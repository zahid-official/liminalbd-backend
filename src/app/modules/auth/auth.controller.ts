import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import status from "http-status";
import { env } from "../../config/env.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import type { AuthSession, AuthUser } from "./auth.interface.js";
import { AuthService } from "./auth.service.js";
import type {
  ChangePasswordBody,
  ConfirmEmailVerificationBody,
  ForgotPasswordBody,
  LinkGoogleQuery,
  LoginWithCredentialsBody,
  LoginWithGoogleQuery,
  RequestEmailVerificationBody,
  ResetPasswordBody,
  SetPasswordBody,
} from "./auth.validation.js";

// Request email verification OTP
const requestEmailVerification = catchAsync(
  async (req: Request, res: Response) => {
    const headers = fromNodeHeaders(req.headers);
    const payload = res.locals.validated?.body as RequestEmailVerificationBody;
    
    const result = await AuthService.requestEmailVerification({
      headers,
      payload,
    });

    sendResponse(res, {
      statusCode: status.OK,
      message: "Verification code sent to your email",
      data: result,
    });
  },
);

// Confirm email verification using provided OTP
const confirmEmailVerification = catchAsync(
  async (req: Request, res: Response) => {
    const payload = res.locals.validated?.body as ConfirmEmailVerificationBody;
    const headers = fromNodeHeaders(req.headers);

    const result = await AuthService.confirmEmailVerification({
      headers,
      payload,
    });

    if (result.setCookies.length > 0) {
      res.setHeader("set-cookie", result.setCookies);
    }

    sendResponse(res, {
      statusCode: status.OK,
      message: "Email verified successfully",
      data: result.user,
    });
  },
);

// Login with email and password credentials
const loginWithCredentials = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as LoginWithCredentialsBody;
  const headers = fromNodeHeaders(req.headers);

  const result = await AuthService.loginWithCredentials({
    headers,
    payload,
  });

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

  const result = await AuthService.loginWithGoogle({
    headers,
    redirectTo: query?.redirectTo,
  });

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
  const user = res.locals.user as AuthUser;
  const headers = fromNodeHeaders(req.headers);
  const query = res.locals.validated?.query as LinkGoogleQuery | undefined;

  const result = await AuthService.linkGoogleAccount({
    headers,
    user,
    redirectTo: query?.redirectTo,
  });

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
const unlinkGoogle = catchAsync(async (_req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const result = await AuthService.unlinkGoogleAccount(user.id);

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Forgot password request
const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as ForgotPasswordBody;
  const headers = fromNodeHeaders(req.headers);

  const result = await AuthService.forgotPassword({
    headers,
    payload,
  });

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Reset password using token
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as ResetPasswordBody;
  const headers = fromNodeHeaders(req.headers);

  const result = await AuthService.resetPassword({
    headers,
    payload,
  });

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Change password for authenticated user
const changePassword = catchAsync(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const payload = res.locals.validated?.body as ChangePasswordBody;
  const headers = fromNodeHeaders(req.headers);

  const result = await AuthService.changePassword({
    userId: user.id,
    headers,
    payload,
  });

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Set initial password for authenticated user without password
const setPassword = catchAsync(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const payload = res.locals.validated?.body as SetPasswordBody;
  const headers = fromNodeHeaders(req.headers);

  const result = await AuthService.setPassword({
    userId: user.id,
    headers,
    payload,
  });

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Logout current session
const logout = catchAsync(async (req: Request, res: Response) => {
  const session = res.locals.session as AuthSession;
  const headers = fromNodeHeaders(req.headers);

  const result = await AuthService.logout({
    headers,
    sessionToken: session.token,
  });

  if (result.setCookies.length > 0) {
    res.setHeader("set-cookie", result.setCookies);
  }

  sendResponse(res, {
    statusCode: status.OK,
    message: result.message,
    data: null,
  });
});

// Logout all active sessions across all devices
const logoutAll = catchAsync(async (req: Request, res: Response) => {
  const headers = fromNodeHeaders(req.headers);
  const result = await AuthService.logoutAll(headers);

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
  requestEmailVerification,
  confirmEmailVerification,
  loginWithCredentials,
  loginWithGoogle,
  handleOAuthError,
  linkGoogle,
  unlinkGoogle,
  forgotPassword,
  resetPassword,
  changePassword,
  setPassword,
  logout,
  logoutAll,
};
