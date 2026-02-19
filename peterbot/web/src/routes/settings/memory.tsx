import { createFileRoute } from "@tanstack/react-router";
import { MemoryTab } from "@/components/settings/memory-tab";

export const Route = createFileRoute("/settings/memory")({
  component: MemoryTab,
});
