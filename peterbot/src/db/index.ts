import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";

const dbPath = process.env.SQLITE_DB_PATH || "./data/jobs.db";

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

// Initialize SQLite with Bun
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency
sqlite.exec("PRAGMA journal_mode = WAL;");

// Enable foreign keys
sqlite.exec("PRAGMA foreign_keys = ON;");

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Re-export schema types
export * from "./schema";
