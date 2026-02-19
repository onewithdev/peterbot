import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Database, Tag } from "lucide-react";

export function OverviewTab() {
  return (
    <div className="space-y-6">
      {/* System Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <CardTitle>System Status</CardTitle>
          </div>
          <CardDescription>
            Current operational status of peterbot
          </CardDescription>
        </CardHeader>
        <CardContent>
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
