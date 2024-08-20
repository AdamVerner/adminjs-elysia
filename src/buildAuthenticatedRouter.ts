import {
  AdminJS,
  BaseAuthProvider,
  type CurrentAdmin,
  Router as AdminJSRouter,
} from "adminjs";
import { type Context, Elysia, t } from "elysia";
import { buildAssets, buildRoutes } from "./buildRouter";
import { jwt } from "@elysiajs/jwt";

type RouterType = Elysia<string>;

// has to be here, otherwise TSC will not export it into type declarations.
// idk how to fix it...
export { AdminJS };
export type AuthenticationOptions = {
  cookiePassword: string;
  cookieName?: string;
  provider: BaseAuthProvider<Context>;
};

export type RouterOptions = { logErrors: boolean; logAccess: boolean };

const getLoginPath = (admin: AdminJS): string => {
  const { loginPath, rootPath } = admin.options;
  // since we are inside already namespaced router we have to replace login and logout routes that
  // they don't have rootUrl inside. So changing /admin/login to just /login.
  // but there is a case where user gives / as a root url and /login becomes `login`. We have to
  // fix it by adding / in front of the route
  const normalizedLoginPath = loginPath.replace(rootPath, "");

  return normalizedLoginPath.startsWith("/")
    ? normalizedLoginPath
    : `/${normalizedLoginPath}`;
};

export const buildLoginLogout = (
  admin: AdminJS,
  auth: AuthenticationOptions,
  router: RouterType,
): RouterType => {
  const loginPath = getLoginPath(admin);
  const providerProps = auth.provider.getUiProps();

  let cookieName = auth.cookieName ?? "adminjs";
  let cookie = t.Cookie(
    {
      [cookieName]: t.Optional(t.Any()),
      redirectTo: t.Optional(t.String({ default: admin.options.rootPath })),
    },
    {
      /*
      signed cookies cannot be used since elysia is checking their presence on requests.
      and for login requests they cannot be present...
      we use JWT instead as king of dirty quick fix
      secrets: [auth.cookiePassword],
      sign: [cookieName, "redirectTo"],
    */
    },
  );

  router
    .use(
      jwt({
        secret: auth.cookiePassword,
        name: "jwt",
      }),
    )
    .derive(async ({ cookie, ...ctx }) => {
      let adminUser: {} | undefined;
      let token = cookie[cookieName].value;
      if (token) {
        adminUser = await ctx.jwt.verify(token);
      }
      return { adminUser };
    })
    .get(loginPath, async ({ set, cookie }) => {
      set.headers["Content-Type"] = "text/html;charset=utf-8";
      cookie[cookieName].remove();
      return await admin.renderLogin({
        action: admin.options.loginPath,
        errorMessage: null,
        ...providerProps,
      });
    })
    .get("/logout", async ({ cookie, redirect }) => {
      cookie[cookieName].remove();
      cookie.redirectTo.remove();
      return redirect(admin.options.rootPath, 302);
    })
    .post(
      loginPath,
      async (ctx) => {
        let adminUser = await auth.provider.handleLogin(
          {
            headers: ctx.headers,
            query: ctx.query,
            params: ctx.params,
            data: ctx.body ?? {},
          },
          ctx,
        );
        if (adminUser) {
          console.log("adminUser", JSON.stringify(adminUser));
          ctx.cookie[cookieName].value = await ctx.jwt.sign(adminUser);
          console.log(
            "redirecting user to ",
            ctx.cookie?.redirectTo?.value ?? admin.options.rootPath,
          );
          return ctx.redirect(
            ctx.cookie?.redirectTo?.value ?? admin.options.rootPath,
            302,
          );
        } else {
          return await admin.renderLogin({
            action: admin.options.loginPath,
            errorMessage: "Invalid credentials",
            ...providerProps,
          });
        }
      },
      { cookie },
    );
  return router;
};

export const buildAuth = (
  admin: AdminJS,
  auth: AuthenticationOptions,
  router: RouterType,
) => {
  let cookieName = auth.cookieName ?? "adminUser";
  const { loginPath } = admin.options;

  return router.onBeforeHandle(async ({ redirect, ...ctx }) => {
    const adminUser: CurrentAdmin = (ctx as any)?.adminUser;
    // in dev components.bundle.js is served via route and fucks-up redirects if we do not skip its auth
    if (
      !adminUser &&
      ctx.path !== "/admin/frontend/assets/components.bundle.js"
    ) {
      ctx.cookie.redirectTo.value = ctx.path;
      return redirect(loginPath, 302);
    }
  });
};

export const buildAuthenticatedRouter = async (
  admin: AdminJS,
  auth: AuthenticationOptions,
  options: RouterOptions,
): Promise<RouterType> => {
  // initialize bundler
  await admin.initialize();
  await admin.watch();

  admin.options.env = {
    ...admin.options.env,
    ...auth.provider.getUiProps(),
  };

  // create router
  const { routes, assets } = AdminJSRouter;
  const router: RouterType = new Elysia({ prefix: admin.options.rootPath });

  //add logging into router
  router
    .onBeforeHandle(({ request, path }) => {
      if (options.logAccess) {
        console.log(`${request.method} [${path}]`);
      }
    })
    .onError(({ code, error }) => {
      if (options.logErrors) {
        console.error("fatal error: ", error, "code", code);
      }
    });

  buildAssets(admin, assets, routes, router);
  buildLoginLogout(admin, auth, router);

  // buildLoginLogout injects adminUser into context
  // when adminUser is undefined, no one is logged in...

  // todo fix typing by converting each "build*" module into elysia plugin

  router.guard((app) => {
    buildAuth(admin, auth, router);
    buildRoutes(admin, routes, app as unknown as RouterType, (ctx) => {
      return (ctx as any)?.adminUser;
    });
    return app;
  });

  return router;
};
