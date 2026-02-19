/**
 * Test Database Helper
 *
 * Creates isolated in-memory SQLite databases for testing.
 * Prevents test data from polluting production database.
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

/**
 * Create an in-memory test database with all tables.
 * Use this in tests instead of the production database.
 */
export function createTestDb(): BunSQLiteDatabase<typeof schema> {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Create jobs table
  sqlite.exec(`
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      chat_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      schedule_id TEXT,
      delivered INTEGER NOT NULL DEFAULT 0,
      skill_system_prompt TEXT
    )
  `);

  // Create chat_messages table
  sqlite.exec(`
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      sender TEXT NOT NULL,
      job_id TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Create schedules table
  sqlite.exec(`
    CREATE TABLE schedules (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      natural_schedule TEXT NOT NULL,
      parsed_cron TEXT NOT NULL,
      prompt TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      next_run_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create solutions table
  sqlite.exec(`
    CREATE TABLE solutions (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      keywords TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create chat_state table
  sqlite.exec(`
    CREATE TABLE chat_state (
      chat_id TEXT PRIMARY KEY,
      latest_summary TEXT,
      last_summary_job_id TEXT,
      message_count_since_summary INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create compaction_config table
  sqlite.exec(`
    CREATE TABLE compaction_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      message_threshold INTEGER NOT NULL DEFAULT 50,
      enabled INTEGER NOT NULL DEFAULT 1
    )
  `);

  return db;
}
