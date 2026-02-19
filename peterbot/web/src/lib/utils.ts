import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date as a relative time string (e.g., "2 min ago", "5h ago", "3 days ago").
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return `${diffSecs}s ago`
  } else if (diffMins < 60) {
    return `${diffMins} min ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays === 1) {
    return 'yesterday'
  } else {
    return `${diffDays} days ago`
  }
}

/**
 * Format elapsed time for active jobs (e.g., "Running for 45s").
 */
export function formatElapsedTime(startDate: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(startDate).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)

  if (diffSecs < 60) {
    return `Running for ${diffSecs}s`
  } else if (diffMins < 60) {
    return `Running for ${diffMins}m ${diffSecs % 60}s`
  } else {
    return `Running for ${diffHours}h ${diffMins % 60}m`
  }
}

/**
 * Get emoji icon for job status.
 */
export function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return '⏳'
    case 'running':
      return '🔄'
    case 'completed':
      return '✅'
    case 'failed':
      return '❌'
    default:
      return '❓'
  }
}

/**
 * Get color class for job status.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-500'
    case 'running':
      return 'text-blue-500'
    case 'completed':
      return 'text-green-500'
    case 'failed':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.slice(0, maxLength) + '...'
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get the start of today for date filtering.
 */
export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Get the start of the current week for date filtering.
 */
export function startOfWeek(): Date {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - dayOfWeek)
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * Get the start of the current month for date filtering.
 */
export function startOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}
