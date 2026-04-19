import * as THREE from 'three'
import { TrackModel } from '../../domain/road/TrackModel'
import { loadRepeatingPbrTextures } from './TextureFactory'

export interface RoadSceneMeshes {
  apron: THREE.Mesh
  road: THREE.Mesh
  shoulder: THREE.Mesh
  markingGroup: THREE.Group
}

export class RoadMeshFactory {
  create(track: TrackModel): RoadSceneMeshes {
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
    apron.receiveShadow = false
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
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    })
    const road = new THREE.Mesh(roadGeometry, roadMaterial)
    road.frustumCulled = false
    road.receiveShadow = false
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
    shoulder.receiveShadow = false
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
    const laneMarking = new THREE.Mesh(this.buildLaneMarkingGeometry(track), laneMarkMaterial)
    laneMarking.frustumCulled = false
    laneMarking.renderOrder = 8
    const startGrid = new THREE.Mesh(this.buildStartGridGeometry(track), laneMarkMaterial)
    startGrid.frustumCulled = false
    startGrid.renderOrder = 9
    markingGroup.renderOrder = 8
    markingGroup.add(laneMarking)
    markingGroup.add(startGrid)

    return { apron, road, shoulder, markingGroup }
  }

  private buildOffsetLoop(track: TrackModel, offset: number, y: number): THREE.Vector3[] {
    const loop: THREE.Vector3[] = []
    const count = track.centerline.length

    for (let i = 0; i < count; i++) {
      const prev = track.centerline[(i - 1 + count) % count]
      const current = track.centerline[i]
      const next = track.centerline[(i + 1) % count]
      const tangent = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z).normalize()
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(offset)

      loop.push(new THREE.Vector3(current.x + normal.x, y, current.z + normal.z))
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

      positions.push(left.x, left.y, left.z, right.x, right.y, right.z)
      normals.push(0, 1, 0, 0, 1, 0)
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

      positions.push(
        outerLeft.x, outerLeft.y, outerLeft.z,
        innerLeft.x, innerLeft.y, innerLeft.z,
        innerRight.x, innerRight.y, innerRight.z,
        outerRight.x, outerRight.y, outerRight.z
      )
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0)
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
    const dashLength = 5.4
    const dashWidth = 0.58
    const dashCount = Math.max(24, Math.floor(track.totalLength / dashSpacing))
    const y = track.roadY + 0.085
    const start = new THREE.Vector3()
    const end = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()

    for (let i = 0; i < dashCount; i++) {
      const centerDistance = (i / dashCount) * track.totalLength
      track.sampleCenterlineByDistance(centerDistance - dashLength * 0.5, start)
      track.sampleCenterlineByDistance(centerDistance + dashLength * 0.5, end)

      tangent.set(end.x - start.x, 0, end.z - start.z)

      if (tangent.lengthSq() < 0.0001) {
        track.sampleCenterlineByDistance(centerDistance, start, tangent)
      }

      tangent.normalize()
      side.set(-tangent.z, 0, tangent.x).multiplyScalar(dashWidth * 0.5)

      const base = positions.length / 3
      positions.push(
        start.x + side.x, y, start.z + side.z,
        start.x - side.x, y, start.z - side.z,
        end.x + side.x, y, end.z + side.z,
        end.x - side.x, y, end.z - side.z
      )
      normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0)
      uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
      indices.push(base, base + 1, base + 2)
      indices.push(base + 1, base + 3, base + 2)
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

  private buildStartGridGeometry(track: TrackModel): THREE.BufferGeometry {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const y = track.roadY + 0.105
    const startDistance =
      (THREE.MathUtils.euclideanModulo(track.startAngle, Math.PI * 2) / (Math.PI * 2)) *
      track.totalLength
    const center = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const side = new THREE.Vector3()

    track.sampleCenterlineByDistance(startDistance, center, tangent)
    this.addOrientedRect(
      positions,
      normals,
      uvs,
      indices,
      center,
      tangent,
      track.roadWidth * 0.9,
      0.72,
      y,
      true
    )

    const slotLength = 6.2
    const slotWidth = 3.2
    const lineWidth = 0.22
    const slotCenters = [
      { distanceOffset: -5.1, lateralOffset: 0 },
      { distanceOffset: -12.2, lateralOffset: -track.roadWidth * 0.24 },
      { distanceOffset: -12.2, lateralOffset: track.roadWidth * 0.24 },
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
        y
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
    y: number
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
      true
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
      true
    )

    rectCenter.copy(center).addScaledVector(side, width * 0.5)
    this.addOrientedRect(positions, normals, uvs, indices, rectCenter, tangent, length, lineWidth, y)

    rectCenter.copy(center).addScaledVector(side, -width * 0.5)
    this.addOrientedRect(positions, normals, uvs, indices, rectCenter, tangent, length, lineWidth, y)
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
    swapAxes = false
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
      positions.push(corner.x, y, corner.z)
      normals.push(0, 1, 0)
    }

    uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
    indices.push(base, base + 1, base + 2)
    indices.push(base + 1, base + 3, base + 2)
  }
}
