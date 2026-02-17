export const PASSWORD_KEY = 'peterbot_password'

/**
 * Get the stored password from localStorage.
 * Returns null if no password is stored.
 */
export function getPassword(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(PASSWORD_KEY)
}

/**
 * Store the password in localStorage.
 * This is used to authenticate API requests.
 */
export function setPassword(password: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PASSWORD_KEY, password)
}

/**
 * Clear the stored password from localStorage.
 * Used when logging out or when authentication fails.
 */
export function clearPassword(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PASSWORD_KEY)
}

/**
 * Check if the user has a stored password (is "logged in").
 */
export function isAuthenticated(): boolean {
  return getPassword() !== null
}
