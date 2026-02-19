<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { statsApi } from '@/api/endpoints/stats'
import { usePolling } from '@/composables/usePolling'
import type { GrowthEntity, GrowthDateField, StatsGrowthPoint } from '@/api/types/stats'

interface Props {
  entity: GrowthEntity
  label: string
  color: string
  dateField?: GrowthDateField
  refreshInterval?: number
}

const props = withDefaults(defineProps<Props>(), {
  dateField: 'updated_at',
  refreshInterval: 60_000,
})

const INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 10_000, label: '10 с' },
  { value: 30_000, label: '30 с' },
  { value: 60_000, label: '1 мин' },
  { value: 300_000, label: '5 мин' },
  { value: 600_000, label: '10 мин' },
  { value: 0, label: 'Выкл' },
]

const W = 280
const H = 64
const PAD = { top: 4, right: 4, bottom: 4, left: 4 }

const points = ref<StatsGrowthPoint[]>([])
const total = ref(0)
const loading = ref(true)
const lastUpdated = ref<Date | null>(null)
const selectedInterval = ref(props.refreshInterval)

function formatApiDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const load = async () => {
  try {
    const now = new Date()
    const from = new Date(now.getTime() - 60 * 60 * 1000)
    const res = await statsApi.getGrowth({
      entity: props.entity,
      granularity: 'minute',
      start_date: formatApiDate(from),
      end_date: formatApiDate(now),
      date_filter_field: props.dateField,
    })
    points.value = res.payload
    total.value = res.total_in_period
    lastUpdated.value = new Date()
  } catch {
    /* silent — card shows last known data */
  } finally {
    loading.value = false
  }
}

const trend = computed<number>(() => {
  if (points.value.length < 4) return 0
  const half = Math.floor(points.value.length / 2)
  const first = points.value.slice(0, half).reduce((s, p) => s + p.count, 0)
  const second = points.value.slice(half).reduce((s, p) => s + p.count, 0)
  if (first === 0) return second > 0 ? 100 : 0
  return Math.round(((second - first) / first) * 100)
})

const chartW = W - PAD.left - PAD.right
const chartH = H - PAD.top - PAD.bottom

const maxVal = computed(() => Math.max(...points.value.map((p) => p.count), 1))

const toX = (i: number) => {
  if (points.value.length <= 1) return PAD.left + chartW / 2
  return PAD.left + (i / (points.value.length - 1)) * chartW
}
const toY = (v: number) => PAD.top + chartH - (v / maxVal.value) * chartH

const polyline = computed(() =>
  points.value.map((p, i) => `${toX(i)},${toY(p.count)}`).join(' '),
)

const area = computed(() => {
  if (!points.value.length) return ''
  const bottom = PAD.top + chartH
  const line = points.value.map((p, i) => `${toX(i)},${toY(p.count)}`).join(' ')
  return `${line} ${toX(points.value.length - 1)},${bottom} ${PAD.left},${bottom}`
})

const gradId = computed(() => `spark-grad-${props.entity}`)

const updatedLabel = computed(() => {
  if (!lastUpdated.value) return ''
  const d = lastUpdated.value
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
})

const isLive = computed(() => selectedInterval.value > 0)

const { updateInterval } = usePolling(load, { interval: props.refreshInterval, immediate: false })

const onIntervalChange = () => {
  updateInterval(selectedInterval.value)
}

onMounted(load)
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
    <!-- Header -->
    <div class="mb-1 flex items-center justify-between">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ label }}
      </p>
      <div class="flex items-center gap-1.5">
        <!-- Trend badge -->
        <span
          v-if="!loading && points.length"
          :class="[
            'rounded px-1.5 py-0.5 text-xs font-semibold',
            trend > 0
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
              : trend < 0
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
          ]"
        >
          {{ trend > 0 ? '↑' : trend < 0 ? '↓' : '—' }}{{ trend !== 0 ? Math.abs(trend) + '%' : '' }}
        </span>
        <!-- Live / paused indicator -->
        <span class="relative flex size-2">
          <span
            v-if="isLive"
            class="absolute inline-flex size-full animate-ping rounded-full opacity-75"
            :style="{ backgroundColor: color }"
          />
          <span
            class="relative inline-flex size-2 rounded-full"
            :style="{ backgroundColor: isLive ? color : '#6b7280' }"
          />
        </span>
      </div>
    </div>

    <!-- Total -->
    <div v-if="loading" class="mb-2 h-6 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    <p v-else class="mb-1 text-2xl font-bold" :style="{ color }">
      {{ total.toLocaleString() }}
    </p>

    <!-- Sparkline -->
    <div class="h-16 w-full overflow-hidden rounded">
      <div v-if="loading" class="h-full animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      <svg
        v-else-if="points.length"
        :viewBox="`0 0 ${W} ${H}`"
        class="h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
            <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <polygon :points="area" :fill="`url(#${gradId})`" />
        <polyline
          :points="polyline"
          fill="none"
          :stroke="color"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
      <div
        v-else
        class="flex h-full items-center justify-center text-xs text-gray-400 dark:text-gray-500"
      >
        нет данных
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-2 flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5">
        <p class="text-xs text-gray-400 dark:text-gray-500">обновление:</p>
        <select
          v-model.number="selectedInterval"
          class="rounded border border-gray-200 bg-transparent py-0 pl-1 pr-5 text-xs text-gray-500 focus:border-gray-400 focus:outline-none dark:border-gray-600 dark:text-gray-400"
          @change="onIntervalChange"
        >
          <option v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <p v-if="updatedLabel" class="shrink-0 text-xs text-gray-400 dark:text-gray-500">
        {{ updatedLabel }}
      </p>
    </div>
  </div>
</template>

<style scoped></style>
