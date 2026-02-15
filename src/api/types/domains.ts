/**
 * Domain list entity
 * @interface DomainsList
 */
export interface DomainsList {
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
}

/**
 * Domain entity
 * @interface Domain
 */
export interface Domain {
  id: number
  domains_list_id?: number
  resolved: boolean
  name: string
  ros_comment?: string
  ips_v4?: string[]
  ips_v6?: string[]
  created_at: number
  created_at_hum: string
  updated_at?: number
  updated_at_hum?: string
  last_resolved_at?: number
  last_resolved_at_hum?: string
}

/**
 * Domain list creation data
 * @interface DomainsListCreateData
 */
export interface DomainsListCreateData {
  name: string
  url: string
  description?: string
}

/**
 * Domain creation data
 * @interface DomainCreateData
 */
export interface DomainCreateData {
  domain: string
  list_id?: number
  ros_comment?: string
}
