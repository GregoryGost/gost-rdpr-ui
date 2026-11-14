import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedTask } from '@/composables/useDebouncedTask'
import { usePolling } from '@/composables/usePolling'
import { errorHandler } from '@/utils/errorHandler'
import { deferred, mountComposable } from '../fixtures/unit/harness'

/** Uses virtual time so delay boundaries and timer leaks are deterministic. */
beforeEach(() => {
  vi.useFakeTimers()
})

/** Debounce schedules only the last intent and reports task failures without leaking a rejection. */
describe('useDebouncedTask', () => {
  /** A second run restarts the full delay; cancellation and unmount discard only pending work. */
  it('replaces pending work, cancels it and cleans up on unmount', async () => {
    /** task counts actual executions rather than schedule requests. */
    const task = vi.fn()
    /** controls and wrapper expose scheduling and the component lifetime. */
    const { result: controls, wrapper } = mountComposable(() => useDebouncedTask(task, 100))
    controls.run()
    await vi.advanceTimersByTimeAsync(99)
    controls.run()
    await vi.advanceTimersByTimeAsync(99)
    expect(task).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(task).toHaveBeenCalledTimes(1)
    controls.run()
    controls.cancel()
    await vi.advanceTimersByTimeAsync(100)
    expect(task).toHaveBeenCalledTimes(1)
    controls.run()
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(100)
    expect(task).toHaveBeenCalledTimes(1)
  })

  /** Both immediate exceptions and rejected promises reach the public error channel exactly once. */
  it.each(['throw', 'reject'])('reports a task %s and allows another run', async (failureMode) => {
    /** failure is the exact task error and listener receives its structured public notification. */
    const failure = new Error('synthetic task failure')
    const listener = vi.fn()
    errorHandler.onError(listener)
    try {
      /** task fails on the first run using the selected failure path, then succeeds. */
      const task = vi.fn<() => Promise<void> | void>().mockImplementationOnce(() => {
        if (failureMode === 'throw') throw failure
        return Promise.reject(failure)
      })
      /** controls expose the reusable scheduler. */
      const { result: controls } = mountComposable(() => useDebouncedTask(task, 100))
      controls.run()
      await vi.advanceTimersByTimeAsync(100)
      expect(listener).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ originalError: failure }))
      controls.run()
      await vi.advanceTimersByTimeAsync(100)
      expect(task).toHaveBeenCalledTimes(2)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      errorHandler.offError(listener)
    }
  })

  /** Cancelling scheduling does not interrupt work which has already entered the task. */
  it('keeps an already started task alive when cancel is called', async () => {
    /** pending controls the task's completion after cancellation. */
    const pending = deferred<void>()
    /** task starts at the delay boundary and waits on pending. */
    const task = vi.fn(() => pending.promise)
    /** controls are mounted with a short explicit debounce delay. */
    const { result: controls } = mountComposable(() => useDebouncedTask(task, 100))
    controls.run()
    await vi.advanceTimersByTimeAsync(100)
    controls.cancel()
    expect(task).toHaveBeenCalledTimes(1)
    pending.resolve(undefined)
    await Promise.resolve()
    expect(vi.getTimerCount()).toBe(0)
  })
})

/** Polling uses fixed ticks and skips busy ticks, including while its timer is restarted. */
describe('usePolling', () => {
  /** Startup schedules a timer; it does not synchronously call the polling callback. */
  it('starts once, waits an interval, stops and cleans up at unmount', async () => {
    /** task records calls from available ticks. */
    const task = vi.fn()
    /** polling and wrapper expose timer controls and lifecycle disposal. */
    const { result: polling, wrapper } = mountComposable(() => usePolling(task, { interval: 100 }))
    expect(polling.isActive.value).toBe(true)
    expect(task).not.toHaveBeenCalled()
    polling.start()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(task).toHaveBeenCalledTimes(1)
    polling.stop()
    expect(polling.isActive.value).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(task).toHaveBeenCalledTimes(1)
    polling.start()
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  /** A long request blocks all busy ticks without queueing a catch-up call after completion. */
  it('skips busy ticks across restart and interval changes', async () => {
    /** pending is the first long-running callback. */
    const pending = deferred<void>()
    /** task waits only for its first invocation; later available ticks complete normally. */
    const task = vi.fn<() => Promise<void> | void>().mockReturnValueOnce(pending.promise)
    /** polling owns a 100 ms timer. */
    const { result: polling } = mountComposable(() => usePolling(task, { interval: 100 }))
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(300)
    polling.restart()
    await vi.advanceTimersByTimeAsync(100)
    polling.updateInterval(50)
    await vi.advanceTimersByTimeAsync(100)
    expect(task).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    pending.resolve(undefined)
    await Promise.resolve()
    expect(task).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(50)
    expect(task).toHaveBeenCalledTimes(2)
  })

  /** Zero disables scheduling, and an explicit start is required when immediate is false. */
  it('supports disabled polling, manual start and interval replacement', async () => {
    /** task counts only timer-triggered work; intervalGetter supplies the initial 100 ms delay. */
    const task = vi.fn()
    const intervalGetter = vi.fn(() => 100)
    /** polling begins inactive because immediate is false. */
    const { result: polling } = mountComposable(() => usePolling(task, { interval: intervalGetter, immediate: false }))
    expect(polling.isActive.value).toBe(false)
    expect(intervalGetter).toHaveBeenCalledTimes(1)
    polling.start()
    await vi.advanceTimersByTimeAsync(100)
    expect(task).toHaveBeenCalledTimes(1)
    polling.updateInterval(0)
    polling.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(task).toHaveBeenCalledTimes(1)
    expect(polling.isActive.value).toBe(false)
    polling.updateInterval(40)
    expect(polling.currentInterval.value).toBe(40)
    await vi.advanceTimersByTimeAsync(39)
    expect(task).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(task).toHaveBeenCalledTimes(2)
  })

  /** A failed callback releases the pending guard so the next available tick can proceed. */
  it.each(['throw', 'reject'])('reports %s and continues polling', async (failureMode) => {
    /** failure is a controlled callback exception; onError captures the public failure channel. */
    const failure = new Error('synthetic polling failure')
    const onError = vi.fn()
    /** task uses either a synchronous throw or a rejected promise for its first invocation. */
    const task = vi.fn<() => Promise<void> | void>().mockImplementationOnce(() => {
      if (failureMode === 'throw') throw failure
      return Promise.reject(failure)
    })
    mountComposable(() => usePolling(task, { interval: 100, onError }))
    await vi.advanceTimersByTimeAsync(200)
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
    expect(task).toHaveBeenCalledTimes(2)
  })

  /** Omitting an error callback retains console reporting and must not stop later ticks. */
  it('reports failures to the console when no handler is supplied', async () => {
    /** failure is the controlled rejected callback and report captures the documented fallback channel. */
    const failure = new Error('synthetic polling failure')
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    /** task fails once, allowing the following tick to prove that the pending guard was released. */
    const task = vi.fn<() => Promise<void> | void>().mockRejectedValueOnce(failure)
    mountComposable(() => usePolling(task, { interval: 100 }))
    await vi.advanceTimersByTimeAsync(200)
    expect(report).toHaveBeenCalledExactlyOnceWith('Polling error:', failure)
    expect(task).toHaveBeenCalledTimes(2)
  })
})
