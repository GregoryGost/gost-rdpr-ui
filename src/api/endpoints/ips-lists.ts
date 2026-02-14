import { apiRequest } from '../client'
import type { IpsList, IpsListCreateData } from '../types/ips'
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
 * IPs Lists API methods
 */
export const ipsListsApi = {
  /**
   * Get all IPs lists
   * @param {PaginationParams & { attempts?: number }} [params] - Pagination and filter parameters
   * @returns {Promise<PaginatedResponse<IpsList>>}
   */
  getAll: (params?: PaginationParams & { attempts?: number }) => {
    const queryString = params ? `?${toSearchParams(params)}` : ''
    return apiRequest<PaginatedResponse<IpsList>>(`/ips/lists${queryString}`)
  },

  /**
   * Get one IPs list by ID
   * @param {number} id - IPs list ID
   * @returns {Promise<IpsList>}
   */
  getOne: (id: number) => apiRequest<IpsList>(`/ips/lists/${id}`),

  /**
   * Create IPs lists
   * @param {IpsListCreateData[]} data - Array of creation data
   * @returns {Promise<OkResponse>}
   */
  create: (data: IpsListCreateData[]) =>
    apiRequest<OkResponse>('/ips/lists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Delete one IPs list
   * @param {number} id - IPs list ID
   * @returns {Promise<OkResponse>}
   */
  deleteOne: (id: number) => apiRequest<OkResponse>(`/ips/lists/${id}`, { method: 'DELETE' }),

  /**
   * Delete all IPs lists
   * @returns {Promise<OkResponse>}
   */
  deleteAll: () => apiRequest<OkResponse>('/ips/lists', { method: 'DELETE' }),

  /**
   * Search IPs lists by text
   * @param {string} text - Search text
   * @param {PaginationParams & { attempts?: number }} [params] - Pagination and filter parameters
   * @returns {Promise<PaginatedResponse<IpsList>>}
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
    return apiRequest<PaginatedResponse<IpsList>>(`/ips/lists/search?${searchParams}`)
  },
}
