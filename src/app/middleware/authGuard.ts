import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { auth } from "../config/auth.js";
import { AppError } from "../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../errors/errorCodes.js";
import { catchAsync } from "../utils/catchAsync.js";

// Express middleware to authenticate session requests using Better Auth
const authGuard = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const headers = fromNodeHeaders(req.headers);
    const sessionData = await auth.api.getSession({ headers });

    if (!sessionData?.session || !sessionData?.user) {
      throw new AppError(
        status.UNAUTHORIZED,
        PUBLIC_ERROR_CODES.UNAUTHORIZED,
        "Authentication required. Please sign in.",
      );
    }

    if (sessionData.user.deletedAt) {
      throw new AppError(
        status.UNAUTHORIZED,
        PUBLIC_ERROR_CODES.UNAUTHORIZED,
        "Authentication required. Please sign in.",
      );
    }

    req.user = sessionData.user;
    req.session = sessionData.session;
    res.locals.user = sessionData.user;
    res.locals.session = sessionData.session;

    next();
  },
);

export { authGuard };
