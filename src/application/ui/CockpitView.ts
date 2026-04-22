import { createApp, reactive } from 'vue'
import CockpitOverlay from './components/CockpitOverlay.vue'

export interface CockpitState {
  visible: boolean
  speed: number
  rpm: number
  gear: number
  steer: number
  vehicleId: string
}

export class CockpitView {
  private readonly state = reactive<CockpitState>({
    visible: false,
    speed: 0,
    rpm: 900,
    gear: 1,
    steer: 0,
    vehicleId: 'mustang',
  })

  constructor(parent: HTMLElement = document.body) {
    const mountElement = document.createElement('div')
    parent.appendChild(mountElement)

    createApp(CockpitOverlay, {
      state: this.state,
    }).mount(mountElement)
  }

  update(
    visible: boolean,
    speed: number,
    rpm: number,
    gear: number,
    steer: number,
    vehicleId: string
  ): void {
    if (
      this.state.visible === visible &&
      this.state.speed === speed &&
      this.state.gear === gear &&
      this.state.vehicleId === vehicleId &&
      Math.abs(this.state.rpm - rpm) < 35 &&
      Math.abs(this.state.steer - steer) < 0.01
    ) {
      return
    }

    this.state.visible = visible
    this.state.speed = speed
    this.state.rpm = rpm
    this.state.gear = gear
    this.state.steer = steer
    this.state.vehicleId = vehicleId
  }
}
