import * as THREE from 'three'
import type { CarView } from '../../infrastructure/graphics/CarView'
import type { Road } from '../../world/Road'

interface MapPoint {
  x: number
  y: number
}

export interface MinimapCarMarker {
  car: CarView
  heading: number
  color: string
  isPlayer: boolean
}

export class MinimapView {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D | null
  private readonly startVector = new THREE.Vector3()
  private readonly carPosition = new THREE.Vector3()

  constructor(
    private readonly road: Road,
    parent: HTMLElement = document.body
  ) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 220
    this.canvas.height = 220
    this.canvas.style.position = 'fixed'
    this.canvas.style.top = '16px'
    this.canvas.style.right = '16px'
    this.canvas.style.width = '220px'
    this.canvas.style.height = '220px'
    this.canvas.style.background = 'rgba(20,20,24,0.55)'
    this.canvas.style.backdropFilter = 'blur(6px)'
    this.canvas.style.borderRadius = '16px'
    this.canvas.style.zIndex = '10'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.18)'
    parent.appendChild(this.canvas)

    this.context = this.canvas.getContext('2d')
  }

  draw(markers: MinimapCarMarker[]): void {
    if (!this.context) return

    const width = this.canvas.width
    const height = this.canvas.height
    const padding = 22
    const bounds = this.road.trackBounds
    const spanX = Math.max(bounds.maxX - bounds.minX, 1)
    const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1)
    const scale = Math.min(
      (width - padding * 2) / spanX,
      (height - padding * 2) / spanZ
    )
    const worldToMap = (x: number, z: number): MapPoint => ({
      x: padding + (x - bounds.minX) * scale,
      y: height - padding - (z - bounds.minZ) * scale,
    })

    this.context.clearRect(0, 0, width, height)
    this.context.fillStyle = 'rgba(24, 28, 34, 0.88)'
    this.context.fillRect(0, 0, width, height)

    this.drawTrack(worldToMap, scale)
    this.drawStart(worldToMap)

    for (const marker of markers) {
      marker.car.copyPosition(this.carPosition)
      this.drawCar(
        worldToMap(this.carPosition.x, this.carPosition.z),
        marker.heading,
        marker.color,
        marker.isPlayer
      )
    }
  }

  private drawTrack(worldToMap: (x: number, z: number) => MapPoint, scale: number): void {
    if (!this.context || this.road.centerline.length <= 1) return

    this.context.lineCap = 'round'
    this.context.lineJoin = 'round'
    this.strokeCenterline(
      worldToMap,
      '#8b7d62',
      (this.road.roadWidth + this.road.shoulderWidth * 2) * scale
    )
    this.strokeCenterline(worldToMap, '#596067', this.road.roadWidth * scale)
  }

  private strokeCenterline(
    worldToMap: (x: number, z: number) => MapPoint,
    color: string,
    lineWidth: number
  ): void {
    if (!this.context) return

    const context = this.context

    context.beginPath()
    this.road.centerline.forEach((point, index) => {
      const mapPoint = worldToMap(point.x, point.z)
      if (index === 0) context.moveTo(mapPoint.x, mapPoint.y)
      else context.lineTo(mapPoint.x, mapPoint.y)
    })

    const firstPoint = worldToMap(this.road.centerline[0].x, this.road.centerline[0].z)
    context.lineTo(firstPoint.x, firstPoint.y)
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.stroke()
  }

  private drawStart(worldToMap: (x: number, z: number) => MapPoint): void {
    if (!this.context) return

    const startVector = this.road.getCenterPointAtAngle(this.road.startAngle, this.startVector)
    const startPoint = worldToMap(startVector.x, startVector.z)
    this.context.beginPath()
    this.context.arc(startPoint.x, startPoint.y, 4, 0, Math.PI * 2)
    this.context.fillStyle = '#f3e7a4'
    this.context.fill()
  }

  private drawCar(carMap: MapPoint, heading: number, color: string, isPlayer: boolean): void {
    if (!this.context) return

    const arrowLength = isPlayer ? 12 : 9
    const radius = isPlayer ? 5 : 4
    const dirX = Math.sin(heading)
    const dirY = -Math.cos(heading)

    this.context.beginPath()
    this.context.arc(carMap.x, carMap.y, radius, 0, Math.PI * 2)
    this.context.fillStyle = color
    this.context.fill()
    this.context.strokeStyle = isPlayer ? '#fff4da' : 'rgba(255,255,255,0.78)'
    this.context.lineWidth = isPlayer ? 2 : 1.5
    this.context.stroke()

    this.context.beginPath()
    this.context.moveTo(carMap.x, carMap.y)
    this.context.lineTo(carMap.x + dirX * arrowLength, carMap.y + dirY * arrowLength)
    this.context.strokeStyle = '#fff4da'
    this.context.lineWidth = isPlayer ? 2.5 : 1.8
    this.context.stroke()
  }
}
