import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sparkles,
  Brain,
  Activity,
  Settings,
  Terminal,
  Bot,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearPassword } from "@/lib/auth";
import { useRouter } from "@tanstack/react-router";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Soul", path: "/soul", icon: Sparkles },
  { label: "Memory", path: "/memory", icon: Brain },
  { label: "Monitor", path: "/monitor", icon: Activity },
  { label: "Config", path: "/config", icon: Settings },
  { label: "Dev Console", path: "/console", icon: Terminal },
];

export function Sidebar() {
  const location = useLocation();
  const router = useRouter();

  const handleLogout = () => {
    clearPassword();
    router.navigate({ to: "/login" });
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar">
      {/* Header */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Bot className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">peterbot</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
