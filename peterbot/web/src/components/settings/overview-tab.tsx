import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Database, Tag, Bot, Cpu, Puzzle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface SystemStatus {
  telegram: {
    connected: boolean;
    botTokenConfigured: boolean;
  };
  worker: {
    running: boolean;
  };
  composio: {
    configured: boolean;
  };
  timestamp: number;
}

export function OverviewTab() {
  const { data: status, isLoading } = useQuery<SystemStatus>({
    queryKey: ["system-status"],
    queryFn: async () => {
      const response = await api.status.$get();
      return response.json();
    },
  });

  const composioConfigured = status?.composio.configured ?? false;

  return (
    <div className="space-y-6">
      {/* Health Check Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle>Health Check</CardTitle>
          </div>
          <CardDescription>
            Current operational status of peterbot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Online status */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-sm font-medium">Online</span>
              <span className="text-sm text-muted-foreground">
                All systems operational
              </span>
            </div>

            {/* System Health Section */}
            <div className="grid gap-4 md:grid-cols-3 pt-2 border-t">
              {/* Telegram Bot */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <Bot className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Telegram Bot</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {isLoading ? (
                      <span>Checking...</span>
                    ) : status?.telegram.connected ? (
                      <>
                        <span className="text-green-500">✅</span> Connected
                      </>
                    ) : (
                      <>
                        <span className="text-red-500">❌</span> Disconnected
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Worker */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <Cpu className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Worker</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {isLoading ? (
                      <span>Checking...</span>
                    ) : status?.worker.running ? (
                      <>
                        <span className="text-green-500">✅</span> Running
                      </>
                    ) : (
                      <>
                        <span className="text-red-500">❌</span> Stopped
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Composio */}
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${composioConfigured ? 'bg-green-100' : 'bg-amber-100'}`}>
                  <Puzzle className={`h-5 w-5 ${composioConfigured ? 'text-green-600' : 'text-amber-600'}`} />
                </div>
                <div>
                  <p className="font-medium">Composio</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {isLoading ? (
                      <span>Checking...</span>
                    ) : composioConfigured ? (
                      <>
                        <span className="text-green-500">✅</span> Configured
                      </>
                    ) : (
                      <>
                        <span className="text-amber-500">⚠️</span> Not configured
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Version Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-500" />
            <CardTitle>Version</CardTitle>
          </div>
          <CardDescription>
            Current build information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Build</span>
              <span className="font-medium">Development</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-500" />
            <CardTitle>Database</CardTitle>
          </div>
          <CardDescription>
            Storage backend information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">SQLite</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Location</span>
              <span className="font-medium">Local file</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
