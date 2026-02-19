import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Archive, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { SessionsResponse, ApiSession, ConfigResponse } from "@/types/session";

export function CompactionTab() {
  const queryClient = useQueryClient();

  // State
  const [thresholdInput, setThresholdInput] = useState("");
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Fetch sessions
  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery<SessionsResponse>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const response = await api.sessions.$get();
      return response.json();
    },
  });

  const sessions: ApiSession[] = sessionsData?.sessions ?? [];

  // Fetch config
  const { data: configData, isLoading: isLoadingConfig } = useQuery<ConfigResponse | null>({
    queryKey: ["config", "compaction_threshold"],
    queryFn: async () => {
      const response = await api.config[":key"].$get({
        param: { key: "compaction_threshold" },
      });
      if (!response.ok) {
        return null;
      }
      return response.json() as Promise<ConfigResponse>;
    },
  });

  // Initialize threshold input when config loads
  useEffect(() => {
    if (configData && 'value' in configData && configData.value) {
      setThresholdInput(configData.value);
    }
  }, [configData]);

  // Save threshold mutation
  const saveMutation = useMutation({
    mutationFn: async (value: string) => {
      const response = await api.config[":key"].$put({
        param: { key: "compaction_threshold" },
        json: { value },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error("Failed to save threshold");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config", "compaction_threshold"] });
      toast.success("Threshold saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save threshold");
    },
  });

  const handleSaveThreshold = () => {
    if (!thresholdInput.trim()) {
      toast.error("Threshold is required");
      return;
    }
    saveMutation.mutate(thresholdInput);
  };

  const toggleExpanded = (sessionId: string) => {
    setExpandedSessionId(expandedSessionId === sessionId ? null : sessionId);
  };

  return (
    <div className="space-y-6">
      {/* Compaction Threshold Card */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Compaction Threshold</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Compact after</span>
            <Input
              type="number"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              disabled={isLoadingConfig || saveMutation.isPending}
              className="w-24"
              min="1"
            />
            <span className="text-sm text-muted-foreground">messages</span>
            <Button
              onClick={handleSaveThreshold}
              disabled={isLoadingConfig || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Archive className="h-4 w-4" />
          COMPACTED SESSIONS ({sessions.length})
        </h3>

        {isLoadingSessions ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">No sessions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: ApiSession) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {session.triggerJobId?.slice(0, 8) ?? "—"}
                      </code>
                      <span className="text-sm text-muted-foreground">
                        {session.messageCount} messages compacted ·{" "}
                        {formatDate(new Date(session.createdAt))}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(session.id)}
                    >
                      {expandedSessionId === session.id ? (
                        <>
                          Hide Summary <ChevronUp className="ml-1 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          View Summary <ChevronDown className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                  {expandedSessionId === session.id && (
                    <div className="mt-4 rounded-md bg-muted p-4 text-sm">
                      {session.summary}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
