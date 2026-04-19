import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clamp, expLerpFactor, lerpAngle } from '../../utils/math'
import type { CarView } from '../../infrastructure/graphics/CarView'

const CAMERA_TARGET_HEIGHT = 0.9
const BASE_FOV = 60
const MAX_SPEED_REFERENCE = 38

export class FollowCameraController {
  readonly controls: OrbitControls

  private readonly fallback = {
    delay: 1.4,
    restoring: false,
  }
  private lastUserOrbitTime = performance.now()
  private readonly tmpForward = new THREE.Vector3()
  private readonly tmpCarPosition = new THREE.Vector3()
  private readonly tmpToCamera = new THREE.Vector3()
  private readonly tmpDesired = new THREE.Vector3()
  private readonly tmpSpherical = new THREE.Spherical()
  private readonly previousShakeOffset = new THREE.Vector3()
  private speedEffectTime = 0

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    domElement: HTMLElement
  ) {
    this.controls = new OrbitControls(camera, domElement)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 3
    this.controls.maxDistance = 14
    this.controls.maxPolarAngle = Math.PI * 0.48
    this.controls.target.set(0, 1, 0)
    this.controls.addEventListener('start', this.handleUserOrbit)
    this.controls.addEventListener('change', this.handleUserOrbitChange)
  }

  focusOn(car: CarView, heading: number): void {
    const carPosition = car.copyPosition(this.tmpCarPosition)
    this.getForwardFromHeading(heading, this.tmpForward)
    this.controls.target.set(
      carPosition.x,
      carPosition.y + CAMERA_TARGET_HEIGHT,
      carPosition.z
    )
    this.camera.position.set(
      carPosition.x - this.tmpForward.x * 6.2,
      carPosition.y + 2.2,
      carPosition.z - this.tmpForward.z * 6.2
    )
    this.controls.update()
  }

  update(car: CarView | null, heading: number, speed: number, delta: number): void {
    if (!car) return

    this.camera.position.sub(this.previousShakeOffset)
    this.previousShakeOffset.set(0, 0, 0)

    const carPosition = car.copyPosition(this.tmpCarPosition)
    this.tmpDesired.set(carPosition.x, carPosition.y + CAMERA_TARGET_HEIGHT, carPosition.z)
    this.controls.target.lerp(this.tmpDesired, expLerpFactor(8, delta))

    const sinceOrbit = (performance.now() - this.lastUserOrbitTime) / 1000
    if (sinceOrbit > this.fallback.delay) {
      this.fallback.restoring = true
    }

    if (this.fallback.restoring) {
      this.restoreBehindCar(car, heading, speed, delta)
    }

    this.controls.update()
    this.updateSpeedFeel(speed, delta)
  }

  dispose(): void {
    this.controls.removeEventListener('start', this.handleUserOrbit)
    this.controls.removeEventListener('change', this.handleUserOrbitChange)
    this.controls.dispose()
  }

  private restoreBehindCar(
    car: CarView,
    heading: number,
    speed: number,
    delta: number
  ): void {
    const carPosition = car.copyPosition(this.tmpCarPosition)
    this.getForwardFromHeading(heading, this.tmpForward)

    const desiredDistance = 5.8 + clamp(Math.abs(speed) / 24, 0, 2.4)
    const desiredHeight = 2.2 + clamp(Math.abs(speed) / 42, 0, 0.9)

    this.tmpDesired.set(
      carPosition.x - this.tmpForward.x * desiredDistance,
      carPosition.y + desiredHeight,
      carPosition.z - this.tmpForward.z * desiredDistance
    )
    this.camera.position.lerp(this.tmpDesired, expLerpFactor(2.2, delta))

    this.tmpToCamera.copy(this.camera.position).sub(this.controls.target)
    this.tmpSpherical.setFromVector3(this.tmpToCamera)

    const targetYaw = Math.atan2(this.tmpToCamera.x, this.tmpToCamera.z)
    const behindYaw = Math.atan2(-this.tmpForward.x, -this.tmpForward.z)
    const blendedYaw = lerpAngle(targetYaw, behindYaw, expLerpFactor(2.2, delta))

    this.tmpSpherical.theta = blendedYaw
    this.tmpSpherical.phi = clamp(this.tmpSpherical.phi, 0.55, 1.25)
    this.tmpSpherical.radius = THREE.MathUtils.lerp(
      this.tmpSpherical.radius,
      desiredDistance,
      expLerpFactor(2.2, delta)
    )

    this.tmpDesired.setFromSpherical(this.tmpSpherical).add(this.controls.target)
    this.camera.position.lerp(this.tmpDesired, expLerpFactor(4, delta))
  }

  private getForwardFromHeading(heading: number, out: THREE.Vector3): THREE.Vector3 {
    out.set(Math.sin(heading), 0, Math.cos(heading))
    return out.normalize()
  }

  private updateSpeedFeel(speed: number, delta: number): void {
    const speedRatio = clamp(Math.abs(speed) / MAX_SPEED_REFERENCE, 0, 1)
    const effect = THREE.MathUtils.smoothstep(speedRatio, 0.34, 1)
    const targetFov = BASE_FOV + effect * 15
    const nextFov = THREE.MathUtils.lerp(this.camera.fov, targetFov, expLerpFactor(3.6, delta))

    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov
      this.camera.updateProjectionMatrix()
    }

    if (effect <= 0.01) return

    this.speedEffectTime += delta * (12 + effect * 24)
    const shakeAmount = effect * 0.045
    this.previousShakeOffset.set(
      Math.sin(this.speedEffectTime * 1.73) * shakeAmount,
      Math.sin(this.speedEffectTime * 2.31 + 1.7) * shakeAmount * 0.52,
      0
    )
    this.camera.position.add(this.previousShakeOffset)
  }

  private readonly handleUserOrbit = (): void => {
    this.lastUserOrbitTime = performance.now()
    this.fallback.restoring = false
  }

  private readonly handleUserOrbitChange = (): void => {
    this.lastUserOrbitTime = performance.now()
  }
}
