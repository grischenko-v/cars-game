import * as THREE from 'three'
import { clamp, expLerpFactor } from '../../utils/math'

const SPEED_REFERENCE = 38

export class SpeedLinesOverlay {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private intensity = 0
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
    this.canvas.style.mixBlendMode = 'multiply'
    this.parent.appendChild(this.canvas)
    window.addEventListener('resize', this.handleResize)
    this.resize()
  }

  update(speed: number, delta: number): void {
    const targetIntensity = THREE.MathUtils.smoothstep(
      clamp(Math.abs(speed) / SPEED_REFERENCE, 0, 1),
      0.24,
      0.92
    )
    this.intensity = THREE.MathUtils.lerp(
      this.intensity,
      targetIntensity,
      expLerpFactor(5.5, delta)
    )
    const blur = this.intensity * 8
    const clearRadius = 42 - this.intensity * 14
    const softRadius = 62 - this.intensity * 10
    const mask = `radial-gradient(circle at 50% 48%, transparent 0 ${clearRadius}%, rgba(0,0,0,0.35) ${softRadius}%, black 100%)`
    this.canvas.style.backdropFilter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : ''
    this.canvas.style.setProperty('-webkit-backdrop-filter', this.canvas.style.backdropFilter)
    this.canvas.style.maskImage = mask
    this.canvas.style.setProperty('-webkit-mask-image', mask)

    if (this.intensity < 0.015 && targetIntensity < 0.015) {
      if (this.hasVisibleFrame) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.canvas.style.backdropFilter = ''
        this.canvas.style.removeProperty('-webkit-backdrop-filter')
        this.canvas.style.maskImage = ''
        this.canvas.style.removeProperty('-webkit-mask-image')
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

    ctx.save()
    ctx.scale(dpr, dpr)

    const vignette = ctx.createRadialGradient(
      centerX,
      centerY,
      logicalWidth * (0.16 + this.intensity * 0.04),
      centerX,
      centerY,
      logicalWidth * (0.58 - this.intensity * 0.1)
    )
    vignette.addColorStop(0, 'rgba(255,255,255,0)')
    vignette.addColorStop(0.52, `rgba(15,22,28,${0.1 * this.intensity})`)
    vignette.addColorStop(1, `rgba(2,6,10,${0.42 * this.intensity})`)
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, logicalWidth, logicalHeight)

    const tunnel = ctx.createRadialGradient(
      centerX,
      centerY,
      logicalWidth * 0.05,
      centerX,
      centerY,
      logicalWidth * 0.5
    )
    tunnel.addColorStop(0, `rgba(255,255,255,${0.025 * this.intensity})`)
    tunnel.addColorStop(0.42, 'rgba(255,255,255,0)')
    tunnel.addColorStop(1, `rgba(120,165,210,${0.09 * this.intensity})`)
    ctx.fillStyle = tunnel
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
