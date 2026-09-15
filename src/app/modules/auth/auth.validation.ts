import { z } from "zod";

// Shared email validation schema with normalization preceding format checks
const emailSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? "Email address is required"
        : "Email must be a valid text string",
  })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: "Please provide a valid email address" })
      .max(255, { error: "Email address cannot exceed 255 characters" }),
  );

// Register Customer Schema
const registerCustomerSchema = {
  body: z.object({
    name: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "Full name is required"
            : "Name must be a valid text string",
      })
      .trim()
      .min(2, { error: "Name must be at least 2 characters" })
      .max(100, { error: "Name cannot exceed 100 characters" }),

    email: emailSchema,

    password: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "Password is required"
            : "Password must be a valid text string",
      })
      .min(8, { error: "Password must be at least 8 characters" })
      .max(100, { error: "Password cannot exceed 100 characters" })
      .regex(/[A-Z]/, {
        error: "Password must include at least one uppercase letter (A-Z)",
      })
      .regex(/[a-z]/, {
        error: "Password must include at least one lowercase letter (a-z)",
      })
      .regex(/\d/, {
        error: "Password must include at least one number (0-9)",
      })
      .regex(/[^A-Za-z0-9]/, {
        error: "Password must include at least one symbol (!@#$%^&*)",
      }),
  }),
};

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

// Inferred input types from validation schemas
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema.body>;
export type SendVerificationOtpInput = z.infer<
  typeof sendVerificationOtpSchema.body
>;
export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpSchema.body>;
export type LoginWithCredentialsInput = z.infer<
  typeof loginWithCredentialsSchema.body
>;
export type LoginWithGoogleQuery = z.infer<typeof loginWithGoogleSchema.query>;
export type LinkGoogleQuery = z.infer<typeof linkGoogleSchema.query>;

// Export validation schemas
export const AuthValidation = {
  registerCustomerSchema,
  sendVerificationOtpSchema,
  verifyEmailOtpSchema,
  loginWithCredentialsSchema,
  loginWithGoogleSchema,
  linkGoogleSchema,
};


