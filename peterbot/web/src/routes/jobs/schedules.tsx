import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import type { SchedulesResponse, ApiSchedule } from "@/types/schedule"

export const Route = createFileRoute("/jobs/schedules")({
  component: SchedulesTab,
})

function SchedulesTab() {
  const queryClient = useQueryClient()
  
  // Form state
  const [description, setDescription] = useState("")
  const [naturalSchedule, setNaturalSchedule] = useState("")
  const [prompt, setPrompt] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  // Fetch schedules
  const { data: schedulesData, isLoading } = useQuery<SchedulesResponse>({
    queryKey: ["schedules"],
    queryFn: async () => {
      const response = await api.schedules.$get()
      return response.json()
    },
  })

  const schedules: ApiSchedule[] = schedulesData?.schedules ?? []

  // Create schedule mutation
  const createMutation = useMutation({
    mutationFn: async (data: { description: string; naturalSchedule: string; prompt: string }) => {
      const response = await api.schedules.$post({ json: data })
      const result = await response.json()
      if (!response.ok) {
        const errorResult = result as { error: string; message: string; examples?: string[] }
        throw new Error(errorResult.message || "Failed to create schedule")
      }
      return result
    },
    onSuccess: () => {
      // Reset form
      setDescription("")
      setNaturalSchedule("")
      setPrompt("")
      setFormError(null)
      // Invalidate and show success
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
      toast.success("Schedule created successfully")
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  // Delete schedule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.schedules[":id"].$delete({
        param: { id },
      })
      const result = await response.json()
      if (!response.ok) {
        const errorResult = result as { error: string; message: string }
        throw new Error(errorResult.message || "Failed to delete schedule")
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
      toast.success("Schedule deleted successfully")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete schedule")
    },
  })

  // Toggle schedule mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await api.schedules[":id"].toggle.$post({
        param: { id },
        json: { enabled },
      })
      const result = await response.json()
      if (!response.ok) {
        const errorResult = result as { error: string; message: string }
        throw new Error(errorResult.message || "Failed to toggle schedule")
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] })
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to toggle schedule")
    },
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !naturalSchedule.trim() || !prompt.trim()) {
      setFormError("All fields are required")
      return
    }
    createMutation.mutate({ description, naturalSchedule, prompt })
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="space-y-6">
      {/* New Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle>New Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="e.g., Weekly briefing"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">When (natural language)</label>
                <Input
                  placeholder="e.g., every monday 9am"
                  value={naturalSchedule}
                  onChange={(e) => setNaturalSchedule(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">What to do</label>
              <Input
                placeholder="e.g., Send me a tech news briefing"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            {formError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              className="w-full md:w-auto"
            >
              {createMutation.isPending ? "Creating..." : "Create Schedule"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Schedules List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          YOUR SCHEDULES ({schedules.length})
        </h2>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading schedules...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">No schedules yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule: ApiSchedule) => (
              <Card key={schedule.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {schedule.description}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            schedule.enabled
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {schedule.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {schedule.naturalSchedule} · {schedule.parsedCron}
                      </p>
                      <p className="text-sm">{schedule.prompt}</p>
                      <p className="text-xs text-muted-foreground">
                        Next run: {formatDate(new Date(schedule.nextRunAt))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={schedule.enabled}
                        onCheckedChange={(enabled) =>
                          toggleMutation.mutate({ id: schedule.id, enabled })
                        }
                        disabled={toggleMutation.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule.id)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
