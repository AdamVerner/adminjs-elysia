import AdminJS, {
  ComponentLoader,
  CurrentAdmin,
  DefaultAuthProvider,
} from "adminjs";
import Elysia, { Context } from "elysia";

import { buildAuthenticatedRouter } from "../src";
import type {
  AuthenticationOptions,
  RouterOptions,
} from "../src/buildAuthenticatedRouter";

const componentLoader = new ComponentLoader();
const authProvider = new DefaultAuthProvider({
  authenticate: async (
    { email, password },
    ctx: Context,
  ): Promise<CurrentAdmin | null> => {
    console.log("authenticating", email, password, JSON.stringify(ctx));
    return { email, title: "Admin" };
  },
  componentLoader,
});

const admin = new AdminJS({
  rootPath: "/admin",
  componentLoader,
});

const auth: AuthenticationOptions = {
  cookiePassword: crypto.randomUUID(),
  provider: authProvider,
};

const opts: RouterOptions = {
  logErrors: true,
  logAccess: true,
};

const router = buildAuthenticatedRouter(admin, auth, opts);
new Elysia().use(router).listen(3001, ({ url }) => {
  console.log(`Server is running on ${new URL(admin.options.rootPath, url)}`);
});
