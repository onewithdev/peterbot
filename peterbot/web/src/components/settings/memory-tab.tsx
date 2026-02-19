import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Brain, Save, FileText, Globe, AlertCircle, RefreshCw, Trash2, Plus, Upload, Link2 } from "lucide-react";
import { FileUpload } from "@/components/documents/file-upload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface MemoryData {
  content: string;
  lastModified: string | null;
  size: number;
  exists: boolean;
}

interface Document {
  id: string;
  name: string;
  source: string;
  type: "web" | "doc" | "upload";
  summary: string | null;
  tags: string | null;
  content: string | null;
  contentTruncated: boolean;
  cachedAt: string | null;
  lastFetchAttemptAt: string | null;
  lastFetchError: string | null;
  createdAt: string;
}

interface DocumentsResponse {
  documents: Document[];
  total: number;
}

export function MemoryTab() {
  const queryClient = useQueryClient();

  // Memory editor state
  const [editedContent, setEditedContent] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Documents state
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocName, setNewDocName] = useState("");
  const [refreshingDocId, setRefreshingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Fetch memory content
  const { data: memoryData, isLoading: isMemoryLoading } = useQuery<MemoryData>({
    queryKey: ["memory"],
    queryFn: async () => {
      const response = await api.memory.$get();
      return response.json();
    },
  });

  // Initialize edited content when data loads
  useEffect(() => {
    if (memoryData && !isInitialized) {
      setEditedContent(memoryData.content);
      setIsInitialized(true);
    }
  }, [memoryData, isInitialized]);

  // Fetch documents
  const { data: documentsData, isLoading: isDocumentsLoading } = useQuery<DocumentsResponse>({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await api.documents.$get();
      return response.json();
    },
  });

  const documents: Document[] = documentsData?.documents ?? [];

  // Save memory mutation
  const saveMemoryMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.memory.$put({ json: { content } });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      setShowDialog(false);
      toast.success("Memory saved successfully");
    },
    onError: () => {
      setShowDialog(false);
      toast.error("Failed to save memory");
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  // Add document mutation
  const addDocumentMutation = useMutation({
    mutationFn: async ({ name, source }: { name: string; source: string }) => {
      const response = await api.documents.$post({ json: { name, source } });
      if (!response.ok) throw new Error("Failed to add document");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setNewDocUrl("");
      setNewDocName("");
      if (data.fetchSuccess) {
        toast.success(`Document "${data.document.name}" added successfully`);
      } else {
        toast.warning(`Document "${data.document.name}" added but fetch failed: ${data.fetchError}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to add document: ${error.message}`);
    },
  });

  // Refresh document mutation
  const refreshDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.documents[":id"].refresh.$post({ param: { id } });
      if (!response.ok) throw new Error("Failed to refresh document");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setRefreshingDocId(null);
      if (data.success) {
        toast.success(`Document "${data.document?.name ?? "Unknown"}" refreshed successfully`);
      } else {
        toast.error(`Failed to refresh: ${data.error}`);
      }
    },
    onError: (error: Error) => {
      setRefreshingDocId(null);
      toast.error(`Failed to refresh document: ${error.message}`);
    },
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.documents[":id"].$delete({ param: { id } });
      if (!response.ok) throw new Error("Failed to delete document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setDeletingDocId(null);
      toast.success("Document deleted successfully");
    },
    onError: (error: Error) => {
      setDeletingDocId(null);
      toast.error(`Failed to delete document: ${error.message}`);
    },
  });

  const hasChanges = memoryData && editedContent !== memoryData.content;

  const handleSave = () => {
    setShowDialog(true);
  };

  const handleConfirmSave = () => {
    setIsSaving(true);
    saveMemoryMutation.mutate(editedContent);
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocUrl.trim()) return;

    // Generate name from URL if not provided
    let name = newDocName.trim();
    if (!name) {
      try {
        const url = new URL(newDocUrl);
        const pathParts = url.pathname.split("/").filter(Boolean);
        name = pathParts[pathParts.length - 1] || url.hostname || "Saved Document";
        name = name.replace(/\.(html?|md|txt|pdf)$/i, "").replace(/[_-]/g, " ");
        name = name.charAt(0).toUpperCase() + name.slice(1);
      } catch {
        name = newDocUrl.slice(0, 50);
      }
    }

    addDocumentMutation.mutate({ name, source: newDocUrl });
  };

  const handleRefreshDocument = (id: string) => {
    setRefreshingDocId(id);
    refreshDocumentMutation.mutate(id);
  };

  const handleDeleteDocument = (id: string) => {
    setDeletingDocId(id);
    deleteDocumentMutation.mutate(id);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Section A - Memory Editor */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              Memory Editor
            </CardTitle>
            <CardDescription>
              Edit permanent facts and user preferences
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="sm"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </CardHeader>
        <CardContent>
          {isMemoryLoading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[200px] resize-none font-mono text-sm"
              placeholder="Enter memory facts..."
            />
          )}
        </CardContent>
      </Card>

      {/* Section B - Documents */}
      <div className="space-y-4">
        {/* Add Document Tabs */}
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Add Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="url" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  From URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4">
                <form onSubmit={handleAddDocument} className="flex gap-2">
                  <Input
                    placeholder="URL or Google Drive link"
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Name (optional)"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    className="w-48"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newDocUrl.trim() || addDocumentMutation.isPending}
                  >
                    {addDocumentMutation.isPending ? "Adding..." : "Add"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="upload">
                <FileUpload
                  onUpload={(file, name) => uploadMutation.mutateAsync({ file, name })}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Saved Documents</CardTitle>
            <CardDescription>
              {documents.length} document{documents.length !== 1 ? "s" : ""} saved
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isDocumentsLoading ? (
              <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  No documents saved yet. Add a URL above to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 p-3 rounded-lg border"
                  >
                    <div className="mt-0.5">
                      {doc.type === "web" ? (
                        <Globe className="h-5 w-5 text-blue-500" />
                      ) : doc.type === "upload" ? (
                        <Upload className="h-5 w-5 text-purple-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm">{doc.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {doc.type === "web" ? "web" : doc.type === "upload" ? "upload" : "doc"}
                        </Badge>
                        {doc.contentTruncated && (
                          <Badge variant="outline" className="text-xs text-amber-600">
                            truncated
                          </Badge>
                        )}
                        {doc.lastFetchError && (
                          <Badge variant="outline" className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            error
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {doc.source}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Saved: {formatDate(doc.createdAt)}</span>
                        {doc.cachedAt && (
                          <span>Cached: {formatDate(doc.cachedAt)}</span>
                        )}
                      </div>
                      {doc.lastFetchError && (
                        <p className="text-xs text-red-600 mt-2">
                          Error: {doc.lastFetchError}
                        </p>
                      )}
                      {doc.summary && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {doc.summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRefreshDocument(doc.id)}
                        disabled={refreshingDocId === doc.id}
                        title="Refresh document"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshingDocId === doc.id ? "animate-spin" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={deletingDocId === doc.id}
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <Button onClick={handleConfirmSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Confirm Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
