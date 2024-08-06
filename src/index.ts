import type { ActionRequest, ApiController, AppController } from "adminjs";
import { AdminJS } from "adminjs";
import { Router as AdminJSRouter } from "adminjs";
import type { Context } from "elysia";
import { Elysia } from "elysia";
import { createResponse } from "node-mocks-http";

type RouterType = Elysia<string>;

const buildAssets = (
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

const buildRoute = (
  route: (typeof AdminJSRouter)["routes"][number],
  router: RouterType,
  admin: AdminJS,
) => {
  const elysiaPath = route.path.replace(/{/g, ":").replace(/}/g, ""); //change routes from {recordId} to :recordId
  const handler = routeHandler(admin, route);
  router.route(route.method, elysiaPath, handler);
};

const buildRoutes = (
  admin: AdminJS,
  routes: (typeof AdminJSRouter)["routes"],
  router: RouterType,
): void => {
  routes.forEach((route) => buildRoute(route, router, admin));
};

type AdminJSController = typeof ApiController | typeof AppController;

const routeHandler =
  (admin: AdminJS, route: (typeof AdminJSRouter)["routes"][0]) =>
  async ({ params, query, request, set, body }: Context) => {
    const currentAdmin = undefined;

    // todo authentication
    // const currentAdmin: CurrentAdmin = { email: 'current@admin.example' };

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

export const buildRouter = async (
  admin: AdminJS,
  options: { logErrors: boolean; logAccess: boolean },
): Promise<RouterType> => {
  // initialize bundler
  await admin.initialize();
  await admin.watch();

  // create router
  const { routes, assets } = AdminJSRouter;
  const router: RouterType = new Elysia({ prefix: admin.options.rootPath });

  //add logging into router
  router
    .onError(({ code, error }) => {
      if (options.logErrors) {
        console.error("fatal error: ", error, "code", code);
      }
    })
    .onBeforeHandle(({ request, path }) => {
      if (options.logAccess) {
        console.log(`${request.method} [${path}]`);
      }
    });

  // add all necessary routes
  buildAssets(admin, assets, routes, router);
  buildRoutes(admin, routes, router);

  return router;
};
