import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  redirectUrlSchema,
} from "../../validations/common.validation.js";

// Request Email Verification OTP Schema
const requestEmailVerificationSchema = {
  body: z.object({
    email: emailSchema,
  }),
};

// Confirm Email Verification OTP Schema
const confirmEmailVerificationSchema = {
  body: z.object({
    email: emailSchema,

    otp: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "OTP code is required"
            : "OTP code must be a valid string",
      })
      .trim()
      .regex(/^\d{6}$/, {
        error: "Verification code must be exactly 6 digits",
      }),
  }),
};

// Login With Credentials Schema
const loginWithCredentialsSchema = {
  body: z.object({
    email: emailSchema,

    password: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "Password is required"
            : "Password must be a valid text string",
      })
      .min(1, { error: "Password cannot be empty" })
      .max(100, { error: "Password cannot exceed 100 characters" }),
  }),
};

// Login With Google Schema
const loginWithGoogleSchema = {
  query: z.object({
    redirectTo: redirectUrlSchema.optional(),
  }),
};

// Link Google Account Schema
const linkGoogleSchema = {
  query: z.object({
    redirectTo: redirectUrlSchema.optional(),
  }),
};

// Forgot Password Schema
const forgotPasswordSchema = {
  body: z.object({
    email: emailSchema,
    redirectTo: redirectUrlSchema.optional(),
  }),
};

// Reset Password Schema
const resetPasswordSchema = {
  body: z.object({
    token: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "Reset token is required"
            : "Reset token must be a valid text string",
      })
      .trim()
      .min(1, { error: "Reset token cannot be empty" })
      .max(256, { error: "Reset token is invalid" }),

    newPassword: passwordSchema,
  }),
};

// Change Password Schema
const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z
        .string({
          error: (issue) =>
            issue.input === undefined
              ? "Current password is required"
              : "Current password must be a valid text string",
        })
        .min(1, { error: "Current password cannot be empty" })
        .max(100, { error: "Current password cannot exceed 100 characters" }),

      newPassword: passwordSchema,

      revokeOtherSessions: z
        .boolean({
          error: "Revoke other sessions must be a boolean",
        })
        .default(true),
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: "New password must be different from current password",
      path: ["newPassword"],
    }),
};

// Set Password Schema
const setPasswordSchema = {
  body: z.object({
    newPassword: passwordSchema,
  }),
};

// Inferred input types from validation schemas
export type RequestEmailVerificationInput = z.infer<
  typeof requestEmailVerificationSchema.body
>;
export type ConfirmEmailVerificationInput = z.infer<
  typeof confirmEmailVerificationSchema.body
>;
export type LoginWithCredentialsInput = z.infer<
  typeof loginWithCredentialsSchema.body
>;
export type LoginWithGoogleQuery = z.infer<typeof loginWithGoogleSchema.query>;
export type LinkGoogleQuery = z.infer<typeof linkGoogleSchema.query>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema.body>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema.body>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema.body>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema.body>;

// Export validation schemas
export const AuthValidation = {
  requestEmailVerificationSchema,
  confirmEmailVerificationSchema,
  loginWithCredentialsSchema,
  loginWithGoogleSchema,
  linkGoogleSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  setPasswordSchema,
};
