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
import {
  type BuildPrismaQueryOptions,
  buildPaginationMeta,
  buildPrismaQuery,
} from "../../utils/queryBuilder.js";
import { ADMIN_SEARCHABLE_FIELDS } from "./admin.constant.js";
import type {
  CreateAdminInput,
  GetAdminsInput,
  UpdateAdminInput,
} from "./admin.interface.js";
import type { UpdateAdminBody } from "./admin.validation.js";

// Map user status transitions to semantic audit actions
const STATUS_AUDIT_ACTION_MAP: Record<UserStatus, AuditAction> = {
  [UserStatus.ACTIVE]: AuditAction.REACTIVATE,
  [UserStatus.SUSPENDED]: AuditAction.SUSPEND,
  [UserStatus.DEACTIVATED]: AuditAction.DEACTIVATE,
};

// Resolve granular audit action based on mutated attributes
const resolveAuditAction = (payload: UpdateAdminBody): AuditAction => {
  if (payload.role && !payload.status) {
    return AuditAction.ROLE_CHANGE;
  }

  if (payload.status && !payload.role) {
    return STATUS_AUDIT_ACTION_MAP[payload.status];
  }

  return AuditAction.UPDATE;
};

// Create Admin account
const createAdmin = async ({ actorId, actorRole, payload }: CreateAdminInput) => {
  if (actorRole !== UserRole.SUPER_ADMIN) {
    await AuditService.record({
      actorId,
      action: AuditAction.UNAUTHORIZED_ATTEMPT,
      entityType: AuditEntityType.ADMIN,
      metadata: {
        attemptedAction: "CREATE_ADMIN",
        attemptedRole: UserRole.ADMIN,
        reason: "FORBIDDEN_ROLE_ACCESS",
      },
    });

    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Only Super Admin can create an Admin account",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
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
      data: { userId },
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
      contactNumber: adminProfile.contactNumber,
      address: adminProfile.address,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  });

  return result;
};

// Update Admin account
const updateAdmin = async ({ actorId, actorRole, targetId, payload }: UpdateAdminInput) => {
  if (actorRole !== UserRole.SUPER_ADMIN) {
    await AuditService.record({
      actorId,
      action: AuditAction.UNAUTHORIZED_ATTEMPT,
      entityType: AuditEntityType.ADMIN,
      entityId: targetId,
      metadata: {
        attemptedAction: "UPDATE_ADMIN",
        attemptedPayload: payload,
        reason: "FORBIDDEN_ROLE_ACCESS",
      },
    });

    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Only Super Admin can update an Admin account",
    );
  }

  // Prevent self-role mutation and self-lockout
  if (actorId === targetId) {
    if (payload.role !== undefined) {
      await AuditService.record({
        actorId,
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        entityType: AuditEntityType.ADMIN,
        entityId: targetId,
        metadata: {
          attemptedAction: "SELF_ROLE_MUTATION",
          attemptedRole: payload.role,
          reason: "SELF_ROLE_MUTATION_FORBIDDEN",
        },
      });

      throw new AppError(
        status.BAD_REQUEST,
        PUBLIC_ERROR_CODES.VALIDATION_ERROR,
        "Super Admin cannot modify their own role",
      );
    }

    if (payload.status && payload.status !== UserStatus.ACTIVE) {
      await AuditService.record({
        actorId,
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        entityType: AuditEntityType.ADMIN,
        entityId: targetId,
        metadata: {
          attemptedAction: "SELF_LOCKOUT_ATTEMPT",
          attemptedStatus: payload.status,
          reason: "SELF_LOCKOUT_FORBIDDEN",
        },
      });

      throw new AppError(
        status.BAD_REQUEST,
        PUBLIC_ERROR_CODES.VALIDATION_ERROR,
        "Super Admin cannot suspend or deactivate their own account",
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
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

    // Build selective update payload for provided attributes
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

    // Invalidate active sessions when restricting account access
    if (
      payload.status === UserStatus.SUSPENDED ||
      payload.status === UserStatus.DEACTIVATED
    ) {
      await tx.session.deleteMany({
        where: { userId: targetId },
      });
    }

    // Record audit trail with previous and new attribute values
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
      action: resolveAuditAction(payload),
      entityType: AuditEntityType.ADMIN,
      entityId: targetId,
      previousValue,
      newValue,
      tx,
    });

    const updatedAt =
      targetUser.admin && targetUser.admin.updatedAt > updatedUser.updatedAt
        ? targetUser.admin.updatedAt
        : updatedUser.updatedAt;

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
      role: updatedUser.role,
      status: updatedUser.status,
      needPasswordChange: updatedUser.needPasswordChange,
      contactNumber: targetUser.admin?.contactNumber,
      address: targetUser.admin?.address,
      createdAt: updatedUser.createdAt,
      updatedAt,
    };
  });

  return result;
};

// Retrieve paginated Admin accounts
const getAdmins = async ({ actorId, actorRole, query }: GetAdminsInput) => {
  if (actorRole !== UserRole.SUPER_ADMIN) {
    await AuditService.record({
      actorId,
      action: AuditAction.UNAUTHORIZED_ATTEMPT,
      entityType: AuditEntityType.ADMIN,
      metadata: {
        attemptedAction: "GET_ADMINS",
        attemptedRole: actorRole,
        reason: "FORBIDDEN_ROLE_ACCESS",
      },
    });

    throw new AppError(
      status.FORBIDDEN,
      PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      "Only Super Admin can list Admin accounts",
    );
  }

  // Assemble query options for pagination, sorting and search
  const queryOptions: BuildPrismaQueryOptions = {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    searchableFields: ADMIN_SEARCHABLE_FIELDS,
  };

  if (query.searchTerm) {
    queryOptions.searchTerm = query.searchTerm;
  }

  const { skip, take, orderBy, searchFilter, page, limit } = buildPrismaQuery(queryOptions);

  // Assemble query filters excluding soft-deleted and non-admin users
  const where: Prisma.UserWhereInput = {
    role: UserRole.ADMIN,
    deletedAt: null,
    ...searchFilter,
  };

  if (query.status) {
    where.status = query.status;
  }

  const [admins, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { admin: true },
    }),
    prisma.user.count({ where }),
  ]);

  const formattedAdmins = admins.map((adminUser) => {
    const updatedAt =
      adminUser.admin && adminUser.admin.updatedAt > adminUser.updatedAt
        ? adminUser.admin.updatedAt
        : adminUser.updatedAt;

    return {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      emailVerified: adminUser.emailVerified,
      role: adminUser.role,
      status: adminUser.status,
      needPasswordChange: adminUser.needPasswordChange,
      contactNumber: adminUser.admin?.contactNumber,
      address: adminUser.admin?.address,
      createdAt: adminUser.createdAt,
      updatedAt,
    };
  });

  return {
    data: formattedAdmins,
    meta: buildPaginationMeta(page, limit, total),
  };
};

// Export Admin service
export const AdminService = {
  createAdmin,
  updateAdmin,
  getAdmins,
};
