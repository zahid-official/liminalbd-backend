import { describe, expect, it } from "vitest";
import { AppError } from "../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import type { ErrorDetail } from "../../../src/app/interfaces/error.interface.js";

describe("AppError Unit Tests", () => {
  it("should instantiate correctly with statusCode, code, message, and default properties", () => {
    const error = new AppError(
      400,
      PUBLIC_ERROR_CODES.VALIDATION_ERROR,
      "Validation failed",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AppError");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Validation failed");
    expect(error.isOperational).toBe(true);
    expect(error.errors).toBeUndefined();
    expect(error.stack).toBeDefined();
  });

  it("should retain structured error details when provided", () => {
    const details: ErrorDetail[] = [
      { source: "body", field: "email", message: "Invalid email format" },
      { source: "body", field: "password", message: "Password too short" },
    ];

    const error = new AppError(
      422,
      PUBLIC_ERROR_CODES.VALIDATION_ERROR,
      "Unprocessable entity",
      details,
    );

    expect(error.statusCode).toBe(422);
    expect(error.errors).toEqual(details);
    expect(error.errors).toHaveLength(2);
  });
});
