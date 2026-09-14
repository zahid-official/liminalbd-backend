import { toNodeHandler } from "better-auth/node";
import { Router } from "express";
import { auth } from "../../config/auth.js";
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
  validateRequest(AuthValidation.loginWithCredentialsSchema),
  AuthController.loginWithCredentials,
);

// Customer Google OAuth initiation
router.post(
  "/login/google",
  validateRequest(AuthValidation.loginWithGoogleSchema),
  AuthController.loginWithGoogle,
);

// Google OAuth callback
router.get("/callback/google", toNodeHandler(auth));

// Export auth routes
export const AuthRoutes = router;
