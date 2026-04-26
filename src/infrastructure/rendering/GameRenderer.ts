import * as THREE from 'three'
import { qualitySettings } from '../../application/config/QualitySettings'

export interface GameRenderingContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
}

export class GameRenderer {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  private readonly skyTopColor = new THREE.Color(0x6eaefc)
  private readonly skyBottomColor = new THREE.Color(0xf1f7ff)
  private currentPixelRatio = qualitySettings.maxPixelRatio
  private performanceSampleTime = 0
  private performanceFrameCount = 0

  constructor(private readonly container: HTMLElement = document.body) {
    this.scene = this.createScene()
    this.camera = this.createCamera()
    this.renderer = this.createRenderer()

    this.container.style.margin = '0'
    this.container.style.overflow = 'hidden'
    this.container.appendChild(this.renderer.domElement)
    window.addEventListener('resize', this.handleResize)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  updatePerformance(delta: number): void {
    this.performanceSampleTime += delta
    this.performanceFrameCount += 1

    if (this.performanceSampleTime < 0.6) return

    const averageDelta = this.performanceSampleTime / Math.max(this.performanceFrameCount, 1)

    if (averageDelta > 1 / 48) {
      this.applyPixelRatio(this.currentPixelRatio - 0.08)
    } else if (averageDelta < 1 / 62) {
      this.applyPixelRatio(this.currentPixelRatio + 0.04)
    }

    this.performanceSampleTime = 0
    this.performanceFrameCount = 0
  }

  setSky(topColor: THREE.ColorRepresentation, bottomColor: THREE.ColorRepresentation): void {
    this.skyTopColor.set(topColor)
    this.skyBottomColor.set(bottomColor)
  }

  setFog(color: THREE.ColorRepresentation, near: number, far: number): void {
    const fogColor = new THREE.Color(color)
    this.scene.background = fogColor.lerp(this.skyBottomColor, 0.38)
    this.scene.fog = new THREE.Fog(fogColor, near, far)
  }

  setCameraFar(distance: number): void {
    this.camera.far = Math.max(this.camera.near + 10, distance)
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    this.renderer.dispose()
  }

  private createScene(): THREE.Scene {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x9fc6ff)
    scene.fog = new THREE.Fog(0x9fc6ff, 80, 340)
    return scene
  }

  private createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.set(0, 2.5, 6)
    return camera
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(this.clampPixelRatio(qualitySettings.maxPixelRatio))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    return renderer
  }

  private readonly handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(this.clampPixelRatio(this.currentPixelRatio))
  }

  private applyPixelRatio(nextRatio: number): void {
    const clamped = this.clampPixelRatio(nextRatio)

    if (Math.abs(clamped - this.currentPixelRatio) < 0.045) return

    this.currentPixelRatio = clamped
    this.renderer.setPixelRatio(clamped)
  }

  private clampPixelRatio(ratio: number): number {
    return Math.min(
      window.devicePixelRatio,
      THREE.MathUtils.clamp(ratio, qualitySettings.minPixelRatio, qualitySettings.maxPixelRatio)
    )
  }
}
