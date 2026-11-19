import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/api/client'
import { domainsApi } from '@/api/endpoints/domains'
import { dnsApi } from '@/api/endpoints/dns'
import { domainsListsApi } from '@/api/endpoints/domains-lists'
import { ipsApi } from '@/api/endpoints/ips'
import { ipsListsApi } from '@/api/endpoints/ips-lists'
import { rosApi } from '@/api/endpoints/ros'
import { statsApi } from '@/api/endpoints/stats'
import { commandsApi } from '@/api/endpoints/commands'
import type { DomainResolveCheckRequest } from '@/api/types/domains'
import type { RipeStatPrefixCheckRequest } from '@/api/types/ips'

/** Replaces only transport; endpoint serialization and validators execute unchanged. */
vi.mock('@/api/client', () => ({ apiRequest: vi.fn() }))

/** requestMock records the transport contract without permitting network requests. */
const requestMock = vi.mocked(apiRequest)

/** Gives each wrapper test a successful synthetic transport and empty call history. */
beforeEach(() => {
  requestMock.mockReset()
  requestMock.mockResolvedValue({ result: 'accepted' })
})

/** Shared wrappers must serialize values without losing zero, false or non-ASCII search text. */
describe('endpoint serialization', () => {
  /** The confirmed unprocessed flag composes with resolved and search; false remains an explicit legacy no-op. */
  it('serializes the confirmed unprocessed contract on both domain endpoints', async () => {
    await domainsApi.getAll({ unprocessed: true, resolved: false, limit: 10, offset: 0 })
    expect(requestMock).toHaveBeenLastCalledWith('/domains?unprocessed=true&resolved=false&limit=10&offset=0')
    await domainsApi.search('fresh & new', { unprocessed: true, limit: 10, offset: 0 })
    expect(requestMock).toHaveBeenLastCalledWith(
      '/domains/search?text=fresh+%26+new&unprocessed=true&limit=10&offset=0',
    )
    await domainsApi.getAll({ unprocessed: false, offset: 0 })
    expect(requestMock).toHaveBeenLastCalledWith('/domains?unprocessed=false&offset=0')
    await domainsApi.search('fresh', { unprocessed: undefined, resolved: undefined, offset: 0 })
    expect(requestMock).toHaveBeenLastCalledWith('/domains/search?text=fresh&offset=0')
  })

  /** All six searchable resources encode text and preserve the zero offset. */
  it.each([
    ['/dns', dnsApi],
    ['/domains', domainsApi],
    ['/domains/lists', domainsListsApi],
    ['/ips', ipsApi],
    ['/ips/lists', ipsListsApi],
    ['/ros', rosApi],
  ] as const)('encodes search and pagination for %s', async (path, api) => {
    await api.search('пример & test', { limit: 20, offset: 0 })
    expect(requestMock).toHaveBeenCalledExactlyOnceWith(
      `${path}/search?text=%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D1%80+%26+test&limit=20&offset=0`,
    )
  })

  /** List, detail and deletion paths remain distinct and getAll omits a query when no filters exist. */
  it.each([
    ['/dns', dnsApi],
    ['/domains', domainsApi],
    ['/domains/lists', domainsListsApi],
    ['/ips', ipsApi],
    ['/ips/lists', ipsListsApi],
    ['/ros', rosApi],
  ] as const)('uses list, detail and deletion contracts for %s', async (path, api) => {
    await api.getAll()
    expect(requestMock).toHaveBeenLastCalledWith(path)
    await api.getAll({ limit: 10, offset: 0 })
    expect(requestMock).toHaveBeenLastCalledWith(`${path}?limit=10&offset=0`)
    await api.getOne(7)
    expect(requestMock).toHaveBeenLastCalledWith(`${path}/7`)
    await api.deleteOne(7)
    expect(requestMock).toHaveBeenLastCalledWith(`${path}/7`, { method: 'DELETE' })
    await api.deleteAll()
    expect(requestMock).toHaveBeenLastCalledWith(path, { method: 'DELETE' })
  })

  /** Boolean filters and exact-zero attempts must survive optional-value serialization. */
  it('preserves false and zero filters while omitting undefined optional values', async () => {
    await domainsApi.search('example', { resolved: false, offset: 0, limit: 10, start_date: undefined })
    expect(requestMock).toHaveBeenLastCalledWith('/domains/search?text=example&resolved=false&offset=0&limit=10')
    await ipsApi.getAll({ default_gw: false, type: 4, offset: 0 })
    expect(requestMock).toHaveBeenLastCalledWith('/ips?default_gw=false&type=4&offset=0')
    await domainsListsApi.getAll({ attempts: 0, offset: 0 })
    expect(requestMock).toHaveBeenLastCalledWith('/domains/lists?attempts=0&offset=0')
    await ipsListsApi.search('example', { attempts: 0, limit: 10 })
    expect(requestMock).toHaveBeenLastCalledWith('/ips/lists/search?text=example&attempts=0&limit=10')
  })

  /** Creation arrays use backend field names and JSON serialization instead of query parameters. */
  it('posts creation arrays for each resource', async () => {
    await dnsApi.create([{ server: '192.0.2.53', description: 'Тест' }])
    expect(requestMock).toHaveBeenLastCalledWith('/dns', {
      method: 'POST',
      body: '[{"server":"192.0.2.53","description":"Тест"}]',
    })
    await domainsApi.create([{ domain: 'example.test', list_id: 0 }])
    expect(requestMock).toHaveBeenLastCalledWith('/domains', {
      method: 'POST',
      body: '[{"domain":"example.test","list_id":0}]',
    })
    await domainsListsApi.create([{ name: 'domains', url: 'https://example.test/domains' }])
    expect(requestMock).toHaveBeenLastCalledWith('/domains/lists', {
      method: 'POST',
      body: '[{"name":"domains","url":"https://example.test/domains"}]',
    })
    await ipsApi.create([{ addr: '192.0.2.1', use_default_gw: false }])
    expect(requestMock).toHaveBeenLastCalledWith('/ips', {
      method: 'POST',
      body: '[{"addr":"192.0.2.1","use_default_gw":false}]',
    })
    await ipsListsApi.create([{ name: 'ips', url: 'https://example.test/ips' }])
    expect(requestMock).toHaveBeenLastCalledWith('/ips/lists', {
      method: 'POST',
      body: '[{"name":"ips","url":"https://example.test/ips"}]',
    })
    await rosApi.create([
      { host: '192.0.2.2', user: 'test-user', user_password: 'synthetic-test-password', bgp_list_name: 'test-list' },
    ])
    expect(requestMock).toHaveBeenLastCalledWith('/ros', {
      method: 'POST',
      body: '[{"host":"192.0.2.2","user":"test-user","user_password":"synthetic-test-password","bgp_list_name":"test-list"}]',
    })
  })

  /** The wrappers return transport results and preserve a rejection rather than swallowing it. */
  it('returns the transport result and propagates transport rejection', async () => {
    expect(await domainsApi.getOne(7)).toEqual({ result: 'accepted' })
    /** failure is a synthetic transport rejection used to check error identity. */
    const failure = new Error('transport failure')
    requestMock.mockRejectedValueOnce(failure)
    await expect(domainsApi.getAll()).rejects.toBe(failure)
  })
})

/** Domain resolving validates public numeric constraints before sending any transport request. */
describe('domain resolving', () => {
  /** OpenAPI requires a positive integer stored-domain ID for the background POST endpoint. */
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid stored ID %s before transport', (id) => {
    expect(() => domainsApi.resolveNow(id)).toThrow(TypeError)
    expect(requestMock).not.toHaveBeenCalled()
  })

  /** A valid ID uses the background POST path and returns its accepted response. */
  it('posts a stored-domain resolve request', async () => {
    expect(await domainsApi.resolveNow(7)).toEqual({ result: 'accepted' })
    expect(requestMock).toHaveBeenCalledExactlyOnceWith('/domains/7/resolve', { method: 'POST' })
  })

  /** DNS lists must be nonempty, nonnegative and integral, with the existing frontend uniqueness rule. */
  it.each([
    { ids: [] },
    { ids: [-1] },
    { ids: [1.5] },
    { ids: [Number.NaN] },
    { ids: [Number.POSITIVE_INFINITY] },
    { ids: [1, 1] },
  ])('rejects invalid DNS IDs $ids', ({ ids }) => {
    /** malformed deliberately crosses the typed tuple boundary to exercise runtime validation. */
    const malformed = { domain: 'example.test', dns_server_ids: ids } as DomainResolveCheckRequest
    expect(() => domainsApi.resolveCheck(malformed)).toThrow(TypeError)
    expect(requestMock).not.toHaveBeenCalled()
  })

  /** Zero is a valid explicit DNS ID; omission retains automatic DNS selection and both source types serialize. */
  it('preserves valid DNS selections, source types and the resolve timeout', async () => {
    await domainsApi.resolveCheck({ domain: 'example.test', dns_server_ids: [0, 2] })
    expect(requestMock).toHaveBeenLastCalledWith(
      '/domains/resolve/check',
      {
        method: 'POST',
        body: '{"domain":"example.test","dns_server_ids":[0,2]}',
      },
      60000,
    )
    await domainsApi.resolveCheck({ id: 7 })
    expect(requestMock).toHaveBeenLastCalledWith('/domains/resolve/check', { method: 'POST', body: '{"id":7}' }, 60000)
  })
})

/** IP checks reject ambiguous sources and invalid IPv4 values without contacting RIPEstat. */
describe('IP checks', () => {
  /** Runtime validation must reject values that can arrive from untyped input. */
  it.each([
    {},
    { id: 0 },
    { id: -1 },
    { id: 1.5 },
    { id: 7, address: '192.0.2.1' },
    { address: '256.0.2.1' },
    { address: '192.0.2' },
    { address: '2001:db8::1' },
    { address: '192.a.2.1' },
  ])('rejects invalid RIPEstat source %j', (data) => {
    expect(() => ipsApi.checkRipeStatPrefix(data as RipeStatPrefixCheckRequest)).toThrow(TypeError)
    expect(requestMock).not.toHaveBeenCalled()
  })

  /** Valid address and saved-record requests use the same JSON POST boundary. */
  it('posts valid sources and the cache or cleanup commands', async () => {
    await ipsApi.checkRipeStatPrefix({ address: '192.0.2.1' })
    expect(requestMock).toHaveBeenLastCalledWith('/ips/ripe/check', { method: 'POST', body: '{"address":"192.0.2.1"}' })
    await ipsApi.checkRipeStatPrefix({ id: 7 })
    expect(requestMock).toHaveBeenLastCalledWith('/ips/ripe/check', { method: 'POST', body: '{"id":7}' })
    await ipsApi.clearRipeStatCache()
    expect(requestMock).toHaveBeenLastCalledWith('/ips/ripe/cache/clear', { method: 'POST' })
    await ipsApi.queueCleanupNotAllowed()
    expect(requestMock).toHaveBeenLastCalledWith('/ips/cleanup/not-allowed', { method: 'POST' })
  })
})

/** Statistics date inputs and command query flags are serialized independently of transport implementation. */
describe('statistics and commands', () => {
  /** Minute-precision HTML datetime input is converted into the backend's second-precision timestamp. */
  it('serializes growth dates, grouping and the zero IP subtype', async () => {
    await statsApi.getStats()
    expect(requestMock).toHaveBeenLastCalledWith('/stats')
    await statsApi.getGrowth({
      entity: 'ips',
      granularity: 'day',
      start_date: '2026-01-01T12:30',
      end_date: '2026-01-02T12:30:45',
      ip_subtype: 0,
      date_filter_field: 'updated_at',
    })
    expect(requestMock).toHaveBeenLastCalledWith(
      '/stats/growth?entity=ips&granularity=day&start_date=2026-01-01+12%3A30%3A00&end_date=2026-01-02+12%3A30%3A45&ip_subtype=0&date_filter_field=updated_at',
    )
    await statsApi.getGrowth({ entity: 'domains', start_date: null, end_date: null, ip_subtype: null })
    expect(requestMock).toHaveBeenLastCalledWith('/stats/growth?entity=domains')
  })

  /** Boolean forced=false remains explicit and each background command uses POST. */
  it('sends explicit command flags and command-specific POST paths', async () => {
    await commandsApi.loadLists()
    expect(requestMock).toHaveBeenLastCalledWith('/commands/lists/load?forced=false', { method: 'POST' })
    await commandsApi.loadLists(true)
    expect(requestMock).toHaveBeenLastCalledWith('/commands/lists/load?forced=true', { method: 'POST' })
    await commandsApi.resolveNewDomains()
    expect(requestMock).toHaveBeenLastCalledWith('/commands/domains/resolve/new', { method: 'POST' })
    await commandsApi.resolveStaleDomains()
    expect(requestMock).toHaveBeenLastCalledWith('/commands/domains/resolve/stale', { method: 'POST' })
    await commandsApi.updateRouterOS(4)
    expect(requestMock).toHaveBeenLastCalledWith('/commands/ros/update?type=4', { method: 'POST' })
    await commandsApi.updateRouterOS()
    expect(requestMock).toHaveBeenLastCalledWith('/commands/ros/update', { method: 'POST' })
  })
})
