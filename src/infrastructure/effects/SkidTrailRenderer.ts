import * as THREE from 'three'
import type { KeyState } from '../../application/input/KeyboardInput'
import type { Car as CarAggregate } from '../../domain/car/Car'
import type { CarView } from '../graphics/CarView'
import type { Road } from '../../world/Road'
import type { Terrain } from '../../world/Terrain'

export class SkidTrailRenderer {
  private readonly maxPoints = 6000
  private readonly positions = new Float32Array(this.maxPoints * 3)
  private readonly geometry = new THREE.BufferGeometry()
  private readonly lines: THREE.LineSegments
  private readonly tmpForward = new THREE.Vector3()
  private readonly tmpRight = new THREE.Vector3()
  private readonly tmpCarPosition = new THREE.Vector3()
  private readonly tmpRearCenter = new THREE.Vector3()
  private skidIndex = 0
  private drawCount = 0
  private lastLeftMark: THREE.Vector3 | null = null
  private lastRightMark: THREE.Vector3 | null = null

  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setDrawRange(0, 0)

    const material = new THREE.LineBasicMaterial({
      color: 0x1b1b1b,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })

    this.lines = new THREE.LineSegments(this.geometry, material)
    this.lines.renderOrder = 11
    scene.add(this.lines)
  }

  update(
    car: CarView | null,
    carAggregate: CarAggregate,
    keys: KeyState,
    road: Road,
    terrain: Terrain
  ): void {
    if (!car) return

    const shouldSkid =
      (keys.brake && Math.abs(carAggregate.speed) > 7) ||
      (keys.backward && carAggregate.speed > 10) ||
      carAggregate.driftAmount > 1.35

    if (!shouldSkid) {
      this.reset()
      return
    }

    carAggregate.getForward(this.tmpForward)
    this.tmpRight.set(this.tmpForward.z, 0, -this.tmpForward.x).normalize()

    const rearOffset = 1.4
    const halfTrack = 0.72
    this.tmpRearCenter
      .copy(car.copyPosition(this.tmpCarPosition))
      .addScaledVector(this.tmpForward, -rearOffset)

    const leftMark = this.tmpRearCenter.clone().addScaledVector(this.tmpRight, -halfTrack)
    const rightMark = this.tmpRearCenter.clone().addScaledVector(this.tmpRight, halfTrack)

    const leftSurface = road.getHeightAndNormal(
      leftMark.x,
      leftMark.z,
      terrain.getHeightAndNormal(leftMark.x, leftMark.z)
    )
    const rightSurface = road.getHeightAndNormal(
      rightMark.x,
      rightMark.z,
      terrain.getHeightAndNormal(rightMark.x, rightMark.z)
    )

    leftMark.y = leftSurface.height + 0.085
    rightMark.y = rightSurface.height + 0.085

    if (this.lastLeftMark && this.lastRightMark) {
      this.addSegment(this.lastLeftMark, leftMark)
      this.addSegment(this.lastRightMark, rightMark)
    }

    this.lastLeftMark = leftMark.clone()
    this.lastRightMark = rightMark.clone()
  }

  private addSegment(from: THREE.Vector3, to: THREE.Vector3): void {
    const attr = this.geometry.getAttribute('position') as THREE.BufferAttribute

    attr.setXYZ(this.skidIndex, from.x, from.y, from.z)
    this.skidIndex = (this.skidIndex + 1) % this.maxPoints

    attr.setXYZ(this.skidIndex, to.x, to.y, to.z)
    this.skidIndex = (this.skidIndex + 1) % this.maxPoints

    this.drawCount = Math.min(this.drawCount + 2, this.maxPoints)
    this.geometry.setDrawRange(0, this.drawCount)
    attr.needsUpdate = true
  }

  private reset(): void {
    this.lastLeftMark = null
    this.lastRightMark = null
  }
}
