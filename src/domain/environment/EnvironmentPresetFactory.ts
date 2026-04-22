import type {
  EnvironmentPreset,
  TimeOfDayKind,
  WeatherKind,
} from './EnvironmentPreset'

interface TimeOfDaySettings {
  skyTopColor: number
  skyBottomColor: number
  fogColor: number
  ambientIntensity: number
  hemisphereIntensity: number
  sunIntensity: number
  sunColor: number
  sunPosition: [number, number, number]
  headlightsRequired: boolean
}

interface WeatherSettings {
  fogNearOffset: number
  fogFar: number
  ambientMultiplier: number
  hemisphereMultiplier: number
  sunMultiplier: number
  rainIntensity: number
  skyTopBlend?: number
  skyBottomBlend?: number
  fogBlend?: number
}

const timeOfDaySettings: Record<TimeOfDayKind, TimeOfDaySettings> = {
  morning: {
    skyTopColor: 0x7fb7ff,
    skyBottomColor: 0xffdfbd,
    fogColor: 0xd8e8f3,
    ambientIntensity: 1.35,
    hemisphereIntensity: 1.35,
    sunIntensity: 2.1,
    sunColor: 0xffe3b8,
    sunPosition: [55, 24, 12],
    headlightsRequired: false,
  },
  day: {
    skyTopColor: 0x6eaefc,
    skyBottomColor: 0xf1f7ff,
    fogColor: 0x9fc6ff,
    ambientIntensity: 1.5,
    hemisphereIntensity: 1.4,
    sunIntensity: 2.4,
    sunColor: 0xffffff,
    sunPosition: [40, 45, 20],
    headlightsRequired: false,
  },
  evening: {
    skyTopColor: 0x31466f,
    skyBottomColor: 0xff9e66,
    fogColor: 0xb98d79,
    ambientIntensity: 1.05,
    hemisphereIntensity: 1.0,
    sunIntensity: 1.45,
    sunColor: 0xffb061,
    sunPosition: [-48, 15, 28],
    headlightsRequired: true,
  },
  night: {
    skyTopColor: 0x050814,
    skyBottomColor: 0x111b2a,
    fogColor: 0x07101c,
    ambientIntensity: 0.34,
    hemisphereIntensity: 0.42,
    sunIntensity: 0.18,
    sunColor: 0x9cbcff,
    sunPosition: [-30, 32, -45],
    headlightsRequired: true,
  },
}

const weatherSettings: Record<WeatherKind, WeatherSettings> = {
  sunny: {
    fogNearOffset: 0,
    fogFar: 380,
    ambientMultiplier: 1,
    hemisphereMultiplier: 1,
    sunMultiplier: 1,
    rainIntensity: 0,
  },
  'partly-cloudy': {
    fogNearOffset: -10,
    fogFar: 340,
    ambientMultiplier: 0.96,
    hemisphereMultiplier: 0.96,
    sunMultiplier: 0.72,
    rainIntensity: 0,
    skyTopBlend: 0xa9b7c3,
    skyBottomBlend: 0xd5d9d4,
    fogBlend: 0xb7c3c8,
  },
  overcast: {
    fogNearOffset: -20,
    fogFar: 285,
    ambientMultiplier: 0.84,
    hemisphereMultiplier: 0.86,
    sunMultiplier: 0.34,
    rainIntensity: 0,
    skyTopBlend: 0x77828c,
    skyBottomBlend: 0xb3b8b0,
    fogBlend: 0x9aa4a7,
  },
  drizzle: {
    fogNearOffset: -30,
    fogFar: 250,
    ambientMultiplier: 0.78,
    hemisphereMultiplier: 0.78,
    sunMultiplier: 0.25,
    rainIntensity: 0.42,
    skyTopBlend: 0x66717a,
    skyBottomBlend: 0xa5aca7,
    fogBlend: 0x879296,
  },
  rain: {
    fogNearOffset: -38,
    fogFar: 220,
    ambientMultiplier: 0.76,
    hemisphereMultiplier: 0.76,
    sunMultiplier: 0.28,
    rainIntensity: 1,
    skyTopBlend: 0x56616a,
    skyBottomBlend: 0x8e999a,
    fogBlend: 0x748187,
  },
  storm: {
    fogNearOffset: -48,
    fogFar: 180,
    ambientMultiplier: 0.62,
    hemisphereMultiplier: 0.66,
    sunMultiplier: 0.12,
    rainIntensity: 1,
    skyTopBlend: 0x2e3742,
    skyBottomBlend: 0x5b6669,
    fogBlend: 0x4b585f,
  },
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function blendColor(base: number, overlay: number | undefined, alpha: number): number {
  if (overlay === undefined) return base

  const baseR = (base >> 16) & 255
  const baseG = (base >> 8) & 255
  const baseB = base & 255
  const overlayR = (overlay >> 16) & 255
  const overlayG = (overlay >> 8) & 255
  const overlayB = overlay & 255
  const r = Math.round(baseR + (overlayR - baseR) * alpha)
  const g = Math.round(baseG + (overlayG - baseG) * alpha)
  const b = Math.round(baseB + (overlayB - baseB) * alpha)

  return (r << 16) | (g << 8) | b
}

export class EnvironmentPresetFactory {
  createRandom(): EnvironmentPreset {
    const weather = randomItem<WeatherKind>([
      'sunny',
      'partly-cloudy',
      'overcast',
      'drizzle',
      'rain',
      'storm',
    ])
    const timeOfDay = randomItem<TimeOfDayKind>([
      'morning',
      'day',
      'evening',
      'night',
    ])
    const time = timeOfDaySettings[timeOfDay]
    const weatherTune = weatherSettings[weather]
    const nightFogBonus = timeOfDay === 'night' ? -26 : 0

    return {
      weather,
      timeOfDay,
      skyTopColor: blendColor(time.skyTopColor, weatherTune.skyTopBlend, 0.55),
      skyBottomColor: blendColor(time.skyBottomColor, weatherTune.skyBottomBlend, 0.5),
      fogColor: blendColor(time.fogColor, weatherTune.fogBlend, 0.52),
      fogNear: Math.max(24, 86 + weatherTune.fogNearOffset + nightFogBonus),
      fogFar: timeOfDay === 'night'
        ? Math.min(weatherTune.fogFar, 190)
        : weatherTune.fogFar,
      ambientIntensity: time.ambientIntensity * weatherTune.ambientMultiplier,
      hemisphereIntensity: time.hemisphereIntensity * weatherTune.hemisphereMultiplier,
      sunIntensity: time.sunIntensity * weatherTune.sunMultiplier,
      sunColor: time.sunColor,
      sunPosition: time.sunPosition,
      rainIntensity: weatherTune.rainIntensity,
      headlightsRequired: time.headlightsRequired || weatherTune.rainIntensity > 0,
    }
  }
}
