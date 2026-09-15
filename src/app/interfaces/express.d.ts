import type { auth } from "../config/auth.js";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

// Express request and locals ambient type augmentation
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: AuthSession;
    }

    interface Locals {
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
      user?: AuthUser;
      session?: AuthSession;
    }
  }
}

