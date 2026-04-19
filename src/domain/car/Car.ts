import * as THREE from 'three'
import { clamp, moveTowards } from '../../utils/math'

export interface CarMotionSnapshot {
  speed: number
  steer: number
  heading: number
  yawVelocity: number
  velocity: THREE.Vector3
  driftAmount: number
  bodyRoll: number
  gear: number
  rpm: number
  shiftTimer: number
}

export class Car {
  private static readonly gearSpeedLimits = [0, 8, 15, 23, 31, 38]
  private static readonly redlineRpm = 7200
  private static readonly idleRpm = 900
  private static readonly shiftDuration = 0.34
  private static readonly nominalTopSpeed = Car.gearSpeedLimits[Car.gearSpeedLimits.length - 1]

  private static gearSpeedLimitAt(gear: number, maxForwardSpeed: number): number {
    return Car.gearSpeedLimits[gear] * (maxForwardSpeed / Car.nominalTopSpeed)
  }

  speed = 0
  steer = 0
  heading = 0
  yawVelocity = 0
  readonly velocity = new THREE.Vector3()
  driftAmount = 0
  bodyRoll = 0
  gear = 1
  rpm = Car.idleRpm
  shiftTimer = 0

  get absSpeed(): number {
    return Math.abs(this.speed)
  }

  getForward(out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    out.set(Math.sin(this.heading), 0, Math.cos(this.heading))
    return out.normalize()
  }

  signedSpeedAlongForward(out: THREE.Vector3 = new THREE.Vector3()): number {
    this.getForward(out)
    return this.velocity.dot(out)
  }

  setHeading(heading: number): void {
    this.heading = heading
  }

  updateTransmission(delta: number, maxForwardSpeed: number, throttle: number): void {
    if (this.shiftTimer > 0) {
      this.shiftTimer = Math.max(0, this.shiftTimer - delta)
    }

    const absSpeed = Math.abs(this.speed)
    const maxGear = Car.gearSpeedLimits.length - 1
    const currentLimit = Car.gearSpeedLimitAt(this.gear, maxForwardSpeed)
    const previousLimit = Car.gearSpeedLimitAt(Math.max(this.gear - 1, 0), maxForwardSpeed)
    const gearRange = Math.max(currentLimit - previousLimit, 0.001)
    const gearProgress = clamp((absSpeed - previousLimit) / gearRange, 0, 1)

    if (
      this.shiftTimer === 0 &&
      throttle > 0.05 &&
      this.gear < maxGear &&
      absSpeed > currentLimit * 0.94
    ) {
      this.gear += 1
      this.shiftTimer = Car.shiftDuration
    }

    if (
      this.shiftTimer === 0 &&
      this.gear > 1 &&
      absSpeed < Car.gearSpeedLimitAt(this.gear - 1, maxForwardSpeed) * 0.72
    ) {
      this.gear -= 1
      this.shiftTimer = Car.shiftDuration * 0.55
    }

    const rpmTarget =
      Car.idleRpm +
      gearProgress * (Car.redlineRpm - Car.idleRpm) +
      Math.max(throttle, 0) * 350
    const shiftDrop = this.shiftTimer > 0 ? 0.72 : 1
    this.rpm = THREE.MathUtils.lerp(
      this.rpm,
      clamp(rpmTarget * shiftDrop, Car.idleRpm, Car.redlineRpm),
      1 - Math.exp(-10 * delta)
    )
  }

  get shiftAccelerationFactor(): number {
    return this.shiftTimer > 0 ? 0.42 : 1
  }

  get shiftKickAmount(): number {
    if (this.shiftTimer <= 0) return 0

    return Math.sin((this.shiftTimer / Car.shiftDuration) * Math.PI)
  }

  accelerate(amount: number): void {
    this.speed += amount
  }

  moveSpeedTowardZero(amount: number): void {
    if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - amount)
    } else if (this.speed < 0) {
      this.speed = Math.min(0, this.speed + amount)
    }
  }

  dampenVelocity(factor: number): void {
    this.velocity.multiplyScalar(factor)
  }

  clampSpeed(min: number, max: number): void {
    this.speed = clamp(this.speed, min, max)
  }

  steerToward(target: number, maxStep: number): void {
    this.steer = moveTowards(this.steer, target, maxStep)
  }

  blendYawVelocity(target: number, factor: number): void {
    this.yawVelocity = THREE.MathUtils.lerp(this.yawVelocity, target, factor)
  }

  dampenYaw(rate: number, delta: number): void {
    this.yawVelocity *= Math.exp(-rate * delta)
  }

  integrateHeading(delta: number, forwardSpeed: number): void {
    if (Math.abs(forwardSpeed) > 0.05 || this.absSpeed > 0.05) {
      this.heading += this.yawVelocity * delta
    }
  }

  resolveCollision(normal: THREE.Vector3, bounce = 1.2, speedMultiplier = 0.55): void {
    const intoNormalSpeed = this.velocity.dot(normal)

    if (intoNormalSpeed < 0) {
      this.velocity.addScaledVector(normal, -intoNormalSpeed * bounce)
    }

    this.speed *= speedMultiplier
  }

  applyForwardVelocity(
    forward: THREE.Vector3,
    forwardSpeed: number,
    lateral: THREE.Vector3
  ): void {
    this.velocity.copy(forward).multiplyScalar(forwardSpeed).add(lateral)
    this.driftAmount = lateral.length()
  }

  rollToward(target: number, factor: number): void {
    this.bodyRoll = THREE.MathUtils.lerp(this.bodyRoll, target, factor)
  }

  snapshot(): CarMotionSnapshot {
    return {
      speed: this.speed,
      steer: this.steer,
      heading: this.heading,
      yawVelocity: this.yawVelocity,
      velocity: this.velocity.clone(),
      driftAmount: this.driftAmount,
      bodyRoll: this.bodyRoll,
      gear: this.gear,
      rpm: this.rpm,
      shiftTimer: this.shiftTimer,
    }
  }
}
