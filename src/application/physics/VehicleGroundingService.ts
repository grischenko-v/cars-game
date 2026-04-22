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
  visibleSurfaceClearance: number
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

    view.setY(
      this.getSurfaceAlignedY(view, bounds.groundContactY, surface, extraRideHeight)
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
    view.updateMatrixWorld(true)

    const bounds = this.carTemplateFactory.getBounds(view)
    const centerPosition = view.copyPosition(this.tmpPosition)
    const centerSurface = this.sampleSurface(centerPosition.x, centerPosition.z)
    const surfaceExtraRideHeight = this.getSurfaceExtraRideHeight(
      centerSurface,
      extraRideHeight
    )
    const insetX = Math.max((bounds.maxX - bounds.minX) * 0.12, 0.08)
    const insetZ = Math.max((bounds.maxZ - bounds.minZ) * 0.12, 0.08)
    const contactY = bounds.groundContactY
    const maxLift = Math.max(
      this.getLocalContactLift(view, 0, contactY, 0, extraRideHeight),
      this.getLocalContactLift(
        view,
        bounds.minX + insetX,
        contactY,
        bounds.minZ + insetZ,
        extraRideHeight
      ),
      this.getLocalContactLift(
        view,
        bounds.maxX - insetX,
        contactY,
        bounds.minZ + insetZ,
        extraRideHeight
      ),
      this.getLocalContactLift(
        view,
        bounds.minX + insetX,
        contactY,
        bounds.maxZ - insetZ,
        extraRideHeight
      ),
      this.getLocalContactLift(
        view,
        bounds.maxX - insetX,
        contactY,
        bounds.maxZ - insetZ,
        extraRideHeight
      )
    )

    if (maxLift > 0) {
      view.translateY(maxLift)
    }

    view.updateMatrixWorld(true)
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

    view.updateMatrixWorld(true)
    this.liftVehicleVisualBoundsAboveSurface(view, extraRideHeight)
  }

  getSurfaceAlignedY(
    view: CarView,
    localContactY: number,
    surface: RoadSurfaceData,
    extraRideHeight: number
  ): number {
    return (
      surface.height -
      localContactY * view.getScaleY() +
      this.getRideHeightOffset(surface) +
      this.getSurfaceExtraRideHeight(surface, extraRideHeight)
    )
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

  getSurfaceExtraRideHeight(
    surface: RoadSurfaceData,
    extraRideHeight: number
  ): number {
    return surface.onRoad
      ? extraRideHeight
      : Math.max(extraRideHeight, this.settings.minOffroadExtraRideHeight)
  }

  private getLocalContactLift(
    view: CarView,
    x: number,
    y: number,
    z: number,
    extraRideHeight: number
  ): number {
    view.worldPointFromLocal(x, y, z, this.tmpPoint)

    const surface = this.sampleSurface(this.tmpPoint.x, this.tmpPoint.z)
    return (
      surface.height +
      this.getGroundClearance(surface) +
      this.getSurfaceExtraRideHeight(surface, extraRideHeight) -
      this.tmpPoint.y
    )
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

  private liftVehicleVisualBoundsAboveSurface(view: CarView, extraRideHeight = 0): void {
    view.updateMatrixWorld(true)
    view.setBoxFromObject(this.tmpBox)

    const minX = this.tmpBox.min.x
    const midX = (this.tmpBox.min.x + this.tmpBox.max.x) * 0.5
    const maxX = this.tmpBox.max.x
    const minZ = this.tmpBox.min.z
    const midZ = (this.tmpBox.min.z + this.tmpBox.max.z) * 0.5
    const maxZ = this.tmpBox.max.z
    let requiredBottomY = -Infinity

    for (let xi = 0; xi < 3; xi++) {
      const x = xi === 0 ? minX : xi === 1 ? midX : maxX

      for (let zi = 0; zi < 3; zi++) {
        const z = zi === 0 ? minZ : zi === 1 ? midZ : maxZ
        const surface = this.sampleSurface(x, z)
        const surfaceExtra = Math.min(
          this.getSurfaceExtraRideHeight(surface, extraRideHeight),
          this.settings.visibleSurfaceClearance
        )

        requiredBottomY = Math.max(
          requiredBottomY,
          surface.height + this.settings.visibleSurfaceClearance + surfaceExtra
        )
      }
    }

    const lift = requiredBottomY - this.tmpBox.min.y
    if (lift > 0) {
      view.translateY(lift)
      view.updateMatrixWorld(true)
    }

    this.liftVehicleFootprintAboveSurface(view, extraRideHeight)
  }

  private liftVehicleFootprintAboveSurface(view: CarView, extraRideHeight = 0): void {
    const bounds = this.carTemplateFactory.getBounds(view)
    const insetX = Math.max((bounds.maxX - bounds.minX) * 0.1, 0.06)
    const insetZ = Math.max((bounds.maxZ - bounds.minZ) * 0.1, 0.06)
    const contactY = bounds.groundContactY

    view.updateMatrixWorld(true)

    const maxLift = Math.max(
      this.getLocalContactLift(
        view,
        bounds.minX + insetX,
        contactY,
        bounds.minZ + insetZ,
        extraRideHeight
      ),
      this.getLocalContactLift(
        view,
        bounds.maxX - insetX,
        contactY,
        bounds.minZ + insetZ,
        extraRideHeight
      ),
      this.getLocalContactLift(
        view,
        bounds.minX + insetX,
        contactY,
        bounds.maxZ - insetZ,
        extraRideHeight
      ),
      this.getLocalContactLift(
        view,
        bounds.maxX - insetX,
        contactY,
        bounds.maxZ - insetZ,
        extraRideHeight
      )
    )

    if (maxLift > 0) {
      view.translateY(maxLift)
      view.updateMatrixWorld(true)
    }
  }
}
