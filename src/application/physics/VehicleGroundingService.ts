import * as THREE from 'three'
import type { RoadSurfaceData } from '../../domain/road/TrackModel'
import { expLerpFactor } from '../../utils/math'
import type { CarTemplateFactory } from '../../infrastructure/graphics/CarTemplateFactory'
import type { CarView } from '../../infrastructure/graphics/CarView'

export interface VehicleGroundingSettings {
  rideHeightOffset: number
  roadGroundClearance: number
  offroadGroundClearance: number
  offroadRideHeightBoost: number
  heightSmoothness: number
  minOffroadExtraRideHeight: number
}

export type SurfaceSampler = (x: number, z: number) => RoadSurfaceData

export class VehicleGroundingService {
  private readonly tmpPosition = new THREE.Vector3()
  private readonly tmpPoint = new THREE.Vector3()
  private readonly tmpBox = new THREE.Box3()

  constructor(
    private readonly carTemplateFactory: CarTemplateFactory,
    private readonly sampleSurface: SurfaceSampler,
    private readonly settings: VehicleGroundingSettings
  ) {}

  snapToSurface(view: CarView, extraRideHeight = 0): void {
    const bounds = this.carTemplateFactory.getBounds(view)
    const carPosition = view.copyPosition(this.tmpPosition)
    const surface = this.sampleSurface(carPosition.x, carPosition.z)
    const surfaceExtraRideHeight = this.getSurfaceExtraRideHeight(surface, extraRideHeight)

    view.setY(
      surface.height -
        bounds.groundContactY * view.getScaleY() +
        this.getRideHeightOffset(surface) +
        surfaceExtraRideHeight
    )
    view.updateMatrixWorld(true)

    this.resolveGroundPenetration(view, extraRideHeight)
  }

  smoothFollowSurface(view: CarView, delta: number, extraRideHeight = 0): RoadSurfaceData {
    const bounds = this.carTemplateFactory.getBounds(view)
    const carPosition = view.copyPosition(this.tmpPosition)
    const surface = this.sampleSurface(carPosition.x, carPosition.z)
    const targetY =
      surface.height -
      bounds.groundContactY * view.getScaleY() +
      this.getRideHeightOffset(surface) +
      this.getSurfaceExtraRideHeight(surface, extraRideHeight)

    view.setY(
      THREE.MathUtils.lerp(
        carPosition.y,
        targetY,
        expLerpFactor(this.settings.heightSmoothness, delta)
      )
    )

    return surface
  }

  resolveGroundPenetration(view: CarView, extraRideHeight = 0): void {
    const bounds = this.carTemplateFactory.getBounds(view)
    const centerPosition = view.copyPosition(this.tmpPosition)
    const centerSurface = this.sampleSurface(centerPosition.x, centerPosition.z)
    const surfaceExtraRideHeight = this.getSurfaceExtraRideHeight(
      centerSurface,
      extraRideHeight
    )
    const insetX = Math.max((bounds.maxX - bounds.minX) * 0.12, 0.08)
    const insetZ = Math.max((bounds.maxZ - bounds.minZ) * 0.12, 0.08)
    const samplePoints: Array<[number, number, number]> = [
      [0, bounds.groundContactY, 0],
      [bounds.minX + insetX, bounds.groundContactY, bounds.minZ + insetZ],
      [bounds.maxX - insetX, bounds.groundContactY, bounds.minZ + insetZ],
      [bounds.minX + insetX, bounds.groundContactY, bounds.maxZ - insetZ],
      [bounds.maxX - insetX, bounds.groundContactY, bounds.maxZ - insetZ],
    ]
    let maxLift = 0

    for (const [x, y, z] of samplePoints) {
      view.worldPointFromLocal(x, y, z, this.tmpPoint)

      const surface = this.sampleSurface(this.tmpPoint.x, this.tmpPoint.z)
      const lift =
        surface.height +
        this.getGroundClearance(surface) +
        this.getSurfaceExtraRideHeight(surface, extraRideHeight) -
        this.tmpPoint.y

      maxLift = Math.max(maxLift, lift)
    }

    if (maxLift > 0) {
      view.translateY(maxLift)
    }

    this.liftVisualBoundsIfNeeded(view, centerSurface, surfaceExtraRideHeight)

    view.worldPointFromLocal(0, bounds.groundContactY, 0, this.tmpPoint)
    const contactLift =
      centerSurface.height +
      this.getGroundClearance(centerSurface) +
      surfaceExtraRideHeight -
      this.tmpPoint.y

    if (contactLift > 0) {
      view.translateY(contactLift)
    }
  }

  getRideHeightOffset(surface: RoadSurfaceData): number {
    return (
      this.settings.rideHeightOffset +
      (surface.onRoad ? 0 : this.settings.offroadRideHeightBoost)
    )
  }

  getGroundClearance(surface: RoadSurfaceData): number {
    return surface.onRoad
      ? this.settings.roadGroundClearance
      : this.settings.offroadGroundClearance
  }

  private getSurfaceExtraRideHeight(
    surface: RoadSurfaceData,
    extraRideHeight: number
  ): number {
    return surface.onRoad
      ? extraRideHeight
      : Math.max(extraRideHeight, this.settings.minOffroadExtraRideHeight)
  }

  private liftVisualBoundsIfNeeded(
    view: CarView,
    centerSurface: RoadSurfaceData,
    surfaceExtraRideHeight: number
  ): void {
    const bounds = this.carTemplateFactory.getBounds(view)

    view.updateMatrixWorld(true)
    view.setBoxFromObject(this.tmpBox)

    const visualLift =
      centerSurface.height +
      this.getGroundClearance(centerSurface) * 0.45 +
      surfaceExtraRideHeight -
      this.tmpBox.min.y

    if (visualLift > 0) {
      view.translateY(visualLift)
    }
  }
}
