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
import { Sparkles, Save } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";

export const Route = createFileRoute("/soul")({
  component: SoulPage,
});

interface SoulData {
  content: string;
  lastModified: string | null;
  size: number;
  exists: boolean;
}

function SoulPage() {
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch soul content
  const { data, isLoading } = useQuery<SoulData>({
    queryKey: ["soul"],
    queryFn: async () => {
      const response = await api.soul.$get();
      const result = await response.json();
      return result;
    },
  });

  // Initialize edited content when data loads
  useEffect(() => {
    if (data && !isInitialized) {
      setEditedContent(data.content);
      setPreviewContent(data.content);
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.soul.$put({
        json: { content },
      });
      if (!response.ok) {
        throw new Error("Failed to save");
      }
      return response.json();
    },
    onSuccess: () => {
      setPreviewContent(editedContent);
      setShowDialog(false);
      queryClient.invalidateQueries({ queryKey: ["soul"] });
      toast.success("Personality saved successfully");
    },
    onError: () => {
      setShowDialog(false);
      toast.error("Failed to save personality");
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
          <h1 className="text-3xl font-bold tracking-tight">Soul</h1>
          <p className="text-muted-foreground">
            Configure peterbot&apos;s personality and communication style
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
              <Sparkles className="h-5 w-5" />
              Editor
            </CardTitle>
            <CardDescription>
              Edit the personality configuration in Markdown
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
                placeholder="Enter personality configuration..."
              />
            )}
          </CardContent>
        </Card>

        {/* Right Pane - Preview */}
        <Card className="flex flex-col h-full">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Last saved version (updates on save)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{previewContent || "No content saved yet"}</ReactMarkdown>
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
              This will update the personality configuration used by peterbot for all future conversations.
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
