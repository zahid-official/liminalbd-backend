import type { RequestHandler } from "express";
import { describe, expect, it } from "vitest";
import { authGuard } from "../../../../src/app/middleware/authGuard.js";
import { AuthRoutes } from "../../../../src/app/modules/auth/auth.routes.js";

interface RouteStackLayer {
  name: string;
  handle: RequestHandler;
}

interface RouteLayer {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack?: RouteStackLayer[];
  };
}

describe("AuthRoutes Unit Tests", () => {
  const findRoute = (path: string): RouteLayer["route"] | undefined => {
    const layer = AuthRoutes.stack.find(
      (l: RouteLayer) => l.route?.path === path,
    );
    return layer?.route;
  };

  const assertExclusiveMethod = (
    route: RouteLayer["route"],
    expectedMethod: "post" | "get",
  ) => {
    expect(route).toBeDefined();
    expect(route?.methods?.[expectedMethod]).toBe(true);
    const forbiddenMethods = ["get", "post", "put", "delete"].filter(
      (m) => m !== expectedMethod,
    );
    for (const method of forbiddenMethods) {
      expect(route?.methods?.[method]).toBeUndefined();
    }
  };

  const assertProtectedWithAuthGuard = (route: RouteLayer["route"]) => {
    expect(route).toBeDefined();
    expect(route?.stack?.[0]?.handle).toBe(authGuard);
  };

  it("should register exactly 14 route layers on the auth router", () => {
    expect(AuthRoutes.stack.length).toBe(14);
  });

  describe("Public Authentication Routes", () => {
    it("should configure POST /send-verification-otp route with validation and controller handlers", () => {
      const route = findRoute("/send-verification-otp");
      assertExclusiveMethod(route, "post");
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /verify-email-otp route with validation and controller handlers", () => {
      const route = findRoute("/verify-email-otp");
      assertExclusiveMethod(route, "post");
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /login route with validation and controller handlers", () => {
      const route = findRoute("/login");
      assertExclusiveMethod(route, "post");
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /login/google route with validation and controller handlers", () => {
      const route = findRoute("/login/google");
      assertExclusiveMethod(route, "post");
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure GET /callback/google route with Better Auth node handler", () => {
      const route = findRoute("/callback/google");
      assertExclusiveMethod(route, "get");
      expect(route?.stack?.length).toBe(1);
    });

    it("should configure GET /error route with controller handler", () => {
      const route = findRoute("/error");
      assertExclusiveMethod(route, "get");
      expect(route?.stack?.length).toBe(1);
    });

    it("should configure POST /forgot-password route with validation and controller handlers", () => {
      const route = findRoute("/forgot-password");
      assertExclusiveMethod(route, "post");
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /reset-password route with validation and controller handlers", () => {
      const route = findRoute("/reset-password");
      assertExclusiveMethod(route, "post");
      expect(route?.stack?.length).toBe(2);
    });
  });

  describe("Protected Authentication Routes (authGuard enforced)", () => {
    it("should configure POST /link/google route with authGuard, validation, and controller handlers", () => {
      const route = findRoute("/link/google");
      assertExclusiveMethod(route, "post");
      assertProtectedWithAuthGuard(route);
      expect(route?.stack?.length).toBe(3);
    });

    it("should configure POST /unlink/google route with authGuard and controller handlers", () => {
      const route = findRoute("/unlink/google");
      assertExclusiveMethod(route, "post");
      assertProtectedWithAuthGuard(route);
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /change-password route with authGuard, validation, and controller handlers", () => {
      const route = findRoute("/change-password");
      assertExclusiveMethod(route, "post");
      assertProtectedWithAuthGuard(route);
      expect(route?.stack?.length).toBe(3);
    });

    it("should configure POST /set-password route with authGuard, validation, and controller handlers", () => {
      const route = findRoute("/set-password");
      assertExclusiveMethod(route, "post");
      assertProtectedWithAuthGuard(route);
      expect(route?.stack?.length).toBe(3);
    });

    it("should configure POST /logout route with authGuard and controller handlers", () => {
      const route = findRoute("/logout");
      assertExclusiveMethod(route, "post");
      assertProtectedWithAuthGuard(route);
      expect(route?.stack?.length).toBe(2);
    });

    it("should configure POST /logout-all route with authGuard and controller handlers", () => {
      const route = findRoute("/logout-all");
      assertExclusiveMethod(route, "post");
      assertProtectedWithAuthGuard(route);
      expect(route?.stack?.length).toBe(2);
    });
  });
});
