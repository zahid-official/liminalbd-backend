import status from "http-status";
import { UserRole } from "../../../generated/prisma/enums.js";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import type { RegisterCustomerInput } from "./customer.interface.js";

// Register customer account
const registerCustomer = async ({
  headers,
  payload,
}: RegisterCustomerInput) => {
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

// Retrieve customer by ID (Admin only)
const getCustomerById = async (customerId: string) => {
  const targetUser = await prisma.user.findUnique({
    where: { id: customerId },
    include: { customer: true },
  });

  if (
    !targetUser ||
    targetUser.role !== UserRole.CUSTOMER ||
    targetUser.deletedAt !== null
  ) {
    throw new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.USER_NOT_FOUND,
      "Customer not found",
    );
  }

  // Accurately reflect the latest modification timestamp across user identity and customer profile
  const updatedAt =
    targetUser.customer && targetUser.customer.updatedAt > targetUser.updatedAt
      ? targetUser.customer.updatedAt
      : targetUser.updatedAt;

  return {
    id: targetUser.id,
    name: targetUser.name,
    email: targetUser.email,
    emailVerified: targetUser.emailVerified,
    image: targetUser.image,
    role: targetUser.role,
    status: targetUser.status,
    contactNumber: targetUser.customer?.contactNumber,
    address: targetUser.customer?.address,
    createdAt: targetUser.createdAt,
    updatedAt,
  };
};

// Export customer service
export const CustomerService = {
  registerCustomer,
  getCustomerById,
};
