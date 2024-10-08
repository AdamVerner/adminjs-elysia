import type {
  ActionRequest,
  ApiController,
  AppController,
  CurrentAdmin,
} from "adminjs";
import { AdminJS } from "adminjs";
import { Router as AdminJSRouter } from "adminjs";
import type { Context } from "elysia";
import { Elysia } from "elysia";
import { createResponse } from "node-mocks-http";

type RouterType = Elysia<string>;

// has to be here, otherwise TSC will not export it into type declarations.
// idk how to fix it...
export { AdminJS };

export const buildAssets = (
  admin: AdminJS,
  assets: (typeof AdminJSRouter)["assets"],
  routes: (typeof AdminJSRouter)["routes"],
  router: RouterType,
): void => {
  // copied from adminjs-express
  // Note: We want components.bundle.js to be globally available. In production it is served as a .js asset, meanwhile
  // in local environments it's a route with "bundleComponents" action assigned.
  const componentBundlerRoute = routes.find(
    (r) => r.action === "bundleComponents",
  );
  if (componentBundlerRoute) {
    buildRoute(componentBundlerRoute, router, admin);
  }

  assets.forEach((asset) => {
    router.get(asset.path, () => Bun.file(asset.src));
  });
};

export const buildRoute = (
  route: (typeof AdminJSRouter)["routes"][number],
  router: RouterType,
  admin: AdminJS,
  adminGetter?: (ctx: Context) => CurrentAdmin,
) => {
  const elysiaPath = route.path.replace(/{/g, ":").replace(/}/g, ""); //change routes from {recordId} to :recordId
  const handler = routeHandler(admin, route, adminGetter);
  router.route(route.method, elysiaPath, handler);
};

export const buildRoutes = (
  admin: AdminJS,
  routes: (typeof AdminJSRouter)["routes"],
  router: RouterType,
  adminGetter?: (ctx: Context) => CurrentAdmin,
): void => {
  routes.forEach((route) => buildRoute(route, router, admin, adminGetter));
};

type AdminJSController = typeof ApiController | typeof AppController;

const routeHandler =
  (
    admin: AdminJS,
    route: (typeof AdminJSRouter)["routes"][0],
    adminGetter?: (ctx: Context) => CurrentAdmin,
  ) =>
  async (ctx: Context) => {
    let { params, query, request, set, body } = ctx;
    const currentAdmin = adminGetter?.(ctx);

    const controller = new (route.Controller as AdminJSController)(
      { admin },
      currentAdmin,
    );

    let payload = {};
    if (request.method.toUpperCase() === "POST") {
      payload = {
        ...(body || {}),
        // ...(formData?.files || {}),
      };
    }

    const actionRequest: ActionRequest = {
      ...request,
      payload,
      params,
      query,
      method: request.method.toLowerCase() as "get" | "post",
    };

    const response = createResponse();
    const html = await controller[route.action as keyof typeof controller](
      actionRequest,
      response,
    );

    if (html) {
      set.headers["Content-Type"] =
        route?.contentType ?? "text/html;charset=utf-8";
      return html;
    }

    set.status = response.statusCode || 200;
    return response._getData();
  };

export type RouterOptions = {};

export const buildRouter = async (
  admin: AdminJS,
  options: RouterOptions,
): Promise<RouterType> => {
  // initialize bundler
  await admin.initialize();
  await admin.watch();

  // create router
  const { routes, assets } = AdminJSRouter;
  const router: RouterType = new Elysia({ prefix: admin.options.rootPath });

  // add all necessary routes
  buildAssets(admin, assets, routes, router);
  buildRoutes(admin, routes, router);

  return router;
};
