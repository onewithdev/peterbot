import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { JobMonitorTab } from "@/components/jobs/job-monitor-tab";

export const Route = createFileRoute("/jobs")({
  component: JobsLayout,
});

function JobsLayout() {
  // Check if we're at the exact /jobs path (not a nested route)
  const location = useLocation();
  const isExactJobs = location.pathname === "/jobs";

  // Last refresh state - owned by JobMonitorTab but displayed in layout header
  // This is passed to JobMonitorTab so it can update the timestamp
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const tabs = [
    { path: "/jobs", label: "Job Monitor", exact: true },
    { path: "/jobs/history", label: "Job History" },
  ];

  // Base tab styles
  const baseTabClass = "px-4 py-2 text-sm font-medium border-b-2 transition-colors text-muted-foreground border-transparent hover:text-foreground hover:border-muted";
  const activeTabClass = "border-primary text-foreground";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          Monitor and manage background tasks
        </p>
      </div>

      {/* Tab Bar */}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              activeOptions={{ exact: tab.exact ?? false }}
              className={baseTabClass}
              activeProps={{ className: activeTabClass }}

            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div>
        {isExactJobs ? (
          <JobMonitorTab 
            lastRefresh={lastRefresh} 
            setLastRefresh={setLastRefresh} 
          />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
