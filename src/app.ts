import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { status } from "http-status";
import env from "./app/config/env.js";
import globalErrorHandler from "./app/middleware/globalErrorHandler.js";
import notFoundErrorHandler from "./app/middleware/notFoundErrorHandler.js";

import RootRouter from "./app/routes/index.js";

// Initialize Express app
const app: Application = express();

// CORS configuration
const allowedOrigins =
  env.NODE_ENV === "development"
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

// Health Check
app.get("/", (_req: Request, res: Response) => {
  res.status(status.OK).json({
    success: true,
    message: "Liminal Backend API is running successfully",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Application Routes
app.use("/api/v1", RootRouter);

// Not Found Handler
app.use(notFoundErrorHandler);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
