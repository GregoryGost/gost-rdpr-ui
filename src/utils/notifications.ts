import { useNotificationsStore } from '@/stores/notifications'
import { ErrorSeverity } from './errorHandler'

/**
 * Helper functions for showing notifications
 */

/**
 * Show info notification
 * @param message - Notification message
 * @param title - Notification title (default: 'Информация')
 * @param duration - Duration in milliseconds (default: 3000)
 */
export function showInfo(message: string, title = 'Информация', duration?: number): void {
  const store = useNotificationsStore()
  store.addNotification({
    title,
    message,
    severity: ErrorSeverity.INFO,
    duration,
  })
}

/**
 * Show success notification
 * @param message - Notification message
 * @param title - Notification title (default: 'Успешно')
 * @param duration - Duration in milliseconds (default: 3000)
 */
export function showSuccess(message: string, title = 'Успешно', duration?: number): void {
  const store = useNotificationsStore()
  store.addNotification({
    title,
    message,
    severity: ErrorSeverity.INFO,
    duration,
  })
}

/**
 * Show warning notification
 * @param message - Notification message
 * @param title - Notification title (default: 'Предупреждение')
 * @param duration - Duration in milliseconds (default: 5000)
 */
export function showWarning(message: string, title = 'Предупреждение', duration?: number): void {
  const store = useNotificationsStore()
  store.addNotification({
    title,
    message,
    severity: ErrorSeverity.WARNING,
    duration,
  })
}

/**
 * Show error notification
 * @param message - Notification message
 * @param title - Notification title (default: 'Ошибка')
 * @param duration - Duration in milliseconds (default: 7000)
 */
export function showError(message: string, title = 'Ошибка', duration?: number): void {
  const store = useNotificationsStore()
  store.addNotification({
    title,
    message,
    severity: ErrorSeverity.ERROR,
    duration,
  })
}

/**
 * Show critical error notification
 * @param message - Notification message
 * @param title - Notification title (default: 'Критическая ошибка')
 * @param duration - Duration in milliseconds (default: 10000)
 */
export function showCritical(message: string, title = 'Критическая ошибка', duration?: number): void {
  const store = useNotificationsStore()
  store.addNotification({
    title,
    message,
    severity: ErrorSeverity.CRITICAL,
    duration,
  })
}

/**
 * Clear all notifications
 */
export function clearNotifications(): void {
  const store = useNotificationsStore()
  store.clearAll()
}
