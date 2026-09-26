import { Router } from "express";
import { authGuard } from "../../middleware/authGuard.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { UserController } from "./user.controller.js";
import { UserValidation } from "./user.validation.js";

const router: Router = Router();

// Retrieve authenticated user's own profile
router.get("/profile", authGuard, UserController.getProfile);

// Update authenticated user's own profile
router.patch(
  "/profile",
  authGuard,
  validateRequest(UserValidation.updateProfileSchema),
  UserController.updateProfile,
);

// Export user routes
export const UserRoutes = router;
