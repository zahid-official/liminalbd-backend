import status from "http-status";
import { describe, expect, it } from "vitest";
import { AppError } from "../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import {
  handlePrismaError,
  isPrismaError,
} from "../../../src/app/errors/handlePrismaError.js";
import { Prisma } from "../../../src/generated/prisma/client.js";

const CLIENT_VERSION = "7.0.0";

describe("handlePrismaError Unit Tests", () => {
  describe("isPrismaError Type Guard", () => {
    it("should return true for PrismaClientKnownRequestError", () => {
      const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: CLIENT_VERSION,
      });

      expect(isPrismaError(error)).toBe(true);
    });

    it("should return true for PrismaClientValidationError", () => {
      const error = new Prisma.PrismaClientValidationError("Invalid argument", {
        clientVersion: CLIENT_VERSION,
      });

      expect(isPrismaError(error)).toBe(true);
    });

    it("should return true for PrismaClientInitializationError", () => {
      const error = new Prisma.PrismaClientInitializationError(
        "Cannot connect to database",
        CLIENT_VERSION,
      );

      expect(isPrismaError(error)).toBe(true);
    });

    it("should return true for PrismaClientRustPanicError", () => {
      const error = new Prisma.PrismaClientRustPanicError(
        "Critical panic",
        CLIENT_VERSION,
      );

      expect(isPrismaError(error)).toBe(true);
    });

    it("should return true for PrismaClientUnknownRequestError", () => {
      const error = new Prisma.PrismaClientUnknownRequestError("Unknown query issue", {
        clientVersion: CLIENT_VERSION,
      });

      expect(isPrismaError(error)).toBe(true);
    });

    it("should return true for generic Error whose name starts with PrismaClient", () => {
      const customPrismaError = new Error("Mock engine error");
      customPrismaError.name = "PrismaClientGenericError";

      expect(isPrismaError(customPrismaError)).toBe(true);
    });

    it("should return false for standard Error or non-Prisma entities", () => {
      expect(isPrismaError(new Error("Standard runtime error"))).toBe(false);
      expect(isPrismaError(new TypeError("Invalid type"))).toBe(false);
      expect(isPrismaError({ message: "Object with message" })).toBe(false);
      expect(isPrismaError(null)).toBe(false);
      expect(isPrismaError(undefined)).toBe(false);
    });
  });

  describe("handlePrismaUniqueError (P2002 Unique Constraint)", () => {
    it("should map unique violation with target fields array to 409 CONFLICT and structured error details", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`email`)",
        {
          code: "P2002",
          clientVersion: CLIENT_VERSION,
          meta: { target: ["email"] },
        },
      );

      const result = handlePrismaError(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(status.CONFLICT);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.CONFLICT);
      expect(result.message).toBe("A record with this email already exists");
      expect(result.errors).toEqual([
        {
          field: "email",
          message: "email already exists",
        },
      ]);
    });

    it("should handle unique violation without target array gracefully", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: CLIENT_VERSION,
          meta: {},
        },
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.CONFLICT);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.CONFLICT);
      expect(result.message).toBe("A record with this field already exists");
      expect(result.errors).toBeUndefined();
    });
  });

  describe("Known Request Query & Relational Errors (P2xxx)", () => {
    it("should map record not found error codes (P2001, P2015, P2018, P2025) to 404 NOT_FOUND", () => {
      const notFoundCodes = ["P2001", "P2015", "P2018", "P2025"] as const;

      for (const code of notFoundCodes) {
        const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
          code,
          clientVersion: CLIENT_VERSION,
        });

        const result = handlePrismaError(error);

        expect(result.statusCode).toBe(status.NOT_FOUND);
        expect(result.code).toBe(PUBLIC_ERROR_CODES.NOT_FOUND);
      }
    });

    it("should map foreign key constraint violation (P2003) to 400 VALIDATION_ERROR", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        {
          code: "P2003",
          clientVersion: CLIENT_VERSION,
        },
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.BAD_REQUEST);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
      expect(result.message).toBe("Referenced relationship does not exist");
    });

    it("should map database check constraint violation (P2004) to 400 VALIDATION_ERROR", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Check constraint failed",
        {
          code: "P2004",
          clientVersion: CLIENT_VERSION,
        },
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.BAD_REQUEST);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
      expect(result.message).toBe("Database constraint condition failed");
    });

    it("should map invalid field value error (P2006) to 400 VALIDATION_ERROR", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Invalid field value",
        {
          code: "P2006",
          clientVersion: CLIENT_VERSION,
        },
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.BAD_REQUEST);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
      expect(result.message).toBe("Provided value is invalid for database field");
    });

    it("should map unmapped P2xxx constraint violations to 400 VALIDATION_ERROR fallback", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unmapped P2 constraint violation",
        {
          code: "P2030",
          clientVersion: CLIENT_VERSION,
        },
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.BAD_REQUEST);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
      expect(result.message).toBe("Database request constraint violation");
    });
  });

  describe("Database Connectivity & Initialization Errors (P1xxx / InitializationError)", () => {
    it("should map P1xxx database connection errors to 503 SERVICE_UNAVAILABLE", () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Can't reach database server",
        {
          code: "P1001",
          clientVersion: CLIENT_VERSION,
        },
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.SERVICE_UNAVAILABLE);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe("Database service is temporarily unavailable");
    });

    it("should map PrismaClientInitializationError to 503 SERVICE_UNAVAILABLE", () => {
      const error = new Prisma.PrismaClientInitializationError(
        "Database initialization failed",
        CLIENT_VERSION,
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.SERVICE_UNAVAILABLE);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe("Database service is temporarily unavailable");
    });
  });

  describe("PrismaClientValidationError", () => {
    it("should map query argument validation errors to 400 VALIDATION_ERROR", () => {
      const error = new Prisma.PrismaClientValidationError(
        "Invalid `prisma.user.findUnique()` invocation",
        { clientVersion: CLIENT_VERSION },
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.BAD_REQUEST);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.VALIDATION_ERROR);
      expect(result.message).toBe("Invalid query arguments provided to database");
    });
  });

  describe("Unmapped & Unexpected Errors (Fallback)", () => {
    it("should map unknown Prisma error to 500 INTERNAL_SERVER_ERROR", () => {
      const error = new Prisma.PrismaClientUnknownRequestError(
        "Unknown engine error",
        { clientVersion: CLIENT_VERSION },
      );

      const result = handlePrismaError(error);

      expect(result.statusCode).toBe(status.INTERNAL_SERVER_ERROR);
      expect(result.code).toBe(PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(result.message).toBe("An unexpected database error occurred");
    });
  });
});
