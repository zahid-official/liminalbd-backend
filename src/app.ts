import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { status } from "http-status";
import { env } from "./app/config/env.js";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler.js";
import { notFoundErrorHandler } from "./app/middleware/notFoundErrorHandler.js";
import { RootRouter } from "./app/routes/index.js";
import { sendResponse } from "./app/utils/sendResponse.js";

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
  sendResponse(res, {
    statusCode: status.OK,
    message: "Liminal Backend API is running successfully",
    data: {
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});

// Application Routes
app.use("/api/v1", RootRouter);

// Development Only: Live Email Preview Route (Zero sending, instant browser HMR)
if (env.NODE_ENV === "development") {
  app.get("/dev/email-preview", async (_req: Request, res: Response) => {
    try {
      const { render } = await import("react-email");
      const React = (await import("react")).default;
      const { VerificationEmail } = await import(
        "./app/shared/email/templates/VerificationEmail.js"
      );

      const html = await render(
        React.createElement(VerificationEmail, {
          name: "Zahidul Islam",
          otp: "379828",
        }),
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error) {
      res.status(500).send(`<h3>Failed to render email preview:</h3><pre>${String(error)}</pre>`);
    }
  });
}

// Not Found Handler
app.use(notFoundErrorHandler);

// Global Error Handler
app.use(globalErrorHandler);

export default app;
