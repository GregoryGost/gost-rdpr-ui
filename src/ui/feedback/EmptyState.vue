<script setup lang="ts">
import type { Component } from 'vue'
import { InboxIcon } from '@heroicons/vue/24/outline'

/**
 * Empty state component
 * @component EmptyState
 */
interface Props {
  title?: string
  message?: string
  icon?: Component
}

withDefaults(defineProps<Props>(), {
  title: 'Нет данных',
  message: 'Данные отсутствуют или не найдены',
  icon: InboxIcon,
})
</script>

<template>
  <div class="flex flex-col items-center justify-center px-4 py-12">
    <component :is="icon" class="mb-4 h-12 w-12 text-gray-400 dark:text-gray-600" />
    <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">{{ title }}</h3>
    <p class="max-w-sm text-center text-sm text-gray-600 dark:text-gray-400">{{ message }}</p>
    <slot name="action" />
  </div>
</template>

<style scoped></style>
