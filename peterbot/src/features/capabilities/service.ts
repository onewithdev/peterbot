/**
 * Capabilities Service - Self-Awareness Aggregation
 *
 * Provides a unified view of bot capabilities by aggregating:
 * - Active/enabled skills with trigger patterns
 * - Connected app integrations
 * - Changelog history
 *
 * Used by both the Telegram bot (/whatcanido, /changelog, /skills)
 * and the dashboard About page.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { getEnabledSkills, getAllSkills } from "../skills/repository.js";
import { getConnectedApps } from "../integrations/repository.js";


/**
 * Core command information for the capabilities summary.
 */
export interface CoreCommand {
  name: string;
  description: string;
}

/**
 * Skill capability information.
 */
export interface SkillCapability {
  name: string;
  description: string;
  triggerPattern: string;
  category: string;
  enabled: boolean;
}

/**
 * Connected app information.
 */
export interface AppCapability {
  provider: string;
  connected: boolean;
  enabled: boolean;
  accountEmail: string | null;
}

/**
 * Parsed changelog entry.
 */
export interface ChangelogEntry {
  date: string;
  phase: string;
  items: string[];
}

/**
 * Full capabilities summary returned by getCapabilities().
 */
export interface CapabilitiesSummary {
  version: string;
  phase: string;
  coreCommands: CoreCommand[];
  skills: SkillCapability[];
  connectedApps: AppCapability[];
  recentChanges: ChangelogEntry[];
}

// Core commands that are always available
const CORE_COMMANDS: CoreCommand[] = [
  { name: "/start", description: "Welcome message" },
  { name: "/help", description: "Show full command reference" },
  { name: "/status", description: "List all your tasks" },
  { name: "/retry [jobId]", description: "Retry a failed job" },
  { name: "/get [jobId]", description: "Get completed job output" },
  { name: "/schedule", description: "Create recurring task" },
  { name: "/schedules", description: "List all schedules" },
  { name: "/solutions", description: "List saved solutions" },
  { name: "/skills", description: "List active skills" },
  { name: "/whatcanido", description: "Show capabilities summary" },
  { name: "/changelog", description: "Show full changelog" },
];

/**
 * Get the full capabilities summary.
 * Aggregates skills, connected apps, and changelog data.
 */
export async function getCapabilities(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<CapabilitiesSummary> {
  // Get all skills (enabled and disabled)
  const allSkills = await getAllSkills(db);
  const skills: SkillCapability[] = allSkills.map((skill) => ({
    name: skill.name,
    description: skill.description || "",
    triggerPattern: skill.triggerPattern,
    category: skill.category,
    enabled: skill.enabled && skill.valid,
  }));

  // Get connected apps
  const connectedApps = await getConnectedApps(db);
  const apps: AppCapability[] = connectedApps.map((app) => ({
    provider: app.provider,
    connected: true,
    enabled: app.enabled,
    accountEmail: app.accountEmail,
  }));

  // Get recent changelog entries (last 2-3)
  const changelog = await getChangelog();
  const recentChanges = changelog.slice(0, 3);

  return {
    version: "0.3.0",
    phase: "Phase 3: Extensible",
    coreCommands: CORE_COMMANDS,
    skills,
    connectedApps: apps,
    recentChanges,
  };
}

/**
 * Get enabled skills for the /skills command.
 * Returns only active, valid skills with their trigger phrases.
 */
export async function getEnabledSkillCapabilities(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<SkillCapability[]> {
  const enabledSkills = await getEnabledSkills(db);
  return enabledSkills.map((skill) => ({
    name: skill.name,
    description: skill.description || "",
    triggerPattern: skill.triggerPattern,
    category: skill.category,
    enabled: true,
  }));
}

/**
 * Read and parse the changelog from docs/changelog.md.
 * Returns structured changelog entries grouped by date.
 */
export async function getChangelog(): Promise<ChangelogEntry[]> {
  try {
    const changelogPath = join(process.cwd(), "docs", "changelog.md");
    const content = await readFile(changelogPath, "utf-8");
    return parseChangelog(content);
  } catch (error) {
    console.error("Error reading changelog:", error);
    // Return a default entry if changelog can't be read
    return [
      {
        date: new Date().toISOString().split("T")[0],
        phase: "Current",
        items: ["Changelog not available"],
      },
    ];
  }
}

/**
 * Get the full changelog as raw markdown text.
 * Used for the /changelog command.
 */
export async function getChangelogRaw(): Promise<string> {
  try {
    const changelogPath = join(process.cwd(), "docs", "changelog.md");
    return await readFile(changelogPath, "utf-8");
  } catch (error) {
    console.error("Error reading changelog:", error);
    return "# Changelog\n\nNo changelog available yet.";
  }
}

/**
 * Parse changelog markdown into structured entries.
 *
 * Expected format:
 * ## YYYY-MM-DD — Phase Name
 * - Item 1
 * - Item 2
 *
 * ## YYYY-MM-DD — Another Phase
 * - Item 3
 */
function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = content.split("\n");

  let currentEntry: ChangelogEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for date header pattern: ## YYYY-MM-DD — Phase Name
    // or ## YYYY-MM-DD - Phase Name (with regular dash)
    const headerMatch = trimmed.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*[—-]\s*(.+)$/);
    if (headerMatch) {
      // Save previous entry if exists
      if (currentEntry && currentEntry.items.length > 0) {
        entries.push(currentEntry);
      }
      // Start new entry
      currentEntry = {
        date: headerMatch[1],
        phase: headerMatch[2].trim(),
        items: [],
      };
      continue;
    }

    // Check for list item: - Item text or * Item text
    const itemMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (itemMatch && currentEntry) {
      currentEntry.items.push(itemMatch[1].trim());
    }
  }

  // Don't forget the last entry
  if (currentEntry && currentEntry.items.length > 0) {
    entries.push(currentEntry);
  }

  return entries;
}

/**
 * Format capabilities summary for Telegram bot response.
 * Returns a formatted markdown string.
 */
export function formatCapabilitiesSummary(
  summary: CapabilitiesSummary
): string {
  const lines: string[] = [];

  // Header
  lines.push(`*🤖 peterbot ${summary.version}* — ${summary.phase}\n`);

  // Core commands
  lines.push("*Core Commands:*");
  const coreCommandsToShow = summary.coreCommands.slice(0, 7); // Show top 7
  for (const cmd of coreCommandsToShow) {
    lines.push(`• \`${cmd.name}\` — ${cmd.description}`);
  }
  lines.push("");

  // Active skills
  const enabledSkills = summary.skills.filter((s) => s.enabled);
  if (enabledSkills.length > 0) {
    lines.push(`*Active Skills (${enabledSkills.length}):*`);
    for (const skill of enabledSkills.slice(0, 5)) {
      const triggers = skill.triggerPattern.split("|")[0]; // Show first trigger
      lines.push(`• ${skill.name} — _"${triggers}"_`);
    }
    if (enabledSkills.length > 5) {
      lines.push(`• _...and ${enabledSkills.length - 5} more_`);
    }
    lines.push("");
  }

  // Connected apps
  if (summary.connectedApps.length > 0) {
    lines.push("*Connected Apps:*");
    const connected = summary.connectedApps.filter((a) => a.connected);
    for (const app of connected) {
      const status = app.enabled ? "✅" : "⚫";
      const account = app.accountEmail ? ` (${app.accountEmail})` : "";
      lines.push(`• ${status} ${app.provider}${account}`);
    }
    lines.push("");
  }

  // Recent changes
  if (summary.recentChanges.length > 0) {
    lines.push("*Recent Changes:*");
    const latest = summary.recentChanges[0];
    lines.push(`_${latest.date} — ${latest.phase}_`);
    for (const item of latest.items.slice(0, 3)) {
      lines.push(`• ${item}`);
    }
    lines.push("");
  }

  lines.push("Type /changelog for full history");

  return lines.join("\n");
}

/**
 * Format skills list for Telegram bot response.
 * Used by /skills command.
 */
export function formatSkillsCapabilityList(skills: SkillCapability[]): string {
  if (skills.length === 0) {
    return "*⚡ Active Skills*\n\nNo skills are currently active.\n\nSkills are auto-detected from the /skills/ folder.";
  }

  const lines: string[] = [];
  lines.push(`*⚡ Active Skills (${skills.length}):*\n`);

  for (const skill of skills) {
    const triggers = skill.triggerPattern.split("|").map((t) => t.trim());
    const triggerExamples = triggers.slice(0, 2).join('", "');
    lines.push(`*${skill.name}*`);
    lines.push(`  Triggers: "${triggerExamples}"`);
    if (skill.description) {
      lines.push(`  ${skill.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format changelog for Telegram bot response.
 * Used by /changelog command.
 */
export function formatChangelogForTelegram(entries: ChangelogEntry[]): string {
  if (entries.length === 0) {
    return "*📋 Changelog*\n\nNo changelog entries available.";
  }

  const lines: string[] = [];
  lines.push("*📋 Changelog*\n");

  for (const entry of entries) {
    lines.push(`_${entry.date} — ${entry.phase}_`);
    for (const item of entry.items) {
      lines.push(`• ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Check if a natural language query is asking about capabilities.
 * Used to trigger the /whatcanido response from natural language.
 */
export function isCapabilitiesQuery(text: string): boolean {
  const patterns = [
    /what can you do/i,
    /what are your capabilities/i,
    /what can you help (me )?with/i,
    /what commands (are available|do you have)/i,
    /show (me )?your (skills|capabilities)/i,
    /tell me about (yourself|your capabilities)/i,
    /help (me )?understand what you can do/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}
