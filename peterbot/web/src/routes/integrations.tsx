import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Link2,
  Mail,
  Github,
  Folder,
  FileText,
  Calendar,
  CheckSquare,
  AlertCircle,
  RefreshCw,
  Table,
  HelpCircle,
  ExternalLink,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { IntegrationsResponse, ApiProvider } from "@/types/integration";

export const Route = createFileRoute("/integrations")({
  component: IntegrationsPage,
});

// Helper function to format relative time
function formatRelativeTime(timestamp: string | null): string | null {
  if (!timestamp) return null;
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMinutes < 1) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  github: Github,
  folder: Folder,
  "file-text": FileText,
  calendar: Calendar,
  "check-square": CheckSquare,
  table: Table,
};

// Instructions modal component
function InstructionsDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: ApiProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Connect {provider.label}
          </DialogTitle>
          <DialogDescription>{provider.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <p className="text-sm font-medium">Steps to connect:</p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://app.composio.dev/accounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Composio Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Click "Add Account"</li>
              <li>
                Search for and select <strong>{provider.label}</strong>
              </li>
              <li>Complete the OAuth flow</li>
              <li>Return here and click "Sync from Composio"</li>
            </ol>
          </div>

          {provider.required && (
            <div className="flex items-start gap-2 text-amber-600 text-sm">
              <Star className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                This integration is <strong>required</strong> for some Peterbot
                features to work properly.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [instructionsProvider, setInstructionsProvider] =
    useState<ApiProvider | null>(null);

  // Fetch integrations
  const { data: integrationsData, isLoading } = useQuery<IntegrationsResponse>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const response = await api.integrations.$get();
      return response.json();
    },
  });

  const providers: ApiProvider[] = integrationsData?.providers ?? [];
  const isConfigured = integrationsData?.configured ?? false;
  const lastSyncedAt = integrationsData?.lastSyncedAt ?? null;

  // Group providers by category
  const groupedProviders = providers.reduce(
    (acc, provider) => {
      const category = provider.category || "Other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(provider);
      return acc;
    },
    {} as Record<string, ApiProvider[]>
  );

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.integrations.sync.$post();
      const result = await response.json();
      if (!response.ok) {
        throw new Error("Failed to sync");
      }
      return result as {
        success: true;
        added: string[];
        removed: string[];
        unchanged: string[];
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      if (result.added.length === 0 && result.removed.length === 0) {
        toast.info("Already up to date");
      } else {
        toast.success(
          `Synced: ${result.added.length} added, ${result.removed.length} removed, ${result.unchanged.length} unchanged`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sync from Composio");
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({
      provider,
      enabled,
    }: {
      provider: string;
      enabled: boolean;
    }) => {
      const response = await api.integrations[":provider"].toggle.$patch({
        param: { provider },
        json: { enabled },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error("Failed to toggle integration");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to toggle integration");
    },
  });



  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleToggle = (provider: string, enabled: boolean) => {
    toggleMutation.mutate({ provider, enabled });
  };

  const getStatusBadge = (provider: ApiProvider) => {
    if (!provider.connected) {
      return (
        <Badge variant="secondary" className="text-muted-foreground">
          Not Connected
        </Badge>
      );
    }
    if (!provider.enabled) {
      return (
        <Badge
          variant="outline"
          className="text-amber-600 border-amber-600 bg-amber-50"
        >
          Disabled
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-green-700 border-green-700 bg-green-50"
      >
        Connected
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Link2 className="h-8 w-8" />
            Integrations
          </h1>
          <p className="text-muted-foreground">
            Manage connections via{" "}
            <a
              href="https://composio.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Composio
            </a>
          </p>
        </div>
        {isConfigured && (
          <div className="flex flex-col items-end gap-1.5">
            {lastSyncedAt && (
              <span className="text-xs text-muted-foreground">
                Last synced: {formatRelativeTime(lastSyncedAt)}
              </span>
            )}
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              Sync from Composio
            </Button>
          </div>
        )}
      </div>

      {/* Not Configured State */}
      {!isConfigured && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Composio not configured</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Add{" "}
            <code className="bg-muted px-1 py-0.5 rounded">COMPOSIO_API_KEY</code>{" "}
            to your environment to enable integrations. Get your API key at{" "}
            <a
              href="https://composio.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              composio.dev
            </a>
            .
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading integrations...</p>
        </div>
      )}

      {/* Providers by Category */}
      {isConfigured &&
        !isLoading &&
        Object.entries(groupedProviders).map(([category, categoryProviders]) => (
          <div key={category} className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryProviders.map((provider) => {
                const Icon = iconMap[provider.icon] || Link2;

                return (
                  <Card key={provider.provider}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{provider.label}</span>
                            {provider.required && (
                              <Badge
                                variant="outline"
                                className="text-amber-600 border-amber-600 text-xs"
                              >
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                Required
                              </Badge>
                            )}
                            {getStatusBadge(provider)}
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {provider.description}
                          </p>

                          {provider.connected && provider.app?.accountEmail && (
                            <p className="text-sm text-muted-foreground">
                              {provider.app.accountEmail}
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-2">
                            {provider.connected ? (
                              <>
                                <Switch
                                  checked={provider.enabled}
                                  onCheckedChange={(enabled) =>
                                    handleToggle(provider.provider, enabled)
                                  }
                                  disabled={toggleMutation.isPending}
                                />
                                <span className="text-sm text-muted-foreground">
                                  {provider.enabled ? "Enabled" : "Disabled"}
                                </span>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setInstructionsProvider(provider)}
                                className="gap-1"
                              >
                                <HelpCircle className="h-4 w-4" />
                                How to Connect
                              </Button>
                            )}
                          </div>
                        </div>

                        {provider.connected && (
                          <a
                            href="https://app.composio.dev/accounts"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                          >
                            Manage in Composio
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

      {/* Instructions Modal */}
      {instructionsProvider && (
        <InstructionsDialog
          provider={instructionsProvider}
          open={!!instructionsProvider}
          onOpenChange={() => setInstructionsProvider(null)}
        />
      )}
    </div>
  );
}
