/**
 * API Types index
 * Centralized export for all API types
 */

// Common types
export type { PaginationParams, PaginatedResponse, OkResponse, ErrorResponse } from './common'

// DNS types
export type { DnsServer, DnsServerCreateData } from './dns'

// Domains types
export type { DomainsList, Domain, DomainsListCreateData, DomainCreateData } from './domains'

// IPs types
export type { IpsList, IpAddress, IpsListCreateData, IpAddressCreateData } from './ips'

// RouterOS types
export type { RosConfig, RosConfigCreateData } from './ros'
