import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../src/app/config/auth.js";
import { prisma } from "../../src/app/config/prisma.js";
import { PUBLIC_ERROR_CODES } from "../../src/app/errors/errorCodes.js";
import { getApp } from "../helpers/app.helper.js";

describe("Phase 2 Integration & Security Verification Tests", () => {
  const sampleUuid = "11111111-1111-4111-8111-111111111111";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockSession = (role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN", status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" = "ACTIVE", deletedAt: Date | null = null) => {
    return {
      session: {
        id: "sess-sec-001",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: "user-sec-001",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        token: "sample-session-token",
        ipAddress: "127.0.0.1",
        userAgent: "vitest-supertest",
      },
      user: {
        id: "user-sec-001",
        name: "Test User",
        email: "test@example.com",
        emailVerified: true,
        image: null,
        role,
        status,
        needPasswordChange: false,
        deletedAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  };

  describe("RBAC: Customer Role Boundary Enforcement", () => {
    it("should reject CUSTOMER access to Super Admin route POST /api/v1/admins with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER") as any);

      const res = await request(getApp())
        .post("/api/v1/admins")
        .set("Cookie", ["better-auth.session_token=sample-session-token"])
        .send({
          name: "New Admin",
          email: "admin@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject CUSTOMER access to Super Admin route GET /api/v1/admins with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER") as any);

      const res = await request(getApp())
        .get("/api/v1/admins")
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject CUSTOMER access to Super Admin route PATCH /api/v1/admins/:id with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER") as any);

      const res = await request(getApp())
        .patch(`/api/v1/admins/${sampleUuid}`)
        .set("Cookie", ["better-auth.session_token=sample-session-token"])
        .send({ role: "SUPER_ADMIN" });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject CUSTOMER access to Admin route GET /api/v1/customers with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER") as any);

      const res = await request(getApp())
        .get("/api/v1/customers")
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject CUSTOMER access to Admin route GET /api/v1/customers/:id with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER") as any);

      const res = await request(getApp())
        .get(`/api/v1/customers/${sampleUuid}`)
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject CUSTOMER access to Admin route PATCH /api/v1/customers/:id/status with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER") as any);

      const res = await request(getApp())
        .patch(`/api/v1/customers/${sampleUuid}/status`)
        .set("Cookie", ["better-auth.session_token=sample-session-token"])
        .send({ status: "SUSPENDED" });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject CUSTOMER access to Admin route DELETE /api/v1/customers/:id with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER") as any);

      const res = await request(getApp())
        .delete(`/api/v1/customers/${sampleUuid}`)
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });
  });

  describe("RBAC: Admin Role Boundary Enforcement", () => {
    it("should reject ADMIN access to Super Admin route POST /api/v1/admins with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("ADMIN") as any);

      const res = await request(getApp())
        .post("/api/v1/admins")
        .set("Cookie", ["better-auth.session_token=sample-session-token"])
        .send({
          name: "Another Admin",
          email: "another@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject ADMIN access to Super Admin route GET /api/v1/admins with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("ADMIN") as any);

      const res = await request(getApp())
        .get("/api/v1/admins")
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject ADMIN access to Super Admin route PATCH /api/v1/admins/:id with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("ADMIN") as any);

      const res = await request(getApp())
        .patch(`/api/v1/admins/${sampleUuid}`)
        .set("Cookie", ["better-auth.session_token=sample-session-token"])
        .send({ role: "SUPER_ADMIN" });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject ADMIN access to Customer portal route POST /api/v1/auth/link/google with 403 FORBIDDEN_ROLE_ACCESS per DEC-020", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("ADMIN") as any);

      const res = await request(getApp())
        .post("/api/v1/auth/link/google")
        .set("Cookie", ["better-auth.session_token=sample-session-token"])
        .send({ idToken: "sample-token" });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject ADMIN access to Customer portal route POST /api/v1/auth/unlink/google with 403 FORBIDDEN_ROLE_ACCESS per DEC-020", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("ADMIN") as any);

      const res = await request(getApp())
        .post("/api/v1/auth/unlink/google")
        .set("Cookie", ["better-auth.session_token=sample-session-token"])
        .send({});

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });

    it("should reject unlinking when no Google account is linked with 400 ACCOUNT_NOT_LINKED", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER") as any);
      vi.spyOn(prisma.account, "findMany").mockResolvedValue([]);

      const res = await request(getApp())
        .post("/api/v1/auth/unlink/google")
        .set("Cookie", ["better-auth.session_token=sample-session-token"])
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.ACCOUNT_NOT_LINKED,
      });
    });
  });

  describe("Account Status Enforcement across Protected Routes", () => {
    it("should reject account with needPasswordChange: true with 403 PASSWORD_CHANGE_REQUIRED on administrative route", async () => {
      const mockSession = createMockSession("ADMIN");
      (mockSession.user as any).needPasswordChange = true;
      vi.spyOn(auth.api, "getSession").mockResolvedValue(mockSession as any);

      const res = await request(getApp())
        .get("/api/v1/customers")
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.PASSWORD_CHANGE_REQUIRED,
        message:
          "Password change is required before accessing administrative operations.",
      });
    });

    it("should reject SUSPENDED account with 403 ACCOUNT_SUSPENDED", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER", "SUSPENDED") as any);

      const res = await request(getApp())
        .get("/api/v1/users/profile")
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED,
        message: "Your account has been suspended. Please contact support.",
      });
    });

    it("should reject DEACTIVATED account with 403 ACCOUNT_DEACTIVATED", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER", "DEACTIVATED") as any);

      const res = await request(getApp())
        .get("/api/v1/users/profile")
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED,
        message: "Your account is deactivated. Please contact support.",
      });
    });

    it("should reject soft-deleted account with 401 UNAUTHORIZED (Anti-enumeration per DEC-018)", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(createMockSession("CUSTOMER", "ACTIVE", new Date()) as any);

      const res = await request(getApp())
        .get("/api/v1/users/profile")
        .set("Cookie", ["better-auth.session_token=sample-session-token"]);

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
    });
  });

  describe("Data Exposure & Error Sanitization", () => {
    it("should return clean 404 ROUTE_NOT_FOUND without leaking path traversal or system internals", async () => {
      const res = await request(getApp())
        .get("/api/v1/non-existent-endpoint-path");

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.ROUTE_NOT_FOUND,
      });
      expect(res.body.stack).toBeUndefined();
    });

    it("should handle CORS headers properly for allowed origins", async () => {
      const res = await request(getApp())
        .get("/")
        .set("Origin", "http://localhost:3000");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    });

    it("should not allow CORS for unauthorized or malicious origins", async () => {
      const res = await request(getApp())
        .get("/")
        .set("Origin", "http://malicious-site.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("Administrative Login Portal (POST /api/v1/auth/admin/login)", () => {
    it("should permit ADMIN credentials login and return session with cookies", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.session_token=admin-integration-token; Path=/; HttpOnly",
      );

      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        headers: mockAuthHeaders,
        response: {
          token: "admin-integration-token",
          user: {
            id: "admin-sec-001",
            name: "Sec Admin",
            email: "admin@example.com",
            emailVerified: true,
            role: "ADMIN",
            status: "ACTIVE",
          },
        },
      } as any);

      const res = await request(getApp())
        .post("/api/v1/auth/admin/login")
        .send({
          email: "admin@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: "Admin login successful",
        data: {
          id: "admin-sec-001",
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should permit SUPER_ADMIN credentials login and return session", async () => {
      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        headers: new Headers(),
        response: {
          token: "superadmin-integration-token",
          user: {
            id: "superadmin-sec-001",
            name: "Sec Super Admin",
            email: "superadmin@example.com",
            emailVerified: true,
            role: "SUPER_ADMIN",
            status: "ACTIVE",
          },
        },
      } as any);

      const res = await request(getApp())
        .post("/api/v1/auth/admin/login")
        .send({
          email: "superadmin@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        data: {
          role: "SUPER_ADMIN",
        },
      });
    });

    it("should reject CUSTOMER on POST /api/v1/auth/admin/login with 403 FORBIDDEN_ROLE_ACCESS", async () => {
      vi.spyOn(prisma.session, "deleteMany").mockResolvedValue({ count: 1 } as any);
      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        headers: new Headers(),
        response: {
          token: "customer-integration-token",
          user: {
            id: "cust-sec-001",
            name: "Sec Customer",
            email: "customer@example.com",
            emailVerified: true,
            role: "CUSTOMER",
            status: "ACTIVE",
          },
        },
      } as any);

      const res = await request(getApp())
        .post("/api/v1/auth/admin/login")
        .send({
          email: "customer@example.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({
        success: false,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        message:
          "Access denied. This login portal is reserved for administrators.",
      });
    });
  });
});
