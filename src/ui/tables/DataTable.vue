<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * Data table component with sortable columns
 * @component DataTable
 */
import { ref, computed } from 'vue'

type SortDirection = 'asc' | 'desc' | null
type SortType = 'default' | 'ip'

interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  sortType?: SortType
}

const isIPv4 = (s: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(s)
const isIPv6 = (s: string): boolean => s.includes(':')

const expandIPv6 = (ip: string): string => {
  const halves = ip.split('::')
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves.length > 1 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - left.length - right.length
  return [...left, ...Array(missing).fill('0'), ...right].map((g) => g.padStart(4, '0')).join(':')
}

const compareIp = (a: string, b: string): number => {
  const aIsV4 = isIPv4(a)
  const bIsV4 = isIPv4(b)
  if (aIsV4 !== bIsV4) return aIsV4 ? -1 : 1
  if (aIsV4 && bIsV4) {
    const aParts = a.split('.').map(Number)
    const bParts = b.split('.').map(Number)
    for (let i = 0; i < 4; i++) {
      const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0)
      if (diff !== 0) return diff
    }
    return 0
  }
  if (isIPv6(a) && isIPv6(b)) {
    const aExp = expandIPv6(a)
    const bExp = expandIPv6(b)
    return aExp.localeCompare(bExp)
  }
  return a.localeCompare(b)
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
  sort: [key: string, direction: SortDirection]
}>()

const sortKey = ref<string | null>(null)
const sortDirection = ref<SortDirection>(null)

const toggleSort = (column: Column<T>) => {
  if (!column.sortable) return
  const key = String(column.key)
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDirection.value = 'asc'
  } else if (sortDirection.value === 'asc') {
    sortDirection.value = 'desc'
  } else if (sortDirection.value === 'desc') {
    sortKey.value = null
    sortDirection.value = null
  }
  emit('sort', sortKey.value ?? key, sortDirection.value)
}

const sortedData = computed(() => {
  if (!sortKey.value || !sortDirection.value) return props.data
  const column = props.columns.find((c) => String(c.key) === sortKey.value)
  return [...props.data].sort((a, b) => {
    const aVal = a[sortKey.value!]
    const bVal = b[sortKey.value!]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    if (column?.sortType === 'ip') {
      const result = compareIp(String(aVal), String(bVal))
      return sortDirection.value === 'asc' ? result : -result
    }
    if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
      const result = aVal === bVal ? 0 : aVal ? -1 : 1
      return sortDirection.value === 'asc' ? result : -result
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection.value === 'asc' ? aVal - bVal : bVal - aVal
    }
    const result = String(aVal).localeCompare(String(bVal), 'ru', { sensitivity: 'base' })
    return sortDirection.value === 'asc' ? result : -result
  })
})
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th
            v-for="column in columns"
            :key="String(column.key)"
            class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
          >
            <button
              v-if="column.sortable"
              type="button"
              class="inline-flex items-center gap-1 select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              :aria-sort="sortKey === String(column.key) ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
              @click="toggleSort(column)"
            >
              {{ column.label }}
              <span class="inline-flex flex-col">
                <svg
                  viewBox="0 0 10 6"
                  class="h-2 w-2 transition-opacity"
                  :class="sortKey === String(column.key) && sortDirection === 'asc' ? 'opacity-100 text-blue-500' : 'opacity-30'"
                  fill="currentColor"
                >
                  <path d="M5 0L10 6H0z" />
                </svg>
                <svg
                  viewBox="0 0 10 6"
                  class="h-2 w-2 transition-opacity"
                  :class="sortKey === String(column.key) && sortDirection === 'desc' ? 'opacity-100 text-blue-500' : 'opacity-30'"
                  fill="currentColor"
                >
                  <path d="M5 6L0 0H10z" />
                </svg>
              </span>
            </button>
            <span v-else>{{ column.label }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
        <tr v-if="isLoading">
          <td :colspan="columns.length" class="px-6 py-4 text-center text-gray-500">
            <div class="flex items-center justify-center">
              <svg class="mr-3 h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
          v-for="(row, index) in sortedData"
          :key="index"
          @click="emit('rowClick', row)"
          class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <td
            v-for="column in columns"
            :key="String(column.key)"
            class="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
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

<style scoped></style>
