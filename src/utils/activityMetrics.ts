/** Resolving outcomes are rates per minute, while DNS and writer samples are durations in milliseconds. */
export interface ActivityValues {
  /** Successful resolution outcomes per minute. */
  success: number | null
  /** Partial resolution outcomes per minute. */
  partial: number | null
  /** Failed resolution outcomes per minute. */
  failure: number | null
  /** Mean duration of a classic DNS observation. */
  classicDns: number | null
  /** Mean duration of a DNS-over-HTTPS observation. */
  doh: number | null
  /** Mean time from admission to removal from the SQLite writer queue. */
  writerWait: number | null
}

/** A plotted sample uses the wall-clock time at which the scrape finished, including samples that mark a gap. */
export interface ActivityPoint {
  /** Completion time in Unix milliseconds. */
  time: number
  /** Numeric values or gaps for each chart series. */
  values: ActivityValues
}

/** Backend identifiers for the latest run in each resolving mode. */
export type RunMode = 'new' | 'stale' | 'stored'

/** Public snapshot fields displayed for a started run. */
export type RunField = 'selected' | 'attempted' | 'confirmed' | 'pending'

/** Each present mode has at least one finite count from its latest run. */
export type RunSnapshots = Partial<Record<RunMode, Partial<Record<RunField, number>>>>

/** Chart keys that select one rate or duration aggregate. */
type Series = keyof ActivityValues

/** Cumulative values for a single metric and exact set of labels. */
interface Sample {
  /** Event counter or summed histogram duration in seconds. */
  total?: number
  /** Number of histogram observations paired with the sum. */
  count?: number
}

/** A complete scrape retains the constituent series needed to compare consecutive counters. */
export interface ActivitySnapshot {
  /** Original cumulative values grouped by chart series and indexed by canonical label set. */
  series: Record<Series, Map<string, Sample>>
  /** Gauges for display independently of whether two comparable scrapes exist. */
  runs: RunSnapshots
  /** Optional process startup timestamp in seconds. Its change can reveal a restart before counters decrease. */
  processStart?: number
}

/** Reused for scrapes that establish a baseline and for poll failures. */
export const EMPTY_ACTIVITY_VALUES: ActivityValues = {
  success: null,
  partial: null,
  failure: null,
  classicDns: null,
  doh: null,
  writerWait: null,
}

/** Matches the sample name, raw labels and value. Sample timestamps and exemplars are irrelevant to this view. */
const SAMPLE_LINE = /^([A-Za-z_:][\w:]*)(?:\{((?:[^"{}]|"(?:[^"\\]|\\.)*")*)\})?[ \t]+([^ \t]+)(?:[ \t]+.*)?$/

/** Reads names and quoted values without treating commas, quotes or braces inside values as delimiters. */
const LABEL = /([A-Za-z_]\w*)="((?:[^"\\]|\\.)*)"/g

/** Only finite decimal and scientific-notation numbers can contribute to the calculations. */
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Extracts the resolution series from a complete OpenMetrics scrape. The EOF marker distinguishes a complete
 * snapshot from an interrupted response or an HTML fallback. Non-finite counters remain invalid samples so
 * they cannot be confused with zero. A run with no valid field is absent from the display.
 */
export function parseActivityMetrics(text: string): ActivitySnapshot {
  /** lines are the exposition records. The final one must be the OpenMetrics completion marker. */
  const lines = text.trimEnd().split(/\r?\n/)
  if (lines.pop() !== '# EOF') throw new Error('Incomplete OpenMetrics response')

  /** snapshot contains only the requested metric families and optional process identity. */
  const snapshot: ActivitySnapshot = {
    series: {
      success: new Map(),
      partial: new Map(),
      failure: new Map(),
      classicDns: new Map(),
      doh: new Map(),
      writerWait: new Map(),
    },
    runs: {},
  }

  // line holds a complete sample or metadata record from this scrape.
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    /** match separates the name, labels and sample value. Other lines do not supply a usable sample. */
    const match = SAMPLE_LINE.exec(line)
    if (!match) continue

    // name selects the backend metric, rawLabels holds the original escaped labels and rawValue holds its value token.
    const [, name, rawLabels = '', rawValue = ''] = match
    /** value reads the decimal token. Consumers reject non-finite and negative cumulative values. */
    const value = DECIMAL.test(rawValue) ? Number(rawValue) : NaN

    if (name === 'process_start_time_seconds' && Number.isFinite(value) && value >= 0) {
      snapshot.processStart = value
      continue
    }

    /**
     * entries canonicalizes label order. Each mapping callback extracts the label name and its escaped value,
     * which preserves identity even for labels containing separators.
     */
    const entries = Array.from(rawLabels.matchAll(LABEL), (label) => [label[1] ?? '', label[2] ?? ''] as const).sort()
    /** labels allows the grouping dimensions to be read independently of their order in the scrape. */
    const labels = new Map(entries)

    if (name === 'resolution_run_snapshot') {
      // mode selects the run and field selects the individual gauge to display.
      const mode = labels.get('mode')
      const field = labels.get('field')
      if (
        (mode === 'new' || mode === 'stale' || mode === 'stored') &&
        (field === 'selected' || field === 'attempted' || field === 'confirmed' || field === 'pending') &&
        Number.isFinite(value) &&
        value >= 0
      ) {
        ;(snapshot.runs[mode] ??= {})[field] = value
      }
      continue
    }

    /** series is the chart aggregate for the sample. count entries are joined with sums by identical labels. */
    const series = selectSeries(name, labels)
    if (!series) continue

    /** key avoids collisions between label sets even when label values contain punctuation. */
    const key = JSON.stringify(entries)
    /** sample carries both halves of a histogram series or the sole event counter. */
    const sample = snapshot.series[series].get(key) ?? {}
    sample[name?.endsWith('_count') ? 'count' : 'total'] = value
    snapshot.series[series].set(key, sample)
  }

  return snapshot
}

/** Maps the required metric and labels to a displayed series. Histogram buckets are excluded. */
function selectSeries(name: string | undefined, labels: ReadonlyMap<string, string>): Series | undefined {
  if (name === 'resolution_run_events_total') {
    /** event is the terminal resolution result tracked by the backend counter. */
    const event = labels.get('event')
    if (event === 'success' || event === 'partial' || event === 'failure') return event
  }

  if (name === 'resolution_dns_duration_seconds_sum' || name === 'resolution_dns_duration_seconds_count') {
    /** transport distinguishes classic DNS from DNS over HTTPS in the exported histogram. */
    const transport = labels.get('transport')
    if (transport === 'classic') return 'classicDns'
    if (transport === 'doh') return 'doh'
  }

  if (
    (name === 'resolution_queue_duration_seconds_sum' || name === 'resolution_queue_duration_seconds_count') &&
    labels.get('queue') === 'writer' &&
    labels.get('phase') === 'residence' &&
    labels.get('outcome') === 'dequeued'
  ) {
    return 'writerWait'
  }
}

/** Returns a comparable cumulative increase, preserving decreases and invalid inputs as gaps. */
function increase(before: number | undefined, after: number | undefined): number | null {
  if (before === undefined || after === undefined || !Number.isFinite(before) || !Number.isFinite(after)) return null
  return before >= 0 && after >= before ? after - before : null
}

/**
 * Adds deltas for previously observed label sets. New series begin contributing on the following scrape.
 * A previously observed series that is absent, invalid or reset makes its aggregate incomplete for this interval.
 * Histogram means are weighted by observation count, with a gap when no observations were recorded.
 */
function aggregate(
  prior: ReadonlyMap<string, Sample>,
  next: ReadonlyMap<string, Sample>,
  elapsedMs: number,
  histogram: boolean,
): number | null {
  if (!prior.size) return null

  // total adds increases for all contributing label sets. count weights histogram durations by observations.
  let total = 0
  let count = 0
  // key identifies the exact label set and before contains the previous cumulative values for that set.
  for (const [key, before] of prior) {
    /** after supplies the matching label set in the new scrape, if it still exists. */
    const after = next.get(key)
    /** totalDelta is the counter increment or additional seconds observed since the previous scrape. */
    const totalDelta = increase(before.total, after?.total)
    if (totalDelta === null) return null
    total += totalDelta

    if (histogram) {
      /** countDelta is the number of additional observations attached to the same labels as totalDelta. */
      const countDelta = increase(before.count, after?.count)
      if (countDelta === null) return null
      count += countDelta
    }
  }

  /** result is a weighted duration in milliseconds or an event rate per minute. */
  const result = histogram ? (total / count) * 1000 : (total / elapsedMs) * 60_000
  return Number.isFinite(result) ? result : null
}

/**
 * Calculates plot values for two consecutive successful snapshots. elapsedMs is the observed interval in milliseconds.
 * A changed backend process or a nonpositive elapsed time establishes a fresh baseline for every series.
 */
export function calculateActivityMetrics(
  previous: ActivitySnapshot,
  current: ActivitySnapshot,
  elapsedMs: number,
): ActivityValues {
  if (
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0 ||
    (previous.processStart !== undefined &&
      current.processStart !== undefined &&
      previous.processStart !== current.processStart)
  ) {
    return EMPTY_ACTIVITY_VALUES
  }

  return {
    success: aggregate(previous.series.success, current.series.success, elapsedMs, false),
    partial: aggregate(previous.series.partial, current.series.partial, elapsedMs, false),
    failure: aggregate(previous.series.failure, current.series.failure, elapsedMs, false),
    classicDns: aggregate(previous.series.classicDns, current.series.classicDns, elapsedMs, true),
    doh: aggregate(previous.series.doh, current.series.doh, elapsedMs, true),
    writerWait: aggregate(previous.series.writerWait, current.series.writerWait, elapsedMs, true),
  }
}
