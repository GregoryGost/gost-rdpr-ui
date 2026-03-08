<script setup lang="ts">
interface Props {
  title: string
  value: number | string | null
  subtitle?: string
  secondaryValue?: number | string | null
  secondaryLabel?: string
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  color: 'blue',
  loading: false,
})

const colorMap: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  green: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
  purple: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
  orange: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20',
  red: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
  teal: 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-900/20',
}

const valueColorMap: Record<string, string> = {
  blue: 'text-blue-700 dark:text-blue-300',
  green: 'text-green-700 dark:text-green-300',
  purple: 'text-purple-700 dark:text-purple-300',
  orange: 'text-orange-700 dark:text-orange-300',
  red: 'text-red-700 dark:text-red-300',
  teal: 'text-teal-700 dark:text-teal-300',
}

const cardClass = () => colorMap[props.color] ?? colorMap.blue
const valueClass = () => valueColorMap[props.color] ?? valueColorMap.blue
</script>

<template>
  <div :class="['rounded-lg border p-4', cardClass()]">
    <p class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {{ title }}
    </p>
    <div v-if="loading" class="mt-1 h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    <p v-else :class="['text-3xl font-bold', valueClass()]">
      {{ value ?? '—' }}
    </p>
    <p v-if="subtitle" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {{ subtitle }}
    </p>
    <div
      v-if="secondaryLabel !== undefined || secondaryValue !== undefined"
      class="mt-3 border-t border-current/10 pt-2"
    >
      <div v-if="loading" class="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <template v-else>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ secondaryLabel }}
        </p>
        <p :class="['text-xl font-semibold', valueClass()]">
          {{ secondaryValue ?? '—' }}
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped></style>
