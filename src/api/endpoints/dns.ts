import { apiRequest } from '../client'
import type { DnsServer, DnsServerCreateData } from '../types/dns'
import type { PaginatedResponse, PaginationParams, OkResponse } from '../types/common'

/**
 * Convert pagination params to URLSearchParams
 * @param {PaginationParams} params - Pagination parameters
 * @returns {URLSearchParams}
 */
function toSearchParams(params: PaginationParams): URLSearchParams {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value))
  })
  return searchParams
}

/**
 * DNS API methods
 */
export const dnsApi = {
  /**
   * Get all DNS servers
   * @param {PaginationParams} [params] - Pagination parameters
   * @returns {Promise<PaginatedResponse<DnsServer>>}
   */
  getAll: (params?: PaginationParams) => {
    const queryString = params ? `?${toSearchParams(params)}` : ''
    return apiRequest<PaginatedResponse<DnsServer>>(`/dns${queryString}`)
  },

  /**
   * Get one DNS server by ID
   * @param {number} id - DNS server ID
   * @returns {Promise<DnsServer>}
   */
  getOne: (id: number) => apiRequest<DnsServer>(`/dns/${id}`),

  /**
   * Create DNS servers
   * @param {DnsServerCreateData[]} data - Array of creation data
   * @returns {Promise<OkResponse>}
   */
  create: (data: DnsServerCreateData[]) =>
    apiRequest<OkResponse>('/dns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Delete one DNS server
   * @param {number} id - DNS server ID
   * @returns {Promise<OkResponse>}
   */
  deleteOne: (id: number) => apiRequest<OkResponse>(`/dns/${id}`, { method: 'DELETE' }),

  /**
   * Delete all DNS servers
   * @returns {Promise<OkResponse>}
   */
  deleteAll: () => apiRequest<OkResponse>('/dns', { method: 'DELETE' }),

  /**
   * Search DNS servers by text
   * @param {string} text - Search text
   * @param {PaginationParams} [params] - Pagination parameters
   * @returns {Promise<PaginatedResponse<DnsServer>>}
   */
  search: (text: string, params?: PaginationParams) => {
    const searchParams = new URLSearchParams({ text })
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value))
      })
    }
    return apiRequest<PaginatedResponse<DnsServer>>(`/dns/search?${searchParams}`)
  },
}
