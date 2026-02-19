import { useState, useMemo } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { History, Search } from "lucide-react";
import { JobCard } from "@/components/job-card";
import { api } from "@/lib/api";
import type { JobsResponse, ApiJob } from "@/types/job";

// Define search params type
interface JobsHistorySearch {
  expand?: string;
}

type DateFilter = "all" | "today" | "week" | "month";

const JOBS_PER_PAGE = 20;

export function JobHistoryTab() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/jobs/history" }) as JobsHistorySearch;

  // Local state
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(search.expand || null);
  const [displayCount, setDisplayCount] = useState(JOBS_PER_PAGE);

  // Fetch jobs (no auto-refresh for history)
  const { data: jobsData, isLoading } = useQuery<JobsResponse>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const response = await api.jobs.$get();
      return response.json();
    },
  });

  const jobs: ApiJob[] = jobsData?.jobs ?? [];

  // Filter jobs to completed + failed only, then apply search and date filters
  const filteredJobs = useMemo(() => {
    // First filter to completed/failed only
    let result = jobs.filter((job: ApiJob) => {
      return job.status === 'completed' || job.status === 'failed';
    });

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      result = result.filter((job: ApiJob) => {
        const jobDate = new Date(job.createdAt);
        
        switch (dateFilter) {
          case "today":
            return jobDate >= startOfDay;
          case "week": {
            const startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            return jobDate >= startOfWeek;
          }
          case "month": {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return jobDate >= startOfMonth;
          }
          default:
            return true;
        }
      });
    }

    // Apply search filter (searches in input and output text)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter((job: ApiJob) => {
        const inputMatch = job.input.toLowerCase().includes(term);
        const outputMatch = job.output?.toLowerCase().includes(term) ?? false;
        return inputMatch || outputMatch;
      });
    }

    return result;
  }, [jobs, searchTerm, dateFilter]);

  // Paginated jobs
  const displayedJobs = useMemo(() => {
    return filteredJobs.slice(0, displayCount);
  }, [filteredJobs, displayCount]);

  const hasMore = displayedJobs.length < filteredJobs.length;

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + JOBS_PER_PAGE);
  };

  const handleExpandJob = (jobId: string) => {
    const newExpandedId = expandedJobId === jobId ? null : jobId;
    setExpandedJobId(newExpandedId);
    
    // Update URL search param
    if (newExpandedId) {
      navigate({ 
        to: "/jobs/history", 
        search: { expand: newExpandedId } 
      });
    } else {
      navigate({ 
        to: "/jobs/history", 
        search: {} 
      });
    }
  };

  // Get empty state message based on filters
  const getEmptyMessage = () => {
    if (searchTerm.trim() || dateFilter !== "all") {
      return "No jobs match your filters";
    }
    return "No job history yet";
  };

  return (
    <div className="space-y-4">
      {/* Filters Header */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in input/output..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setDisplayCount(JOBS_PER_PAGE); // Reset pagination on search
            }}
            className="pl-9"
          />
        </div>
        <select
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value as DateFilter);
            setDisplayCount(JOBS_PER_PAGE); // Reset pagination on filter change
          }}
          className="h-9 w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Job History
          </CardTitle>
          <CardDescription>
            Completed and failed jobs ({filteredJobs.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobList
            jobs={displayedJobs}
            isLoading={isLoading}
            expandedJobId={expandedJobId}
            onExpandJob={handleExpandJob}
            emptyMessage={getEmptyMessage()}
          />
          
          {/* Load More Button */}
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                className="w-full sm:w-auto"
              >
                Load More ({filteredJobs.length - displayedJobs.length} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface JobListProps {
  jobs: ApiJob[];
  isLoading: boolean;
  expandedJobId: string | null;
  onExpandJob: (jobId: string) => void;
  emptyMessage: string;
}

function JobList({
  jobs,
  isLoading,
  expandedJobId,
  onExpandJob,
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
          onExpand={() => onExpandJob(job.id)}
        />
      ))}
    </div>
  );
}
