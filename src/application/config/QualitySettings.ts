export interface QualitySettings {
  decorationDrawDistance: number
  minimapUpdateInterval: number
  maxPixelRatio: number
  shadowMapSize: number
  terrainSegments: number
  uiLabelUpdateInterval: number
  visibilityUpdateInterval: number
}

export const qualitySettings: QualitySettings = {
  decorationDrawDistance: 280,
  minimapUpdateInterval: 0.08,
  maxPixelRatio: 1.15,
  shadowMapSize: 512,
  terrainSegments: 120,
  uiLabelUpdateInterval: 0.08,
  visibilityUpdateInterval: 0.18,
}
