export type TerrainReliefKind = 'plain' | 'hills' | 'mountains'

export interface TerrainTextureProfile {
  basePath: string
  name: string
  repeatX: number
  repeatY: number
  color: number
  normalScale: number
}

export interface TerrainProfile {
  kind: TerrainReliefKind
  texture: TerrainTextureProfile
  heightAmplitude: number
  primaryFrequency: number
  secondaryFrequency: number
  detailFrequency: number
  ridgeAmplitude: number
  ridgeFrequency: number
  roadsideCliffAmplitude: number
  roadsideCliffFrequency: number
  roadsideCliffThreshold: number
}
