import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BookOpen, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/utils"
import type { SolutionsResponse, ApiSolution } from "@/types/solution"

export const Route = createFileRoute("/solutions")({
  component: SolutionsPage,
})

function SolutionsPage() {
  const queryClient = useQueryClient()

  // Client-side search state
  const [searchQuery, setSearchQuery] = useState("")
  // Client-side tag filter state
  const [activeTags, setActiveTags] = useState<string[]>([])

  // Fetch solutions
  const { data: solutionsData, isLoading } = useQuery<SolutionsResponse>({
    queryKey: ["solutions"],
    queryFn: async () => {
      const response = await api.solutions.$get()
      return response.json()
    },
  })

  const allSolutions: ApiSolution[] = solutionsData?.solutions ?? []

  // Derive all unique tags from solutions
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const solution of allSolutions) {
      if (solution.tags) {
        try {
          const tags = JSON.parse(solution.tags) as string[]
          for (const tag of tags) {
            tagSet.add(tag)
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }
    return Array.from(tagSet).sort()
  }, [allSolutions])

  // Filter solutions based on search query and active tags
  const filteredSolutions = useMemo(() => {
    return allSolutions.filter((solution) => {
      // Search filter
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        solution.title.toLowerCase().includes(query) ||
        (solution.description?.toLowerCase() ?? "").includes(query) ||
        (solution.tags?.toLowerCase() ?? "").includes(query)

      // Tag filter
      const matchesTags =
        activeTags.length === 0 ||
        (() => {
          if (!solution.tags) return false
          try {
            const tags = JSON.parse(solution.tags) as string[]
            return activeTags.every((tag) => tags.includes(tag))
          } catch {
            return false
          }
        })()

      return matchesSearch && matchesTags
    })
  }, [allSolutions, searchQuery, activeTags])

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.solutions[":id"].$delete({
        param: { id },
      })
      if (!response.ok) {
        throw new Error("Failed to delete solution")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solutions"] })
      toast.success("Solution deleted")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete solution")
    },
  })

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id)
  }

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const parseTags = (tagsJson: string | null): string[] => {
    if (!tagsJson) return []
    try {
      return JSON.parse(tagsJson) as string[]
    } catch {
      return []
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          Solutions
        </h1>
        <p className="text-muted-foreground">
          View and manage your saved solutions from completed jobs
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium whitespace-nowrap">Search</span>
            <Input
              placeholder="Search by title, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex items-start gap-4">
              <span className="text-sm font-medium whitespace-nowrap pt-1.5">Filter by tags</span>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const isActive = activeTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solutions List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          SOLUTIONS ({filteredSolutions.length})
        </h2>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading solutions...</p>
          </div>
        ) : allSolutions.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed gap-2">
            <p className="text-sm text-muted-foreground">No solutions yet</p>
            <p className="text-xs text-muted-foreground">
              To save a solution, reply to a completed job in Telegram with: &quot;save this solution&quot;
            </p>
          </div>
        ) : filteredSolutions.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">No solutions match your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSolutions.map((solution: ApiSolution) => {
              const tags = parseTags(solution.tags)
              return (
                <Card key={solution.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Title */}
                        <h3 className="font-semibold truncate">{solution.title}</h3>

                        {/* Tags */}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Description */}
                        {solution.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {solution.description}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            {solution.jobId.slice(0, 8)}
                          </code>
                          <span>·</span>
                          <span>{formatDate(new Date(solution.createdAt))}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(solution.id)}
                        disabled={deleteMutation.isPending}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
