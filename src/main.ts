import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clamp, expLerpFactor } from './utils/math'
import { Car as CarAggregate } from './domain/car/Car'
import { Race } from './domain/race/Race'
import type { RoadSurfaceData } from './domain/road/TrackModel'
import { KeyboardInput } from './application/input/KeyboardInput'
import { FollowCameraController } from './application/camera/FollowCameraController'
import { OpponentDriver } from './application/ai/OpponentDriver'
import { HudView } from './application/ui/HudView'
import { LoadingView } from './application/ui/LoadingView'
import { MinimapView } from './application/ui/MinimapView'
import { PositionLabelView } from './application/ui/PositionLabelView'
import { StandingsView } from './application/ui/StandingsView'
import { CarShadow } from './infrastructure/effects/CarShadow'
import { SkidTrailRenderer } from './infrastructure/effects/SkidTrailRenderer'
import { SpeedLinesOverlay } from './infrastructure/effects/SpeedLinesOverlay'
import { CarView } from './infrastructure/graphics/CarView'
import { publicAssetUrl } from './infrastructure/graphics/TextureFactory'
import { GameRenderer } from './infrastructure/rendering/GameRenderer'
import { LightingFactory } from './infrastructure/rendering/LightingFactory'
import { NameGenerator } from './domain/race/NameGenerator'
import { Road } from './world/Road'
import { Terrain } from './world/Terrain'
import { Decorations } from './world/Decorations'
import { RaceStandings } from './domain/race/RaceStandings'

const gameRenderer = new GameRenderer()
const { scene, camera, renderer } = gameRenderer
const hud = new HudView()
const loadingView = new LoadingView()
const standingsView = new StandingsView()
const positionLabelView = new PositionLabelView()
const keyboardInput = new KeyboardInput()
const keys = keyboardInput.keys
new LightingFactory().attachTo(scene)

const TARGET_LAPS = 3
const road = new Road()
const race = new Race(TARGET_LAPS, road.startAngle, road.totalLength)
const raceStandings = new RaceStandings()
const nameGenerator = new NameGenerator()
const terrain = new Terrain(scene, road)
road.attachTo(scene)
const decorations = new Decorations(scene, terrain, road)
const minimap = new MinimapView(road)
const cameraRig = new FollowCameraController(camera, renderer.domElement)
const skidTrail = new SkidTrailRenderer(scene)
const carShadow = new CarShadow(scene)
const speedLines = new SpeedLinesOverlay()

let carView: CarView | null = null
let carLocalMinY = 0
let carLocalMaxX = 0
let carLocalMinX = 0
let carLocalMaxZ = 0
let carLocalMinZ = 0
let carRideHeightOffset = 0.14
const OPPONENT_RIDE_HEIGHT_EXTRA = 0.34

const carAggregate = new CarAggregate()
standingsView.updateRace(0, TARGET_LAPS, 0, 0, [], false)

const MAX_FORWARD_SPEED = 38
const MAX_REVERSE_SPEED = 8
const BASE_ACCEL = 22
const BASE_BRAKE = 24
const NATURAL_DRAG = 5.8
const ROLLING_DRAG = 3.4
const MAX_STEER = 0.62
const STEER_SPEED = 3.3
const STEER_RETURN = 4.6
const TURN_RATE = 2.25
const HANDBRAKE_DRAG = 13.5
const GRIP_NORMAL = 8.8
const GRIP_HANDBRAKE = 4.8
const HEIGHT_SMOOTHNESS = 10
const TILT_SMOOTHNESS = 8
const CAR_COLLIDER_RADIUS = 1.05
const COMPETITOR_COLLIDER_RADIUS = 1.8
const CAR_GROUND_CLEARANCE = 0.05
const LATERAL_GRIP_ROAD = 8.6
const LATERAL_GRIP_OFFROAD = 3.6
const YAW_RESPONSE_ROAD = 5.4
const YAW_RESPONSE_OFFROAD = 3.0
const YAW_DAMPING = 3.0
const DRIFT_SLIP_ASSIST = 1.15
const DRIFT_RECOVERY = 5.0
const BODY_ROLL_AMOUNT = 0.13
const HUD_SPEED_MULTIPLIER = 5.4
const SHOULDER_SPEED_DRAG = 7.5
const APRON_SPEED_DRAG = 11.5
const GRASS_SPEED_DRAG = 18.5
const SHOULDER_VELOCITY_DAMP = 0.985
const APRON_VELOCITY_DAMP = 0.975
const GRASS_VELOCITY_DAMP = 0.955
const COUNTDOWN_SECONDS = 3
const COUNTDOWN_GO_HOLD_SECONDS = 0.65
const PLAYER_START_GRID_OFFSET = -5.1
const OPPONENT_START_GRID_OFFSET = -12.2
const OPPONENT_LATERAL_OFFSET_FACTOR = 0.24

type GamePhase = 'loading' | 'countdown' | 'running' | 'finished'

interface Competitor {
  id: string
  name: string
  isPlayer: boolean
  car: CarAggregate
  view: CarView
  race: Race
  driver: OpponentDriver | null
  minimapColor: string
}

interface DriveControls {
  throttle: number
  steer: number
  brake: boolean
  canDrive: boolean
  maxForwardSpeed: number
  extraRideHeight: number
}

const clock = new THREE.Clock()

const tmpVecA = new THREE.Vector3()
const tmpVecB = new THREE.Vector3()
const tmpVecC = new THREE.Vector3()
const tmpVecE = new THREE.Vector3()
const tmpCarPosition = new THREE.Vector3()
const tmpRight = new THREE.Vector3()
const tmpForwardProjected = new THREE.Vector3()
const tmpMatrix = new THREE.Matrix4()
const tmpQuat = new THREE.Quaternion()
const tmpQuatB = new THREE.Quaternion()
const tmpQuatC = new THREE.Quaternion()
const tmpBox = new THREE.Box3()
const tmpRollAxis = new THREE.Vector3(0, 0, 1)
const tmpPitchAxis = new THREE.Vector3(1, 0, 0)
const surfaceCache = new Map<string, RoadSurfaceData>()
const competitors: Competitor[] = []
const usedNames = new Set<string>()
const playerName = nameGenerator.nextName(usedNames)

const loader = new GLTFLoader()
let gamePhase: GamePhase = 'loading'
let countdownTime = COUNTDOWN_SECONDS
let goHoldTime = 0

loadingView.showLoading(null)

loader.load(
  publicAssetUrl('/models/car.glb'),
  (gltf) => {
    carView = new CarView(gltf.scene)
    carView.addTo(scene)
    carView.enableShadows()

    const box = carView.getLocalBounds()
    if (!box) {
      loadingView.showError('Модель машины загрузилась без геометрии')
      return
    }
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    carView.translateBy(center.multiplyScalar(-1))
    carView.translateY(size.y / 2)

    const maxDim = Math.max(size.x, size.y, size.z)
    const desiredLength = 4.8
    const scale = desiredLength / maxDim
    carView.setScalarScale(scale)

    const boxAfterScale = carView.getLocalBounds()
    if (!boxAfterScale) {
      loadingView.showError('Не удалось подготовить геометрию машины')
      return
    }
    const centerAfterScale = boxAfterScale.getCenter(new THREE.Vector3())
    carView.translateBy(centerAfterScale.multiplyScalar(-1))

    const localBox = carView.getLocalBounds()
    if (!localBox) {
      loadingView.showError('Не удалось определить размеры машины')
      return
    }
    carLocalMinY = localBox.min.y
    carLocalMinX = localBox.min.x
    carLocalMaxX = localBox.max.x
    carLocalMinZ = localBox.min.z
    carLocalMaxZ = localBox.max.z

    placeCarOnStartGrid(carView, PLAYER_START_GRID_OFFSET, 0)
    snapCarToSurface(carView)

    carAggregate.setHeading(carView.getYaw())
    carAggregate.getForward(tmpVecA)
    competitors.length = 0
    competitors.push({
      id: 'player',
      name: `${playerName} (ты)`,
      isPlayer: true,
      car: carAggregate,
      view: carView,
      race,
      driver: null,
      minimapColor: '#ff7b54',
    })
    createOpponents(carView)

    cameraRig.focusOn(carView, carAggregate.heading)
    startCountdown()
  },
  (event) => {
    const progress =
      event.lengthComputable && event.total > 0
        ? clamp(event.loaded / event.total, 0, 1)
        : null
    loadingView.showLoading(progress)
  },
  (error) => {
    console.error('Ошибка загрузки модели:', error)
    loadingView.showError('Не удалось загрузить модель машины')
  }
)

function startCountdown(): void {
  gamePhase = 'countdown'
  countdownTime = COUNTDOWN_SECONDS
  goHoldTime = 0
  loadingView.showCountdown(String(COUNTDOWN_SECONDS))
}

function updateCountdown(delta: number): void {
  if (gamePhase === 'running' && goHoldTime > 0) {
    goHoldTime -= delta

    if (goHoldTime <= 0) {
      loadingView.hide()
    }

    return
  }

  if (gamePhase !== 'countdown') return

  countdownTime -= delta

  if (countdownTime > 0) {
    loadingView.showCountdown(String(Math.ceil(countdownTime)))
    return
  }

  loadingView.showCountdown('GO!')
  goHoldTime = COUNTDOWN_GO_HOLD_SECONDS
  gamePhase = 'running'
}

function createOpponents(sourceView: CarView): void {
  const opponentSettings = [
    {
      id: 'opponent-1',
      speedFactor: 0.8,
      lateralOffset: -road.roadWidth * OPPONENT_LATERAL_OFFSET_FACTOR,
      tint: 0xb9413f,
    },
    {
      id: 'opponent-2',
      speedFactor: 0.5,
      lateralOffset: road.roadWidth * OPPONENT_LATERAL_OFFSET_FACTOR,
      tint: 0x2f78c4,
    },
  ]

  for (const settings of opponentSettings) {
    const opponentView = sourceView.clone()
    const opponentCar = new CarAggregate()
    const opponentRace = new Race(TARGET_LAPS, road.startAngle, road.totalLength)

    opponentView.tintMaterials(settings.tint, 0.44)
    opponentView.addTo(scene)
    opponentView.enableShadows()
    placeCarOnStartGrid(opponentView, OPPONENT_START_GRID_OFFSET, settings.lateralOffset)
    snapCarToSurface(opponentView, OPPONENT_RIDE_HEIGHT_EXTRA)
    opponentCar.setHeading(opponentView.getYaw())

    competitors.push({
      id: settings.id,
      name: nameGenerator.nextName(usedNames),
      isPlayer: false,
      car: opponentCar,
      view: opponentView,
      race: opponentRace,
      driver: new OpponentDriver({
        maxSpeed: MAX_FORWARD_SPEED,
        maxSteer: MAX_STEER,
        speedFactor: settings.speedFactor,
      }),
      minimapColor: settings.id === 'opponent-1' ? '#e05249' : '#4e9dff',
    })
  }
}

function placeCarOnStartGrid(
  view: CarView,
  distanceOffset: number,
  lateralOffset: number
): void {
  const startDistance =
    (THREE.MathUtils.euclideanModulo(road.startAngle, Math.PI * 2) / (Math.PI * 2)) *
    road.totalLength

  road.sampleCenterlineByDistance(startDistance + distanceOffset, tmpCarPosition, tmpVecA)
  tmpVecB.set(-tmpVecA.z, 0, tmpVecA.x).normalize()
  tmpCarPosition.addScaledVector(tmpVecB, lateralOffset)
  view.setPosition(tmpCarPosition)
  view.setYaw(Math.atan2(tmpVecA.x, tmpVecA.z))
}

function snapCarToSurface(view: CarView, extraRideHeight = 0): void {
  const carPosition = view.copyPosition(tmpCarPosition)
  const surface = getSurfaceAt(carPosition.x, carPosition.z)
  view.setY(surface.height - carLocalMinY + carRideHeightOffset + extraRideHeight)
  view.updateMatrixWorld(true)
  view.setBoxFromObject(tmpBox)

  const minAllowedY = surface.height + CAR_GROUND_CLEARANCE + extraRideHeight
  if (tmpBox.min.y < minAllowedY) {
    view.translateY(minAllowedY - tmpBox.min.y)
  }

  resolveGroundPenetration(view, extraRideHeight)
}

function resolveGroundPenetration(view: CarView, extraRideHeight = 0): void {
  tmpBox.makeEmpty()

  const insetX = Math.max((carLocalMaxX - carLocalMinX) * 0.12, 0.08)
  const insetZ = Math.max((carLocalMaxZ - carLocalMinZ) * 0.12, 0.08)
  const samplePoints: Array<[number, number, number]> = [
    [0, carLocalMinY, 0],
    [carLocalMinX + insetX, carLocalMinY, carLocalMinZ + insetZ],
    [carLocalMaxX - insetX, carLocalMinY, carLocalMinZ + insetZ],
    [carLocalMinX + insetX, carLocalMinY, carLocalMaxZ - insetZ],
    [carLocalMaxX - insetX, carLocalMinY, carLocalMaxZ - insetZ],
  ]

  let maxLift = 0

  for (const [x, y, z] of samplePoints) {
    view.worldPointFromLocal(x, y, z, tmpVecE)

    const surface = getSurfaceAt(tmpVecE.x, tmpVecE.z)
    const lift = surface.height + CAR_GROUND_CLEARANCE + extraRideHeight - tmpVecE.y

    if (lift > maxLift) {
      maxLift = lift
    }
  }

  if (maxLift > 0) {
    view.translateY(maxLift)
  }

  view.setBoxFromObject(tmpBox)
  const carPosition = view.copyPosition(tmpCarPosition)
  const centerSurface = getSurfaceAt(carPosition.x, carPosition.z).height
  const bboxLift = centerSurface + CAR_GROUND_CLEARANCE + extraRideHeight - tmpBox.min.y

  if (bboxLift > 0) {
    view.translateY(bboxLift)
  }
}

function resolveObstacleCollisions(): void {
  if (!carView) return
  resolveObstacleCollisionsFor(carView, carAggregate)
}

function resolveObstacleCollisionsFor(view: CarView, car: CarAggregate): void {
  const carPosition = view.copyPosition(tmpCarPosition)
  const nearbyObstacles = decorations.getNearbyObstacles(
    carPosition.x,
    carPosition.z,
    CAR_COLLIDER_RADIUS + 8
  )

  for (const obstacle of nearbyObstacles) {
    const dx = carPosition.x - obstacle.x
    const dz = carPosition.z - obstacle.z
    const distSq = dx * dx + dz * dz
    const minDist = CAR_COLLIDER_RADIUS + obstacle.radius

    if (distSq < minDist * minDist) {
      let dist = Math.sqrt(distSq)

      if (dist < 0.0001) {
        dist = 0.0001
      }

      const nx = dx / dist
      const nz = dz / dist
      const pushOut = minDist - dist

      view.translateXZ(nx * pushOut, nz * pushOut)
      view.copyPosition(carPosition)

      const collisionNormal = tmpVecB.set(nx, 0, nz)
      car.resolveCollision(collisionNormal)
    }
  }
}

function getSurfaceAt(x: number, z: number) {
  const key = `${x.toFixed(2)}:${z.toFixed(2)}`
  const cached = surfaceCache.get(key)

  if (cached) {
    return cached
  }

  const surface = road.getHeightAndNormal(x, z, terrain.getHeightAndNormal(x, z))
  surfaceCache.set(key, surface)
  return surface
}

function applyDrivePhysics(
  view: CarView,
  car: CarAggregate,
  controls: DriveControls,
  delta: number
): void {
  const carPosition = view.copyPosition(tmpCarPosition)
  const roadBand = road.getBandData(carPosition.x, carPosition.z)
  const currentSurface = getSurfaceAt(carPosition.x, carPosition.z)
  const absSpeed = car.absSpeed
  const speedRatio = clamp(absSpeed, 0, controls.maxForwardSpeed) / controls.maxForwardSpeed
  const accelCurve = 1 - Math.pow(speedRatio, 1.8)
  car.updateTransmission(delta, controls.maxForwardSpeed, controls.canDrive ? controls.throttle : 0)

  if (controls.canDrive && controls.throttle > 0) {
    car.accelerate(BASE_ACCEL * controls.throttle * accelCurve * car.shiftAccelerationFactor * delta)
  }

  if (controls.canDrive && controls.throttle < 0) {
    car.moveSpeedTowardZero(BASE_BRAKE * Math.abs(controls.throttle) * delta)
  }

  if (!controls.canDrive || Math.abs(controls.throttle) < 0.01) {
    car.moveSpeedTowardZero(
      (car.speed > 0
        ? NATURAL_DRAG + ROLLING_DRAG * speedRatio
        : NATURAL_DRAG + ROLLING_DRAG) * delta
    )
  }

  if (controls.canDrive && controls.brake) {
    car.moveSpeedTowardZero(HANDBRAKE_DRAG * delta)
  }

  const shoulderLimit = road.trackHalfWidth + road.shoulderWidth
  const apronLimit = shoulderLimit + road.apronWidth

  if (roadBand.distFromRoadCenter > road.trackHalfWidth) {
    if (roadBand.distFromRoadCenter <= shoulderLimit) {
      car.moveSpeedTowardZero(SHOULDER_SPEED_DRAG * delta)
      car.dampenVelocity(Math.pow(SHOULDER_VELOCITY_DAMP, delta * 60))
    } else if (roadBand.distFromRoadCenter <= apronLimit) {
      car.moveSpeedTowardZero(APRON_SPEED_DRAG * delta)
      car.dampenVelocity(Math.pow(APRON_VELOCITY_DAMP, delta * 60))
    } else {
      car.moveSpeedTowardZero(GRASS_SPEED_DRAG * delta)
      car.dampenVelocity(Math.pow(GRASS_VELOCITY_DAMP, delta * 60))
    }
  }

  car.clampSpeed(-MAX_REVERSE_SPEED, controls.maxForwardSpeed)

  const maxSteerAtSpeed = THREE.MathUtils.lerp(MAX_STEER, MAX_STEER * 0.42, speedRatio)
  const steerTarget = controls.canDrive ? controls.steer * maxSteerAtSpeed : 0
  const steerSpeed = controls.canDrive && Math.abs(controls.steer) > 0.01 ? STEER_SPEED : STEER_RETURN
  car.steerToward(steerTarget, steerSpeed * delta)

  car.getForward(tmpVecA)
  const forwardSpeed = car.velocity.dot(tmpVecA)
  const lateralSpeed = tmpVecB.set(tmpVecA.z, 0, -tmpVecA.x).dot(car.velocity)
  const slipAngle = Math.atan2(lateralSpeed, Math.max(Math.abs(forwardSpeed), 0.001))
  const driftFactor = clamp(Math.abs(slipAngle) / 0.58, 0, 1)
  const turnStrength = clamp(Math.abs(forwardSpeed) / 11, 0, 1)
  const reverseTurnFactor = forwardSpeed < -0.2 ? -0.75 : 1
  const desiredYawVelocity =
    car.steer *
    TURN_RATE *
    (0.22 + turnStrength * 0.96) *
    reverseTurnFactor *
    (currentSurface.onRoad ? 1 : 0.72) +
    slipAngle * DRIFT_SLIP_ASSIST * turnStrength * (controls.canDrive && controls.brake ? 0.72 : 0.36)
  const yawResponse = expLerpFactor(
    currentSurface.onRoad ? YAW_RESPONSE_ROAD : YAW_RESPONSE_OFFROAD,
    delta
  )

  car.blendYawVelocity(desiredYawVelocity, yawResponse)
  car.dampenYaw(YAW_DAMPING, delta)
  car.integrateHeading(delta, forwardSpeed)
  car.getForward(tmpVecA)

  const forwardVelocity = tmpVecC.copy(tmpVecA).multiplyScalar(car.velocity.dot(tmpVecA))
  const lateral = tmpVecB.copy(car.velocity).sub(forwardVelocity)
  const forwardGrip = controls.canDrive && controls.brake ? GRIP_HANDBRAKE : GRIP_NORMAL
  const forwardLerp = expLerpFactor(forwardGrip, delta)
  const newForwardSpeed =
    THREE.MathUtils.lerp(
      forwardVelocity.length(),
      Math.abs(car.speed),
      forwardLerp
    ) * Math.sign(car.speed || forwardSpeed || 1)
  const lateralGripBase = currentSurface.onRoad ? LATERAL_GRIP_ROAD : LATERAL_GRIP_OFFROAD
  const handbrakeGripFactor = controls.canDrive && controls.brake ? 0.34 : 1
  const steeringSlipFactor = THREE.MathUtils.lerp(1, 0.62, driftFactor)
  const recoveryGrip = THREE.MathUtils.lerp(1, 1.35, expLerpFactor(DRIFT_RECOVERY, delta))
  const lateralGrip = lateralGripBase * handbrakeGripFactor * steeringSlipFactor * recoveryGrip
  lateral.multiplyScalar(Math.exp(-lateralGrip * delta))
  car.applyForwardVelocity(tmpVecA, newForwardSpeed, lateral)

  view.addScaledVector(car.velocity, delta)
  resolveObstacleCollisionsFor(view, car)

  view.copyPosition(tmpCarPosition)
  const surface = getSurfaceAt(tmpCarPosition.x, tmpCarPosition.z)
  const targetY = surface.height - carLocalMinY + carRideHeightOffset + controls.extraRideHeight
  view.setY(
    THREE.MathUtils.lerp(
      tmpCarPosition.y,
      targetY,
      expLerpFactor(HEIGHT_SMOOTHNESS, delta)
    )
  )

  car.getForward(tmpVecA)
  tmpForwardProjected.copy(tmpVecA)
  tmpForwardProjected.projectOnPlane(surface.normal).normalize()

  if (tmpForwardProjected.lengthSq() < 0.0001) {
    tmpForwardProjected.copy(tmpVecA)
  }

  tmpRight.crossVectors(surface.normal, tmpForwardProjected).normalize()
  tmpVecA.crossVectors(tmpRight, surface.normal).normalize()

  tmpMatrix.makeBasis(tmpRight, surface.normal, tmpVecA)
  tmpQuat.setFromRotationMatrix(tmpMatrix)
  const rollStrength = clamp(Math.abs(forwardSpeed) / 18, 0, 1)
  const bodyRollTarget =
    clamp(-car.steer * rollStrength * BODY_ROLL_AMOUNT, -BODY_ROLL_AMOUNT, BODY_ROLL_AMOUNT) *
    (surface.onRoad ? 1 : 0.6)
  car.rollToward(bodyRollTarget, expLerpFactor(5.5, delta))
  tmpQuatC.setFromAxisAngle(tmpPitchAxis, -car.shiftKickAmount * 0.055)
  tmpQuat.multiply(tmpQuatC)
  tmpQuatB.setFromAxisAngle(tmpRollAxis, car.bodyRoll)
  tmpQuat.multiply(tmpQuatB)
  view.slerpQuaternion(tmpQuat, expLerpFactor(TILT_SMOOTHNESS, delta))
  resolveGroundPenetration(view, controls.extraRideHeight)
}

function updateDrive(delta: number): void {
  if (!carView) return

  const carPosition = carView.copyPosition(tmpCarPosition)
  const roadBand = road.getBandData(carPosition.x, carPosition.z)
  const currentSurface = getSurfaceAt(carPosition.x, carPosition.z)
  const absSpeed = carAggregate.absSpeed
  const speedRatio = clamp(absSpeed, 0, MAX_FORWARD_SPEED) / MAX_FORWARD_SPEED

  const raceSnapshot = race.snapshot()
  const canDrive = gamePhase === 'running' && !raceSnapshot.finished
  const accelCurve = 1 - Math.pow(speedRatio, 1.8)
  const reverseRatio = clamp(Math.abs(Math.min(carAggregate.speed, 0)) / MAX_REVERSE_SPEED, 0, 1)
  const reverseCurve = 1 - Math.pow(reverseRatio, 1.35)
  const throttleInput = canDrive && keys.forward ? 1 : canDrive && keys.backward ? -1 : 0
  carAggregate.updateTransmission(delta, MAX_FORWARD_SPEED, throttleInput)

  if (canDrive && keys.forward) {
    carAggregate.accelerate(BASE_ACCEL * accelCurve * carAggregate.shiftAccelerationFactor * delta)
  }

  if (canDrive && keys.backward) {
    if (carAggregate.speed > 1.5) {
      carAggregate.accelerate(-BASE_BRAKE * 1.1 * delta)
    } else {
      carAggregate.accelerate(-BASE_BRAKE * reverseCurve * delta)
    }
  }

  if (!canDrive || (!keys.forward && !keys.backward)) {
    carAggregate.moveSpeedTowardZero(
      (carAggregate.speed > 0
        ? NATURAL_DRAG + ROLLING_DRAG * speedRatio
        : NATURAL_DRAG + ROLLING_DRAG) * delta
    )
  }

  if (canDrive && keys.brake) {
    carAggregate.moveSpeedTowardZero(HANDBRAKE_DRAG * delta)
  }

  const shoulderLimit = road.trackHalfWidth + road.shoulderWidth
  const apronLimit = shoulderLimit + road.apronWidth

  if (roadBand.distFromRoadCenter > road.trackHalfWidth) {
    if (roadBand.distFromRoadCenter <= shoulderLimit) {
      carAggregate.moveSpeedTowardZero(SHOULDER_SPEED_DRAG * delta)
      carAggregate.dampenVelocity(Math.pow(SHOULDER_VELOCITY_DAMP, delta * 60))
    } else if (roadBand.distFromRoadCenter <= apronLimit) {
      carAggregate.moveSpeedTowardZero(APRON_SPEED_DRAG * delta)
      carAggregate.dampenVelocity(Math.pow(APRON_VELOCITY_DAMP, delta * 60))
    } else {
      carAggregate.moveSpeedTowardZero(GRASS_SPEED_DRAG * delta)
      carAggregate.dampenVelocity(Math.pow(GRASS_VELOCITY_DAMP, delta * 60))
    }
  }

  carAggregate.clampSpeed(-MAX_REVERSE_SPEED, MAX_FORWARD_SPEED)

  const maxSteerAtSpeed = THREE.MathUtils.lerp(MAX_STEER, MAX_STEER * 0.42, speedRatio)
  let steerTarget = 0
  if (canDrive && keys.left) steerTarget = maxSteerAtSpeed
  if (canDrive && keys.right) steerTarget = -maxSteerAtSpeed

  const steerSpeed = canDrive && (keys.left || keys.right) ? STEER_SPEED : STEER_RETURN
  carAggregate.steerToward(steerTarget, steerSpeed * delta)

  carAggregate.getForward(tmpVecA)
  const forwardSpeed = carAggregate.velocity.dot(tmpVecA)
  const lateralSpeed = tmpVecB.set(tmpVecA.z, 0, -tmpVecA.x).dot(carAggregate.velocity)
  const slipAngle = Math.atan2(lateralSpeed, Math.max(Math.abs(forwardSpeed), 0.001))
  const driftFactor = clamp(Math.abs(slipAngle) / 0.58, 0, 1)
  const turnStrength = clamp(Math.abs(forwardSpeed) / 11, 0, 1)
  const reverseTurnFactor = forwardSpeed < -0.2 ? -0.75 : 1
  const desiredYawVelocity =
    carAggregate.steer *
    TURN_RATE *
    (0.22 + turnStrength * 0.96) *
    reverseTurnFactor *
    (currentSurface.onRoad ? 1 : 0.72) +
    slipAngle * DRIFT_SLIP_ASSIST * turnStrength * (canDrive && keys.brake ? 0.72 : 0.36)
  const yawResponse = expLerpFactor(
    currentSurface.onRoad ? YAW_RESPONSE_ROAD : YAW_RESPONSE_OFFROAD,
    delta
  )

  carAggregate.blendYawVelocity(desiredYawVelocity, yawResponse)
  carAggregate.dampenYaw(YAW_DAMPING, delta)

  carAggregate.integrateHeading(delta, forwardSpeed)

  carAggregate.getForward(tmpVecA)

  const forwardVelocity = tmpVecC.copy(tmpVecA).multiplyScalar(carAggregate.velocity.dot(tmpVecA))
  const lateral = tmpVecB.copy(carAggregate.velocity).sub(forwardVelocity)
  const forwardGrip = canDrive && keys.brake ? GRIP_HANDBRAKE : GRIP_NORMAL
  const forwardLerp = expLerpFactor(forwardGrip, delta)
  const newForwardSpeed =
    THREE.MathUtils.lerp(
      forwardVelocity.length(),
      Math.abs(carAggregate.speed),
      forwardLerp
    ) * Math.sign(carAggregate.speed || forwardSpeed || 1)
  const lateralGripBase = currentSurface.onRoad ? LATERAL_GRIP_ROAD : LATERAL_GRIP_OFFROAD
  const handbrakeGripFactor = canDrive && keys.brake ? 0.34 : 1
  const steeringSlipFactor = THREE.MathUtils.lerp(1, 0.62, driftFactor)
  const recoveryGrip = THREE.MathUtils.lerp(1, 1.35, expLerpFactor(DRIFT_RECOVERY, delta))
  const lateralGrip = lateralGripBase * handbrakeGripFactor * steeringSlipFactor * recoveryGrip
  lateral.multiplyScalar(Math.exp(-lateralGrip * delta))
  carAggregate.applyForwardVelocity(tmpVecA, newForwardSpeed, lateral)

  carView.addScaledVector(carAggregate.velocity, delta)

  resolveObstacleCollisions()

  carView.copyPosition(tmpCarPosition)
  const surface = getSurfaceAt(tmpCarPosition.x, tmpCarPosition.z)

  const targetY = surface.height - carLocalMinY + carRideHeightOffset
  carView.setY(
    THREE.MathUtils.lerp(
      tmpCarPosition.y,
      targetY,
      expLerpFactor(HEIGHT_SMOOTHNESS, delta)
    )
  )

  carAggregate.getForward(tmpVecA)

  tmpForwardProjected.copy(tmpVecA)
  tmpForwardProjected.projectOnPlane(surface.normal).normalize()

  if (tmpForwardProjected.lengthSq() < 0.0001) {
    tmpForwardProjected.copy(tmpVecA)
  }

  tmpRight.crossVectors(surface.normal, tmpForwardProjected).normalize()
  tmpVecA.crossVectors(tmpRight, surface.normal).normalize()

  tmpMatrix.makeBasis(tmpRight, surface.normal, tmpVecA)
  tmpQuat.setFromRotationMatrix(tmpMatrix)
  const rollStrength = clamp(Math.abs(forwardSpeed) / 18, 0, 1)
  const bodyRollTarget =
    clamp(-carAggregate.steer * rollStrength * BODY_ROLL_AMOUNT, -BODY_ROLL_AMOUNT, BODY_ROLL_AMOUNT) *
    (surface.onRoad ? 1 : 0.6)
  carAggregate.rollToward(bodyRollTarget, expLerpFactor(5.5, delta))
  tmpQuatC.setFromAxisAngle(tmpPitchAxis, -carAggregate.shiftKickAmount * 0.055)
  tmpQuat.multiply(tmpQuatC)
  tmpQuatB.setFromAxisAngle(tmpRollAxis, carAggregate.bodyRoll)
  tmpQuat.multiply(tmpQuatB)
  carView.slerpQuaternion(tmpQuat, expLerpFactor(TILT_SMOOTHNESS, delta))
  resolveGroundPenetration(carView)

  carView.copyPosition(tmpCarPosition)
  decorations.updateVisibility(tmpCarPosition)
  carShadow.update(tmpCarPosition, surface.height, carAggregate.heading, carAggregate.speed)

  const currentRoadBand = road.getBandData(tmpCarPosition.x, tmpCarPosition.z)
  const isCloseEnoughToTrack =
    currentRoadBand.distFromRoadCenter <= road.trackHalfWidth + road.shoulderWidth
  const updatedRaceSnapshot = gamePhase === 'running' && isCloseEnoughToTrack
    ? race.update(
        delta,
        currentRoadBand.distanceAlong,
        carAggregate.signedSpeedAlongForward(tmpVecA)
      )
    : race.snapshot()
  if (updatedRaceSnapshot.finished) {
    gamePhase = 'finished'
  }
  standingsView.updateRace(
    updatedRaceSnapshot.completedLaps,
    updatedRaceSnapshot.targetLaps,
    updatedRaceSnapshot.elapsedTime,
    updatedRaceSnapshot.currentLapTime,
    updatedRaceSnapshot.lapTimes,
    updatedRaceSnapshot.finished
  )

  const kmh = Math.round(
    Math.abs(carAggregate.signedSpeedAlongForward(tmpVecA)) * HUD_SPEED_MULTIPLIER
  )
  hud.updateInstruments(kmh, carAggregate.rpm, carAggregate.gear)
}

function updateOpponents(delta: number): void {
  const canDrive = gamePhase === 'running'

  for (const competitor of competitors) {
    if (competitor.isPlayer || !competitor.driver) continue

    const position = competitor.view.copyPosition(tmpCarPosition)
    const opponentCanDrive = canDrive && !competitor.race.snapshot().finished
    const controls = competitor.driver.decide(competitor.car, road, position, opponentCanDrive)

    applyDrivePhysics(
      competitor.view,
      competitor.car,
      {
        throttle: controls.throttle,
        steer: controls.steer,
        brake: controls.brake,
        canDrive: opponentCanDrive,
        maxForwardSpeed: MAX_FORWARD_SPEED * controls.speedFactor,
        extraRideHeight: OPPONENT_RIDE_HEIGHT_EXTRA,
      },
      delta
    )

    snapCarToSurface(competitor.view, OPPONENT_RIDE_HEIGHT_EXTRA)
    competitor.view.copyPosition(tmpCarPosition)

    const roadBand = road.getBandData(tmpCarPosition.x, tmpCarPosition.z)

    if (
      canDrive &&
      roadBand.distFromRoadCenter <= road.trackHalfWidth + road.shoulderWidth
    ) {
      competitor.race.update(
        delta,
        roadBand.distanceAlong,
        competitor.car.signedSpeedAlongForward(tmpVecA)
      )
    }
  }
}

function resolveCompetitorCollisions(): void {
  for (let i = 0; i < competitors.length; i++) {
    for (let j = i + 1; j < competitors.length; j++) {
      const first = competitors[i]
      const second = competitors[j]
      const firstPosition = first.view.copyPosition(tmpVecA)
      const secondPosition = second.view.copyPosition(tmpVecB)
      const dx = firstPosition.x - secondPosition.x
      const dz = firstPosition.z - secondPosition.z
      const distSq = dx * dx + dz * dz
      const minDist = COMPETITOR_COLLIDER_RADIUS * 2

      if (distSq >= minDist * minDist) continue

      const dist = Math.max(Math.sqrt(distSq), 0.0001)
      const nx = dx / dist
      const nz = dz / dist
      const pushOut = (minDist - dist) * 0.5

      first.view.translateXZ(nx * pushOut, nz * pushOut)
      second.view.translateXZ(-nx * pushOut, -nz * pushOut)

      first.car.resolveCollision(tmpVecC.set(nx, 0, nz), 0.95, 0.72)
      second.car.resolveCollision(tmpVecC.set(-nx, 0, -nz), 0.95, 0.72)
    }
  }
}

function snapCompetitorsToSurface(): void {
  for (const competitor of competitors) {
    snapCarToSurface(
      competitor.view,
      competitor.isPlayer ? 0 : OPPONENT_RIDE_HEIGHT_EXTRA
    )
  }
}

function getMinimapMarkers() {
  return competitors.map((competitor) => ({
    car: competitor.view,
    heading: competitor.car.heading,
    color: competitor.minimapColor,
    isPlayer: competitor.isPlayer,
  }))
}

function updateCompetitionUi(): void {
  if (competitors.length === 0) return

  const ranked = raceStandings.rank(
    competitors.map((competitor) =>
      raceStandings.fromSnapshot(
        competitor.id,
        competitor.name,
        competitor.race.snapshot(),
        competitor.isPlayer
      )
    )
  )
  standingsView.update(ranked)
  positionLabelView.update(
    ranked.map((entry) => {
      const competitor = competitors.find((item) => item.id === entry.id)

      return {
        id: entry.id,
        name: entry.name,
        place: entry.place,
        view: competitor ? competitor.view : competitors[0].view,
        isPlayer: entry.isPlayer,
      }
    }),
    camera,
    renderer
  )
}

function animate(): void {
  requestAnimationFrame(animate)

  const delta = Math.min(clock.getDelta(), 0.05)

  if (gamePhase === 'finished' && keys.restart) {
    window.location.reload()
    return
  }

  surfaceCache.clear()
  updateCountdown(delta)
  updateDrive(delta)
  updateOpponents(delta)
  resolveCompetitorCollisions()
  snapCompetitorsToSurface()
  updateCompetitionUi()
  skidTrail.update(carView, carAggregate, keys, road, terrain)
  cameraRig.update(carView, carAggregate.heading, carAggregate.speed, delta)
  speedLines.update(carAggregate.speed, delta)
  minimap.draw(getMinimapMarkers())

  gameRenderer.render()
}

animate()
