<script setup lang="ts">
import { computed } from 'vue'
import PieChart from '@/components/charts/PieChart.vue'
import type { PieSlice } from '@/components/charts/PieChart.vue'

interface Props {
  title: string
  slices: PieSlice[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const total = computed(() => props.slices.reduce((s, sl) => s + sl.value, 0))
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
    <p class="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {{ title }}
    </p>

    <div v-if="loading" class="flex items-center justify-center gap-4">
      <div class="h-40 w-40 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
      <div class="flex-1 space-y-2">
        <div v-for="n in 2" :key="n" class="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>

    <div v-else class="flex items-center gap-4">
      <div class="shrink-0">
        <PieChart :slices="slices" :size="140" :outer-radius="62" :inner-radius="40" />
      </div>

      <div class="min-w-0 flex-1 space-y-1.5">
        <div
          v-for="sl in slices"
          :key="sl.label"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: sl.color }" />
            <span class="truncate text-gray-700 dark:text-gray-300">{{ sl.label }}</span>
          </div>
          <span class="shrink-0 font-semibold text-gray-900 dark:text-gray-100">{{ sl.value }}</span>
        </div>

        <div class="mt-2 border-t border-gray-100 pt-2 dark:border-gray-700">
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Итого</span>
            <span class="font-bold text-gray-800 dark:text-gray-200">{{ total }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
