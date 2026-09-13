import status from "http-status";
import { UserStatus } from "../../../generated/prisma/enums.js";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import type {
  LoginWithCredentialsInput,
  RegisterCustomerInput,
  SendVerificationOtpInput,
  VerifyEmailOtpInput,
} from "./auth.validation.js";

// Helper to safely rollback orphan user without shadowing the primary failure
const rollbackOrphanUser = async (userId: string, primaryError: unknown) => {
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
const registerCustomer = async (payload: RegisterCustomerInput) => {
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
    throw error;
  }

  // Dispatch verification OTP only after account and customer profile are committed
  await auth.api.sendVerificationOTP({
    body: {
      email,
      type: "email-verification",
    },
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
const sendVerificationOtp = async (payload: SendVerificationOtpInput) => {
  const { email } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (!existingUser) {
    throw new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.USER_NOT_FOUND,
      "No account found with this email address",
    );
  }

  if (existingUser.emailVerified) {
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
  });

  return {
    email,
  };
};

// Verify email OTP
const verifyEmailOtp = async (payload: VerifyEmailOtpInput) => {
  const { email, otp } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (!existingUser) {
    throw new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.USER_NOT_FOUND,
      "No account found with this email address",
    );
  }

  if (existingUser.emailVerified) {
    throw new AppError(
      status.BAD_REQUEST,
      PUBLIC_ERROR_CODES.ALREADY_VERIFIED,
      "Your account is already verified. Please sign in.",
    );
  }

  await auth.api.verifyEmailOTP({
    body: {
      email,
      otp,
    },
  });

  // Synchronize database state ensuring emailVerified is set to true
  const updatedUser = await prisma.user.update({
    where: { email },
    data: {
      emailVerified: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      status: true,
    },
  });

  return updatedUser;
};

// Login user with email and password credentials
const loginWithCredentials = async (
  payload: LoginWithCredentialsInput,
  headers: Headers,
) => {
  const { email, password } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      status: true,
      deletedAt: true,
    },
  });

  // Prevent email enumeration for missing or soft-deleted accounts
  if (!existingUser || existingUser.deletedAt !== null) {
    throw new AppError(
      status.UNAUTHORIZED,
      PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
      "Invalid email or password",
    );
  }

  if (!existingUser.emailVerified) {
    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.EMAIL_NOT_VERIFIED,
      "Please verify your email before logging in",
    );
  }

  if (existingUser.status === UserStatus.SUSPENDED) {
    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED,
      "Your account has been suspended. Please contact support.",
    );
  }

  if (existingUser.status === UserStatus.DEACTIVATED) {
    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED,
      "Your account is deactivated. Please contact support.",
    );
  }

  const { headers: authHeaders, response: authResult } =
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers,
      returnHeaders: true,
    });

  const setCookie = authHeaders.get("set-cookie");

  return {
    user: {
      id: authResult.user.id,
      name: authResult.user.name,
      email: authResult.user.email,
      emailVerified: authResult.user.emailVerified,
      role: authResult.user.role,
      status: authResult.user.status,
    },
    setCookie,
  };
};

// Export auth service
export const AuthService = {
  registerCustomer,
  sendVerificationOtp,
  verifyEmailOtp,
  loginWithCredentials,
};
