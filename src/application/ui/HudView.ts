export class HudView {
  private readonly element: HTMLDivElement
  private speed = 0
  private completedLaps = 0
  private targetLaps = 0
  private elapsedTime = 0
  private currentLapTime = 0
  private lapTimes: number[] = []
  private finished = false

  constructor(parent: HTMLElement = document.body) {
    this.element = document.createElement('div')
    this.element.style.position = 'fixed'
    this.element.style.left = '16px'
    this.element.style.bottom = '16px'
    this.element.style.padding = '10px 14px'
    this.element.style.background = 'rgba(20,20,24,0.55)'
    this.element.style.backdropFilter = 'blur(6px)'
    this.element.style.color = '#fff'
    this.element.style.fontFamily = 'system-ui, sans-serif'
    this.element.style.fontSize = '18px'
    this.element.style.borderRadius = '12px'
    this.element.style.zIndex = '10'
    this.element.style.userSelect = 'none'
    this.render()
    parent.appendChild(this.element)
  }

  updateSpeed(kmh: number): void {
    this.speed = kmh
    this.render()
  }

  updateRace(
    completedLaps: number,
    targetLaps: number,
    elapsedTime: number,
    currentLapTime: number,
    lapTimes: number[],
    finished: boolean
  ): void {
    this.completedLaps = completedLaps
    this.targetLaps = targetLaps
    this.elapsedTime = elapsedTime
    this.currentLapTime = currentLapTime
    this.lapTimes = lapTimes
    this.finished = finished
    this.render()
  }

  private render(): void {
    const lapsText = this.targetLaps > 0 ? `<div>Круги: ${this.completedLaps}/${this.targetLaps}</div>` : ''
    const timerText = this.targetLaps > 0
      ? `
        <div>Время: ${this.formatTime(this.elapsedTime)}</div>
        <div>Текущий: ${this.finished ? '-' : this.formatTime(this.currentLapTime)}</div>
      `
      : ''
    const lapTimesText = this.lapTimes.length > 0
      ? `
        <div style="margin-top: 6px; font-size: 14px; opacity: 0.9;">
          ${this.lapTimes.map((time, index) => `Круг ${index + 1}: ${this.formatTime(time)}`).join('<br>')}
        </div>
      `
      : ''
    const finishText = this.finished
      ? '<div style="margin-top: 6px; color: #f3e7a4;">Финиш! Enter / R - рестарт</div>'
      : ''

    this.element.innerHTML = `
      <div>${this.speed} km/h</div>
      ${lapsText}
      ${timerText}
      ${lapTimesText}
      ${finishText}
    `
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds - minutes * 60
    return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`
  }
}
