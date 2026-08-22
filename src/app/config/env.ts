import "dotenv/config";

interface EnvConfig {
  NODE_ENV: "development" | "production";
  PORT: number;
  DATABASE_URL: string;
  FRONTEND_URL: string;
}

// Load and validate environment variables
const loadEnvConfig = (): EnvConfig => {
  const requiredEnvVariables = [
    "NODE_ENV",
    "PORT",
    "DATABASE_URL",
    "FRONTEND_URL",
  ] as const;

  // Validate presence of required variables
  for (const key of requiredEnvVariables) {
    if (!process.env[key]) {
      throw new Error(
        `[Config Error] Missing required environment variable: ${key}`,
      );
    }
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== "development" && nodeEnv !== "production") {
    throw new Error(
      `[Config Error] Invalid NODE_ENV "${nodeEnv}". Expected "development" or "production".`,
    );
  }

  // Parse string values into numbers
  const parseNumber = (field: string, value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(
        `[Config Error] Invalid ${field}: "${value}". Expected a valid number.`,
      );
    }

    return parsed;
  };

  // Parse and validate the server port
  const port = parseNumber("PORT", process.env.PORT!);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `[Config Error] Invalid PORT: "${port}". Expected an integer between 1 and 65535.`,
    );
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: process.env.DATABASE_URL!,
    FRONTEND_URL: process.env.FRONTEND_URL!,
  };
};

const env = loadEnvConfig();
export default env;
