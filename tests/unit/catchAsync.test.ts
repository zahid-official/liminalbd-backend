import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { catchAsync } from "../../src/app/utils/catchAsync.js";

describe("catchAsync Unit Tests", () => {
  describe("Successful Execution", () => {
    it("should execute the wrapped handler with req, res, next and not call next on success", async () => {
      const req = { body: { test: true } } as unknown as Request;
      const res = { status: vi.fn() } as unknown as Response;
      const next = vi.fn() as unknown as NextFunction;

      const handler = vi.fn().mockResolvedValue("success");
      const wrapped = catchAsync(handler);

      await wrapped(req, res, next);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Error Forwarding", () => {
    it("should catch rejected promise and forward error to next()", async () => {
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      const asyncError = new Error("Async operation failed");
      const handler = vi.fn().mockRejectedValue(asyncError);
      const wrapped = catchAsync(handler);

      await wrapped(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(asyncError);
    });

    it("should catch synchronous error and forward error to next()", async () => {
      const req = {} as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      const syncError = new Error("Synchronous throw");
      const handler = vi.fn().mockImplementation(() => {
        throw syncError;
      });
      const wrapped = catchAsync(handler);

      await wrapped(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(syncError);
    });
  });
});
