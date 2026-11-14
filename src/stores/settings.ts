import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { STORAGE_KEYS, STORES, POLLING_INTERVALS } from '@/constants'
import { showError } from '@/utils/notifications'

/**
 * Provides application polling settings; the setup callback creates state and storage-backed actions.
 */
export const useSettingsStore = defineStore('settings', () => {
  // pollingInterval is the accepted delay in milliseconds, initially the application default.
  const pollingInterval: Ref<number> = ref(STORES.DEFAULT_POLLING_INTERVAL)

  /**
   * Loads an allowed stored interval; unavailable or failing storage leaves the current setting intact.
   */
  function init(): void {
    try {
      if (typeof localStorage === 'undefined') return

      // stored is the persisted interval text, or null when no preference was saved.
      const stored = localStorage.getItem(STORAGE_KEYS.POLLING_INTERVAL)
      if (stored !== null) {
        // storedOption matches the exact text written by setPollingInterval, rejecting partial numbers.
        // The predicate compares each opt's serialized value with the persisted text.
        const storedOption = POLLING_INTERVALS.find((opt) => String(opt.value) === stored)
        if (storedOption) {
          pollingInterval.value = storedOption.value
        }
      }
    } catch (error) {
      // error is the failure to access storage or read the saved interval.
      console.error('Failed to load polling interval from localStorage:', error)
    }
  }

  /**
   * Persists an allowed interval before publishing it to polling consumers.
   * Storage failure reports a save error and leaves the previous setting unchanged.
   * @param value New interval in milliseconds; it must match an existing option, including zero to disable polling.
   */
  function setPollingInterval(value: number): void {
    /** The option predicate checks whether opt offers the requested value. */
    if (!POLLING_INTERVALS.some((opt) => opt.value === value)) {
      console.warn(`Invalid polling interval: ${value}`)
      return
    }

    try {
      if (typeof localStorage === 'undefined') {
        throw new Error('Хранилище настроек недоступно')
      }
      localStorage.setItem(STORAGE_KEYS.POLLING_INTERVAL, value.toString())
    } catch (error) {
      // error is the unavailable storage or failed write; the reactive interval has not changed yet.
      console.error('Failed to save polling interval to localStorage:', error)
      showError('Не удалось сохранить частоту обновления. Предыдущее значение сохранено.')
      return
    }

    pollingInterval.value = value
  }

  /**
   * Saves and applies the default interval through the same validation and failure handling as user changes.
   */
  function resetPollingInterval(): void {
    setPollingInterval(STORES.DEFAULT_POLLING_INTERVAL)
  }

  return {
    pollingInterval,
    // pollingIntervalOptions exposes the existing allowed values and Russian labels for settings controls.
    pollingIntervalOptions: POLLING_INTERVALS,
    init,
    setPollingInterval,
    resetPollingInterval,
  }
})
