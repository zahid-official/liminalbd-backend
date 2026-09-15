import status from "http-status";
import { UserRole } from "../../../generated/prisma/enums.js";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import { resolveCallbackURL } from "../../utils/resolveCallbackURL.js";
import type {
  ForgotPasswordInput,
  LoginWithCredentialsInput,
  ResetPasswordInput,
  SendVerificationOtpInput,
  VerifyEmailOtpInput,
} from "./auth.validation.js";

// Send verification OTP to user's email
const sendVerificationOtp = async (
  payload: SendVerificationOtpInput,
  headers: Headers,
) => {
  const { email } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (existingUser?.emailVerified) {
    throw new AppError(
      status.BAD_REQUEST,
      PUBLIC_ERROR_CODES.ALREADY_VERIFIED,
      "Your account is already verified. Please sign in.",
    );
  }

  await auth.api.sendVerificationOTP({
    body: {
      email,
      type: "email-verification",
    },
    headers,
  });

  return {
    email,
  };
};

// Verify email OTP
const verifyEmailOtp = async (
  payload: VerifyEmailOtpInput,
  headers: Headers,
) => {
  const { email, otp } = payload;

  const { headers: authHeaders, response: authResult } =
    await auth.api.verifyEmailOTP({
      body: {
        email,
        otp,
      },
      headers,
      returnHeaders: true,
    });

  const setCookies = authHeaders.getSetCookie();

  return {
    user: {
      id: authResult.user.id,
      name: authResult.user.name,
      email: authResult.user.email,
      emailVerified: authResult.user.emailVerified,
      role: authResult.user.role,
      status: authResult.user.status,
    },
    setCookies,
  };
};

// Login user with email and password credentials
const loginWithCredentials = async (
  payload: LoginWithCredentialsInput,
  headers: Headers,
) => {
  const { email, password } = payload;

  const { headers: authHeaders, response: authResult } =
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers,
      returnHeaders: true,
    });

  // Enforce customer portal boundary (DEC-020)
  if (authResult.user.role !== UserRole.CUSTOMER) {
    if (authResult.token) {
      await prisma.session.deleteMany({
        where: { token: authResult.token },
      });
    }

    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Access denied. This login portal is reserved for customers.",
    );
  }

  return {
    user: {
      id: authResult.user.id,
      name: authResult.user.name,
      email: authResult.user.email,
      emailVerified: authResult.user.emailVerified,
      role: authResult.user.role,
      status: authResult.user.status,
    },
    setCookies: authHeaders.getSetCookie(),
  };
};

// Initialize Google OAuth sign-in flow
const loginWithGoogle = async (headers: Headers, redirectTo?: string) => {
  const callbackURL = resolveCallbackURL(redirectTo, "/dashboard");

  const { headers: authHeaders, response: authResult } =
    await auth.api.signInSocial({
      body: {
        provider: "google",
        callbackURL,
      },
      headers,
      returnHeaders: true,
    });

  return {
    url: authResult.url,
    redirect: authResult.redirect,
    setCookies: authHeaders.getSetCookie(),
  };
};

// Link Google account for authenticated user
const linkGoogleAccount = async (
  userId: string,
  role: string | null | undefined,
  headers: Headers,
  redirectTo?: string,
) => {
  // Enforce customer portal boundary (DEC-020)
  if (role !== UserRole.CUSTOMER) {
    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Access denied. Administrative accounts cannot link or use Google sign-in.",
    );
  }

  // Check if user already has a linked Google account
  const existingGoogleAccount = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "google",
    },
    select: { id: true },
  });

  if (existingGoogleAccount) {
    throw new AppError(
      status.CONFLICT,
      PUBLIC_ERROR_CODES.ACCOUNT_ALREADY_LINKED,
      "A Google account is already linked to your profile.",
    );
  }

  const callbackURL = resolveCallbackURL(redirectTo, "/profile");

  const { headers: authHeaders, response: authResult } =
    await auth.api.linkSocialAccount({
      body: {
        provider: "google",
        callbackURL,
      },
      headers,
      returnHeaders: true,
    });

  return {
    url: authResult.url,
    redirect: authResult.redirect,
    setCookies: authHeaders.getSetCookie(),
  };
};

// Unlink Google account from authenticated user
const unlinkGoogleAccount = async (userId: string) => {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: {
      id: true,
      providerId: true,
      password: true,
    },
  });

  const googleAccount = accounts.find(
    (account) => account.providerId === "google",
  );
  if (!googleAccount) {
    throw new AppError(
      status.BAD_REQUEST,
      PUBLIC_ERROR_CODES.ACCOUNT_NOT_LINKED,
      "No linked Google account was found on your profile.",
    );
  }

  // Prevent removal of sole authentication method (FR-AUTH-003.4)
  const hasAlternativeAuth = accounts.some(
    (account) =>
      account.providerId !== "google" &&
      (account.providerId !== "credential" || Boolean(account.password)),
  );

  if (!hasAlternativeAuth) {
    throw new AppError(
      status.UNPROCESSABLE_ENTITY,
      PUBLIC_ERROR_CODES.CANNOT_UNLINK_SOLE_METHOD,
      "Cannot unlink your only authentication method. Please set a password first.",
    );
  }

  await prisma.account.delete({
    where: { id: googleAccount.id },
  });

  return {
    message: "Google account unlinked successfully.",
  };
};

// Forgot password request
const forgotPassword = async (
  payload: ForgotPasswordInput,
  headers: Headers,
) => {
  const { email, redirectTo } = payload;
  const resetCallbackURL = resolveCallbackURL(redirectTo, "/reset-password");

  await auth.api.requestPasswordReset({
    body: {
      email,
      redirectTo: resetCallbackURL,
    },
    headers,
  });

  return {
    message:
      "If an account with that email exists, password reset instructions have been sent.",
  };
};

// Reset user password with single-use token
const resetPassword = async (payload: ResetPasswordInput, headers: Headers) => {
  const { token, newPassword } = payload;

  const { headers: authHeaders } = await auth.api.resetPassword({
    body: {
      token,
      newPassword,
    },
    headers,
    returnHeaders: true,
  });

  const setCookies = authHeaders ? authHeaders.getSetCookie() : [];

  return {
    message:
      "Password has been reset successfully. Please log in with your new password.",
    setCookies,
  };
};

// Export auth service
export const AuthService = {
  sendVerificationOtp,
  verifyEmailOtp,
  loginWithCredentials,
  loginWithGoogle,
  linkGoogleAccount,
  unlinkGoogleAccount,
  forgotPassword,
  resetPassword,
};
