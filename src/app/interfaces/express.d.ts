import type { AuthSession, AuthUser } from "../modules/auth/auth.interface.js";

// Express locals ambient type augmentation for validated input and authenticated context
declare global {
  namespace Express {
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
