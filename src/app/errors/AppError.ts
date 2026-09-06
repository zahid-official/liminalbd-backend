import type { ErrorDetail } from "../interfaces/error.interface.js";
import type { PublicErrorCode } from "./errorCodes.js";

// Application operational error representing client-safe HTTP failures
export class AppError extends Error {
  public readonly isOperational = true as const;

  constructor(
    public readonly statusCode: number,
    public readonly code: PublicErrorCode,
    message: string,
    public readonly errors?: ErrorDetail[],
  ) {
    super(message);
    this.name = this.constructor.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
