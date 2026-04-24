<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface DataPoint {
  date: string
  count: number
}

interface Props {
  points: DataPoint[]
  height?: number
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: 240,
  color: '#6366f1',
})

const WIDTH = 800
const HEIGHT = computed(() => props.height)
const PADDING = { top: 32, right: 20, bottom: 48, left: 52 }

const chartWidth = computed(() => WIDTH - PADDING.left - PADDING.right)
const chartHeight = computed(() => HEIGHT.value - PADDING.top - PADDING.bottom)

// ResizeObserver: measure actual container width to compensate SVG viewBox scaling.
// Formula: s(px) converts a desired CSS-pixel size into SVG user units so it
// renders at exactly `px` CSS pixels regardless of container width.
const containerRef = ref<HTMLDivElement | null>(null)
const containerWidth = ref(WIDTH)
let ro: ResizeObserver | null = null
let mounted = false

onMounted(() => {
  mounted = true
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth || WIDTH
    ro = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => {
        if (mounted) containerWidth.value = entries[0]?.contentRect.width ?? WIDTH
      })
    })
    ro.observe(containerRef.value)
  }
})
onUnmounted(() => {
  mounted = false
  ro?.disconnect()
})

const FONT_PX = 13

const sc = computed(() => WIDTH / Math.max(containerWidth.value, 1))

// Partially compensates for SVG viewBox scaling.
// On wide screens (>800px) elements grow up to 1.4×; on narrow — shrink no lower than 0.85×.
// rendered_px = px × clamp(containerWidth / WIDTH, 0.85, 1.4)
const s = (px: number) => {
  const ratio = containerWidth.value / WIDTH
  return px * Math.min(Math.max(ratio, 0.85), 1.4) * sc.value
}

const maxCount = computed(() => {
  if (!props.points.length) return 10
  return Math.max(...props.points.map((p) => p.count), 1)
})

const yTicks = computed(() => {
  const step = Math.ceil(maxCount.value / 5)
  return Array.from({ length: 6 }, (_, i) => i * step)
})

const isSinglePoint = computed(() => props.points.length === 1)

const xStep = computed(() => {
  if (props.points.length <= 1) return chartWidth.value
  return chartWidth.value / (props.points.length - 1)
})

const toX = (index: number) => {
  if (isSinglePoint.value) return PADDING.left + chartWidth.value / 2
  return PADDING.left + index * xStep.value
}
const toY = (value: number) =>
  PADDING.top + chartHeight.value - (value / (yTicks.value[yTicks.value.length - 1] || 1)) * chartHeight.value

const polylinePoints = computed(() =>
  props.points.map((p, i) => `${toX(i)},${toY(p.count)}`).join(' '),
)

const areaPoints = computed(() => {
  if (!props.points.length) return ''
  const line = props.points.map((p, i) => `${toX(i)},${toY(p.count)}`).join(' ')
  const bottomRight = `${toX(props.points.length - 1)},${PADDING.top + chartHeight.value}`
  const bottomLeft = `${PADDING.left},${PADDING.top + chartHeight.value}`
  return `${line} ${bottomRight} ${bottomLeft}`
})

const xLabels = computed(() => {
  if (!props.points.length) return []
  const maxLabels = 10
  const step = Math.max(1, Math.ceil(props.points.length / maxLabels))
  return props.points
    .map((p, i) => ({ label: p.date, x: toX(i), index: i }))
    .filter((_, i) => i % step === 0 || i === props.points.length - 1)
})

const labelY = (i: number): number => {
  const y = toY(props.points[i]?.count ?? 0)
  return y < PADDING.top + s(24) ? y + s(20) : y - s(12)
}

const singlePoint = computed(() => props.points[0] ?? { date: '', count: 0 })

const hoveredIndex = ref<number | null>(null)
const hoveredPoint = computed(() =>
  hoveredIndex.value !== null ? (props.points[hoveredIndex.value] ?? null) : null,
)
const axisBottom = computed(() => PADDING.top + chartHeight.value)

const baseDotPx = computed(() => {
  const n = props.points.length
  if (n > 60) return 2.5
  if (n > 30) return 3.5
  return 5
})

const dotRadius = computed(() => {
  const ratio = containerWidth.value / WIDTH
  return baseDotPx.value * Math.min(Math.max(ratio, 0.85), 1.4) * sc.value
})
const hitRadius = computed(() => Math.max(baseDotPx.value * 2, 8) * sc.value)
const lineStrokeWidth = computed(() => {
  const base = props.points.length > 60 ? 1.5 : 2.5
  const ratio = containerWidth.value / WIDTH
  return base * Math.min(Math.max(ratio, 0.85), 1.4) * sc.value
})
</script>

<template>
  <div ref="containerRef" class="w-full">
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="w-full"
      :style="{ minHeight: `${height}px` }"
      aria-label="Линейный график"
    >
      <defs>
        <linearGradient :id="`area-grad-${color.replace('#', '')}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.2" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <g v-if="points.length">
        <!-- Y grid lines and labels -->
        <line
          v-for="tick in yTicks"
          :key="tick"
          :x1="PADDING.left"
          :y1="toY(tick)"
          :x2="PADDING.left + chartWidth"
          :y2="toY(tick)"
          class="stroke-gray-200 dark:stroke-gray-700"
          :stroke-width="s(1)"
          stroke-dasharray="4 4"
        />
        <text
          v-for="tick in yTicks"
          :key="`y-${tick}`"
          :x="PADDING.left - s(8)"
          :y="toY(tick) + s(4)"
          text-anchor="end"
          class="fill-gray-500 dark:fill-gray-400"
          :font-size="s(FONT_PX)"
        >
          {{ tick }}
        </text>

        <!-- Axes -->
        <line
          :x1="PADDING.left"
          :y1="PADDING.top"
          :x2="PADDING.left"
          :y2="axisBottom"
          class="stroke-gray-300 dark:stroke-gray-600"
          :stroke-width="s(1)"
        />
        <line
          :x1="PADDING.left"
          :y1="axisBottom"
          :x2="PADDING.left + chartWidth"
          :y2="axisBottom"
          class="stroke-gray-300 dark:stroke-gray-600"
          :stroke-width="s(1)"
        />

        <!-- Single point -->
        <g v-if="isSinglePoint">
          <circle
            :cx="toX(0)"
            :cy="toY(singlePoint.count)"
            :r="s(7)"
            :fill="color"
          />
          <text
            :x="toX(0)"
            :y="toY(singlePoint.count) - s(16)"
            text-anchor="middle"
            class="fill-gray-700 dark:fill-gray-300"
            :font-size="s(15)"
            font-weight="600"
          >
            {{ singlePoint.count }}
          </text>
          <text
            :x="toX(0)"
            :y="axisBottom + s(18)"
            text-anchor="middle"
            class="fill-gray-500 dark:fill-gray-400"
            :font-size="s(FONT_PX)"
          >
            {{ singlePoint.date }}
          </text>
        </g>

        <!-- Multiple points -->
        <g v-else>
          <polygon
            :points="areaPoints"
            :fill="`url(#area-grad-${color.replace('#', '')})`"
          />
          <polyline
            :points="polylinePoints"
            fill="none"
            :stroke="color"
            :stroke-width="lineStrokeWidth"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <!-- Hover guide line -->
          <line
            v-if="hoveredIndex !== null && hoveredPoint !== null"
            :x1="toX(hoveredIndex)"
            :y1="toY(hoveredPoint.count)"
            :x2="toX(hoveredIndex)"
            :y2="axisBottom"
            :stroke="color"
            :stroke-width="s(1)"
            stroke-dasharray="4 3"
            opacity="0.5"
          />

          <!-- Points with labels -->
          <g
            v-for="(p, i) in points"
            :key="i"
            class="point-group"
            @mouseenter="hoveredIndex = i"
            @mouseleave="hoveredIndex = null"
          >
            <!-- Invisible hit area for hover -->
            <circle
              :cx="toX(i)"
              :cy="toY(p.count)"
              :r="hitRadius"
              fill="transparent"
              pointer-events="all"
            />

            <!-- Value label -->
            <text
              :x="toX(i)"
              :y="labelY(i)"
              text-anchor="middle"
              :font-size="s(FONT_PX)"
              font-weight="600"
              class="point-label fill-gray-900 dark:fill-gray-100"
              :class="{ 'point-label--visible': hoveredIndex === i }"
              pointer-events="none"
            >
              {{ p.count.toLocaleString() }}
            </text>

            <!-- Dot -->
            <circle
              :cx="toX(i)"
              :cy="toY(p.count)"
              :r="dotRadius"
              :fill="color"
              class="point-dot"
              :class="{ 'point-dot--active': hoveredIndex === i }"
              pointer-events="none"
            />
          </g>

          <!-- X-axis labels -->
          <text
            v-for="label in xLabels"
            :key="label.index"
            :x="label.x"
            :y="axisBottom + s(18)"
            text-anchor="middle"
            class="fill-gray-500 dark:fill-gray-400"
            :font-size="s(FONT_PX)"
          >
            {{ label.label }}
          </text>
        </g>
      </g>

      <text
        v-else
        :x="WIDTH / 2"
        :y="HEIGHT / 2"
        text-anchor="middle"
        class="fill-gray-400 dark:fill-gray-500"
        :font-size="s(16)"
      >
        Нет данных
      </text>
    </svg>
  </div>
</template>

<style scoped>
.point-group {
  cursor: pointer;
}

.point-dot {
  transform-box: fill-box;
  transform-origin: center;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 0.2s ease;
}

.point-dot--active {
  transform: scale(2);
  filter: brightness(1.25);
}

.point-label {
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.point-label--visible {
  opacity: 1;
}
</style>
