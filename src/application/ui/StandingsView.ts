import { createApp, h, reactive } from '@vue/runtime-dom'
import type { RankedStandingEntry } from '../../domain/race/RaceStandings'

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
  private readonly element: HTMLDivElement
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
    this.element = document.createElement('div')
    this.element.style.position = 'fixed'
    this.element.style.left = '16px'
    this.element.style.top = '16px'
    this.element.style.minWidth = '286px'
    this.element.style.padding = '12px'
    this.element.style.borderRadius = '16px'
    this.element.style.background = 'linear-gradient(145deg, rgba(18,20,24,0.68), rgba(34,38,43,0.54))'
    this.element.style.backdropFilter = 'blur(8px)'
    this.element.style.border = '1px solid rgba(255,255,255,0.12)'
    this.element.style.boxShadow = '0 14px 34px rgba(0,0,0,0.28)'
    this.element.style.color = '#fff'
    this.element.style.fontFamily = 'system-ui, sans-serif'
    this.element.style.fontSize = '14px'
    this.element.style.zIndex = '10'
    this.element.style.userSelect = 'none'
    parent.appendChild(this.element)

    createApp({
      setup: () => () => this.render(),
    }).mount(this.element)
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

  private render() {
    return h('div', [
      this.renderRaceInfo(),
      h(
        'div',
        {
          style: {
            fontWeight: '800',
            marginBottom: '6px',
            letterSpacing: '0.02em',
          },
        },
        'Положение'
      ),
      ...this.state.entries.map((entry) => this.renderStandingEntry(entry)),
    ])
  }

  private renderRaceInfo() {
    if (this.state.targetLaps <= 0) return null

    return h(
      'div',
      {
        style: {
          marginBottom: '10px',
          padding: '9px 10px',
          borderRadius: '13px',
          background: 'rgba(255,255,255,0.08)',
          lineHeight: '1.35',
        },
      },
      [
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px',
              alignItems: 'center',
              color: '#f3e7a4',
              fontWeight: '800',
            },
          },
          [
            h('span', `Круги ${this.state.completedLaps}/${this.state.targetLaps}`),
            h('span', this.state.finished ? 'Финиш' : this.formatTime(this.state.elapsedTime)),
          ]
        ),
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px',
              marginTop: '3px',
              fontSize: '13px',
              opacity: '0.84',
            },
          },
          [
            h('span', 'Текущий круг'),
            h('span', this.state.finished ? '-' : this.formatTime(this.state.currentLapTime)),
          ]
        ),
        this.renderLapTimes(),
        this.state.finished
          ? h(
              'div',
              {
                style: {
                  marginTop: '6px',
                  color: '#f3e7a4',
                  fontWeight: '700',
                },
              },
              'Enter / R - рестарт'
            )
          : null,
      ]
    )
  }

  private renderLapTimes() {
    if (this.state.lapTimes.length === 0) return null

    return h(
      'div',
      {
        style: {
          marginTop: '7px',
          fontSize: '13px',
          opacity: '0.9',
        },
      },
      this.state.lapTimes.map((time, index) =>
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px',
            },
          },
          [h('span', `Круг ${index + 1}`), h('span', this.formatTime(time))]
        )
      )
    )
  }

  private renderStandingEntry(entry: RankedStandingEntry) {
    const lapText = entry.finished
      ? 'Финиш'
      : `${Math.min(entry.completedLaps + 1, entry.targetLaps)}/${entry.targetLaps}`

    return h(
      'div',
      {
        style: {
          display: 'grid',
          gridTemplateColumns: '28px 1fr auto',
          gap: '8px',
          alignItems: 'center',
          padding: '3px 0',
          color: entry.isPlayer ? '#ffe88e' : '#fff',
        },
      },
      [
        h('span', entry.place),
        h('span', entry.name),
        h('span', { style: { opacity: '0.78' } }, lapText),
      ]
    )
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds - minutes * 60
    return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`
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
