import { z } from "zod";
import { UserRole } from "../../../generated/prisma/enums.js";
import {
  emailSchema,
  idSchema,
  nameSchema,
  paginationQuerySchema,
  passwordSchema,
  userStatusSchema,
} from "../../validations/common.validation.js";
import { ADMIN_SORT_FIELDS } from "./admin.constant.js";

// Create Admin Schema
const createAdminSchema = {
  body: z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
};

// Update Admin Schema
const updateAdminSchema = {
  params: z.object({
    id: idSchema,
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
export type CreateAdminBody = z.infer<typeof createAdminSchema.body>;
export type UpdateAdminBody = z.infer<typeof updateAdminSchema.body>;
export type UpdateAdminParams = z.infer<typeof updateAdminSchema.params>;
export type GetAdminsQuery = z.infer<typeof getAdminsQuerySchema.query>;

// Export admin validation schemas
export const AdminValidation = {
  createAdminSchema,
  updateAdminSchema,
  getAdminsQuerySchema,
};
