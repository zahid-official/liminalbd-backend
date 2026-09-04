import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.routes.js";

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
];

// Mount module routes onto root router
moduleRoutes.forEach((moduleRoute: ModuleRoute) => {
  router.use(moduleRoute.path, moduleRoute.route);
});

export { router as RootRouter };
