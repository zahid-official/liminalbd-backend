import type { RequestHandler } from "express";
import status from "http-status";
import { AppError } from "../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../errors/errorCodes.js";

// Catch-all middleware to forward unhandled routes as a typed 404 AppError
const notFoundErrorHandler: RequestHandler = (_req, _res, next) => {
  next(
    new AppError(
      status.NOT_FOUND,
      PUBLIC_ERROR_CODES.ROUTE_NOT_FOUND,
      "The requested route was not found on this server.",
    ),
  );
};

export { notFoundErrorHandler };
