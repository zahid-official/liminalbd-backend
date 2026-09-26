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
  GetCustomersQuery,
  RegisterCustomerBody,
} from "./customer.validation.js";

// Register customer account
const registerCustomer = catchAsync(async (req: Request, res: Response) => {
  const headers = fromNodeHeaders(req.headers);
  const payload = res.locals.validated?.body as RegisterCustomerBody;

  const result = await CustomerService.registerCustomer({
    headers,
    payload,
  });

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Account created successfully. Please verify your email.",
    data: result,
  });
});

// Retrieve paginated Customer accounts (Admin only)
const getCustomers = catchAsync(async (_req: Request, res: Response) => {
  const user = res.locals.user as AuthUser;
  const query = res.locals.validated?.query as GetCustomersQuery;

  const result = await CustomerService.getCustomers({
    actorId: user.id,
    actorRole: user.role as UserRole,
    query,
  });

  sendResponse(res, {
    statusCode: status.OK,
    message: "Customers retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

// Retrieve customer by ID (Admin only)
const getCustomerById = catchAsync(async (_req: Request, res: Response) => {
  const params = res.locals.validated?.params as GetCustomerParams;
  const result = await CustomerService.getCustomerById(params.id);

  sendResponse(res, {
    statusCode: status.OK,
    message: "Customer retrieved successfully",
    data: result,
  });
});

// Export customer controller
export const CustomerController = {
  registerCustomer,
  getCustomers,
  getCustomerById,
};
