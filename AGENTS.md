# AGENTS.md

## 📌 Overview

This project is racing game. 

- Vite
- TypeScript
- Three.js
- GLB model loading (GLTFLoader)
- Vue SFC components for DOM UI widgets
- Keyboard-based car movement
- Mouse-based camera orbit (OrbitControls)

The app renders a drivable car with a follow/target camera, analog instruments, lap/race UI, generated scenery, and multiple AI opponents.

---

## 🧱 Project Structure
```text
/public
  /models
    mustang.glb
    mini.glb

/src
  main.ts
  /application
    /config
      QualitySettings.ts
    /camera
      FollowCameraController.ts
    /input
      KeyboardInput.ts
    /game
      CountdownController.ts
      GamePhase.ts
      RacingGame.ts
      RacingGameConfig.ts
    /environment
      EnvironmentController.ts
    /ai
      OpponentDriver.ts
    /physics
      DriveControls.ts
      SurfaceSpeedPolicy.ts
      VehicleGroundingService.ts
    /race
      Competitor.ts
      CompetitorRegistry.ts
      OpponentProfile.ts
      StartGridPlacementService.ts
    /ui
      HudView.ts
      MinimapView.ts
      PositionLabelView.ts
      StandingsView.ts
      /components
        HudPanel.vue
        HudPanel.css
        LoadingOverlay.vue
        LoadingOverlay.css
        MinimapPanel.vue
        MinimapPanel.css
        PositionLabelsOverlay.vue
        PositionLabelsOverlay.css
        StandingsPanel.vue
        StandingsPanel.css
  /domain
    /car
      Car.ts
    /environment
      EnvironmentPreset.ts
      EnvironmentPresetFactory.ts
      TerrainProfile.ts
      TerrainProfileFactory.ts
    /road
      TrackModel.ts
      TrackGenerationStrategy.ts
      RandomClosedLoopTrackStrategy.ts
    /race
      Race.ts
    /vehicle
      VehicleSpec.ts
    /decoration
      DecorationPlacementPolicy.ts
    /shared
      SpatialHashGrid.ts
  /infrastructure
    /effects
      CarShadow.ts
      RainEffect.ts
      SkidTrailRenderer.ts
      SpeedLinesOverlay.ts
      SunDisc.ts
    /graphics
      CarView.ts
      CarTemplateFactory.ts
      VehicleAssetCatalog.ts
      RoadMeshFactory.ts
      VegetationFactory.ts
      HouseFactory.ts
    /rendering
      GameRenderer.ts
      LightingFactory.ts
  /utils
    math.ts
  /world
    Road.ts
    Terrain.ts
    Decorations.ts
    WaterFeatures.ts
    RockFeatures.ts

index.html
package.json
vite.config.ts
tsconfig.json
```

## 🧭 Architecture Notes

- `src/main.ts` is only the browser entrypoint. Keep it tiny: import and start the game, nothing else.
- `src/application/game/RacingGame.ts` is the application-level orchestrator for the game loop. It may wire services and coordinate flow, but avoid moving domain algorithms, UI rendering, mesh building, or low-level physics rules into it.
- `src/application/game/RacingGameConfig.ts` owns game-loop constants that are not domain value objects yet. Prefer promoting cohesive groups into domain/application services over adding more loose constants to `RacingGame.ts`.
- `src/application/game/CountdownController.ts` owns countdown/running/finished lifecycle transitions that are coupled to the loading overlay.
- `src/application/environment/EnvironmentController.ts` applies random weather/time-of-day presets to rendering, lighting, fog, and rain effects.
- `src/application/input/KeyboardInput.ts` owns browser keyboard events and exposes a small `KeyState` read model.
- `src/application/game/GamePhase.ts` contains the coarse game lifecycle state. Keep phase names and lifecycle semantics here instead of redeclaring them in `main.ts`.
- `src/application/ai/OpponentDriver.ts` owns AI driving decisions for non-player cars. Keep AI target selection, racing-line behavior, braking, and speed limiting here instead of hardcoding opponent movement in `main.ts`.
- `src/application/ai/RacingLineWorkerClient.ts` builds a transferable road snapshot and asks `src/application/ai/workers/racingLine.worker.ts` to precompute the AI racing line/speed profile off the main thread. Keep worker messages plain data/typed arrays; do not send Three.js objects to workers.
- `src/application/physics/DriveControls.ts` contains the driving command read model used by player and AI physics updates.
- `src/application/physics/SurfaceSpeedPolicy.ts` owns speed caps for asphalt/grass/sand and applies surface-dependent speed limiting to cars.
- `src/application/physics/VehicleGroundingService.ts` owns vehicle ride height, terrain/road alignment, and anti-penetration lifting. If a car sinks into asphalt, grass, sand, road edge lines, or start-grid markings, fix this service or the surface sampler instead of adding one-off Y offsets in `RacingGame.ts`.
- `src/application/race/Competitor.ts` represents a race participant from the application layer: domain car/race state, selected vehicle spec, view adapter, and optional AI driver.
- `src/application/race/CompetitorRegistry.ts` owns participant registration plus minimap, standings, and position-label read models.
- `src/application/race/OpponentProfile.ts` contains default AI roster/start-grid profile data. Keep opponent balancing tables there instead of embedding them in `main.ts`.
- `src/application/race/StartGridPlacementService.ts` owns grid slot placement on the road centerline and clamps cars into the available asphalt width.
- `src/application/config/QualitySettings.ts` owns performance/quality knobs such as pixel ratio, shadow size, terrain density, and decoration draw distance.
- `src/application/camera/FollowCameraController.ts` owns OrbitControls and follow-camera behavior. Do not put OrbitControls event handling back into `main.ts`.
- `src/application/ui/HudView.ts`, `src/application/ui/LoadingView.ts`, `src/application/ui/MinimapView.ts`, `src/application/ui/PositionLabelView.ts`, and `src/application/ui/StandingsView.ts` are thin adapters between the game loop and Vue state. Keep UI markup in `.vue` components under `src/application/ui/components/` and keep styling in adjacent `.css` files.
- `src/infrastructure/rendering/GameRenderer.ts` creates the Three.js scene, camera, renderer, sky, resize behavior, and render facade. It also exposes sky/fog setters used by environment presets; keep weather-specific values in `src/domain/environment/`, not inside the renderer.
- `src/infrastructure/rendering/LightingFactory.ts` owns scene light creation and shadow settings. It returns `SceneLighting`, which is adjusted by environment presets.
- `src/infrastructure/effects/SkidTrailRenderer.ts` owns skid mark geometry and rendering.
- `src/infrastructure/effects/RainEffect.ts` owns the lightweight camera-local rain particle system.
- `src/infrastructure/effects/SunDisc.ts` owns the visible sun/moon glow sprite. Keep visual sun styling there; keep preset values in `src/domain/environment/`.
- `src/infrastructure/effects/SpeedLinesOverlay.ts` owns the 2D canvas speed-focus overlay; keep speed-feel overlay code there instead of adding drawing code to `main.ts`. Prefer peripheral blur/vignette over arcade streak lines.
- `src/infrastructure/graphics/CarView.ts` is the adapter/facade around the loaded `THREE.Group`. Do not access `THREE.Object3D.position` for the car directly from `main.ts`; use `CarView` methods such as `copyPosition`, `setPosition`, `translateXZ`, and `addScaledVector`.
- `src/world/Road.ts` is a facade over the road domain model, generation strategy, and mesh factory. Keep public road queries here, but put generation rules into `src/domain/road/` and Three.js mesh construction into `src/infrastructure/graphics/`.
- `src/domain/road/TrackModel.ts` contains road domain queries such as closest band data, start sector checks, surface data, and banking height/normal calculations.
- `src/domain/environment/TerrainProfileFactory.ts` randomly selects the terrain relief profile (`plain`, `hills`, `mountains`) and binds each profile to height parameters and a matching local PBR texture set. Mountain profiles should create a real valley feeling: high distant massifs, stronger roadside walls, and larger rock formations while keeping a smooth drivable corridor around asphalt.
- `src/domain/road/TrackGenerationStrategy.ts` is the Strategy interface for road generation. `RandomClosedLoopTrackStrategy.ts` currently targets a random closed loop with roughly `3..10` left turns and `3..10` right turns. It also injects racing features into the generated centerline: hairpins, chicanes, double-apex corners, banked corners, and S-curves. Keep those feature rules in the generation strategy rather than hardcoding one-off track shapes in `main.ts`.
- `src/domain/race/Race.ts` tracks lap timing/progress for one participant. Use one `Race` instance per car when adding opponents.
- `src/domain/race/RaceStandings.ts` ranks participants by finished state and race distance; keep leaderboard sorting rules there.
- `src/domain/vehicle/VehicleSpec.ts` contains vehicle identity, real-world width, and performance multipliers. Treat these as domain value objects; do not put GLB paths or Three.js details here.
- `src/infrastructure/graphics/VehicleAssetCatalog.ts` binds domain vehicle specs to concrete GLB asset paths.
- `src/infrastructure/graphics/CarTemplateFactory.ts` loads GLB vehicle templates from the asset catalog, normalizes real-world size, prepares per-model physics bounds, and clones `CarView` instances. Keep GLTF loading, model centering, and per-view bounds maps here rather than in `main.ts`.
- `src/infrastructure/graphics/RoadMeshFactory.ts` builds road/shoulder/apron/lane meshes, variable `1..6` lane markings, smooth asphalt width transitions, the start grid, layered asphalt patch textures, asphalt repair/wear/crack overlays, continuous guardrails, and road signs. Lane markings must use the same effective lane count and dynamic road width as `TrackModel`: edge lines are continuous white strips, internal lane dividers are dashed, and internal dashes should be skipped on widening/narrowing tapers. Shoulder and apron geometry must stay as outer side bands only, not full-width strips over the asphalt. The road surface must stay opaque with depth writing enabled; grass/sand should visually meet the asphalt edge through height separation and backfill bands, not by making asphalt transparent. The road surface may use `THREE.DoubleSide` because procedural winding can flip on some loops, but shoulder/apron should prefer `THREE.FrontSide`. To reduce edge shimmer, keep `roadY`, `shoulderY`, and `apronY` separated; road, shoulder, and apron should still receive shadows so cars feel grounded. Road ribbons should be built from dense distance samples, not only raw centerline vertices, so curves and lane-width transitions do not create long triangles. Asphalt decorative rectangles should be skipped if their corners do not fit inside the current asphalt width; do not clamp oversized patches into warped triangles over grass.
- `src/world/Terrain.ts` contains terrain height generation and terrain smoothing/cutout around the road. It receives a `TerrainProfile` so plains, hills, and mountains can vary height and texture without branching in `RacingGame.ts`. Hill and mountain profiles may add roadside cliff influence and distant valley walls, but cliffs must keep a safe distance from asphalt and use smooth ramps. Keep the terrain mesh continuous so sky cannot show through near the road. Grass/asphalt conflicts should be solved with road depth settings, road/terrain height separation, and the narrow road-edge backfill mesh, not by deleting terrain triangles under the road.
- `src/world/Decorations.ts` contains trees, houses, and obstacle collider generation. Decorations are rendered with chunked `THREE.InstancedMesh` batches and use `SpatialHashGrid` for placement/collision lookup; avoid returning to per-tree/per-house Mesh groups unless debugging.
- `src/world/WaterFeatures.ts` owns visual lakes, rivers, and bridge decks. It must always create exactly one asphalt bridge on a stable road section, with a river underneath and low curbs along the sides. Keep water/bridge scenic generation there instead of adding geometry in `RacingGame.ts`; if bridges become collidable later, register their obstacle shapes alongside water generation.
- `src/world/RockFeatures.ts` owns large scenic rock formations and roadside cliff clusters. Keep them instanced, outside the asphalt/shoulder clearance, and tied to the current `TerrainProfile` so mountains/hills get real scale while plains stay sparse.
- `src/utils/math.ts` contains shared math helpers used by gameplay code.

## 🧩 DDD / GoF Patterns

- Composition Root: `src/main.ts` starts the application and should remain a tiny entrypoint.
- Application Service / Orchestrator: `RacingGame` wires domain, application, infrastructure, and world objects together and runs the frame loop.
- Facade: `src/world/Road.ts` hides `TrackModel`, generation strategy, and mesh factory details behind the stable road API used by gameplay.
- Strategy: `TrackGenerationStrategy` lets road generation change without rewriting `Road` or `main.ts`.
- Facade / Adapter: `CarView` hides public mutable Three.js model fields behind game-specific methods.
- Factory: `RoadMeshFactory`, `VegetationFactory`, `HouseFactory`, and `LightingFactory` create Three.js objects outside domain/game-loop code.
- Factory: `CarTemplateFactory` loads and prepares GLB car templates, then clones configured car views for race participants.
- Catalog / Mapper: `VehicleAssetCatalog` maps pure vehicle specs to infrastructure asset paths.
- Controller/Presenter: `KeyboardInput`, `FollowCameraController`, `HudView`, `LoadingView`, `MinimapView`, `PositionLabelView`, and `StandingsView` isolate browser/UI behavior from the game loop.
- Component: UI panels are Vue SFCs with separate CSS files. Do not rebuild HUD/minimap/standings with inline styles or render functions in TS adapters.
- State Model: `GamePhase` names the application lifecycle states used by loading, countdown, racing, and finish flows.
- Controller: `CountdownController` owns transitions between loading/countdown/running/finished without spreading phase timers through the game loop.
- Preset Factory: `EnvironmentPresetFactory` randomly selects weather (`sunny`, `partly-cloudy`, `overcast`, `drizzle`, `rain`, `storm`) and time of day (`morning`, `day`, `evening`, `night`) and maps them to pure rendering/light parameters.
- Preset Factory: `TerrainProfileFactory` randomly selects relief (`plain`, `hills`, `mountains`) and maps it to pure height/material parameters.
- Controller: `EnvironmentController` applies the selected preset to renderer, lighting, and weather effects.
- Value Object / Profile: `OpponentProfile` describes AI participant tuning and start-grid placement without owning Three.js objects.
- Registry: `CompetitorRegistry` collects race participants and prepares UI/minimap read models without exposing maps and mutable arrays from the game loop.
- Policy: `SurfaceSpeedPolicy` applies terrain-specific speed limits consistently for player and AI cars.
- Domain Service: `VehicleGroundingService` centralizes car-to-surface alignment and anti-penetration behavior.
- Aggregate / Domain Model: `Car` owns car motion state and behavior without owning DOM, Three.js scene objects, or browser event wiring. Prefer adding car behavior to `src/domain/car/Car.ts` instead of mutating primitive state fields from `main.ts`.
- Aggregate / Domain Model: `Race` owns lap counting and finish state. It should count laps from road progress, not from UI or renderer code.
- Domain Model: `TrackModel` represents road queries and road shape rules without owning DOM or browser event wiring.
- Value Object: `VehicleSpec` describes car identity, real-world width, and performance multipliers without owning Three.js objects.
- Spatial Index: `SpatialHashGrid` is used for obstacle broad-phase queries; runtime collision checks should query nearby obstacles instead of scanning every collider.
- Worker / Precomputed Plan: `RacingLineWorkerClient` and `racingLine.worker.ts` move pure AI racing-line calculation off the render thread; `OpponentDriver` consumes the resulting typed-array plan at runtime.

## 🤖 Agent Notes

- Prefer keeping `main.ts` as an orchestration layer and moving domain-specific logic into focused modules.
- The road start grid currently renders a staggered F1-style seven-slot grid plus a checkered start/finish line: six opponents plus the player. Start must remain inside a stable 2-lane section; `TrackModel` shifts lane sections relative to `startAngle` so the grid is not placed on a widening/narrowing transition. Keep `RoadMeshFactory.buildStartGridGeometry()` aligned with `createOpponents()` and `PLAYER_START_GRID_OFFSET`.
- The player intentionally starts from the last grid row; keep opponent grid offsets ahead of `PLAYER_START_GRID_OFFSET` unless explicitly changing race balance.
- Car GLB templates are loaded from `vehicleAssetCatalog` in `main.ts`. `mustang.glb` is treated as a Ford Mustang and `mini.glb` as a Mini JCW; each template is scaled by real vehicle width and carries model-specific speed, acceleration, handling, and grip multipliers. Keep `CarTemplateFactory` bounds in sync when adding new car models so ground placement and collision radii use the correct per-model dimensions. If a GLB has a baked-in pitch/axis issue, keep that correction in `VehicleAssetCatalog`, not in domain vehicle specs.
- The game currently creates six AI opponents. If changing opponent count, review start-grid offsets, minimap markers, position labels, and collision density together.
- AI opponents should stay on asphalt with rail-like racing-line logic and respect their configured speed/acceleration limits. The primary AI line is now precomputed in a Web Worker; keep `OpponentDriver` runtime decisions cheap and avoid restoring per-frame multi-candidate road scans for every bot. Current opponent profiles are intentionally competitive, roughly `100%..110%` speed with matching acceleration multipliers before vehicle-specific modifiers. Keep their braking model speed-preserving: prefer coasting near the calculated limit, braking only when projected braking distance exceeds the available distance or when the car is near the asphalt edge. `OpponentDriver` chooses the racing target, while `main.ts` applies a rail constraint that projects AI cars back into a safe asphalt corridor and softly aligns velocity with the track tangent. Keep AI navigation focused on the racing line: do not feed other cars or decoration obstacles into `OpponentDriver`, because obstacle steering causes start-grid pileups and odd behavior. Preserve lightweight physical separation so AI cars do not remain overlapped.
- Guardrails are visualized by `RoadMeshFactory` as continuous barrier geometry and registered as dense non-passable obstacle colliders by `Decorations` on stable `4+` lane sections. Avoid placing guardrails on lane-count transition tapers; if guardrail spacing or lane-width rules change, update both the visual barrier placement and collider registration together.
- Car transmission currently has seven forward gears in the rich `Car` aggregate. Keep HUD gear display numeric-only, without the word `GEAR`.
- Off-road surface balance is gameplay-critical: grass/dirt should cap speed at roughly `75%` of asphalt and sand patches at roughly `65%`. `Decorations.getGroundSurfaceAt()` feeds this into `SurfaceSpeedPolicy`.
- Cars use extra off-road ride height/ground clearance so grass, sand, and dirt decals do not visually swallow the model. Keep this off-road-only; do not globally raise road ride height unless the car visibly floats on asphalt.
- Weather and time of day are randomized at game start through `EnvironmentPresetFactory`. Night and rain require headlights; use `CarView.setHeadlightsEnabled()` for all participant cars instead of adding ad-hoc lights from `RacingGame.ts`.
- Headlights are part of `CarView`: they should be visible only as light cast onto the road, not as glowing sphere meshes. If night asphalt is unreadable, tune the `SpotLight` distance/angle/intensity there rather than creating extra scene-level lights.
- Terrain relief is randomized at game start through `TerrainProfileFactory`. Plains use grass, hills use darker grass, and mountains use the existing sand/ground PBR set with a rock-like tint until a dedicated rock texture set is added. Hill and mountain profiles should feel visibly taller than plains and can occasionally place the road alongside cliff-like terrain.
- HUD instruments are analog Vue-rendered gauges. Keep speed/RPM presentation in `HudPanel.vue` and `HudPanel.css`; `HudView.ts` should only push state from the game loop.
- The road is now generated as a long closed random loop with multiple straights and turns. Prefer longer straights, smoother corners, and fewer noisy micro-turns, so decoration placement should query the road shape rather than assume an oval. If track scale grows, keep `Terrain.size` large enough to cover the whole generated road.
- When changing road height or width, also review the terrain cut parameters in `Road.ts`/`Terrain.ts`; otherwise asphalt can visually sink into the grass again.
- If road/grass intersections reappear, first adjust `terrainHardMargin`, `terrainShoulderMargin`, `apronWidth`, terrain mesh density, terrain polygon offset, and `roadY/shoulderY/apronY` separation before changing gameplay code.
- If you see striped shimmer/acne across the asphalt surface itself, check the directional light shadow settings in `LightingFactory.ts` first, especially `sun.shadow.bias` and `sun.shadow.normalBias`.
- For performance changes, prefer tuning `QualitySettings.ts` first before scattering constants across renderer, terrain, and decoration files.
- `RacingGame.ts` keeps a bounded, quantized surface-height cache for runtime ground queries. If road/terrain geometry changes, clear or retune that cache instead of removing it; unbounded per-centimeter surface keys can hurt performance during longer drives.
- When updating road, terrain, decoration, camera, input, UI, race, grounding, or rendering behavior, prefer editing the corresponding class/service instead of adding more logic back into `main.ts` or `RacingGame.ts`.
- If the structure changes again, update this file so future work starts with the right project map.
