import type { NextFunction, Request, RequestHandler, Response } from "express";
import status from "http-status";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import { rbacGuard } from "../../../src/app/middleware/rbacGuard.js";
import { UserRole, UserStatus } from "../../../src/generated/prisma/enums.js";

describe("rbacGuard Unit Tests", () => {
  const createMockContext = (role?: UserRole, overrides?: Record<string, unknown>) => {
    const req = {
      body: {},
      headers: {},
      query: {},
      ...overrides,
    } as unknown as Request;

    const res = {
      locals: role
        ? {
            user: {
              id: "user-test-uuid-1",
              name: "Test User",
              email: "test@liminalbd.com",
              role,
              status: UserStatus.ACTIVE,
              deletedAt: null,
              emailVerified: true,
            },
          }
        : {},
    } as unknown as Response;

    const next = vi.fn() as unknown as NextFunction;

    return { req, res, next };
  };

  describe("Authorized Access Scenarios (next() called)", () => {
    it("should allow access when user role matches a single allowed role", async () => {
      const { req, res, next } = createMockContext(UserRole.ADMIN);
      const guard = rbacGuard(UserRole.ADMIN);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it("should allow access when user role matches one of multiple allowed roles (ADMIN)", async () => {
      const { req, res, next } = createMockContext(UserRole.ADMIN);
      const guard = rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it("should allow access when user role matches one of multiple allowed roles (SUPER_ADMIN)", async () => {
      const { req, res, next } = createMockContext(UserRole.SUPER_ADMIN);
      const guard = rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it("should allow CUSTOMER access on customer-dedicated endpoints", async () => {
      const { req, res, next } = createMockContext(UserRole.CUSTOMER);
      const guard = rbacGuard(UserRole.CUSTOMER);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("Unauthorized Role Access Scenarios (403 FORBIDDEN_ROLE_ACCESS)", () => {
    it("should reject with 403 when CUSTOMER attempts to access ADMIN route", async () => {
      const { req, res, next } = createMockContext(UserRole.CUSTOMER);
      const guard = rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        message: "You do not have permission to access this resource.",
      });
    });

    it("should reject with 403 when ADMIN attempts to access SUPER_ADMIN exclusive route", async () => {
      const { req, res, next } = createMockContext(UserRole.ADMIN);
      const guard = rbacGuard(UserRole.SUPER_ADMIN);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        message: "You do not have permission to access this resource.",
      });
    });

    it("should reject with 403 when no roles are specified in guard definition (runtime fallback)", async () => {
      const { req, res, next } = createMockContext(UserRole.SUPER_ADMIN);
      const guard = (rbacGuard as unknown as () => RequestHandler)();

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      });
    });
  });

  describe("Defense-in-Depth Authentication Scenarios (401 UNAUTHORIZED)", () => {
    it("should reject with 401 when res.locals.user is undefined (guard mounted without authGuard)", async () => {
      const { req, res, next } = createMockContext();
      const guard = rbacGuard(UserRole.ADMIN);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.UNAUTHORIZED,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
    });

    it("should reject with 401 when res.locals.user exists but role is undefined or empty", async () => {
      const req = {} as Request;
      const res = {
        locals: {
          user: {
            id: "user-no-role",
            email: "norole@example.com",
            role: undefined,
          },
        },
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;
      const guard = rbacGuard(UserRole.ADMIN);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.UNAUTHORIZED,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
    });
  });

  describe("Zero-Trust Client Spoofing Attack Immunity", () => {
    it("should strictly reject request when client injects spoofed role claims in body, headers, or query", async () => {
      // User is verified as CUSTOMER by authGuard, but attempts to spoof SUPER_ADMIN in client inputs
      const { req, res, next } = createMockContext(UserRole.CUSTOMER, {
        body: { role: "SUPER_ADMIN" },
        headers: { "x-user-role": "SUPER_ADMIN" },
        query: { role: "SUPER_ADMIN" },
      });

      const guard = rbacGuard(UserRole.SUPER_ADMIN);

      await guard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.FORBIDDEN,
        code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        message: "You do not have permission to access this resource.",
      });
    });
  });
});
