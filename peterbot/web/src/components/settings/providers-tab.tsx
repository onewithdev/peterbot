import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "./provider-card";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Provider = "anthropic" | "google" | "zai" | "moonshot";

interface MaskedKey {
  id: string;
  provider: Provider;
  maskedKey: string;
  label: string | null;
  isValid: boolean;
  lastError: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KeysResponse {
  keys: Record<Provider, MaskedKey[]>;
}

interface ProvidersResponse {
  primary: Provider;
  fallback_chain: Provider[];
  models: {
    anthropic: string | null;
    google: string | null;
  };
}

const PROVIDER_DISPLAY_NAMES: Record<Provider, string> = {
  anthropic: "Anthropic",
  google: "Google",
  zai: "Z.ai",
  moonshot: "Moonshot",
};

const PROVIDER_ORDER: Provider[] = ["anthropic", "google", "zai", "moonshot"];

export function ProvidersTab() {
  const queryClient = useQueryClient();

  // Query for keys
  const {
    data: keysData,
    isLoading: isLoadingKeys,
  } = useQuery<KeysResponse>({
    queryKey: ["settings/keys"],
    queryFn: async () => {
      const response = await api.settings.keys.$get();
      return response.json();
    },
  });

  // Query for providers config
  const {
    data: providersData,
    isLoading: isLoadingProviders,
  } = useQuery<ProvidersResponse>({
    queryKey: ["settings/providers"],
    queryFn: async () => {
      const response = await api.settings.providers.$get();
      return response.json();
    },
  });

  // Mutation to update providers
  const updateProvidersMutation = useMutation({
    mutationFn: async ({
      primary,
      fallback_chain,
    }: {
      primary: Provider;
      fallback_chain: Provider[];
    }) => {
      const response = await api.settings.providers.$put({
        json: { primary, fallback_chain },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { message?: string }).message ?? "Failed to update providers"
        );
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings/keys"] });
      queryClient.invalidateQueries({ queryKey: ["settings/providers"] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to update providers");
    },
  });

  // Invalidation helper
  const handleKeysChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["settings/keys"] });
    queryClient.invalidateQueries({ queryKey: ["settings/providers"] });
  }, [queryClient]);

  // Handle setting a provider as primary
  const handleSetPrimary = (provider: Provider) => {
    if (!providersData) return;
    updateProvidersMutation.mutate(
      {
        primary: provider,
        fallback_chain: providersData.fallback_chain,
      },
      {
        onSuccess: () => {
          toast.success(`${PROVIDER_DISPLAY_NAMES[provider]} is now the primary provider.`);
        },
      }
    );
  };

  // Handle moving a provider up in the fallback chain
  const handleMoveUp = (index: number) => {
    if (!providersData || index === 0) return;
    const newChain = [...providersData.fallback_chain];
    const temp = newChain[index];
    newChain[index] = newChain[index - 1];
    newChain[index - 1] = temp;
    updateProvidersMutation.mutate({
      primary: providersData.primary,
      fallback_chain: newChain,
    });
  };

  // Handle moving a provider down in the fallback chain
  const handleMoveDown = (index: number) => {
    if (!providersData) return;
    const newChain = [...providersData.fallback_chain];
    if (index >= newChain.length - 1) return;
    const temp = newChain[index];
    newChain[index] = newChain[index + 1];
    newChain[index + 1] = temp;
    updateProvidersMutation.mutate({
      primary: providersData.primary,
      fallback_chain: newChain,
    });
  };

  const isLoading = isLoadingKeys || isLoadingProviders;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!keysData || !providersData) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-destructive">Failed to load providers data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fallback order panel */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Fallback order</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {providersData.fallback_chain.map((provider, index) => (
              <div
                key={provider}
                className="flex items-center justify-between py-2 px-3 border rounded-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  <span className="text-sm">
                    {PROVIDER_DISPLAY_NAMES[provider]}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || updateProvidersMutation.isPending}
                  >
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMoveDown(index)}
                    disabled={
                      index >= providersData.fallback_chain.length - 1 ||
                      updateProvidersMutation.isPending
                    }
                  >
                    Down
                  </Button>
                </div>
              </div>
            ))}
            {/* Env vars row (always last, read-only) */}
            <div className="flex items-center justify-between py-2 px-3 border rounded-md bg-muted/50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {providersData.fallback_chain.length + 1}
                </span>
                <span className="text-sm text-muted-foreground">
                  Env vars (always last)
                </span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled>
                  Up
                </Button>
                <Button size="sm" variant="outline" disabled>
                  Down
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider cards section */}
      <div className="space-y-4">
        {PROVIDER_ORDER.map((provider) => (
          <ProviderCard
            key={provider}
            provider={provider}
            displayName={PROVIDER_DISPLAY_NAMES[provider]}
            keys={keysData.keys[provider] ?? []}
            isPrimary={providersData.primary === provider}
            onSetPrimary={() => handleSetPrimary(provider)}
            isSettingPrimary={updateProvidersMutation.isPending}
            onKeysChanged={handleKeysChanged}
          />
        ))}
      </div>
    </div>
  );
}
