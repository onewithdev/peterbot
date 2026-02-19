import { createFileRoute } from "@tanstack/react-router";
import { CompactionTab } from "@/components/settings/compaction-tab";

export const Route = createFileRoute("/settings/compaction")({
  component: CompactionTab,
});
