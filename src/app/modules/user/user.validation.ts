import { z } from "zod";
import {
  contactNumberSchema,
  nameSchema,
} from "../../validations/common.validation.js";

// Update User Profile Schema
const updateProfileSchema = {
  body: z
    .object({
      name: nameSchema.optional(),

      contactNumber: contactNumberSchema.optional(),

      address: z
        .string({
          error: "Address must be a valid text string",
        })
        .trim()
        .min(3, { error: "Address must be at least 3 characters" })
        .max(500, { error: "Address cannot exceed 500 characters" })
        .optional(),

      image: z
        .string({
          error: "Avatar image must be a valid text string",
        })
        .trim()
        .pipe(
          z
            .url({ error: "Avatar image must be a valid URL" })
            .max(2048, { error: "Avatar image URL cannot exceed 2048 characters" }),
        )
        .optional(),
    })
    .refine((data) => Object.values(data).some((val) => val !== undefined), {
      message: "At least one field must be provided for update",
    }),
};

// Inferred input types
export type UpdateProfileInput = z.infer<typeof updateProfileSchema.body>;

// Export user validation schemas
export const UserValidation = {
  updateProfileSchema,
};
