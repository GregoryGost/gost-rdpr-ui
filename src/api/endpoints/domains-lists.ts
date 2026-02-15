import { apiRequest } from '../client'
import type { DomainsList, DomainsListCreateData } from '../types/domains'
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
 * Domains Lists API methods
 */
export const domainsListsApi = {
  /**
   * Get all domains lists
   * @param {PaginationParams & { attempts?: number }} [params] - Pagination and filter parameters
   * @returns {Promise<PaginatedResponse<DomainsList>>}
   */
  getAll: (params?: PaginationParams & { attempts?: number }) => {
    const queryString = params ? `?${toSearchParams(params)}` : ''
    return apiRequest<PaginatedResponse<DomainsList>>(`/domains/lists${queryString}`)
  },

  /**
   * Get one domains list by ID
   * @param {number} id - Domains list ID
   * @returns {Promise<DomainsList>}
   */
  getOne: (id: number) => apiRequest<DomainsList>(`/domains/lists/${id}`),

  /**
   * Create domains lists
   * @param {DomainsListCreateData[]} data - Array of creation data
   * @returns {Promise<OkResponse>}
   */
  create: (data: DomainsListCreateData[]) =>
    apiRequest<OkResponse>('/domains/lists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Delete one domains list
   * @param {number} id - Domains list ID
   * @returns {Promise<OkResponse>}
   */
  deleteOne: (id: number) => apiRequest<OkResponse>(`/domains/lists/${id}`, { method: 'DELETE' }),

  /**
   * Delete all domains lists
   * @returns {Promise<OkResponse>}
   */
  deleteAll: () => apiRequest<OkResponse>('/domains/lists', { method: 'DELETE' }),

  /**
   * Search domains lists by text
   * @param {string} text - Search text
   * @param {PaginationParams & { attempts?: number }} [params] - Pagination and filter parameters
   * @returns {Promise<PaginatedResponse<DomainsList>>}
   */
  search: (text: string, params?: PaginationParams & { attempts?: number }) => {
    const searchParams = new URLSearchParams({ text })
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
    }
    return apiRequest<PaginatedResponse<DomainsList>>(`/domains/lists/search?${searchParams}`)
  },
}
