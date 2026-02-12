/**
 * API base URL
 * In development mode, uses Vite proxy (/api)
 * In production, uses environment variable or fallback URL
 */
const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000'

/**
 * API Error class
 * @class ApiError
 * @extends Error
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Make API request
 * @template T - Response data type
 * @param {string} endpoint - API endpoint path
 * @param {RequestInit} [options] - Fetch options
 * @returns {Promise<T>} Response data promise
 * @throws {ApiError} On request error
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(response.status, error.error || error.message || 'Request failed')
  }

  return response.json()
}