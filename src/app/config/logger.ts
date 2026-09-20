import pino, { type Logger, type LoggerOptions } from "pino";
import { env } from "./env.js";

const isProduction = env.NODE_ENV === "production";

// Logger configuration options
const options: LoggerOptions = {
  level: env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "password",
      "*.password",
      "currentPassword",
      "*.currentPassword",
      "newPassword",
      "*.newPassword",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
};

if (!isProduction) {
  options.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:HH:MM:ss",
      ignore: "pid,hostname",
    },
  };
}

// Initialize Pino logger instance
const logger: Logger = pino(options);
export { logger, options as loggerOptions };
