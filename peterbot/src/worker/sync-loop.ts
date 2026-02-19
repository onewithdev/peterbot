import { syncFromComposio } from "../features/integrations/service.js";

/**
 * Sync loop interval in milliseconds.
 * The sync loop runs every 1 hour (3600 seconds).
 */
const SYNC_INTERVAL_MS = 3_600_000;

/**
 * Run the sync loop indefinitely.
 *
 * Calls syncFromComposio() at regular intervals to keep integrations in sync
 * with the Composio dashboard. Errors are caught and logged; the loop never
 * throws or exits.
 */
export async function syncLoop(): Promise<void> {
  console.log("[SyncLoop] Starting...");

  while (true) {
    try {
      // Pass updateTimestamp: false so background syncs don't update the UI timestamp
      const result = await syncFromComposio({ updateTimestamp: false });

      if ("error" in result) {
        console.log(`[SyncLoop] Sync failed: ${result.message}`);
      } else {
        const { added, removed, unchanged } = result;
        console.log(
          `[SyncLoop] Synced: ${added.length} added, ${removed.length} removed, ${unchanged.length} unchanged`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SyncLoop] Unexpected error: ${message}`);
    }

    // Sleep before next sync
    await Bun.sleep(SYNC_INTERVAL_MS);
  }
}
