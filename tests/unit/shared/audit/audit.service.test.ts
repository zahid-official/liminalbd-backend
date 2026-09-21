import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../src/app/config/prisma.js";
import { Prisma } from "../../../../src/generated/prisma/client.js";
import type { AuditLog } from "../../../../src/generated/prisma/client.js";
import { AuditAction, AuditEntityType } from "../../../../src/generated/prisma/enums.js";
import { AuditService } from "../../../../src/app/shared/audit/audit.service.js";

describe("AuditService Unit Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockAuditRecord: AuditLog = {
    id: "audit-log-uuid-1",
    actorId: "actor-uuid-1",
    action: AuditAction.ROLE_CHANGE,
    entityType: AuditEntityType.USER,
    entityId: "target-user-uuid-1",
    previousValue: { role: "ADMIN" },
    newValue: { role: "SUPER_ADMIN" },
    metadata: { ip: "127.0.0.1" },
    createdAt: new Date("2026-09-21T01:00:00Z"),
  };

  describe("Standalone Record Creation (Default prisma client)", () => {
    it("should successfully persist an audit log entry via prisma client", async () => {
      const createSpy = vi
        .spyOn(prisma.auditLog, "create")
        .mockResolvedValue(mockAuditRecord);

      const result = await AuditService.record({
        actorId: "actor-uuid-1",
        action: AuditAction.ROLE_CHANGE,
        entityType: AuditEntityType.USER,
        entityId: "target-user-uuid-1",
        previousValue: { role: "ADMIN" },
        newValue: { role: "SUPER_ADMIN" },
        metadata: { ip: "127.0.0.1" },
      });

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          actorId: "actor-uuid-1",
          action: AuditAction.ROLE_CHANGE,
          entityType: AuditEntityType.USER,
          entityId: "target-user-uuid-1",
          previousValue: { role: "ADMIN" },
          newValue: { role: "SUPER_ADMIN" },
          metadata: { ip: "127.0.0.1" },
        },
      });
      expect(result).toEqual(mockAuditRecord);
    });

    it("should handle unauthenticated / system actor with actorId set to null", async () => {
      const createSpy = vi
        .spyOn(prisma.auditLog, "create")
        .mockResolvedValue({
          ...mockAuditRecord,
          actorId: null,
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
        });

      const result = await AuditService.record({
        action: AuditAction.UNAUTHORIZED_ATTEMPT,
        entityType: AuditEntityType.ADMIN,
        entityId: "target-admin-1",
      });

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith({
        data: {
          actorId: null,
          action: AuditAction.UNAUTHORIZED_ATTEMPT,
          entityType: AuditEntityType.ADMIN,
          entityId: "target-admin-1",
        },
      });
      expect(result.actorId).toBeNull();
    });
  });

  describe("Transactional Record Creation (Custom tx client)", () => {
    it("should delegate to transaction client when tx is provided", async () => {
      const txCreateMock = vi.fn().mockResolvedValue({
        ...mockAuditRecord,
        id: "tx-audit-uuid",
      });

      const mockTx = {
        auditLog: {
          create: txCreateMock,
        },
      } as unknown as Prisma.TransactionClient;

      const prismaSpy = vi.spyOn(prisma.auditLog, "create");

      const result = await AuditService.record({
        actorId: "admin-1",
        action: AuditAction.CREATE,
        entityType: AuditEntityType.ADMIN,
        entityId: "new-admin-2",
        tx: mockTx,
      });

      expect(txCreateMock).toHaveBeenCalledTimes(1);
      expect(txCreateMock).toHaveBeenCalledWith({
        data: {
          actorId: "admin-1",
          action: AuditAction.CREATE,
          entityType: AuditEntityType.ADMIN,
          entityId: "new-admin-2",
        },
      });
      expect(prismaSpy).not.toHaveBeenCalled();
      expect(result.id).toBe("tx-audit-uuid");
    });
  });

  describe("Sensitive Data Redaction & Normalization", () => {
    it("should recursively redact sensitive fields from previousValue, newValue, and metadata", async () => {
      const createSpy = vi
        .spyOn(prisma.auditLog, "create")
        .mockResolvedValue(mockAuditRecord);

      await AuditService.record({
        actorId: "actor-1",
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.USER,
        previousValue: {
          email: "user@liminalbd.com",
          password: "plain-secret-password",
          nullField: null,
          undefField: undefined,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          nested: {
            current_password: "old-password-123",
            "new-password": "new-password-456",
            password_hash: "hash_xyz",
            token: "sensitive-token-xyz",
            normalField: "safe-value",
            innerNull: null,
          },
        },
        newValue: {
          secret: "super-secret-key",
          client_secret: "oauth-client-secret",
          tokenList: [{ reset_token: "tok-1", note: "token item" }],
          credential: "encrypted-credentials",
          apiConfig: { "api-key": "key-123", apiKey: "key-456" },
          authorization: "Bearer secret-jwt-token",
          cookie: "auth_session=abcdef",
          session_token: "sess-tok-123",
          hashed_password: "pbkdf2-hash",
        },
        metadata: {
          ip: "10.0.0.1",
          headers: {
            authorization: "Bearer my-token",
            cookie: "session=xyz",
            "access-token": "acc-123",
            refresh_token: "ref-456",
          },
        },
      });

      expect(createSpy).toHaveBeenCalledTimes(1);
      const callData = createSpy.mock.calls[0]?.[0]?.data;

      expect(callData?.previousValue).toEqual({
        email: "user@liminalbd.com",
        password: "[REDACTED]",
        nullField: null,
        undefField: undefined,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        nested: {
          current_password: "[REDACTED]",
          "new-password": "[REDACTED]",
          password_hash: "[REDACTED]",
          token: "[REDACTED]",
          normalField: "safe-value",
          innerNull: null,
        },
      });

      expect(callData?.newValue).toEqual({
        secret: "[REDACTED]",
        client_secret: "[REDACTED]",
        tokenList: [{ reset_token: "[REDACTED]", note: "token item" }],
        credential: "[REDACTED]",
        apiConfig: { "api-key": "[REDACTED]", apiKey: "[REDACTED]" },
        authorization: "[REDACTED]",
        cookie: "[REDACTED]",
        session_token: "[REDACTED]",
        hashed_password: "[REDACTED]",
      });

      expect(callData?.metadata).toEqual({
        ip: "10.0.0.1",
        headers: {
          authorization: "[REDACTED]",
          cookie: "[REDACTED]",
          "access-token": "[REDACTED]",
          refresh_token: "[REDACTED]",
        },
      });
    });

    it("should correctly handle Prisma.JsonNull when values are explicitly null", async () => {
      const createSpy = vi
        .spyOn(prisma.auditLog, "create")
        .mockResolvedValue(mockAuditRecord);

      await AuditService.record({
        actorId: "actor-1",
        action: AuditAction.SUSPEND,
        entityType: AuditEntityType.CUSTOMER,
        entityId: "cust-1",
        previousValue: null,
        newValue: null,
        metadata: null,
      });

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          actorId: "actor-1",
          action: AuditAction.SUSPEND,
          entityType: AuditEntityType.CUSTOMER,
          entityId: "cust-1",
          previousValue: Prisma.JsonNull,
          newValue: Prisma.JsonNull,
          metadata: Prisma.JsonNull,
        },
      });
    });

    it("should omit fields when previousValue, newValue, and metadata are undefined", async () => {
      const createSpy = vi
        .spyOn(prisma.auditLog, "create")
        .mockResolvedValue(mockAuditRecord);

      await AuditService.record({
        actorId: "actor-1",
        action: AuditAction.SOFT_DELETE,
        entityType: AuditEntityType.CUSTOMER,
      });

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          actorId: "actor-1",
          action: AuditAction.SOFT_DELETE,
          entityType: AuditEntityType.CUSTOMER,
          entityId: null,
        },
      });
    });
  });

  describe("Error Propagation & Failures", () => {
    it("should rethrow error when database operation fails", async () => {
      const dbError = new Error("Database connection timeout");
      vi.spyOn(prisma.auditLog, "create").mockRejectedValue(dbError);

      await expect(
        AuditService.record({
          actorId: "actor-1",
          action: AuditAction.CREATE,
          entityType: AuditEntityType.ADMIN,
        }),
      ).rejects.toThrow("Database connection timeout");
    });
  });
});
