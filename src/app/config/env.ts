import "dotenv/config";
import { z } from "zod";
import { ConfigurationError } from "../errors/ConfigurationError.js";

// Zod schema for environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"], {
    error: 'NODE_ENV is required and must be either "development" or "production"',
  }),
  PORT: z.coerce
    .number({ error: "PORT is required" })
    .int({ error: "PORT must be an integer" })
    .min(1, { error: "PORT must be between 1 and 65535" })
    .max(65535, { error: "PORT must be between 1 and 65535" }),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .trim()
    .min(1, { error: "DATABASE_URL cannot be empty" }),
  FRONTEND_URL: z.url({
    protocol: /^https?$/,
    error: "FRONTEND_URL must be a valid HTTP or HTTPS URL",
  }),

  // Better Auth Configuration
  BETTER_AUTH_SECRET: z
    .string({ error: "BETTER_AUTH_SECRET is required" })
    .min(32, {
      error: "BETTER_AUTH_SECRET must be at least 32 characters long",
    }),
  BETTER_AUTH_URL: z.url({
    protocol: /^https?$/,
    error: "BETTER_AUTH_URL must be a valid HTTP or HTTPS URL",
  }),

  // Google OAuth configuration
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),

  // SMTP configuration
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().trim().optional(),
  SMTP_FROM: z.string().trim().optional(),
});

// Infer read-only TypeScript type directly from schema
export type EnvConfig = Readonly<z.infer<typeof envSchema>>;

// Validate and load environment variables
const loadEnvConfig = (): EnvConfig => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");

    throw new ConfigurationError(
      `Environment configuration validation failed: ${errorDetails}`,
    );
  }

  return Object.freeze(result.data);
};

export const env = loadEnvConfig();
