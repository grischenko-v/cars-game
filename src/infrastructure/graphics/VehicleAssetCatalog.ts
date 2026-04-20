import type { VehicleSpec } from '../../domain/vehicle/VehicleSpec'
import { vehicleSpecs } from '../../domain/vehicle/VehicleSpec'

export interface VehicleAssetDefinition {
  spec: VehicleSpec
  modelPath: string
  modelPitchCorrection?: number
  modelRideHeightCorrection?: number
}

const vehicleAssetsById = new Map<string, Omit<VehicleAssetDefinition, 'spec'>>([
  ['mustang', { modelPath: '/models/mustang.glb' }],
  [
    'mini-jcw',
    {
      modelPath: '/models/mini.glb',
      modelPitchCorrection: (8.5 * Math.PI) / 180,
      modelRideHeightCorrection: -0.18,
    },
  ],
])

export const vehicleAssetCatalog: VehicleAssetDefinition[] = vehicleSpecs.map((spec) => {
  const asset = vehicleAssetsById.get(spec.id)

  if (!asset) {
    throw new Error(`Не указан GLB ассет для машины ${spec.id}`)
  }

  return { spec, ...asset }
})
