import { APIError } from "better-auth/api";
import status from "http-status";
import { describe, expect, it } from "vitest";
import { AppError } from "../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import { handleBetterAuthError } from "../../../src/app/errors/handleBetterAuthError.js";

describe("handleBetterAuthError Unit Tests", () => {
  describe("Predefined Mapped Domain Errors", () => {
    it("should map credential errors correctly (INVALID_EMAIL_OR_PASSWORD, INVALID_CREDENTIALS)", () => {
      const emailPasswordError = new APIError("UNAUTHORIZED", {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Original Better Auth message",
      });
      const credentialsError = new APIError("UNAUTHORIZED", {
        code: "INVALID_CREDENTIALS",
      });

      const resEmailPassword = handleBetterAuthError(emailPasswordError);
      expect(resEmailPassword).toBeInstanceOf(AppError);
      expect(resEmailPassword.statusCode).toBe(status.UNAUTHORIZED);
      expect(resEmailPassword.code).toBe(PUBLIC_ERROR_CODES.INVALID_CREDENTIALS);
      expect(resEmailPassword.message).toBe("Invalid email or password");

      const resCredentials = handleBetterAuthError(credentialsError);
      expect(resCredentials.statusCode).toBe(status.UNAUTHORIZED);
      expect(resCredentials.code).toBe(PUBLIC_ERROR_CODES.INVALID_CREDENTIALS);
      expect(resCredentials.message).toBe("Invalid email or password");
    });

    it("should map account status and portal boundary errors correctly (EMAIL_NOT_VERIFIED, ACCOUNT_SUSPENDED, ACCOUNT_DEACTIVATED, FORBIDDEN_ROLE_ACCESS)", () => {
      const unverifiedError = new APIError("FORBIDDEN", {
        code: "EMAIL_NOT_VERIFIED",
      });
      const suspendedError = new APIError("FORBIDDEN", {
        code: "ACCOUNT_SUSPENDED",
      });
      const deactivatedError = new APIError("FORBIDDEN", {
        code: "ACCOUNT_DEACTIVATED",
      });
      const forbiddenRoleError = new APIError("FORBIDDEN", {
        code: "FORBIDDEN_ROLE_ACCESS",
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

      const resForbiddenRole = handleBetterAuthError(forbiddenRoleError);
      expect(resForbiddenRole.statusCode).toBe(status.FORBIDDEN);
      expect(resForbiddenRole.code).toBe(
        PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
      );
      expect(resForbiddenRole.message).toBe(
        "Access denied. This login portal is reserved for customers.",
      );
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

    it("should map OTP and verification token errors correctly (INVALID_OTP, OTP_EXPIRED, TOKEN_EXPIRED, INVALID_TOKEN)", () => {
      const otpError = new APIError("BAD_REQUEST", {
        code: "INVALID_OTP",
      });
      const otpExpiredError = new APIError("BAD_REQUEST", {
        code: "OTP_EXPIRED",
      });
      const tokenError = new APIError("BAD_REQUEST", {
        code: "TOKEN_EXPIRED",
      });
      const invalidTokenError = new APIError("BAD_REQUEST", {
        code: "INVALID_TOKEN",
      });

      const resOtp = handleBetterAuthError(otpError);
      expect(resOtp.statusCode).toBe(status.BAD_REQUEST);
      expect(resOtp.code).toBe(PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP);

      const resOtpExpired = handleBetterAuthError(otpExpiredError);
      expect(resOtpExpired.statusCode).toBe(status.BAD_REQUEST);
      expect(resOtpExpired.code).toBe(
        PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP,
      );

      const resToken = handleBetterAuthError(tokenError);
      expect(resToken.statusCode).toBe(status.BAD_REQUEST);
      expect(resToken.code).toBe(PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_TOKEN);

      const resInvalidToken = handleBetterAuthError(invalidTokenError);
      expect(resInvalidToken.statusCode).toBe(status.BAD_REQUEST);
      expect(resInvalidToken.code).toBe(
        PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_TOKEN,
      );
    });

    it("should map rate limiting error code correctly (TOO_MANY_ATTEMPTS)", () => {
      const apiError = new APIError("TOO_MANY_REQUESTS", {
        code: "TOO_MANY_ATTEMPTS",
      });

      const result = handleBetterAuthError(apiError);

      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(status.TOO_MANY_REQUESTS);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.TOO_MANY_REQUESTS);
      expect(result.message).toBe(
        "Too many verification attempts. Please try again later.",
      );
    });

    it("should map password change and set errors correctly (INVALID_PASSWORD, CREDENTIAL_ACCOUNT_NOT_FOUND, PASSWORD_ALREADY_SET)", () => {
      const invalidPasswordError = new APIError("BAD_REQUEST", {
        code: "INVALID_PASSWORD",
      });
      const noCredentialError = new APIError("FORBIDDEN", {
        code: "CREDENTIAL_ACCOUNT_NOT_FOUND",
      });
      const alreadySetError = new APIError("BAD_REQUEST", {
        code: "PASSWORD_ALREADY_SET",
      });

      const resInvalidPassword = handleBetterAuthError(invalidPasswordError);
      expect(resInvalidPassword.statusCode).toBe(status.BAD_REQUEST);
      expect(resInvalidPassword.code).toBe(
        PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
      );
      expect(resInvalidPassword.message).toBe("Incorrect current password");

      const resNoCredential = handleBetterAuthError(noCredentialError);
      expect(resNoCredential.statusCode).toBe(status.FORBIDDEN);
      expect(resNoCredential.code).toBe(
        PUBLIC_ERROR_CODES.PASSWORD_CHANGE_NOT_ALLOWED,
      );
      expect(resNoCredential.message).toBe(
        "Password change is not permitted for the current authentication state.",
      );

      const resAlreadySet = handleBetterAuthError(alreadySetError);
      expect(resAlreadySet.statusCode).toBe(status.BAD_REQUEST);
      expect(resAlreadySet.code).toBe(PUBLIC_ERROR_CODES.CONFLICT);
      expect(resAlreadySet.message).toBe(
        "A password has already been set for this account. Please use change password.",
      );
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
