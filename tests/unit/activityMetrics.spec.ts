import { describe, expect, it } from 'vitest'
import { calculateActivityMetrics, parseActivityMetrics } from '@/utils/activityMetrics'

/** Joins sample and metadata records into a complete OpenMetrics body for parsing. */
function scrape(...lines: string[]): string {
  return [...lines, '# EOF', ''].join('\n')
}

/** OpenMetrics bodies exercise the text parser and derived values together without mocking either layer. */
describe('service activity metrics', () => {
  /** The first complete scrape exposes run gauges, including zero and numeric exponent notation. */
  it('reads published run fields independently for each mode', () => {
    // snapshot contains known and unknown modes, with reordered labels and a gauge that was not reported.
    const snapshot = parseActivityMetrics(
      scrape(
        '# TYPE resolution_run_snapshot gauge',
        'resolution_run_snapshot{field="selected",mode="new"} 2.5e1',
        'resolution_run_snapshot{mode="new",field="attempted"} 10',
        'resolution_run_snapshot{field="confirmed",mode="new"} 0',
        'resolution_run_snapshot{mode="new",field="pending"} NaN',
        'resolution_run_snapshot{field="selected",mode="stale"} 7',
        'resolution_run_snapshot{field="pending",mode="stored"} 4',
        'resolution_run_snapshot{mode="stored",field="unknown"} 1234',
        'resolution_run_snapshot{mode="other",field="selected"} 900',
        'unrelated_metric{mode="new",field="pending"} 88',
      ),
    )

    expect(snapshot.runs).toEqual({
      new: { selected: 25, attempted: 10, confirmed: 0 },
      stale: { selected: 7 },
      stored: { pending: 4 },
    })
    expect(parseActivityMetrics(scrape()).runs).toEqual({})
  })

  /** A cut-off response can otherwise establish a partial baseline and break the next interval. */
  it('rejects a truncated scrape', () => {
    /** Supplies a valid sample with no end-of-exposition marker. */
    expect(() => parseActivityMetrics('resolution_run_snapshot{mode="new",field="selected"} 10\n')).toThrow()
  })

  /** Half a minute makes the event rate twice the increase. Two unequal sample populations expose unweighted means. */
  it('combines comparable series by time and observation count', () => {
    // before supplies nonzero starting counters for every graph and unrelated queue observations.
    const before = parseActivityMetrics(
      scrape(
        'resolution_run_events_total{mode="new",event="success"} 50',
        'resolution_run_events_total{mode="stored",event="success"} 80',
        'resolution_run_events_total{mode="stale",event="partial"} 30',
        'resolution_run_events_total{mode="stale",event="failure"} 20',
        'resolution_dns_duration_seconds_sum{transport="classic",server_id="1",record_type="A",outcome="ok",reason=""} 3',
        'resolution_dns_duration_seconds_count{transport="classic",server_id="1",record_type="A",outcome="ok",reason=""} 10',
        'resolution_dns_duration_seconds_sum{transport="classic",server_id="2",record_type="AAAA",outcome="ok",reason=""} 5',
        'resolution_dns_duration_seconds_count{transport="classic",server_id="2",record_type="AAAA",outcome="ok",reason=""} 20',
        'resolution_dns_duration_seconds_sum{transport="doh",server_id="3",record_type="A",outcome="ok",reason=""} 8',
        'resolution_dns_duration_seconds_count{transport="doh",server_id="3",record_type="A",outcome="ok",reason=""} 30',
        'resolution_queue_duration_seconds_sum{queue="writer",phase="residence",outcome="dequeued"} 2',
        'resolution_queue_duration_seconds_count{queue="writer",phase="residence",outcome="dequeued"} 8',
        'resolution_queue_duration_seconds_sum{queue="writer",phase="execution",outcome="dequeued"} 10',
        'resolution_queue_duration_seconds_count{queue="writer",phase="execution",outcome="dequeued"} 10',
        'resolution_queue_duration_seconds_sum{queue="resolver",phase="residence",outcome="dequeued"} 10',
        'resolution_queue_duration_seconds_count{queue="resolver",phase="residence",outcome="dequeued"} 10',
      ),
    )
    // after represents 6 successes and 3 partial outcomes, and unequal classic DNS latency populations.
    const after = parseActivityMetrics(
      scrape(
        'resolution_run_events_total{event="success",mode="new"} 52',
        'resolution_run_events_total{mode="stored",event="success"} 84',
        'resolution_run_events_total{mode="stale",event="partial"} 33',
        'resolution_run_events_total{mode="stale",event="failure"} 20',
        'resolution_dns_duration_seconds_sum{reason="",record_type="A",transport="classic",server_id="1",outcome="ok"} 3.5',
        'resolution_dns_duration_seconds_count{transport="classic",server_id="1",record_type="A",outcome="ok",reason=""} 11',
        'resolution_dns_duration_seconds_sum{transport="classic",server_id="2",record_type="AAAA",outcome="ok",reason=""} 5.5',
        'resolution_dns_duration_seconds_count{transport="classic",server_id="2",record_type="AAAA",outcome="ok",reason=""} 23',
        'resolution_dns_duration_seconds_sum{transport="doh",server_id="3",record_type="A",outcome="ok",reason=""} 8.25',
        'resolution_dns_duration_seconds_count{transport="doh",server_id="3",record_type="A",outcome="ok",reason=""} 32',
        'resolution_queue_duration_seconds_sum{queue="writer",phase="residence",outcome="dequeued"} 2.125',
        'resolution_queue_duration_seconds_count{queue="writer",phase="residence",outcome="dequeued"} 10',
        'resolution_queue_duration_seconds_sum{queue="writer",phase="execution",outcome="dequeued"} 410',
        'resolution_queue_duration_seconds_count{queue="writer",phase="execution",outcome="dequeued"} 20',
        'resolution_queue_duration_seconds_sum{queue="resolver",phase="residence",outcome="dequeued"} 910',
        'resolution_queue_duration_seconds_count{queue="resolver",phase="residence",outcome="dequeued"} 20',
      ),
    )

    expect(calculateActivityMetrics(before, after, 30_000)).toEqual({
      success: 12,
      partial: 6,
      failure: 0,
      classicDns: 250,
      doh: 125,
      writerWait: 62.5,
    })
  })

  /** The first value from a newly visible label set could already contain thousands of historical events. */
  it('starts new label sets at a baseline before counting their increases', () => {
    // before has only the existing new-domain series.
    const before = parseActivityMetrics(scrape('resolution_run_events_total{mode="new",event="success"} 10'))
    // introduced adds a large initial value for an independent stored-domain series.
    const introduced = parseActivityMetrics(
      scrape(
        'resolution_run_events_total{mode="new",event="success"} 12',
        'resolution_run_events_total{mode="stored",event="success"} 10000',
      ),
    )
    // after adds one event to the original label set and four to the newly comparable stored-domain series.
    const after = parseActivityMetrics(
      scrape(
        'resolution_run_events_total{mode="new",event="success"} 13',
        'resolution_run_events_total{mode="stored",event="success"} 10004',
      ),
    )

    expect(calculateActivityMetrics(before, introduced, 15_000).success).toBe(8)
    expect(calculateActivityMetrics(introduced, after, 15_000).success).toBe(20)
  })

  /**
   * Exercises three ways earlier observations become incomparable. condition names the break
   * and storedSample carries its latest record, or an empty string when it disappeared.
   */
  it.each([
    ['reset', 'resolution_run_events_total{mode="stored",event="success"} 4'],
    ['non-finite value', 'resolution_run_events_total{mode="stored",event="success"} NaN'],
    ['disappearance', ''],
  ])('leaves a series gap after a %s even when another label increases', (condition, storedSample) => {
    // before has two success populations and a separate failure population.
    const before = parseActivityMetrics(
      scrape(
        'resolution_run_events_total{mode="new",event="success"} 100',
        'resolution_run_events_total{mode="stored",event="success"} 40',
        'resolution_run_events_total{mode="stale",event="failure"} 8',
      ),
    )
    // after increases the other success label enough to hide a reset in a sum-before-delta calculation.
    const after = parseActivityMetrics(
      scrape(
        'resolution_run_events_total{mode="new",event="success"} 200',
        storedSample,
        'resolution_run_events_total{mode="stale",event="failure"} 10',
      ),
    )

    expect(calculateActivityMetrics(before, after, 6_000), condition).toMatchObject({ success: null, failure: 20 })
  })

  /** A count that stays fixed yields a gap, while a newly recorded observation can genuinely take zero milliseconds. */
  it('distinguishes absent histogram observations from a measured zero duration', () => {
    // before is a valid cumulative DoH histogram.
    const before = parseActivityMetrics(
      scrape(
        'resolution_dns_duration_seconds_sum{transport="doh",server_id="1"} 2',
        'resolution_dns_duration_seconds_count{transport="doh",server_id="1"} 4',
      ),
    )
    // advancedCount describes a zero-duration observation appended after the baseline.
    const advancedCount = parseActivityMetrics(
      scrape(
        'resolution_dns_duration_seconds_sum{transport="doh",server_id="1"} 2',
        'resolution_dns_duration_seconds_count{transport="doh",server_id="1"} 5',
      ),
    )

    expect(calculateActivityMetrics(before, before, 3_000).doh).toBeNull()
    expect(calculateActivityMetrics(before, advancedCount, 3_000).doh).toBe(0)
  })

  /** Fresh process counters can already be larger than the old counters when the next scrape arrives. */
  it('takes a fresh baseline when the reported process start changes', () => {
    // before identifies the old process and ends at a lower value than the replacement's first snapshot.
    const before = parseActivityMetrics(
      scrape('process_start_time_seconds 1700000000', 'resolution_run_events_total{mode="new",event="success"} 5'),
    )
    // restarted identifies a replacement with six already counted successes.
    const restarted = parseActivityMetrics(
      scrape('process_start_time_seconds 1700000030', 'resolution_run_events_total{mode="new",event="success"} 6'),
    )

    expect(calculateActivityMetrics(before, restarted, 3_000).success).toBeNull()
  })
})
