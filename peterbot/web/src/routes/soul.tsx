import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/soul")({
  component: () => <Navigate to="/settings/soul" />,
});
