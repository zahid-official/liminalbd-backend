import type { NextFunction, Request, Response } from "express";
import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../../src/app/config/env.js";
import { AppError } from "../../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import { AuthController } from "../../../../src/app/modules/auth/auth.controller.js";
import type {
  AuthSession,
  AuthUser,
} from "../../../../src/app/modules/auth/auth.interface.js";
import { AuthService } from "../../../../src/app/modules/auth/auth.service.js";
import {
  UserRole,
  UserStatus,
} from "../../../../src/generated/prisma/enums.js";

interface MockResponseOptions {
  validatedBody?: unknown;
  validatedQuery?: unknown;
  user?: AuthUser;
  session?: AuthSession;
}

const makeMockRes = ({
  validatedBody,
  validatedQuery,
  user,
  session,
}: MockResponseOptions = {}) => {
  return {
    locals: {
      validated:
        validatedBody !== undefined || validatedQuery !== undefined
          ? { body: validatedBody, query: validatedQuery }
          : undefined,
      user,
      session,
    },
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    redirect: vi.fn(),
  } as unknown as Response & {
    setHeader: ReturnType<typeof vi.fn>;
    redirect: ReturnType<typeof vi.fn>;
  };
};

describe("AuthController Unit Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockCustomerUser: AuthUser = {
    id: "user-123",
    name: "Zahidul Islam",
    email: "zahid@liminalbd.com",
    emailVerified: true,
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    needPasswordChange: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession: AuthSession = {
    id: "session-123",
    userId: "user-123",
    token: "valid-session-token",
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("requestEmailVerification", () => {
    const mockPayload = {
      email: "zahid@liminalbd.com",
    };

    it("should extract validated body, convert headers faithfully, invoke AuthService, and send 200 response", async () => {
      const mockResult = {
        email: "zahid@liminalbd.com",
      };

      const requestServiceSpy = vi
        .spyOn(AuthService, "requestEmailVerification")
        .mockResolvedValue(mockResult);

      const req = {
        headers: {
          "user-agent": "Vitest-Agent",
          "x-forwarded-for": "127.0.0.1",
        },
      } as unknown as Request;

      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.requestEmailVerification(req, res, next);

      expect(requestServiceSpy).toHaveBeenCalledTimes(1);
      expect(requestServiceSpy).toHaveBeenCalledWith(
        mockPayload,
        expect.any(Headers),
      );

      const passedHeaders = requestServiceSpy.mock.calls[0]?.[1] as Headers;
      expect(passedHeaders.get("x-forwarded-for")).toBe("127.0.0.1");
      expect(passedHeaders.get("user-agent")).toBe("Vitest-Agent");

      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Verification code sent to your email",
        data: mockResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.BAD_REQUEST,
        PUBLIC_ERROR_CODES.ALREADY_VERIFIED,
        "Your account is already verified. Please sign in.",
      );

      vi.spyOn(AuthService, "requestEmailVerification").mockRejectedValue(
        serviceError,
      );

      const req = {
        headers: {},
      } as unknown as Request;

      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.requestEmailVerification(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("confirmEmailVerification", () => {
    const mockPayload = {
      email: "zahid@liminalbd.com",
      otp: "123456",
    };

    it("should verify OTP, attach set-cookie headers when present, and send 200 response", async () => {
      const mockResult = {
        user: {
          id: "user-verified-123",
          name: "Zahidul Islam",
          email: "zahid@liminalbd.com",
          emailVerified: true,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
        setCookies: ["better-auth.session_token=test-cookie; Path=/"],
      };

      const confirmServiceSpy = vi
        .spyOn(AuthService, "confirmEmailVerification")
        .mockResolvedValue(mockResult);

      const req = {
        headers: {
          "user-agent": "Vitest-Agent",
          "x-forwarded-for": "127.0.0.1",
        },
      } as unknown as Request;

      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.confirmEmailVerification(req, res, next);

      expect(confirmServiceSpy).toHaveBeenCalledTimes(1);
      expect(confirmServiceSpy).toHaveBeenCalledWith(
        mockPayload,
        expect.any(Headers),
      );

      const passedHeaders = confirmServiceSpy.mock.calls[0]?.[1] as Headers;
      expect(passedHeaders.get("x-forwarded-for")).toBe("127.0.0.1");
      expect(passedHeaders.get("user-agent")).toBe("Vitest-Agent");

      expect(res.setHeader).toHaveBeenCalledWith("set-cookie", [
        "better-auth.session_token=test-cookie; Path=/",
      ]);
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Email verified successfully",
        data: mockResult.user,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should omit set-cookie header when setCookies is empty", async () => {
      const mockResult = {
        user: {
          id: "user-verified-123",
          name: "Zahidul Islam",
          email: "zahid@liminalbd.com",
          emailVerified: true,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
        setCookies: [],
      };

      vi.spyOn(AuthService, "confirmEmailVerification").mockResolvedValue(
        mockResult,
      );

      const req = {
        headers: {},
      } as unknown as Request;

      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.confirmEmailVerification(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Email verified successfully",
        data: mockResult.user,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward verification service errors to next() middleware via catchAsync", async () => {
      const serviceError = new Error("Invalid or expired OTP");
      vi.spyOn(AuthService, "confirmEmailVerification").mockRejectedValue(
        serviceError,
      );

      const req = {
        headers: {},
      } as unknown as Request;

      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.confirmEmailVerification(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("loginWithCredentials", () => {
    const mockPayload = {
      email: "zahid@liminalbd.com",
      password: "Password123!",
    };

    it("should extract validated body, convert headers faithfully, invoke AuthService, set cookies, and send 200 response", async () => {
      const mockResult = {
        user: {
          id: "user-123",
          name: "Zahidul Islam",
          email: "zahid@liminalbd.com",
          emailVerified: true,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
        setCookies: ["better-auth.session_token=valid-cookie; Path=/"],
      };

      const loginSpy = vi
        .spyOn(AuthService, "loginWithCredentials")
        .mockResolvedValue(mockResult);

      const req = {
        headers: {
          "user-agent": "Vitest-Agent",
          "x-forwarded-for": "127.0.0.1",
        },
      } as unknown as Request;

      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.loginWithCredentials(req, res, next);

      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(loginSpy).toHaveBeenCalledWith(mockPayload, expect.any(Headers));

      const passedHeaders = loginSpy.mock.calls[0]?.[1] as Headers;
      expect(passedHeaders.get("x-forwarded-for")).toBe("127.0.0.1");
      expect(passedHeaders.get("user-agent")).toBe("Vitest-Agent");

      expect(res.setHeader).toHaveBeenCalledWith(
        "set-cookie",
        mockResult.setCookies,
      );
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Login successful",
        data: mockResult.user,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should omit set-cookie header when setCookies is empty", async () => {
      const mockResult = {
        user: {
          id: "user-123",
          name: "Zahidul Islam",
          email: "zahid@liminalbd.com",
          emailVerified: true,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
        setCookies: [],
      };

      vi.spyOn(AuthService, "loginWithCredentials").mockResolvedValue(
        mockResult,
      );

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.loginWithCredentials(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Login successful",
        data: mockResult.user,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward login service errors to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.UNAUTHORIZED,
        PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
        "Invalid email or password",
      );

      vi.spyOn(AuthService, "loginWithCredentials").mockRejectedValue(
        serviceError,
      );

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({ validatedBody: mockPayload });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.loginWithCredentials(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("loginWithGoogle", () => {
    it("should extract validated query, convert headers faithfully, set cookies, and send 200 response", async () => {
      const mockResult = {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        redirect: true,
        setCookies: ["oauth_state=state123; Path=/"],
      };

      const loginSpy = vi
        .spyOn(AuthService, "loginWithGoogle")
        .mockResolvedValue(mockResult);

      const req = {
        headers: {
          "user-agent": "Vitest-Agent",
          "x-forwarded-for": "127.0.0.1",
        },
      } as unknown as Request;
      const res = makeMockRes({ validatedQuery: { redirectTo: "/dashboard" } });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.loginWithGoogle(req, res, next);

      expect(loginSpy).toHaveBeenCalledWith(expect.any(Headers), "/dashboard");
      const passedHeaders = loginSpy.mock.calls[0]?.[0] as Headers;
      expect(passedHeaders.get("user-agent")).toBe("Vitest-Agent");
      expect(passedHeaders.get("x-forwarded-for")).toBe("127.0.0.1");

      expect(res.setHeader).toHaveBeenCalledWith(
        "set-cookie",
        mockResult.setCookies,
      );
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Google authentication initialized",
        data: {
          url: mockResult.url,
          redirect: mockResult.redirect,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should not call res.setHeader when setCookies is empty", async () => {
      const mockResult = {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        redirect: true,
        setCookies: [],
      };

      vi.spyOn(AuthService, "loginWithGoogle").mockResolvedValue(mockResult);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({ validatedQuery: { redirectTo: "/dashboard" } });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.loginWithGoogle(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Google authentication initialized",
        data: {
          url: mockResult.url,
          redirect: mockResult.redirect,
        },
      });
    });

    it("should handle omitted redirectTo query gracefully", async () => {
      const mockResult = {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        redirect: true,
        setCookies: [],
      };

      const loginSpy = vi
        .spyOn(AuthService, "loginWithGoogle")
        .mockResolvedValue(mockResult);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes(); // res.locals.validated is undefined
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.loginWithGoogle(req, res, next);

      expect(loginSpy).toHaveBeenCalledWith(expect.any(Headers), undefined);
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.INTERNAL_SERVER_ERROR,
        PUBLIC_ERROR_CODES.INTERNAL_SERVER_ERROR,
        "Failed to initiate OAuth flow",
      );

      vi.spyOn(AuthService, "loginWithGoogle").mockRejectedValue(serviceError);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({ validatedQuery: { redirectTo: "/dashboard" } });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.loginWithGoogle(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("handleOAuthError", () => {
    it("should redirect to frontend login with encoded error parameter when error query is present", async () => {
      const req = {
        query: { error: "access denied & cancelled" },
      } as unknown as Request;

      const res = makeMockRes();
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.handleOAuthError(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith(
        `${env.FRONTEND_URL}/login?error=access%20denied%20%26%20cancelled`,
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should fallback to oauth_failed error when query parameter is missing", async () => {
      const req = {
        query: {},
      } as unknown as Request;

      const res = makeMockRes();
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.handleOAuthError(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith(
        `${env.FRONTEND_URL}/login?error=oauth_failed`,
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward unexpected redirect errors to next() middleware via catchAsync", async () => {
      const redirectError = new Error("Redirect failed");
      const req = { query: { error: "test" } } as unknown as Request;
      const res = makeMockRes();
      res.redirect = vi.fn().mockImplementation(() => {
        throw redirectError;
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.handleOAuthError(req, res, next);

      expect(next).toHaveBeenCalledWith(redirectError);
    });
  });

  describe("linkGoogle", () => {
    it("should link Google account for authenticated user, forward cookies, and return link URL", async () => {
      const mockResult = {
        url: "https://accounts.google.com/link",
        redirect: true,
        setCookies: ["oauth_state=link-state; Path=/"],
      };

      const linkSpy = vi
        .spyOn(AuthService, "linkGoogleAccount")
        .mockResolvedValue(mockResult);

      const req = {
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedQuery: { redirectTo: "/profile" },
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.linkGoogle(req, res, next);

      expect(linkSpy).toHaveBeenCalledWith(
        mockCustomerUser,
        expect.any(Headers),
        "/profile",
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "set-cookie",
        mockResult.setCookies,
      );
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Google account linking initialized",
        data: {
          url: mockResult.url,
          redirect: mockResult.redirect,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should not set set-cookie header when setCookies array is empty", async () => {
      const mockResult = {
        url: "https://accounts.google.com/link",
        redirect: true,
        setCookies: [],
      };

      vi.spyOn(AuthService, "linkGoogleAccount").mockResolvedValue(mockResult);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedQuery: { redirectTo: "/profile" },
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.linkGoogle(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Google account linking initialized",
        data: {
          url: mockResult.url,
          redirect: mockResult.redirect,
        },
      });
    });

    it("should handle omitted validated query gracefully and pass undefined redirectTo to service", async () => {
      const mockResult = {
        url: "https://accounts.google.com/link",
        redirect: true,
        setCookies: [],
      };

      const linkSpy = vi
        .spyOn(AuthService, "linkGoogleAccount")
        .mockResolvedValue(mockResult);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({ user: mockCustomerUser }); // res.locals.validated is undefined
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.linkGoogle(req, res, next);

      expect(linkSpy).toHaveBeenCalledWith(
        mockCustomerUser,
        expect.any(Headers),
        undefined,
      );
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.CONFLICT,
        PUBLIC_ERROR_CODES.ACCOUNT_ALREADY_LINKED,
        "A Google account is already linked to your profile.",
      );

      vi.spyOn(AuthService, "linkGoogleAccount").mockRejectedValue(
        serviceError,
      );

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedQuery: { redirectTo: "/profile" },
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.linkGoogle(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("unlinkGoogle", () => {
    it("should unlink Google account for authenticated user and send 200 response", async () => {
      const unlinkSpy = vi
        .spyOn(AuthService, "unlinkGoogleAccount")
        .mockResolvedValue({
          message: "Google account unlinked successfully.",
        });

      const req = {} as unknown as Request;
      const res = makeMockRes({ user: mockCustomerUser });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.unlinkGoogle(req, res, next);

      expect(unlinkSpy).toHaveBeenCalledWith(mockCustomerUser.id);
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Google account unlinked successfully.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new AppError(
        status.UNPROCESSABLE_ENTITY,
        PUBLIC_ERROR_CODES.CANNOT_UNLINK_SOLE_METHOD,
        "Cannot unlink your only authentication method. Please set a password first.",
      );

      vi.spyOn(AuthService, "unlinkGoogleAccount").mockRejectedValue(
        serviceError,
      );

      const req = {} as unknown as Request;
      const res = makeMockRes({ user: mockCustomerUser });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.unlinkGoogle(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("should send password reset instructions and return 200 response", async () => {
      const forgotSpy = vi
        .spyOn(AuthService, "forgotPassword")
        .mockResolvedValue({
          message:
            "If an account with that email exists, password reset instructions have been sent.",
        });

      const req = {
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Request;
      const res = makeMockRes({
        validatedBody: { email: "user@example.com", redirectTo: "/new-pass" },
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.forgotPassword(req, res, next);

      expect(forgotSpy).toHaveBeenCalledWith(
        { email: "user@example.com", redirectTo: "/new-pass" },
        expect.any(Headers),
      );
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          "If an account with that email exists, password reset instructions have been sent.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new Error(
        "Failed to process password reset request",
      );
      vi.spyOn(AuthService, "forgotPassword").mockRejectedValue(serviceError);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        validatedBody: { email: "user@example.com" },
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.forgotPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    const payload = { token: "token", newPassword: "NewPassword123!" };

    it("should reset password, set cookies, and send 200 response", async () => {
      const resetSpy = vi
        .spyOn(AuthService, "resetPassword")
        .mockResolvedValue({
          message:
            "Password has been reset successfully. Please log in with your new password.",
          setCookies: ["token=resetted; Path=/"],
        });

      const req = {
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Request;
      const res = makeMockRes({
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.resetPassword(req, res, next);

      expect(resetSpy).toHaveBeenCalledWith(payload, expect.any(Headers));
      expect(res.setHeader).toHaveBeenCalledWith("set-cookie", [
        "token=resetted; Path=/",
      ]);
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          "Password has been reset successfully. Please log in with your new password.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should omit set-cookie header when setCookies is empty", async () => {
      vi.spyOn(AuthService, "resetPassword").mockResolvedValue({
        message:
          "Password has been reset successfully. Please log in with your new password.",
        setCookies: [],
      });

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.resetPassword(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message:
          "Password has been reset successfully. Please log in with your new password.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new Error("Invalid or expired reset token");
      vi.spyOn(AuthService, "resetPassword").mockRejectedValue(serviceError);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("changePassword", () => {
    const payload = {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      revokeOtherSessions: true,
    };

    it("should change user password, set cookies, and send 200 response", async () => {
      const changeSpy = vi
        .spyOn(AuthService, "changePassword")
        .mockResolvedValue({
          message: "Password has been changed successfully.",
          setCookies: ["new_token=valid; Path=/"],
        });

      const req = {
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.changePassword(req, res, next);

      expect(changeSpy).toHaveBeenCalledWith(
        mockCustomerUser.id,
        payload,
        expect.any(Headers),
      );
      expect(res.setHeader).toHaveBeenCalledWith("set-cookie", [
        "new_token=valid; Path=/",
      ]);
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Password has been changed successfully.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should omit set-cookie header when setCookies is empty", async () => {
      vi.spyOn(AuthService, "changePassword").mockResolvedValue({
        message: "Password has been changed successfully.",
        setCookies: [],
      });

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.changePassword(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Password has been changed successfully.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new Error("Current password is incorrect");
      vi.spyOn(AuthService, "changePassword").mockRejectedValue(serviceError);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("setPassword", () => {
    const payload = { newPassword: "InitialPassword123!" };

    it("should set password, set cookies, and send 200 response", async () => {
      const setSpy = vi.spyOn(AuthService, "setPassword").mockResolvedValue({
        message: "Password has been set successfully.",
        setCookies: ["token=initialized; Path=/"],
      });

      const req = {
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.setPassword(req, res, next);

      expect(setSpy).toHaveBeenCalledWith(
        mockCustomerUser.id,
        payload,
        expect.any(Headers),
      );
      expect(res.setHeader).toHaveBeenCalledWith("set-cookie", [
        "token=initialized; Path=/",
      ]);
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Password has been set successfully.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should omit set-cookie header when setCookies is empty", async () => {
      vi.spyOn(AuthService, "setPassword").mockResolvedValue({
        message: "Password has been set successfully.",
        setCookies: [],
      });

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.setPassword(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Password has been set successfully.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new Error("Password already set");
      vi.spyOn(AuthService, "setPassword").mockRejectedValue(serviceError);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({
        user: mockCustomerUser,
        validatedBody: payload,
      });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.setPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("should logout current session, set cookies, and send 200 response", async () => {
      const logoutSpy = vi.spyOn(AuthService, "logout").mockResolvedValue({
        message: "Successfully logged out.",
        setCookies: ["session=; Path=/"],
      });

      const req = {
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Request;
      const res = makeMockRes({ session: mockSession });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.logout(req, res, next);

      expect(logoutSpy).toHaveBeenCalledWith(
        mockSession.token,
        expect.any(Headers),
      );
      expect(res.setHeader).toHaveBeenCalledWith("set-cookie", [
        "session=; Path=/",
      ]);
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Successfully logged out.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should omit set-cookie header when setCookies is empty", async () => {
      vi.spyOn(AuthService, "logout").mockResolvedValue({
        message: "Successfully logged out.",
        setCookies: [],
      });

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({ session: mockSession });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.logout(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Successfully logged out.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new Error("Session invalid or expired");
      vi.spyOn(AuthService, "logout").mockRejectedValue(serviceError);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes({ session: mockSession });
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.logout(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("logoutAll", () => {
    it("should logout all sessions, set cookies, and send 200 response", async () => {
      const logoutAllSpy = vi
        .spyOn(AuthService, "logoutAll")
        .mockResolvedValue({
          message: "Successfully logged out from all devices.",
          setCookies: ["session=; Path=/"],
        });

      const req = {
        headers: { "user-agent": "Mozilla/5.0" },
      } as unknown as Request;
      const res = makeMockRes();
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.logoutAll(req, res, next);

      expect(logoutAllSpy).toHaveBeenCalledWith(expect.any(Headers));
      expect(res.setHeader).toHaveBeenCalledWith("set-cookie", [
        "session=; Path=/",
      ]);
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Successfully logged out from all devices.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should omit set-cookie header when setCookies is empty", async () => {
      vi.spyOn(AuthService, "logoutAll").mockResolvedValue({
        message: "Successfully logged out from all devices.",
        setCookies: [],
      });

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes();
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.logoutAll(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(status.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Successfully logged out from all devices.",
        data: null,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next() middleware via catchAsync", async () => {
      const serviceError = new Error("Failed to revoke all sessions");
      vi.spyOn(AuthService, "logoutAll").mockRejectedValue(serviceError);

      const req = { headers: {} } as unknown as Request;
      const res = makeMockRes();
      const next = vi.fn() as unknown as NextFunction;

      await AuthController.logoutAll(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
