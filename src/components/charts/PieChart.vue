<script setup lang="ts">
import { computed, ref } from 'vue'

export interface PieSlice {
  label: string
  value: number
  color: string
}

interface Props {
  slices: PieSlice[]
  size?: number
  outerRadius?: number
  innerRadius?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 160,
  outerRadius: 72,
  innerRadius: 46,
})

const hoveredIndex = ref<number | null>(null)

const cx = computed(() => props.size / 2)
const cy = computed(() => props.size / 2)

const total = computed(() => props.slices.reduce((s, sl) => s + sl.value, 0))

function polarToCart(r: number, angle: number) {
  return {
    x: cx.value + r * Math.cos(angle),
    y: cy.value + r * Math.sin(angle),
  }
}

const START_ANGLE = -Math.PI / 2

const sliceData = computed(() => {
  if (!total.value) return []

  let currentAngle = START_ANGLE

  return props.slices
    .filter((sl) => sl.value > 0)
    .map((sl) => {
      const fraction = sl.value / total.value
      const sweep = fraction * 2 * Math.PI
      const startAngle = currentAngle
      const endAngle = currentAngle + sweep
      currentAngle = endAngle

      const largeArc = sweep > Math.PI ? 1 : 0

      const os = polarToCart(props.outerRadius, startAngle)
      const oe = polarToCart(props.outerRadius, endAngle)
      const ie = polarToCart(props.innerRadius, endAngle)
      const is_ = polarToCart(props.innerRadius, startAngle)

      const path =
        sweep >= 2 * Math.PI - 0.001
          ? [
              `M ${os.x} ${os.y}`,
              `A ${props.outerRadius} ${props.outerRadius} 0 1 1 ${os.x - 0.001} ${os.y}`,
              `L ${is_.x} ${is_.y}`,
              `A ${props.innerRadius} ${props.innerRadius} 0 1 0 ${is_.x - 0.001} ${is_.y}`,
              'Z',
            ].join(' ')
          : [
              `M ${os.x} ${os.y}`,
              `A ${props.outerRadius} ${props.outerRadius} 0 ${largeArc} 1 ${oe.x} ${oe.y}`,
              `L ${ie.x} ${ie.y}`,
              `A ${props.innerRadius} ${props.innerRadius} 0 ${largeArc} 0 ${is_.x} ${is_.y}`,
              'Z',
            ].join(' ')

      return {
        ...sl,
        path,
        pct: Math.round(fraction * 100),
      }
    })
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${size} ${size}`"
    :width="size"
    :height="size"
    aria-label="Круговая диаграмма"
    class="overflow-visible"
  >
    <g v-if="sliceData.length">
      <path
        v-for="(sl, i) in sliceData"
        :key="i"
        :d="sl.path"
        :fill="sl.color"
        class="pie-slice cursor-pointer"
        :class="{ 'pie-slice--active': hoveredIndex === i }"
        @mouseenter="hoveredIndex = i"
        @mouseleave="hoveredIndex = null"
      >
        <title>{{ sl.label }}: {{ sl.value }} ({{ sl.pct }}%)</title>
      </path>

      <text
        :x="cx"
        :y="cy - 8"
        text-anchor="middle"
        dominant-baseline="middle"
        class="pointer-events-none select-none fill-gray-900 dark:fill-gray-100"
        font-size="20"
        font-weight="700"
      >
        {{ hoveredIndex !== null ? sliceData[hoveredIndex]?.value : total }}
      </text>
      <text
        :x="cx"
        :y="cy + 12"
        text-anchor="middle"
        dominant-baseline="middle"
        class="pointer-events-none select-none fill-gray-500 dark:fill-gray-400"
        font-size="10"
      >
        {{ hoveredIndex !== null ? sliceData[hoveredIndex]?.pct + '%' : 'всего' }}
      </text>
    </g>

    <text
      v-else
      :x="cx"
      :y="cy"
      text-anchor="middle"
      dominant-baseline="middle"
      class="fill-gray-400 dark:fill-gray-500"
      font-size="11"
    >
      нет данных
    </text>
  </svg>
</template>

<style scoped>
.pie-slice {
  transform-box: fill-box;
  transform-origin: center;
  transition:
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 0.15s ease;
}

.pie-slice--active {
  transform: scale(1.1);
  filter: brightness(1.2);
}
</style>
