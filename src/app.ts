import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { status } from "http-status";
import { pinoHttp } from "pino-http";
import { env } from "./app/config/env.js";
import { logger } from "./app/config/logger.js";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler.js";
import { notFoundErrorHandler } from "./app/middleware/notFoundErrorHandler.js";
import { RootRouter } from "./app/routes/index.js";
import { sendResponse } from "./app/utils/sendResponse.js";

// Initialize Express app
const app: Application = express();

// CORS configuration
const allowedOrigins =
  env.NODE_ENV === "development" || env.NODE_ENV === "test"
    ? [env.FRONTEND_URL, "http://localhost:3000"]
    : [env.FRONTEND_URL];

// Core Middlewares
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP request logger (mounted before route handlers)
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url ? req.url.split("?")[0] : "",
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "res.headers['set-cookie']",
        "req.headers.cookie",
        "req.body.token",
        "req.body.password",
        "req.body.currentPassword",
        "req.body.newPassword",
      ],
      censor: "[REDACTED]",
    },
  }),
);

// Health Check
app.get("/", (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: status.OK,
    message: "Liminal Backend API is running successfully",
    data: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Application Routes
app.use("/api/v1", RootRouter);

// Not Found Handler
app.use(notFoundErrorHandler);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
