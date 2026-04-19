import * as THREE from 'three'

export interface RaceSnapshot {
  completedLaps: number
  targetLaps: number
  elapsedTime: number
  currentLapTime: number
  lapTimes: number[]
  progressDistance: number
  raceDistance: number
  finished: boolean
}

export class Race {
  private readonly startDistance: number
  private previousProgress: number | null = null
  private completedLaps = 0
  private elapsedTime = 0
  private currentLapStartTime = 0
  private lapTimes: number[] = []
  private checkpointReached = false
  private finished = false

  constructor(
    private readonly targetLaps: number,
    startAngle: number,
    private readonly trackLength: number
  ) {
    this.startDistance =
      (THREE.MathUtils.euclideanModulo(startAngle, Math.PI * 2) / (Math.PI * 2)) *
      trackLength
  }

  update(delta: number, distanceAlong: number, signedForwardSpeed: number): RaceSnapshot {
    if (this.finished) return this.snapshot()

    this.elapsedTime += delta

    const progress = THREE.MathUtils.euclideanModulo(
      distanceAlong - this.startDistance,
      this.trackLength
    )

    if (progress > this.trackLength * 0.42 && progress < this.trackLength * 0.72) {
      this.checkpointReached = true
    }

    if (this.previousProgress !== null) {
      const crossedForward =
        this.checkpointReached &&
        this.previousProgress > this.trackLength * 0.82 &&
        progress < this.trackLength * 0.18 &&
        signedForwardSpeed > 1.5

      if (crossedForward) {
        this.lapTimes.push(this.elapsedTime - this.currentLapStartTime)
        this.currentLapStartTime = this.elapsedTime
        this.completedLaps += 1
        this.checkpointReached = false
        this.finished = this.completedLaps >= this.targetLaps
      }
    }

    this.previousProgress = progress
    return this.snapshot()
  }

  snapshot(): RaceSnapshot {
    const progressDistance = this.previousProgress ?? 0
    const scoringProgress =
      this.completedLaps === 0 &&
      !this.checkpointReached &&
      progressDistance > this.trackLength * 0.82
        ? 0
        : progressDistance

    return {
      completedLaps: this.completedLaps,
      targetLaps: this.targetLaps,
      elapsedTime: this.elapsedTime,
      currentLapTime: this.finished ? 0 : this.elapsedTime - this.currentLapStartTime,
      lapTimes: [...this.lapTimes],
      progressDistance,
      raceDistance:
        Math.min(this.completedLaps, this.targetLaps) * this.trackLength +
        (this.finished ? 0 : scoringProgress),
      finished: this.finished,
    }
  }
}
