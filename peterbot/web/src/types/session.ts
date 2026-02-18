// API returns dates as strings (JSON serialization)
export interface ApiSession {
  id: string
  chatId: string
  triggerJobId: string | null
  messageCount: number
  summary: string
  createdAt: string
}

export interface SessionsResponse {
  sessions: ApiSession[]
  total: number
}

export interface ConfigResponse {
  key: string
  value: string
}
