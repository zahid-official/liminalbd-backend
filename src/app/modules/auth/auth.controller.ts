import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import status from "http-status";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../errors/errorCodes.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AuthService } from "./auth.service.js";
import type {
  ForgotPasswordInput,
  LinkGoogleQuery,
  LoginWithCredentialsInput,
  LoginWithGoogleQuery,
  RegisterCustomerInput,
  ResetPasswordInput,
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

// Login with Google OAuth
const loginWithGoogle = catchAsync(async (req: Request, res: Response) => {
  const headers = fromNodeHeaders(req.headers);
  const query = res.locals.validated?.query as LoginWithGoogleQuery | undefined;
  const result = await AuthService.loginWithGoogle(headers, query?.redirectTo);

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: "Google authentication initialized",
    data: {
      url: result.url,
      redirect: result.redirect,
    },
  });
});

// OAuth error handler - safely redirects to frontend login with error query
const handleOAuthError = catchAsync(async (req: Request, res: Response) => {
  const error = (req.query.error as string) || "oauth_failed";
  res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
});

// Link Google account for authenticated customer
const linkGoogle = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(
      status.UNAUTHORIZED,
      PUBLIC_ERROR_CODES.UNAUTHORIZED,
      "Authentication required. Please sign in.",
    );
  }

  const headers = fromNodeHeaders(req.headers);
  const query = res.locals.validated?.query as LinkGoogleQuery | undefined;

  const result = await AuthService.linkGoogleAccount(
    user.id,
    user.role,
    headers,
    query?.redirectTo,
  );

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: "Google account linking initialized",
    data: {
      url: result.url,
      redirect: result.redirect,
    },
  });
});

// Unlink Google account from authenticated user
const unlinkGoogle = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new AppError(
      status.UNAUTHORIZED,
      PUBLIC_ERROR_CODES.UNAUTHORIZED,
      "Authentication required. Please sign in.",
    );
  }

  const result = await AuthService.unlinkGoogleAccount(user.id);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Forgot password request
const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as ForgotPasswordInput;
  const headers = fromNodeHeaders(req.headers);
  const result = await AuthService.forgotPassword(payload, headers);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Reset password using token
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as ResetPasswordInput;
  const headers = fromNodeHeaders(req.headers);
  const result = await AuthService.resetPassword(payload, headers);

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Export auth controller
export const AuthController = {
  registerCustomer,
  sendVerificationOtp,
  verifyEmailOtp,
  loginWithCredentials,
  loginWithGoogle,
  handleOAuthError,
  linkGoogle,
  unlinkGoogle,
  forgotPassword,
  resetPassword,
};
