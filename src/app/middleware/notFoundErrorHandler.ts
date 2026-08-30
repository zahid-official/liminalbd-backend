import type { RequestHandler } from "express";
import status from "http-status";

// notFoundErrorHandler Function
const notFoundErrorHandler: RequestHandler = (req, res) => {
  res.status(status.NOT_FOUND).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorSources: [
      {
        path: req.originalUrl,
        message: "The requested route does not exist.",
      },
    ],
  });
};

export default notFoundErrorHandler;
