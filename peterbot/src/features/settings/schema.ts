import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const apiKeys = sqliteTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  provider: text("provider", {
    enum: ["anthropic", "google", "zai", "moonshot"],
  }).notNull(),
  encryptedKey: text("encrypted_key").notNull(), // AES-256-GCM, base64(ciphertext + authTag)
  iv: text("iv").notNull(), // GCM IV, base64
  maskedKey: text("masked_key").notNull(), // e.g. "sk-ant-...AbCd"
  label: text("label"),
  isValid: integer("is_valid", { mode: "boolean" })
    .notNull()
    .default(false),
  lastError: text("last_error"),
  validatedAt: integer("validated_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
