import { API, ERROR_MESSAGES } from '@/constants'

/**
 * API base URL
 * In development mode, uses Vite proxy (/api)
 * In production, uses environment variable or fallback URL
 */
const API_BASE_URL = import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_BASE_URL || API.FALLBACK_BASE_URL

/**
 * API Error class
 * @class ApiError
 * @extends Error
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Network Error class for connection failures
 * @class NetworkError
 * @extends Error
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

/**
 * Make API request with timeout
 * @template T - Response data type
 * @param {string} endpoint - API endpoint path
 * @param {RequestInit} [options] - Fetch options
 * @param {number} [timeout] - Request timeout in milliseconds
 * @returns {Promise<T>} Response data promise
 * @throws {ApiError} On request error
 * @throws {NetworkError} On network/connection error
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
  timeout: number = API.TIMEOUT,
): Promise<T> {
  // controller supplies the fetch signal; the timeout callback aborts it when the request deadline expires.
  const controller = new AbortController()
  // timeoutId identifies the deadline timer that every completed or failed fetch must clear.
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    // requestHeaders copies every supported HeadersInit form and resolves header names without case sensitivity.
    const requestHeaders = new Headers(options?.headers)
    if (!requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', API.HEADERS.CONTENT_TYPE)
    }

    // response is the transport response whose HTTP status and JSON body are returned to the caller.
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: requestHeaders,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      // error contains backend failure fields; the rejection callback supplies fallback text for non-JSON bodies.
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new ApiError(response.status, error.error || error.message || 'Request failed')
    }

    return response.json()
  } catch (error) {
    // error is a fetch or HTTP-status failure classified below; the deadline is released before propagation.
    clearTimeout(timeoutId)

    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new NetworkError(ERROR_MESSAGES.API_TIMEOUT)
    }

    // Handle network errors (server unavailable, connection refused, etc.)
    if (error instanceof TypeError) {
      throw new NetworkError(ERROR_MESSAGES.SERVER_UNAVAILABLE)
    }

    // Re-throw ApiError as is
    if (error instanceof ApiError) {
      throw error
    }

    // Unknown error
    throw new NetworkError(ERROR_MESSAGES.UNKNOWN_CONNECTION_ERROR)
  }
}
