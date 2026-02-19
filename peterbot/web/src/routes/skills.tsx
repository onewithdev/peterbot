import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Zap, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import type { SkillsResponse, ApiSkill } from "@/types/skill"

export const Route = createFileRoute("/skills")({
  component: SkillsPage,
})

function SkillsPage() {
  const queryClient = useQueryClient()

  // Fetch skills
  const { data: skillsData, isLoading } = useQuery<SkillsResponse>({
    queryKey: ["skills"],
    queryFn: async () => {
      const response = await api.skills.$get()
      return response.json()
    },
  })

  const skills: ApiSkill[] = skillsData?.skills ?? []

  // Sync skills mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.skills.sync.$post()
      const result = await response.json()
      if (!response.ok) {
        throw new Error("Failed to sync skills")
      }
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["skills"] })
      toast.success(`Synced ${result.synced} skills`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sync skills")
    },
  })

  // Toggle skill mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await api.skills[":id"].toggle.$patch({
        param: { id },
        json: { enabled },
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error("Failed to toggle skill")
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] })
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to toggle skill")
    },
  })

  const handleSync = () => {
    syncMutation.mutate()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-8 w-8" />
            Skills
          </h1>
          <p className="text-muted-foreground">
            Manage AI skills and trigger patterns
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          {syncMutation.isPending ? "Syncing..." : "Sync"}
        </Button>
      </div>

      {/* Skills List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading skills...</p>
          </div>
        ) : skills.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Drop <code>.skill.md</code> files into the <code>/skills/</code> folder to add skills.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map((skill: ApiSkill) => (
              <Card
                key={skill.id}
                className={!skill.valid || !skill.enabled ? "opacity-60" : ""}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {skill.name}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {skill.category}
                        </span>
                        {!skill.valid && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            Error
                          </span>
                        )}
                      </div>
                      {skill.description && (
                        <p className="text-sm text-muted-foreground">
                          {skill.description}
                        </p>
                      )}
                      <code className="block text-xs bg-muted p-1.5 rounded">
                        {skill.triggerPattern}
                      </code>
                      {!skill.valid && skill.loadError && (
                        <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {skill.loadError}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={skill.enabled}
                        onCheckedChange={(enabled) =>
                          toggleMutation.mutate({ id: skill.id, enabled })
                        }
                        disabled={toggleMutation.isPending || !skill.valid}
                      />
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
