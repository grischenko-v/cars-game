export interface QualitySettings {
  decorationDrawDistance: number
  maxPixelRatio: number
  shadowMapSize: number
  terrainSegments: number
}

export const qualitySettings: QualitySettings = {
  decorationDrawDistance: 230,
  maxPixelRatio: 1.5,
  shadowMapSize: 1024,
  terrainSegments: 180,
}
