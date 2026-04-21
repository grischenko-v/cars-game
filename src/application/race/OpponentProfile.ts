import { getStartGridSlot, START_GRID_OPPONENT_COUNT } from '../../domain/race/StartGrid'
import type { StartGridTrack } from '../../domain/race/StartGrid'

export interface OpponentProfile {
  id: string
  speedFactor: number
  accelerationFactor: number
  aggression: number
  lineBias: number
  distanceOffset: number
  lateralOffset: number
  tint: number
  minimapColor: string
}

interface OpponentProfileOptions {
  track: StartGridTrack
}

export function createDefaultOpponentProfiles({
  track,
}: OpponentProfileOptions): OpponentProfile[] {
  const slots = Array.from({ length: START_GRID_OPPONENT_COUNT }, (_, index) =>
    getStartGridSlot(track, index)
  )

  return [
    {
      id: 'opponent-1',
      speedFactor: 1.1,
      accelerationFactor: 1.1,
      aggression: 0.96,
      lineBias: -0.45,
      distanceOffset: slots[0].distanceOffset,
      lateralOffset: slots[0].lateralOffset,
      tint: 0xb9413f,
      minimapColor: '#e05249',
    },
    {
      id: 'opponent-2',
      speedFactor: 1.08,
      accelerationFactor: 1.08,
      aggression: 0.92,
      lineBias: 0.4,
      distanceOffset: slots[1].distanceOffset,
      lateralOffset: slots[1].lateralOffset,
      tint: 0x2f78c4,
      minimapColor: '#4e9dff',
    },
    {
      id: 'opponent-3',
      speedFactor: 1.06,
      accelerationFactor: 1.06,
      aggression: 0.88,
      lineBias: -0.1,
      distanceOffset: slots[2].distanceOffset,
      lateralOffset: slots[2].lateralOffset,
      tint: 0xe5b84a,
      minimapColor: '#f3d45a',
    },
    {
      id: 'opponent-4',
      speedFactor: 1.04,
      accelerationFactor: 1.04,
      aggression: 0.84,
      lineBias: 0.55,
      distanceOffset: slots[3].distanceOffset,
      lateralOffset: slots[3].lateralOffset,
      tint: 0x5fbf78,
      minimapColor: '#7bd88f',
    },
    {
      id: 'opponent-5',
      speedFactor: 1.02,
      accelerationFactor: 1.02,
      aggression: 0.82,
      lineBias: -0.55,
      distanceOffset: slots[4].distanceOffset,
      lateralOffset: slots[4].lateralOffset,
      tint: 0xb66ce0,
      minimapColor: '#c58cff',
    },
    {
      id: 'opponent-6',
      speedFactor: 1,
      accelerationFactor: 1,
      aggression: 0.78,
      lineBias: 0.08,
      distanceOffset: slots[5].distanceOffset,
      lateralOffset: slots[5].lateralOffset,
      tint: 0xf08a52,
      minimapColor: '#ff9f6e',
    },
  ]
}
