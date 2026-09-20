import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../../../src/app/config/auth.js";
import { env } from "../../../../src/app/config/env.js";
import { prisma } from "../../../../src/app/config/prisma.js";
import { AppError } from "../../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import type { AuthUser } from "../../../../src/app/modules/auth/auth.interface.js";
import { AuthService } from "../../../../src/app/modules/auth/auth.service.js";
import { UserRole, UserStatus } from "../../../../src/generated/prisma/enums.js";

describe("AuthService Unit Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockHeaders = new Headers({
    "x-forwarded-for": "127.0.0.1",
    "user-agent": "Vitest-Agent",
  });

  describe("requestEmailVerification", () => {
    const payload = {
      email: "zahid@liminalbd.com",
    };

    describe("Already Verified Prevention", () => {
      it("should throw 400 BAD_REQUEST if user is already verified and enforce minimal projection", async () => {
        const findUniqueSpy = vi
          .spyOn(prisma.user, "findUnique")
          .mockResolvedValue({
            id: "user-verified-123",
            emailVerified: true,
          } as any);

        const otpSpy = vi.spyOn(auth.api, "sendVerificationOTP");

        await expect(
          AuthService.requestEmailVerification(payload, mockHeaders),
        ).rejects.toSatisfy((err: unknown) => {
          expect(err).toBeInstanceOf(AppError);
          expect(err).toMatchObject({
            statusCode: status.BAD_REQUEST,
            code: PUBLIC_ERROR_CODES.ALREADY_VERIFIED,
            message: "Your account is already verified. Please sign in.",
          });
          return true;
        });

        expect(findUniqueSpy).toHaveBeenCalledTimes(1);
        expect(findUniqueSpy).toHaveBeenCalledWith({
          where: { email: payload.email },
          select: { id: true, emailVerified: true },
        });
        expect(otpSpy).not.toHaveBeenCalled();
      });
    });

    describe("Anti-User Enumeration & Unverified User Flow", () => {
      it("should dispatch verification OTP when user exists but is unverified", async () => {
        const findUniqueSpy = vi
          .spyOn(prisma.user, "findUnique")
          .mockResolvedValue({
            id: "user-unverified-123",
            emailVerified: false,
          } as any);

        const otpSpy = vi
          .spyOn(auth.api, "sendVerificationOTP")
          .mockResolvedValue({} as any);

        const result = await AuthService.requestEmailVerification(
          payload,
          mockHeaders,
        );

        expect(findUniqueSpy).toHaveBeenCalledTimes(1);
        expect(findUniqueSpy).toHaveBeenCalledWith({
          where: { email: payload.email },
          select: { id: true, emailVerified: true },
        });

        expect(otpSpy).toHaveBeenCalledTimes(1);
        expect(otpSpy).toHaveBeenCalledWith({
          body: {
            email: payload.email,
            type: "email-verification",
          },
          headers: mockHeaders,
        });

        expect(result).toEqual({
          email: payload.email,
        });
      });

      it("should dispatch verification OTP even when user is not found in database (anti-enumeration)", async () => {
        const findUniqueSpy = vi
          .spyOn(prisma.user, "findUnique")
          .mockResolvedValue(null);

        const otpSpy = vi
          .spyOn(auth.api, "sendVerificationOTP")
          .mockResolvedValue({} as any);

        const result = await AuthService.requestEmailVerification(
          payload,
          mockHeaders,
        );

        expect(findUniqueSpy).toHaveBeenCalledTimes(1);
        expect(findUniqueSpy).toHaveBeenCalledWith({
          where: { email: payload.email },
          select: { id: true, emailVerified: true },
        });

        expect(otpSpy).toHaveBeenCalledTimes(1);
        expect(otpSpy).toHaveBeenCalledWith({
          body: {
            email: payload.email,
            type: "email-verification",
          },
          headers: mockHeaders,
        });

        expect(result).toEqual({
          email: payload.email,
        });
      });
    });

    describe("Better Auth Dispatch Failures", () => {
      it("should propagate errors when sendVerificationOTP fails", async () => {
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
          id: "user-unverified-123",
          emailVerified: false,
        } as any);

        const dispatchError = new Error("Better Auth OTP provider unavailable");
        vi.spyOn(auth.api, "sendVerificationOTP").mockRejectedValue(
          dispatchError,
        );

        await expect(
          AuthService.requestEmailVerification(payload, mockHeaders),
        ).rejects.toThrow(dispatchError);
      });
    });
  });

  describe("confirmEmailVerification", () => {
    const payload = {
      email: "zahid@liminalbd.com",
      otp: "123456",
    };

    describe("Successful Verification Flow", () => {
      it("should successfully verify OTP, extract set-cookies, and return sanitized user identity", async () => {
        const mockAuthHeaders = new Headers();
        mockAuthHeaders.append(
          "set-cookie",
          "better-auth.session_token=token123; Path=/; HttpOnly",
        );

        const verifySpy = vi
          .spyOn(auth.api, "verifyEmailOTP")
          .mockResolvedValue({
            headers: mockAuthHeaders,
            response: {
              status: true,
              user: {
                id: "user-verified-789",
                name: "Zahidul Islam",
                email: "zahid@liminalbd.com",
                emailVerified: true,
                role: UserRole.CUSTOMER,
                status: UserStatus.ACTIVE,
                createdAt: new Date("2026-09-19T12:00:00.000Z"),
                updatedAt: new Date("2026-09-19T12:00:00.000Z"),
              },
            },
          } as any);

        const result = await AuthService.confirmEmailVerification(
          payload,
          mockHeaders,
        );

        expect(verifySpy).toHaveBeenCalledTimes(1);
        expect(verifySpy).toHaveBeenCalledWith({
          body: {
            email: payload.email,
            otp: payload.otp,
          },
          headers: mockHeaders,
          returnHeaders: true,
        });

        expect(result).toEqual({
          user: {
            id: "user-verified-789",
            name: "Zahidul Islam",
            email: "zahid@liminalbd.com",
            emailVerified: true,
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
          },
          setCookies: [
            "better-auth.session_token=token123; Path=/; HttpOnly",
          ],
        });
      });

      it("should return empty setCookies array when authHeaders is missing or contains no cookies", async () => {
        vi.spyOn(auth.api, "verifyEmailOTP").mockResolvedValue({
          headers: null,
          response: {
            status: true,
            user: {
              id: "user-verified-789",
              name: "Zahidul Islam",
              email: "zahid@liminalbd.com",
              emailVerified: true,
              role: UserRole.CUSTOMER,
              status: UserStatus.ACTIVE,
            },
          },
        } as any);

        const result = await AuthService.confirmEmailVerification(
          payload,
          mockHeaders,
        );

        expect(result.setCookies).toEqual([]);
      });
    });

    describe("Verification Failures", () => {
      it("should propagate errors when verifyEmailOTP rejects (e.g., invalid or expired OTP)", async () => {
        const verifyError = new Error("Invalid or expired OTP code");
        vi.spyOn(auth.api, "verifyEmailOTP").mockRejectedValue(verifyError);

        await expect(
          AuthService.confirmEmailVerification(payload, mockHeaders),
        ).rejects.toThrow(verifyError);
      });
    });
  });

  describe("loginWithCredentials", () => {
    const payload = {
      email: "user@example.com",
      password: "UserPassword123!",
    };

    it("should allow customer login, extract cookies, and return sanitized user profile", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.session_token=session-cookie-val; Path=/",
      );

      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        headers: mockAuthHeaders,
        response: {
          token: "session-token-123",
          user: {
            id: "customer-1",
            name: "Customer One",
            email: "user@example.com",
            emailVerified: true,
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
          },
        },
      } as any);

      const result = await AuthService.loginWithCredentials(payload, mockHeaders);

      expect(result).toEqual({
        user: {
          id: "customer-1",
          name: "Customer One",
          email: "user@example.com",
          emailVerified: true,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
        setCookies: ["better-auth.session_token=session-cookie-val; Path=/"],
      });
    });

    it("should revoke session and throw 403 FORBIDDEN if non-customer account attempts customer portal login", async () => {
      const deleteManySpy = vi
        .spyOn(prisma.session, "deleteMany")
        .mockResolvedValue({ count: 1 });

      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        headers: new Headers(),
        response: {
          token: "admin-token-xyz",
          user: {
            id: "admin-user-1",
            name: "Admin User",
            email: "admin@example.com",
            emailVerified: true,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
          },
        },
      } as any);

      await expect(
        AuthService.loginWithCredentials(payload, mockHeaders),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Access denied. This login portal is reserved for customers.",
        });
        return true;
      });

      expect(deleteManySpy).toHaveBeenCalledWith({
        where: { token: "admin-token-xyz" },
      });
    });

    it("should safely skip session deletion if Better Auth does not issue a token during non-customer rejection", async () => {
      const deleteManySpy = vi
        .spyOn(prisma.session, "deleteMany")
        .mockResolvedValue({ count: 0 });

      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        headers: new Headers(),
        response: {
          token: null,
          user: {
            id: "manager-user-1",
            name: "Manager User",
            email: "manager@example.com",
            emailVerified: true,
            role: UserRole.SUPER_ADMIN,
            status: UserStatus.ACTIVE,
          },
        },
      } as any);

      await expect(
        AuthService.loginWithCredentials(payload, mockHeaders),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message: "Access denied. This login portal is reserved for customers.",
        });
        return true;
      });

      expect(deleteManySpy).not.toHaveBeenCalled();
    });

    it("should fallback to empty setCookies array when authHeaders does not contain set-cookie headers", async () => {
      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        headers: new Headers(),
        response: {
          token: "session-token-no-cookie",
          user: {
            id: "customer-1",
            name: "Customer One",
            email: "user@example.com",
            emailVerified: true,
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
          },
        },
      } as any);

      const result = await AuthService.loginWithCredentials(payload, mockHeaders);

      expect(result.setCookies).toEqual([]);
      expect(result.user.id).toBe("customer-1");
    });

    it("should propagate errors when signInEmail rejects (e.g., invalid credentials or account status)", async () => {
      const signInError = new Error("Invalid email or password");
      vi.spyOn(auth.api, "signInEmail").mockRejectedValue(signInError);

      await expect(
        AuthService.loginWithCredentials(payload, mockHeaders),
      ).rejects.toThrow(signInError);
    });
  });

  describe("loginWithGoogle", () => {
    it("should initialize Google OAuth sign-in flow with resolved callback URL and return URL & cookies", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.state=oauth-state; Path=/",
      );

      const signInSocialSpy = vi
        .spyOn(auth.api, "signInSocial")
        .mockResolvedValue({
          headers: mockAuthHeaders,
          response: {
            url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
            redirect: true,
          },
        } as any);

      const result = await AuthService.loginWithGoogle(
        mockHeaders,
        "/custom-destination",
      );

      expect(signInSocialSpy).toHaveBeenCalledWith({
        body: {
          provider: "google",
          callbackURL: `${env.FRONTEND_URL}/custom-destination`,
        },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result).toEqual({
        url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
        redirect: true,
        setCookies: ["better-auth.state=oauth-state; Path=/"],
      });
    });
  });

  describe("linkGoogleAccount", () => {
    const customerUser = {
      id: "customer-100",
      role: UserRole.CUSTOMER,
      name: "Customer Test",
      email: "cust@example.com",
      status: UserStatus.ACTIVE,
    } as AuthUser;

    it("should throw 403 FORBIDDEN if non-customer user attempts to link Google account", async () => {
      const adminUser = {
        id: "admin-100",
        role: UserRole.ADMIN,
        name: "Admin Test",
        email: "admin@example.com",
        status: UserStatus.ACTIVE,
      } as AuthUser;

      await expect(
        AuthService.linkGoogleAccount(adminUser, mockHeaders),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message:
            "Access denied. Administrative accounts cannot link or use Google sign-in.",
        });
        return true;
      });
    });

    it("should throw 409 CONFLICT if Google account is already linked to user profile", async () => {
      vi.spyOn(prisma.account, "findFirst").mockResolvedValue({
        id: "acc-google-1",
      } as any);

      await expect(
        AuthService.linkGoogleAccount(customerUser, mockHeaders),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.CONFLICT,
          code: PUBLIC_ERROR_CODES.ACCOUNT_ALREADY_LINKED,
          message: "A Google account is already linked to your profile.",
        });
        return true;
      });
    });

    it("should link Google account successfully when customer has no existing Google link", async () => {
      vi.spyOn(prisma.account, "findFirst").mockResolvedValue(null);

      const linkSpy = vi.spyOn(auth.api, "linkSocialAccount").mockResolvedValue({
        headers: new Headers(),
        response: {
          url: "https://accounts.google.com/link",
          redirect: true,
        },
      } as any);

      const result = await AuthService.linkGoogleAccount(
        customerUser,
        mockHeaders,
        "/settings/security",
      );

      expect(linkSpy).toHaveBeenCalledWith({
        body: {
          provider: "google",
          callbackURL: `${env.FRONTEND_URL}/settings/security`,
        },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result.url).toBe("https://accounts.google.com/link");
    });
  });

  describe("unlinkGoogleAccount", () => {
    it("should throw 400 BAD_REQUEST if user has no linked Google account", async () => {
      vi.spyOn(prisma.account, "findMany").mockResolvedValue([
        { id: "acc-1", providerId: "credential", password: "hash" },
      ] as any);

      await expect(
        AuthService.unlinkGoogleAccount("user-no-google"),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.BAD_REQUEST,
          code: PUBLIC_ERROR_CODES.ACCOUNT_NOT_LINKED,
          message: "No linked Google account was found on your profile.",
        });
        return true;
      });
    });

    it("should throw 422 UNPROCESSABLE_ENTITY if Google is the user's only authentication method", async () => {
      vi.spyOn(prisma.account, "findMany").mockResolvedValue([
        { id: "acc-google", providerId: "google", password: null },
      ] as any);

      await expect(
        AuthService.unlinkGoogleAccount("user-google-only"),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.UNPROCESSABLE_ENTITY,
          code: PUBLIC_ERROR_CODES.CANNOT_UNLINK_SOLE_METHOD,
          message:
            "Cannot unlink your only authentication method. Please set a password first.",
        });
        return true;
      });
    });

    it("should throw 422 UNPROCESSABLE_ENTITY if user has a credential account but password is null (no alternative auth)", async () => {
      vi.spyOn(prisma.account, "findMany").mockResolvedValue([
        { id: "acc-google", providerId: "google", password: null },
        { id: "acc-cred", providerId: "credential", password: null },
      ] as any);

      await expect(
        AuthService.unlinkGoogleAccount("user-passwordless-cred"),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.UNPROCESSABLE_ENTITY,
          code: PUBLIC_ERROR_CODES.CANNOT_UNLINK_SOLE_METHOD,
          message:
            "Cannot unlink your only authentication method. Please set a password first.",
        });
        return true;
      });
    });

    it("should unlink Google account successfully when an alternative auth method exists", async () => {
      vi.spyOn(prisma.account, "findMany").mockResolvedValue([
        { id: "acc-google-1", providerId: "google", password: null },
        { id: "acc-cred-1", providerId: "credential", password: "hashed_password" },
      ] as any);

      const deleteSpy = vi
        .spyOn(prisma.account, "delete")
        .mockResolvedValue({ id: "acc-google-1" } as any);

      const result = await AuthService.unlinkGoogleAccount("user-multi-auth");

      expect(deleteSpy).toHaveBeenCalledWith({
        where: { id: "acc-google-1" },
      });
      expect(result).toEqual({
        message: "Google account unlinked successfully.",
      });
    });
  });

  describe("forgotPassword", () => {
    it("should call auth.api.requestPasswordReset with resolved callback URL and return generic message", async () => {
      const resetSpy = vi
        .spyOn(auth.api, "requestPasswordReset")
        .mockResolvedValue({} as any);

      const result = await AuthService.forgotPassword(
        { email: "user@example.com", redirectTo: "/new-password" },
        mockHeaders,
      );

      expect(resetSpy).toHaveBeenCalledWith({
        body: {
          email: "user@example.com",
          redirectTo: `${env.FRONTEND_URL}/new-password`,
        },
        headers: mockHeaders,
      });

      expect(result).toEqual({
        message:
          "If an account with that email exists, password reset instructions have been sent.",
      });
    });
  });

  describe("resetPassword", () => {
    it("should reset password and return success message and setCookies", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append("set-cookie", "session_token=resetted; Path=/");

      const resetSpy = vi.spyOn(auth.api, "resetPassword").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      const result = await AuthService.resetPassword(
        { token: "reset-tok-123", newPassword: "NewSecurePass123!" },
        mockHeaders,
      );

      expect(resetSpy).toHaveBeenCalledWith({
        body: {
          token: "reset-tok-123",
          newPassword: "NewSecurePass123!",
        },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result).toEqual({
        message:
          "Password has been reset successfully. Please log in with your new password.",
        setCookies: ["session_token=resetted; Path=/"],
      });
    });
  });

  describe("changePassword", () => {
    it("should change password, clear needPasswordChange flag, and return cookies", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append("set-cookie", "new_session=active; Path=/");

      const changeSpy = vi.spyOn(auth.api, "changePassword").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      const updateSpy = vi
        .spyOn(prisma.user, "update")
        .mockResolvedValue({} as any);

      const result = await AuthService.changePassword(
        "user-id-123",
        {
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword456!",
          revokeOtherSessions: true,
        },
        mockHeaders,
      );

      expect(changeSpy).toHaveBeenCalledWith({
        body: {
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword456!",
          revokeOtherSessions: true,
        },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: "user-id-123" },
        data: { needPasswordChange: false },
      });

      expect(result).toEqual({
        message: "Password has been changed successfully.",
        setCookies: ["new_session=active; Path=/"],
      });
    });
  });

  describe("setPassword", () => {
    it("should throw 400 BAD_REQUEST if a credential password already exists for this account", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue({
        password: "already-hashed-password",
      } as any);

      await expect(
        AuthService.setPassword(
          "user-with-pass",
          { newPassword: "NewPassword123!" },
          mockHeaders,
        ),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.BAD_REQUEST,
          code: PUBLIC_ERROR_CODES.CONFLICT,
          message:
            "A password has already been set for this account. Please use change password.",
        });
        return true;
      });
    });

    it("should set password, clear needPasswordChange flag, and return cookies when no password exists", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      const setSpy = vi.spyOn(auth.api, "setPassword").mockResolvedValue({
        headers: new Headers(),
        response: { status: true },
      } as any);

      const updateSpy = vi
        .spyOn(prisma.user, "update")
        .mockResolvedValue({} as any);

      const result = await AuthService.setPassword(
        "user-without-pass",
        { newPassword: "InitialPassword123!" },
        mockHeaders,
      );

      expect(setSpy).toHaveBeenCalledWith({
        body: { newPassword: "InitialPassword123!" },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: "user-without-pass" },
        data: { needPasswordChange: false },
      });

      expect(result).toEqual({
        message: "Password has been set successfully.",
        setCookies: [],
      });
    });
  });

  describe("logout", () => {
    it("should revoke session, call signOut, and return cookies and success message", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      );

      const revokeSpy = vi
        .spyOn(auth.api, "revokeSession")
        .mockResolvedValue({ status: true } as any);

      const signOutSpy = vi.spyOn(auth.api, "signOut").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      const result = await AuthService.logout("active-token-123", mockHeaders);

      expect(revokeSpy).toHaveBeenCalledWith({
        body: { token: "active-token-123" },
        headers: mockHeaders,
      });

      expect(signOutSpy).toHaveBeenCalledWith({
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result).toEqual({
        message: "Successfully logged out.",
        setCookies: [
          "better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        ],
      });
    });
  });

  describe("logoutAll", () => {
    it("should revoke all sessions, call signOut, and return cookies and success message", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      );

      const revokeAllSpy = vi
        .spyOn(auth.api, "revokeSessions")
        .mockResolvedValue({ status: true } as any);

      const signOutSpy = vi.spyOn(auth.api, "signOut").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      const result = await AuthService.logoutAll(mockHeaders);

      expect(revokeAllSpy).toHaveBeenCalledWith({
        headers: mockHeaders,
      });

      expect(signOutSpy).toHaveBeenCalledWith({
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result).toEqual({
        message: "Successfully logged out from all devices.",
        setCookies: [
          "better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        ],
      });
    });
  });
});
