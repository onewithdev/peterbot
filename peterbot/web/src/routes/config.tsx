import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Shield, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const Route = createFileRoute("/config")({
  component: ConfigPage,
});

interface BlocklistData {
  enabled: boolean;
  strict: {
    patterns: string[];
    action: string;
    message: string;
  };
  warn: {
    patterns: string[];
    action: string;
    message: string;
  };
}

interface BlocklistResponse {
  data: BlocklistData;
  content: string;
  lastModified: string | null;
  size: number;
  exists: boolean;
}

function ConfigPage() {
  const queryClient = useQueryClient();
  const [patterns, setPatterns] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [fullData, setFullData] = useState<BlocklistData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // Store previous patterns for rollback on error
  const [previousPatterns, setPreviousPatterns] = useState<string[] | null>(null);

  // Fetch blocklist
  const { data, isLoading } = useQuery<BlocklistResponse>({
    queryKey: ["blocklist"],
    queryFn: async () => {
      const response = await api.blocklist.$get();
      const result = await response.json();
      return result;
    },
  });

  // Initialize patterns when data loads
  useEffect(() => {
    if (data && !isInitialized) {
      setPatterns(data.data.strict.patterns);
      setIsEnabled(data.data.enabled ?? true);
      setFullData(data.data);
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  // Save mutation for patterns
  const saveMutation = useMutation({
    mutationFn: async (updatedPatterns: string[]) => {
      if (!fullData) throw new Error("No data");

      const updatedData: BlocklistData = {
        ...fullData,
        strict: {
          ...fullData.strict,
          patterns: updatedPatterns,
        },
      };

      const response = await api.blocklist.$put({
        json: { content: JSON.stringify(updatedData, null, 2) },
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
      toast.success("Blocklist updated");
      // Clear previous patterns after successful save
      setPreviousPatterns(null);
    },
    onError: () => {
      toast.error("Failed to update blocklist");
      // Rollback to previous patterns on error
      if (previousPatterns !== null) {
        setPatterns(previousPatterns);
        setPreviousPatterns(null);
      }
    },
  });

  // Save mutation for enabled toggle
  const saveEnabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!fullData) throw new Error("No data");

      const updatedData: BlocklistData = {
        ...fullData,
        enabled,
      };

      const response = await api.blocklist.$put({
        json: { content: JSON.stringify(updatedData, null, 2) },
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocklist"] });
      toast.success(`Blocklist ${isEnabled ? "enabled" : "disabled"}`);
    },
    onError: () => {
      toast.error("Failed to update blocklist status");
      // Rollback toggle on error
      setIsEnabled((prev) => !prev);
    },
  });

  const handleAddPattern = () => {
    if (!newPattern.trim()) {
      setIsAdding(false);
      return;
    }

    // Capture previous patterns for potential rollback
    setPreviousPatterns(patterns);

    // Optimistic update
    const updatedPatterns = [...patterns, newPattern.trim()];
    setPatterns(updatedPatterns);
    setNewPattern("");
    setIsAdding(false);

    // Save to server
    saveMutation.mutate(updatedPatterns);
  };

  const handleRemovePattern = (index: number) => {
    // Capture previous patterns for potential rollback
    setPreviousPatterns(patterns);

    // Optimistic update
    const updatedPatterns = patterns.filter((_, i) => i !== index);
    setPatterns(updatedPatterns);

    // Save to server
    saveMutation.mutate(updatedPatterns);
  };

  const handleToggleEnabled = (checked: boolean) => {
    // Optimistic update
    setIsEnabled(checked);

    // Save to server
    saveEnabledMutation.mutate(checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPattern();
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setNewPattern("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground">
          Manage peterbot settings and security
        </p>
      </div>

      {/* Blocklist Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Command Blocklist</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="blocklist-toggle"
                checked={isEnabled}
                onCheckedChange={handleToggleEnabled}
                disabled={saveEnabledMutation.isPending}
              />
              <Label htmlFor="blocklist-toggle" className="text-sm text-muted-foreground">
                {isEnabled ? "Enabled" : "Disabled"}
              </Label>
            </div>
          </div>
          <CardDescription>
            Block dangerous commands from running in E2B sandbox
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pattern List */}
              {patterns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No patterns defined. Add patterns to block dangerous commands.
                </p>
              ) : (
                <div className="space-y-2">
                  {patterns.map((pattern, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md border px-3 py-2 group hover:bg-muted/50"
                    >
                      <code className="text-sm font-mono">{pattern}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemovePattern(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Pattern Input */}
              {isAdding ? (
                <div className="flex items-center gap-2 mt-3">
                  <Input
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleAddPattern}
                    placeholder="Enter regex pattern..."
                    className="font-mono text-sm"
                    autoFocus
                  />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 gap-2"
                  onClick={() => setIsAdding(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Pattern
                </Button>
              )}
            </div>
          )}

          {/* Block Message Display */}
          {fullData && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>Block message:</strong> {fullData.strict.message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
