import { describe, expect, it } from "vitest";
import { AuthRoutes } from "../../../../src/app/modules/auth/auth.routes.js";

interface RouteLayer {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: unknown[];
  };
}

describe("AuthRoutes Unit Tests", () => {
  const findRoute = (path: string): RouteLayer["route"] | undefined => {
    const layer = AuthRoutes.stack.find(
      (l: RouteLayer) => l.route?.path === path,
    );
    return layer?.route;
  };

  it("should register exactly 14 route layers on the auth router", () => {
    expect(AuthRoutes.stack.length).toBe(14);
  });

  describe("Public Authentication Routes", () => {
    it("should configure POST /send-verification-otp route with validation and controller handlers", () => {
      const route = findRoute("/send-verification-otp");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /verify-email-otp route with validation and controller handlers", () => {
      const route = findRoute("/verify-email-otp");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /login route with validation and controller handlers", () => {
      const route = findRoute("/login");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.methods?.get).toBeUndefined();
      expect(route?.methods?.put).toBeUndefined();
      expect(route?.methods?.delete).toBeUndefined();
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /login/google route with validation and controller handlers", () => {
      const route = findRoute("/login/google");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.methods?.get).toBeUndefined();
      expect(route?.methods?.put).toBeUndefined();
      expect(route?.methods?.delete).toBeUndefined();
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure GET /callback/google route with Better Auth node handler", () => {
      const route = findRoute("/callback/google");
      expect(route).toBeDefined();
      expect(route?.methods?.get).toBe(true);
      expect(route?.methods?.post).toBeUndefined();
      expect(route?.methods?.put).toBeUndefined();
      expect(route?.methods?.delete).toBeUndefined();
      expect(route?.stack?.length).toBe(1);
    });

    it("should configure GET /error route with controller handler", () => {
      const route = findRoute("/error");
      expect(route).toBeDefined();
      expect(route?.methods?.get).toBe(true);
      expect(route?.methods?.post).toBeUndefined();
      expect(route?.methods?.put).toBeUndefined();
      expect(route?.methods?.delete).toBeUndefined();
      expect(route?.stack?.length).toBe(1);
    });

    it("should configure POST /forgot-password route with validation and controller handlers", () => {
      const route = findRoute("/forgot-password");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /reset-password route with validation and controller handlers", () => {
      const route = findRoute("/reset-password");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(2);
    });
  });

  describe("Protected Authentication Routes (authGuard enforced)", () => {
    it("should configure POST /link/google route with authGuard, validation, and controller handlers", () => {
      const route = findRoute("/link/google");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(3);
    });

    it("should configure POST /unlink/google route with authGuard and controller handlers", () => {
      const route = findRoute("/unlink/google");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /change-password route with authGuard, validation, and controller handlers", () => {
      const route = findRoute("/change-password");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(3);
    });

    it("should configure POST /set-password route with authGuard, validation, and controller handlers", () => {
      const route = findRoute("/set-password");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(3);
    });

    it("should configure POST /logout route with authGuard and controller handlers", () => {
      const route = findRoute("/logout");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /logout-all route with authGuard and controller handlers", () => {
      const route = findRoute("/logout-all");
      expect(route).toBeDefined();
      expect(route?.methods?.post).toBe(true);
      expect(route?.stack?.length).toBe(2);
    });
  });
});
