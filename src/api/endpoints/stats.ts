/**
 * Statistics API endpoints
 */
import { apiRequest } from '@/api/client'
import type { StatsResponse, StatsGrowthResponse, StatsGrowthParams } from '@/api/types/stats'

function toApiDate(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace('T', ' ') + (value.length === 16 ? ':00' : '')
}

export const statsApi = {
  getStats(): Promise<StatsResponse> {
    return apiRequest<StatsResponse>('/stats')
  },

  getGrowth(params: StatsGrowthParams): Promise<StatsGrowthResponse> {
    const query = new URLSearchParams()
    query.set('entity', params.entity)
    if (params.granularity) query.set('granularity', params.granularity)
    if (params.start_date) query.set('start_date', toApiDate(params.start_date))
    if (params.end_date) query.set('end_date', toApiDate(params.end_date))
    if (params.ip_subtype !== null && params.ip_subtype !== undefined) {
      query.set('ip_subtype', String(params.ip_subtype))
    }
    if (params.date_filter_field) query.set('date_filter_field', params.date_filter_field)
    return apiRequest<StatsGrowthResponse>(`/stats/growth?${query.toString()}`)
  },
}
