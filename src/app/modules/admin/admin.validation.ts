import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
} from "../../validations/common.validation.js";

// Create Admin Schema
const createAdminSchema = {
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

// Inferred input types
export type CreateAdminInput = z.infer<typeof createAdminSchema.body>;

// Export admin validation schemas
export const AdminValidation = {
  createAdminSchema,
};
