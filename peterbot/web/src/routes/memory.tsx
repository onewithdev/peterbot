import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/memory")({
  component: () => <Navigate to="/settings/memory" />,
});
