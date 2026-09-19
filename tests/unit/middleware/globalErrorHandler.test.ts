import { APIError } from "better-auth/api";
import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { describe, expect, it, vi } from "vitest";
import { logger } from "../../../src/app/config/logger.js";
import { AppError } from "../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import type { ErrorDetail } from "../../../src/app/interfaces/error.interface.js";
import { globalErrorHandler } from "../../../src/app/middleware/globalErrorHandler.js";
import { Prisma } from "../../../src/generated/prisma/client.js";

const makeMockRes = (headersSent = false) => {
  const json = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json });
  const res = {
    headersSent,
    status: statusMock,
    json,
  } as unknown as Response;

  return { res, statusMock, json };
};

describe("globalErrorHandler Unit Tests", () => {
  describe("AppError Handling", () => {
    it("should format known operational AppError with custom status code, message, and code", () => {
      const { res, statusMock, json } = makeMockRes();
      const req = { id: "req-1" } as unknown as Request;
      const next = vi.fn() as unknown as NextFunction;

      const appError = new AppError(
        status.NOT_FOUND,
        PUBLIC_ERROR_CODES.NOT_FOUND,
        "Resource not found",
      );

      globalErrorHandler(appError, req, res, next);

      expect(statusMock).toHaveBeenCalledWith(status.NOT_FOUND);
      expect(json).toHaveBeenCalledWith({
        success: false,
        message: "Resource not found",
        code: PUBLIC_ERROR_CODES.NOT_FOUND,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should include field-level errors when AppError provides them", () => {
      const { res, statusMock, json } = makeMockRes();
      const req = { id: "req-2" } as unknown as Request;
      const next = vi.fn() as unknown as NextFunction;

      const details: ErrorDetail[] = [
        { source: "body", field: "email", message: "Email is required" },
      ];

      const appError = new AppError(
        status.BAD_REQUEST,
        PUBLIC_ERROR_CODES.VALIDATION_ERROR,
        "Validation failed",
        details,
      );

      globalErrorHandler(appError, req, res, next);

      expect(statusMock).toHaveBeenCalledWith(status.BAD_REQUEST);
      expect(json).toHaveBeenCalledWith({
        success: false,
        message: "Validation failed",
        code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
        errors: details,
      });
    });
  });

  describe("Unexpected / 500 Internal Error Handling", () => {
    it("should sanitize unexpected errors to 500 INTERNAL_SERVER_ERROR without leaking internal details", () => {
      const { res, statusMock, json } = makeMockRes();
      const req = { id: "req-3" } as unknown as Request;
      const next = vi.fn() as unknown as NextFunction;

      const internalError = new Error("Database connection password failed");

      globalErrorHandler(internalError, req, res, next);

      expect(statusMock).toHaveBeenCalledWith(status.INTERNAL_SERVER_ERROR);
      expect(json).toHaveBeenCalledWith({
        success: false,
        message: "An unexpected internal error occurred.",
        code: PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
      });

      const responsePayload = json.mock.calls[0]?.[0];
      expect(JSON.stringify(responsePayload)).not.toContain(
        "Database connection password failed",
      );
      expect(responsePayload).not.toHaveProperty("stack");
    });

    it("should log errors via logger when statusCode is 500 or higher", () => {
      const { res } = makeMockRes();
      const req = { id: "req-4" } as unknown as Request;
      const next = vi.fn() as unknown as NextFunction;

      const loggerSpy = vi.spyOn(logger, "error");
      const unhandledError = new Error("Critical subsystem failure");

      globalErrorHandler(unhandledError, req, res, next);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          err: unhandledError,
          requestId: "req-4",
        }),
        "Internal server error",
      );
    });
  });

  describe("Delegation when headers are sent", () => {
    it("should delegate to next(error) if res.headersSent is true", () => {
      const { res, statusMock, json } = makeMockRes(true);
      const req = { id: "req-5" } as unknown as Request;
      const next = vi.fn() as unknown as NextFunction;

      const error = new Error("Streaming error occurred");

      globalErrorHandler(error, req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);
      expect(statusMock).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe("Adapter Error Handling (Better Auth & Prisma)", () => {
    it("should handle Better Auth APIError via handleBetterAuthError", () => {
      const { res, statusMock, json } = makeMockRes();
      const req = { id: "req-auth" } as unknown as Request;
      const next = vi.fn() as unknown as NextFunction;

      const authError = new APIError("UNAUTHORIZED", {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      });

      globalErrorHandler(authError, req, res, next);

      expect(statusMock).toHaveBeenCalledWith(status.UNAUTHORIZED);
      expect(json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email or password",
        code: PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle Prisma database error via handlePrismaError", () => {
      const { res, statusMock, json } = makeMockRes();
      const req = { id: "req-prisma" } as unknown as Request;
      const next = vi.fn() as unknown as NextFunction;

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Record not found",
        {
          code: "P2025",
          clientVersion: "7.9.1",
        },
      );

      globalErrorHandler(prismaError, req, res, next);

      expect(statusMock).toHaveBeenCalledWith(status.NOT_FOUND);
      expect(json).toHaveBeenCalledWith({
        success: false,
        message: "The requested record was not found",
        code: PUBLIC_ERROR_CODES.NOT_FOUND,
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
