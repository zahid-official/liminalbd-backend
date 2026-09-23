import type { Request, Response } from "express";
import status from "http-status";
import type { UserRole } from "../../../generated/prisma/enums.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import type { AuthUser } from "../auth/auth.interface.js";
import { AdminService } from "./admin.service.js";
import type {
  CreateAdminInput,
  UpdateAdminInput,
  UpdateAdminParams,
} from "./admin.validation.js";

// Create Admin account
const createAdmin = catchAsync(async (_req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const payload = res.locals.validated?.body as CreateAdminInput;

  const result = await AdminService.createAdmin({
    actorId: user.id,
    actorRole: user.role as UserRole,
    payload,
  });

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Admin account created successfully",
    data: result,
  });
});

// Update Admin account
const updateAdmin = catchAsync(async (_req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const params = res.locals.validated?.params as UpdateAdminParams;
  const payload = res.locals.validated?.body as UpdateAdminInput;

  const result = await AdminService.updateAdmin({
    actorId: user.id,
    actorRole: user.role as UserRole,
    targetId: params.id,
    payload,
  });

  sendResponse(res, {
    statusCode: status.OK,
    message: "Admin account updated successfully",
    data: result,
  });
});

// Export Admin controller
export const AdminController = {
  createAdmin,
  updateAdmin,
};
