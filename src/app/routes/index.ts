import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.routes.js";
import { AdminRoutes } from "../modules/admin/admin.routes.js";
import { CustomerRoutes } from "../modules/customer/customer.routes.js";

// Module route interface
interface ModuleRoute {
  path: string;
  route: Router;
}

// Initialize Express router
const router: Router = Router();

// Application module routes registry
const moduleRoutes: ModuleRoute[] = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/admin",
    route: AdminRoutes,
  },
  {
    path: "/customer",
    route: CustomerRoutes,
  },
];

// Mount module routes onto root router
moduleRoutes.forEach((moduleRoute: ModuleRoute) => {
  router.use(moduleRoute.path, moduleRoute.route);
});

// Export root router
export const RootRouter = router;
