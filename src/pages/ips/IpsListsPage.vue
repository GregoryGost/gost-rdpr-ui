<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ipsListsApi } from '@/api/endpoints/ips-lists'
import type { IpsList, IpsListCreateData } from '@/api/types/ips'
import { usePaginatedData } from '@/composables'
import { IPS_LISTS_TEXTS, UI_TEXTS, SEARCH, VALIDATION, ERROR_MESSAGES } from '@/constants'
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
 * IPs Lists management page
 * @component IpsListsPage
 */
const searchQuery = ref('')
const attemptsFilter = ref<'all' | 'success' | 'errors' | 'critical'>('all')

// Statistics
const totalLists = ref(0)
const totalWithErrors = ref(0)
const totalCritical = ref(0)

// Paginated data management
const {
  data: lists,
  isLoading,
  pagination,
  load: loadLists,
  refresh: refreshLists,
  goToPage,
  changePageSize,
} = usePaginatedData<IpsList>(async (params) => {
  const response = await ipsListsApi.getAll(params)

  // Update statistics
  totalLists.value = response.total
  totalWithErrors.value = response.payload.filter((item) => item.attempts > 0 && item.attempts < 3).length
  totalCritical.value = response.payload.filter((item) => item.attempts >= 3).length

  // Apply client-side filtering by attempts
  let filtered = response.payload
  if (attemptsFilter.value === 'success') {
    filtered = filtered.filter((item) => item.attempts === 0)
  } else if (attemptsFilter.value === 'errors') {
    filtered = filtered.filter((item) => item.attempts > 0 && item.attempts < 3)
  } else if (attemptsFilter.value === 'critical') {
    filtered = filtered.filter((item) => item.attempts >= 3)
  }
  return { ...response, payload: filtered, total: filtered.length }
}, 20)

// Modals
const isAddModalOpen = ref(false)
const isViewModalOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const listToDelete = ref<number | null>(null)
const selectedList = ref<IpsList | null>(null)

// Form data
const formData = ref<IpsListCreateData>({
  name: '',
  url: '',
  description: '',
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS = [
  { key: 'id', label: UI_TEXTS.ID },
  { key: 'name', label: UI_TEXTS.NAME },
  { key: 'url', label: UI_TEXTS.URL },
  { key: 'description', label: UI_TEXTS.DESCRIPTION },
  { key: 'elements_count', label: IPS_LISTS_TEXTS.COLUMN_IPS_COUNT },
  { key: 'ip_v4_count', label: IPS_LISTS_TEXTS.COLUMN_IPV4_COUNT },
  { key: 'ip_v6_count', label: IPS_LISTS_TEXTS.COLUMN_IPV6_COUNT },
  { key: 'attempts', label: IPS_LISTS_TEXTS.COLUMN_ATTEMPTS },
  { key: 'created_at_hum', label: UI_TEXTS.CREATED },
  { key: 'actions', label: UI_TEXTS.ACTIONS },
]

/**
 * Search IPs lists with debounce
 */
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const searchLists = async () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(async () => {
    pagination.currentPage.value = 1 // Reset to first page

    if (!searchQuery.value || searchQuery.value.length < SEARCH.MIN_LENGTH) {
      loadLists()
      return
    }

    isLoading.value = true
    try {
      const response = await ipsListsApi.search(searchQuery.value, {
        limit: pagination.pageSize.value,
        offset: pagination.offset.value,
      })

      // Update statistics
      totalLists.value = response.total
      totalWithErrors.value = response.payload.filter((item) => item.attempts > 0 && item.attempts < 3).length
      totalCritical.value = response.payload.filter((item) => item.attempts >= 3).length

      // Apply client-side filtering by attempts
      let filtered = response.payload
      if (attemptsFilter.value === 'success') {
        filtered = filtered.filter((item) => item.attempts === 0)
      } else if (attemptsFilter.value === 'errors') {
        filtered = filtered.filter((item) => item.attempts > 0 && item.attempts < 3)
      } else if (attemptsFilter.value === 'critical') {
        filtered = filtered.filter((item) => item.attempts >= 3)
      }

      lists.value = filtered
      pagination.totalItems.value = filtered.length

      // Show search results notification
      if (lists.value.length === 0) {
        showInfo(
          `${IPS_LISTS_TEXTS.SEARCH_NOT_FOUND_PREFIX} "${searchQuery.value}" ${UI_TEXTS.NOTHING_FOUND}`,
          UI_TEXTS.SEARCH_RESULTS,
        )
      } else {
        showInfo(`${IPS_LISTS_TEXTS.SEARCH_FOUND_PREFIX} ${lists.value.length}`, UI_TEXTS.SEARCH_RESULTS)
      }
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'searchLists',
        component: 'IpsListsPage',
        query: searchQuery.value,
      })
    } finally {
      isLoading.value = false
    }
  }, 300) // Debounce 300ms
}

/**
 * Filter by attempts status
 */
const filterByAttempts = (value: 'all' | 'success' | 'errors' | 'critical') => {
  attemptsFilter.value = value
  pagination.currentPage.value = 1 // Reset to first page

  // Reload data with new filter
  if (searchQuery.value && searchQuery.value.length >= SEARCH.MIN_LENGTH) {
    searchLists()
  } else {
    loadLists()
  }
}

/**
 * Validate form data
 */
const validateForm = (): boolean => {
  formErrors.value = {}

  if (!formData.value.name || formData.value.name.length < VALIDATION.MIN_NAME_LENGTH) {
    formErrors.value.name = IPS_LISTS_TEXTS.VALIDATION_NAME_REQUIRED
    showWarning(IPS_LISTS_TEXTS.VALIDATION_NAME_REQUIRED, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  if (!formData.value.url || formData.value.url.length < VALIDATION.MIN_URL_LENGTH) {
    formErrors.value.url = IPS_LISTS_TEXTS.VALIDATION_URL_REQUIRED
    showWarning(IPS_LISTS_TEXTS.VALIDATION_URL_REQUIRED, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  // Validate URL format
  try {
    new URL(formData.value.url)
  } catch {
    formErrors.value.url = IPS_LISTS_TEXTS.VALIDATION_URL_INVALID
    showWarning(IPS_LISTS_TEXTS.VALIDATION_URL_INVALID, ERROR_MESSAGES.VALIDATION_ERROR)
    return false
  }

  return true
}

/**
 * Open view modal
 */
const openViewModal = (list: IpsList) => {
  selectedList.value = list
  isViewModalOpen.value = true
}

/**
 * Open add modal
 */
const openAddModal = () => {
  formData.value = { name: '', url: '', description: '' }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Close add modal and reset form
 */
const closeAddModal = () => {
  formData.value = { name: '', url: '', description: '' }
  formErrors.value = {}
  isAddModalOpen.value = false
}

/**
 * Create new IPs list
 */
const createList = async () => {
  if (!validateForm()) return

  isLoading.value = true
  try {
    await ipsListsApi.create([formData.value])
    closeAddModal()
    showSuccess(`${IPS_LISTS_TEXTS.LIST_PREFIX} "${formData.value.name}" ${IPS_LISTS_TEXTS.SUCCESS_CREATED}`)
    await refreshLists()
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'createList',
      component: 'IpsListsPage',
      name: formData.value.name,
    })
  } finally {
    isLoading.value = false
  }
}

/**
 * Open delete confirmation dialog
 */
const openDeleteConfirm = (id: number) => {
  listToDelete.value = id
  isDeleteConfirmOpen.value = true
}

/**
 * Delete IPs list
 */
const deleteList = async () => {
  if (!listToDelete.value) return

  const listId = listToDelete.value
  isLoading.value = true
  try {
    await ipsListsApi.deleteOne(listId)
    isDeleteConfirmOpen.value = false
    listToDelete.value = null
    showSuccess(`${IPS_LISTS_TEXTS.LIST_PREFIX} #${listId} ${IPS_LISTS_TEXTS.SUCCESS_DELETED}`)

    // Reload data after deletion
    await refreshLists()

    // Check if we need to go to previous page (if current page is now empty)
    if (lists.value.length === 0 && pagination.currentPage.value > 1) {
      goToPage(pagination.currentPage.value - 1)
    }
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'deleteList',
      component: 'IpsListsPage',
      listId,
    })
    isDeleteConfirmOpen.value = false
    listToDelete.value = null
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadLists()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ IPS_LISTS_TEXTS.PAGE_TITLE }}</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        {{ IPS_LISTS_TEXTS.PAGE_DESCRIPTION }}
      </p>
    </div>

    <!-- Stats -->
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Всего списков</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{{ totalLists }}</div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_LISTS_TEXTS.STATS_TOTAL_HINT }}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Без ошибок</div>
        <div class="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
          {{ totalLists - totalWithErrors - totalCritical }}
        </div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_LISTS_TEXTS.STATS_SUCCESS_HINT }}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">С ошибками</div>
        <div class="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">{{ totalWithErrors }}</div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_LISTS_TEXTS.STATS_ERRORS_HINT }}</p>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Критические</div>
        <div class="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{{ totalCritical }}</div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ IPS_LISTS_TEXTS.STATS_CRITICAL_HINT }}</p>
      </div>
    </div>

    <!-- Actions Bar -->
    <div class="mb-6 flex flex-col justify-between gap-4 lg:flex-row">
      <!-- Search and Filters -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <!-- Search -->
        <div class="relative max-w-md flex-1">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            @input="searchLists"
            type="search"
            :placeholder="IPS_LISTS_TEXTS.SEARCH_PLACEHOLDER"
            class="block w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-10 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <!-- Filter by Attempts -->
        <div class="flex flex-wrap gap-2">
          <BaseButton
            @click="filterByAttempts('all')"
            :variant="attemptsFilter === 'all' ? 'primary' : 'ghost'"
            size="sm"
          >
            {{ IPS_LISTS_TEXTS.FILTER_ALL }}
          </BaseButton>
          <BaseButton
            @click="filterByAttempts('success')"
            :variant="attemptsFilter === 'success' ? 'primary' : 'ghost'"
            size="sm"
          >
            {{ IPS_LISTS_TEXTS.FILTER_SUCCESS }}
          </BaseButton>
          <BaseButton
            @click="filterByAttempts('errors')"
            :variant="attemptsFilter === 'errors' ? 'primary' : 'ghost'"
            size="sm"
          >
            {{ IPS_LISTS_TEXTS.FILTER_ERRORS }}
          </BaseButton>
          <BaseButton
            @click="filterByAttempts('critical')"
            :variant="attemptsFilter === 'critical' ? 'primary' : 'ghost'"
            size="sm"
          >
            {{ IPS_LISTS_TEXTS.FILTER_CRITICAL }}
          </BaseButton>
        </div>
      </div>

      <!-- Add Button -->
      <BaseButton @click="openAddModal" variant="primary">
        <PlusIcon class="mr-2 h-5 w-5" />
        {{ IPS_LISTS_TEXTS.ADD_BUTTON }}
      </BaseButton>
    </div>

    <!-- Table -->
    <DataTable
      :data="lists"
      :columns="TABLE_COLUMNS"
      :is-loading="isLoading"
      :empty-message="IPS_LISTS_TEXTS.EMPTY_MESSAGE"
      @row-click="openViewModal"
    >
      <template #cell-name="{ value }">
        <span class="font-medium text-gray-900 dark:text-gray-100">{{ value }}</span>
      </template>

      <template #cell-url="{ value }">
        <a
          :href="value as string"
          target="_blank"
          rel="noopener noreferrer"
          class="block max-w-xs truncate font-mono text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {{ value }}
        </a>
      </template>

      <template #cell-description="{ value }">
        <span class="text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-elements_count="{ value }">
        <span class="font-mono text-sm text-gray-700 dark:text-gray-300">{{ value }}</span>
      </template>

      <template #cell-ip_v4_count="{ value }">
        <span
          class="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 font-mono text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        >
          {{ value || 0 }}
        </span>
      </template>

      <template #cell-ip_v6_count="{ value }">
        <span
          class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 font-mono text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
        >
          {{ value || 0 }}
        </span>
      </template>

      <template #cell-attempts="{ value }">
        <span
          class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
          :class="{
            'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': value === 0,
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200':
              (value as number) > 0 && (value as number) < 3,
            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200': (value as number) >= 3,
          }"
        >
          {{ value }}
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
      v-if="lists.length > 0"
      :current-page="pagination.currentPage.value"
      :total-pages="pagination.totalPages.value"
      :total-items="pagination.totalItems.value"
      :page-size="pagination.pageSize.value"
      :page-size-options="pagination.PAGE_SIZE_OPTIONS"
      @update:current-page="goToPage"
      @update:page-size="changePageSize"
    />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" :title="IPS_LISTS_TEXTS.MODAL_TITLE" @close="closeAddModal">
      <form @submit.prevent="createList" class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ IPS_LISTS_TEXTS.LABEL_NAME }} <span class="text-red-500">*</span>
          </label>
          <BaseInput
            v-model="formData.name"
            type="text"
            :placeholder="IPS_LISTS_TEXTS.PLACEHOLDER_NAME"
            :error="formErrors.name"
            required
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ IPS_LISTS_TEXTS.LABEL_URL }} <span class="text-red-500">*</span>
          </label>
          <BaseInput
            v-model="formData.url"
            type="url"
            :placeholder="IPS_LISTS_TEXTS.PLACEHOLDER_URL"
            :error="formErrors.url"
            required
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ IPS_LISTS_TEXTS.HINT_URL }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ IPS_LISTS_TEXTS.LABEL_DESCRIPTION }}
          </label>
          <BaseTextarea
            v-model="formData.description!"
            :placeholder="IPS_LISTS_TEXTS.PLACEHOLDER_DESCRIPTION"
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
      :title="`${IPS_LISTS_TEXTS.LIST_PREFIX}: ${selectedList?.name || ''}`"
      @close="isViewModalOpen = false"
    >
      <div v-if="selectedList" class="space-y-4">
        <!-- List Info (Read-only) -->
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">ID</label>
            <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedList.id }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_LISTS_TEXTS.LABEL_NAME }}
            </label>
            <p class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedList.name }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_LISTS_TEXTS.LABEL_URL }}
            </label>
            <a
              :href="selectedList.url"
              target="_blank"
              rel="noopener noreferrer"
              class="block font-mono text-sm break-all text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {{ selectedList.url }}
            </a>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_LISTS_TEXTS.LABEL_DESCRIPTION }}
            </label>
            <p v-if="selectedList.description" class="text-sm text-gray-900 dark:text-gray-100">
              {{ selectedList.description }}
            </p>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Не указано</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Hash</label>
            <p v-if="selectedList.hash" class="font-mono text-xs break-all text-gray-900 dark:text-gray-100">
              {{ selectedList.hash }}
            </p>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">Не вычислен</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_LISTS_TEXTS.COLUMN_ATTEMPTS }}
            </label>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
                :class="{
                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200': selectedList.attempts === 0,
                  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200':
                    selectedList.attempts > 0 && selectedList.attempts < 3,
                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200': selectedList.attempts >= 3,
                }"
              >
                {{ selectedList.attempts }}
              </span>
              <span class="text-sm text-gray-600 dark:text-gray-400">
                {{
                  selectedList.attempts === 0
                    ? 'Без ошибок'
                    : selectedList.attempts < 3
                      ? 'Есть ошибки'
                      : 'Критическое состояние'
                }}
              </span>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ IPS_LISTS_TEXTS.COLUMN_IPS_COUNT }}
            </label>
            <p class="text-sm text-gray-900 dark:text-gray-100">
              <span class="font-mono font-semibold">{{ selectedList.elements_count }}</span> IP адресов
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ IPS_LISTS_TEXTS.COLUMN_IPV4_COUNT }}
              </label>
              <span
                class="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 font-mono text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              >
                {{ selectedList.ip_v4_count || 0 }}
              </span>
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {{ IPS_LISTS_TEXTS.COLUMN_IPV6_COUNT }}
              </label>
              <span
                class="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 font-mono text-sm font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
              >
                {{ selectedList.ip_v6_count || 0 }}
              </span>
            </div>
          </div>

          <div class="border-t pt-3 dark:border-gray-700">
            <label class="mb-2 block text-xs font-semibold text-gray-700 uppercase dark:text-gray-300">
              Временные метки
            </label>

            <div class="space-y-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Создано</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedList.created_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">
                  Timestamp: {{ selectedList.created_at }}
                </p>
              </div>

              <div v-if="selectedList.updated_at_hum">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Обновлено</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedList.updated_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">
                  Timestamp: {{ selectedList.updated_at }}
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
      :title="IPS_LISTS_TEXTS.DELETE_TITLE"
      :message="IPS_LISTS_TEXTS.DELETE_MESSAGE"
      :confirm-text="UI_TEXTS.DELETE"
      :cancel-text="UI_TEXTS.CANCEL"
      variant="danger"
      :is-loading="isLoading"
      @confirm="deleteList"
      @cancel="isDeleteConfirmOpen = false"
    />
  </div>
</template>

<style scoped></style>
