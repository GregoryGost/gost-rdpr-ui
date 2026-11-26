<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { dnsApi } from '@/api/endpoints/dns'
import type { DnsServer, DnsServerCreateData } from '@/api/types/dns'
import { useDebouncedTask, usePaginatedData } from '@/composables'
import { SEARCH } from '@/constants'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import BaseInput from '@/ui/forms/BaseInput.vue'
import BaseTextarea from '@/ui/forms/BaseTextarea.vue'
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { showSuccess, showWarning, showInfo } from '@/utils/notifications'
import { delay } from '@/utils/timers'
import { errorHandler } from '@/utils/errorHandler'
import { loadClientFilteredPage } from '@/utils/clientPagination'
import {
  hasColumnFilters,
  matchesColumnFilters,
  type TableColumn,
  type TableColumnFilters,
} from '@/ui/tables/columnFilters'

/**
 * DNS Servers management page
 * @component DnsServersPage
 */
/** waitingForRefresh identifies the refresh after a successful mutation, including the wait before it begins. */
const waitingForRefresh = ref(false)
const searchQuery = ref('')
const columnFilters = ref<TableColumnFilters>({})
const hasActiveColumnFilters = computed(() => hasColumnFilters(columnFilters.value))

/** servers holds accepted rows; isLoading tracks the current load;
 * hasError records a failed table request; pagination owns page counters.
 * The loader callback uses params as the requested page and returns its backend response.
 * requests coordinates normal, search and filtered loads; loadServers loads the current normal page. */
const {
  data: servers,
  isLoading,
  hasError,
  pagination,
  requests,
  load: loadServers,
} = usePaginatedData<DnsServer>(async (params) => dnsApi.getAll(params), 20)

// Modals
const isAddModalOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const serverToDelete = ref<number | null>(null)

// Form data
const formData = ref<DnsServerCreateData>({
  server: undefined,
  doh_server: undefined,
  description: undefined,
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS: TableColumn<DnsServer>[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'server', label: 'DNS-сервер', sortable: true },
  { key: 'doh_server', label: 'DoH-сервер', sortable: true },
  { key: 'description', label: 'Описание', sortable: true },
  { key: 'created_at_hum', label: 'Создано', sortable: true },
  { key: 'actions', label: 'Действия' },
]

const hasActiveSearch = () => Boolean(searchQuery.value && searchQuery.value.length >= SEARCH.MIN_LENGTH)

/** Captures column values and returns a predicate for one consistent filtered dataset. */
const createDnsColumnFilter = () => {
  // filters keeps subsequent backend batches independent of new input edits.
  const filters = { ...columnFilters.value }
  return (row: DnsServer) => matchesColumnFilters(row, TABLE_COLUMNS, filters)
}

/** Reports the accepted result total for the query captured by its request. */
const showSearchResults = (total: number, query: string) => {
  if (total === 0) {
    showInfo(`По запросу "${query}" ничего не найдено`, 'Результаты поиска')
    return
  }

  showInfo(`Найдено серверов: ${total}`, 'Результаты поиска')
}

/** Loads the captured search and filters; obsolete outcomes cannot publish or notify. */
const loadSearchResults = async (shouldNotify = false) => {
  // isCurrent checks ownership; query is the entered search; filterItem freezes column matching.
  const isCurrent = requests.begin()
  const query = searchQuery.value
  const filterItem = createDnsColumnFilter()
  if (!isCurrent()) return
  hasError.value = false
  isLoading.value = true
  try {
    // response holds the filtered rows and matching total; the fetch callback reuses the captured query.
    const response = await loadClientFilteredPage(
      (params) => dnsApi.search(query, params),
      {
        limit: pagination.pageSize.value,
        offset: pagination.offset.value,
      },
      filterItem,
    )

    if (!isCurrent()) return
    servers.value = response.payload
    pagination.totalItems.value = response.total

    if (shouldNotify) showSearchResults(response.total, query)
  } catch (error) {
    // error belongs to this search and is reported only if its intent remains current.
    if (!isCurrent()) return
    hasError.value = true
    errorHandler.handleError(error, {
      action: 'searchServers',
      component: 'DnsServersPage',
      query,
    })
    servers.value = []
    pagination.totalItems.value = 0
  } finally {
    if (isCurrent()) isLoading.value = false
  }
}

/** Selects the search, column-filtered or normal source for the current intent. */
const loadActiveServers = async (shouldNotifySearch = false) => {
  if (hasActiveSearch()) {
    await loadSearchResults(shouldNotifySearch)
  } else if (hasActiveColumnFilters.value) {
    await loadFilteredServers()
  } else {
    await loadServers()
  }
}

/** Loads a snapshot of column-filtered rows without allowing earlier loads to replace them. */
const loadFilteredServers = async () => {
  // isCurrent checks publication ownership; filterItem retains this request's column values.
  const isCurrent = requests.begin()
  const filterItem = createDnsColumnFilter()
  if (!isCurrent()) return
  hasError.value = false
  isLoading.value = true
  try {
    // response contains this filtered page and total; its fetch callback forwards each backend page unchanged.
    const response = await loadClientFilteredPage(
      (params) => dnsApi.getAll(params),
      {
        limit: pagination.pageSize.value,
        offset: pagination.offset.value,
      },
      filterItem,
    )

    if (!isCurrent()) return
    servers.value = response.payload
    pagination.totalItems.value = response.total
  } catch (error) {
    // error is relevant only while this filtered load remains current.
    if (!isCurrent()) return
    hasError.value = true
    errorHandler.handleError(error, {
      action: 'loadFilteredServers',
      component: 'DnsServersPage',
    })
    servers.value = []
    pagination.totalItems.value = 0
  } finally {
    if (isCurrent()) isLoading.value = false
  }
}

/** runSearchServersDebounced schedules the search callback; cancelSearchServersDebounce clears its queued run.
 * The callback resets pagination and loads the latest active input after the debounce delay. */
const { run: runSearchServersDebounced, cancel: cancelSearchServersDebounce } = useDebouncedTask(async () => {
  pagination.currentPage.value = 1 // Reset to first page

  if (!hasActiveSearch()) {
    await loadActiveServers()
    return
  }

  await loadSearchResults(true)
})

/** runColumnFiltersDebounced schedules a reload using current filters; cancelColumnFiltersDebounce clears it.
 * The callback loads through the active search or normal source. */
const { run: runColumnFiltersDebounced, cancel: cancelColumnFiltersDebounce } = useDebouncedTask(async () => {
  await loadActiveServers()
})

/** Cancels queued input loads and immediately invalidates all earlier request continuations. */
const cancelPendingInputLoads = () => {
  waitingForRefresh.value = false
  requests.invalidate()
  cancelSearchServersDebounce()
  cancelColumnFiltersDebounce()
}

/** Selects page and loads it through the active search or filter source. */
const goToActivePage = async (page: number) => {
  cancelPendingInputLoads()
  pagination.goToPage(page)
  await loadActiveServers()
}

/** Selects a new page size and reloads the first page through the active source. */
const changeActivePageSize = async (size: number) => {
  cancelPendingInputLoads()
  pagination.changePageSize(size)
  await loadActiveServers()
}

/** Invalidates earlier results at input time, before scheduling the existing search debounce. */
const searchServers = () => {
  cancelPendingInputLoads()
  runSearchServersDebounced()
}

/** Replaces column filters, invalidating pending results before the debounced reload. */
const updateColumnFilters = (filters: TableColumnFilters) => {
  cancelPendingInputLoads()
  columnFilters.value = filters
  pagination.currentPage.value = 1
  runColumnFiltersDebounced()
}

/**
 * Validate form data
 */
const validateForm = (): boolean => {
  formErrors.value = {}

  if (!formData.value.server && !formData.value.doh_server) {
    formErrors.value.server = 'Укажите DNS сервер или DoH сервер'
    showWarning('Укажите DNS сервер или DoH сервер', 'Ошибка валидации')
    return false
  }

  // Validate IP format if server is provided
  if (formData.value.server) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6Regex =
      /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/

    if (!ipv4Regex.test(formData.value.server) && !ipv6Regex.test(formData.value.server)) {
      formErrors.value.server = 'Некорректный формат IP адреса'
      showWarning('Некорректный формат IP адреса', 'Ошибка валидации')
      return false
    }
  }

  // Validate DoH URL format if provided
  if (formData.value.doh_server) {
    try {
      new URL(formData.value.doh_server)
    } catch {
      formErrors.value.doh_server = 'Некорректный формат URL'
      showWarning('Некорректный формат DoH URL', 'Ошибка валидации')
      return false
    }
  }

  return true
}

/**
 * Open add modal
 */
const openAddModal = () => {
  formData.value = { server: undefined, doh_server: undefined, description: undefined }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Close add modal and reset form
 */
const closeAddModal = () => {
  formData.value = { server: undefined, doh_server: undefined, description: undefined }
  formErrors.value = {}
  isAddModalOpen.value = false
}

/**
 * Create new DNS server
 */
const createServer = async () => {
  if (!validateForm()) return

  // serverName retains the submitted entity name for success and error messages after form reset.
  const serverName = formData.value.server || formData.value.doh_server
  cancelPendingInputLoads()
  // isCurrent controls table loading and empty-page fallback; accepted mutation outcomes depend only on scope lifetime.
  let isCurrent = requests.begin()
  if (!isCurrent()) return
  isLoading.value = true
  try {
    await dnsApi.create([formData.value])
    if (!requests.isActive()) return
    closeAddModal()
    showSuccess(`DNS сервер "${serverName}" успешно добавлен`)
    if (isCurrent()) waitingForRefresh.value = true
    await delay()
    if (!requests.isActive()) return
    // pendingLoad starts the current table reload; its generation now owns completion and page fallback.
    const pendingLoad = loadActiveServers()
    isCurrent = requests.capture()
    await pendingLoad
    if (!requests.isActive()) return
  } catch (error) {
    // error reports this submitted mutation even if table input changed; teardown still suppresses publication.
    if (!requests.isActive()) return
    errorHandler.handleError(error, {
      action: 'createServer',
      component: 'DnsServersPage',
      server: serverName,
    })
  } finally {
    if (isCurrent()) {
      waitingForRefresh.value = false
      isLoading.value = false
    }
  }
}

/**
 * Open delete confirmation dialog
 */
const openDeleteConfirm = (id: number) => {
  serverToDelete.value = id
  isDeleteConfirmOpen.value = true
}

/**
 * Delete DNS server
 */
const deleteServer = async () => {
  if (!serverToDelete.value) return

  cancelPendingInputLoads()
  // serverId captures the confirmed row before selection state is cleared.
  const serverId = serverToDelete.value
  // isCurrent controls table loading and empty-page fallback; accepted mutation outcomes depend only on scope lifetime.
  let isCurrent = requests.begin()
  if (!isCurrent()) return
  isLoading.value = true
  try {
    await dnsApi.deleteOne(serverId)
    if (!requests.isActive()) return
    isDeleteConfirmOpen.value = false
    serverToDelete.value = null
    showSuccess(`DNS сервер #${serverId} успешно удален`)

    // Reload data after deletion
    if (isCurrent()) waitingForRefresh.value = true
    await delay()
    if (!requests.isActive()) return
    // pendingLoad starts the current table reload; its generation now owns completion and page fallback.
    const pendingLoad = loadActiveServers()
    isCurrent = requests.capture()
    await pendingLoad
    if (!requests.isActive()) return

    if (!isCurrent()) return
    // Check if we need to go to previous page (if current page is now empty)
    if (!hasError.value && servers.value.length === 0 && pagination.currentPage.value > 1) {
      // previousPageLoad starts the fallback synchronously; capture its ownership before awaiting it.
      const previousPageLoad = goToActivePage(pagination.currentPage.value - 1)
      isCurrent = requests.capture()
      await previousPageLoad
    }
  } catch (error) {
    // error reports this submitted mutation even if table input changed; teardown still suppresses publication.
    if (!requests.isActive()) return
    errorHandler.handleError(error, {
      action: 'deleteServer',
      component: 'DnsServersPage',
      serverId,
    })
    isDeleteConfirmOpen.value = false
    serverToDelete.value = null
  } finally {
    if (isCurrent()) {
      waitingForRefresh.value = false
      isLoading.value = false
    }
  }
}

onMounted(() => {
  loadServers()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">DNS Серверы</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Управление DNS серверами для определения доменов</p>
    </div>

    <!-- Actions Bar -->
    <div class="mb-6 flex flex-col justify-between gap-4 sm:flex-row">
      <!-- Search -->
      <div class="relative max-w-md flex-1">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
        </div>
        <input
          v-model="searchQuery"
          @input="searchServers"
          type="search"
          aria-label="Поиск по серверу"
          placeholder="Поиск по серверу..."
          class="block w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-10 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <!-- Add Button -->
      <BaseButton @click="openAddModal" variant="primary">
        <PlusIcon class="mr-2 h-5 w-5" />
        Добавить DNS Сервер
      </BaseButton>
    </div>

    <!-- Table -->
    <DataTable
      :data="servers"
      :columns="TABLE_COLUMNS"
      :is-loading="isLoading"
      :has-error="hasError"
      :loading-message="waitingForRefresh ? 'Изменения сохранены. Обновляем список…' : undefined"
      :column-filters="columnFilters"
      empty-message="DNS серверы не найдены"
      @update:column-filters="updateColumnFilters"
      @retry="loadActiveServers()"
    >
      <template #cell-server="{ value }">
        <span class="font-mono text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-doh_server="{ value }">
        <span class="block max-w-xs truncate font-mono text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-description="{ value }">
        <span class="text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-actions="{ row }">
        <BaseButton
          variant="danger"
          size="sm"
          :aria-label="`Удалить DNS-сервер: ${row.server || row.doh_server || row.id}`"
          @click.stop="openDeleteConfirm(row.id)"
        >
          <TrashIcon class="h-4 w-4" />
        </BaseButton>
      </template>
    </DataTable>

    <!-- Pagination -->
    <PaginationControl
      v-if="servers.length > 0"
      :current-page="pagination.currentPage.value"
      :total-pages="pagination.totalPages.value"
      :total-items="pagination.totalItems.value"
      :page-size="pagination.pageSize.value"
      :page-size-options="pagination.PAGE_SIZE_OPTIONS"
      @update:current-page="goToActivePage"
      @update:page-size="changeActivePageSize"
    />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" title="Добавить DNS Сервер" @close="closeAddModal">
      <form @submit.prevent="createServer" class="space-y-4">
        <div>
          <BaseInput
            label="DNS-сервер (IPv4/IPv6)"
            v-model="formData.server!"
            type="text"
            placeholder="8.8.8.8 или 2001:4860:4860::8888"
            :error="formErrors.server"
          />
        </div>

        <div>
          <BaseInput
            label="DoH-сервер (DNS через HTTPS)"
            v-model="formData.doh_server!"
            :error="formErrors.doh_server"
            type="url"
            placeholder="https://dns.google/dns-query"
          />
        </div>

        <div>
          <BaseTextarea label="Описание" v-model="formData.description!" placeholder="Описание DNS сервера" :rows="2" />
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <BaseButton variant="ghost" type="button" @click="closeAddModal">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :is-loading="isLoading">Создать</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      :is-open="isDeleteConfirmOpen"
      title="Удалить DNS Сервер"
      message="Вы уверены, что хотите удалить этот DNS сервер? Это действие нельзя отменить."
      confirm-text="Удалить"
      cancel-text="Отмена"
      variant="danger"
      :is-loading="isLoading"
      @confirm="deleteServer"
      @cancel="isDeleteConfirmOpen = false"
    />
  </div>
</template>

<style scoped></style>
