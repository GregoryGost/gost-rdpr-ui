<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * Data table component
 * @component DataTable
 */
interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
}

interface Props<T> {
  data: T[]
  columns: Column<T>[]
  isLoading?: boolean
  emptyMessage?: string
}

const props = withDefaults(defineProps<Props<T>>(), {
  isLoading: false,
  emptyMessage: 'Нет данных',
})

const emit = defineEmits<{
  rowClick: [row: T]
}>()
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th
            v-for="column in columns"
            :key="String(column.key)"
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
        <tr v-if="isLoading">
          <td :colspan="columns.length" class="px-6 py-4 text-center text-gray-500">
            <div class="flex items-center justify-center">
              <svg class="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Загрузка...
            </div>
          </td>
        </tr>
        <tr v-else-if="data.length === 0">
          <td :colspan="columns.length" class="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
            {{ emptyMessage }}
          </td>
        </tr>
        <tr
          v-else
          v-for="(row, index) in data"
          :key="index"
          @click="emit('rowClick', row)"
          class="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <td
            v-for="column in columns"
            :key="String(column.key)"
            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
          >
            <slot :name="`cell-${String(column.key)}`" :row="row" :value="row[column.key as keyof T]">
              {{ row[column.key as keyof T] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
