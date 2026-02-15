<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { apiRequest } from '@/api/client'
import PollingSettings from '@/components/dashboard/PollingSettings.vue'
import ConnectionAlert from '@/components/dashboard/ConnectionAlert.vue'
import HealthStatusCard from '@/components/dashboard/HealthStatusCard.vue'
import VersionInfoCard from '@/components/dashboard/VersionInfoCard.vue'
import QuickActionsCard from '@/components/dashboard/QuickActionsCard.vue'
import ConfigurationCard from '@/components/dashboard/ConfigurationCard.vue'
import { APP_NAME } from '@/constants'
import { usePolling } from '@/composables'
import { useSettingsStore } from '@/stores/settings'
import { useHealthStore } from '@/stores/health'
import { errorHandler } from '@/utils/errorHandler'
import type { HealthData } from '@/stores/health'
import type { ConfigResponse } from '@/api/types/config'

/**
 * Home page with dashboard metrics
 * @component HomePage
 */
const config = ref<ConfigResponse | null>(null)
const isManualRefreshing = ref(false)

const settingsStore = useSettingsStore()
const healthStore = useHealthStore()

// Use reactive refs from store
const { cachedHealth, hasError } = storeToRefs(healthStore)

// Invalidate old cache on mount
if (!healthStore.isCacheValid()) {
  healthStore.invalidateCache()
}

/**
 * Load health data
 */
const loadHealthData = async () => {
  try {
    const healthData = await apiRequest<HealthData>('/health')

    // Update store - this will automatically update all reactive refs
    healthStore.updateHealth(healthData)
  } catch (error) {
    // Set error state in store
    healthStore.setError()

    // Don't show notifications for polling errors, just log them
    errorHandler.handleError(error, {
      action: 'loadHealthData',
      component: 'HomePage',
      silent: true,
    })
  }
}

/**
 * Load config data
 */
const loadConfigData = async () => {
  try {
    const configData = await apiRequest<ConfigResponse>('/config')
    config.value = configData
  } catch (error) {
    // Keep the last config data to prevent version info from disappearing

    // Don't show notifications for config errors on initial load
    errorHandler.handleError(error, {
      action: 'loadConfigData',
      component: 'HomePage',
      silent: true,
    })
  }
}

/**
 * Manual refresh health data
 */
const manualRefresh = async () => {
  isManualRefreshing.value = true
  try {
    await loadHealthData()
  } finally {
    isManualRefreshing.value = false
  }
}

/**
 * Initialize data loading
 */
const initializeDashboard = () => {
  // Load initial data immediately
  loadHealthData()
  loadConfigData()

  // Start polling for health data
  polling.start()
}

const polling = usePolling(loadHealthData, {
  interval: () => settingsStore.pollingInterval,
  immediate: false, // Don't start immediately, we'll start manually after first load
  onError: (error) => {
    // Silent error handling for polling
    errorHandler.handleError(error, {
      action: 'polling',
      component: 'HomePage',
      silent: true,
    })
  },
})

watch(
  () => settingsStore.pollingInterval,
  (newInterval) => {
    polling.updateInterval(newInterval)
  },
)

onMounted(() => {
  initializeDashboard()
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Главная</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Панель управления {{ APP_NAME }}</p>
    </div>

    <!-- Content is always visible, cards show loading state or data when available -->
    <PollingSettings
      :is-active="polling.isActive.value"
      :is-manual-refreshing="isManualRefreshing"
      @manual-refresh="manualRefresh"
    />

    <ConnectionAlert v-if="hasError" />

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <HealthStatusCard :health="cachedHealth" :has-error="hasError" />
      <VersionInfoCard :config="config" />
      <QuickActionsCard />
    </div>

    <!-- Full Configuration Display -->
    <div class="mt-8">
      <h2 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Конфигурация приложения</h2>
      <ConfigurationCard :config="config" />
    </div>
  </div>
</template>

<style scoped></style>
