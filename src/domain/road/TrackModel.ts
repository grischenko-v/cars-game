import * as THREE from 'three'

export interface TurnInfo {
  leftTurns: number
  rightTurns: number
  desiredLeftTurns: number
  desiredRightTurns: number
}

export interface TrackBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface RoadBandData {
  angle: number
  centerRadius: number
  halfWidth: number
  distFromRoadCenter: number
  tangent: THREE.Vector3
  nearestPoint: THREE.Vector3
  distanceAlong: number
  radius: number
  innerRadius: number
  outerRadius: number
}

export interface RoadSurfaceData {
  height: number
  normal: THREE.Vector3
  onRoad: boolean
}

export interface TrackLayoutSnapshot {
  roadWidth: number
  shoulderWidth: number
  roadY: number
  shoulderY: number
  apronY: number
  shoulderBlend: number
  terrainBlend: number
  cutDepth: number
  terrainCalmDistance: number
  terrainCalmFactor: number
  terrainHardMargin: number
  terrainShoulderMargin: number
  apronWidth: number
  trackHalfWidth: number
  outerHalfWidth: number
  startAngle: number
  startClearArc: number
  turnInfo: TurnInfo
  centerline: THREE.Vector3[]
}

export class TrackModel {
  readonly roadWidth: number
  readonly shoulderWidth: number
  readonly roadY: number
  readonly shoulderY: number
  readonly apronY: number
  readonly shoulderBlend: number
  readonly terrainBlend: number
  readonly cutDepth: number
  readonly terrainCalmDistance: number
  readonly terrainCalmFactor: number
  readonly terrainHardMargin: number
  readonly terrainShoulderMargin: number
  readonly apronWidth: number
  readonly trackHalfWidth: number
  readonly outerHalfWidth: number
  readonly startAngle: number
  readonly startClearArc: number
  readonly turnInfo: TurnInfo
  readonly centerline: THREE.Vector3[]
  readonly cumulativeLengths: number[]
  readonly totalLength: number
  readonly trackBounds: TrackBounds

  constructor(snapshot: TrackLayoutSnapshot) {
    this.roadWidth = snapshot.roadWidth
    this.shoulderWidth = snapshot.shoulderWidth
    this.roadY = snapshot.roadY
    this.shoulderY = snapshot.shoulderY
    this.apronY = snapshot.apronY
    this.shoulderBlend = snapshot.shoulderBlend
    this.terrainBlend = snapshot.terrainBlend
    this.cutDepth = snapshot.cutDepth
    this.terrainCalmDistance = snapshot.terrainCalmDistance
    this.terrainCalmFactor = snapshot.terrainCalmFactor
    this.terrainHardMargin = snapshot.terrainHardMargin
    this.terrainShoulderMargin = snapshot.terrainShoulderMargin
    this.apronWidth = snapshot.apronWidth
    this.trackHalfWidth = snapshot.trackHalfWidth
    this.outerHalfWidth = snapshot.outerHalfWidth
    this.startAngle = snapshot.startAngle
    this.startClearArc = snapshot.startClearArc
    this.turnInfo = snapshot.turnInfo
    this.centerline = snapshot.centerline

    const cache = this.buildLengthCache(snapshot.centerline)
    this.cumulativeLengths = cache.cumulativeLengths
    this.totalLength = cache.totalLength
    this.trackBounds = cache.trackBounds
  }

  private buildLengthCache(centerline: THREE.Vector3[]) {
    const cumulativeLengths = [0]
    let totalLength = 0

    for (let i = 0; i < centerline.length; i++) {
      const current = centerline[i]
      const next = centerline[(i + 1) % centerline.length]
      totalLength += current.distanceTo(next)
      cumulativeLengths.push(totalLength)
    }

    const trackBounds = centerline.reduce(
      (bounds, point) => {
        bounds.minX = Math.min(bounds.minX, point.x)
        bounds.maxX = Math.max(bounds.maxX, point.x)
        bounds.minZ = Math.min(bounds.minZ, point.z)
        bounds.maxZ = Math.max(bounds.maxZ, point.z)
        return bounds
      },
      {
        minX: Infinity,
        maxX: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
      } as TrackBounds
    )

    return { cumulativeLengths, totalLength, trackBounds }
  }

  getClosestPointData(x: number, z: number) {
    let bestDistanceSq = Infinity
    let bestSegmentIndex = 0
    let bestSegmentT = 0
    let bestX = 0
    let bestZ = 0

    for (let i = 0; i < this.centerline.length; i++) {
      const a3 = this.centerline[i]
      const b3 = this.centerline[(i + 1) % this.centerline.length]
      const abX = b3.x - a3.x
      const abZ = b3.z - a3.z
      const abLenSq = abX * abX + abZ * abZ
      const apX = x - a3.x
      const apZ = z - a3.z
      const t = abLenSq > 0 ? THREE.MathUtils.clamp((apX * abX + apZ * abZ) / abLenSq, 0, 1) : 0
      const projectedX = a3.x + abX * t
      const projectedZ = a3.z + abZ * t
      const dx = x - projectedX
      const dz = z - projectedZ
      const distSq = dx * dx + dz * dz

      if (distSq < bestDistanceSq) {
        bestDistanceSq = distSq
        bestSegmentIndex = i
        bestSegmentT = t
        bestX = projectedX
        bestZ = projectedZ
      }
    }

    const segmentStart = this.centerline[bestSegmentIndex]
    const segmentEnd = this.centerline[(bestSegmentIndex + 1) % this.centerline.length]
    const tangent = new THREE.Vector3(
      segmentEnd.x - segmentStart.x,
      0,
      segmentEnd.z - segmentStart.z
    ).normalize()
    const distanceAlong =
      this.cumulativeLengths[bestSegmentIndex] +
      segmentStart.distanceTo(segmentEnd) * bestSegmentT
    const phase = this.totalLength > 0 ? distanceAlong / this.totalLength : 0

    return {
      point: new THREE.Vector3(bestX, this.roadY, bestZ),
      distance: Math.sqrt(bestDistanceSq),
      tangent,
      distanceAlong,
      angle: phase * Math.PI * 2,
    }
  }

  sampleCenterlineByDistance(
    distance: number,
    out: THREE.Vector3 = new THREE.Vector3(),
    tangentOut: THREE.Vector3 | null = null
  ): THREE.Vector3 {
    const loopDistance = THREE.MathUtils.euclideanModulo(distance, this.totalLength)

    for (let i = 0; i < this.centerline.length; i++) {
      const segmentStartDistance = this.cumulativeLengths[i]
      const segmentEndDistance = this.cumulativeLengths[i + 1]

      if (loopDistance <= segmentEndDistance) {
        const a = this.centerline[i]
        const b = this.centerline[(i + 1) % this.centerline.length]
        const segmentLength = Math.max(segmentEndDistance - segmentStartDistance, 0.0001)
        const t = (loopDistance - segmentStartDistance) / segmentLength

        out.copy(a).lerp(b, t)

        if (tangentOut) {
          tangentOut.set(b.x - a.x, 0, b.z - a.z).normalize()
        }

        return out
      }
    }

    out.copy(this.centerline[0])
    if (tangentOut) {
      const first = this.centerline[0]
      const second = this.centerline[1]
      tangentOut.set(second.x - first.x, 0, second.z - first.z).normalize()
    }
    return out
  }

  getCenterPointAtAngle(angle: number, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const phase = THREE.MathUtils.euclideanModulo(angle, Math.PI * 2) / (Math.PI * 2)
    return this.sampleCenterlineByDistance(phase * this.totalLength, out)
  }

  getTangentHeadingAtAngle(angle: number): number {
    const tangent = new THREE.Vector3()
    this.sampleCenterlineByDistance(
      (THREE.MathUtils.euclideanModulo(angle, Math.PI * 2) / (Math.PI * 2)) * this.totalLength,
      new THREE.Vector3(),
      tangent
    )
    return Math.atan2(tangent.x, tangent.z)
  }

  getBandData(x: number, z: number): RoadBandData {
    const closest = this.getClosestPointData(x, z)

    return {
      angle: closest.angle,
      centerRadius: 0,
      halfWidth: this.trackHalfWidth,
      distFromRoadCenter: closest.distance,
      tangent: closest.tangent,
      nearestPoint: closest.point,
      distanceAlong: closest.distanceAlong,
      radius: closest.distance,
      innerRadius: 0,
      outerRadius: this.trackHalfWidth,
    }
  }

  angleDistance(a: number, b: number): number {
    return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
  }

  isNearStartSector(angle: number, extraArc = 0): boolean {
    return this.angleDistance(angle, this.startAngle) < this.startClearArc + extraArc
  }

  isPointOnRoad(x: number, z: number, margin = 0): boolean {
    return this.getBandData(x, z).distFromRoadCenter <= this.trackHalfWidth + margin
  }

  getHeightAndNormal(
    x: number,
    z: number,
    terrainData: { height: number; normal: THREE.Vector3 }
  ): RoadSurfaceData {
    const roadBand = this.getBandData(x, z)

    if (roadBand.distFromRoadCenter <= roadBand.halfWidth) {
      return {
        height: this.roadY,
        normal: new THREE.Vector3(0, 1, 0),
        onRoad: true,
      }
    }

    if (roadBand.distFromRoadCenter <= roadBand.halfWidth + this.shoulderBlend) {
      const t = (roadBand.distFromRoadCenter - roadBand.halfWidth) / this.shoulderBlend
      const k = THREE.MathUtils.smoothstep(t, 0, 1)

      return {
        height: THREE.MathUtils.lerp(this.roadY, terrainData.height, k),
        normal: new THREE.Vector3(0, 1, 0).lerp(terrainData.normal, k).normalize(),
        onRoad: false,
      }
    }

    return {
      height: terrainData.height,
      normal: terrainData.normal,
      onRoad: false,
    }
  }
}
