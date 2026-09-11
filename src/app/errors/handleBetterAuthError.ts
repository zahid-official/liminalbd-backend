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

// Transform Better Auth APIError into standardized AppError
const handleBetterAuthError = (error: APIError): AppError => {
  const authCode = error.body?.code as AuthErrorCode;
  const mapped = authErrorMap[authCode];

  if (mapped) {
    return new AppError(mapped.status, mapped.code, mapped.message);
  }

  const statusCode = error.statusCode || status.BAD_REQUEST;
  const message = error.body?.message || error.message;
  return new AppError(statusCode, PUBLIC_ERROR_CODES.VALIDATION_ERROR, message);
};

export { handleBetterAuthError };
