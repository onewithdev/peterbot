import { createFileRoute } from "@tanstack/react-router";
import { SoulTab } from "@/components/settings/soul-tab";

export const Route = createFileRoute("/settings/soul")({
  component: SoulTab,
});
