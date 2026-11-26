import { test as base, expect, type Page, type Route } from '@playwright/test'

/** Synthetic API domain, independent of application types and including nullable backend fields. */
export interface BrowserDomain {
  /** Saved identifier; nonpositive values model service records excluded from unprocessed counts. */
  id: number
  /** Domain name shown in searches and the saved card. */
  name: string
  /** Whether the saved resolution currently has usable addresses. */
  resolved: boolean
  /** Optional list membership; null represents an unassigned domain. */
  domains_list_id: number | null
  /** Saved IPv4 addresses, including the backend's null case. */
  ips_v4: string[] | null
  /** Saved IPv6 addresses, including the backend's null case. */
  ips_v6: string[] | null
  /** Optional RouterOS comment used by column filtering. */
  ros_comment: string
  /** Creation time in epoch seconds. */
  created_at: number
  /** Backend-formatted creation date. */
  created_at_hum: string
  /** Last successful resolution time in epoch seconds. */
  last_resolved_at?: number | null
  /** Backend-formatted last successful resolution date. */
  last_resolved_at_hum?: string | null
  /** Last completed saved attempt, absent for older records or null when unknown. */
  last_attempt_at?: number | null
  /** Backend-formatted saved attempt date with the same compatibility cases. */
  last_attempt_at_hum?: string | null
}

/** Captured mutation allows assertions on the browser's actual public API request. */
interface Mutation {
  /** HTTP method sent by the browser. */
  method: string
  /** API path without its local prefix. */
  path: string
  /** Parsed JSON request body, or null for bodyless requests. */
  body: unknown
}

/** Supported controlled outcomes of a completed background DNS attempt. */
export type ResolveOutcome = 'success' | 'partial' | 'failure'

/** Returns an independent domain record; id and name identify the synthetic saved entity. */
export function makeDomain(id: number, name: string): BrowserDomain {
  return {
    id,
    name,
    resolved: true,
    domains_list_id: 7,
    ips_v4: ['192.0.2.10'],
    ips_v6: ['2001:db8::10'],
    ros_comment: 'primary',
    created_at: 1700000000,
    created_at_hum: '2023-11-14 22:13:20',
    last_resolved_at: 1700000100,
    last_resolved_at_hum: '2023-11-14 22:15:00',
    last_attempt_at: 1700000200,
    last_attempt_at_hum: '2023-11-14 22:16:40',
  }
}

/** Creates fresh records spanning two pages and all saved-attempt compatibility cases. */
function seedDomains(): BrowserDomain[] {
  // dated has both timestamps; unknown has explicit nulls; legacy omits both attempt fields.
  const dated = makeDomain(1, 'dated.example.test')
  const unknown = {
    ...makeDomain(2, 'unknown.example.test'),
    resolved: false,
    domains_list_id: null,
    ips_v4: null,
    ips_v6: null,
    last_attempt_at: null,
    last_attempt_at_hum: null,
    ros_comment: 'secondary',
  }
  const legacy = makeDomain(3, 'legacy.example.test')
  delete legacy.last_attempt_at
  delete legacy.last_attempt_at_hum
  // additional's factory callback uses zero-based index for distinct IDs and alternating categories; _ is unused.
  const additional = Array.from({ length: 23 }, (_, index) => ({
    ...makeDomain(index + 4, `page-${String(index + 4).padStart(2, '0')}.example.test`),
    resolved: index % 2 === 0,
    domains_list_id: index % 2 === 0 ? 7 : null,
    ros_comment: index % 2 === 0 ? 'primary' : 'secondary',
  }))
  return [dated, unknown, legacy, ...additional]
}

/** Isolates every API call and mutation within a single browser test. */
export class BrowserApi {
  /** Test-owned saved data; tests may replace it before navigation for empty and boundary cases. */
  domains = seedDomains()
  /** Public mutation requests observed during this test. */
  mutations: Mutation[] = []
  /** Every observed API method/path/query, useful for negative request assertions. */
  requests: string[] = []
  /** Any unexpected network or JavaScript failure causes fixture teardown to fail. */
  failures: string[] = []
  /** Exact console text patterns allowed only by intentional failure scenarios. */
  expectedConsoleErrors: RegExp[] = []
  /** Search strings whose next requests remain pending until explicitly released. */
  holdSearches = new Set<string>()
  /** Held searches indexed by their entered public query value. */
  heldSearches = new Map<string, Route>()
  /** When true, domain list requests stay pending to expose loading states. */
  holdDomains = false
  /** Pending list requests owned by this test. */
  heldDomains: Route[] = []
  /** One controlled domain-list error status, consumed by the next request. */
  nextDomainStatus: number | null = null
  /** Accepted background operations, still incomplete until completeResolve is called. */
  pendingResolves = new Set<number>()
  /** API paths whose requests are paused for explicit failure/concurrency scenario sequencing. */
  holdPaths = new Set<string>()
  /** Pending routes grouped by their backend path; each test owns and releases its own routes. */
  heldPaths = new Map<string, Route[]>()
  /** One synthetic HTTP 200 result per exact command path and query, consumed by the next matching POST. */
  nextCommandResults = new Map<string, string>()
  /** Complete OpenMetrics body returned on each scrape until the test replaces it. */
  metricsBody = '# EOF\n'
  /** Aborts one scrape before a response exists so recovery can be exercised against the next successful response. */
  failNextMetricsRequest = false

  /** Installs routing and browser-error observers on page before any application navigation. */
  async install(page: Page): Promise<void> {
    /** Records unhandled browser exceptions rather than silently relying on visible UI assertions. */
    page.on('pageerror', (error) => this.failures.push(`pageerror: ${error.message}`))
    /** Captures unexpected console errors; tests must allow known injected errors explicitly. */
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      /** The predicate checks pattern against this message, allowing only deliberately injected console failures. */
      if (this.expectedConsoleErrors.some((pattern) => pattern.test(message.text()))) return
      this.failures.push(`console: ${message.text()}`)
    })
    /** Routes every request through the isolated fixture or permits only local static application assets. */
    await page.context().route('**/*', async (route) => {
      // url is the actual outgoing URL; method identifies the requested public operation.
      const url = new URL(route.request().url())
      const method = route.request().method()
      if (url.origin !== 'http://127.0.0.1:5001') {
        this.failures.push(`External request blocked: ${method} ${url.origin}${url.pathname}`)
        await route.abort('blockedbyclient')
        return
      }
      if (!url.pathname.startsWith('/api/')) {
        if (['fetch', 'xhr'].includes(route.request().resourceType())) {
          this.failures.push(`Unexpected non-API request: ${method} ${url.pathname}`)
          await route.abort('blockedbyclient')
          return
        }
        await route.continue()
        return
      }
      this.requests.push(`${method} ${url.pathname}${url.search}`)
      await this.respond(route, url, method)
    })
  }

  /** Returns backend-shaped pagination for url, applying the confirmed search and status parameters. */
  private domainPage(url: URL): unknown {
    // text/resolved/unprocessed are backend filters; limit and offset select the requested slice.
    const text = url.searchParams.get('text')?.toLowerCase() ?? ''
    const resolved = url.searchParams.get('resolved')
    const unprocessed = url.searchParams.get('unprocessed') === 'true'
    const limit = Number(url.searchParams.get('limit') ?? 20)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    // matching's callback models server-side filters, without copying application client-pagination logic.
    const matching = this.domains.filter(
      (domain) =>
        domain.name.toLowerCase().includes(text) &&
        (resolved === null || domain.resolved === (resolved === 'true')) &&
        (!unprocessed || (domain.id > 0 && domain.last_attempt_at == null && domain.last_resolved_at == null)),
    )
    // payload contains only this API page; counters describe the filtered source and global resolved total.
    const payload = matching.slice(offset, offset + limit)
    return {
      limit,
      offset,
      duration: 0.001,
      count: payload.length,
      total: this.domains.length,
      total_resolved: this.domains.filter(
        /** Counts domain only when the backend fixture considers it currently resolved. */
        (domain) => domain.resolved,
      ).length,
      total_query: matching.length,
      payload,
    }
  }

  /** Releases text's pending search with the current synthetic backend response. */
  async releaseSearch(text: string): Promise<void> {
    // route is the exact pending search; missing capture indicates a broken test sequence.
    const route = this.heldSearches.get(text)
    if (!route) throw new Error(`No held search for ${text}`)
    this.heldSearches.delete(text)
    this.holdSearches.delete(text)
    await route.fulfill({ json: this.domainPage(new URL(route.request().url())) })
  }

  /** Releases all pending lists, preserving the API's current saved state. */
  async releaseDomains(): Promise<void> {
    this.holdDomains = false
    // route is each captured list request, removed from the pending collection before fulfillment.
    for (const route of this.heldDomains.splice(0)) {
      await route.fulfill({ json: this.domainPage(new URL(route.request().url())) })
    }
  }

  /** Releases path's captured requests through the normal deterministic handler without changing their meaning. */
  async releasePath(path: string): Promise<void> {
    this.holdPaths.delete(path)
    // routes is the detached collection of requests that this explicit release now completes.
    const routes = this.heldPaths.get(path) ?? []
    this.heldPaths.delete(path)
    // route is the captured request whose original URL and method must be preserved.
    for (const route of routes) {
      await this.respond(route, new URL(route.request().url()), route.request().method())
    }
  }

  /** Completes an accepted id's background attempt with outcome; partial/failure retain prior successful dates. */
  completeResolve(id: number, outcome: ResolveOutcome): void {
    if (!this.pendingResolves.delete(id)) throw new Error(`No accepted resolve for ${id}`)
    // domain is the saved entity whose backend attempt is now complete.
    const domain = this.domains.find(
      /** Selects item by its saved ID; array position does not identify a backend record. */
      (item) => item.id === id,
    )
    if (!domain) throw new Error(`Missing domain ${id}`)
    domain.last_attempt_at = 1700000300
    domain.last_attempt_at_hum = '2023-11-14 22:18:20'
    // Only complete success advances the saved resolution checkpoint; partial/failure retain prior status.
    if (outcome === 'success') domain.resolved = true
    if (outcome === 'success') domain.ips_v4 = ['192.0.2.20']
    else if (outcome === 'partial') domain.ips_v4 = [...new Set([...(domain.ips_v4 ?? []), '192.0.2.20'])]
    // Incomplete evidence preserves prior supports; saved resolution never changes IPv6 in this backend flow.
    if (outcome === 'success') {
      domain.last_resolved_at = 1700000300
      domain.last_resolved_at_hum = '2023-11-14 22:18:20'
    }
  }

  /** Dispatches a known method and url; unrecognized operations fail closed without contacting a backend. */
  private async respond(route: Route, url: URL, method: string): Promise<void> {
    // path is the backend path after the preview-only local prefix.
    const path = url.pathname.slice(4)
    if (this.holdPaths.has(path)) {
      // routes collects only requests for this deliberately paused backend path.
      const routes = this.heldPaths.get(path) ?? []
      routes.push(route)
      this.heldPaths.set(path, routes)
      return
    }
    if (method === 'POST' && path.startsWith('/commands/') && route.request().postData() === null) {
      // target includes the query so a change to an API parameter cannot accidentally match the scripted reply.
      const target = `${path}${url.search}`
      // result is set by the test for this stage of the simulated queue, independently of the browser's response handling.
      const result = this.nextCommandResults.get(target)
      if (result !== undefined) {
        this.nextCommandResults.delete(target)
        await route.fulfill({ status: 200, json: { result } })
        return
      }
    }
    if (method === 'GET' && path === '/health') {
      await route.fulfill({ json: { status: 'OK', ts: 1700000000, uptime: 120, db_pool: 'isolated' } })
      return
    }
    if (method === 'GET' && path === '/config') {
      await route.fulfill({ json: configuration })
      return
    }
    if (method === 'GET' && path === '/metrics') {
      if (this.failNextMetricsRequest) {
        this.failNextMetricsRequest = false
        await route.abort('failed')
        return
      }
      await route.fulfill({ contentType: 'text/plain', body: this.metricsBody })
      return
    }
    if (method === 'GET' && path === '/stats/growth') {
      await route.fulfill({
        json: {
          entity: url.searchParams.get('entity'),
          granularity: url.searchParams.get('granularity'),
          start_date: url.searchParams.get('start_date'),
          end_date: url.searchParams.get('end_date'),
          ip_subtype: url.searchParams.has('ip_subtype') ? Number(url.searchParams.get('ip_subtype')) : null,
          payload: [{ date: url.searchParams.get('start_date') ?? '2026-01-01 00:00:00', count: 17 }],
          total_in_period: 17,
          duration: 0.001,
        },
      })
      return
    }
    if (method === 'GET' && path === '/stats') {
      // resolved and listed hold the global and assigned-list populations used in backend statistics.
      const resolved = this.domains.filter(
        /** Counts domain only when its saved resolution status is true. */
        (domain) => domain.resolved,
      ).length
      const listed = this.domains.filter(
        /** Selects domain only when it belongs to the fixture's sole saved list. */
        (domain) => domain.domains_list_id === 7,
      )
      await route.fulfill({
        json: {
          generated_at: '2023-11-14 22:20:00',
          dns: { total: 1, classic: 1, doh: 0 },
          domains: {
            total: this.domains.length,
            resolved,
            unresolved: this.domains.length - resolved,
            unprocessed: this.domains.filter(
              /** Missing dates mean no saved processing; zero timestamps are known dates, and service IDs are excluded. */
              (domain) => domain.id > 0 && domain.last_attempt_at == null && domain.last_resolved_at == null,
            ).length,
            lists_total: 1,
            per_list: [
              {
                list_id: 7,
                list_name: 'Example list',
                total: listed.length,
                resolved: listed.filter(
                  /** Counts the listed domain when its saved resolution is successful. */
                  (domain) => domain.resolved,
                ).length,
                unresolved: listed.filter(
                  /** Counts the listed domain when its saved resolution is unsuccessful. */
                  (domain) => !domain.resolved,
                ).length,
                attempts: 0,
              },
            ],
          },
          ips: { total: 2, v4_total: 1, v6_total: 1, linked_to_domain: 2, standalone: 0, lists_total: 0, per_list: [] },
          ros: { total: 0 },
        },
      })
      return
    }
    if (method === 'GET' && path === '/dns') {
      await route.fulfill({
        json: {
          limit: 100,
          offset: 0,
          duration: 0.001,
          count: 1,
          total: 1,
          payload: [
            {
              id: 1,
              server: '192.0.2.53',
              doh_server: null,
              description: 'Synthetic DNS',
              created_at: 1700000000,
              created_at_hum: '2023-11-14 22:13:20',
            },
          ],
        },
      })
      return
    }
    if (method === 'GET' && (path === '/domains' || path === '/domains/search')) {
      if (this.nextDomainStatus !== null) {
        // status is consumed once so recovery can be tested against the same isolated backend.
        const status = this.nextDomainStatus
        this.nextDomainStatus = null
        await route.fulfill({ status, json: { error: 'Контролируемая ошибка списка доменов' } })
        return
      }
      // text selects searches held by race tests; other requests receive deterministic replies immediately.
      const text = url.searchParams.get('text') ?? ''
      if (path === '/domains/search' && this.holdSearches.has(text)) {
        this.heldSearches.set(text, route)
        return
      }
      if (path === '/domains' && this.holdDomains) {
        this.heldDomains.push(route)
        return
      }
      await route.fulfill({ json: this.domainPage(url) })
      return
    }
    if (method === 'POST' && path === '/domains') {
      // body is the actual domain creation array emitted by the form.
      const body: unknown = route.request().postDataJSON()
      this.mutations.push({ method, path, body })
      if (!Array.isArray(body) || body.length !== 1 || typeof body[0]?.domain !== 'string') {
        this.failures.push('Invalid domain creation body')
        await route.fulfill({ status: 422, json: { error: 'Invalid body' } })
        return
      }
      this.domains.push({ ...makeDomain(100, body[0].domain), ros_comment: body[0].ros_comment ?? '' })
      await route.fulfill({ json: { result: 'OK' } })
      return
    }
    if (method === 'DELETE' && /^\/domains\/\d+$/.test(path)) {
      this.mutations.push({ method, path, body: null })
      // id is the exact stored record selected by the user's confirmation.
      const id = Number(path.split('/').at(-1))
      this.domains = this.domains.filter(
        /** Retains domain unless its saved ID is the explicitly deleted entity. */
        (domain) => domain.id !== id,
      )
      await route.fulfill({ json: { result: 'OK' } })
      return
    }
    if (method === 'POST' && /^\/domains\/\d+\/resolve$/.test(path)) {
      this.mutations.push({ method, path, body: null })
      this.pendingResolves.add(Number(path.split('/')[2]))
      await route.fulfill({ status: 202, json: { result: 'OK' } })
      return
    }
    if (method === 'POST' && path === '/domains/resolve/check') {
      // body is the diagnostic request; checking never updates the saved domain collection.
      const body: unknown = route.request().postDataJSON()
      this.mutations.push({ method, path, body })
      await route.fulfill({
        json: {
          domain: 'dated.example.test',
          results: [{ server: '192.0.2.53', server_type: 'classic', ips_v4: ['192.0.2.99'], ips_v6: [], cnames: [] }],
        },
      })
      return
    }
    this.failures.push(`Unexpected API request: ${method} ${path}${url.search}`)
    await route.abort('blockedbyclient')
  }
}

/** Full synthetic configuration follows the backend's static/dynamic response shape. */
const configuration = {
  static: {
    root_path: '',
    root_log_level: 'INFO',
    app_title: 'GOST-RDPR',
    app_summary: 'Synthetic server',
    app_description: 'Isolated browser fixture',
    app_debug: false,
    app_version: '2.3.1',
    app_host: '127.0.0.1',
    app_port: 4000,
    app_log_level: 'INFO',
    queue_max_size: 100,
    queue_get_timeout: 1,
    queue_sleep_timeout: 1,
    db_log_level: 'INFO',
    db_timeout: 5,
    db_base_dir: '/synthetic',
    db_file_name: 'fixture.db',
    db_table_prefix: '',
    db_save_batch_size: 10,
    db_save_batch_timeout: 1,
    attempts_limit: 3,
    req_connection_retries: 1,
    req_timeout_default: 5,
    req_timeout_connect: 1,
    req_timeout_read: 5,
    req_max_connections: 10,
    req_max_keepalive_connections: 5,
    req_ssl_verify: true,
    req_default_limit: 20,
    domains_filtered_min_len: 3,
    domains_update_interval: 60,
    domain_resolve_semaphore_limit: 1,
    domains_black_list: '',
    lists_update_interval_sec: 60,
    ip_not_allowed: '',
    ros_rest_api_read_timeout: 5,
  },
  dynamic: {
    ip_not_allowed_list: [],
    app_title_metrics: 'gost_rdpr',
    db_path: '/synthetic/fixture.db',
    db_connection: 'sqlite+aiosqlite:///synthetic/fixture.db',
  },
}

/** Test fixtures expose a fresh API controller alongside Playwright's isolated page and context. */
interface BrowserFixtures {
  /** Per-test API state and network guard. */
  api: BrowserApi
}

/** The api fixture callback installs guards before use and verifies captured failures after the test. */
export const test = base.extend<BrowserFixtures>({
  api: async ({ page }, use) => {
    // api is owned only by this test; Playwright discards its browser context after teardown.
    const api = new BrowserApi()
    await api.install(page)
    await use(api)
    expect(api.failures, 'No unexpected browser exceptions, console errors, or outgoing requests').toEqual([])
  },
})

export { expect }
