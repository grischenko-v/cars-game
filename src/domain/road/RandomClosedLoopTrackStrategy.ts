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

type TrackFeatureKind = 'hairpin' | 'chicane' | 'doubleApex' | 'banking' | 'sCurves'

interface TrackFeature {
  kind: TrackFeatureKind
  center: number
  width: number
  strength: number
  sign: number
}

export class RandomClosedLoopTrackStrategy implements TrackGenerationStrategy {
  constructor(
    private readonly config = {
      roadWidth: 28,
      shoulderWidth: 5,
      roadY: 0.24,
      shoulderY: 0.17,
      apronY: 0.12,
      shoulderBlend: 5.5,
      terrainBlend: 24,
      cutDepth: 0.22,
      terrainCalmDistance: 34,
      terrainCalmFactor: 0.08,
      terrainHardMargin: 4.5,
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
    const controlCount = this.randomInt(18, 24)
    const stretchX = this.randomRange(1.18, 1.52)
    const stretchZ = this.randomRange(0.92, 1.24)
    const baseRadius = this.randomRange(380, 470)
    const wobbleFrequencyA = this.randomInt(3, 5)
    const wobbleFrequencyB = this.randomInt(4, 6)
    const wobbleAmpA = this.randomRange(24, 46)
    const wobbleAmpB = this.randomRange(12, 28)
    const wobblePhaseA = this.randomRange(0, Math.PI * 2)
    const wobblePhaseB = this.randomRange(0, Math.PI * 2)
    const features = this.buildTrackFeatures()
    const controls: THREE.Vector3[] = []

    for (let i = 0; i < controlCount; i++) {
      const angle = (i / controlCount) * Math.PI * 2
      const angularJitter = this.randomRange(-0.035, 0.035)
      const phase = i / controlCount
      const angleOffset = this.getFeatureAngleOffset(phase, features)
      const sampleAngle = angle + angularJitter + angleOffset
      const featureRadiusOffset = this.getFeatureRadiusOffset(phase, features)
      const radius = Math.max(
        baseRadius * 0.54,
        baseRadius +
          Math.sin(sampleAngle * wobbleFrequencyA + wobblePhaseA) * wobbleAmpA +
          Math.sin(sampleAngle * wobbleFrequencyB + wobblePhaseB) * wobbleAmpB +
          featureRadiusOffset +
          this.randomRange(-6, 6)
      )

      controls.push(
        new THREE.Vector3(
          Math.cos(sampleAngle) * radius * stretchX,
          this.config.roadY,
          Math.sin(sampleAngle) * radius * stretchZ
        )
      )
    }

    const curve = new THREE.CatmullRomCurve3(controls, true, 'catmullrom', 0.24)
    const points = curve.getSpacedPoints(959)
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

  private buildTrackFeatures(): TrackFeature[] {
    const baseCenters = [0.16, 0.34, 0.52, 0.68, 0.84]
    const jitter = () => this.randomRange(-0.035, 0.035)

    return [
      {
        kind: 'hairpin',
        center: THREE.MathUtils.euclideanModulo(baseCenters[0] + jitter(), 1),
        width: this.randomRange(0.045, 0.062),
        strength: this.randomRange(120, 165),
        sign: Math.random() > 0.5 ? 1 : -1,
      },
      {
        kind: 'chicane',
        center: THREE.MathUtils.euclideanModulo(baseCenters[1] + jitter(), 1),
        width: this.randomRange(0.055, 0.075),
        strength: this.randomRange(44, 68),
        sign: Math.random() > 0.5 ? 1 : -1,
      },
      {
        kind: 'doubleApex',
        center: THREE.MathUtils.euclideanModulo(baseCenters[2] + jitter(), 1),
        width: this.randomRange(0.085, 0.12),
        strength: this.randomRange(58, 86),
        sign: Math.random() > 0.5 ? 1 : -1,
      },
      {
        kind: 'banking',
        center: THREE.MathUtils.euclideanModulo(baseCenters[3] + jitter(), 1),
        width: this.randomRange(0.085, 0.13),
        strength: this.randomRange(48, 72),
        sign: Math.random() > 0.5 ? 1 : -1,
      },
      {
        kind: 'sCurves',
        center: THREE.MathUtils.euclideanModulo(baseCenters[4] + jitter(), 1),
        width: this.randomRange(0.09, 0.13),
        strength: this.randomRange(44, 66),
        sign: Math.random() > 0.5 ? 1 : -1,
      },
    ]
  }

  private getFeatureRadiusOffset(phase: number, features: TrackFeature[]): number {
    return features.reduce((offset, feature) => {
      const local = this.normalizedFeatureDistance(phase, feature.center, feature.width)
      const envelope = Math.exp(-local * local * 2.3)

      if (Math.abs(local) > 1.7) return offset

      switch (feature.kind) {
        case 'hairpin':
          return offset - feature.strength * envelope
        case 'chicane':
          return (
            offset +
            feature.sign * feature.strength * Math.sin(local * Math.PI * 2.1) * envelope
          )
        case 'doubleApex': {
          const apexA = Math.exp(-Math.pow(local + 0.55, 2) * 8)
          const apexB = Math.exp(-Math.pow(local - 0.55, 2) * 8)
          const middleRelease = Math.exp(-local * local * 12)
          return offset + feature.sign * feature.strength * (apexA + apexB - middleRelease * 0.48)
        }
        case 'banking':
          return offset + feature.sign * feature.strength * envelope
        case 'sCurves':
          return offset + feature.sign * feature.strength * Math.sin(local * Math.PI * 3) * envelope
      }

      return offset
    }, 0)
  }

  private getFeatureAngleOffset(phase: number, features: TrackFeature[]): number {
    return features.reduce((offset, feature) => {
      const local = this.normalizedFeatureDistance(phase, feature.center, feature.width)
      const envelope = Math.exp(-local * local * 2.8)

      if (Math.abs(local) > 1.7) return offset

      switch (feature.kind) {
        case 'hairpin':
          return offset + feature.sign * 0.18 * Math.sin(local * Math.PI) * envelope
        case 'chicane':
          return offset + feature.sign * 0.055 * Math.sin(local * Math.PI * 2) * envelope
        case 'doubleApex':
          return offset + feature.sign * 0.045 * Math.sin(local * Math.PI * 0.9) * envelope
        case 'banking':
          return offset + feature.sign * 0.035 * Math.sin(local * Math.PI * 0.7) * envelope
        case 'sCurves':
          return offset + feature.sign * 0.065 * Math.sin(local * Math.PI * 3) * envelope
      }

      return offset
    }, 0)
  }

  private normalizedFeatureDistance(phase: number, center: number, width: number): number {
    const delta = Math.atan2(
      Math.sin((phase - center) * Math.PI * 2),
      Math.cos((phase - center) * Math.PI * 2)
    ) / (Math.PI * 2)

    return delta / width
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
