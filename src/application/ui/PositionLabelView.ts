import * as THREE from 'three'
import type { CarView } from '../../infrastructure/graphics/CarView'

export interface PositionLabelTarget {
  id: string
  name: string
  place: number
  view: CarView
  isPlayer: boolean
}

export class PositionLabelView {
  private readonly labels = new Map<string, HTMLDivElement>()
  private readonly activeIds = new Set<string>()
  private readonly worldPosition = new THREE.Vector3()
  private readonly screenPosition = new THREE.Vector3()

  constructor(private readonly parent: HTMLElement = document.body) {}

  update(targets: PositionLabelTarget[], camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.activeIds.clear()

    for (const target of targets) {
      this.activeIds.add(target.id)
    }

    for (const [id, label] of this.labels) {
      if (!this.activeIds.has(id)) {
        label.remove()
        this.labels.delete(id)
      }
    }

    const rect = renderer.domElement.getBoundingClientRect()

    for (const target of targets) {
      const label = this.getLabel(target.id)
      target.view.copyPosition(this.worldPosition)
      this.worldPosition.y += 3.2
      this.screenPosition.copy(this.worldPosition).project(camera)

      const visible = this.screenPosition.z < 1

      label.style.display = visible ? 'block' : 'none'

      if (!visible) continue

      const x = (this.screenPosition.x * 0.5 + 0.5) * rect.width + rect.left
      const y = (-this.screenPosition.y * 0.5 + 0.5) * rect.height + rect.top
      const nextText = `${target.place}. ${target.name}`
      const nextBorderColor = target.isPlayer ? 'rgba(255,232,142,0.95)' : 'rgba(255,255,255,0.55)'

      label.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`

      if (label.textContent !== nextText) {
        label.textContent = nextText
      }

      if (label.style.borderColor !== nextBorderColor) {
        label.style.borderColor = nextBorderColor
      }
    }
  }

  private getLabel(id: string): HTMLDivElement {
    const existing = this.labels.get(id)

    if (existing) return existing

    const label = document.createElement('div')
    label.style.position = 'fixed'
    label.style.left = '0'
    label.style.top = '0'
    label.style.padding = '4px 8px'
    label.style.border = '1px solid rgba(255,255,255,0.55)'
    label.style.borderRadius = '999px'
    label.style.background = 'rgba(13,18,22,0.74)'
    label.style.backdropFilter = 'blur(4px)'
    label.style.color = '#fff'
    label.style.fontFamily = 'system-ui, sans-serif'
    label.style.fontSize = '12px'
    label.style.fontWeight = '700'
    label.style.pointerEvents = 'none'
    label.style.textShadow = '0 1px 2px rgba(0,0,0,0.45)'
    label.style.zIndex = '12'

    this.parent.appendChild(label)
    this.labels.set(id, label)
    return label
  }
}
