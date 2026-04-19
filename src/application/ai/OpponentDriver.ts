import * as THREE from 'three'
import { Car } from '../../domain/car/Car'
import { clamp } from '../../utils/math'
import type { Road } from '../../world/Road'

export interface OpponentControls {
  throttle: number
  steer: number
  brake: boolean
  speedFactor: number
}

export interface OpponentDriverConfig {
  maxSpeed: number
  maxSteer: number
  speedFactor: number
  aggression?: number
  lineBias?: number
}

export class OpponentDriver {
  private readonly target = new THREE.Vector3()
  private readonly tangent = new THREE.Vector3()
  private readonly nextTangent = new THREE.Vector3()
  private readonly curveProbePoint = new THREE.Vector3()
  private readonly side = new THREE.Vector3()
  private readonly toTarget = new THREE.Vector3()

  constructor(private readonly config: OpponentDriverConfig) {}

  decide(car: Car, road: Road, position: THREE.Vector3, canDrive: boolean): OpponentControls {
    if (!canDrive) {
      return { throttle: 0, steer: 0, brake: false, speedFactor: this.config.speedFactor }
    }

    const roadBand = road.getBandData(position.x, position.z)
    const speedRatio = clamp(car.absSpeed / this.config.maxSpeed, 0, 1)
    const aggression = this.config.aggression ?? 0.7
    const lookAhead = THREE.MathUtils.lerp(18, 46, speedRatio)
    const curveProbe = THREE.MathUtils.lerp(34, 76, speedRatio)

    road.sampleCenterlineByDistance(roadBand.distanceAlong + lookAhead, this.target, this.tangent)
    road.sampleCenterlineByDistance(
      roadBand.distanceAlong + curveProbe,
      this.curveProbePoint,
      this.nextTangent
    )

    const turnSign = this.tangent.x * this.nextTangent.z - this.tangent.z * this.nextTangent.x
    const tangentDot = clamp(this.tangent.dot(this.nextTangent), -1, 1)
    const curveAngle = Math.atan2(turnSign, tangentDot)
    const curveAmount = clamp(Math.abs(curveAngle) / 0.72, 0, 1)
    const insideSign = turnSign < 0 ? 1 : -1
    const insideOffset =
      road.trackHalfWidth *
      (0.28 + aggression * 0.2) *
      curveAmount *
      insideSign
    const laneBias = road.trackHalfWidth * (this.config.lineBias ?? 0) * 0.28

    this.side.set(-this.tangent.z, 0, this.tangent.x).normalize()
    this.target.addScaledVector(this.side, insideOffset + laneBias)
    this.toTarget.subVectors(this.target, position)

    const desiredHeading = Math.atan2(this.toTarget.x, this.toTarget.z)
    const headingError =
      THREE.MathUtils.euclideanModulo(desiredHeading - car.heading + Math.PI, Math.PI * 2) -
      Math.PI
    this.side.set(-roadBand.tangent.z, 0, roadBand.tangent.x).normalize()
    const lateralError =
      this.side.dot(this.toTarget.subVectors(position, roadBand.nearestPoint)) /
      Math.max(road.trackHalfWidth, 0.001)
    const steer = clamp(
      (headingError * (1.65 + aggression * 0.45) - lateralError * 0.42) /
        this.config.maxSteer,
      -1,
      1
    )
    const curveSpeedFactor = THREE.MathUtils.lerp(1, 0.74, curveAmount)
    const headingSpeedFactor = THREE.MathUtils.lerp(
      1,
      0.72,
      clamp(Math.abs(headingError) / 0.95, 0, 1)
    )
    const speedFactor = this.config.speedFactor * curveSpeedFactor * headingSpeedFactor
    const targetSpeed = this.config.maxSpeed * speedFactor
    const overspeed = car.speed - targetSpeed
    const throttle = overspeed > 1.2 ? -0.72 : 1
    const brake =
      overspeed > 3.2 ||
      (curveAmount > 0.72 && speedRatio > 0.58 && Math.abs(headingError) > 0.38)

    return {
      throttle,
      steer,
      brake,
      speedFactor,
    }
  }
}
