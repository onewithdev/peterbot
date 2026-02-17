import { hc } from 'hono/client'
import type { DashboardAPI } from '../../../src/core/dashboard/routes'
import { getPassword } from './auth'

/**
 * Hono RPC client for type-safe API calls.
 * This client is typed based on the Hono app routes.
 * 
 * Note: In development, Vite proxy forwards /api to localhost:3000.
 * In production, the API is served from the same origin.
 */
const client = hc<DashboardAPI>('/api', {
  headers: () => {
    const password = getPassword()
    const headers: Record<string, string> = {}
    if (password) {
      headers['X-Dashboard-Password'] = password
    }
    return headers
  },
})

export { client }

/**
 * Type-safe API client for peterbot dashboard.
 * 
 * Usage:
 * ```ts
 * const { data } = await api.jobs.$get()
 * const { data } = await api.config.soul.$get()
 * ```
 */
export const api = client
