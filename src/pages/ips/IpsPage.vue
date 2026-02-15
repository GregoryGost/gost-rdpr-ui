<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ipsApi } from '@/api/endpoints/ips'
import type { IpAddress, IpAddressCreateData } from '@/api/types/ips'
import { PAGINATION, IPS_TEXTS, UI_TEXTS, SEARCH, ERROR_MESSAGES } from '@/constants'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import BaseInput from '@/ui/forms/BaseInput.vue'
import BaseTextarea from '@/ui/forms/BaseTextarea.vue'
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { showSuccess, showWarning, showInfo } from '@/utils/notifications'
import { errorHandler } from '@/utils/errorHandler'

/**
 * IPs management page
 * @component IpsPage
 */
const searchQuery = ref('')
const typeFilter = ref<'all' | 'ipv4' | 'ipv6'>('all')
const listFilter = ref<'all' | 'with-list' | 'without-list'>('all')
const domainFilter = ref<'all' | 'with-domain' | 'without-domain'>('all')

// Data management
const ips = ref<IpAddress[]>([])
const allIps = ref<IpAddress[]>([]) // All loaded IPs before filters
const isLoading = ref(false)
const totalIpv4 = ref(0)
const totalIpv6 = ref(0)
const totalWithList = ref(0)
const totalWithDomain = ref(0)

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
  ros_comment: '',
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS = [
  { key: 'id', label: UI_TEXTS.ID },
  { key: 'type', label: IPS_TEXTS.COLUMN_TYPE },
  { key: 'addr', label: IPS_TEXTS.COLUMN_ADDR },
  { key: 'ip_list_name', label: IPS_TEXTS.COLUMN_IP_LIST },
  { key: 'domain_name', label: IPS_TEXTS.COLUMN_DOMAIN },
  { key: 'ros_comment', label: IPS_TEXTS.COLUMN_ROS_COMMENT },
  { key: 'created_at_hum', label: UI_TEXTS.CREATED },
  { key: 'actions', label: UI_TEXTS.ACTIONS },
]

/**
 * Apply filters to IPs
 */
const applyFilters = (ipsToFilter: IpAddress[]): IpAddress[] => {
  let filtered = [...ipsToFilter]

  // Type filter
  if (typeFilter.value === 'ipv4') {
    filtered = filtered.filter((ip) => ip.type === 4)
  } else if (typeFilter.value === 'ipv6') {
    filtered = filtered.filter((ip) => ip.type === 6)
  }

  // List filter
  if (listFilter.value === 'with-list') {
    filtered = filtered.filter((ip) => ip.ip_list_id != null)
  } else if (listFilter.value === 'without-list') {
    filtered = filtered.filter((ip) => ip.ip_list_id == null)
  }

  // Domain filter
  if (domainFilter.value === 'with-domain') {
    filtered = filtered.filter((ip) => ip.domain_id != null)
  } else if (domainFilter.value === 'without-domain') {
    filtered = filtered.filter((ip) => ip.domain_id == null)
  }

  return filtered
}

/**
 * Load IPs with stats
 */
const loadIpsWithStats = async () => {
  isLoading.value = true
  try {
    const response = await ipsApi.getAll({
      limit: pageSize.value,
      offset: offset.value,
    })

    allIps.value = response.payload

    // Calculate statistics
    totalItems.value = response.total
    totalIpv4.value = response.payload.filter((ip) => ip.type === 4).length
    totalIpv6.value = response.payload.filter((ip) => ip.type === 6).length
    totalWithList.value = response.payload.filter((ip) => ip.ip_list_id != null).length
    totalWithDomain.value = response.payload.filter((ip) => ip.domain_id != null).length

    // Apply filters
    ips.value = applyFilters(allIps.value)
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'loadIpsWithStats',
      component: 'IpsPage',
    })
  } finally {
    isLoading.value = false
  }
}

/**
 * Search IPs with debounce
 */
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const searchIps = async () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(async () => {
    currentPage.value = 1 // Reset to first page

    if (!searchQuery.value || searchQuery.value.length < SEARCH.MIN_LENGTH) {
      loadIpsWithStats()
      return
    }

    isLoading.value = true
    try {
      const response = await ipsApi.search(searchQuery.value, {
        limit: pageSize.value,
        offset: offset.value,
      })

      allIps.value = response.payload

      // Calculate statistics
      totalItems.value = response.total
      totalIpv4.value = response.payload.filter((ip) => ip.type === 4).length
      totalIpv6.value = response.payload.filter((ip) => ip.type === 6).length
      totalWithList.value = response.payload.filter((ip) => ip.ip_list_id != null).length
      totalWithDomain.value = response.payload.filter((ip) => ip.domain_id != null).length

      // Apply filters
      ips.value = applyFilters(allIps.value)

      // Show search results notification
      if (ips.value.length === 0) {
        showInfo(
          `${IPS_TEXTS.SEARCH_NOT_FOUND_PREFIX} "${searchQuery.value}" ${UI_TEXTS.NOTHING_FOUND}`,
          UI_TEXTS.SEARCH_RESULTS,
        )
      } else {
        showInfo(`${IPS_TEXTS.SEARCH_FOUND_PREFIX} ${ips.value.length}`, UI_TEXTS.SEARCH_RESULTS)
      }
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'searchIps',
        component: 'IpsPage',
        query: searchQuery.value,
      })
    } finally {
      isLoading.value = false
    }
  }, 300) // Debounce 300ms
}

/**
 * Filter by type
 */
const filterByType = (value: 'all' | 'ipv4' | 'ipv6') => {
  typeFilter.value = value
  ips.value = applyFilters(allIps.value)
}

/**
 * Filter by list
 */
const filterByList = (value: 'all' | 'with-list' | 'without-list') => {
  listFilter.value = value
  ips.value = applyFilters(allIps.value)
}

/**
 * Filter by domain
 */
const filterByDomain = (value: 'all' | 'with-domain' | 'without-domain') => {
  domainFilter.value = value
  ips.value = applyFilters(allIps.value)
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
  formData.value = { addr: '', list_id: undefined, domain_id: undefined, ros_comment: '' }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Close add modal and reset form
 */
const closeAddModal = () => {
  formData.value = { addr: '', list_id: undefined, domain_id: undefined, ros_comment: '' }
  formErrors.value = {}
  isAddModalOpen.value = false
}

/**
 * Create new IP address
 */
const createIp = async () => {
  if (!validateForm()) return

  isLoading.value = true
  try {
    await ipsApi.create([formData.value])
    closeAddModal()
    showSuccess(`${IPS_TEXTS.IP_PREFIX} "${formData.value.addr}" ${IPS_TEXTS.SUCCESS_CREATED}`)
    await loadIpsWithStats()
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

  const ipId = ipToDelete.value
  isLoading.value = true
  try {
    await ipsApi.deleteOne(ipId)
    isDeleteConfirmOpen.value = false
    ipToDelete.value = null
    showSuccess(`${IPS_TEXTS.IP_PREFIX} #${ipId} ${IPS_TEXTS.SUCCESS_DELETED}`)

    // Reload data after deletion
    await loadIpsWithStats()

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
  currentPage.value = page
  loadIpsWithStats()
}

/**
 * Change page size
 */
const changePageSize = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  loadIpsWithStats()
}

onMounted(() => {
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
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{{ totalItems }}</div>
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
      :empty-message="IPS_TEXTS.EMPTY_MESSAGE"
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
