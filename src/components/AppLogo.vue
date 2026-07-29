<script setup lang="ts">
import { APP_NAME } from '@/constants'

/**
 * Application logo component
 * @component AppLogo
 */

const [firstWord, secondWord] = APP_NAME.split('-')
</script>

<template>
  <span class="font-gost text-2xl font-bold text-gray-900 italic dark:text-gray-100">
    <span class="inline-block rounded bg-brand-primary py-0 pr-[0.8rem] pl-2 text-white">{{ firstWord }}</span
    ><span class="inline-block tracking-[0.1rem]">&mdash;{{ secondWord }}</span>
  </span>
</template>

<style scoped></style>
