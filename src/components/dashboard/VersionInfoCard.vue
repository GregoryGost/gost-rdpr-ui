<script setup lang="ts">
import type { ConfigResponse } from '@/api/types/config'

/**
 * Version info card component
 * @component VersionInfoCard
 */
interface Props {
  config: ConfigResponse | null
}

defineProps<Props>()
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
    <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Информация о версии</h3>
    <div class="space-y-3">
      <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-4">
        <span class="text-sm text-gray-600 dark:text-gray-400">Название:</span>
        <span class="break-words font-medium text-gray-900 md:text-right dark:text-gray-100">
          {{ config?.static.app_title || '—' }}
        </span>
      </div>
      <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-4">
        <span class="text-sm text-gray-600 dark:text-gray-400">Версия:</span>
        <span class="break-words font-medium text-gray-900 md:text-right dark:text-gray-100">
          {{ config?.static.app_version || '—' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
