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
const updateStatus = async ({
  actorId,
  targetUserId,
  newStatus,
  reason,
}: UpdateUserStatusInput): Promise<User> => {
  const result = await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      throw new AppError(
        status.NOT_FOUND,
        PUBLIC_ERROR_CODES.USER_NOT_FOUND,
        "User not found",
      );
    }

    if (targetUser.status === newStatus) {
      throw new AppError(
        status.BAD_REQUEST,
        PUBLIC_ERROR_CODES.VALIDATION_ERROR,
        `User account is already ${newStatus.toLowerCase()}`,
      );
    }

    const updatedUser = await tx.user.update({
      where: { id: targetUserId },
      data: { status: newStatus },
    });

    // Invalidate all active sessions if restricting account access
    if (
      newStatus === UserStatus.SUSPENDED ||
      newStatus === UserStatus.DEACTIVATED
    ) {
      await tx.session.deleteMany({
        where: { userId: targetUserId },
      });
    }

    let action: AuditAction = AuditAction.REACTIVATE;
    if (newStatus === UserStatus.SUSPENDED) {
      action = AuditAction.SUSPEND;
    } else if (newStatus === UserStatus.DEACTIVATED) {
      action = AuditAction.DEACTIVATE;
    }

    // Persist audit record atomically within the same transaction
    const auditData: CreateAuditLogInput = {
      action,
      entityType: AuditEntityType.USER,
      entityId: targetUserId,
      previousValue: { status: targetUser.status },
      newValue: { status: newStatus },
      tx,
    };

    if (actorId) {
      auditData.actorId = actorId;
    }
    if (reason) {
      auditData.metadata = { reason };
    }

    await AuditService.record(auditData);
    return updatedUser;
  });

  return result;
};

// Soft-delete user account
const softDelete = async ({
  actorId,
  targetUserId,
  reason,
}: SoftDeleteUserInput): Promise<User> => {
  const result = await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { id: targetUserId },
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
      where: { id: targetUserId },
      data: { deletedAt: new Date() },
    });

    // Invalidate all active sessions for the soft-deleted account
    await tx.session.deleteMany({
      where: { userId: targetUserId },
    });

    // Persist audit record atomically within the same transaction
    const auditData: CreateAuditLogInput = {
      action: AuditAction.SOFT_DELETE,
      entityType: AuditEntityType.USER,
      entityId: targetUserId,
      previousValue: { deletedAt: targetUser.deletedAt },
      newValue: { deletedAt: updatedUser.deletedAt },
      tx,
    };

    if (actorId) {
      auditData.actorId = actorId;
    }
    if (reason) {
      auditData.metadata = { reason };
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
