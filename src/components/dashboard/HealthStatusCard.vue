<script setup lang="ts">
/**
 * Health status card component
 * @component HealthStatusCard
 */
interface HealthData {
  status: string
  db_pool: string
  uptime: number
}

interface Props {
  health: HealthData | null
  hasError?: boolean
}

defineProps<Props>()
</script>

<template>
  <div
    :class="[
      'rounded-lg border p-6 transition-colors',
      hasError
        ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    ]"
  >
    <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Состояние Системы</h3>
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600 dark:text-gray-400">Статус:</span>
        <span
          :class="[
            hasError
              ? 'text-red-600 dark:text-red-400'
              : health?.status === 'OK'
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400',
            'font-medium',
          ]"
        >
          {{ hasError ? 'ERROR' : health?.status }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600 dark:text-gray-400">База данных:</span>
        <span class="font-medium text-gray-900 dark:text-gray-100">
          {{ hasError ? '—' : health?.db_pool }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600 dark:text-gray-400">Uptime:</span>
        <span class="font-medium text-gray-900 dark:text-gray-100">
          {{ hasError ? '—' : health?.uptime ? Math.floor(health.uptime / 3600) : 0 }}{{ hasError ? '' : 'ч' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
