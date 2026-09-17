import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
} from "../../validations/common.validation.js";

// Send Verification OTP Schema
const sendVerificationOtpSchema = {
  body: z.object({
    email: emailSchema,
  }),
};

// Verify Email OTP Schema
const verifyEmailOtpSchema = {
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
    redirectTo: z
      .string({
        error: "Redirect URL must be a valid text string",
      })
      .trim()
      .optional(),
  }),
};

// Link Google Account Schema
const linkGoogleSchema = {
  query: z.object({
    redirectTo: z
      .string({
        error: "Redirect URL must be a valid text string",
      })
      .trim()
      .optional(),
  }),
};

// Forgot Password Schema
const forgotPasswordSchema = {
  body: z.object({
    email: emailSchema,

    redirectTo: z
      .string({
        error: "Redirect URL must be a valid text string",
      })
      .trim()
      .optional(),
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
      .min(1, { error: "Reset token cannot be empty" }),

    newPassword: passwordSchema,
  }),
};

// Inferred input types from validation schemas
export type SendVerificationOtpInput = z.infer<
  typeof sendVerificationOtpSchema.body
>;
export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpSchema.body>;
export type LoginWithCredentialsInput = z.infer<
  typeof loginWithCredentialsSchema.body
>;
export type LoginWithGoogleQuery = z.infer<typeof loginWithGoogleSchema.query>;
export type LinkGoogleQuery = z.infer<typeof linkGoogleSchema.query>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema.body>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema.body>;

// Export validation schemas
export const AuthValidation = {
  sendVerificationOtpSchema,
  verifyEmailOtpSchema,
  loginWithCredentialsSchema,
  loginWithGoogleSchema,
  linkGoogleSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
