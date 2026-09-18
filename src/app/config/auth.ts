import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { UserRole, UserStatus } from "../../generated/prisma/enums.js";
import { PUBLIC_ERROR_CODES } from "../errors/errorCodes.js";
import { AuthMailer } from "../shared/email/mailers/auth.mailer.js";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

// Central Better Auth authentication and lifecycle configuration
const auth = betterAuth({
  // Core Infrastructure & Server Context
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",
  trustedOrigins: [env.FRONTEND_URL],

  // Database Adapter & Data Lifecycle Hooks
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (user.role === UserRole.CUSTOMER) {
            await prisma.customer.upsert({
              where: { userId: user.id },
              create: { userId: user.id },
              update: {},
            });
          }
        },
      },
    },
    account: {
      create: {
        before: async (account) => {
          if (account.providerId === "google") {
            const user = await prisma.user.findUnique({
              where: { id: account.userId },
              select: { role: true },
            });

            if (user && user.role !== UserRole.CUSTOMER) {
              throw new APIError("FORBIDDEN", {
                code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
                message:
                  "Access denied. Administrative accounts cannot link or use Google sign-in.",
              });
            }
          }
        },
      },
    },
    session: {
      create: {
        before: async (session, context) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
              role: true,
              status: true,
              deletedAt: true,
              emailVerified: true,
            },
          });

          if (!user || user.deletedAt !== null) {
            throw new APIError("UNAUTHORIZED", {
              code: PUBLIC_ERROR_CODES.INVALID_CREDENTIALS,
              message: "Invalid email or password",
            });
          }

          // Path guard for Google callback
          const requestPath = context?.request
            ? new URL(context.request.url).pathname
            : undefined;

          const googleCallbackPath = new URL(env.GOOGLE_CALLBACK_URL).pathname;

          if (
            requestPath === googleCallbackPath &&
            user.role !== UserRole.CUSTOMER
          ) {
            throw new APIError("FORBIDDEN", {
              code: PUBLIC_ERROR_CODES.FORBIDDEN_ROLE_ACCESS,
              message:
                "Access denied. Administrative accounts cannot use Google sign-in.",
            });
          }

          if (user.status === UserStatus.SUSPENDED) {
            throw new APIError("FORBIDDEN", {
              code: PUBLIC_ERROR_CODES.ACCOUNT_SUSPENDED,
              message:
                "Your account has been suspended. Please contact support.",
            });
          }

          if (user.status === UserStatus.DEACTIVATED) {
            throw new APIError("FORBIDDEN", {
              code: PUBLIC_ERROR_CODES.ACCOUNT_DEACTIVATED,
              message: "Your account is deactivated. Please contact support.",
            });
          }

          if (!user.emailVerified) {
            throw new APIError("FORBIDDEN", {
              code: PUBLIC_ERROR_CODES.EMAIL_NOT_VERIFIED,
              message: "Please verify your email before logging in",
            });
          }
        },
      },
    },
  },

  // User Entity Schema Extensions
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: UserRole.CUSTOMER,
        input: false, // Prevent client self-assignment of role
      },
      status: {
        type: "string",
        required: false,
        defaultValue: UserStatus.ACTIVE,
        input: false, // Prevent client self-assignment of status
      },
      needPasswordChange: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false, // Internal flag; cannot be set by client
      },
      deletedAt: {
        type: "date",
        required: false,
        input: false, // Managed via soft-delete lifecycle; cannot be set by client
      },
    },
  },

  // Primary Authentication Strategies
  emailAndPassword: {
    enabled: true,
    autoSignIn: false, // Do not auto sign-in unverified user on registration
    requireEmailVerification: false, // Enforced centrally via databaseHooks for compound-state precedence
    resetPasswordTokenExpiresIn: 60 * 15, // 15 minutes token lifetime
    revokeSessionsOnPasswordReset: true, // Invalidate all active user sessions on password reset
    async sendResetPassword({ user, url }) {
      // Check user lifecycle and credential status before dispatching email
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          status: true,
          deletedAt: true,
          accounts: {
            where: { providerId: "credential" },
            select: { id: true, password: true },
          },
        },
      });

      // Ignore soft-deleted or non-active accounts without leaking status
      if (
        !dbUser ||
        dbUser.deletedAt !== null ||
        dbUser.status !== UserStatus.ACTIVE
      ) {
        return;
      }

      // Google-only accounts check - do not dispatch reset link if no password credential
      const credentialAccount = dbUser.accounts[0];
      if (!credentialAccount || !credentialAccount.password) {
        return;
      }

      await AuthMailer.sendPasswordResetLink({
        email: user.email,
        name: user.name || "Customer",
        resetUrl: url,
      });
    },

    async onPasswordReset({ user }) {
      // Clear needPasswordChange flag upon successful password reset
      await prisma.user.update({
        where: { id: user.id },
        data: { needPasswordChange: false },
      });
    },
  },

  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
  },

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectURI: env.GOOGLE_CALLBACK_URL,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  // Session Lifecycle & Cookie Security Transport
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day sliding renewal
    cookieCache: {
      enabled: true,
      maxAge: 15 * 60, // 15 minutes in seconds
    },
  },

  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: env.NODE_ENV === "production",
        },
      },
    },
  },

  // Modular Extensions & Plugins
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      otpLength: 6,
      expiresIn: 5 * 60, // 5 minutes in seconds
      sendVerificationOnSignUp: false,
      async sendVerificationOTP({ email, otp, type }) {
        // Dispatch branded OTP email for unverified user accounts
        if (type === "email-verification") {
          const user = await prisma.user.findUnique({
            where: { email },
            select: { name: true, emailVerified: true },
          });

          if (user && !user.emailVerified) {
            await AuthMailer.sendVerificationOtp({
              email,
              name: user.name,
              otp,
            });
          }
        }
      },
    }),
  ],
});

export type Auth = typeof auth;
export { auth };
