import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums.js";
import { authGuard } from "../../middleware/authGuard.js";
import { rbacGuard } from "../../middleware/rbacGuard.js";
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

// Retrieve customer by ID (Admin only)
router.get(
  "/:id",
  authGuard,
  rbacGuard(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(CustomerValidation.getCustomerSchema),
  CustomerController.getCustomerById,
);

// Export customer routes
export const CustomerRoutes = router;
