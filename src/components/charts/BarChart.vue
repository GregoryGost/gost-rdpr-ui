<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface BarItem {
  label: string
  value: number
  color?: string
}

interface Props {
  bars: BarItem[]
  height?: number
  defaultColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: 200,
  defaultColor: '#6366f1',
})

const WIDTH = 800
const PADDING_BASE = { top: 12, right: 20, bottom: 8 }
const FONT_PX = 13
const BAR_HEIGHT_PX = 28
const BAR_GAP_PX = 12

// ResizeObserver: keep SVG element sizes fixed in CSS pixels
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

const sc = computed(() => WIDTH / Math.max(containerWidth.value, 1))

// Partially compensates SVG viewBox scaling.
// rendered_px = px × clamp(containerWidth / WIDTH, 0.85, 1.4)
const s = (px: number) => {
  const ratio = containerWidth.value / WIDTH
  return px * Math.min(Math.max(ratio, 0.85), 1.4) * sc.value
}

// CHAR_WIDTH in SVG units: compensated so label width estimation matches
// the rendered character width at the target font size (FONT_PX CSS px)
const charWidth = computed(() => FONT_PX * 0.6 * sc.value)

const paddingLeft = computed(() => {
  if (!props.bars.length) return s(80)
  const maxLen = Math.max(...props.bars.map((b) => b.label.length))
  const textWidth = maxLen * charWidth.value + s(16)
  return Math.min(Math.max(Math.ceil(textWidth), s(40)), s(220))
})

const chartWidth = computed(() => WIDTH - paddingLeft.value - PADDING_BASE.right)

const svgHeight = computed(() => {
  if (!props.bars.length) return props.height
  const bh = s(BAR_HEIGHT_PX)
  const bg = s(BAR_GAP_PX)
  return PADDING_BASE.top + props.bars.length * (bh + bg) - bg + PADDING_BASE.bottom
})

const maxValue = computed(() => Math.max(...props.bars.map((b) => b.value), 1))

const barItems = computed(() => {
  const bh = s(BAR_HEIGHT_PX)
  const bg = s(BAR_GAP_PX)
  const labelMinWidth = s(50)
  return props.bars.map((b, i) => {
    const width = (b.value / maxValue.value) * chartWidth.value
    const inside = width > labelMinWidth
    return {
      ...b,
      y: PADDING_BASE.top + i * (bh + bg),
      barH: bh,
      axisY2: PADDING_BASE.top + props.bars.length * (bh + bg) - bg,
      width,
      color: b.color ?? props.defaultColor,
      labelX: inside ? paddingLeft.value + width - s(6) : paddingLeft.value + width + s(6),
      labelAnchor: inside ? 'end' : 'start',
      labelInside: inside,
    }
  })
})
</script>

<template>
  <div ref="containerRef" class="w-full">
    <svg
      :viewBox="`0 0 ${WIDTH} ${svgHeight}`"
      class="w-full"
      aria-label="Столбчатый график"
    >
      <g v-if="bars.length">
        <g v-for="(bar, i) in barItems" :key="i">
          <text
            :x="paddingLeft - s(8)"
            :y="bar.y + bar.barH / 2 + s(4)"
            text-anchor="end"
            class="fill-gray-700 dark:fill-gray-300"
            :font-size="s(FONT_PX)"
          >
            {{ bar.label }}
          </text>

          <rect
            :x="paddingLeft"
            :y="bar.y"
            :width="Math.max(bar.width, s(2))"
            :height="bar.barH"
            :fill="bar.color"
            :rx="s(3)"
            opacity="0.85"
          />

          <text
            v-if="bar.value > 0"
            :x="bar.labelX"
            :y="bar.y + bar.barH / 2 + s(4)"
            :text-anchor="bar.labelAnchor"
            :class="bar.labelInside ? 'fill-white' : 'fill-gray-700 dark:fill-gray-300'"
            :font-size="s(FONT_PX)"
          >
            {{ bar.value }}
          </text>
        </g>

        <line
          v-if="barItems.length"
          :x1="paddingLeft"
          :y1="PADDING_BASE.top"
          :x2="paddingLeft"
          :y2="barItems[0]!.axisY2"
          class="stroke-gray-300 dark:stroke-gray-600"
          :stroke-width="s(1)"
        />
      </g>

      <text
        v-else
        :x="WIDTH / 2"
        :y="svgHeight / 2"
        text-anchor="middle"
        class="fill-gray-400 dark:fill-gray-500"
        :font-size="s(14)"
      >
        Нет данных
      </text>
    </svg>
  </div>
</template>

<style scoped></style>
