import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Brain, Save, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const Route = createFileRoute("/memory")({
  component: MemoryPage,
});

interface MemoryData {
  content: string;
  lastModified: string | null;
  size: number;
  exists: boolean;
}

function MemoryPage() {
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch memory content
  const { data, isLoading } = useQuery<MemoryData>({
    queryKey: ["memory"],
    queryFn: async () => {
      const response = await api.memory.$get();
      const result = await response.json();
      return result;
    },
  });

  // Initialize edited content when data loads
  useEffect(() => {
    if (data && !isInitialized) {
      setEditedContent(data.content);
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.memory.$put({
        json: { content },
      });
      if (!response.ok) {
        throw new Error("Failed to save");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowDialog(false);
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      toast.success("Memory saved successfully");
    },
    onError: () => {
      setShowDialog(false);
      toast.error("Failed to save memory");
    },
  });

  const handleSave = () => {
    setShowDialog(true);
  };

  const handleConfirmSave = () => {
    saveMutation.mutate(editedContent);
  };

  const hasChanges = data && editedContent !== data.content;

  return (
    <div className="space-y-6 h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memory</h1>
          <p className="text-muted-foreground">
            Manage what peterbot remembers about you
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6 h-[calc(100%-5rem)]">
        {/* Left Pane - Editor */}
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Memory Editor
            </CardTitle>
            <CardDescription>
              Edit permanent facts and user preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="flex-1 resize-none font-mono text-sm"
                placeholder="Enter memory facts..."
              />
            )}
          </CardContent>
        </Card>

        {/* Right Pane - Job History Placeholder */}
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Job History
            </CardTitle>
            <CardDescription>
              Recent background job executions
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">Job history coming in T4</p>
              <p className="text-xs text-muted-foreground">
                This feature will display recently executed background tasks and their results.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Changes?</DialogTitle>
            <DialogDescription>
              This will update the permanent memory used by peterbot for all future conversations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Confirm Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
