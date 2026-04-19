import * as THREE from 'three'
import { clamp } from '../../utils/math'

export class CarShadow {
  private readonly mesh: THREE.Mesh

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 2.35),
      new THREE.MeshBasicMaterial({
        map: this.createShadowTexture(),
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      })
    )
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.renderOrder = 7
    scene.add(this.mesh)
  }

  update(position: THREE.Vector3, groundHeight: number, heading: number, speed: number): void {
    const speedStretch = 1 + clamp(Math.abs(speed) / 70, 0, 0.18)

    this.mesh.position.set(position.x, groundHeight + 0.045, position.z)
    this.mesh.rotation.z = -heading
    this.mesh.scale.set(speedStretch, 1, 1)
  }

  private createShadowTexture(): THREE.CanvasTexture {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext('2d')
    if (!context) {
      return new THREE.CanvasTexture(canvas)
    }

    context.clearRect(0, 0, size, size)
    context.filter = 'blur(10px)'

    const gradient = context.createRadialGradient(128, 134, 18, 128, 134, 108)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.42)')
    gradient.addColorStop(0.56, 'rgba(0, 0, 0, 0.24)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    context.fillStyle = gradient
    this.roundedRect(context, 38, 82, 180, 86, 34)
    context.fill()

    context.fillStyle = 'rgba(0, 0, 0, 0.18)'
    this.roundedRect(context, 58, 66, 138, 44, 24)
    context.fill()

    context.fillStyle = 'rgba(0, 0, 0, 0.16)'
    this.roundedRect(context, 46, 150, 54, 22, 16)
    context.fill()
    this.roundedRect(context, 156, 150, 54, 22, 16)
    context.fill()

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }

  private roundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    context.beginPath()
    context.moveTo(x + radius, y)
    context.lineTo(x + width - radius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + radius)
    context.lineTo(x + width, y + height - radius)
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    context.lineTo(x + radius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
    context.closePath()
  }
}
