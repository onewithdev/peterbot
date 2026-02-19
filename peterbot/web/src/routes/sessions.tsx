import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sessions")({
  component: () => <Navigate to="/settings/compaction" />,
});
