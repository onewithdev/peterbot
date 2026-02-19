import { Composio } from "@composio/core";
import { config } from "../../shared/config.js";
import {
  getConnectedApp,
  upsertConnection,
} from "./repository.js";

// In-memory state store for pending OAuth tokens (10-minute TTL)
interface PendingState {
  provider: string;
  expiresAt: number;
}

const pendingStates = new Map<string, PendingState>();

/**
 * Generate and store a state token for OAuth flow.
 */
function generateStateToken(provider: string): string {
  const state = crypto.randomUUID();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  pendingStates.set(state, { provider, expiresAt });
  return state;
}

/**
 * Validate and consume a state token.
 * Returns the associated provider or null if invalid/expired.
 */
export function validateAndConsumeState(state: string): string | null {
  const pending = pendingStates.get(state);
  
  if (!pending) {
    return null;
  }
  
  // Clean up
  pendingStates.delete(state);
  
  // Check expiry
  if (Date.now() > pending.expiresAt) {
    return null;
  }
  
  return pending.provider;
}

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

export type OAuthUrlResult =
  | { redirectUrl: string; state: string }
  | { error: "not_configured" | "sdk_error"; message: string };

/**
 * Get OAuth URL for connecting to a provider.
 */
export async function getOAuthUrl(provider: string): Promise<OAuthUrlResult> {
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
    // Use the link method to create a connection link for the user
    // This generates a redirect URL for OAuth
    const connectionRequest = await client.connectedAccounts.link(
      "peterbot-user",
      provider,
      {
        callbackUrl: "/api/integrations/callback",
      }
    );

    const state = generateStateToken(provider);

    return {
      redirectUrl: connectionRequest.redirectUrl!,
      state,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: "sdk_error",
      message: `Failed to initiate OAuth: ${message}`,
    };
  }
}

export type ConnectionStatusResult =
  | { accountEmail: string | null; connected: boolean }
  | { error: "not_configured" | "sdk_error"; message: string };

/**
 * Check connection status for a provider.
 */
export async function checkConnection(provider: string): Promise<ConnectionStatusResult> {
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
    const accountEmail = (account.params?.email as string | undefined) ||
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
export async function revokeConnection(provider: string): Promise<RevokeResult> {
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
