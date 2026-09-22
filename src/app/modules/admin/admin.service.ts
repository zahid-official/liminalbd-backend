import { hashPassword } from "better-auth/crypto";
import status from "http-status";
import crypto from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  AuditAction,
  AuditEntityType,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import { AuditService } from "../../shared/audit/audit.service.js";
import type { CreateAdminInput } from "./admin.validation.js";

// Input contract for creating an Admin account
export interface CreateAdminServiceInput {
  actorId: string;
  actorRole: UserRole;
  payload: CreateAdminInput;
  tx?: Prisma.TransactionClient;
}

// Execute Admin account creation
const executeCreateAdmin = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  payload: CreateAdminInput,
) => {
  const { name, email, password } = payload;

  const existingUser = await tx.user.findUnique({
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

  // Hash initial password using Better Auth's timing-equalized crypto utility
  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();

  const user = await tx.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: true,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      needPasswordChange: true,
    },
  });

  // Link credential account for Better Auth authentication
  await tx.account.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  // Initialize linked Admin profile record
  const adminProfile = await tx.admin.create({
    data: {
      userId,
      contactNumber: null,
      address: null,
    },
  });

  // Record privileged account creation in audit log
  await AuditService.record({
    actorId,
    action: AuditAction.CREATE,
    entityType: AuditEntityType.ADMIN,
    entityId: userId,
    newValue: {
      id: userId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      needPasswordChange: user.needPasswordChange,
    },
    metadata: {
      createdVia: "SUPER_ADMIN_PROVISIONING",
    },
    tx,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role,
    status: user.status,
    needPasswordChange: user.needPasswordChange,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    admin: {
      contactNumber: adminProfile.contactNumber,
      address: adminProfile.address,
      createdAt: adminProfile.createdAt,
      updatedAt: adminProfile.updatedAt,
    },
  };
};

// Create Admin account
const createAdmin = async (input: CreateAdminServiceInput) => {
  const { actorId, actorRole, payload, tx } = input;

  if (actorRole !== UserRole.SUPER_ADMIN) {
    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Only Super Admin can create an Admin account",
    );
  }

  if (tx) {
    return executeCreateAdmin(tx, actorId, payload);
  }

  return prisma.$transaction((txClient) =>
    executeCreateAdmin(txClient, actorId, payload),
  );
};

// Export Admin service
export const AdminService = {
  createAdmin,
};
