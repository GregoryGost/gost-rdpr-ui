<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ApiError, NetworkError } from '@/api/client'
import { domainsApi } from '@/api/endpoints/domains'
import type {
  Domain,
  DomainResolveCheckRequest,
  DomainResolveCheckResponse,
  DnsServerResolveResult,
} from '@/api/types/domains'
import { DOMAIN_RESOLVE_CHECK_TEXTS } from '@/constants'
import BaseButton from '@/ui/buttons/BaseButton.vue'
import LoadingSpinner from '@/ui/feedback/LoadingSpinner.vue'
import BaseInput from '@/ui/forms/BaseInput.vue'
import BaseModal from '@/ui/modals/BaseModal.vue'

/**
 * One-time domain resolve check modal
 * @component DomainResolveCheckModal
 */
interface Props {
  isOpen: boolean
  domain?: Pick<Domain, 'id' | 'name'> | null
}

const props = withDefaults(defineProps<Props>(), {
  domain: null,
})

const emit = defineEmits<{
  close: []
}>()

const domainName = ref('')
const formError = ref('')
const requestError = ref('')
const isLoading = ref(false)
const resolveResult = ref<DomainResolveCheckResponse | null>(null)
let activeRequestId = 0

const isSavedDomainMode = computed(() => props.domain !== null)

/**
 * Reset modal state and invalidate any pending request result.
 * @param {string} initialDomainName - Domain name displayed when the modal opens
 * @returns {void}
 */
const resetState = (initialDomainName = ''): void => {
  activeRequestId += 1
  domainName.value = initialDomainName
  formError.value = ''
  requestError.value = ''
  isLoading.value = false
  resolveResult.value = null
}

watch(
  () => ({ isOpen: props.isOpen, domain: props.domain }),
  ({ isOpen, domain }) => {
    resetState(isOpen ? (domain?.name ?? '') : '')
  },
  { immediate: true },
)

/**
 * Convert a handled request failure into modal-specific user text.
 * @param {unknown} error - Request failure
 * @returns {string} User-facing error message
 */
const getRequestErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Домен с указанным ID не найден'
    if (error.status === 422) return 'Проверьте доменное имя или ID и повторите запрос'
    if (error.status >= 500) {
      return 'Сервер не смог выполнить проверку. Убедитесь, что DNS-серверы настроены, и повторите запрос'
    }
    return error.message
  }

  if (error instanceof NetworkError) return error.message
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить проверку резолвинга'
}

/**
 * Validate the editable domain-name source.
 * @returns {string | null} Normalized input or null when invalid
 */
const validateDomainName = (): string | null => {
  const value = domainName.value.trim()
  formError.value = ''

  if (!value) {
    formError.value = DOMAIN_RESOLVE_CHECK_TEXTS.DOMAIN_REQUIRED
    return null
  }

  if (value.length > 253) {
    formError.value = DOMAIN_RESOLVE_CHECK_TEXTS.DOMAIN_TOO_LONG
    return null
  }

  return value
}

/**
 * Run a one-time resolve check for the selected source.
 * @returns {Promise<void>}
 */
const runResolveCheck = async (): Promise<void> => {
  let request: DomainResolveCheckRequest

  if (props.domain) {
    request = { id: props.domain.id }
  } else {
    const value = validateDomainName()
    if (!value) return
    request = { domain: value }
  }

  const requestId = ++activeRequestId
  requestError.value = ''
  resolveResult.value = null
  isLoading.value = true

  try {
    const result = await domainsApi.resolveCheck(request)
    if (requestId !== activeRequestId || !props.isOpen) return
    resolveResult.value = result
  } catch (error) {
    if (requestId !== activeRequestId || !props.isOpen) return
    requestError.value = getRequestErrorMessage(error)
  } finally {
    if (requestId === activeRequestId) isLoading.value = false
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

const clearFormError = (): void => {
  formError.value = ''
}

const hasRecords = (result: DnsServerResolveResult): boolean => {
  return result.ips_v4.length > 0 || result.ips_v6.length > 0 || result.cnames.length > 0
}
</script>

<template>
  <BaseModal :is-open="isOpen" :title="DOMAIN_RESOLVE_CHECK_TEXTS.MODAL_TITLE" size="lg" @close="closeModal">
    <form class="space-y-5" @submit.prevent="runResolveCheck">
      <div
        v-if="isSavedDomainMode && domain"
        class="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 dark:border-gray-700 dark:bg-gray-900/50"
      >
        <div>
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400">Доменное имя</div>
          <div class="mt-1 font-mono text-sm font-medium text-gray-900 dark:text-gray-100">{{ domain.name }}</div>
        </div>
        <div>
          <div class="text-xs font-medium text-gray-500 dark:text-gray-400">ID</div>
          <div class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{{ domain.id }}</div>
        </div>
      </div>

      <div v-else>
        <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ DOMAIN_RESOLVE_CHECK_TEXTS.DOMAIN_LABEL }}
        </label>
        <BaseInput
          v-model="domainName"
          type="text"
          :placeholder="DOMAIN_RESOLVE_CHECK_TEXTS.DOMAIN_PLACEHOLDER"
          :error="formError"
          :is-disabled="isLoading"
          :is-required="true"
          @update:model-value="clearFormError"
        />
      </div>

      <div
        v-if="requestError"
        class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        <div class="font-semibold">Проверка не выполнена</div>
        <div class="mt-1">{{ requestError }}</div>
      </div>

      <div v-if="isLoading" class="rounded-lg border border-gray-200 p-8 dark:border-gray-700" aria-live="polite">
        <LoadingSpinner size="lg" :message="DOMAIN_RESOLVE_CHECK_TEXTS.LOADING" />
      </div>

      <section v-else-if="resolveResult" class="space-y-4" aria-live="polite">
        <div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            {{ DOMAIN_RESOLVE_CHECK_TEXTS.RESULT_TITLE }}
          </h3>
          <p class="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300">{{ resolveResult.domain }}</p>
        </div>

        <div
          v-if="resolveResult.results.length === 0"
          class="rounded-lg border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
        >
          {{ DOMAIN_RESOLVE_CHECK_TEXTS.EMPTY_RECORDS }}
        </div>

        <article
          v-for="(serverResult, index) in resolveResult.results"
          :key="`${serverResult.server_type}-${serverResult.server}-${index}`"
          class="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        >
          <header
            class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700"
          >
            <h4 class="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{{ serverResult.server }}</h4>
            <span
              class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {{ serverResult.server_type }}
            </span>
          </header>

          <div v-if="!hasRecords(serverResult)" class="pt-4 text-sm text-gray-500 dark:text-gray-400">
            {{ DOMAIN_RESOLVE_CHECK_TEXTS.EMPTY_RECORDS }}
          </div>

          <div v-else class="grid gap-4 pt-4 lg:grid-cols-3">
            <div>
              <div class="mb-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">IPv4</div>
              <div v-if="serverResult.ips_v4.length > 0" class="flex flex-wrap gap-1.5">
                <span
                  v-for="ip in serverResult.ips_v4"
                  :key="ip"
                  class="rounded-md bg-blue-100 px-2 py-1 font-mono text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {{ ip }}
                </span>
              </div>
              <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ DOMAIN_RESOLVE_CHECK_TEXTS.EMPTY_RECORDS }}
              </div>
            </div>

            <div>
              <div class="mb-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">IPv6</div>
              <div v-if="serverResult.ips_v6.length > 0" class="flex flex-wrap gap-1.5">
                <span
                  v-for="ip in serverResult.ips_v6"
                  :key="ip"
                  class="rounded-md bg-purple-100 px-2 py-1 font-mono text-xs text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                >
                  {{ ip }}
                </span>
              </div>
              <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ DOMAIN_RESOLVE_CHECK_TEXTS.EMPTY_RECORDS }}
              </div>
            </div>

            <div>
              <div class="mb-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">CNAME</div>
              <div v-if="serverResult.cnames.length > 0" class="flex flex-wrap gap-1.5">
                <span
                  v-for="cname in serverResult.cnames"
                  :key="cname"
                  class="rounded-md bg-emerald-100 px-2 py-1 font-mono text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  {{ cname }}
                </span>
              </div>
              <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ DOMAIN_RESOLVE_CHECK_TEXTS.EMPTY_RECORDS }}
              </div>
            </div>
          </div>
        </article>
      </section>

      <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
        <BaseButton type="button" variant="ghost" @click="closeModal">
          {{ DOMAIN_RESOLVE_CHECK_TEXTS.CLOSE }}
        </BaseButton>
        <BaseButton type="submit" variant="primary" :is-loading="isLoading">
          {{ DOMAIN_RESOLVE_CHECK_TEXTS.RUN }}
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>

<style lang="scss" scoped></style>
