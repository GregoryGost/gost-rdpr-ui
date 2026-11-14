<script setup lang="ts">
import { computed, useId } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/20/solid'

/** Parent-owned pagination state and optional controls for repeated responsive panels. */
interface Props {
  /** One-based selected page; empty results conventionally keep this at one. */
  currentPage: number
  /** Number of pages in the current filtered result, including zero for an empty result. */
  totalPages: number
  /** Number of matching rows used to display the current range. */
  totalItems: number
  /** Maximum rows requested per page. */
  pageSize: number
  /** Allowed row counts offered by each page-size selector. */
  pageSizeOptions?: number[]
  /** Adds a final-page shortcut after the desktop window and in the compact mobile panel. */
  showLastPage?: boolean
  /** Replaces the legacy mobile arrows with current/last-page controls and a page-size selector. */
  compactMobile?: boolean
  /** Prevents page and size changes while the parent is loading the selected result. */
  isLoading?: boolean
  /** Accessible navigation name that can distinguish multiple panels on the same page. */
  ariaLabel?: string
}

/** props contains the parent's reactive pagination values; the options factory supplies per-instance defaults. */
const props = withDefaults(defineProps<Props>(), {
  /** Returns an independent list of default row counts for this component instance. */
  pageSizeOptions: () => [10, 20, 50, 100],
  showLastPage: false,
  compactMobile: false,
  isLoading: false,
  ariaLabel: 'Pagination',
})

/** emit requests parent-owned changes without fetching data or mutating pagination props. */
const emit = defineEmits<{
  /** Requests a valid one-based page different from the current page. */
  'update:currentPage': [page: number]
  /** Requests one of the parent's allowed page sizes. */
  'update:pageSize': [size: number]
}>()

/** pageSizeId links this instance's desktop selector and label without colliding with another panel. */
const pageSizeId = useId()
/** mobilePageSizeId gives the compact selector its own label target even while desktop markup is hidden. */
const mobilePageSizeId = `${pageSizeId}-mobile`

/** hasNextPage recomputes whether a forward request is available and loading allows interaction. */
const hasNextPage = computed(() => !props.isLoading && props.currentPage < props.totalPages)
/** hasPrevPage excludes empty results and loading before allowing a backward request. */
const hasPrevPage = computed(() => !props.isLoading && props.totalPages > 0 && props.currentPage > 1)

/** startItem recomputes the first displayed row number, with zero reserved for an empty result. */
const startItem = computed(() => (props.totalItems === 0 ? 0 : (props.currentPage - 1) * props.pageSize + 1))
/** endItem caps the computed last displayed row number at the current result count. */
const endItem = computed(() => Math.min(props.currentPage * props.pageSize, props.totalItems))

/** visiblePages recomputes up to five consecutive page numbers, shifting the window back near the last page. */
const visiblePages = computed(() => {
  /** pages collects the ascending page numbers rendered between the desktop arrows. */
  const pages: number[] = []
  /** maxVisible limits the desktop window without including the optional final-page shortcut. */
  const maxVisible = 5
  /** start is the first window page and moves back when the result ends before a full window fits. */
  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  /** end bounds the window by both the result and the maximum visible count. */
  const end = Math.min(props.totalPages, start + maxVisible - 1)

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }

  // page is the one-based page number appended for each position in the window.
  for (let page = start; page <= end; page++) {
    pages.push(page)
  }

  return pages
})

/** showDesktopLastPage recomputes whether the final page is absent from a nonempty desktop window. */
const showDesktopLastPage = computed(
  () => props.showLastPage && props.totalPages > 0 && !visiblePages.value.includes(props.totalPages),
)
/** showLastPageGap adds a separator only when at least one page is skipped before the final shortcut. */
const showLastPageGap = computed(
  () => showDesktopLastPage.value && props.totalPages > (visiblePages.value.at(-1) ?? 0) + 1,
)

/** Requests page only when it is in range, differs from the selection, and no parent request is pending. */
function selectPage(page: number): void {
  if (props.isLoading || !Number.isInteger(page) || page < 1 || page > props.totalPages || page === props.currentPage) {
    return
  }
  emit('update:currentPage', page)
}

/** Reads a selector change event and requests a different allowed size unless the parent is loading. */
function changePageSize(event: Event): void {
  if (props.isLoading || !(event.target instanceof HTMLSelectElement)) return
  /** size is the numeric row count selected by the user, checked against the parent's offered options. */
  const size = Number(event.target.value)
  if (props.pageSizeOptions.includes(size) && size !== props.pageSize) emit('update:pageSize', size)
}
</script>

<template>
  <div
    class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-700 dark:bg-gray-900"
    :aria-busy="isLoading"
  >
    <div v-if="compactMobile" class="flex min-w-0 flex-1 flex-col gap-3 sm:hidden">
      <nav class="flex flex-wrap items-center justify-between gap-1" :aria-label="ariaLabel">
        <button
          type="button"
          @click="selectPage(currentPage - 1)"
          :disabled="!hasPrevPage"
          class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 enabled:cursor-pointer enabled:hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:enabled:hover:bg-gray-700"
        >
          Назад
        </button>
        <span
          :aria-current="totalPages > 0 ? 'page' : undefined"
          :aria-label="`Текущая страница: ${totalPages > 0 ? currentPage : 0}`"
          class="px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          {{ totalPages > 0 ? currentPage : 0 }}
        </span>
        <button
          v-if="showLastPage && currentPage < totalPages"
          type="button"
          @click="selectPage(totalPages)"
          :disabled="isLoading"
          :aria-label="`Последняя страница: ${totalPages}`"
          class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 enabled:cursor-pointer enabled:hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:enabled:hover:bg-gray-700"
        >
          {{ totalPages }}
        </button>
        <button
          type="button"
          @click="selectPage(currentPage + 1)"
          :disabled="!hasNextPage"
          class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 enabled:cursor-pointer enabled:hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:enabled:hover:bg-gray-700"
        >
          Вперёд
        </button>
      </nav>
      <div class="flex items-center justify-between gap-2">
        <label :for="mobilePageSizeId" class="text-sm text-gray-700 dark:text-gray-300">На странице:</label>
        <select
          :id="mobilePageSizeId"
          :value="pageSize"
          :disabled="isLoading"
          @change="changePageSize"
          class="rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option v-for="size in pageSizeOptions" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
      </div>
    </div>
    <div v-else class="flex flex-1 justify-between sm:hidden">
      <button
        type="button"
        @click="selectPage(currentPage - 1)"
        :disabled="!hasPrevPage"
        :class="[
          hasPrevPage ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : 'cursor-default',
          'relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
        ]"
      >
        Предыдущая
      </button>
      <button
        type="button"
        @click="selectPage(currentPage + 1)"
        :disabled="!hasNextPage"
        :class="[
          hasNextPage ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : 'cursor-default',
          'relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200',
        ]"
      >
        Следующая
      </button>
    </div>
    <div
      :class="
        compactMobile
          ? 'hidden min-w-0 gap-3 sm:flex sm:flex-1 sm:flex-col sm:items-start xl:flex-row xl:items-center xl:justify-between'
          : 'hidden sm:flex sm:flex-1 sm:items-center sm:justify-between'
      "
    >
      <div class="flex flex-wrap items-center gap-4">
        <p class="text-sm text-gray-700 dark:text-gray-300">
          Показано <span class="font-medium">{{ startItem }}</span> - <span class="font-medium">{{ endItem }}</span> из
          <span class="font-medium">{{ totalItems }}</span> результатов
        </p>
        <div class="flex items-center gap-2">
          <label :for="pageSizeId" class="text-sm text-gray-700 dark:text-gray-300">На странице:</label>
          <select
            :id="pageSizeId"
            :value="pageSize"
            :disabled="isLoading"
            @change="changePageSize"
            class="rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option v-for="size in pageSizeOptions" :key="size" :value="size">
              {{ size }}
            </option>
          </select>
        </div>
      </div>
      <nav class="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" :aria-label="ariaLabel">
        <button
          type="button"
          aria-label="Предыдущая страница"
          @click="selectPage(currentPage - 1)"
          :disabled="!hasPrevPage"
          :class="[
            hasPrevPage ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : 'cursor-default',
            'relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400',
          ]"
        >
          <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          v-for="page in visiblePages"
          :key="page"
          type="button"
          @click="selectPage(page)"
          :disabled="isLoading"
          :aria-current="page === currentPage ? 'page' : undefined"
          :class="[
            page === currentPage
              ? 'z-10 cursor-default border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
              : 'cursor-pointer border-gray-300 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
            'relative inline-flex items-center border px-4 py-2 text-sm font-medium focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-default disabled:opacity-50',
          ]"
        >
          {{ page }}
        </button>
        <span
          v-if="showLastPageGap"
          aria-hidden="true"
          class="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
        >
          ...
        </span>
        <button
          v-if="showDesktopLastPage"
          type="button"
          @click="selectPage(totalPages)"
          :disabled="isLoading"
          :aria-label="`Последняя страница: ${totalPages}`"
          class="relative inline-flex items-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 enabled:cursor-pointer enabled:hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:enabled:hover:bg-gray-700"
        >
          {{ totalPages }}
        </button>
        <button
          type="button"
          aria-label="Следующая страница"
          @click="selectPage(currentPage + 1)"
          :disabled="!hasNextPage"
          :class="[
            hasNextPage ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : 'cursor-default',
            'relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400',
          ]"
        >
          <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>
    </div>
  </div>
</template>
