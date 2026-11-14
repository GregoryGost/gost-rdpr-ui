import { describe, expect, it, vi } from 'vitest'
import { usePagination } from '@/composables/usePagination'
import { loadClientFilteredPage } from '@/utils/clientPagination'
import { loadAttemptsFilteredPage, matchesAttemptsFilter } from '@/utils/attemptsPagination'
import type { AttemptsFilter } from '@/utils/attemptsPagination'
import type { PaginatedResponse } from '@/api/types/common'
import {
  getColumnKey,
  getFilterValue,
  hasColumnFilters,
  isFilterableColumn,
  matchesColumnFilters,
  normalizeFilterValue,
  type TableColumn,
} from '@/ui/tables/columnFilters'

/** Verifies empty, boundary and reset behavior through the public pagination controls. */
describe('usePagination', () => {
  /** Empty datasets cannot move in either direction or accept an out-of-range page. */
  it('keeps an empty dataset on the first page', () => {
    /** pagination represents the default empty table. */
    const pagination = usePagination()
    pagination.nextPage()
    pagination.prevPage()
    pagination.goToPage(2)
    expect(pagination.currentPage.value).toBe(1)
    expect(pagination.offset.value).toBe(0)
    expect(pagination.totalPages.value).toBe(0)
    expect(pagination.hasNextPage.value).toBe(false)
    expect(pagination.hasPrevPage.value).toBe(false)
    expect(pagination.pageSize.value).toBe(20)
  })

  /** A 41-row table has two full pages and one tail; size changes return to its first page. */
  it('respects both boundaries, changes size and resets totals', () => {
    /** pagination uses 20-row pages to make the final partial page explicit. */
    const pagination = usePagination(20)
    pagination.totalItems.value = 41
    pagination.goToPage(3)
    expect(pagination.offset.value).toBe(40)
    expect(pagination.totalPages.value).toBe(3)
    expect(pagination.hasNextPage.value).toBe(false)
    expect(pagination.hasPrevPage.value).toBe(true)
    pagination.nextPage()
    pagination.goToPage(0)
    pagination.goToPage(4)
    expect(pagination.currentPage.value).toBe(3)
    pagination.prevPage()
    expect(pagination.offset.value).toBe(20)
    pagination.changePageSize(50)
    expect(pagination.currentPage.value).toBe(1)
    expect(pagination.offset.value).toBe(0)
    expect(pagination.totalPages.value).toBe(1)
    pagination.reset()
    expect(pagination.totalItems.value).toBe(0)
    expect(pagination.pageSize.value).toBe(50)
  })
})

/** Synthetic source row with an ID, an attempt category and a searchable group. */
interface Row {
  /** Stable source order, starting at one. */
  id: number
  /** Retry count used by the attempts categories. */
  attempts: number
  /** Client-only column filter value. */
  group: string
}

/** Creates 205 rows, with matching rows deliberately spanning three backend pages. */
function createRows(): Row[] {
  /** rows is the unfiltered backend collection, ordered by ID. */
  const rows: Row[] = []
  /** id identifies each synthetic record and its position in backend order. */
  for (let id = 1; id <= 205; id += 1) {
    rows.push({ id, attempts: id % 4, group: id % 2 === 0 ? 'selected' : 'other' })
  }
  return rows
}

/** Builds a transport-free backend fixture; total_query describes the actual search subset. */
function createBackend(rows: Row[], declaredTotal = rows.length) {
  /** fetchPage returns a genuine backend slice; limit/offset locate it, count measures it,
   * total is the global count, total_query is the subset count and duration is synthetic metadata.
   */
  const fetchPage = vi.fn(async ({ limit = 100, offset = 0 }: { limit?: number; offset?: number }) => ({
    payload: rows.slice(offset, offset + limit),
    count: rows.slice(offset, offset + limit).length,
    total: 999,
    total_query: declaredTotal,
    limit,
    offset,
    duration: 0.01,
  }))
  return fetchPage
}

/** Verifies filtering before pagination using explicit expected IDs and independent source sizes. */
describe('client-filtered pagination', () => {
  /** Filtering odd rows away must happen before skipping the first 49 matching records. */
  it('returns an exact filtered page and total across three backend pages', async () => {
    /** fetchPage owns the 205-row synthetic backend. */
    const fetchPage = createBackend(createRows())
    /** page selects the 50th through 53rd even IDs, not the same offset in raw rows. */
    const page = await loadClientFilteredPage<Row, Awaited<ReturnType<typeof fetchPage>>>(
      fetchPage,
      { limit: 4, offset: 49 },
      /** Keeps only selected-group rows before the requested filtered offset is applied. */
      (row) => row.group === 'selected',
    )
    expect(page).toMatchObject({
      payload: [{ id: 100 }, { id: 102 }, { id: 104 }, { id: 106 }],
      count: 4,
      total: 102,
      total_query: 102,
      limit: 4,
      offset: 49,
    })
    // The projection reads each call's params.offset to verify the exact backend pages requested.
    expect(fetchPage.mock.calls.map(([params]) => params.offset)).toEqual([0, 100, 200])
  })

  /** The tail and past-the-end pages retain the filtered total rather than the backend's global total. */
  it('keeps exact metadata for the last page and an empty page', async () => {
    /** fetchPage supplies all 205 rows for both independent requests. */
    const fetchPage = createBackend(createRows())
    /** tail selects only the last two even IDs. */
    const tail = await loadClientFilteredPage<Row, Awaited<ReturnType<typeof fetchPage>>>(
      fetchPage,
      { limit: 10, offset: 100 },
      /** Keeps selected-group rows across all backend pages before selecting the tail. */
      (row) => row.group === 'selected',
    )
    // The projection compares each returned row's stable ID rather than incidental fixture fields.
    expect(tail.payload.map((row) => row.id)).toEqual([202, 204])
    expect(tail).toMatchObject({ count: 2, total: 102, total_query: 102, limit: 10, offset: 100 })
    /** empty asks past the last filtered row. */
    const empty = await loadClientFilteredPage<Row, Awaited<ReturnType<typeof fetchPage>>>(
      fetchPage,
      { limit: 10, offset: 102 },
      /** Applies the same selected-group predicate even when the requested page has no rows. */
      (row) => row.group === 'selected',
    )
    expect(empty).toMatchObject({ payload: [], count: 0, total: 102, total_query: 102, limit: 10, offset: 102 })
  })

  /** Empty sources terminate immediately, and supplied filtered totals allow early completion. */
  it('handles empty sources, known totals and backend passthrough', async () => {
    /** emptyBackend represents an empty search result despite a nonzero global total. */
    const emptyBackend = createBackend([])
    expect(await loadClientFilteredPage(emptyBackend, { limit: 10, offset: 0 })).toMatchObject({
      payload: [],
      count: 0,
      total: 0,
      total_query: 0,
    })
    expect(emptyBackend).toHaveBeenCalledTimes(1)
    /** fetchPage supplies an existing known filtered count of 102. */
    const fetchPage = createBackend(createRows())
    /** first is filled by the first backend page and retains the known total. */
    const first = await loadClientFilteredPage<Row, Awaited<ReturnType<typeof fetchPage>>>(
      fetchPage,
      { limit: 2, offset: 0 },
      /** Matches the known filtered population by keeping selected-group rows. */
      (row) => row.group === 'selected',
      {
        knownTotal: 102,
        stopWhenPageFilled: true,
      },
    )
    // The projection exposes each returned row's ID for an independent expected-order assertion.
    expect(first.payload.map((row) => row.id)).toEqual([2, 4])
    expect(first).toMatchObject({ count: 2, total: 102, total_query: 102, limit: 2, offset: 0 })
    expect(fetchPage).toHaveBeenCalledTimes(1)
    fetchPage.mockClear()
    await loadClientFilteredPage(fetchPage, { limit: 10, offset: 20 }, undefined, false)
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith({ limit: 10, offset: 20 })
  })

  /** A search subset's total_query prevents requests for pages that belong only to the global collection. */
  it('uses total_query to bound backend requests', async () => {
    /** fetchPage exposes a full 100-row search subset with a global total of 999. */
    const fetchPage = createBackend(createRows().slice(0, 100), 100)
    /** page retains the search subset size after client processing. */
    const page = await loadClientFilteredPage(fetchPage, { limit: 10, offset: 0 })
    expect(page).toMatchObject({ count: 10, total: 100, total_query: 100 })
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})

/** Attempts categories follow the displayed success, error and critical boundaries. */
describe('attempts pagination', () => {
  /** Each category is checked against explicit membership at zero, one, two and three attempts. */
  it.each<[AttemptsFilter, boolean[]]>([
    ['all', [true, true, true, true]],
    ['success', [true, false, false, false]],
    ['errors', [false, true, true, false]],
    ['critical', [false, false, false, true]],
  ])('classifies %s at each boundary', (filter, expected) => {
    // The mapping evaluates each explicit attempts boundary using the selected public category filter.
    expect([0, 1, 2, 3].map((attempts) => matchesAttemptsFilter({ attempts }, filter))).toEqual(expected)
  })

  /** Error-category and column filters must both run before selecting a page. */
  it('combines category and column filters across backend pages', async () => {
    /** backend ignores attempts filtering as the errors category cannot be expressed as equality. */
    const backend = createBackend(createRows())
    /** page contains the second and third even rows with one or two attempts. */
    const page = await loadAttemptsFilteredPage<Row>(backend, { limit: 2, offset: 1 }, 'errors', {
      /** Restricts each row to the client-only selected group in addition to its attempts category. */
      filterItem: (row) => row.group === 'selected',
    })
    // The projection compares returned row IDs with the independently enumerated expected page.
    expect(page.payload.map((row) => row.id)).toEqual([6, 10])
    expect(page).toMatchObject({ count: 2, total: 51, limit: 2, offset: 1 })
  })

  /** The exact-success request preserves attempts=0 and still derives a filtered total. */
  it('sends attempts zero for success and bypasses client paging for all', async () => {
    /** rows are explicit success records; response totals intentionally include unrelated records. */
    const rows: Row[] = [
      { id: 4, attempts: 0, group: 'selected' },
      { id: 8, attempts: 0, group: 'selected' },
    ]
    /** fetchPage accepts the public optional backend filter and returns a short terminal page. */
    const fetchPage = vi.fn(async (): Promise<PaginatedResponse<Row>> => ({
      payload: rows,
      limit: 100,
      offset: 0,
      count: 2,
      total: 205,
      duration: 0,
    }))
    expect(await loadAttemptsFilteredPage(fetchPage, { limit: 1, offset: 1 }, 'success')).toMatchObject({
      payload: [rows[1]],
      count: 1,
      total: 2,
      offset: 1,
      limit: 1,
    })
    expect(fetchPage).toHaveBeenCalledWith({ limit: 100, offset: 0, attempts: 0 })
    fetchPage.mockClear()
    await loadAttemptsFilteredPage(fetchPage, { limit: 20, offset: 40 }, 'all')
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith({ limit: 20, offset: 40 })
  })
})

/** Column filtering normalizes values and combines searchable columns with Russian case folding. */
describe('column filters', () => {
  /** Null values disappear, arrays join with spaces, and booleans/numbers retain meaningful text. */
  it.each([
    [null, ''],
    [undefined, ''],
    [[1, 'ТЕСТ'], '1 ТЕСТ'],
    [false, 'false'],
    [0, '0'],
  ])('normalizes %j as %s', (value, expected) => {
    expect(normalizeFilterValue(value)).toBe(expected)
  })

  /** Multiple populated column filters are conjunctive; actions and disabled columns are excluded. */
  it('combines normalized queries, custom values and disabled columns', () => {
    /** row has a Cyrillic name, an array address and a null note. */
    const row = { name: 'ПРИМЕР.РФ', addresses: ['192.0.2.1', '2001:db8::1'], note: null, resolved: true }
    /** columns declare public names; the resolved-label callback converts item.resolved into Russian status text. */
    const columns: TableColumn<typeof row>[] = [
      { key: 'name', label: 'Имя' },
      { key: 'addresses', label: 'Адреса' },
      { key: 'note', label: 'Комментарий' },
      { key: 'resolved', label: 'Статус', filterValue: (item) => (item.resolved ? 'Определён' : 'Нет') },
      { key: 'actions', label: 'Действия' },
      { key: 'ignored', label: 'Скрыто', filterable: false },
    ]
    expect(
      matchesColumnFilters(row, columns, {
        name: '  пример ',
        addresses: 'DB8',
        resolved: 'ОПРЕДЕЛЁН',
        actions: 'missing',
        ignored: 'missing',
      }),
    ).toBe(true)
    expect(matchesColumnFilters(row, columns, { name: 'пример', addresses: '203.0.113' })).toBe(false)
    expect(matchesColumnFilters(row, columns, { note: 'NULL' })).toBe(false)
    expect(hasColumnFilters({ name: '  ', note: '' })).toBe(false)
    expect(hasColumnFilters({ name: ' пример ' })).toBe(true)
    expect(getColumnKey(columns[0]!)).toBe('name')
    expect(getFilterValue(row, columns[1]!)).toBe('192.0.2.1 2001:db8::1')
    expect(isFilterableColumn(columns[4]!)).toBe(false)
  })
})
