import status from "http-status";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../../../src/app/config/auth.js";
import { env } from "../../../../src/app/config/env.js";
import { prisma } from "../../../../src/app/config/prisma.js";
import { AppError } from "../../../../src/app/errors/AppError.js";
import { PUBLIC_ERROR_CODES } from "../../../../src/app/errors/errorCodes.js";
import type { AuthUser } from "../../../../src/app/modules/auth/auth.interface.js";
import { AuthService } from "../../../../src/app/modules/auth/auth.service.js";
import {
  UserRole,
  UserStatus,
} from "../../../../src/generated/prisma/enums.js";

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
          AuthService.requestEmailVerification({ headers: mockHeaders, payload }),
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

        const result = await AuthService.requestEmailVerification({
          headers: mockHeaders,
          payload,
        });

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

        const result = await AuthService.requestEmailVerification({
          headers: mockHeaders,
          payload,
        });

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
          AuthService.requestEmailVerification({ headers: mockHeaders, payload }),
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

        const result = await AuthService.confirmEmailVerification({
          headers: mockHeaders,
          payload,
        });

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
          setCookies: ["better-auth.session_token=token123; Path=/; HttpOnly"],
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

        const result = await AuthService.confirmEmailVerification({
          headers: mockHeaders,
          payload,
        });

        expect(result.setCookies).toEqual([]);
      });
    });

    describe("Verification Failures", () => {
      it("should propagate errors when verifyEmailOTP rejects (e.g., invalid or expired OTP)", async () => {
        const verifyError = new Error("Invalid or expired OTP code");
        vi.spyOn(auth.api, "verifyEmailOTP").mockRejectedValue(verifyError);

        await expect(
          AuthService.confirmEmailVerification({ headers: mockHeaders, payload }),
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

      const result = await AuthService.loginWithCredentials({
        headers: mockHeaders,
        payload,
      });

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
        AuthService.loginWithCredentials({ headers: mockHeaders, payload }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message:
            "Access denied. This login portal is reserved for customers.",
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
        AuthService.loginWithCredentials({ headers: mockHeaders, payload }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.FORBIDDEN,
          code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
          message:
            "Access denied. This login portal is reserved for customers.",
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

      const result = await AuthService.loginWithCredentials({
        headers: mockHeaders,
        payload,
      });

      expect(result.setCookies).toEqual([]);
      expect(result.user.id).toBe("customer-1");
    });

    it("should safely handle undefined authHeaders and return empty setCookies", async () => {
      vi.spyOn(auth.api, "signInEmail").mockResolvedValue({
        headers: undefined,
        response: {
          token: "session-token-no-headers",
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

      const result = await AuthService.loginWithCredentials({
        headers: mockHeaders,
        payload,
      });

      expect(result.setCookies).toEqual([]);
      expect(result.user.id).toBe("customer-1");
    });

    it("should propagate errors when signInEmail rejects (e.g., invalid credentials or account status)", async () => {
      const signInError = new Error("Invalid email or password");
      vi.spyOn(auth.api, "signInEmail").mockRejectedValue(signInError);

      await expect(
        AuthService.loginWithCredentials({ headers: mockHeaders, payload }),
      ).rejects.toThrow(signInError);
    });
  });

  describe("loginWithGoogle", () => {
    it("should initialize Google OAuth sign-in flow with custom redirectTo and return URL & cookies", async () => {
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

      const result = await AuthService.loginWithGoogle({
        headers: mockHeaders,
        redirectTo: "/custom-destination",
      });

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

    it("should fallback to default /dashboard callbackURL when redirectTo is omitted", async () => {
      const signInSocialSpy = vi
        .spyOn(auth.api, "signInSocial")
        .mockResolvedValue({
          headers: new Headers(),
          response: {
            url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
            redirect: true,
          },
        } as any);

      const result = await AuthService.loginWithGoogle({ headers: mockHeaders });

      expect(signInSocialSpy).toHaveBeenCalledWith({
        body: {
          provider: "google",
          callbackURL: `${env.FRONTEND_URL}/dashboard`,
        },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result.url).toBe(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
      );
      expect(result.redirect).toBe(true);
      expect(result.setCookies).toEqual([]);
    });

    it("should safely handle undefined authHeaders and return empty setCookies array", async () => {
      vi.spyOn(auth.api, "signInSocial").mockResolvedValue({
        headers: undefined,
        response: {
          url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
          redirect: true,
        },
      } as any);

      const result = await AuthService.loginWithGoogle({
        headers: mockHeaders,
        redirectTo: "/cart",
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should forward multiple cookies when returned by better-auth", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.state=state123; Path=/; HttpOnly",
      );
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.pkce=pkce456; Path=/; HttpOnly",
      );

      vi.spyOn(auth.api, "signInSocial").mockResolvedValue({
        headers: mockAuthHeaders,
        response: {
          url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
          redirect: true,
        },
      } as any);

      const result = await AuthService.loginWithGoogle({ headers: mockHeaders });

      expect(result.setCookies).toEqual([
        "better-auth.state=state123; Path=/; HttpOnly",
        "better-auth.pkce=pkce456; Path=/; HttpOnly",
      ]);
    });

    it("should propagate errors thrown by auth.api.signInSocial", async () => {
      vi.spyOn(auth.api, "signInSocial").mockRejectedValue(
        new Error("OAuth upstream service unavailable"),
      );

      await expect(
        AuthService.loginWithGoogle({ headers: mockHeaders }),
      ).rejects.toThrow("OAuth upstream service unavailable");
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
      const adminRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

      for (const role of adminRoles) {
        const staffUser = {
          id: `staff-${role}`,
          role,
          name: "Staff Test",
          email: `${role.toLowerCase()}@example.com`,
          status: UserStatus.ACTIVE,
        } as AuthUser;

        await expect(
          AuthService.linkGoogleAccount({ user: staffUser, headers: mockHeaders }),
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
      }
    });

    it("should throw 409 CONFLICT if Google account is already linked to user profile", async () => {
      const findUniqueSpy = vi
        .spyOn(prisma.account, "findUnique")
        .mockResolvedValue({
          id: "acc-google-1",
        } as any);

      await expect(
        AuthService.linkGoogleAccount({
          user: customerUser,
          headers: mockHeaders,
        }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err).toMatchObject({
          statusCode: status.CONFLICT,
          code: PUBLIC_ERROR_CODES.ACCOUNT_ALREADY_LINKED,
          message: "A Google account is already linked to your profile.",
        });
        return true;
      });

      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: {
          userId_providerId: {
            userId: customerUser.id,
            providerId: "google",
          },
        },
        select: { id: true },
      });
    });

    it("should link Google account with default callback URL (/profile) when redirectTo is omitted", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      const linkSpy = vi
        .spyOn(auth.api, "linkSocialAccount")
        .mockResolvedValue({
          headers: new Headers(),
          response: {
            url: "https://accounts.google.com/o/oauth2/v2/auth?link=1",
            redirect: true,
          },
        } as any);

      const result = await AuthService.linkGoogleAccount({
        user: customerUser,
        headers: mockHeaders,
      });

      expect(linkSpy).toHaveBeenCalledWith({
        body: {
          provider: "google",
          callbackURL: `${env.FRONTEND_URL}/profile`,
        },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result).toEqual({
        url: "https://accounts.google.com/o/oauth2/v2/auth?link=1",
        redirect: true,
        setCookies: [],
      });
    });

    it("should link Google account with custom callback URL when valid redirectTo is provided", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      const linkSpy = vi
        .spyOn(auth.api, "linkSocialAccount")
        .mockResolvedValue({
          headers: new Headers(),
          response: {
            url: "https://accounts.google.com/o/oauth2/v2/auth?link=2",
            redirect: true,
          },
        } as any);

      const result = await AuthService.linkGoogleAccount({
        user: customerUser,
        headers: mockHeaders,
        redirectTo: "/settings/security",
      });

      expect(linkSpy).toHaveBeenCalledWith({
        body: {
          provider: "google",
          callbackURL: `${env.FRONTEND_URL}/settings/security`,
        },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result.url).toBe(
        "https://accounts.google.com/o/oauth2/v2/auth?link=2",
      );
      expect(result.redirect).toBe(true);
      expect(result.setCookies).toEqual([]);
    });

    it("should handle undefined or null auth headers safely and return empty setCookies", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      vi.spyOn(auth.api, "linkSocialAccount").mockResolvedValue({
        headers: undefined,
        response: {
          url: "https://accounts.google.com/o/oauth2/v2/auth?link=3",
          redirect: true,
        },
      } as any);

      const result = await AuthService.linkGoogleAccount({
        user: customerUser,
        headers: mockHeaders,
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should forward multiple cookies returned by linkSocialAccount", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.state=linkstate123; Path=/; HttpOnly",
      );
      mockAuthHeaders.append(
        "set-cookie",
        "better-auth.pkce=linkpkce456; Path=/; HttpOnly",
      );

      vi.spyOn(auth.api, "linkSocialAccount").mockResolvedValue({
        headers: mockAuthHeaders,
        response: {
          url: "https://accounts.google.com/o/oauth2/v2/auth?link=4",
          redirect: true,
        },
      } as any);

      const result = await AuthService.linkGoogleAccount({
        user: customerUser,
        headers: mockHeaders,
      });

      expect(result.setCookies).toEqual([
        "better-auth.state=linkstate123; Path=/; HttpOnly",
        "better-auth.pkce=linkpkce456; Path=/; HttpOnly",
      ]);
    });

    it("should propagate errors thrown by auth.api.linkSocialAccount", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      vi.spyOn(auth.api, "linkSocialAccount").mockRejectedValue(
        new Error("OAuth upstream service unavailable"),
      );

      await expect(
        AuthService.linkGoogleAccount({
          user: customerUser,
          headers: mockHeaders,
        }),
      ).rejects.toThrow("OAuth upstream service unavailable");
    });
  });

  describe("unlinkGoogleAccount", () => {
    it("should throw 400 BAD_REQUEST if user has no linked Google account", async () => {
      const findManySpy = vi
        .spyOn(prisma.account, "findMany")
        .mockResolvedValue([
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

      expect(findManySpy).toHaveBeenCalledWith({
        where: { userId: "user-no-google" },
        select: {
          id: true,
          providerId: true,
          password: true,
        },
      });
    });

    it("should throw 400 BAD_REQUEST if user has no accounts at all", async () => {
      vi.spyOn(prisma.account, "findMany").mockResolvedValue([]);

      await expect(
        AuthService.unlinkGoogleAccount("user-no-accounts"),
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
      const deleteSpy = vi.spyOn(prisma.account, "delete");

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

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it("should throw 422 UNPROCESSABLE_ENTITY if user has a credential account but password is null or empty", async () => {
      const deleteSpy = vi.spyOn(prisma.account, "delete");

      for (const emptyPassword of [null, ""]) {
        vi.spyOn(prisma.account, "findMany").mockResolvedValue([
          { id: "acc-google", providerId: "google", password: null },
          { id: "acc-cred", providerId: "credential", password: emptyPassword },
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
      }

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it("should unlink Google account successfully when password-protected credential account exists", async () => {
      const findManySpy = vi
        .spyOn(prisma.account, "findMany")
        .mockResolvedValue([
          { id: "acc-google-1", providerId: "google", password: null },
          {
            id: "acc-cred-1",
            providerId: "credential",
            password: "hashed_password",
          },
        ] as any);

      const deleteSpy = vi
        .spyOn(prisma.account, "delete")
        .mockResolvedValue({ id: "acc-google-1" } as any);

      const result = await AuthService.unlinkGoogleAccount("user-multi-auth");

      expect(findManySpy).toHaveBeenCalledWith({
        where: { userId: "user-multi-auth" },
        select: {
          id: true,
          providerId: true,
          password: true,
        },
      });
      expect(deleteSpy).toHaveBeenCalledWith({
        where: { id: "acc-google-1" },
      });
      expect(result).toEqual({
        message: "Google account unlinked successfully.",
      });
    });

    it("should unlink Google account successfully when an alternative third-party OAuth provider exists", async () => {
      vi.spyOn(prisma.account, "findMany").mockResolvedValue([
        { id: "acc-google-1", providerId: "google", password: null },
        { id: "acc-github-1", providerId: "github", password: null },
      ] as any);

      const deleteSpy = vi
        .spyOn(prisma.account, "delete")
        .mockResolvedValue({ id: "acc-google-1" } as any);

      const result = await AuthService.unlinkGoogleAccount("user-oauth-multi");

      expect(deleteSpy).toHaveBeenCalledWith({
        where: { id: "acc-google-1" },
      });
      expect(result).toEqual({
        message: "Google account unlinked successfully.",
      });
    });

    it("should propagate errors thrown by prisma.account.delete", async () => {
      vi.spyOn(prisma.account, "findMany").mockResolvedValue([
        { id: "acc-google-1", providerId: "google", password: null },
        {
          id: "acc-cred-1",
          providerId: "credential",
          password: "hashed_password",
        },
      ] as any);

      vi.spyOn(prisma.account, "delete").mockRejectedValue(
        new Error("Database write failure"),
      );

      await expect(
        AuthService.unlinkGoogleAccount("user-multi-auth"),
      ).rejects.toThrow("Database write failure");
    });
  });

  describe("forgotPassword", () => {
    it("should call auth.api.requestPasswordReset with resolved callback URL and return generic message", async () => {
      const resetSpy = vi
        .spyOn(auth.api, "requestPasswordReset")
        .mockResolvedValue({} as any);

      const result = await AuthService.forgotPassword({
        headers: mockHeaders,
        payload: { email: "user@example.com", redirectTo: "/new-password" },
      });

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

    it("should fallback to default callback URL (/reset-password) when redirectTo is omitted", async () => {
      const resetSpy = vi
        .spyOn(auth.api, "requestPasswordReset")
        .mockResolvedValue({} as any);

      const result = await AuthService.forgotPassword({
        headers: mockHeaders,
        payload: { email: "user@example.com" },
      });

      expect(resetSpy).toHaveBeenCalledWith({
        body: {
          email: "user@example.com",
          redirectTo: `${env.FRONTEND_URL}/reset-password`,
        },
        headers: mockHeaders,
      });

      expect(result).toEqual({
        message:
          "If an account with that email exists, password reset instructions have been sent.",
      });
    });

    it("should propagate errors thrown by auth.api.requestPasswordReset", async () => {
      vi.spyOn(auth.api, "requestPasswordReset").mockRejectedValue(
        new Error("Auth provider unavailable"),
      );

      await expect(
        AuthService.forgotPassword(
          { headers: mockHeaders, payload: { email: "user@example.com" } },
        ),
      ).rejects.toThrow("Auth provider unavailable");
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

      const result = await AuthService.resetPassword({
        headers: mockHeaders,
        payload: { token: "reset-tok-123", newPassword: "NewSecurePass123!" },
      });

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

    it("should safely handle undefined authHeaders and return empty setCookies", async () => {
      vi.spyOn(auth.api, "resetPassword").mockResolvedValue({
        headers: undefined,
        response: { status: true },
      } as any);

      const result = await AuthService.resetPassword({
        headers: mockHeaders,
        payload: { token: "reset-tok-123", newPassword: "NewSecurePass123!" },
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should return empty setCookies when authHeaders contains no set-cookie entries", async () => {
      const mockAuthHeaders = new Headers();

      vi.spyOn(auth.api, "resetPassword").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      const result = await AuthService.resetPassword({
        headers: mockHeaders,
        payload: { token: "reset-tok-123", newPassword: "NewSecurePass123!" },
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should propagate errors thrown by auth.api.resetPassword", async () => {
      vi.spyOn(auth.api, "resetPassword").mockRejectedValue(
        new Error("Invalid or expired reset token"),
      );

      await expect(
        AuthService.resetPassword({
          headers: mockHeaders,
          payload: { token: "invalid-tok", newPassword: "NewSecurePass123!" },
        }),
      ).rejects.toThrow("Invalid or expired reset token");
    });
  });

  describe("changePassword", () => {
    const payload = {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword456!",
      revokeOtherSessions: true,
    };

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

      const result = await AuthService.changePassword({
        userId: "user-id-123",
        headers: mockHeaders,
        payload,
      });

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

    it("should change password with revokeOtherSessions: false when explicitly provided", async () => {
      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append("set-cookie", "new_session=active; Path=/");

      const changeSpy = vi.spyOn(auth.api, "changePassword").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      vi.spyOn(prisma.user, "update").mockResolvedValue({} as any);

      const result = await AuthService.changePassword({
        userId: "user-id-123",
        headers: mockHeaders,
        payload: { ...payload, revokeOtherSessions: false },
      });

      expect(changeSpy).toHaveBeenCalledWith({
        body: {
          currentPassword: "OldPassword123!",
          newPassword: "NewPassword456!",
          revokeOtherSessions: false,
        },
        headers: mockHeaders,
        returnHeaders: true,
      });

      expect(result.setCookies).toEqual(["new_session=active; Path=/"]);
    });

    it("should return empty setCookies when authHeaders contains no set-cookie entries", async () => {
      const mockAuthHeaders = new Headers();

      vi.spyOn(auth.api, "changePassword").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      vi.spyOn(prisma.user, "update").mockResolvedValue({} as any);

      const result = await AuthService.changePassword({
        userId: "user-id-123",
        headers: mockHeaders,
        payload,
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should safely handle undefined authHeaders and return empty setCookies", async () => {
      vi.spyOn(auth.api, "changePassword").mockResolvedValue({
        headers: undefined,
        response: { status: true },
      } as any);

      vi.spyOn(prisma.user, "update").mockResolvedValue({} as any);

      const result = await AuthService.changePassword({
        userId: "user-id-123",
        headers: mockHeaders,
        payload,
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should propagate errors from auth.api.changePassword and never update user flag", async () => {
      const updateSpy = vi.spyOn(prisma.user, "update");

      vi.spyOn(auth.api, "changePassword").mockRejectedValue(
        new Error("Invalid current password"),
      );

      await expect(
        AuthService.changePassword({
          userId: "user-id-123",
          headers: mockHeaders,
          payload,
        }),
      ).rejects.toThrow("Invalid current password");

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("should propagate errors thrown by prisma.user.update", async () => {
      vi.spyOn(auth.api, "changePassword").mockResolvedValue({
        headers: new Headers(),
        response: { status: true },
      } as any);

      vi.spyOn(prisma.user, "update").mockRejectedValue(
        new Error("Database write failure"),
      );

      await expect(
        AuthService.changePassword({
          userId: "user-id-123",
          headers: mockHeaders,
          payload,
        }),
      ).rejects.toThrow("Database write failure");
    });
  });

  describe("setPassword", () => {
    it("should throw 400 BAD_REQUEST if a credential password already exists for this account", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue({
        password: "already-hashed-password",
      } as any);
      const setSpy = vi.spyOn(auth.api, "setPassword");
      const updateSpy = vi.spyOn(prisma.user, "update");

      await expect(
        AuthService.setPassword({
          userId: "user-with-pass",
          headers: mockHeaders,
          payload: { newPassword: "NewPassword123!" },
        }),
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

      expect(setSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("should allow setting password when existing credential account has null password", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue({
        password: null,
      } as any);

      const setSpy = vi.spyOn(auth.api, "setPassword").mockResolvedValue({
        headers: new Headers(),
        response: { status: true },
      } as any);

      const updateSpy = vi
        .spyOn(prisma.user, "update")
        .mockResolvedValue({} as any);

      const result = await AuthService.setPassword({
        userId: "user-null-pass",
        headers: mockHeaders,
        payload: { newPassword: "InitialPassword123!" },
      });

      expect(setSpy).toHaveBeenCalledWith({
        body: { newPassword: "InitialPassword123!" },
        headers: mockHeaders,
        returnHeaders: true,
      });
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: "user-null-pass" },
        data: { needPasswordChange: false },
      });
      expect(result.message).toBe("Password has been set successfully.");
    });

    it("should set password, clear needPasswordChange flag, and return cookies when no password exists", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      const mockAuthHeaders = new Headers();
      mockAuthHeaders.append("set-cookie", "session_token=initialized; Path=/");

      const setSpy = vi.spyOn(auth.api, "setPassword").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      const updateSpy = vi
        .spyOn(prisma.user, "update")
        .mockResolvedValue({} as any);

      const result = await AuthService.setPassword({
        userId: "user-without-pass",
        headers: mockHeaders,
        payload: { newPassword: "InitialPassword123!" },
      });

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
        setCookies: ["session_token=initialized; Path=/"],
      });
    });

    it("should safely handle undefined authHeaders and return empty setCookies", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      vi.spyOn(auth.api, "setPassword").mockResolvedValue({
        headers: undefined,
        response: { status: true },
      } as any);

      vi.spyOn(prisma.user, "update").mockResolvedValue({} as any);

      const result = await AuthService.setPassword({
        userId: "user-without-pass",
        headers: mockHeaders,
        payload: { newPassword: "InitialPassword123!" },
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should return empty setCookies when authHeaders contains no set-cookie entries", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      vi.spyOn(auth.api, "setPassword").mockResolvedValue({
        headers: new Headers(),
        response: { status: true },
      } as any);

      vi.spyOn(prisma.user, "update").mockResolvedValue({} as any);

      const result = await AuthService.setPassword({
        userId: "user-without-pass",
        headers: mockHeaders,
        payload: { newPassword: "InitialPassword123!" },
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should propagate errors from auth.api.setPassword and never update user flag", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);
      const updateSpy = vi.spyOn(prisma.user, "update");

      vi.spyOn(auth.api, "setPassword").mockRejectedValue(
        new Error("Upstream setPassword failure"),
      );

      await expect(
        AuthService.setPassword({
          userId: "user-without-pass",
          headers: mockHeaders,
          payload: { newPassword: "InitialPassword123!" },
        }),
      ).rejects.toThrow("Upstream setPassword failure");

      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("should propagate errors thrown by prisma.user.update", async () => {
      vi.spyOn(prisma.account, "findUnique").mockResolvedValue(null);

      vi.spyOn(auth.api, "setPassword").mockResolvedValue({
        headers: new Headers(),
        response: { status: true },
      } as any);

      vi.spyOn(prisma.user, "update").mockRejectedValue(
        new Error("Database write failure"),
      );

      await expect(
        AuthService.setPassword({
          userId: "user-without-pass",
          headers: mockHeaders,
          payload: { newPassword: "InitialPassword123!" },
        }),
      ).rejects.toThrow("Database write failure");
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

      const result = await AuthService.logout({
        sessionToken: "active-token-123",
        headers: mockHeaders,
      });

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

    it("should safely handle undefined authHeaders from signOut and return empty setCookies", async () => {
      vi.spyOn(auth.api, "revokeSession").mockResolvedValue({
        status: true,
      } as any);

      vi.spyOn(auth.api, "signOut").mockResolvedValue({
        headers: undefined,
        response: { status: true },
      } as any);

      const result = await AuthService.logout({
        sessionToken: "active-token-123",
        headers: mockHeaders,
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should safely handle authHeaders with empty getSetCookie() and return empty setCookies", async () => {
      const mockAuthHeaders = new Headers();
      vi.spyOn(auth.api, "revokeSession").mockResolvedValue({
        status: true,
      } as any);
      vi.spyOn(auth.api, "signOut").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      const result = await AuthService.logout({
        sessionToken: "active-token-123",
        headers: mockHeaders,
      });

      expect(result.setCookies).toEqual([]);
    });

    it("should propagate errors when upstream revokeSession fails and not call signOut", async () => {
      const signOutSpy = vi.spyOn(auth.api, "signOut");
      vi.spyOn(auth.api, "revokeSession").mockRejectedValue(
        new Error("Session revocation failed"),
      );

      await expect(
        AuthService.logout({
          sessionToken: "active-token-123",
          headers: mockHeaders,
        }),
      ).rejects.toThrow("Session revocation failed");

      expect(signOutSpy).not.toHaveBeenCalled();
    });

    it("should propagate errors when upstream signOut fails", async () => {
      vi.spyOn(auth.api, "revokeSession").mockResolvedValue({
        status: true,
      } as any);
      vi.spyOn(auth.api, "signOut").mockRejectedValue(
        new Error("Sign out failed"),
      );

      await expect(
        AuthService.logout({
          sessionToken: "active-token-123",
          headers: mockHeaders,
        }),
      ).rejects.toThrow("Sign out failed");
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

    it("should safely handle undefined authHeaders from signOut and return empty setCookies", async () => {
      vi.spyOn(auth.api, "revokeSessions").mockResolvedValue({
        status: true,
      } as any);

      vi.spyOn(auth.api, "signOut").mockResolvedValue({
        headers: undefined,
        response: { status: true },
      } as any);

      const result = await AuthService.logoutAll(mockHeaders);

      expect(result.setCookies).toEqual([]);
    });

    it("should safely handle authHeaders with empty getSetCookie() and return empty setCookies", async () => {
      const mockAuthHeaders = new Headers();
      vi.spyOn(auth.api, "revokeSessions").mockResolvedValue({
        status: true,
      } as any);
      vi.spyOn(auth.api, "signOut").mockResolvedValue({
        headers: mockAuthHeaders,
        response: { status: true },
      } as any);

      const result = await AuthService.logoutAll(mockHeaders);

      expect(result.setCookies).toEqual([]);
    });

    it("should propagate errors when upstream revokeSessions fails and not call signOut", async () => {
      const signOutSpy = vi.spyOn(auth.api, "signOut");
      vi.spyOn(auth.api, "revokeSessions").mockRejectedValue(
        new Error("Mass session revocation failed"),
      );

      await expect(AuthService.logoutAll(mockHeaders)).rejects.toThrow(
        "Mass session revocation failed",
      );

      expect(signOutSpy).not.toHaveBeenCalled();
    });

    it("should propagate errors when upstream signOut fails", async () => {
      vi.spyOn(auth.api, "revokeSessions").mockResolvedValue({
        status: true,
      } as any);
      vi.spyOn(auth.api, "signOut").mockRejectedValue(
        new Error("Sign out failed"),
      );

      await expect(AuthService.logoutAll(mockHeaders)).rejects.toThrow(
        "Sign out failed",
      );
    });
  });
});
