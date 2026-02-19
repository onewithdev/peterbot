import { createFileRoute } from "@tanstack/react-router";
import { BlocklistTab } from "@/components/settings/blocklist-tab";

export const Route = createFileRoute("/settings/blocklist")({
  component: BlocklistTab,
});
