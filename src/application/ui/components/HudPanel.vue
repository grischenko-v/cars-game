<script setup lang="ts">

interface HudState {
  speed: number
  rpm: number
  gear: number
}

interface GaugeOptions {
  title: string
  unit: string
  value: number
  maxValue: number
  majorStep: number
  minorStep: number
  accentColor: string
  dangerFrom?: number
  bottomLabel?: string
}

const props = defineProps<{
  state: HudState
}>()

const startAngle = -132
const sweepAngle = 264
const center = 80

function speedGauge(): GaugeOptions {
  return {
    title: 'SPEED',
    unit: 'km/h',
    value: props.state.speed,
    maxValue: 240,
    majorStep: 40,
    minorStep: 20,
    accentColor: '#85d7ff',
    bottomLabel: `${props.state.speed} km/h`,
  }
}

function rpmGauge(): GaugeOptions {
  return {
    title: 'RPM',
    unit: 'x1000',
    value: props.state.rpm / 1000,
    maxValue: 8,
    majorStep: 1,
    minorStep: 0.5,
    accentColor: props.state.rpm > 6200 ? '#ff6b55' : '#f3e7a4',
    dangerFrom: 6.4,
    bottomLabel: String(props.state.gear),
  }
}

function valueToAngle(value: number, maxValue: number): number {
  return startAngle + (value / maxValue) * sweepAngle
}

function pointOnGauge(angleDeg: number, radius: number): { x: number; y: number } {
  const radians = ((angleDeg - 90) * Math.PI) / 180

  return {
    x: center + Math.cos(radians) * radius,
    y: center + Math.sin(radians) * radius,
  }
}

function ticks(options: GaugeOptions) {
  const result = []
  const totalTicks = Math.round(options.maxValue / options.minorStep)

  for (let i = 0; i <= totalTicks; i++) {
    const value = i * options.minorStep
    const isMajor = Math.abs(value / options.majorStep - Math.round(value / options.majorStep)) < 0.001
    const angle = valueToAngle(value, options.maxValue)
    const outer = pointOnGauge(angle, 60)
    const inner = pointOnGauge(angle, isMajor ? 49 : 54)
    const label = pointOnGauge(angle, 38)
    const color = options.dangerFrom && value >= options.dangerFrom
      ? '#ff6b55'
      : 'rgba(255,255,255,0.78)'

    result.push({ value, isMajor, outer, inner, label, color })
  }

  return result
}

function needlePoints(options: GaugeOptions) {
  const clampedValue = Math.max(0, Math.min(options.value, options.maxValue))
  const angle = valueToAngle(clampedValue, options.maxValue)

  return {
    tip: pointOnGauge(angle, 50),
    tail: pointOnGauge(angle + 180, 12),
  }
}

function dangerArc(options: GaugeOptions): string {
  if (!options.dangerFrom) return ''

  const start = valueToAngle(options.dangerFrom, options.maxValue)
  const end = valueToAngle(options.maxValue, options.maxValue)
  const startPoint = pointOnGauge(start, 63)
  const endPoint = pointOnGauge(end, 63)
  const largeArc = end - start > 180 ? 1 : 0

  return `M ${startPoint.x} ${startPoint.y} A 63 63 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`
}
</script>

<template>
  <section class="hud-panel" aria-label="Панель приборов">
    <div
      v-for="gauge in [speedGauge(), rpmGauge()]"
      :key="gauge.title"
      class="hud-gauge"
    >
      <svg class="hud-gauge__svg" viewBox="0 0 160 160" aria-hidden="true">
        <circle
          :cx="center"
          :cy="center"
          r="59"
          fill="rgba(0,0,0,0.16)"
          stroke="rgba(255,255,255,0.1)"
          stroke-width="2"
        />

        <line
          v-for="tick in ticks(gauge)"
          :key="`${gauge.title}-${tick.value}-line`"
          :x1="tick.outer.x"
          :y1="tick.outer.y"
          :x2="tick.inner.x"
          :y2="tick.inner.y"
          :stroke="tick.color"
          :stroke-width="tick.isMajor ? 2.4 : 1.1"
          stroke-linecap="round"
        />

        <text
          v-for="tick in ticks(gauge).filter((item) => item.isMajor)"
          :key="`${gauge.title}-${tick.value}-text`"
          :x="tick.label.x"
          :y="tick.label.y"
          :fill="tick.color"
          :font-size="gauge.maxValue <= 10 ? 8 : 7"
          font-weight="800"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ Math.round(tick.value) }}
        </text>

        <path
          v-if="gauge.dangerFrom"
          :d="dangerArc(gauge)"
          fill="none"
          stroke="#ff6b55"
          stroke-width="4"
          stroke-linecap="round"
          opacity="0.72"
        />

        <line
          :x1="needlePoints(gauge).tail.x"
          :y1="needlePoints(gauge).tail.y"
          :x2="needlePoints(gauge).tip.x"
          :y2="needlePoints(gauge).tip.y"
          :stroke="gauge.accentColor"
          stroke-width="3"
          stroke-linecap="round"
          :style="{ filter: `drop-shadow(0 0 4px ${gauge.accentColor})` }"
        />

        <circle
          :cx="center"
          :cy="center"
          r="6.5"
          fill="#16191d"
          :stroke="gauge.accentColor"
          stroke-width="2"
        />
      </svg>

      <div class="hud-gauge__title">{{ gauge.title }}</div>
      <div class="hud-gauge__value" :style="{ color: gauge.accentColor }">
        {{ gauge.bottomLabel ?? gauge.unit }}
      </div>
    </div>
  </section>
</template>

<style src="./HudPanel.css"></style>
