import type { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AuthService } from "./auth.service.js";

// Handle customer registration
const registerCustomer = catchAsync(
  async (_req: Request, res: Response): Promise<void> => {
    const payload = res.locals.validated.body;
    const result = await AuthService.registerCustomer(payload);

    sendResponse(res, {
      statusCode: status.CREATED,
      message: "Customer registered successfully",
      data: result,
    });
  },
);

export const AuthController = {
  registerCustomer,
};
