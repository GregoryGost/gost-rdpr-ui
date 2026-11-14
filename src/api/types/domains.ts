import type { PaginationParams } from './common'

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
  /** Stored domain identifier used by domain-specific API operations. */
  id: number
  /** Identifier of the domain list containing this record, when assigned. */
  domains_list_id?: number
  /** Resolution status displayed in the table and domain card. */
  resolved: boolean
  /** Domain name displayed in the table and resolution dialogs. */
  name: string
  /** Optional comment associated with this domain for RouterOS. */
  ros_comment?: string
  /** IPv4 addresses associated with the saved domain. */
  ips_v4?: string[]
  /** IPv6 addresses associated with the saved domain. */
  ips_v6?: string[]
  /** Backend timestamp of the domain record's creation. */
  created_at: number
  /** Backend-formatted creation date displayed without client-side conversion. */
  created_at_hum: string
  /** Backend timestamp of the most recent record update, when available. */
  updated_at?: number
  /** Backend-formatted update date, when available. */
  updated_at_hum?: string
  /** Backend timestamp of the last successful resolution, when available. */
  last_resolved_at?: number | null
  /** Backend-formatted date of the last successful resolution, when available. */
  last_resolved_at_hum?: string | null
  /**
   * Backend timestamp of the last completed saved attempt, including partial results and failures.
   * Null means the timestamp is unknown; responses without attempt metadata may omit this field.
   */
  last_attempt_at?: number | null
  /** Backend-formatted attempt date; null or omitted when no date is available. */
  last_attempt_at_hum?: string | null
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

/**
 * Non-empty DNS server ID collection for a one-time resolve request
 */
export type DnsServerIds = [number, ...number[]]

/**
 * One-time resolve request by domain name
 * @interface DomainResolveByNameRequest
 */
export interface DomainResolveByNameRequest {
  domain: string
  id?: never
  dns_server_ids?: DnsServerIds
}

/**
 * One-time resolve request by existing domain ID
 * @interface DomainResolveByIdRequest
 */
export interface DomainResolveByIdRequest {
  id: number
  domain?: never
  dns_server_ids?: DnsServerIds
}

/**
 * One-time resolve request with exactly one source
 */
export type DomainResolveCheckRequest = DomainResolveByNameRequest | DomainResolveByIdRequest

/**
 * Resolve result returned for one DNS server
 * @interface DnsServerResolveResult
 */
export interface DnsServerResolveResult {
  server: string
  server_type: string
  ips_v4: string[]
  ips_v6: string[]
  cnames: string[]
}

/**
 * One-time domain resolve response
 * @interface DomainResolveCheckResponse
 */
export interface DomainResolveCheckResponse {
  domain: string
  results: DnsServerResolveResult[]
}

/** Pagination and independent status filters accepted by both domain list and search endpoints. */
export interface DomainsQueryParams extends PaginationParams {
  /** Selects the saved resolution flag; omission includes both resolution states. */
  resolved?: boolean
  /** True restricts rows to positive IDs with neither date; false or omission adds no restriction. */
  unprocessed?: boolean
}
