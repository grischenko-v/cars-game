import type { LoadingView } from '../ui/LoadingView'
import type { GamePhase } from './GamePhase'
import { COUNTDOWN_GO_HOLD_SECONDS, COUNTDOWN_SECONDS } from './RacingGameConfig'

export class CountdownController {
  private gamePhase: GamePhase = 'loading'
  private countdownTime = COUNTDOWN_SECONDS
  private goHoldTime = 0

  constructor(private readonly loadingView: LoadingView) {}

  get phase(): GamePhase {
    return this.gamePhase
  }

  start(): void {
    this.gamePhase = 'countdown'
    this.countdownTime = COUNTDOWN_SECONDS
    this.goHoldTime = 0
    this.loadingView.showCountdown(String(COUNTDOWN_SECONDS))
  }

  finish(): void {
    this.gamePhase = 'finished'
  }

  update(delta: number): void {
    if (this.gamePhase === 'running' && this.goHoldTime > 0) {
      this.goHoldTime -= delta

      if (this.goHoldTime <= 0) {
        this.loadingView.hide()
      }

      return
    }

    if (this.gamePhase !== 'countdown') return

    this.countdownTime -= delta

    if (this.countdownTime > 0) {
      this.loadingView.showCountdown(String(Math.ceil(this.countdownTime)))
      return
    }

    this.loadingView.showCountdown('GO!')
    this.goHoldTime = COUNTDOWN_GO_HOLD_SECONDS
    this.gamePhase = 'running'
  }
}
