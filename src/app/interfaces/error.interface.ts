import type { PublicErrorCode } from "../errors/errorCodes.js";

// Standard field-level error detail interface
export interface ErrorDetail {
  field: string;
  message: string;
}

// Standard application error response interface
export interface ErrorResponse {
  success: false;
  message: string;
  code: PublicErrorCode;
  errors?: ErrorDetail[];
}
