import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Save, Eye, Pencil } from "lucide-react";
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
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPreview, setIsPreview] = useState(true);

  const { data, isLoading } = useQuery<SoulData>({
    queryKey: ["soul"],
    queryFn: async () => {
      const response = await api.soul.$get();
      return response.json();
    },
  });

  useEffect(() => {
    if (data && !isInitialized) {
      setEditedContent(data.content);
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.soul.$put({ json: { content } });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      setShowSaveDialog(false);
      queryClient.invalidateQueries({ queryKey: ["soul"] });
      toast.success("Personality saved successfully");
    },
    onError: () => {
      setShowSaveDialog(false);
      toast.error("Failed to save personality");
    },
  });

  const hasChanges = data && editedContent !== data.content;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Soul</h2>
            <p className="text-sm text-muted-foreground">
              Configure peterbot&apos;s personality and communication style
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={!hasChanges || saveMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save Changes</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsPreview(!isPreview)}
                >
                  {isPreview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPreview ? "Edit" : "Preview"}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              {isPreview ? "Preview" : "Editor"}
            </CardTitle>
            <CardDescription>
              {isPreview
                ? "Live preview of your personality configuration"
                : "Edit the personality configuration in Markdown"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : isPreview ? (
              <div className="prose prose-sm dark:prose-invert max-w-none min-h-[400px]">
                <ReactMarkdown>{editedContent || "No content yet"}</ReactMarkdown>
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

        {/* Save Confirmation Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Changes?</DialogTitle>
              <DialogDescription>
                This will update the personality configuration used by peterbot for all future conversations.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate(editedContent)}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : "Confirm Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
