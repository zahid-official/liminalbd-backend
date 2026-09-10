import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins";
import { UserRole, UserStatus } from "../../generated/prisma/enums.js";
import { AuthMailer } from "../shared/email/mailers/auth.mailer.js";
import { prisma } from "./prisma.js";
import { env } from "./env.js";

// Central Better Auth authentication and lifecycle configuration
const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/v1/auth",
  trustedOrigins: [env.FRONTEND_URL],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day sliding renewal
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

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 5 * 60, // 5 minutes in seconds
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
});

export type Auth = typeof auth;
export { auth };
