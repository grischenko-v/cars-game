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
  private readonly leftMark = new THREE.Vector3()
  private readonly rightMark = new THREE.Vector3()
  private skidIndex = 0
  private drawCount = 0
  private readonly lastLeftMark = new THREE.Vector3()
  private readonly lastRightMark = new THREE.Vector3()
  private hasLastMarks = false

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

    this.leftMark.copy(this.tmpRearCenter).addScaledVector(this.tmpRight, -halfTrack)
    this.rightMark.copy(this.tmpRearCenter).addScaledVector(this.tmpRight, halfTrack)

    const leftSurface = road.getHeightAndNormal(
      this.leftMark.x,
      this.leftMark.z,
      terrain.getHeightAndNormal(this.leftMark.x, this.leftMark.z)
    )
    const rightSurface = road.getHeightAndNormal(
      this.rightMark.x,
      this.rightMark.z,
      terrain.getHeightAndNormal(this.rightMark.x, this.rightMark.z)
    )

    this.leftMark.y = leftSurface.height + 0.085
    this.rightMark.y = rightSurface.height + 0.085

    if (this.hasLastMarks) {
      this.addSegment(this.lastLeftMark, this.leftMark)
      this.addSegment(this.lastRightMark, this.rightMark)
    }

    this.lastLeftMark.copy(this.leftMark)
    this.lastRightMark.copy(this.rightMark)
    this.hasLastMarks = true
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
    this.hasLastMarks = false
  }
}
