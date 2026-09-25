import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import status from "http-status";
import type { UserRole } from "../../../generated/prisma/enums.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import type { AuthUser } from "../auth/auth.interface.js";
import { CustomerService } from "./customer.service.js";
import type {
  GetCustomerParams,
  RegisterCustomerInput,
} from "./customer.validation.js";

// Register customer account
const registerCustomer = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as RegisterCustomerInput;
  const headers = fromNodeHeaders(req.headers);
  const result = await CustomerService.registerCustomer({ payload, headers });

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Account created successfully. Please verify your email.",
    data: result,
  });
});

// Retrieve customer profile by ID
const getCustomerProfile = catchAsync(async (_req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const params = res.locals.validated?.params as GetCustomerParams;

  const result = await CustomerService.getCustomerProfile({
    actorId: user.id,
    actorRole: user.role as UserRole,
    targetId: params.id,
  });

  sendResponse(res, {
    statusCode: status.OK,
    message: "Customer profile retrieved successfully",
    data: result,
  });
});

// Export customer controller
export const CustomerController = {
  registerCustomer,
  getCustomerProfile,
};
