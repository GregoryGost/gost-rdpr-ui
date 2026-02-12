<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/20/solid'

/**
 * Pagination control component
 * @component PaginationControl
 */
interface Props {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  pageSizeOptions?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => [10, 20, 50, 100],
})

const emit = defineEmits<{
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
}>()

const hasNextPage = computed(() => props.currentPage < props.totalPages)
const hasPrevPage = computed(() => props.currentPage > 1)

const startItem = computed(() => (props.currentPage - 1) * props.pageSize + 1)
const endItem = computed(() => Math.min(props.currentPage * props.pageSize, props.totalItems))

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  const end = Math.min(props.totalPages, start + maxVisible - 1)

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 sm:px-6">
    <div class="flex flex-1 justify-between sm:hidden">
      <button
        @click="emit('update:currentPage', currentPage - 1)"
        :disabled="!hasPrevPage"
        class="relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Предыдущая
      </button>
      <button
        @click="emit('update:currentPage', currentPage + 1)"
        :disabled="!hasNextPage"
        class="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Следующая
      </button>
    </div>
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div class="flex items-center gap-4">
        <p class="text-sm text-gray-700 dark:text-gray-300">
          Показано <span class="font-medium">{{ startItem }}</span> -
          <span class="font-medium">{{ endItem }}</span> из
          <span class="font-medium">{{ totalItems }}</span> результатов
        </p>
        <div class="flex items-center gap-2">
          <label for="pageSize" class="text-sm text-gray-700 dark:text-gray-300">На странице:</label>
          <select
            id="pageSize"
            :value="pageSize"
            @change="emit('update:pageSize', Number(($event.target as HTMLSelectElement).value))"
            class="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option v-for="size in pageSizeOptions" :key="size" :value="size">
              {{ size }}
            </option>
          </select>
        </div>
      </div>
      <nav class="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
        <button
          @click="emit('update:currentPage', currentPage - 1)"
          :disabled="!hasPrevPage"
          class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon class="h-5 w-5" />
        </button>
        <button
          v-for="page in visiblePages"
          :key="page"
          @click="emit('update:currentPage', page)"
          :class="[
            page === currentPage
              ? 'z-10 bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
            'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
          ]"
        >
          {{ page }}
        </button>
        <button
          @click="emit('update:currentPage', currentPage + 1)"
          :disabled="!hasNextPage"
          class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRightIcon class="h-5 w-5" />
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
/* No styles - using Tailwind classes directly */
</style>
