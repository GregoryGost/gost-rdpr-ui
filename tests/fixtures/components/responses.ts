import type { Domain } from '@/api/types/domains'
import type { DomainsResponse } from '@/api/endpoints/domains'
import type { StatsResponse, StatsGrowthResponse } from '@/api/types/stats'

/** Exposes settlement controls so tests choose response order without real timers or network IO. */
export function deferred<T>() {
  // resolve publishes a successful response; reject publishes a failure to the same pending promise.
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  // promise stays pending until a scenario explicitly settles it; the executor captures both controls.
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

/** Builds the minimum saved domain used by page contracts; name and id identify the visible row. */
export function domain(name: string, id = 1): Domain {
  return {
    // id identifies the stored row; name is its display/search value; resolved selects its status.
    id,
    name,
    resolved: true,
    // created_at and created_at_hum are synthetic backend timestamp representations.
    created_at: 1_700_000_000,
    created_at_hum: '2023-11-14 22:13:20',
  }
}

/** Builds a single backend page; the optional total can exceed payload length for pagination checks. */
export function domainPage(payload: Domain[], total = payload.length): DomainsResponse {
  return {
    // payload contains backend rows; count counts this response; total and total_query count matching rows.
    payload,
    count: payload.length,
    total,
    total_query: total,
    // limit and offset identify the requested page; duration is a synthetic response time in seconds.
    limit: 20,
    offset: 0,
    duration: 0,
    // total_resolved counts the resolved records represented by this synthetic result.
    total_resolved: payload.length,
  }
}

/** Supplies independent global statistics whose domain counts intentionally differ from table results. */
export function statistics(): StatsResponse {
  return {
    // generated_at is the server's display timestamp.
    generated_at: '2026-11-14 12:00:00',
    // dns describes two classic servers and one DoH server.
    dns: { total: 3, classic: 2, doh: 1 },
    // domains counts 42 records, including 30 resolved and nine unprocessed; no domain lists exist in this fixture.
    domains: { total: 42, resolved: 30, unresolved: 12, unprocessed: 9, lists_total: 0, per_list: [] },
    // ips counts eight addresses, split by family and association; there are no IP lists.
    ips: { total: 8, v4_total: 5, v6_total: 3, linked_to_domain: 6, standalone: 2, lists_total: 0, per_list: [] },
    // ros counts the single synthetic RouterOS configuration.
    ros: { total: 1 },
  }
}

/** Provides an empty chart window with a nonzero aggregate so successful rendering is observable. */
export function growth(): StatsGrowthResponse {
  return {
    // entity and granularity identify the requested minute buckets for domains.
    entity: 'domains',
    granularity: 'minute',
    // start_date, end_date and ip_subtype remain unset in this isolated response fixture.
    start_date: null,
    end_date: null,
    ip_subtype: null,
    // total_in_period is the rendered aggregate; payload has no plotted points; duration is seconds.
    total_in_period: 17,
    payload: [],
    duration: 0.001,
  }
}
