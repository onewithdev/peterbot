// API returns dates as strings (JSON serialization)
export interface ApiSkill {
  id: string
  name: string
  description: string | null
  triggerPattern: string
  tools: string | null       // JSON array string
  category: string
  systemPrompt: string
  filePath: string
  enabled: boolean
  valid: boolean
  loadError: string | null
  createdAt: string
  updatedAt: string
}

export interface SkillsResponse {
  skills: ApiSkill[]
  total: number
}
