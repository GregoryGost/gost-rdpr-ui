import { ref, onUnmounted } from 'vue'

/**
 * Configures fixed-interval polling and optional error reporting.
 */
interface PollingOptions {
  /** Delay in milliseconds; a getter is evaluated once when the composable is created. */
  interval: number | (() => number)
  /** Starts the timer during setup by default; the first callback still waits one interval. */
  immediate?: boolean
  /** Receives callback failures instead of the default console error. */
  onError?: (error: unknown) => void
}

/**
 * Schedules callback on a fixed interval, skipping ticks while its previous invocation is pending.
 * Stopping or restarting the timer does not cancel an invocation already running.
 * @param callback Work awaited on each available tick; failures are reported through options.onError or the console.
 * @param options Initial interval, automatic timer startup and optional failure handler.
 * @returns Reactive timer state and controls; unmounting clears the timer.
 */
export function usePolling(callback: () => Promise<void> | void, options: PollingOptions) {
  // intervalOption supplies the initial delay; immediate controls startup; onError reports failed invocations.
  const { interval: intervalOption, immediate = true, onError } = options

  // isActive indicates whether a timer is scheduled, rather than whether callback is currently running.
  const isActive = ref(false)
  // currentInterval stores the timer delay in milliseconds; zero disables scheduling.
  const currentInterval = ref(typeof intervalOption === 'function' ? intervalOption() : intervalOption)
  // intervalId identifies the timer to clear on stop, interval changes or component unmount.
  let intervalId: number | null = null
  // isCallbackPending survives timer replacement so restarting cannot overlap an unfinished invocation.
  let isCallbackPending = false

  /**
   * Starts a timer unless one is already active or the interval is disabled.
   */
  const start = () => {
    if (isActive.value) return
    if (currentInterval.value === 0) return

    isActive.value = true
    /** Each timer tick skips busy work and releases the guard after either success or failure. */
    intervalId = window.setInterval(async () => {
      if (isCallbackPending) return
      isCallbackPending = true
      try {
        await callback()
      } catch (error) {
        // error is the synchronous throw or rejected promise from this callback invocation.
        if (onError) {
          onError(error)
        } else {
          console.error('Polling error:', error)
        }
      } finally {
        isCallbackPending = false
      }
    }, currentInterval.value)
  }

  /**
   * Clears future ticks without cancelling a callback already running or releasing its guard.
   */
  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    isActive.value = false
  }

  /**
   * Replaces the timer with the requested delay, starting it when the delay is positive.
   * @param {number} newInterval - New interval in milliseconds (0 to disable)
   */
  const updateInterval = (newInterval: number) => {
    currentInterval.value = newInterval
    stop()
    if (newInterval > 0) {
      start()
    }
  }

  /**
   * Replaces the timer while preserving the guard for any unfinished callback.
   */
  const restart = () => {
    stop()
    start()
  }

  if (immediate && currentInterval.value > 0) {
    start()
  }

  onUnmounted(stop)

  return {
    isActive,
    currentInterval,
    start,
    stop,
    restart,
    updateInterval,
  }
}
