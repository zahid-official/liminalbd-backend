import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../../src/app/config/auth.js";
import { AppError } from "../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import { authGuard } from "../../../src/app/middleware/authGuard.js";
import { UserRole, UserStatus } from "../../../src/generated/prisma/enums.js";

describe("authGuard Unit Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: "user-cust-123",
    name: "Zahidul Islam",
    email: "zahid@liminalbd.com",
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    deletedAt: null,
    emailVerified: true,
  };

  const mockSession = {
    id: "session-123",
    userId: "user-cust-123",
    token: "session-token-abc",
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("Session Validation & Rejection Scenarios (401 UNAUTHORIZED)", () => {
    it("should reject with 401 UNAUTHORIZED when sessionData is null (missing session)", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue(null);

      const req = { headers: {} } as Request;
      const res = { locals: {} } as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.UNAUTHORIZED,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
      expect(res.locals.user).toBeUndefined();
      expect(res.locals.session).toBeUndefined();
    });

    it("should reject with 401 UNAUTHORIZED when session object is missing inside sessionData", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        session: null,
        user: mockUser,
      } as any);

      const req = { headers: {} } as Request;
      const res = { locals: {} } as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.UNAUTHORIZED,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
      expect(res.locals.user).toBeUndefined();
      expect(res.locals.session).toBeUndefined();
    });

    it("should reject with 401 UNAUTHORIZED when user object is missing inside sessionData", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        session: mockSession,
        user: null,
      } as any);

      const req = { headers: {} } as Request;
      const res = { locals: {} } as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.UNAUTHORIZED,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
      expect(res.locals.user).toBeUndefined();
      expect(res.locals.session).toBeUndefined();
    });

    it("should reject with 401 UNAUTHORIZED when user is soft-deleted (deletedAt !== null)", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        session: mockSession,
        user: {
          ...mockUser,
          id: "deleted-user-1",
          deletedAt: new Date("2026-01-01T00:00:00Z"),
        },
      } as any);

      const req = { headers: {} } as Request;
      const res = { locals: {} } as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = vi.mocked(next).mock.calls[0]?.[0];
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: status.UNAUTHORIZED,
        code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
        message: "Authentication required. Please sign in.",
      });
      expect(res.locals.user).toBeUndefined();
      expect(res.locals.session).toBeUndefined();
    });
  });

  describe("Successful Authentication & Identity Context Injection (Happy Path)", () => {
    it("should attach user and session to res.locals and call next() without arguments", async () => {
      const getSessionSpy = vi.spyOn(auth.api, "getSession").mockResolvedValue({
        session: mockSession,
        user: mockUser,
      } as any);

      const req = {
        headers: {
          cookie: "better-auth.session_token=session-token-abc",
          "user-agent": "Vitest-Agent",
        },
      } as unknown as Request;
      const res = { locals: {} } as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(getSessionSpy).toHaveBeenCalledTimes(1);
      expect(getSessionSpy).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        query: {
          disableCookieCache: true,
        },
      });

      const passedHeaders = getSessionSpy.mock.calls[0]?.[0]?.headers as Headers;
      expect(passedHeaders.get("cookie")).toBe(
        "better-auth.session_token=session-token-abc",
      );
      expect(passedHeaders.get("user-agent")).toBe("Vitest-Agent");

      expect(res.locals.user).toEqual(mockUser);
      expect(res.locals.session).toEqual(mockSession);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it("should faithfully attach administrative user sessions without premature role filtering", async () => {
      const adminUser = {
        ...mockUser,
        id: "admin-456",
        role: UserRole.ADMIN,
      };

      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        session: mockSession,
        user: adminUser,
      } as any);

      const req = { headers: {} } as Request;
      const res = { locals: {} } as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(res.locals.user).toEqual(adminUser);
      expect(res.locals.session).toEqual(mockSession);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("Security & Request Immutability Boundaries (DEC-022)", () => {
    it("should strictly derive identity from server session and ignore client-injected claims", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        session: mockSession,
        user: mockUser,
      } as any);

      const req = {
        headers: {
          "x-user-id": "spoofed-user-999",
          "x-user-role": "SUPER_ADMIN",
        },
        body: {
          userId: "spoofed-body-user",
          role: "SUPER_ADMIN",
        },
      } as unknown as Request;
      const res = { locals: {} } as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(res.locals.user).toEqual(mockUser);
      expect(res.locals.session).toEqual(mockSession);
      expect((req as any).user).toBeUndefined();
      expect((req as any).session).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it("should preserve pre-existing properties on res.locals without mutation or erasure", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValue({
        session: mockSession,
        user: mockUser,
      } as any);

      const req = { headers: {} } as Request;
      const res = {
        locals: {
          requestId: "req-trace-456",
          validated: { query: { page: 1 } },
        },
      } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(res.locals.user).toEqual(mockUser);
      expect(res.locals.session).toEqual(mockSession);
      expect(res.locals.requestId).toBe("req-trace-456");
      expect(res.locals.validated).toEqual({ query: { page: 1 } });
      expect((req as any).user).toBeUndefined();
      expect((req as any).session).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("Unexpected Error Handling (catchAsync)", () => {
    it("should catch and forward unexpected getSession failures to next() middleware", async () => {
      const dbError = new Error("Database connection timeout");
      vi.spyOn(auth.api, "getSession").mockRejectedValue(dbError);

      const req = { headers: {} } as Request;
      const res = { locals: {} } as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authGuard(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.locals.user).toBeUndefined();
      expect(res.locals.session).toBeUndefined();
    });
  });
});
