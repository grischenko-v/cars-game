<script setup lang="ts">

interface LoadingState {
  visible: boolean
  title: string
  details: string
  mode: 'loading' | 'countdown' | 'error'
}

defineProps<{
  state: LoadingState
}>()
</script>

<template>
  <section
    v-show="state.visible"
    class="loading-overlay"
    :class="`loading-overlay--${state.mode}`"
    aria-live="polite"
  >
    <div class="loading-overlay__title">{{ state.title }}</div>
    <div class="loading-overlay__details">{{ state.details }}</div>
  </section>
</template>

<style src="./LoadingOverlay.css"></style>
