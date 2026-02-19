import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  description: text("description"),
  triggerPattern: text("trigger_pattern").notNull(),
  tools: text("tools"), // JSON array string
  category: text("category").notNull().default("general"),
  systemPrompt: text("system_prompt").notNull(),
  content: text("content").notNull(), // full markdown body
  filePath: text("file_path").notNull().unique(), // source path on disk
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  valid: integer("valid", { mode: "boolean" }).notNull().default(true),
  loadError: text("load_error"), // parse error message
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
