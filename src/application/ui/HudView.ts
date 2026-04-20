import { createApp, reactive } from 'vue'
import HudPanel from './components/HudPanel.vue'

interface HudState {
  speed: number
  rpm: number
  gear: number
}

export class HudView {
  private readonly state = reactive<HudState>({
    speed: 0,
    rpm: 900,
    gear: 1,
  })

  constructor(parent: HTMLElement = document.body) {
    const mountElement = document.createElement('div')
    parent.appendChild(mountElement)

    createApp(HudPanel, {
      state: this.state,
    }).mount(mountElement)
  }

  updateInstruments(kmh: number, rpm: number, gear: number): void {
    if (
      this.state.speed === kmh &&
      this.state.gear === gear &&
      Math.abs(this.state.rpm - rpm) < 35
    ) {
      return
    }

    this.state.speed = kmh
    this.state.rpm = rpm
    this.state.gear = gear
  }
}
