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

  // Logging configuration
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"], {
      error: 'LOG_LEVEL must be one of: fatal, error, warn, info, debug, trace',
    })
    .optional(),

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
  GOOGLE_CLIENT_ID: z
    .string({ error: "GOOGLE_CLIENT_ID is required" })
    .trim()
    .min(1, { error: "GOOGLE_CLIENT_ID cannot be empty" }),
  GOOGLE_CLIENT_SECRET: z
    .string({ error: "GOOGLE_CLIENT_SECRET is required" })
    .trim()
    .min(1, { error: "GOOGLE_CLIENT_SECRET cannot be empty" }),
  GOOGLE_CALLBACK_URL: z.url({
    protocol: /^https?$/,
    error: "GOOGLE_CALLBACK_URL must be a valid HTTP or HTTPS URL",
  }),

  // SMTP configuration
  SMTP_HOST: z
    .string({ error: "SMTP_HOST is required" })
    .trim()
    .min(1, { error: "SMTP_HOST cannot be empty" }),
  SMTP_PORT: z.coerce
    .number({ error: "SMTP_PORT is required" })
    .int({ error: "SMTP_PORT must be an integer" })
    .min(1, { error: "SMTP_PORT must be between 1 and 65535" })
    .max(65535, { error: "SMTP_PORT must be between 1 and 65535" }),
  SMTP_USER: z
    .string({ error: "SMTP_USER is required" })
    .trim()
    .min(1, { error: "SMTP_USER cannot be empty" }),
  SMTP_PASS: z
    .string({ error: "SMTP_PASS is required" })
    .trim()
    .min(1, { error: "SMTP_PASS cannot be empty" }),
  SMTP_FROM: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? "SMTP_FROM is required"
          : "SMTP_FROM must be a valid text string",
    })
    .trim()
    .toLowerCase()
    .pipe(
      z
        .email({ error: "SMTP_FROM must be a valid email address" })
        .max(255, { error: "SMTP_FROM cannot exceed 255 characters" }),
    ),
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
