<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { domainsApi, type DomainsResponse } from '@/api/endpoints/domains'
import { statsApi } from '@/api/endpoints/stats'
import type { Domain, DomainCreateData } from '@/api/types/domains'
import { DOMAIN_RESOLVE_CHECK_TEXTS, DOMAIN_RESOLVE_NOW_TEXTS, PAGINATION, SEARCH, UI_TEXTS } from '@/constants'
import DomainResolveCheckModal from '@/components/domains/DomainResolveCheckModal.vue'
import DomainResolveNowModal from '@/components/domains/DomainResolveNowModal.vue'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import BaseInput from '@/ui/forms/BaseInput.vue'
import BaseTextarea from '@/ui/forms/BaseTextarea.vue'
import {
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  BoltIcon,
  GlobeAltIcon,
} from '@heroicons/vue/24/outline'
import { showSuccess, showWarning, showInfo } from '@/utils/notifications'
import { delay } from '@/utils/timers'
import { errorHandler } from '@/utils/errorHandler'
import { loadClientFilteredPage } from '@/utils/clientPagination'
import { useDebouncedTask, useLatestRequest } from '@/composables'
import {
  hasColumnFilters,
  matchesColumnFilters,
  type TableColumn,
  type TableColumnFilters,
} from '@/ui/tables/columnFilters'

/**
 * Domains management page
 * @component DomainsPage
 */
/** waitingForRefresh identifies the refresh after a successful mutation, including the wait before it begins. */
const waitingForRefresh = ref(false)
const searchQuery = ref('')
/** Exclusive table status; unprocessed is independent of the domain's saved resolved flag. */
type DomainStatusFilter = 'all' | 'resolved' | 'unresolved' | 'unprocessed'
/** domainStatusFilter is the only selected status button and resets with the other button filters. */
const domainStatusFilter = ref<DomainStatusFilter>('all')
/** resolvedFilter derives the existing API flag only for its two resolution categories. */
const resolvedFilter = computed(() =>
  domainStatusFilter.value === 'resolved' ? true : domainStatusFilter.value === 'unresolved' ? false : undefined,
)
/** unprocessedFilter enables server-side date eligibility only for the unprocessed category. */
const unprocessedFilter = computed(() => (domainStatusFilter.value === 'unprocessed' ? true : undefined))
type DomainListFilter = 'all' | 'with-list' | 'without-list'
const listFilter = ref<DomainListFilter>('all')
const columnFilters = ref<TableColumnFilters>({})

// Data management
// statsRequests keeps global counts independent of table queries and rejects old responses after refresh or teardown.
const statsRequests = useLatestRequest()
// requests coordinates search, filtered reloads and input invalidation for this table.
const requests = useLatestRequest()
const domains = ref<Domain[]>([])
const isLoading = ref(false)
/** hasError records a failure in the current table query, including search and filters. */
const hasError = ref(false)

// Global stats (always unfiltered — used for stat cards)
const globalTotalResolved = ref(0)
const globalTotalQuery = ref(0)
/** globalUnprocessed counts every ordinary domain without a saved attempt or success date, independent of the table. */
const globalUnprocessed = ref(0)
const globalWithListTotal = ref(0)
const globalWithListResolved = ref(0)
const globalWithListUnresolved = ref(0)

// Pagination counters (change with active filter)
const totalItems = ref(0)
const pageSize = ref(PAGINATION.DEFAULT_PAGE_SIZE)
const currentPage = ref(1)
const totalPages = computed(() => Math.ceil(totalItems.value / pageSize.value))
const offset = computed(() => (currentPage.value - 1) * pageSize.value)

const pagination = {
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  offset,
  PAGE_SIZE_OPTIONS: PAGINATION.PAGE_SIZE_OPTIONS,
}

/** hasActiveButtonFilters enables reset for any status category or list-presence selection. */
const hasActiveButtonFilters = computed(() => domainStatusFilter.value !== 'all' || listFilter.value !== 'all')
const isGlobalStatsLoaded = computed(() => globalTotalQuery.value > 0)
const hasActiveColumnFilters = computed(() => hasColumnFilters(columnFilters.value))

// Modals
const isAddModalOpen = ref(false)
const isViewModalOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const isResolveCheckModalOpen = ref(false)
const isResolveNowModalOpen = ref(false)
const domainToDelete = ref<number | null>(null)
const selectedDomain = ref<Domain | null>(null)
const domainToResolveCheck = ref<Domain | null>(null)
const domainToResolveNow = ref<Domain | null>(null)

// Form data
const formData = ref<DomainCreateData>({
  domain: '',
  list_id: undefined,
  ros_comment: undefined,
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS: TableColumn<Domain>[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Домен', sortable: true },
  {
    key: 'domains_list_id',
    label: 'Список',
    sortable: true,
    filterValue: (_row: Domain, value: unknown) => (value ? `список ${value}` : 'без списка'),
  },
  {
    key: 'resolved',
    label: 'Статус',
    sortable: true,
    filterValue: (_row: Domain, value: unknown) =>
      value ? 'определен определён resolved true да yes 1' : 'не определен не определён unresolved false нет no 0',
  },
  { key: 'ips_v4', label: 'IPv4' },
  { key: 'ips_v6', label: 'IPv6' },
  { key: 'ros_comment', label: 'Комментарий', sortable: true },
  { key: 'created_at_hum', label: 'Создано', sortable: true },
  { key: 'last_resolved_at_hum', label: 'Определено', sortable: true },
  { key: 'actions', label: 'Действия' },
]

/** Captures list and column filters and returns a stable predicate for every fetched backend page. */
const createDomainFilter = () => {
  // selectedList is this request's list category; filters is its independent column-filter snapshot.
  const selectedList = listFilter.value
  const filters = { ...columnFilters.value }
  return (domain: Domain): boolean => {
    if (selectedList === 'with-list' && domain.domains_list_id == null) return false
    if (selectedList === 'without-list' && domain.domains_list_id != null) return false
    return matchesColumnFilters(domain, TABLE_COLUMNS, filters)
  }
}

/**
 * Whether search should be delegated to API.
 */
const hasActiveSearch = () => Boolean(searchQuery.value && searchQuery.value.length >= SEARCH.MIN_LENGTH)

const getColumnFilterQuery = (key: string): string | undefined => {
  const query = columnFilters.value[key]?.trim()
  return query && query.length > 0 ? query : undefined
}

const getApiSearchQuery = (): string | undefined => {
  if (hasActiveSearch()) return searchQuery.value
  return getColumnFilterQuery('name')
}

/** Returns an exact existing list subtotal, or requests a full filtered scan when no matching aggregate exists. */
const getKnownListFilterTotal = (): number | undefined => {
  if (
    domainStatusFilter.value === 'unprocessed' ||
    listFilter.value === 'all' ||
    hasActiveSearch() ||
    hasActiveColumnFilters.value
  )
    return undefined

  // withListTotals holds existing all/resolved/unresolved counts for list members; none describes unprocessed domains.
  const withListTotals = {
    all: globalWithListTotal.value,
    resolved: globalWithListResolved.value,
    unresolved: globalWithListUnresolved.value,
  }
  // withoutListTotals subtracts list members from the corresponding existing global all/resolved/unresolved counts.
  const withoutListTotals = {
    all: globalTotalQuery.value - globalWithListTotal.value,
    resolved: globalTotalResolved.value - globalWithListResolved.value,
    unresolved: globalTotalQuery.value - globalTotalResolved.value - globalWithListUnresolved.value,
  }

  if (resolvedFilter.value === true) {
    return listFilter.value === 'with-list' ? withListTotals.resolved : withoutListTotals.resolved
  }

  if (resolvedFilter.value === false) {
    return listFilter.value === 'with-list' ? withListTotals.unresolved : withoutListTotals.unresolved
  }

  return listFilter.value === 'with-list' ? withListTotals.all : withoutListTotals.all
}

/**
 * Load global stats from the dedicated statistics API endpoint
 */
// The default isCurrent predicate keeps standalone statistics refreshes independent of table query changes.
const loadGlobalStats = async (isCurrent: () => boolean = () => true) => {
  // An obsolete dependent caller must not supersede an independent statistics refresh.
  if (!isCurrent()) return
  // isStatsCurrent prevents older statistics responses from replacing a newer refresh or surviving unmount.
  const isStatsCurrent = statsRequests.begin()
  if (!isStatsCurrent() || !isCurrent()) return
  try {
    // stats is the dedicated global statistics response for the current caller.
    const stats = await statsApi.getStats()
    // Global counts do not depend on the table query, so an accepted statistics response survives input edits.
    if (!isStatsCurrent()) return
    globalTotalResolved.value = stats.domains.resolved
    globalTotalQuery.value = stats.domains.total
    globalUnprocessed.value = stats.domains.unprocessed
    // The reduce callbacks accumulate each list's total, resolved and unresolved counts in sum.
    globalWithListTotal.value = stats.domains.per_list.reduce((sum, list) => sum + list.total, 0)
    globalWithListResolved.value = stats.domains.per_list.reduce((sum, list) => sum + list.resolved, 0)
    globalWithListUnresolved.value = stats.domains.per_list.reduce((sum, list) => sum + list.unresolved, 0)
  } catch (error) {
    // error is the statistics failure; obsolete table-dependent refreshes must not notify.
    if (!isStatsCurrent() || !isCurrent()) return
    errorHandler.handleError(error, {
      action: 'loadGlobalStats',
      component: 'DomainsPage',
    })
  }
}

/**
 * Load domains (paginated, with active filters).
 * @param useKnownTotal - Allows the statistics count to shorten a filtered scan on regular page loads.
 */
const loadDomainsWithStats = async (useKnownTotal = true) => {
  // isCurrent guards this load; filterItem freezes row matching; pageParams freezes the requested page.
  const isCurrent = requests.begin()
  const filterItem = createDomainFilter()
  const pageParams = { limit: pageSize.value, offset: offset.value }
  // resolved is the API filter used by every backend page in this request.
  const resolved = resolvedFilter.value
  // unprocessed captures the server-side eligibility flag for every backend batch in this request.
  const unprocessed = unprocessedFilter.value
  // forceClientPagination keeps the original list/column filtering policy for this request.
  const forceClientPagination = listFilter.value !== 'all' || hasActiveColumnFilters.value
  if (!isCurrent()) return
  hasError.value = false
  isLoading.value = true
  try {
    if (listFilter.value !== 'all' && !isGlobalStatsLoaded.value) {
      await loadGlobalStats(isCurrent)
      if (!isCurrent()) return
    }

    // The known total is read only while this request still owns the unchanged filter intent.
    const knownListFilterTotal = useKnownTotal ? getKnownListFilterTotal() : undefined
    // fetchFilteredPage scans the captured filter; totalHint reuses the statistics count when available.
    const fetchFilteredPage = (totalHint?: number) =>
      loadClientFilteredPage(
        // params sets each backend slice while the captured API filters stay fixed.
        (params) =>
          domainsApi.getAll({
            ...params,
            resolved,
            unprocessed,
          }),
        pageParams,
        filterItem,
        {
          forceClientPagination,
          knownTotal: totalHint,
          stopWhenPageFilled: totalHint !== undefined,
        },
      )

    // response is the first page calculation, which can carry a count from before the latest deletion.
    const response = await fetchFilteredPage(knownListFilterTotal)
    if (!isCurrent()) return
    // verifyTotal requests an exact scan only when a cached count accompanies an empty later page.
    const verifyTotal = knownListFilterTotal !== undefined && pageParams.offset > 0 && response.payload.length === 0
    // The reload callback omits the hint for the corrected page when the previous page needed an exact scan.
    await publishDomainPage(verifyTotal ? await fetchFilteredPage() : response, isCurrent, () =>
      loadDomainsWithStats(useKnownTotal && !verifyTotal),
    )
  } catch (error) {
    // error belongs to this load; an obsolete failure must not clear or notify over a newer intent.
    if (!isCurrent()) return
    hasError.value = true
    errorHandler.handleError(error, {
      action: 'loadDomainsWithStats',
      component: 'DomainsPage',
    })
    domains.value = []
    totalItems.value = 0
  } finally {
    if (isCurrent()) {
      waitingForRefresh.value = false
      isLoading.value = false
    }
  }
}

/**
 * Search domains immediately with current pagination and filters.
 */
const runSearchDomains = async () => {
  // apiSearchQuery selects the main search or the searchable column value at invocation time.
  const apiSearchQuery = getApiSearchQuery()

  if (!apiSearchQuery) {
    await loadDomainsWithStats()
    return
  }

  // isCurrent guards this load; filterItem freezes row matching; pageParams freezes the requested page.
  const isCurrent = requests.begin()
  const filterItem = createDomainFilter()
  const pageParams = { limit: pageSize.value, offset: offset.value }
  // resolved is the API filter used by every backend page in this request.
  const resolved = resolvedFilter.value
  // unprocessed captures the server-side eligibility flag for every backend batch in this request.
  const unprocessed = unprocessedFilter.value
  // forceClientPagination keeps the original list/column filtering policy for this request.
  const forceClientPagination = listFilter.value !== 'all' || hasActiveColumnFilters.value
  // query and notifySearch preserve the entered search for error context and accepted-result notifications.
  const query = searchQuery.value
  const notifySearch = hasActiveSearch()
  if (!isCurrent()) return
  hasError.value = false
  isLoading.value = true
  try {
    // response combines backend batches; fetch callbacks use only the parameters captured above.
    const response = await loadClientFilteredPage(
      (params) =>
        domainsApi.search(apiSearchQuery, {
          ...params,
          resolved,
          unprocessed,
        }),
      pageParams,
      filterItem,
      forceClientPagination,
    )

    if (!(await publishDomainPage(response, isCurrent))) return

    if (notifySearch) {
      if (response.total_query === 0) {
        showInfo(`По запросу "${query}" ничего не найдено`, 'Результаты поиска')
      } else {
        showInfo(`Найдено доменов: ${response.total_query}`, 'Результаты поиска')
      }
    }
  } catch (error) {
    // error belongs to this load; an obsolete failure must not clear or notify over a newer intent.
    if (!isCurrent()) return
    hasError.value = true
    errorHandler.handleError(error, {
      action: 'searchDomains',
      component: 'DomainsPage',
      query,
    })
    domains.value = []
    totalItems.value = 0
  } finally {
    if (isCurrent()) {
      waitingForRefresh.value = false
      isLoading.value = false
    }
  }
}

/**
 * Publishes an accepted domain page and reloads a valid final page when the result set shrank.
 * @param response - The current backend or client-filtered page and its query total.
 * @param isCurrent - Reports whether the original request still owns the table.
 * @param reloadPage - Loads the corrected page with the current data source and count policy.
 * @returns Whether this request published the accepted page.
 */
const publishDomainPage = async (
  response: DomainsResponse,
  isCurrent: () => boolean,
  reloadPage: () => Promise<void> = loadActiveDomains,
): Promise<boolean> => {
  if (!isCurrent()) return false
  totalItems.value = response.total_query
  // lastPage keeps empty results on page one while bounding every nonempty selection by its current filtered total.
  const lastPage = Math.max(1, totalPages.value)
  if (currentPage.value > lastPage) {
    currentPage.value = lastPage
    if (response.total_query > 0) {
      await reloadPage()
      return false
    }
  }
  domains.value = response.payload
  return true
}

/**
 * Load domains through the active data source.
 */
const loadActiveDomains = () => {
  if (getApiSearchQuery()) return runSearchDomains()
  return loadDomainsWithStats()
}

/**
 * Refreshes domains and global stats after create/delete without dropping the refresh status.
 */
const refreshDomains = () => {
  cancelPendingInputLoads(false)
  loadGlobalStats()
  return loadActiveDomains()
}

/** runSearchDomainsDebounced queues the callback that resets the page and loads current input;
 * cancelSearchDomainsDebounce clears that queued execution. */
const { run: runSearchDomainsDebounced, cancel: cancelSearchDomainsDebounce } = useDebouncedTask(async () => {
  currentPage.value = 1 // Reset to first page
  await loadActiveDomains()
})

/** runColumnFiltersDebounced queues the callback that reloads active filters;
 * cancelColumnFiltersDebounce clears that queued execution. */
const { run: runColumnFiltersDebounced, cancel: cancelColumnFiltersDebounce } = useDebouncedTask(async () => {
  await loadActiveDomains()
})

/** Clears queued input loads and rejects earlier responses. clearRefreshStatus stays false when writes request a reload. */
const cancelPendingInputLoads = (clearRefreshStatus = true) => {
  if (clearRefreshStatus) waitingForRefresh.value = false
  requests.invalidate()
  cancelSearchDomainsDebounce()
  cancelColumnFiltersDebounce()
}

/**
 * Go to specific page and load data
 */
const goToPage = (page: number) => {
  if (isLoading.value || !Number.isInteger(page) || page < 1 || page > totalPages.value || page === currentPage.value)
    return
  cancelPendingInputLoads()
  currentPage.value = page
  loadActiveDomains()
}

/**
 * Change page size and reload from first page
 */
const changePageSize = (size: number) => {
  if (isLoading.value || !PAGINATION.PAGE_SIZE_OPTIONS.includes(size) || size === pageSize.value) return
  cancelPendingInputLoads()
  pageSize.value = size
  currentPage.value = 1
  loadActiveDomains()
}

/** Replaces column filters and invalidates old responses before scheduling the filtered reload. */
const updateColumnFilters = (filters: TableColumnFilters) => {
  cancelPendingInputLoads()
  columnFilters.value = filters
  currentPage.value = 1
  isLoading.value = true
  runColumnFiltersDebounced()
}

/** Invalidates old responses as soon as input changes, then schedules the existing search debounce. */
const searchDomains = () => {
  cancelPendingInputLoads()
  currentPage.value = 1
  isLoading.value = true
  runSearchDomainsDebounced()
}

/**
 * Select one status category and reload its server-filtered first page.
 */
const filterByStatus = (value: DomainStatusFilter) => {
  cancelPendingInputLoads()
  domainStatusFilter.value = value
  currentPage.value = 1 // Reset to first page
  loadActiveDomains()
}

/**
 * Filter by list presence
 */
const filterByList = async (value: DomainListFilter) => {
  cancelPendingInputLoads()
  listFilter.value = value
  currentPage.value = 1 // Reset to first page
  // pendingLoad starts synchronously; isCurrent checks the generation it selected before notifying.
  const pendingLoad = loadActiveDomains()
  const isCurrent = requests.capture()
  await pendingLoad
  if (!isCurrent()) return

  // Show filter notification
  // filterLabels supplies the existing empty-result message for the selected list category.
  const filterLabels = {
    all: 'все списки',
    'with-list': 'домены со списком',
    'without-list': 'домены без списка',
  }
  if (!hasError.value && domains.value.length === 0) {
    showInfo(`Нет доменов для фильтра: ${filterLabels[value]}`, 'Фильтрация')
  }
}

/**
 * Reset button filters to default values
 */
const resetButtonFilters = () => {
  cancelPendingInputLoads()
  domainStatusFilter.value = 'all'
  listFilter.value = 'all'
  currentPage.value = 1
  loadActiveDomains()
}

/**
 * Validate form data
 */
const validateForm = (): boolean => {
  formErrors.value = {}

  if (!formData.value.domain || formData.value.domain.trim().length < 3) {
    formErrors.value.domain = 'Укажите доменное имя (минимум 3 символа)'
    showWarning('Укажите доменное имя (минимум 3 символа)', 'Ошибка валидации')
    return false
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  if (!domainRegex.test(formData.value.domain.trim())) {
    formErrors.value.domain = 'Некорректный формат доменного имени'
    showWarning('Некорректный формат доменного имени', 'Ошибка валидации')
    return false
  }

  return true
}

/**
 * Open add modal
 */
const openAddModal = () => {
  formData.value = { domain: '', list_id: undefined, ros_comment: undefined }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Close add modal and reset form
 */
const closeAddModal = () => {
  formData.value = { domain: '', list_id: undefined, ros_comment: undefined }
  formErrors.value = {}
  isAddModalOpen.value = false
}

/**
 * Open an editable one-time domain resolve check.
 */
const openDomainResolveCheck = () => {
  domainToResolveCheck.value = null
  isResolveCheckModalOpen.value = true
}

/**
 * Open a one-time resolve check for an existing domain.
 * @param {Domain} domain - Selected table row
 */
const openSavedDomainResolveCheck = (domain: Domain) => {
  domainToResolveCheck.value = domain
  isResolveCheckModalOpen.value = true
}

/**
 * Close the one-time resolve check and clear its source.
 */
const closeDomainResolveCheck = () => {
  isResolveCheckModalOpen.value = false
  domainToResolveCheck.value = null
}

/**
 * Check whether a stored domain can use the resolve-by-ID endpoint.
 * @param {number} id - Stored domain ID
 * @returns {boolean}
 */
const canResolveDomainNow = (id: number): boolean => Number.isInteger(id) && id > 0

/**
 * Open background resolve confirmation for an existing domain.
 * @param {Domain} domain - Selected table row
 */
const openDomainResolveNow = (domain: Domain): void => {
  if (!canResolveDomainNow(domain.id)) return

  domainToResolveNow.value = domain
  isResolveNowModalOpen.value = true
}

/**
 * Close background resolve confirmation and clear its source.
 */
const closeDomainResolveNow = (): void => {
  isResolveNowModalOpen.value = false
  domainToResolveNow.value = null
}

/**
 * Create new domain
 */
const createDomain = async () => {
  if (!validateForm()) return

  // domainName retains the submitted entity name for success and error messages after form reset.
  const domainName = formData.value.domain
  cancelPendingInputLoads()
  // isCurrent controls table loading and empty-page fallback; accepted mutation outcomes depend only on scope lifetime.
  let isCurrent = requests.begin()
  if (!isCurrent()) return
  isLoading.value = true
  try {
    await domainsApi.create([formData.value])
    if (!requests.isActive()) return
    closeAddModal()
    showSuccess(`Домен "${domainName}" успешно добавлен`)
    if (isCurrent()) waitingForRefresh.value = true
    await delay()
    if (!requests.isActive()) return
    // pendingLoad starts the current table reload; its generation now owns completion and page fallback.
    const pendingLoad = refreshDomains()
    isCurrent = requests.capture()
    await pendingLoad
    if (!requests.isActive()) return
  } catch (error) {
    // error reports this submitted mutation even if table input changed; teardown still suppresses publication.
    if (!requests.isActive()) return
    errorHandler.handleError(error, {
      action: 'createDomain',
      component: 'DomainsPage',
      domain: domainName,
    })
  } finally {
    if (isCurrent()) {
      waitingForRefresh.value = false
      isLoading.value = false
    }
  }
}

/**
 * Open domain view modal
 */
const openViewModal = (domain: Domain) => {
  selectedDomain.value = domain
  isViewModalOpen.value = true
}

/**
 * Open delete confirmation dialog
 */
const openDeleteConfirm = (id: number) => {
  domainToDelete.value = id
  isDeleteConfirmOpen.value = true
}

/**
 * Delete domain
 */
const deleteDomain = async () => {
  if (!domainToDelete.value) return

  cancelPendingInputLoads()
  // domainId captures the confirmed row before selection state is cleared.
  const domainId = domainToDelete.value
  // isCurrent controls table loading and empty-page fallback; accepted mutation outcomes depend only on scope lifetime.
  let isCurrent = requests.begin()
  if (!isCurrent()) return
  isLoading.value = true
  try {
    await domainsApi.deleteOne(domainId)
    if (!requests.isActive()) return
    isDeleteConfirmOpen.value = false
    domainToDelete.value = null
    showSuccess(`Домен #${domainId} успешно удален`)

    // Reload data after deletion
    if (isCurrent()) waitingForRefresh.value = true
    await delay()
    if (!requests.isActive()) return
    // pendingLoad starts the current table reload; its generation now owns completion and page fallback.
    const pendingLoad = refreshDomains()
    isCurrent = requests.capture()
    await pendingLoad
    if (!requests.isActive()) return
  } catch (error) {
    // error reports this submitted mutation even if table input changed; teardown still suppresses publication.
    if (!requests.isActive()) return
    errorHandler.handleError(error, {
      action: 'deleteDomain',
      component: 'DomainsPage',
      domainId,
    })
    isDeleteConfirmOpen.value = false
    domainToDelete.value = null
  } finally {
    if (isCurrent()) {
      waitingForRefresh.value = false
      isLoading.value = false
    }
  }
}

/**
 * Get limited IPs for display
 */
const getLimitedIps = (ips?: string[], maxDisplay: number = 3) => {
  if (!ips || ips.length === 0) return { ips: [], remaining: 0 }
  return {
    ips: ips.slice(0, maxDisplay),
    remaining: ips.length > maxDisplay ? ips.length - maxDisplay : 0,
  }
}

onMounted(() => {
  loadGlobalStats()
  loadDomainsWithStats()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Домены</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Управление доменами и их определением в IP адреса</p>
    </div>

    <!-- Stats -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Всего доменов</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{{ globalTotalQuery }}</div>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Определено</div>
        <div class="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{{ globalTotalResolved }}</div>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Не определено</div>
        <div class="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
          {{ globalTotalQuery - globalTotalResolved }}
        </div>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Не обработано</div>
        <div class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ globalUnprocessed }}</div>
      </div>
    </div>

    <!-- Actions Bar -->
    <div class="mb-6 flex flex-col justify-between gap-4">
      <!-- Search and Filter -->
      <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <!-- Search -->
        <div class="relative max-w-md flex-1">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            @input="searchDomains"
            type="search"
            aria-label="Поиск по домену"
            placeholder="Поиск по домену..."
            class="block w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-10 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <!-- Filter by Resolved Status -->
        <div role="group" aria-label="Статус доменов" class="flex flex-wrap gap-2">
          <BaseButton
            @click="filterByStatus('all')"
            :variant="domainStatusFilter === 'all' ? 'primary' : 'ghost'"
            :aria-pressed="domainStatusFilter === 'all'"
            size="sm"
          >
            Все
          </BaseButton>
          <BaseButton
            @click="filterByStatus('resolved')"
            :variant="domainStatusFilter === 'resolved' ? 'primary' : 'ghost'"
            :aria-pressed="domainStatusFilter === 'resolved'"
            size="sm"
          >
            Определен
          </BaseButton>
          <BaseButton
            @click="filterByStatus('unresolved')"
            :variant="domainStatusFilter === 'unresolved' ? 'primary' : 'ghost'"
            :aria-pressed="domainStatusFilter === 'unresolved'"
            size="sm"
          >
            Не определен
          </BaseButton>
          <BaseButton
            @click="filterByStatus('unprocessed')"
            :variant="domainStatusFilter === 'unprocessed' ? 'primary' : 'ghost'"
            :aria-pressed="domainStatusFilter === 'unprocessed'"
            size="sm"
          >
            Не обработано
          </BaseButton>
        </div>

        <!-- Filter by List -->
        <div role="group" aria-label="Списки доменов" class="flex flex-wrap gap-2">
          <BaseButton
            @click="filterByList('all')"
            :variant="listFilter === 'all' ? 'secondary' : 'ghost'"
            :aria-pressed="listFilter === 'all'"
            size="sm"
          >
            Все списки
          </BaseButton>
          <BaseButton
            @click="filterByList('with-list')"
            :variant="listFilter === 'with-list' ? 'secondary' : 'ghost'"
            :aria-pressed="listFilter === 'with-list'"
            size="sm"
          >
            Со списком
          </BaseButton>
          <BaseButton
            @click="filterByList('without-list')"
            :variant="listFilter === 'without-list' ? 'secondary' : 'ghost'"
            :aria-pressed="listFilter === 'without-list'"
            size="sm"
          >
            Без списка
          </BaseButton>
        </div>

        <BaseButton
          @click="resetButtonFilters"
          variant="secondary"
          size="sm"
          :is-disabled="!hasActiveButtonFilters"
          :title="UI_TEXTS.RESET_FILTERS"
        >
          <ArrowPathIcon class="mr-2 h-4 w-4" />
          {{ UI_TEXTS.RESET_FILTERS }}
        </BaseButton>
      </div>

      <!-- Page Actions -->
      <div class="flex flex-col gap-2 sm:flex-row">
        <BaseButton @click="openDomainResolveCheck" variant="secondary">
          <GlobeAltIcon class="mr-2 h-5 w-5" />
          {{ DOMAIN_RESOLVE_CHECK_TEXTS.BUTTON }}
        </BaseButton>
        <BaseButton @click="openAddModal" variant="primary">
          <PlusIcon class="mr-2 h-5 w-5" />
          Добавить Домен
        </BaseButton>
      </div>
    </div>

    <PaginationControl
      :current-page="pagination.currentPage.value"
      :total-pages="pagination.totalPages.value"
      :total-items="pagination.totalItems.value"
      :page-size="pagination.pageSize.value"
      :page-size-options="pagination.PAGE_SIZE_OPTIONS"
      :is-loading="isLoading"
      show-last-page
      compact-mobile
      aria-label="Пагинация доменов сверху"
      @update:current-page="goToPage"
      @update:page-size="changePageSize"
    />

    <!-- Table -->
    <DataTable
      :data="domains"
      :columns="TABLE_COLUMNS"
      :is-loading="isLoading"
      :has-error="hasError"
      :loading-message="waitingForRefresh ? 'Изменения сохранены. Обновляем список…' : undefined"
      row-action-column="name"
      :column-filters="columnFilters"
      empty-message="Домены не найдены"
      @update:column-filters="updateColumnFilters"
      @row-click="openViewModal"
      @retry="loadActiveDomains()"
    >
      <template #cell-name="{ value }">
        <span class="font-mono text-sm font-medium">{{ value }}</span>
      </template>

      <template #cell-domains_list_id="{ value }">
        <span
          v-if="value"
          class="inline-flex items-center rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
        >
          Список #{{ value }}
        </span>
        <span v-else class="text-sm text-gray-600 dark:text-gray-300">Без списка</span>
      </template>

      <template #cell-resolved="{ value }">
        <div class="flex items-center gap-2">
          <CheckCircleIcon v-if="value" class="h-5 w-5 text-green-600 dark:text-green-400" />
          <XCircleIcon v-else class="h-5 w-5 text-red-600 dark:text-red-400" />
          <span class="text-sm">{{ value ? 'Определен' : 'Не определен' }}</span>
        </div>
      </template>

      <template #cell-ips_v4="{ value }">
        <div class="flex flex-wrap gap-1">
          <template v-if="Array.isArray(value) && value.length > 0">
            <span
              v-for="ip in getLimitedIps(value).ips"
              :key="ip"
              class="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 font-mono text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            >
              {{ ip }}
            </span>
            <span
              v-if="getLimitedIps(value).remaining > 0"
              class="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
              +{{ getLimitedIps(value).remaining }}
            </span>
          </template>
          <span v-else class="text-sm text-gray-400">-</span>
        </div>
      </template>

      <template #cell-ips_v6="{ value }">
        <div class="flex flex-wrap gap-1">
          <template v-if="Array.isArray(value) && value.length > 0">
            <span
              v-for="ip in getLimitedIps(value).ips"
              :key="ip"
              class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 font-mono text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
            >
              {{ ip }}
            </span>
            <span
              v-if="getLimitedIps(value).remaining > 0"
              class="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
              +{{ getLimitedIps(value).remaining }}
            </span>
          </template>
          <span v-else class="text-sm text-gray-400">-</span>
        </div>
      </template>

      <template #cell-ros_comment="{ value }">
        <span class="text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-last_resolved_at_hum="{ value }">
        <span class="text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center gap-2" @click.stop>
          <BaseButton
            variant="primary"
            size="sm"
            :is-disabled="!canResolveDomainNow(row.id)"
            :title="
              canResolveDomainNow(row.id)
                ? DOMAIN_RESOLVE_NOW_TEXTS.ROW_BUTTON_TITLE
                : DOMAIN_RESOLVE_NOW_TEXTS.ROW_BUTTON_UNAVAILABLE
            "
            :aria-label="
              canResolveDomainNow(row.id)
                ? `${DOMAIN_RESOLVE_NOW_TEXTS.ROW_BUTTON_TITLE}: ${row.name}`
                : `${DOMAIN_RESOLVE_NOW_TEXTS.ROW_BUTTON_UNAVAILABLE}: ${row.name}`
            "
            @click="openDomainResolveNow(row)"
          >
            <BoltIcon class="h-4 w-4" />
          </BaseButton>
          <BaseButton
            variant="secondary"
            size="sm"
            :title="DOMAIN_RESOLVE_CHECK_TEXTS.ROW_BUTTON_TITLE"
            :aria-label="`${DOMAIN_RESOLVE_CHECK_TEXTS.ROW_BUTTON_TITLE}: ${row.name}`"
            @click.stop="openSavedDomainResolveCheck(row)"
          >
            <GlobeAltIcon class="h-4 w-4" />
          </BaseButton>
          <BaseButton variant="danger" size="sm" aria-label="Удалить домен" @click.stop="openDeleteConfirm(row.id)">
            <TrashIcon class="h-4 w-4" />
          </BaseButton>
        </div>
      </template>
    </DataTable>

    <!-- Pagination -->
    <PaginationControl
      :current-page="pagination.currentPage.value"
      :total-pages="pagination.totalPages.value"
      :total-items="pagination.totalItems.value"
      :page-size="pagination.pageSize.value"
      :page-size-options="pagination.PAGE_SIZE_OPTIONS"
      :is-loading="isLoading"
      show-last-page
      compact-mobile
      aria-label="Пагинация доменов снизу"
      @update:current-page="goToPage"
      @update:page-size="changePageSize"
    />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" title="Добавить Домен" @close="closeAddModal">
      <form @submit.prevent="createDomain" class="space-y-4">
        <div>
          <BaseInput
            label="Доменное имя"
            v-model="formData.domain"
            type="text"
            placeholder="example.com"
            :error="formErrors.domain"
            required
          />
        </div>

        <div>
          <BaseTextarea
            label="Комментарий для RouterOS"
            v-model="formData.ros_comment!"
            placeholder="Комментарий для RouterOS"
            :rows="2"
          />
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <BaseButton variant="ghost" type="button" @click="closeAddModal">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :is-loading="isLoading">Создать</BaseButton>
        </div>
      </form>
    </BaseModal>

    <DomainResolveCheckModal
      :is-open="isResolveCheckModalOpen"
      :domain="domainToResolveCheck"
      @close="closeDomainResolveCheck"
    />

    <DomainResolveNowModal
      :is-open="isResolveNowModalOpen"
      :domain="domainToResolveNow"
      @close="closeDomainResolveNow"
    />

    <!-- View/Edit Domain Modal -->
    <BaseModal
      :is-open="isViewModalOpen"
      :title="`Домен: ${selectedDomain?.name || ''}`"
      @close="isViewModalOpen = false"
    >
      <div v-if="selectedDomain" class="space-y-4">
        <!-- Domain Info (Read-only) -->
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">ID</label>
            <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedDomain.id }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Доменное имя</label>
            <p class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedDomain.name }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Список доменов</label>
            <span
              v-if="selectedDomain.domains_list_id"
              class="inline-flex items-center rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
            >
              Список #{{ selectedDomain.domains_list_id }}
            </span>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Без списка</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Статус</label>
            <div class="flex items-center gap-2">
              <CheckCircleIcon v-if="selectedDomain.resolved" class="h-5 w-5 text-green-600 dark:text-green-400" />
              <XCircleIcon v-else class="h-5 w-5 text-red-600 dark:text-red-400" />
              <span class="text-sm text-gray-900 dark:text-gray-100">
                {{ selectedDomain.resolved ? 'Определен' : 'Не определен' }}
              </span>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              IPv4 адреса
              <span v-if="selectedDomain.ips_v4 && selectedDomain.ips_v4.length > 0" class="ml-1 text-gray-400">
                ({{ selectedDomain.ips_v4.length }})
              </span>
            </label>
            <div v-if="selectedDomain.ips_v4 && selectedDomain.ips_v4.length > 0" class="flex flex-wrap gap-1">
              <span
                v-for="ip in selectedDomain.ips_v4"
                :key="ip"
                class="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 font-mono text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {{ ip }}
              </span>
            </div>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Нет адресов</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              IPv6 адреса
              <span v-if="selectedDomain.ips_v6 && selectedDomain.ips_v6.length > 0" class="ml-1 text-gray-400">
                ({{ selectedDomain.ips_v6.length }})
              </span>
            </label>
            <div v-if="selectedDomain.ips_v6 && selectedDomain.ips_v6.length > 0" class="flex flex-wrap gap-1">
              <span
                v-for="ip in selectedDomain.ips_v6"
                :key="ip"
                class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 font-mono text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
              >
                {{ ip }}
              </span>
            </div>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Нет адресов</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Комментарий для RouterOS
            </label>
            <p v-if="selectedDomain.ros_comment" class="text-sm text-gray-900 dark:text-gray-100">
              {{ selectedDomain.ros_comment }}
            </p>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Не указан</p>
          </div>

          <div class="border-t pt-3 dark:border-gray-700">
            <label class="mb-2 block text-xs font-semibold text-gray-700 uppercase dark:text-gray-300"
              >Временные метки</label
            >

            <div class="space-y-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Создано</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedDomain.created_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">
                  Timestamp: {{ selectedDomain.created_at }}
                </p>
              </div>

              <div v-if="selectedDomain.updated_at_hum">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Обновлено</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedDomain.updated_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">
                  Timestamp: {{ selectedDomain.updated_at }}
                </p>
              </div>

              <div v-if="selectedDomain.last_resolved_at_hum">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400"
                  >Последнее определение</label
                >
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedDomain.last_resolved_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">
                  Timestamp: {{ selectedDomain.last_resolved_at }}
                </p>
              </div>

              <div v-if="selectedDomain.last_attempt_at_hum">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Последняя попытка</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedDomain.last_attempt_at_hum }}</p>
                <p
                  v-if="selectedDomain.last_attempt_at != null"
                  class="font-mono text-xs text-gray-500 dark:text-gray-400"
                >
                  Timestamp: {{ selectedDomain.last_attempt_at }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Close Button -->
        <div class="flex justify-end border-t pt-4 dark:border-gray-700">
          <BaseButton variant="primary" @click="isViewModalOpen = false">Закрыть</BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      :is-open="isDeleteConfirmOpen"
      title="Удалить Домен"
      message="Вы уверены, что хотите удалить этот домен? Это действие нельзя отменить."
      confirm-text="Удалить"
      cancel-text="Отмена"
      variant="danger"
      :is-loading="isLoading"
      @confirm="deleteDomain"
      @cancel="isDeleteConfirmOpen = false"
    />
  </div>
</template>

<style scoped></style>
