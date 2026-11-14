/**
 * Statistics API types
 */

export interface StatsDnsData {
  total: number
  classic: number
  doh: number
}

export interface StatsDomainsListItem {
  list_id: number
  list_name: string
  total: number
  resolved: number
  unresolved: number
  attempts: number
}

/** Global domain aggregates, independent of the current list/search query and page. */
export interface StatsDomainsData {
  /** Existing total number of stored domain records. */
  total: number
  /** Existing number of records whose saved resolution flag is true. */
  resolved: number
  /** Existing number of records whose saved resolution flag is false. */
  unresolved: number
  /** Number of configured domain lists, including empty lists. */
  lists_total: number
  /** Existing list-level totals and download-attempt counts. */
  per_list: StatsDomainsListItem[]
  /** Positive-ID records with neither a saved attempt nor a successful-resolution date. */
  unprocessed: number
}

export interface StatsIpsListItem {
  list_id: number
  list_name: string
  total: number
  v4_count: number
  v6_count: number
  attempts: number
}

export interface StatsIpsData {
  total: number
  v4_total: number
  v6_total: number
  linked_to_domain: number
  standalone: number
  lists_total: number
  per_list: StatsIpsListItem[]
}

export interface StatsRosData {
  total: number
}

export interface StatsResponse {
  generated_at: string
  dns: StatsDnsData
  domains: StatsDomainsData
  ips: StatsIpsData
  ros: StatsRosData
}

export type GrowthEntity = 'domains' | 'lists' | 'ips'
export type GrowthGranularity = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
export type GrowthDateField = 'created_at' | 'updated_at' | 'last_resolved_at'

export interface StatsGrowthPoint {
  date: string
  count: number
}

export interface StatsGrowthResponse {
  entity: GrowthEntity
  granularity: GrowthGranularity
  start_date: string | null
  end_date: string | null
  ip_subtype: number | null
  total_in_period: number
  payload: StatsGrowthPoint[]
  duration: number
}

export interface StatsGrowthParams {
  entity: GrowthEntity
  granularity?: GrowthGranularity
  start_date?: string | null
  end_date?: string | null
  ip_subtype?: number | null
  date_filter_field?: GrowthDateField
}
