import { z } from "zod";
import { UserRole } from "../../../generated/prisma/enums.js";
import {
  emailSchema,
  paginationQuerySchema,
  passwordSchema,
  userStatusSchema,
} from "../../validations/common.validation.js";
import { ADMIN_SORT_FIELDS } from "./admin.constant.js";

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

      status: userStatusSchema.optional(),
    })
    .refine((data) => Object.values(data).some((val) => val !== undefined), {
      message: "At least one field must be provided for update",
    }),
};

// Get Admins Query Schema
const getAdminsQuerySchema = {
  query: paginationQuerySchema.extend({
    sortBy: z
      .enum(ADMIN_SORT_FIELDS, {
        error: "Invalid sort field",
      })
      .default("createdAt"),

    status: userStatusSchema.optional(),
  }),
};

// Inferred input types
export type CreateAdminInput = z.infer<typeof createAdminSchema.body>;
export type UpdateAdminParams = z.infer<typeof updateAdminSchema.params>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema.body>;
export type GetAdminsQueryInput = z.infer<typeof getAdminsQuerySchema.query>;

// Export admin validation schemas
export const AdminValidation = {
  createAdminSchema,
  updateAdminSchema,
  getAdminsQuerySchema,
};
