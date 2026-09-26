import { z } from "zod";
import {
  emailSchema,
  idSchema,
  nameSchema,
  paginationQuerySchema,
  passwordSchema,
  userStatusSchema,
} from "../../validations/common.validation.js";
import { CUSTOMER_SORT_FIELDS } from "./customer.constant.js";

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

// Get Customers Query Schema
const getCustomersQuerySchema = {
  query: paginationQuerySchema
    .extend({
      sortBy: z
        .enum(CUSTOMER_SORT_FIELDS, {
          error: "Invalid sort field",
        })
        .default("createdAt"),

      status: userStatusSchema.optional(),

      startDate: z.coerce
        .date({ error: "Invalid start date format" })
        .optional(),

      endDate: z.coerce
        .date({ error: "Invalid end date format" })
        .optional(),
    })
    .refine(
      (data) => {
        if (data.startDate && data.endDate) {
          return data.startDate <= data.endDate;
        }
        return true;
      },
      {
        message: "Start date must be before or equal to end date",
        path: ["startDate"],
      },
    ),
};

// Inferred input types
export type RegisterCustomerBody = z.infer<typeof registerCustomerSchema.body>;
export type GetCustomerParams = z.infer<typeof getCustomerSchema.params>;
export type GetCustomersQuery = z.infer<typeof getCustomersQuerySchema.query>;

// Export customer validation schemas
export const CustomerValidation = {
  registerCustomerSchema,
  getCustomerSchema,
  getCustomersQuerySchema,
};

