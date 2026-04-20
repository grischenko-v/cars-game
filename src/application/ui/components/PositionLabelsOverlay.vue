<script setup lang="ts">

interface PositionLabelState {
  id: string
  text: string
  x: number
  y: number
  visible: boolean
  isPlayer: boolean
}

defineProps<{
  labels: PositionLabelState[]
}>()
</script>

<template>
  <div class="position-labels" aria-hidden="true">
    <div
      v-for="label in labels"
      :key="label.id"
      class="position-label"
      :class="{ 'position-label--player': label.isPlayer }"
      :style="{
        display: label.visible ? 'block' : 'none',
        transform: `translate(-50%, -100%) translate(${label.x}px, ${label.y}px)`,
      }"
    >
      {{ label.text }}
    </div>
  </div>
</template>

<style src="./PositionLabelsOverlay.css"></style>
