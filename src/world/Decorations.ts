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
}

export class Decorations {
  readonly obstacleColliders: ObstacleCollider[] = []
  readonly obstacleIndex = new SpatialHashGrid<ObstacleCollider>(28)
  readonly group: THREE.Group

  private readonly treeInstances: TreeInstance[] = []
  private readonly houseInstances: HouseInstance[] = []
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
    const scale = this.randomRange(0.85, 1.35)
    const variant = THREE.MathUtils.randInt(0, 2)

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
      radius: 0.8 * scale,
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
    this.houseInstances.push({
      x,
      y: this.terrain.height(x, z),
      z,
      scale,
      rotationY,
    })

    this.registerObstacle({
      x,
      z,
      radius: 2.6 * scale,
    })
  }

  getNearbyObstacles(x: number, z: number, radius: number): ObstacleCollider[] {
    return this.obstacleIndex.queryRadius(x, z, radius)
  }

  private registerObstacle(obstacle: ObstacleCollider): void {
    this.obstacleColliders.push(obstacle)
    this.obstacleIndex.insert(obstacle)
  }

  private populate(): void {
    const centerPos = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const outside = new THREE.Vector3()

    const treeTargetCount = 56
    let treeAttempts = 0

    while (this.treeInstances.length < treeTargetCount && treeAttempts < 400) {
      treeAttempts += 1
      const phase = Math.random()
      const angle = phase * Math.PI * 2
      if (this.road.isNearStartSector(angle, 0.24)) continue

      this.road.sampleCenterlineByDistance(phase * this.road.totalLength, centerPos, tangent)
      outside.set(centerPos.x, 0, centerPos.z).normalize()

      const side = Math.random() > 0.3 ? 1 : -1
      const offset = this.road.outerHalfWidth + this.randomRange(10, 48)
      const x = centerPos.x + outside.x * offset * side
      const z = centerPos.z + outside.z * offset * side

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
      outside.set(centerPos.x, 0, centerPos.z).normalize()

      const clusterCenterX =
        centerPos.x + outside.x * (this.road.outerHalfWidth + this.randomRange(26, 42))
      const clusterCenterZ =
        centerPos.z + outside.z * (this.road.outerHalfWidth + this.randomRange(26, 42))
      const houseCount = THREE.MathUtils.randInt(2, 4)
      const tangentAngle = Math.atan2(tangent.x, tangent.z)

      for (let j = 0; j < houseCount; j++) {
        const lateralAngle = tangentAngle + Math.PI * 0.5
        const lateralOffset = this.randomRange(-11, 11)
        const radialPush = this.randomRange(0, 10)
        const x =
          clusterCenterX +
          Math.sin(lateralAngle) * lateralOffset +
          outside.x * radialPush
        const z =
          clusterCenterZ +
          Math.cos(lateralAngle) * lateralOffset +
          outside.z * radialPush

        if (!this.canPlaceAt(x, z, this.road.shoulderWidth + 8)) continue

        const rotationY = Math.atan2(-outside.x, -outside.z) + this.randomRange(-0.4, 0.4)
        this.addHouse(x, z, rotationY, this.randomRange(0.9, 1.2))
      }
    }
  }

  private buildInstancedMeshes(): void {
    this.buildTreeMeshes()
    this.buildHouseMeshes()
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
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9c9ae,
      map: wallTextures.map,
      normalMap: wallTextures.normalMap,
      roughnessMap: wallTextures.roughnessMap,
      roughness: 0.95,
      normalScale: new THREE.Vector2(0.25, 0.25),
    })
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x9b4f39,
      map: roofTextures.map,
      normalMap: roofTextures.normalMap,
      roughnessMap: roofTextures.roughnessMap,
      roughness: 0.92,
      normalScale: new THREE.Vector2(0.36, 0.36),
    })
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

    this.addInstancedPart(
      new THREE.BoxGeometry(4.6, 2.8, 3.8),
      wallMaterial,
      this.houseInstances,
      [0, 1.4, 0]
    )
    this.addInstancedPart(
      new THREE.CylinderGeometry(0, 3.6, 2.2, 4),
      roofMaterial,
      this.houseInstances,
      [0, 3.35, 0],
      Math.PI * 0.25
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.8, 1.5, 0.12),
      doorMaterial,
      this.houseInstances,
      [0, 0.75, 1.96]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.72, 0.62, 0.08),
      windowMaterial,
      this.houseInstances,
      [-1.15, 1.55, 1.97]
    )
    this.addInstancedPart(
      new THREE.BoxGeometry(0.72, 0.62, 0.08),
      windowMaterial,
      this.houseInstances,
      [1.15, 1.55, 1.97]
    )
  }

  private addInstancedPart(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    instances: Array<TreeInstance | HouseInstance>,
    localOffset: [number, number, number],
    localRotationY = 0
  ): void {
    if (instances.length === 0) return

    const chunkSize = 90
    const chunks = new Map<string, Array<TreeInstance | HouseInstance>>()

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

  private composeRootMatrix(instance: TreeInstance | HouseInstance): void {
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
