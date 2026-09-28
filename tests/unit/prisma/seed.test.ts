import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/app/config/env.js", () => ({
  env: {
    SUPER_ADMIN_NAME: "Super Admin",
    SUPER_ADMIN_EMAIL: "superadmin@liminalbd.com",
    SUPER_ADMIN_PASSWORD: "SuperSecretPassword123!",
  },
}));

import { env } from "../../../src/app/config/env.js";
import { logger } from "../../../src/app/config/logger.js";
import { prisma } from "../../../src/app/config/prisma.js";
import { ConfigurationError } from "../../../src/app/errors/ConfigurationError.js";
import { AuditService } from "../../../src/app/shared/audit/audit.service.js";
import { Prisma } from "../../../src/generated/prisma/client.js";
import {
  AuditAction,
  AuditEntityType,
  UserRole,
  UserStatus,
} from "../../../src/generated/prisma/enums.js";
import { seedSuperAdmin } from "../../../prisma/seed.js";

// Strongly-typed mutable reference for test overrides without using 'any'
type MutableEnv = {
  -readonly [K in keyof typeof env]?: (typeof env)[K];
};
const mutableEnv = env as unknown as MutableEnv;

describe("seedSuperAdmin Unit Tests", () => {
  const validEmail = "superadmin@liminalbd.com";
  const validPassword = "SuperSecretPassword123!";
  const validName = "Super Admin";

  let mockUserFindFirst: ReturnType<typeof vi.fn>;
  let mockUserFindUnique: ReturnType<typeof vi.fn>;
  let mockUserCreate: ReturnType<typeof vi.fn>;
  let mockAccountCreate: ReturnType<typeof vi.fn>;
  let mockAdminCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mutableEnv.SUPER_ADMIN_NAME = validName;
    mutableEnv.SUPER_ADMIN_EMAIL = validEmail;
    mutableEnv.SUPER_ADMIN_PASSWORD = validPassword;

    mockUserFindFirst = vi.fn().mockResolvedValue(null);
    mockUserFindUnique = vi.fn().mockResolvedValue(null);
    mockUserCreate = vi.fn().mockResolvedValue({ id: "new-user-id" });
    mockAccountCreate = vi.fn().mockResolvedValue({ id: "new-account-id" });
    mockAdminCreate = vi.fn().mockResolvedValue({ userId: "new-user-id" });

    vi.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
      const mockTx = {
        user: {
          findFirst: mockUserFindFirst,
          findUnique: mockUserFindUnique,
          create: mockUserCreate,
        },
        account: { create: mockAccountCreate },
        admin: { create: mockAdminCreate },
      };
      return callback(mockTx as unknown as Parameters<typeof callback>[0]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Missing Environment Credentials Guard", () => {
    it("should log info and skip provisioning when SUPER_ADMIN_EMAIL is missing", async () => {
      mutableEnv.SUPER_ADMIN_EMAIL = undefined;

      const loggerSpy = vi.spyOn(logger, "info");
      const transactionSpy = vi.spyOn(prisma, "$transaction");

      await seedSuperAdmin();

      expect(loggerSpy).toHaveBeenCalledWith(
        "SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set in environment. Skipping provisioning.",
      );
      expect(transactionSpy).not.toHaveBeenCalled();
    });

    it("should log info and skip provisioning when SUPER_ADMIN_PASSWORD is missing", async () => {
      mutableEnv.SUPER_ADMIN_PASSWORD = undefined;

      const loggerSpy = vi.spyOn(logger, "info");
      const transactionSpy = vi.spyOn(prisma, "$transaction");

      await seedSuperAdmin();

      expect(loggerSpy).toHaveBeenCalledWith(
        "SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set in environment. Skipping provisioning.",
      );
      expect(transactionSpy).not.toHaveBeenCalled();
    });
  });

  describe("Password Complexity Validation", () => {
    it("should throw ConfigurationError when password is too weak", async () => {
      mutableEnv.SUPER_ADMIN_PASSWORD = "weakpassword";

      const transactionSpy = vi.spyOn(prisma, "$transaction");

      await expect(seedSuperAdmin()).rejects.toThrow(ConfigurationError);
      expect(transactionSpy).not.toHaveBeenCalled();
    });
  });

  describe("Idempotency Enforcement & Identity Protection", () => {
    it("should skip provisioning when a Super Admin with the target email already exists", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "existing-super-admin-id",
        email: validEmail,
        role: UserRole.SUPER_ADMIN,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

      const loggerSpy = vi.spyOn(logger, "info");

      await seedSuperAdmin();

      expect(loggerSpy).toHaveBeenCalledWith(
        `Super Admin account already exists (${validEmail}). Skipping provisioning.`,
      );
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should skip provisioning when another Super Admin with a different email already exists", async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue({
        id: "existing-other-admin-id",
        email: "otheradmin@liminalbd.com",
      } as unknown as Awaited<ReturnType<typeof prisma.user.findFirst>>);

      const loggerSpy = vi.spyOn(logger, "info");

      await seedSuperAdmin();

      expect(loggerSpy).toHaveBeenCalledWith(
        "Another Super Admin account already exists (otheradmin@liminalbd.com). Skipping provisioning to prevent duplicate root accounts.",
      );
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should throw ConfigurationError when target email is already held by a non-Super Admin", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "existing-customer-id",
        email: validEmail,
        role: UserRole.CUSTOMER,
      } as unknown as Awaited<ReturnType<typeof prisma.user.findUnique>>);

      await expect(seedSuperAdmin()).rejects.toThrow(ConfigurationError);
      expect(mockUserCreate).not.toHaveBeenCalled();
    });

    it("should handle Prisma P2002 concurrent insertion race condition gracefully without throwing", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`email`)",
        { code: "P2002", clientVersion: "7.0.0" },
      );
      vi.spyOn(prisma, "$transaction").mockRejectedValue(p2002Error);
      const loggerSpy = vi.spyOn(logger, "info");

      await expect(seedSuperAdmin()).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        "Super Admin was provisioned concurrently by another process. Skipping.",
      );
    });
  });

  describe("Successful Provisioning Flow", () => {
    it("should atomically provision User, Account, Admin profile, and AuditLog", async () => {
      const auditRecordSpy = vi
        .spyOn(AuditService, "record")
        .mockResolvedValue({} as unknown as Awaited<ReturnType<typeof AuditService.record>>);
      const loggerInfoSpy = vi.spyOn(logger, "info");

      await seedSuperAdmin();

      expect(mockUserCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: validName,
          email: validEmail,
          emailVerified: true,
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          needPasswordChange: true,
        }),
      });

      expect(mockAccountCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          providerId: "credential",
          password: expect.any(String),
        }),
      });

      expect(mockAdminCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: expect.any(String),
        }),
      });

      expect(auditRecordSpy).toHaveBeenCalledWith({
        actorId: expect.any(String),
        action: AuditAction.CREATE,
        entityType: AuditEntityType.ADMIN,
        entityId: expect.any(String),
        newValue: expect.objectContaining({
          name: validName,
          email: validEmail,
          role: UserRole.SUPER_ADMIN,
          status: UserStatus.ACTIVE,
          needPasswordChange: true,
        }),
        metadata: {
          source: "SEED_SCRIPT",
          description: "Initial Super Admin provisioning via Prisma database seed",
        },
        tx: expect.anything(),
      });

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        `Super Admin provisioned successfully: ${validEmail}`,
      );
    });
  });
});
