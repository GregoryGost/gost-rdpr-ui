import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { STORAGE_KEYS, STORES, POLLING_INTERVALS } from '@/constants'

/**
 * Settings store for application-wide settings
 */
export const useSettingsStore = defineStore('settings', () => {
  const pollingInterval: Ref<number> = ref(STORES.DEFAULT_POLLING_INTERVAL)

  /**
   * Initialize settings from localStorage
   */
  function init(): void {
    if (typeof localStorage === 'undefined') {
      return
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.POLLING_INTERVAL)
      if (stored !== null) {
        const parsed = parseInt(stored, 10)
        if (!isNaN(parsed) && POLLING_INTERVALS.some((opt) => opt.value === parsed)) {
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
    if (!POLLING_INTERVALS.some((opt) => opt.value === value)) {
      console.warn(`Invalid polling interval: ${value}`)
      return
    }

    pollingInterval.value = value

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.POLLING_INTERVAL, value.toString())
      } catch (error) {
        console.error('Failed to save polling interval to localStorage:', error)
      }
    }
  }

  /**
   * Reset polling interval to default
   */
  function resetPollingInterval(): void {
    setPollingInterval(STORES.DEFAULT_POLLING_INTERVAL)
  }

  return {
    pollingInterval,
    pollingIntervalOptions: POLLING_INTERVALS,
    init,
    setPollingInterval,
    resetPollingInterval,
  }
})
