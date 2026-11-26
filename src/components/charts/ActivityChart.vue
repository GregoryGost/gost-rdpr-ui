<script lang="ts">
import type { ActivityPoint, ActivityValues } from '@/utils/activityMetrics'

/** Describes the visual and textual representation of one aggregate. */
export interface ActivitySeriesStyle {
  /** Key of the numeric field rendered from each point. */
  key: keyof ActivityValues
  /** Series name that appears in the legend. */
  label: string
  /** Tailwind stroke tokens for light and dark themes. */
  stroke: string
  /** Optional SVG line pattern used in both the graph and the legend. */
  dash?: string
}
/** Plot data and bounds selected by the activity section. */
export interface ActivityChartProps {
  /** Visible graph title and accessible name. */
  title: string
  /** Unit shared by all plotted series. */
  unit: string
  /** Ordered points inside the visible window, with null values marking missing intervals. */
  points: readonly ActivityPoint[]
  /** start and end are the visible window bounds in Unix milliseconds. */
  start: number
  end: number
  /** Named series and styling in legend order. */
  series: readonly ActivitySeriesStyle[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { STATS_TEXTS } from '@/constants'

/** Receives the same time window as the other activity charts. */
const props = defineProps<ActivityChartProps>()

/** width and height define the coordinate space of the SVG, whose rendered size follows the card. */
const width = 360
const height = 120

/** valueFormat keeps rates and durations readable, including fractional measurements. */
const valueFormat = new Intl.NumberFormat('ru-RU', { maximumSignificantDigits: 4 })
/** timeFormat shows seconds so users can read the scale at short polling intervals. */
const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The callback finds the maximum value across all series at every visible point, using one for an empty scale. */
const scaleMax = computed(() => {
  /** max starts at zero because all displayed rates and durations are nonnegative. */
  let max = 0
  // point supplies the values at one time and series selects the fields used by this chart.
  for (const point of props.points) {
    for (const series of props.series) {
      max = Math.max(max, point.values[series.key] ?? 0)
    }
  }
  return max || 1
})

/**
 * Scales each sample by its elapsed time from the left edge. Null samples end the current
 * SVG subpath so the next value starts a disconnected line. A round cap marks isolated points.
 */
function seriesPath(key: keyof ActivityValues): string {
  // commands accumulates the SVG path and connected tracks whether the previous sample can be joined.
  const commands: string[] = []
  let connected = false

  // point contains one timestamp and a value or a gap for the requested key.
  for (const point of props.points) {
    /** value is the plotted rate or duration, with null leaving empty space at that time. */
    const value = point.values[key]
    if (value === null) {
      connected = false
      continue
    }

    // x reflects the actual time within the period. y shares a common scale across all series in this chart.
    const x = Math.round(((point.time - props.start) / (props.end - props.start)) * width * 100) / 100
    const y = Math.round((1 - value / scaleMax.value) * height * 100) / 100
    if (connected) commands.push('L' + x + ',' + y)
    else commands.push('M' + x + ',' + y + 'h0')
    connected = true
  }

  return commands.join(' ')
}

/**
 * The callback builds each series' path and pairs it with the newest visible value.
 * The map callback leaves the value empty if the latest interval was a gap.
 */
const plots = computed(() =>
  props.series.map((series) => ({
    ...series,
    path: seriesPath(series.key),
    value: props.points.at(-1)?.values[series.key] ?? null,
  })),
)

/** The computed callback checks for visible data. The predicate tests each plot for a nonempty path. */
const hasData = computed(() => plots.value.some((plot) => plot.path !== ''))
</script>

<template>
  <article
    :aria-label="title"
    class="min-w-0 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
  >
    <h3 class="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
    <p class="mb-4 text-xs text-gray-600 dark:text-gray-400">{{ unit }}</p>

    <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <div
        aria-hidden="true"
        class="flex flex-col justify-between text-xs text-gray-600 tabular-nums dark:text-gray-400"
      >
        <span>{{ valueFormat.format(scaleMax) }}</span>
        <span>{{ valueFormat.format(scaleMax / 2) }}</span>
        <span>0</span>
      </div>
      <div class="relative min-w-0">
        <svg
          :viewBox="'0 0 ' + width + ' ' + height"
          preserveAspectRatio="none"
          role="img"
          :aria-label="title"
          class="h-28 w-full overflow-visible"
        >
          <path
            d="M0 0H360 M0 60H360 M0 120H360 M0 0V120"
            fill="none"
            class="stroke-gray-200 dark:stroke-gray-600"
            vector-effect="non-scaling-stroke"
          />
          <!-- plot holds one SVG path and the style for its corresponding legend entry. -->
          <path
            v-for="plot in plots"
            :key="plot.key"
            :d="plot.path"
            :class="plot.stroke"
            :stroke-dasharray="plot.dash"
            fill="none"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <p
          v-if="!hasData"
          class="pointer-events-none absolute inset-0 grid place-items-center text-center text-xs text-gray-600 dark:text-gray-400"
        >
          {{ STATS_TEXTS.ACTIVITY_NO_POINTS }}
        </p>
      </div>
      <div class="col-start-2 mt-2 flex justify-between gap-2 text-xs text-gray-600 tabular-nums dark:text-gray-400">
        <time :datetime="new Date(start).toISOString()">{{ timeFormat.format(start) }}</time>
        <time :datetime="new Date(end).toISOString()">{{ timeFormat.format(end) }}</time>
      </div>
    </div>

    <dl class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
      <!-- plot supplies the visual key, series name and latest value shown in this legend entry. -->
      <div v-for="plot in plots" :key="plot.key" class="flex items-baseline gap-1.5">
        <dt class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <svg viewBox="0 0 20 6" aria-hidden="true" class="h-2 w-5">
            <path d="M0 3H20" :class="plot.stroke" :stroke-dasharray="plot.dash" fill="none" stroke-width="2" />
          </svg>
          {{ plot.label }}
        </dt>
        <dd class="font-medium text-gray-900 tabular-nums dark:text-gray-100">
          {{ plot.value === null ? '—' : valueFormat.format(plot.value) }}
        </dd>
      </div>
    </dl>
  </article>
</template>
