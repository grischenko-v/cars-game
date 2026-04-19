import * as THREE from 'three'

export class VegetationFactory {
  constructor(private readonly randomRange: (min: number, max: number) => number) {}

  createRoundTree(scale: number): THREE.Group {
    const tree = new THREE.Group()
    tree.scale.setScalar(scale)

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x6d4b2f, roughness: 1 })
    )
    trunk.position.y = 1.1
    trunk.castShadow = true
    trunk.receiveShadow = true

    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 10),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(
          this.randomRange(0.24, 0.31),
          0.3,
          this.randomRange(0.4, 0.5)
        ),
        roughness: 1,
      })
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
      new THREE.MeshStandardMaterial({ color: 0x6c4b32, roughness: 1 })
    )
    trunk.position.y = 1.3
    trunk.castShadow = true
    trunk.receiveShadow = true
    tree.add(trunk)

    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(1.35 - i * 0.2, 1.8, 8),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(
            this.randomRange(0.27, 0.34),
            0.35,
            this.randomRange(0.3, 0.42)
          ),
          roughness: 1,
        })
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
      new THREE.MeshStandardMaterial({ color: 0x715236, roughness: 1 })
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
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(
            this.randomRange(0.23, 0.3),
            0.28,
            this.randomRange(0.38, 0.5)
          ),
          roughness: 1,
        })
      )
      crown.position.set(ox, oy, oz)
      crown.castShadow = true
      crown.receiveShadow = true
      tree.add(crown)
    }

    tree.rotation.y = this.randomRange(0, Math.PI * 2)
    return tree
  }
}
