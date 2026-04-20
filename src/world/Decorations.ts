import * as THREE from 'three'
import { qualitySettings } from '../application/config/QualitySettings'
import { SpatialHashGrid } from '../domain/shared/SpatialHashGrid'
import { loadRepeatingPbrTextures } from '../infrastructure/graphics/TextureFactory'
import type { Terrain } from './Terrain'
import type { Road } from './Road'

export interface ObstacleCollider {
  x: number
  z: number
  radius: number
}

export type GroundSurfaceKind = 'sand' | 'dirt'

interface TreeInstance {
  x: number
  y: number
  z: number
  scale: number
  rotationY: number
  variant: number
}

interface HouseInstance {
  x: number
  y: number
  z: number
  scale: number
  rotationY: number
  variant: number
}

interface RockInstance {
  x: number
  y: number
  z: number
  scale: number
  rotationY: number
}

interface GroundPatchInstance {
  x: number
  y: number
  z: number
  scaleX: number
  scaleZ: number
  rotationY: number
  variant: number
}

type ScenicInstance = TreeInstance | HouseInstance | RockInstance

export class Decorations {
  readonly obstacleColliders: ObstacleCollider[] = []
  readonly obstacleIndex = new SpatialHashGrid<ObstacleCollider>(28)
  readonly group: THREE.Group

  private readonly treeInstances: TreeInstance[] = []
  private readonly houseInstances: HouseInstance[] = []
  private readonly rockInstances: RockInstance[] = []
  private readonly groundPatchInstances: GroundPatchInstance[] = []
  private readonly tmpMatrix = new THREE.Matrix4()
  private readonly tmpLocalMatrix = new THREE.Matrix4()
  private readonly tmpFinalMatrix = new THREE.Matrix4()
  private readonly tmpQuat = new THREE.Quaternion()
  private readonly tmpLocalQuat = new THREE.Quaternion()
  private readonly tmpPosition = new THREE.Vector3()
  private readonly tmpScale = new THREE.Vector3()
  private readonly yAxis = new THREE.Vector3(0, 1, 0)

  constructor(
    private readonly scene: THREE.Scene,
    private readonly terrain: Terrain,
    private readonly road: Road
  ) {
    this.group = new THREE.Group()
    this.group.name = 'decorations-instanced'
    this.scene.add(this.group)
    this.populate()
    this.buildInstancedMeshes()
  }

  randomRange(min: number, max: number): number {
    return THREE.MathUtils.randFloat(min, max)
  }

  addTree(x: number, z: number): void {
    const variant = THREE.MathUtils.randInt(0, 3)
    const scale = variant === 3 ? this.randomRange(1.45, 2.15) : this.randomRange(1.05, 1.75)

    this.treeInstances.push({
      x,
      y: this.terrain.height(x, z),
      z,
      scale,
      rotationY: this.randomRange(0, Math.PI * 2),
      variant,
    })

    this.registerObstacle({
      x,
      z,
      radius: (variant === 3 ? 0.95 : 0.82) * scale,
    })
  }

  canPlaceAt(x: number, z: number, clearance = 0): boolean {
    if (this.road.isPointOnRoad(x, z, clearance)) return false

    const nearby = this.obstacleIndex.queryRadius(x, z, clearance + 8)

    for (const obstacle of nearby) {
      const dx = x - obstacle.x
      const dz = z - obstacle.z
      const minDist = clearance + obstacle.radius + 1.5
      if (dx * dx + dz * dz < minDist * minDist) {
        return false
      }
    }

    return true
  }

  addHouse(x: number, z: number, rotationY: number, scale = 1): void {
    const variant = THREE.MathUtils.randInt(0, 2)

    this.houseInstances.push({
      x,
      y: this.terrain.height(x, z),
      z,
      scale,
      rotationY,
      variant,
    })

    this.registerObstacle({
      x,
      z,
      radius: (variant === 2 ? 3.8 : variant === 1 ? 2.9 : 2.6) * scale,
    })
  }

  addRock(x: number, z: number): void {
    const scale = this.randomRange(0.55, 1.8)

    this.rockInstances.push({
      x,
      y: this.terrain.height(x, z) + 0.08,
      z,
      scale,
      rotationY: this.randomRange(0, Math.PI * 2),
    })

    this.registerObstacle({
      x,
      z,
      radius: 0.55 * scale,
    })
  }

  addGroundPatch(x: number, z: number, variant: number): void {
    this.groundPatchInstances.push({
      x,
      y: this.terrain.height(x, z) + 0.055,
      z,
      scaleX: this.randomRange(5, 15),
      scaleZ: this.randomRange(3, 9),
      rotationY: this.randomRange(0, Math.PI * 2),
      variant,
    })
  }

  getNearbyObstacles(x: number, z: number, radius: number): ObstacleCollider[] {
    return this.obstacleIndex.queryRadius(x, z, radius)
  }

  getGroundSurfaceAt(x: number, z: number): GroundSurfaceKind | null {
    for (const patch of this.groundPatchInstances) {
      const dx = x - patch.x
      const dz = z - patch.z
      const cos = Math.cos(-patch.rotationY)
      const sin = Math.sin(-patch.rotationY)
      const localX = dx * cos - dz * sin
      const localZ = dx * sin + dz * cos
      const normalized =
        (localX * localX) / (patch.scaleX * patch.scaleX) +
        (localZ * localZ) / (patch.scaleZ * patch.scaleZ)

      if (normalized <= 1) {
        return patch.variant === 0 ? 'sand' : 'dirt'
      }
    }

    return null
  }

  private registerObstacle(obstacle: ObstacleCollider): void {
    this.obstacleColliders.push(obstacle)
    this.obstacleIndex.insert(obstacle)
  }

  private populate(): void {
    const centerPos = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const sideNormal = new THREE.Vector3()

    this.registerGuardrailColliders()

    const treeTargetCount = 84
    let treeAttempts = 0

    while (this.treeInstances.length < treeTargetCount && treeAttempts < 400) {
      treeAttempts += 1
      const phase = Math.random()
      const angle = phase * Math.PI * 2
      if (this.road.isNearStartSector(angle, 0.24)) continue

      this.road.sampleCenterlineByDistance(phase * this.road.totalLength, centerPos, tangent)
      sideNormal.set(-tangent.z, 0, tangent.x).normalize()

      const side = Math.random() > 0.3 ? 1 : -1
      const offset =
        this.road.getOuterHalfWidthAtDistance(phase * this.road.totalLength) +
        this.randomRange(12, 72)
      const x = centerPos.x + sideNormal.x * offset * side
      const z = centerPos.z + sideNormal.z * offset * side

      if (!this.canPlaceAt(x, z, this.road.shoulderWidth + 4)) continue
      this.addTree(x, z)
    }

    const houseClusterCount = 10
    for (let i = 0; i < houseClusterCount; i++) {
      const phase = i / houseClusterCount + this.randomRange(-0.025, 0.025)
      const angle = THREE.MathUtils.euclideanModulo(phase, 1) * Math.PI * 2
      if (this.road.isNearStartSector(angle, 0.28)) continue

      this.road.sampleCenterlineByDistance(
        THREE.MathUtils.euclideanModulo(phase, 1) * this.road.totalLength,
        centerPos,
        tangent
      )
      sideNormal.set(-tangent.z, 0, tangent.x).normalize()
      const clusterSide = i % 2 === 0 ? 1 : -1

      const clusterCenterX =
        centerPos.x +
        sideNormal.x *
          clusterSide *
          (this.road.getOuterHalfWidthAtDistance(
            THREE.MathUtils.euclideanModulo(phase, 1) * this.road.totalLength
          ) +
            this.randomRange(26, 42))
      const clusterCenterZ =
        centerPos.z +
        sideNormal.z *
          clusterSide *
          (this.road.getOuterHalfWidthAtDistance(
            THREE.MathUtils.euclideanModulo(phase, 1) * this.road.totalLength
          ) +
            this.randomRange(26, 42))
      const houseCount = THREE.MathUtils.randInt(2, 4)
      const tangentAngle = Math.atan2(tangent.x, tangent.z)

      for (let j = 0; j < houseCount; j++) {
        const lateralAngle = tangentAngle + Math.PI * 0.5
        const lateralOffset = this.randomRange(-11, 11)
        const radialPush = this.randomRange(0, 10)
        const x =
          clusterCenterX +
          Math.sin(lateralAngle) * lateralOffset +
          sideNormal.x * clusterSide * radialPush
        const z =
          clusterCenterZ +
          Math.cos(lateralAngle) * lateralOffset +
          sideNormal.z * clusterSide * radialPush

        if (!this.canPlaceAt(x, z, this.road.shoulderWidth + 8)) continue

        const rotationY =
          Math.atan2(-sideNormal.x * clusterSide, -sideNormal.z * clusterSide) +
          this.randomRange(-0.4, 0.4)
        this.addHouse(x, z, rotationY, this.randomRange(0.82, 1.28))
      }
    }

    const patchTargetCount = 34
    let patchAttempts = 0

    while (this.groundPatchInstances.length < patchTargetCount && patchAttempts < 260) {
      patchAttempts += 1
      const phase = Math.random()
      this.road.sampleCenterlineByDistance(phase * this.road.totalLength, centerPos, tangent)
      sideNormal.set(-tangent.z, 0, tangent.x).normalize()

      const side = Math.random() > 0.5 ? 1 : -1
      const offset =
        this.road.getOuterHalfWidthAtDistance(phase * this.road.totalLength) +
        this.randomRange(15, 85)
      const x = centerPos.x + sideNormal.x * offset * side + this.randomRange(-10, 10)
      const z = centerPos.z + sideNormal.z * offset * side + this.randomRange(-10, 10)

      if (!this.canPlaceAt(x, z, this.road.shoulderWidth + 9)) continue
      this.addGroundPatch(x, z, Math.random() > 0.32 ? 0 : 1)
    }

    const rockTargetCount = 38
    let rockAttempts = 0

    while (this.rockInstances.length < rockTargetCount && rockAttempts < 320) {
      rockAttempts += 1
      const phase = Math.random()
      this.road.sampleCenterlineByDistance(phase * this.road.totalLength, centerPos, tangent)
      sideNormal.set(-tangent.z, 0, tangent.x).normalize()

      const side = Math.random() > 0.5 ? 1 : -1
      const offset =
        this.road.getOuterHalfWidthAtDistance(phase * this.road.totalLength) +
        this.randomRange(18, 90)
      const x = centerPos.x + sideNormal.x * offset * side + this.randomRange(-14, 14)
      const z = centerPos.z + sideNormal.z * offset * side + this.randomRange(-14, 14)

      if (!this.canPlaceAt(x, z, this.road.shoulderWidth + 5)) continue
      this.addRock(x, z)
    }
  }

  private registerGuardrailColliders(): void {
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const sideNormal = new THREE.Vector3()
    const spacing = 3.5
    const count = Math.max(60, Math.floor(this.road.totalLength / spacing))

    for (let i = 0; i < count; i++) {
      const distance = (i / count) * this.road.totalLength

      if (this.road.getEffectiveLaneCountAtDistance(distance) < 4) continue

      this.road.sampleCenterlineByDistance(distance, center, tangent)
      sideNormal.set(-tangent.z, 0, tangent.x).normalize()

      for (const sideSign of [-1, 1]) {
        const offset = sideSign * (this.road.getOuterHalfWidthAtDistance(distance) + 1.25)

        this.registerObstacle({
          x: center.x + sideNormal.x * offset,
          z: center.z + sideNormal.z * offset,
          radius: 2.1,
        })
      }
    }
  }

  private buildInstancedMeshes(): void {
    this.buildGroundPatchMeshes()
    this.buildTreeMeshes()
    this.buildHouseMeshes()
    this.buildRockMeshes()
  }

  private buildTreeMeshes(): void {
    const barkTextures = loadRepeatingPbrTextures('/textures/bark', 'Bark012_1K-JPG', 1.3, 3.4)
    const foliageTextures = loadRepeatingPbrTextures(
      '/textures/foliage',
      'PineNeedles001_1K-JPG',
      2.4,
      2.4
    )
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b6a48,
      map: barkTextures.map,
      normalMap: barkTextures.normalMap,
      roughnessMap: barkTextures.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.42, 0.42),
    })
    const roundCrownMaterial = new THREE.MeshStandardMaterial({
      color: 0x7ea45e,
      map: foliageTextures.map,
      normalMap: foliageTextures.normalMap,
      roughnessMap: foliageTextures.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.3, 0.3),
    })
    const pineCrownMaterial = new THREE.MeshStandardMaterial({
      color: 0x517044,
      map: foliageTextures.map,
      normalMap: foliageTextures.normalMap,
      roughnessMap: foliageTextures.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.32, 0.32),
    })
    const clusterCrownMaterial = new THREE.MeshStandardMaterial({
      color: 0x86a765,
      map: foliageTextures.map,
      normalMap: foliageTextures.normalMap,
      roughnessMap: foliageTextures.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.28, 0.28),
    })

    const roundTrees = this.treeInstances.filter((tree) => tree.variant === 0)
    const pineTrees = this.treeInstances.filter((tree) => tree.variant === 1)
    const clusterTrees = this.treeInstances.filter((tree) => tree.variant === 2)
    const tallPines = this.treeInstances.filter((tree) => tree.variant === 3)

    this.addInstancedPart(
      new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8),
      trunkMaterial,
      roundTrees,
      [0, 1.1, 0]
    )
    this.addInstancedPart(
      new THREE.SphereGeometry(1.4, 10, 10),
      roundCrownMaterial,
      roundTrees,
      [0, 2.7, 0]
    )

    this.addInstancedPart(
      new THREE.CylinderGeometry(0.18, 0.28, 2.6, 8),
      trunkMaterial,
      pineTrees,
      [0, 1.3, 0]
    )
    for (let i = 0; i < 3; i++) {
      this.addInstancedPart(
        new THREE.ConeGeometry(1.35 - i * 0.2, 1.8, 8),
        pineCrownMaterial,
        pineTrees,
        [0, 2 + i * 0.75, 0]
      )
    }

    this.addInstancedPart(
      new THREE.CylinderGeometry(0.22, 0.34, 4.1, 8),
      trunkMaterial,
      tallPines,
      [0, 2.05, 0]
    )
    for (let i = 0; i < 4; i++) {
      this.addInstancedPart(
        new THREE.ConeGeometry(1.65 - i * 0.24, 2.15, 9),
        pineCrownMaterial,
        tallPines,
        [0, 3.05 + i * 0.82, 0]
      )
    }

    this.addInstancedPart(
      new THREE.CylinderGeometry(0.22, 0.32, 2.4, 8),
      trunkMaterial,
      clusterTrees,
      [0, 1.2, 0]
    )
    this.addInstancedPart(
      new THREE.SphereGeometry(1.08, 9, 9),
      clusterCrownMaterial,
      clusterTrees,
      [0, 2.6, 0]
    )
    this.addInstancedPart(
      new THREE.SphereGeometry(1.0, 9, 9),
      clusterCrownMaterial,
      clusterTrees,
      [0.9, 2.3, 0.25]
    )
    this.addInstancedPart(
      new THREE.SphereGeometry(1.0, 9, 9),
      clusterCrownMaterial,
      clusterTrees,
      [-0.75, 2.15, -0.2]
    )
  }

  private buildHouseMeshes(): void {
    const wallTextures = loadRepeatingPbrTextures('/textures/walls', 'Bricks084_1K-JPG', 2.2, 1.4)
    const roofTextures = loadRepeatingPbrTextures(
      '/textures/roof',
      'RoofingTiles011A_1K-JPG',
      1.8,
      1.8
    )
    const barkTextures = loadRepeatingPbrTextures('/textures/bark', 'Bark012_1K-JPG', 1, 1.8)
    const wallMaterials = [0xd9c9ae, 0xd4d7c5, 0xe2d0bb].map((color) => new THREE.MeshStandardMaterial({
      color,
      map: wallTextures.map,
      normalMap: wallTextures.normalMap,
      roughnessMap: wallTextures.roughnessMap,
      roughness: 0.95,
      normalScale: new THREE.Vector2(0.25, 0.25),
    }))
    const roofMaterials = [0x9b4f39, 0x74513f, 0x855f49].map((color) => new THREE.MeshStandardMaterial({
      color,
      map: roofTextures.map,
      normalMap: roofTextures.normalMap,
      roughnessMap: roofTextures.roughnessMap,
      roughness: 0.92,
      normalScale: new THREE.Vector2(0.36, 0.36),
    }))
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x76543b,
      map: barkTextures.map,
      normalMap: barkTextures.normalMap,
      roughnessMap: barkTextures.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.3, 0.3),
    })
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0xb7d8ee,
      roughness: 0.2,
      metalness: 0.05,
    })

    const cottageHouses = this.houseInstances.filter((house) => house.variant === 0)
    const tallHouses = this.houseInstances.filter((house) => house.variant === 1)
    const barnHouses = this.houseInstances.filter((house) => house.variant === 2)

    this.addInstancedPart(
      new THREE.BoxGeometry(4.6, 2.8, 3.8),
      wallMaterials[0],
      cottageHouses,
      [0, 1.4, 0]
    )
    this.addInstancedPart(
      new THREE.CylinderGeometry(0, 3.6, 2.2, 4),
      roofMaterials[0],
      cottageHouses,
      [0, 3.35, 0],
      Math.PI * 0.25
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.8, 1.5, 0.12),
      doorMaterial,
      cottageHouses,
      [0, 0.75, 1.96]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.72, 0.62, 0.08),
      windowMaterial,
      cottageHouses,
      [-1.15, 1.55, 1.97]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.72, 0.62, 0.08),
      windowMaterial,
      cottageHouses,
      [1.15, 1.55, 1.97]
    )

    this.addInstancedPart(
      new THREE.BoxGeometry(3.6, 3.7, 3.3),
      wallMaterials[1],
      tallHouses,
      [0, 1.85, 0]
    )
    this.addInstancedPart(
      new THREE.CylinderGeometry(0, 3, 2.8, 4),
      roofMaterials[1],
      tallHouses,
      [0, 4.1, 0],
      Math.PI * 0.25
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.8, 1.55, 0.12),
      doorMaterial,
      tallHouses,
      [0, 0.78, 1.71]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.6, 0.62, 0.08),
      windowMaterial,
      tallHouses,
      [-0.9, 1.65, 1.72]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.6, 0.62, 0.08),
      windowMaterial,
      tallHouses,
      [0.9, 2.65, 1.72]
    )

    this.addInstancedPart(
      new THREE.BoxGeometry(6.3, 2.45, 3.6),
      wallMaterials[2],
      barnHouses,
      [0, 1.22, 0]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(6.8, 0.55, 4.2),
      roofMaterials[2],
      barnHouses,
      [0, 2.75, 0],
      Math.PI * 0.02
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(1.25, 1.55, 0.12),
      doorMaterial,
      barnHouses,
      [0, 0.78, 1.86]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.78, 0.58, 0.08),
      windowMaterial,
      barnHouses,
      [-2.1, 1.45, 1.87]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.78, 0.58, 0.08),
      windowMaterial,
      barnHouses,
      [2.1, 1.45, 1.87]
    )
  }

  private buildRockMeshes(): void {
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x77776e,
      roughness: 0.95,
      metalness: 0.02,
      flatShading: true,
    })

    this.addInstancedPart(
      new THREE.DodecahedronGeometry(0.8, 0),
      rockMaterial,
      this.rockInstances,
      [0, 0.28, 0]
    )
  }

  private buildGroundPatchMeshes(): void {
    const sandPatches = this.groundPatchInstances.filter((patch) => patch.variant === 0)
    const dirtPatches = this.groundPatchInstances.filter((patch) => patch.variant === 1)
    const patchGeometry = new THREE.CircleGeometry(1, 28)
    patchGeometry.rotateX(-Math.PI / 2)

    this.addGroundPatchInstancedMesh(
      patchGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xc8b985,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
      sandPatches
    )
    this.addGroundPatchInstancedMesh(
      patchGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x8f7c5e,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
      dirtPatches
    )
  }

  private addInstancedPart(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    instances: ScenicInstance[],
    localOffset: [number, number, number],
    localRotationY = 0
  ): void {
    if (instances.length === 0) return

    const chunkSize = 90
    const chunks = new Map<string, ScenicInstance[]>()

    for (const instance of instances) {
      const cellX = Math.floor(instance.x / chunkSize)
      const cellZ = Math.floor(instance.z / chunkSize)
      const key = `${cellX}:${cellZ}`
      const chunk = chunks.get(key)

      if (chunk) chunk.push(instance)
      else chunks.set(key, [instance])
    }

    chunks.forEach((chunkInstances) => {
      const mesh = new THREE.InstancedMesh(geometry, material, chunkInstances.length)
      const center = new THREE.Vector3()

      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.frustumCulled = true

      chunkInstances.forEach((instance, index) => {
        center.x += instance.x
        center.y += instance.y
        center.z += instance.z

        this.composeRootMatrix(instance)
        this.tmpLocalQuat.setFromAxisAngle(this.yAxis, localRotationY)
        this.tmpLocalMatrix.compose(
          this.tmpPosition.set(localOffset[0], localOffset[1], localOffset[2]),
          this.tmpLocalQuat,
          this.tmpScale.set(1, 1, 1)
        )
        this.tmpFinalMatrix.multiplyMatrices(this.tmpMatrix, this.tmpLocalMatrix)
        mesh.setMatrixAt(index, this.tmpFinalMatrix)
      })

      center.multiplyScalar(1 / chunkInstances.length)
      mesh.userData.center = center
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      this.group.add(mesh)
    })
  }

  private addGroundPatchInstancedMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    instances: GroundPatchInstance[]
  ): void {
    if (instances.length === 0) return

    const mesh = new THREE.InstancedMesh(geometry, material, instances.length)
    const center = new THREE.Vector3()

    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.frustumCulled = true

    instances.forEach((instance, index) => {
      center.x += instance.x
      center.y += instance.y
      center.z += instance.z

      this.tmpQuat.setFromAxisAngle(this.yAxis, instance.rotationY)
      this.tmpMatrix.compose(
        this.tmpPosition.set(instance.x, instance.y, instance.z),
        this.tmpQuat,
        this.tmpScale.set(instance.scaleX, 1, instance.scaleZ)
      )
      mesh.setMatrixAt(index, this.tmpMatrix)
    })

    center.multiplyScalar(1 / instances.length)
    mesh.userData.center = center
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    this.group.add(mesh)
  }

  private composeRootMatrix(instance: ScenicInstance): void {
    this.tmpQuat.setFromAxisAngle(this.yAxis, instance.rotationY)
    this.tmpMatrix.compose(
      this.tmpPosition.set(instance.x, instance.y, instance.z),
      this.tmpQuat,
      this.tmpScale.set(instance.scale, instance.scale, instance.scale)
    )
  }

  updateVisibility(carPosition: THREE.Vector3): void {
    const maxDistanceSq = qualitySettings.decorationDrawDistance * qualitySettings.decorationDrawDistance

    this.group.children.forEach((child) => {
      const center = child.userData.center as THREE.Vector3 | undefined
      child.visible = !center || center.distanceToSquared(carPosition) <= maxDistanceSq
    })
  }
}
