// API returns dates as strings (JSON serialization)

export interface CoreCommand {
  name: string
  description: string
}

export interface SkillCapability {
  name: string
  description: string
  triggerPattern: string
  category: string
  enabled: boolean
}

export interface AppCapability {
  provider: string
  connected: boolean
  enabled: boolean
  accountEmail: string | null
}

export interface ChangelogEntry {
  date: string
  phase: string
  items: string[]
}

export interface Capabilities {
  version: string
  phase: string
  coreCommands: CoreCommand[]
  skills: SkillCapability[]
  connectedApps: AppCapability[]
  recentChanges: ChangelogEntry[]
}

export interface CapabilitiesResponse {
  capabilities: Capabilities
}

export interface ChangelogResponse {
  changelog: ChangelogEntry[]
}

export interface ChangelogRawResponse {
  content: string
}
