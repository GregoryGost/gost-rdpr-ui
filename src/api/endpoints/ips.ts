import { apiRequest } from '../client'
import type { IpAddress, IpAddressCreateData } from '../types/ips'
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
 * IPs API methods
 */
export const ipsApi = {
  /**
   * Get all IP addresses
   * @param {PaginationParams} [params] - Pagination parameters
   * @returns {Promise<PaginatedResponse<IpAddress>>}
   */
  getAll: (params?: PaginationParams) => {
    const queryString = params ? `?${toSearchParams(params)}` : ''
    return apiRequest<PaginatedResponse<IpAddress>>(`/ips${queryString}`)
  },

  /**
   * Get one IP address by ID
   * @param {number} id - IP address ID
   * @returns {Promise<IpAddress>}
   */
  getOne: (id: number) => apiRequest<IpAddress>(`/ips/${id}`),

  /**
   * Create IP addresses
   * @param {IpAddressCreateData[]} data - Array of creation data
   * @returns {Promise<OkResponse>}
   */
  create: (data: IpAddressCreateData[]) =>
    apiRequest<OkResponse>('/ips', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Delete one IP address by ID or IP address string
   * @param {number | string} idOrIp - IP address ID or IP address string
   * @returns {Promise<OkResponse>}
   */
  deleteOne: (idOrIp: number | string) => apiRequest<OkResponse>(`/ips/${idOrIp}`, { method: 'DELETE' }),

  /**
   * Delete all IP addresses
   * @returns {Promise<OkResponse>}
   */
  deleteAll: () => apiRequest<OkResponse>('/ips', { method: 'DELETE' }),

  /**
   * Search IP addresses by text
   * @param {string} text - Search text
   * @param {PaginationParams} [params] - Pagination parameters
   * @returns {Promise<PaginatedResponse<IpAddress>>}
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
    return apiRequest<PaginatedResponse<IpAddress>>(`/ips/search?${searchParams}`)
  },
}
