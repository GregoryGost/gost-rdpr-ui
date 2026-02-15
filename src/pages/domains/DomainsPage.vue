<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { domainsApi } from '@/api/endpoints/domains'
import type { Domain, DomainCreateData } from '@/api/types/domains'
import { PAGINATION } from '@/constants'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import BaseInput from '@/ui/forms/BaseInput.vue'
import BaseTextarea from '@/ui/forms/BaseTextarea.vue'
import { PlusIcon, TrashIcon, MagnifyingGlassIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/vue/24/outline'
import { showSuccess, showWarning, showInfo } from '@/utils/notifications'
import { errorHandler } from '@/utils/errorHandler'

/**
 * Domains management page
 * @component DomainsPage
 */
const searchQuery = ref('')
const resolvedFilter = ref<boolean | undefined>(undefined)
const listFilter = ref<'all' | 'with-list' | 'without-list'>('all')

// Data management
const domains = ref<Domain[]>([])
const allDomains = ref<Domain[]>([]) // All loaded domains before list filter
const isLoading = ref(false)
const totalResolved = ref(0)
const totalQuery = ref(0)

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
const domainToDelete = ref<number | null>(null)
const selectedDomain = ref<Domain | null>(null)

// Form data
const formData = ref<DomainCreateData>({
  domain: '',
  list_id: undefined,
  ros_comment: '',
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Домен' },
  { key: 'domains_list_id', label: 'Список' },
  { key: 'resolved', label: 'Статус' },
  { key: 'ips_v4', label: 'IPv4' },
  { key: 'ips_v6', label: 'IPv6' },
  { key: 'ros_comment', label: 'Комментарий' },
  { key: 'created_at_hum', label: 'Создано' },
  { key: 'last_resolved_at_hum', label: 'Определено' },
  { key: 'actions', label: 'Действия' },
]

/**
 * Apply list filter to domains
 */
const applyListFilter = (domainsToFilter: Domain[]): Domain[] => {
  if (listFilter.value === 'with-list') {
    return domainsToFilter.filter((d) => d.domains_list_id != null)
  } else if (listFilter.value === 'without-list') {
    return domainsToFilter.filter((d) => d.domains_list_id == null)
  }
  return domainsToFilter
}

/**
 * Load domains with stats
 */
const loadDomainsWithStats = async () => {
  isLoading.value = true
  try {
    const response = await domainsApi.getAll({
      limit: pageSize.value,
      offset: offset.value,
      resolved: resolvedFilter.value,
    })
    allDomains.value = response.payload
    domains.value = applyListFilter(response.payload)
    totalItems.value = domains.value.length
    totalResolved.value = response.total_resolved
    totalQuery.value = response.total_query
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'loadDomainsWithStats',
      component: 'DomainsPage',
    })
    domains.value = []
    allDomains.value = []
    totalItems.value = 0
    totalResolved.value = 0
    totalQuery.value = 0
  } finally {
    isLoading.value = false
  }
}

/**
 * Refresh domains (reload current page)
 */
const refreshDomains = () => loadDomainsWithStats()

/**
 * Go to specific page and load data
 */
const goToPage = (page: number) => {
  currentPage.value = page
  loadDomainsWithStats()
}

/**
 * Change page size and reload from first page
 */
const changePageSize = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  loadDomainsWithStats()
}

/**
 * Search domains
 */
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const searchDomains = async () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(async () => {
    currentPage.value = 1 // Reset to first page

    if (!searchQuery.value || searchQuery.value.length < 3) {
      loadDomainsWithStats()
      return
    }

    isLoading.value = true
    try {
      const response = await domainsApi.search(searchQuery.value, {
        limit: pageSize.value,
        offset: offset.value,
        resolved: resolvedFilter.value,
      })
      allDomains.value = response.payload
      domains.value = applyListFilter(response.payload)
      totalItems.value = domains.value.length
      totalResolved.value = response.total_resolved
      totalQuery.value = response.total_query

      // Show search results notification
      if (domains.value.length === 0) {
        showInfo(`По запросу "${searchQuery.value}" ничего не найдено`, 'Результаты поиска')
      } else {
        showInfo(`Найдено доменов: ${domains.value.length}`, 'Результаты поиска')
      }
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'searchDomains',
        component: 'DomainsPage',
        query: searchQuery.value,
      })
      domains.value = []
      allDomains.value = []
      totalItems.value = 0
      totalResolved.value = 0
      totalQuery.value = 0
    } finally {
      isLoading.value = false
    }
  }, 300) // Debounce 300ms
}

/**
 * Filter by resolved status
 */
const filterByResolved = (value: boolean | undefined) => {
  resolvedFilter.value = value
  currentPage.value = 1 // Reset to first page
  loadDomainsWithStats()
}

/**
 * Filter by list presence
 */
const filterByList = (value: 'all' | 'with-list' | 'without-list') => {
  listFilter.value = value
  currentPage.value = 1 // Reset to first page
  // Re-apply filter to already loaded domains
  domains.value = applyListFilter(allDomains.value)
  totalItems.value = domains.value.length

  // Show filter notification
  const filterLabels = {
    all: 'все списки',
    'with-list': 'домены со списком',
    'without-list': 'домены без списка',
  }
  if (domains.value.length === 0) {
    showInfo(`Нет доменов для фильтра: ${filterLabels[value]}`, 'Фильтрация')
  }
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
  formData.value = { domain: '', list_id: undefined, ros_comment: '' }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Close add modal and reset form
 */
const closeAddModal = () => {
  formData.value = { domain: '', list_id: undefined, ros_comment: '' }
  formErrors.value = {}
  isAddModalOpen.value = false
}

/**
 * Create new domain
 */
const createDomain = async () => {
  if (!validateForm()) return

  isLoading.value = true
  try {
    await domainsApi.create([formData.value])
    closeAddModal()
    showSuccess(`Домен "${formData.value.domain}" успешно добавлен`)
    await refreshDomains()
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'createDomain',
      component: 'DomainsPage',
      domain: formData.value.domain,
    })
  } finally {
    isLoading.value = false
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

  const domainId = domainToDelete.value
  isLoading.value = true
  try {
    await domainsApi.deleteOne(domainId)
    isDeleteConfirmOpen.value = false
    domainToDelete.value = null
    showSuccess(`Домен #${domainId} успешно удален`)

    // Reload data after deletion
    await refreshDomains()

    // Check if we need to go to previous page (if current page is now empty)
    if (domains.value.length === 0 && currentPage.value > 1) {
      currentPage.value -= 1
      await loadDomainsWithStats()
    }
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'deleteDomain',
      component: 'DomainsPage',
      domainId,
    })
    isDeleteConfirmOpen.value = false
    domainToDelete.value = null
  } finally {
    isLoading.value = false
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
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Всего доменов</div>
        <div class="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{{ totalQuery }}</div>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Определено</div>
        <div class="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{{ totalResolved }}</div>
      </div>
      <div class="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="text-sm text-gray-600 dark:text-gray-400">Не определено</div>
        <div class="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{{ totalQuery - totalResolved }}</div>
      </div>
    </div>

    <!-- Actions Bar -->
    <div class="mb-6 flex flex-col justify-between gap-4 lg:flex-row">
      <!-- Search and Filter -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <!-- Search -->
        <div class="relative max-w-md flex-1">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            @input="searchDomains"
            type="search"
            placeholder="Поиск по домену..."
            class="block w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-10 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <!-- Filter by Resolved Status -->
        <div class="flex flex-wrap gap-2">
          <BaseButton
            @click="filterByResolved(undefined)"
            :variant="resolvedFilter === undefined ? 'primary' : 'ghost'"
            size="sm"
          >
            Все
          </BaseButton>
          <BaseButton
            @click="filterByResolved(true)"
            :variant="resolvedFilter === true ? 'primary' : 'ghost'"
            size="sm"
          >
            Определен
          </BaseButton>
          <BaseButton
            @click="filterByResolved(false)"
            :variant="resolvedFilter === false ? 'primary' : 'ghost'"
            size="sm"
          >
            Не определен
          </BaseButton>
        </div>

        <!-- Filter by List -->
        <div class="flex flex-wrap gap-2">
          <BaseButton @click="filterByList('all')" :variant="listFilter === 'all' ? 'secondary' : 'ghost'" size="sm">
            Все списки
          </BaseButton>
          <BaseButton
            @click="filterByList('with-list')"
            :variant="listFilter === 'with-list' ? 'secondary' : 'ghost'"
            size="sm"
          >
            Со списком
          </BaseButton>
          <BaseButton
            @click="filterByList('without-list')"
            :variant="listFilter === 'without-list' ? 'secondary' : 'ghost'"
            size="sm"
          >
            Без списка
          </BaseButton>
        </div>
      </div>

      <!-- Add Button -->
      <BaseButton @click="openAddModal" variant="primary">
        <PlusIcon class="mr-2 h-5 w-5" />
        Добавить Домен
      </BaseButton>
    </div>

    <!-- Table -->
    <DataTable
      :data="domains"
      :columns="TABLE_COLUMNS"
      :is-loading="isLoading"
      empty-message="Домены не найдены"
      @row-click="openViewModal"
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
        <span v-else class="text-sm text-gray-400">Без списка</span>
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
        <BaseButton variant="danger" size="sm" @click.stop="openDeleteConfirm(row.id)">
          <TrashIcon class="h-4 w-4" />
        </BaseButton>
      </template>
    </DataTable>

    <!-- Pagination -->
    <PaginationControl
      v-if="domains.length > 0"
      :current-page="pagination.currentPage.value"
      :total-pages="pagination.totalPages.value"
      :total-items="pagination.totalItems.value"
      :page-size="pagination.pageSize.value"
      :page-size-options="pagination.PAGE_SIZE_OPTIONS"
      @update:current-page="goToPage"
      @update:page-size="changePageSize"
    />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" title="Добавить Домен" @close="closeAddModal">
      <form @submit.prevent="createDomain" class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"> Доменное имя * </label>
          <BaseInput
            v-model="formData.domain"
            type="text"
            placeholder="example.com"
            :error="formErrors.domain"
            required
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Комментарий для RouterOS
          </label>
          <BaseTextarea v-model="formData.ros_comment!" placeholder="Комментарий для RouterOS" :rows="2" />
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <BaseButton variant="ghost" type="button" @click="closeAddModal">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :is-loading="isLoading">Создать</BaseButton>
        </div>
      </form>
    </BaseModal>

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
