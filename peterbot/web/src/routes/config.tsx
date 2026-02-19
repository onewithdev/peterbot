import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/config")({
  component: () => <Navigate to="/settings/blocklist" />,
});
