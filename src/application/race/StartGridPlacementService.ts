import * as THREE from 'three'
import { clamp } from '../../utils/math'
import { getStartDistance } from '../../domain/race/StartGrid'
import type { CarView } from '../../infrastructure/graphics/CarView'
import type { Road } from '../../world/Road'

export class StartGridPlacementService {
  private readonly position = new THREE.Vector3()
  private readonly tangent = new THREE.Vector3()
  private readonly side = new THREE.Vector3()

  constructor(private readonly road: Road) {}

  place(view: CarView, distanceOffset: number, lateralOffset: number): void {
    const gridDistance = getStartDistance(this.road) + distanceOffset
    const trackHalfWidth = this.road.getTrackHalfWidthAtDistance(gridDistance)
    const safeLateralOffset = clamp(
      lateralOffset,
      -trackHalfWidth * 0.78,
      trackHalfWidth * 0.78
    )

    this.road.sampleCenterlineByDistance(gridDistance, this.position, this.tangent)
    this.side.set(-this.tangent.z, 0, this.tangent.x).normalize()
    this.position.addScaledVector(this.side, safeLateralOffset)
    view.setPosition(this.position)
    view.setYaw(Math.atan2(this.tangent.x, this.tangent.z))
  }
}
