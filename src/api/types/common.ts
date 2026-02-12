/**
 * Pagination parameters for API requests
 * @interface PaginationParams
 */
export interface PaginationParams {
  limit?: number
  offset?: number
  start_date?: string
  end_date?: string
}

/**
 * Paginated API response
 * @interface PaginatedResponse
 * @template T - Type of items in payload array
 */
export interface PaginatedResponse<T> {
  limit: number
  offset: number
  duration: number
  count: number
  total: number
  payload: T[]
}

/**
 * Standard OK response
 * @interface OkResponse
 */
export interface OkResponse {
  result: string
}

/**
 * Error response
 * @interface ErrorResponse
 */
export interface ErrorResponse {
  error: string
  resolution?: string
}