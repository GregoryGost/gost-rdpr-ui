import { apiRequest } from '../client'
import type { RosConfig, RosConfigCreateData } from '../types/ros'
import type { PaginatedResponse, PaginationParams, OkResponse } from '../types/common'

/**
 * Convert pagination params to URLSearchParams
 * @param {PaginationParams} params - Pagination parameters
 * @returns {URLSearchParams}
 */
function toSearchParams(params: PaginationParams): URLSearchParams {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  return searchParams
}

/**
 * RouterOS Configs API methods
 */
export const rosApi = {
  /**
   * Get all RouterOS configs
   * @param {PaginationParams} [params] - Pagination parameters
   * @returns {Promise<PaginatedResponse<RosConfig>>}
   */
  getAll: (params?: PaginationParams) => {
    const queryString = params ? `?${toSearchParams(params)}` : ''
    return apiRequest<PaginatedResponse<RosConfig>>(`/ros${queryString}`)
  },

  /**
   * Get one RouterOS config by ID
   * @param {number} id - RouterOS config ID
   * @returns {Promise<RosConfig>}
   */
  getOne: (id: number) => apiRequest<RosConfig>(`/ros/${id}`),

  /**
   * Create RouterOS configs
   * @param {RosConfigCreateData[]} data - Array of creation data
   * @returns {Promise<OkResponse>}
   */
  create: (data: RosConfigCreateData[]) =>
    apiRequest<OkResponse>('/ros', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Delete one RouterOS config
   * @param {number} id - RouterOS config ID
   * @returns {Promise<OkResponse>}
   */
  deleteOne: (id: number) => apiRequest<OkResponse>(`/ros/${id}`, { method: 'DELETE' }),

  /**
   * Delete all RouterOS configs
   * @returns {Promise<OkResponse>}
   */
  deleteAll: () => apiRequest<OkResponse>('/ros', { method: 'DELETE' }),

  /**
   * Search RouterOS configs by text
   * @param {string} text - Search text
   * @param {PaginationParams} [params] - Pagination parameters
   * @returns {Promise<PaginatedResponse<RosConfig>>}
   */
  search: (text: string, params?: PaginationParams) => {
    const searchParams = new URLSearchParams({ text })
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
    }
    return apiRequest<PaginatedResponse<RosConfig>>(`/ros/search?${searchParams}`)
  },
}
