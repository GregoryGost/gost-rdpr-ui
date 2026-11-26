import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { statsApi } from '@/api/endpoints/stats'
import { usePolling } from '@/composables/usePolling'
import {
  calculateActivityMetrics,
  EMPTY_ACTIVITY_VALUES,
  parseActivityMetrics,
  type ActivityPoint,
  type ActivitySnapshot,
  type RunSnapshots,
} from '@/utils/activityMetrics'

/** Default scrape interval in milliseconds, used each time the statistics page opens. */
const DEFAULT_INTERVAL = 3_000

/** Keep one hour of plot points regardless of the selected viewing period. */
const HISTORY_MS = 60 * 60_000

/**
 * Owns a single scrape and its history for the lifetime of the activity section.
 * The initial request and all timer ticks share an in-flight guard. Failure or an excessive
 * interval establishes a break, and the next success becomes the new baseline.
 */
export function useActivityMetrics() {
  /** interval is the delay selected by the user in milliseconds. */
  const interval = ref(DEFAULT_INTERVAL)
  /** history keeps only the plot values needed to draw the last hour. */
  const history = shallowRef<ActivityPoint[]>([])
  /** runs holds the newest gauges, available even when a second scrape is still needed for the charts. */
  const runs = shallowRef<RunSnapshots>({})
  /** clock is the most recent completed poll time in Unix milliseconds and anchors the viewing window. */
  const clock = ref(Date.now())
  /** since records the first successful poll of the current timeline so partial windows can show their coverage. */
  const since = ref<number | null>(null)
  /** loading is true until the first scrape completes, including an unsuccessful first attempt. */
  const loading = ref(true)
  /** failed indicates whether the most recent poll ended without a valid scrape. */
  const failed = ref(false)
  /** previous pairs the cumulative snapshot with its wall-clock time and monotonic measuredAt, both in milliseconds. */
  let previous: { time: number; measuredAt: number; snapshot: ActivitySnapshot } | null = null
  /** pending prevents overlap with the initial load and provides cancellation when the section unmounts. */
  let pending: AbortController | null = null
  /** disposed prevents a scheduled invocation from starting new work after the section unmounts. */
  let disposed = false

  /**
   * Reads the time used on the x-axis. If the wall clock moves backwards, start a new
   * timeline so old points cannot reappear later in reverse order.
   */
  function readPlotTime(): number {
    /** time is the current wall clock in Unix milliseconds. */
    const time = Date.now()
    if (time < clock.value) {
      previous = null
      since.value = null
      history.value = []
    }
    return time
  }

  /** Advances the viewing window and discards points older than one hour relative to this sample. */
  function record(point: ActivityPoint) {
    clock.value = point.time
    /** cutoff is the earliest timestamp still needed by any of the supported periods. */
    const cutoff = point.time - HISTORY_MS
    /** The filter callback retains oldPoint only while its timestamp is within the supported hour. */
    history.value = [...history.value.filter((oldPoint) => oldPoint.time >= cutoff), point]
  }

  /**
   * Collects a complete scrape, publishes run gauges and records chart values or a gap.
   * Local cancellation must leave no points or failure state in an unmounted section.
   */
  async function collect() {
    if (disposed || pending) return
    /** request identifies this invocation so disposal can abort it while awaiting the body. */
    const request = new AbortController()
    pending = request

    try {
      /** text is the body of this scrape, read to completion before recording a timestamp. */
      const text = await statsApi.getMetrics(request.signal)
      if (disposed) return
      /** snapshot supplies the current cumulative values and latest run gauges. */
      const snapshot = parseActivityMetrics(text)
      // time is the wall-clock position on the chart. measuredAt is monotonic time in milliseconds.
      const time = readPlotTime()
      const measuredAt = performance.now()
      // elapsed is the real duration since the baseline. gapLimit is the maximum comparable interval.
      const elapsed = previous ? measuredAt - previous.measuredAt : 0
      const gapLimit = interval.value * 2
      /** values also break across a wall-clock jump or suspension that exceeds the visible gap limit. */
      const values =
        previous && elapsed <= gapLimit && time - previous.time <= gapLimit
          ? calculateActivityMetrics(previous.snapshot, snapshot, elapsed)
          : EMPTY_ACTIVITY_VALUES

      previous = { time, measuredAt, snapshot }
      since.value ??= time
      runs.value = snapshot.runs
      failed.value = false
      record({ time, values })
    } catch {
      if (disposed) return
      previous = null
      failed.value = true
      record({ time: readPlotTime(), values: EMPTY_ACTIVITY_VALUES })
    } finally {
      pending = null
      if (!disposed) loading.value = false
    }
  }

  /** polling runs ticks for this section only, starting after its mounted initial request begins. */
  const polling = usePolling(collect, { interval: DEFAULT_INTERVAL, immediate: false })
  watch(interval, polling.updateInterval)

  /** Starts the first scrape immediately and schedules the next tick using the same guard. */
  onMounted(() => {
    void collect()
    polling.start()
  })

  /** Prevents late writes and aborts a pending request. usePolling separately clears its timer. */
  onUnmounted(() => {
    disposed = true
    pending?.abort()
  })

  return { interval, history, runs, clock, since, loading, failed }
}
