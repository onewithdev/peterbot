import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, CheckCircle, Clock, XCircle, Bot, Cpu } from "lucide-react"
import { JobCard } from "@/components/job-card"
import { api } from "@/lib/api"
import type { JobsResponse, ApiJob } from "@/types/job"

export const Route = createFileRoute("/")({
  component: OverviewPage,
})

function OverviewPage() {
  const navigate = useNavigate()
  
  // Fetch jobs with auto-refresh
  const { data: jobsData, isLoading } = useQuery<JobsResponse>({
    queryKey: ["jobs"],
    queryFn: async () => {
      const response = await api.jobs.$get()
      return response.json()
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  })

  const jobs: ApiJob[] = jobsData?.jobs ?? []
  
  // Calculate stats
  const stats = {
    active: jobs.filter((j: ApiJob) => j.status === 'running').length,
    pending: jobs.filter((j: ApiJob) => j.status === 'pending').length,
    completed: jobs.filter((j: ApiJob) => j.status === 'completed').length,
    failed: jobs.filter((j: ApiJob) => j.status === 'failed').length,
  }

  // Get recent jobs (last 5)
  const recentJobs = jobs.slice(0, 5)

  const handleStatClick = (tab: string) => {
    navigate({ to: "/monitor", search: { tab } })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Monitor your peterbot status and recent activity
        </p>
      </div>

      {/* System Health Section */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Current status of system components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Bot className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Telegram Bot</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span className="text-green-500">✅</span> Connected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Cpu className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Worker</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span className="text-green-500">✅</span> Running
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Running Jobs"
          value={isLoading ? "..." : stats.active.toString()}
          description="Currently processing"
          icon={Activity}
          onClick={() => handleStatClick("active")}
          clickable
        />
        <StatCard
          title="Pending"
          value={isLoading ? "..." : stats.pending.toString()}
          description="In queue"
          icon={Clock}
          onClick={() => handleStatClick("pending")}
          clickable
        />
        <StatCard
          title="Completed"
          value={isLoading ? "..." : stats.completed.toString()}
          description="Successfully finished"
          icon={CheckCircle}
          onClick={() => handleStatClick("completed")}
          clickable
        />
        <StatCard
          title="Failed"
          value={isLoading ? "..." : stats.failed.toString()}
          description="Need attention"
          icon={XCircle}
          onClick={() => handleStatClick("failed")}
          clickable
        />
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
          <CardDescription>Your most recent tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job: ApiJob) => {
                // Map job status to monitor tab
                const tabMap: Record<string, string> = {
                  running: 'active',
                  pending: 'pending',
                  completed: 'completed',
                  failed: 'failed',
                }
                const tab = tabMap[job.status] || 'active'
                return (
                  <JobCard 
                    key={job.id} 
                    job={job}
                    onExpand={() => navigate({ to: "/monitor", search: { expand: job.id, tab } })}
                  />
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  clickable?: boolean
}

function StatCard({ title, value, description, icon: Icon, onClick, clickable }: StatCardProps) {
  return (
    <Card 
      className={clickable ? "cursor-pointer transition-shadow hover:shadow-md" : ""}
      onClick={clickable ? onClick : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
