import { ref } from 'vue'
import { usePagination } from './usePagination'
import { useLatestRequest } from './useLatestRequest'

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  /** Maximum rows requested for this page. */
  limit: number
  /** Number of rows skipped before this page. */
  offset: number
}

/**
 * API response with pagination
 */
export interface PaginatedResponse<T> {
  /** Rows returned for the requested page. */
  payload: T[]
  /** Total rows matching the requested dataset. */
  total: number
}

/**
 * Loader function type
 */
export type DataLoader<T> = (params: PaginationParams) => Promise<PaginatedResponse<T>>

/**
 * Combines pagination state with explicit data loading. Only the latest load may publish rows,
 * totals or loading completion. Pages sharing these refs with custom loaders must use requests too.
 *
 * @template T - Type of data items
 * @param {DataLoader<T>} loader - Function to load data with pagination params
 * @param {number} [initialPageSize=20] - Initial page size
 * @returns Object with data, loading state, pagination and methods
 *
 * @example
 * const { data, isLoading, goToPage, changePageSize, load, refresh } = usePaginatedData(
 *   async (params) => await dnsApi.getAll(params)
 * )
 *
 * // Load data manually
 * await load()
 *
 * // Use the loading wrappers to change pagination and request the selected page
 * goToPage(2)
 * changePageSize(50)
 */
export function usePaginatedData<T>(loader: DataLoader<T>, initialPageSize: number = 20) {
  // data contains the latest accepted page; isLoading describes the active load.
  const data = ref<T[]>([])
  const isLoading = ref(false)
  // pagination owns the selected page, requested size and accepted result total.
  const pagination = usePagination(initialPageSize)
  // requests also lets custom page loaders invalidate this composable's pending responses.
  const requests = useLatestRequest()

  /**
   * Loads a snapshot of the current page, ignoring success, failure and completion from obsolete loads.
   */
  const load = async () => {
    // isCurrent checks whether this load still owns the shared result state.
    const isCurrent = requests.begin()
    if (!isCurrent()) return
    isLoading.value = true
    try {
      // response contains rows and the total for the page selected at invocation time.
      const response = await loader({
        limit: pagination.pageSize.value,
        offset: pagination.offset.value,
      })
      if (!isCurrent()) return
      data.value = response.payload
      pagination.totalItems.value = response.total
    } catch (error) {
      // error is this load's failure; obsolete failures must not erase a newer result.
      if (!isCurrent()) return
      console.error('Failed to load paginated data:', error)
      data.value = []
      pagination.totalItems.value = 0
    } finally {
      if (isCurrent()) isLoading.value = false
    }
  }

  /**
   * Refresh data (reload current page)
   */
  const refresh = () => load()

  /**
   * Reset pagination and reload data
   */
  const reset = () => {
    pagination.reset()
    load()
  }

  /**
   * Go to specific page and load data
   */
  const goToPage = (page: number) => {
    pagination.goToPage(page)
    load()
  }

  /**
   * Change page size and reload from first page
   */
  const changePageSize = (size: number) => {
    pagination.changePageSize(size)
    load()
  }

  /**
   * Go to next page and load data
   */
  const nextPage = () => {
    pagination.nextPage()
    load()
  }

  /**
   * Go to previous page and load data
   */
  const prevPage = () => {
    pagination.prevPage()
    load()
  }

  return {
    data,
    isLoading,
    pagination,
    load,
    refresh,
    reset,
    goToPage,
    changePageSize,
    nextPage,
    prevPage,
    requests,
  }
}
