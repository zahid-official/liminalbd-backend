import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../src/app/errors/errorCodes.js";
import { validateRequest } from "../../src/app/middleware/validateRequest.js";

describe("validateRequest Unit Tests", () => {
  describe("Successful Validation", () => {
    it("should validate and normalize valid body data and attach to res.locals.validated", async () => {
      const schema = {
        body: z.object({
          email: z.email(),
          count: z.number(),
        }),
      };

      const req = {
        body: { email: "user@example.com", count: 42 },
      } as Request;
      const res = {
        locals: {},
      } as Response;
      const next = vi.fn() as unknown as NextFunction;

      const middleware = validateRequest(schema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(res.locals.validated).toEqual({
        body: { email: "user@example.com", count: 42 },
      });
    });

    it("should validate and coerce valid params and query data", async () => {
      const schema = {
        params: z.object({
          id: z.string().min(1),
        }),
        query: z.object({
          page: z.coerce.number().int().positive(),
        }),
      };

      const req = {
        params: { id: "item-123" },
        query: { page: "3" },
      } as unknown as Request;
      const res = {
        locals: {},
      } as Response;
      const next = vi.fn() as unknown as NextFunction;

      const middleware = validateRequest(schema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(res.locals.validated).toEqual({
        params: { id: "item-123" },
        query: { page: 3 },
      });
    });
  });

  describe("Validation Failures & Error Aggregation", () => {
    it("should forward a 400 VALIDATION_ERROR AppError when body validation fails", async () => {
      const schema = {
        body: z.object({
          email: z.email({ error: "Invalid email format" }),
        }),
      };

      const req = {
        body: { email: "not-an-email" },
      } as Request;
      const res = {
        locals: {},
      } as Response;
      const next = vi.fn() as unknown as NextFunction;

      const middleware = validateRequest(schema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: status.BAD_REQUEST,
          code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
          message: "Request validation failed.",
          errors: [
            {
              source: "body",
              field: "email",
              message: "Invalid email format",
            },
          ],
        }),
      );
      expect(res.locals.validated).toBeUndefined();
    });

    it("should aggregate validation errors across multiple sources (body, params, query)", async () => {
      const schema = {
        body: z.object({
          name: z.string().min(3),
        }),
        params: z.object({
          id: z.uuid(),
        }),
        query: z.object({
          limit: z.coerce.number(),
        }),
      };

      const req = {
        body: { name: "ab" },
        params: { id: "invalid-uuid" },
        query: { limit: "not-a-number" },
      } as unknown as Request;
      const res = {
        locals: {},
      } as Response;
      const next = vi.fn() as unknown as NextFunction;

      const middleware = validateRequest(schema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: status.BAD_REQUEST,
          code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
          errors: expect.arrayContaining([
            expect.objectContaining({ source: "body", field: "name" }),
            expect.objectContaining({ source: "params", field: "id" }),
            expect.objectContaining({ source: "query", field: "limit" }),
          ]),
        }),
      );
    });

    it("should format root-level schema validation errors with field 'root'", async () => {
      const schema = {
        body: z.string({ error: "Body must be a string" }),
      };

      const req = {
        body: 12345,
      } as unknown as Request;
      const res = {
        locals: {},
      } as Response;
      const next = vi.fn() as unknown as NextFunction;

      const middleware = validateRequest(schema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: status.BAD_REQUEST,
          code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
          errors: [
            expect.objectContaining({
              source: "body",
              field: "root",
            }),
          ],
        }),
      );
    });
  });
});
