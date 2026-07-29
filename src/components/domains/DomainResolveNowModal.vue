<script setup lang="ts">
import { ref, watch } from 'vue'
import { ApiError, NetworkError } from '@/api/client'
import { domainsApi } from '@/api/endpoints/domains'
import type { Domain } from '@/api/types/domains'
import { DOMAIN_RESOLVE_NOW_TEXTS, UI_TEXTS } from '@/constants'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import LoadingSpinner from '@/ui/feedback/LoadingSpinner.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'

/**
 * Stored domain background resolve confirmation modal
 * @component DomainResolveNowModal
 */
interface Props {
  isOpen: boolean
  domain: Pick<Domain, 'id' | 'name'> | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const isLoading = ref(false)
const isAccepted = ref(false)
const requestError = ref('')
let modalSessionId = 0
let activeRequestId = 0

/**
 * Reset modal output and invalidate pending responses.
 * @returns {void}
 */
const resetState = (): void => {
  modalSessionId += 1
  activeRequestId += 1
  isLoading.value = false
  isAccepted.value = false
  requestError.value = ''
}

watch([() => props.isOpen, () => props.domain], resetState, { immediate: true })

/**
 * Convert a request failure into modal-specific user text.
 * @param {unknown} error - Request failure
 * @returns {string} User-facing error message
 */
const getRequestErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Сохраненный домен не найден. Возможно, он был удален'
    if (error.status === 422) return 'Сервер отклонил ID домена. Обновите страницу и повторите запрос'
    if (error.status >= 500) return 'Сервер не смог запустить фоновый резолвинг. Повторите позже'
    return error.message
  }

  if (error instanceof TypeError) return DOMAIN_RESOLVE_NOW_TEXTS.INVALID_ID
  if (error instanceof NetworkError) return error.message
  if (error instanceof Error) return error.message
  return 'Не удалось запустить фоновый резолвинг'
}

/**
 * Start background resolving for the selected stored domain.
 * @returns {Promise<void>}
 */
const runResolveNow = async (): Promise<void> => {
  if (isLoading.value || isAccepted.value) return

  const domain = props.domain
  if (!domain) {
    requestError.value = DOMAIN_RESOLVE_NOW_TEXTS.INVALID_ID
    return
  }

  const sessionId = modalSessionId
  const requestId = ++activeRequestId
  requestError.value = ''
  isAccepted.value = false
  isLoading.value = true

  try {
    await domainsApi.resolveNow(domain.id)
    if (sessionId !== modalSessionId || requestId !== activeRequestId || !props.isOpen) return
    isAccepted.value = true
  } catch (error) {
    if (sessionId !== modalSessionId || requestId !== activeRequestId || !props.isOpen) return
    requestError.value = getRequestErrorMessage(error)
  } finally {
    if (sessionId === modalSessionId && requestId === activeRequestId) isLoading.value = false
  }
}

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
  <BaseModal :is-open="isOpen" :title="DOMAIN_RESOLVE_NOW_TEXTS.MODAL_TITLE" @close="closeModal">
    <form class="space-y-5" @submit.prevent="runResolveNow">
      <div
        v-if="domain"
        class="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 dark:border-gray-700 dark:bg-gray-900/50"
      >
        <div>
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ DOMAIN_RESOLVE_NOW_TEXTS.DOMAIN_LABEL }}
          </div>
          <div class="mt-1 font-mono text-sm font-medium break-all text-gray-900 dark:text-gray-100">
            {{ domain.name }}
          </div>
        </div>
        <div>
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ DOMAIN_RESOLVE_NOW_TEXTS.ID_LABEL }}
          </div>
          <div class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ domain.id }}</div>
        </div>
      </div>

      <p class="text-sm leading-6 text-gray-700 dark:text-gray-300">
        {{ DOMAIN_RESOLVE_NOW_TEXTS.DESCRIPTION }}
      </p>

      <div
        v-if="requestError"
        class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        <div class="font-semibold">{{ DOMAIN_RESOLVE_NOW_TEXTS.ERROR_TITLE }}</div>
        <div class="mt-1">{{ requestError }}</div>
      </div>

      <div v-if="isLoading" class="rounded-lg border border-gray-200 p-8 dark:border-gray-700" aria-live="polite">
        <LoadingSpinner size="lg" :message="DOMAIN_RESOLVE_NOW_TEXTS.LOADING" />
      </div>

      <div
        v-else-if="isAccepted"
        class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300"
        role="status"
        aria-live="polite"
      >
        <div class="font-semibold">{{ DOMAIN_RESOLVE_NOW_TEXTS.ACCEPTED_TITLE }}</div>
        <div class="mt-1">{{ DOMAIN_RESOLVE_NOW_TEXTS.ACCEPTED_MESSAGE }}</div>
      </div>

      <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
        <BaseButton type="button" variant="ghost" @click="closeModal">
          {{ isAccepted ? DOMAIN_RESOLVE_NOW_TEXTS.CLOSE : UI_TEXTS.CANCEL }}
        </BaseButton>
        <BaseButton v-if="!isAccepted" type="submit" variant="primary" :is-loading="isLoading">
          {{ DOMAIN_RESOLVE_NOW_TEXTS.RUN }}
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped></style>
