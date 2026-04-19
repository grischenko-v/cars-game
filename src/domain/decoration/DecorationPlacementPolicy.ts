import * as THREE from 'three'
import type { Road } from '../../world/Road'
import type { ObstacleCollider } from '../../world/Decorations'

export class DecorationPlacementPolicy {
  constructor(
    private readonly road: Road,
    private readonly obstacleColliders: ObstacleCollider[]
  ) {}

  canPlaceAt(x: number, z: number, clearance = 0): boolean {
    if (this.road.isPointOnRoad(x, z, clearance)) return false

    for (const obstacle of this.obstacleColliders) {
      const dx = x - obstacle.x
      const dz = z - obstacle.z
      const minDist = clearance + obstacle.radius + 1.5
      if (dx * dx + dz * dz < minDist * minDist) {
        return false
      }
    }

    return true
  }

  isNearStartSector(angle: number, extraArc = 0): boolean {
    return this.road.isNearStartSector(angle, extraArc)
  }

  sampleTrack(distance: number, centerPos: THREE.Vector3, tangent: THREE.Vector3): void {
    this.road.sampleCenterlineByDistance(distance, centerPos, tangent)
  }
}
