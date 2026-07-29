import { apiRequest } from '../client'
import type {
  IpAddress,
  IpAddressCreateData,
  RipeStatPrefixCheckRequest,
  RipeStatPrefixCheckResponse,
} from '../types/ips'
import type { PaginatedResponse, PaginationParams, OkResponse } from '../types/common'

interface IpsFilterParams extends PaginationParams {
  type?: number
  default_gw?: boolean
}

/**
 * Convert pagination params to URLSearchParams
 * @param {IpsFilterParams} params - Pagination and filter parameters
 * @returns {URLSearchParams}
 */
function toSearchParams(params: IpsFilterParams): URLSearchParams {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })
  return searchParams
}

/**
 * Validate a saved IP record ID before sending it to RIPEstat.
 * @param {number} id - Saved IP record ID
 * @returns {void}
 * @throws {TypeError} When the ID is not a positive integer
 */
function validateIpRecordId(id: number): void {
  if (!Number.isInteger(id) || id <= 0) {
    throw new TypeError('IP record ID must be a positive integer')
  }
}

/**
 * Validate an IPv4 address before sending it to RIPEstat.
 * @param {string} address - IPv4 address
 * @returns {void}
 * @throws {TypeError} When the address is not a valid IPv4 value
 */
function validateIpv4Address(address: string): void {
  const octets = address.trim().split('.')
  const isValid =
    octets.length === 4 &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255)

  if (!isValid) {
    throw new TypeError('RIPEstat check requires a valid IPv4 address')
  }
}

/**
 * Validate a RIPEstat source before sending a prefix check request.
 * @param {RipeStatPrefixCheckRequest} data - Prefix check source
 * @returns {void}
 * @throws {TypeError} When the request does not contain exactly one valid source
 */
function validateRipeStatPrefixCheckRequest(data: RipeStatPrefixCheckRequest): void {
  const hasId = data.id !== undefined
  const hasAddress = data.address !== undefined

  if (hasId === hasAddress) {
    throw new TypeError('Specify exactly one RIPEstat check source')
  }

  if (hasId) {
    validateIpRecordId(data.id)
    return
  }

  validateIpv4Address(data.address)
}

/**
 * IPs API methods
 */
export const ipsApi = {
  /**
   * Get all IP addresses
   * @param {IpsFilterParams} [params] - Pagination and filter parameters
   * @returns {Promise<PaginatedResponse<IpAddress>>}
   */
  getAll: (params?: IpsFilterParams) => {
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
   * Check an IPv4 prefix through RIPEstat without changing database records.
   * @param {RipeStatPrefixCheckRequest} data - Exactly one IP address or saved-record ID source
   * @returns {Promise<RipeStatPrefixCheckResponse>}
   */
  checkRipeStatPrefix: (data: RipeStatPrefixCheckRequest) => {
    validateRipeStatPrefixCheckRequest(data)
    return apiRequest<RipeStatPrefixCheckResponse>('/ips/ripe/check', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  /**
   * Clear the in-memory RIPEstat prefix cache without changing database records.
   * @returns {Promise<OkResponse>}
   */
  clearRipeStatCache: () => apiRequest<OkResponse>('/ips/ripe/cache/clear', { method: 'POST' }),

  /**
   * Queue background cleanup of IP records blocked by IP_NOT_ALLOWED.
   * @returns {Promise<OkResponse>}
   */
  queueCleanupNotAllowed: () => apiRequest<OkResponse>('/ips/cleanup/not-allowed', { method: 'POST' }),

  /**
   * Search IP addresses by text
   * @param {string} text - Search text
   * @param {IpsFilterParams} [params] - Pagination and filter parameters
   * @returns {Promise<PaginatedResponse<IpAddress>>}
   */
  search: (text: string, params?: IpsFilterParams) => {
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
