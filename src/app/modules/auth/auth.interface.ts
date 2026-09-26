import type { auth } from "../../config/auth.js";
import type {
  ChangePasswordBody,
  ConfirmEmailVerificationBody,
  ForgotPasswordBody,
  LoginWithCredentialsBody,
  RequestEmailVerificationBody,
  ResetPasswordBody,
  SetPasswordBody,
} from "./auth.validation.js";

// Authenticated session context contracts
export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session.session;

// Input contract for requesting email verification OTP
export interface RequestEmailVerificationInput {
  headers: Headers;
  payload: RequestEmailVerificationBody;
}

// Input contract for confirming email verification OTP
export interface ConfirmEmailVerificationInput {
  headers: Headers;
  payload: ConfirmEmailVerificationBody;
}

// Input contract for login with email & password credentials
export interface LoginWithCredentialsInput {
  headers: Headers;
  payload: LoginWithCredentialsBody;
}

// Input contract for Google OAuth sign-in flow
export interface LoginWithGoogleInput {
  headers: Headers;
  redirectTo?: string | undefined;
}

// Input contract for linking Google account
export interface LinkGoogleAccountInput {
  headers: Headers;
  user: AuthUser;
  redirectTo?: string | undefined;
}


// Input contract for forgot password request
export interface ForgotPasswordInput {
  headers: Headers;
  payload: ForgotPasswordBody;
}

// Input contract for resetting user password
export interface ResetPasswordInput {
  headers: Headers;
  payload: ResetPasswordBody;
}

// Input contract for changing user password
export interface ChangePasswordInput {
  userId: string;
  headers: Headers;
  payload: ChangePasswordBody;
}

// Input contract for setting initial password on OAuth accounts
export interface SetPasswordInput {
  userId: string;
  headers: Headers;
  payload: SetPasswordBody;
}

// Input contract for logging out active session
export interface LogoutInput {
  headers: Headers;
  sessionToken: string;
}

