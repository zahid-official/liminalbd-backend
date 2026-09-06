import type { Response } from "express";
import type {
  SendResponseOptions,
  SuccessResponse,
} from "../interfaces/response.interface.js";

// Standardized HTTP success response helper
export const sendResponse = <T>(
  res: Response,
  options: SendResponseOptions<T>,
): Response<SuccessResponse<T>> => {
  const { statusCode, message, data, meta } = options;

  const responseBody: SuccessResponse<T> = {
    success: true,
    message,
    data,
  };

  if (meta !== undefined) {
    responseBody.meta = meta;
  }

  return res.status(statusCode).json(responseBody) as Response<
    SuccessResponse<T>
  >;
};
