export interface QualitySettings {
  decorationDrawDistance: number
  maxPixelRatio: number
  shadowMapSize: number
  terrainSegments: number
}

export const qualitySettings: QualitySettings = {
  decorationDrawDistance: 320,
  maxPixelRatio: 1.35,
  shadowMapSize: 768,
  terrainSegments: 150,
}
