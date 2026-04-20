import * as THREE from 'three'
import { TrackModel } from '../../domain/road/TrackModel'
import { loadRepeatingPbrTextures } from './TextureFactory'

export interface RoadSceneMeshes {
  terrainBackfill: THREE.Mesh
  apron: THREE.Mesh
  road: THREE.Mesh
  shoulder: THREE.Mesh
  markingGroup: THREE.Group
}

export class RoadMeshFactory {
  create(track: TrackModel): RoadSceneMeshes {
    const terrainBackfillGeometry = this.buildBandGeometry(
      track,
      track.outerHalfWidth + track.apronWidth - 1.2,
      track.outerHalfWidth + track.apronWidth + 12,
      track.apronY - 0.08
    )
    const terrainBackfillMaterial = new THREE.MeshStandardMaterial({
      color: 0xb7c991,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 4,
      polygonOffsetUnits: 4,
    })
    const terrainBackfill = new THREE.Mesh(terrainBackfillGeometry, terrainBackfillMaterial)
    terrainBackfill.receiveShadow = true
    terrainBackfill.renderOrder = -1

    const apronGeometry = this.buildBandGeometry(
      track,
      track.outerHalfWidth,
      track.outerHalfWidth + track.apronWidth,
      track.apronY
    )
    const apronMaterial = new THREE.MeshStandardMaterial({
      color: 0x9b8f78,
      roughness: 1,
      metalness: 0,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3,
    })
    const apron = new THREE.Mesh(apronGeometry, apronMaterial)
    apron.receiveShadow = true
    apron.renderOrder = 0

    const roadGeometry = this.buildRibbonGeometry(track, track.trackHalfWidth, track.roadY)
    const asphaltTextures = loadRepeatingPbrTextures(
      '/textures/asphalt',
      'Asphalt010_1K-JPG',
      Math.max(track.totalLength / 18, 1),
      1.8
    )
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x7a7d7b,
      map: asphaltTextures.map,
      normalMap: asphaltTextures.normalMap,
      roughnessMap: asphaltTextures.roughnessMap,
      roughness: 0.96,
      metalness: 0.02,
      normalScale: new THREE.Vector2(0.42, 0.42),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    })
    const road = new THREE.Mesh(roadGeometry, roadMaterial)
    road.frustumCulled = false
    road.receiveShadow = true
    road.renderOrder = 3

    const shoulderGeometry = this.buildBandGeometry(
      track,
      track.trackHalfWidth,
      track.outerHalfWidth,
      track.shoulderY
    )
    const shoulderMaterial = new THREE.MeshStandardMaterial({
      color: 0x9b8f78,
      roughness: 1,
      metalness: 0,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    const shoulder = new THREE.Mesh(shoulderGeometry, shoulderMaterial)
    shoulder.receiveShadow = true
    shoulder.renderOrder = 1

    const laneMarkMaterial = new THREE.MeshBasicMaterial({
      color: 0xf5f2d8,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    })
    const markingGroup = new THREE.Group()
    const asphaltWear = new THREE.Mesh(
      this.buildAsphaltWearGeometry(track),
      new THREE.MeshBasicMaterial({
        color: 0x202624,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -7,
        polygonOffsetUnits: -7,
      })
    )
    asphaltWear.frustumCulled = false
    asphaltWear.renderOrder = 7
    const laneMarking = new THREE.Mesh(this.buildLaneMarkingGeometry(track), laneMarkMaterial)
    laneMarking.frustumCulled = false
    laneMarking.renderOrder = 8
    const startGrid = new THREE.Mesh(this.buildStartGridGeometry(track), laneMarkMaterial)
    startGrid.frustumCulled = false
    startGrid.renderOrder = 9
    const roadsideGroup = this.buildRoadsideInfrastructure(track)
    markingGroup.renderOrder = 8
    markingGroup.add(asphaltWear)
    markingGroup.add(laneMarking)
    markingGroup.add(startGrid)
    markingGroup.add(roadsideGroup)

    return { terrainBackfill, apron, road, shoulder, markingGroup }
  }

  private buildOffsetLoop(track: TrackModel, offset: number, y: number): THREE.Vector3[] {
    const loop: THREE.Vector3[] = []
    const count = track.centerline.length

    for (let i = 0; i < count; i++) {
      const prev = track.centerline[(i - 1 + count) % count]
      const current = track.centerline[i]
      const next = track.centerline[(i + 1) % count]
      const tangent = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z).normalize()
      const distance = track.cumulativeLengths[i] ?? 0
      const dynamicOffset = this.getDynamicOffset(track, offset, distance)
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(dynamicOffset)
      const bankedY = track.getBankedHeightAtDistance(distance, dynamicOffset, y)

      loop.push(new THREE.Vector3(current.x + normal.x, bankedY, current.z + normal.z))
    }

    return loop
  }

  private buildRibbonGeometry(track: TrackModel, halfWidth: number, y: number): THREE.BufferGeometry {
    const leftLoop = this.buildOffsetLoop(track, halfWidth, y)
    const rightLoop = this.buildOffsetLoop(track, -halfWidth, y)
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    let u = 0

    for (let i = 0; i < leftLoop.length; i++) {
      const left = leftLoop[i]
      const right = rightLoop[i]

      if (i > 0) {
        u += left.distanceTo(leftLoop[i - 1])
      }
      const normal = track.getBankedNormalAtDistance(track.cumulativeLengths[i] ?? 0)

      positions.push(left.x, left.y, left.z, right.x, right.y, right.z)
      normals.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z)
      uvs.push(u * 0.02, 1, u * 0.02, 0)
    }

    for (let i = 0; i < leftLoop.length; i++) {
      const base = i * 2
      const nextBase = ((i + 1) % leftLoop.length) * 2
      indices.push(base, base + 1, nextBase)
      indices.push(base + 1, nextBase + 1, nextBase)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    )
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(new Float32Array(normals), 3)
    )
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvs), 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    return geometry
  }

  private buildBandGeometry(
    track: TrackModel,
    innerHalfWidth: number,
    outerHalfWidth: number,
    y: number
  ): THREE.BufferGeometry {
    const outerLeftLoop = this.buildOffsetLoop(track, outerHalfWidth, y)
    const innerLeftLoop = this.buildOffsetLoop(track, innerHalfWidth, y)
    const innerRightLoop = this.buildOffsetLoop(track, -innerHalfWidth, y)
    const outerRightLoop = this.buildOffsetLoop(track, -outerHalfWidth, y)
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    let u = 0

    for (let i = 0; i < outerLeftLoop.length; i++) {
      const outerLeft = outerLeftLoop[i]
      const innerLeft = innerLeftLoop[i]
      const innerRight = innerRightLoop[i]
      const outerRight = outerRightLoop[i]

      if (i > 0) {
        u += outerLeft.distanceTo(outerLeftLoop[i - 1])
      }
      const normal = track.getBankedNormalAtDistance(track.cumulativeLengths[i] ?? 0)

      positions.push(
        outerLeft.x, outerLeft.y, outerLeft.z,
        innerLeft.x, innerLeft.y, innerLeft.z,
        innerRight.x, innerRight.y, innerRight.z,
        outerRight.x, outerRight.y, outerRight.z
      )
      normals.push(
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z,
        normal.x, normal.y, normal.z
      )
      uvs.push(
        u * 0.02, 1,
        u * 0.02, 0,
        u * 0.02, 0,
        u * 0.02, 1
      )
    }

    for (let i = 0; i < outerLeftLoop.length; i++) {
      const base = i * 4
      const nextBase = ((i + 1) % outerLeftLoop.length) * 4

      indices.push(base, base + 1, nextBase)
      indices.push(base + 1, nextBase + 1, nextBase)

      indices.push(base + 2, base + 3, nextBase + 2)
      indices.push(base + 3, nextBase + 3, nextBase + 2)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    )
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(new Float32Array(normals), 3)
    )
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvs), 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    return geometry
  }

  private buildLaneMarkingGeometry(track: TrackModel): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const dashSpacing = 18
    const dashLength = 5.2
    const dashWidth = 0.46
    const edgeWidth = 0.34
    const dashCount = Math.max(24, Math.floor(track.totalLength / dashSpacing))

    for (let i = 0; i < dashCount; i++) {
      const centerDistance = (i / dashCount) * track.totalLength
      const laneCount = track.getEffectiveLaneCountAtDistance(centerDistance)

      for (let separator = 1; separator < laneCount; separator++) {
        this.addLaneSeparatorDash(
          track,
          centerDistance,
          separator / laneCount,
          dashLength,
          dashWidth,
          0.2,
          positions,
          normals,
          uvs,
          indices
        )
      }

      if (i % 2 === 0) {
        this.addEdgeDash(
          track,
          centerDistance,
          -1,
          edgeWidth * 1.8,
          dashLength * 0.82,
          edgeWidth,
          0.21,
          positions,
          normals,
          uvs,
          indices
        )
        this.addEdgeDash(
          track,
          centerDistance,
          1,
          edgeWidth * 1.8,
          dashLength * 0.82,
          edgeWidth,
          0.21,
          positions,
          normals,
          uvs,
          indices
        )
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    )
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(new Float32Array(normals), 3)
    )
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvs), 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    return geometry
  }

  private addLaneSeparatorDash(
    track: TrackModel,
    centerDistance: number,
    laneFraction: number,
    length: number,
    width: number,
    lift: number,
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[]
  ): void {
    const startDistance = centerDistance - length * 0.5
    const endDistance = centerDistance + length * 0.5
    const startHalfWidth = track.getTrackHalfWidthAtDistance(startDistance)
    const endHalfWidth = track.getTrackHalfWidthAtDistance(endDistance)
    const startOffset = -startHalfWidth + startHalfWidth * 2 * laneFraction
    const endOffset = -endHalfWidth + endHalfWidth * 2 * laneFraction

    this.addRoadDashWithOffsets(
      track,
      startDistance,
      endDistance,
      startOffset,
      endOffset,
      width,
      lift,
      positions,
      normals,
      uvs,
      indices
    )
  }

  private addEdgeDash(
    track: TrackModel,
    centerDistance: number,
    sideSign: number,
    edgeInset: number,
    length: number,
    width: number,
    lift: number,
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[]
  ): void {
    const startDistance = centerDistance - length * 0.5
    const endDistance = centerDistance + length * 0.5
    const startOffset = sideSign * (track.getTrackHalfWidthAtDistance(startDistance) - edgeInset)
    const endOffset = sideSign * (track.getTrackHalfWidthAtDistance(endDistance) - edgeInset)

    this.addRoadDashWithOffsets(
      track,
      startDistance,
      endDistance,
      startOffset,
      endOffset,
      width,
      lift,
      positions,
      normals,
      uvs,
      indices
    )
  }

  private addRoadDashWithOffsets(
    track: TrackModel,
    startDistance: number,
    endDistance: number,
    startOffset: number,
    endOffset: number,
    width: number,
    lift: number,
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[]
  ): void {
    const start = new THREE.Vector3()
    const end = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()
    const corner = new THREE.Vector3()

    track.sampleCenterlineByDistance(startDistance, start)
    track.sampleCenterlineByDistance(endDistance, end)
    tangent.set(end.x - start.x, 0, end.z - start.z)

    if (tangent.lengthSq() < 0.0001) {
      track.sampleCenterlineByDistance((startDistance + endDistance) * 0.5, start, tangent)
    }

    tangent.normalize()
    side.set(-tangent.z, 0, tangent.x).normalize()
    start.addScaledVector(side, startOffset)
    end.addScaledVector(side, endOffset)
    side.multiplyScalar(width * 0.5)

    const base = positions.length / 3
    this.addRoadPaintCorner(
      track,
      corner.set(start.x + side.x, 0, start.z + side.z),
      lift,
      positions,
      normals
    )
    this.addRoadPaintCorner(
      track,
      corner.set(start.x - side.x, 0, start.z - side.z),
      lift,
      positions,
      normals
    )
    this.addRoadPaintCorner(
      track,
      corner.set(end.x + side.x, 0, end.z + side.z),
      lift,
      positions,
      normals
    )
    this.addRoadPaintCorner(
      track,
      corner.set(end.x - side.x, 0, end.z - side.z),
      lift,
      positions,
      normals
    )
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
    indices.push(base, base + 1, base + 2)
    indices.push(base + 1, base + 3, base + 2)
  }

  private buildAsphaltWearGeometry(track: TrackModel): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const wearCount = Math.max(120, Math.floor(track.totalLength / 18))
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()

    for (let i = 0; i < wearCount; i++) {
      const seed = i + 1
      const distance =
        (i / wearCount) * track.totalLength +
        (this.pseudoRandom(seed * 4.3) - 0.5) * 12
      const lateralRange = track.getTrackHalfWidthAtDistance(distance) * 0.74
      const offset = (this.pseudoRandom(seed * 7.1) * 2 - 1) * lateralRange
      const length = THREE.MathUtils.lerp(1.6, 9.5, this.pseudoRandom(seed * 2.9))
      const width = THREE.MathUtils.lerp(0.08, 0.52, this.pseudoRandom(seed * 8.7))

      track.sampleCenterlineByDistance(distance, center, tangent)
      center.addScaledVector(new THREE.Vector3(-tangent.z, 0, tangent.x).normalize(), offset)
      this.addOrientedRect(
        positions,
        normals,
        uvs,
        indices,
        center,
        tangent,
        length,
        width,
        track.roadY,
        false,
        track,
        0.17
      )

      if (i % 3 === 0) {
        const crackOffset = offset + (this.pseudoRandom(seed * 11.3) - 0.5) * 2.2

        track.sampleCenterlineByDistance(distance + length * 0.7, center, tangent)
        center.addScaledVector(
          new THREE.Vector3(-tangent.z, 0, tangent.x).normalize(),
          THREE.MathUtils.clamp(crackOffset, -lateralRange, lateralRange)
        )
        this.addOrientedRect(
          positions,
          normals,
          uvs,
          indices,
          center,
          tangent,
          THREE.MathUtils.lerp(2.5, 7.5, this.pseudoRandom(seed * 13.1)),
          0.055,
          track.roadY,
          false,
          track,
          0.18
        )
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    )
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(new Float32Array(normals), 3)
    )
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvs), 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    return geometry
  }

  private buildRoadsideInfrastructure(track: TrackModel): THREE.Group {
    const group = new THREE.Group()
    const barrier = new THREE.Mesh(
      this.buildGuardrailBarrierGeometry(track),
      new THREE.MeshStandardMaterial({
        color: 0xb4b0a4,
        roughness: 0.68,
        metalness: 0.22,
      })
    )
    barrier.castShadow = true
    barrier.receiveShadow = true
    barrier.frustumCulled = false
    group.add(barrier)

    const signCount = Math.max(14, Math.floor(track.totalLength / 260))
    for (let i = 0; i < signCount; i++) {
      const sideSign = i % 2 === 0 ? 1 : -1
      const distance = ((i + 0.35) / signCount) * track.totalLength

      group.add(this.createRoadSign(track, distance, sideSign, i % 4))
    }

    return group
  }

  private buildGuardrailBarrierGeometry(track: TrackModel): THREE.BufferGeometry {
    const positions: number[] = []
    const indices: number[] = []
    const segmentLength = 4.5
    const segmentCount = Math.max(80, Math.floor(track.totalLength / segmentLength))
    const centerA = new THREE.Vector3()
    const centerB = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()

    for (let i = 0; i < segmentCount; i++) {
      const startDistance = (i / segmentCount) * track.totalLength
      const endDistance = ((i + 1) / segmentCount) * track.totalLength
      const middleDistance = (startDistance + endDistance) * 0.5

      if (!this.shouldPlaceGuardrail(track, startDistance, middleDistance, endDistance)) continue

      track.sampleCenterlineByDistance(startDistance, centerA, tangent)
      track.sampleCenterlineByDistance(endDistance, centerB)
      side.set(-tangent.z, 0, tangent.x).normalize()

      for (const sideSign of [-1, 1]) {
        this.addBarrierSegment(
          track,
          startDistance,
          endDistance,
          sideSign,
          centerA,
          centerB,
          side,
          positions,
          indices
        )
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    )
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
  }

  private shouldPlaceGuardrail(
    track: TrackModel,
    startDistance: number,
    middleDistance: number,
    endDistance: number
  ): boolean {
    return (
      track.getEffectiveLaneCountAtDistance(startDistance) >= 4 &&
      track.getEffectiveLaneCountAtDistance(middleDistance) >= 4 &&
      track.getEffectiveLaneCountAtDistance(endDistance) >= 4
    )
  }

  private addBarrierSegment(
    track: TrackModel,
    startDistance: number,
    endDistance: number,
    sideSign: number,
    centerA: THREE.Vector3,
    centerB: THREE.Vector3,
    side: THREE.Vector3,
    positions: number[],
    indices: number[]
  ): void {
    const thickness = 0.72
    const height = 1.15
    const offsetA = sideSign * (track.getOuterHalfWidthAtDistance(startDistance) + 1.25)
    const offsetB = sideSign * (track.getOuterHalfWidthAtDistance(endDistance) + 1.25)
    const lateralHalf = side.clone().multiplyScalar(sideSign * thickness * 0.5)
    const a = centerA.clone().addScaledVector(side, offsetA)
    const b = centerB.clone().addScaledVector(side, offsetB)
    const ay = track.getBankedHeightAtDistance(startDistance, offsetA, track.shoulderY) + 0.04
    const by = track.getBankedHeightAtDistance(endDistance, offsetB, track.shoulderY) + 0.04
    const base = positions.length / 3
    const corners = [
      a.clone().sub(lateralHalf).setY(ay),
      a.clone().add(lateralHalf).setY(ay),
      b.clone().sub(lateralHalf).setY(by),
      b.clone().add(lateralHalf).setY(by),
      a.clone().sub(lateralHalf).setY(ay + height),
      a.clone().add(lateralHalf).setY(ay + height),
      b.clone().sub(lateralHalf).setY(by + height),
      b.clone().add(lateralHalf).setY(by + height),
    ]

    for (const corner of corners) {
      positions.push(corner.x, corner.y, corner.z)
    }

    indices.push(
      base, base + 2, base + 4,
      base + 2, base + 6, base + 4,
      base + 1, base + 5, base + 3,
      base + 3, base + 5, base + 7,
      base + 4, base + 6, base + 5,
      base + 5, base + 6, base + 7,
      base, base + 1, base + 2,
      base + 1, base + 3, base + 2,
      base, base + 4, base + 1,
      base + 1, base + 4, base + 5,
      base + 2, base + 3, base + 6,
      base + 3, base + 7, base + 6
    )
  }

  private createRoadSign(
    track: TrackModel,
    distance: number,
    sideSign: number,
    variant: number
  ): THREE.Group {
    const sign = new THREE.Group()
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()
    const position = new THREE.Vector3()
    const lateralOffset = sideSign * (track.getOuterHalfWidthAtDistance(distance) + 5.2)

    track.sampleCenterlineByDistance(distance, center, tangent)
    side.set(-tangent.z, 0, tangent.x).normalize()
    position.copy(center).addScaledVector(side, lateralOffset)
    position.y = track.getBankedHeightAtDistance(distance, lateralOffset, track.shoulderY)

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x55534c, roughness: 0.75, metalness: 0.25 })
    )
    post.position.set(position.x, position.y + 1.1, position.z)
    post.castShadow = true
    sign.add(post)

    const faceDirection = side.clone().multiplyScalar(-sideSign).normalize()
    const yaw = Math.atan2(faceDirection.x, faceDirection.z)
    const board =
      variant === 0
        ? new THREE.Mesh(
            new THREE.CircleGeometry(0.62, 24),
            new THREE.MeshBasicMaterial({ color: 0xe7efe9, side: THREE.DoubleSide })
          )
        : new THREE.Mesh(
            new THREE.PlaneGeometry(1.25, variant === 1 ? 0.72 : 0.92),
            new THREE.MeshBasicMaterial({
              color: variant === 1 ? 0x2f6bb0 : variant === 2 ? 0xd8b13f : 0xf0f0e6,
              side: THREE.DoubleSide,
            })
          )

    board.position.set(position.x, position.y + 2.25, position.z)
    board.rotation.y = yaw
    board.castShadow = true
    sign.add(board)

    if (variant === 0) {
      const warning = new THREE.Mesh(
        new THREE.CircleGeometry(0.46, 24),
        new THREE.MeshBasicMaterial({ color: 0xc63c32, side: THREE.DoubleSide })
      )
      warning.position.copy(board.position).addScaledVector(faceDirection, 0.01)
      warning.rotation.y = yaw
      sign.add(warning)
    }

    return sign
  }

  private pseudoRandom(seed: number): number {
    return THREE.MathUtils.euclideanModulo(Math.sin(seed * 12.9898) * 43758.5453, 1)
  }

  private getDynamicOffset(track: TrackModel, offset: number, distance: number): number {
    if (Math.abs(offset) < 0.0001) return 0

    const sign = Math.sign(offset)
    const roadHalfWidth = track.getTrackHalfWidthAtDistance(distance)
    const insetFromRoadEdge = track.trackHalfWidth - Math.abs(offset)

    if (insetFromRoadEdge > 0) {
      return sign * Math.max(0, roadHalfWidth - insetFromRoadEdge)
    }

    const extraFromRoadEdge = Math.max(Math.abs(offset) - track.trackHalfWidth, 0)

    return sign * (roadHalfWidth + extraFromRoadEdge)
  }

  private buildStartGridGeometry(track: TrackModel): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const y = track.roadY + 0.105
    const startDistance =
      (THREE.MathUtils.euclideanModulo(track.startAngle, Math.PI * 2) / (Math.PI * 2)) *
      track.totalLength
    const startHalfWidth = track.getTrackHalfWidthAtDistance(startDistance)
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()

    track.sampleCenterlineByDistance(startDistance, center, tangent)
    this.addCheckeredStartLine(
      positions,
      normals,
      uvs,
      indices,
      track,
      center,
      tangent,
      y
    )

    const slotLength = 6.2
    const slotWidth = 3.2
    const lineWidth = 0.22
    const firstOpponentOffset = -5.1
    const rowSpacing = 7.2
    const lateralOffset = startHalfWidth * 0.42
    const slotCenters = [
      { distanceOffset: firstOpponentOffset, lateralOffset: -lateralOffset },
      { distanceOffset: firstOpponentOffset - rowSpacing, lateralOffset },
      { distanceOffset: firstOpponentOffset - rowSpacing * 2, lateralOffset: -lateralOffset },
      { distanceOffset: firstOpponentOffset - rowSpacing * 3, lateralOffset },
      { distanceOffset: firstOpponentOffset - rowSpacing * 4, lateralOffset: -lateralOffset },
      { distanceOffset: firstOpponentOffset - rowSpacing * 5, lateralOffset },
      { distanceOffset: firstOpponentOffset - rowSpacing * 6, lateralOffset: -lateralOffset },
    ]

    for (const slot of slotCenters) {
      track.sampleCenterlineByDistance(startDistance + slot.distanceOffset, center, tangent)
      side.set(-tangent.z, 0, tangent.x).normalize()
      center.addScaledVector(side, slot.lateralOffset)
      this.addSlotOutline(
        positions,
        normals,
        uvs,
        indices,
        center,
        tangent,
        slotLength,
        slotWidth,
        lineWidth,
        y,
        track
      )
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    )
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(new Float32Array(normals), 3)
    )
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uvs), 2))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    return geometry
  }

  private addCheckeredStartLine(
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    track: TrackModel,
    center: THREE.Vector3,
    tangent: THREE.Vector3,
    y: number
  ): void {
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    const square = 1.35
    const rows = 2
    const startWidth = track.getTrackHalfWidthAtDistance(
      (THREE.MathUtils.euclideanModulo(track.startAngle, Math.PI * 2) / (Math.PI * 2)) *
        track.totalLength
    ) * 2
    const columns = Math.max(4, Math.floor((startWidth * 0.92) / square))
    const totalWidth = columns * square
    const cellCenter = new THREE.Vector3()

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        if ((row + column) % 2 !== 0) continue

        const forwardOffset = (row - (rows - 1) * 0.5) * square
        const sideOffset = (column - (columns - 1) * 0.5) * square
        cellCenter
          .copy(center)
          .addScaledVector(tangent, forwardOffset)
          .addScaledVector(side, sideOffset)

        this.addOrientedRect(
          positions,
          normals,
          uvs,
          indices,
          cellCenter,
          tangent,
          square * 0.96,
          square * 0.96,
          y,
          false,
          track,
          0.24
        )
      }
    }

    this.addOrientedRect(
      positions,
      normals,
      uvs,
      indices,
      center,
      tangent,
      totalWidth,
      0.16,
      y,
      true,
      track,
      0.25
    )
  }

  private addSlotOutline(
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    center: THREE.Vector3,
    tangent: THREE.Vector3,
    length: number,
    width: number,
    lineWidth: number,
    y: number,
    track: TrackModel
  ): void {
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
    const rectCenter = new THREE.Vector3()

    rectCenter.copy(center).addScaledVector(tangent, length * 0.5)
    this.addOrientedRect(
      positions,
      normals,
      uvs,
      indices,
      rectCenter,
      tangent,
      width,
      lineWidth,
      y,
      true,
      track,
      0.22
    )

    rectCenter.copy(center).addScaledVector(tangent, -length * 0.5)
    this.addOrientedRect(
      positions,
      normals,
      uvs,
      indices,
      rectCenter,
      tangent,
      width,
      lineWidth,
      y,
      true,
      track,
      0.22
    )

    rectCenter.copy(center).addScaledVector(side, width * 0.5)
    this.addOrientedRect(
      positions,
      normals,
      uvs,
      indices,
      rectCenter,
      tangent,
      length,
      lineWidth,
      y,
      false,
      track,
      0.22
    )

    rectCenter.copy(center).addScaledVector(side, -width * 0.5)
    this.addOrientedRect(
      positions,
      normals,
      uvs,
      indices,
      rectCenter,
      tangent,
      length,
      lineWidth,
      y,
      false,
      track,
      0.22
    )
  }

  private addOrientedRect(
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    center: THREE.Vector3,
    tangent: THREE.Vector3,
    length: number,
    width: number,
    y: number,
    swapAxes = false,
    track: TrackModel | null = null,
    lift = 0
  ): void {
    const forward = tangent.clone().normalize()
    const side = new THREE.Vector3(-forward.z, 0, forward.x)
    const longAxis = swapAxes ? side : forward
    const shortAxis = swapAxes ? forward : side
    const halfLength = length * 0.5
    const halfWidth = width * 0.5
    const base = positions.length / 3
    const corners = [
      new THREE.Vector3()
        .copy(center)
        .addScaledVector(longAxis, -halfLength)
        .addScaledVector(shortAxis, -halfWidth),
      new THREE.Vector3()
        .copy(center)
        .addScaledVector(longAxis, halfLength)
        .addScaledVector(shortAxis, -halfWidth),
      new THREE.Vector3()
        .copy(center)
        .addScaledVector(longAxis, -halfLength)
        .addScaledVector(shortAxis, halfWidth),
      new THREE.Vector3()
        .copy(center)
        .addScaledVector(longAxis, halfLength)
        .addScaledVector(shortAxis, halfWidth),
    ]

    for (const corner of corners) {
      if (track) {
        this.addRoadPaintCorner(track, corner, lift, positions, normals)
      } else {
        positions.push(corner.x, y, corner.z)
        normals.push(0, 1, 0)
      }
    }

    uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
    indices.push(base, base + 1, base + 2)
    indices.push(base + 1, base + 3, base + 2)
  }

  private addRoadPaintCorner(
    track: TrackModel,
    point: THREE.Vector3,
    lift: number,
    positions: number[],
    normals: number[]
  ): void {
    const band = track.getBandData(point.x, point.z)
    const y =
      track.getBankedHeightAtDistance(band.distanceAlong, band.lateralOffset, track.roadY) + lift
    const normal = track.getBankedNormalAtDistance(band.distanceAlong)

    positions.push(point.x, y, point.z)
    normals.push(normal.x, normal.y, normal.z)
  }
}
