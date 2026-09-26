import { z } from "zod";
import {
  addressSchema,
  contactNumberSchema,
  nameSchema,
} from "../../validations/common.validation.js";

// Update User Profile Schema
const updateProfileSchema = {
  body: z
    .object({
      name: nameSchema.optional(),
      contactNumber: contactNumberSchema.optional(),
      address: addressSchema.optional(),

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
export type UpdateProfileBody = z.infer<typeof updateProfileSchema.body>;

// Export user validation schemas
export const UserValidation = {
  updateProfileSchema,
};
