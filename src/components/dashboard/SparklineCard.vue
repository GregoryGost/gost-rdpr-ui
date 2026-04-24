<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
const duration = ref<number | null>(null)
const loading = ref(true)
const hasError = ref(false)
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
    duration.value = res.duration ?? null
    lastUpdated.value = new Date()
    hasError.value = false
  } catch {
    hasError.value = true
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

// Reactive clock — ticks every minute so visiblePoints recomputes even when offline
const nowTs = ref(Date.now())
const clockId = setInterval(() => { nowTs.value = Date.now() }, 60_000)
onUnmounted(() => clearInterval(clockId))

// Sliding window: keep only points within the last hour from *now*
const visiblePoints = computed<StatsGrowthPoint[]>(() => {
  if (!points.value.length) return []
  const cutoff = nowTs.value - 60 * 60 * 1000
  return points.value.filter((p) => {
    const t = new Date(p.date.replace(' ', 'T')).getTime()
    return !isNaN(t) && t >= cutoff
  })
})

const chartW = W - PAD.left - PAD.right
const chartH = H - PAD.top - PAD.bottom

const maxVal = computed(() => Math.max(...visiblePoints.value.map((p) => p.count), 1))

const toX = (i: number) => {
  if (visiblePoints.value.length <= 1) return PAD.left + chartW / 2
  return PAD.left + (i / (visiblePoints.value.length - 1)) * chartW
}
const toY = (v: number) => PAD.top + chartH - (v / maxVal.value) * chartH

const polyline = computed(() =>
  visiblePoints.value.map((p, i) => `${toX(i)},${toY(p.count)}`).join(' '),
)

const area = computed(() => {
  if (!visiblePoints.value.length) return ''
  const bottom = PAD.top + chartH
  const line = visiblePoints.value.map((p, i) => `${toX(i)},${toY(p.count)}`).join(' ')
  return `${line} ${toX(visiblePoints.value.length - 1)},${bottom} ${PAD.left},${bottom}`
})

const gradId = computed(() => `spark-grad-${props.entity}`)

const updatedLabel = computed(() => {
  if (!lastUpdated.value) return ''
  const d = lastUpdated.value
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
})

const durationLabel = computed(() => {
  if (duration.value === null) return null
  const ms = duration.value * 1000
  if (ms < 1) return `${(ms * 1000).toFixed(0)} мкс`
  if (ms < 1000) return `${ms.toFixed(1)} мс`
  return `${(ms / 1000).toFixed(2)} с`
})

const isLive = computed(() => selectedInterval.value > 0)

// immediate: true — polling starts on mount automatically;
// initial data is fetched separately via onMounted to avoid the first
// interval tick being the only load.
const { updateInterval } = usePolling(load, { interval: props.refreshInterval, immediate: true })

const onIntervalChange = () => {
  updateInterval(selectedInterval.value)
}

onMounted(load)
</script>

<template>
  <div
    :class="[
      'rounded-lg border p-3 transition-colors',
      hasError
        ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    ]"
  >
    <!-- Header -->
    <div class="mb-1 flex items-center justify-between">
      <p
        :class="[
          'text-xs font-semibold uppercase tracking-wide',
          hasError ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400',
        ]"
      >
        {{ label }}
      </p>
      <div class="flex items-center gap-1.5">
        <!-- Error badge -->
        <span
          v-if="hasError"
          class="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-900/50 dark:text-orange-400"
        >
          ⚠ offline
        </span>
        <!-- Trend badge -->
        <span
          v-else-if="!loading && points.length"
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
        <!-- Live / paused indicator dot -->
        <span class="relative flex size-2">
          <span
            v-if="isLive && !hasError"
            class="absolute inline-flex size-full animate-ping rounded-full opacity-75"
            :style="{ backgroundColor: color }"
          />
          <span
            class="relative inline-flex size-2 rounded-full"
            :style="{ backgroundColor: hasError ? '#f97316' : isLive ? color : '#6b7280' }"
          />
        </span>
      </div>
    </div>

    <!-- Total -->
    <div v-if="loading" class="mb-2 h-6 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    <p
      v-else
      :class="['mb-1 text-2xl font-bold', hasError ? 'text-orange-500 dark:text-orange-400' : '']"
      :style="hasError ? undefined : { color }"
    >
      {{ total.toLocaleString() }}
    </p>

    <!-- Sparkline -->
    <div class="h-16 w-full overflow-hidden rounded">
      <div v-if="loading" class="h-full animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      <div
        v-else-if="hasError && !visiblePoints.length"
        class="flex h-full flex-col items-center justify-center gap-1 rounded border border-orange-200 text-xs text-orange-500 dark:border-orange-800 dark:text-orange-400"
      >
        <span class="text-base">⚡</span>
        <span>сервер недоступен</span>
      </div>
      <svg
        v-else-if="visiblePoints.length"
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
        <p
          :class="[
            'text-xs',
            hasError ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500',
          ]"
        >
          {{ hasError ? 'повтор через:' : 'обновление:' }}
        </p>
        <select
          v-model.number="selectedInterval"
          :class="[
            'rounded border py-0 pl-1 pr-5 text-xs focus:outline-none',
            hasError
              ? 'border-orange-300 bg-transparent text-orange-500 focus:border-orange-400 dark:border-orange-700 dark:text-orange-400'
              : 'border-gray-200 bg-transparent text-gray-500 focus:border-gray-400 dark:border-gray-600 dark:text-gray-400',
          ]"
          @change="onIntervalChange"
        >
          <option v-for="opt in INTERVAL_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div v-if="updatedLabel && !hasError" class="flex shrink-0 items-center gap-1.5">
        <span
          v-if="durationLabel"
          class="rounded bg-gray-100 px-1 py-0.5 text-xs tabular-nums text-gray-400 dark:bg-gray-700 dark:text-gray-500"
          :title="'Время вычисления ответа'"
        >
          {{ durationLabel }}
        </span>
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ updatedLabel }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
