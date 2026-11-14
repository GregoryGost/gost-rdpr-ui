import { ref, type Ref } from 'vue'
import { ApiError } from '@/api/client'
import { errorHandler } from '@/utils/errorHandler'
import { useLatestRequest } from './useLatestRequest'

/** Reactive state and execution control for the most recently started API call. */
export interface UseApiResult<T> {
  /** Last accepted successful response, or null before any success. */
  data: Ref<T | null>
  /** Whether the latest execution is awaiting completion. */
  isLoading: Ref<boolean>
  /** Whether the latest execution failed. */
  hasError: Ref<boolean>
  /** Latest execution's user-facing failure text, cleared at execution start. */
  errorMessage: Ref<string | null>
  /** Starts a call whose result supersedes all earlier executions. */
  execute: () => Promise<void>
}

/**
 * Composable for API requests with state management
 * @template T - Response data type
 * @param {() => Promise<T>} apiCall - API call function
 * @param {boolean} showNotification - Show error notification (default: true)
 * @returns Object with data, loading and error states, and execute method
 */
export function useApi<T>(apiCall: () => Promise<T>, showNotification = true): UseApiResult<T> {
  // data retains the last accepted success while subsequent calls are pending or fail.
  const data = ref<T | null>(null) as Ref<T | null>
  // isLoading tracks the newest call; hasError and errorMessage describe only its failure.
  const isLoading = ref(false)
  const hasError = ref(false)
  const errorMessage = ref<string | null>(null)
  // requests prevents old calls from changing state or notifying after a newer execution or teardown.
  const requests = useLatestRequest()

  /**
   * Executes a call, publishing success, errors, notifications and completion only while it is current.
   */
  const execute = async () => {
    // isCurrent is this execution's permission to publish its asynchronous outcome.
    const isCurrent = requests.begin()
    if (!isCurrent()) return
    isLoading.value = true
    hasError.value = false
    errorMessage.value = null

    try {
      // response is kept local until this execution is confirmed to still own the public state.
      const response = await apiCall()
      if (!isCurrent()) return
      data.value = response
    } catch (error) {
      // error belongs to this execution; obsolete failures produce no state changes or notifications.
      if (!isCurrent()) return
      hasError.value = true

      if (error instanceof ApiError) {
        errorMessage.value = error.message
      } else {
        errorMessage.value = 'Произошла непредвиденная ошибка'
      }

      if (showNotification) {
        errorHandler.handleError(error, {
          composable: 'useApi',
        })
      }
    } finally {
      if (isCurrent()) isLoading.value = false
    }
  }

  return {
    data,
    isLoading,
    hasError,
    errorMessage,
    execute,
  }
}
