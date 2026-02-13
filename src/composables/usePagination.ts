import { ref, computed } from 'vue'
import { PAGINATION } from '@/constants'

const { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } = PAGINATION

/**
 * Composable for table pagination management
 * @param {number} [initialPageSize=20] - Initial page size
 * @returns Object with pagination parameters and methods
 */
export function usePagination(initialPageSize: number = DEFAULT_PAGE_SIZE) {
  const currentPage = ref(1)
  const pageSize = ref(initialPageSize)
  const totalItems = ref(0)

  const offset = computed(() => (currentPage.value - 1) * pageSize.value)
  const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value))
  const hasNextPage = computed(() => currentPage.value < totalPages.value)
  const hasPrevPage = computed(() => currentPage.value > 1)

  const nextPage = () => {
    if (hasNextPage.value) currentPage.value++
  }

  const prevPage = () => {
    if (hasPrevPage.value) currentPage.value--
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) currentPage.value = page
  }

  const changePageSize = (size: number) => {
    pageSize.value = size
    currentPage.value = 1
  }

  const reset = () => {
    currentPage.value = 1
    totalItems.value = 0
  }

  return {
    currentPage,
    pageSize,
    totalItems,
    offset,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
    changePageSize,
    reset,
    PAGE_SIZE_OPTIONS,
  }
}
