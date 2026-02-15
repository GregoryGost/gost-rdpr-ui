import { apiRequest } from '../client'
import type { Domain, DomainCreateData } from '../types/domains'
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
 * Domains API response with additional fields
 */
export interface DomainsResponse extends PaginatedResponse<Domain> {
  total_resolved: number
  total_query: number
}

/**
 * Domains API methods
 */
export const domainsApi = {
  /**
   * Get all domains
   * @param {PaginationParams & { resolved?: boolean }} [params] - Pagination and filter parameters
   * @returns {Promise<DomainsResponse>}
   */
  getAll: (params?: PaginationParams & { resolved?: boolean }) => {
    const queryString = params ? `?${toSearchParams(params)}` : ''
    return apiRequest<DomainsResponse>(`/domains${queryString}`)
  },

  /**
   * Get one domain by ID
   * @param {number} id - Domain ID
   * @returns {Promise<Domain>}
   */
  getOne: (id: number) => apiRequest<Domain>(`/domains/${id}`),

  /**
   * Create domains
   * @param {DomainCreateData[]} data - Array of creation data
   * @returns {Promise<OkResponse>}
   */
  create: (data: DomainCreateData[]) =>
    apiRequest<OkResponse>('/domains', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Delete one domain
   * @param {number} id - Domain ID
   * @returns {Promise<OkResponse>}
   */
  deleteOne: (id: number) => apiRequest<OkResponse>(`/domains/${id}`, { method: 'DELETE' }),

  /**
   * Delete all domains
   * @returns {Promise<OkResponse>}
   */
  deleteAll: () => apiRequest<OkResponse>('/domains', { method: 'DELETE' }),

  /**
   * Search domains by text
   * @param {string} text - Search text
   * @param {PaginationParams & { resolved?: boolean }} [params] - Pagination and filter parameters
   * @returns {Promise<DomainsResponse>}
   */
  search: (text: string, params?: PaginationParams & { resolved?: boolean }) => {
    const searchParams = new URLSearchParams({ text })
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
    }
    return apiRequest<DomainsResponse>(`/domains/search?${searchParams}`)
  },
}
