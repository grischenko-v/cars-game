<script setup lang="ts">
interface CockpitState {
  visible: boolean
  speed: number
  rpm: number
  gear: number
  steer: number
  vehicleId: string
}

const props = defineProps<{
  state: CockpitState
}>()

const rpmMax = 8000

function rpmNeedleRotation(): string {
  const angle = -118 + Math.min(props.state.rpm / rpmMax, 1) * 236
  return `rotate(${angle}deg)`
}

function speedNeedleRotation(): string {
  const angle = -118 + Math.min(props.state.speed / 260, 1) * 236
  return `rotate(${angle}deg)`
}

function cockpitClass(): Record<string, boolean> {
  return {
    'cockpit--mustang': props.state.vehicleId === 'mustang',
    'cockpit--mini': props.state.vehicleId === 'mini-jcw',
  }
}

function steeringStyle(): Record<string, string> {
  const wheelAngle = -Math.max(-1, Math.min(props.state.steer, 1)) * 118

  return {
    transform: `translateX(-50%) rotate(${wheelAngle}deg)`,
  }
}
</script>

<template>
  <section
    v-show="state.visible"
    class="cockpit"
    :class="cockpitClass()"
    aria-label="Вид из кабины"
    aria-hidden="true"
  >
    <div class="cockpit__windshield">
      <div class="cockpit__wiper cockpit__wiper--left"></div>
      <div class="cockpit__wiper cockpit__wiper--right"></div>
    </div>

    <div class="cockpit__hood">
      <div class="cockpit__hood-highlight"></div>
    </div>

    <div class="cockpit__dashboard">
      <div class="cockpit__vent cockpit__vent--left"></div>
      <div class="cockpit__vent cockpit__vent--right"></div>

      <div class="cockpit__cluster" aria-hidden="true">
        <div class="cockpit-gauge cockpit-gauge--speed">
          <div class="cockpit-gauge__needle" :style="{ transform: speedNeedleRotation() }"></div>
          <div class="cockpit-gauge__hub"></div>
          <div class="cockpit-gauge__label">km/h</div>
          <div class="cockpit-gauge__value">{{ state.speed }}</div>
        </div>

        <div class="cockpit__gear">
          <span>{{ state.gear }}</span>
        </div>

        <div class="cockpit-gauge cockpit-gauge--rpm">
          <div class="cockpit-gauge__needle" :style="{ transform: rpmNeedleRotation() }"></div>
          <div class="cockpit-gauge__hub"></div>
          <div class="cockpit-gauge__label">rpm</div>
          <div class="cockpit-gauge__value">{{ Math.round(state.rpm / 100) / 10 }}</div>
        </div>
      </div>

      <div class="cockpit__steering-wheel" :style="steeringStyle()">
        <div class="cockpit__steering-ring"></div>
        <div class="cockpit__steering-grip cockpit__steering-grip--left"></div>
        <div class="cockpit__steering-grip cockpit__steering-grip--right"></div>
        <div class="cockpit__steering-spoke cockpit__steering-spoke--left"></div>
        <div class="cockpit__steering-spoke cockpit__steering-spoke--right"></div>
        <div class="cockpit__steering-spoke cockpit__steering-spoke--bottom"></div>
        <div class="cockpit__steering-hub"></div>
      </div>
    </div>
  </section>
</template>

<style src="./CockpitOverlay.css"></style>
