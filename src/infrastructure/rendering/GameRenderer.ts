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

  setSky(topColor: THREE.ColorRepresentation, bottomColor: THREE.ColorRepresentation): void {
    this.skyTopColor.set(topColor)
    this.skyBottomColor.set(bottomColor)
  }

  setFog(color: THREE.ColorRepresentation, near: number, far: number): void {
    const fogColor = new THREE.Color(color)
    this.scene.background = fogColor.lerp(this.skyBottomColor, 0.38)
    this.scene.fog = new THREE.Fog(fogColor, near, far)
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualitySettings.maxPixelRatio))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    return renderer
  }

  private readonly handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualitySettings.maxPixelRatio))
  }
}
