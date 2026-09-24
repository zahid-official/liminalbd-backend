import { APIError } from "better-auth/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../../src/app/config/auth.js";
import { env } from "../../../src/app/config/env.js";
import { prisma } from "../../../src/app/config/prisma.js";
import { PUBLIC_ERROR_CODES } from "../../../src/app/errors/errorCodes.js";
import { AuthMailer } from "../../../src/app/shared/email/mailers/auth.mailer.js";
import { UserRole, UserStatus } from "../../../src/generated/prisma/enums.js";

describe("auth Configuration Unit Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Core Infrastructure & Cookie Policy", () => {
    it("should configure baseURL, basePath, and trustedOrigins correctly", () => {
      expect(auth.options.baseURL).toBe(env.BETTER_AUTH_URL);
      expect(auth.options.basePath).toBe("/api/v1/auth");
      expect(auth.options.trustedOrigins).toEqual([env.FRONTEND_URL]);
    });

    it("should enforce secure session lifecycle and cookie caching policy", () => {
      expect(auth.options.session?.expiresIn).toBe(60 * 60 * 24 * 7); // 7 days
      expect(auth.options.session?.updateAge).toBe(60 * 60 * 24); // 1 day
      expect(auth.options.session?.cookieCache).toEqual({
        enabled: true,
        maxAge: 60 * 15, // 15 minutes
      });
    });

    it("should configure secure cookie attributes according to environment", () => {
      const cookieAttrs =
        auth.options.advanced?.cookies?.session_token?.attributes;

      expect(cookieAttrs?.httpOnly).toBe(true);
      expect(cookieAttrs?.sameSite).toBe("lax");
      expect(cookieAttrs?.path).toBe("/");
      expect(cookieAttrs?.secure).toBe(env.NODE_ENV === "production");
      expect(auth.options.advanced?.useSecureCookies).toBe(
        env.NODE_ENV === "production",
      );
    });
  });

  describe("User Schema Extensions", () => {
    it("should register custom application fields with client input disabled", () => {
      const fields = auth.options.user?.additionalFields;

      expect(fields?.role).toEqual({
        type: "string",
        required: false,
        defaultValue: UserRole.CUSTOMER,
        input: false,
      });

      expect(fields?.status).toEqual({
        type: "string",
        required: false,
        defaultValue: UserStatus.ACTIVE,
        input: false,
      });

      expect(fields?.needPasswordChange).toEqual({
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      });

      expect(fields?.deletedAt).toEqual({
        type: "date",
        required: false,
        input: false,
      });
    });
  });

  describe("Authentication Strategies & Plugins Configuration", () => {
    it("should configure emailAndPassword with secure reset and session revocation settings", () => {
      const emailConfig = auth.options.emailAndPassword;

      expect(emailConfig?.enabled).toBe(true);
      expect(emailConfig?.autoSignIn).toBe(false);
      expect(emailConfig?.requireEmailVerification).toBe(false);
      expect(emailConfig?.resetPasswordTokenExpiresIn).toBe(60 * 15);
      expect(emailConfig?.revokeSessionsOnPasswordReset).toBe(true);
    });

    it("should configure emailVerification and accountLinking", () => {
      expect(auth.options.emailVerification?.sendOnSignUp).toBe(false);
      expect(auth.options.emailVerification?.autoSignInAfterVerification).toBe(
        true,
      );

      expect(auth.options.account?.accountLinking?.enabled).toBe(true);
      expect(auth.options.account?.accountLinking?.trustedProviders).toEqual([
        "google",
      ]);
    });

    it("should configure Google social provider and emailOTP plugin", () => {
      expect(auth.options.socialProviders?.google).toEqual({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectURI: env.GOOGLE_CALLBACK_URL,
      });

      const otpPlugin = auth.options.plugins?.find((p) => p.id === "email-otp");
      expect(otpPlugin).toBeDefined();

      const otpOptions = (
        otpPlugin as unknown as { options?: Record<string, unknown> }
      )?.options;
      expect(otpOptions?.overrideDefaultEmailVerification).toBe(true);
      expect(otpOptions?.otpLength).toBe(6);
      expect(otpOptions?.expiresIn).toBe(60 * 5);
      expect(otpOptions?.sendVerificationOnSignUp).toBe(false);
    });
  });

  describe("Database Hook: user.create.after", () => {
    it("should upsert Customer record when created user has role CUSTOMER", async () => {
      const upsertSpy = vi
        .spyOn(prisma.customer, "upsert")
        .mockResolvedValue({} as any);

      const afterHook = auth.options.databaseHooks?.user?.create?.after;
      expect(afterHook).toBeDefined();
      if (!afterHook) throw new Error("user.create.after hook missing");

      await afterHook({
        id: "user-cust-1",
        email: "customer@example.com",
        role: UserRole.CUSTOMER,
      } as any);

      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy).toHaveBeenCalledWith({
        where: { userId: "user-cust-1" },
        create: { userId: "user-cust-1" },
        update: {},
      });
    });

    it("should not upsert Customer record when created user is not CUSTOMER", async () => {
      const upsertSpy = vi
        .spyOn(prisma.customer, "upsert")
        .mockResolvedValue({} as any);

      const afterHook = auth.options.databaseHooks?.user?.create?.after;
      if (!afterHook) throw new Error("user.create.after hook missing");

      await afterHook({
        id: "user-admin-1",
        email: "admin@example.com",
        role: UserRole.ADMIN,
      } as any);

      expect(upsertSpy).not.toHaveBeenCalled();
    });
  });

  describe("Database Hook: account.create.before", () => {
    it("should forbid linking Google account for non-CUSTOMER accounts (ADMIN and SUPER_ADMIN)", async () => {
      const beforeHook = auth.options.databaseHooks?.account?.create?.before;
      expect(beforeHook).toBeDefined();
      if (!beforeHook) throw new Error("account.create.before hook missing");

      // ADMIN role rejection
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.ADMIN,
      } as any);

      await expect(
        beforeHook({
          userId: "user-admin-1",
          providerId: "google",
        } as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        );
        expect(apiError.body?.message).toBe(
          "Access denied. Administrative accounts cannot link or use Google sign-in.",
        );
        return true;
      });

      // SUPER_ADMIN role rejection
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.SUPER_ADMIN,
      } as any);

      await expect(
        beforeHook({
          userId: "user-super-1",
          providerId: "google",
        } as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        );
        return true;
      });
    });

    it("should allow linking Google account for CUSTOMER accounts", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
      } as any);

      const beforeHook = auth.options.databaseHooks?.account?.create?.before;
      if (!beforeHook) throw new Error("account.create.before hook missing");

      await expect(
        beforeHook({
          userId: "user-cust-1",
          providerId: "google",
        } as any),
      ).resolves.not.toThrow();
    });

    it("should allow linking non-google provider accounts without querying user role", async () => {
      const findSpy = vi.spyOn(prisma.user, "findUnique");

      const beforeHook = auth.options.databaseHooks?.account?.create?.before;
      if (!beforeHook) throw new Error("account.create.before hook missing");

      await expect(
        beforeHook({
          userId: "user-1",
          providerId: "credential",
        } as any),
      ).resolves.not.toThrow();

      expect(findSpy).not.toHaveBeenCalled();
    });
  });

  describe("Database Hook: session.create.before", () => {
    it("should throw 401 INVALID_CREDENTIALS when user does not exist in database", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      expect(beforeHook).toBeDefined();
      if (!beforeHook) throw new Error("session.create.before hook missing");

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      await expect(
        beforeHook({ userId: "nonexistent-user" } as any, {} as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("UNAUTHORIZED");
        expect(apiError.statusCode).toBe(401);
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
        );
        expect(apiError.body?.message).toBe("Invalid email or password");
        return true;
      });
    });

    it("should throw 401 INVALID_CREDENTIALS when user is soft-deleted (anti-enumeration)", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        deletedAt: new Date("2026-01-01T00:00:00Z"),
        emailVerified: true,
      } as any);

      await expect(
        beforeHook({ userId: "deleted-user" } as any, {} as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("UNAUTHORIZED");
        expect(apiError.statusCode).toBe(401);
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
        );
        expect(apiError.body?.message).toBe("Invalid email or password");
        return true;
      });
    });

    it("should prioritize soft-deleted state over unverified and suspended states (Compound Precedence Priority 2)", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      // Compound state: soft-deleted + suspended + unverified
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
        status: UserStatus.SUSPENDED,
        deletedAt: new Date("2026-01-01T00:00:00Z"),
        emailVerified: false,
      } as any);

      await expect(
        beforeHook({ userId: "deleted-compound-user" } as any, {} as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("UNAUTHORIZED");
        expect(apiError.statusCode).toBe(401);
        // Soft delete MUST take precedence over ACCOUNT_SUSPENDED and EMAIL_NOT_VERIFIED
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
        );
        expect(apiError.body?.message).toBe("Invalid email or password");
        return true;
      });
    });

    it("should throw FORBIDDEN when administrative user (ADMIN or SUPER_ADMIN) attempts Google callback session creation", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");
      const googleCallbackUrl = new URL(env.GOOGLE_CALLBACK_URL);

      const mockContext = {
        request: {
          url: `${googleCallbackUrl.origin}${googleCallbackUrl.pathname}?code=xyz`,
        },
      };

      // ADMIN role rejection
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerified: true,
      } as any);

      await expect(
        beforeHook({ userId: "admin-user" } as any, mockContext as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        );
        expect(apiError.body?.message).toBe(
          "Access denied. Administrative accounts cannot use Google sign-in.",
        );
        return true;
      });

      // SUPER_ADMIN role rejection
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerified: true,
      } as any);

      await expect(
        beforeHook({ userId: "superadmin-user" } as any, mockContext as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
        );
        return true;
      });
    });

    it("should allow session creation check to proceed when request is not Google callback path", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerified: true,
      } as any);

      const mockContext = {
        request: {
          url: "http://localhost:5000/api/v1/auth/login",
        },
      };

      await expect(
        beforeHook(
          { userId: "admin-credential-user" } as any,
          mockContext as any,
        ),
      ).resolves.not.toThrow();
    });

    it("should throw 403 ACCOUNT_SUSPENDED when user account is SUSPENDED", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
        status: UserStatus.SUSPENDED,
        deletedAt: null,
        emailVerified: true,
      } as any);

      await expect(
        beforeHook({ userId: "user-suspended" } as any, {} as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        expect(apiError.body?.code).toBe(PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED);
        expect(apiError.body?.message).toBe(
          "Your account has been suspended. Please contact support.",
        );
        return true;
      });
    });

    it("should prioritize SUSPENDED status over unverified email state (Compound Precedence Priority 3)", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      // Compound state: suspended + unverified
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
        status: UserStatus.SUSPENDED,
        deletedAt: null,
        emailVerified: false,
      } as any);

      await expect(
        beforeHook({ userId: "user-suspended-unverified" } as any, {} as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        // Suspension MUST take precedence over EMAIL_NOT_VERIFIED
        expect(apiError.body?.code).toBe(PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED);
        expect(apiError.body?.message).toBe(
          "Your account has been suspended. Please contact support.",
        );
        return true;
      });
    });

    it("should throw 403 ACCOUNT_DEACTIVATED when user account is DEACTIVATED", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
        status: UserStatus.DEACTIVATED,
        deletedAt: null,
        emailVerified: true,
      } as any);

      await expect(
        beforeHook({ userId: "user-deactivated" } as any, {} as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED,
        );
        expect(apiError.body?.message).toBe(
          "Your account is deactivated. Please contact support.",
        );
        return true;
      });
    });

    it("should prioritize DEACTIVATED status over unverified email state (Compound Precedence Priority 3)", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      // Compound state: deactivated + unverified
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
        status: UserStatus.DEACTIVATED,
        deletedAt: null,
        emailVerified: false,
      } as any);

      await expect(
        beforeHook({ userId: "user-deactivated-unverified" } as any, {} as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        // Deactivation MUST take precedence over EMAIL_NOT_VERIFIED
        expect(apiError.body?.code).toBe(
          PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED,
        );
        expect(apiError.body?.message).toBe(
          "Your account is deactivated. Please contact support.",
        );
        return true;
      });
    });

    it("should throw 403 EMAIL_NOT_VERIFIED when active user email is not verified (Priority 4)", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerified: false,
      } as any);

      await expect(
        beforeHook({ userId: "user-unverified" } as any, {} as any),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(APIError);
        const apiError = err as APIError;
        expect(apiError.status).toBe("FORBIDDEN");
        expect(apiError.statusCode).toBe(403);
        expect(apiError.body?.code).toBe(PUBLIC_ERROR_CODES.EMAIL_NOT_VERIFIED);
        expect(apiError.body?.message).toBe(
          "Please verify your email before logging in",
        );
        return true;
      });
    });

    it("should allow session creation for active verified customer (Priority 5)", async () => {
      const beforeHook = auth.options.databaseHooks?.session?.create?.before;
      if (!beforeHook) throw new Error("session.create.before hook missing");

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerified: true,
      } as any);

      await expect(
        beforeHook({ userId: "user-valid" } as any, {} as any),
      ).resolves.not.toThrow();
    });
  });

  describe("Password Reset Callbacks", () => {
    it("should invalidate reset token and skip email dispatch for ineligible accounts", async () => {
      const deleteManySpy = vi
        .spyOn(prisma.verification, "deleteMany")
        .mockResolvedValue({ count: 1 });
      const sendEmailSpy = vi
        .spyOn(AuthMailer, "sendPasswordResetLink")
        .mockResolvedValue();

      // Suspended account
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        status: UserStatus.SUSPENDED,
        deletedAt: null,
        accounts: [{ id: "acc-1", password: "hashed-password" }],
      } as any);

      const sendResetPassword =
        auth.options.emailAndPassword?.sendResetPassword;
      expect(sendResetPassword).toBeDefined();
      if (!sendResetPassword) throw new Error("sendResetPassword missing");

      await sendResetPassword({
        user: { id: "user-1", email: "user@example.com" } as any,
        url: "https://liminal.test/reset?token=t123",
        token: "t123",
      });

      expect(deleteManySpy).toHaveBeenCalledWith({
        where: { identifier: "reset-password:t123" },
      });
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it("should invalidate reset token and skip email dispatch when user does not exist in database", async () => {
      const deleteManySpy = vi
        .spyOn(prisma.verification, "deleteMany")
        .mockResolvedValue({ count: 1 });
      const sendEmailSpy = vi
        .spyOn(AuthMailer, "sendPasswordResetLink")
        .mockResolvedValue();

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const sendResetPassword =
        auth.options.emailAndPassword?.sendResetPassword;
      if (!sendResetPassword) throw new Error("sendResetPassword missing");

      await sendResetPassword({
        user: { id: "user-not-found", email: "ghost@example.com" } as any,
        url: "https://liminal.test/reset?token=token-ghost",
        token: "token-ghost",
      });

      expect(deleteManySpy).toHaveBeenCalledWith({
        where: { identifier: "reset-password:token-ghost" },
      });
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it("should invalidate reset token and skip email dispatch when user is soft-deleted", async () => {
      const deleteManySpy = vi
        .spyOn(prisma.verification, "deleteMany")
        .mockResolvedValue({ count: 1 });
      const sendEmailSpy = vi
        .spyOn(AuthMailer, "sendPasswordResetLink")
        .mockResolvedValue();

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        status: UserStatus.ACTIVE,
        deletedAt: new Date("2026-01-01T00:00:00Z"),
        accounts: [{ id: "acc-1", password: "hashed-password" }],
      } as any);

      const sendResetPassword =
        auth.options.emailAndPassword?.sendResetPassword;
      if (!sendResetPassword) throw new Error("sendResetPassword missing");

      await sendResetPassword({
        user: { id: "user-deleted", email: "deleted@example.com" } as any,
        url: "https://liminal.test/reset?token=token-deleted",
        token: "token-deleted",
      });

      expect(deleteManySpy).toHaveBeenCalledWith({
        where: { identifier: "reset-password:token-deleted" },
      });
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it("should invalidate reset token and skip email dispatch when user has no credential password", async () => {
      const deleteManySpy = vi
        .spyOn(prisma.verification, "deleteMany")
        .mockResolvedValue({ count: 1 });
      const sendEmailSpy = vi
        .spyOn(AuthMailer, "sendPasswordResetLink")
        .mockResolvedValue();

      // Social OAuth account only (no local password)
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        status: UserStatus.ACTIVE,
        deletedAt: null,
        accounts: [{ id: "acc-google", password: null }],
      } as any);

      const sendResetPassword =
        auth.options.emailAndPassword?.sendResetPassword;
      if (!sendResetPassword) throw new Error("sendResetPassword missing");

      await sendResetPassword({
        user: { id: "user-social", email: "social@example.com" } as any,
        url: "https://liminal.test/reset?token=token-social",
        token: "token-social",
      });

      expect(deleteManySpy).toHaveBeenCalledWith({
        where: { identifier: "reset-password:token-social" },
      });
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it("should dispatch password reset link email using user's explicit name when provided", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        status: UserStatus.ACTIVE,
        deletedAt: null,
        accounts: [{ id: "acc-1", password: "hashed-password" }],
      } as any);

      const sendEmailSpy = vi
        .spyOn(AuthMailer, "sendPasswordResetLink")
        .mockResolvedValue();

      const sendResetPassword =
        auth.options.emailAndPassword?.sendResetPassword;
      if (!sendResetPassword) throw new Error("sendResetPassword missing");

      await sendResetPassword({
        user: {
          id: "user-eligible",
          name: "Farhan Ahmed",
          email: "farhan@example.com",
        } as any,
        url: "https://liminal.test/reset?token=t789",
        token: "t789",
      });

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith({
        email: "farhan@example.com",
        name: "Farhan Ahmed",
        resetUrl: "https://liminal.test/reset?token=t789",
      });
    });

    it("should dispatch password reset link email for eligible active accounts with fallback name", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        status: UserStatus.ACTIVE,
        deletedAt: null,
        accounts: [{ id: "acc-1", password: "hashed-password" }],
      } as any);

      const sendEmailSpy = vi
        .spyOn(AuthMailer, "sendPasswordResetLink")
        .mockResolvedValue();

      const sendResetPassword =
        auth.options.emailAndPassword?.sendResetPassword;
      if (!sendResetPassword) throw new Error("sendResetPassword missing");

      await sendResetPassword({
        user: {
          id: "user-eligible",
          email: "eligible@example.com",
        } as any,
        url: "https://liminal.test/reset?token=t456",
        token: "t456",
      });

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith({
        email: "eligible@example.com",
        name: "Customer",
        resetUrl: "https://liminal.test/reset?token=t456",
      });
    });

    it("should reset needPasswordChange flag on successful password reset", async () => {
      const updateSpy = vi
        .spyOn(prisma.user, "update")
        .mockResolvedValue({} as any);

      const onPasswordReset = auth.options.emailAndPassword?.onPasswordReset;
      expect(onPasswordReset).toBeDefined();
      if (!onPasswordReset) throw new Error("onPasswordReset missing");

      await onPasswordReset({
        user: { id: "user-pw-reset" } as any,
      });

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: "user-pw-reset" },
        data: { needPasswordChange: false },
      });
    });
  });

  describe("emailOTP Plugin: sendVerificationOTP Hook", () => {
    it("should dispatch verification OTP email to unverified user with fallback name", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        name: "",
        emailVerified: false,
      } as any);

      const sendOtpSpy = vi
        .spyOn(AuthMailer, "sendVerificationOtp")
        .mockResolvedValue();

      const otpPlugin = auth.options.plugins?.find((p) => p.id === "email-otp");
      const otpOptions = (
        otpPlugin as unknown as {
          options?: {
            sendVerificationOTP?: (params: {
              email: string;
              otp: string;
              type: string;
            }) => Promise<void>;
          };
        }
      )?.options;

      expect(otpOptions?.sendVerificationOTP).toBeDefined();
      if (!otpOptions?.sendVerificationOTP) {
        throw new Error("sendVerificationOTP missing");
      }

      await otpOptions.sendVerificationOTP({
        email: "jane@example.com",
        otp: "123456",
        type: "email-verification",
      });

      expect(sendOtpSpy).toHaveBeenCalledTimes(1);
      expect(sendOtpSpy).toHaveBeenCalledWith({
        email: "jane@example.com",
        name: "Customer",
        otp: "123456",
      });
    });

    it("should dispatch verification OTP email using explicit user name when provided", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        name: "Jane Doe",
        emailVerified: false,
      } as any);

      const sendOtpSpy = vi
        .spyOn(AuthMailer, "sendVerificationOtp")
        .mockResolvedValue();

      const otpPlugin = auth.options.plugins?.find((p) => p.id === "email-otp");
      const otpOptions = (
        otpPlugin as unknown as {
          options?: {
            sendVerificationOTP?: (params: {
              email: string;
              otp: string;
              type: string;
            }) => Promise<void>;
          };
        }
      )?.options;

      if (!otpOptions?.sendVerificationOTP) {
        throw new Error("sendVerificationOTP missing");
      }

      await otpOptions.sendVerificationOTP({
        email: "jane.doe@example.com",
        otp: "654321",
        type: "email-verification",
      });

      expect(sendOtpSpy).toHaveBeenCalledTimes(1);
      expect(sendOtpSpy).toHaveBeenCalledWith({
        email: "jane.doe@example.com",
        name: "Jane Doe",
        otp: "654321",
      });
    });

    it("should not dispatch OTP if user does not exist in database", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const sendOtpSpy = vi
        .spyOn(AuthMailer, "sendVerificationOtp")
        .mockResolvedValue();

      const otpPlugin = auth.options.plugins?.find((p) => p.id === "email-otp");
      const otpOptions = (
        otpPlugin as unknown as {
          options?: {
            sendVerificationOTP?: (params: {
              email: string;
              otp: string;
              type: string;
            }) => Promise<void>;
          };
        }
      )?.options;

      if (!otpOptions?.sendVerificationOTP) {
        throw new Error("sendVerificationOTP missing");
      }

      await otpOptions.sendVerificationOTP({
        email: "ghost@example.com",
        otp: "123456",
        type: "email-verification",
      });

      expect(sendOtpSpy).not.toHaveBeenCalled();
    });

    it("should not dispatch OTP if user is already verified", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        name: "Verified User",
        emailVerified: true,
      } as any);

      const sendOtpSpy = vi
        .spyOn(AuthMailer, "sendVerificationOtp")
        .mockResolvedValue();

      const otpPlugin = auth.options.plugins?.find((p) => p.id === "email-otp");
      const otpOptions = (
        otpPlugin as unknown as {
          options?: {
            sendVerificationOTP?: (params: {
              email: string;
              otp: string;
              type: string;
            }) => Promise<void>;
          };
        }
      )?.options;

      if (!otpOptions?.sendVerificationOTP) {
        throw new Error("sendVerificationOTP missing");
      }

      await otpOptions.sendVerificationOTP({
        email: "verified@example.com",
        otp: "123456",
        type: "email-verification",
      });

      expect(sendOtpSpy).not.toHaveBeenCalled();
    });

    it("should ignore non-email-verification OTP types", async () => {
      const findSpy = vi.spyOn(prisma.user, "findUnique");
      const sendOtpSpy = vi
        .spyOn(AuthMailer, "sendVerificationOtp")
        .mockResolvedValue();

      const otpPlugin = auth.options.plugins?.find((p) => p.id === "email-otp");
      const otpOptions = (
        otpPlugin as unknown as {
          options?: {
            sendVerificationOTP?: (params: {
              email: string;
              otp: string;
              type: string;
            }) => Promise<void>;
          };
        }
      )?.options;

      if (!otpOptions?.sendVerificationOTP) {
        throw new Error("sendVerificationOTP missing");
      }

      await otpOptions.sendVerificationOTP({
        email: "user@example.com",
        otp: "123456",
        type: "other-type",
      });

      expect(findSpy).not.toHaveBeenCalled();
      expect(sendOtpSpy).not.toHaveBeenCalled();
    });
  });
});
