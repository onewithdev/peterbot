import { useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { JobCard } from "@/components/job-card";
import { api } from "@/lib/api";
import { formatTimeAgo } from "@/lib/utils";
import type { JobsResponse, ApiJob } from "@/types/job";

// Define search params type
interface JobsSearch {
  expand?: string;
}

interface JobMonitorTabProps {
  lastRefresh: Date;
  setLastRefresh: (date: Date) => void;
}

export function JobMonitorTab({ lastRefresh, setLastRefresh }: JobMonitorTabProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/jobs" }) as JobsSearch;

  // State for pause/resume and expanded job
  const [isPaused, setIsPaused] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(search.expand || null);
  const [jobToCancel, setJobToCancel] = useState<ApiJob | null>(null);

  // Fetch jobs with conditional auto-refresh
  const { data: jobsData, isLoading, refetch } = useQuery<JobsResponse>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const response = await api.jobs.$get();
      const data = await response.json();
      setLastRefresh(new Date());
      return data;
    },
    refetchInterval: isPaused ? false : 15000,
    refetchIntervalInBackground: false,
  });

  const jobs: ApiJob[] = jobsData?.jobs ?? [];

  // Cancel job mutation
  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.jobs[":id"].cancel.$post({
        param: { id: jobId },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to cancel job");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job cancelled successfully");
      setJobToCancel(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel job");
      setJobToCancel(null);
    },
  });

  // Filter jobs to running + pending only
  const filteredJobs = jobs.filter((job: ApiJob) => {
    return job.status === 'running' || job.status === 'pending';
  });

  // Get counts for display
  const counts = {
    running: jobs.filter((j: ApiJob) => j.status === 'running').length,
    pending: jobs.filter((j: ApiJob) => j.status === 'pending').length,
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused) {
      toast.info("Auto-refresh resumed");
    } else {
      toast.info("Auto-refresh paused");
    }
  };

  const handleExpandJob = (jobId: string) => {
    const newExpandedId = expandedJobId === jobId ? null : jobId;
    setExpandedJobId(newExpandedId);
    
    // Update URL search param
    if (newExpandedId) {
      navigate({ 
        to: "/jobs", 
        search: { expand: newExpandedId } 
      });
    } else {
      navigate({ 
        to: "/jobs", 
        search: {} 
      });
    }
  };

  const handleCancelClick = (job: ApiJob) => {
    setJobToCancel(job);
  };

  const handleConfirmCancel = () => {
    if (jobToCancel) {
      cancelMutation.mutate(jobToCancel.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Refresh Controls Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{counts.running}</span> running
            {" · "}
            <span className="font-medium text-foreground">{counts.pending}</span> pending
          </span>
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
            Active Jobs
          </CardTitle>
          <CardDescription>
            Real-time tracking of running and pending jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobList
            jobs={filteredJobs}
            isLoading={isLoading}
            expandedJobId={expandedJobId}
            onExpandJob={handleExpandJob}
            onCancelJob={handleCancelClick}
            showActions
            emptyMessage="No active jobs"
          />
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
  );
}

interface JobListProps {
  jobs: ApiJob[];
  isLoading: boolean;
  expandedJobId: string | null;
  onExpandJob: (jobId: string) => void;
  onCancelJob?: (job: ApiJob) => void;
  showActions?: boolean;
  emptyMessage: string;
}

function JobList({
  jobs,
  isLoading,
  expandedJobId,
  onExpandJob,
  onCancelJob,
  showActions = false,
  emptyMessage,
}: JobListProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading jobs...</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
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
  );
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}
