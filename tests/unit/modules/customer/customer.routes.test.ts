import { describe, expect, it } from "vitest";
import { CustomerRoutes } from "../../../../src/app/modules/customer/customer.routes.js";

describe("CustomerRoutes Unit Tests", () => {
  it("should configure POST /register route with validation and controller handlers", () => {
    const registerLayer = CustomerRoutes.stack.find(
      (layer: { route?: { path?: string } }) =>
        layer.route?.path === "/register",
    );

    expect(registerLayer).toBeDefined();

    const route = registerLayer?.route as unknown as {
      methods?: Record<string, boolean>;
      stack?: unknown[];
    };
    expect(route).toBeDefined();
    expect(route.methods?.post).toBe(true);
    expect(route.stack?.length).toBe(2);
  });
});
