import { z } from "zod";
import {
  emailSchema,
  nameSchema,
  passwordSchema,
} from "../../validations/common.validation.js";

// Register Customer Schema
const registerCustomerSchema = {
  body: z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
};

// Get Customer Params Schema
const getCustomerSchema = {
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
export type GetCustomerParams = z.infer<typeof getCustomerSchema.params>;

// Export customer validation schemas
export const CustomerValidation = {
  registerCustomerSchema,
  getCustomerSchema,
};
