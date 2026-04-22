import type { RaceStandings, RankedStandingEntry } from '../../domain/race/RaceStandings'
import type { StandingEntry } from '../../domain/race/RaceStandings'
import type { MinimapCarMarker } from '../ui/MinimapView'
import type { PositionLabelTarget } from '../ui/PositionLabelView'
import type { Competitor } from './Competitor'

export class CompetitorRegistry {
  readonly competitors: Competitor[] = []

  private readonly competitorById = new Map<string, Competitor>()
  private readonly minimapMarkers: MinimapCarMarker[] = []
  private readonly positionLabelTargets: PositionLabelTarget[] = []
  private readonly standingEntries: StandingEntry[] = []

  reset(): void {
    this.competitors.length = 0
    this.competitorById.clear()
    this.minimapMarkers.length = 0
    this.positionLabelTargets.length = 0
    this.standingEntries.length = 0
  }

  register(competitor: Competitor): void {
    this.competitors.push(competitor)
    this.competitorById.set(competitor.id, competitor)
    this.minimapMarkers.push({
      car: competitor.view,
      heading: competitor.car.heading,
      color: competitor.minimapColor,
      isPlayer: competitor.isPlayer,
    })
  }

  getMinimapMarkers(): MinimapCarMarker[] {
    for (let i = 0; i < this.competitors.length; i++) {
      this.minimapMarkers[i].heading = this.competitors[i].car.heading
    }

    return this.minimapMarkers
  }

  buildStandings(raceStandings: RaceStandings): RankedStandingEntry[] {
    this.standingEntries.length = 0

    for (const competitor of this.competitors) {
      this.standingEntries.push(
        raceStandings.fromSnapshot(
          competitor.id,
          competitor.name,
          competitor.race.snapshot(),
          competitor.isPlayer
        )
      )
    }

    return raceStandings.rank(this.standingEntries)
  }

  buildPositionLabelTargets(ranked: RankedStandingEntry[]): PositionLabelTarget[] {
    this.positionLabelTargets.length = 0

    for (const entry of ranked) {
      if (entry.isPlayer) continue

      const competitor = this.competitorById.get(entry.id)
      const fallbackView = this.competitors[0]?.view

      if (!competitor && !fallbackView) continue

      this.positionLabelTargets.push({
        id: entry.id,
        name: entry.name,
        place: entry.place,
        view: competitor ? competitor.view : fallbackView,
        isPlayer: entry.isPlayer,
      })
    }

    return this.positionLabelTargets
  }

  getPositionLabelTargets(): PositionLabelTarget[] {
    return this.positionLabelTargets
  }
}
