import type { NextFunction, Request, RequestHandler, Response } from "express";
import status from "http-status";
import type { UserRole } from "../../generated/prisma/enums.js";
import { AppError } from "../errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../errors/errorCodes.js";
import { catchAsync } from "../utils/catchAsync.js";

// Express middleware factory for role-based access control (RBAC)
const rbacGuard = (
  ...allowedRoles: [UserRole, ...UserRole[]]
): RequestHandler => {
  return catchAsync(
    (_req: Request, res: Response, next: NextFunction): void => {
      const user = res.locals.user;

      if (!user || !user.role) {
        throw new AppError(
          status.UNAUTHORIZED,
          PUBLIC_ERROR_CODES.UNAUTHORIZED,
          "Authentication required. Please sign in.",
        );
      }

      if (!allowedRoles.includes(user.role as UserRole)) {
        throw new AppError(
          status.FORBIDDEN,
          PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          "You do not have permission to access this resource.",
        );
      }

      next();
    },
  );
};

export { rbacGuard };
