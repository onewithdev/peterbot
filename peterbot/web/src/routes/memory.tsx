import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Brain, Save, Clock, Search, ChevronDown, FileText, Globe, AlertCircle, RefreshCw, Trash2, Plus } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { JobCard } from "@/components/job-card"
import { startOfToday, startOfWeek, startOfMonth } from "@/lib/utils"
import type { JobsResponse, ApiJob } from "@/types/job"

interface MemoryData {
  content: string
  lastModified: string | null
  size: number
  exists: boolean
}

interface Document {
  id: string
  name: string
  source: string
  type: "web" | "doc"
  summary: string | null
  tags: string | null
  content: string | null
  contentTruncated: boolean
  cachedAt: string | null
  lastFetchAttemptAt: string | null
  lastFetchError: string | null
  createdAt: string
}

interface DocumentsResponse {
  documents: Document[]
  total: number
}

type DateFilter = "all" | "today" | "week" | "month"

export const Route = createFileRoute("/memory")({
  component: MemoryPage,
})

function MemoryPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState("memory")

  // Memory editor state
  const [editedContent, setEditedContent] = useState("")
  const [showDialog, setShowDialog] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Job history state
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [displayCount, setDisplayCount] = useState(20)

  // Documents state
  const [newDocUrl, setNewDocUrl] = useState("")
  const [newDocName, setNewDocName] = useState("")
  const [refreshingDocId, setRefreshingDocId] = useState<string | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  // Fetch memory content
  const { data: memoryData, isLoading: isMemoryLoading } = useQuery<MemoryData>({
    queryKey: ["memory"],
    queryFn: async () => {
      const response = await api.memory.$get()
      return response.json()
    },
  })

  // Initialize edited content when data loads
  useEffect(() => {
    if (memoryData && !isInitialized) {
      setEditedContent(memoryData.content)
      setIsInitialized(true)
    }
  }, [memoryData, isInitialized])

  // Fetch jobs for job history
  const { data: jobsData, isLoading: isJobsLoading } = useQuery<JobsResponse>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const response = await api.jobs.$get()
      return response.json()
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  })

  // Fetch documents
  const { data: documentsData, isLoading: isDocumentsLoading } = useQuery<DocumentsResponse>({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await api.documents.$get()
      return response.json()
    },
  })

  const jobs: ApiJob[] = jobsData?.jobs ?? []
  const documents: Document[] = documentsData?.documents ?? []

  // Filter jobs based on search and date
  const filteredJobs = jobs.filter((job: ApiJob) => {
    const matchesSearch = searchTerm === "" || 
      job.input.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.output?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)

    let matchesDate = true
    const jobDate = new Date(job.createdAt)
    switch (dateFilter) {
      case "today":
        matchesDate = jobDate >= startOfToday()
        break
      case "week":
        matchesDate = jobDate >= startOfWeek()
        break
      case "month":
        matchesDate = jobDate >= startOfMonth()
        break
      default:
        matchesDate = true
    }

    return matchesSearch && matchesDate
  })

  // Pagination
  const displayedJobs = filteredJobs.slice(0, displayCount)
  const hasMore = filteredJobs.length > displayCount

  // Save memory mutation
  const saveMemoryMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.memory.$put({ json: { content } })
      if (!response.ok) throw new Error("Failed to save")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory"] })
      setShowDialog(false)
      toast.success("Memory saved successfully")
    },
    onError: () => {
      setShowDialog(false)
      toast.error("Failed to save memory")
    },
    onSettled: () => {
      setIsSaving(false)
    },
  })

  // Add document mutation
  const addDocumentMutation = useMutation({
    mutationFn: async ({ name, source }: { name: string; source: string }) => {
      const response = await api.documents.$post({ json: { name, source } })
      if (!response.ok) throw new Error("Failed to add document")
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      setNewDocUrl("")
      setNewDocName("")
      if (data.fetchSuccess) {
        toast.success(`Document "${data.document.name}" added successfully`)
      } else {
        toast.warning(`Document "${data.document.name}" added but fetch failed: ${data.fetchError}`)
      }
    },
    onError: (error) => {
      toast.error(`Failed to add document: ${error.message}`)
    },
  })

  // Refresh document mutation
  const refreshDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.documents[":id"].refresh.$post({ param: { id } })
      if (!response.ok) throw new Error("Failed to refresh document")
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      setRefreshingDocId(null)
      if (data.success) {
        toast.success(`Document "${data.document?.name ?? "Unknown"}" refreshed successfully`)
      } else {
        toast.error(`Failed to refresh: ${data.error}`)
      }
    },
    onError: (error) => {
      setRefreshingDocId(null)
      toast.error(`Failed to refresh document: ${error.message}`)
    },
  })

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.documents[":id"].$delete({ param: { id } })
      if (!response.ok) throw new Error("Failed to delete document")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      setDeletingDocId(null)
      toast.success("Document deleted successfully")
    },
    onError: (error) => {
      setDeletingDocId(null)
      toast.error(`Failed to delete document: ${error.message}`)
    },
  })

  const hasChanges = memoryData && editedContent !== memoryData.content

  const handleSave = () => {
    setShowDialog(true)
  }

  const handleConfirmSave = () => {
    setIsSaving(true)
    saveMemoryMutation.mutate(editedContent)
  }

  const handleExpandJob = (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId)
  }

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 20)
  }

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDocUrl.trim()) return

    // Generate name from URL if not provided
    let name = newDocName.trim()
    if (!name) {
      try {
        const url = new URL(newDocUrl)
        const pathParts = url.pathname.split("/").filter(Boolean)
        name = pathParts[pathParts.length - 1] || url.hostname || "Saved Document"
        name = name.replace(/\.(html?|md|txt|pdf)$/i, "").replace(/[_-]/g, " ")
        name = name.charAt(0).toUpperCase() + name.slice(1)
      } catch {
        name = newDocUrl.slice(0, 50)
      }
    }

    addDocumentMutation.mutate({ name, source: newDocUrl })
  }

  const handleRefreshDocument = (id: string) => {
    setRefreshingDocId(id)
    refreshDocumentMutation.mutate(id)
  }

  const handleDeleteDocument = (id: string) => {
    setDeletingDocId(id)
    deleteDocumentMutation.mutate(id)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6 h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memory</h1>
          <p className="text-muted-foreground">
            Manage what peterbot remembers about you
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100%-5rem)]">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="memory" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Job History
          </TabsTrigger>
        </TabsList>

        {/* Memory Tab */}
        <TabsContent value="memory" className="h-[calc(100%-3rem)] mt-4">
          <Card className="flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Memory Editor
                </CardTitle>
                <CardDescription>
                  Edit permanent facts and user preferences
                </CardDescription>
              </div>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {isMemoryLoading ? (
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
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="h-[calc(100%-3rem)] mt-4">
          <div className="space-y-4 h-full flex flex-col">
            {/* Add Document Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" />
                  Add Document
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            {/* Documents List */}
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">Saved Documents</CardTitle>
                <CardDescription>
                  {documents.length} document{documents.length !== 1 ? "s" : ""} saved
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
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
                          ) : (
                            <FileText className="h-5 w-5 text-green-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-sm">{doc.name}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {doc.type === "web" ? "web" : "doc"}
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
        </TabsContent>

        {/* Job History Tab */}
        <TabsContent value="jobs" className="h-[calc(100%-3rem)] mt-4">
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
            <CardContent className="flex-1 flex flex-col">
              {/* Search and Filter Controls */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="relative">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                    className="h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="all">All time</option>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Job List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {isJobsLoading ? (
                  <div className="flex h-64 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading jobs...</p>
                  </div>
                ) : displayedJobs.length === 0 ? (
                  <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                    <p className="text-sm text-muted-foreground">
                      {searchTerm || dateFilter !== "all" 
                        ? "No jobs match your filters" 
                        : "No job history yet"}
                    </p>
                  </div>
                ) : (
                  <>
                    {displayedJobs.map((job: ApiJob) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        isExpanded={expandedJobId === job.id}
                        onExpand={() => handleExpandJob(job.id)}
                      />
                    ))}
                    
                    {hasMore && (
                      <div className="flex justify-center pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleLoadMore}
                        >
                          Load More
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
  )
}
