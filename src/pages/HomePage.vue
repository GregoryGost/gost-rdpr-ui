<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiRequest } from '@/api/client'
import LoadingSpinner from '@/ui/feedback/LoadingSpinner.vue'

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
    [key: string]: any
  }
  dynamic: {
    [key: string]: any
  }
}

const isLoading = ref(true)
const health = ref<HealthResponse | null>(null)
const config = ref<ConfigResponse | null>(null)

const loadDashboardData = async () => {
  isLoading.value = true
  try {
    const [healthData, configData] = await Promise.all([
      apiRequest<HealthResponse>('/health'),
      apiRequest<ConfigResponse>('/config'),
    ])
    health.value = healthData
    config.value = configData
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadDashboardData()
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Главная</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Панель управления GOST-RDPR</p>
    </div>

    <LoadingSpinner v-if="isLoading" message="Загрузка данных..." />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Health Status Card -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Состояние Системы</h3>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Статус:</span>
            <span
              :class="[
                health?.status === 'OK' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                'font-medium',
              ]"
            >
              {{ health?.status }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">База данных:</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">{{ health?.db_pool }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Uptime:</span>
            <span class="font-medium text-gray-900 dark:text-gray-100">
              {{ health?.uptime ? Math.floor(health.uptime / 3600) : 0 }}ч
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
</template>

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
