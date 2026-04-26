import * as THREE from 'three'
import type { TerrainProfile } from '../domain/environment/TerrainProfile'
import type { Road } from './Road'

const BACKDROP_BASE_Y = -520
const WALL_SEGMENTS = 160

type WallAxis = 'x' | 'z'

export class MountainBackdrop {
  private readonly group = new THREE.Group()

  constructor(
    scene: THREE.Scene,
    road: Road,
    terrainProfile: TerrainProfile
  ) {
    if (terrainProfile.kind !== 'mountains') return

    const bounds = road.getPlayableBounds(80)
    const centerX = (bounds.minX + bounds.maxX) * 0.5
    const centerZ = (bounds.minZ + bounds.maxZ) * 0.5
    const spanX = bounds.maxX - bounds.minX
    const spanZ = bounds.maxZ - bounds.minZ
    const offsetX = spanX * 0.5 + 1180
    const offsetZ = spanZ * 0.5 + 1180

    this.group.name = 'MountainBackdrop'
    this.group.add(this.createWall('x', centerX, centerZ - offsetZ, spanX + 1800, 0.15, false))
    this.group.add(this.createWall('x', centerX, centerZ + offsetZ, spanX + 1800, 0.65, true))
    this.group.add(this.createWall('z', centerX - offsetX, centerZ, spanZ + 1800, 1.15, true))
    this.group.add(this.createWall('z', centerX + offsetX, centerZ, spanZ + 1800, 1.75, false))
    scene.add(this.group)
  }

  update(): void {}

  private createWall(
    axis: WallAxis,
    centerX: number,
    centerZ: number,
    length: number,
    seed: number,
    flipWinding: boolean
  ): THREE.Mesh {
    const positions: number[] = []
    const indices: number[] = []
    const heights = this.buildHeights(seed)

    for (let i = 0; i <= WALL_SEGMENTS; i++) {
      const t = i / WALL_SEGMENTS
      const offset = (t - 0.5) * length
      const height = heights[i]
      const x = axis === 'x' ? centerX + offset : centerX
      const z = axis === 'z' ? centerZ + offset : centerZ

      positions.push(
        x, BACKDROP_BASE_Y, z,
        x, height, z
      )
    }

    for (let i = 0; i < WALL_SEGMENTS; i++) {
      const base = i * 2
      const nextBase = (i + 1) * 2

      if (flipWinding) {
        indices.push(
          base, base + 1, nextBase,
          base + 1, nextBase + 1, nextBase
        )
      } else {
        indices.push(
          base, nextBase, base + 1,
          base + 1, nextBase, nextBase + 1
        )
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    const material = new THREE.MeshBasicMaterial({
      color: 0x6a645d,
      side: THREE.FrontSide,
      fog: true,
      depthWrite: true,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.frustumCulled = false
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.renderOrder = -40
    return mesh
  }

  private buildHeights(seed: number): number[] {
    const heights: number[] = []

    for (let i = 0; i <= WALL_SEGMENTS; i++) {
      const t = i / WALL_SEGMENTS
      const wave =
        Math.sin((t + seed) * Math.PI * 1.15) * 0.48 +
        Math.sin((t + seed * 0.7) * Math.PI * 2.2) * 0.22 +
        Math.cos((t + seed * 0.4) * Math.PI * 3.4) * 0.1
      heights.push(420 + Math.max(wave, -0.1) * 220)
    }

    for (let pass = 0; pass < 14; pass++) {
      const smoothed = heights.slice()

      for (let i = 0; i < heights.length; i++) {
        const prev = heights[Math.max(0, i - 1)]
        const current = heights[i]
        const next = heights[Math.min(heights.length - 1, i + 1)]
        smoothed[i] = prev * 0.26 + current * 0.48 + next * 0.26
      }

      for (let i = 0; i < heights.length; i++) {
        heights[i] = smoothed[i]
      }
    }

    return heights
  }
}
