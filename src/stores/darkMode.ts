import { defineStore } from 'pinia'
import { ref, type Ref } from 'vue'
import { STORAGE_KEYS } from '@/constants'
import { showError } from '@/utils/notifications'

/** Provides theme state; the setup callback creates actions that coordinate storage and document classes. */
export const useDarkModeStore = defineStore('darkMode', () => {
  // isEnabled is the applied theme, initially light until initialization reads a preference.
  const isEnabled: Ref<boolean, boolean> = ref(false)
  // isInProgress marks theme changes until a scheduled 200 ms completion callback clears it.
  const isInProgress: Ref<boolean, boolean> = ref(false)

  /** Applies a saved theme or the system preference without writing storage; read failures preserve current state. */
  function init(): void {
    if (typeof window === 'undefined') return

    try {
      if (typeof localStorage === 'undefined') return

      // stored is the explicit theme preference; other values fall back to the system theme.
      const stored = localStorage.getItem(STORAGE_KEYS.DARK_MODE)
      if (stored === '1') {
        set(true, false)
      } else if (stored === '0') {
        set(false, false)
      } else {
        set(window.matchMedia('(prefers-color-scheme: dark)').matches, false)
      }
    } catch (error) {
      // error is a failure while reading or applying the initial theme preference.
      console.error('Failed to load dark mode preference:', error)
    }
  }

  /** Removes the saved override and reloads the system theme; removal failure keeps the applied theme unchanged. */
  function reset(): void {
    try {
      if (typeof localStorage === 'undefined') {
        throw new Error('Хранилище настроек недоступно')
      }
      localStorage.removeItem(STORAGE_KEYS.DARK_MODE)
    } catch (error) {
      // error is the failed removal; initialization must not run while the saved override remains in place.
      console.error('Failed to reset dark mode preference:', error)
      showError('Не удалось сбросить тему. Предыдущее значение сохранено.')
      return
    }
    init()
  }

  /**
   * Applies payload, or toggles the current theme when payload is null.
   * When persist is true, storage must accept the preference before state, classes or transition timers change.
   * Save failure reports an error and keeps the applied theme; persist defaults to false for initialization.
   */
  function set(payload: null | boolean = null, persist: boolean = false): void {
    // setIsEnabled is the requested explicit theme or the inverse of the currently applied theme.
    const setIsEnabled: boolean = payload !== null ? payload : !isEnabled.value

    if (persist) {
      try {
        if (typeof localStorage === 'undefined') {
          throw new Error('Хранилище настроек недоступно')
        }
        localStorage.setItem(STORAGE_KEYS.DARK_MODE, setIsEnabled ? '1' : '0')
      } catch (error) {
        // error is the unavailable storage or failed write before any applied theme state has changed.
        console.error('Failed to save dark mode preference:', error)
        showError('Не удалось сохранить тему. Предыдущее значение сохранено.')
        return
      }
    }

    isEnabled.value = setIsEnabled
    isInProgress.value = true

    if (typeof document !== 'undefined') {
      if (setIsEnabled) {
        document.documentElement.classList.add('dark')
        document.body.classList.add('dark-scrollbars')
      } else {
        document.documentElement.classList.remove('dark')
        document.body.classList.remove('dark-scrollbars')
      }
    }

    /** Clears the transition indicator after the existing theme change window. */
    setTimeout(() => {
      isInProgress.value = false
    }, 200)
  }

  return {
    isEnabled,
    isInProgress,
    init,
    reset,
    set,
  }
})
