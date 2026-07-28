/**
 * API Types index
 * Centralized export for all API types
 */

// Common types
export type { PaginationParams, PaginatedResponse, OkResponse, ErrorResponse } from './common'

// DNS types
export type { DnsServer, DnsServerCreateData } from './dns'

// Domains types
export type {
  DomainsList,
  Domain,
  DomainsListCreateData,
  DomainCreateData,
  DnsServerIds,
  DomainResolveByNameRequest,
  DomainResolveByIdRequest,
  DomainResolveCheckRequest,
  DnsServerResolveResult,
  DomainResolveCheckResponse,
} from './domains'

// IPs types
export type {
  IpsList,
  IpAddress,
  IpsListCreateData,
  IpAddressCreateData,
  RipeStatPrefixCheckByAddressRequest,
  RipeStatPrefixCheckByIdRequest,
  RipeStatPrefixCheckRequest,
  RipeStatPrefixCheckResponse,
} from './ips'

// RouterOS types
export type { RosConfig, RosConfigCreateData } from './ros'

// Statistics types
export type {
  StatsDnsData,
  StatsDomainsListItem,
  StatsDomainsData,
  StatsIpsListItem,
  StatsIpsData,
  StatsRosData,
  StatsResponse,
  GrowthEntity,
  GrowthGranularity,
  GrowthDateField,
  StatsGrowthPoint,
  StatsGrowthResponse,
  StatsGrowthParams,
} from './stats'
