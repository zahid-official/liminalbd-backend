import { z } from "zod";
import { UserStatus } from "../../generated/prisma/enums.js";

// Shared email validation schema with normalization preceding format checks
export const emailSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? "Email address is required"
        : "Email must be a valid text string",
  })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email({ error: "Please provide a valid email address" })
      .max(255, { error: "Email address cannot exceed 255 characters" }),
  );

// Shared password complexity validation schema
export const passwordSchema = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? "Password is required"
        : "Password must be a valid text string",
  })
  .min(8, { error: "Password must be at least 8 characters" })
  .max(100, { error: "Password cannot exceed 100 characters" })
  .regex(/[A-Z]/, {
    error: "Password must include at least one uppercase letter (A-Z)",
  })
  .regex(/[a-z]/, {
    error: "Password must include at least one lowercase letter (a-z)",
  })
  .regex(/\d/, {
    error: "Password must include at least one number (0-9)",
  })
  .regex(/[^A-Za-z0-9]/, {
    error: "Password must include at least one symbol (!@#$%^&*)",
  });

// Shared redirect URL validation schema with standard maximum URL length
export const redirectUrlSchema = z
  .string({
    error: "Redirect URL must be a valid text string",
  })
  .trim()
  .max(2048, { error: "Redirect URL cannot exceed 2048 characters" });

// Shared user account status validation schema
export const userStatusSchema = z.enum(
  [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED],
  { error: "Status must be a valid account status" },
);

// Shared pagination and search query validation schema
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number({ error: "Page must be a valid number" })
    .int({ error: "Page must be an integer" })
    .min(1, { error: "Page must be at least 1" })
    .default(1),

  limit: z.coerce
    .number({ error: "Limit must be a valid number" })
    .int({ error: "Limit must be an integer" })
    .min(1, { error: "Limit must be at least 1" })
    .max(100, { error: "Limit cannot exceed 100" })
    .default(10),

  sortOrder: z
    .enum(["asc", "desc"], {
      error: "Sort order must be either 'asc' or 'desc'",
    })
    .default("desc"),

  searchTerm: z
    .string({ error: "Search term must be a valid text string" })
    .trim()
    .max(100, { error: "Search term cannot exceed 100 characters" })
    .optional(),
});
