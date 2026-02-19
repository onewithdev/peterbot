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
import { Sparkles, Save, Columns } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { api } from "@/lib/api";

interface SoulData {
  content: string;
  lastModified: string | null;
  size: number;
  exists: boolean;
}

export function SoulTab() {
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);

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
    <div className="space-y-4">
      {/* Header with Save and Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Soul</h2>
          <p className="text-sm text-muted-foreground">
            Configure peterbot&apos;s personality and communication style
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSplitView(!isSplitView)}
            className="gap-2"
          >
            <Columns className="h-4 w-4" />
            {isSplitView ? "Edit Only" : "Split View"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            size="sm"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Content - Single or Split View */}
      {isSplitView ? (
        <div className="grid grid-cols-2 gap-4">
          {/* Left Pane - Editor */}
          <Card className="flex flex-col">
            <CardHeader className="py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Editor
              </CardTitle>
              <CardDescription>
                Edit the personality configuration in Markdown
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[400px] resize-none font-mono text-sm"
                  placeholder="Enter personality configuration..."
                />
              )}
            </CardContent>
          </Card>

          {/* Right Pane - Preview */}
          <Card className="flex flex-col">
            <CardHeader className="py-4">
              <CardTitle className="text-base">Preview</CardTitle>
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
      ) : (
        /* Edit Only View */
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Editor
            </CardTitle>
            <CardDescription>
              Edit the personality configuration in Markdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[400px] resize-none font-mono text-sm"
                placeholder="Enter personality configuration..."
              />
            )}
          </CardContent>
        </Card>
      )}

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
