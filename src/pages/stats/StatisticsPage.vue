<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { statsApi } from '@/api/endpoints/stats'
import LineChart from '@/components/charts/LineChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import StatsMetricCard from '@/components/dashboard/StatsMetricCard.vue'
import StatsPieCard from '@/components/dashboard/StatsPieCard.vue'
import SparklineCard from '@/components/dashboard/SparklineCard.vue'
import { STATS_TEXTS } from '@/constants'
import { errorHandler } from '@/utils/errorHandler'
import type {
  StatsResponse,
  StatsGrowthResponse,
  GrowthEntity,
  GrowthGranularity,
  GrowthDateField,
} from '@/api/types/stats'

const stats = ref<StatsResponse | null>(null)
const growth = ref<StatsGrowthResponse | null>(null)
const isStatsLoading = ref(false)
const isGrowthLoading = ref(false)

const selectedEntity = ref<GrowthEntity>('domains')
const selectedGranularity = ref<GrowthGranularity>('day')
const selectedDateField = ref<GrowthDateField>('created_at')
const startDate = ref('')
const endDate = ref('')
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

const availableDateFields = computed(() =>
  DATE_FIELDS.filter((f) => !f.onlyFor || f.onlyFor === selectedEntity.value),
)

const chartColor = computed(() => {
  const map: Record<GrowthEntity, string> = {
    domains: '#6366f1',
    lists: '#14b8a6',
    ips: '#a855f7',
  }
  return map[selectedEntity.value]
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
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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

const loadGrowth = async () => {
  isGrowthLoading.value = true
  try {
    if (selectedDateField.value === 'last_resolved_at' && selectedEntity.value !== 'domains') {
      selectedDateField.value = 'created_at'
    }
    growth.value = await statsApi.getGrowth({
      entity: selectedEntity.value,
      granularity: selectedGranularity.value,
      start_date: startDate.value || defaultStartDate(selectedGranularity.value),
      end_date: endDate.value || null,
      ip_subtype:
        selectedEntity.value === 'ips' && ipSubtype.value !== ''
          ? Number(ipSubtype.value)
          : null,
      date_filter_field: selectedDateField.value,
    })
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'loadGrowth',
      component: 'StatisticsPage',
      silent: false,
    })
  } finally {
    isGrowthLoading.value = false
  }
}

const applyFilters = () => loadGrowth()

const resetFilters = () => {
  selectedGranularity.value = 'day'
  selectedDateField.value = 'created_at'
  startDate.value = ''
  endDate.value = ''
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

      <p v-if="stats" class="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {{ STATS_TEXTS.GENERATED_AT }}: {{ stats.generated_at }}
      </p>
    </section>

    <!-- Live sparklines -->
    <section class="mt-10">
      <h2 class="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
        {{ STATS_TEXTS.SECTION_LIVE }}
      </h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SparklineCard
          entity="domains"
          :label="STATS_TEXTS.ENTITY_DOMAINS"
          color="#6366f1"
          date-field="updated_at"
        />
        <SparklineCard
          entity="lists"
          :label="STATS_TEXTS.ENTITY_LISTS"
          color="#14b8a6"
          date-field="updated_at"
        />
        <SparklineCard
          entity="ips"
          :label="STATS_TEXTS.ENTITY_IPS"
          color="#a855f7"
          date-field="updated_at"
        />
      </div>
    </section>

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
            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_ENTITY }}
            </label>
            <select
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
            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_GRANULARITY }}
            </label>
            <select
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
            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_DATE_FIELD }}
            </label>
            <select
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
            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_IP_SUBTYPE }}
            </label>
            <select
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
            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_START_DATE }}
            </label>
            <input
              v-model="startDate"
              type="datetime-local"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          <!-- End date -->
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ STATS_TEXTS.LABEL_END_DATE }}
            </label>
            <input
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
      <div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">
              {{
                ENTITIES.find((e) => e.value === selectedEntity)?.label ?? selectedEntity
              }}
              —
              {{
                GRANULARITIES.find((g) => g.value === selectedGranularity)?.label ?? selectedGranularity
              }}
            </h3>
            <p v-if="growth" class="text-sm text-gray-500 dark:text-gray-400">
              {{ STATS_TEXTS.TOTAL_IN_PERIOD }}: {{ growth.total_in_period }}
            </p>
          </div>
          <div
            v-if="isGrowthLoading"
            class="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
          />
        </div>

        <div v-if="!isGrowthLoading && growthPoints.length === 0" class="py-12 text-center text-gray-400">
          {{ STATS_TEXTS.NO_DATA }}
        </div>

        <LineChart
          v-else
          :points="growthPoints"
          :height="280"
          :color="chartColor"
        />
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
          <BarChart
            v-else
            :bars="domainsBarData"
            :height="EMPTY_BAR_HEIGHT"
            default-color="#6366f1"
          />
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
          <BarChart
            v-else
            :bars="ipsBarData"
            :height="EMPTY_BAR_HEIGHT"
            default-color="#a855f7"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped></style>
