import { toNodeHandler } from "better-auth/node";
import { Router } from "express";
import { auth } from "../../config/auth.js";
import { authGuard } from "../../middleware/authGuard.js";
import { validateRequest } from "../../middleware/validateRequest.js";
import { AuthController } from "./auth.controller.js";
import { AuthValidation } from "./auth.validation.js";

const router: Router = Router();

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

// Google OAuth initiation
router.post(
  "/login/google",
  validateRequest(AuthValidation.loginWithGoogleSchema),
  AuthController.loginWithGoogle,
);

// Google OAuth callback
router.get("/callback/google", toNodeHandler(auth));

// OAuth error handler
router.get("/error", AuthController.handleOAuthError);

// Link Google account (Authenticated users only)
router.post(
  "/link/google",
  authGuard,
  validateRequest(AuthValidation.linkGoogleSchema),
  AuthController.linkGoogle,
);

// Unlink Google account (Authenticated users)
router.post("/unlink/google", authGuard, AuthController.unlinkGoogle);

// Forgot password request
router.post(
  "/forgot-password",
  validateRequest(AuthValidation.forgotPasswordSchema),
  AuthController.forgotPassword,
);

// Reset password using token
router.post(
  "/reset-password",
  validateRequest(AuthValidation.resetPasswordSchema),
  AuthController.resetPassword,
);

// Change password (Authenticated users)
router.post(
  "/change-password",
  authGuard,
  validateRequest(AuthValidation.changePasswordSchema),
  AuthController.changePassword,
);

// Set initial password (Authenticated users without password)
router.post(
  "/set-password",
  authGuard,
  validateRequest(AuthValidation.setPasswordSchema),
  AuthController.setPassword,
);

// Export auth routes
export const AuthRoutes = router;
