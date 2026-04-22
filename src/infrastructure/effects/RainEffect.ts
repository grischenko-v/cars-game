import * as THREE from 'three'

export class RainEffect {
  private readonly points: THREE.Points
  private readonly positions: Float32Array
  private readonly velocities: Float32Array
  private intensity = 0

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    count = 900
  ) {
    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      this.resetDrop(i, true)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

    const material = new THREE.PointsMaterial({
      color: 0xbfd3df,
      size: 0.08,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })

    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
    this.points.visible = false
    scene.add(this.points)
  }

  setIntensity(intensity: number): void {
    this.intensity = THREE.MathUtils.clamp(intensity, 0, 1)
    this.points.visible = this.intensity > 0

    const material = this.points.material as THREE.PointsMaterial
    material.opacity = THREE.MathUtils.lerp(0.18, 0.5, this.intensity)
  }

  update(delta: number): void {
    if (this.intensity <= 0) return

    this.points.position.copy(this.camera.position)
    this.points.position.y += 4

    for (let i = 0; i < this.velocities.length; i++) {
      const index = i * 3
      this.positions[index] -= delta * 4.8 * this.intensity
      this.positions[index + 1] -= this.velocities[i] * delta
      this.positions[index + 2] += delta * 1.7 * this.intensity

      if (this.positions[index + 1] < -5) {
        this.resetDrop(i, false)
      }
    }

    const position = this.points.geometry.getAttribute('position')
    position.needsUpdate = true
  }

  private resetDrop(index: number, initial: boolean): void {
    const offset = index * 3
    this.positions[offset] = THREE.MathUtils.randFloatSpread(52)
    this.positions[offset + 1] = initial
      ? THREE.MathUtils.randFloat(-5, 22)
      : THREE.MathUtils.randFloat(14, 24)
    this.positions[offset + 2] = THREE.MathUtils.randFloatSpread(46)
    this.velocities[index] = THREE.MathUtils.randFloat(22, 34)
  }
}
