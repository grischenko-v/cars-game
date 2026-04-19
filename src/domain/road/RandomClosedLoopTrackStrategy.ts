import * as THREE from 'three'
import type { TrackGenerationStrategy } from './TrackGenerationStrategy'
import type { TrackLayoutSnapshot, TurnInfo } from './TrackModel'

interface TurnRun {
  sign: number
  length: number
}

interface TurnSummary {
  leftTurns: number
  rightTurns: number
  startPhase: number
  startClearArc: number
  curveNoisePenalty: number
}

export class RandomClosedLoopTrackStrategy implements TrackGenerationStrategy {
  constructor(
    private readonly config = {
      roadWidth: 34,
      shoulderWidth: 6,
      roadY: 0.24,
      shoulderY: 0.17,
      apronY: 0.12,
      shoulderBlend: 5.5,
      terrainBlend: 24,
      cutDepth: 0.22,
      terrainCalmDistance: 34,
      terrainCalmFactor: 0.08,
      terrainHardMargin: 5,
      terrainShoulderMargin: 3,
      apronWidth: 8,
    }
  ) {}

  generate(): TrackLayoutSnapshot {
    const turnInfo: TurnInfo = {
      leftTurns: 0,
      rightTurns: 0,
      desiredLeftTurns: this.randomInt(3, 10),
      desiredRightTurns: this.randomInt(3, 10),
    }

    let selected: { points: THREE.Vector3[]; turnSummary: TurnSummary } | null = null

    for (let attempt = 0; attempt < 120; attempt++) {
      const candidate = this.buildRandomTrackCandidate()
      const turnSummary = this.analyzeTurns(candidate)

      if (
        turnSummary.leftTurns >= 3 &&
        turnSummary.leftTurns <= 10 &&
        turnSummary.rightTurns >= 3 &&
        turnSummary.rightTurns <= 10
      ) {
        selected = { points: candidate, turnSummary }
        break
      }

      if (
        !selected ||
        this.scoreTurnSummary(turnSummary) > this.scoreTurnSummary(selected.turnSummary)
      ) {
        selected = { points: candidate, turnSummary }
      }
    }

    if (!selected) {
      const fallback = this.buildRandomTrackCandidate()
      selected = {
        points: fallback,
        turnSummary: this.analyzeTurns(fallback),
      }
    }

    turnInfo.leftTurns = selected.turnSummary.leftTurns
    turnInfo.rightTurns = selected.turnSummary.rightTurns

    const trackHalfWidth = this.config.roadWidth / 2

    return {
      ...this.config,
      trackHalfWidth,
      outerHalfWidth: trackHalfWidth + this.config.shoulderWidth,
      startAngle: selected.turnSummary.startPhase * Math.PI * 2,
      startClearArc: selected.turnSummary.startClearArc,
      turnInfo,
      centerline: selected.points,
    }
  }

  private randomRange(min: number, max: number): number {
    return THREE.MathUtils.randFloat(min, max)
  }

  private randomInt(min: number, max: number): number {
    return THREE.MathUtils.randInt(min, max)
  }

  private scoreTurnSummary(turnSummary: TurnSummary): number {
    const leftPenalty =
      Math.abs(THREE.MathUtils.clamp(turnSummary.leftTurns, 3, 10) - turnSummary.leftTurns) * 10
    const rightPenalty =
      Math.abs(THREE.MathUtils.clamp(turnSummary.rightTurns, 3, 10) - turnSummary.rightTurns) * 10

    return (
      turnSummary.leftTurns +
      turnSummary.rightTurns -
      leftPenalty -
      rightPenalty -
      turnSummary.curveNoisePenalty
    )
  }

  private buildRandomTrackCandidate(): THREE.Vector3[] {
    const controlCount = this.randomInt(24, 34)
    const stretchX = this.randomRange(1.12, 1.46)
    const stretchZ = this.randomRange(0.86, 1.18)
    const baseRadius = this.randomRange(205, 255)
    const wobbleFrequencyA = this.randomInt(4, 7)
    const wobbleFrequencyB = this.randomInt(5, 10)
    const wobbleAmpA = this.randomRange(34, 58)
    const wobbleAmpB = this.randomRange(18, 36)
    const wobblePhaseA = this.randomRange(0, Math.PI * 2)
    const wobblePhaseB = this.randomRange(0, Math.PI * 2)
    const controls: THREE.Vector3[] = []

    for (let i = 0; i < controlCount; i++) {
      const angle = (i / controlCount) * Math.PI * 2
      const angularJitter = this.randomRange(-0.06, 0.06)
      const sampleAngle = angle + angularJitter
      const radius =
        baseRadius +
        Math.sin(sampleAngle * wobbleFrequencyA + wobblePhaseA) * wobbleAmpA +
        Math.sin(sampleAngle * wobbleFrequencyB + wobblePhaseB) * wobbleAmpB +
        this.randomRange(-10, 10)

      controls.push(
        new THREE.Vector3(
          Math.cos(sampleAngle) * radius * stretchX,
          this.config.roadY,
          Math.sin(sampleAngle) * radius * stretchZ
        )
      )
    }

    const curve = new THREE.CatmullRomCurve3(controls, true, 'catmullrom', 0.42)
    const points = curve.getSpacedPoints(539)
    points.pop()

    const centroid = points
      .reduce((acc, point) => acc.add(point), new THREE.Vector3())
      .multiplyScalar(1 / points.length)

    for (const point of points) {
      point.sub(centroid)
      point.y = this.config.roadY
    }

    return points
  }

  private analyzeTurns(points: THREE.Vector3[]): TurnSummary {
    const curvatureSamples: number[] = []
    const smoothed: number[] = []
    const n = points.length
    const threshold = 0.012

    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n]
      const current = points[i]
      const next = points[(i + 1) % n]

      const ax = current.x - prev.x
      const az = current.z - prev.z
      const bx = next.x - current.x
      const bz = next.z - current.z
      const aLen = Math.hypot(ax, az)
      const bLen = Math.hypot(bx, bz)

      if (aLen < 0.0001 || bLen < 0.0001) {
        curvatureSamples.push(0)
        continue
      }

      const dot = THREE.MathUtils.clamp((ax * bx + az * bz) / (aLen * bLen), -1, 1)
      const cross = ax * bz - az * bx
      curvatureSamples.push(Math.atan2(cross, dot))
    }

    for (let i = 0; i < n; i++) {
      let sum = 0
      let weightSum = 0

      for (let k = -3; k <= 3; k++) {
        const idx = (i + k + n) % n
        const weight = 4 - Math.abs(k)
        sum += curvatureSamples[idx] * weight
        weightSum += weight
      }

      smoothed.push(sum / weightSum)
    }

    const signs = smoothed.map((value) => {
      if (value > threshold) return 1
      if (value < -threshold) return -1
      return 0
    })

    const runs: TurnRun[] = []
    let currentSign = signs[0]
    let currentLength = 1

    for (let i = 1; i < signs.length; i++) {
      if (signs[i] === currentSign) {
        currentLength += 1
        continue
      }

      runs.push({ sign: currentSign, length: currentLength })
      currentSign = signs[i]
      currentLength = 1
    }
    runs.push({ sign: currentSign, length: currentLength })

    if (runs.length > 1 && runs[0].sign === runs[runs.length - 1].sign) {
      runs[0].length += runs[runs.length - 1].length
      runs.pop()
    }

    const significantRuns = runs.filter((run) => run.sign !== 0 && run.length >= 4)
    const leftTurns = significantRuns.filter((run) => run.sign > 0).length
    const rightTurns = significantRuns.filter((run) => run.sign < 0).length

    let bestStraightLength = 0
    let bestStraightIndex = 0
    let scanIndex = 0

    for (const run of runs) {
      if (run.sign === 0 && run.length > bestStraightLength) {
        bestStraightLength = run.length
        bestStraightIndex = scanIndex + Math.floor(run.length / 2)
      }
      scanIndex += run.length
    }

    if (bestStraightLength === 0) {
      let smallestCurve = Infinity
      for (let i = 0; i < smoothed.length; i++) {
        const absCurve = Math.abs(smoothed[i])
        if (absCurve < smallestCurve) {
          smallestCurve = absCurve
          bestStraightIndex = i
        }
      }
    }

    const startPhase = bestStraightIndex / n
    const startClearArc = THREE.MathUtils.clamp(
      (bestStraightLength / n) * Math.PI * 0.9,
      0.2,
      0.46
    )
    const curveNoisePenalty = runs.filter((run) => run.length <= 2).length

    return {
      leftTurns,
      rightTurns,
      startPhase,
      startClearArc,
      curveNoisePenalty,
    }
  }
}
