import type { EnvironmentPreset } from '../../domain/environment/EnvironmentPreset'
import type { RainEffect } from '../../infrastructure/effects/RainEffect'
import type { SunDisc } from '../../infrastructure/effects/SunDisc'
import type { GameRenderer } from '../../infrastructure/rendering/GameRenderer'
import type { SceneLighting } from '../../infrastructure/rendering/LightingFactory'

export class EnvironmentController {
  constructor(
    private readonly gameRenderer: GameRenderer,
    private readonly lighting: SceneLighting,
    private readonly rainEffect: RainEffect,
    private readonly sunDisc: SunDisc
  ) {}

  applyPreset(preset: EnvironmentPreset): void {
    this.gameRenderer.setSky(preset.skyTopColor, preset.skyBottomColor)
    this.gameRenderer.setFog(preset.fogColor, preset.fogNear, preset.fogFar)
    this.lighting.applyPreset(preset)
    this.rainEffect.setIntensity(preset.rainIntensity)
    this.sunDisc.applyPreset(preset)
  }

  update(delta: number): void {
    this.rainEffect.update(delta)
    this.sunDisc.update()
  }
}
