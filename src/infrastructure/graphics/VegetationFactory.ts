import * as THREE from 'three'
import { loadRepeatingPbrTextures } from './TextureFactory'

export class VegetationFactory {
  private readonly barkMaterial = this.createBarkMaterial()
  private readonly foliageMaterial = this.createFoliageMaterial()

  constructor(private readonly randomRange: (min: number, max: number) => number) {}

  createRoundTree(scale: number): THREE.Group {
    const tree = new THREE.Group()
    tree.scale.setScalar(scale)

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8),
      this.barkMaterial
    )
    trunk.position.y = 1.1
    trunk.castShadow = true
    trunk.receiveShadow = true

    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 10),
      this.createFoliageVariant()
    )
    crown.position.y = 2.7
    crown.castShadow = true
    crown.receiveShadow = true

    tree.add(trunk, crown)
    tree.rotation.y = this.randomRange(0, Math.PI * 2)
    return tree
  }

  createPineTree(scale: number): THREE.Group {
    const tree = new THREE.Group()
    tree.scale.setScalar(scale)

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 2.6, 8),
      this.barkMaterial
    )
    trunk.position.y = 1.3
    trunk.castShadow = true
    trunk.receiveShadow = true
    tree.add(trunk)

    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.35 - i * 0.2, 1.8, 8),
        this.createFoliageVariant(0.82)
      )
      crown.position.y = 2 + i * 0.75
      crown.castShadow = true
      crown.receiveShadow = true
      tree.add(crown)
    }

    tree.rotation.y = this.randomRange(0, Math.PI * 2)
    return tree
  }

  createClusterTree(scale: number): THREE.Group {
    const tree = new THREE.Group()
    tree.scale.setScalar(scale)

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 2.4, 8),
      this.barkMaterial
    )
    trunk.position.y = 1.2
    trunk.castShadow = true
    trunk.receiveShadow = true
    tree.add(trunk)

    const offsets = [
      [0, 2.6, 0],
      [0.9, 2.3, 0.25],
      [-0.75, 2.15, -0.2],
    ]

    for (const [ox, oy, oz] of offsets) {
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(this.randomRange(0.95, 1.2), 9, 9),
        this.createFoliageVariant()
      )
      crown.position.set(ox, oy, oz)
      crown.castShadow = true
      crown.receiveShadow = true
      tree.add(crown)
    }

    tree.rotation.y = this.randomRange(0, Math.PI * 2)
    return tree
  }

  private createBarkMaterial(): THREE.MeshStandardMaterial {
    const textures = loadRepeatingPbrTextures('/textures/bark', 'Bark012_1K-JPG', 1.4, 3.2)

    return new THREE.MeshStandardMaterial({
      color: 0x8b6a48,
      map: textures.map,
      normalMap: textures.normalMap,
      roughnessMap: textures.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.42, 0.42),
    })
  }

  private createFoliageMaterial(): THREE.MeshStandardMaterial {
    const textures = loadRepeatingPbrTextures(
      '/textures/foliage',
      'PineNeedles001_1K-JPG',
      2.4,
      2.4
    )

    return new THREE.MeshStandardMaterial({
      color: 0x7ea45f,
      map: textures.map,
      normalMap: textures.normalMap,
      roughnessMap: textures.roughnessMap,
      roughness: 1,
      normalScale: new THREE.Vector2(0.28, 0.28),
    })
  }

  private createFoliageVariant(lightnessMultiplier = 1): THREE.MeshStandardMaterial {
    const material = this.foliageMaterial.clone()
    material.color = new THREE.Color().setHSL(
      this.randomRange(0.24, 0.34),
      0.34,
      this.randomRange(0.32, 0.46) * lightnessMultiplier
    )
    return material
  }
}
