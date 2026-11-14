import { onBeforeUnmount } from 'vue'
import { SEARCH } from '@/constants'
import { errorHandler } from '@/utils/errorHandler'

/** Controls scheduling without cancelling a task that has already started. */
export interface DebouncedTask {
  /** Replaces pending execution with a new execution after the debounce delay. */
  run: () => void
  /** Clears a scheduled execution that has not started yet. */
  cancel: () => void
}

/**
 * Creates a debounced task and clears pending execution on component unmount.
 * Uncaught task failures go through errorHandler; tasks that handle their own errors resolve normally.
 * @param task - Work awaited after the debounce delay; synchronous throws and promise rejections are handled.
 * @param delay - Delay before task execution in milliseconds.
 * @returns Debounced task controls.
 */
export function useDebouncedTask(task: () => Promise<void> | void, delay: number = SEARCH.DEBOUNCE_MS): DebouncedTask {
  // timeout identifies the scheduled execution, or null when no execution is waiting.
  let timeout: ReturnType<typeof setTimeout> | null = null

  /** Clears the pending timeout without interrupting task work that has already started. */
  const cancel = () => {
    if (timeout === null) return

    clearTimeout(timeout)
    timeout = null
  }

  /** Restarts the debounce delay; its timeout callback awaits the task and reports uncaught failures once. */
  const run = () => {
    cancel()
    timeout = setTimeout(async () => {
      timeout = null
      try {
        await task()
      } catch (error) {
        // error is the task failure that escaped the caller's own error handling.
        errorHandler.handleError(error, { action: 'debouncedTask' })
      }
    }, delay)
  }

  onBeforeUnmount(cancel)

  return {
    run,
    cancel,
  }
}
