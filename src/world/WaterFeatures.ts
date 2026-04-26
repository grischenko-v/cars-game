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
  maxYHalfB?: number
  segmentsA?: number
  segmentsB?: number
}

export class WaterFeatures {
  private readonly group = new THREE.Group()
  private readonly waterColorTexture = WaterFeatures.createWaterColorTexture()
  private readonly waterBumpTexture = WaterFeatures.createWaterBumpTexture()
  private readonly waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x58bde8,
    map: this.waterColorTexture,
    bumpMap: this.waterBumpTexture,
    bumpScale: 0.42,
    roughness: 0.12,
    metalness: 0.06,
    emissive: 0x1d6f8d,
    emissiveIntensity: 0.42,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    side: THREE.FrontSide,
  })
  private readonly curbMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9d8ce,
    roughness: 0.82,
    metalness: 0.05,
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

  update(delta: number): void {
    const flow = delta * 0.14

    this.waterColorTexture.offset.y -= flow
    this.waterColorTexture.offset.x += delta * 0.018
    this.waterBumpTexture.offset.y -= flow * 1.45
    this.waterBumpTexture.offset.x -= delta * 0.012
  }

  private build(): void {
    const waterRects: RectSpec[] = []

    this.addLakes(waterRects)
    this.addMandatoryRiverBridge(waterRects)

    if (waterRects.length === 0) return

    const water = new THREE.Mesh(this.buildRectGeometry(waterRects), this.waterMaterial)
    water.receiveShadow = true
    water.frustumCulled = false
    water.renderOrder = -1
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
      center.y = this.terrain.height(center.x, center.z) + 0.08

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
    const distance = this.road.getPrimaryBridgeDistance()
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()

    this.road.sampleCenterlineByDistance(distance, center, tangent)
    side.set(-tangent.z, 0, tangent.x).normalize()

    const riverHalfAlong = THREE.MathUtils.lerp(34, 42, this.pseudoRandom(11.1))
    const riverHalfAcross = this.terrainProfile.kind === 'mountains'
      ? THREE.MathUtils.lerp(112, 146, this.pseudoRandom(12.7))
      : THREE.MathUtils.lerp(96, 128, this.pseudoRandom(12.7))
    const bridgeSurfaceY = this.road.getBankedHeightAtDistance(distance, 0, this.road.roadY)
    const waterCenter = center.clone()
    waterCenter.y = bridgeSurfaceY - 1.28

    rects.push({
      center: waterCenter,
      axisA: tangent.clone().normalize(),
      axisB: side.clone(),
      halfA: riverHalfAlong,
      halfB: riverHalfAcross,
      conformToTerrain: false,
      segmentsA: 1,
      segmentsB: 1,
    })

    const sideWaterOffset =
      this.road.getOuterHalfWidthAtDistance(distance) +
      this.road.apronWidth +
      30
    const visibleBranchHalfLength = THREE.MathUtils.lerp(42, 58, this.pseudoRandom(15.4))
    const visibleBranchHalfWidth = THREE.MathUtils.lerp(44, 66, this.pseudoRandom(18.6))

    for (const sideSign of [-1, 1]) {
      const branchCenter = center
        .clone()
        .addScaledVector(side, sideSign * sideWaterOffset)
      branchCenter.y = bridgeSurfaceY - 1.2

      rects.push({
        center: branchCenter,
        axisA: tangent.clone().normalize(),
        axisB: side.clone(),
        halfA: visibleBranchHalfWidth,
        halfB: visibleBranchHalfLength,
        conformToTerrain: false,
        segmentsA: 1,
        segmentsB: 1,
      })
    }

    this.addBridge(distance, riverHalfAlong * 2, center, tangent, side)
  }
  private addBridge(
    distance: number,
    riverWidth: number,
    center: THREE.Vector3,
    tangent: THREE.Vector3,
    side: THREE.Vector3
  ): void {
    const bridgeWidth = this.road.getOuterHalfWidthAtDistance(distance) * 2 + 2.2
    const bridgeLength = THREE.MathUtils.clamp(riverWidth + 8, 46, 74)
    const y = this.road.getBankedHeightAtDistance(distance, 0, this.road.roadY)
    const heading = Math.atan2(tangent.x, tangent.z)

    for (const sideSign of [-1, 1]) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(0.64, 0.72, bridgeLength + 0.8),
        this.curbMaterial
      )

      curb.position
        .set(center.x, y + 0.36, center.z)
        .addScaledVector(side, sideSign * (bridgeWidth * 0.5 + 0.18))
      curb.rotation.y = heading
      curb.castShadow = true
      curb.receiveShadow = true
      this.group.add(curb)
    }

  }

  private buildRectGeometry(rects: RectSpec[]): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    for (const rect of rects) {
      const segmentsA = rect.segmentsA ?? 1
      const segmentsB = rect.segmentsB ?? 1
      const base = positions.length / 3

      for (let b = 0; b <= segmentsB; b++) {
        const v = b / segmentsB
        const offsetB = THREE.MathUtils.lerp(-rect.halfB, rect.halfB, v)

        for (let a = 0; a <= segmentsA; a++) {
          const u = a / segmentsA
          const offsetA = THREE.MathUtils.lerp(-rect.halfA, rect.halfA, u)
          const point = new THREE.Vector3()
            .copy(rect.center)
            .addScaledVector(rect.axisA, offsetA)
            .addScaledVector(rect.axisB, offsetB)

          if (rect.conformToTerrain) {
            const terrainWaterY = this.terrain.height(point.x, point.z) + 0.22
            const shouldDipBelowBridge =
              rect.maxY !== undefined &&
              rect.maxYHalfB !== undefined &&
              Math.abs(offsetB) <= rect.maxYHalfB

            point.y = shouldDipBelowBridge
              ? Math.min(terrainWaterY, rect.maxY)
              : terrainWaterY
          }

          positions.push(point.x, point.y, point.z)
          normals.push(0, 1, 0)
          uvs.push(u, v)
        }
      }

      const row = segmentsA + 1
      for (let b = 0; b < segmentsB; b++) {
        for (let a = 0; a < segmentsA; a++) {
          const i0 = base + b * row + a
          const i1 = i0 + 1
          const i2 = i0 + row
          const i3 = i2 + 1

          indices.push(i0, i1, i2)
          indices.push(i1, i3, i2)
        }
      }
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

  private static createWaterColorTexture(): THREE.CanvasTexture {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return new THREE.CanvasTexture(canvas)
    }

    const gradient = ctx.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, '#0f5f88')
    gradient.addColorStop(0.45, '#2da2c7')
    gradient.addColorStop(1, '#0b496d')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    ctx.globalAlpha = 0.34
    ctx.strokeStyle = '#d8fbff'
    ctx.lineWidth = 2

    for (let row = -16; row < size + 24; row += 18) {
      ctx.beginPath()
      for (let x = -12; x <= size + 12; x += 8) {
        const y =
          row +
          Math.sin(x * 0.055 + row * 0.18) * 5 +
          Math.sin(x * 0.13 + row * 0.08) * 2

        if (x === -12) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    ctx.globalAlpha = 0.16
    ctx.fillStyle = '#ffffff'
    for (let i = 0; i < 90; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % size
      const y = (Math.sin(i * 78.233) * 24634.6345) % size
      ctx.fillRect(Math.abs(x), Math.abs(y), 10 + (i % 5) * 4, 1)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(1.4, 8)
    texture.anisotropy = 8

    return texture
  }

  private static createWaterBumpTexture(): THREE.CanvasTexture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      return new THREE.CanvasTexture(canvas)
    }

    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#b4b4b4'
    ctx.lineWidth = 2

    for (let row = -12; row < size + 16; row += 10) {
      ctx.beginPath()
      for (let x = -8; x <= size + 8; x += 6) {
        const y = row + Math.sin(x * 0.16 + row * 0.11) * 3

        if (x === -8) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(1.6, 10)
    texture.anisotropy = 8

    return texture
  }
}
