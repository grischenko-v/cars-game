<script setup lang="ts">
import * as THREE from 'three'
import { onMounted, ref } from 'vue'
import type { CarView } from '../../../infrastructure/graphics/CarView'
import type { TrackBounds } from '../../../domain/road/TrackModel'
import type { Road } from '../../../world/Road'

interface MapPoint {
  x: number
  y: number
}

interface MinimapCarMarker {
  car: CarView
  heading: number
  color: string
  isPlayer: boolean
}

const props = defineProps<{
  road: Road
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const trackCanvas = document.createElement('canvas')
const startVector = new THREE.Vector3()
const carPosition = new THREE.Vector3()
const padding = 22
const bounds: TrackBounds = props.road.trackBounds
const spanX = Math.max(bounds.maxX - bounds.minX, 1)
const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1)
const mapScale = Math.min(
  (220 - padding * 2) / spanX,
  (220 - padding * 2) / spanZ
)

let context: CanvasRenderingContext2D | null = null
let trackContext: CanvasRenderingContext2D | null = null

onMounted(() => {
  if (!canvas.value) return

  trackCanvas.width = canvas.value.width
  trackCanvas.height = canvas.value.height
  context = canvas.value.getContext('2d')
  trackContext = trackCanvas.getContext('2d')
  drawStaticTrack()
})

function draw(markers: MinimapCarMarker[]): void {
  if (!context || !canvas.value) return

  const width = canvas.value.width
  const height = canvas.value.height

  context.clearRect(0, 0, width, height)
  context.drawImage(trackCanvas, 0, 0)

  for (const marker of markers) {
    marker.car.copyPosition(carPosition)
    drawCar(
      worldToMap(carPosition.x, carPosition.z),
      marker.heading,
      marker.color,
      marker.isPlayer
    )
  }
}

function drawStaticTrack(): void {
  if (!trackContext || !canvas.value) return

  const width = canvas.value.width
  const height = canvas.value.height

  trackContext.clearRect(0, 0, width, height)
  trackContext.fillStyle = 'rgba(24, 28, 34, 0.88)'
  trackContext.fillRect(0, 0, width, height)

  drawTrack(trackContext)
  drawStart(trackContext)
}

function worldToMap(x: number, z: number): MapPoint {
  if (!canvas.value) return { x: 0, y: 0 }

  return {
    x: padding + (x - bounds.minX) * mapScale,
    y: canvas.value.height - padding - (z - bounds.minZ) * mapScale,
  }
}

function drawTrack(targetContext: CanvasRenderingContext2D): void {
  if (props.road.centerline.length <= 1) return

  targetContext.lineCap = 'round'
  targetContext.lineJoin = 'round'
  strokeCenterline(
    targetContext,
    '#8b7d62',
    (props.road.roadWidth + props.road.shoulderWidth * 2) * mapScale
  )
  strokeCenterline(targetContext, '#596067', props.road.roadWidth * mapScale)
}

function strokeCenterline(
  targetContext: CanvasRenderingContext2D,
  color: string,
  lineWidth: number
): void {
  targetContext.beginPath()
  props.road.centerline.forEach((point, index) => {
    const mapPoint = worldToMap(point.x, point.z)
    if (index === 0) targetContext.moveTo(mapPoint.x, mapPoint.y)
    else targetContext.lineTo(mapPoint.x, mapPoint.y)
  })

  const firstPoint = worldToMap(props.road.centerline[0].x, props.road.centerline[0].z)
  targetContext.lineTo(firstPoint.x, firstPoint.y)
  targetContext.strokeStyle = color
  targetContext.lineWidth = lineWidth
  targetContext.stroke()
}

function drawStart(targetContext: CanvasRenderingContext2D): void {
  props.road.getCenterPointAtAngle(props.road.startAngle, startVector)
  const startPoint = worldToMap(startVector.x, startVector.z)
  targetContext.beginPath()
  targetContext.arc(startPoint.x, startPoint.y, 4, 0, Math.PI * 2)
  targetContext.fillStyle = '#f3e7a4'
  targetContext.fill()
}

function drawCar(carMap: MapPoint, heading: number, color: string, isPlayer: boolean): void {
  if (!context) return

  const arrowLength = isPlayer ? 12 : 9
  const radius = isPlayer ? 5 : 4
  const dirX = Math.sin(heading)
  const dirY = -Math.cos(heading)

  context.beginPath()
  context.arc(carMap.x, carMap.y, radius, 0, Math.PI * 2)
  context.fillStyle = color
  context.fill()
  context.strokeStyle = isPlayer ? '#fff4da' : 'rgba(255,255,255,0.78)'
  context.lineWidth = isPlayer ? 2 : 1.5
  context.stroke()

  context.beginPath()
  context.moveTo(carMap.x, carMap.y)
  context.lineTo(carMap.x + dirX * arrowLength, carMap.y + dirY * arrowLength)
  context.strokeStyle = '#fff4da'
  context.lineWidth = isPlayer ? 2.5 : 1.8
  context.stroke()
}

defineExpose({ draw })
</script>

<template>
  <section class="minimap-panel" aria-label="Миникарта">
    <canvas ref="canvas" class="minimap-panel__canvas" width="220" height="220" />
  </section>
</template>

<style src="./MinimapPanel.css"></style>
