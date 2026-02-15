import type { App } from 'vue'
import { ApiError, NetworkError } from '@/api/client'
import type { Router } from 'vue-router'

/**
 * Error types for categorization
 */
export enum ErrorType {
  API = 'api',
  NETWORK = 'network',
  VALIDATION = 'validation',
  RUNTIME = 'runtime',
  UNKNOWN = 'unknown',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Structured error info
 */
export interface ErrorInfo {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  originalError?: unknown
  timestamp: Date
  context?: Record<string, unknown>
}

/**
 * Error handler callback type
 */
export type ErrorCallback = (errorInfo: ErrorInfo) => void

/**
 * Global error handler class
 */
class ErrorHandler {
  private callbacks: ErrorCallback[] = []
  private isDevelopment = import.meta.env.DEV

  /**
   * Register error callback
   */
  onError(callback: ErrorCallback): void {
    this.callbacks.push(callback)
  }

  /**
   * Remove error callback
   */
  offError(callback: ErrorCallback): void {
    const index = this.callbacks.indexOf(callback)
    if (index > -1) {
      this.callbacks.splice(index, 1)
    }
  }

  /**
   * Handle error and notify all callbacks
   */
  handleError(error: unknown, context?: Record<string, unknown>): void {
    const errorInfo = this.parseError(error, context)

    // Log to console in development
    if (this.isDevelopment) {
      console.error('[Error Handler]', errorInfo)
    }

    // Notify all registered callbacks
    this.callbacks.forEach((callback) => {
      try {
        callback(errorInfo)
      } catch (err) {
        console.error('[Error Handler] Callback error:', err)
      }
    })
  }

  /**
   * Parse error to ErrorInfo
   */
  private parseError(error: unknown, context?: Record<string, unknown>): ErrorInfo {
    const timestamp = new Date()

    // API Error
    if (error instanceof ApiError) {
      return {
        type: ErrorType.API,
        severity: error.status >= 500 ? ErrorSeverity.ERROR : ErrorSeverity.WARNING,
        message: error.message,
        originalError: error,
        timestamp,
        context: { ...context, status: error.status },
      }
    }

    // Network Error (custom class)
    if (error instanceof NetworkError) {
      return {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.ERROR,
        message: error.message,
        originalError: error,
        timestamp,
        context,
      }
    }

    // Network Error (fallback for TypeError from fetch)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        severity: ErrorSeverity.ERROR,
        message: 'Ошибка сетевого соединения',
        originalError: error,
        timestamp,
        context,
      }
    }

    // Standard Error
    if (error instanceof Error) {
      return {
        type: ErrorType.RUNTIME,
        severity: ErrorSeverity.ERROR,
        message: error.message,
        originalError: error,
        timestamp,
        context,
      }
    }

    // Unknown error
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.ERROR,
      message: String(error) || 'Произошла неизвестная ошибка',
      originalError: error,
      timestamp,
      context,
    }
  }

  /**
   * Setup Vue error handlers
   */
  setupVueErrorHandler(app: App): void {
    // Vue error handler
    app.config.errorHandler = (err, instance, info) => {
      this.handleError(err, {
        componentName: instance?.$options?.name || 'Unknown',
        errorInfo: info,
      })
    }

    // Vue warning handler (development only)
    if (this.isDevelopment) {
      app.config.warnHandler = (msg, instance, trace) => {
        console.warn('[Vue warn]', msg, instance, trace)
      }
    }
  }

  /**
   * Setup global error handlers
   */
  setupGlobalErrorHandlers(): void {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      event.preventDefault()
      this.handleError(event.reason, {
        type: 'unhandledRejection',
      })
    })

    // Global errors
    window.addEventListener('error', (event) => {
      event.preventDefault()
      this.handleError(event.error || event.message, {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    })
  }

  /**
   * Setup router error handler
   */
  setupRouterErrorHandler(router: Router): void {
    router.onError((error) => {
      this.handleError(error, {
        type: 'routerError',
      })
    })
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler()
