<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ApiError, NetworkError } from '@/api/client'
import { dnsApi } from '@/api/endpoints/dns'
import { domainsApi } from '@/api/endpoints/domains'
import type { DnsServer } from '@/api/types/dns'
import type {
  Domain,
  DomainResolveCheckRequest,
  DomainResolveCheckResponse,
  DnsServerIds,
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

type DnsSelectionMode = 'automatic' | 'manual'

const DNS_SERVER_PAGE_LIMIT = 100
const domainName = ref('')
const formError = ref('')
const selectionError = ref('')
const requestError = ref('')
const isLoading = ref(false)
const resolveResult = ref<DomainResolveCheckResponse | null>(null)
const dnsSelectionMode = ref<DnsSelectionMode>('automatic')
const selectedDnsServerIds = ref<number[]>([])
const dnsServers = ref<DnsServer[]>([])
const dnsListError = ref('')
const isDnsListLoading = ref(false)
let modalSessionId = 0
let activeResolveRequestId = 0
let activeDnsLoadId = 0

const isSavedDomainMode = computed(() => props.domain !== null)
const isManualDnsSelection = computed(() => dnsSelectionMode.value === 'manual')

/**
 * Invalidate the active resolve request and clear its displayed state.
 * @returns {void}
 */
const clearResolveState = (): void => {
  activeResolveRequestId += 1
  requestError.value = ''
  isLoading.value = false
  resolveResult.value = null
}

/**
 * Reset modal state and invalidate pending list and resolve responses.
 * @param {string} initialDomainName - Domain name displayed when the modal opens
 * @returns {void}
 */
const resetState = (initialDomainName = ''): void => {
  modalSessionId += 1
  activeDnsLoadId += 1
  clearResolveState()
  domainName.value = initialDomainName
  formError.value = ''
  selectionError.value = ''
  dnsSelectionMode.value = 'automatic'
  selectedDnsServerIds.value = []
  dnsServers.value = []
  dnsListError.value = ''
  isDnsListLoading.value = false
}

/**
 * Convert a DNS list failure into selection-specific user text.
 * @param {unknown} error - DNS list request failure
 * @returns {string} User-facing error message
 */
const getDnsListErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  return DOMAIN_RESOLVE_CHECK_TEXTS.DNS_LIST_ERROR
}

/**
 * Load every available DNS server page for the manual selector.
 * @returns {Promise<void>}
 */
const loadDnsServers = async (): Promise<void> => {
  if (!props.isOpen || isDnsListLoading.value) return

  const sessionId = modalSessionId
  const loadId = ++activeDnsLoadId
  const loadedServers = new Map<number, DnsServer>()
  let nextOffset = 0

  dnsListError.value = ''
  dnsServers.value = []
  isDnsListLoading.value = true

  try {
    while (true) {
      const response = await dnsApi.getAll({ limit: DNS_SERVER_PAGE_LIMIT, offset: nextOffset })
      if (sessionId !== modalSessionId || loadId !== activeDnsLoadId || !props.isOpen) return

      response.payload.forEach((server) => loadedServers.set(server.id, server))
      nextOffset += response.payload.length

      if (response.payload.length === 0 || nextOffset >= response.total) break
    }

    if (sessionId !== modalSessionId || loadId !== activeDnsLoadId || !props.isOpen) return
    dnsServers.value = [...loadedServers.values()].sort((first, second) => first.id - second.id)
  } catch (error) {
    if (sessionId !== modalSessionId || loadId !== activeDnsLoadId || !props.isOpen) return
    dnsListError.value = getDnsListErrorMessage(error)
  } finally {
    if (sessionId === modalSessionId && loadId === activeDnsLoadId) isDnsListLoading.value = false
  }
}

watch(
  [() => props.isOpen, () => props.domain],
  ([isOpen, domain]) => {
    resetState(isOpen ? (domain?.name ?? '') : '')
    if (isOpen) void loadDnsServers()
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
    if (error.status === 404) {
      return 'Сохраненный домен или один из выбранных DNS-серверов больше не существует'
    }
    if (error.status === 422) return 'Проверьте доменное имя или ID и повторите запрос'
    if (error.status >= 500) {
      return 'Сервер не смог выполнить проверку. Убедитесь, что DNS-серверы настроены, и повторите запрос'
    }
    return error.message
  }

  if (error instanceof TypeError) return DOMAIN_RESOLVE_CHECK_TEXTS.DNS_SELECTION_INVALID
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
 * Validate and normalize the optional manual DNS selection.
 * @returns {DnsServerIds | undefined | null} IDs, automatic mode, or invalid selection
 */
const getDnsServerIds = (): DnsServerIds | undefined | null => {
  selectionError.value = ''
  if (!isManualDnsSelection.value) return undefined

  const normalizedIds = [...new Set(selectedDnsServerIds.value)]
  const hasInvalidId = normalizedIds.some((id) => !Number.isInteger(id) || id < 0)

  if (normalizedIds.length === 0) {
    selectionError.value = DOMAIN_RESOLVE_CHECK_TEXTS.DNS_MANUAL_REQUIRED
    return null
  }

  if (hasInvalidId || normalizedIds.length !== selectedDnsServerIds.value.length) {
    selectionError.value = DOMAIN_RESOLVE_CHECK_TEXTS.DNS_SELECTION_INVALID
    return null
  }

  return normalizedIds as DnsServerIds
}

/**
 * Run a one-time resolve check for the selected source.
 * @returns {Promise<void>}
 */
const runResolveCheck = async (): Promise<void> => {
  if (isLoading.value) return

  let request: DomainResolveCheckRequest
  const dnsServerIds = getDnsServerIds()
  if (dnsServerIds === null) return

  if (props.domain) {
    request = dnsServerIds ? { id: props.domain.id, dns_server_ids: dnsServerIds } : { id: props.domain.id }
  } else {
    const value = validateDomainName()
    if (!value) return
    request = dnsServerIds ? { domain: value, dns_server_ids: dnsServerIds } : { domain: value }
  }

  const sessionId = modalSessionId
  const requestId = ++activeResolveRequestId
  requestError.value = ''
  resolveResult.value = null
  isLoading.value = true

  try {
    const result = await domainsApi.resolveCheck(request)
    if (sessionId !== modalSessionId || requestId !== activeResolveRequestId || !props.isOpen) return
    resolveResult.value = result
  } catch (error) {
    if (sessionId !== modalSessionId || requestId !== activeResolveRequestId || !props.isOpen) return
    requestError.value = getRequestErrorMessage(error)
  } finally {
    if (sessionId === modalSessionId && requestId === activeResolveRequestId) isLoading.value = false
  }
}

/**
 * Switch DNS selection mode and clear stale resolve output.
 * @param {DnsSelectionMode} mode - Next selection mode
 * @returns {void}
 */
const setDnsSelectionMode = (mode: DnsSelectionMode): void => {
  if (dnsSelectionMode.value === mode) return

  dnsSelectionMode.value = mode
  if (mode === 'automatic') selectedDnsServerIds.value = []
  selectionError.value = ''
  clearResolveState()
}

/**
 * Toggle one valid DNS server ID in the manual selection.
 * @param {number} id - DNS server ID
 * @returns {void}
 */
const toggleDnsServer = (id: number): void => {
  const selectedIds = new Set(selectedDnsServerIds.value)
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)

  selectedDnsServerIds.value = [...selectedIds]
  selectionError.value = ''
  clearResolveState()
}

/**
 * Close the modal with a clean state.
 * @returns {void}
 */
const closeModal = (): void => {
  resetState()
  emit('close')
}

const handleDomainInput = (): void => {
  formError.value = ''
  clearResolveState()
}

const hasRecords = (result: DnsServerResolveResult): boolean => {
  return result.ips_v4.length > 0 || result.ips_v6.length > 0 || result.cnames.length > 0
}

const getDnsServerAddress = (server: DnsServer): string => {
  return server.server ?? server.doh_server ?? 'Адрес не указан'
}

const getDnsServerType = (server: DnsServer): 'classic' | 'DoH' => {
  return server.server ? 'classic' : 'DoH'
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
          @update:model-value="handleDomainInput"
        />
      </div>

      <fieldset class="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <legend class="px-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {{ DOMAIN_RESOLVE_CHECK_TEXTS.DNS_SELECTION_TITLE }}
        </legend>

        <label class="flex cursor-pointer items-start gap-3">
          <input
            type="radio"
            name="dns-selection-mode"
            value="automatic"
            class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            :checked="dnsSelectionMode === 'automatic'"
            :disabled="isLoading"
            @change="setDnsSelectionMode('automatic')"
          />
          <span>
            <span class="block text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ DOMAIN_RESOLVE_CHECK_TEXTS.DNS_AUTOMATIC }}
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400">
              {{ DOMAIN_RESOLVE_CHECK_TEXTS.DNS_AUTOMATIC_HINT }}
            </span>
          </span>
        </label>

        <label class="flex cursor-pointer items-start gap-3">
          <input
            type="radio"
            name="dns-selection-mode"
            value="manual"
            class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            :checked="dnsSelectionMode === 'manual'"
            :disabled="isLoading"
            @change="setDnsSelectionMode('manual')"
          />
          <span>
            <span class="block text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ DOMAIN_RESOLVE_CHECK_TEXTS.DNS_MANUAL }}
            </span>
            <span class="block text-xs text-gray-500 dark:text-gray-400">
              {{ DOMAIN_RESOLVE_CHECK_TEXTS.DNS_MANUAL_HINT }}
            </span>
          </span>
        </label>

        <div v-if="isDnsListLoading" class="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50" aria-live="polite">
          <LoadingSpinner size="sm" :message="DOMAIN_RESOLVE_CHECK_TEXTS.DNS_LIST_LOADING" />
        </div>

        <div
          v-else-if="dnsListError"
          class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
          role="alert"
        >
          <div class="font-semibold">{{ DOMAIN_RESOLVE_CHECK_TEXTS.DNS_LIST_ERROR_TITLE }}</div>
          <div class="mt-1">{{ dnsListError }}</div>
          <BaseButton type="button" variant="secondary" size="sm" class="mt-3" @click="loadDnsServers">
            {{ DOMAIN_RESOLVE_CHECK_TEXTS.DNS_LIST_RETRY }}
          </BaseButton>
        </div>

        <div v-else-if="isManualDnsSelection" class="space-y-2">
          <div
            v-if="dnsServers.length === 0"
            class="rounded-lg bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-900/50 dark:text-gray-400"
          >
            {{ DOMAIN_RESOLVE_CHECK_TEXTS.DNS_LIST_EMPTY }}
          </div>

          <div v-else class="max-h-64 space-y-2 overflow-y-auto pr-1" role="group" aria-label="Доступные DNS-серверы">
            <label
              v-for="server in dnsServers"
              :key="server.id"
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/50"
            >
              <input
                type="checkbox"
                class="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                :checked="selectedDnsServerIds.includes(server.id)"
                :disabled="isLoading"
                @change="toggleDnsServer(server.id)"
              />
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">ID {{ server.id }}</span>
                  <span
                    class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    {{ getDnsServerType(server) }}
                  </span>
                </span>
                <span class="mt-1 block font-mono text-sm break-all text-gray-700 dark:text-gray-300">
                  {{ getDnsServerAddress(server) }}
                </span>
                <span v-if="server.description" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                  {{ server.description }}
                </span>
              </span>
            </label>
          </div>
        </div>

        <div v-if="isManualDnsSelection && selectionError" class="text-sm text-red-600 dark:text-red-400" role="alert">
          {{ selectionError }}
        </div>
      </fieldset>

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
