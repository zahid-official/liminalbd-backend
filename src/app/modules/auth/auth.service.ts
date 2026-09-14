import status from "http-status";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { UserRole } from "../../../generated/prisma/enums.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import { env } from "../../config/env.js";
import type {
  LoginWithCredentialsInput,
  RegisterCustomerInput,
  SendVerificationOtpInput,
  VerifyEmailOtpInput,
} from "./auth.validation.js";

// Helper to safely rollback orphan user without shadowing the primary failure
const rollbackOrphanUser = async (userId: string, primaryError: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Customer profile creation failed, rolling back orphan user:", {
    userId,
    primaryError,
  });

  try {
    await prisma.user.delete({
      where: { id: userId },
    });
  } catch (rollbackError) {
    // eslint-disable-next-line no-console
    console.error(
      "Critical: Failed to rollback orphan user during customer profile creation failure:",
      {
        userId,
        primaryError,
        rollbackError,
      },
    );
  }
};

// Register customer account
const registerCustomer = async (
  payload: RegisterCustomerInput,
  headers: Headers,
) => {
  const { name, email, password } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError(
      status.CONFLICT,
      PUBLIC_ERROR_CODES.USER_ALREADY_EXISTS,
      "User with this email already exists",
    );
  }

  const authResult = await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
    },
    headers,
  });

  if (!authResult?.user) {
    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
      "Failed to register user account",
    );
  }

  // Create Customer profile with compensating rollback
  try {
    await prisma.customer.create({
      data: {
        userId: authResult.user.id,
      },
    });
  } catch (error) {
    await rollbackOrphanUser(authResult.user.id, error);

    throw new AppError(
      status.INTERNAL_SERVER_ERROR,
      PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
      "Failed to complete customer registration",
    );
  }

  // Dispatch verification OTP only after account and customer profile are committed
  await auth.api.sendVerificationOTP({
    body: {
      email,
      type: "email-verification",
    },
    headers,
  });

  return {
    id: authResult.user.id,
    name: authResult.user.name,
    email: authResult.user.email,
    emailVerified: authResult.user.emailVerified,
    role: authResult.user.role,
    status: authResult.user.status,
    createdAt: authResult.user.createdAt,
  };
};

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
  const callbackURL = redirectTo
    ? `${env.FRONTEND_URL}${redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`}`
    : `${env.FRONTEND_URL}/dashboard`;

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

// Export auth service
export const AuthService = {
  registerCustomer,
  sendVerificationOtp,
  verifyEmailOtp,
  loginWithCredentials,
  loginWithGoogle,
};
