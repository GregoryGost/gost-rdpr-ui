<script setup lang="ts">
import { computed } from 'vue'

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
const CHAR_WIDTH = 6.5
const BAR_HEIGHT = 24
const BAR_GAP = 10

const paddingLeft = computed(() => {
  if (!props.bars.length) return 80
  const maxLen = Math.max(...props.bars.map((b) => b.label.length))
  return Math.min(Math.max(Math.ceil(maxLen * CHAR_WIDTH) + 16, 40), 220)
})

const chartWidth = computed(() => WIDTH - paddingLeft.value - PADDING_BASE.right)

const svgHeight = computed(() => {
  if (!props.bars.length) return props.height
  return PADDING_BASE.top + props.bars.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP + PADDING_BASE.bottom
})

const maxValue = computed(() => Math.max(...props.bars.map((b) => b.value), 1))

const LABEL_MIN_WIDTH = 50

const barItems = computed(() =>
  props.bars.map((b, i) => {
    const width = (b.value / maxValue.value) * chartWidth.value
    const inside = width > LABEL_MIN_WIDTH
    return {
      ...b,
      y: PADDING_BASE.top + i * (BAR_HEIGHT + BAR_GAP),
      width,
      color: b.color ?? props.defaultColor,
      labelX: inside ? paddingLeft.value + width - 6 : paddingLeft.value + width + 6,
      labelAnchor: inside ? 'end' : 'start',
      labelInside: inside,
    }
  }),
)
</script>

<template>
  <div class="w-full overflow-x-auto">
    <svg
      :viewBox="`0 0 ${WIDTH} ${svgHeight}`"
      class="w-full"
      aria-label="Столбчатый график"
    >
      <g v-if="bars.length">
        <g v-for="(bar, i) in barItems" :key="i">
          <text
            :x="paddingLeft - 8"
            :y="bar.y + BAR_HEIGHT / 2 + 4"
            text-anchor="end"
            class="fill-gray-700 dark:fill-gray-300"
            font-size="11"
          >
            {{ bar.label }}
          </text>

          <rect
            :x="paddingLeft"
            :y="bar.y"
            :width="Math.max(bar.width, 2)"
            :height="BAR_HEIGHT"
            :fill="bar.color"
            rx="3"
            opacity="0.85"
          />

          <text
            v-if="bar.value > 0"
            :x="bar.labelX"
            :y="bar.y + BAR_HEIGHT / 2 + 4"
            :text-anchor="bar.labelAnchor"
            :class="bar.labelInside ? 'fill-white' : 'fill-gray-700 dark:fill-gray-300'"
            font-size="11"
          >
            {{ bar.value }}
          </text>
        </g>

        <line
          :x1="paddingLeft"
          :y1="PADDING_BASE.top"
          :x2="paddingLeft"
          :y2="PADDING_BASE.top + bars.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP"
          class="stroke-gray-300 dark:stroke-gray-600"
          stroke-width="1"
        />
      </g>

      <text
        v-else
        :x="WIDTH / 2"
        :y="svgHeight / 2"
        text-anchor="middle"
        class="fill-gray-400 dark:fill-gray-500"
        font-size="14"
      >
        Нет данных
      </text>
    </svg>
  </div>
</template>

<style scoped></style>
