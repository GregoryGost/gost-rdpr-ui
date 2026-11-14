import { createTestingPinia } from '@pinia/testing'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from '@/pages/HomePage.vue'
import SparklineCard from '@/components/dashboard/SparklineCard.vue'
import PollingSettings from '@/components/dashboard/PollingSettings.vue'
import { apiRequest } from '@/api/client'
import { statsApi } from '@/api/endpoints/stats'
import type { StatsGrowthResponse } from '@/api/types/stats'
import { useHealthStore, type HealthData } from '@/stores/health'
import { deferred, growth, statistics } from '../fixtures/components/responses'

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

  /** A slow chart's initial fetch cannot overlap refresh ticks; completion re-enables polling and unmount clears it. */
  it('skips sparkline ticks while its initial request remains pending', async () => {
    // initialGrowth keeps the mounted load unresolved for three refresh intervals.
    const initialGrowth = deferred<StatsGrowthResponse>()
    vi.spyOn(statsApi, 'getGrowth').mockReturnValueOnce(initialGrowth.promise).mockResolvedValue(growth())
    // wrapper uses the actual chart, selected interval and usePolling lifecycle.
    const wrapper = mount(SparklineCard, {
      props: { entity: 'domains', label: 'Домены', color: '#123456', refreshInterval: 10_000 },
    })
    expect(statsApi.getGrowth).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(statsApi.getGrowth).toHaveBeenCalledTimes(1)
    initialGrowth.resolve(growth())
    await flushPromises()
    expect(wrapper.text()).toContain('17')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(statsApi.getGrowth).toHaveBeenCalledTimes(2)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(statsApi.getGrowth).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
