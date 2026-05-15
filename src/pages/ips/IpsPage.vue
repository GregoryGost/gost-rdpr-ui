<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ipsApi } from '@/api/endpoints/ips'
import { statsApi } from '@/api/endpoints/stats'
import type { IpAddress, IpAddressCreateData } from '@/api/types/ips'
import { PAGINATION, IPS_TEXTS, UI_TEXTS, SEARCH, ERROR_MESSAGES } from '@/constants'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import BaseInput from '@/ui/forms/BaseInput.vue'
import BaseTextarea from '@/ui/forms/BaseTextarea.vue'
import { PlusIcon, TrashIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
import { showSuccess, showWarning, showInfo } from '@/utils/notifications'
import { delay } from '@/utils/timers'
import { errorHandler } from '@/utils/errorHandler'
import { loadClientFilteredPage } from '@/utils/clientPagination'
import { useDebouncedTask } from '@/composables'
import {
  hasColumnFilters,
  matchesColumnFilters,
  type TableColumn,
  type TableColumnFilters,
} from '@/ui/tables/columnFilters'

/**
 * IPs management page
 * @component IpsPage
 */
const searchQuery = ref('')
type IpTypeFilter = 'all' | 'ipv4' | 'ipv6'
type IpListFilter = 'all' | 'with-list' | 'without-list'
type IpDomainFilter = 'all' | 'with-domain' | 'without-domain'
type IpGatewayFilter = 'all' | 'default-gateway' | 'vpn-gateway'

const typeFilter = ref<IpTypeFilter>('all')
const listFilter = ref<IpListFilter>('all')
const domainFilter = ref<IpDomainFilter>('all')
const gatewayFilter = ref<IpGatewayFilter>('all')
const columnFilters = ref<TableColumnFilters>({})

// Data management
const ips = ref<IpAddress[]>([])
const isLoading = ref(false)
const totalIps = ref(0)
const totalIpv4 = ref(0)
const totalIpv6 = ref(0)
const totalWithList = ref(0)
const totalWithListIpv4 = ref(0)
const totalWithListIpv6 = ref(0)
const totalWithDomain = ref(0)
const totalDefaultGateway = ref<number | undefined>(undefined)

// Pagination
const pageSize = ref(PAGINATION.DEFAULT_PAGE_SIZE)
const currentPage = ref(1)
const totalItems = ref(0)
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

const hasActiveButtonFilters = computed(
  () =>
    typeFilter.value !== 'all' ||
    listFilter.value !== 'all' ||
    domainFilter.value !== 'all' ||
    gatewayFilter.value !== 'all',
)
const hasActiveColumnFilters = computed(() => hasColumnFilters(columnFilters.value))

// Modals
const isAddModalOpen = ref(false)
const isViewModalOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const ipToDelete = ref<number | string | null>(null)
const selectedIp = ref<IpAddress | null>(null)

// Form data
const formData = ref<IpAddressCreateData>({
  addr: '',
  list_id: undefined,
  domain_id: undefined,
  ros_comment: undefined,
  use_default_gw: false,
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS: TableColumn<IpAddress>[] = [
  { key: 'id', label: UI_TEXTS.ID, sortable: true },
  {
    key: 'type',
    label: IPS_TEXTS.COLUMN_TYPE,
    sortable: true,
    filterValue: (_row: IpAddress, value: unknown) => (value === 4 ? 'ipv4 4' : 'ipv6 6'),
  },
  { key: 'addr', label: IPS_TEXTS.COLUMN_ADDR, sortable: true, sortType: 'ip' as const },
  {
    key: 'ip_list_name',
    label: IPS_TEXTS.COLUMN_IP_LIST,
    sortable: true,
    filterValue: (row: IpAddress, value: unknown) => (value ? `${value} ${row.ip_list_id}` : 'без списка'),
  },
  {
    key: 'domain_name',
    label: IPS_TEXTS.COLUMN_DOMAIN,
    sortable: true,
    filterValue: (row: IpAddress, value: unknown) => (value ? `${value} ${row.domain_id}` : 'без домена'),
  },
  { key: 'ros_comment', label: IPS_TEXTS.COLUMN_ROS_COMMENT, sortable: true },
  {
    key: 'use_default_gw',
    label: IPS_TEXTS.COLUMN_USE_DEFAULT_GATEWAY,
    sortable: true,
    filterValue: (_row: IpAddress, value: unknown) => (value ? 'да yes true 1' : 'нет no false 0'),
  },
  { key: 'created_at_hum', label: UI_TEXTS.CREATED, sortable: true },
  { key: 'actions', label: UI_TEXTS.ACTIONS },
]

const matchesIpFilters = (ip: IpAddress): boolean => {
  if (typeFilter.value === 'ipv4' && ip.type !== 4) return false
  if (typeFilter.value === 'ipv6' && ip.type !== 6) return false
  if (listFilter.value === 'with-list' && ip.ip_list_id == null) return false
  if (listFilter.value === 'without-list' && ip.ip_list_id != null) return false
  if (domainFilter.value === 'with-domain' && ip.domain_id == null) return false
  if (domainFilter.value === 'without-domain' && ip.domain_id != null) return false
  if (gatewayFilter.value === 'default-gateway' && ip.use_default_gw !== true) return false
  if (gatewayFilter.value === 'vpn-gateway' && ip.use_default_gw === true) return false
  return true
}

const matchesActiveIpFilters = (ip: IpAddress): boolean => {
  return matchesIpFilters(ip) && matchesColumnFilters(ip, TABLE_COLUMNS, columnFilters.value)
}

/**
 * Map active type filter to the API query parameter.
 */
const getTypeFilterParam = () => {
  if (typeFilter.value === 'ipv4') return 4
  if (typeFilter.value === 'ipv6') return 6
  return undefined
}

/**
 * Map active gateway filter to the API query parameter.
 */
const getGatewayFilterParam = () => {
  if (gatewayFilter.value === 'default-gateway') return true
  if (gatewayFilter.value === 'vpn-gateway') return false
  return undefined
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
  return getColumnFilterQuery('addr')
}

const shouldUseClientPagination = () =>
  hasActiveSearch() || hasActiveButtonFilters.value || hasActiveColumnFilters.value

const loadDefaultGatewayTotal = async () => {
  if (totalDefaultGateway.value !== undefined) return

  const response = await loadClientFilteredPage<IpAddress>(
    (params) =>
      ipsApi.getAll({
        ...params,
        default_gw: true,
      }),
    {
      limit: 1,
      offset: 0,
    },
    (ip) => ip.use_default_gw === true,
  )

  totalDefaultGateway.value = response.total
}

const getKnownIpFilterTotal = (): number | undefined => {
  if (hasActiveSearch() || hasActiveColumnFilters.value) return undefined

  if (
    gatewayFilter.value !== 'all' &&
    typeFilter.value === 'all' &&
    listFilter.value === 'all' &&
    domainFilter.value === 'all' &&
    totalDefaultGateway.value !== undefined
  ) {
    return gatewayFilter.value === 'default-gateway'
      ? totalDefaultGateway.value
      : totalIps.value - totalDefaultGateway.value
  }

  if (
    domainFilter.value !== 'all' &&
    typeFilter.value === 'all' &&
    listFilter.value === 'all' &&
    gatewayFilter.value === 'all'
  ) {
    return domainFilter.value === 'with-domain' ? totalWithDomain.value : totalIps.value - totalWithDomain.value
  }

  if (listFilter.value !== 'all' && domainFilter.value === 'all' && gatewayFilter.value === 'all') {
    if (typeFilter.value === 'ipv4') {
      return listFilter.value === 'with-list' ? totalWithListIpv4.value : totalIpv4.value - totalWithListIpv4.value
    }

    if (typeFilter.value === 'ipv6') {
      return listFilter.value === 'with-list' ? totalWithListIpv6.value : totalIpv6.value - totalWithListIpv6.value
    }

    return listFilter.value === 'with-list' ? totalWithList.value : totalIps.value - totalWithList.value
  }

  if (
    typeFilter.value !== 'all' &&
    listFilter.value === 'all' &&
    domainFilter.value === 'all' &&
    gatewayFilter.value === 'all'
  ) {
    return typeFilter.value === 'ipv4' ? totalIpv4.value : totalIpv6.value
  }

  return undefined
}

/**
 * Load IPs with stats
 */
const loadIpsWithStats = async () => {
  isLoading.value = true
  try {
    if (hasActiveButtonFilters.value && totalIps.value === 0) {
      await loadGlobalStats()
    }

    if (
      gatewayFilter.value !== 'all' &&
      typeFilter.value === 'all' &&
      listFilter.value === 'all' &&
      domainFilter.value === 'all'
    ) {
      await loadDefaultGatewayTotal()
    }

    const knownFilterTotal = getKnownIpFilterTotal()
    const response = await loadClientFilteredPage(
      (params) =>
        ipsApi.getAll({
          ...params,
          type: getTypeFilterParam(),
          default_gw: getGatewayFilterParam(),
        }),
      {
        limit: pageSize.value,
        offset: offset.value,
      },
      matchesActiveIpFilters,
      {
        forceClientPagination: shouldUseClientPagination(),
        knownTotal: knownFilterTotal,
        stopWhenPageFilled: knownFilterTotal !== undefined,
      },
    )

    totalItems.value = response.total
    ips.value = response.payload
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'loadIpsWithStats',
      component: 'IpsPage',
    })
    ips.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

/**
 * Search IPs immediately with current pagination and filters.
 */
const runSearchIps = async () => {
  const apiSearchQuery = getApiSearchQuery()

  if (!apiSearchQuery) {
    await loadIpsWithStats()
    return
  }

  isLoading.value = true
  try {
    const response = await loadClientFilteredPage(
      (params) =>
        ipsApi.search(apiSearchQuery, {
          ...params,
          type: getTypeFilterParam(),
          default_gw: getGatewayFilterParam(),
        }),
      {
        limit: pageSize.value,
        offset: offset.value,
      },
      matchesActiveIpFilters,
    )

    totalItems.value = response.total
    ips.value = response.payload

    if (hasActiveSearch()) {
      if (response.total === 0) {
        showInfo(
          `${IPS_TEXTS.SEARCH_NOT_FOUND_PREFIX} "${searchQuery.value}" ${UI_TEXTS.NOTHING_FOUND}`,
          UI_TEXTS.SEARCH_RESULTS,
        )
      } else {
        showInfo(`${IPS_TEXTS.SEARCH_FOUND_PREFIX} ${response.total}`, UI_TEXTS.SEARCH_RESULTS)
      }
    }
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'searchIps',
      component: 'IpsPage',
      query: searchQuery.value,
    })
    ips.value = []
    totalItems.value = 0
  } finally {
    isLoading.value = false
  }
}

/**
 * Load IPs through the active data source.
 */
const loadActiveIps = () => {
  if (getApiSearchQuery()) return runSearchIps()
  return loadIpsWithStats()
}

/**
 * Search IPs
 */
const { run: runSearchIpsDebounced, cancel: cancelSearchIpsDebounce } = useDebouncedTask(async () => {
  currentPage.value = 1 // Reset to first page
  await loadActiveIps()
})

const { run: runColumnFiltersDebounced, cancel: cancelColumnFiltersDebounce } = useDebouncedTask(async () => {
  await loadActiveIps()
})

const cancelPendingInputLoads = () => {
  cancelSearchIpsDebounce()
  cancelColumnFiltersDebounce()
}

const searchIps = () => {
  runSearchIpsDebounced()
}

/**
 * Load global statistics from the dedicated statistics API endpoint
 */
const loadGlobalStats = async () => {
  try {
    const stats = await statsApi.getStats()
    totalIps.value = stats.ips.total
    totalIpv4.value = stats.ips.v4_total
    totalIpv6.value = stats.ips.v6_total
    totalWithList.value = stats.ips.per_list.reduce((sum, l) => sum + l.total, 0)
    totalWithListIpv4.value = stats.ips.per_list.reduce((sum, l) => sum + l.v4_count, 0)
    totalWithListIpv6.value = stats.ips.per_list.reduce((sum, l) => sum + l.v6_count, 0)
    totalWithDomain.value = stats.ips.linked_to_domain
  } catch (error) {
    errorHandler.handleError(error, { action: 'loadGlobalStats', component: 'IpsPage' })
  }
}

/**
 * Filter by type
 */
const filterByType = (value: IpTypeFilter) => {
  cancelPendingInputLoads()
  typeFilter.value = value
  currentPage.value = 1 // Reset to first page
  loadActiveIps()
}

/**
 * Filter by list
 */
const filterByList = (value: IpListFilter) => {
  cancelPendingInputLoads()
  listFilter.value = value
  currentPage.value = 1 // Reset to first page
  loadActiveIps()
}

/**
 * Filter by domain
 */
const filterByDomain = (value: IpDomainFilter) => {
  cancelPendingInputLoads()
  domainFilter.value = value
  currentPage.value = 1 // Reset to first page
  loadActiveIps()
}

/**
 * Filter by gateway usage
 */
const filterByGateway = (value: Exclude<IpGatewayFilter, 'all'>) => {
  cancelPendingInputLoads()
  gatewayFilter.value = value
  currentPage.value = 1 // Reset to first page
  loadActiveIps()
}

/**
 * Reset button filters to default values
 */
const resetButtonFilters = () => {
  cancelPendingInputLoads()
  typeFilter.value = 'all'
  listFilter.value = 'all'
  domainFilter.value = 'all'
  gatewayFilter.value = 'all'
  currentPage.value = 1
  loadActiveIps()
}

/**
 * Validate form data
 */
const validateForm = (): boolean => {
  formErrors.value = {}

  if (!formData.value.addr || formData.value.addr.trim() === '') {
    formErrors.value.addr = IPS_TEXTS.VALIDATION_ADDR_REQUIRED
    showWarning(IPS_TEXTS.VALIDATION_ADDR_REQUIRED, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  // Basic IPv4/IPv6 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

  if (!ipv4Regex.test(formData.value.addr) && !ipv6Regex.test(formData.value.addr)) {
    formErrors.value.addr = IPS_TEXTS.VALIDATION_ADDR_INVALID
    showWarning(IPS_TEXTS.VALIDATION_ADDR_INVALID, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  return true
}

/**
 * Open view modal
 */
const openViewModal = (ip: IpAddress) => {
  selectedIp.value = ip
  isViewModalOpen.value = true
}

/**
 * Open add modal
 */
const openAddModal = () => {
  formData.value = { addr: '', list_id: undefined, domain_id: undefined, ros_comment: undefined, use_default_gw: false }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Close add modal and reset form
 */
const closeAddModal = () => {
  formData.value = { addr: '', list_id: undefined, domain_id: undefined, ros_comment: undefined, use_default_gw: false }
  formErrors.value = {}
  isAddModalOpen.value = false
}

/**
 * Create new IP address
 */
const createIp = async () => {
  if (!validateForm()) return

  cancelPendingInputLoads()
  isLoading.value = true
  try {
    await ipsApi.create([formData.value])
    closeAddModal()
    showSuccess(`${IPS_TEXTS.IP_PREFIX} "${formData.value.addr}" ${IPS_TEXTS.SUCCESS_CREATED}`)
    await delay()
    await loadActiveIps()
    await loadGlobalStats()
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'createIp',
      component: 'IpsPage',
      addr: formData.value.addr,
    })
  } finally {
    isLoading.value = false
  }
}

/**
 * Open delete confirmation dialog
 */
const openDeleteConfirm = (id: number) => {
  ipToDelete.value = id
  isDeleteConfirmOpen.value = true
}

/**
 * Delete IP address
 */
const deleteIp = async () => {
  if (!ipToDelete.value) return

  cancelPendingInputLoads()
  const ipId = ipToDelete.value
  isLoading.value = true
  try {
    await ipsApi.deleteOne(ipId)
    isDeleteConfirmOpen.value = false
    ipToDelete.value = null
    showSuccess(`${IPS_TEXTS.IP_PREFIX} #${ipId} ${IPS_TEXTS.SUCCESS_DELETED}`)

    // Reload data after deletion
    await delay()
    await loadActiveIps()
    await loadGlobalStats()

    // Check if we need to go to previous page (if current page is now empty)
    if (ips.value.length === 0 && currentPage.value > 1) {
      goToPage(currentPage.value - 1)
    }
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'deleteIp',
      component: 'IpsPage',
      ipId,
    })
    isDeleteConfirmOpen.value = false
    ipToDelete.value = null
  } finally {
    isLoading.value = false
  }
}

/**
 * Go to specific page
 */
const goToPage = (page: number) => {
  cancelPendingInputLoads()
  currentPage.value = page
  loadActiveIps()
}

/**
 * Change page size
 */
const changePageSize = (size: number) => {
  cancelPendingInputLoads()
  pageSize.value = size
  currentPage.value = 1
  loadActiveIps()
}

const updateColumnFilters = (filters: TableColumnFilters) => {
  columnFilters.value = filters
  currentPage.value = 1
  runColumnFiltersDebounced()
}

onMounted(() => {
  loadGlobalStats()
  loadIpsWithStats()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ IPS_TEXTS.PAGE_TITLE }}</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        {{ IPS_TEXTS.PAGE_DESCRIPTION }}
      </p>
    </div>

    <!-- Stats -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Всего IP</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{{ totalIps }}</div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_TEXTS.STATS_TOTAL_HINT }}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">IPv4</div>
        <div class="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{{ totalIpv4 }}</div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_TEXTS.STATS_IPV4_HINT }}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">IPv6</div>
        <div class="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">{{ totalIpv6 }}</div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_TEXTS.STATS_IPV6_HINT }}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Со списком</div>
        <div class="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{{ totalWithList }}</div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_TEXTS.STATS_WITH_LIST_HINT }}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">С доменом</div>
        <div class="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">{{ totalWithDomain }}</div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_TEXTS.STATS_WITH_DOMAIN_HINT }}</p>
      </div>
    </div>

    <!-- Actions Bar -->
    <div class="mb-6 flex flex-col justify-between gap-4 lg:flex-row">
      <!-- Search and Filters -->
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
        <!-- Search -->
        <div class="relative max-w-md flex-1">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            @input="searchIps"
            type="search"
            :placeholder="IPS_TEXTS.SEARCH_PLACEHOLDER"
            class="block w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-10 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-2">
          <!-- Type Filter -->
          <div class="flex gap-1">
            <BaseButton @click="filterByType('all')" :variant="typeFilter === 'all' ? 'primary' : 'ghost'" size="sm">
              {{ IPS_TEXTS.FILTER_ALL }}
            </BaseButton>
            <BaseButton @click="filterByType('ipv4')" :variant="typeFilter === 'ipv4' ? 'primary' : 'ghost'" size="sm">
              {{ IPS_TEXTS.FILTER_IPV4 }}
            </BaseButton>
            <BaseButton @click="filterByType('ipv6')" :variant="typeFilter === 'ipv6' ? 'primary' : 'ghost'" size="sm">
              {{ IPS_TEXTS.FILTER_IPV6 }}
            </BaseButton>
          </div>

          <!-- List Filter -->
          <div class="flex gap-1">
            <BaseButton
              @click="filterByList('with-list')"
              :variant="listFilter === 'with-list' ? 'primary' : 'ghost'"
              size="sm"
            >
              {{ IPS_TEXTS.FILTER_WITH_LIST }}
            </BaseButton>
            <BaseButton
              @click="filterByList('without-list')"
              :variant="listFilter === 'without-list' ? 'primary' : 'ghost'"
              size="sm"
            >
              {{ IPS_TEXTS.FILTER_WITHOUT_LIST }}
            </BaseButton>
          </div>

          <!-- Domain Filter -->
          <div class="flex gap-1">
            <BaseButton
              @click="filterByDomain('with-domain')"
              :variant="domainFilter === 'with-domain' ? 'primary' : 'ghost'"
              size="sm"
            >
              {{ IPS_TEXTS.FILTER_WITH_DOMAIN }}
            </BaseButton>
            <BaseButton
              @click="filterByDomain('without-domain')"
              :variant="domainFilter === 'without-domain' ? 'primary' : 'ghost'"
              size="sm"
            >
              {{ IPS_TEXTS.FILTER_WITHOUT_DOMAIN }}
            </BaseButton>
          </div>

          <!-- Gateway Filter -->
          <div class="flex gap-1">
            <BaseButton
              @click="filterByGateway('default-gateway')"
              :variant="gatewayFilter === 'default-gateway' ? 'primary' : 'ghost'"
              size="sm"
            >
              {{ IPS_TEXTS.FILTER_DEFAULT_GATEWAY }}
            </BaseButton>
            <BaseButton
              @click="filterByGateway('vpn-gateway')"
              :variant="gatewayFilter === 'vpn-gateway' ? 'primary' : 'ghost'"
              size="sm"
            >
              {{ IPS_TEXTS.FILTER_VPN_GATEWAY }}
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
      </div>

      <!-- Add Button -->
      <BaseButton @click="openAddModal" variant="primary">
        <PlusIcon class="mr-2 h-5 w-5" />
        {{ IPS_TEXTS.ADD_BUTTON }}
      </BaseButton>
    </div>

    <!-- Table -->
    <DataTable
      :data="ips"
      :columns="TABLE_COLUMNS"
      :is-loading="isLoading"
      :column-filters="columnFilters"
      :empty-message="IPS_TEXTS.EMPTY_MESSAGE"
      @update:column-filters="updateColumnFilters"
      @row-click="openViewModal"
    >
      <template #cell-type="{ value }">
        <span
          class="inline-flex items-center rounded-md px-2 py-1 font-mono text-xs font-medium"
          :class="{
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400': value === 4,
            'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400': value === 6,
          }"
        >
          {{ value === 4 ? 'IPv4' : 'IPv6' }}
        </span>
      </template>

      <template #cell-addr="{ value }">
        <span class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ value }}</span>
      </template>

      <template #cell-ip_list_name="{ value, row }">
        <div v-if="value" class="text-sm">
          <span class="text-gray-900 dark:text-gray-100">{{ value }}</span>
          <span class="ml-1 text-xs text-gray-500 dark:text-gray-400">(ID: {{ row.ip_list_id }})</span>
        </div>
        <span v-else class="text-sm text-gray-400 dark:text-gray-500">-</span>
      </template>

      <template #cell-domain_name="{ value, row }">
        <div v-if="value" class="text-sm">
          <span class="text-gray-900 dark:text-gray-100">{{ value }}</span>
          <span class="ml-1 text-xs text-gray-500 dark:text-gray-400">(ID: {{ row.domain_id }})</span>
        </div>
        <span v-else class="text-sm text-gray-400 dark:text-gray-500">-</span>
      </template>

      <template #cell-ros_comment="{ value }">
        <span class="text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-use_default_gw="{ value }">
        <span
          class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
          :class="
            value
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          "
        >
          {{ value ? 'Да' : 'Нет' }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <BaseButton variant="danger" size="sm" @click.stop="openDeleteConfirm(row.id)">
          <TrashIcon class="h-4 w-4" />
        </BaseButton>
      </template>
    </DataTable>

    <!-- Pagination -->
    <PaginationControl
      v-if="ips.length > 0"
      :current-page="pagination.currentPage.value"
      :total-pages="pagination.totalPages.value"
      :total-items="pagination.totalItems.value"
      :page-size="pagination.pageSize.value"
      :page-size-options="pagination.PAGE_SIZE_OPTIONS"
      @update:current-page="goToPage"
      @update:page-size="changePageSize"
    />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" :title="IPS_TEXTS.MODAL_TITLE" @close="closeAddModal">
      <form @submit.prevent="createIp" class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ IPS_TEXTS.LABEL_ADDR }} <span class="text-red-500">*</span>
          </label>
          <BaseInput
            v-model="formData.addr"
            type="text"
            :placeholder="IPS_TEXTS.PLACEHOLDER_ADDR"
            :error="formErrors.addr"
            required
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ IPS_TEXTS.HINT_ADDR }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ IPS_TEXTS.LABEL_LIST_ID }}
          </label>
          <BaseInput
            :model-value="formData.list_id ?? ''"
            @update:model-value="(val) => (formData.list_id = val === '' ? undefined : Number(val))"
            type="number"
            :placeholder="IPS_TEXTS.PLACEHOLDER_LIST_ID"
            min="1"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ IPS_TEXTS.HINT_LIST_ID }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ IPS_TEXTS.LABEL_DOMAIN_ID }}
          </label>
          <BaseInput
            :model-value="formData.domain_id ?? ''"
            @update:model-value="(val) => (formData.domain_id = val === '' ? undefined : Number(val))"
            type="number"
            :placeholder="IPS_TEXTS.PLACEHOLDER_DOMAIN_ID"
            min="0"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ IPS_TEXTS.HINT_DOMAIN_ID }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ IPS_TEXTS.LABEL_ROS_COMMENT }}
          </label>
          <BaseTextarea v-model="formData.ros_comment!" :placeholder="IPS_TEXTS.PLACEHOLDER_ROS_COMMENT" :rows="2" />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ IPS_TEXTS.HINT_ROS_COMMENT }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ IPS_TEXTS.LABEL_USE_DEFAULT_GATEWAY }}
          </label>
          <label class="mt-3 mb-4 flex cursor-pointer items-center gap-2">
            <input
              v-model="formData.use_default_gw"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">Использовать дефолтный gateway вместо VPN</span>
          </label>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ IPS_TEXTS.HINT_USE_DEFAULT_GATEWAY }}
          </p>
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <BaseButton variant="ghost" type="button" @click="closeAddModal">{{ UI_TEXTS.CANCEL }}</BaseButton>
          <BaseButton variant="primary" type="submit" :is-loading="isLoading">{{ UI_TEXTS.CREATE }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- View Modal -->
    <BaseModal
      :is-open="isViewModalOpen"
      :title="`${IPS_TEXTS.IP_PREFIX}: ${selectedIp?.addr || ''}`"
      @close="isViewModalOpen = false"
    >
      <div v-if="selectedIp" class="space-y-4">
        <!-- IP Info (Read-only) -->
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">ID</label>
            <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedIp.id }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_TEXTS.COLUMN_TYPE }}
            </label>
            <span
              class="inline-flex items-center rounded-md px-2 py-1 font-mono text-sm font-medium"
              :class="{
                'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400': selectedIp.type === 4,
                'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400': selectedIp.type === 6,
              }"
            >
              {{ selectedIp.type === 4 ? 'IPv4' : 'IPv6' }} (type: {{ selectedIp.type }})
            </span>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_TEXTS.LABEL_ADDR }}
            </label>
            <p class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedIp.addr }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_TEXTS.COLUMN_IP_LIST }}
            </label>
            <div v-if="selectedIp.ip_list_name">
              <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedIp.ip_list_name }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">ID: {{ selectedIp.ip_list_id }}</p>
            </div>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Не привязан</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_TEXTS.COLUMN_DOMAIN }}
            </label>
            <div v-if="selectedIp.domain_name">
              <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedIp.domain_name }}</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">ID: {{ selectedIp.domain_id }}</p>
            </div>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Не привязан</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_TEXTS.COLUMN_ROS_COMMENT }}
            </label>
            <p v-if="selectedIp.ros_comment" class="text-sm text-gray-900 dark:text-gray-100">
              {{ selectedIp.ros_comment }}
            </p>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Не указан</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_TEXTS.COLUMN_USE_DEFAULT_GATEWAY }}
            </label>
            <p class="text-sm text-gray-900 dark:text-gray-100">
              {{ selectedIp.use_default_gw ? 'Да' : 'Нет' }}
            </p>
          </div>

          <div class="border-t pt-3 dark:border-gray-700">
            <label class="mb-2 block text-xs font-semibold text-gray-700 uppercase dark:text-gray-300">
              Временные метки
            </label>

            <div class="space-y-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Создано</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedIp.created_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">Timestamp: {{ selectedIp.created_at }}</p>
              </div>

              <div v-if="selectedIp.updated_at_hum">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Обновлено</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedIp.updated_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">Timestamp: {{ selectedIp.updated_at }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Close Button -->
        <div class="flex justify-end border-t pt-4 dark:border-gray-700">
          <BaseButton variant="primary" @click="isViewModalOpen = false">{{ UI_TEXTS.CANCEL }}</BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      :is-open="isDeleteConfirmOpen"
      :title="IPS_TEXTS.DELETE_TITLE"
      :message="IPS_TEXTS.DELETE_MESSAGE"
      :confirm-text="UI_TEXTS.DELETE"
      :cancel-text="UI_TEXTS.CANCEL"
      variant="danger"
      :is-loading="isLoading"
      @confirm="deleteIp"
      @cancel="isDeleteConfirmOpen = false"
    />
  </div>
</template>

<style scoped></style>
