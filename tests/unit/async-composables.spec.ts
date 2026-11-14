import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useApi } from '@/composables/useApi'
import { usePaginatedData } from '@/composables/usePaginatedData'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { ApiError } from '@/api/client'
import { errorHandler } from '@/utils/errorHandler'
import { deferred, mountComposable } from '../fixtures/unit/harness'

/** API execution publishes only current results and reports failures through the documented public channel. */
describe('useApi', () => {
  /** A failure preserves the last success and a retry clears the previous failure immediately. */
  it('loads, fails with an API message and recovers on retry', async () => {
    /** request returns a success, an API failure and a second success in that order. */
    const request = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new ApiError(422, 'Некорректный домен'))
      .mockResolvedValueOnce('recovered')
    /** api exposes loading, result and errors from the mounted composable. */
    const { result: api } = mountComposable(() => useApi(request, false))
    expect(api.data.value).toBeNull()
    /** first remains pending until its microtask is observed. */
    const first = api.execute()
    expect(api.isLoading.value).toBe(true)
    await first
    expect(api.data.value).toBe('first')
    expect(api.isLoading.value).toBe(false)
    await api.execute()
    expect(api.data.value).toBe('first')
    expect(api.hasError.value).toBe(true)
    expect(api.errorMessage.value).toBe('Некорректный домен')
    expect(api.isLoading.value).toBe(false)
    /** retry clears the old error before the new response settles. */
    const retry = api.execute()
    expect(api.hasError.value).toBe(false)
    expect(api.errorMessage.value).toBeNull()
    expect(api.isLoading.value).toBe(true)
    await retry
    expect(api.data.value).toBe('recovered')
    expect(api.isLoading.value).toBe(false)
  })

  /** Notification opt-in must deliver one structured error; opting out still exposes local error state. */
  it.each([true, false])('uses notification opt-in %s for unexpected errors', async (showNotification) => {
    /** listener records only errors emitted during this scenario and is removed in finally. */
    const listener = vi.fn()
    errorHandler.onError(listener)
    try {
      /** request rejects with an ordinary exception to exercise the safe public fallback text. */
      const request = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('synthetic failure'))
      /** api is isolated within its own lifecycle scope. */
      const { result: api } = mountComposable(() => useApi(request, showNotification))
      await api.execute()
      expect(api.errorMessage.value).toBe('Произошла непредвиденная ошибка')
      expect(api.hasError.value).toBe(true)
      expect(api.isLoading.value).toBe(false)
      expect(listener).toHaveBeenCalledTimes(showNotification ? 1 : 0)
      if (showNotification)
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ message: 'synthetic failure' }))
    } finally {
      errorHandler.offError(listener)
    }
  })

  /** An older successful response cannot replace a result from the newest execution. */
  it('keeps the newest success when responses complete in reverse order', async () => {
    /** older and newer are independently settled requests. */
    const older = deferred<string>()
    const newer = deferred<string>()
    /** request binds each invocation to its own deferred response. */
    const request = vi.fn<() => Promise<string>>().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    /** api holds the current result; oldRun and newRun track completion without changing response order. */
    const { result: api } = mountComposable(() => useApi(request))
    const oldRun = api.execute()
    const newRun = api.execute()
    newer.resolve('newest')
    await newRun
    older.resolve('obsolete')
    await oldRun
    expect(api.data.value).toBe('newest')
    expect(api.hasError.value).toBe(false)
    expect(api.isLoading.value).toBe(false)
  })

  /** Stale failures cannot report an error or end loading for the still-pending newest request. */
  it('suppresses an obsolete rejection and its loading completion', async () => {
    /** older rejects while newer is intentionally left in flight. */
    const older = deferred<string>()
    const newer = deferred<string>()
    /** listener would receive a wrongly published obsolete failure. */
    const listener = vi.fn()
    errorHandler.onError(listener)
    try {
      /** request supplies two overlapping calls. */
      const request = vi
        .fn<() => Promise<string>>()
        .mockReturnValueOnce(older.promise)
        .mockReturnValueOnce(newer.promise)
      /** api, oldRun and newRun retain public state and both call completions. */
      const { result: api } = mountComposable(() => useApi(request))
      const oldRun = api.execute()
      const newRun = api.execute()
      older.reject(new ApiError(500, 'obsolete failure'))
      await oldRun
      expect(api.isLoading.value).toBe(true)
      expect(api.hasError.value).toBe(false)
      expect(api.errorMessage.value).toBeNull()
      expect(listener).not.toHaveBeenCalled()
      newer.resolve('current')
      await newRun
      expect(api.data.value).toBe('current')
    } finally {
      errorHandler.offError(listener)
    }
  })

  /** Teardown prevents both result publication and later execute calls from starting work. */
  it('ignores a response after unmount and refuses later executions', async () => {
    /** pending represents a transport request that cannot be physically cancelled. */
    const pending = deferred<string>()
    /** request records whether disposed controls accidentally launch more work. */
    const request = vi.fn(() => pending.promise)
    /** api supplies public refs and wrapper owns their lifetime. */
    const { result: api, wrapper } = mountComposable(() => useApi(request))
    /** run completes only after teardown, exercising stale continuation suppression. */
    const run = api.execute()
    wrapper.unmount()
    pending.resolve('too late')
    await run
    expect(api.data.value).toBeNull()
    await api.execute()
    expect(request).toHaveBeenCalledTimes(1)
  })

  /** Failures from a disposed component cannot create a notification on the page now being viewed. */
  it('suppresses errors and notifications after unmount', async () => {
    /** pending keeps a request in flight until after its owning component is gone. */
    const pending = deferred<string>()
    /** listener detects an incorrectly published error and is explicitly unsubscribed. */
    const listener = vi.fn()
    errorHandler.onError(listener)
    try {
      /** api and wrapper expose public error refs and the component teardown operation. */
      const { result: api, wrapper } = mountComposable(() => useApi(() => pending.promise))
      /** run waits for the deliberately late rejection. */
      const run = api.execute()
      wrapper.unmount()
      pending.reject(new ApiError(500, 'late failure'))
      await run
      expect(api.hasError.value).toBe(false)
      expect(api.errorMessage.value).toBeNull()
      expect(listener).not.toHaveBeenCalled()
    } finally {
      errorHandler.offError(listener)
    }
  })
})

/** A search intent can invalidate pending results before its debounce timer starts another request. */
describe('useLatestRequest', () => {
  /** Captured publication permission expires on a new intent, a new request and component disposal. */
  it('invalidates captured work immediately and permanently after unmount', () => {
    /** requests and wrapper expose the public guard API and its owning Vue scope. */
    const { result: requests, wrapper } = mountComposable(useLatestRequest)
    /** initial may publish before any later user intent supersedes it. */
    const initial = requests.capture()
    expect(initial()).toBe(true)
    requests.invalidate()
    expect(initial()).toBe(false)
    /** newer represents work captured after the new intent but before a newer transport begins. */
    const newer = requests.capture()
    expect(newer()).toBe(true)
    /** latest is the guard returned when another execution starts. */
    const latest = requests.begin()
    expect(newer()).toBe(false)
    expect(latest()).toBe(true)
    wrapper.unmount()
    expect(latest()).toBe(false)
    expect(requests.begin()()).toBe(false)
  })
})

/** Page loaders keep rows and total from the same accepted response while supporting navigation. */
describe('usePaginatedData', () => {
  /** Public navigation wrappers send the selected offset and size, and reset reloads page one. */
  it('loads coherent rows and totals and reloads through navigation controls', async () => {
    /** loader returns a small page with a larger matching total so navigation remains meaningful. */
    const loader = vi.fn(async () => ({ payload: ['row'], total: 45 }))
    /** page exposes the loaded data and pagination controls. */
    const { result: page } = mountComposable(() => usePaginatedData(loader, 20))
    /** first is the initial pending load, before its promise microtask completes. */
    const first = page.load()
    expect(page.isLoading.value).toBe(true)
    await first
    expect(page.data.value).toEqual(['row'])
    expect(page.pagination.totalItems.value).toBe(45)
    expect(page.isLoading.value).toBe(false)
    page.goToPage(2)
    await flushPromises()
    expect(loader).toHaveBeenLastCalledWith({ limit: 20, offset: 20 })
    page.nextPage()
    await flushPromises()
    expect(loader).toHaveBeenLastCalledWith({ limit: 20, offset: 40 })
    page.prevPage()
    await flushPromises()
    expect(loader).toHaveBeenLastCalledWith({ limit: 20, offset: 20 })
    await page.refresh()
    expect(loader).toHaveBeenLastCalledWith({ limit: 20, offset: 20 })
    page.changePageSize(10)
    await flushPromises()
    expect(loader).toHaveBeenLastCalledWith({ limit: 10, offset: 0 })
    page.goToPage(3)
    await flushPromises()
    page.reset()
    await flushPromises()
    expect(loader).toHaveBeenLastCalledWith({ limit: 10, offset: 0 })
    expect(page.pagination.currentPage.value).toBe(1)
  })

  /** Current load failure removes outdated rows/counts and leaves the loader usable for a retry. */
  it('clears rows and totals on current failure and recovers', async () => {
    /** loader returns success, failure, then an empty successful dataset. */
    const loader = vi
      .fn<() => Promise<{ payload: string[]; total: number }>>()
      .mockResolvedValueOnce({ payload: ['old'], total: 1 })
      .mockRejectedValueOnce(new Error('synthetic failure'))
      .mockResolvedValueOnce({ payload: [], total: 0 })
    /** page owns the public loading and pagination state. */
    const { result: page } = mountComposable(() => usePaginatedData(loader))
    await page.load()
    await page.load()
    expect(page.data.value).toEqual([])
    expect(page.pagination.totalItems.value).toBe(0)
    expect(page.isLoading.value).toBe(false)
    await page.refresh()
    expect(page.data.value).toEqual([])
    expect(loader).toHaveBeenCalledTimes(3)
  })

  /** Both obsolete success and failure leave the latest page and its matching total intact. */
  it.each(['success', 'failure'])('ignores stale %s after a newer page succeeds', async (outcome) => {
    /** older and newer carry different rows/counts so mixed publication is observable. */
    const older = deferred<{ payload: string[]; total: number }>()
    const newer = deferred<{ payload: string[]; total: number }>()
    /** loader assigns each invocation its own controlled result. */
    const loader = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    /** page, first and second retain state and both load completions. */
    const { result: page } = mountComposable(() => usePaginatedData<string>(loader))
    const first = page.load()
    const second = page.load()
    newer.resolve({ payload: ['new'], total: 81 })
    await second
    if (outcome === 'success') older.resolve({ payload: ['old'], total: 3 })
    else older.reject(new Error('old failure'))
    await first
    expect(page.data.value).toEqual(['new'])
    expect(page.pagination.totalItems.value).toBe(81)
    expect(page.isLoading.value).toBe(false)
  })

  /** Finishing an older request cannot release loading while the latest page is pending. */
  it('keeps loading owned by the latest request and ignores completion after unmount', async () => {
    /** older and newer remain independently pending until this test settles each one. */
    const older = deferred<{ payload: string[]; total: number }>()
    const newer = deferred<{ payload: string[]; total: number }>()
    /** loader supplies both requests without network IO. */
    const loader = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    /** page and wrapper expose state and disposal; first and second are the corresponding loads. */
    const { result: page, wrapper } = mountComposable(() => usePaginatedData<string>(loader))
    const first = page.load()
    const second = page.load()
    older.resolve({ payload: ['old'], total: 1 })
    await first
    expect(page.isLoading.value).toBe(true)
    expect(page.data.value).toEqual([])
    wrapper.unmount()
    newer.resolve({ payload: ['late'], total: 90 })
    await second
    expect(page.data.value).toEqual([])
    expect(page.pagination.totalItems.value).toBe(0)
  })
})
