import type { Response } from "express";
import type {
  SendResponseOptions,
  SuccessResponse,
} from "../interfaces/response.interface.js";

// Standardized HTTP success response helper
const sendResponse = <T>(
  res: Response<SuccessResponse<T>>,
  options: SendResponseOptions<T>,
) => {
  const { statusCode, message, data, meta } = options;

  const responseBody: SuccessResponse<T> = {
    success: true,
    message,
    data,
  };

  if (meta !== undefined) {
    responseBody.meta = meta;
  }

  return res.status(statusCode).json(responseBody);
};

export { sendResponse };
