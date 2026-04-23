import * as THREE from 'three'
import type { TerrainProfile } from '../domain/environment/TerrainProfile'
import type { Road } from './Road'
import type { Terrain } from './Terrain'

interface RectSpec {
  center: THREE.Vector3
  axisA: THREE.Vector3
  axisB: THREE.Vector3
  halfA: number
  halfB: number
  conformToTerrain?: boolean
  maxY?: number
}

export class WaterFeatures {
  private static readonly bridgeCandidateFractions = [0.34, 0.47, 0.61, 0.76, 0.88, 0.22]

  private readonly group = new THREE.Group()
  private readonly waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x356f8f,
    roughness: 0.18,
    metalness: 0.02,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  })
  private readonly bridgeDeckMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2423,
    roughness: 0.96,
    metalness: 0.01,
  })
  private readonly curbMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8c7bd,
    roughness: 0.86,
    metalness: 0.04,
  })

  constructor(
    scene: THREE.Scene,
    private readonly terrain: Terrain,
    private readonly road: Road,
    private readonly terrainProfile: TerrainProfile
  ) {
    this.group.name = 'WaterFeatures'
    scene.add(this.group)
    this.build()
  }

  private build(): void {
    const waterRects: RectSpec[] = []

    this.addLakes(waterRects)
    this.addMandatoryRiverBridge(waterRects)

    if (waterRects.length === 0) return

    const water = new THREE.Mesh(this.buildRectGeometry(waterRects), this.waterMaterial)
    water.receiveShadow = true
    water.renderOrder = -2
    this.group.add(water)
  }

  private addLakes(rects: RectSpec[]): void {
    const lakeCount = this.terrainProfile.kind === 'plain'
      ? 3
      : this.terrainProfile.kind === 'hills'
        ? 2
        : 1
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()

    for (let i = 0; i < lakeCount; i++) {
      const distance = ((i + 0.23) / lakeCount) * this.road.totalLength
      const sideSign = i % 2 === 0 ? 1 : -1
      const lateralOffset =
        sideSign *
        (this.road.getOuterHalfWidthAtDistance(distance) +
          THREE.MathUtils.lerp(95, 170, this.pseudoRandom(i + 1.8)))

      this.road.sampleCenterlineByDistance(distance, center, tangent)
      side.set(-tangent.z, 0, tangent.x).normalize()
      center.addScaledVector(side, lateralOffset)
      center.y = this.terrain.height(center.x, center.z) + 0.035

      rects.push({
        center: center.clone(),
        axisA: tangent.clone().normalize(),
        axisB: side.clone(),
        halfA: THREE.MathUtils.lerp(30, 58, this.pseudoRandom(i + 4.4)),
        halfB: THREE.MathUtils.lerp(20, 46, this.pseudoRandom(i + 6.2)),
      })
    }
  }

  private addMandatoryRiverBridge(rects: RectSpec[]): void {
    const distance = this.findBridgeDistance()
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()

    this.road.sampleCenterlineByDistance(distance, center, tangent)
    side.set(-tangent.z, 0, tangent.x).normalize()

    const riverWidth = THREE.MathUtils.lerp(16, 24, this.pseudoRandom(11.1))
    const riverLength = this.terrainProfile.kind === 'mountains'
      ? THREE.MathUtils.lerp(270, 390, this.pseudoRandom(12.7))
      : THREE.MathUtils.lerp(220, 330, this.pseudoRandom(12.7))
    const bridgeSurfaceY = this.road.getBankedHeightAtDistance(distance, 0, this.road.roadY)
    const waterCenter = center.clone()
    waterCenter.y = bridgeSurfaceY - 0.26

    rects.push({
      center: waterCenter,
      axisA: tangent.clone().normalize(),
      axisB: side.clone(),
      halfA: riverWidth * 0.5,
      halfB: riverLength * 0.5,
      conformToTerrain: true,
      maxY: bridgeSurfaceY - 0.18,
    })

    this.addBridge(distance, riverWidth, center, tangent, side)
  }

  private findBridgeDistance(): number {
    for (const fraction of WaterFeatures.bridgeCandidateFractions) {
      const distance = fraction * this.road.totalLength

      if (!this.road.isLaneTransitionAtDistance(distance, 94)) {
        return distance
      }
    }

    return this.road.totalLength * 0.5
  }

  private addBridge(
    distance: number,
    riverWidth: number,
    center: THREE.Vector3,
    tangent: THREE.Vector3,
    side: THREE.Vector3
  ): void {
    const bridgeWidth = this.road.getOuterHalfWidthAtDistance(distance) * 2 + 2.8
    const bridgeLength = riverWidth + 10
    const y = this.road.getBankedHeightAtDistance(distance, 0, this.road.roadY) + 0.07
    const heading = Math.atan2(tangent.x, tangent.z)
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeWidth, 0.16, bridgeLength),
      this.bridgeDeckMaterial
    )

    deck.position.set(center.x, y, center.z)
    deck.rotation.y = heading
    deck.receiveShadow = true
    deck.castShadow = true
    this.group.add(deck)

    for (const sideSign of [-1, 1]) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.38, bridgeLength + 0.8),
        this.curbMaterial
      )

      curb.position
        .set(center.x, y + 0.27, center.z)
        .addScaledVector(side, sideSign * bridgeWidth * 0.48)
      curb.rotation.y = heading
      curb.castShadow = true
      curb.receiveShadow = true
      this.group.add(curb)
    }

    this.addBridgeEndLip(center, tangent, heading, bridgeWidth, bridgeLength, y, -1)
    this.addBridgeEndLip(center, tangent, heading, bridgeWidth, bridgeLength, y, 1)
  }

  private addBridgeEndLip(
    center: THREE.Vector3,
    tangent: THREE.Vector3,
    heading: number,
    bridgeWidth: number,
    bridgeLength: number,
    y: number,
    sign: number
  ): void {
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeWidth, 0.08, 0.32),
      this.curbMaterial
    )

    lip.position
      .set(center.x, y + 0.14, center.z)
      .addScaledVector(tangent, sign * bridgeLength * 0.5)
    lip.rotation.y = heading
    lip.receiveShadow = true
    this.group.add(lip)
  }

  private buildRectGeometry(rects: RectSpec[]): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (const rect of rects) {
      const base = positions.length / 3
      const corners = [
        new THREE.Vector3()
          .copy(rect.center)
          .addScaledVector(rect.axisA, -rect.halfA)
          .addScaledVector(rect.axisB, -rect.halfB),
        new THREE.Vector3()
          .copy(rect.center)
          .addScaledVector(rect.axisA, rect.halfA)
          .addScaledVector(rect.axisB, -rect.halfB),
        new THREE.Vector3()
          .copy(rect.center)
          .addScaledVector(rect.axisA, -rect.halfA)
          .addScaledVector(rect.axisB, rect.halfB),
        new THREE.Vector3()
          .copy(rect.center)
          .addScaledVector(rect.axisA, rect.halfA)
          .addScaledVector(rect.axisB, rect.halfB),
      ]

      for (const corner of corners) {
        if (rect.conformToTerrain) {
          corner.y = Math.min(
            this.terrain.height(corner.x, corner.z) + 0.055,
            rect.maxY ?? corner.y
          )
        }

        positions.push(corner.x, corner.y, corner.z)
        normals.push(0, 1, 0)
      }

      uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()

    return geometry
  }

  private pseudoRandom(seed: number): number {
    return THREE.MathUtils.euclideanModulo(Math.sin(seed * 12.9898) * 43758.5453, 1)
  }
}
