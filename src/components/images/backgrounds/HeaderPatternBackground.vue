<script setup lang="ts">
/**
 * Header pattern background component
 * Displays an animated wave pattern with theme-aware styling
 * @component HeaderPatternBackground
 */
</script>

<template>
  <svg
    class="pointer-events-none absolute top-0 left-0 h-full w-full"
    viewBox="0 0 1536 64"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="header-bg-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" class="[stop-color:white] dark:[stop-color:rgb(31,41,55)]" />
        <stop offset="50%" class="[stop-color:rgb(249,250,251)] dark:[stop-color:rgb(17,24,39)]" />
        <stop offset="100%" class="[stop-color:white] dark:[stop-color:rgb(31,41,55)]" />
      </linearGradient>
    </defs>

    <g id="background-layer">
      <rect width="1536" height="64" fill="url(#header-bg-gradient)" />
    </g>

    <g id="pattern-layer" class="opacity-25 dark:opacity-30">
      <path
        d="M 0,32 Q 192,20 384,32 T 768,32 T 1152,32 T 1536,32"
        class="wave-path stroke-gray-400 dark:stroke-gray-600"
        stroke-width="2"
        fill="none"
      />
      <path
        d="M 0,28 Q 192,16 384,28 T 768,28 T 1152,28 T 1536,28"
        class="wave-path-delayed stroke-gray-400 dark:stroke-gray-600"
        stroke-width="1"
        fill="none"
      />
      <path
        d="M 0,36 Q 192,24 384,36 T 768,36 T 1152,36 T 1536,36"
        class="wave-path-delayed-2 stroke-gray-400 dark:stroke-gray-600"
        stroke-width="1"
        fill="none"
      />
    </g>

    <g id="decorative-layer" class="opacity-10 dark:opacity-15">
      <circle cx="128" cy="32" r="2" class="circle-pulse fill-indigo-500 dark:fill-indigo-400" />
      <circle
        cx="384"
        cy="32"
        r="2"
        class="circle-pulse fill-indigo-500 dark:fill-indigo-400"
        style="animation-delay: 1s"
      />
      <circle
        cx="640"
        cy="32"
        r="2"
        class="circle-pulse fill-indigo-500 dark:fill-indigo-400"
        style="animation-delay: 3s"
      />
      <circle
        cx="896"
        cy="32"
        r="2"
        class="circle-pulse fill-indigo-500 dark:fill-indigo-400"
        style="animation-delay: 1.5s"
      />
      <circle
        cx="1152"
        cy="32"
        r="2"
        class="circle-pulse fill-indigo-500 dark:fill-indigo-400"
        style="animation-delay: 2.5s"
      />
      <circle
        cx="1408"
        cy="32"
        r="2"
        class="circle-pulse fill-indigo-500 dark:fill-indigo-400"
        style="animation-delay: 2s"
      />
    </g>
  </svg>
</template>

<style scoped>
.wave-path {
  stroke-dasharray: 100;
  stroke-dashoffset: 0;
  animation: wave-dash 15s linear infinite;
}

.wave-path-delayed {
  stroke-dasharray: 100;
  stroke-dashoffset: 0;
  animation: wave-dash 15s linear infinite 2s;
}

.wave-path-delayed-2 {
  stroke-dasharray: 100;
  stroke-dashoffset: 0;
  animation: wave-dash 15s linear infinite 4s;
}

.circle-pulse {
  animation: circle-pulse 13s ease-in-out infinite;
}

@keyframes wave-dash {
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: -200;
  }
}

@keyframes circle-pulse {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-0.375rem);
  }
}
</style>
