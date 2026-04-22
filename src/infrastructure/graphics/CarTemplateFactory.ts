import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { VehicleSpec } from '../../domain/vehicle/VehicleSpec'
import { CarView } from './CarView'
import { publicAssetUrl } from './TextureFactory'
import type { VehicleAssetDefinition } from './VehicleAssetCatalog'

export interface CarPhysicsBounds {
  minY: number
  groundContactY: number
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  colliderRadius: number
}

export interface CarTemplate {
  spec: VehicleSpec
  view: CarView
  bounds: CarPhysicsBounds
}

export class CarTemplateFactory {
  private readonly loader = new GLTFLoader()
  private readonly boundsByView = new WeakMap<CarView, CarPhysicsBounds>()

  loadAll(definitions: VehicleAssetDefinition[]): Promise<CarTemplate[]> {
    return Promise.all(definitions.map((definition) => this.load(definition)))
  }

  instantiate(template: CarTemplate): CarView {
    const view = template.view.clone()
    this.boundsByView.set(view, template.bounds)
    return view
  }

  getBounds(view: CarView): CarPhysicsBounds {
    const bounds = this.boundsByView.get(view)
    if (bounds) return bounds

    const localBox = view.getLocalBounds()
    if (localBox) {
      const computed = this.createPhysicsBounds(
        localBox,
        view.estimateWheelContactY(localBox) ?? localBox.min.y
      )
      this.boundsByView.set(view, computed)
      return computed
    }

    const fallback = {
      minY: 0,
      groundContactY: 0,
      minX: -0.95,
      maxX: 0.95,
      minZ: -2.2,
      maxZ: 2.2,
      colliderRadius: 1.05,
    }

    this.boundsByView.set(view, fallback)
    return fallback
  }

  private load(definition: VehicleAssetDefinition): Promise<CarTemplate> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        publicAssetUrl(definition.modelPath),
        (gltf) => {
          const modelRoot = new THREE.Group()
          gltf.scene.rotation.x += definition.modelPitchCorrection ?? 0
          gltf.scene.position.y += definition.modelRideHeightCorrection ?? 0
          modelRoot.add(gltf.scene)

          const view = new CarView(modelRoot)
          const prepared = this.prepare(view, definition)

          if (!prepared) {
            reject(new Error(`Не удалось подготовить модель ${definition.spec.name}`))
            return
          }

          resolve(prepared)
        },
        undefined,
        reject
      )
    })
  }

  private prepare(view: CarView, definition: VehicleAssetDefinition): CarTemplate | null {
    const box = view.getLocalBounds()
    if (!box) return null
    const spec = definition.spec

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    view.translateBy(center.multiplyScalar(-1))
    view.translateY(size.y / 2)

    const horizontalWidth = Math.min(size.x, size.z)
    const scale = spec.widthMeters / Math.max(horizontalWidth, 0.001)
    view.setScalarScale(scale)

    const boxAfterScale = view.getLocalBounds()
    if (!boxAfterScale) return null

    const centerAfterScale = boxAfterScale.getCenter(new THREE.Vector3())
    view.translateBy(centerAfterScale.multiplyScalar(-1))

    const localBox = view.getLocalBounds()
    if (!localBox) return null

    const wheelContactY = view.estimateWheelContactY(localBox)
    const bounds = this.createPhysicsBounds(
      localBox,
      wheelContactY ?? localBox.min.y
    )
    this.boundsByView.set(view, bounds)

    return { spec, view, bounds }
  }

  private createPhysicsBounds(
    localBox: THREE.Box3,
    wheelContactY: number
  ): CarPhysicsBounds {
    const width = localBox.max.x - localBox.min.x
    const length = localBox.max.z - localBox.min.z
    const height = localBox.max.y - localBox.min.y
    const hasReliableWheelContact =
      Number.isFinite(wheelContactY) &&
      wheelContactY >= localBox.min.y &&
      wheelContactY <= localBox.min.y + height * 0.34

    return {
      minY: localBox.min.y,
      groundContactY: hasReliableWheelContact ? wheelContactY : localBox.min.y,
      minX: localBox.min.x,
      maxX: localBox.max.x,
      minZ: localBox.min.z,
      maxZ: localBox.max.z,
      colliderRadius: THREE.MathUtils.clamp(width * 0.62 + length * 0.18, 1.25, 1.85),
    }
  }
}
