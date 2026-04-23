import * as THREE from 'three'
import type { TerrainProfile } from '../domain/environment/TerrainProfile'
import { loadRepeatingPbrTextures } from '../infrastructure/graphics/TextureFactory'
import type { Road } from './Road'
import type { Terrain } from './Terrain'

interface RockInstance {
  x: number
  y: number
  z: number
  rotationY: number
  scaleX: number
  scaleY: number
  scaleZ: number
  variant: number
}

export class RockFeatures {
  private readonly group = new THREE.Group()
  private readonly instances: RockInstance[] = []
  private readonly tmpMatrix = new THREE.Matrix4()
  private readonly tmpPosition = new THREE.Vector3()
  private readonly tmpQuaternion = new THREE.Quaternion()
  private readonly tmpScale = new THREE.Vector3()
  private readonly yAxis = new THREE.Vector3(0, 1, 0)

  constructor(
    scene: THREE.Scene,
    private readonly terrain: Terrain,
    private readonly road: Road,
    private readonly terrainProfile: TerrainProfile
  ) {
    this.group.name = 'RockFeatures'
    scene.add(this.group)
    this.populate()
    this.buildMeshes()
  }

  private populate(): void {
    const clusterCount = this.terrainProfile.kind === 'mountains'
      ? 42
      : this.terrainProfile.kind === 'hills'
        ? 24
        : 8
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()

    for (let i = 0; i < clusterCount; i++) {
      const distance = ((i + this.pseudoRandom(i + 3.1) * 0.72) / clusterCount) *
        this.road.totalLength

      if (this.road.isNearStartSector((distance / this.road.totalLength) * Math.PI * 2, 0.22)) {
        continue
      }

      this.road.sampleCenterlineByDistance(distance, center, tangent)
      side.set(-tangent.z, 0, tangent.x).normalize()

      const sideSign = this.pseudoRandom(i + 5.2) > 0.5 ? 1 : -1
      const baseOffset =
        this.road.getOuterHalfWidthAtDistance(distance) +
        THREE.MathUtils.lerp(
          this.terrainProfile.kind === 'plain' ? 62 : 38,
          this.terrainProfile.kind === 'mountains' ? 128 : 150,
          this.pseudoRandom(i + 7.4)
        )
      const rockCount = this.terrainProfile.kind === 'mountains'
        ? THREE.MathUtils.lerp(5, 10, this.pseudoRandom(i + 9.8))
        : THREE.MathUtils.lerp(2, 5, this.pseudoRandom(i + 9.8))

      for (let j = 0; j < Math.floor(rockCount); j++) {
        const along = THREE.MathUtils.lerp(-18, 18, this.pseudoRandom(i * 13.7 + j))
        const spread = THREE.MathUtils.lerp(-16, 20, this.pseudoRandom(i * 17.3 + j))
        const x =
          center.x +
          tangent.x * along +
          side.x * sideSign * (baseOffset + spread)
        const z =
          center.z +
          tangent.z * along +
          side.z * sideSign * (baseOffset + spread)

        if (this.road.isPointOnRoad(x, z, this.road.shoulderWidth + 24)) continue

        this.addRockInstance(x, z, i, j)
      }

      if (
        this.terrainProfile.kind !== 'plain' &&
        this.pseudoRandom(i + 19.6) > (this.terrainProfile.kind === 'mountains' ? 0.42 : 0.72)
      ) {
        this.addCliffWall(center, tangent, side, sideSign, baseOffset, i)
      }
    }
  }

  private addCliffWall(
    center: THREE.Vector3,
    tangent: THREE.Vector3,
    side: THREE.Vector3,
    sideSign: number,
    baseOffset: number,
    clusterIndex: number
  ): void {
    const wallRocks = this.terrainProfile.kind === 'mountains'
      ? THREE.MathUtils.randInt(4, 7)
      : THREE.MathUtils.randInt(2, 4)

    for (let i = 0; i < wallRocks; i++) {
      const seed = clusterIndex * 47.5 + i * 9.1
      const along = THREE.MathUtils.lerp(-46, 46, this.pseudoRandom(seed + 1.7))
      const sideJitter = THREE.MathUtils.lerp(-10, 24, this.pseudoRandom(seed + 2.9))
      const x =
        center.x +
        tangent.x * along +
        side.x * sideSign * (baseOffset + sideJitter)
      const z =
        center.z +
        tangent.z * along +
        side.z * sideSign * (baseOffset + sideJitter)

      if (this.road.isPointOnRoad(x, z, this.road.shoulderWidth + 30)) continue

      const baseScale =
        THREE.MathUtils.lerp(5.5, 13.5, this.pseudoRandom(seed + 4.2)) *
        (this.terrainProfile.kind === 'mountains' ? 1.35 : 0.85)

      this.instances.push({
        x,
        y: this.terrain.height(x, z) - baseScale * 0.08,
        z,
        rotationY:
          Math.atan2(tangent.x, tangent.z) +
          THREE.MathUtils.lerp(-0.35, 0.35, this.pseudoRandom(seed + 5.1)),
        scaleX: baseScale * THREE.MathUtils.lerp(1.3, 2.6, this.pseudoRandom(seed + 6.4)),
        scaleY: baseScale * THREE.MathUtils.lerp(1.4, 2.8, this.pseudoRandom(seed + 7.2)),
        scaleZ: baseScale * THREE.MathUtils.lerp(0.58, 1.15, this.pseudoRandom(seed + 8.8)),
        variant: Math.floor(this.pseudoRandom(seed + 9.9) * 3),
      })
    }
  }

  private addRockInstance(x: number, z: number, clusterIndex: number, rockIndex: number): void {
    const seed = clusterIndex * 31.7 + rockIndex * 11.3
    const mountainScale = this.terrainProfile.kind === 'mountains' ? 1.8 : 1
    const baseScale =
      THREE.MathUtils.lerp(
        this.terrainProfile.kind === 'plain' ? 1.8 : 2.8,
        this.terrainProfile.kind === 'plain' ? 4.4 : 8.8,
        this.pseudoRandom(seed)
      ) * mountainScale
    const heightBoost = THREE.MathUtils.lerp(1.05, 2.25, this.pseudoRandom(seed + 2.2))

    this.instances.push({
      x,
      y: this.terrain.height(x, z) - 0.18,
      z,
      rotationY: this.pseudoRandom(seed + 1.1) * Math.PI * 2,
      scaleX: baseScale * THREE.MathUtils.lerp(0.7, 1.55, this.pseudoRandom(seed + 3.4)),
      scaleY: baseScale * heightBoost,
      scaleZ: baseScale * THREE.MathUtils.lerp(0.65, 1.45, this.pseudoRandom(seed + 5.8)),
      variant: Math.floor(this.pseudoRandom(seed + 7.9) * 3),
    })
  }

  private buildMeshes(): void {
    if (this.instances.length === 0) return

    const textures = loadRepeatingPbrTextures('/textures/sand', 'Ground054_1K-JPG', 1.8, 1.8)
    const material = new THREE.MeshStandardMaterial({
      color: this.terrainProfile.kind === 'mountains' ? 0x7e7b71 : 0x8a8678,
      map: textures.map,
      normalMap: textures.normalMap,
      roughnessMap: textures.roughnessMap,
      roughness: 0.98,
      metalness: 0.02,
      normalScale: new THREE.Vector2(0.55, 0.55),
      flatShading: true,
    })
    const geometries = [
      this.createJaggedRockGeometry(new THREE.DodecahedronGeometry(1, 0), 1.3),
      this.createJaggedRockGeometry(new THREE.IcosahedronGeometry(1, 1), 2.1),
      this.createJaggedRockGeometry(new THREE.ConeGeometry(0.92, 1.7, 7, 2), 3.4),
    ]

    for (let variant = 0; variant < geometries.length; variant++) {
      const variantInstances = this.instances.filter((rock) => rock.variant === variant)
      if (variantInstances.length === 0) continue

      const mesh = new THREE.InstancedMesh(
        geometries[variant],
        material,
        variantInstances.length
      )

      variantInstances.forEach((rock, index) => {
        this.tmpQuaternion.setFromAxisAngle(this.yAxis, rock.rotationY)
        this.tmpMatrix.compose(
          this.tmpPosition.set(rock.x, rock.y, rock.z),
          this.tmpQuaternion,
          this.tmpScale.set(rock.scaleX, rock.scaleY, rock.scaleZ)
        )
        mesh.setMatrixAt(index, this.tmpMatrix)
      })

      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      this.group.add(mesh)
    }
  }

  private createJaggedRockGeometry<T extends THREE.BufferGeometry>(
    geometry: T,
    seedOffset: number
  ): T {
    const position = geometry.getAttribute('position')
    const vertex = new THREE.Vector3()

    for (let i = 0; i < position.count; i++) {
      vertex.set(position.getX(i), position.getY(i), position.getZ(i))

      const noise = THREE.MathUtils.lerp(
        0.78,
        1.22,
        this.pseudoRandom(i * 1.37 + seedOffset)
      )
      vertex.multiplyScalar(noise)
      position.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }

    position.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    return geometry
  }

  private pseudoRandom(seed: number): number {
    return THREE.MathUtils.euclideanModulo(Math.sin(seed * 12.9898) * 43758.5453, 1)
  }
}
