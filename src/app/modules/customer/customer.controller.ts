import { fromNodeHeaders } from "better-auth/node";
import type { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { CustomerService } from "./customer.service.js";
import type { RegisterCustomerInput } from "./customer.validation.js";

// Register customer account
const registerCustomer = catchAsync(async (req: Request, res: Response) => {
  const payload = res.locals.validated?.body as RegisterCustomerInput;
  const headers = fromNodeHeaders(req.headers);
  const result = await CustomerService.registerCustomer(payload, headers);

  sendResponse(res, {
    statusCode: status.CREATED,
    message: "Account created successfully. Please verify your email.",
    data: result,
  });
});

// Export customer controller
export const CustomerController = {
  registerCustomer,
};
