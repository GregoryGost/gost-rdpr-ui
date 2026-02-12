<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { apiRequest } from '@/api/client'
import LoadingSpinner from '@/ui/feedback/LoadingSpinner.vue'
import PollingSettings from '@/components/dashboard/PollingSettings.vue'
import ConnectionAlert from '@/components/dashboard/ConnectionAlert.vue'
import HealthStatusCard from '@/components/dashboard/HealthStatusCard.vue'
import VersionInfoCard from '@/components/dashboard/VersionInfoCard.vue'
import QuickActionsCard from '@/components/dashboard/QuickActionsCard.vue'
import { APP_NAME } from '@/constants'
import { usePolling } from '@/composables/usePolling'
import { useSettingsStore } from '@/stores/settings'

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
const isManualRefreshing = ref(false)

const settingsStore = useSettingsStore()

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

const manualRefresh = async () => {
  isManualRefreshing.value = true
  try {
    await loadHealthData()
  } finally {
    isManualRefreshing.value = false
  }
}

const polling = usePolling(loadHealthData, {
  interval: () => settingsStore.pollingInterval,
  immediate: true,
  onError: (error) => {
    console.error('Health polling error:', error)
  },
})

watch(
  () => settingsStore.pollingInterval,
  (newInterval) => {
    polling.updateInterval(newInterval)
  }
)

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
      <PollingSettings
        :is-active="polling.isActive.value"
        :is-manual-refreshing="isManualRefreshing"
        @manual-refresh="manualRefresh"
      />

      <ConnectionAlert v-if="hasConnectionError" />

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <HealthStatusCard :health="health" :has-error="hasConnectionError" />
        <VersionInfoCard :config="config" />
        <QuickActionsCard />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
