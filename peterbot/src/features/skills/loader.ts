/**
 * Skills Loader (Poller) Module
 *
 * Polls the /skills/ directory for .skill.md files and syncs them with the database.
 * Runs on a 5-second interval in the server process.
 */

import { readdirSync, mkdirSync } from "fs";
import { join } from "path";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema.js";
import { db as defaultDb } from "../../db/index.js";
import { parseSkillFile, type ParsedSkill } from "./parser.js";
import {
  getAllSkills,
  upsertSkill,
  deleteSkillByFilePath,
  markSkillInvalid,
} from "./repository.js";

const SKILLS_DIR = join(process.cwd(), "skills");
const POLL_INTERVAL_MS = 5000;

/**
 * Ensure the skills directory exists.
 */
function ensureSkillsDirectory(): void {
  try {
    mkdirSync(SKILLS_DIR, { recursive: true });
  } catch (error) {
    console.error("[Skills] Failed to create skills directory:", error);
  }
}

/**
 * Get all .skill.md files from the skills directory.
 */
function getSkillFiles(): string[] {
  try {
    const files = readdirSync(SKILLS_DIR);
    return files
      .filter((f) => f.endsWith(".skill.md"))
      .map((f) => join(SKILLS_DIR, f));
  } catch (error) {
    console.error("[Skills] Failed to read skills directory:", error);
    return [];
  }
}

/**
 * Perform a single scan of the skills directory and sync with database.
 * This function is exported for use by the API route.
 */
export async function scanSkillsOnce(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<{ synced: number; errors: number }> {
  ensureSkillsDirectory();

  const skillFiles = getSkillFiles();
  const existingSkills = await getAllSkills(db);

  // Create a set of file paths on disk for quick lookup
  const diskFilePaths = new Set(skillFiles);

  let synced = 0;
  let errors = 0;

  // Process each file on disk
  for (const filePath of skillFiles) {
    const result = await parseSkillFile(filePath);

    if ("error" in result) {
      console.error(`[Skills] Parse error in ${filePath}: ${result.error}`);
      await markSkillInvalid(db, filePath, result.error);
      errors++;
    } else {
      try {
        await upsertSkill(db, result as ParsedSkill);
        synced++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Skills] Database error for ${filePath}: ${message}`);
        await markSkillInvalid(db, filePath, message);
        errors++;
      }
    }
  }

  // Remove skills whose files were deleted
  for (const skill of existingSkills) {
    if (!diskFilePaths.has(skill.filePath)) {
      console.log(`[Skills] Removing deleted skill: ${skill.name}`);
      await deleteSkillByFilePath(db, skill.filePath);
    }
  }

  if (synced > 0 || errors > 0) {
    console.log(`[Skills] Scan complete: ${synced} synced, ${errors} errors`);
  }

  return { synced, errors };
}

/**
 * Start the skills poller.
 *
 * @param db - Database instance
 * @returns Cleanup function to stop the poller
 */
export function startSkillsPoller(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): () => void {
  ensureSkillsDirectory();

  console.log("[Skills] Starting skills poller...");

  // Run initial scan
  scanSkillsOnce(db).catch((error) => {
    console.error("[Skills] Initial scan failed:", error);
  });

  // Start polling interval
  const intervalId = setInterval(() => {
    scanSkillsOnce(db).catch((error) => {
      console.error("[Skills] Scan failed:", error);
    });
  }, POLL_INTERVAL_MS);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    console.log("[Skills] Poller stopped");
  };
}
