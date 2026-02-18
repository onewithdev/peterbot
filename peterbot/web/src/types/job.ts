import type { Job as JobSchema } from '../../../src/features/jobs/schema'

// Job type from the database schema (with Date objects)
export type Job = JobSchema
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

// API returns dates as strings (JSON serialization)
export interface ApiJob {
  id: string
  type: 'task' | 'quick'
  status: 'pending' | 'running' | 'completed' | 'failed'
  input: string
  output: string | null
  chatId: string
  scheduleId: string | null
  delivered: boolean
  createdAt: string
  updatedAt: string
  retryCount: number
}

export interface JobsResponse {
  jobs: ApiJob[]
  total: number
}

export interface JobResponse {
  job: ApiJob
}

export interface CancelJobResponse {
  success: boolean
  message: string
}

// Helper function to convert API job to Job (converts string dates to Date objects)
export function mapApiJobToJob(apiJob: ApiJob): Job {
  return {
    ...apiJob,
    createdAt: new Date(apiJob.createdAt),
    updatedAt: new Date(apiJob.updatedAt),
  } as Job
}

// Helper function to convert Job to API job (converts Date objects to strings)
export function mapJobToApiJob(job: Job): ApiJob {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  }
}
