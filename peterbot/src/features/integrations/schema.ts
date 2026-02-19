import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const connectedApps = sqliteTable("connected_apps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider").notNull().unique(),
  composioEntityId: text("composio_entity_id").notNull().default("peterbot-user"),
  accountEmail: text("account_email"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  connectedAt: integer("connected_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
});

export type ConnectedApp = typeof connectedApps.$inferSelect;
export type NewConnectedApp = typeof connectedApps.$inferInsert;
