import * as THREE from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

function isMeshObject(child: THREE.Object3D): child is THREE.Mesh {
  return (child as THREE.Mesh).isMesh === true
}

export class CarView {
  constructor(private readonly root: THREE.Group) {}

  clone(): CarView {
    const clone = cloneSkeleton(this.root) as THREE.Group
    clone.traverse((child) => {
      if (!isMeshObject(child)) return

      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) => material.clone())
      } else if (child.material) {
        child.material = child.material.clone()
      }
    })

    return new CarView(clone)
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.root)
  }

  enableShadows(): void {
    this.root.renderOrder = 20

    this.root.traverse((child) => {
      if (isMeshObject(child)) {
        child.castShadow = true
        child.receiveShadow = false
        child.renderOrder = 20

        const materials = Array.isArray(child.material) ? child.material : [child.material]
        for (const material of materials) {
          if (!material) continue

          material.depthTest = true
          material.depthWrite = true
          material.transparent = false
          material.polygonOffset = false
        }
      }
    })
  }

  tintMaterials(color: THREE.ColorRepresentation, strength = 0.35): void {
    const tint = new THREE.Color(color)

    this.root.traverse((child) => {
      if (!isMeshObject(child)) return

      const materials = Array.isArray(child.material) ? child.material : [child.material]

      for (const material of materials) {
        if (!material) continue

        material.transparent = false
        material.opacity = 1
        material.depthWrite = true

        if ('color' in material && material.color instanceof THREE.Color) {
          material.color.lerp(tint, strength)
        }
      }
    })
  }

  copyPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.root.position)
  }

  setPosition(position: THREE.Vector3): void {
    this.root.position.copy(position)
  }

  setY(y: number): void {
    this.root.position.y = y
  }

  translateY(delta: number): void {
    this.root.position.y += delta
  }

  translateBy(delta: THREE.Vector3): void {
    this.root.position.add(delta)
  }

  translateXZ(x: number, z: number): void {
    this.root.position.x += x
    this.root.position.z += z
  }

  addScaledVector(vector: THREE.Vector3, scale: number): void {
    this.root.position.addScaledVector(vector, scale)
  }

  setYaw(yaw: number): void {
    this.root.rotation.y = yaw
  }

  getYaw(): number {
    return this.root.rotation.y
  }

  setScalarScale(scale: number): void {
    this.root.scale.setScalar(scale)
  }

  getScaleY(): number {
    return this.root.scale.y
  }

  updateMatrixWorld(force = true): void {
    this.root.updateMatrixWorld(force)
  }

  setBoxFromObject(out: THREE.Box3): THREE.Box3 {
    return out.setFromObject(this.root)
  }

  worldPointFromLocal(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(x, y, z).applyMatrix4(this.root.matrixWorld)
    return out
  }

  slerpQuaternion(target: THREE.Quaternion, alpha: number): void {
    this.root.quaternion.slerp(target, alpha)
  }

  getLocalBounds(): THREE.Box3 | null {
    const bounds = new THREE.Box3()
    const childBounds = new THREE.Box3()
    const rootInverse = new THREE.Matrix4()
    let hasGeometry = false

    this.root.updateMatrixWorld(true)
    rootInverse.copy(this.root.matrixWorld).invert()

    this.root.traverse((child) => {
      if (!isMeshObject(child) || !child.geometry) return

      if (!child.geometry.boundingBox) {
        child.geometry.computeBoundingBox()
      }

      if (!child.geometry.boundingBox) return

      childBounds
        .copy(child.geometry.boundingBox)
        .applyMatrix4(child.matrixWorld)
        .applyMatrix4(rootInverse)

      if (!hasGeometry) {
        bounds.copy(childBounds)
        hasGeometry = true
      } else {
        bounds.union(childBounds)
      }
    })

    return hasGeometry ? bounds : null
  }

  estimateWheelContactY(localBox: THREE.Box3): number | null {
    const rootInverse = new THREE.Matrix4()
    const childToRoot = new THREE.Matrix4()
    const point = new THREE.Vector3()
    const centerX = (localBox.min.x + localBox.max.x) * 0.5
    const centerZ = (localBox.min.z + localBox.max.z) * 0.5
    const width = localBox.max.x - localBox.min.x
    const length = localBox.max.z - localBox.min.z
    const height = localBox.max.y - localBox.min.y
    const sideThreshold = width * 0.22
    const axleThreshold = length * 0.16
    const lowerBodyLimit = localBox.min.y + height * 0.58
    const contactCandidates: number[] = []

    this.root.updateMatrixWorld(true)
    rootInverse.copy(this.root.matrixWorld).invert()

    this.root.traverse((child) => {
      if (!isMeshObject(child) || !child.geometry) return

      const position = child.geometry.getAttribute('position')
      if (!position) return

      childToRoot.multiplyMatrices(rootInverse, child.matrixWorld)

      for (let i = 0; i < position.count; i++) {
        point
          .set(position.getX(i), position.getY(i), position.getZ(i))
          .applyMatrix4(childToRoot)

        const isSideVertex = Math.abs(point.x - centerX) >= sideThreshold
        const isAxleVertex = Math.abs(point.z - centerZ) >= axleThreshold
        const isLowerVertex = point.y <= lowerBodyLimit

        if (!isSideVertex || !isAxleVertex || !isLowerVertex) continue

        contactCandidates.push(point.y)
      }
    })

    if (contactCandidates.length <= 64) return null

    contactCandidates.sort((a, b) => a - b)
    const contactIndex = Math.min(
      contactCandidates.length - 1,
      Math.floor(contactCandidates.length * 0.08)
    )

    return contactCandidates[contactIndex]
  }
}
