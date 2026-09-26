import { z } from "zod";
import {
  emailSchema,
  idSchema,
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
    id: idSchema,
  }),
};

// Inferred input types
export type RegisterCustomerBody = z.infer<typeof registerCustomerSchema.body>;
export type GetCustomerParams = z.infer<typeof getCustomerSchema.params>;

// Export customer validation schemas
export const CustomerValidation = {
  registerCustomerSchema,
  getCustomerSchema,
};
