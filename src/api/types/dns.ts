/**
 * DNS Server entity
 * @interface DnsServer
 */
export interface DnsServer {
  id: number
  server?: string
  doh_server?: string
  description?: string
  created_at: number
  created_at_hum: string
  updated_at?: number
  updated_at_hum?: string
}

/**
 * DNS Server creation data
 * @interface DnsServerCreateData
 */
export interface DnsServerCreateData {
  server?: string
  doh_server?: string
  description?: string
}