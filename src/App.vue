<script setup lang="ts">
import { RouterView } from 'vue-router'
import ErrorNotification from '@/components/ErrorNotification.vue'
</script>

<template>
  <router-view />
  <error-notification />
</template>
