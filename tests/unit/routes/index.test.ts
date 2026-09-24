import { describe, expect, it } from "vitest";
import { AdminRoutes } from "../../../src/app/modules/admin/admin.routes.js";
import { AuthRoutes } from "../../../src/app/modules/auth/auth.routes.js";
import { CustomerRoutes } from "../../../src/app/modules/customer/customer.routes.js";
import { RootRouter } from "../../../src/app/routes/index.js";

interface ExpressLayer {
  match: (path: string) => boolean;
  handle: unknown;
}

describe("RootRouter Unit Tests", () => {
  it("should mount all module routers in stack", () => {
    expect(RootRouter.stack).toBeDefined();
    expect(RootRouter.stack.length).toBe(3);
  });

  it("should mount AuthRoutes under /auth", () => {
    const authLayer = RootRouter.stack.find((layer: unknown) => {
      const l = layer as ExpressLayer;
      return (
        typeof l.match === "function" &&
        l.match("/auth") &&
        l.handle === AuthRoutes
      );
    });

    expect(authLayer).toBeDefined();
  });

  it("should mount AdminRoutes under /admins per DEC-027", () => {
    const adminLayer = RootRouter.stack.find((layer: unknown) => {
      const l = layer as ExpressLayer;
      return (
        typeof l.match === "function" &&
        l.match("/admins") &&
        l.handle === AdminRoutes
      );
    });

    expect(adminLayer).toBeDefined();
  });

  it("should mount CustomerRoutes under /customers per DEC-027", () => {
    const customerLayer = RootRouter.stack.find((layer: unknown) => {
      const l = layer as ExpressLayer;
      return (
        typeof l.match === "function" &&
        l.match("/customers") &&
        l.handle === CustomerRoutes
      );
    });

    expect(customerLayer).toBeDefined();
  });
});
