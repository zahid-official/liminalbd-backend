import "dotenv/config";
import { z } from "zod";
import { ConfigurationError } from "../errors/ConfigurationError.js";

// Zod schema for environment variables
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required" })
    .trim()
    .min(1, { error: "DATABASE_URL cannot be empty" }),
  FRONTEND_URL: z.url({
    protocol: /^https?$/,
    error: "FRONTEND_URL must be a valid HTTP or HTTPS URL",
  }),
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
