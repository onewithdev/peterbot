import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sparkles,
  Brain,
  Activity,
  Clock,
  Settings,
  Terminal,
  Bot,
  LogOut,
  Archive,
  BookOpen,
  MessageSquare,
  Zap,
  Hexagon,
  Info,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearPassword } from "@/lib/auth";
import { useRouter } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";
import { Switch } from "@/components/ui/switch";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  isNew?: boolean;
}

const navItems: NavItem[] = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Soul", path: "/soul", icon: Sparkles },
  { label: "Memory", path: "/memory", icon: Brain },
  { label: "Monitor", path: "/monitor", icon: Activity },
  { label: "Schedules", path: "/schedules", icon: Clock },
  { label: "Sessions", path: "/sessions", icon: Archive },
  { label: "Solutions", path: "/solutions", icon: BookOpen },
  { label: "Chat", path: "/chat", icon: MessageSquare },
  { label: "Skills", path: "/skills", icon: Zap, isNew: true },
  { label: "Integrations", path: "/integrations", icon: Hexagon, isNew: true },
  { label: "Config", path: "/config", icon: Settings },
  { label: "About", path: "/about", icon: Info, isNew: true },
  { label: "Dev Console", path: "/console", icon: Terminal, external: true },
];

export function Sidebar() {
  const location = useLocation();
  const router = useRouter();
  const { isDark, toggleTheme, isInitialized } = useTheme();

  const handleLogout = () => {
    clearPassword();
    router.navigate({ to: "/login" });
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Header */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <Bot className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold text-sidebar-foreground">peterbot</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          // External links (Dev Console) open in new tab
          if (item.external) {
            return (
              <a
                key={item.path}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                item.isNew && !isActive && "text-indigo-400 hover:text-indigo-300"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.isNew && (
                <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-semibold">
                  new
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        {/* Theme Toggle */}
        {isInitialized && (
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 text-sidebar-foreground">
              {isDark ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {isDark ? 'Dark' : 'Light'}
              </span>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={toggleTheme}
              aria-label="Toggle theme"
            />
          </div>
        )}
        
        {/* Logout Button */}
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
