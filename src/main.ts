import * as THREE from 'three'
import { clamp, expLerpFactor } from './utils/math'
import { qualitySettings } from './application/config/QualitySettings'
import { Car as CarAggregate } from './domain/car/Car'
import { Race } from './domain/race/Race'
import {
  getStartDistance,
  getStartGridSlot,
  START_GRID_PLAYER_SLOT_INDEX,
} from './domain/race/StartGrid'
import type { RoadBandData, RoadSurfaceData } from './domain/road/TrackModel'
import type { VehicleSpec } from './domain/vehicle/VehicleSpec'
import { vehicleSpecs } from './domain/vehicle/VehicleSpec'
import { KeyboardInput } from './application/input/KeyboardInput'
import { FollowCameraController } from './application/camera/FollowCameraController'
import { OpponentDriver } from './application/ai/OpponentDriver'
import type { RacingLinePlan } from './application/ai/RacingLinePlan'
import { RacingLineWorkerClient } from './application/ai/RacingLineWorkerClient'
import type { GamePhase } from './application/game/GamePhase'
import type { DriveControls } from './application/physics/DriveControls'
import type { Competitor } from './application/race/Competitor'
import { createDefaultOpponentProfiles } from './application/race/OpponentProfile'
import { HudView } from './application/ui/HudView'
import { CockpitView } from './application/ui/CockpitView'
import { LoadingView } from './application/ui/LoadingView'
import { MinimapView } from './application/ui/MinimapView'
import type { MinimapCarMarker } from './application/ui/MinimapView'
import { PositionLabelView } from './application/ui/PositionLabelView'
import type { PositionLabelTarget } from './application/ui/PositionLabelView'
import { StandingsView } from './application/ui/StandingsView'
import { CarShadow } from './infrastructure/effects/CarShadow'
import { SkidTrailRenderer } from './infrastructure/effects/SkidTrailRenderer'
import { SpeedLinesOverlay } from './infrastructure/effects/SpeedLinesOverlay'
import { CarView } from './infrastructure/graphics/CarView'
import type { CarTemplate } from './infrastructure/graphics/CarTemplateFactory'
import { CarTemplateFactory } from './infrastructure/graphics/CarTemplateFactory'
import { vehicleAssetCatalog } from './infrastructure/graphics/VehicleAssetCatalog'
import { GameRenderer } from './infrastructure/rendering/GameRenderer'
import { LightingFactory } from './infrastructure/rendering/LightingFactory'
import { NameGenerator } from './domain/race/NameGenerator'
import { Road } from './world/Road'
import { Terrain } from './world/Terrain'
import { Decorations } from './world/Decorations'
import { RaceStandings } from './domain/race/RaceStandings'
import type { StandingEntry } from './domain/race/RaceStandings'

const gameRenderer = new GameRenderer()
const { scene, camera, renderer } = gameRenderer
const hud = new HudView()
const cockpitView = new CockpitView()
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
const carTemplateFactory = new CarTemplateFactory()
const racingLineWorkerClient = new RacingLineWorkerClient()

let carView: CarView | null = null
let carRideHeightOffset = 0.055
const OPPONENT_POST_COLLISION_RIDE_HEIGHT_EXTRA = 0.2
let playerVehicleSpec: VehicleSpec | null = null
let racingLinePlan: RacingLinePlan | null = null

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
const CAR_GROUND_CLEARANCE = 0.055
const OFFROAD_GROUND_CLEARANCE = 0.28
const OFFROAD_RIDE_HEIGHT_BOOST = 0.2
const OPPONENT_SURFACE_CLEARANCE = 0.18
const VEHICLE_VISIBLE_SURFACE_CLEARANCE = 0.055
const LATERAL_GRIP_ROAD = 8.6
const LATERAL_GRIP_OFFROAD = 3.6
const YAW_RESPONSE_ROAD = 5.4
const YAW_RESPONSE_OFFROAD = 3.0
const YAW_DAMPING = 3.0
const DRIFT_SLIP_ASSIST = 1.15
const DRIFT_RECOVERY = 5.0
const BODY_ROLL_AMOUNT = 0.24
const HUD_SPEED_MULTIPLIER = 5.4
const GRASS_SPEED_FACTOR = 0.75
const SAND_SPEED_FACTOR = 0.65
const SHOULDER_VELOCITY_DAMP = 0.985
const APRON_VELOCITY_DAMP = 0.975
const GRASS_VELOCITY_DAMP = 0.985
const COUNTDOWN_SECONDS = 3
const COUNTDOWN_GO_HOLD_SECONDS = 0.65
const OPPONENT_RAIL_HALF_WIDTH_FACTOR = 0.64
const OPPONENT_RAIL_LATERAL_SPEED = 3.8
const OPPONENT_RAIL_EMERGENCY_LATERAL_SPEED = 8.2
const CAR_COLLISION_ITERATIONS = 5
const CAR_COLLISION_SKIN = 0.16

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
const competitors: Competitor[] = []
const competitorById = new Map<string, Competitor>()
const minimapMarkers: MinimapCarMarker[] = []
const positionLabelTargets: PositionLabelTarget[] = []
const standingEntries: StandingEntry[] = []
const collisionGroundingQueue: Competitor[] = []
const usedNames = new Set<string>()
const playerName = nameGenerator.nextName(usedNames)
const STANDINGS_UPDATE_INTERVAL = 0.12
let standingsUpdateTimer = 0
let labelUpdateTimer = 0
let minimapUpdateTimer = 0
let hasRankedCompetition = false

let gamePhase: GamePhase = 'loading'
let countdownTime = COUNTDOWN_SECONDS
let goHoldTime = 0

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function registerCompetitor(competitor: Competitor): void {
  competitors.push(competitor)
  competitorById.set(competitor.id, competitor)
  minimapMarkers.push({
    car: competitor.view,
    heading: competitor.car.heading,
    color: competitor.minimapColor,
    isPlayer: competitor.isPlayer,
  })
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

    const playerStartSlot = getStartGridSlot(road, START_GRID_PLAYER_SLOT_INDEX)
    placeCarOnStartGrid(carView, playerStartSlot.distanceOffset, playerStartSlot.lateralOffset)
    snapCarToSurface(carView)

    carAggregate.setHeading(carView.getYaw())
    carAggregate.getForward(tmpVecA)
    competitors.length = 0
    competitorById.clear()
    minimapMarkers.length = 0
    positionLabelTargets.length = 0
    hasRankedCompetition = false
    standingsUpdateTimer = 0
    createOpponents(carTemplates)
    registerCompetitor({
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
    startCountdown()
  })
  .catch((error) => {
    console.error('Ошибка загрузки модели:', error)
    loadingView.showError('Не удалось загрузить модели машин')
  })

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
    placeCarOnStartGrid(opponentView, settings.distanceOffset, settings.lateralOffset)
    snapCarToSurface(opponentView, OPPONENT_SURFACE_CLEARANCE)
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

    registerCompetitor({
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

function placeCarOnStartGrid(
  view: CarView,
  distanceOffset: number,
  lateralOffset: number
): void {
  const startDistance = getStartDistance(road)

  const gridDistance = startDistance + distanceOffset
  const safeLateralOffset = clamp(
    lateralOffset,
    -road.getTrackHalfWidthAtDistance(gridDistance) * 0.78,
    road.getTrackHalfWidthAtDistance(gridDistance) * 0.78
  )

  road.sampleCenterlineByDistance(gridDistance, tmpCarPosition, tmpVecA)
  tmpVecB.set(-tmpVecA.z, 0, tmpVecA.x).normalize()
  tmpCarPosition.addScaledVector(tmpVecB, safeLateralOffset)
  view.setPosition(tmpCarPosition)
  view.setYaw(Math.atan2(tmpVecA.x, tmpVecA.z))
}

function snapCarToSurface(view: CarView, extraRideHeight = 0): void {
  const bounds = carTemplateFactory.getBounds(view)
  const carPosition = view.copyPosition(tmpCarPosition)
  const surface = getVehicleSurfaceAt(carPosition.x, carPosition.z)
  view.setY(getSurfaceAlignedY(view, bounds.groundContactY, surface, extraRideHeight))
  view.updateMatrixWorld(true)

  resolveGroundPenetration(view, extraRideHeight)
}

function getSurfaceExtraRideHeight(surface: RoadSurfaceData, extraRideHeight: number): number {
  return surface.onRoad ? extraRideHeight : Math.max(extraRideHeight, 0.08)
}

function getSurfaceAlignedY(
  view: CarView,
  localContactY: number,
  surface: RoadSurfaceData,
  extraRideHeight: number
): number {
  return (
    surface.height -
    localContactY * view.getScaleY() +
    getRideHeightOffset(surface) +
    getSurfaceExtraRideHeight(surface, extraRideHeight)
  )
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

function resolveGroundPenetration(view: CarView, extraRideHeight = 0): void {
  view.updateMatrixWorld(true)

  const bounds = carTemplateFactory.getBounds(view)
  const centerPosition = view.copyPosition(tmpCarPosition)
  const centerSurface = getVehicleSurfaceAt(centerPosition.x, centerPosition.z)
  const surfaceExtraRideHeight = getSurfaceExtraRideHeight(centerSurface, extraRideHeight)
  tmpBox.makeEmpty()

  const insetX = Math.max((bounds.maxX - bounds.minX) * 0.12, 0.08)
  const insetZ = Math.max((bounds.maxZ - bounds.minZ) * 0.12, 0.08)
  const contactY = bounds.groundContactY
  let maxLift = Math.max(
    getLocalContactLift(view, 0, contactY, 0, extraRideHeight),
    getLocalContactLift(
      view,
      bounds.minX + insetX,
      contactY,
      bounds.minZ + insetZ,
      extraRideHeight
    ),
    getLocalContactLift(
      view,
      bounds.maxX - insetX,
      contactY,
      bounds.minZ + insetZ,
      extraRideHeight
    ),
    getLocalContactLift(
      view,
      bounds.minX + insetX,
      contactY,
      bounds.maxZ - insetZ,
      extraRideHeight
    ),
    getLocalContactLift(
      view,
      bounds.maxX - insetX,
      contactY,
      bounds.maxZ - insetZ,
      extraRideHeight
    )
  )

  if (maxLift > 0) {
    view.translateY(maxLift)
  }

  view.updateMatrixWorld(true)
  view.setBoxFromObject(tmpBox)
  const visualLift =
    centerSurface.height +
    getGroundClearance(centerSurface) * 0.45 +
    surfaceExtraRideHeight -
    tmpBox.min.y

  if (visualLift > 0) {
    view.translateY(visualLift)
  }

  view.worldPointFromLocal(0, bounds.groundContactY, 0, tmpVecE)
  const bboxLift =
    centerSurface.height +
    getGroundClearance(centerSurface) +
    surfaceExtraRideHeight -
    tmpVecE.y

  if (bboxLift > 0) {
    view.translateY(bboxLift)
  }

  view.updateMatrixWorld(true)
  liftVehicleVisualBoundsAboveSurface(view, extraRideHeight)
}

function getLocalContactLift(
  view: CarView,
  x: number,
  y: number,
  z: number,
  extraRideHeight: number
): number {
  view.worldPointFromLocal(x, y, z, tmpVecE)

  const surface = getVehicleSurfaceAt(tmpVecE.x, tmpVecE.z)
  return (
    surface.height +
    getGroundClearance(surface) +
    getSurfaceExtraRideHeight(surface, extraRideHeight) -
    tmpVecE.y
  )
}

function liftVehicleVisualBoundsAboveSurface(view: CarView, extraRideHeight = 0): void {
  view.updateMatrixWorld(true)
  view.setBoxFromObject(tmpBox)

  const minX = tmpBox.min.x
  const midX = (tmpBox.min.x + tmpBox.max.x) * 0.5
  const maxX = tmpBox.max.x
  const minZ = tmpBox.min.z
  const midZ = (tmpBox.min.z + tmpBox.max.z) * 0.5
  const maxZ = tmpBox.max.z
  let requiredBottomY = -Infinity

  for (let xi = 0; xi < 3; xi++) {
    const x = xi === 0 ? minX : xi === 1 ? midX : maxX

    for (let zi = 0; zi < 3; zi++) {
      const z = zi === 0 ? minZ : zi === 1 ? midZ : maxZ
      const surface = getVehicleSurfaceAt(x, z)
      const surfaceExtra = Math.min(
        getSurfaceExtraRideHeight(surface, extraRideHeight),
        VEHICLE_VISIBLE_SURFACE_CLEARANCE
      )

      requiredBottomY = Math.max(
        requiredBottomY,
        surface.height + VEHICLE_VISIBLE_SURFACE_CLEARANCE + surfaceExtra
      )
    }
  }

  const lift = requiredBottomY - tmpBox.min.y
  if (lift > 0) {
    view.translateY(lift)
    view.updateMatrixWorld(true)
  }

  liftVehicleFootprintAboveSurface(view, extraRideHeight)
}

function liftVehicleFootprintAboveSurface(view: CarView, extraRideHeight = 0): void {
  const bounds = carTemplateFactory.getBounds(view)
  const insetX = Math.max((bounds.maxX - bounds.minX) * 0.1, 0.06)
  const insetZ = Math.max((bounds.maxZ - bounds.minZ) * 0.1, 0.06)
  const contactY = bounds.groundContactY

  view.updateMatrixWorld(true)

  const maxLift = Math.max(
    getLocalContactLift(
      view,
      bounds.minX + insetX,
      contactY,
      bounds.minZ + insetZ,
      extraRideHeight
    ),
    getLocalContactLift(
      view,
      bounds.maxX - insetX,
      contactY,
      bounds.minZ + insetZ,
      extraRideHeight
    ),
    getLocalContactLift(
      view,
      bounds.minX + insetX,
      contactY,
      bounds.maxZ - insetZ,
      extraRideHeight
    ),
    getLocalContactLift(
      view,
      bounds.maxX - insetX,
      contactY,
      bounds.maxZ - insetZ,
      extraRideHeight
    )
  )

  if (maxLift > 0) {
    view.translateY(maxLift)
    view.updateMatrixWorld(true)
  }
}

function getRideHeightOffset(surface: RoadSurfaceData): number {
  return carRideHeightOffset + (surface.onRoad ? 0 : OFFROAD_RIDE_HEIGHT_BOOST)
}

function getGroundClearance(surface: RoadSurfaceData): number {
  return surface.onRoad ? CAR_GROUND_CLEARANCE : OFFROAD_GROUND_CLEARANCE
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
  return road.getHeightAndNormal(x, z, terrain.getHeightAndNormal(x, z))
}

function getSurfaceSpeedFactor(x: number, z: number, roadBand: RoadBandData): number {
  if (roadBand.distFromRoadCenter <= roadBand.halfWidth) {
    return 1
  }

  return decorations.getGroundSurfaceAt(x, z) === 'sand'
    ? SAND_SPEED_FACTOR
    : GRASS_SPEED_FACTOR
}

function limitSpeedBySurface(
  car: CarAggregate,
  maxForwardSpeed: number,
  surfaceSpeedFactor: number,
  delta: number
): void {
  const surfaceMaxSpeed = maxForwardSpeed * surfaceSpeedFactor

  if (car.speed > surfaceMaxSpeed) {
    car.moveSpeedTowardZero((8 + (car.speed - surfaceMaxSpeed) * 3.4) * delta)
  }

  car.clampSpeed(-MAX_REVERSE_SPEED * surfaceSpeedFactor, surfaceMaxSpeed)
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
  const surfaceSpeedFactor = getSurfaceSpeedFactor(carPosition.x, carPosition.z, roadBand)
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

  limitSpeedBySurface(car, controls.maxForwardSpeed, surfaceSpeedFactor, delta)

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
    getRideHeightOffset(surface) +
    (surface.onRoad ? controls.extraRideHeight : Math.max(controls.extraRideHeight, 0.08))
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
  resolveGroundPenetration(view, controls.extraRideHeight)
}

function updateDrive(delta: number): void {
  if (!carView) return

  const carPosition = carView.copyPosition(tmpCarPosition)
  const roadBand = road.getBandData(carPosition.x, carPosition.z)
  const currentSurface = getVehicleSurfaceAt(carPosition.x, carPosition.z)
  const surfaceSpeedFactor = getSurfaceSpeedFactor(carPosition.x, carPosition.z, roadBand)
  const vehicleSpec = playerVehicleSpec ?? vehicleSpecs[0]
  const playerMaxForwardSpeed = MAX_FORWARD_SPEED * vehicleSpec.maxSpeedFactor
  const absSpeed = carAggregate.absSpeed
  const speedRatio = clamp(absSpeed, 0, playerMaxForwardSpeed) / playerMaxForwardSpeed

  const raceSnapshot = race.snapshot()
  const canDrive = gamePhase === 'running' && !raceSnapshot.finished
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

  limitSpeedBySurface(carAggregate, playerMaxForwardSpeed, surfaceSpeedFactor, delta)

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
    getRideHeightOffset(surface)
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
  resolveGroundPenetration(carView)

  carView.copyPosition(tmpCarPosition)
  decorations.updateVisibility(tmpCarPosition, delta)
  carShadow.update(tmpCarPosition, surface.height, carAggregate.heading, carAggregate.speed)

  const currentRoadBand = road.getBandData(tmpCarPosition.x, tmpCarPosition.z)
  const isCloseEnoughToTrack =
    currentRoadBand.distFromRoadCenter <= currentRoadBand.halfWidth + road.shoulderWidth
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
  const canDrive = gamePhase === 'running'

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
    resolveGroundPenetration(competitor.view, OPPONENT_SURFACE_CLEARANCE)

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
  position.y = getSurfaceAlignedY(
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

    snapCarToSurface(competitor.view, extraRideHeight)
    if (competitor.isPlayer) continue

    competitor.view.copyPosition(tmpCarPosition)
    alignCarToSurface(
      competitor.view,
      competitor.car,
      getVehicleSurfaceAt(tmpCarPosition.x, tmpCarPosition.z)
    )
    resolveGroundPenetration(competitor.view, extraRideHeight)
  }

  collisionGroundingQueue.length = 0
}

function getMinimapMarkers() {
  for (let i = 0; i < competitors.length; i++) {
    minimapMarkers[i].heading = competitors[i].car.heading
  }

  return minimapMarkers
}

function updateCompetitionUi(delta: number): void {
  if (competitors.length === 0) return

  standingsUpdateTimer -= delta

  if (standingsUpdateTimer <= 0 || !hasRankedCompetition) {
    standingsUpdateTimer = STANDINGS_UPDATE_INTERVAL
    standingEntries.length = 0

    for (const competitor of competitors) {
      standingEntries.push(
        raceStandings.fromSnapshot(
          competitor.id,
          competitor.name,
          competitor.race.snapshot(),
          competitor.isPlayer
        )
      )
    }

    const ranked = raceStandings.rank(standingEntries)

    positionLabelTargets.length = 0

    for (const entry of ranked) {
      if (entry.isPlayer) continue

      const competitor = competitorById.get(entry.id)

      positionLabelTargets.push({
        id: entry.id,
        name: entry.name,
        place: entry.place,
        view: competitor ? competitor.view : competitors[0].view,
        isPlayer: entry.isPlayer,
      })
    }

    standingsView.update(ranked)
    hasRankedCompetition = true
  }

  labelUpdateTimer -= delta

  if (labelUpdateTimer <= 0) {
    labelUpdateTimer = qualitySettings.uiLabelUpdateInterval
    positionLabelView.update(positionLabelTargets, camera, renderer)
  }
}

function animate(): void {
  requestAnimationFrame(animate)

  const delta = Math.min(clock.getDelta(), 0.05)

  if (gamePhase === 'finished' && keys.restart) {
    window.location.reload()
    return
  }

  updateCountdown(delta)
  updateDrive(delta)
  updateOpponents(delta)
  resolveCompetitorCollisions()
  snapCollisionMovedCompetitorsToSurface()
  updateCompetitionUi(delta)
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
    minimap.draw(getMinimapMarkers())
  }

  gameRenderer.render()
}

animate()
