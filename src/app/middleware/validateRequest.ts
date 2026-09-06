import type { NextFunction, Request, RequestHandler, Response } from "express";
import status from "http-status";
import type { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../errors/errorCodes.js";
import type { ErrorDetail } from "../interfaces/error.interface.js";
import type {
  RequestValidationSchema,
  ValidatedRequest,
} from "../interfaces/validation.interface.js";

type RequestSource = "body" | "params" | "query";

// Format Zod issues into standardized error details with source-qualified field paths
const formatZodIssues = (
  source: RequestSource,
  zodError: ZodError,
): ErrorDetail[] => {
  return zodError.issues.map((issue) => {
    const subPath = issue.path.join(".");
    const field = subPath ? `${source}.${subPath}` : source;

    return {
      field,
      message: issue.message,
    };
  });
};

// Express middleware for validating request body, params, and query using Zod schemas
const validateRequest = <TSchema extends RequestValidationSchema>(
  schema: TSchema,
): RequestHandler => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const errors: ErrorDetail[] = [];
    const validatedData: Partial<Record<RequestSource, unknown>> = {};

    if (schema.body) {
      const result = await schema.body.safeParseAsync(req.body);
      if (result.success) {
        validatedData.body = result.data;
      } else {
        errors.push(...formatZodIssues("body", result.error));
      }
    }

    if (schema.params) {
      const result = await schema.params.safeParseAsync(req.params);
      if (result.success) {
        validatedData.params = result.data;
      } else {
        errors.push(...formatZodIssues("params", result.error));
      }
    }

    if (schema.query) {
      const result = await schema.query.safeParseAsync(req.query);
      if (result.success) {
        validatedData.query = result.data;
      } else {
        errors.push(...formatZodIssues("query", result.error));
      }
    }

    if (errors.length > 0) {
      next(
        new AppError(
          status.BAD_REQUEST,
          PUBLIC_ERROR_CODES.VALIDATION_ERROR,
          "Request validation failed.",
          errors,
        ),
      );
      return;
    }

    // Attach trusted, parsed data to Express response locals
    res.locals.validated = validatedData as ValidatedRequest<TSchema>;
    next();
  };
};

export { validateRequest };
