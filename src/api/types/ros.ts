/**
 * RouterOS configuration entity
 * @interface RosConfig
 */
export interface RosConfig {
  id: number
  host: string
  user: string
  password: string
  bgp_list_name: string
  description?: string
  created_at: number
  created_at_hum: string
  updated_at?: number
  updated_at_hum?: string
}

/**
 * RouterOS configuration creation data
 * @interface RosConfigCreateData
 */
export interface RosConfigCreateData {
  host: string
  user: string
  user_password: string
  bgp_list_name: string
  description?: string
}
