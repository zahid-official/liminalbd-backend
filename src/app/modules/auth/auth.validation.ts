import { z } from "zod";

// Validation schema for public customer registration
const registerValidationSchema = {
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

    email: z
      .email({
        error: (issue) =>
          issue.input === undefined
            ? "Email address is required"
            : "Please provide a valid email address",
      })
      .trim()
      .toLowerCase(),

    password: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "Password is required"
            : "Password must be a valid text string",
      })
      .min(8, { error: "Password must be at least 8 characters" })
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

// Inferred input types from validation schemas
export type RegisterCustomerInput = z.infer<
  typeof registerValidationSchema.body
>;

// Export the validation schemas
export const AuthValidation = {
  registerValidationSchema,
};
