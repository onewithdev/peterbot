import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Brain, Save, Clock, Search, ChevronDown } from "lucide-react"
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

type DateFilter = "all" | "today" | "week" | "month"

export const Route = createFileRoute("/memory")({
  component: MemoryPage,
})

function MemoryPage() {
  const queryClient = useQueryClient()

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

  const jobs: ApiJob[] = jobsData?.jobs ?? []

  // Filter jobs based on search and date
  const filteredJobs = jobs.filter((job: ApiJob) => {
    // Search filter
    const matchesSearch = searchTerm === "" || 
      job.input.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.output?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)

    // Date filter
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

  // Save mutation
  const handleSave = () => {
    setShowDialog(true)
  }

  const handleConfirmSave = () => {
    setIsSaving(true)
    // Use the API client to save
    api.memory.$put({
      json: { content: editedContent },
    }).then((response) => {
      if (!response.ok) {
        throw new Error("Failed to save")
      }
      return response.json()
    }).then(() => {
      // Invalidate memory query to refresh cached data
      queryClient.invalidateQueries({ queryKey: ['memory'] })
      setShowDialog(false)
      toast.success("Memory saved successfully")
    }).catch(() => {
      setShowDialog(false)
      toast.error("Failed to save memory")
    }).finally(() => {
      setIsSaving(false)
    })
  }

  const hasChanges = memoryData && editedContent !== memoryData.content

  const handleExpandJob = (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId)
  }

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 20)
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
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
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

        {/* Right Pane - Job History */}
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
              Confirm Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
