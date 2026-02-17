import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type", { enum: ["task", "quick"] }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  description: text("description").notNull(),
  result: text("result"),
  chatId: text("chat_id").notNull(),
  delivered: integer("delivered", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
