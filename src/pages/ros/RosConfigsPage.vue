<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { rosApi } from '@/api/endpoints/ros'
import type { RosConfig, RosConfigCreateData } from '@/api/types/ros'
import { useDebouncedTask, usePaginatedData } from '@/composables'
import { ROS_TEXTS, UI_TEXTS, SEARCH, VALIDATION, ERROR_MESSAGES } from '@/constants'
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
 * RouterOS Configs management page
 * @component RosConfigsPage
 */
/** waitingForRefresh identifies the refresh after a successful mutation, including the wait before it begins. */
const waitingForRefresh = ref(false)
const searchQuery = ref('')
const columnFilters = ref<TableColumnFilters>({})
const hasActiveColumnFilters = computed(() => hasColumnFilters(columnFilters.value))

/** configs holds accepted rows; isLoading tracks the current load;
 * hasError records a failed table request; pagination owns page counters.
 * The loader callback uses params as the requested page and returns its backend response.
 * requests coordinates normal, search and filtered loads; loadConfigs loads the current normal page. */
const {
  data: configs,
  isLoading,
  hasError,
  pagination,
  requests,
  load: loadConfigs,
} = usePaginatedData<RosConfig>(async (params) => {
  return await rosApi.getAll(params)
}, 20)

// Modals
const isAddModalOpen = ref(false)
const isViewModalOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const configToDelete = ref<number | null>(null)
const selectedConfig = ref<RosConfig | null>(null)

// Form data
const formData = ref<RosConfigCreateData>({
  host: '',
  user: '',
  user_password: '',
  bgp_list_name: '',
  description: undefined,
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS: TableColumn<RosConfig>[] = [
  { key: 'id', label: UI_TEXTS.ID, sortable: true },
  { key: 'host', label: ROS_TEXTS.COLUMN_HOST, sortable: true },
  { key: 'user', label: ROS_TEXTS.COLUMN_USER, sortable: true },
  { key: 'bgp_list_name', label: ROS_TEXTS.COLUMN_BGP_LIST_NAME, sortable: true },
  { key: 'description', label: ROS_TEXTS.COLUMN_DESCRIPTION, sortable: true },
  { key: 'created_at_hum', label: UI_TEXTS.CREATED, sortable: true },
  { key: 'actions', label: UI_TEXTS.ACTIONS },
]

const hasActiveSearch = () => Boolean(searchQuery.value && searchQuery.value.length >= SEARCH.MIN_LENGTH)

/** Captures column values and returns a predicate for one consistent filtered dataset. */
const createRosColumnFilter = () => {
  // filters keeps subsequent backend batches independent of new input edits.
  const filters = { ...columnFilters.value }
  return (row: RosConfig) => matchesColumnFilters(row, TABLE_COLUMNS, filters)
}

/** Reports the accepted result total for the query captured by its request. */
const showSearchResults = (total: number, query: string) => {
  if (total === 0) {
    showInfo(`${ROS_TEXTS.SEARCH_NOT_FOUND_PREFIX} "${query}" ${UI_TEXTS.NOTHING_FOUND}`, UI_TEXTS.SEARCH_RESULTS)
    return
  }

  showInfo(`${ROS_TEXTS.SEARCH_FOUND_PREFIX} ${total}`, UI_TEXTS.SEARCH_RESULTS)
}

/** Loads the captured search and filters; obsolete outcomes cannot publish or notify. */
const loadSearchResults = async (shouldNotify = false) => {
  // isCurrent checks ownership; query is the entered search; filterItem freezes column matching.
  const isCurrent = requests.begin()
  const query = searchQuery.value
  const filterItem = createRosColumnFilter()
  if (!isCurrent()) return
  hasError.value = false
  isLoading.value = true
  try {
    // response holds the filtered rows and matching total; the fetch callback reuses the captured query.
    const response = await loadClientFilteredPage(
      (params) => rosApi.search(query, params),
      {
        limit: pagination.pageSize.value,
        offset: pagination.offset.value,
      },
      filterItem,
    )

    if (!isCurrent()) return
    configs.value = response.payload
    pagination.totalItems.value = response.total

    if (shouldNotify) showSearchResults(response.total, query)
  } catch (error) {
    // error belongs to this search and is reported only if its intent remains current.
    if (!isCurrent()) return
    hasError.value = true
    errorHandler.handleError(error, {
      action: 'searchConfigs',
      component: 'RosConfigsPage',
      query,
    })
    configs.value = []
    pagination.totalItems.value = 0
  } finally {
    if (isCurrent()) isLoading.value = false
  }
}

/** Selects the search, column-filtered or normal source for the current intent. */
const loadActiveConfigs = async (shouldNotifySearch = false) => {
  if (hasActiveSearch()) {
    await loadSearchResults(shouldNotifySearch)
  } else if (hasActiveColumnFilters.value) {
    await loadFilteredConfigs()
  } else {
    await loadConfigs()
  }
}

/** Loads a snapshot of column-filtered rows without allowing earlier loads to replace them. */
const loadFilteredConfigs = async () => {
  // isCurrent checks publication ownership; filterItem retains this request's column values.
  const isCurrent = requests.begin()
  const filterItem = createRosColumnFilter()
  if (!isCurrent()) return
  hasError.value = false
  isLoading.value = true
  try {
    // response contains this filtered page and total; its fetch callback forwards each backend page unchanged.
    const response = await loadClientFilteredPage(
      (params) => rosApi.getAll(params),
      {
        limit: pagination.pageSize.value,
        offset: pagination.offset.value,
      },
      filterItem,
    )

    if (!isCurrent()) return
    configs.value = response.payload
    pagination.totalItems.value = response.total
  } catch (error) {
    // error is relevant only while this filtered load remains current.
    if (!isCurrent()) return
    hasError.value = true
    errorHandler.handleError(error, {
      action: 'loadFilteredConfigs',
      component: 'RosConfigsPage',
    })
    configs.value = []
    pagination.totalItems.value = 0
  } finally {
    if (isCurrent()) isLoading.value = false
  }
}

/** runSearchConfigsDebounced schedules the search callback; cancelSearchConfigsDebounce clears its queued run.
 * The callback resets pagination and loads the latest active input after the debounce delay. */
const { run: runSearchConfigsDebounced, cancel: cancelSearchConfigsDebounce } = useDebouncedTask(async () => {
  pagination.currentPage.value = 1 // Reset to first page

  if (!hasActiveSearch()) {
    await loadActiveConfigs()
    return
  }

  await loadSearchResults(true)
})

/** runColumnFiltersDebounced schedules a reload using current filters; cancelColumnFiltersDebounce clears it.
 * The callback loads through the active search or normal source. */
const { run: runColumnFiltersDebounced, cancel: cancelColumnFiltersDebounce } = useDebouncedTask(async () => {
  await loadActiveConfigs()
})

/** Cancels queued input loads and immediately invalidates all earlier request continuations. */
const cancelPendingInputLoads = () => {
  waitingForRefresh.value = false
  requests.invalidate()
  cancelSearchConfigsDebounce()
  cancelColumnFiltersDebounce()
}

/** Selects page and loads it through the active search or filter source. */
const goToActivePage = async (page: number) => {
  cancelPendingInputLoads()
  pagination.goToPage(page)
  await loadActiveConfigs()
}

/** Selects a new page size and reloads the first page through the active source. */
const changeActivePageSize = async (size: number) => {
  cancelPendingInputLoads()
  pagination.changePageSize(size)
  await loadActiveConfigs()
}

/** Invalidates earlier results at input time, before scheduling the existing search debounce. */
const searchConfigs = () => {
  cancelPendingInputLoads()
  runSearchConfigsDebounced()
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

  if (!formData.value.host || formData.value.host.length < VALIDATION.MIN_NAME_LENGTH) {
    formErrors.value.host = ROS_TEXTS.VALIDATION_HOST_REQUIRED
    showWarning(ROS_TEXTS.VALIDATION_HOST_REQUIRED, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  if (!formData.value.user || formData.value.user.length < VALIDATION.MIN_NAME_LENGTH) {
    formErrors.value.user = ROS_TEXTS.VALIDATION_USER_REQUIRED
    showWarning(ROS_TEXTS.VALIDATION_USER_REQUIRED, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  if (!formData.value.user_password || formData.value.user_password.length < VALIDATION.MIN_NAME_LENGTH) {
    formErrors.value.user_password = ROS_TEXTS.VALIDATION_PASSWORD_REQUIRED
    showWarning(ROS_TEXTS.VALIDATION_PASSWORD_REQUIRED, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  if (!formData.value.bgp_list_name || formData.value.bgp_list_name.length < VALIDATION.MIN_NAME_LENGTH) {
    formErrors.value.bgp_list_name = ROS_TEXTS.VALIDATION_BGP_LIST_NAME_REQUIRED
    showWarning(ROS_TEXTS.VALIDATION_BGP_LIST_NAME_REQUIRED, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  return true
}

/**
 * Open view modal
 */
const openViewModal = (config: RosConfig) => {
  selectedConfig.value = config
  isViewModalOpen.value = true
}

/**
 * Open add modal
 */
const openAddModal = () => {
  formData.value = { host: '', user: '', user_password: '', bgp_list_name: '', description: undefined }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Close add modal and reset form
 */
const closeAddModal = () => {
  formData.value = { host: '', user: '', user_password: '', bgp_list_name: '', description: undefined }
  formErrors.value = {}
  isAddModalOpen.value = false
}

/**
 * Create new RouterOS config
 */
const createConfig = async () => {
  if (!validateForm()) return

  // configHost retains the submitted entity name for success and error messages after form reset.
  const configHost = formData.value.host
  cancelPendingInputLoads()
  // isCurrent controls table loading and empty-page fallback; accepted mutation outcomes depend only on scope lifetime.
  let isCurrent = requests.begin()
  if (!isCurrent()) return
  isLoading.value = true
  try {
    await rosApi.create([formData.value])
    if (!requests.isActive()) return
    closeAddModal()
    showSuccess(`${ROS_TEXTS.CONFIG_PREFIX} "${configHost}" ${ROS_TEXTS.SUCCESS_CREATED}`)
    if (isCurrent()) waitingForRefresh.value = true
    await delay()
    if (!requests.isActive()) return
    // pendingLoad starts the current table reload; its generation now owns completion and page fallback.
    const pendingLoad = loadActiveConfigs()
    isCurrent = requests.capture()
    await pendingLoad
    if (!requests.isActive()) return
  } catch (error) {
    // error reports this submitted mutation even if table input changed; teardown still suppresses publication.
    if (!requests.isActive()) return
    errorHandler.handleError(error, {
      action: 'createConfig',
      component: 'RosConfigsPage',
      host: configHost,
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
  configToDelete.value = id
  isDeleteConfirmOpen.value = true
}

/**
 * Delete RouterOS config
 */
const deleteConfig = async () => {
  if (!configToDelete.value) return

  cancelPendingInputLoads()
  // configId captures the confirmed row before selection state is cleared.
  const configId = configToDelete.value
  // isCurrent controls table loading and empty-page fallback; accepted mutation outcomes depend only on scope lifetime.
  let isCurrent = requests.begin()
  if (!isCurrent()) return
  isLoading.value = true
  try {
    await rosApi.deleteOne(configId)
    if (!requests.isActive()) return
    isDeleteConfirmOpen.value = false
    configToDelete.value = null
    showSuccess(`${ROS_TEXTS.CONFIG_PREFIX} #${configId} ${ROS_TEXTS.SUCCESS_DELETED}`)

    // Reload data after deletion
    if (isCurrent()) waitingForRefresh.value = true
    await delay()
    if (!requests.isActive()) return
    // pendingLoad starts the current table reload; its generation now owns completion and page fallback.
    const pendingLoad = loadActiveConfigs()
    isCurrent = requests.capture()
    await pendingLoad
    if (!requests.isActive()) return

    if (!isCurrent()) return
    // Check if we need to go to previous page (if current page is now empty)
    if (!hasError.value && configs.value.length === 0 && pagination.currentPage.value > 1) {
      // previousPageLoad starts the fallback synchronously; capture its ownership before awaiting it.
      const previousPageLoad = goToActivePage(pagination.currentPage.value - 1)
      isCurrent = requests.capture()
      await previousPageLoad
    }
  } catch (error) {
    // error reports this submitted mutation even if table input changed; teardown still suppresses publication.
    if (!requests.isActive()) return
    errorHandler.handleError(error, {
      action: 'deleteConfig',
      component: 'RosConfigsPage',
      configId,
    })
    isDeleteConfirmOpen.value = false
    configToDelete.value = null
  } finally {
    if (isCurrent()) {
      waitingForRefresh.value = false
      isLoading.value = false
    }
  }
}

onMounted(() => {
  loadConfigs()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ ROS_TEXTS.PAGE_TITLE }}</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        {{ ROS_TEXTS.PAGE_DESCRIPTION }}
      </p>
    </div>

    <!-- Stats -->
    <div class="mb-6">
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Всего конфигураций</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{{ pagination.totalItems.value }}</div>
        <p class="mt-2 text-xs text-gray-600 dark:text-gray-300">{{ ROS_TEXTS.STATS_TOTAL_HINT }}</p>
      </div>
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
          @input="searchConfigs"
          type="search"
          aria-label="Поиск по хосту, пользователю или BGP списку"
          :placeholder="ROS_TEXTS.SEARCH_PLACEHOLDER"
          class="block w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-10 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <!-- Add Button -->
      <BaseButton @click="openAddModal" variant="primary">
        <PlusIcon class="mr-2 h-5 w-5" />
        {{ ROS_TEXTS.ADD_BUTTON }}
      </BaseButton>
    </div>

    <!-- Table -->
    <DataTable
      :data="configs"
      :columns="TABLE_COLUMNS"
      :is-loading="isLoading"
      :has-error="hasError"
      :loading-message="waitingForRefresh ? 'Изменения сохранены. Обновляем список…' : undefined"
      row-action-column="host"
      :column-filters="columnFilters"
      :empty-message="ROS_TEXTS.EMPTY_MESSAGE"
      @update:column-filters="updateColumnFilters"
      @row-click="openViewModal"
      @retry="loadActiveConfigs()"
    >
      <template #cell-host="{ value }">
        <span class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ value }}</span>
      </template>

      <template #cell-user="{ value }">
        <span class="text-sm text-gray-900 dark:text-gray-100">{{ value }}</span>
      </template>

      <template #cell-bgp_list_name="{ value }">
        <span class="font-mono text-sm text-blue-600 dark:text-blue-400">{{ value }}</span>
      </template>

      <template #cell-description="{ value }">
        <span class="text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-actions="{ row }">
        <BaseButton
          variant="danger"
          size="sm"
          :aria-label="`Удалить конфигурацию RouterOS: ${row.host}`"
          @click.stop="openDeleteConfirm(row.id)"
        >
          <TrashIcon class="h-4 w-4" />
        </BaseButton>
      </template>
    </DataTable>

    <!-- Pagination -->
    <PaginationControl
      v-if="configs.length > 0"
      :current-page="pagination.currentPage.value"
      :total-pages="pagination.totalPages.value"
      :total-items="pagination.totalItems.value"
      :page-size="pagination.pageSize.value"
      :page-size-options="pagination.PAGE_SIZE_OPTIONS"
      @update:current-page="goToActivePage"
      @update:page-size="changeActivePageSize"
    />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" :title="ROS_TEXTS.MODAL_TITLE" @close="closeAddModal">
      <form @submit.prevent="createConfig" class="space-y-4">
        <div>
          <BaseInput
            :label="ROS_TEXTS.LABEL_HOST"
            v-model="formData.host"
            type="text"
            :placeholder="ROS_TEXTS.PLACEHOLDER_HOST"
            :error="formErrors.host"
            required
            aria-describedby="rosconfigs-hint-host"
          />
          <p id="rosconfigs-hint-host" class="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {{ ROS_TEXTS.HINT_HOST }}
          </p>
        </div>

        <div>
          <BaseInput
            :label="ROS_TEXTS.LABEL_USER"
            v-model="formData.user"
            type="text"
            :placeholder="ROS_TEXTS.PLACEHOLDER_USER"
            :error="formErrors.user"
            required
            aria-describedby="rosconfigs-hint-user"
          />
          <p id="rosconfigs-hint-user" class="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {{ ROS_TEXTS.HINT_USER }}
          </p>
        </div>

        <div>
          <BaseInput
            :label="ROS_TEXTS.LABEL_PASSWORD"
            v-model="formData.user_password"
            type="password"
            :placeholder="ROS_TEXTS.PLACEHOLDER_PASSWORD"
            :error="formErrors.user_password"
            required
            aria-describedby="rosconfigs-hint-password"
          />
          <p id="rosconfigs-hint-password" class="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {{ ROS_TEXTS.HINT_PASSWORD }}
          </p>
        </div>

        <div>
          <BaseInput
            :label="ROS_TEXTS.LABEL_BGP_LIST_NAME"
            v-model="formData.bgp_list_name"
            type="text"
            :placeholder="ROS_TEXTS.PLACEHOLDER_BGP_LIST_NAME"
            :error="formErrors.bgp_list_name"
            required
            aria-describedby="rosconfigs-hint-bgp-list-name"
          />
          <p id="rosconfigs-hint-bgp-list-name" class="mt-1 text-xs text-gray-600 dark:text-gray-400">
            {{ ROS_TEXTS.HINT_BGP_LIST_NAME }}
          </p>
        </div>

        <div>
          <BaseTextarea
            :label="ROS_TEXTS.LABEL_DESCRIPTION"
            v-model="formData.description!"
            :placeholder="ROS_TEXTS.PLACEHOLDER_DESCRIPTION"
            :rows="2"
          />
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
      :title="`${ROS_TEXTS.CONFIG_PREFIX}: ${selectedConfig?.host || ''}`"
      @close="isViewModalOpen = false"
    >
      <div v-if="selectedConfig" class="space-y-4">
        <!-- Config Info (Read-only) -->
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">ID</label>
            <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedConfig.id }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_HOST }}
            </label>
            <p class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedConfig.host }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_USER }}
            </label>
            <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedConfig.user }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_PASSWORD }}
            </label>
            <p class="font-mono text-sm text-gray-500 dark:text-gray-400">
              {{ ROS_TEXTS.PASSWORD_MASKED }}
            </p>
            <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">Пароль скрыт из соображений безопасности</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_BGP_LIST_NAME }}
            </label>
            <p class="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
              {{ selectedConfig.bgp_list_name }}
            </p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_DESCRIPTION }}
            </label>
            <p v-if="selectedConfig.description" class="text-sm text-gray-900 dark:text-gray-100">
              {{ selectedConfig.description }}
            </p>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Не указано</p>
          </div>

          <div class="border-t pt-3 dark:border-gray-700">
            <label class="mb-2 block text-xs font-semibold text-gray-700 uppercase dark:text-gray-300">
              Временные метки
            </label>

            <div class="space-y-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Создано</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedConfig.created_at_hum }}</p>
                <p class="font-mono text-xs text-gray-600 dark:text-gray-400">
                  Timestamp: {{ selectedConfig.created_at }}
                </p>
              </div>

              <div v-if="selectedConfig.updated_at_hum">
                <label class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Обновлено</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedConfig.updated_at_hum }}</p>
                <p class="font-mono text-xs text-gray-600 dark:text-gray-400">
                  Timestamp: {{ selectedConfig.updated_at }}
                </p>
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
      :title="ROS_TEXTS.DELETE_TITLE"
      :message="ROS_TEXTS.DELETE_MESSAGE"
      :confirm-text="UI_TEXTS.DELETE"
      :cancel-text="UI_TEXTS.CANCEL"
      variant="danger"
      :is-loading="isLoading"
      @confirm="deleteConfig"
      @cancel="isDeleteConfirmOpen = false"
    />
  </div>
</template>

<style scoped></style>
