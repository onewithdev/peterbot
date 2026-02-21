import { createFileRoute } from "@tanstack/react-router";
import { ProvidersTab } from "@/components/settings/providers-tab";

export const Route = createFileRoute("/settings/providers")({
  component: ProvidersTab,
});
