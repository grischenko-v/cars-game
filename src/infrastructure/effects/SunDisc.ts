import * as THREE from 'three'
import type { EnvironmentPreset } from '../../domain/environment/EnvironmentPreset'

export class SunDisc {
  private readonly sprite: THREE.Sprite
  private readonly material: THREE.SpriteMaterial
  private readonly direction = new THREE.Vector3()

  constructor(scene: THREE.Scene, private readonly camera: THREE.Camera) {
    this.material = new THREE.SpriteMaterial({
      map: this.createSunTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: false,
    })
    this.sprite = new THREE.Sprite(this.material)
    this.sprite.renderOrder = -20
    this.sprite.scale.set(12, 12, 1)
    scene.add(this.sprite)
  }

  applyPreset(preset: EnvironmentPreset): void {
    this.direction.set(...preset.sunPosition).normalize()
    this.material.color.set(preset.sunColor)

    const weatherVisibilityByKind = {
      sunny: 1,
      'partly-cloudy': 0.58,
      overcast: 0.26,
      drizzle: 0.18,
      rain: 0.12,
      storm: 0.06,
    }
    const weatherVisibility = weatherVisibilityByKind[preset.weather]
    const timeVisibility = preset.timeOfDay === 'night' ? 0.18 : 1

    this.material.opacity = 0.72 * weatherVisibility * timeVisibility
    this.sprite.visible = this.material.opacity > 0.02
    this.sprite.scale.setScalar(preset.timeOfDay === 'evening' ? 16 : 12)
  }

  update(): void {
    if (!this.sprite.visible) return

    this.sprite.position
      .copy(this.camera.position)
      .addScaledVector(this.direction, 260)
  }

  private createSunTexture(): THREE.CanvasTexture {
    const size = 128
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    canvas.width = size
    canvas.height = size

    if (context) {
      const gradient = context.createRadialGradient(
        size * 0.5,
        size * 0.5,
        size * 0.04,
        size * 0.5,
        size * 0.5,
        size * 0.5
      )

      gradient.addColorStop(0, 'rgba(255, 255, 245, 1)')
      gradient.addColorStop(0.34, 'rgba(255, 238, 185, 0.95)')
      gradient.addColorStop(0.55, 'rgba(255, 190, 104, 0.22)')
      gradient.addColorStop(1, 'rgba(255, 160, 80, 0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, size, size)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }
}
