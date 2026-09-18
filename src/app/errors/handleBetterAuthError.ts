import type { APIError } from "better-auth/api";
import status from "http-status";
import { AppError } from "./AppError.js";
import {
  PUBLIC_ERROR_CODES,
  type PublicErrorCode,
} from "./errorCodes.js";

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
  INVALID_CREDENTIALS: {
    status: status.UNAUTHORIZED,
    code: PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
    message: "Invalid email or password",
  },
  EMAIL_NOT_VERIFIED: {
    status: status.FORBIDDEN,
    code: PUBLIC_ERROR_CODES.EMAIL_NOT_VERIFIED,
    message: "Please verify your email before logging in",
  },
  FORBIDDEN_ROLE_ACCESS: {
    status: status.FORBIDDEN,
    code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
    message: "Access denied. This login portal is reserved for customers.",
  },
  ACCOUNT_SUSPENDED: {
    status: status.FORBIDDEN,
    code: PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED,
    message: "Your account has been suspended. Please contact support.",
  },
  ACCOUNT_DEACTIVATED: {
    status: status.FORBIDDEN,
    code: PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED,
    message: "Your account is deactivated. Please contact support.",
  },
  INVALID_OTP: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP,
    message: "Invalid or expired verification code",
  },
  OTP_EXPIRED: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_OTP,
    message: "Invalid or expired verification code",
  },
  TOKEN_EXPIRED: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_TOKEN,
    message: "Invalid or expired verification token",
  },
  INVALID_TOKEN: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.INVALID_OR_EXPIRED_TOKEN,
    message: "Invalid or expired verification token",
  },
  TOO_MANY_ATTEMPTS: {
    status: status.TOO_MANY_REQUESTS,
    code: PUBLIC_ERROR_CODES.TOO_MANY_REQUESTS,
    message: "Too many verification attempts. Please try again later.",
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
  let code: PublicErrorCode = PUBLIC_ERROR_CODES.VALIDATION_ERROR;
  let message = "Authentication request failed";

  if (statusCode === status.UNAUTHORIZED) {
    code = PUBLIC_ERROR_CODES.INVALID_CREDENTIALS;
  } else if (statusCode === status.TOO_MANY_REQUESTS) {
    code = PUBLIC_ERROR_CODES.TOO_MANY_REQUESTS;
    message = "Too many requests. Please try again later.";
  }

  return new AppError(statusCode, code, message);
};

export { handleBetterAuthError };
