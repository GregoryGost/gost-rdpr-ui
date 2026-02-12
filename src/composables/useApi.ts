import { ref } from 'vue'
import { ApiError } from '@/api/client'

/**
 * Composable for API requests with state management
 * @template T - Response data type
 * @param {() => Promise<T>} apiCall - API call function
 * @returns Object with data, loading and error states, and execute method
 */
export function useApi<T>(apiCall: () => Promise<T>) {
  const data = ref<T | null>(null)
  const isLoading = ref(false)
  const hasError = ref(false)
  const errorMessage = ref<string | null>(null)

  /**
   * Execute API request
   */
  const execute = async () => {
    isLoading.value = true
    hasError.value = false
    errorMessage.value = null
    
    try {
      data.value = await apiCall()
    } catch (error) {
      hasError.value = true
      if (error instanceof ApiError) {
        errorMessage.value = error.message
      } else {
        errorMessage.value = 'Произошла непредвиденная ошибка'
      }
    } finally {
      isLoading.value = false
    }
  }

  return { 
    data, 
    isLoading, 
    hasError, 
    errorMessage, 
    execute 
  }
}