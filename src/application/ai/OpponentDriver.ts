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
    const lookAhead = THREE.MathUtils.lerp(12, 32, speedRatio)
    const curveProbe = THREE.MathUtils.lerp(20, 38, speedRatio)

    road.sampleCenterlineByDistance(roadBand.distanceAlong + lookAhead, this.target, this.tangent)
    road.sampleCenterlineByDistance(
      roadBand.distanceAlong + curveProbe,
      this.curveProbePoint,
      this.nextTangent
    )

    const turnSign = this.tangent.x * this.nextTangent.z - this.tangent.z * this.nextTangent.x
    const curveAmount = clamp(Math.abs(turnSign) * 3.1, 0, 1)
    const insideOffset = road.trackHalfWidth * 0.38 * curveAmount * (turnSign < 0 ? 1 : -1)

    this.side.set(-this.tangent.z, 0, this.tangent.x).normalize()
    this.target.addScaledVector(this.side, insideOffset)
    this.toTarget.subVectors(this.target, position)

    const desiredHeading = Math.atan2(this.toTarget.x, this.toTarget.z)
    const headingError =
      THREE.MathUtils.euclideanModulo(desiredHeading - car.heading + Math.PI, Math.PI * 2) -
      Math.PI
    const steer = clamp((headingError * 1.55) / this.config.maxSteer, -1, 1)
    const curveSpeedFactor = THREE.MathUtils.lerp(1, 0.62, curveAmount)
    const headingSpeedFactor = THREE.MathUtils.lerp(1, 0.62, clamp(Math.abs(headingError) / 0.9, 0, 1))
    const speedFactor = this.config.speedFactor * curveSpeedFactor * headingSpeedFactor
    const targetSpeed = this.config.maxSpeed * speedFactor
    const throttle = car.speed < targetSpeed ? 1 : -0.6

    return {
      throttle,
      steer,
      brake: false,
      speedFactor,
    }
  }
}
