import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    chatId: text("chat_id").notNull(),
    direction: text("direction", { enum: ["in", "out"] }).notNull(),
    content: text("content").notNull(),
    sender: text("sender", { enum: ["user", "bot"] }).notNull(),
    jobId: text("job_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    idxChatMessagesChatId: index("idx_chat_messages_chat_id").on(table.chatId),
    idxChatMessagesCreatedAt: index("idx_chat_messages_created_at").on(
      table.createdAt
    ),
  })
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
