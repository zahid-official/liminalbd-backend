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
import type {
  CreateAdminServiceInput,
  UpdateAdminServiceInput,
} from "./admin.interface.js";
import type { CreateAdminInput, UpdateAdminInput } from "./admin.validation.js";

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

// Execute Admin account update
const executeUpdateAdmin = async (
  tx: Prisma.TransactionClient,
  actorId: string,
  targetId: string,
  payload: UpdateAdminInput,
) => {
  const targetUser = await tx.user.findUnique({
    where: { id: targetId },
    include: { admin: true },
  });

  if (
    !targetUser ||
    targetUser.deletedAt ||
    targetUser.role === UserRole.CUSTOMER
  ) {
    throw new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.USER_NOT_FOUND,
      "Admin user not found",
    );
  }

  // Prepare update data
  const updateData: Prisma.UserUpdateInput = {};
  if (payload.role) {
    updateData.role = payload.role;
  }
  if (payload.status) {
    updateData.status = payload.status;
  }

  const updatedUser = await tx.user.update({
    where: { id: targetId },
    data: updateData,
  });

  // Invalidate active sessions if account status is restricted
  if (
    payload.status === UserStatus.SUSPENDED ||
    payload.status === UserStatus.DEACTIVATED
  ) {
    await tx.session.deleteMany({
      where: { userId: targetId },
    });
  }

  // Record audit trail with before and after changes
  const previousValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};

  if (payload.role !== undefined) {
    previousValue.role = targetUser.role;
    newValue.role = updatedUser.role;
  }
  if (payload.status !== undefined) {
    previousValue.status = targetUser.status;
    newValue.status = updatedUser.status;
  }

  await AuditService.record({
    actorId,
    action: AuditAction.UPDATE,
    entityType: AuditEntityType.ADMIN,
    entityId: targetId,
    previousValue,
    newValue,
    metadata: {
      updatedVia: "SUPER_ADMIN_MANAGEMENT",
    },
    tx,
  });

  // Prepare Admin profile for response
  const adminProfile = targetUser.admin
    ? {
        contactNumber: targetUser.admin.contactNumber,
        address: targetUser.admin.address,
        createdAt: targetUser.admin.createdAt,
        updatedAt: targetUser.admin.updatedAt,
      }
    : null;

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    emailVerified: updatedUser.emailVerified,
    role: updatedUser.role,
    status: updatedUser.status,
    needPasswordChange: updatedUser.needPasswordChange,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt,
    admin: adminProfile,
  };
};

// Update Admin account
const updateAdmin = async (input: UpdateAdminServiceInput) => {
  const { actorId, actorRole, targetId, payload, tx } = input;

  if (actorRole !== UserRole.SUPER_ADMIN) {
    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Only Super Admin can update an Admin account",
    );
  }

  if (actorId === targetId && payload.role !== undefined) {
    throw new AppError(
      status.BAD_REQUEST,
      PUBLIC_ERROR_CODES.VALIDATION_ERROR,
      "Super Admin cannot modify their own role",
    );
  }

  if (tx) {
    return executeUpdateAdmin(tx, actorId, targetId, payload);
  }

  return prisma.$transaction((txClient) =>
    executeUpdateAdmin(txClient, actorId, targetId, payload),
  );
};

// Export Admin service
export const AdminService = {
  createAdmin,
  updateAdmin,
};
