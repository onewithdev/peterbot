import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  formatTimeAgo, 
  formatElapsedTime, 
  getStatusIcon, 
  getStatusColor,
  truncateText 
} from "@/lib/utils"
import type { ApiJob } from "@/types/job"

interface JobCardProps {
  job: ApiJob
  isExpanded?: boolean
  showActions?: boolean
  onExpand?: () => void
  onCancel?: () => void
}

export function JobCard({ 
  job, 
  isExpanded = false, 
  showActions = false,
  onExpand,
  onCancel 
}: JobCardProps) {
  const isActive = job.status === 'running' || job.status === 'pending'
  const createdAt = new Date(job.createdAt)
  
  return (
    <Card 
      className={`cursor-pointer transition-shadow hover:shadow-md ${isExpanded ? 'ring-2 ring-primary' : ''}`}
      onClick={onExpand}
    >
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg" title={job.status}>
              {getStatusIcon(job.status)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {job.id.slice(0, 8)}
                </span>
                <span className={`text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isActive && job.status === 'running' 
                  ? formatElapsedTime(createdAt)
                  : formatTimeAgo(createdAt)
                }
              </p>
            </div>
          </div>
          
          {showActions && isActive && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2 text-xs shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onCancel?.()
              }}
            >
              Cancel
            </Button>
          )}
        </div>

        {/* Input Preview */}
        <div className="mt-3">
          <p className="text-sm text-foreground">
            {isExpanded 
              ? job.input 
              : truncateText(job.input, 60)
            }
          </p>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 space-y-3 border-t pt-3">
            {job.output && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Output:</p>
                <p className="text-sm text-foreground bg-muted p-2 rounded">
                  {job.output}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Type:</span> {job.type}
              </div>
              <div>
                <span className="font-medium">Delivered:</span> {job.delivered ? 'Yes' : 'No'}
              </div>
              {job.retryCount > 0 && (
                <div>
                  <span className="font-medium">Retries:</span> {job.retryCount}
                </div>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Created:</span>{' '}
              {createdAt.toLocaleString()}
            </div>
            
            {job.updatedAt && job.updatedAt !== job.createdAt && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Updated:</span>{' '}
                {new Date(job.updatedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
