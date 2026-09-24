import status from "http-status";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as betterAuthCrypto from "better-auth/crypto";
import type { Prisma } from "../../../../src/generated/prisma/client.js";
import {
  AuditAction,
  AuditEntityType,
  UserRole,
  UserStatus,
} from "../../../../src/generated/prisma/enums.js";
import { prisma } from "../../../../src/app/config/prisma.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import { AdminService } from "../../../../src/app/modules/admin/admin.service.js";
import { AuditService } from "../../../../src/app/shared/audit/audit.service.js";

vi.mock("better-auth/crypto");

describe("AdminService Unit Tests", () => {
  let mockTx: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    account: {
      create: ReturnType<typeof vi.fn>;
    };
    admin: {
      create: ReturnType<typeof vi.fn>;
    };
    session: {
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  const mockPayload = {
    name: "New Admin",
    email: "newadmin@liminalbd.com",
    password: "AdminPassword123!",
  };

  beforeEach(() => {
    vi.spyOn(betterAuthCrypto, "hashPassword").mockResolvedValue(
      "mock_hashed_password",
    );

    mockTx = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      account: {
        create: vi.fn(),
      },
      admin: {
        create: vi.fn(),
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

  describe("createAdmin", () => {
    describe("Authorization Defense-in-Depth", () => {
      it("should reject non-SUPER_ADMIN callers with 403 FORBIDDEN and record unauthorized attempt audit log", async () => {
        await expect(
          AdminService.createAdmin({
            actorId: "admin-actor-1",
            actorRole: UserRole.ADMIN,
            payload: mockPayload,
          }),
        ).rejects.toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Only Super Admin can create an Admin account",
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "admin-actor-1",
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          metadata: {
            attemptedAction: "CREATE_ADMIN",
            attemptedRole: UserRole.ADMIN,
            reason: "FORBIDDEN_ROLE_ACCESS",
          },
        });
      });

      it("should reject CUSTOMER callers with 403 FORBIDDEN and record unauthorized attempt audit log", async () => {
        await expect(
          AdminService.createAdmin({
            actorId: "customer-actor-1",
            actorRole: UserRole.CUSTOMER,
            payload: mockPayload,
          }),
        ).rejects.toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Only Super Admin can create an Admin account",
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "customer-actor-1",
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          metadata: {
            attemptedAction: "CREATE_ADMIN",
            attemptedRole: UserRole.ADMIN,
            reason: "FORBIDDEN_ROLE_ACCESS",
          },
        });
      });
    });

    describe("Duplicate Email Prevention", () => {
      it("should throw 409 CONFLICT if user with the same email already exists", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          id: "existing-user-123",
        });

        await expect(
          AdminService.createAdmin({
            actorId: "super-admin-1",
            actorRole: UserRole.SUPER_ADMIN,
            payload: mockPayload,
          }),
        ).rejects.toMatchObject({
          statusCode: status.CONFLICT,
          code: PUBLIC_ERROR_CODES.USER_ALREADY_EXISTS,
          message: "User with this email already exists",
        });

        expect(mockTx.user.findUnique).toHaveBeenCalledWith({
          where: { email: mockPayload.email },
          select: { id: true },
        });
        expect(mockTx.user.create).not.toHaveBeenCalled();
        expect(mockTx.account.create).not.toHaveBeenCalled();
        expect(mockTx.admin.create).not.toHaveBeenCalled();
        expect(AuditService.record).not.toHaveBeenCalled();
      });
    });

    describe("Successful Admin Provisioning Flow", () => {
      it("should atomically provision User, Account, Admin profile, record Audit log, and return symmetrical metadata", async () => {
        const mockCreatedAt = new Date("2026-09-23T10:00:00.000Z");
        const mockUpdatedAt = new Date("2026-09-23T10:00:00.000Z");

        mockTx.user.findUnique.mockResolvedValue(null);

        mockTx.user.create.mockImplementation(async ({ data }: any) => ({
          ...data,
          createdAt: mockCreatedAt,
          updatedAt: mockUpdatedAt,
        }));

        mockTx.account.create.mockImplementation(async ({ data }: any) => ({
          ...data,
          createdAt: mockCreatedAt,
          updatedAt: mockUpdatedAt,
        }));

        mockTx.admin.create.mockImplementation(async ({ data }: any) => ({
          ...data,
          createdAt: mockCreatedAt,
          updatedAt: mockUpdatedAt,
        }));

        const result = await AdminService.createAdmin({
          actorId: "super-admin-1",
          actorRole: UserRole.SUPER_ADMIN,
          payload: mockPayload,
        });

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);

        // Verify User creation
        expect(mockTx.user.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            id: expect.any(String),
            name: mockPayload.name,
            email: mockPayload.email,
            emailVerified: true,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            needPasswordChange: true,
          }),
        });

        const createdUserId = mockTx.user.create.mock.calls[0][0].data.id;

        // Verify Account creation
        expect(mockTx.account.create).toHaveBeenCalledWith({
          data: {
            id: expect.any(String),
            userId: createdUserId,
            accountId: createdUserId,
            providerId: "credential",
            password: "mock_hashed_password",
          },
        });

        // Verify Admin profile creation
        expect(mockTx.admin.create).toHaveBeenCalledWith({
          data: {
            userId: createdUserId,
            contactNumber: null,
            address: null,
          },
        });

        // Verify Audit log recording
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "super-admin-1",
          action: AuditAction.CREATE,
          entityType: AuditEntityType.ADMIN,
          entityId: createdUserId,
          newValue: {
            id: createdUserId,
            name: mockPayload.name,
            email: mockPayload.email,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            needPasswordChange: true,
          },
          tx: mockTx,
        });

        // Verify return shape
        expect(result).toEqual({
          id: createdUserId,
          name: mockPayload.name,
          email: mockPayload.email,
          emailVerified: true,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          needPasswordChange: true,
          createdAt: mockCreatedAt,
          updatedAt: mockUpdatedAt,
          admin: {
            contactNumber: null,
            address: null,
            createdAt: mockCreatedAt,
            updatedAt: mockUpdatedAt,
          },
        });
      });
    });
  });

  describe("updateAdmin", () => {
    const actorId = "super-admin-actor-1";
    const targetId = "target-admin-user-1";

    const mockAdminProfile = {
      contactNumber: "01700000000",
      address: "Dhaka, Bangladesh",
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      updatedAt: new Date("2026-09-20T10:00:00.000Z"),
    };

    const mockExistingAdmin = {
      id: targetId,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      admin: mockAdminProfile,
    };

    const mockUpdatedUser = {
      id: targetId,
      name: "Existing Admin",
      email: "existingadmin@liminalbd.com",
      emailVerified: true,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      needPasswordChange: false,
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      updatedAt: new Date("2026-09-23T11:00:00.000Z"),
    };

    describe("Authorization Defense-in-Depth", () => {
      it("should reject non-SUPER_ADMIN callers with 403 FORBIDDEN and record unauthorized attempt audit log", async () => {
        await expect(
          AdminService.updateAdmin({
            actorId: "admin-actor-1",
            actorRole: UserRole.ADMIN,
            targetId,
            payload: { role: UserRole.SUPER_ADMIN },
          }),
        ).rejects.toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Only Super Admin can update an Admin account",
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "admin-actor-1",
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          entityId: targetId,
          metadata: {
            attemptedAction: "UPDATE_ADMIN",
            attemptedPayload: { role: UserRole.SUPER_ADMIN },
            reason: "FORBIDDEN_ROLE_ACCESS",
          },
        });
      });

      it("should reject CUSTOMER callers with 403 FORBIDDEN and record unauthorized attempt audit log", async () => {
        await expect(
          AdminService.updateAdmin({
            actorId: "customer-actor-1",
            actorRole: UserRole.CUSTOMER,
            targetId,
            payload: { status: UserStatus.SUSPENDED },
          }),
        ).rejects.toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Only Super Admin can update an Admin account",
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "customer-actor-1",
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          entityId: targetId,
          metadata: {
            attemptedAction: "UPDATE_ADMIN",
            attemptedPayload: { status: UserStatus.SUSPENDED },
            reason: "FORBIDDEN_ROLE_ACCESS",
          },
        });
      });
    });

    describe("Self-Role Mutation & Self-Lockout Prevention", () => {
      it("should reject Super Admin mutating their own role with 400 VALIDATION_ERROR and record audit log", async () => {
        await expect(
          AdminService.updateAdmin({
            actorId: targetId,
            actorRole: UserRole.SUPER_ADMIN,
            targetId,
            payload: { role: UserRole.ADMIN },
          }),
        ).rejects.toMatchObject({
          statusCode: status.BAD_REQUEST,
          code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
          message: "Super Admin cannot modify their own role",
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: targetId,
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          entityId: targetId,
          metadata: {
            attemptedAction: "SELF_ROLE_MUTATION",
            attemptedRole: UserRole.ADMIN,
            reason: "SELF_ROLE_MUTATION_FORBIDDEN",
          },
        });
      });

      it("should reject Super Admin suspending their own account with 400 VALIDATION_ERROR and record audit log", async () => {
        await expect(
          AdminService.updateAdmin({
            actorId: targetId,
            actorRole: UserRole.SUPER_ADMIN,
            targetId,
            payload: { status: UserStatus.SUSPENDED },
          }),
        ).rejects.toMatchObject({
          statusCode: status.BAD_REQUEST,
          code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
          message: "Super Admin cannot suspend or deactivate their own account",
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: targetId,
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          entityId: targetId,
          metadata: {
            attemptedAction: "SELF_LOCKOUT_ATTEMPT",
            attemptedStatus: UserStatus.SUSPENDED,
            reason: "SELF_LOCKOUT_FORBIDDEN",
          },
        });
      });

      it("should reject Super Admin deactivating their own account with 400 VALIDATION_ERROR and record audit log", async () => {
        await expect(
          AdminService.updateAdmin({
            actorId: targetId,
            actorRole: UserRole.SUPER_ADMIN,
            targetId,
            payload: { status: UserStatus.DEACTIVATED },
          }),
        ).rejects.toMatchObject({
          statusCode: status.BAD_REQUEST,
          code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
          message: "Super Admin cannot suspend or deactivate their own account",
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: targetId,
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          entityId: targetId,
          metadata: {
            attemptedAction: "SELF_LOCKOUT_ATTEMPT",
            attemptedStatus: UserStatus.DEACTIVATED,
            reason: "SELF_LOCKOUT_FORBIDDEN",
          },
        });
      });

      it("should allow Super Admin setting status to ACTIVE on their own account without error", async () => {
        mockTx.user.findUnique.mockResolvedValue(mockExistingAdmin);
        mockTx.user.update.mockResolvedValue({
          ...mockUpdatedUser,
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
        });

        const result = await AdminService.updateAdmin({
          actorId: targetId,
          actorRole: UserRole.SUPER_ADMIN,
          targetId,
          payload: { status: UserStatus.ACTIVE },
        });

        expect(result).toBeDefined();
        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: targetId },
          data: { status: UserStatus.ACTIVE },
          select: expect.any(Object),
        });
        expect(AuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.REACTIVATE,
          }),
        );
      });
    });

    describe("Target Account Existence & Role Validation", () => {
      it("should reject with 404 USER_NOT_FOUND when target user does not exist", async () => {
        mockTx.user.findUnique.mockResolvedValue(null);

        await expect(
          AdminService.updateAdmin({
            actorId,
            actorRole: UserRole.SUPER_ADMIN,
            targetId,
            payload: { role: UserRole.SUPER_ADMIN },
          }),
        ).rejects.toMatchObject({
          statusCode: status.NOT_FOUND,
          code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
          message: "Admin user not found",
        });

        expect(mockTx.user.update).not.toHaveBeenCalled();
      });

      it("should reject with 404 USER_NOT_FOUND when target user is soft-deleted", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          ...mockExistingAdmin,
          deletedAt: new Date("2026-09-22T00:00:00.000Z"),
        });

        await expect(
          AdminService.updateAdmin({
            actorId,
            actorRole: UserRole.SUPER_ADMIN,
            targetId,
            payload: { role: UserRole.SUPER_ADMIN },
          }),
        ).rejects.toMatchObject({
          statusCode: status.NOT_FOUND,
          code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
          message: "Admin user not found",
        });

        expect(mockTx.user.update).not.toHaveBeenCalled();
      });

      it("should reject with 404 USER_NOT_FOUND when target user has CUSTOMER role", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          ...mockExistingAdmin,
          role: UserRole.CUSTOMER,
        });

        await expect(
          AdminService.updateAdmin({
            actorId,
            actorRole: UserRole.SUPER_ADMIN,
            targetId,
            payload: { role: UserRole.SUPER_ADMIN },
          }),
        ).rejects.toMatchObject({
          statusCode: status.NOT_FOUND,
          code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
          message: "Admin user not found",
        });

        expect(mockTx.user.update).not.toHaveBeenCalled();
      });
    });

    describe("Successful Role and Status Updates & Invariants", () => {
      it("should promote ADMIN to SUPER_ADMIN with ROLE_CHANGE audit action and without revoking sessions", async () => {
        mockTx.user.findUnique.mockResolvedValue(mockExistingAdmin);
        mockTx.user.update.mockResolvedValue(mockUpdatedUser);

        const result = await AdminService.updateAdmin({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          targetId,
          payload: { role: UserRole.SUPER_ADMIN },
        });

        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: targetId },
          data: { role: UserRole.SUPER_ADMIN },
          select: expect.any(Object),
        });

        expect(mockTx.session.deleteMany).not.toHaveBeenCalled();

        expect(AuditService.record).toHaveBeenCalledWith({
          actorId,
          action: AuditAction.ROLE_CHANGE,
          entityType: AuditEntityType.ADMIN,
          entityId: targetId,
          previousValue: { role: UserRole.ADMIN },
          newValue: { role: UserRole.SUPER_ADMIN },
          tx: mockTx,
        });

        expect(result).toEqual({
          ...mockUpdatedUser,
          admin: mockAdminProfile,
        });
      });

      it("should demote SUPER_ADMIN to ADMIN with ROLE_CHANGE audit action", async () => {
        mockTx.user.findUnique.mockResolvedValue({
          ...mockExistingAdmin,
          role: UserRole.SUPER_ADMIN,
        });
        mockTx.user.update.mockResolvedValue({
          ...mockUpdatedUser,
          role: UserRole.ADMIN,
        });

        await AdminService.updateAdmin({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          targetId,
          payload: { role: UserRole.ADMIN },
        });

        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: targetId },
          data: { role: UserRole.ADMIN },
          select: expect.any(Object),
        });

        expect(AuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.ROLE_CHANGE,
            previousValue: { role: UserRole.SUPER_ADMIN },
            newValue: { role: UserRole.ADMIN },
          }),
        );
      });

      it("should suspend account, revoke active sessions, and record SUSPEND audit action", async () => {
        mockTx.user.findUnique.mockResolvedValue(mockExistingAdmin);
        mockTx.user.update.mockResolvedValue({
          ...mockUpdatedUser,
          role: UserRole.ADMIN,
          status: UserStatus.SUSPENDED,
        });

        await AdminService.updateAdmin({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          targetId,
          payload: { status: UserStatus.SUSPENDED },
        });

        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: targetId },
          data: { status: UserStatus.SUSPENDED },
          select: expect.any(Object),
        });

        expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: targetId },
        });

        expect(AuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.SUSPEND,
            previousValue: { status: UserStatus.ACTIVE },
            newValue: { status: UserStatus.SUSPENDED },
          }),
        );
      });

      it("should deactivate account, revoke active sessions, and record DEACTIVATE audit action", async () => {
        mockTx.user.findUnique.mockResolvedValue(mockExistingAdmin);
        mockTx.user.update.mockResolvedValue({
          ...mockUpdatedUser,
          role: UserRole.ADMIN,
          status: UserStatus.DEACTIVATED,
        });

        await AdminService.updateAdmin({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          targetId,
          payload: { status: UserStatus.DEACTIVATED },
        });

        expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: targetId },
        });

        expect(AuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.DEACTIVATE,
            previousValue: { status: UserStatus.ACTIVE },
            newValue: { status: UserStatus.DEACTIVATED },
          }),
        );
      });

      it("should handle combined role and status update with UPDATE audit action and session revocation", async () => {
        mockTx.user.findUnique.mockResolvedValue(mockExistingAdmin);
        mockTx.user.update.mockResolvedValue({
          ...mockUpdatedUser,
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.SUSPENDED,
        });

        await AdminService.updateAdmin({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          targetId,
          payload: {
            role: UserRole.SUPER_ADMIN,
            status: UserStatus.SUSPENDED,
          },
        });

        expect(mockTx.user.update).toHaveBeenCalledWith({
          where: { id: targetId },
          data: {
            role: UserRole.SUPER_ADMIN,
            status: UserStatus.SUSPENDED,
          },
          select: expect.any(Object),
        });

        expect(mockTx.session.deleteMany).toHaveBeenCalledWith({
          where: { userId: targetId },
        });

        expect(AuditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditAction.UPDATE,
            previousValue: {
              role: UserRole.ADMIN,
              status: UserStatus.ACTIVE,
            },
            newValue: {
              role: UserRole.SUPER_ADMIN,
              status: UserStatus.SUSPENDED,
            },
          }),
        );
      });
    });
  });

  describe("getAdmins", () => {
    const actorId = "super-admin-id";
    const mockAdminItem = {
      id: "admin-user-1",
      name: "Admin One",
      email: "admin1@liminalbd.com",
      emailVerified: true,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      needPasswordChange: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      admin: {
        contactNumber: "01711111111",
        address: "Dhaka, Bangladesh",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    };

    describe("Authorization Defense-in-Depth", () => {
      it("should reject non-SUPER_ADMIN callers with 403 FORBIDDEN and record unauthorized attempt audit log", async () => {
        const findManySpy = vi.spyOn(prisma.user, "findMany");
        const countSpy = vi.spyOn(prisma.user, "count");

        await expect(
          AdminService.getAdmins({
            actorId: "regular-admin-id",
            actorRole: UserRole.ADMIN,
            query: {
              page: 1,
              limit: 10,
              sortBy: "createdAt",
              sortOrder: "desc",
            },
          }),
        ).rejects.toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Only Super Admin can list Admin accounts",
        });

        expect(findManySpy).not.toHaveBeenCalled();
        expect(countSpy).not.toHaveBeenCalled();
        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "regular-admin-id",
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          metadata: {
            attemptedAction: "GET_ADMINS",
            attemptedRole: UserRole.ADMIN,
            reason: "FORBIDDEN_ROLE_ACCESS",
          },
        });
      });

      it("should reject CUSTOMER callers with 403 FORBIDDEN and record unauthorized attempt audit log", async () => {
        await expect(
          AdminService.getAdmins({
            actorId: "customer-id",
            actorRole: UserRole.CUSTOMER,
            query: {
              page: 1,
              limit: 10,
              sortBy: "createdAt",
              sortOrder: "desc",
            },
          }),
        ).rejects.toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Only Super Admin can list Admin accounts",
        });

        expect(AuditService.record).toHaveBeenCalledWith({
          actorId: "customer-id",
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          metadata: {
            attemptedAction: "GET_ADMINS",
            attemptedRole: UserRole.CUSTOMER,
            reason: "FORBIDDEN_ROLE_ACCESS",
          },
        });
      });
    });

    describe("Successful Query Execution", () => {
      it("should retrieve admins with default pagination, default sorting, and safe projection", async () => {
        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([mockAdminItem as any]);
        const countSpy = vi.spyOn(prisma.user, "count").mockResolvedValue(1);

        const result = await AdminService.getAdmins({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
          },
        });

        expect(findManySpy).toHaveBeenCalledWith({
          where: {
            role: UserRole.ADMIN,
            deletedAt: null,
          },
          skip: 0,
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            role: true,
            status: true,
            needPasswordChange: true,
            createdAt: true,
            updatedAt: true,
            admin: {
              select: {
                contactNumber: true,
                address: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

        expect(countSpy).toHaveBeenCalledWith({
          where: {
            role: UserRole.ADMIN,
            deletedAt: null,
          },
        });

        expect(result).toEqual({
          data: [mockAdminItem],
          meta: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        });
      });

      it("should filter by status when status filter is provided", async () => {
        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([]);
        const countSpy = vi.spyOn(prisma.user, "count").mockResolvedValue(0);

        const result = await AdminService.getAdmins({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            status: UserStatus.SUSPENDED,
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              role: UserRole.ADMIN,
              deletedAt: null,
              status: UserStatus.SUSPENDED,
            },
          }),
        );
        expect(countSpy).toHaveBeenCalledWith({
          where: {
            role: UserRole.ADMIN,
            deletedAt: null,
            status: UserStatus.SUSPENDED,
          },
        });
        expect(result.data).toEqual([]);
        expect(result.meta).toEqual({
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        });
      });

      it("should apply multi-field text search when searchTerm is provided", async () => {
        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([mockAdminItem as any]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(1);

        await AdminService.getAdmins({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
            searchTerm: "rahman",
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              role: UserRole.ADMIN,
              deletedAt: null,
              OR: [
                { name: { contains: "rahman", mode: "insensitive" } },
                { email: { contains: "rahman", mode: "insensitive" } },
              ],
            },
          }),
        );
      });

      it("should apply custom pagination and sorting options correctly", async () => {
        const findManySpy = vi
          .spyOn(prisma.user, "findMany")
          .mockResolvedValue([]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(25);

        const result = await AdminService.getAdmins({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          query: {
            page: 3,
            limit: 5,
            sortBy: "name",
            sortOrder: "asc",
          },
        });

        expect(findManySpy).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10,
            take: 5,
            orderBy: { name: "asc" },
          }),
        );
        expect(result.meta).toEqual({
          page: 3,
          limit: 5,
          total: 25,
          totalPages: 5,
        });
      });

      it("should return empty list and zero totalPages when total count is 0", async () => {
        vi.spyOn(prisma.user, "findMany").mockResolvedValue([]);
        vi.spyOn(prisma.user, "count").mockResolvedValue(0);

        const result = await AdminService.getAdmins({
          actorId,
          actorRole: UserRole.SUPER_ADMIN,
          query: {
            page: 1,
            limit: 10,
            sortBy: "createdAt",
            sortOrder: "desc",
          },
        });

        expect(result.data).toEqual([]);
        expect(result.meta).toEqual({
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        });
      });
    });
  });
});
