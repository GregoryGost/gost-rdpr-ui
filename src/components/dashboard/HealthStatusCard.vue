<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/vue/24/outline'

/**
 * Health status card component
 * @component HealthStatusCard
 */
interface HealthData {
  status: string
  db_pool: string
  uptime: number
  ts: number
}

interface Props {
  health: HealthData | null
  hasError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hasError: false,
})

/**
 * Determine if card should show error state
 * Only show error if there's an actual error, not just missing data
 */
const shouldShowError = computed(() => {
  return props.hasError
})

/**
 * Format uptime in seconds to human readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
const formatUptime = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0с'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []

  if (days > 0) {
    parts.push(`${days}д`)
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}ч`)
  }
  if (minutes > 0 || (days === 0 && hours === 0)) {
    parts.push(`${minutes}м`)
  }

  return parts.join(' ')
}

/**
 * Format server timestamp to readable date and time
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date and time string
 */
const formatServerTime = (timestamp: number): string => {
  if (!timestamp) return '—'

  const date = new Date(timestamp * 1000)
  const dateStr = date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return `${dateStr} ${timeStr}`
}
</script>

<template>
  <div
    :class="[
      'rounded-lg border p-6',
      shouldShowError
        ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/10'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    ]"
  >
    <div class="mb-4 flex items-center justify-between">
      <h3
        :class="[
          'text-lg font-semibold',
          shouldShowError ? 'text-red-900 dark:text-red-100' : 'text-gray-900 dark:text-gray-100',
        ]"
      >
        Состояние Системы
      </h3>
      <CheckCircleIcon
        v-if="health && !shouldShowError && health.status === 'OK'"
        class="h-6 w-6 text-green-500 dark:text-green-400"
      />
      <XCircleIcon v-else-if="shouldShowError" class="h-6 w-6 text-red-500 dark:text-red-400" />
    </div>
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span
          :class="['text-sm', shouldShowError ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400']"
        >
          Статус:
        </span>
        <span
          :class="[
            shouldShowError
              ? 'text-red-600 dark:text-red-400'
              : health?.status === 'OK'
                ? 'text-green-600 dark:text-green-400'
                : health
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-100',
            'font-medium',
          ]"
        >
          {{ health?.status || '—' }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span
          :class="['text-sm', shouldShowError ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400']"
        >
          База данных:
        </span>
        <span
          :class="[
            'font-medium',
            shouldShowError ? 'text-red-800 dark:text-red-200' : 'text-gray-900 dark:text-gray-100',
          ]"
        >
          {{ health?.db_pool || '—' }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span
          :class="['text-sm', shouldShowError ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400']"
        >
          Время работы:
        </span>
        <span
          :class="[
            'font-medium',
            shouldShowError ? 'text-red-800 dark:text-red-200' : 'text-gray-900 dark:text-gray-100',
          ]"
        >
          {{ health?.uptime ? formatUptime(health.uptime) : '—' }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span
          :class="['text-sm', shouldShowError ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400']"
        >
          Время сервера:
        </span>
        <span
          :class="[
            'font-medium',
            shouldShowError ? 'text-red-800 dark:text-red-200' : 'text-gray-900 dark:text-gray-100',
          ]"
        >
          {{ health?.ts ? formatServerTime(health.ts) : '—' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
