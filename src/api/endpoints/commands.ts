import { apiRequest } from '../client'
import type { OkResponse } from '../types/common'

/**
 * Commands API methods
 */
export const commandsApi = {
  /**
   * Download domains and IPs lists
   * @param {boolean} [forced=false] - Force reload lists
   * @returns {Promise<OkResponse>}
   */
  loadLists: (forced: boolean = false) => {
    const params = new URLSearchParams({ forced: String(forced) })
    return apiRequest<OkResponse>(`/commands/lists/load?${params}`, {
      method: 'POST',
    })
  },

  /**
   * Resolve all domains
   * @returns {Promise<OkResponse>}
   */
  resolveDomains: () =>
    apiRequest<OkResponse>('/commands/domains/resolve', {
      method: 'POST',
    }),

  /**
   * Update firewall and routing at RouterOS devices
   * @param {number} [type] - IP address type filter (4 or 6)
   * @returns {Promise<OkResponse>}
   */
  updateRouterOS: (type?: number) => {
    const params = type ? `?${new URLSearchParams({ type: String(type) })}` : ''
    return apiRequest<OkResponse>(`/commands/ros/update${params}`, {
      method: 'POST',
    })
  },
}
