// Global error source interface
export interface ErrorSource {
  path: string;
  message: string;
}

// Global error response interface
export interface ErrorResponse {
  success: false;
  message: string;
  errorSources: ErrorSource[];
  error?: unknown;
  stack?: string[] | undefined;
}
