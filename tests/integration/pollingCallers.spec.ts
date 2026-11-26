import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from '@/pages/HomePage.vue'
import MetricsActivity from '@/pages/stats/MetricsActivity.vue'
import PollingSettings from '@/components/dashboard/PollingSettings.vue'
import { apiRequest } from '@/api/client'
import { statsApi } from '@/api/endpoints/stats'
import { useHealthStore, type HealthData } from '@/stores/health'
import { deferred, statistics } from '../fixtures/components/responses'

/** Replaces transport alone while preserving ApiError classes imported by error handling. */
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  apiRequest: vi.fn(),
}))

/** Verifies that separately mounted initial loads share exclusion with polling and manual refresh paths. */
describe('polling callers', () => {
  /** Fake time controls interval ticks; every endpoint is isolated from the real backend. */
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.spyOn(statsApi, 'getStats').mockResolvedValue(statistics())
  })

  /** A slow initial health request blocks both polling and manual duplicate calls, then permits the next tick. */
  it('keeps one health request pending across initial load, polling and manual refresh', async () => {
    // initialHealth holds the initial request open while several polling ticks and a manual action occur.
    const initialHealth = deferred<HealthData>()
    // healthResponse is the successful synthetic cache value observed by the health store action.
    const healthResponse: HealthData = {
      // status and db_pool indicate readiness; ts is a synthetic timestamp; uptime is synthetic seconds.
      status: 'ok',
      ts: 1,
      uptime: 10,
      db_pool: 'ok',
    }
    /** The transport fixture serves only health and config; endpoint spelling is itself part of the assertion. */
    vi.mocked(apiRequest).mockImplementation((endpoint) => {
      if (endpoint === '/health') return initialHealth.promise
      if (endpoint === '/config') return Promise.resolve({})
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })
    // pinia intentionally stubs store actions: this scenario checks the page's calls, not store action internals.
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: true,
      initialState: { settings: { pollingInterval: 10_000 } },
    })
    // wrapper mounts the real polling owner while chart/config children cannot add unrelated timers or requests.
    const wrapper = mount(HomePage, {
      global: {
        plugins: [pinia],
        stubs: {
          PollingSettings: true,
          ConnectionAlert: true,
          HealthStatusCard: true,
          VersionInfoCard: true,
          ConfigurationCard: true,
          StatsMetricCard: true,
          StatsPieCard: true,
        },
      },
    })
    /** Counts health calls only; the filter callback selects endpoint '/health' and excludes configuration IO. */
    const healthCalls = () => vi.mocked(apiRequest).mock.calls.filter(([endpoint]) => endpoint === '/health')
    await flushPromises()
    expect(healthCalls()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(30_000)
    wrapper.getComponent(PollingSettings).vm.$emit('manual-refresh')
    await flushPromises()
    expect(healthCalls()).toHaveLength(1)
    initialHealth.resolve(healthResponse)
    await flushPromises()
    expect(useHealthStore(pinia).updateHealth).toHaveBeenCalledExactlyOnceWith(healthResponse)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(healthCalls()).toHaveLength(2)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(healthCalls()).toHaveLength(2)
  })

  /** A busy scrape blocks later ticks and unmount aborts its fetch and releases both timers. */
  it('keeps one metrics request pending and aborts it on unmount', async () => {
    /** initial holds the first scrape across several configured timer ticks. */
    const initial = deferred<Response>()
    /** fetchMetrics serves the initial scrape and then waits for the next request's abort signal. */
    const fetchMetrics = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(initial.promise)
      .mockImplementationOnce((_url, options) => {
        /** The executor rejects when the fetch for the pending scrape is cancelled. */
        return new Promise((_resolve, reject) => {
          /** The listener simulates cancellation at the same boundary as a real fetch. */
          options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      })
    vi.stubGlobal('fetch', fetchMetrics)

    /** wrapper owns the real statistics activity section and its request lifetime. */
    const wrapper = mount(MetricsActivity)
    expect(fetchMetrics).toHaveBeenCalledTimes(1)
    expect(fetchMetrics.mock.calls[0]?.[0]).toBe('/api/metrics')
    await vi.advanceTimersByTimeAsync(9_000)
    expect(fetchMetrics).toHaveBeenCalledTimes(1)
    initial.resolve(new Response('resolution_run_snapshot{mode="new",field="selected"} 17\n# EOF\n'))
    await flushPromises()
    expect(wrapper.text()).toContain('17')

    await vi.advanceTimersByTimeAsync(3_000)
    expect(fetchMetrics).toHaveBeenCalledTimes(2)
    /** signal comes from the pending fetch and records actual cancellation by the transport. */
    const signal = fetchMetrics.mock.calls[1]?.[1]?.signal
    expect(signal?.aborted).toBe(false)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(9_000)
    expect(signal?.aborted).toBe(true)
    expect(fetchMetrics).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  /** Elapsed time determines the rate, and a backward step in wall time clears the chart history. */
  it('uses elapsed time for rates and clears graph history when the wall clock moves backwards', async () => {
    /** initialTime anchors the simulated visit. monotonic is the elapsed clock controlled independently of Date. */
    const initialTime = Date.UTC(2026, 0, 1, 12)
    vi.setSystemTime(initialTime)
    const monotonic = vi.spyOn(performance, 'now').mockReturnValue(0)
    /** successes increases by three for each of the timed scrapes. */
    let successes = 100
    /** The mock serves cumulative counters without relying on a real backend or network timing. */
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () => {
        return new Response('resolution_run_events_total{mode="new",event="success"} ' + successes + '\n# EOF\n')
      }),
    )
    /** wrapper mounts the actual activity section. chart contains the successful-outcome series and its legend. */
    const wrapper = mount(MetricsActivity)
    const chart = wrapper.get('article[aria-label="Результаты резолвинга"]')
    await flushPromises()

    vi.setSystemTime(initialTime + 2_000)
    monotonic.mockReturnValue(3_000)
    successes = 103
    await vi.advanceTimersByTimeAsync(3_000)
    expect(chart.get('dd').text()).toBe('60')
    expect(chart.text()).not.toContain('Недостаточно данных')

    vi.setSystemTime(initialTime - 60_000)
    monotonic.mockReturnValue(6_000)
    successes = 106
    await vi.advanceTimersByTimeAsync(3_000)
    expect(chart.get('dd').text()).toBe('—')
    expect(chart.text()).toContain('Недостаточно данных')
  })
})
