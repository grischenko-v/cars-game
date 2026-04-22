import * as THREE from 'three'
import { clamp, expLerpFactor } from '../../utils/math'
import { qualitySettings } from '../config/QualitySettings'
import {
  APRON_VELOCITY_DAMP,
  BASE_ACCEL,
  BASE_BRAKE,
  BODY_ROLL_AMOUNT,
  CAR_COLLISION_ITERATIONS,
  CAR_COLLISION_SKIN,
  CAR_GROUND_CLEARANCE,
  DRIFT_RECOVERY,
  DRIFT_SLIP_ASSIST,
  GRASS_SPEED_FACTOR,
  GRASS_VELOCITY_DAMP,
  GRIP_HANDBRAKE,
  GRIP_NORMAL,
  HANDBRAKE_DRAG,
  HEIGHT_SMOOTHNESS,
  HUD_SPEED_MULTIPLIER,
  LATERAL_GRIP_OFFROAD,
  LATERAL_GRIP_ROAD,
  MAX_FORWARD_SPEED,
  MAX_REVERSE_SPEED,
  MAX_STEER,
  NATURAL_DRAG,
  OFFROAD_GROUND_CLEARANCE,
  OFFROAD_RIDE_HEIGHT_BOOST,
  OPPONENT_POST_COLLISION_RIDE_HEIGHT_EXTRA,
  OPPONENT_RAIL_EMERGENCY_LATERAL_SPEED,
  OPPONENT_RAIL_HALF_WIDTH_FACTOR,
  OPPONENT_RAIL_LATERAL_SPEED,
  OPPONENT_SURFACE_CLEARANCE,
  ROLLING_DRAG,
  SAND_SPEED_FACTOR,
  SHOULDER_VELOCITY_DAMP,
  STANDINGS_UPDATE_INTERVAL,
  STEER_RETURN,
  STEER_SPEED,
  TARGET_LAPS,
  TILT_SMOOTHNESS,
  TURN_RATE,
  VEHICLE_VISIBLE_SURFACE_CLEARANCE,
  YAW_DAMPING,
  YAW_RESPONSE_OFFROAD,
  YAW_RESPONSE_ROAD,
} from './RacingGameConfig'
import { CountdownController } from './CountdownController'
import { Car as CarAggregate } from '../../domain/car/Car'
import { EnvironmentPresetFactory } from '../../domain/environment/EnvironmentPresetFactory'
import { Race } from '../../domain/race/Race'
import {
  getStartGridSlot,
  START_GRID_PLAYER_SLOT_INDEX,
} from '../../domain/race/StartGrid'
import type { RoadBandData, RoadSurfaceData } from '../../domain/road/TrackModel'
import type { VehicleSpec } from '../../domain/vehicle/VehicleSpec'
import { vehicleSpecs } from '../../domain/vehicle/VehicleSpec'
import { KeyboardInput } from '../input/KeyboardInput'
import { EnvironmentController } from '../environment/EnvironmentController'
import { FollowCameraController } from '../camera/FollowCameraController'
import { OpponentDriver } from '../ai/OpponentDriver'
import type { RacingLinePlan } from '../ai/RacingLinePlan'
import { RacingLineWorkerClient } from '../ai/RacingLineWorkerClient'
import type { DriveControls } from '../physics/DriveControls'
import { SurfaceSpeedPolicy } from '../physics/SurfaceSpeedPolicy'
import { VehicleGroundingService } from '../physics/VehicleGroundingService'
import type { Competitor } from '../race/Competitor'
import { CompetitorRegistry } from '../race/CompetitorRegistry'
import { createDefaultOpponentProfiles } from '../race/OpponentProfile'
import { StartGridPlacementService } from '../race/StartGridPlacementService'
import { HudView } from '../ui/HudView'
import { CockpitView } from '../ui/CockpitView'
import { LoadingView } from '../ui/LoadingView'
import { MinimapView } from '../ui/MinimapView'
import { PositionLabelView } from '../ui/PositionLabelView'
import { StandingsView } from '../ui/StandingsView'
import { CarShadow } from '../../infrastructure/effects/CarShadow'
import { RainEffect } from '../../infrastructure/effects/RainEffect'
import { SkidTrailRenderer } from '../../infrastructure/effects/SkidTrailRenderer'
import { SpeedLinesOverlay } from '../../infrastructure/effects/SpeedLinesOverlay'
import { SunDisc } from '../../infrastructure/effects/SunDisc'
import { CarView } from '../../infrastructure/graphics/CarView'
import type { CarTemplate } from '../../infrastructure/graphics/CarTemplateFactory'
import { CarTemplateFactory } from '../../infrastructure/graphics/CarTemplateFactory'
import { vehicleAssetCatalog } from '../../infrastructure/graphics/VehicleAssetCatalog'
import { GameRenderer } from '../../infrastructure/rendering/GameRenderer'
import { LightingFactory } from '../../infrastructure/rendering/LightingFactory'
import { NameGenerator } from '../../domain/race/NameGenerator'
import { Road } from '../../world/Road'
import { Terrain } from '../../world/Terrain'
import { Decorations } from '../../world/Decorations'
import { RaceStandings } from '../../domain/race/RaceStandings'

export function startRacingGame(): void {

const gameRenderer = new GameRenderer()
const { scene, camera, renderer } = gameRenderer
const hud = new HudView()
const cockpitView = new CockpitView()
const loadingView = new LoadingView()
const countdown = new CountdownController(loadingView)
const standingsView = new StandingsView()
const positionLabelView = new PositionLabelView()
const keyboardInput = new KeyboardInput()
const keys = keyboardInput.keys
const lighting = new LightingFactory().attachTo(scene)
const environmentPreset = new EnvironmentPresetFactory().createRandom()
const rainEffect = new RainEffect(scene, camera)
const sunDisc = new SunDisc(scene, camera)
const environmentController = new EnvironmentController(
  gameRenderer,
  lighting,
  rainEffect,
  sunDisc
)
environmentController.applyPreset(environmentPreset)

const road = new Road()
const race = new Race(TARGET_LAPS, road.startAngle, road.totalLength)
const raceStandings = new RaceStandings()
const nameGenerator = new NameGenerator()
const terrain = new Terrain(scene, road)
road.attachTo(scene)
const decorations = new Decorations(scene, terrain, road)
const surfaceSpeedPolicy = new SurfaceSpeedPolicy(
  (x, z) => decorations.getGroundSurfaceAt(x, z),
  {
    grassSpeedFactor: GRASS_SPEED_FACTOR,
    sandSpeedFactor: SAND_SPEED_FACTOR,
    maxReverseSpeed: MAX_REVERSE_SPEED,
  }
)
const startGridPlacement = new StartGridPlacementService(road)
const minimap = new MinimapView(road)
const cameraRig = new FollowCameraController(camera, renderer.domElement)
const skidTrail = new SkidTrailRenderer(scene)
const carShadow = new CarShadow(scene)
const speedLines = new SpeedLinesOverlay()
const carTemplateFactory = new CarTemplateFactory()
const competitorRegistry = new CompetitorRegistry()
const vehicleGrounding = new VehicleGroundingService(
  carTemplateFactory,
  getVehicleSurfaceAt,
  {
    rideHeightOffset: 0.055,
    roadGroundClearance: CAR_GROUND_CLEARANCE,
    offroadGroundClearance: OFFROAD_GROUND_CLEARANCE,
    offroadRideHeightBoost: OFFROAD_RIDE_HEIGHT_BOOST,
    heightSmoothness: HEIGHT_SMOOTHNESS,
    minOffroadExtraRideHeight: 0.08,
    visibleSurfaceClearance: VEHICLE_VISIBLE_SURFACE_CLEARANCE,
  }
)
const racingLineWorkerClient = new RacingLineWorkerClient()

let carView: CarView | null = null
let playerVehicleSpec: VehicleSpec | null = null
let racingLinePlan: RacingLinePlan | null = null
const surfaceCache = new Map<string, RoadSurfaceData>()
const maxSurfaceCacheEntries = 4096
const surfaceCacheScale = 2

const carAggregate = new CarAggregate()
standingsView.updateRace(0, TARGET_LAPS, 0, 0, [], false)

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
const tmpRollAxis = new THREE.Vector3(0, 0, 1)
const tmpPitchAxis = new THREE.Vector3(1, 0, 0)
const competitors = competitorRegistry.competitors
const collisionGroundingQueue: Competitor[] = []
const usedNames = new Set<string>()
const playerName = nameGenerator.nextName(usedNames)
let standingsUpdateTimer = 0
let labelUpdateTimer = 0
let minimapUpdateTimer = 0
let hasRankedCompetition = false

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function applyRacingLinePlan(plan: RacingLinePlan): void {
  racingLinePlan = plan

  for (const competitor of competitors) {
    competitor.driver?.setRacingLinePlan(plan)
  }
}

racingLineWorkerClient
  .buildPlan(road)
  .then(applyRacingLinePlan)
  .catch((error) => {
    console.warn('Не удалось рассчитать гоночную линию в worker:', error)
  })

loadingView.showLoading(null)

carTemplateFactory.loadAll(vehicleAssetCatalog)
  .then((carTemplates) => {
    const playerTemplate = randomItem(carTemplates)
    playerVehicleSpec = playerTemplate.spec
    carView = carTemplateFactory.instantiate(playerTemplate)
    carView.addTo(scene)
    carView.enableShadows()
    carView.setHeadlightsEnabled(environmentPreset.headlightsRequired)

    const playerStartSlot = getStartGridSlot(road, START_GRID_PLAYER_SLOT_INDEX)
    startGridPlacement.place(carView, playerStartSlot.distanceOffset, playerStartSlot.lateralOffset)
    vehicleGrounding.snapToSurface(carView)

    carAggregate.setHeading(carView.getYaw())
    carAggregate.getForward(tmpVecA)
    competitorRegistry.reset()
    hasRankedCompetition = false
    standingsUpdateTimer = 0
    createOpponents(carTemplates)
    competitorRegistry.register({
      id: 'player',
      name: playerName,
      isPlayer: true,
      car: carAggregate,
      view: carView,
      race,
      driver: null,
      minimapColor: '#ff7b54',
      vehicleSpec: playerTemplate.spec,
    })

    cameraRig.focusOn(carView, carAggregate.heading)
    countdown.start()
  })
  .catch((error) => {
    console.error('Ошибка загрузки модели:', error)
    loadingView.showError('Не удалось загрузить модели машин')
  })

function createOpponents(carTemplates: CarTemplate[]): void {
  const opponentSettings = createDefaultOpponentProfiles({ track: road })

  for (const settings of opponentSettings) {
    const template = randomItem(carTemplates)
    const opponentView = carTemplateFactory.instantiate(template)
    const opponentCar = new CarAggregate()
    const opponentRace = new Race(TARGET_LAPS, road.startAngle, road.totalLength)

    opponentView.tintMaterials(settings.tint, 0.44)
    opponentView.addTo(scene)
    opponentView.enableShadows()
    opponentView.setHeadlightsEnabled(environmentPreset.headlightsRequired)
    startGridPlacement.place(opponentView, settings.distanceOffset, settings.lateralOffset)
    vehicleGrounding.snapToSurface(opponentView, OPPONENT_SURFACE_CLEARANCE)
    opponentCar.setHeading(opponentView.getYaw())
    const driver = new OpponentDriver({
      maxSpeed: MAX_FORWARD_SPEED,
      maxSteer: MAX_STEER * template.spec.handlingFactor,
      speedFactor: settings.speedFactor * template.spec.maxSpeedFactor,
      accelerationFactor: settings.accelerationFactor * template.spec.accelerationFactor,
      aggression: settings.aggression,
      lineBias: settings.lineBias,
    })

    if (racingLinePlan) {
      driver.setRacingLinePlan(racingLinePlan)
    }

    competitorRegistry.register({
      id: settings.id,
      name: nameGenerator.nextName(usedNames),
      isPlayer: false,
      car: opponentCar,
      view: opponentView,
      race: opponentRace,
      driver,
      minimapColor: settings.minimapColor,
      vehicleSpec: template.spec,
      railLateralOffset: settings.lateralOffset,
    })
  }
}

function alignCarToSurface(view: CarView, car: CarAggregate, surface: RoadSurfaceData): void {
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
  view.slerpQuaternion(tmpQuat, 1)
}

function resolveObstacleCollisions(): void {
  if (!carView) return
  resolveObstacleCollisionsFor(carView, carAggregate)
}

function resolveObstacleCollisionsFor(view: CarView, car: CarAggregate): void {
  const colliderRadius = carTemplateFactory.getBounds(view).colliderRadius
  const carPosition = view.copyPosition(tmpCarPosition)
  const nearbyObstacles = decorations.getNearbyObstacles(
    carPosition.x,
    carPosition.z,
    colliderRadius + 8
  )

  for (const obstacle of nearbyObstacles) {
    const dx = carPosition.x - obstacle.x
    const dz = carPosition.z - obstacle.z
    const distSq = dx * dx + dz * dz
    const minDist = colliderRadius + obstacle.radius

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

function getVehicleSurfaceAt(x: number, z: number) {
  const cacheKey = `${Math.round(x * surfaceCacheScale)},${Math.round(z * surfaceCacheScale)}`
  const cached = surfaceCache.get(cacheKey)

  if (cached) return cached

  const surface = road.getHeightAndNormal(x, z, terrain.getHeightAndNormal(x, z))

  surfaceCache.set(cacheKey, surface)

  if (surfaceCache.size > maxSurfaceCacheEntries) {
    const oldestKey = surfaceCache.keys().next().value
    if (oldestKey) surfaceCache.delete(oldestKey)
  }

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
  const currentSurface = getVehicleSurfaceAt(carPosition.x, carPosition.z)
  const surfaceSpeedFactor = surfaceSpeedPolicy.getSpeedFactor(
    carPosition.x,
    carPosition.z,
    roadBand
  )
  const absSpeed = car.absSpeed
  const speedRatio = clamp(absSpeed, 0, controls.maxForwardSpeed) / controls.maxForwardSpeed
  const accelCurve = 1 - Math.pow(speedRatio, 1.8)
  const handlingFactor = controls.handlingFactor ?? 1
  const gripFactor = controls.gripFactor ?? 1
  car.updateTransmission(delta, controls.maxForwardSpeed, controls.canDrive ? controls.throttle : 0)

  if (controls.canDrive && controls.throttle > 0) {
    car.accelerate(
      BASE_ACCEL *
        (controls.accelerationFactor ?? 1) *
        controls.throttle *
        accelCurve *
        car.shiftAccelerationFactor *
        delta
    )
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

  const shoulderLimit = roadBand.halfWidth + road.shoulderWidth
  const apronLimit = shoulderLimit + road.apronWidth

  if (roadBand.distFromRoadCenter > roadBand.halfWidth) {
    if (roadBand.distFromRoadCenter <= shoulderLimit) {
      car.dampenVelocity(Math.pow(SHOULDER_VELOCITY_DAMP, delta * 60))
    } else if (roadBand.distFromRoadCenter <= apronLimit) {
      car.dampenVelocity(Math.pow(APRON_VELOCITY_DAMP, delta * 60))
    } else {
      car.dampenVelocity(Math.pow(GRASS_VELOCITY_DAMP, delta * 60))
    }
  }

  surfaceSpeedPolicy.limitSpeed(car, controls.maxForwardSpeed, surfaceSpeedFactor, delta)

  const maxSteer = MAX_STEER * handlingFactor
  const maxSteerAtSpeed = THREE.MathUtils.lerp(maxSteer, maxSteer * 0.42, speedRatio)
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
    handlingFactor *
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
  const lateralGripBase =
    (currentSurface.onRoad ? LATERAL_GRIP_ROAD : LATERAL_GRIP_OFFROAD) * gripFactor
  const handbrakeGripFactor = controls.canDrive && controls.brake ? 0.34 : 1
  const steeringSlipFactor = THREE.MathUtils.lerp(1, 0.62, driftFactor)
  const recoveryGrip = THREE.MathUtils.lerp(1, 1.35, expLerpFactor(DRIFT_RECOVERY, delta))
  const lateralGrip = lateralGripBase * handbrakeGripFactor * steeringSlipFactor * recoveryGrip
  lateral.multiplyScalar(Math.exp(-lateralGrip * delta))
  car.applyForwardVelocity(tmpVecA, newForwardSpeed, lateral)

  view.addScaledVector(car.velocity, delta)
  resolveObstacleCollisionsFor(view, car)

  view.copyPosition(tmpCarPosition)
  const surface = getVehicleSurfaceAt(tmpCarPosition.x, tmpCarPosition.z)
  const targetY =
    surface.height -
    carTemplateFactory.getBounds(view).groundContactY * view.getScaleY() +
    vehicleGrounding.getRideHeightOffset(surface) +
    vehicleGrounding.getSurfaceExtraRideHeight(surface, controls.extraRideHeight)
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
  const dynamicRoll =
    -car.steer * 0.74 -
    car.yawVelocity * 0.18 -
    lateralSpeed * 0.018
  const bodyRollTarget =
    clamp(dynamicRoll * rollStrength * BODY_ROLL_AMOUNT, -BODY_ROLL_AMOUNT, BODY_ROLL_AMOUNT) *
    (surface.onRoad ? 1 : 0.6)
  car.rollToward(bodyRollTarget, expLerpFactor(7.2, delta))
  tmpQuatC.setFromAxisAngle(tmpPitchAxis, -car.shiftKickAmount * 0.055)
  tmpQuat.multiply(tmpQuatC)
  tmpQuatB.setFromAxisAngle(tmpRollAxis, car.bodyRoll)
  tmpQuat.multiply(tmpQuatB)
  view.slerpQuaternion(tmpQuat, expLerpFactor(TILT_SMOOTHNESS, delta))
  vehicleGrounding.resolveGroundPenetration(view, controls.extraRideHeight)
}

function updateDrive(delta: number): void {
  if (!carView) return

  const carPosition = carView.copyPosition(tmpCarPosition)
  const roadBand = road.getBandData(carPosition.x, carPosition.z)
  const currentSurface = getVehicleSurfaceAt(carPosition.x, carPosition.z)
  const surfaceSpeedFactor = surfaceSpeedPolicy.getSpeedFactor(
    carPosition.x,
    carPosition.z,
    roadBand
  )
  const vehicleSpec = playerVehicleSpec ?? vehicleSpecs[0]
  const playerMaxForwardSpeed = MAX_FORWARD_SPEED * vehicleSpec.maxSpeedFactor
  const absSpeed = carAggregate.absSpeed
  const speedRatio = clamp(absSpeed, 0, playerMaxForwardSpeed) / playerMaxForwardSpeed

  const raceSnapshot = race.snapshot()
  const canDrive = countdown.phase === 'running' && !raceSnapshot.finished
  const accelCurve = 1 - Math.pow(speedRatio, 1.8)
  const reverseRatio = clamp(Math.abs(Math.min(carAggregate.speed, 0)) / MAX_REVERSE_SPEED, 0, 1)
  const reverseCurve = 1 - Math.pow(reverseRatio, 1.35)
  const throttleInput = canDrive && keys.forward ? 1 : canDrive && keys.backward ? -1 : 0
  carAggregate.updateTransmission(delta, playerMaxForwardSpeed, throttleInput)

  if (canDrive && keys.forward) {
    carAggregate.accelerate(
      BASE_ACCEL *
        vehicleSpec.accelerationFactor *
        accelCurve *
        carAggregate.shiftAccelerationFactor *
        delta
    )
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

  const shoulderLimit = roadBand.halfWidth + road.shoulderWidth
  const apronLimit = shoulderLimit + road.apronWidth

  if (roadBand.distFromRoadCenter > roadBand.halfWidth) {
    if (roadBand.distFromRoadCenter <= shoulderLimit) {
      carAggregate.dampenVelocity(Math.pow(SHOULDER_VELOCITY_DAMP, delta * 60))
    } else if (roadBand.distFromRoadCenter <= apronLimit) {
      carAggregate.dampenVelocity(Math.pow(APRON_VELOCITY_DAMP, delta * 60))
    } else {
      carAggregate.dampenVelocity(Math.pow(GRASS_VELOCITY_DAMP, delta * 60))
    }
  }

  surfaceSpeedPolicy.limitSpeed(carAggregate, playerMaxForwardSpeed, surfaceSpeedFactor, delta)

  const playerMaxSteer = MAX_STEER * vehicleSpec.handlingFactor
  const maxSteerAtSpeed = THREE.MathUtils.lerp(
    playerMaxSteer,
    playerMaxSteer * 0.42,
    speedRatio
  )
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
    vehicleSpec.handlingFactor *
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
  const lateralGripBase =
    (currentSurface.onRoad ? LATERAL_GRIP_ROAD : LATERAL_GRIP_OFFROAD) *
    vehicleSpec.gripFactor
  const handbrakeGripFactor = canDrive && keys.brake ? 0.34 : 1
  const steeringSlipFactor = THREE.MathUtils.lerp(1, 0.62, driftFactor)
  const recoveryGrip = THREE.MathUtils.lerp(1, 1.35, expLerpFactor(DRIFT_RECOVERY, delta))
  const lateralGrip = lateralGripBase * handbrakeGripFactor * steeringSlipFactor * recoveryGrip
  lateral.multiplyScalar(Math.exp(-lateralGrip * delta))
  carAggregate.applyForwardVelocity(tmpVecA, newForwardSpeed, lateral)

  carView.addScaledVector(carAggregate.velocity, delta)

  resolveObstacleCollisions()

  carView.copyPosition(tmpCarPosition)
  const surface = getVehicleSurfaceAt(tmpCarPosition.x, tmpCarPosition.z)

  const targetY =
    surface.height -
    carTemplateFactory.getBounds(carView).groundContactY * carView.getScaleY() +
    vehicleGrounding.getRideHeightOffset(surface)
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
  const dynamicRoll =
    -carAggregate.steer * 0.74 -
    carAggregate.yawVelocity * 0.18 -
    lateralSpeed * 0.018
  const bodyRollTarget =
    clamp(dynamicRoll * rollStrength * BODY_ROLL_AMOUNT, -BODY_ROLL_AMOUNT, BODY_ROLL_AMOUNT) *
    (surface.onRoad ? 1 : 0.6)
  carAggregate.rollToward(bodyRollTarget, expLerpFactor(7.2, delta))
  tmpQuatC.setFromAxisAngle(tmpPitchAxis, -carAggregate.shiftKickAmount * 0.055)
  tmpQuat.multiply(tmpQuatC)
  tmpQuatB.setFromAxisAngle(tmpRollAxis, carAggregate.bodyRoll)
  tmpQuat.multiply(tmpQuatB)
  carView.slerpQuaternion(tmpQuat, expLerpFactor(TILT_SMOOTHNESS, delta))
  vehicleGrounding.resolveGroundPenetration(carView)

  carView.copyPosition(tmpCarPosition)
  decorations.updateVisibility(tmpCarPosition, delta)
  carShadow.update(tmpCarPosition, surface.height, carAggregate.heading, carAggregate.speed)

  const currentRoadBand = road.getBandData(tmpCarPosition.x, tmpCarPosition.z)
  const isCloseEnoughToTrack =
    currentRoadBand.distFromRoadCenter <= currentRoadBand.halfWidth + road.shoulderWidth
  const updatedRaceSnapshot = countdown.phase === 'running' && isCloseEnoughToTrack
    ? race.update(
        delta,
        currentRoadBand.distanceAlong,
        carAggregate.signedSpeedAlongForward(tmpVecA)
      )
    : race.snapshot()
  if (updatedRaceSnapshot.finished) {
    countdown.finish()
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
  const normalizedSteer = clamp(
    carAggregate.steer / Math.max(playerMaxSteer, 0.001),
    -1,
    1
  )

  hud.updateInstruments(kmh, carAggregate.rpm, carAggregate.gear)
  cockpitView.update(
    cameraRig.currentViewMode === 'cockpit',
    kmh,
    carAggregate.rpm,
    carAggregate.gear,
    normalizedSteer,
    vehicleSpec.id
  )
}

function updateOpponents(delta: number): void {
  const canDrive = countdown.phase === 'running'

  for (const competitor of competitors) {
    if (competitor.isPlayer || !competitor.driver) continue

    const position = competitor.view.copyPosition(tmpCarPosition)
    const opponentCanDrive = canDrive && !competitor.race.snapshot().finished
    const roadBand = road.getBandData(position.x, position.z)
    const controls = competitor.driver.decide(
      competitor.car,
      road,
      position,
      opponentCanDrive,
      roadBand
    )

    applyDrivePhysics(
      competitor.view,
      competitor.car,
      {
        throttle: controls.throttle,
        steer: controls.steer,
        brake: controls.brake,
        canDrive: opponentCanDrive,
        maxForwardSpeed: MAX_FORWARD_SPEED * controls.speedFactor,
        accelerationFactor: controls.accelerationFactor,
        handlingFactor: competitor.vehicleSpec.handlingFactor,
        gripFactor: competitor.vehicleSpec.gripFactor,
        extraRideHeight: OPPONENT_SURFACE_CLEARANCE,
      },
      delta
    )

    const constrainedRoadBand = applyOpponentRailConstraint(competitor, delta)
    competitor.view.copyPosition(tmpCarPosition)
    const constrainedSurface = getVehicleSurfaceAt(tmpCarPosition.x, tmpCarPosition.z)
    alignCarToSurface(competitor.view, competitor.car, constrainedSurface)
    vehicleGrounding.resolveGroundPenetration(competitor.view, OPPONENT_SURFACE_CLEARANCE)

    if (
      canDrive &&
      constrainedRoadBand.distFromRoadCenter <=
        constrainedRoadBand.halfWidth + road.shoulderWidth
    ) {
      competitor.race.update(
        delta,
        constrainedRoadBand.distanceAlong,
        competitor.car.signedSpeedAlongForward(tmpVecA)
      )
    }
  }
}

function applyOpponentRailConstraint(competitor: Competitor, delta: number): RoadBandData {
  const { view, car } = competitor
  const position = view.copyPosition(tmpCarPosition)
  const roadBand = road.getBandData(position.x, position.z)
  const safeHalfWidth = roadBand.halfWidth * OPPONENT_RAIL_HALF_WIDTH_FACTOR
  const desiredLateralOffset = clamp(roadBand.lateralOffset, -safeHalfWidth, safeHalfWidth)
  const currentRailOffset = competitor.railLateralOffset ?? roadBand.lateralOffset
  const isOutsideRail = Math.abs(roadBand.lateralOffset) > safeHalfWidth
  const lateralSpeed = isOutsideRail
    ? OPPONENT_RAIL_EMERGENCY_LATERAL_SPEED
    : OPPONENT_RAIL_LATERAL_SPEED
  const maxLateralStep = lateralSpeed * delta
  const nextRailOffset =
    currentRailOffset +
    clamp(desiredLateralOffset - currentRailOffset, -maxLateralStep, maxLateralStep)
  const shoulderOverflow = Math.min(road.shoulderWidth * 0.45, 1.2)
  const railLateralOffset = clamp(
    nextRailOffset,
    -safeHalfWidth - shoulderOverflow,
    safeHalfWidth + shoulderOverflow
  )

  competitor.railLateralOffset = railLateralOffset

  tmpRight.set(-roadBand.tangent.z, 0, roadBand.tangent.x).normalize()
  tmpVecA
    .copy(roadBand.nearestPoint)
    .addScaledVector(tmpRight, railLateralOffset)

  const isOffAsphalt = roadBand.distFromRoadCenter > roadBand.halfWidth
  const railFactor = isOffAsphalt
    ? expLerpFactor(6.5, delta)
    : isOutsideRail
      ? expLerpFactor(4.8, delta)
      : expLerpFactor(1.7, delta)

  position.lerp(tmpVecA, railFactor)
  const railSurface = getVehicleSurfaceAt(position.x, position.z)
  position.y = vehicleGrounding.getSurfaceAlignedY(
    view,
    carTemplateFactory.getBounds(view).groundContactY,
    railSurface,
    OPPONENT_SURFACE_CLEARANCE
  )
  view.setPosition(position)

  const targetHeading = Math.atan2(roadBand.tangent.x, roadBand.tangent.z)
  const headingError =
    THREE.MathUtils.euclideanModulo(targetHeading - car.heading + Math.PI, Math.PI * 2) -
    Math.PI
  const headingFactor = isOffAsphalt
    ? expLerpFactor(9, delta)
    : expLerpFactor(isOutsideRail ? 5.5 : 2.8, delta)
  car.setHeading(car.heading + headingError * headingFactor)
  car.yawVelocity *= isOffAsphalt ? 0.35 : isOutsideRail ? 0.68 : 0.86

  const forwardSpeed = Math.max(
    car.speed,
    car.velocity.dot(roadBand.tangent),
    car.velocity.length() * 0.75,
    0
  )
  car.speed = forwardSpeed

  if (isOffAsphalt || isOutsideRail) {
    tmpVecB.copy(roadBand.tangent).multiplyScalar(forwardSpeed)
    car.velocity.lerp(tmpVecB, expLerpFactor(7, delta))
  } else {
    tmpVecB.copy(roadBand.tangent).multiplyScalar(forwardSpeed)
    car.velocity.lerp(tmpVecB, expLerpFactor(2.4, delta))
  }

  return road.getBandData(position.x, position.z)
}

function resolveCarCarImpact(
  first: Competitor,
  second: Competitor,
  nx: number,
  nz: number,
  overlap: number
): void {
  tmpVecC.set(nx, 0, nz)
  tmpVecE.copy(first.car.velocity).sub(second.car.velocity)

  const closingSpeed = tmpVecE.dot(tmpVecC)
  const bothAi = !first.isPlayer && !second.isPlayer
  const playerInvolved = first.isPlayer || second.isPlayer
  const impulse =
    closingSpeed < 0
      ? -closingSpeed * (playerInvolved ? 1.05 : 0.82) + overlap * 0.74
      : overlap * 0.52

  first.car.velocity.addScaledVector(tmpVecC, impulse)
  second.car.velocity.addScaledVector(tmpVecC, -impulse)

  const speedLoss = 1.2 + overlap * (playerInvolved ? 1.55 : 1.0)

  first.car.moveSpeedTowardZero(speedLoss * (bothAi ? 0.55 : first.isPlayer ? 0.9 : 1.05))
  second.car.moveSpeedTowardZero(speedLoss * (bothAi ? 0.55 : second.isPlayer ? 0.9 : 1.05))
}

function resolveCompetitorCollisions(): void {
  for (let iteration = 0; iteration < CAR_COLLISION_ITERATIONS; iteration++) {
    for (let i = 0; i < competitors.length; i++) {
      for (let j = i + 1; j < competitors.length; j++) {
        const first = competitors[i]
        const second = competitors[j]
        const firstPosition = first.view.copyPosition(tmpVecA)
        const secondPosition = second.view.copyPosition(tmpVecB)
        const dx = firstPosition.x - secondPosition.x
        const dz = firstPosition.z - secondPosition.z
        const distSq = dx * dx + dz * dz
        const minDist =
          carTemplateFactory.getBounds(first.view).colliderRadius +
          carTemplateFactory.getBounds(second.view).colliderRadius +
          CAR_COLLISION_SKIN

        if (distSq >= minDist * minDist) continue

        const dist = Math.max(Math.sqrt(distSq), 0.0001)
        const nx = dx / dist
        const nz = dz / dist
        const overlap = minDist - dist
        const playerInvolved = first.isPlayer || second.isPlayer
        const firstShare = second.isPlayer ? 0.72 : first.isPlayer ? 0.28 : 0.5
        const secondShare = 1 - firstShare
        const pushOut = overlap + (playerInvolved ? 0.08 : 0.03)

        first.view.translateXZ(nx * pushOut * firstShare, nz * pushOut * firstShare)
        second.view.translateXZ(-nx * pushOut * secondShare, -nz * pushOut * secondShare)
        queueCollisionGrounding(first)
        queueCollisionGrounding(second)
        syncOpponentRailOffset(first)
        syncOpponentRailOffset(second)

        resolveCarCarImpact(first, second, nx, nz, overlap)

        if (!first.isPlayer && !second.isPlayer && overlap > 0.45) {
          const midX = (firstPosition.x + secondPosition.x) * 0.5
          const midZ = (firstPosition.z + secondPosition.z) * 0.5
          const roadBand = road.getBandData(midX, midZ)
          tmpVecE.set(-roadBand.tangent.z, 0, roadBand.tangent.x).normalize()

          const firstSide = i % 2 === 0 ? 1 : -1
          const sidePush = Math.min(0.42, 0.12 + overlap * 0.18)
          first.view.translateXZ(tmpVecE.x * sidePush * firstSide, tmpVecE.z * sidePush * firstSide)
          second.view.translateXZ(
            -tmpVecE.x * sidePush * firstSide,
            -tmpVecE.z * sidePush * firstSide
          )
          queueCollisionGrounding(first)
          queueCollisionGrounding(second)
          resolveCarCarImpact(first, second, nx, nz, overlap * 1.25)
        }
      }
    }
  }
}

function syncOpponentRailOffset(competitor: Competitor): void {
  if (competitor.isPlayer) return

  competitor.view.copyPosition(tmpCarPosition)
  competitor.railLateralOffset = road.getBandData(
    tmpCarPosition.x,
    tmpCarPosition.z
  ).lateralOffset
}

function queueCollisionGrounding(competitor: Competitor): void {
  if (collisionGroundingQueue.includes(competitor)) return

  collisionGroundingQueue.push(competitor)
}

function snapCollisionMovedCompetitorsToSurface(): void {
  if (collisionGroundingQueue.length === 0) return

  for (const competitor of collisionGroundingQueue) {
    const extraRideHeight = competitor.isPlayer ? 0 : OPPONENT_POST_COLLISION_RIDE_HEIGHT_EXTRA

    vehicleGrounding.snapToSurface(competitor.view, extraRideHeight)
    if (competitor.isPlayer) continue

    competitor.view.copyPosition(tmpCarPosition)
    alignCarToSurface(
      competitor.view,
      competitor.car,
      getVehicleSurfaceAt(tmpCarPosition.x, tmpCarPosition.z)
    )
    vehicleGrounding.resolveGroundPenetration(competitor.view, extraRideHeight)
  }

  collisionGroundingQueue.length = 0
}

function updateCompetitionUi(delta: number): void {
  if (competitors.length === 0) return

  standingsUpdateTimer -= delta

  if (standingsUpdateTimer <= 0 || !hasRankedCompetition) {
    standingsUpdateTimer = STANDINGS_UPDATE_INTERVAL
    const ranked = competitorRegistry.buildStandings(raceStandings)
    competitorRegistry.buildPositionLabelTargets(ranked)

    standingsView.update(ranked)
    hasRankedCompetition = true
  }

  labelUpdateTimer -= delta

  if (labelUpdateTimer <= 0) {
    labelUpdateTimer = qualitySettings.uiLabelUpdateInterval
    positionLabelView.update(competitorRegistry.getPositionLabelTargets(), camera, renderer)
  }
}

function animate(): void {
  requestAnimationFrame(animate)

  const delta = Math.min(clock.getDelta(), 0.05)

  if (countdown.phase === 'finished' && keys.restart) {
    window.location.reload()
    return
  }

  countdown.update(delta)
  updateDrive(delta)
  updateOpponents(delta)
  resolveCompetitorCollisions()
  snapCollisionMovedCompetitorsToSurface()
  updateCompetitionUi(delta)
  environmentController.update(delta)
  skidTrail.update(carView, carAggregate, keys, road, terrain)

  if (keys.cameraToggle) {
    cameraRig.cycleViewMode(carView, carAggregate.heading)
    keys.cameraToggle = false
  }

  cameraRig.update(carView, carAggregate.heading, carAggregate.speed, delta)
  speedLines.update(carAggregate.speed, delta)
  minimapUpdateTimer -= delta

  if (minimapUpdateTimer <= 0) {
    minimapUpdateTimer = qualitySettings.minimapUpdateInterval
    minimap.draw(competitorRegistry.getMinimapMarkers())
  }

  gameRenderer.render()
}

animate()

}
