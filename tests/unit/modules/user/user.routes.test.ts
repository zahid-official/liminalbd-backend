import type { RequestHandler } from "express";
import { describe, expect, it } from "vitest";
import { authGuard } from "../../../../src/app/middleware/authGuard.js";
import { UserRoutes } from "../../../../src/app/modules/user/user.routes.js";

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

describe("UserRoutes Unit Tests", () => {
  const findRoute = (
    path: string,
    method?: string,
  ): RouteLayer["route"] | undefined => {
    const layer = UserRoutes.stack.find(
      (l: RouteLayer) =>
        l.route?.path === path &&
        (method ? l.route?.methods?.[method] === true : true),
    );
    return layer?.route;
  };

  it("should configure GET /profile route with authGuard and controller handler", () => {
    const route = findRoute("/profile", "get");

    expect(route).toBeDefined();
    expect(route?.methods?.get).toBe(true);

    // Method exclusivity
    expect(route?.methods?.post).toBeUndefined();
    expect(route?.methods?.put).toBeUndefined();
    expect(route?.methods?.delete).toBeUndefined();

    // Guard and middleware stack assertions
    expect(route?.stack?.length).toBe(2);
    expect(route?.stack?.[0]?.handle).toBe(authGuard);
  });

  it("should configure PATCH /profile route with authGuard, validation, and controller handler", () => {
    const route = findRoute("/profile", "patch");

    expect(route).toBeDefined();
    expect(route?.methods?.patch).toBe(true);

    // Method exclusivity
    expect(route?.methods?.get).toBeUndefined();
    expect(route?.methods?.post).toBeUndefined();
    expect(route?.methods?.put).toBeUndefined();
    expect(route?.methods?.delete).toBeUndefined();

    // Guard and middleware stack assertions
    expect(route?.stack?.length).toBe(3);
    expect(route?.stack?.[0]?.handle).toBe(authGuard);
  });
});
