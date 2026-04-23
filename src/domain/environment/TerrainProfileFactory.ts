import type { TerrainProfile, TerrainReliefKind } from './TerrainProfile'

const terrainProfiles: Record<TerrainReliefKind, TerrainProfile> = {
  plain: {
    kind: 'plain',
    texture: {
      basePath: '/textures/grass',
      name: 'Grass001_1K-JPG',
      repeatX: 118,
      repeatY: 118,
      color: 0xb7c991,
      normalScale: 0.34,
    },
    heightAmplitude: 0.35,
    primaryFrequency: 0.025,
    secondaryFrequency: 0.022,
    detailFrequency: 0.015,
    ridgeAmplitude: 0,
    ridgeFrequency: 0.008,
    roadsideCliffAmplitude: 0,
    roadsideCliffFrequency: 0.004,
    roadsideCliffThreshold: 1,
  },
  hills: {
    kind: 'hills',
    texture: {
      basePath: '/textures/grass',
      name: 'Grass001_1K-JPG',
      repeatX: 96,
      repeatY: 96,
      color: 0x93ad70,
      normalScale: 0.42,
    },
    heightAmplitude: 2.25,
    primaryFrequency: 0.011,
    secondaryFrequency: 0.016,
    detailFrequency: 0.033,
    ridgeAmplitude: 1.05,
    ridgeFrequency: 0.009,
    roadsideCliffAmplitude: 2.4,
    roadsideCliffFrequency: 0.0045,
    roadsideCliffThreshold: 0.62,
  },
  mountains: {
    kind: 'mountains',
    texture: {
      basePath: '/textures/sand',
      name: 'Ground054_1K-JPG',
      repeatX: 82,
      repeatY: 82,
      color: 0x9b9784,
      normalScale: 0.58,
    },
    heightAmplitude: 6.8,
    primaryFrequency: 0.006,
    secondaryFrequency: 0.010,
    detailFrequency: 0.026,
    ridgeAmplitude: 5.4,
    ridgeFrequency: 0.0065,
    roadsideCliffAmplitude: 8.5,
    roadsideCliffFrequency: 0.0038,
    roadsideCliffThreshold: 0.42,
  },
}

export class TerrainProfileFactory {
  createRandom(): TerrainProfile {
    const roll = Math.random()

    if (roll < 0.38) return terrainProfiles.plain
    if (roll < 0.74) return terrainProfiles.hills

    return terrainProfiles.mountains
  }
}
