import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Activity, Pause, Play, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { JobCard } from "@/components/job-card"
import { api } from "@/lib/api"
import { formatTimeAgo } from "@/lib/utils"
import type { JobsResponse, ApiJob } from "@/types/job"

// Define search params type
interface MonitorSearch {
  tab?: string
  expand?: string
}

export const Route = createFileRoute("/monitor")({
  component: MonitorPage,
  validateSearch: (search: Record<string, unknown>): MonitorSearch => {
    return {
      tab: search.tab as string | undefined,
      expand: search.expand as string | undefined,
    }
  },
})

function MonitorPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ from: "/monitor" }) as MonitorSearch
  
  // State for pause/resume and expanded job
  const [isPaused, setIsPaused] = useState(false)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(search.expand || null)
  const [jobToCancel, setJobToCancel] = useState<ApiJob | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Get active tab from URL or default to "active"
  const activeTab = search.tab || "active"

  // Fetch jobs with conditional auto-refresh
  const { data: jobsData, isLoading, refetch } = useQuery<JobsResponse>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const response = await api.jobs.$get()
      const data = await response.json()
      setLastRefresh(new Date())
      return data
    },
    refetchInterval: isPaused ? false : 15000,
    refetchIntervalInBackground: false,
  })

  const jobs: ApiJob[] = jobsData?.jobs ?? []

  // Cancel job mutation
  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.jobs[":id"].cancel.$post({
        param: { id: jobId },
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to cancel job")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] })
      toast.success("Job cancelled successfully")
      setJobToCancel(null)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel job")
      setJobToCancel(null)
    },
  })

  // Filter jobs based on active tab
  const filteredJobs = jobs.filter((job: ApiJob) => {
    switch (activeTab) {
      case "active":
        return job.status === 'running'
      case "pending":
        return job.status === 'pending'
      case "completed":
        return job.status === 'completed'
      case "failed":
        return job.status === 'failed'
      default:
        return job.status === 'running'
    }
  })

  // Get counts for each tab
  const counts = {
    active: jobs.filter((j: ApiJob) => j.status === 'running').length,
    pending: jobs.filter((j: ApiJob) => j.status === 'pending').length,
    completed: jobs.filter((j: ApiJob) => j.status === 'completed').length,
    failed: jobs.filter((j: ApiJob) => j.status === 'failed').length,
  }

  const handleTabChange = (value: string) => {
    navigate({ to: "/monitor", search: { tab: value } })
  }

  const handleRefresh = () => {
    refetch()
  }

  const handleTogglePause = () => {
    setIsPaused(!isPaused)
    if (isPaused) {
      toast.info("Auto-refresh resumed")
    } else {
      toast.info("Auto-refresh paused")
    }
  }

  const handleExpandJob = (jobId: string) => {
    setExpandedJobId(expandedJobId === jobId ? null : jobId)
  }

  const handleCancelClick = (job: ApiJob) => {
    setJobToCancel(job)
  }

  const handleConfirmCancel = () => {
    if (jobToCancel) {
      cancelMutation.mutate(jobToCancel.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitor</h1>
          <p className="text-muted-foreground">
            Track job status and system health
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last refresh: {formatTimeAgo(lastRefresh)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePause}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Job Monitor
          </CardTitle>
          <CardDescription>
            Real-time job tracking and management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="active" className="gap-2">
                Active
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                  {counts.active}
                </span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-2">
                Pending
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                  {counts.pending}
                </span>
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                Completed
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                  {counts.completed}
                </span>
              </TabsTrigger>
              <TabsTrigger value="failed" className="gap-2">
                Failed
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                  {counts.failed}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              <JobList 
                jobs={filteredJobs} 
                isLoading={isLoading}
                expandedJobId={expandedJobId}
                onExpandJob={handleExpandJob}
                onCancelJob={handleCancelClick}
                showActions
                emptyMessage="No active jobs"
              />
            </TabsContent>
            <TabsContent value="pending" className="mt-4">
              <JobList 
                jobs={filteredJobs} 
                isLoading={isLoading}
                expandedJobId={expandedJobId}
                onExpandJob={handleExpandJob}
                onCancelJob={handleCancelClick}
                showActions
                emptyMessage="No pending jobs"
              />
            </TabsContent>
            <TabsContent value="completed" className="mt-4">
              <JobList 
                jobs={filteredJobs} 
                isLoading={isLoading}
                expandedJobId={expandedJobId}
                onExpandJob={handleExpandJob}
                emptyMessage="No completed jobs"
              />
            </TabsContent>
            <TabsContent value="failed" className="mt-4">
              <JobList 
                jobs={filteredJobs} 
                isLoading={isLoading}
                expandedJobId={expandedJobId}
                onExpandJob={handleExpandJob}
                emptyMessage="No failed jobs"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={jobToCancel !== null} onOpenChange={() => setJobToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Job?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this job? This action cannot be undone.
              {jobToCancel && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <span className="font-mono text-xs">{jobToCancel.id.slice(0, 8)}</span>
                  <p className="mt-1 text-foreground">{truncateText(jobToCancel.input, 80)}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobToCancel(null)}>
              No, Keep It
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface JobListProps {
  jobs: ApiJob[]
  isLoading: boolean
  expandedJobId: string | null
  onExpandJob: (jobId: string) => void
  onCancelJob?: (job: ApiJob) => void
  showActions?: boolean
  emptyMessage: string
}

function JobList({ 
  jobs, 
  isLoading, 
  expandedJobId, 
  onExpandJob, 
  onCancelJob,
  showActions = false,
  emptyMessage 
}: JobListProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading jobs...</p>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
      {jobs.map((job: ApiJob) => (
        <JobCard
          key={job.id}
          job={job}
          isExpanded={expandedJobId === job.id}
          showActions={showActions}
          onExpand={() => onExpandJob(job.id)}
          onCancel={() => onCancelJob?.(job)}
        />
      ))}
    </div>
  )
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.slice(0, maxLength) + '...'
}
