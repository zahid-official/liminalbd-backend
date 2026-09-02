import type { ErrorRequestHandler } from "express";
import status from "http-status";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import type {
  ErrorResponse,
  ErrorSource,
} from "../interfaces/error.interface.js";

// globalErrorHandler Function
const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const devMode = env.NODE_ENV === "development";

  // Default error response values
  let statusCode: number = status.INTERNAL_SERVER_ERROR;
  let message = "Something went wrong!";
  let errorSources: ErrorSource[] = [];

  // Custom application error
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorSources = [{ path: "", message: error.message }];
  }

  // Standard native JavaScript error
  else if (error instanceof Error) {
    message = error.message;
    errorSources = [{ path: "", message: error.message }];
  }

  // Format stack trace in development mode
  const stack: string[] | undefined =
    devMode && error instanceof Error && error.stack
      ? error.stack
          .split("\n")
          .map((line: string) => line.trim())
          .filter((line: string) => line.startsWith("at"))
      : undefined;

  // Build the error response
  const errorResponse: ErrorResponse = {
    success: false,
    message,
    errorSources,
    ...(devMode && {
      error,
      stack,
    }),
  };

  // Send the error response
  res.status(statusCode).json(errorResponse);
};

export { globalErrorHandler };
