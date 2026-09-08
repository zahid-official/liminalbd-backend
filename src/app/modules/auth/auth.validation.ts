import { z } from "zod";

// Validation schema for public customer registration
const registerValidationSchema = {
  body: z.object({
    name: z
      .string({ error: "Name is required" })
      .trim()
      .min(2, { error: "Name must be at least 2 characters long" })
      .max(100, { error: "Name must not exceed 100 characters" }),
    email: z.email({ error: "Valid email is required" }).trim().toLowerCase(),
    password: z
      .string({ error: "Password is required" })
      .min(8, { error: "Password must be at least 8 characters long" })
      .regex(/[A-Z]/, {
        error: "Password must contain at least one uppercase letter",
      })
      .regex(/[a-z]/, {
        error: "Password must contain at least one lowercase letter",
      })
      .regex(/\d/, {
        error: "Password must contain at least one number",
      })
      .regex(/[^A-Za-z0-9]/, {
        error: "Password must contain at least one special character",
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
