import { isAPIError } from "better-auth/api";
import type { ErrorRequestHandler } from "express";
import status from "http-status";
import { AppError } from "../errors/AppError.js";
import {
  PUBLIC_ERROR_CODES,
  type PublicErrorCode,
} from "../errors/errorCodes.js";
import { handleBetterAuthError } from "../errors/handleBetterAuthError.js";
import {
  handlePrismaError,
  isPrismaError,
} from "../errors/handlePrismaError.js";
import type {
  ErrorDetail,
  ErrorResponse,
} from "../interfaces/error.interface.js";

// Central global error handling middleware for safe error serialization
const globalErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  // If response headers have already been sent, delegate to default Express error handler
  if (res.headersSent) {
    next(error);
    return;
  }

  let statusCode: number = status.INTERNAL_SERVER_ERROR;
  let code: PublicErrorCode = PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = "An unexpected internal error occurred.";
  let errors: ErrorDetail[] | undefined = undefined;

  // 1. Application-defined operational errors
  if (
    error instanceof AppError &&
    error.code !== PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR
  ) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    errors = error.errors;
  }

  // 2. Better Auth API errors
  else if (isAPIError(error)) {
    const authError = handleBetterAuthError(error);
    statusCode = authError.statusCode;
    code = authError.code;
    message = authError.message;
  }

  // 3. Prisma database errors
  else if (isPrismaError(error)) {
    const dbError = handlePrismaError(error);
    statusCode = dbError.statusCode;
    code = dbError.code;
    message = dbError.message;
    errors = dbError.errors;
  }

  // Unexpected runtime errors
  else {
    // eslint-disable-next-line no-console
    console.error("Unhandled runtime error:", error);
  }

  // Final unified response format
  const responseBody: ErrorResponse = {
    success: false,
    message,
    code,
  };

  if (errors && errors.length > 0) {
    responseBody.errors = errors;
  }

  res.status(statusCode).json(responseBody);
};

export { globalErrorHandler };
