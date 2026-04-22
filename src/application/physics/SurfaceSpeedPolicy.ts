import type { Car } from '../../domain/car/Car'
import type { RoadBandData } from '../../domain/road/TrackModel'
import type { GroundSurfaceKind } from '../../world/Decorations'

export type GroundSurfaceSampler = (x: number, z: number) => GroundSurfaceKind | null

export interface SurfaceSpeedPolicySettings {
  grassSpeedFactor: number
  sandSpeedFactor: number
  maxReverseSpeed: number
}

export class SurfaceSpeedPolicy {
  constructor(
    private readonly sampleGroundSurface: GroundSurfaceSampler,
    private readonly settings: SurfaceSpeedPolicySettings
  ) {}

  getSpeedFactor(x: number, z: number, roadBand: RoadBandData): number {
    if (roadBand.distFromRoadCenter <= roadBand.halfWidth) {
      return 1
    }

    return this.sampleGroundSurface(x, z) === 'sand'
      ? this.settings.sandSpeedFactor
      : this.settings.grassSpeedFactor
  }

  limitSpeed(
    car: Car,
    maxForwardSpeed: number,
    surfaceSpeedFactor: number,
    delta: number
  ): void {
    const surfaceMaxSpeed = maxForwardSpeed * surfaceSpeedFactor

    if (car.speed > surfaceMaxSpeed) {
      car.moveSpeedTowardZero((8 + (car.speed - surfaceMaxSpeed) * 3.4) * delta)
    }

    car.clampSpeed(
      -this.settings.maxReverseSpeed * surfaceSpeedFactor,
      surfaceMaxSpeed
    )
  }
}
