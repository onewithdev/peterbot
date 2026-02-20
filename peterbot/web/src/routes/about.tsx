import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Info, Zap, Hexagon, ExternalLink } from "lucide-react"
import { api } from "@/lib/api"
import type { CapabilitiesResponse, ChangelogResponse } from "@/types/capabilities"

export const Route = createFileRoute("/about")({
  component: AboutPage,
})

function AboutPage() {
  // Fetch capabilities
  const { data: capabilitiesData, isLoading: isLoadingCapabilities } = useQuery<CapabilitiesResponse>({
    queryKey: ["capabilities"],
    queryFn: async () => {
      const response = await api.capabilities.$get()
      return response.json()
    },
  })

  // Fetch full changelog
  const { data: changelogData, isLoading: isLoadingChangelog } = useQuery<ChangelogResponse>({
    queryKey: ["changelog"],
    queryFn: async () => {
      const response = await api.changelog.$get()
      return response.json()
    },
  })

  const capabilities = capabilitiesData?.capabilities
  const changelog = changelogData?.changelog ?? []

  const enabledSkills = capabilities?.skills.filter((s) => s.enabled) ?? []
  const connectedApps = capabilities?.connectedApps ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Info className="h-8 w-8" />
          About peterbot
        </h1>
        {capabilities && (
          <Badge variant="secondary" className="text-xs">
            {capabilities.version} · {capabilities.phase}
          </Badge>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Active Skills Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Active Skills
              </span>
              <Link
                to="/skills"
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-normal"
              >
                Manage →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingCapabilities ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : enabledSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active skills. Enable skills from the Skills page.
              </p>
            ) : (
              <div className="space-y-2">
                {enabledSkills.slice(0, 6).map((skill) => (
                  <div
                    key={skill.name}
                    className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                  >
                    <span className="truncate">{skill.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0 ml-2">
                      enabled
                    </Badge>
                  </div>
                ))}
                {enabledSkills.length > 6 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    +{enabledSkills.length - 6} more
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connected Apps Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Hexagon className="h-4 w-4" />
                Connected Apps
              </span>
              <Link
                to="/integrations"
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-normal"
              >
                Manage →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingCapabilities ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : connectedApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No connected apps. Connect apps from the Integrations page.
              </p>
            ) : (
              <div className="space-y-2">
                {connectedApps.map((app) => (
                  <div
                    key={app.provider}
                    className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                  >
                    <span className="capitalize truncate">{app.provider}</span>
                    <span className="text-xs shrink-0 ml-2">
                      {app.enabled ? (
                        <span className="text-green-600">
                          ✓ {app.accountEmail || "connected"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">disabled</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Changelog Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Changelog
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingChangelog ? (
            <p className="text-sm text-muted-foreground">Loading changelog...</p>
          ) : changelog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changelog entries available.</p>
          ) : (
            <div className="space-y-6">
              {changelog.map((entry, index) => (
                <div key={`${entry.date}-${index}`} className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {entry.date} — {entry.phase}
                  </h3>
                  <ul className="space-y-1">
                    {entry.items.map((item, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-muted-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
