import * as THREE from 'three'
import { createApp, reactive } from 'vue'
import type { CarView } from '../../infrastructure/graphics/CarView'
import PositionLabelsOverlay from './components/PositionLabelsOverlay.vue'

export interface PositionLabelTarget {
  id: string
  name: string
  place: number
  view: CarView
  isPlayer: boolean
}

interface PositionLabelState {
  id: string
  text: string
  x: number
  y: number
  visible: boolean
  isPlayer: boolean
}

export class PositionLabelView {
  private readonly labels = reactive<PositionLabelState[]>([])
  private readonly worldPosition = new THREE.Vector3()
  private readonly screenPosition = new THREE.Vector3()

  constructor(parent: HTMLElement = document.body) {
    const mountElement = document.createElement('div')
    parent.appendChild(mountElement)

    createApp(PositionLabelsOverlay, {
      labels: this.labels,
    }).mount(mountElement)
  }

  update(targets: PositionLabelTarget[], camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    const width = renderer.domElement.clientWidth
    const height = renderer.domElement.clientHeight
    const nextLabels: PositionLabelState[] = []

    for (const target of targets) {
      target.view.copyPosition(this.worldPosition)
      this.worldPosition.y += 3.2
      this.screenPosition.copy(this.worldPosition).project(camera)

      const visible =
        this.screenPosition.z > -1 &&
        this.screenPosition.z < 1 &&
        Math.abs(this.screenPosition.x) <= 1.12 &&
        Math.abs(this.screenPosition.y) <= 1.12
      const x = (this.screenPosition.x * 0.5 + 0.5) * width
      const y = (-this.screenPosition.y * 0.5 + 0.5) * height

      nextLabels.push({
        id: target.id,
        text: `${target.place}. ${target.name}`,
        x,
        y,
        visible,
        isPlayer: target.isPlayer,
      })
    }

    this.labels.splice(0, this.labels.length, ...nextLabels)
  }
}
