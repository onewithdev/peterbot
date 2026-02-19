import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const documentReferences = sqliteTable("document_references", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  source: text("source").notNull(), // URL or "google_drive:<fileId>"
  type: text("type", { enum: ["web", "doc", "upload"] }).notNull().default("web"),
  summary: text("summary"),
  tags: text("tags"), // JSON array
  content: text("content"),
  contentTruncated: integer("content_truncated", { mode: "boolean" }).notNull().default(false),
  cachedAt: integer("cached_at", { mode: "timestamp_ms" }),
  lastFetchAttemptAt: integer("last_fetch_attempt_at", { mode: "timestamp_ms" }),
  lastFetchError: text("last_fetch_error"),
  lastAccessed: integer("last_accessed", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  memoryImportance: integer("memory_importance", { mode: "number" }).notNull().default(5),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type DocumentReference = typeof documentReferences.$inferSelect;
export type NewDocumentReference = typeof documentReferences.$inferInsert;
