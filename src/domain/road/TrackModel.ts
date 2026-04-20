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
  lateralOffset: number
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
  private readonly laneSectionLength = 280
  private readonly laneTransitionLength = 92
  private readonly startTwoLaneLeadIn = 160
  private readonly lanePattern = [2, 3, 1, 4, 2, 5, 3, 6, 2, 4]
  private readonly laneWidth = 4.2
  private readonly roadEdgePadding = 3

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
  private readonly up = new THREE.Vector3(0, 1, 0)

  get nominalLaneWidth(): number {
    return this.laneWidth
  }

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

    const lateralOffset = new THREE.Vector3(x - bestX, 0, z - bestZ).dot(
      new THREE.Vector3(-tangent.z, 0, tangent.x)
    )

    return {
      point: new THREE.Vector3(bestX, this.roadY, bestZ),
      distance: Math.sqrt(bestDistanceSq),
      lateralOffset,
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
    const halfWidth = this.getTrackHalfWidthAtDistance(closest.distanceAlong)

    return {
      angle: closest.angle,
      centerRadius: 0,
      halfWidth,
      distFromRoadCenter: closest.distance,
      tangent: closest.tangent,
      nearestPoint: closest.point,
      distanceAlong: closest.distanceAlong,
      lateralOffset: closest.lateralOffset,
      radius: closest.distance,
      innerRadius: 0,
      outerRadius: halfWidth,
    }
  }

  angleDistance(a: number, b: number): number {
    return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
  }

  isNearStartSector(angle: number, extraArc = 0): boolean {
    return this.angleDistance(angle, this.startAngle) < this.startClearArc + extraArc
  }

  isPointOnRoad(x: number, z: number, margin = 0): boolean {
    const roadBand = this.getBandData(x, z)

    return roadBand.distFromRoadCenter <= roadBand.halfWidth + margin
  }

  getLaneCountAtDistance(distance: number): number {
    const loopDistance = this.getLanePatternDistance(distance)
    const section = Math.floor(loopDistance / this.laneSectionLength)

    return this.lanePattern[section % this.lanePattern.length]
  }

  getEffectiveLaneCountAtDistance(distance: number): number {
    const laneCountByWidth = Math.round(
      (this.getTrackHalfWidthAtDistance(distance) * 2 - this.roadEdgePadding) /
        this.laneWidth
    )

    return THREE.MathUtils.clamp(laneCountByWidth, 1, 6)
  }

  isLaneTransitionAtDistance(distance: number, margin = 0): boolean {
    const loopDistance = this.getLanePatternDistance(distance)
    const localDistance = THREE.MathUtils.euclideanModulo(
      loopDistance,
      this.laneSectionLength
    )
    const transitionLength = this.laneTransitionLength + margin

    return (
      localDistance < transitionLength ||
      localDistance > this.laneSectionLength - transitionLength
    )
  }

  getTrackHalfWidthAtDistance(distance: number): number {
    const loopDistance = this.getLanePatternDistance(distance)
    const localDistance = THREE.MathUtils.euclideanModulo(
      loopDistance,
      this.laneSectionLength
    )
    const currentWidth = this.getRawTrackHalfWidthAtDistance(loopDistance)

    if (localDistance < this.laneTransitionLength) {
      const previousWidth = this.getRawTrackHalfWidthAtDistance(
        loopDistance - localDistance - 0.01
      )
      const t = THREE.MathUtils.smoothstep(
        localDistance / this.laneTransitionLength,
        0,
        1
      )

      return THREE.MathUtils.lerp(previousWidth, currentWidth, t)
    }

    if (localDistance > this.laneSectionLength - this.laneTransitionLength) {
      const nextWidth = this.getRawTrackHalfWidthAtDistance(
        loopDistance + this.laneTransitionLength
      )
      const t = THREE.MathUtils.smoothstep(
        (localDistance - (this.laneSectionLength - this.laneTransitionLength)) /
          this.laneTransitionLength,
        0,
        1
      )

      return THREE.MathUtils.lerp(currentWidth, nextWidth, t)
    }

    return currentWidth
  }

  private getRawTrackHalfWidthAtDistance(distance: number): number {
    const laneCount = this.getLaneCountAtDistance(distance)
    const dynamicWidth = laneCount * this.laneWidth + this.roadEdgePadding

    return Math.min(this.trackHalfWidth, dynamicWidth * 0.5)
  }

  getOuterHalfWidthAtDistance(distance: number): number {
    return this.getTrackHalfWidthAtDistance(distance) + this.shoulderWidth
  }

  private getLanePatternDistance(distance: number): number {
    if (this.totalLength <= 0) return Math.max(distance, 0)

    const startDistance =
      (THREE.MathUtils.euclideanModulo(this.startAngle, Math.PI * 2) / (Math.PI * 2)) *
      this.totalLength

    return THREE.MathUtils.euclideanModulo(
      distance - startDistance + this.startTwoLaneLeadIn,
      this.totalLength
    )
  }

  getHeightAndNormal(
    x: number,
    z: number,
    terrainData: { height: number; normal: THREE.Vector3 }
  ): RoadSurfaceData {
    const roadBand = this.getBandData(x, z)
    const sideSign = Math.sign(roadBand.lateralOffset || 1)

    if (roadBand.distFromRoadCenter <= roadBand.halfWidth) {
      const slope = this.getBankSlopeAtDistance(roadBand.distanceAlong)

      return {
        height: this.getBankedHeightAtDistance(
          roadBand.distanceAlong,
          roadBand.lateralOffset,
          this.roadY
        ),
        normal: this.getBankedNormalAtDistance(roadBand.distanceAlong, slope),
        onRoad: true,
      }
    }

    if (roadBand.distFromRoadCenter <= roadBand.halfWidth + this.shoulderWidth) {
      const shoulderOffset = sideSign * THREE.MathUtils.clamp(
        roadBand.distFromRoadCenter,
        roadBand.halfWidth,
        roadBand.halfWidth + this.shoulderWidth
      )

      return {
        height: this.getBankedHeightAtDistance(
          roadBand.distanceAlong,
          shoulderOffset,
          this.shoulderY
        ),
        normal: this.getBankedNormalAtDistance(roadBand.distanceAlong),
        onRoad: false,
      }
    }

    if (roadBand.distFromRoadCenter <= roadBand.halfWidth + this.shoulderWidth + this.apronWidth) {
      const apronOffset = sideSign * THREE.MathUtils.clamp(
        roadBand.distFromRoadCenter,
        roadBand.halfWidth + this.shoulderWidth,
        roadBand.halfWidth + this.shoulderWidth + this.apronWidth
      )

      return {
        height: this.getBankedHeightAtDistance(
          roadBand.distanceAlong,
          apronOffset,
          this.apronY
        ),
        normal: this.getBankedNormalAtDistance(roadBand.distanceAlong),
        onRoad: false,
      }
    }

    const blendStart = roadBand.halfWidth + this.shoulderWidth + this.apronWidth

    if (roadBand.distFromRoadCenter <= blendStart + this.terrainBlend) {
      const t = (roadBand.distFromRoadCenter - blendStart) / this.terrainBlend
      const k = THREE.MathUtils.smoothstep(t, 0, 1)
      const edgeOffset = sideSign * blendStart
      const edgeHeight = this.getBankedHeightAtDistance(
        roadBand.distanceAlong,
        edgeOffset,
        this.apronY
      )
      const edgeNormal = this.getBankedNormalAtDistance(roadBand.distanceAlong)

      return {
        height: THREE.MathUtils.lerp(edgeHeight, terrainData.height, k),
        normal: edgeNormal.lerp(terrainData.normal, k).normalize(),
        onRoad: false,
      }
    }

    return {
      height: terrainData.height,
      normal: terrainData.normal,
      onRoad: false,
    }
  }

  getBankedHeightAtDistance(distance: number, lateralOffset: number, baseY: number): number {
    return baseY + lateralOffset * this.getBankSlopeAtDistance(distance)
  }

  getBankedNormalAtDistance(
    distance: number,
    slope = this.getBankSlopeAtDistance(distance)
  ): THREE.Vector3 {
    const tangent = new THREE.Vector3()
    this.sampleCenterlineByDistance(distance, new THREE.Vector3(), tangent)
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x)

    return this.up.clone().addScaledVector(side, -slope).normalize()
  }

  getBankSlopeAtDistance(distance: number): number {
    const signedCurve = this.getSignedCurveAtDistance(distance)
    const normalizedCurve = THREE.MathUtils.clamp(signedCurve / 0.5, -1, 1)

    return -normalizedCurve * 0.13
  }

  private getSignedCurveAtDistance(distance: number): number {
    const tangentA = new THREE.Vector3()
    const tangentB = new THREE.Vector3()

    this.sampleCenterlineByDistance(distance - 32, new THREE.Vector3(), tangentA)
    this.sampleCenterlineByDistance(distance + 32, new THREE.Vector3(), tangentB)

    const turnSign = tangentA.x * tangentB.z - tangentA.z * tangentB.x
    const tangentDot = THREE.MathUtils.clamp(tangentA.dot(tangentB), -1, 1)

    return Math.atan2(turnSign, tangentDot)
  }
}
