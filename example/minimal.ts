import AdminJS from "adminjs";
import Elysia from "elysia";

import { buildRouter } from "../src";

const admin = new AdminJS({
  rootPath: "/admin",
});
const router = buildRouter(admin, { logErrors: true, logAccess: true });
new Elysia().use(router).listen(3000, ({ url }) => {
  console.log(`Server is running on ${new URL(admin.options.rootPath, url)}`);
});
