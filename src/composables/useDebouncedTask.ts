import { onBeforeUnmount } from 'vue'
import { SEARCH } from '@/constants'

export interface DebouncedTask {
  run: () => void
  cancel: () => void
}

/**
 * Create a debounced task and clear pending execution on component unmount.
 * @param task - Task executed after the debounce delay.
 * @param delay - Delay before task execution in milliseconds.
 * @returns Debounced task controls.
 */
export function useDebouncedTask(task: () => Promise<void> | void, delay: number = SEARCH.DEBOUNCE_MS): DebouncedTask {
  let timeout: ReturnType<typeof setTimeout> | null = null

  const cancel = () => {
    if (!timeout) return

    clearTimeout(timeout)
    timeout = null
  }

  const run = () => {
    cancel()
    timeout = setTimeout(() => {
      timeout = null
      void task()
    }, delay)
  }

  onBeforeUnmount(cancel)

  return {
    run,
    cancel,
  }
}
