import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AuthController } from "./auth.controller.js";
import { AuthValidation } from "./auth.validation.js";

const router: Router = Router();

// Customer registration endpoint
router.post(
  "/register",
  validateRequest(AuthValidation.registerValidationSchema),
  AuthController.registerCustomer,
);

export const AuthRoutes = router;
