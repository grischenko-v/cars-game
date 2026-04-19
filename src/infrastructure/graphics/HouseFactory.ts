import * as THREE from 'three'

export class HouseFactory {
  create(scale = 1, rotationY = 0): THREE.Group {
    const house = new THREE.Group()
    house.rotation.y = rotationY
    house.scale.setScalar(scale)

    const wallColors = [0xd7cab2, 0xc8d8c1, 0xe3d5c4]
    const roofColors = [0x8b4a36, 0x6d4f3f, 0x7d5a4b]
    const wallColor = wallColors[THREE.MathUtils.randInt(0, wallColors.length - 1)]
    const roofColor = roofColors[THREE.MathUtils.randInt(0, roofColors.length - 1)]

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 2.8, 3.8),
      new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95 })
    )
    body.position.y = 1.4
    body.castShadow = true
    body.receiveShadow = true

    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(0, 3.6, 2.2, 4),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.92 })
    )
    roof.position.y = 3.35
    roof.rotation.y = Math.PI * 0.25
    roof.castShadow = true
    roof.receiveShadow = true

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x6b4833, roughness: 1 })
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
}
