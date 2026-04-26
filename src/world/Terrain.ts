import * as THREE from 'three'
import { qualitySettings } from '../application/config/QualitySettings'
import type { TerrainProfile } from '../domain/environment/TerrainProfile'
import { loadRepeatingPbrTextures } from '../infrastructure/graphics/TextureFactory'
import { clamp } from '../utils/math'
import type { Road } from './Road'

export class Terrain {
  road: Road
  size = 2400
  segments = qualitySettings.terrainSegments
  geometry: THREE.PlaneGeometry
  material: THREE.MeshStandardMaterial
  mesh: THREE.Mesh
  private readonly primaryBridgeDistance: number

  constructor(
    scene: THREE.Scene,
    road: Road,
    private readonly profile: TerrainProfile
  ) {
    this.road = road
    this.primaryBridgeDistance = this.road.getPrimaryBridgeDistance()
    const terrainPadding = this.profile.kind === 'mountains'
      ? 420
      : this.profile.kind === 'hills'
        ? 220
        : 120
    const bounds = this.road.getPlayableBounds(terrainPadding)
    const sizeX = Math.max(bounds.maxX - bounds.minX, 480)
    const sizeZ = Math.max(bounds.maxZ - bounds.minZ, 480)
    const centerX = (bounds.minX + bounds.maxX) * 0.5
    const centerZ = (bounds.minZ + bounds.maxZ) * 0.5
    this.size = Math.max(sizeX, sizeZ)
    this.segments = this.profile.kind === 'mountains'
      ? Math.max(qualitySettings.terrainSegments * 2, 192)
      : this.profile.kind === 'hills'
        ? Math.max(Math.floor(qualitySettings.terrainSegments * 1.5), 144)
        : qualitySettings.terrainSegments

    this.geometry = new THREE.PlaneGeometry(
      sizeX,
      sizeZ,
      this.segments,
      this.segments
    )
    this.geometry.rotateX(-Math.PI / 2)
    this.geometry.translate(centerX, 0, centerZ)

    const terrainPos = this.geometry.attributes.position
    for (let i = 0; i < terrainPos.count; i++) {
      const x = terrainPos.getX(i)
      const z = terrainPos.getZ(i)
      terrainPos.setY(i, this.height(x, z))
    }
    this.geometry.computeVertexNormals()

    const terrainTextures = loadRepeatingPbrTextures(
      this.profile.texture.basePath,
      this.profile.texture.name,
      this.profile.texture.repeatX,
      this.profile.texture.repeatY
    )

    this.material = new THREE.MeshStandardMaterial({
      color: this.profile.texture.color,
      map: terrainTextures.map,
      normalMap: terrainTextures.normalMap,
      roughnessMap: terrainTextures.roughnessMap,
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(
        this.profile.texture.normalScale,
        this.profile.texture.normalScale
      ),
      polygonOffset: true,
      polygonOffsetFactor: 18,
      polygonOffsetUnits: 18,
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.renderOrder = -10
    scene.add(this.mesh)
  }

  rawHeight(x: number, z: number): number {
    const rolling =
      Math.sin(x * this.profile.primaryFrequency) * 0.9 +
      Math.cos(z * this.profile.secondaryFrequency) * 0.8 +
      Math.sin((x + z) * this.profile.detailFrequency) * 0.42
    const ridgeWave =
      Math.sin((x + z * 0.42) * this.profile.ridgeFrequency) * 0.5 +
      Math.cos((z - x * 0.28) * this.profile.ridgeFrequency * 1.28) * 0.5
    const ridge =
      Math.pow(Math.abs(ridgeWave), 1.8) *
      this.profile.ridgeAmplitude
    const massifWave =
      Math.sin(x * this.profile.massifFrequency + Math.cos(z * this.profile.massifFrequency * 0.62) * 1.4) * 0.5 +
      Math.cos((z - x * 0.18) * this.profile.massifFrequency * 1.35) * 0.34 +
      Math.sin((x + z * 0.36) * this.profile.massifFrequency * 1.9) * 0.22
    const massifT = clamp(massifWave * 0.5 + 0.5, 0, 1)
    const massif =
      Math.pow(massifT, this.profile.massifSharpness) *
      this.profile.massifAmplitude

    return rolling * this.profile.heightAmplitude + ridge + massif
  }

  height(x: number, z: number): number {
    const roadBand = this.road.getBandData(x, z)
    const bridgeCut = this.bridgeRiverCutHeight(roadBand)
    const calmT = clamp(
      (roadBand.distFromRoadCenter - roadBand.halfWidth) / this.road.terrainCalmDistance,
      0,
      1
    )
    const calmFactor = THREE.MathUtils.lerp(
      this.road.terrainCalmFactor,
      1,
      THREE.MathUtils.smoothstep(calmT, 0, 1)
    )
    const baseHeight =
      (
        this.rawHeight(x, z) +
        this.valleyWallHeight(roadBand) +
        this.roadsideReliefHeight(roadBand) +
        bridgeCut
      ) * calmFactor
    const mountainDistanceFade = this.profile.kind === 'mountains'
      ? THREE.MathUtils.lerp(
          1,
          0.18,
          THREE.MathUtils.smoothstep(
            clamp((roadBand.distFromRoadCenter - roadBand.halfWidth - 220) / 320, 0, 1),
            0,
            1
          )
        )
      : 1
    const shapedBaseHeight = baseHeight * mountainDistanceFade
    const roadEdgeOffset = clamp(
      roadBand.lateralOffset,
      -roadBand.halfWidth,
      roadBand.halfWidth
    )
    const outerHalfWidth = this.road.getOuterHalfWidthAtDistance(roadBand.distanceAlong)
    const apronHalfWidth = outerHalfWidth + this.road.apronWidth
    const shoulderEdgeOffset = clamp(
      roadBand.lateralOffset,
      -outerHalfWidth,
      outerHalfWidth
    )
    const apronEdgeOffset = clamp(
      roadBand.lateralOffset,
      -apronHalfWidth,
      apronHalfWidth
    )
    const roadBedHeight =
      this.road.getBankedHeightAtDistance(
        roadBand.distanceAlong,
        roadEdgeOffset,
        this.road.roadY
      ) - this.road.cutDepth
    const shoulderBedHeight =
      this.road.getBankedHeightAtDistance(
        roadBand.distanceAlong,
        shoulderEdgeOffset,
        this.road.apronY
      ) -
      this.road.cutDepth * 0.45
    const apronBedHeight =
      this.road.getBankedHeightAtDistance(
        roadBand.distanceAlong,
        apronEdgeOffset,
        this.road.apronY
      ) -
      this.road.cutDepth * 0.55
    const hiddenRoadBedHeight = roadBedHeight - 0.18
    const hiddenShoulderBedHeight = shoulderBedHeight - 0.12 + bridgeCut * 0.38
    const hiddenApronBedHeight = apronBedHeight - 0.1 + bridgeCut * 0.82
    const hardRoadLimit = roadBand.halfWidth + this.road.terrainHardMargin
    const shoulderLimit =
      hardRoadLimit + this.road.shoulderWidth + this.road.terrainShoulderMargin
    const apronLimit = shoulderLimit + this.road.apronWidth

    if (roadBand.distFromRoadCenter <= hardRoadLimit) {
      return hiddenRoadBedHeight
    }

    if (roadBand.distFromRoadCenter <= shoulderLimit) {
      const t = clamp(
        (roadBand.distFromRoadCenter - hardRoadLimit) /
          (this.road.shoulderWidth + this.road.terrainShoulderMargin),
        0,
        1
      )
      const k = THREE.MathUtils.smoothstep(t, 0, 1)
      return THREE.MathUtils.lerp(hiddenRoadBedHeight, hiddenShoulderBedHeight, k)
    }

    if (roadBand.distFromRoadCenter <= apronLimit) {
      return hiddenApronBedHeight
    }

    if (roadBand.distFromRoadCenter <= apronLimit + this.road.terrainBlend) {
      const t = clamp(
        (roadBand.distFromRoadCenter - apronLimit) / this.road.terrainBlend,
        0,
        1
      )
      const k = THREE.MathUtils.smoothstep(t, 0, 1)
      return THREE.MathUtils.lerp(hiddenApronBedHeight, shapedBaseHeight, k)
    }

    return shapedBaseHeight
  }

  private roadsideReliefHeight(roadBand: {
    distanceAlong: number
    distFromRoadCenter: number
    halfWidth: number
    lateralOffset: number
  }): number {
    if (this.profile.roadsideCliffAmplitude <= 0) return 0

    const sideSign = Math.sign(roadBand.lateralOffset || 1)
    const preferredSide = Math.sin(roadBand.distanceAlong * 0.0028) >= 0 ? 1 : -1

    if (sideSign !== preferredSide) return 0

    const cliffWave =
      Math.sin(roadBand.distanceAlong * this.profile.roadsideCliffFrequency) * 0.5 +
      Math.sin(roadBand.distanceAlong * this.profile.roadsideCliffFrequency * 1.73 + 1.9) * 0.5
    const cliffMask = THREE.MathUtils.smoothstep(
      Math.abs(cliffWave),
      this.profile.roadsideCliffThreshold,
      1
    )

    if (cliffMask <= 0) return 0

    const safeStart = roadBand.halfWidth + 24
    const rampDistance = 92
    const lateralT = clamp(
      (roadBand.distFromRoadCenter - safeStart) / rampDistance,
      0,
      1
    )
    const shoulderMask = THREE.MathUtils.smoothstep(lateralT, 0, 1)
    const layeredSlope =
      0.72 +
      Math.pow(
        Math.abs(Math.sin(roadBand.distanceAlong * 0.011 + roadBand.distFromRoadCenter * 0.018)),
        1.6
      ) * 0.52

    return this.profile.roadsideCliffAmplitude * cliffMask * shoulderMask * layeredSlope
  }

  private valleyWallHeight(roadBand: {
    distanceAlong: number
    distFromRoadCenter: number
    halfWidth: number
    lateralOffset: number
  }): number {
    if (this.profile.valleyWallAmplitude <= 0) return 0

    const safeStart = roadBand.halfWidth + this.profile.valleyWallDistance
    const lateralT = clamp(
      (roadBand.distFromRoadCenter - safeStart) / this.profile.valleyWallRamp,
      0,
      1
    )

    if (lateralT <= 0) return 0

    const sideSign = Math.sign(roadBand.lateralOffset || 1)
    const wallMask = THREE.MathUtils.smoothstep(lateralT, 0, 1)
    const ridgeRhythm =
      0.72 +
      Math.pow(
        Math.abs(
          Math.sin(
            roadBand.distanceAlong * this.profile.massifFrequency * 3.8 +
              sideSign * 1.6
          )
        ),
        1.35
      ) * 0.88
    const terracedSlope = Math.pow(wallMask, 1.22)

    return this.profile.valleyWallAmplitude * terracedSlope * ridgeRhythm
  }

  private bridgeRiverCutHeight(roadBand: {
    distanceAlong: number
    distFromRoadCenter: number
    halfWidth: number
    lateralOffset: number
  }): number {
    const alongDelta = THREE.MathUtils.euclideanModulo(
      roadBand.distanceAlong - this.primaryBridgeDistance + this.road.totalLength * 0.5,
      this.road.totalLength
    ) - this.road.totalLength * 0.5
    const alongAbs = Math.abs(alongDelta)

    if (alongAbs > 156) return 0

    const outerHalfWidth = this.road.getOuterHalfWidthAtDistance(this.primaryBridgeDistance)
    const riverCrossReach = outerHalfWidth + this.road.apronWidth + 84
    const lateralAbs = Math.abs(roadBand.lateralOffset)
    const sideBranchCenter = outerHalfWidth + this.road.apronWidth + 18
    const sideBranchDistance = Math.abs(lateralAbs - sideBranchCenter)
    const alongMask = 1 - THREE.MathUtils.smoothstep(alongAbs, 20, 156)
    const centralMask = 1 - THREE.MathUtils.smoothstep(lateralAbs, outerHalfWidth * 0.08, riverCrossReach)
    const branchMask = 1 - THREE.MathUtils.smoothstep(sideBranchDistance, 10, 56)
    const depth =
      this.profile.kind === 'mountains'
        ? 9.8
        : this.profile.kind === 'hills'
          ? 7.2
          : 6.2

    return -depth * alongMask * Math.max(centralMask, branchMask * 0.82)
  }

  getHeightAndNormal(x: number, z: number): { height: number; normal: THREE.Vector3 } {
    const h = this.height(x, z)
    const eps = 0.2

    const hL = this.height(x - eps, z)
    const hR = this.height(x + eps, z)
    const hD = this.height(x, z - eps)
    const hU = this.height(x, z + eps)

    const dx = (hR - hL) / (2 * eps)
    const dz = (hU - hD) / (2 * eps)

    const normal = new THREE.Vector3(-dx, 1, -dz).normalize()
    return { height: h, normal }
  }

  getSlopeBarrier(
    x: number,
    z: number,
    colliderRadius: number,
    outNormal = new THREE.Vector3()
  ): { normal: THREE.Vector3; pushOut: number } | null {
    const roadBand = this.road.getBandData(x, z)
    const barrierStart =
      roadBand.halfWidth +
      this.road.shoulderWidth +
      this.road.apronWidth +
      this.road.terrainBlend * 0.72

    if (roadBand.distFromRoadCenter <= barrierStart) return null

    if (this.profile.kind !== 'plain') {
      const dx = roadBand.nearestPoint.x - x
      const dz = roadBand.nearestPoint.z - z
      const dist = Math.hypot(dx, dz)

      if (dist < 0.0001) return null

      outNormal.set(dx / dist, 0, dz / dist)

      const offroadPenetration = roadBand.distFromRoadCenter - barrierStart + colliderRadius * 0.8
      if (offroadPenetration > 0) {
        const terrainPush =
          this.profile.kind === 'mountains'
            ? Math.max(offroadPenetration, colliderRadius * 0.42)
            : Math.max(offroadPenetration * 0.82, colliderRadius * 0.3)

        return {
          normal: outNormal,
          pushOut: terrainPush,
        }
      }
    }

    const { normal } = this.getHeightAndNormal(x, z)
    const steepness = 1 - normal.y

    if (steepness < 0.26) return null

    const dx = roadBand.nearestPoint.x - x
    const dz = roadBand.nearestPoint.z - z
    const dist = Math.hypot(dx, dz)

    if (dist < 0.0001) return null

    outNormal.set(dx / dist, 0, dz / dist)

    const slopePush = THREE.MathUtils.clamp((steepness - 0.26) / 0.22, 0, 1)
    const penetrationPush = Math.max(
      0,
      roadBand.distFromRoadCenter - barrierStart + colliderRadius * 0.65
    )

    return {
      normal: outNormal,
      pushOut: Math.max(penetrationPush * slopePush, colliderRadius * 0.18 * slopePush),
    }
  }
}
