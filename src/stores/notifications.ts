import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ErrorInfo } from '@/utils/errorHandler'
import { ErrorSeverity } from '@/utils/errorHandler'

/**
 * Notification item
 */
export interface Notification {
  id: string
  title: string
  message: string
  severity: ErrorSeverity
  timestamp: Date
  duration?: number
  dismissible?: boolean
}

/**
 * Notifications store
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([])
  const maxNotifications = 5
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  /**
   * Add notification
   */
  function addNotification(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Calculate duration before creating notification
    const duration =
      notification.duration !== undefined ? notification.duration : getDefaultDuration(notification.severity)

    const newNotification: Notification = {
      id,
      timestamp: new Date(),
      duration,
      dismissible: notification.dismissible ?? true,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
    }

    notifications.value.push(newNotification)

    // Limit number of notifications
    if (notifications.value.length > maxNotifications) {
      const removed = notifications.value.shift()
      if (removed) {
        const timer = timers.get(removed.id)
        if (timer) {
          clearTimeout(timer)
          timers.delete(removed.id)
        }
      }
    }

    // Auto-dismiss if duration is set and greater than 0
    if (duration > 0) {
      const timer = setTimeout(() => {
        removeNotification(id)
      }, duration)
      timers.set(id, timer)
    }
  }

  /**
   * Remove notification by id
   */
  function removeNotification(id: string): void {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)

      // Clear timer if exists
      const timer = timers.get(id)
      if (timer) {
        clearTimeout(timer)
        timers.delete(id)
      }
    }
  }

  /**
   * Clear all notifications
   */
  function clearAll(): void {
    // Clear all timers
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()

    // Clear notifications
    notifications.value = []
  }

  /**
   * Add error notification from ErrorInfo
   */
  function addErrorNotification(errorInfo: ErrorInfo): void {
    addNotification({
      title: getErrorTitle(errorInfo),
      message: errorInfo.message,
      severity: errorInfo.severity,
    })
  }

  /**
   * Get default duration based on severity
   */
  function getDefaultDuration(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 3000
      case ErrorSeverity.WARNING:
        return 5000
      case ErrorSeverity.ERROR:
        return 7000
      case ErrorSeverity.CRITICAL:
        return 10000
      default:
        return 5000
    }
  }

  /**
   * Get error title based on ErrorInfo
   */
  function getErrorTitle(errorInfo: ErrorInfo): string {
    switch (errorInfo.severity) {
      case ErrorSeverity.INFO:
        return 'Информация'
      case ErrorSeverity.WARNING:
        return 'Предупреждение'
      case ErrorSeverity.ERROR:
        return 'Ошибка'
      case ErrorSeverity.CRITICAL:
        return 'Критическая ошибка'
      default:
        return 'Уведомление'
    }
  }

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    addErrorNotification,
  }
})
