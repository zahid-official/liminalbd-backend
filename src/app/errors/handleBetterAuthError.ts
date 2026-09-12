import type { APIError } from "better-auth/api";
import status from "http-status";
import { AppError } from "./AppError.js";
import { PUBLIC_ERROR_CODES } from "./errorCodes.js";

// Better Auth error resolution map
const authErrorMap = {
  INVALID_EMAIL_OR_PASSWORD: {
    status: status.UNAUTHORIZED,
    code: PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
    message: "Invalid email or password",
  },
  INVALID_PASSWORD: {
    status: status.UNAUTHORIZED,
    code: PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
    message: "Invalid email or password",
  },
  INVALID_OTP: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP,
    message: "Invalid or expired verification code",
  },
  TOKEN_EXPIRED: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP,
    message: "Invalid or expired verification code",
  },
  USER_NOT_FOUND: {
    status: status.NOT_FOUND,
    code: PUBLIC_ERROR_CODES.USER_NOT_FOUND,
    message: "No account found with this email address",
  },
  USER_ALREADY_EXISTS: {
    status: status.CONFLICT,
    code: PUBLIC_ERROR_CODES.USER_ALREADY_EXISTS,
    message: "User with this email already exists",
  },
} as const;

type AuthErrorCode = keyof typeof authErrorMap;

// Helper to check if error code exists in our predefined authErrorMap
const getAuthErrorCode = (error: APIError): AuthErrorCode | undefined => {
  const code = error.body?.code;
  return typeof code === "string" && code in authErrorMap
    ? (code as AuthErrorCode)
    : undefined;
};

// Transform Better Auth APIError into standardized AppError
const handleBetterAuthError = (error: APIError): AppError => {
  // Resolve mapped domain errors
  const authCode = getAuthErrorCode(error);
  if (authCode) {
    const mapped = authErrorMap[authCode];
    return new AppError(mapped.status, mapped.code, mapped.message);
  }

  // Sanitize internal server errors to prevent information leakage
  const statusCode = error.statusCode || status.BAD_REQUEST;
  if (statusCode >= status.INTERNAL_SERVER_ERROR) {
    return new AppError(
      status.INTERNAL_SERVER_ERROR,
      PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
      "An unexpected internal error occurred.",
    );
  }

  // Categorize unmapped client errors with safe generic message
  const code =
    statusCode === status.UNAUTHORIZED
      ? PUBLIC_ERROR_CODES.INVALID_CREDENTIALS
      : PUBLIC_ERROR_CODES.VALIDATION_ERROR;

  return new AppError(statusCode, code, "Authentication request failed");
};

export { handleBetterAuthError };
