import type { Schedule as ScheduleSchema } from '../../../src/features/jobs/schedules/schema'

// Schedule type from the database schema (with Date objects)
export type Schedule = ScheduleSchema

// API returns dates as strings (JSON serialization)
export interface ApiSchedule {
  id: string
  description: string
  naturalSchedule: string
  parsedCron: string
  prompt: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string
  createdAt: string
  updatedAt: string
}

export interface SchedulesResponse {
  schedules: ApiSchedule[]
  total: number
}

// Helper function to convert API schedule to Schedule (converts string dates to Date objects)
export function mapApiScheduleToSchedule(apiSchedule: ApiSchedule): Schedule {
  return {
    ...apiSchedule,
    lastRunAt: apiSchedule.lastRunAt ? new Date(apiSchedule.lastRunAt) : null,
    nextRunAt: new Date(apiSchedule.nextRunAt),
    createdAt: new Date(apiSchedule.createdAt),
    updatedAt: new Date(apiSchedule.updatedAt),
  }
}

// Helper function to convert Schedule to API schedule (converts Date objects to strings)
export function mapScheduleToApiSchedule(schedule: Schedule): ApiSchedule {
  return {
    ...schedule,
    lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
    nextRunAt: schedule.nextRunAt.toISOString(),
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  }
}
