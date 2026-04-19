import type { TrackLayoutSnapshot } from './TrackModel'

export interface TrackGenerationStrategy {
  generate(): TrackLayoutSnapshot
}
