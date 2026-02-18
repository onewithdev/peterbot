// API returns dates as strings (JSON serialization)
export interface ApiSolution {
  id: string
  jobId: string
  title: string
  description: string | null
  tags: string | null        // JSON array string e.g. '["scraping","python"]'
  keywords: string | null
  createdAt: string          // timestamp_ms serialized as number in JSON
}

export interface SolutionsResponse {
  solutions: ApiSolution[]
  total: number
}
