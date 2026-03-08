<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { apiRequest } from '@/api/client'
import { statsApi } from '@/api/endpoints/stats'
import PollingSettings from '@/components/dashboard/PollingSettings.vue'
import ConnectionAlert from '@/components/dashboard/ConnectionAlert.vue'
import HealthStatusCard from '@/components/dashboard/HealthStatusCard.vue'
import VersionInfoCard from '@/components/dashboard/VersionInfoCard.vue'
import ConfigurationCard from '@/components/dashboard/ConfigurationCard.vue'
import StatsMetricCard from '@/components/dashboard/StatsMetricCard.vue'
import StatsPieCard from '@/components/dashboard/StatsPieCard.vue'
import { APP_NAME, STATS_TEXTS } from '@/constants'
import { usePolling } from '@/composables'
import { useSettingsStore } from '@/stores/settings'
import { useHealthStore } from '@/stores/health'
import { errorHandler } from '@/utils/errorHandler'
import type { HealthData } from '@/stores/health'
import type { ConfigResponse } from '@/api/types/config'
import type { StatsResponse } from '@/api/types/stats'

const config = ref<ConfigResponse | null>(null)
const stats = ref<StatsResponse | null>(null)
const isStatsLoading = ref(false)
const isManualRefreshing = ref(false)

const settingsStore = useSettingsStore()
const healthStore = useHealthStore()

const { cachedHealth, hasError } = storeToRefs(healthStore)

if (!healthStore.isCacheValid()) {
  healthStore.invalidateCache()
}

const loadHealthData = async () => {
  try {
    const healthData = await apiRequest<HealthData>('/health')
    healthStore.updateHealth(healthData)
  } catch (error) {
    healthStore.setError()
    errorHandler.handleError(error, {
      action: 'loadHealthData',
      component: 'HomePage',
      silent: true,
    })
  }
}

const loadConfigData = async () => {
  try {
    const configData = await apiRequest<ConfigResponse>('/config')
    config.value = configData
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'loadConfigData',
      component: 'HomePage',
      silent: true,
    })
  }
}

const loadStatsData = async () => {
  isStatsLoading.value = true
  try {
    stats.value = await statsApi.getStats()
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'loadStatsData',
      component: 'HomePage',
      silent: true,
    })
  } finally {
    isStatsLoading.value = false
  }
}

const manualRefresh = async () => {
  isManualRefreshing.value = true
  try {
    await Promise.all([loadHealthData(), loadStatsData()])
  } finally {
    isManualRefreshing.value = false
  }
}

const initializeDashboard = () => {
  loadHealthData()
  loadConfigData()
  loadStatsData()
  polling.start()
}

const polling = usePolling(loadHealthData, {
  interval: () => settingsStore.pollingInterval,
  immediate: false,
  onError: (error) => {
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

    <PollingSettings
      :is-active="polling.isActive.value"
      :is-manual-refreshing="isManualRefreshing"
      @manual-refresh="manualRefresh"
    />

    <ConnectionAlert v-if="hasError" />

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <HealthStatusCard :health="cachedHealth" :has-error="hasError" />
      <VersionInfoCard :config="config" />
    </div>

    <!-- Key Metrics -->
    <div class="mt-8">
      <h2 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {{ STATS_TEXTS.SECTION_OVERVIEW }}
      </h2>

      <!-- Pie charts row -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsPieCard
          :title="STATS_TEXTS.DNS_TOTAL"
          :slices="[
            { label: STATS_TEXTS.DNS_CLASSIC, value: stats?.dns.classic ?? 0, color: '#3b82f6' },
            { label: STATS_TEXTS.DNS_DOH, value: stats?.dns.doh ?? 0, color: '#06b6d4' },
          ]"
          :loading="isStatsLoading"
        />
        <StatsPieCard
          :title="STATS_TEXTS.DOMAINS_TOTAL"
          :slices="[
            { label: STATS_TEXTS.DOMAINS_RESOLVED, value: stats?.domains.resolved ?? 0, color: '#22c55e' },
            { label: STATS_TEXTS.DOMAINS_UNRESOLVED, value: stats?.domains.unresolved ?? 0, color: '#ef4444' },
          ]"
          :loading="isStatsLoading"
        />
        <StatsPieCard
          :title="STATS_TEXTS.IPS_TOTAL"
          :slices="[
            { label: STATS_TEXTS.IPS_V4, value: stats?.ips.v4_total ?? 0, color: '#6366f1' },
            { label: STATS_TEXTS.IPS_V6, value: stats?.ips.v6_total ?? 0, color: '#a855f7' },
          ]"
          :loading="isStatsLoading"
        />
      </div>

      <!-- Metric cards row -->
      <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsMetricCard
          :title="STATS_TEXTS.DOMAINS_LISTS"
          :value="stats?.domains.lists_total ?? null"
          color="teal"
          :loading="isStatsLoading"
        />
        <StatsMetricCard
          :title="STATS_TEXTS.IPS_LISTS"
          :value="stats?.ips.lists_total ?? null"
          color="teal"
          :loading="isStatsLoading"
        />
        <StatsMetricCard
          :title="STATS_TEXTS.IPS_LINKED"
          :value="stats?.ips.linked_to_domain ?? null"
          :secondary-label="STATS_TEXTS.IPS_STANDALONE"
          :secondary-value="stats?.ips.standalone ?? null"
          color="orange"
          :loading="isStatsLoading"
        />
        <StatsMetricCard
          :title="STATS_TEXTS.ROS_TOTAL"
          :value="stats?.ros.total ?? null"
          color="red"
          :loading="isStatsLoading"
        />
      </div>

      <p v-if="stats" class="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {{ STATS_TEXTS.GENERATED_AT }}: {{ stats.generated_at }}
      </p>
    </div>

    <!-- Full Configuration Display -->
    <div class="mt-8">
      <h2 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Конфигурация приложения</h2>
      <ConfigurationCard :config="config" />
    </div>
  </div>
</template>

<style scoped></style>
