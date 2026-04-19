import type { RaceSnapshot } from './Race'

export interface StandingEntry {
  id: string
  name: string
  completedLaps: number
  targetLaps: number
  raceDistance: number
  finished: boolean
  isPlayer: boolean
}

export interface RankedStandingEntry extends StandingEntry {
  place: number
}

export class RaceStandings {
  rank(entries: StandingEntry[]): RankedStandingEntry[] {
    return entries
      .sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? -1 : 1
        return b.raceDistance - a.raceDistance
      })
      .map((entry, index) => ({
        ...entry,
        place: index + 1,
      }))
  }

  fromSnapshot(
    id: string,
    name: string,
    snapshot: RaceSnapshot,
    isPlayer: boolean
  ): StandingEntry {
    return {
      id,
      name,
      completedLaps: snapshot.completedLaps,
      targetLaps: snapshot.targetLaps,
      raceDistance: snapshot.raceDistance,
      finished: snapshot.finished,
      isPlayer,
    }
  }
}
