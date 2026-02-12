import { ref, onUnmounted, watch } from 'vue'

/**
 * Options for polling configuration
 */
interface PollingOptions {
  interval: number | (() => number)
  immediate?: boolean
  onError?: (error: unknown) => void
}

/**
 * Composable for periodic polling
 * @param {() => Promise<void> | void} callback - Function to execute periodically
 * @param {PollingOptions} options - Polling configuration
 * @returns Object with control methods and state
 */
export function usePolling(
  callback: () => Promise<void> | void,
  options: PollingOptions
) {
  const { interval: intervalOption, immediate = true, onError } = options
  
  const isActive = ref(false)
  const currentInterval = ref(typeof intervalOption === 'function' ? intervalOption() : intervalOption)
  let intervalId: number | null = null

  /**
   * Start polling
   */
  const start = () => {
    if (isActive.value) return
    if (currentInterval.value === 0) return

    isActive.value = true
    intervalId = window.setInterval(async () => {
      try {
        await callback()
      } catch (error) {
        if (onError) {
          onError(error)
        } else {
          console.error('Polling error:', error)
        }
      }
    }, currentInterval.value)
  }

  /**
   * Stop polling
   */
  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    isActive.value = false
  }

  /**
   * Update polling interval
   * @param {number} newInterval - New interval in milliseconds (0 to disable)
   */
  const updateInterval = (newInterval: number) => {
    currentInterval.value = newInterval
    if (isActive.value) {
      stop()
      if (newInterval > 0) {
        start()
      }
    }
  }

  /**
   * Restart polling
   */
  const restart = () => {
    stop()
    start()
  }

  if (immediate && currentInterval.value > 0) {
    start()
  }

  onUnmounted(() => {
    stop()
  })

  return {
    isActive,
    currentInterval,
    start,
    stop,
    restart,
    updateInterval,
  }
}
