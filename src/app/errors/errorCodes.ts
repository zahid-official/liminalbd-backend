// Registry of stable public application error codes
export const PUBLIC_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

// Union type of all valid public error codes
export type PublicErrorCode =
  (typeof PUBLIC_ERROR_CODES)[keyof typeof PUBLIC_ERROR_CODES];
