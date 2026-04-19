import * as THREE from 'three'
import { loadRepeatingPbrTextures } from './TextureFactory'

export class HouseFactory {
  private readonly wallMaterials = this.createWallMaterials()
  private readonly roofMaterials = this.createRoofMaterials()
  private readonly doorMaterial = this.createDoorMaterial()

  create(scale = 1, rotationY = 0): THREE.Group {
    const house = new THREE.Group()
    house.rotation.y = rotationY
    house.scale.setScalar(scale)

    const wallMaterial = this.wallMaterials[
      THREE.MathUtils.randInt(0, this.wallMaterials.length - 1)
    ]
    const roofMaterial = this.roofMaterials[
      THREE.MathUtils.randInt(0, this.roofMaterials.length - 1)
    ]

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 2.8, 3.8),
      wallMaterial
    )
    body.position.y = 1.4
    body.castShadow = true
    body.receiveShadow = true

    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(0, 3.6, 2.2, 4),
      roofMaterial
    )
    roof.position.y = 3.35
    roof.rotation.y = Math.PI * 0.25
    roof.castShadow = true
    roof.receiveShadow = true

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.5, 0.12),
      this.doorMaterial
    )
    door.position.set(0, 0.75, 1.96)

    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0xb7d8ee,
      roughness: 0.2,
      metalness: 0.05,
    })

    const windowOffsets = [
      [-1.15, 1.55, 1.97],
      [1.15, 1.55, 1.97],
    ]

    house.add(body, roof, door)

    for (const [wx, wy, wz] of windowOffsets) {
      const windowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.62, 0.08),
        windowMaterial
      )
      windowMesh.position.set(wx, wy, wz)
      house.add(windowMesh)
    }

    return house
  }

  private createWallMaterials(): THREE.MeshStandardMaterial[] {
    const textures = loadRepeatingPbrTextures('/textures/walls', 'Bricks084_1K-JPG', 2.2, 1.4)
    const colors = [0xd9c9ae, 0xd4d7c5, 0xe2d0bb]

    return colors.map((color) =>
      new THREE.MeshStandardMaterial({
        color,
        map: textures.map,
        normalMap: textures.normalMap,
        roughnessMap: textures.roughnessMap,
        roughness: 0.95,
        normalScale: new THREE.Vector2(0.25, 0.25),
      })
    )
  }

  private createRoofMaterials(): THREE.MeshStandardMaterial[] {
    const textures = loadRepeatingPbrTextures(
      '/textures/roof',
      'RoofingTiles011A_1K-JPG',
      1.8,
      1.8
    )
    const colors = [0x9b4f39, 0x74513f, 0x855f49]

    return colors.map((color) =>
      new THREE.MeshStandardMaterial({
        color,
        map: textures.map,
        normalMap: textures.normalMap,
        roughnessMap: textures.roughnessMap,
        roughness: 0.92,
        normalScale: new THREE.Vector2(0.36, 0.36),
      })
    )
  }

  private createDoorMaterial(): THREE.MeshStandardMaterial {
    const textures = loadRepeatingPbrTextures('/textures/bark', 'Bark012_1K-JPG', 1, 1.8)

    return new THREE.MeshStandardMaterial({
      color: 0x76543b,
      map: textures.map,
      normalMap: textures.normalMap,
      roughnessMap: textures.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.3, 0.3),
    })
  }
}
