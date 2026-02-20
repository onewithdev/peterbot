import { useState, useEffect, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bot, AlertTriangle, Key } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ConfigResponse } from "@/types/session";

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
  googleApiKeyConfigured: boolean;
  zaiApiKeyConfigured: boolean;
  moonshotApiKeyConfigured: boolean;
  timestamp: number;
}

const MODEL_OPTIONS = [
  { value: "gemini", label: "Gemini" },
  { value: "glm-5", label: "GLM-5" },
  { value: "kimi-k2.5", label: "Kimi 2.5" },
];

const API_KEY_CONFIG = {
  gemini: {
    envVar: "GOOGLE_API_KEY",
    statusField: "googleApiKeyConfigured" as const,
    description: "Required for Gemini",
  },
  "glm-5": {
    envVar: "ZAI_API_KEY",
    statusField: "zaiApiKeyConfigured" as const,
    description: "Required for GLM-5",
  },
  "kimi-k2.5": {
    envVar: "MOONSHOT_API_KEY",
    statusField: "moonshotApiKeyConfigured" as const,
    description: "Required for Kimi 2.5",
  },
};

export function AgentTab() {
  const queryClient = useQueryClient();

  // Local state
  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState("gemini");

  // Fetch agent.enabled config
  const { data: enabledConfig, isLoading: isLoadingEnabled } = useQuery<ConfigResponse | null>({
    queryKey: ["config", "agent.enabled"],
    queryFn: async () => {
      const response = await api.config[":key"].$get({
        param: { key: "agent.enabled" },
      });
      if (!response.ok) {
        return null;
      }
      return response.json() as Promise<ConfigResponse>;
    },
  });

  // Fetch agent.model config
  const { data: modelConfig, isLoading: isLoadingModel } = useQuery<ConfigResponse | null>({
    queryKey: ["config", "agent.model"],
    queryFn: async () => {
      const response = await api.config[":key"].$get({
        param: { key: "agent.model" },
      });
      if (!response.ok) {
        return null;
      }
      return response.json() as Promise<ConfigResponse>;
    },
  });

  // Fetch status for API key configuration
  const { data: status, isLoading: isLoadingStatus } = useQuery<SystemStatus>({
    queryKey: ["system-status"],
    queryFn: async () => {
      const response = await api.status.$get();
      return response.json();
    },
  });

  // Initialize local state when config loads
  useEffect(() => {
    if (enabledConfig && "value" in enabledConfig) {
      setEnabled(enabledConfig.value === "true");
    }
  }, [enabledConfig]);

  useEffect(() => {
    if (modelConfig && "value" in modelConfig) {
      setModel(modelConfig.value);
    }
  }, [modelConfig]);

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const response = await api.config[":key"].$put({
        param: { key: "agent.enabled" },
        json: { value: newValue ? "true" : "false" },
      });
      if (!response.ok) {
        throw new Error("Failed to save");
      }
      return response.json();
    },
    onSuccess: (_, newValue) => {
      queryClient.invalidateQueries({ queryKey: ["config", "agent.enabled"] });
      toast.success(newValue ? "AgentEngine enabled" : "AgentEngine disabled");
    },
    onError: () => {
      toast.error("Failed to save setting");
    },
  });

  // Model change mutation
  const modelMutation = useMutation({
    mutationFn: async (newModel: string) => {
      const response = await api.config[":key"].$put({
        param: { key: "agent.model" },
        json: { value: newModel },
      });
      if (!response.ok) {
        throw new Error("Failed to save");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "agent.model"] });
    },
    onError: () => {
      toast.error("Failed to save model");
    },
  });

  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate(checked);
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setModel(newModel);
    modelMutation.mutate(newModel);
  };

  const isLoading = isLoadingEnabled || isLoadingModel || isLoadingStatus;

  // Check if selected model's API key is missing
  const selectedModelConfig = API_KEY_CONFIG[model as keyof typeof API_KEY_CONFIG];
  const isApiKeyMissing = status && selectedModelConfig
    ? !status[selectedModelConfig.statusField]
    : false;

  return (
    <div className="space-y-6">
      {/* Section 1 - AgentEngine Toggle */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            AgentEngine
          </CardTitle>
          <CardDescription>
            Enable or disable the AI agent functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Enable AgentEngine</div>
              <div className="text-sm text-muted-foreground">
                {enabled ? "AgentEngine is currently enabled" : "AgentEngine is currently disabled"}
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={isLoading || toggleMutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2 - Model Selector */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Model Selection</CardTitle>
          <CardDescription>
            Choose the AI model to use for agent operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <select
              value={model}
              onChange={handleModelChange}
              disabled={isLoading || modelMutation.isPending}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Warning banner for missing API key */}
          {isApiKeyMissing && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                ⚠️ {selectedModelConfig.envVar} is not set —{" "}
                {MODEL_OPTIONS.find((o) => o.value === model)?.label} will not work until this is configured in your environment.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3 - API Key Status */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            API Key Status
          </CardTitle>
          <CardDescription>
            Configuration status for AI provider API keys
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* GOOGLE_API_KEY */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <code className="rounded bg-muted px-2 py-0.5 text-xs">GOOGLE_API_KEY</code>
                <div className="text-sm text-muted-foreground">Required for Gemini</div>
              </div>
              <Badge variant={status?.googleApiKeyConfigured ? "default" : "destructive"}>
                {status?.googleApiKeyConfigured ? "✅ Configured" : "❌ Missing"}
              </Badge>
            </div>

            {/* ZAI_API_KEY */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <code className="rounded bg-muted px-2 py-0.5 text-xs">ZAI_API_KEY</code>
                <div className="text-sm text-muted-foreground">Required for GLM-5</div>
              </div>
              <Badge variant={status?.zaiApiKeyConfigured ? "default" : "destructive"}>
                {status?.zaiApiKeyConfigured ? "✅ Configured" : "❌ Missing"}
              </Badge>
            </div>

            {/* MOONSHOT_API_KEY */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <code className="rounded bg-muted px-2 py-0.5 text-xs">MOONSHOT_API_KEY</code>
                <div className="text-sm text-muted-foreground">Required for Kimi 2.5</div>
              </div>
              <Badge variant={status?.moonshotApiKeyConfigured ? "default" : "destructive"}>
                {status?.moonshotApiKeyConfigured ? "✅ Configured" : "❌ Missing"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
