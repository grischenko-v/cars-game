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
  trackHalfWidth: number
  startOffset: number
  rowSpacing: number
  lateralOffsetFactor: number
}

export function createDefaultOpponentProfiles({
  trackHalfWidth,
  startOffset,
  rowSpacing,
  lateralOffsetFactor,
}: OpponentProfileOptions): OpponentProfile[] {
  const gridLateralOffset = trackHalfWidth * lateralOffsetFactor

  return [
    {
      id: 'opponent-1',
      speedFactor: 1.03,
      accelerationFactor: 1.04,
      aggression: 0.94,
      lineBias: -0.45,
      distanceOffset: startOffset,
      lateralOffset: -gridLateralOffset,
      tint: 0xb9413f,
      minimapColor: '#e05249',
    },
    {
      id: 'opponent-2',
      speedFactor: 1.01,
      accelerationFactor: 1.02,
      aggression: 0.88,
      lineBias: 0.4,
      distanceOffset: startOffset - rowSpacing,
      lateralOffset: gridLateralOffset,
      tint: 0x2f78c4,
      minimapColor: '#4e9dff',
    },
    {
      id: 'opponent-3',
      speedFactor: 0.99,
      accelerationFactor: 1.0,
      aggression: 0.82,
      lineBias: -0.1,
      distanceOffset: startOffset - rowSpacing * 2,
      lateralOffset: -gridLateralOffset,
      tint: 0xe5b84a,
      minimapColor: '#f3d45a',
    },
    {
      id: 'opponent-4',
      speedFactor: 0.97,
      accelerationFactor: 0.98,
      aggression: 0.76,
      lineBias: 0.55,
      distanceOffset: startOffset - rowSpacing * 3,
      lateralOffset: gridLateralOffset,
      tint: 0x5fbf78,
      minimapColor: '#7bd88f',
    },
    {
      id: 'opponent-5',
      speedFactor: 0.95,
      accelerationFactor: 0.96,
      aggression: 0.8,
      lineBias: -0.55,
      distanceOffset: startOffset - rowSpacing * 4,
      lateralOffset: -gridLateralOffset,
      tint: 0xb66ce0,
      minimapColor: '#c58cff',
    },
    {
      id: 'opponent-6',
      speedFactor: 0.93,
      accelerationFactor: 0.94,
      aggression: 0.72,
      lineBias: 0.08,
      distanceOffset: startOffset - rowSpacing * 5,
      lateralOffset: gridLateralOffset,
      tint: 0xf08a52,
      minimapColor: '#ff9f6e',
    },
  ]
}
