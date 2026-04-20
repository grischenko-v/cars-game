import * as THREE from 'three'
import type { RoadBandData, RoadSurfaceData, TrackBounds, TurnInfo } from '../domain/road/TrackModel'
import { TrackModel } from '../domain/road/TrackModel'
import { RandomClosedLoopTrackStrategy } from '../domain/road/RandomClosedLoopTrackStrategy'
import type { TrackGenerationStrategy } from '../domain/road/TrackGenerationStrategy'
import { RoadMeshFactory } from '../infrastructure/graphics/RoadMeshFactory'

export class Road {
  private readonly track: TrackModel
  private readonly meshFactory: RoadMeshFactory

  terrainBackfill: THREE.Mesh | null = null
  apron: THREE.Mesh | null = null
  road: THREE.Mesh | null = null
  shoulder: THREE.Mesh | null = null
  markingGroup: THREE.Group | null = null

  constructor(
    generationStrategy: TrackGenerationStrategy = new RandomClosedLoopTrackStrategy(),
    meshFactory = new RoadMeshFactory()
  ) {
    this.track = new TrackModel(generationStrategy.generate())
    this.meshFactory = meshFactory
  }

  get roadWidth(): number {
    return this.track.roadWidth
  }

  get shoulderWidth(): number {
    return this.track.shoulderWidth
  }

  get roadY(): number {
    return this.track.roadY
  }

  get shoulderY(): number {
    return this.track.shoulderY
  }

  get apronY(): number {
    return this.track.apronY
  }

  get shoulderBlend(): number {
    return this.track.shoulderBlend
  }

  get terrainBlend(): number {
    return this.track.terrainBlend
  }

  get cutDepth(): number {
    return this.track.cutDepth
  }

  get terrainCalmDistance(): number {
    return this.track.terrainCalmDistance
  }

  get terrainCalmFactor(): number {
    return this.track.terrainCalmFactor
  }

  get terrainHardMargin(): number {
    return this.track.terrainHardMargin
  }

  get terrainShoulderMargin(): number {
    return this.track.terrainShoulderMargin
  }

  get apronWidth(): number {
    return this.track.apronWidth
  }

  get trackHalfWidth(): number {
    return this.track.trackHalfWidth
  }

  get outerHalfWidth(): number {
    return this.track.outerHalfWidth
  }

  get startAngle(): number {
    return this.track.startAngle
  }

  get startClearArc(): number {
    return this.track.startClearArc
  }

  get turnInfo(): TurnInfo {
    return this.track.turnInfo
  }

  get centerline(): THREE.Vector3[] {
    return this.track.centerline
  }

  get cumulativeLengths(): number[] {
    return this.track.cumulativeLengths
  }

  get totalLength(): number {
    return this.track.totalLength
  }

  get trackBounds(): TrackBounds {
    return this.track.trackBounds
  }

  attachTo(scene: THREE.Scene): void {
    const meshes = this.meshFactory.create(this.track)

    this.terrainBackfill = meshes.terrainBackfill
    this.apron = meshes.apron
    this.road = meshes.road
    this.shoulder = meshes.shoulder
    this.markingGroup = meshes.markingGroup

    scene.add(this.terrainBackfill)
    scene.add(this.apron)
    scene.add(this.road)
    scene.add(this.shoulder)
    scene.add(this.markingGroup)
  }

  sampleCenterlineByDistance(
    distance: number,
    out?: THREE.Vector3,
    tangentOut?: THREE.Vector3 | null
  ): THREE.Vector3 {
    return this.track.sampleCenterlineByDistance(distance, out, tangentOut)
  }

  getCenterPointAtAngle(angle: number, out?: THREE.Vector3): THREE.Vector3 {
    return this.track.getCenterPointAtAngle(angle, out)
  }

  getTangentHeadingAtAngle(angle: number): number {
    return this.track.getTangentHeadingAtAngle(angle)
  }

  getBandData(x: number, z: number): RoadBandData {
    return this.track.getBandData(x, z)
  }

  getLaneCountAtDistance(distance: number): number {
    return this.track.getLaneCountAtDistance(distance)
  }

  getEffectiveLaneCountAtDistance(distance: number): number {
    return this.track.getEffectiveLaneCountAtDistance(distance)
  }

  getTrackHalfWidthAtDistance(distance: number): number {
    return this.track.getTrackHalfWidthAtDistance(distance)
  }

  getOuterHalfWidthAtDistance(distance: number): number {
    return this.track.getOuterHalfWidthAtDistance(distance)
  }

  angleDistance(a: number, b: number): number {
    return this.track.angleDistance(a, b)
  }

  isNearStartSector(angle: number, extraArc = 0): boolean {
    return this.track.isNearStartSector(angle, extraArc)
  }

  isPointOnRoad(x: number, z: number, margin = 0): boolean {
    return this.track.isPointOnRoad(x, z, margin)
  }

  getHeightAndNormal(
    x: number,
    z: number,
    terrainData: { height: number; normal: THREE.Vector3 }
  ): RoadSurfaceData {
    return this.track.getHeightAndNormal(x, z, terrainData)
  }

  getBankedHeightAtDistance(distance: number, lateralOffset: number, baseY: number): number {
    return this.track.getBankedHeightAtDistance(distance, lateralOffset, baseY)
  }
}
