import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
} from "../../validations/common.validation.js";

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

    password: passwordSchema,
  }),
};

// Get Customer Profile Schema
const getCustomerProfileSchema = {
  params: z.object({
    id: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "Customer ID is required"
            : "Customer ID must be a valid text string",
      })
      .trim()
      .pipe(z.uuid({ error: "Invalid Customer ID format" })),
  }),
};

// Inferred input types
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema.body>;
export type GetCustomerProfileParams = z.infer<
  typeof getCustomerProfileSchema.params
>;

// Export customer validation schemas
export const CustomerValidation = {
  registerCustomerSchema,
  getCustomerProfileSchema,
};
