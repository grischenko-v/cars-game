import * as THREE from 'three'
import { qualitySettings } from '../../application/config/QualitySettings'

export class LightingFactory {
  attachTo(scene: THREE.Scene): void {
    scene.add(new THREE.AmbientLight(0xffffff, 1.5))
    scene.add(new THREE.HemisphereLight(0xe5f3ff, 0xb8c19a, 1.4))
    scene.add(this.createSunLight())
  }

  private createSunLight(): THREE.DirectionalLight {
    const sun = new THREE.DirectionalLight(0xffffff, 2.4)
    sun.position.set(40, 45, 20)
    sun.castShadow = true
    sun.shadow.mapSize.width = qualitySettings.shadowMapSize
    sun.shadow.mapSize.height = qualitySettings.shadowMapSize
    sun.shadow.camera.left = -180
    sun.shadow.camera.right = 180
    sun.shadow.camera.top = 180
    sun.shadow.camera.bottom = -180
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 320
    sun.shadow.bias = 0.00008
    sun.shadow.normalBias = 0.08
    return sun
  }
}
