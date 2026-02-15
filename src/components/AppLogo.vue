<script setup lang="ts">
import { APP_NAME } from '@/constants'

/**
 * Application logo component
 * @component AppLogo
 */

const [firstWord, secondWord] = APP_NAME.split('-')
</script>

<template>
  <span class="logo-text font-bold text-gray-900 dark:text-gray-100">
    <span class="logo-g">{{ firstWord }}</span
    ><span class="logo-t">&mdash;{{ secondWord }}</span>
  </span>
</template>

<style scoped></style>
