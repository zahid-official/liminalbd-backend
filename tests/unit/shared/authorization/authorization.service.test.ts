import status from "http-status";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../../../src/generated/prisma/client.js";
import {
  AuditAction,
  AuditEntityType,
  UserRole,
} from "../../../../src/generated/prisma/enums.js";
import { AppError } from "../../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import { AuditService } from "../../../../src/app/shared/audit/audit.service.js";
import { AuthorizationService } from "../../../../src/app/shared/authorization/authorization.service.js";

describe("AuthorizationService Unit Tests", () => {
  const actorId = "user-customer-1";
  const resourceOwnerId = "user-customer-2";
  const resourceId = "resource-cust-profile-100";

  beforeEach(() => {
    vi.spyOn(AuditService, "record").mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Direct Resource Owner Access", () => {
    it("should authorize access when actor is the direct resource owner", async () => {
      await expect(
        AuthorizationService.authorizeOwnership({
          actorId: "user-owner-123",
          actorRole: UserRole.CUSTOMER,
          resourceOwnerId: "user-owner-123",
          resourceType: AuditEntityType.CUSTOMER,
          action: "READ_PROFILE",
        }),
      ).resolves.toBeUndefined();

      expect(AuditService.record).not.toHaveBeenCalled();
    });

    it("should authorize admin accessing their own resource", async () => {
      await expect(
        AuthorizationService.authorizeOwnership({
          actorId: "admin-owner-456",
          actorRole: UserRole.ADMIN,
          resourceOwnerId: "admin-owner-456",
          resourceType: AuditEntityType.ADMIN,
          action: "UPDATE_PROFILE",
        }),
      ).resolves.toBeUndefined();

      expect(AuditService.record).not.toHaveBeenCalled();
    });
  });

  describe("Cross-Customer Access Violations", () => {
    it("should reject cross-customer access with 403 FORBIDDEN_ACCESS and log an audit record", async () => {
      const promise = AuthorizationService.authorizeOwnership({
        actorId,
        actorRole: UserRole.CUSTOMER,
        resourceOwnerId,
        resourceType: AuditEntityType.CUSTOMER,
        resourceId,
        action: "READ_PROFILE",
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
        message: "You do not have permission to access or modify this resource",
      });

      expect(AuditService.record).toHaveBeenCalledOnce();
      expect(AuditService.record).toHaveBeenCalledWith({
        actorId,
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        entityType: AuditEntityType.CUSTOMER,
        entityId: resourceId,
        metadata: {
          attemptedAction: "READ_PROFILE",
          reason: "FORBIDDEN_ACCESS",
          resourceOwnerId,
        },
      });
    });

    it("should reject customer access even if allowAdmin is set to true", async () => {
      const promise = AuthorizationService.authorizeOwnership({
        actorId,
        actorRole: UserRole.CUSTOMER,
        resourceOwnerId,
        resourceType: AuditEntityType.CUSTOMER,
        action: "UPDATE_PROFILE",
        policy: { allowAdmin: true },
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });

      expect(AuditService.record).toHaveBeenCalledOnce();
    });
  });

  describe("Super Admin Administrative Access", () => {
    it("should authorize Super Admin by default when no policy is provided", async () => {
      await expect(
        AuthorizationService.authorizeOwnership({
          actorId: "super-admin-1",
          actorRole: UserRole.SUPER_ADMIN,
          resourceOwnerId,
          resourceType: AuditEntityType.CUSTOMER,
          action: "VIEW_CUSTOMER_DATA",
        }),
      ).resolves.toBeUndefined();

      expect(AuditService.record).not.toHaveBeenCalled();
    });

    it("should authorize Super Admin when allowSuperAdmin is explicitly true", async () => {
      await expect(
        AuthorizationService.authorizeOwnership({
          actorId: "super-admin-1",
          actorRole: UserRole.SUPER_ADMIN,
          resourceOwnerId,
          resourceType: AuditEntityType.CUSTOMER,
          action: "VIEW_CUSTOMER_DATA",
          policy: { allowSuperAdmin: true },
        }),
      ).resolves.toBeUndefined();

      expect(AuditService.record).not.toHaveBeenCalled();
    });

    it("should reject Super Admin when allowSuperAdmin is explicitly false", async () => {
      const promise = AuthorizationService.authorizeOwnership({
        actorId: "super-admin-1",
        actorRole: UserRole.SUPER_ADMIN,
        resourceOwnerId,
        resourceType: AuditEntityType.CUSTOMER,
        action: "RESTRICTED_CUSTOMER_MUTATION",
        policy: { allowSuperAdmin: false },
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });

      expect(AuditService.record).toHaveBeenCalledOnce();
      expect(AuditService.record).toHaveBeenCalledWith({
        actorId: "super-admin-1",
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        entityType: AuditEntityType.CUSTOMER,
        metadata: {
          attemptedAction: "RESTRICTED_CUSTOMER_MUTATION",
          reason: "FORBIDDEN_ACCESS",
          resourceOwnerId,
        },
      });
    });
  });

  describe("Admin Administrative Access", () => {
    it("should reject Admin by default when no policy is provided", async () => {
      const promise = AuthorizationService.authorizeOwnership({
        actorId: "admin-1",
        actorRole: UserRole.ADMIN,
        resourceOwnerId,
        resourceType: AuditEntityType.CUSTOMER,
        action: "VIEW_CUSTOMER_DATA",
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });

      expect(AuditService.record).toHaveBeenCalledOnce();
    });

    it("should reject Admin when allowAdmin is explicitly false", async () => {
      const promise = AuthorizationService.authorizeOwnership({
        actorId: "admin-1",
        actorRole: UserRole.ADMIN,
        resourceOwnerId,
        resourceType: AuditEntityType.CUSTOMER,
        action: "VIEW_CUSTOMER_DATA",
        policy: { allowAdmin: false },
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });

      expect(AuditService.record).toHaveBeenCalledOnce();
    });

    it("should authorize Admin when allowAdmin is explicitly true", async () => {
      await expect(
        AuthorizationService.authorizeOwnership({
          actorId: "admin-1",
          actorRole: UserRole.ADMIN,
          resourceOwnerId,
          resourceType: AuditEntityType.CUSTOMER,
          action: "VIEW_CUSTOMER_DATA",
          policy: { allowAdmin: true },
        }),
      ).resolves.toBeUndefined();

      expect(AuditService.record).not.toHaveBeenCalled();
    });
  });

  describe("Explicit Role Allow-List (allowedRoles)", () => {
    it("should authorize a role that is in the allowedRoles list", async () => {
      await expect(
        AuthorizationService.authorizeOwnership({
          actorId: "admin-1",
          actorRole: UserRole.ADMIN,
          resourceOwnerId,
          resourceType: AuditEntityType.CUSTOMER,
          action: "SPECIAL_SUPPORT_ACCESS",
          policy: { allowedRoles: [UserRole.ADMIN] },
        }),
      ).resolves.toBeUndefined();

      expect(AuditService.record).not.toHaveBeenCalled();
    });

    it("should reject Super Admin if not included in an explicit allowedRoles list", async () => {
      const promise = AuthorizationService.authorizeOwnership({
        actorId: "super-admin-1",
        actorRole: UserRole.SUPER_ADMIN,
        resourceOwnerId,
        resourceType: AuditEntityType.CUSTOMER,
        action: "ADMIN_ONLY_ACTION",
        policy: { allowedRoles: [UserRole.ADMIN] },
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });

      expect(AuditService.record).toHaveBeenCalledOnce();
    });

    it("should reject Customer if not in allowedRoles list", async () => {
      const promise = AuthorizationService.authorizeOwnership({
        actorId,
        actorRole: UserRole.CUSTOMER,
        resourceOwnerId,
        resourceType: AuditEntityType.CUSTOMER,
        action: "SPECIAL_ACTION",
        policy: { allowedRoles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });

      expect(AuditService.record).toHaveBeenCalledOnce();
    });

    it("should strictly reject Customer even if allowedRoles mistakenly includes Customer", async () => {
      const promise = AuthorizationService.authorizeOwnership({
        actorId,
        actorRole: UserRole.CUSTOMER,
        resourceOwnerId,
        resourceType: AuditEntityType.CUSTOMER,
        action: "BYPASS_ATTEMPT",
        policy: { allowedRoles: [UserRole.CUSTOMER] },
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });

      expect(AuditService.record).toHaveBeenCalledOnce();
    });
  });

  describe("Optional Parameters Handling", () => {
    it("should omit entityId from audit data when resourceId is not provided", async () => {
      await expect(
        AuthorizationService.authorizeOwnership({
          actorId,
          actorRole: UserRole.CUSTOMER,
          resourceOwnerId,
          resourceType: AuditEntityType.CUSTOMER,
          action: "UPDATE_PROFILE",
        }),
      ).rejects.toThrow(AppError);

      expect(AuditService.record).toHaveBeenCalledWith(
        expect.not.objectContaining({ entityId: expect.anything() }),
      );
    });

    it("should forward tx to AuditService when a transaction client is provided", async () => {
      const mockTx = {} as Prisma.TransactionClient;

      await expect(
        AuthorizationService.authorizeOwnership({
          actorId,
          actorRole: UserRole.CUSTOMER,
          resourceOwnerId,
          resourceType: AuditEntityType.CUSTOMER,
          action: "TRANSACTIONAL_OPERATION",
          tx: mockTx,
        }),
      ).rejects.toThrow(AppError);

      expect(AuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ tx: mockTx }),
      );
    });
  });

  describe("Defense-in-Depth: Route Guard Bypass Protection", () => {
    it("should reject unauthorized access at the service layer regardless of route guards", async () => {
      // Direct service invocation with mismatched owner ID always throws 403 and writes an audit log
      const promise = AuthorizationService.authorizeOwnership({
        actorId: "malicious-user-bypass",
        actorRole: UserRole.CUSTOMER,
        resourceOwnerId: "victim-customer",
        resourceType: AuditEntityType.CUSTOMER,
        resourceId: "victim-profile-id",
        action: "MUTATE_SENSITIVE_DATA",
      });

      await expect(promise).rejects.toThrow(AppError);
      await expect(promise).rejects.toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ACCESS,
      });

      expect(AuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "malicious-user-bypass",
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
        }),
      );
    });
  });
});
