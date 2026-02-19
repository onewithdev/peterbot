import { createFileRoute } from "@tanstack/react-router";
import { JobHistoryTab } from "@/components/jobs/job-history-tab";

export const Route = createFileRoute("/jobs/history")({
  component: JobHistoryTab,
});
