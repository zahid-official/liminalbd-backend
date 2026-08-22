import type { Server } from "node:http";
import app from "./app.js";
import env from "./app/config/env.js";

let server: Server | undefined;
const port = env.PORT;

// Initialize the server
const bootstrap = async () => {
  try {
    // Start the Express server
    server = app.listen(port, () => {
      console.log(`🚀 Server is running on http://localhost:${port}`);
      console.log(`⚙️  Environment: ${env.NODE_ENV}`);
    });

    // Handle HTTP server errors
    server.on("error", (error) => {
      console.error({
        success: false,
        message: "[Server Error] Failed to start the server",
        error,
      });
      process.exit(1);
    });
  } catch (error) {
    // Handle application startup errors
    console.error({
      success: false,
      message: "[Startup Error] Failed to initialize the application",
      error,
    });
    process.exit(1);
  }
};

// Graceful shutdown handler
const handleShutdown = (signal: string, error?: unknown) => {
  if (error) {
    console.error({
      success: false,
      message: `[${signal}] Server encountered an error and is shutting down...`,
      error,
    });
  } else {
    console.log(
      `\n🛑 [${signal}] Signal received. Closing server gracefully...`,
    );
  }

  if (server) {
    // Force shutdown if connections do not close in 10 seconds
    const forceExitTimeout = setTimeout(() => {
      console.error("⚠️ Forcefully terminating server: close timed out.");
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    server.close(() => {
      console.log("✅ Server closed successfully.");
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
