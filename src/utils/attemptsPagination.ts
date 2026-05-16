import type { PaginatedResponse, PaginationParams } from '@/api/types/common'
import {
  loadClientFilteredPage,
  type ClientFilteredPaginationOptions,
  type RequiredPaginationParams,
} from '@/utils/clientPagination'

export type { RequiredPaginationParams } from '@/utils/clientPagination'

export type AttemptsFilter = 'all' | 'success' | 'errors' | 'critical'

export interface AttemptsItem {
  attempts: number
}

export interface AttemptsFetchParams extends PaginationParams {
  attempts?: number
}

export interface AttemptsPageFetcher<T> {
  (params: AttemptsFetchParams): Promise<PaginatedResponse<T>>
}

export interface AttemptsFilteredPaginationOptions<T> extends ClientFilteredPaginationOptions {
  filterItem?: (item: T) => boolean
}

const getExactAttemptsParam = (filter: AttemptsFilter): number | undefined => {
  return filter === 'success' ? 0 : undefined
}

export const matchesAttemptsFilter = <T extends AttemptsItem>(item: T, filter: AttemptsFilter): boolean => {
  if (filter === 'success') return item.attempts === 0
  if (filter === 'errors') return item.attempts > 0 && item.attempts < 3
  if (filter === 'critical') return item.attempts >= 3
  return true
}

/**
 * Load a page from a dataset that must be filtered before pagination.
 *
 * The backend currently supports only exact `attempts` equality and returns
 * unfiltered totals for some list endpoints. This helper keeps row data,
 * notifications, and pagination totals based on the same client-filtered set.
 */
export const loadAttemptsFilteredPage = async <T extends AttemptsItem>(
  fetchPage: AttemptsPageFetcher<T>,
  params: RequiredPaginationParams,
  filter: AttemptsFilter,
  options: boolean | AttemptsFilteredPaginationOptions<T> = false,
): Promise<PaginatedResponse<T>> => {
  const paginationOptions =
    typeof options === 'boolean'
      ? {
          forceClientPagination: options,
        }
      : options
  const shouldUseClientPagination =
    filter !== 'all' || Boolean(paginationOptions.forceClientPagination) || paginationOptions.filterItem !== undefined

  if (!shouldUseClientPagination) return fetchPage(params)

  const attempts = getExactAttemptsParam(filter)
  const filterItem = paginationOptions.filterItem
  return loadClientFilteredPage<T, PaginatedResponse<T>>(
    (pageParams) =>
      fetchPage({
        ...pageParams,
        attempts,
      }),
    params,
    (item) => matchesAttemptsFilter(item, filter) && (filterItem ? filterItem(item) : true),
    {
      ...paginationOptions,
      forceClientPagination: true,
    },
  )
}
