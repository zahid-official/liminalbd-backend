import status from "http-status";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import type { RegisterCustomerInput } from "./auth.validation.js";

// Register public customer account and persist associated customer profile
const registerCustomer = async (payload: RegisterCustomerInput) => {
  const { name, email, password } = payload;

  // 1. Reject duplicate email case-insensitively
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

  // 2. Create User and Account via Better Auth internal API
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

  // 3. Create Customer profile with compensating rollback if profile creation fails
  try {
    const customerProfile = await prisma.customer.create({
      data: {
        userId: authResult.user.id,
      },
    });

    // 4. Return sanitized public customer response
    return {
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
  } catch (error) {
    // Compensating action: remove orphan User & Account if customer profile fails
    await prisma.user.delete({
      where: {
        id: authResult.user.id,
      },
    });

    throw error;
  }
};

export const AuthService = {
  registerCustomer,
};
