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
  "/admins",
  authGuard,
  rbacGuard(UserRole.SUPER_ADMIN),
  validateRequest(AdminValidation.createAdminSchema),
  AdminController.createAdmin,
);

// Export Admin routes
export const AdminRoutes = router;
