export interface QualitySettings {
  decorationDrawDistance: number
  minimapUpdateInterval: number
  minPixelRatio: number
  maxPixelRatio: number
  shadowMapSize: number
  terrainSegments: number
  uiLabelUpdateInterval: number
  visibilityUpdateInterval: number
}

export const qualitySettings: QualitySettings = {
  decorationDrawDistance: 240,
  minimapUpdateInterval: 0.12,
  minPixelRatio: 0.72,
  maxPixelRatio: 1.05,
  shadowMapSize: 512,
  terrainSegments: 96,
  uiLabelUpdateInterval: 0.12,
  visibilityUpdateInterval: 0.24,
}
