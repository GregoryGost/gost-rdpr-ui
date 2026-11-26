<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { statsApi } from '@/api/endpoints/stats'
import LineChart from '@/components/charts/LineChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import StatsMetricCard from '@/components/dashboard/StatsMetricCard.vue'
import StatsPieCard from '@/components/dashboard/StatsPieCard.vue'
import MetricsActivity from './MetricsActivity.vue'
import { STATS_TEXTS } from '@/constants'
import { errorHandler } from '@/utils/errorHandler'
import { useLatestRequest } from '@/composables'
import type {
  StatsResponse,
  StatsGrowthResponse,
  StatsGrowthParams,
  GrowthEntity,
  GrowthGranularity,
  GrowthDateField,
} from '@/api/types/stats'

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

function todayRange(): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = padTwo(now.getMonth() + 1)
  const d = padTwo(now.getDate())
  return {
    start: `${y}-${m}-${d}T00:00`,
    end: `${y}-${m}-${d}T23:59`,
  }
}

const stats = ref<StatsResponse | null>(null)
const growth = ref<StatsGrowthResponse | null>(null)
const isStatsLoading = ref(false)
/** isGrowthLoading is true while the submitted filter request is in flight. */
const isGrowthLoading = ref(false)
/** growthError records the latest chart failure independently of an empty result. */
const growthError = ref(false)
/** growthRequests discards older chart responses and any responses received after unmount. */
const growthRequests = useLatestRequest()
/** submittedGrowth holds the latest requested filters while the user edits the form or retries a failure. */
const submittedGrowth = ref<StatsGrowthParams | null>(null)
/** growthRegion is a stable focus target when retry replaces the error controls. */
const growthRegion = ref<HTMLElement | null>(null)

const selectedEntity = ref<GrowthEntity>('domains')
const selectedGranularity = ref<GrowthGranularity>('hour')
const selectedDateField = ref<GrowthDateField>('created_at')
const { start: todayStart, end: todayEnd } = todayRange()
const startDate = ref(todayStart)
const endDate = ref(todayEnd)
const ipSubtype = ref<'' | '4' | '6'>('')

const ENTITIES: { value: GrowthEntity; label: string }[] = [
  { value: 'domains', label: STATS_TEXTS.ENTITY_DOMAINS },
  { value: 'lists', label: STATS_TEXTS.ENTITY_LISTS },
  { value: 'ips', label: STATS_TEXTS.ENTITY_IPS },
]

const GRANULARITIES: { value: GrowthGranularity; label: string }[] = [
  { value: 'minute', label: STATS_TEXTS.GRANULARITY_MINUTE },
  { value: 'hour', label: STATS_TEXTS.GRANULARITY_HOUR },
  { value: 'day', label: STATS_TEXTS.GRANULARITY_DAY },
  { value: 'week', label: STATS_TEXTS.GRANULARITY_WEEK },
  { value: 'month', label: STATS_TEXTS.GRANULARITY_MONTH },
  { value: 'year', label: STATS_TEXTS.GRANULARITY_YEAR },
]

const DATE_FIELDS: { value: GrowthDateField; label: string; onlyFor?: GrowthEntity }[] = [
  { value: 'created_at', label: STATS_TEXTS.DATE_FIELD_CREATED },
  { value: 'updated_at', label: STATS_TEXTS.DATE_FIELD_UPDATED },
  { value: 'last_resolved_at', label: STATS_TEXTS.DATE_FIELD_RESOLVED, onlyFor: 'domains' },
]

const availableDateFields = computed(() => DATE_FIELDS.filter((f) => !f.onlyFor || f.onlyFor === selectedEntity.value))

/** chartColor uses the accepted result rather than any unapplied edits to the filters. */
const chartColor = computed(() => {
  /** map assigns the chart color to each supported entity. */
  const map: Record<GrowthEntity, string> = {
    domains: '#6366f1',
    lists: '#14b8a6',
    ips: '#a855f7',
  }
  return map[growth.value?.entity ?? selectedEntity.value]
})

const growthPoints = computed(() => growth.value?.payload ?? [])

type SortOrder = 'default' | 'desc' | 'asc'

const domainsSortOrder = ref<SortOrder>('default')
const ipsSortOrder = ref<SortOrder>('default')

const SORT_ORDERS: { value: SortOrder; label: string; icon: string }[] = [
  { value: 'default', label: STATS_TEXTS.SORT_DEFAULT, icon: '≡' },
  { value: 'desc', label: STATS_TEXTS.SORT_DESC, icon: '↓' },
  { value: 'asc', label: STATS_TEXTS.SORT_ASC, icon: '↑' },
]

function applySortOrder<T extends { value: number }>(items: T[], order: SortOrder): T[] {
  if (order === 'desc') return [...items].sort((a, b) => b.value - a.value)
  if (order === 'asc') return [...items].sort((a, b) => a.value - b.value)
  return items
}

const domainsBarData = computed(() => {
  if (!stats.value) return []
  const raw = stats.value.domains.per_list.map((item) => ({
    label: item.list_name,
    value: item.total,
    color: '#6366f1',
  }))
  return applySortOrder(raw, domainsSortOrder.value)
})

const ipsBarData = computed(() => {
  if (!stats.value) return []
  const raw = stats.value.ips.per_list.map((item) => ({
    label: item.list_name,
    value: item.total,
    color: '#a855f7',
  }))
  return applySortOrder(raw, ipsSortOrder.value)
})

const EMPTY_BAR_HEIGHT = 100

const loadStats = async () => {
  isStatsLoading.value = true
  try {
    stats.value = await statsApi.getStats()
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'loadStats',
      component: 'StatisticsPage',
      silent: false,
    })
  } finally {
    isStatsLoading.value = false
  }
}

function formatApiDate(d: Date): string {
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())} ${padTwo(d.getHours())}:${padTwo(d.getMinutes())}:${padTwo(d.getSeconds())}`
}

function defaultStartDate(granularity: GrowthGranularity): string {
  const d = new Date()
  const shifts: Record<GrowthGranularity, () => void> = {
    minute: () => d.setHours(d.getHours() - 6),
    hour: () => d.setDate(d.getDate() - 14),
    day: () => d.setMonth(d.getMonth() - 3),
    week: () => d.setFullYear(d.getFullYear() - 2),
    month: () => d.setFullYear(d.getFullYear() - 3),
    year: () => d.setFullYear(d.getFullYear() - 10),
  }
  shifts[granularity]()
  return formatApiDate(d)
}

/** Loads the submitted range or retries retryParams. A superseded request cannot publish its data or error. */
const loadGrowth = async (retryParams?: StatsGrowthParams) => {
  /** isCurrent guards publication of data, failure and completion from this request. */
  const isCurrent = growthRequests.begin()
  if (!retryParams && selectedDateField.value === 'last_resolved_at' && selectedEntity.value !== 'domains') {
    selectedDateField.value = 'created_at'
  }
  /** params uses the submitted filters on retry and captures the form values for a new request. */
  const params = retryParams ?? {
    entity: selectedEntity.value,
    granularity: selectedGranularity.value,
    start_date: startDate.value || defaultStartDate(selectedGranularity.value),
    end_date: endDate.value || null,
    ip_subtype: selectedEntity.value === 'ips' && ipSubtype.value !== '' ? Number(ipSubtype.value) : null,
    date_filter_field: selectedDateField.value,
  }
  submittedGrowth.value = params
  growth.value = null
  growthError.value = false
  isGrowthLoading.value = true
  try {
    /** response holds the server data for the filters captured in this request. */
    const response = await statsApi.getGrowth(params)
    if (isCurrent()) growth.value = response
  } catch (error) {
    // error belongs to this chart request; an obsolete failure cannot replace the current chart or announce an error.
    if (!isCurrent()) return
    growthError.value = true
    errorHandler.handleError(error, {
      action: 'loadGrowth',
      component: 'StatisticsPage',
      silent: true,
    })
  } finally {
    if (isCurrent()) isGrowthLoading.value = false
  }
}

/** Repeats the failed query and keeps keyboard focus in the chart while it reloads. */
function retryGrowth(): void {
  if (!submittedGrowth.value) return
  growthRegion.value?.focus()
  void loadGrowth(submittedGrowth.value)
}

/** Applies the form drafts as a new chart query. */
const applyFilters = () => loadGrowth()

const resetFilters = () => {
  selectedGranularity.value = 'hour'
  selectedDateField.value = 'created_at'
  const { start, end } = todayRange()
  startDate.value = start
  endDate.value = end
  ipSubtype.value = ''
  loadGrowth()
}

watch(selectedEntity, () => {
  if (selectedDateField.value === 'last_resolved_at' && selectedEntity.value !== 'domains') {
    selectedDateField.value = 'created_at'
  }
  if (selectedEntity.value !== 'ips') {
    ipSubtype.value = ''
  }
  loadGrowth()
})

onMounted(() => {
  loadStats()
  loadGrowth()
})
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {{ STATS_TEXTS.PAGE_TITLE }}
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">{{ STATS_TEXTS.PAGE_DESCRIPTION }}</p>
    </div>

    <!-- Overview metrics -->
    <section>
      <h2 class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
        {{ STATS_TEXTS.SECTION_OVERVIEW }}
      </h2>

      <!-- Pie charts row -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsPieCard
          :title="STATS_TEXTS.DNS_TOTAL"
          :slices="[
            { label: STATS_TEXTS.DNS_CLASSIC, value: stats?.dns.classic ?? 0, color: '#3b82f6' },
            { label: STATS_TEXTS.DNS_DOH, value: stats?.dns.doh ?? 0, color: '#06b6d4' },
          ]"
          :loading="isStatsLoading"
        />
        <StatsPieCard
          :title="STATS_TEXTS.DOMAINS_TOTAL"
          :slices="[
            { label: STATS_TEXTS.DOMAINS_RESOLVED, value: stats?.domains.resolved ?? 0, color: '#22c55e' },
            { label: STATS_TEXTS.DOMAINS_UNRESOLVED, value: stats?.domains.unresolved ?? 0, color: '#ef4444' },
          ]"
          :loading="isStatsLoading"
        />
        <StatsPieCard
          :title="STATS_TEXTS.IPS_TOTAL"
          :slices="[
            { label: STATS_TEXTS.IPS_V4, value: stats?.ips.v4_total ?? 0, color: '#6366f1' },
            { label: STATS_TEXTS.IPS_V6, value: stats?.ips.v6_total ?? 0, color: '#a855f7' },
          ]"
          :loading="isStatsLoading"
        />
      </div>

      <!-- Metric cards row -->
      <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsMetricCard
          :title="STATS_TEXTS.DOMAINS_LISTS"
          :value="stats?.domains.lists_total ?? null"
          color="teal"
          :loading="isStatsLoading"
        />
        <StatsMetricCard
          :title="STATS_TEXTS.IPS_LISTS"
          :value="stats?.ips.lists_total ?? null"
          color="teal"
          :loading="isStatsLoading"
        />
        <StatsMetricCard
          :title="STATS_TEXTS.IPS_LINKED"
          :value="stats?.ips.linked_to_domain ?? null"
          :secondary-label="STATS_TEXTS.IPS_STANDALONE"
          :secondary-value="stats?.ips.standalone ?? null"
          color="orange"
          :loading="isStatsLoading"
        />
        <StatsMetricCard
          :title="STATS_TEXTS.ROS_TOTAL"
          :value="stats?.ros.total ?? null"
          color="red"
          :loading="isStatsLoading"
        />
      </div>

      <p v-if="stats" class="mt-2 text-xs text-gray-600 dark:text-gray-300">
        {{ STATS_TEXTS.GENERATED_AT }}: {{ stats.generated_at }}
      </p>
    </section>

    <MetricsActivity />

    <!-- Growth chart -->
    <section class="mt-10">
      <h2 class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
        {{ STATS_TEXTS.SECTION_GROWTH }}
      </h2>

      <!-- Filters panel -->
      <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <!-- Entity selector -->
          <div>
            <label for="growth-entity" class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_ENTITY }}
            </label>
            <select
              id="growth-entity"
              v-model="selectedEntity"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option v-for="e in ENTITIES" :key="e.value" :value="e.value">
                {{ e.label }}
              </option>
            </select>
          </div>

          <!-- Granularity selector -->
          <div>
            <label for="growth-granularity" class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_GRANULARITY }}
            </label>
            <select
              id="growth-granularity"
              v-model="selectedGranularity"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option v-for="g in GRANULARITIES" :key="g.value" :value="g.value">
                {{ g.label }}
              </option>
            </select>
          </div>

          <!-- Date field -->
          <div>
            <label for="growth-date-field" class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_DATE_FIELD }}
            </label>
            <select
              id="growth-date-field"
              v-model="selectedDateField"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option v-for="f in availableDateFields" :key="f.value" :value="f.value">
                {{ f.label }}
              </option>
            </select>
          </div>

          <!-- IP subtype (only for ips) -->
          <div v-if="selectedEntity === 'ips'">
            <label for="growth-ip-subtype" class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_IP_SUBTYPE }}
            </label>
            <select
              id="growth-ip-subtype"
              v-model="ipSubtype"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">{{ STATS_TEXTS.IP_SUBTYPE_ALL }}</option>
              <option value="4">{{ STATS_TEXTS.IP_SUBTYPE_V4 }}</option>
              <option value="6">{{ STATS_TEXTS.IP_SUBTYPE_V6 }}</option>
            </select>
          </div>

          <!-- Start date -->
          <div>
            <label for="growth-start" class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_START_DATE }}
            </label>
            <input
              id="growth-start"
              v-model="startDate"
              type="datetime-local"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          <!-- End date -->
          <div>
            <label for="growth-end" class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_END_DATE }}
            </label>
            <input
              id="growth-end"
              v-model="endDate"
              type="datetime-local"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        <div class="mt-4 flex gap-3">
          <button
            :disabled="isGrowthLoading"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            @click="applyFilters"
          >
            {{ STATS_TEXTS.APPLY_FILTERS }}
          </button>
          <button
            :disabled="isGrowthLoading"
            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            @click="resetFilters"
          >
            {{ STATS_TEXTS.RESET_FILTERS }}
          </button>
        </div>
      </div>

      <!-- Growth chart card -->
      <div
        ref="growthRegion"
        tabindex="-1"
        role="region"
        aria-label="График роста"
        class="rounded-lg border border-gray-200 bg-white p-6 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="mb-4 flex items-center justify-between">
          <div>
            <!-- Each find callback resolves the label of the rendered or most recently submitted query. -->
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
              {{
                ENTITIES.find((e) => e.value === (growth?.entity ?? submittedGrowth?.entity ?? selectedEntity))?.label
              }}
              —
              {{
                GRANULARITIES.find(
                  (g) => g.value === (growth?.granularity ?? submittedGrowth?.granularity ?? selectedGranularity),
                )?.label
              }}
            </h3>
            <p v-if="growth" class="text-sm text-gray-500 dark:text-gray-400">
              {{ STATS_TEXTS.TOTAL_IN_PERIOD }}: {{ growth.total_in_period }}
            </p>
          </div>
        </div>

        <p v-if="isGrowthLoading" role="status" class="py-12 text-center text-sm text-gray-600 dark:text-gray-300">
          Загрузка графика…
        </p>
        <div v-else-if="growthError" class="py-12 text-center">
          <p role="alert" class="mb-2 text-sm font-medium text-red-700 dark:text-red-300">
            Не удалось загрузить график
          </p>
          <button
            type="button"
            class="rounded px-3 py-2 text-sm text-blue-700 underline dark:text-blue-300"
            @click="retryGrowth"
          >
            Повторить
          </button>
        </div>
        <p v-else-if="growthPoints.length === 0" class="py-12 text-center text-gray-600 dark:text-gray-300">
          {{ STATS_TEXTS.NO_DATA }}
        </p>
        <template v-else>
          <LineChart :points="growthPoints" :height="280" :color="chartColor" />
          <details class="mt-3 text-sm text-gray-700 dark:text-gray-200">
            <summary class="cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-blue-500">
              Значения по времени
            </summary>
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-600">
                  <th scope="col" class="py-2 pr-4 font-medium">Период</th>
                  <th scope="col" class="py-2 font-medium">Количество</th>
                </tr>
              </thead>
              <tbody>
                <!-- point carries the period and count of one plotted sample, in API order. -->
                <tr
                  v-for="point in growthPoints"
                  :key="point.date"
                  class="border-b border-gray-200 dark:border-gray-600"
                >
                  <td class="py-2 pr-4">{{ point.date }}</td>
                  <td class="py-2 tabular-nums">{{ point.count.toLocaleString('ru-RU') }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </template>
      </div>
    </section>

    <!-- Per-list breakdown -->
    <section v-if="stats" class="mt-10">
      <h2 class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
        {{ STATS_TEXTS.PER_LIST_TITLE }}
      </h2>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Domains per list -->
        <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div class="mb-4 flex items-center justify-between gap-2">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
              {{ STATS_TEXTS.ENTITY_DOMAINS }}
            </h3>
            <div class="flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-600">
              <button
                v-for="s in SORT_ORDERS"
                :key="s.value"
                :title="s.label"
                :aria-label="s.label"
                :aria-pressed="domainsSortOrder === s.value"
                class="px-2.5 py-1 text-sm transition-colors"
                :class="
                  domainsSortOrder === s.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                "
                @click="domainsSortOrder = s.value"
              >
                {{ s.icon }}
              </button>
            </div>
          </div>
          <div v-if="domainsBarData.length === 0" class="py-8 text-center text-gray-400">
            {{ STATS_TEXTS.NO_DATA }}
          </div>
          <BarChart v-else :bars="domainsBarData" :height="EMPTY_BAR_HEIGHT" default-color="#6366f1" />
        </div>

        <!-- IPs per list -->
        <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div class="mb-4 flex items-center justify-between gap-2">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
              {{ STATS_TEXTS.ENTITY_IPS }}
            </h3>
            <div class="flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-600">
              <button
                v-for="s in SORT_ORDERS"
                :key="s.value"
                :title="s.label"
                :aria-label="s.label"
                :aria-pressed="ipsSortOrder === s.value"
                class="px-2.5 py-1 text-sm transition-colors"
                :class="
                  ipsSortOrder === s.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                "
                @click="ipsSortOrder = s.value"
              >
                {{ s.icon }}
              </button>
            </div>
          </div>
          <div v-if="ipsBarData.length === 0" class="py-8 text-center text-gray-400">
            {{ STATS_TEXTS.NO_DATA }}
          </div>
          <BarChart v-else :bars="ipsBarData" :height="EMPTY_BAR_HEIGHT" default-color="#a855f7" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped></style>
