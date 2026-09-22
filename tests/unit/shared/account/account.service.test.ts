import status from "http-status";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../src/app/config/prisma.js";
import type { Prisma, User } from "../../../../src/generated/prisma/client.js";
import {
  AuditAction,
  AuditEntityType,
  UserRole,
  UserStatus,
} from "../../../../src/generated/prisma/enums.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import {
  AccountService,
  activeUserFilter,
  nonDeletedUserFilter,
} from "../../../../src/app/shared/account/account.service.js";
import { AuditService } from "../../../../src/app/shared/audit/audit.service.js";

describe("AccountService Unit Tests", () => {
  const mockTargetUser: User = {
    id: "user-target-123",
    name: "John Doe",
    email: "john@example.com",
    emailVerified: true,
    image: null,
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    needPasswordChange: false,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  let mockTx: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    session: {
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockTx = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
      },
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback: any) => {
      return await callback(mockTx as unknown as Prisma.TransactionClient);
    });

    vi.spyOn(AuditService, "record").mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("updateStatus", () => {
    describe("Happy Path Execution", () => {
      it("should update status to SUSPENDED, invalidate sessions, and record audit log with default transaction", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        });

        const updatedUser: User = {
          ...mockTargetUser,
          status: UserStatus.SUSPENDED,
        };
        mockTx.user.update.mockResolvedValue(updatedUser);
        mockTx.session.deleteMany.mockResolvedValue({ count: 2 });

        const result = await AccountService.updateStatus({
          actorId: "admin-actor-1",
          targetUserId: mockTargetUser.id,
          newStatus: UserStatus.SUSPENDED,
          reason: "Suspected fraudulent activity",
        });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockTx.user.findUnique).toHaveBeenCalledWith({
          where: { id: mockTargetUser.id },
          select: { id: true, status: true, deletedAt: true },
        });
        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: mockTargetUser.id },
          data: { status: UserStatus.SUSPENDED },
        });
        expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: mockTargetUser.id },
        });
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "admin-actor-1",
          action: AuditAction.SUSPEND,
          entityType: AuditEntityType.USER,
          entityId: mockTargetUser.id,
          previousValue: { status: UserStatus.ACTIVE },
          newValue: { status: UserStatus.SUSPENDED },
          metadata: { reason: "Suspected fraudulent activity" },
          tx: mockTx,
        });
        expect(result).toEqual(updatedUser);
      });

      it("should update status to DEACTIVATED and use caller transaction without calling prisma.$transaction", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        });

        const updatedUser: User = {
          ...mockTargetUser,
          status: UserStatus.DEACTIVATED,
        };
        mockTx.user.update.mockResolvedValue(updatedUser);
        mockTx.session.deleteMany.mockResolvedValue({ count: 1 });

        const externalTx = mockTx as unknown as Prisma.TransactionClient;

        const result = await AccountService.updateStatus({
          actorId: null,
          targetUserId: mockTargetUser.id,
          newStatus: UserStatus.DEACTIVATED,
          tx: externalTx,
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: mockTargetUser.id },
          data: { status: UserStatus.DEACTIVATED },
        });
        expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: mockTargetUser.id },
        });
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: null,
          action: AuditAction.DEACTIVATE,
          entityType: AuditEntityType.USER,
          entityId: mockTargetUser.id,
          previousValue: { status: UserStatus.ACTIVE },
          newValue: { status: UserStatus.DEACTIVATED },
          metadata: null,
          tx: externalTx,
        });
        expect(result).toEqual(updatedUser);
      });

      it("should reactivate user (status ACTIVE) without deleting active sessions", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.SUSPENDED,
          deletedAt: null,
        });

        const reactivatedUser: User = {
          ...mockTargetUser,
          status: UserStatus.ACTIVE,
        };
        mockTx.user.update.mockResolvedValue(reactivatedUser);

        const result = await AccountService.updateStatus({
          actorId: "super-admin-99",
          targetUserId: mockTargetUser.id,
          newStatus: UserStatus.ACTIVE,
          reason: "Identity verified via appeal",
        });

        expect(mockTx.session.deleteMany).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "super-admin-99",
          action: AuditAction.REACTIVATE,
          entityType: AuditEntityType.USER,
          entityId: mockTargetUser.id,
          previousValue: { status: UserStatus.SUSPENDED },
          newValue: { status: UserStatus.ACTIVE },
          metadata: { reason: "Identity verified via appeal" },
          tx: mockTx,
        });
        expect(result).toEqual(reactivatedUser);
      });
    });

    describe("Validation and Error Scenarios", () => {
      it("should throw 404 USER_NOT_FOUND when user does not exist", async () => {
        mockTx.user.findUnique.mockResolvedValue(null);

        await expect(
          AccountService.updateStatus({
            targetUserId: "non-existent-id",
            newStatus: UserStatus.SUSPENDED,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: status.NOT_FOUND,
            code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
            message: "User not found",
          }),
        );

        expect(mockTx.user.update).not.toHaveBeenCalled();
        expect(mockTx.session.deleteMany).not.toHaveBeenCalled();
        expect(AuditService.record).not.toHaveBeenCalled();
      });

      it("should throw 404 USER_NOT_FOUND when user is already soft-deleted", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.ACTIVE,
          deletedAt: new Date("2026-01-01T00:00:00Z"),
        });

        await expect(
          AccountService.updateStatus({
            targetUserId: mockTargetUser.id,
            newStatus: UserStatus.SUSPENDED,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: status.NOT_FOUND,
            code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
            message: "User not found",
          }),
        );

        expect(mockTx.user.update).not.toHaveBeenCalled();
        expect(mockTx.session.deleteMany).not.toHaveBeenCalled();
        expect(AuditService.record).not.toHaveBeenCalled();
      });

      it("should throw 400 VALIDATION_ERROR on redundant status transition (already in requested status)", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.SUSPENDED,
          deletedAt: null,
        });

        await expect(
          AccountService.updateStatus({
            targetUserId: mockTargetUser.id,
            newStatus: UserStatus.SUSPENDED,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: status.BAD_REQUEST,
            code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
            message: "User account is already suspended",
          }),
        );

        expect(mockTx.user.update).not.toHaveBeenCalled();
        expect(mockTx.session.deleteMany).not.toHaveBeenCalled();
        expect(AuditService.record).not.toHaveBeenCalled();
      });

      it("should propagate database update errors to caller", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        });

        const dbError = new Error("Database transaction aborted");
        mockTx.user.update.mockRejectedValue(dbError);

        await expect(
          AccountService.updateStatus({
            targetUserId: mockTargetUser.id,
            newStatus: UserStatus.SUSPENDED,
          }),
        ).rejects.toThrow("Database transaction aborted");
      });
    });
  });

  describe("softDelete", () => {
    describe("Happy Path Execution", () => {
      it("should set deletedAt, invalidate all sessions, and record audit log with default transaction", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        });

        const deletedDate = new Date("2026-09-22T00:00:00Z");
        const softDeletedUser: User = {
          ...mockTargetUser,
          deletedAt: deletedDate,
        };
        mockTx.user.update.mockResolvedValue(softDeletedUser);
        mockTx.session.deleteMany.mockResolvedValue({ count: 3 });

        const result = await AccountService.softDelete({
          actorId: "admin-actor-1",
          targetUserId: mockTargetUser.id,
          reason: "Account closure requested by customer",
        });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockTx.user.findUnique).toHaveBeenCalledWith({
          where: { id: mockTargetUser.id },
          select: { id: true, status: true, deletedAt: true },
        });
        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: mockTargetUser.id },
          data: { deletedAt: expect.any(Date) },
        });
        expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: mockTargetUser.id },
        });
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "admin-actor-1",
          action: AuditAction.SOFT_DELETE,
          entityType: AuditEntityType.USER,
          entityId: mockTargetUser.id,
          previousValue: { deletedAt: null },
          newValue: { deletedAt: deletedDate },
          metadata: { reason: "Account closure requested by customer" },
          tx: mockTx,
        });
        expect(result).toEqual(softDeletedUser);
      });

      it("should execute soft-delete directly on provided transaction client without calling prisma.$transaction", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        });

        const softDeletedUser: User = {
          ...mockTargetUser,
          deletedAt: new Date(),
        };
        mockTx.user.update.mockResolvedValue(softDeletedUser);
        mockTx.session.deleteMany.mockResolvedValue({ count: 1 });

        const externalTx = mockTx as unknown as Prisma.TransactionClient;

        const result = await AccountService.softDelete({
          targetUserId: mockTargetUser.id,
          tx: externalTx,
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: mockTargetUser.id },
        });
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: null,
          action: AuditAction.SOFT_DELETE,
          entityType: AuditEntityType.USER,
          entityId: mockTargetUser.id,
          previousValue: { deletedAt: null },
          newValue: { deletedAt: softDeletedUser.deletedAt },
          metadata: null,
          tx: externalTx,
        });
        expect(result).toEqual(softDeletedUser);
      });
    });

    describe("Validation and Error Scenarios", () => {
      it("should throw 404 USER_NOT_FOUND when user does not exist", async () => {
        mockTx.user.findUnique.mockResolvedValue(null);

        await expect(
          AccountService.softDelete({
            targetUserId: "non-existent-user",
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: status.NOT_FOUND,
            code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
            message: "User not found",
          }),
        );

        expect(mockTx.user.update).not.toHaveBeenCalled();
        expect(mockTx.session.deleteMany).not.toHaveBeenCalled();
        expect(AuditService.record).not.toHaveBeenCalled();
      });

      it("should throw 404 USER_NOT_FOUND when user is already soft-deleted", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.ACTIVE,
          deletedAt: new Date("2026-01-01T00:00:00Z"),
        });

        await expect(
          AccountService.softDelete({
            targetUserId: mockTargetUser.id,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            statusCode: status.NOT_FOUND,
            code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
            message: "User not found",
          }),
        );

        expect(mockTx.user.update).not.toHaveBeenCalled();
        expect(mockTx.session.deleteMany).not.toHaveBeenCalled();
        expect(AuditService.record).not.toHaveBeenCalled();
      });

      it("should propagate database update errors to caller", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: mockTargetUser.id,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        });

        const dbError = new Error("Database foreign key violation");
        mockTx.user.update.mockRejectedValue(dbError);

        await expect(
          AccountService.softDelete({
            targetUserId: mockTargetUser.id,
          }),
        ).rejects.toThrow("Database foreign key violation");
      });
    });
  });

  describe("Exported Query Filters", () => {
    it("should export activeUserFilter strictly matching non-deleted active users", () => {
      expect(activeUserFilter).toEqual({
        deletedAt: null,
        status: UserStatus.ACTIVE,
      });
    });

    it("should export nonDeletedUserFilter strictly matching non-deleted users", () => {
      expect(nonDeletedUserFilter).toEqual({
        deletedAt: null,
      });
    });

    it("should expose updateStatus and softDelete on AccountService boundary", () => {
      expect(typeof AccountService.updateStatus).toBe("function");
      expect(typeof AccountService.softDelete).toBe("function");
    });
  });
});
