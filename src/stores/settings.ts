import { defineStore } from 'pinia'
import { ref, watch, type Ref } from 'vue'

/**
 * Polling interval option
 */
export interface PollingIntervalOption {
  value: number
  label: string
}

/**
 * Available polling intervals
 */
export const POLLING_INTERVALS: PollingIntervalOption[] = [
  { value: 0, label: 'Отключено' },
  { value: 1000, label: '1 секунда' },
  { value: 3000, label: '3 секунды' },
  { value: 5000, label: '5 секунд' },
  { value: 10000, label: '10 секунд' },
  { value: 30000, label: '30 секунд' },
  { value: 60000, label: '1 минута' },
]

const POLLING_INTERVAL_KEY = 'polling-interval'
const DEFAULT_POLLING_INTERVAL = 3000

/**
 * Settings store for application-wide settings
 */
export const useSettingsStore = defineStore('settings', () => {
  const pollingInterval: Ref<number> = ref(DEFAULT_POLLING_INTERVAL)

  /**
   * Initialize settings from localStorage
   */
  function init(): void {
    if (typeof localStorage === 'undefined') {
      return
    }

    try {
      const stored = localStorage.getItem(POLLING_INTERVAL_KEY)
      if (stored !== null) {
        const parsed = parseInt(stored, 10)
        if (!isNaN(parsed) && POLLING_INTERVALS.some(opt => opt.value === parsed)) {
          pollingInterval.value = parsed
        }
      }
    } catch (error) {
      console.error('Failed to load polling interval from localStorage:', error)
    }
  }

  /**
   * Set polling interval
   * @param {number} value - New interval value in milliseconds
   */
  function setPollingInterval(value: number): void {
    if (!POLLING_INTERVALS.some(opt => opt.value === value)) {
      console.warn(`Invalid polling interval: ${value}`)
      return
    }

    pollingInterval.value = value

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(POLLING_INTERVAL_KEY, value.toString())
      } catch (error) {
        console.error('Failed to save polling interval to localStorage:', error)
      }
    }
  }

  /**
   * Reset polling interval to default
   */
  function resetPollingInterval(): void {
    setPollingInterval(DEFAULT_POLLING_INTERVAL)
  }

  return {
    pollingInterval,
    pollingIntervalOptions: POLLING_INTERVALS,
    init,
    setPollingInterval,
    resetPollingInterval,
  }
})
