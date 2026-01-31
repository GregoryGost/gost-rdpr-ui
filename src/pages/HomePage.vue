<script setup lang="ts">
import HeaderView from '@/views/HeaderView.vue'
import FooterView from '@/views/FooterView.vue'
</script>

<template>
  <HeaderView />

  <router-view />

  <FooterView />
</template>

<style lang="sass" scoped></style>
