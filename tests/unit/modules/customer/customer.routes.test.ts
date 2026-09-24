import type { RequestHandler } from "express";
import { describe, expect, it } from "vitest";
import { authGuard } from "../../../../src/app/middleware/authGuard.js";
import { CustomerRoutes } from "../../../../src/app/modules/customer/customer.routes.js";

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

describe("CustomerRoutes Unit Tests", () => {
  const findRoute = (
    path: string,
    method?: string,
  ): RouteLayer["route"] | undefined => {
    const layer = CustomerRoutes.stack.find(
      (l: RouteLayer) =>
        l.route?.path === path &&
        (method ? l.route?.methods?.[method] === true : true),
    );
    return layer?.route;
  };

  it("should configure POST /register route with validation and controller handlers", () => {
    const route = findRoute("/register", "post");

    expect(route).toBeDefined();
    expect(route?.methods?.post).toBe(true);

    // Method exclusivity
    expect(route?.methods?.get).toBeUndefined();
    expect(route?.methods?.put).toBeUndefined();
    expect(route?.methods?.delete).toBeUndefined();

    // Guard and middleware stack assertions
    expect(route?.stack?.length).toBe(2);
  });

  it("should configure GET /:id route with authGuard, validation, and controller handlers", () => {
    const route = findRoute("/:id", "get");

    expect(route).toBeDefined();
    expect(route?.methods?.get).toBe(true);

    // Method exclusivity
    expect(route?.methods?.post).toBeUndefined();
    expect(route?.methods?.put).toBeUndefined();
    expect(route?.methods?.delete).toBeUndefined();

    // Guard and middleware stack assertions
    expect(route?.stack?.length).toBe(3);
    expect(route?.stack?.[0]?.handle).toBe(authGuard);
  });
});
