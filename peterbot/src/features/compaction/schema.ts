import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const chatState = sqliteTable("chat_state", {
  chatId: text("chat_id").primaryKey(),
  messageCount: integer("message_count").notNull().default(0),
  latestSummary: text("latest_summary"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  chatId: text("chat_id").notNull(),
  triggerJobId: text("trigger_job_id"),
  messageCount: integer("message_count").notNull(),
  summary: text("summary").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ChatState = typeof chatState.$inferSelect;
export type NewChatState = typeof chatState.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Config = typeof config.$inferSelect;
