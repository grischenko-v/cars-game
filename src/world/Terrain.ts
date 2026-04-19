import * as THREE from 'three'
import { qualitySettings } from '../application/config/QualitySettings'
import { loadRepeatingPbrTextures } from '../infrastructure/graphics/TextureFactory'
import { clamp } from '../utils/math'
import type { Road } from './Road'

export class Terrain {
  road: Road
  size = 1500
  segments = qualitySettings.terrainSegments
  geometry: THREE.PlaneGeometry
  material: THREE.MeshStandardMaterial
  mesh: THREE.Mesh

  constructor(scene: THREE.Scene, road: Road) {
    this.road = road

    this.geometry = new THREE.PlaneGeometry(
      this.size,
      this.size,
      this.segments,
      this.segments
    )
    this.geometry.rotateX(-Math.PI / 2)

    const terrainPos = this.geometry.attributes.position
    for (let i = 0; i < terrainPos.count; i++) {
      const x = terrainPos.getX(i)
      const z = terrainPos.getZ(i)
      terrainPos.setY(i, this.height(x, z))
    }
    this.geometry.computeVertexNormals()

    const grassTextures = loadRepeatingPbrTextures(
      '/textures/grass',
      'Grass001_1K-JPG',
      118,
      118
    )

    this.material = new THREE.MeshStandardMaterial({
      color: 0xb7c991,
      map: grassTextures.map,
      normalMap: grassTextures.normalMap,
      roughnessMap: grassTextures.roughnessMap,
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(0.55, 0.55),
      polygonOffset: true,
      polygonOffsetFactor: 6,
      polygonOffsetUnits: 6,
    })

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.receiveShadow = true
    this.mesh.renderOrder = -1
    scene.add(this.mesh)
  }

  rawHeight(x: number, z: number): number {
    return (
      Math.sin(x * 0.025) * 0.9 +
      Math.cos(z * 0.022) * 0.8 +
      Math.sin((x + z) * 0.015) * 0.6
    ) * 0.35
  }

  height(x: number, z: number): number {
    const roadBand = this.road.getBandData(x, z)
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
    const baseHeight = this.rawHeight(x, z) * calmFactor
    const roadBedHeight = this.road.roadY - this.road.cutDepth
    const shoulderBedHeight = this.road.apronY - this.road.cutDepth * 0.35
    const hardRoadLimit = roadBand.halfWidth + this.road.terrainHardMargin
    const shoulderLimit =
      hardRoadLimit + this.road.shoulderWidth + this.road.terrainShoulderMargin
    const apronLimit = shoulderLimit + this.road.apronWidth

    if (roadBand.distFromRoadCenter <= hardRoadLimit) {
      return roadBedHeight
    }

    if (roadBand.distFromRoadCenter <= shoulderLimit) {
      const t = clamp(
        (roadBand.distFromRoadCenter - hardRoadLimit) /
          (this.road.shoulderWidth + this.road.terrainShoulderMargin),
        0,
        1
      )
      const k = THREE.MathUtils.smoothstep(t, 0, 1)
      return THREE.MathUtils.lerp(roadBedHeight, shoulderBedHeight, k)
    }

    if (roadBand.distFromRoadCenter <= apronLimit) {
      return shoulderBedHeight - this.road.cutDepth * 0.08
    }

    if (roadBand.distFromRoadCenter <= apronLimit + this.road.terrainBlend) {
      const t = clamp(
        (roadBand.distFromRoadCenter - apronLimit) / this.road.terrainBlend,
        0,
        1
      )
      const k = THREE.MathUtils.smoothstep(t, 0, 1)
      return THREE.MathUtils.lerp(shoulderBedHeight, baseHeight, k)
    }

    return baseHeight
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
}
