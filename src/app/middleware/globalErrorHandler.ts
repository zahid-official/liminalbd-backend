import type { ErrorRequestHandler } from "express";
import status from "http-status";
import { AppError } from "../errors/AppError.js";
import {
  PUBLIC_ERROR_CODES,
  type PublicErrorCode,
} from "../errors/errorCodes.js";
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

  // Handle known client-safe operational errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    errors = error.errors;
  }

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
