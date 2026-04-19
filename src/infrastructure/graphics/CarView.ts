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
    this.root.traverse((child) => {
      if (isMeshObject(child)) {
        child.castShadow = true
        child.receiveShadow = false
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

  updateMatrixWorld(force = true): void {
    this.root.updateMatrixWorld(force)
  }

  setBoxFromObject(out: THREE.Box3): THREE.Box3 {
    return out.setFromObject(this.root)
  }

  worldPointFromLocal(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(x, y, z).applyQuaternion(this.root.quaternion).add(this.root.position)
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
}
