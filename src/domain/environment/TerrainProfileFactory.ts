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
    massifAmplitude: 0,
    massifFrequency: 0.004,
    massifSharpness: 2,
    valleyWallAmplitude: 0,
    valleyWallDistance: 90,
    valleyWallRamp: 180,
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
    massifAmplitude: 3.5,
    massifFrequency: 0.0042,
    massifSharpness: 2.2,
    valleyWallAmplitude: 4.5,
    valleyWallDistance: 118,
    valleyWallRamp: 230,
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
    heightAmplitude: 8.8,
    primaryFrequency: 0.0038,
    secondaryFrequency: 0.0056,
    detailFrequency: 0.009,
    ridgeAmplitude: 7.2,
    ridgeFrequency: 0.0032,
    massifAmplitude: 24,
    massifFrequency: 0.0022,
    massifSharpness: 1.75,
    valleyWallAmplitude: 26,
    valleyWallDistance: 132,
    valleyWallRamp: 360,
    roadsideCliffAmplitude: 5.5,
    roadsideCliffFrequency: 0.0026,
    roadsideCliffThreshold: 0.72,
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
