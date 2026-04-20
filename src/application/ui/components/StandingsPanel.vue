<script setup lang="ts">
import type { RankedStandingEntry } from '../../../domain/race/RaceStandings'

interface RaceHudState {
  completedLaps: number
  targetLaps: number
  elapsedTime: number
  currentLapTime: number
  lapTimes: number[]
  finished: boolean
  entries: RankedStandingEntry[]
}

const props = defineProps<{
  state: RaceHudState
}>()

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds - minutes * 60

  return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`
}

function lapText(entry: RankedStandingEntry): string {
  if (entry.finished) return 'Финиш'

  return `${Math.min(entry.completedLaps + 1, entry.targetLaps)}/${entry.targetLaps}`
}

function playerPlace(): string {
  const player = props.state.entries.find((entry) => entry.isPlayer)

  return player ? String(player.place) : '-'
}

function bestLap(): string {
  if (props.state.lapTimes.length === 0) return '-'

  return formatTime(Math.min(...props.state.lapTimes))
}
</script>

<template>
  <section class="standings-panel" aria-label="Положение в гонке">
    <div v-if="state.targetLaps > 0" class="standings-race">
      <div class="standings-race__main">
        <span>Круги {{ state.completedLaps }}/{{ state.targetLaps }}</span>
        <span>{{ state.finished ? 'Финиш' : formatTime(state.elapsedTime) }}</span>
      </div>

      <div class="standings-race__sub">
        <span>Текущий круг</span>
        <span>{{ state.finished ? '-' : formatTime(state.currentLapTime) }}</span>
      </div>

      <div v-if="state.lapTimes.length > 0" class="standings-laps">
        <div
          v-for="(time, index) in state.lapTimes"
          :key="index"
          class="standings-laps__row"
        >
          <span>Круг {{ index + 1 }}</span>
          <span>{{ formatTime(time) }}</span>
        </div>
      </div>

      <div v-if="state.finished" class="standings-finish">
        <div>Ваше место: {{ playerPlace() }}</div>
        <div>Всего: {{ formatTime(state.elapsedTime) }}</div>
        <div>Лучший круг: {{ bestLap() }}</div>
        <div class="standings-finish__restart">Enter / R - рестарт</div>
      </div>
    </div>

    <h2 class="standings-title">Положение</h2>

    <div
      v-for="entry in state.entries"
      :key="entry.id"
      class="standings-entry"
      :class="{ 'standings-entry--player': entry.isPlayer }"
    >
      <span>{{ entry.place }}</span>
      <span>{{ entry.name }}</span>
      <span class="standings-entry__lap">{{ lapText(entry) }}</span>
    </div>
  </section>
</template>

<style src="./StandingsPanel.css"></style>
