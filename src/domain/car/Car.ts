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
}

export class Car {
  speed = 0
  steer = 0
  heading = 0
  yawVelocity = 0
  readonly velocity = new THREE.Vector3()
  driftAmount = 0
  bodyRoll = 0

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
    }
  }
}
