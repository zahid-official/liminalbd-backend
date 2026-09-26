import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { UserStatus } from "../../generated/prisma/enums.js";
import { auth } from "../config/auth.js";
import { AppError } from "../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../errors/errorCodes.js";
import { catchAsync } from "../utils/catchAsync.js";

// Express middleware to authenticate session requests using Better Auth
const authGuard = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const headers = fromNodeHeaders(req.headers);
    const sessionData = await auth.api.getSession({
      headers,
      query: {
        disableCookieCache: true,
      },
    });

    if (
      !sessionData?.session ||
      !sessionData?.user ||
      sessionData.user.deletedAt
    ) {
      throw new AppError(
        status.UNAUTHORIZED,
        PUBLIC_ERROR_CODES.UNAUTHORIZED,
        "Authentication required. Please sign in.",
      );
    }

    if (sessionData.user.status === UserStatus.SUSPENDED) {
      throw new AppError(
        status.FORBIDDEN,
        PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED,
        "Your account has been suspended. Please contact support.",
      );
    }

    if (sessionData.user.status === UserStatus.DEACTIVATED) {
      throw new AppError(
        status.FORBIDDEN,
        PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED,
        "Your account is deactivated. Please contact support.",
      );
    }

    // Attach authenticated user and session to response locals
    res.locals.user = sessionData.user;
    res.locals.session = sessionData.session;
    next();
  },
);

export { authGuard };
