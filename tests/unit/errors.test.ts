import { describe, expect, it } from "vitest";
import { AppError } from "../../src/app/errors/AppError.js";
import { ConfigurationError } from "../../src/app/errors/ConfigurationError.js";
import { PUBLIC_ERROR_CODES } from "../../src/app/errors/errorCodes.js";
import type { ErrorDetail } from "../../src/app/interfaces/error.interface.js";

describe("Custom Errors Unit Tests", () => {
  describe("AppError", () => {
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

  describe("ConfigurationError", () => {
    it("should instantiate with correct name, code, message, and stack trace", () => {
      const error = new ConfigurationError("Missing DATABASE_URL");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.name).toBe("ConfigurationError");
      expect(error.code).toBe("CONFIGURATION_ERROR");
      expect(error.message).toBe("Missing DATABASE_URL");
      expect(error.stack).toBeDefined();
    });
  });

  describe("PUBLIC_ERROR_CODES", () => {
    it("should have matching key-value pairs across all public error codes", () => {
      Object.entries(PUBLIC_ERROR_CODES).forEach(([key, value]) => {
        expect(value).toBe(key);
      });
    });
  });
});
