import * as THREE from 'three'
import { Car } from '../../domain/car/Car'
import type { RoadBandData } from '../../domain/road/TrackModel'
import { clamp } from '../../utils/math'
import type { Road } from '../../world/Road'
import type { RacingLinePlan } from './RacingLinePlan'

export interface OpponentControls {
  throttle: number
  steer: number
  brake: boolean
  speedFactor: number
  accelerationFactor: number
}

export interface OpponentDriverConfig {
  maxSpeed: number
  maxSteer: number
  speedFactor: number
  accelerationFactor?: number
  aggression?: number
  lineBias?: number
}

export class OpponentDriver {
  private readonly racingLineSafety = 0.74
  private racingLinePlan: RacingLinePlan | null = null
  private readonly target = new THREE.Vector3()
  private readonly tangent = new THREE.Vector3()
  private readonly candidate = new THREE.Vector3()
  private readonly candidateTangent = new THREE.Vector3()
  private readonly candidateSide = new THREE.Vector3()
  private readonly candidateToCar = new THREE.Vector3()
  private readonly side = new THREE.Vector3()
  private readonly toTarget = new THREE.Vector3()
  private readonly currentTangent = new THREE.Vector3()
  private readonly brakeTangentA = new THREE.Vector3()
  private readonly brakeTangentB = new THREE.Vector3()
  private readonly brakePoint = new THREE.Vector3()

  constructor(private readonly config: OpponentDriverConfig) {}

  setRacingLinePlan(plan: RacingLinePlan): void {
    this.racingLinePlan = plan
  }

  decide(
    car: Car,
    road: Road,
    position: THREE.Vector3,
    canDrive: boolean,
    roadBand?: RoadBandData
  ): OpponentControls {
    if (!canDrive) {
      return {
        throttle: 0,
        steer: 0,
        brake: false,
        speedFactor: this.config.speedFactor,
        accelerationFactor: this.config.accelerationFactor ?? 1,
      }
    }

    roadBand ??= road.getBandData(position.x, position.z)
    const speedRatio = clamp(car.absSpeed / this.config.maxSpeed, 0, 1)
    const aggression = this.config.aggression ?? 0.7
    const planControls = this.decideFromRacingLinePlan(
      car,
      roadBand.distanceAlong,
      roadBand.halfWidth,
      roadBand.distFromRoadCenter,
      roadBand.lateralOffset,
      position,
      speedRatio,
      aggression
    )

    if (planControls) return planControls

    const lookAhead = THREE.MathUtils.lerp(26, 68, speedRatio)

    this.currentTangent.copy(roadBand.tangent).normalize()
    this.side.set(-this.currentTangent.z, 0, this.currentTangent.x).normalize()
    const lateralError =
      this.side.dot(this.toTarget.subVectors(position, roadBand.nearestPoint)) /
      Math.max(roadBand.halfWidth, 0.001)
    const asphaltLimitPressure = clamp(
      (roadBand.distFromRoadCenter - roadBand.halfWidth * 0.72) /
        Math.max(roadBand.halfWidth * 0.28, 0.001),
      0,
      1
    )
    const racingTarget = this.chooseRacingTarget(
      road,
      roadBand.distanceAlong,
      lookAhead,
      position,
      car.heading,
      aggression,
      asphaltLimitPressure
    )
    this.toTarget.subVectors(this.target, position)
    const desiredHeading = Math.atan2(this.toTarget.x, this.toTarget.z)
    const headingError =
      THREE.MathUtils.euclideanModulo(desiredHeading - car.heading + Math.PI, Math.PI * 2) -
      Math.PI
    const steer = clamp(
      (headingError * (1.95 + aggression * 0.62) -
        lateralError * 1.25) /
        this.config.maxSteer,
      -1,
      1
    )
    const baseTopSpeed = this.config.maxSpeed * this.config.speedFactor
    const brakePlan = this.getBrakePlan(
      road,
      roadBand.distanceAlong,
      car.absSpeed,
      baseTopSpeed,
      aggression
    )
    const curveSpeedFactor = THREE.MathUtils.lerp(
      1,
      0.76 + aggression * 0.12,
      racingTarget.curveAmount
    )
    const headingSpeedFactor = THREE.MathUtils.lerp(
      1,
      0.82,
      clamp(Math.abs(headingError) / 1.2, 0, 1)
    )
    const surfaceSpeedFactor = THREE.MathUtils.lerp(1, 0.74, asphaltLimitPressure)
    const speedFactor =
      this.config.speedFactor *
      Math.min(curveSpeedFactor, brakePlan.speedFactor) *
      headingSpeedFactor *
      surfaceSpeedFactor
    const targetSpeed = this.config.maxSpeed * speedFactor
    const overspeed = car.speed - targetSpeed
    const throttle =
      brakePlan.shouldBrake || overspeed > 3
        ? -1
        : overspeed > 0.8
          ? 0
          : 1
    const brake =
      brakePlan.shouldBrake ||
      overspeed > 4.2 ||
      (asphaltLimitPressure > 0.88 && speedRatio > 0.62)

    return {
      throttle,
      steer,
      brake,
      speedFactor,
      accelerationFactor: this.config.accelerationFactor ?? 1,
    }
  }

  private decideFromRacingLinePlan(
    car: Car,
    distanceAlong: number,
    trackHalfWidth: number,
    distFromRoadCenter: number,
    lateralOffset: number,
    position: THREE.Vector3,
    speedRatio: number,
    aggression: number
  ): OpponentControls | null {
    if (!this.racingLinePlan) return null

    const lookAhead = THREE.MathUtils.lerp(30, 78, speedRatio)
    const sample = this.sampleRacingLine(distanceAlong + lookAhead)
    const sideX = -this.tangent.z
    const sideZ = this.tangent.x
    const lineBiasOffset = sample.halfWidth * (this.config.lineBias ?? 0) * 0.055

    this.target.x += sideX * lineBiasOffset
    this.target.z += sideZ * lineBiasOffset
    this.toTarget.subVectors(this.target, position)

    const desiredHeading = Math.atan2(this.toTarget.x, this.toTarget.z)
    const headingError =
      THREE.MathUtils.euclideanModulo(desiredHeading - car.heading + Math.PI, Math.PI * 2) -
      Math.PI
    const lateralError = lateralOffset / Math.max(trackHalfWidth, 0.001)
    const asphaltLimitPressure = clamp(
      (distFromRoadCenter - trackHalfWidth * 0.76) / Math.max(trackHalfWidth * 0.24, 0.001),
      0,
      1
    )
    const steer = clamp(
      (headingError * (2.08 + aggression * 0.62) - lateralError * 1.18) /
        this.config.maxSteer,
      -1,
      1
    )
    const curveSpeedFactor = THREE.MathUtils.lerp(sample.speedFactor, 1, aggression * 0.18)
    const headingSpeedFactor = THREE.MathUtils.lerp(
      1,
      0.84,
      clamp(Math.abs(headingError) / 1.15, 0, 1)
    )
    const surfaceSpeedFactor = THREE.MathUtils.lerp(1, 0.78, asphaltLimitPressure)
    const speedFactor =
      this.config.speedFactor * curveSpeedFactor * headingSpeedFactor * surfaceSpeedFactor
    const targetSpeed = this.config.maxSpeed * speedFactor
    const overspeed = car.speed - targetSpeed
    const shouldBrake =
      overspeed > THREE.MathUtils.lerp(5.4, 2.4, sample.curveAmount) ||
      (asphaltLimitPressure > 0.9 && speedRatio > 0.68)
    const throttle = shouldBrake ? -1 : overspeed > 1.1 ? 0 : 1

    return {
      throttle,
      steer,
      brake: shouldBrake,
      speedFactor,
      accelerationFactor: this.config.accelerationFactor ?? 1,
    }
  }

  private sampleRacingLine(distance: number): {
    halfWidth: number
    speedFactor: number
    curveAmount: number
  } {
    const plan = this.racingLinePlan as RacingLinePlan
    const count = plan.x.length
    const loopDistance = THREE.MathUtils.euclideanModulo(distance, plan.totalLength)
    const rawIndex = loopDistance / plan.sampleSpacing
    const index = Math.floor(rawIndex) % count
    const nextIndex = (index + 1) % count
    const t = rawIndex - Math.floor(rawIndex)

    this.target.set(
      THREE.MathUtils.lerp(plan.x[index], plan.x[nextIndex], t),
      0,
      THREE.MathUtils.lerp(plan.z[index], plan.z[nextIndex], t)
    )
    this.tangent
      .set(
        THREE.MathUtils.lerp(plan.tangentX[index], plan.tangentX[nextIndex], t),
        0,
        THREE.MathUtils.lerp(plan.tangentZ[index], plan.tangentZ[nextIndex], t)
      )
      .normalize()

    return {
      halfWidth: THREE.MathUtils.lerp(plan.halfWidth[index], plan.halfWidth[nextIndex], t),
      speedFactor: THREE.MathUtils.lerp(
        plan.speedFactor[index],
        plan.speedFactor[nextIndex],
        t
      ),
      curveAmount: THREE.MathUtils.lerp(
        plan.curveAmount[index],
        plan.curveAmount[nextIndex],
        t
      ),
    }
  }

  private chooseRacingTarget(
    road: Road,
    distanceAlong: number,
    lookAhead: number,
    position: THREE.Vector3,
    heading: number,
    aggression: number,
    asphaltLimitPressure: number
  ): { curveAmount: number } {
    const targetDistance = distanceAlong + lookAhead
    const trackHalfWidth = road.getTrackHalfWidthAtDistance(targetDistance)
    const safeAsphaltOffset = trackHalfWidth * this.racingLineSafety
    const idealOffset = this.getIdealRacingOffset(
      road,
      targetDistance,
      safeAsphaltOffset,
      aggression
    )
    const candidateFractions = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1]
    let bestScore = -Infinity
    let bestCurveAmount = 0

    for (const fraction of candidateFractions) {
      const offset = safeAsphaltOffset * fraction
      road.sampleCenterlineByDistance(targetDistance, this.candidate, this.candidateTangent)
      this.candidateSide.set(-this.candidateTangent.z, 0, this.candidateTangent.x).normalize()
      this.candidate.addScaledVector(this.candidateSide, offset)
      this.candidateToCar.subVectors(this.candidate, position)

      const desiredHeading = Math.atan2(this.candidateToCar.x, this.candidateToCar.z)
      const headingError = Math.abs(
        THREE.MathUtils.euclideanModulo(desiredHeading - heading + Math.PI, Math.PI * 2) -
          Math.PI
      )
      const curveAmount = this.getFutureCurveAmount(road, targetDistance + lookAhead * 0.72)
      const idealPenalty = Math.abs(offset - idealOffset) / Math.max(safeAsphaltOffset, 0.001)
      const edgePenalty = Math.pow(Math.abs(offset) / Math.max(trackHalfWidth, 0.001), 4)
      const recoveryPenalty =
        asphaltLimitPressure > 0
          ? Math.abs(offset) / Math.max(safeAsphaltOffset, 0.001) * asphaltLimitPressure * 1.8
          : 0
      const score =
        1 -
        idealPenalty * 1.65 -
        headingError * 0.45 -
        edgePenalty * 0.42 -
        curveAmount * 0.12 -
        recoveryPenalty

      if (score > bestScore) {
        bestScore = score
        bestCurveAmount = curveAmount
        this.target.copy(this.candidate)
        this.tangent.copy(this.candidateTangent)
      }
    }

    return { curveAmount: bestCurveAmount }
  }

  private getIdealRacingOffset(
    road: Road,
    distance: number,
    safeAsphaltOffset: number,
    aggression: number
  ): number {
    const entryCurve = this.getSignedFutureCurve(road, distance + 55)
    const apexCurve = this.getSignedFutureCurve(road, distance + 118)
    const exitCurve = this.getSignedFutureCurve(road, distance + 190)
    const dominantCurve =
      Math.abs(apexCurve) >= Math.abs(entryCurve) ? apexCurve : entryCurve
    const insideSign = dominantCurve < 0 ? 1 : -1
    const entryAmount = clamp(Math.abs(entryCurve) / 0.84, 0, 1)
    const apexAmount = clamp(Math.abs(apexCurve) / 0.84, 0, 1)
    const exitAmount = clamp(Math.abs(exitCurve) / 0.84, 0, 1)
    const outsidePrep = -insideSign * safeAsphaltOffset * entryAmount * 0.42
    const apexCut = insideSign * safeAsphaltOffset * apexAmount * (0.46 + aggression * 0.16)
    const exitOpen = -insideSign * safeAsphaltOffset * exitAmount * 0.28
    const lineBias =
      road.getTrackHalfWidthAtDistance(distance) * (this.config.lineBias ?? 0) * 0.06

    return clamp(
      outsidePrep + apexCut + exitOpen + lineBias,
      -safeAsphaltOffset,
      safeAsphaltOffset
    )
  }

  private getBrakePlan(
    road: Road,
    distanceAlong: number,
    currentSpeed: number,
    topSpeed: number,
    aggression: number
  ): { speedFactor: number; shouldBrake: boolean } {
    const probeDistances = [44, 78, 118, 166, 224]
    const deceleration = 96 + aggression * 22
    let plannedSpeed = topSpeed
    let shouldBrake = false

    for (const distance of probeDistances) {
      const curveAmount = this.getFutureCurveAmount(road, distanceAlong + distance)
      const safeSpeedFactor = THREE.MathUtils.lerp(1, 0.68 + aggression * 0.14, curveAmount)
      const safeSpeed = topSpeed * safeSpeedFactor
      plannedSpeed = Math.min(plannedSpeed, safeSpeed)

      const brakingDistance =
        currentSpeed > safeSpeed
          ? (currentSpeed * currentSpeed - safeSpeed * safeSpeed) / (2 * deceleration)
          : 0

      if (brakingDistance > distance * (1.16 + aggression * 0.18)) {
        shouldBrake = true
      }
    }

    return {
      speedFactor: clamp(plannedSpeed / Math.max(topSpeed, 0.001), 0.64, 1),
      shouldBrake,
    }
  }

  private getFutureCurveAmount(road: Road, distance: number): number {
    return clamp(Math.abs(this.getSignedFutureCurve(road, distance)) / 0.84, 0, 1)
  }

  private getSignedFutureCurve(road: Road, distance: number): number {
    road.sampleCenterlineByDistance(distance, this.brakePoint, this.brakeTangentA)
    road.sampleCenterlineByDistance(distance + 52, this.brakePoint, this.brakeTangentB)

    const turnSign =
      this.brakeTangentA.x * this.brakeTangentB.z -
      this.brakeTangentA.z * this.brakeTangentB.x
    const tangentDot = clamp(this.brakeTangentA.dot(this.brakeTangentB), -1, 1)
    return Math.atan2(turnSign, tangentDot)
  }
}
