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
import {
  AuditAction,
  AuditEntityType,
  UserRole,
  UserStatus,
} from "../../../src/generated/prisma/enums.js";
import { seedSuperAdmin } from "../../../prisma/seed.js";

describe("seedSuperAdmin Unit Tests", () => {
  const validEmail = "superadmin@liminalbd.com";
  const validPassword = "SuperSecretPassword123!";
  const validName = "Super Admin";

  beforeEach(() => {
    vi.restoreAllMocks();
    (env as any).SUPER_ADMIN_NAME = validName;
    (env as any).SUPER_ADMIN_EMAIL = validEmail;
    (env as any).SUPER_ADMIN_PASSWORD = validPassword;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Missing Environment Credentials Guard", () => {
    it("should log info and skip provisioning when SUPER_ADMIN_EMAIL is missing", async () => {
      (env as any).SUPER_ADMIN_EMAIL = undefined;

      const loggerSpy = vi.spyOn(logger, "info");
      const findFirstSpy = vi.spyOn(prisma.user, "findFirst");

      await seedSuperAdmin();

      expect(loggerSpy).toHaveBeenCalledWith(
        "SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set in environment. Skipping provisioning.",
      );
      expect(findFirstSpy).not.toHaveBeenCalled();
    });

    it("should log info and skip provisioning when SUPER_ADMIN_PASSWORD is missing", async () => {
      (env as any).SUPER_ADMIN_PASSWORD = undefined;

      const loggerSpy = vi.spyOn(logger, "info");
      const findFirstSpy = vi.spyOn(prisma.user, "findFirst");

      await seedSuperAdmin();

      expect(loggerSpy).toHaveBeenCalledWith(
        "SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set in environment. Skipping provisioning.",
      );
      expect(findFirstSpy).not.toHaveBeenCalled();
    });
  });

  describe("Password Complexity Validation", () => {
    it("should throw ConfigurationError when password is too weak", async () => {
      (env as any).SUPER_ADMIN_PASSWORD = "weakpassword";

      const findFirstSpy = vi.spyOn(prisma.user, "findFirst");

      await expect(seedSuperAdmin()).rejects.toThrow(ConfigurationError);
      expect(findFirstSpy).not.toHaveBeenCalled();
    });
  });

  describe("Idempotency Enforcement", () => {
    it("should skip provisioning when a Super Admin account already exists", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
        id: "existing-super-admin-id",
        email: "existing@liminalbd.com",
      } as any);

      const loggerSpy = vi.spyOn(logger, "info");
      const transactionSpy = vi.spyOn(prisma, "$transaction");

      await seedSuperAdmin();

      expect(loggerSpy).toHaveBeenCalledWith(
        "Super Admin account already exists (existing@liminalbd.com). Skipping provisioning.",
      );
      expect(transactionSpy).not.toHaveBeenCalled();
    });

    it("should warn and skip provisioning when another user already holds the target email", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: "existing-customer-id",
        role: UserRole.CUSTOMER,
      } as any);

      const loggerWarnSpy = vi.spyOn(logger, "warn");
      const transactionSpy = vi.spyOn(prisma, "$transaction");

      await seedSuperAdmin();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        `User with email "${validEmail}" already exists with role CUSTOMER. Skipping provisioning.`,
      );
      expect(transactionSpy).not.toHaveBeenCalled();
    });
  });

  describe("Successful Provisioning Flow", () => {
    it("should atomically provision User, Account, Admin profile, and AuditLog", async () => {
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const mockUserCreate = vi.fn().mockResolvedValue({ id: "new-user-id" });
      const mockAccountCreate = vi.fn().mockResolvedValue({ id: "new-account-id" });
      const mockAdminCreate = vi.fn().mockResolvedValue({ userId: "new-user-id" });
      const auditRecordSpy = vi
        .spyOn(AuditService, "record")
        .mockResolvedValue({} as any);

      vi.spyOn(prisma, "$transaction").mockImplementation(async (callback) => {
        const mockTx = {
          user: { create: mockUserCreate },
          account: { create: mockAccountCreate },
          admin: { create: mockAdminCreate },
        };
        return callback(mockTx as any);
      });

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
