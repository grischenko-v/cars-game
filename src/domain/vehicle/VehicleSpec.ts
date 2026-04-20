export interface VehicleSpec {
  id: string
  name: string
  widthMeters: number
  maxSpeedFactor: number
  accelerationFactor: number
  handlingFactor: number
  gripFactor: number
}

export const vehicleSpecs: VehicleSpec[] = [
  {
    id: 'mustang',
    name: 'Ford Mustang',
    widthMeters: 1.92,
    maxSpeedFactor: 1.04,
    accelerationFactor: 1,
    handlingFactor: 0.95,
    gripFactor: 0.97,
  },
  {
    id: 'mini-jcw',
    name: 'Mini JCW',
    widthMeters: 1.73,
    maxSpeedFactor: 0.97,
    accelerationFactor: 0.94,
    handlingFactor: 1.18,
    gripFactor: 1.12,
  },
]
