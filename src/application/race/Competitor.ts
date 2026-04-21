import type { Car as CarAggregate } from '../../domain/car/Car'
import type { VehicleSpec } from '../../domain/vehicle/VehicleSpec'
import type { OpponentDriver } from '../ai/OpponentDriver'
import type { Race } from '../../domain/race/Race'
import type { CarView } from '../../infrastructure/graphics/CarView'

export interface Competitor {
  id: string
  name: string
  isPlayer: boolean
  car: CarAggregate
  view: CarView
  race: Race
  driver: OpponentDriver | null
  minimapColor: string
  vehicleSpec: VehicleSpec
  railLateralOffset?: number
}
