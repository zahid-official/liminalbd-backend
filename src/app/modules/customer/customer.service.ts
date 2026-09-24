import status from "http-status";
import { AuditEntityType, UserRole } from "../../../generated/prisma/enums.js";
import { auth } from "../../config/auth.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import { AuthorizationService } from "../../shared/authorization/authorization.service.js";
import type { GetCustomerProfileServiceInput } from "./customer.interface.js";
import type { RegisterCustomerInput } from "./customer.validation.js";

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

// Retrieve customer profile by ID
const getCustomerProfile = async (input: GetCustomerProfileServiceInput) => {
  const { actorId, actorRole, targetId } = input;

  const targetUser = await prisma.user.findFirst({
    where: {
      id: targetId,
      role: UserRole.CUSTOMER,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          contactNumber: true,
          address: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!targetUser) {
    throw new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.USER_NOT_FOUND,
      "Customer not found",
    );
  }

  // Authorize resource ownership and administrative access
  await AuthorizationService.authorizeOwnership({
    actorId,
    actorRole,
    resourceOwnerId: targetUser.id,
    resourceType: AuditEntityType.CUSTOMER,
    resourceId: targetUser.id,
    action: "GET_CUSTOMER_PROFILE",
    policy: {
      allowAdmin: true,
      allowSuperAdmin: true,
    },
  });

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
    contactNumber: targetUser.customer?.contactNumber ?? null,
    address: targetUser.customer?.address ?? null,
    createdAt: targetUser.createdAt,
    updatedAt,
  };
};

// Export customer service
export const CustomerService = {
  registerCustomer,
  getCustomerProfile,
};
