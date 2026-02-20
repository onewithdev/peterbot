import { createFileRoute } from "@tanstack/react-router";
import { AgentTab } from "@/components/settings/agent-tab";

export const Route = createFileRoute("/settings/agent")({
  component: AgentTab,
});
