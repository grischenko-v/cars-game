export type WeatherKind = 'sunny' | 'partly-cloudy' | 'overcast' | 'drizzle' | 'rain' | 'storm'
export type TimeOfDayKind = 'morning' | 'day' | 'evening' | 'night'

export interface EnvironmentPreset {
  weather: WeatherKind
  timeOfDay: TimeOfDayKind
  skyTopColor: number
  skyBottomColor: number
  fogColor: number
  fogNear: number
  fogFar: number
  ambientIntensity: number
  hemisphereIntensity: number
  sunIntensity: number
  sunColor: number
  sunPosition: [number, number, number]
  rainIntensity: number
  headlightsRequired: boolean
}
