import status from "http-status";
import { Prisma } from "../../generated/prisma/client.js";
import type { ErrorDetail } from "../interfaces/error.interface.js";
import { AppError } from "./AppError.js";
import { PUBLIC_ERROR_CODES } from "./errorCodes.js";

// Common Prisma known error codes mapping for PostgreSQL/SQL
const prismaKnownErrorMap = {
  // Record not found errors
  P2001: {
    status: status.NOT_FOUND,
    code: PUBLIC_ERROR_CODES.NOT_FOUND,
    message: "The requested record was not found",
  },
  P2015: {
    status: status.NOT_FOUND,
    code: PUBLIC_ERROR_CODES.NOT_FOUND,
    message: "A related record could not be found",
  },
  P2018: {
    status: status.NOT_FOUND,
    code: PUBLIC_ERROR_CODES.NOT_FOUND,
    message: "The required connected records were not found",
  },
  P2025: {
    status: status.NOT_FOUND,
    code: PUBLIC_ERROR_CODES.NOT_FOUND,
    message: "The requested record was not found",
  },

  // Foreign key constraint violation
  P2003: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
    message: "Referenced relationship does not exist",
  },

  // Constraint violation on database (e.g. check constraint)
  P2004: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
    message: "Database constraint condition failed",
  },

  // Invalid value provided for field type (e.g. invalid enum or int out of range)
  P2006: {
    status: status.BAD_REQUEST,
    code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
    message: "Provided value is invalid for database field",
  },
} as const;

type PrismaKnownErrorCode = keyof typeof prismaKnownErrorMap;

// Extract target fields and create AppError for unique constraint violations
const handlePrismaUniqueError = (
  error: Prisma.PrismaClientKnownRequestError,
): AppError => {
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? (target as string[]) : [];
  const fieldName = fields.join(", ") || "field";

  const errors: ErrorDetail[] = fields.map((field) => ({
    field,
    message: `${field} already exists`,
  }));

  return new AppError(
    status.CONFLICT,
    PUBLIC_ERROR_CODES.CONFLICT,
    `A record with this ${fieldName} already exists`,
    errors.length > 0 ? errors : undefined,
  );
};

// Check if error originated from Prisma ORM
const isPrismaError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    (error instanceof Error && error.name.startsWith("PrismaClient"))
  );
};

// Transform any Prisma error into standardized AppError
const handlePrismaError = (error: unknown): AppError => {
  // 1. Known database query and constraint errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return handlePrismaUniqueError(error);
    }

    const code = error.code as PrismaKnownErrorCode;
    const mapped = prismaKnownErrorMap[code];

    if (mapped) {
      return new AppError(mapped.status, mapped.code, mapped.message);
    }

    // P1xxx connection errors thrown as known request errors
    if (error.code.startsWith("P1")) {
      return new AppError(
        status.SERVICE_UNAVAILABLE,
        PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
        "Database service is temporarily unavailable",
      );
    }

    return new AppError(
      status.BAD_REQUEST,
      PUBLIC_ERROR_CODES.VALIDATION_ERROR,
      "Database request constraint violation",
    );
  }

  // 2. Query argument validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new AppError(
      status.BAD_REQUEST,
      PUBLIC_ERROR_CODES.VALIDATION_ERROR,
      "Invalid query arguments provided to database",
    );
  }

  // 3. Database connectivity and initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new AppError(
      status.SERVICE_UNAVAILABLE,
      PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
      "Database service is temporarily unavailable",
    );
  }

  return new AppError(
    status.INTERNAL_SERVER_ERROR,
    PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
    "An unexpected database error occurred",
  );
};

export { handlePrismaError, isPrismaError };
