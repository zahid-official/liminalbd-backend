import type { RequestHandler } from "express";
import { describe, expect, it } from "vitest";
import { authGuard } from "../../../../src/app/middleware/authGuard.js";
import { AdminRoutes } from "../../../../src/app/modules/admin/admin.routes.js";

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

describe("AdminRoutes Unit Tests", () => {
  const findRoute = (
    path: string,
    method?: string,
  ): RouteLayer["route"] | undefined => {
    const layer = AdminRoutes.stack.find(
      (l: RouteLayer) =>
        l.route?.path === path &&
        (method ? l.route?.methods?.[method] === true : true),
    );
    return layer?.route;
  };

  it("should configure POST / route with authGuard, rbacGuard, validation, and controller handlers", () => {
    const route = findRoute("/", "post");

    expect(route).toBeDefined();
    expect(route?.methods?.post).toBe(true);

    // Method exclusivity
    expect(route?.methods?.get).toBeUndefined();
    expect(route?.methods?.put).toBeUndefined();
    expect(route?.methods?.delete).toBeUndefined();

    // Guard and middleware stack assertions
    expect(route?.stack?.length).toBe(4);
    expect(route?.stack?.[0]?.handle).toBe(authGuard);
  });

  it("should configure GET / route with authGuard, rbacGuard, validation, and controller handlers", () => {
    const route = findRoute("/", "get");

    expect(route).toBeDefined();
    expect(route?.methods?.get).toBe(true);

    // Method exclusivity
    expect(route?.methods?.post).toBeUndefined();
    expect(route?.methods?.put).toBeUndefined();
    expect(route?.methods?.delete).toBeUndefined();

    // Guard and middleware stack assertions
    expect(route?.stack?.length).toBe(4);
    expect(route?.stack?.[0]?.handle).toBe(authGuard);
  });

  it("should configure PATCH /:id route with authGuard, rbacGuard, validation, and controller handlers", () => {
    const route = findRoute("/:id", "patch");

    expect(route).toBeDefined();
    expect(route?.methods?.patch).toBe(true);

    // Method exclusivity
    expect(route?.methods?.get).toBeUndefined();
    expect(route?.methods?.post).toBeUndefined();
    expect(route?.methods?.put).toBeUndefined();
    expect(route?.methods?.delete).toBeUndefined();

    // Guard and middleware stack assertions
    expect(route?.stack?.length).toBe(4);
    expect(route?.stack?.[0]?.handle).toBe(authGuard);
  });
});
