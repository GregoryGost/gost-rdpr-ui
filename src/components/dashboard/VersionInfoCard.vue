<script setup lang="ts">
/**
 * Version info card component
 * @component VersionInfoCard
 */
interface ConfigData {
  static: {
    app_version: string
    app_title: string
  }
}

interface Props {
  config: ConfigData | null
}

defineProps<Props>()
</script>

<template>
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
</template>

<style scoped>
</style>
