import type { Server } from "node:http";
import app from "./app.js";
import { env } from "./app/config/env.js";
import { logger } from "./app/config/logger.js";

let server: Server | undefined;
const port = env.PORT;

// Initialize the server
const bootstrap = async () => {
  try {
    // Start the Express server
    server = app.listen(port, () => {
      logger.info({ port, env: env.NODE_ENV }, "Server started successfully");
    });

    // Handle HTTP server errors
    server.on("error", (error) => {
      logger.fatal({ err: error }, "[Server Error] Failed to start the server");
      process.exit(1);
    });
  } catch (error) {
    // Handle application startup errors
    logger.fatal({ err: error }, "[Startup Error] Failed to initialize the application");
    process.exit(1);
  }
};

// Graceful shutdown handler
const handleShutdown = (signal: string, error?: unknown) => {
  if (error) {
    logger.fatal(
      { err: error, signal },
      `[${signal}] Server encountered an error and is shutting down...`,
    );
  } else {
    logger.info({ signal }, `[${signal}] Signal received. Closing server gracefully...`);
  }

  if (server) {
    // Force shutdown if connections do not close in 10 seconds
    const forceExitTimeout = setTimeout(() => {
      logger.error("Forcefully terminating server: close timed out.");
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    server.close(() => {
      logger.info("Server closed successfully.");
      process.exit(error ? 1 : 0);
    });
  } else {
    process.exit(error ? 1 : 0);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  handleShutdown("Unhandled Rejection", error);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  handleShutdown("Uncaught Exception", error);
});

// Handle process termination signals
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

// Start the application
bootstrap();
