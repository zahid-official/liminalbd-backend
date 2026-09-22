import type { Request, Response } from "express";
import status from "http-status";
import type { UserRole } from "../../../generated/prisma/enums.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import type { AuthUser } from "../auth/auth.interface.js";
import { AdminService } from "./admin.service.js";
import type { CreateAdminInput } from "./admin.validation.js";

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

// Export Admin controller
export const AdminController = {
  createAdmin,
};
