import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHealthStore, type HealthData } from '@/stores/health'
import { useNotificationsStore } from '@/stores/notifications'
import { useSettingsStore } from '@/stores/settings'
import { useDarkModeStore } from '@/stores/darkMode'
import { ErrorSeverity, ErrorType } from '@/utils/errorHandler'
import { STORAGE_KEYS } from '@/constants'

/** Isolates real store actions and controls time without replacing action implementations. */
beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  /** notificationSequence gives generated IDs distinct deterministic entropy within each isolated test. */
  let notificationSequence = 0
  /** The random callback advances notificationSequence so timer/removal tests never depend on random collisions. */
  vi.spyOn(Math, 'random').mockImplementation(() => {
    notificationSequence += 1
    return notificationSequence / 100
  })
})

/** Health caching retains usable data through failures and expires exactly at its TTL. */
describe('health store', () => {
  /** Cache age is measured from the last success, not a subsequent failed fetch. */
  it('expires at ten seconds and keeps the last successful health through errors', () => {
    /** store owns the isolated cache. */
    const store = useHealthStore()
    /** health has status/ts/uptime/db_pool values matching the public health data contract. */
    const health: HealthData = { status: 'ok', ts: 100, uptime: 40, db_pool: 'ready' }
    expect(store.isCacheValid()).toBe(false)
    store.updateHealth(health)
    expect(store.isCacheValid()).toBe(true)
    expect(store.lastUpdateTime?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    vi.advanceTimersByTime(9999)
    store.setError()
    expect(store.cachedHealth).toEqual(health)
    expect(store.hasError).toBe(true)
    expect(store.isCacheValid()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(store.isCacheValid()).toBe(false)
    store.clearError()
    expect(store.hasError).toBe(false)
    expect(store.cachedHealth).toEqual(health)
    store.updateHealth({ ...health, uptime: 55 })
    expect(store.isCacheValid()).toBe(true)
    expect(store.cachedHealth?.uptime).toBe(55)
    store.invalidateCache()
    expect(store.cachedHealth).toBeNull()
    expect(store.hasError).toBe(false)
    expect(store.isCacheValid()).toBe(false)
  })
})

/** Notification behavior is checked by visible content, lifetime and resource cleanup rather than random IDs. */
describe('notifications store', () => {
  /** Severity defaults are public UI behavior documented in the composables guide. */
  it.each([
    [ErrorSeverity.INFO, 3000],
    [ErrorSeverity.WARNING, 5000],
    [ErrorSeverity.ERROR, 7000],
    [ErrorSeverity.CRITICAL, 10000],
  ])('dismisses %s exactly at its default duration', (severity, duration) => {
    /** store owns this scenario's visible notifications and dismissal timers. */
    const store = useNotificationsStore()
    store.addNotification({ title: 'Сообщение', message: 'Содержимое', severity })
    expect(store.notifications[0]).toMatchObject({
      title: 'Сообщение',
      message: 'Содержимое',
      severity,
      dismissible: true,
      duration,
    })
    vi.advanceTimersByTime(duration - 1)
    expect(store.notifications).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(store.notifications).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  /** A sixth notification evicts the oldest and cancels its timer rather than leaving hidden work. */
  it('retains the newest five and clears timers on removal and clearAll', () => {
    /** store receives six messages with different user-visible content. */
    const store = useNotificationsStore()
    /** index supplies the message number; IDs remain opaque. */
    for (let index = 1; index <= 6; index += 1) {
      store.addNotification({ title: 'Сообщение', message: String(index), severity: ErrorSeverity.INFO })
    }
    // The message projection checks visible insertion order after the oldest notification is evicted.
    expect(store.notifications.map((notification) => notification.message)).toEqual(['2', '3', '4', '5', '6'])
    // The ID projection checks uniqueness without depending on the generated ID format.
    expect(new Set(store.notifications.map((notification) => notification.id)).size).toBe(5)
    expect(vi.getTimerCount()).toBe(5)
    store.removeNotification(store.notifications[1]!.id)
    // The message projection verifies that removing one notification preserves the order of the survivors.
    expect(store.notifications.map((notification) => notification.message)).toEqual(['2', '4', '5', '6'])
    expect(vi.getTimerCount()).toBe(4)
    store.removeNotification('unknown-id')
    expect(store.notifications).toHaveLength(4)
    store.clearAll()
    expect(store.notifications).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })

  /** Explicit zero never dismisses; a custom positive duration overrides severity. */
  it('honors custom durations and renders structured errors with Russian titles', () => {
    /** store owns both persistent and timed notifications. */
    const store = useNotificationsStore()
    store.addNotification({
      title: 'Постоянное',
      message: 'Остаётся',
      severity: ErrorSeverity.INFO,
      duration: 0,
      dismissible: false,
    })
    store.addNotification({ title: 'Короткое', message: 'Исчезает', severity: ErrorSeverity.CRITICAL, duration: 25 })
    vi.advanceTimersByTime(25)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toMatchObject({ title: 'Постоянное', duration: 0, dismissible: false })
    store.addErrorNotification({
      type: ErrorType.API,
      severity: ErrorSeverity.WARNING,
      message: 'Некорректный запрос',
      timestamp: new Date(),
    })
    expect(store.notifications[1]).toMatchObject({
      title: 'Предупреждение',
      message: 'Некорректный запрос',
      severity: ErrorSeverity.WARNING,
    })
    vi.advanceTimersByTime(20000)
    // The title projection verifies that only the explicitly persistent notification survives all timed dismissals.
    expect(store.notifications.map((notification) => notification.title)).toEqual(['Постоянное'])
  })
})

/** Polling preferences accept the advertised values and commit state only after successful persistence. */
describe('settings store', () => {
  /** Setter serialization is decimal milliseconds; a new store can read it, including disabled polling. */
  it.each([0, 1000, 3000, 5000, 10000, 30000, 60000])('persists and reloads %s milliseconds', (interval) => {
    /** store saves through the real action and freshStore reads using a separate Pinia. */
    const store = useSettingsStore()
    store.setPollingInterval(interval)
    expect(localStorage.getItem(STORAGE_KEYS.POLLING_INTERVAL)).toBe(String(interval))
    expect(store.pollingInterval).toBe(interval)
    setActivePinia(createPinia())
    const freshStore = useSettingsStore()
    freshStore.init()
    expect(freshStore.pollingInterval).toBe(interval)
    freshStore.resetPollingInterval()
    expect(freshStore.pollingInterval).toBe(3000)
    expect(localStorage.getItem(STORAGE_KEYS.POLLING_INTERVAL)).toBe('3000')
  })

  /** Unsupported action input cannot alter the applied or persisted value. */
  it.each([-1, 1, 1001, Number.NaN, Number.POSITIVE_INFINITY])('rejects unsupported setting %s', (interval) => {
    /** store begins with a successfully saved one-second setting. */
    const store = useSettingsStore()
    store.setPollingInterval(1000)
    store.setPollingInterval(interval)
    expect(store.pollingInterval).toBe(1000)
    expect(localStorage.getItem(STORAGE_KEYS.POLLING_INTERVAL)).toBe('1000')
    expect(useNotificationsStore().notifications).toEqual([])
  })

  /** Persisted values must be complete numeric settings, not a valid prefix followed by corrupt text. */
  it.each(['garbage', '-1', '1001', '1000junk', '1000.5', '', ' 1000 '])(
    'ignores corrupt stored interval %s',
    (stored) => {
      localStorage.setItem(STORAGE_KEYS.POLLING_INTERVAL, stored)
      /** store remains at the documented default when persisted data is invalid. */
      const store = useSettingsStore()
      store.init()
      expect(store.pollingInterval).toBe(3000)
    },
  )

  /** A denied write preserves both the prior setting and its stored representation and displays a save error. */
  it('keeps the previous setting and notifies when storage writes fail', () => {
    /** store first establishes a valid previously persisted value. */
    const store = useSettingsStore()
    store.setPollingInterval(1000)
    /** writeFailure throws before storage changes, like a denied or full storage area. */
    const writeFailure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied')
    })
    store.setPollingInterval(5000)
    expect(store.pollingInterval).toBe(1000)
    writeFailure.mockRestore()
    expect(localStorage.getItem(STORAGE_KEYS.POLLING_INTERVAL)).toBe('1000')
    expect(useNotificationsStore().notifications).toEqual([
      expect.objectContaining({
        title: 'Ошибка',
        message: 'Не удалось сохранить частоту обновления. Предыдущее значение сохранено.',
      }),
    ])
  })

  /** Both a denied storage getter and getItem failure are contained during initialization. */
  it.each(['getter', 'read'])('preserves the setting on storage %s failure', (failureMode) => {
    /** store has an already accepted interval that initialization must preserve. */
    const store = useSettingsStore()
    store.setPollingInterval(1000)
    if (failureMode === 'getter') {
      /** Simulates storage access failing before its methods can be reached. */
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new Error('storage inaccessible')
      })
    } else {
      /** Simulates a failed read from an otherwise accessible storage object. */
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('read denied')
      })
    }
    // The assertion callback observes initialization failures instead of allowing them to escape the test.
    expect(() => store.init()).not.toThrow()
    expect(store.pollingInterval).toBe(1000)
  })

  /** A corrupt stored preference cannot replace a valid setting which was already accepted in memory. */
  it('preserves an accepted setting when a later init reads corrupt text', () => {
    /** store establishes the prior state using the real successful save contract. */
    const store = useSettingsStore()
    store.setPollingInterval(5000)
    localStorage.setItem(STORAGE_KEYS.POLLING_INTERVAL, '1000junk')
    store.init()
    expect(store.pollingInterval).toBe(5000)
  })

  /** Accessing storage itself can fail before setItem is available; that remains a visible save failure. */
  it('notifies and preserves the setting when the storage getter denies a save', () => {
    /** store first accepts a previously saved one-second interval. */
    const store = useSettingsStore()
    store.setPollingInterval(1000)
    /** Denies access to storage before the save action can call setItem. */
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage inaccessible')
    })
    // The assertion callback verifies that the failed save is handled rather than thrown to its UI caller.
    expect(() => store.setPollingInterval(5000)).not.toThrow()
    expect(store.pollingInterval).toBe(1000)
    expect(useNotificationsStore().notifications).toEqual([
      expect.objectContaining({
        message: 'Не удалось сохранить частоту обновления. Предыдущее значение сохранено.',
      }),
    ])
  })
})

/** Theme state, persisted preference and document classes must describe the same applied theme. */
describe('dark mode store', () => {
  /** A local matchMedia stub supplies just the system preference read by this store. */
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      /** Supplies a dark system preference without a real browser media-query implementation. */
      vi.fn(() => ({ matches: true })),
    )
  })

  /** A saved override wins over the system theme, toggles persist, and reset follows the system again. */
  it('initializes, toggles, persists and resets its document classes', () => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, '0')
    /** store starts with a light saved override despite the dark system preference. */
    const store = useDarkModeStore()
    store.init()
    expect(store.isEnabled).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    store.set(null, true)
    expect(store.isEnabled).toBe(true)
    expect(localStorage.getItem(STORAGE_KEYS.DARK_MODE)).toBe('1')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.body.classList.contains('dark-scrollbars')).toBe(true)
    expect(store.isInProgress).toBe(true)
    vi.advanceTimersByTime(200)
    expect(store.isInProgress).toBe(false)
    store.reset()
    expect(localStorage.getItem(STORAGE_KEYS.DARK_MODE)).toBeNull()
    expect(store.isEnabled).toBe(true)
    store.set(false, true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.body.classList.contains('dark-scrollbars')).toBe(false)
  })

  /** Reading failures cannot unset an already applied dark theme. */
  it.each(['getter', 'read'])('preserves state and classes on storage %s failure', (failureMode) => {
    /** store establishes an applied theme without requiring a persistence write. */
    const store = useDarkModeStore()
    store.set(true)
    if (failureMode === 'getter') {
      /** Simulates storage itself being unavailable while an existing theme is applied. */
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new Error('storage inaccessible')
      })
    } else {
      /** Simulates a failed preference read without changing the applied document theme. */
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('read denied')
      })
    }
    // The assertion callback checks that initialization contains the storage exception.
    expect(() => store.init()).not.toThrow()
    expect(store.isEnabled).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.body.classList.contains('dark-scrollbars')).toBe(true)
  })

  /** Saving and resetting are atomic from the caller's perspective when storage rejects the mutation. */
  it.each(['setItem', 'removeItem'] as const)('preserves the theme and notifies when %s fails', (operation) => {
    /** store first persists and applies a dark preference. */
    const store = useDarkModeStore()
    store.set(true, true)
    vi.advanceTimersByTime(200)
    /** Rejects the selected storage mutation before its persisted preference changes. */
    vi.spyOn(Storage.prototype, operation).mockImplementation(() => {
      throw new Error('storage denied')
    })
    if (operation === 'setItem') store.set(false, true)
    else store.reset()
    expect(store.isEnabled).toBe(true)
    expect(store.isInProgress).toBe(false)
    expect(localStorage.getItem(STORAGE_KEYS.DARK_MODE)).toBe('1')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.body.classList.contains('dark-scrollbars')).toBe(true)
    expect(useNotificationsStore().notifications).toEqual([
      expect.objectContaining({
        title: 'Ошибка',
        message:
          operation === 'setItem'
            ? 'Не удалось сохранить тему. Предыдущее значение сохранено.'
            : 'Не удалось сбросить тему. Предыдущее значение сохранено.',
      }),
    ])
  })

  /** A denied storage getter also prevents theme changes before document classes or transition state change. */
  it('keeps the applied theme when the storage getter denies saving', () => {
    /** store begins with the default light theme and no transition in progress. */
    const store = useDarkModeStore()
    /** Denies storage access before the action can persist a new theme. */
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage inaccessible')
    })
    // The assertion callback checks that a denied save remains an ordinary handled UI failure.
    expect(() => store.set(true, true)).not.toThrow()
    expect(store.isEnabled).toBe(false)
    expect(store.isInProgress).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.body.classList.contains('dark-scrollbars')).toBe(false)
    expect(useNotificationsStore().notifications).toEqual([
      expect.objectContaining({
        message: 'Не удалось сохранить тему. Предыдущее значение сохранено.',
      }),
    ])
  })
})
