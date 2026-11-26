<script setup lang="ts">
import { computed, ref } from 'vue'
import ActivityChart, { type ActivitySeriesStyle } from '@/components/charts/ActivityChart.vue'
import { useActivityMetrics } from '@/composables/useActivityMetrics'
import { STATS_TEXTS } from '@/constants'
import type { RunField, RunMode } from '@/utils/activityMetrics'

// interval sets the common request rate, history contains the last hour, runs contains the newest gauges,
// clock anchors the viewing window, since identifies the start of collection, and loading and failed report request state.
const { interval, history, runs, clock, since, loading, failed } = useActivityMetrics()

/** period selects how many minutes to render, leaving the request cadence and retained history alone. */
const period = ref(60)

/** Supported polling delays in milliseconds with Russian labels for the selector. */
const intervals = [
  { value: 2_000, label: '2 секунды' },
  { value: 3_000, label: '3 секунды' },
  { value: 5_000, label: '5 секунд' },
  { value: 10_000, label: '10 секунд' },
  { value: 30_000, label: '30 секунд' },
  { value: 60_000, label: '60 секунд' },
]

/** Viewing windows in minutes, independent of the chosen polling delay. */
const periods = [5, 15, 60]

/** The callback computes the start of the chosen period in Unix milliseconds. */
const start = computed(() => clock.value - period.value * 60_000)
/** The computed callback derives the visible window. Its filter keeps each point within both bounds. */
const visiblePoints = computed(() =>
  history.value.filter((point) => point.time >= start.value && point.time <= clock.value),
)

/** Formats the first successful sample for a partially covered period. */
const coverageFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Chart definitions arrange rates, DNS latency and SQLite writer residence time in that order. */
const charts = [
  {
    title: STATS_TEXTS.ACTIVITY_RESOLUTION,
    unit: STATS_TEXTS.ACTIVITY_PER_MINUTE,
    series: [
      { key: 'success', label: STATS_TEXTS.ACTIVITY_SUCCESS, stroke: 'stroke-green-700 dark:stroke-green-400' },
      {
        key: 'partial',
        label: STATS_TEXTS.ACTIVITY_PARTIAL,
        stroke: 'stroke-amber-700 dark:stroke-amber-400',
        dash: '7 4',
      },
      {
        key: 'failure',
        label: STATS_TEXTS.ACTIVITY_FAILURE,
        stroke: 'stroke-red-700 dark:stroke-red-400',
        dash: '2 4',
      },
    ],
  },
  {
    title: STATS_TEXTS.ACTIVITY_DNS,
    unit: STATS_TEXTS.ACTIVITY_MS,
    series: [
      { key: 'classicDns', label: STATS_TEXTS.ACTIVITY_CLASSIC_DNS, stroke: 'stroke-blue-700 dark:stroke-blue-400' },
      { key: 'doh', label: STATS_TEXTS.ACTIVITY_DOH, stroke: 'stroke-teal-700 dark:stroke-teal-400', dash: '7 4' },
    ],
  },
  {
    title: STATS_TEXTS.ACTIVITY_WRITER,
    unit: STATS_TEXTS.ACTIVITY_MS,
    series: [
      { key: 'writerWait', label: STATS_TEXTS.ACTIVITY_MEAN, stroke: 'stroke-indigo-700 dark:stroke-indigo-400' },
    ],
  },
] satisfies { title: string; unit: string; series: ActivitySeriesStyle[] }[]

/** The gauges in each backend mode are presented together under the mode's Russian label. */
const modes: { key: RunMode; label: string }[] = [
  { key: 'new', label: STATS_TEXTS.ACTIVITY_RUN_NEW },
  { key: 'stale', label: STATS_TEXTS.ACTIVITY_RUN_STALE },
  { key: 'stored', label: STATS_TEXTS.ACTIVITY_RUN_STORED },
]

/** These fields describe the latest observed run without making assumptions about missing values. */
const fields: { key: RunField; label: string }[] = [
  { key: 'selected', label: STATS_TEXTS.ACTIVITY_RUN_SELECTED },
  { key: 'attempted', label: STATS_TEXTS.ACTIVITY_RUN_ATTEMPTED },
  { key: 'confirmed', label: STATS_TEXTS.ACTIVITY_RUN_CONFIRMED },
  { key: 'pending', label: STATS_TEXTS.ACTIVITY_RUN_PENDING },
]
</script>

<template>
  <section aria-labelledby="metrics-activity-heading" class="mt-10">
    <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h2 id="metrics-activity-heading" class="m-0 text-xl font-semibold text-gray-800 dark:text-gray-200">
        {{ STATS_TEXTS.ACTIVITY_TITLE }}
      </h2>
      <div class="flex flex-wrap gap-3">
        <label class="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          {{ STATS_TEXTS.ACTIVITY_INTERVAL }}
          <select
            v-model.number="interval"
            class="min-h-9 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:outline-indigo-400"
          >
            <!-- option is an allowed delay and its user-facing label. -->
            <option v-for="option in intervals" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          {{ STATS_TEXTS.ACTIVITY_PERIOD }}
          <select
            v-model.number="period"
            class="min-h-9 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:outline-indigo-400"
          >
            <!-- minutes is both the value and the number shown in each period option. -->
            <option v-for="minutes in periods" :key="minutes" :value="minutes">{{ minutes }} минут</option>
          </select>
        </label>
      </div>
    </div>

    <div class="mb-3 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <div role="status">
        <p v-if="loading" class="text-gray-600 dark:text-gray-400">{{ STATS_TEXTS.ACTIVITY_LOADING }}</p>
        <p v-else-if="failed" class="text-amber-800 dark:text-amber-300">{{ STATS_TEXTS.ACTIVITY_ERROR }}</p>
      </div>
      <p v-if="since !== null && since > start" class="text-gray-600 dark:text-gray-400">
        {{ STATS_TEXTS.ACTIVITY_COVERAGE }}
        <time :datetime="new Date(since).toISOString()">{{ coverageFormat.format(since) }}</time>
      </p>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <!-- chart selects one unit and set of series. All charts share the visible points and time window. -->
      <ActivityChart
        v-for="chart in charts"
        :key="chart.title"
        :title="chart.title"
        :unit="chart.unit"
        :series="chart.series"
        :points="visiblePoints"
        :start="start"
        :end="clock"
      />
    </div>

    <article class="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">{{ STATS_TEXTS.ACTIVITY_RUNS }}</h3>
      <div class="grid gap-4 sm:grid-cols-3">
        <!-- mode identifies one latest run. Each field in its list is read independently from that run's gauges. -->
        <div v-for="mode in modes" :key="mode.key" class="min-w-0">
          <h4 class="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ mode.label }}</h4>
          <dl v-if="runs[mode.key]" class="space-y-1 text-sm">
            <div v-for="field in fields" :key="field.key" class="flex justify-between gap-2">
              <dt class="text-gray-600 dark:text-gray-400">{{ field.label }}</dt>
              <dd class="font-medium text-gray-900 tabular-nums dark:text-gray-100">
                {{ runs[mode.key]?.[field.key]?.toLocaleString('ru-RU') ?? '—' }}
              </dd>
            </div>
          </dl>
          <p v-else class="text-sm text-gray-600 dark:text-gray-400">{{ STATS_TEXTS.ACTIVITY_NO_RUN }}</p>
        </div>
      </div>
    </article>
  </section>
</template>
