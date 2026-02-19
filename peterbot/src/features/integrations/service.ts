import { Composio } from "@composio/core";
import { config } from "../../shared/config.js";
import {
  getConnectedApp,
  getConnectedApps,
  upsertConnection,
  removeConnection,
} from "./repository.js";

/**
 * Module-level in-memory timestamp of last successful sync.
 * Reset to null on server restart.
 */
let lastSyncedAt: Date | null = null;

/**
 * Get the timestamp of the last successful sync.
 * Returns null if no sync has been performed since server startup.
 */
export function getLastSyncedAt(): Date | null {
  return lastSyncedAt;
}

/**
 * Toolkit slug to Peterbot provider ID mapping.
 * Maps Composio toolkit slugs to our internal provider identifiers.
 */
const TOOLKIT_TO_PROVIDER: Record<string, string> = {
  gmail: "gmail",
  googledocs: "googledocs",
  googlesheets: "googlesheets",
  googledrive: "google_drive",
  googlecalendar: "googlecalendar",
  github: "github",
  notion: "notion",
  linear: "linear",
};

/**
 * Check if Composio is configured.
 */
export function isConfigured(): boolean {
  return !!config.composioApiKey;
}

/**
 * Get the Composio client instance.
 */
function getClient(): Composio | null {
  if (!config.composioApiKey) {
    return null;
  }
  return new Composio({ apiKey: config.composioApiKey });
}

export type SyncResult =
  | {
      added: string[];
      removed: string[];
      unchanged: string[];
    }
  | { error: "not_configured" | "sdk_error"; message: string };

/**
 * Options for syncing from Composio.
 */
export interface SyncFromComposioOptions {
  /**
   * Whether to update the `lastSyncedAt` timestamp.
   * Set to `true` for manual syncs (user-initiated) to surface in the UI.
   * Set to `false` for background syncs to keep the UI showing the last manual sync time.
   * @default true
   */
  updateTimestamp?: boolean;
}

/**
 * Sync connected accounts from Composio to local DB.
 * Fetches all connected accounts for the entity and updates local state.
 */
export async function syncFromComposio(
  options: SyncFromComposioOptions = {}
): Promise<SyncResult> {
  const { updateTimestamp = true } = options;
  if (!isConfigured()) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  const client = getClient();
  if (!client) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  try {
    // Fetch all connected accounts (entityId may be undefined in Composio)
    const accounts = await client.connectedAccounts.list({
      statuses: ["ACTIVE"],
    });

    const added: string[] = [];
    const unchanged: string[] = [];
    const currentProviders = new Set<string>();

    // Process each connected account
    if (accounts.items) {
      for (const account of accounts.items) {
        const toolkitSlug = account.toolkit?.slug;
        if (!toolkitSlug) continue;

        // Map toolkit slug to provider ID
        const provider = TOOLKIT_TO_PROVIDER[toolkitSlug];
        if (!provider) {
          console.warn(`[sync] Unknown toolkit slug: ${toolkitSlug}`);
          continue;
        }

        currentProviders.add(provider);

        // Get account email from params
        const accountEmail =
          (account.params?.email as string | undefined) ||
          (account.params?.login as string | undefined) ||
          null;

        // Check if already exists in DB
        const existing = await getConnectedApp(undefined, provider);

        // Upsert to DB
        await upsertConnection(undefined, {
          provider,
          composioEntityId: "peterbot-user",
          accountEmail,
          enabled: true,
        });

        if (existing) {
          unchanged.push(provider);
        } else {
          added.push(provider);
        }
      }
    }

    // Find providers that were removed from Composio but still in DB
    const dbApps = await getConnectedApps();
    const removed: string[] = [];

    for (const dbApp of dbApps) {
      if (!currentProviders.has(dbApp.provider)) {
        await removeConnection(undefined, dbApp.provider);
        removed.push(dbApp.provider);
      }
    }

    // Update last synced timestamp on successful completion (only for manual syncs)
    if (updateTimestamp) {
      lastSyncedAt = new Date();
    }

    return { added, removed, unchanged };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: "sdk_error",
      message: `Failed to sync from Composio: ${message}`,
    };
  }
}

export type ConnectionStatusResult =
  | { accountEmail: string | null; connected: boolean }
  | { error: "not_configured" | "sdk_error"; message: string };

/**
 * Check connection status for a provider.
 */
export async function checkConnection(
  provider: string
): Promise<ConnectionStatusResult> {
  if (!isConfigured()) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  const client = getClient();
  if (!client) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  try {
    // List connected accounts for this user and provider
    const accounts = await client.connectedAccounts.list({
      userIds: ["peterbot-user"],
      toolkitSlugs: [provider],
      statuses: ["ACTIVE"],
    });

    if (!accounts.items || accounts.items.length === 0) {
      return { accountEmail: null, connected: false };
    }

    const account = accounts.items[0];

    // Get account email from params if available
    const accountEmail =
      (account.params?.email as string | undefined) ||
      (account.params?.login as string | undefined) ||
      null;

    return {
      accountEmail,
      connected: account.status === "ACTIVE",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: "sdk_error",
      message: `Failed to check connection: ${message}`,
    };
  }
}

export type ActionResult =
  | { success: true; data: unknown }
  | { error: "not_configured" | "sdk_error" | "not_connected"; message: string };

/**
 * Execute a Composio action on a connected provider.
 */
export async function executeAction(
  provider: string,
  action: string,
  params: Record<string, unknown>
): Promise<ActionResult> {
  if (!isConfigured()) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  const client = getClient();
  if (!client) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  try {
    // Execute the action using the tools.execute method
    const result = await client.tools.execute(action, {
      userId: "peterbot-user",
      arguments: params,
      dangerouslySkipVersionCheck: true,
    });

    // Update lastUsedAt in DB
    const existing = await getConnectedApp(undefined, provider);
    if (existing) {
      await upsertConnection(undefined, {
        provider,
        composioEntityId: "peterbot-user",
        accountEmail: existing.accountEmail,
        enabled: existing.enabled,
        lastUsedAt: new Date(),
      });
    }

    return { success: true, data: result.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: "sdk_error",
      message: `Failed to execute action: ${message}`,
    };
  }
}

export type RevokeResult =
  | { success: true }
  | { error: "not_configured" | "sdk_error"; message: string };

/**
 * Revoke a connection to a provider.
 */
export async function revokeConnection(
  provider: string
): Promise<RevokeResult> {
  if (!isConfigured()) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  const client = getClient();
  if (!client) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  try {
    // Find the connected account
    const accounts = await client.connectedAccounts.list({
      userIds: ["peterbot-user"],
      toolkitSlugs: [provider],
    });

    if (accounts.items && accounts.items.length > 0) {
      // Delete the connection
      await client.connectedAccounts.delete(accounts.items[0].id);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // If connection doesn't exist, consider it a success
    if (message.includes("not found") || message.includes("does not exist")) {
      return { success: true };
    }
    return {
      error: "sdk_error",
      message: `Failed to revoke connection: ${message}`,
    };
  }
}

// Re-export repository functions for convenience
export {
  getConnectedApps,
  getConnectedApp,
  upsertConnection,
  toggleConnectionEnabled,
  removeConnection,
} from "./repository.js";
