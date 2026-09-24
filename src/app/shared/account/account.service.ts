import status from "http-status";
import type { Prisma, User } from "../../../generated/prisma/client.js";
import {
  AuditAction,
  AuditEntityType,
  UserStatus,
} from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import type { CreateAuditLogInput } from "../audit/audit.interface.js";
import { AuditService } from "../audit/audit.service.js";
import type {
  SoftDeleteUserInput,
  UpdateUserStatusInput,
} from "./account.interface.js";

// Standard query filter for active, non-deleted users
export const activeUserFilter: Prisma.UserWhereInput = {
  deletedAt: null,
  status: UserStatus.ACTIVE,
};

// Standard query filter for non-deleted users
export const nonDeletedUserFilter: Prisma.UserWhereInput = {
  deletedAt: null,
};

// Update user account status
const updateStatus = async (input: UpdateUserStatusInput): Promise<User> => {
  const result = await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      throw new AppError(
        status.NOT_FOUND,
        PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        "User not found",
      );
    }

    if (targetUser.status === input.newStatus) {
      throw new AppError(
        status.BAD_REQUEST,
        PUBLIC_ERROR_CODES.VALIDATION_ERROR,
        `User account is already ${input.newStatus.toLowerCase()}`,
      );
    }

    const updatedUser = await tx.user.update({
      where: { id: input.targetUserId },
      data: { status: input.newStatus },
    });

    // Invalidate all active sessions if restricting account access
    if (
      input.newStatus === UserStatus.SUSPENDED ||
      input.newStatus === UserStatus.DEACTIVATED
    ) {
      await tx.session.deleteMany({
        where: { userId: input.targetUserId },
      });
    }

    let action: AuditAction = AuditAction.REACTIVATE;
    if (input.newStatus === UserStatus.SUSPENDED) {
      action = AuditAction.SUSPEND;
    } else if (input.newStatus === UserStatus.DEACTIVATED) {
      action = AuditAction.DEACTIVATE;
    }

    // Persist audit record atomically within the same transaction
    const auditData: CreateAuditLogInput = {
      action,
      entityType: AuditEntityType.USER,
      entityId: input.targetUserId,
      previousValue: { status: targetUser.status },
      newValue: { status: input.newStatus },
      tx,
    };

    if (input.actorId) {
      auditData.actorId = input.actorId;
    }
    if (input.reason) {
      auditData.metadata = { reason: input.reason };
    }

    await AuditService.record(auditData);
    return updatedUser;
  });

  return result;
};

// Soft-delete user account
const softDelete = async (input: SoftDeleteUserInput): Promise<User> => {
  const result = await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      throw new AppError(
        status.NOT_FOUND,
        PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        "User not found",
      );
    }

    const updatedUser = await tx.user.update({
      where: { id: input.targetUserId },
      data: { deletedAt: new Date() },
    });

    // Invalidate all active sessions for the soft-deleted account
    await tx.session.deleteMany({
      where: { userId: input.targetUserId },
    });

    // Persist audit record atomically within the same transaction
    const auditData: CreateAuditLogInput = {
      action: AuditAction.SOFT_DELETE,
      entityType: AuditEntityType.USER,
      entityId: input.targetUserId,
      previousValue: { deletedAt: targetUser.deletedAt },
      newValue: { deletedAt: updatedUser.deletedAt },
      tx,
    };

    if (input.actorId) {
      auditData.actorId = input.actorId;
    }
    if (input.reason) {
      auditData.metadata = { reason: input.reason };
    }

    await AuditService.record(auditData);
    return updatedUser;
  });

  return result;
};

// Export account service
export const AccountService = {
  updateStatus,
  softDelete,
};
