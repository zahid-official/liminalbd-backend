import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import { notFoundErrorHandler } from "../../../src/app/middleware/notFoundErrorHandler.js";

describe("notFoundErrorHandler Unit Tests", () => {
  it("should forward a 404 AppError with ROUTE_NOT_FOUND code to next()", () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    notFoundErrorHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: status.NOT_FOUND,
        code: PUBLIC_ERROR_CODES.ROUTE_NOT_FOUND,
        message: "The requested route was not found on this server.",
        isOperational: true,
      }),
    );
  });
});
