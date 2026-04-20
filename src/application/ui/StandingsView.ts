import { createApp, reactive } from 'vue'
import type { RankedStandingEntry } from '../../domain/race/RaceStandings'
import StandingsPanel from './components/StandingsPanel.vue'

interface RaceHudState {
  completedLaps: number
  targetLaps: number
  elapsedTime: number
  currentLapTime: number
  lapTimes: number[]
  finished: boolean
  entries: RankedStandingEntry[]
}

export class StandingsView {
  private readonly state = reactive<RaceHudState>({
    completedLaps: 0,
    targetLaps: 0,
    elapsedTime: 0,
    currentLapTime: 0,
    lapTimes: [],
    finished: false,
    entries: [],
  })

  constructor(parent: HTMLElement = document.body) {
    const mountElement = document.createElement('div')
    parent.appendChild(mountElement)

    createApp(StandingsPanel, {
      state: this.state,
    }).mount(mountElement)
  }

  update(entries: RankedStandingEntry[]): void {
    if (this.hasSameEntries(entries)) return

    this.state.entries = entries
  }

  updateRace(
    completedLaps: number,
    targetLaps: number,
    elapsedTime: number,
    currentLapTime: number,
    lapTimes: number[],
    finished: boolean
  ): void {
    if (
      this.state.completedLaps === completedLaps &&
      this.state.targetLaps === targetLaps &&
      this.state.finished === finished &&
      this.state.lapTimes.length === lapTimes.length &&
      Math.abs(this.state.elapsedTime - elapsedTime) < 0.1 &&
      Math.abs(this.state.currentLapTime - currentLapTime) < 0.1
    ) {
      return
    }

    this.state.completedLaps = completedLaps
    this.state.targetLaps = targetLaps
    this.state.elapsedTime = elapsedTime
    this.state.currentLapTime = currentLapTime
    this.state.lapTimes = lapTimes
    this.state.finished = finished
  }

  private hasSameEntries(entries: RankedStandingEntry[]): boolean {
    if (this.state.entries.length !== entries.length) return false

    return entries.every((entry, index) => {
      const current = this.state.entries[index]

      return (
        current.id === entry.id &&
        current.place === entry.place &&
        current.completedLaps === entry.completedLaps &&
        current.finished === entry.finished
      )
    })
  }
}
