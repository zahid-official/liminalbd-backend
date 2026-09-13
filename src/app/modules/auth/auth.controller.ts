import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AuthService } from "./auth.service.js";
import type {
  LoginWithCredentialsInput,
  RegisterCustomerInput,
  SendVerificationOtpInput,
  VerifyEmailOtpInput,
} from "./auth.validation.js";

// Register customer account
const registerCustomer = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as RegisterCustomerInput;
  const headers = fromNodeHeaders(req.headers);
  const result = await AuthService.registerCustomer(payload, headers);

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Account created successfully. Please verify your email.",
    data: result,
  });
});

// Send verification OTP
const sendVerificationOtp = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as SendVerificationOtpInput;
  const headers = fromNodeHeaders(req.headers);
  const result = await AuthService.sendVerificationOtp(payload, headers);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Verification code sent to your email",
    data: result,
  });
});

// Verify email using provided OTP
const verifyEmailOtp = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as VerifyEmailOtpInput;
  const headers = fromNodeHeaders(req.headers);
  const result = await AuthService.verifyEmailOtp(payload, headers);

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: "Email verified successfully",
    data: result.user,
  });
});

// Login with email and password credentials
const loginWithCredentials = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as LoginWithCredentialsInput;
  const headers = fromNodeHeaders(req.headers);
  const result = await AuthService.loginWithCredentials(payload, headers);

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: "Login successful",
    data: result.user,
  });
});

// Export auth controller
export const AuthController = {
  registerCustomer,
  sendVerificationOtp,
  verifyEmailOtp,
  loginWithCredentials,
};
