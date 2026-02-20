import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { OverviewTab } from "@/components/settings/overview-tab";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  // Check if we're at the exact /settings path (not a nested route)
  const location = useLocation();
  const isExactSettings = location.pathname === "/settings";

  const tabs = [
    { path: "/settings", label: "Health Check", exact: true },
    { path: "/settings/soul", label: "Soul" },
    { path: "/settings/memory", label: "Memory" },
    { path: "/settings/blocklist", label: "Blocklist" },
    { path: "/settings/compaction", label: "Compaction" },
    { path: "/settings/agent", label: "Agent" },
  ];

  // Base tab styles
  const baseTabClass = "px-4 py-2 text-sm font-medium border-b-2 transition-colors text-muted-foreground border-transparent hover:text-foreground hover:border-muted";
  const activeTabClass = "border-primary text-foreground";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage peterbot&apos;s configuration and preferences
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
        {isExactSettings ? <OverviewTab /> : <Outlet />}
      </div>
    </div>
  );
}
