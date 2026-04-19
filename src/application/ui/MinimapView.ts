import * as THREE from 'three'
import type { CarView } from '../../infrastructure/graphics/CarView'
import type { TrackBounds } from '../../domain/road/TrackModel'
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
  private readonly trackCanvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D | null
  private readonly trackContext: CanvasRenderingContext2D | null
  private readonly startVector = new THREE.Vector3()
  private readonly carPosition = new THREE.Vector3()
  private readonly padding = 22
  private readonly bounds: TrackBounds
  private readonly mapScale: number

  constructor(
    private readonly road: Road,
    parent: HTMLElement = document.body
  ) {
    this.bounds = this.road.trackBounds
    const spanX = Math.max(this.bounds.maxX - this.bounds.minX, 1)
    const spanZ = Math.max(this.bounds.maxZ - this.bounds.minZ, 1)
    this.mapScale = Math.min(
      (220 - this.padding * 2) / spanX,
      (220 - this.padding * 2) / spanZ
    )

    this.canvas = document.createElement('canvas')
    this.trackCanvas = document.createElement('canvas')
    this.canvas.width = 220
    this.canvas.height = 220
    this.trackCanvas.width = this.canvas.width
    this.trackCanvas.height = this.canvas.height
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
    this.trackContext = this.trackCanvas.getContext('2d')
    this.drawStaticTrack()
  }

  draw(markers: MinimapCarMarker[]): void {
    if (!this.context) return

    const width = this.canvas.width
    const height = this.canvas.height

    this.context.clearRect(0, 0, width, height)
    this.context.drawImage(this.trackCanvas, 0, 0)

    for (const marker of markers) {
      marker.car.copyPosition(this.carPosition)
      this.drawCar(
        this.worldToMap(this.carPosition.x, this.carPosition.z),
        marker.heading,
        marker.color,
        marker.isPlayer
      )
    }
  }

  private drawStaticTrack(): void {
    if (!this.trackContext) return

    const width = this.trackCanvas.width
    const height = this.trackCanvas.height

    this.trackContext.clearRect(0, 0, width, height)
    this.trackContext.fillStyle = 'rgba(24, 28, 34, 0.88)'
    this.trackContext.fillRect(0, 0, width, height)

    this.drawTrack(this.trackContext)
    this.drawStart(this.trackContext)
  }

  private worldToMap(x: number, z: number): MapPoint {
    return {
      x: this.padding + (x - this.bounds.minX) * this.mapScale,
      y: this.canvas.height - this.padding - (z - this.bounds.minZ) * this.mapScale,
    }
  }

  private drawTrack(context: CanvasRenderingContext2D): void {
    if (this.road.centerline.length <= 1) return

    context.lineCap = 'round'
    context.lineJoin = 'round'
    this.strokeCenterline(
      context,
      '#8b7d62',
      (this.road.roadWidth + this.road.shoulderWidth * 2) * this.mapScale
    )
    this.strokeCenterline(context, '#596067', this.road.roadWidth * this.mapScale)
  }

  private strokeCenterline(
    context: CanvasRenderingContext2D,
    color: string,
    lineWidth: number
  ): void {
    context.beginPath()
    this.road.centerline.forEach((point, index) => {
      const mapPoint = this.worldToMap(point.x, point.z)
      if (index === 0) context.moveTo(mapPoint.x, mapPoint.y)
      else context.lineTo(mapPoint.x, mapPoint.y)
    })

    const firstPoint = this.worldToMap(this.road.centerline[0].x, this.road.centerline[0].z)
    context.lineTo(firstPoint.x, firstPoint.y)
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.stroke()
  }

  private drawStart(context: CanvasRenderingContext2D): void {
    const startVector = this.road.getCenterPointAtAngle(this.road.startAngle, this.startVector)
    const startPoint = this.worldToMap(startVector.x, startVector.z)
    context.beginPath()
    context.arc(startPoint.x, startPoint.y, 4, 0, Math.PI * 2)
    context.fillStyle = '#f3e7a4'
    context.fill()
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
