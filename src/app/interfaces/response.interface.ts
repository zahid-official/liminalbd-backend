// Pagination metadata interface
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Response options interface for sendResponse helper
export interface SendResponseOptions<T> {
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

// Standardized API success response payload structure
export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}
