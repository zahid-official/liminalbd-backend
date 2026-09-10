import status from "http-status";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import type {
  RegisterCustomerInput,
  SendVerificationOtpInput,
  VerifyEmailOtpInput,
} from "./auth.validation.js";

// Register public customer account and persist associated customer profile
const registerCustomer = async (payload: RegisterCustomerInput) => {
  const { name, email, password } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
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

  // Create Customer profile with compensating rollback if profile creation fails
  try {
    const customerProfile = await prisma.customer.create({
      data: {
        userId: authResult.user.id,
      },
    });

    const result = {
      id: authResult.user.id,
      name: authResult.user.name,
      email: authResult.user.email,
      emailVerified: authResult.user.emailVerified,
      role: authResult.user.role,
      status: authResult.user.status,
      contactNumber: customerProfile.contactNumber,
      address: customerProfile.address,
      createdAt: customerProfile.createdAt,
    };

    return result;
  } catch (error) {
    // Compensating action: remove orphan User if customer profile creation fails
    await prisma.user.delete({
      where: {
        id: authResult.user.id,
      },
    });

    throw error;
  }
};

// Generate and dispatch a fresh 6-digit email verification OTP
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

// Verify 6-digit OTP and activate user account
const verifyEmailOtp = async (payload: VerifyEmailOtpInput) => {
  const { email, otp } = payload;

  // Verify OTP with Better Auth emailOTP plugin
  try {
    const result = await auth.api.verifyEmailOTP({
      body: {
        email,
        otp,
      },
    });

    if (!result?.status) {
      throw new AppError(
        status.BAD_REQUEST,
        PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP,
        "Invalid or expired verification code",
      );
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      status.BAD_REQUEST,
      PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP,
      "Invalid or expired verification code",
    );
  }

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

const AuthService = {
  registerCustomer,
  sendVerificationOtp,
  verifyEmailOtp,
};

export { AuthService };
