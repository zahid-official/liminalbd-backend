import { z } from "zod";
import { UserRole, UserStatus } from "../../../generated/prisma/enums.js";
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

// Update Admin Schema
const updateAdminSchema = {
  params: z.object({
    id: z
      .string({
        error: (issue) =>
          issue.input === undefined
            ? "Admin ID is required"
            : "Admin ID must be a valid text string",
      })
      .trim()
      .pipe(z.uuid({ error: "Invalid Admin ID format" })),
  }),

  body: z
    .object({
      role: z
        .enum([UserRole.ADMIN, UserRole.SUPER_ADMIN], {
          error: "Role must be either ADMIN or SUPER_ADMIN",
        })
        .optional(),

      status: z
        .enum(
          [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED],
          {
            error: "Status must be a valid account status",
          },
        )
        .optional(),
    })
    .refine((data) => Object.values(data).some((val) => val !== undefined), {
      message: "At least one field must be provided for update",
    }),
};

// Inferred input types
export type CreateAdminInput = z.infer<typeof createAdminSchema.body>;
export type UpdateAdminParams = z.infer<typeof updateAdminSchema.params>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema.body>;

// Export admin validation schemas
export const AdminValidation = {
  createAdminSchema,
  updateAdminSchema,
};
