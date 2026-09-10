import type { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AuthService } from "./auth.service.js";

// Register customer account
const registerCustomer = catchAsync(async (_req: Request, res: Response) => {
  const payload = res.locals.validated.body;
  const result = await AuthService.registerCustomer(payload);

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Customer registered successfully",
    data: result,
  });
});

// Send verification OTP
const sendVerificationOtp = catchAsync(async (_req: Request, res: Response) => {
  const payload = res.locals.validated.body;
  const result = await AuthService.sendVerificationOtp(payload);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Verification code sent to your email",
    data: result,
  });
});

// Verify email using provided OTP
const verifyEmailOtp = catchAsync(async (_req: Request, res: Response) => {
  const payload = res.locals.validated.body;
  const result = await AuthService.verifyEmailOtp(payload);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Email verified successfully",
    data: result,
  });
});

const AuthController = {
  registerCustomer,
  sendVerificationOtp,
  verifyEmailOtp,
};

export { AuthController };
