import { APIError } from "better-auth/api";
import status from "http-status";
import { describe, expect, it } from "vitest";
import { AppError } from "../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import { handleBetterAuthError } from "../../../src/app/errors/handleBetterAuthError.js";

describe("handleBetterAuthError Unit Tests", () => {
  describe("Predefined Mapped Domain Errors", () => {
    it("should map credential errors correctly (INVALID_EMAIL_OR_PASSWORD)", () => {
      const apiError = new APIError("UNAUTHORIZED", {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Original Better Auth message",
      });

      const result = handleBetterAuthError(apiError);

      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(status.UNAUTHORIZED);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.INVALID_CREDENTIALS);
      expect(result.message).toBe("Invalid email or password");
    });

    it("should map account status errors correctly (EMAIL_NOT_VERIFIED, ACCOUNT_SUSPENDED, ACCOUNT_DEACTIVATED)", () => {
      const unverifiedError = new APIError("FORBIDDEN", {
        code: "EMAIL_NOT_VERIFIED",
      });
      const suspendedError = new APIError("FORBIDDEN", {
        code: "ACCOUNT_SUSPENDED",
      });
      const deactivatedError = new APIError("FORBIDDEN", {
        code: "ACCOUNT_DEACTIVATED",
      });

      const resUnverified = handleBetterAuthError(unverifiedError);
      expect(resUnverified.statusCode).toBe(status.FORBIDDEN);
      expect(resUnverified.code).toBe(PUBLIC_ERROR_CODES.EMAIL_NOT_VERIFIED);

      const resSuspended = handleBetterAuthError(suspendedError);
      expect(resSuspended.statusCode).toBe(status.FORBIDDEN);
      expect(resSuspended.code).toBe(PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED);

      const resDeactivated = handleBetterAuthError(deactivatedError);
      expect(resDeactivated.statusCode).toBe(status.FORBIDDEN);
      expect(resDeactivated.code).toBe(PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED);
    });

    it("should map user existence errors correctly (USER_NOT_FOUND, USER_ALREADY_EXISTS)", () => {
      const notFoundError = new APIError("NOT_FOUND", {
        code: "USER_NOT_FOUND",
      });
      const duplicateError = new APIError("CONFLICT", {
        code: "USER_ALREADY_EXISTS",
      });

      const resNotFound = handleBetterAuthError(notFoundError);
      expect(resNotFound.statusCode).toBe(status.NOT_FOUND);
      expect(resNotFound.code).toBe(PUBLIC_ERROR_CODES.USER_NOT_FOUND);

      const resDuplicate = handleBetterAuthError(duplicateError);
      expect(resDuplicate.statusCode).toBe(status.CONFLICT);
      expect(resDuplicate.code).toBe(PUBLIC_ERROR_CODES.USER_ALREADY_EXISTS);
    });

    it("should map OTP and verification token errors correctly", () => {
      const otpError = new APIError("BAD_REQUEST", {
        code: "INVALID_OTP",
      });
      const tokenError = new APIError("BAD_REQUEST", {
        code: "TOKEN_EXPIRED",
      });

      const resOtp = handleBetterAuthError(otpError);
      expect(resOtp.statusCode).toBe(status.BAD_REQUEST);
      expect(resOtp.code).toBe(PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP);

      const resToken = handleBetterAuthError(tokenError);
      expect(resToken.statusCode).toBe(status.BAD_REQUEST);
      expect(resToken.code).toBe(PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_TOKEN);
    });
  });

  describe("Rate Limiting & Unmapped Client Errors", () => {
    it("should map unmapped 401 UNAUTHORIZED to INVALID_CREDENTIALS", () => {
      const apiError = new APIError("UNAUTHORIZED", {
        message: "Unknown auth failure",
      });

      const result = handleBetterAuthError(apiError);

      expect(result.statusCode).toBe(status.UNAUTHORIZED);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.INVALID_CREDENTIALS);
      expect(result.message).toBe("Authentication request failed");
    });

    it("should map unmapped 429 TOO_MANY_REQUESTS to TOO_MANY_REQUESTS", () => {
      const apiError = new APIError("TOO_MANY_REQUESTS", {
        message: "Rate limit exceeded",
      });

      const result = handleBetterAuthError(apiError);

      expect(result.statusCode).toBe(status.TOO_MANY_REQUESTS);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.TOO_MANY_REQUESTS);
      expect(result.message).toBe("Too many requests. Please try again later.");
    });

    it("should map unmapped 400 BAD_REQUEST to VALIDATION_ERROR with safe fallback message", () => {
      const apiError = new APIError("BAD_REQUEST", {
        message: "Unknown malformed input",
      });

      const result = handleBetterAuthError(apiError);

      expect(result.statusCode).toBe(status.BAD_REQUEST);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
      expect(result.message).toBe("Authentication request failed");
    });

    it("should fallback to 400 BAD_REQUEST when error.statusCode is undefined", () => {
      const errorWithoutStatus = {
        name: "APIError",
        body: {},
      } as unknown as APIError;

      const result = handleBetterAuthError(errorWithoutStatus);

      expect(result.statusCode).toBe(status.BAD_REQUEST);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe("Internal Server Error Sanitization (500+)", () => {
    it("should sanitize 500+ errors to generic INTERNAL_SERVER_ERROR without leaking details", () => {
      const internalApiError = new APIError("INTERNAL_SERVER_ERROR", {
        message: "Secret database connection string leaked",
      });

      const result = handleBetterAuthError(internalApiError);

      expect(result.statusCode).toBe(status.INTERNAL_SERVER_ERROR);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe("An unexpected internal error occurred.");
      expect(result.message).not.toContain("database connection");
    });
  });
});
