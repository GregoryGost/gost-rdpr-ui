<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dnsApi } from '@/api/endpoints/dns'
import type { DnsServer, DnsServerCreateData } from '@/api/types/dns'
import { usePaginatedData } from '@/composables'
import DataTable from '@/ui/tables/DataTable.vue'
import PaginationControl from '@/ui/tables/PaginationControl.vue'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'
import ConfirmDialog from '@/ui/modals/ConfirmDialog.vue'
import BaseInput from '@/ui/forms/BaseInput.vue'
import BaseTextarea from '@/ui/forms/BaseTextarea.vue'
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

/**
 * DNS Servers management page
 * @component DnsServersPage
 */
const searchQuery = ref('')

// Paginated data management
const {
  data: servers,
  isLoading,
  pagination,
  load: loadServers,
  refresh: refreshServers,
  goToPage,
  changePageSize,
} = usePaginatedData<DnsServer>(async (params) => dnsApi.getAll(params), 20)

// Modals
const isAddModalOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const serverToDelete = ref<number | null>(null)

// Form data
const formData = ref<DnsServerCreateData>({
  server: '',
  doh_server: '',
  description: ''
})

const formErrors = ref<Record<string, string>>({})

/**
 * Table columns configuration
 */
const TABLE_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'server', label: 'DNS Server' },
  { key: 'doh_server', label: 'DoH Server' },
  { key: 'description', label: 'Описание' },
  { key: 'created_at_hum', label: 'Создано' },
  { key: 'actions', label: 'Действия' },
]

/**
 * Search DNS servers
 */
const searchServers = async () => {
  if (!searchQuery.value || searchQuery.value.length < 3) {
    loadServers()
    return
  }

  isLoading.value = true
  try {
    const response = await dnsApi.search(searchQuery.value, {
      limit: pagination.pageSize.value,
      offset: pagination.offset.value,
    })
    servers.value = response.payload
    pagination.totalItems.value = response.total
  } catch (error) {
    console.error('Failed to search DNS servers:', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Validate form data
 */
const validateForm = (): boolean => {
  formErrors.value = {}

  if (!formData.value.server && !formData.value.doh_server) {
    formErrors.value.server = 'Укажите DNS сервер или DoH сервер'
    return false
  }

  return true
}

/**
 * Open add modal
 */
const openAddModal = () => {
  formData.value = { server: '', doh_server: '', description: '' }
  formErrors.value = {}
  isAddModalOpen.value = true
}

/**
 * Create new DNS server
 */
const createServer = async () => {
  if (!validateForm()) return

  isLoading.value = true
  try {
    await dnsApi.create([formData.value])
    isAddModalOpen.value = false
    refreshServers()
  } catch (error) {
    console.error('Failed to create DNS server:', error)
  } finally {
    isLoading.value = false
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

  isLoading.value = true
  try {
    await dnsApi.deleteOne(serverToDelete.value)
    isDeleteConfirmOpen.value = false
    serverToDelete.value = null
    refreshServers()
  } catch (error) {
    console.error('Failed to delete DNS server:', error)
  } finally {
    isLoading.value = false
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
      <p class="mt-2 text-gray-600 dark:text-gray-400">Управление DNS серверами для разрешения доменов</p>
    </div>

    <!-- Actions Bar -->
    <div class="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
      <!-- Search -->
      <div class="relative flex-1 max-w-md">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
        </div>
        <input
          v-model="searchQuery"
          @input="searchServers"
          type="search"
          placeholder="Поиск по серверу..."
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      <!-- Add Button -->
      <BaseButton @click="openAddModal" variant="primary">
        <PlusIcon class="h-5 w-5 mr-2" />
        Добавить DNS Сервер
      </BaseButton>
    </div>

    <!-- Table -->
    <DataTable
      :data="servers"
      :columns="TABLE_COLUMNS"
      :is-loading="isLoading"
      empty-message="DNS серверы не найдены"
    >
      <template #cell-server="{ value }">
        <span class="font-mono text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-doh_server="{ value }">
        <span class="font-mono text-sm truncate max-w-xs block">{{ value || '-' }}</span>
      </template>

      <template #cell-description="{ value }">
        <span class="text-sm">{{ value || '-' }}</span>
      </template>

      <template #cell-actions="{ row }">
        <BaseButton
          variant="danger"
          size="sm"
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
      @update:current-page="goToPage"
      @update:page-size="changePageSize"
    />

    <!-- Add Modal -->
    <BaseModal :is-open="isAddModalOpen" title="Добавить DNS Сервер" @close="isAddModalOpen = false">
      <form @submit.prevent="createServer" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            DNS Server (IPv4/IPv6)
          </label>
          <BaseInput
            v-model="formData.server!"
            type="text"
            placeholder="8.8.8.8 или 2001:4860:4860::8888"
            :error="formErrors.server"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            DoH Server (DNS over HTTPS)
          </label>
          <BaseInput
            v-model="formData.doh_server!"
            type="url"
            placeholder="https://dns.google/dns-query"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Описание</label>
          <BaseTextarea v-model="formData.description!" placeholder="Описание DNS сервера" :rows="2" />
        </div>

        <div class="flex gap-3 justify-end pt-4">
          <BaseButton variant="ghost" type="button" @click="isAddModalOpen = false">Отмена</BaseButton>
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

<style scoped>
</style>
