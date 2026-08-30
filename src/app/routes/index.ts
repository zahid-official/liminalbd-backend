import { Router } from "express";

interface ModuleRoute {
  path: string;
  route: Router;
}

// Initialize router
const router: Router = Router();

// Module routes
const moduleRoutes: ModuleRoute[] = [];

// Mount all feature module routers onto the root router
moduleRoutes.forEach((moduleRoute: ModuleRoute) => {
  router.use(moduleRoute.path, moduleRoute.route);
});

// Root router
const RootRouter: Router = router;
export default RootRouter;
