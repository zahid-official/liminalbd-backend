import type { NextFunction, Request, RequestHandler, Response } from "express";

// Async controller handler type supporting asynchronous execution
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

// Async controller wrapper to catch and forward errors to the global error handler
const catchAsync = (fn: AsyncRequestHandler): RequestHandler => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };
};

export { catchAsync };
