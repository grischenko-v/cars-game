import type { RankedStandingEntry } from '../../domain/race/RaceStandings'

export class StandingsView {
  private readonly element: HTMLDivElement

  constructor(parent: HTMLElement = document.body) {
    this.element = document.createElement('div')
    this.element.style.position = 'fixed'
    this.element.style.left = '16px'
    this.element.style.top = '16px'
    this.element.style.minWidth = '250px'
    this.element.style.padding = '10px 12px'
    this.element.style.borderRadius = '12px'
    this.element.style.background = 'rgba(20,20,24,0.55)'
    this.element.style.backdropFilter = 'blur(6px)'
    this.element.style.color = '#fff'
    this.element.style.fontFamily = 'system-ui, sans-serif'
    this.element.style.fontSize = '14px'
    this.element.style.zIndex = '10'
    this.element.style.userSelect = 'none'
    parent.appendChild(this.element)
  }

  update(entries: RankedStandingEntry[]): void {
    this.element.innerHTML = `
      <div style="font-weight: 800; margin-bottom: 6px;">Положение</div>
      ${entries
        .map((entry) => {
          const lapText = entry.finished
            ? 'Финиш'
            : `${Math.min(entry.completedLaps + 1, entry.targetLaps)}/${entry.targetLaps}`

          return `
            <div style="
              display: grid;
              grid-template-columns: 28px 1fr auto;
              gap: 8px;
              align-items: center;
              padding: 3px 0;
              color: ${entry.isPlayer ? '#ffe88e' : '#fff'};
            ">
              <span>${entry.place}</span>
              <span>${entry.name}</span>
              <span style="opacity: 0.78;">${lapText}</span>
            </div>
          `
        })
        .join('')}
    `
  }
}
