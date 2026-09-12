import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AuthController } from "./auth.controller.js";
import { AuthValidation } from "./auth.validation.js";

const router: Router = Router();

// Register customer account
router.post(
  "/register",
  validateRequest(AuthValidation.registerCustomerSchema),
  AuthController.registerCustomer,
);

// Send verification OTP
router.post(
  "/send-verification-otp",
  validateRequest(AuthValidation.sendVerificationOtpSchema),
  AuthController.sendVerificationOtp,
);

// Verify email with OTP
router.post(
  "/verify-email-otp",
  validateRequest(AuthValidation.verifyEmailOtpSchema),
  AuthController.verifyEmailOtp,
);

// Login with email and password credentials
router.post(
  "/login",
  validateRequest(AuthValidation.loginSchema),
  AuthController.loginWithCredentials,
);

// Export auth routes
export const AuthRoutes = router;
