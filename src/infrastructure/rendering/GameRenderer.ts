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

  dispose(): void {
    window.removeEventListener('resize', this.handleResize)
    this.renderer.dispose()
  }

  private createScene(): THREE.Scene {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x9fc6ff)
    scene.fog = new THREE.Fog(0x9fc6ff, 80, 340)
    scene.add(this.createSky())
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    return renderer
  }

  private createSky(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 32),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(0x6eaefc) },
          bottomColor: { value: new THREE.Color(0xf1f7ff) },
          offset: { value: 140 },
          exponent: { value: 0.9 },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
            float t = max(pow(max(h, 0.0), exponent), 0.0);
            gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
          }
        `,
      })
    )
  }

  private readonly handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualitySettings.maxPixelRatio))
  }
}
