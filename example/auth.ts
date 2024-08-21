import AdminJS, {
  ComponentLoader,
  CurrentAdmin,
  DefaultAuthProvider,
} from "adminjs";
import Elysia, { Context } from "elysia";

import { buildAuthenticatedRouter } from "../src";
import type {
  AuthenticationOptions,
  AuthenticatedRouterOptions,
} from "../src/buildAuthenticatedRouter";

const componentLoader = new ComponentLoader();
const authProvider = new DefaultAuthProvider({
  authenticate: async (
    { email, password },
    ctx: Context,
  ): Promise<CurrentAdmin | null> => {
    if (email === "") {
      throw new Error("Empty Email");
    }
    if (email !== "admin@example.com" && password !== "password") {
      return null;
    }
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

const opts: AuthenticatedRouterOptions = {
  logErrors: true,
  logAccess: true,
};

const router = buildAuthenticatedRouter(admin, auth, opts);
new Elysia().use(router).listen(3003, ({ url }) => {
  console.log(`Server is running on ${new URL(admin.options.rootPath, url)}`);
});
