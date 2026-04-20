import { createApp } from 'vue'
import type { CarView } from '../../infrastructure/graphics/CarView'
import type { Road } from '../../world/Road'
import MinimapPanel from './components/MinimapPanel.vue'

export interface MinimapCarMarker {
  car: CarView
  heading: number
  color: string
  isPlayer: boolean
}

interface MinimapComponent {
  draw(markers: MinimapCarMarker[]): void
}

export class MinimapView {
  private readonly component: MinimapComponent

  constructor(road: Road, parent: HTMLElement = document.body) {
    const mountElement = document.createElement('div')
    parent.appendChild(mountElement)

    this.component = createApp(MinimapPanel, { road }).mount(mountElement) as unknown as MinimapComponent
  }

  draw(markers: MinimapCarMarker[]): void {
    this.component.draw(markers)
  }
}
