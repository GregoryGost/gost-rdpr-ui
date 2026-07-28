<script setup lang="ts">
import { ref, watch } from 'vue'
import { ApiError, NetworkError } from '@/api/client'
import { ipsApi } from '@/api/endpoints/ips'
import type { IpAddress, RipeStatPrefixCheckResponse } from '@/api/types/ips'
import { RIPESTAT_PREFIX_CHECK_TEXTS } from '@/constants'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import LoadingSpinner from '@/ui/feedback/LoadingSpinner.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'

/**
 * RIPEstat prefix check result modal for one saved IPv4 record
 * @component IpRipePrefixModal
 */
interface Props {
  isOpen: boolean
  ip: Pick<IpAddress, 'id' | 'addr' | 'type'> | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const isLoading = ref(false)
const requestError = ref('')
const result = ref<RipeStatPrefixCheckResponse | null>(null)
let modalSessionId = 0
let activeRequestId = 0

/**
 * Reset modal output and invalidate pending requests.
 * @returns {void}
 */
const resetState = (): void => {
  modalSessionId += 1
  activeRequestId += 1
  isLoading.value = false
  requestError.value = ''
  result.value = null
}

/**
 * Convert a RIPEstat request failure into modal-specific user text.
 * @param {unknown} error - Request failure
 * @returns {string} User-facing error message
 */
const getRequestErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'IP адрес больше не существует. Обновите таблицу и повторите проверку'
    if (error.status === 422) return 'RIPEstat поддерживает только корректные IPv4 адреса'
    if (error.status === 502) return 'Сервис RIPEstat временно недоступен. Повторите позже'
    if (error.status >= 500) return 'Сервер не смог проверить префикс. Повторите позже'
    return error.message
  }

  if (error instanceof TypeError) return RIPESTAT_PREFIX_CHECK_TEXTS.INVALID_SOURCE
  if (error instanceof NetworkError) return error.message
  if (error instanceof Error) return error.message
  return 'Не удалось проверить префикс в RIPEstat'
}

/**
 * Check the selected saved IPv4 record.
 * @returns {Promise<void>}
 */
const checkPrefix = async (): Promise<void> => {
  if (isLoading.value) return

  const ip = props.ip
  if (!ip || ip.type !== 4 || !Number.isInteger(ip.id) || ip.id <= 0) {
    requestError.value = RIPESTAT_PREFIX_CHECK_TEXTS.INVALID_SOURCE
    return
  }

  const sessionId = modalSessionId
  const requestId = ++activeRequestId
  requestError.value = ''
  result.value = null
  isLoading.value = true

  try {
    const response = await ipsApi.checkRipeStatPrefix({ id: ip.id })
    if (sessionId !== modalSessionId || requestId !== activeRequestId || !props.isOpen) return
    result.value = response
  } catch (error) {
    if (sessionId !== modalSessionId || requestId !== activeRequestId || !props.isOpen) return
    requestError.value = getRequestErrorMessage(error)
  } finally {
    if (sessionId === modalSessionId && requestId === activeRequestId) isLoading.value = false
  }
}

watch(
  [() => props.isOpen, () => props.ip],
  ([isOpen]) => {
    resetState()
    if (isOpen) void checkPrefix()
  },
  { immediate: true },
)

/**
 * Close the modal with a clean state.
 * @returns {void}
 */
const closeModal = (): void => {
  resetState()
  emit('close')
}
</script>

<template>
  <BaseModal :is-open="isOpen" :title="RIPESTAT_PREFIX_CHECK_TEXTS.MODAL_TITLE" @close="closeModal">
    <div class="space-y-5">
      <div
        v-if="ip"
        class="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 dark:border-gray-700 dark:bg-gray-900/50"
      >
        <div>
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ RIPESTAT_PREFIX_CHECK_TEXTS.IP_LABEL }}
          </div>
          <div class="mt-1 font-mono text-sm font-medium break-all text-gray-900 dark:text-gray-100">{{ ip.addr }}</div>
        </div>
        <div>
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ RIPESTAT_PREFIX_CHECK_TEXTS.ID_LABEL }}
          </div>
          <div class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ ip.id }}</div>
        </div>
      </div>

      <div v-if="isLoading" class="rounded-lg border border-gray-200 p-8 dark:border-gray-700" aria-live="polite">
        <LoadingSpinner size="lg" :message="RIPESTAT_PREFIX_CHECK_TEXTS.LOADING" />
      </div>

      <div
        v-else-if="requestError"
        class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        <div class="font-semibold">{{ RIPESTAT_PREFIX_CHECK_TEXTS.ERROR_TITLE }}</div>
        <div class="mt-1">{{ requestError }}</div>
      </div>

      <section v-else-if="result" class="rounded-lg border border-gray-200 p-4 dark:border-gray-700" aria-live="polite">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
          {{ RIPESTAT_PREFIX_CHECK_TEXTS.RESULT_TITLE }}
        </h3>
        <dl class="mt-4 space-y-3">
          <div>
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ RIPESTAT_PREFIX_CHECK_TEXTS.ADDRESS_LABEL }}
            </dt>
            <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{{ result.address }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ RIPESTAT_PREFIX_CHECK_TEXTS.PREFIX_LABEL }}
            </dt>
            <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
              {{ result.prefix ?? RIPESTAT_PREFIX_CHECK_TEXTS.PREFIX_NOT_FOUND }}
            </dd>
          </div>
        </dl>
      </section>

      <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
        <BaseButton type="button" variant="ghost" @click="closeModal">
          {{ RIPESTAT_PREFIX_CHECK_TEXTS.CLOSE }}
        </BaseButton>
        <BaseButton v-if="requestError" type="button" variant="primary" :is-loading="isLoading" @click="checkPrefix">
          {{ RIPESTAT_PREFIX_CHECK_TEXTS.RETRY }}
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>

<style lang="scss" scoped></style>
