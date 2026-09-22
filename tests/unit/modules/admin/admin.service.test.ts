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
    };
    account: {
      create: ReturnType<typeof vi.fn>;
    };
    admin: {
      create: ReturnType<typeof vi.fn>;
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
      },
      account: {
        create: vi.fn(),
      },
      admin: {
        create: vi.fn(),
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
      it("should reject non-SUPER_ADMIN callers with 403 FORBIDDEN", async () => {
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
      });

      it("should reject CUSTOMER callers with 403 FORBIDDEN", async () => {
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
          metadata: {
            createdVia: "SUPER_ADMIN_PROVISIONING",
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

      it("should execute directly on caller-provided transaction client without invoking prisma.$transaction", async () => {
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

        await AdminService.createAdmin({
          actorId: "super-admin-1",
          actorRole: UserRole.SUPER_ADMIN,
          payload: mockPayload,
          tx: mockTx as unknown as Prisma.TransactionClient,
        });

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(mockTx.user.findUnique).toHaveBeenCalledTimes(1);
        expect(mockTx.user.create).toHaveBeenCalledTimes(1);
        expect(mockTx.account.create).toHaveBeenCalledTimes(1);
        expect(mockTx.admin.create).toHaveBeenCalledTimes(1);
        expect(AuditService.record).toHaveBeenCalledTimes(1);
      });
    });
  });
});
