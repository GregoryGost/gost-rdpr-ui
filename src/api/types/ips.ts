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
}
