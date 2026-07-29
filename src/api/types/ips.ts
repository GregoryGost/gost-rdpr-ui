/**
 * IP address list entity
 * @interface IpsList
 */
export interface IpsList {
  id: number
  name: string
  url: string
  description?: string
  hash?: string
  attempts: number
  elements_count: number
  created_at: number
  created_at_hum: string
  updated_at?: number
  updated_at_hum?: string
  ip_v4_count?: number
  ip_v6_count?: number
}

/**
 * IP address entity
 * @interface IpAddress
 */
export interface IpAddress {
  id: number
  type: number
  addr: string
  ip_list_id?: number
  ip_list_name?: string
  domain_id?: number
  domain_name?: string
  ros_comment?: string
  use_default_gw?: boolean
  created_at: number
  created_at_hum: string
  updated_at?: number
  updated_at_hum?: string
}

/**
 * IP list creation data
 * @interface IpsListCreateData
 */
export interface IpsListCreateData {
  name: string
  url: string
  description?: string
}

/**
 * IP address creation data
 * @interface IpAddressCreateData
 */
export interface IpAddressCreateData {
  addr: string
  list_id?: number
  domain_id?: number
  ros_comment?: string
  use_default_gw?: boolean
}

/**
 * RIPEstat prefix check request by raw IPv4 address
 * @interface RipeStatPrefixCheckByAddressRequest
 */
export interface RipeStatPrefixCheckByAddressRequest {
  address: string
  id?: never
}

/**
 * RIPEstat prefix check request by saved IP record ID
 * @interface RipeStatPrefixCheckByIdRequest
 */
export interface RipeStatPrefixCheckByIdRequest {
  id: number
  address?: never
}

/**
 * RIPEstat prefix check request with exactly one source
 */
export type RipeStatPrefixCheckRequest = RipeStatPrefixCheckByAddressRequest | RipeStatPrefixCheckByIdRequest

/**
 * RIPEstat prefix check result
 * @interface RipeStatPrefixCheckResponse
 */
export interface RipeStatPrefixCheckResponse {
  address: string
  prefix: string | null
}
