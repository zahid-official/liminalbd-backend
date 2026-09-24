import { Router } from "express";
import { authGuard } from "../../middleware/authGuard.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { CustomerController } from "./customer.controller.js";
import { CustomerValidation } from "./customer.validation.js";

const router: Router = Router();

// Register customer account
router.post(
  "/register",
  validateRequest(CustomerValidation.registerCustomerSchema),
  CustomerController.registerCustomer,
);

// Retrieve customer profile by ID
router.get(
  "/:id",
  authGuard,
  validateRequest(CustomerValidation.getCustomerProfileSchema),
  CustomerController.getCustomerProfile,
);

// Export customer routes
export const CustomerRoutes = router;
