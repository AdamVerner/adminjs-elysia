import AdminJS from "adminjs";
import Elysia from "elysia";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { sql } from "drizzle-orm";
import { text, pgTable } from "drizzle-orm/pg-core";
import { Database, Resource } from "../node_modules/adminjs-drizzle/dist/pg";

import { buildRouter } from "../src";

const User = pgTable("users", {
  id: text("id"),
  name: text("name").notNull(),
  textModifiers: text("text_modifiers")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

const client = new Client("postgres://postgres:postgres@localhost:5432/main");
const db = drizzle(client, { schema: { User } });

AdminJS.registerAdapter({ Database, Resource });
const admin = new AdminJS({
  rootPath: "/admin",
  resources: [{ resource: { table: User, db }, options: {} }],
});
const router = buildRouter(admin, { logErrors: true, logAccess: true });
new Elysia().use(router).listen(3000, ({ url }) => {
  console.log(`Server is running on ${new URL(admin.options.rootPath, url)}`);
});
