import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums.js";
import { authGuard } from "../../middleware/authGuard.js";
import { rbacGuard } from "../../middleware/rbacGuard.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AdminController } from "./admin.controller.js";
import { AdminValidation } from "./admin.validation.js";

const router: Router = Router();

// Create Admin account
router.post(
  "/",
  authGuard,
  rbacGuard(UserRole.SUPER_ADMIN),
  validateRequest(AdminValidation.createAdminSchema),
  AdminController.createAdmin,
);

// Retrieve Admin accounts
router.get(
  "/",
  authGuard,
  rbacGuard(UserRole.SUPER_ADMIN),
  validateRequest(AdminValidation.getAdminsQuerySchema),
  AdminController.getAdmins,
);

// Update Admin account
router.patch(
  "/:id",
  authGuard,
  rbacGuard(UserRole.SUPER_ADMIN),
  validateRequest(AdminValidation.updateAdminSchema),
  AdminController.updateAdmin,
);

// Export Admin routes
export const AdminRoutes = router;
