import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Health data interface
 */
export interface HealthData {
  status: string
  ts: number
  uptime: number
  db_pool: string
}

/**
 * Cache TTL in milliseconds (10 seconds)
 */
const CACHE_TTL = 10000

/**
 * Health store for caching server health data between page navigations
 */
export const useHealthStore = defineStore('health', () => {
  const cachedHealth = ref<HealthData | null>(null)
  const hasError = ref(false)
  const lastUpdateTime = ref<Date | null>(null)

  /**
   * Update cached health data
   */
  function updateHealth(health: HealthData): void {
    cachedHealth.value = health
    hasError.value = false
    lastUpdateTime.value = new Date()
  }

  /**
   * Set error state but keep cached data
   */
  function setError(): void {
    hasError.value = true
    // Keep the last cached health data to prevent flashing
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    hasError.value = false
  }

  /**
   * Invalidate and clear cached data
   */
  function invalidateCache(): void {
    cachedHealth.value = null
    hasError.value = false
  }

  /**
   * Check if cached data is still valid
   */
  function isCacheValid(): boolean {
    if (!cachedHealth.value || !lastUpdateTime.value) {
      return false
    }
    const now = new Date().getTime()
    const cacheAge = now - lastUpdateTime.value.getTime()
    return cacheAge < CACHE_TTL
  }

  return {
    cachedHealth,
    hasError,
    lastUpdateTime,
    updateHealth,
    setError,
    clearError,
    invalidateCache,
    isCacheValid,
  }
})
