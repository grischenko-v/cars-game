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
const samplePoint = new THREE.Vector3()
const sampleTangent = new THREE.Vector3()
const carPosition = new THREE.Vector3()
const padding = 22
const bounds: TrackBounds = createMapBounds()
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

function createMapBounds(): TrackBounds {
  const baseBounds = props.road.trackBounds
  const sampleCount = Math.max(180, Math.ceil(props.road.totalLength / 18))
  const bounds: TrackBounds = {
    minX: baseBounds.minX,
    maxX: baseBounds.maxX,
    minZ: baseBounds.minZ,
    maxZ: baseBounds.maxZ,
  }

  for (let i = 0; i < sampleCount; i++) {
    const distance = (i / sampleCount) * props.road.totalLength
    const halfWidth = props.road.getOuterHalfWidthAtDistance(distance)

    props.road.sampleCenterlineByDistance(distance, samplePoint, sampleTangent)
    expandBounds(bounds, samplePoint.x - halfWidth, samplePoint.z - halfWidth)
    expandBounds(bounds, samplePoint.x + halfWidth, samplePoint.z + halfWidth)
  }

  return bounds
}

function expandBounds(bounds: TrackBounds, x: number, z: number): void {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.minZ = Math.min(bounds.minZ, z)
  bounds.maxZ = Math.max(bounds.maxZ, z)
}

function drawTrack(targetContext: CanvasRenderingContext2D): void {
  drawTrackRibbon(
    targetContext,
    (distance) => props.road.getOuterHalfWidthAtDistance(distance),
    '#8b7d62'
  )
  drawTrackRibbon(
    targetContext,
    (distance) => props.road.getTrackHalfWidthAtDistance(distance),
    '#596067'
  )
}

function drawTrackRibbon(
  targetContext: CanvasRenderingContext2D,
  getHalfWidth: (distance: number) => number,
  color: string
): void {
  const sampleCount = Math.max(220, Math.ceil(props.road.totalLength / 12))
  const leftEdge: MapPoint[] = []
  const rightEdge: MapPoint[] = []

  for (let i = 0; i <= sampleCount; i++) {
    const distance = (i / sampleCount) * props.road.totalLength
    const halfWidth = getHalfWidth(distance)

    props.road.sampleCenterlineByDistance(distance, samplePoint, sampleTangent)

    const sideX = -sampleTangent.z
    const sideZ = sampleTangent.x

    leftEdge.push(worldToMap(samplePoint.x + sideX * halfWidth, samplePoint.z + sideZ * halfWidth))
    rightEdge.push(worldToMap(samplePoint.x - sideX * halfWidth, samplePoint.z - sideZ * halfWidth))
  }

  targetContext.beginPath()
  leftEdge.forEach((mapPoint, index) => {
    if (index === 0) targetContext.moveTo(mapPoint.x, mapPoint.y)
    else targetContext.lineTo(mapPoint.x, mapPoint.y)
  })

  for (let i = rightEdge.length - 1; i >= 0; i--) {
    targetContext.lineTo(rightEdge[i].x, rightEdge[i].y)
  }

  targetContext.closePath()
  targetContext.fillStyle = color
  targetContext.fill()
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
