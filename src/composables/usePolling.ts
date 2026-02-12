import { ref, onUnmounted } from 'vue'

/**
 * Options for polling configuration
 */
interface PollingOptions {
  interval: number
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
  const { interval, immediate = true, onError } = options
  
  const isActive = ref(false)
  let intervalId: number | null = null

  /**
   * Start polling
   */
  const start = () => {
    if (isActive.value) return

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
    }, interval)
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
   * Restart polling
   */
  const restart = () => {
    stop()
    start()
  }

  if (immediate) {
    start()
  }

  onUnmounted(() => {
    stop()
  })

  return {
    isActive,
    start,
    stop,
    restart,
  }
}
