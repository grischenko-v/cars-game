import * as THREE from 'three'
import { clamp, expLerpFactor } from '../../utils/math'

const SPEED_REFERENCE = 38

export class SpeedLinesOverlay {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private intensity = 0
  private time = 0
  private pixelRatio = 1
  private hasVisibleFrame = false

  constructor(private readonly parent: HTMLElement = document.body) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('SpeedLinesOverlay requires a 2D canvas context')
    }

    this.canvas = canvas
    this.context = context
    this.canvas.style.position = 'fixed'
    this.canvas.style.inset = '0'
    this.canvas.style.pointerEvents = 'none'
    this.canvas.style.zIndex = '3'
    this.canvas.style.mixBlendMode = 'screen'
    this.parent.appendChild(this.canvas)
    window.addEventListener('resize', this.handleResize)
    this.resize()
  }

  update(speed: number, delta: number): void {
    const targetIntensity = THREE.MathUtils.smoothstep(
      clamp(Math.abs(speed) / SPEED_REFERENCE, 0, 1),
      0.36,
      1
    )
    this.intensity = THREE.MathUtils.lerp(
      this.intensity,
      targetIntensity,
      expLerpFactor(5.5, delta)
    )
    this.time += delta * (1 + this.intensity * 5)

    if (this.intensity < 0.015 && targetIntensity < 0.015) {
      if (this.hasVisibleFrame) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.hasVisibleFrame = false
      }

      return
    }

    this.draw()
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    this.canvas.remove()
  }

  private draw(): void {
    const { width, height } = this.canvas
    const ctx = this.context
    ctx.clearRect(0, 0, width, height)

    if (this.intensity < 0.015) {
      this.hasVisibleFrame = false
      return
    }

    this.hasVisibleFrame = true

    const dpr = this.pixelRatio
    const logicalWidth = width / dpr
    const logicalHeight = height / dpr
    const centerX = logicalWidth * 0.5
    const centerY = logicalHeight * 0.48
    const lineCount = Math.floor(18 + this.intensity * 58)

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'

    for (let i = 0; i < lineCount; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const seed = (i * 47.13 + this.time * 9.7) % 1
      const edgeBias = 0.68 + ((i * 19.37 + this.time * 1.7) % 1) * 0.3
      const y = ((i * 83.17 + this.time * 340) % logicalHeight)
      const x = side < 0
        ? logicalWidth * (1 - edgeBias)
        : logicalWidth * edgeBias
      const dx = x - centerX
      const dy = y - centerY
      const length = (46 + seed * 118) * this.intensity
      const distance = Math.max(Math.hypot(dx, dy), 1)
      const nx = dx / distance
      const ny = dy / distance
      const alpha = (0.08 + seed * 0.16) * this.intensity

      ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`
      ctx.lineWidth = 1 + this.intensity * 2.3
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - nx * length, y - ny * length)
      ctx.stroke()
    }

    const vignette = ctx.createRadialGradient(
      centerX,
      centerY,
      logicalWidth * 0.2,
      centerX,
      centerY,
      logicalWidth * 0.72
    )
    vignette.addColorStop(0, 'rgba(255,255,255,0)')
    vignette.addColorStop(1, `rgba(125,180,255,${0.09 * this.intensity})`)
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, logicalWidth, logicalHeight)
    ctx.restore()
  }

  private resize(): void {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.floor(window.innerWidth * this.pixelRatio)
    this.canvas.height = Math.floor(window.innerHeight * this.pixelRatio)
    this.canvas.style.width = `${window.innerWidth}px`
    this.canvas.style.height = `${window.innerHeight}px`
  }

  private readonly handleResize = (): void => {
    this.resize()
  }
}
