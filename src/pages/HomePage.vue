<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiRequest } from '@/api/client'
import LoadingSpinner from '@/ui/feedback/LoadingSpinner.vue'
import { APP_NAME } from '@/constants'
import { usePolling } from '@/composables/usePolling'

/**
 * Home page with dashboard metrics
 * @component HomePage
 */
interface HealthResponse {
  status: string
  ts: number
  uptime: number
  db_pool: string
}

interface ConfigResponse {
  static: {
    app_version: string
    app_title: string
    [key: string]: unknown
  }
  dynamic: {
    [key: string]: unknown
  }
}

const isLoading = ref(true)
const health = ref<HealthResponse | null>(null)
const config = ref<ConfigResponse | null>(null)
const hasConnectionError = ref(false)
const lastUpdateTime = ref<Date | null>(null)

const loadHealthData = async () => {
  try {
    const healthData = await apiRequest<HealthResponse>('/health')
    health.value = healthData
    hasConnectionError.value = false
    lastUpdateTime.value = new Date()
  } catch (error) {
    console.error('Failed to load health data:', error)
    hasConnectionError.value = true
  }
}

const loadConfigData = async () => {
  try {
    const configData = await apiRequest<ConfigResponse>('/config')
    config.value = configData
  } catch (error) {
    console.error('Failed to load config data:', error)
  }
}

const loadDashboardData = async () => {
  isLoading.value = true
  try {
    await Promise.all([loadHealthData(), loadConfigData()])
  } finally {
    isLoading.value = false
  }
}

usePolling(loadHealthData, {
  interval: 3000,
  immediate: true,
  onError: (error) => {
    console.error('Health polling error:', error)
  },
})

onMounted(() => {
  loadDashboardData()
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Главная</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Панель управления {{ APP_NAME }}</p>
    </div>

    <LoadingSpinner v-if="isLoading" message="Загрузка данных..." />

    <div v-else>
      <!-- Connection Error Alert -->
      <div
        v-if="hasConnectionError"
        class="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
      >
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="text-sm font-medium text-red-800 dark:text-red-300">
            Нет связи с сервером. Данные могут быть устаревшими.
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Health Status Card -->
        <div
          :class="[
            'rounded-lg border p-6 transition-colors',
            hasConnectionError
              ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
          ]"
        >
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Состояние Системы</h3>
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600 dark:text-gray-400">Статус:</span>
              <span
                :class="[
                  hasConnectionError
                    ? 'text-red-600 dark:text-red-400'
                    : health?.status === 'OK'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400',
                  'font-medium',
                ]"
              >
                {{ hasConnectionError ? 'ERROR' : health?.status }}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600 dark:text-gray-400">База данных:</span>
              <span class="font-medium text-gray-900 dark:text-gray-100">
                {{ hasConnectionError ? '—' : health?.db_pool }}
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600 dark:text-gray-400">Uptime:</span>
              <span class="font-medium text-gray-900 dark:text-gray-100">
                {{ hasConnectionError ? '—' : health?.uptime ? Math.floor(health.uptime / 3600) : 0 }}{{ hasConnectionError ? '' : 'ч' }}
              </span>
            </div>
          </div>
        </div>

      <!-- Version Info Card -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Информация о версии</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Название:</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">{{ config?.static.app_title }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Версия:</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">{{ config?.static.app_version }}</span>
          </div>
        </div>
      </div>

      <!-- Quick Actions Card -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Быстрые действия</h3>
        <div class="space-y-2">
          <router-link
            to="/dns"
            class="block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Управление DNS серверами
          </router-link>
          <router-link
            to="/domains"
            class="block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Управление доменами
          </router-link>
          <router-link
            to="/commands"
            class="block px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            Выполнить команды
          </router-link>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
