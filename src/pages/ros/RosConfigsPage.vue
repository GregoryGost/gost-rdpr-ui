<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { rosApi } from '@/api/endpoints/ros'
import type { RosConfig, RosConfigCreateData } from '@/api/types/ros'
import { usePaginatedData } from '@/composables'
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
import { errorHandler } from '@/utils/errorHandler'

/**
 * RouterOS Configs management page
 * @component RosConfigsPage
 */
const searchQuery = ref('')

// Paginated data management
const {
  data: configs,
  isLoading,
  pagination,
  load: loadConfigs,
  refresh: refreshConfigs,
  goToPage,
  changePageSize,
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
  description: '',
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS = [
  { key: 'id', label: UI_TEXTS.ID },
  { key: 'host', label: ROS_TEXTS.COLUMN_HOST },
  { key: 'user', label: ROS_TEXTS.COLUMN_USER },
  { key: 'bgp_list_name', label: ROS_TEXTS.COLUMN_BGP_LIST_NAME },
  { key: 'description', label: ROS_TEXTS.COLUMN_DESCRIPTION },
  { key: 'created_at_hum', label: UI_TEXTS.CREATED },
  { key: 'actions', label: UI_TEXTS.ACTIONS },
]

/**
 * Search configs with debounce
 */
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const searchConfigs = async () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  searchTimeout = setTimeout(async () => {
    pagination.currentPage.value = 1 // Reset to first page

    if (!searchQuery.value || searchQuery.value.length < SEARCH.MIN_LENGTH) {
      loadConfigs()
      return
    }

    isLoading.value = true
    try {
      const response = await rosApi.search(searchQuery.value, {
        limit: pagination.pageSize.value,
        offset: pagination.offset.value,
      })

      configs.value = response.payload
      pagination.totalItems.value = response.total

      // Show search results notification
      if (configs.value.length === 0) {
        showInfo(
          `${ROS_TEXTS.SEARCH_NOT_FOUND_PREFIX} "${searchQuery.value}" ${UI_TEXTS.NOTHING_FOUND}`,
          UI_TEXTS.SEARCH_RESULTS,
        )
      } else {
        showInfo(`${ROS_TEXTS.SEARCH_FOUND_PREFIX} ${configs.value.length}`, UI_TEXTS.SEARCH_RESULTS)
      }
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'searchConfigs',
        component: 'RosConfigsPage',
        query: searchQuery.value,
      })
    } finally {
      isLoading.value = false
    }
  }, 300) // Debounce 300ms
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
  formData.value = { host: '', user: '', user_password: '', bgp_list_name: '', description: '' }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Close add modal and reset form
 */
const closeAddModal = () => {
  formData.value = { host: '', user: '', user_password: '', bgp_list_name: '', description: '' }
  formErrors.value = {}
  isAddModalOpen.value = false
}

/**
 * Create new RouterOS config
 */
const createConfig = async () => {
  if (!validateForm()) return

  isLoading.value = true
  try {
    await rosApi.create([formData.value])
    closeAddModal()
    showSuccess(`${ROS_TEXTS.CONFIG_PREFIX} "${formData.value.host}" ${ROS_TEXTS.SUCCESS_CREATED}`)
    await refreshConfigs()
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'createConfig',
      component: 'RosConfigsPage',
      host: formData.value.host,
    })
  } finally {
    isLoading.value = false
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

  const configId = configToDelete.value
  isLoading.value = true
  try {
    await rosApi.deleteOne(configId)
    isDeleteConfirmOpen.value = false
    configToDelete.value = null
    showSuccess(`${ROS_TEXTS.CONFIG_PREFIX} #${configId} ${ROS_TEXTS.SUCCESS_DELETED}`)

    // Reload data after deletion
    await refreshConfigs()

    // Check if we need to go to previous page (if current page is now empty)
    if (configs.value.length === 0 && pagination.currentPage.value > 1) {
      goToPage(pagination.currentPage.value - 1)
    }
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'deleteConfig',
      component: 'RosConfigsPage',
      configId,
    })
    isDeleteConfirmOpen.value = false
    configToDelete.value = null
  } finally {
    isLoading.value = false
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
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-500">{{ ROS_TEXTS.STATS_TOTAL_HINT }}</p>
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
      :empty-message="ROS_TEXTS.EMPTY_MESSAGE"
      @row-click="openViewModal"
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
        <BaseButton variant="danger" size="sm" @click.stop="openDeleteConfirm(row.id)">
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
      @update:current-page="goToPage"
      @update:page-size="changePageSize"
    />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" :title="ROS_TEXTS.MODAL_TITLE" @close="closeAddModal">
      <form @submit.prevent="createConfig" class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ ROS_TEXTS.LABEL_HOST }} <span class="text-red-500">*</span>
          </label>
          <BaseInput
            v-model="formData.host"
            type="text"
            :placeholder="ROS_TEXTS.PLACEHOLDER_HOST"
            :error="formErrors.host"
            required
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ ROS_TEXTS.HINT_HOST }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ ROS_TEXTS.LABEL_USER }} <span class="text-red-500">*</span>
          </label>
          <BaseInput
            v-model="formData.user"
            type="text"
            :placeholder="ROS_TEXTS.PLACEHOLDER_USER"
            :error="formErrors.user"
            required
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ ROS_TEXTS.HINT_USER }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ ROS_TEXTS.LABEL_PASSWORD }} <span class="text-red-500">*</span>
          </label>
          <BaseInput
            v-model="formData.user_password"
            type="password"
            :placeholder="ROS_TEXTS.PLACEHOLDER_PASSWORD"
            :error="formErrors.user_password"
            required
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ ROS_TEXTS.HINT_PASSWORD }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ ROS_TEXTS.LABEL_BGP_LIST_NAME }} <span class="text-red-500">*</span>
          </label>
          <BaseInput
            v-model="formData.bgp_list_name"
            type="text"
            :placeholder="ROS_TEXTS.PLACEHOLDER_BGP_LIST_NAME"
            :error="formErrors.bgp_list_name"
            required
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ ROS_TEXTS.HINT_BGP_LIST_NAME }}
          </p>
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ ROS_TEXTS.LABEL_DESCRIPTION }}
          </label>
          <BaseTextarea v-model="formData.description!" :placeholder="ROS_TEXTS.PLACEHOLDER_DESCRIPTION" :rows="2" />
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
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">ID</label>
            <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedConfig.id }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_HOST }}
            </label>
            <p class="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ selectedConfig.host }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_USER }}
            </label>
            <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedConfig.user }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_PASSWORD }}
            </label>
            <p class="font-mono text-sm text-gray-500 dark:text-gray-400">
              {{ ROS_TEXTS.PASSWORD_MASKED }}
            </p>
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">Пароль скрыт из соображений безопасности</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ ROS_TEXTS.LABEL_BGP_LIST_NAME }}
            </label>
            <p class="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
              {{ selectedConfig.bgp_list_name }}
            </p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
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
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Создано</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedConfig.created_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">
                  Timestamp: {{ selectedConfig.created_at }}
                </p>
              </div>

              <div v-if="selectedConfig.updated_at_hum">
                <label class="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Обновлено</label>
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ selectedConfig.updated_at_hum }}</p>
                <p class="font-mono text-xs text-gray-500 dark:text-gray-400">
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
