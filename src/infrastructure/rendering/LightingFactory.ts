import * as THREE from 'three'
import { qualitySettings } from '../../application/config/QualitySettings'
import type { EnvironmentPreset } from '../../domain/environment/EnvironmentPreset'

export class SceneLighting {
  constructor(
    private readonly ambient: THREE.AmbientLight,
    private readonly hemisphere: THREE.HemisphereLight,
    private readonly sun: THREE.DirectionalLight
  ) {}

  applyPreset(preset: EnvironmentPreset): void {
    this.ambient.intensity = preset.ambientIntensity
    this.hemisphere.intensity = preset.hemisphereIntensity
    this.sun.intensity = preset.sunIntensity
    this.sun.color.set(preset.sunColor)
    this.sun.position.set(...preset.sunPosition)
  }
}

export class LightingFactory {
  attachTo(scene: THREE.Scene): SceneLighting {
    const ambient = new THREE.AmbientLight(0xffffff, 1.5)
    const hemisphere = new THREE.HemisphereLight(0xe5f3ff, 0xb8c19a, 1.4)
    const sun = this.createSunLight()

    scene.add(ambient)
    scene.add(hemisphere)
    scene.add(sun)

    return new SceneLighting(ambient, hemisphere, sun)
  }

  private createSunLight(): THREE.DirectionalLight {
    const sun = new THREE.DirectionalLight(0xffffff, 2.4)
    sun.position.set(40, 45, 20)
    sun.castShadow = true
    sun.shadow.mapSize.width = qualitySettings.shadowMapSize
    sun.shadow.mapSize.height = qualitySettings.shadowMapSize
    sun.shadow.camera.left = -240
    sun.shadow.camera.right = 240
    sun.shadow.camera.top = 240
    sun.shadow.camera.bottom = -240
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 520
    sun.shadow.bias = 0.00008
    sun.shadow.normalBias = 0.08
    return sun
  }
}
