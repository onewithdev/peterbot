import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { IntegrationsResponse, ApiProvider } from "@/types/integration";

export const Route = createFileRoute("/integrations")({
  component: IntegrationsPage,
});

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  github: Github,
  folder: Folder,
  "file-text": FileText,
  calendar: Calendar,
  "check-square": CheckSquare,
};

function IntegrationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/integrations" });
  const search = useSearch({ from: "/integrations" }) as {
    connected?: string;
    error?: string;
  };
  const [revokingProvider, setRevokingProvider] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Handle URL params on mount
  useEffect(() => {
    if (search.connected) {
      const provider = search.connected;
      const displayName = provider.charAt(0).toUpperCase() + provider.slice(1);
      toast.success(`${displayName} connected successfully`);
      // Clear the param
      navigate({ search: {} });
    }
    if (search.error) {
      if (search.error === "invalid_state") {
        toast.error("Connection failed: Invalid or expired state");
      } else if (search.error === "connection_failed") {
        toast.error("Connection failed: Could not verify connection");
      } else {
        toast.error(`Connection failed: ${search.error}`);
      }
      // Clear the param
      navigate({ search: {} });
    }
  }, [search, navigate]);

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

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await api.integrations[":provider"].connect.$post({
        param: { provider },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error("Failed to initiate connection");
      }
      return result as { redirectUrl: string; state: string };
    },
    onSuccess: (result) => {
      // Navigate to Composio OAuth page
      window.location.href = result.redirectUrl;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to initiate connection");
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

  // Revoke mutation
  const revokeMutation = useMutation({
    mutationFn: async (provider: string) => {
      const response = await api.integrations[":provider"].$delete({
        param: { provider },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error("Failed to revoke connection");
      }
      return result;
    },
    onSuccess: () => {
      setRevokingProvider(null);
      setConfirmDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Connection revoked");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revoke connection");
    },
  });

  const handleConnect = (provider: string) => {
    connectMutation.mutate(provider);
  };

  const handleToggle = (provider: string, enabled: boolean) => {
    toggleMutation.mutate({ provider, enabled });
  };

  const handleRevoke = (provider: string) => {
    setRevokingProvider(provider);
    setConfirmDialogOpen(true);
  };

  const confirmRevoke = () => {
    if (revokingProvider) {
      revokeMutation.mutate(revokingProvider);
    }
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
            Connect external apps via Composio OAuth
          </p>
        </div>
      </div>

      {/* Not Configured State */}
      {!isConfigured && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Composio not configured</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Add <code className="bg-muted px-1 py-0.5 rounded">COMPOSIO_API_KEY</code> to your
            environment to enable integrations. Get your API key at{" "}
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

      {/* Providers Grid */}
      {isConfigured && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((provider) => {
            const Icon = iconMap[provider.icon] || Link2;
            const isConnecting = connectMutation.isPending && connectMutation.variables === provider.provider;

            return (
              <Card key={provider.provider}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{provider.label}</span>
                        {provider.connected ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            ● Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            ○ Not connected
                          </span>
                        )}
                      </div>

                      {provider.connected && provider.app?.accountEmail && (
                        <p className="text-sm text-muted-foreground">
                          {provider.app.accountEmail}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {provider.connected ? (
                          <>
                            <Switch
                              checked={provider.app?.enabled ?? true}
                              onCheckedChange={(enabled) =>
                                handleToggle(provider.provider, enabled)
                              }
                              disabled={toggleMutation.isPending}
                            />
                            <span className="text-sm text-muted-foreground">
                              {provider.app?.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConnect(provider.provider)}
                            disabled={isConnecting}
                          >
                            {isConnecting ? "Connecting..." : "Connect"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {provider.connected && (
                      <Dialog open={confirmDialogOpen && revokingProvider === provider.provider} onOpenChange={(open) => {
                        setConfirmDialogOpen(open);
                        if (!open) setRevokingProvider(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleRevoke(provider.provider)}
                          >
                            Revoke access
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Revoke {provider.label} Access</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to revoke access to {provider.label}?
                              This will disconnect the integration and remove all associated data.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setConfirmDialogOpen(false);
                                setRevokingProvider(null);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={confirmRevoke}
                              disabled={revokeMutation.isPending}
                            >
                              {revokeMutation.isPending ? "Revoking..." : "Revoke"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
