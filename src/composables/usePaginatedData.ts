import { ref } from 'vue'
import { usePagination } from './usePagination'

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  limit: number
  offset: number
}

/**
 * API response with pagination
 */
export interface PaginatedResponse<T> {
  payload: T[]
  total: number
}

/**
 * Loader function type
 */
export type DataLoader<T> = (params: PaginationParams) => Promise<PaginatedResponse<T>>

/**
 * Composable for managing paginated data with automatic loading
 * Combines pagination state with data fetching logic
 *
 * @template T - Type of data items
 * @param {DataLoader<T>} loader - Function to load data with pagination params
 * @param {number} [initialPageSize=20] - Initial page size
 * @returns Object with data, loading state, pagination and methods
 *
 * @example
 * const { data, isLoading, pagination, load, refresh } = usePaginatedData(
 *   async (params) => await dnsApi.getAll(params)
 * )
 *
 * // Load data manually
 * await load()
 *
 * // Pagination will automatically trigger reload
 * pagination.goToPage(2)
 * pagination.changePageSize(50)
 */
export function usePaginatedData<T>(loader: DataLoader<T>, initialPageSize: number = 20) {
  const data = ref<T[]>([])
  const isLoading = ref(false)
  const pagination = usePagination(initialPageSize)

  /**
   * Load data with current pagination params
   */
  const load = async () => {
    isLoading.value = true
    try {
      const response = await loader({
        limit: pagination.pageSize.value,
        offset: pagination.offset.value,
      })
      data.value = response.payload
      pagination.totalItems.value = response.total
    } catch (error) {
      console.error('Failed to load paginated data:', error)
      data.value = []
      pagination.totalItems.value = 0
    } finally {
      isLoading.value = false
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
  }
}
