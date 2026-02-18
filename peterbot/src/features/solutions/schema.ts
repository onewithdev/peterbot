import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { jobs } from "../jobs/schema.js";

export const solutions = sqliteTable("solutions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id").notNull().unique().references(() => jobs.id),
  title: text("title").notNull(),
  description: text("description"),
  tags: text("tags"),
  keywords: text("keywords"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Solution = typeof solutions.$inferSelect;
export type NewSolution = typeof solutions.$inferInsert;
