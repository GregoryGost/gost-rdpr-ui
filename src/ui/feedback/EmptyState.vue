<script setup lang="ts">
import { InboxIcon } from '@heroicons/vue/24/outline'

/**
 * Empty state component
 * @component EmptyState
 */
interface Props {
  title?: string
  message?: string
  icon?: any
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Нет данных',
  message: 'Данные отсутствуют или не найдены',
  icon: InboxIcon,
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4">
    <component :is="icon" class="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{{ title }}</h3>
    <p class="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm">{{ message }}</p>
    <slot name="action" />
  </div>
</template>

<style scoped>
</style>
