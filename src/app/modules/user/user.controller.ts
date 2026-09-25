import type { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import type { AuthUser } from "../auth/auth.interface.js";
import { UserService } from "./user.service.js";
import type { UpdateProfileInput } from "./user.validation.js";

// Retrieve authenticated user's own profile
const getProfile = catchAsync(async (_req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const result = await UserService.getProfile(user.id);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Profile retrieved successfully",
    data: result,
  });
});

// Update authenticated user's own profile
const updateProfile = catchAsync(async (_req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const body = res.locals.validated?.body as UpdateProfileInput;

  const result = await UserService.updateProfile(user.id, body);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Profile updated successfully",
    data: result,
  });
});

export const UserController = {
  getProfile,
  updateProfile,
};
