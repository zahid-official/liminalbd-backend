import type { z } from "zod";

// Schema definition for request validation supporting optional body, params, and query
export interface RequestValidationSchema {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

// Inferred parsed output types from the validated request schema
export type ValidatedRequest<TSchema extends RequestValidationSchema> = {
  [TLocation in keyof TSchema]: TSchema[TLocation] extends z.ZodType
    ? z.output<TSchema[TLocation]>
    : never;
};

// Typed contract for Express response locals storing validated request data
export interface ValidatedLocals<TSchema extends RequestValidationSchema> {
  validated: ValidatedRequest<TSchema>;
}
