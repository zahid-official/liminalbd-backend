import status from "http-status";
import type { Prisma, User } from "../../../generated/prisma/client.js";
import { AuditAction, AuditEntityType, UserStatus } from "../../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import { AuditService } from "../audit/audit.service.js";
import type { UpdateUserStatusInput } from "./accountStatus.interface.js";

// Worker: Executes database queries using the given transaction client
const executeUpdate = async (
  tx: Prisma.TransactionClient,
  input: UpdateUserStatusInput,
): Promise<User> => {
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
  await AuditService.record({
    actorId: input.actorId ?? null,
    action,
    entityType: AuditEntityType.USER,
    entityId: input.targetUserId,
    previousValue: { status: targetUser.status },
    newValue: { status: input.newStatus },
    metadata: input.reason ? { reason: input.reason } : null,
    tx,
  });

  return updatedUser;
};

// Coordinator: Manages transaction boundary
const updateStatus = async (input: UpdateUserStatusInput): Promise<User> => {
  if (input.tx) {
    return await executeUpdate(input.tx, input);
  }
  
  return await prisma.$transaction((tx) => executeUpdate(tx, input));
};

// Export account status service
export const AccountStatusService = {
  updateStatus,
};
