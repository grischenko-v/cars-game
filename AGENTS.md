# AGENTS.md

## 📌 Overview

This project is racing game. 

- Vite
- TypeScript
- Three.js
- GLB model loading (GLTFLoader)
- Keyboard-based car movement
- Mouse-based camera orbit (OrbitControls)

The app renders a drivable car with a follow/target camera and basic physics-like movement.

---

## 🧱 Project Structure
```text
/public
  /models
    car.glb

/src
  main.ts
  /application
    /config
      QualitySettings.ts
    /camera
      FollowCameraController.ts
    /input
      KeyboardInput.ts
    /ui
      HudView.ts
      MinimapView.ts
  /domain
    /car
      Car.ts
    /road
      TrackModel.ts
      TrackGenerationStrategy.ts
      RandomClosedLoopTrackStrategy.ts
    /race
      Race.ts
    /decoration
      DecorationPlacementPolicy.ts
    /shared
      SpatialHashGrid.ts
  /infrastructure
    /effects
      SkidTrailRenderer.ts
    /graphics
      CarView.ts
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

index.html
package.json
vite.config.ts
tsconfig.json
```

## 🧭 Architecture Notes

- `src/main.ts` is the composition root and game loop. Keep it focused on wiring dependencies and orchestration; avoid adding UI, rendering setup, input listeners, or procedural mesh factories here.
- `src/main.ts` also contains surface-dependent driving penalties: speed and velocity are intentionally reduced on shoulder, apron, and grass so leaving the asphalt has a gameplay cost.
- `src/application/input/KeyboardInput.ts` owns browser keyboard events and exposes a small `KeyState` read model.
- `src/application/ai/OpponentDriver.ts` owns AI driving decisions for non-player cars. Keep AI target selection and speed limiting here instead of hardcoding opponent movement in `main.ts`.
- `src/application/config/QualitySettings.ts` owns performance/quality knobs such as pixel ratio, shadow size, terrain density, and decoration draw distance.
- `src/application/camera/FollowCameraController.ts` owns OrbitControls and follow-camera behavior. Do not put OrbitControls event handling back into `main.ts`.
- `src/application/ui/HudView.ts`, `src/application/ui/LoadingView.ts`, `src/application/ui/MinimapView.ts`, `src/application/ui/PositionLabelView.ts`, and `src/application/ui/StandingsView.ts` are presenters/views for DOM UI and canvas UI.
- `src/infrastructure/rendering/GameRenderer.ts` creates the Three.js scene, camera, renderer, sky, resize behavior, and render facade.
- `src/infrastructure/rendering/LightingFactory.ts` owns scene light creation and shadow settings.
- `src/infrastructure/effects/SkidTrailRenderer.ts` owns skid mark geometry and rendering.
- `src/infrastructure/graphics/CarView.ts` is the adapter/facade around the loaded `THREE.Group`. Do not access `THREE.Object3D.position` for the car directly from `main.ts`; use `CarView` methods such as `copyPosition`, `setPosition`, `translateXZ`, and `addScaledVector`.
- `src/world/Road.ts` is a facade over the road domain model, generation strategy, and mesh factory. Keep public road queries here, but put generation rules into `src/domain/road/` and Three.js mesh construction into `src/infrastructure/graphics/`.
- `src/domain/road/TrackModel.ts` contains road domain queries such as closest band data, start sector checks, and surface data.
- `src/domain/road/TrackGenerationStrategy.ts` is the Strategy interface for road generation. `RandomClosedLoopTrackStrategy.ts` currently targets a random closed loop with roughly `3..10` left turns and `3..10` right turns.
- `src/domain/race/Race.ts` tracks lap timing/progress for one participant. Use one `Race` instance per car when adding opponents.
- `src/domain/race/RaceStandings.ts` ranks participants by finished state and race distance; keep leaderboard sorting rules there.
- `src/infrastructure/graphics/RoadMeshFactory.ts` builds road/shoulder/apron/lane meshes and road paint such as lane markings and the start grid. Shoulder and apron geometry must stay as outer side bands only, not full-width strips over the asphalt. The road surface may use `THREE.DoubleSide` because procedural winding can flip on some loops, but shoulder/apron should prefer `THREE.FrontSide`. To reduce edge shimmer, keep `roadY`, `shoulderY`, and `apronY` separated and usually disable `receiveShadow` on shoulder/apron.
- `src/world/Terrain.ts` contains terrain height generation and terrain smoothing/cutout around the road. For the procedural track, terrain is intentionally cut in multiple stages: a hard carve under the asphalt, a softer carve under the shoulder, a flat carve under the apron coverage belt, and extra render separation via terrain polygon offset/render order so grass should not intersect the road mesh.
- `src/world/Decorations.ts` contains trees, houses, and obstacle collider generation. Decorations are rendered with chunked `THREE.InstancedMesh` batches and use `SpatialHashGrid` for placement/collision lookup; avoid returning to per-tree/per-house Mesh groups unless debugging.
- `src/utils/math.ts` contains shared math helpers used by gameplay code.

## 🧩 DDD / GoF Patterns

- Composition Root: `src/main.ts` wires domain, application, infrastructure, and world objects together.
- Facade: `src/world/Road.ts` hides `TrackModel`, generation strategy, and mesh factory details behind the stable road API used by gameplay.
- Strategy: `TrackGenerationStrategy` lets road generation change without rewriting `Road` or `main.ts`.
- Facade / Adapter: `CarView` hides public mutable Three.js model fields behind game-specific methods.
- Factory: `RoadMeshFactory`, `VegetationFactory`, `HouseFactory`, and `LightingFactory` create Three.js objects outside domain/game-loop code.
- Controller/Presenter: `KeyboardInput`, `FollowCameraController`, `HudView`, `LoadingView`, `MinimapView`, `PositionLabelView`, and `StandingsView` isolate browser/UI behavior from the game loop.
- Aggregate / Domain Model: `Car` owns car motion state and behavior without owning DOM, Three.js scene objects, or browser event wiring. Prefer adding car behavior to `src/domain/car/Car.ts` instead of mutating primitive state fields from `main.ts`.
- Aggregate / Domain Model: `Race` owns lap counting and finish state. It should count laps from road progress, not from UI or renderer code.
- Domain Model: `TrackModel` represents road queries and road shape rules without owning DOM or browser event wiring.
- Spatial Index: `SpatialHashGrid` is used for obstacle broad-phase queries; runtime collision checks should query nearby obstacles instead of scanning every collider.

## 🤖 Agent Notes

- Prefer keeping `main.ts` as an orchestration layer and moving domain-specific logic into focused modules.
- The road is now generated as a closed random loop with multiple straights and turns, so decoration placement should query the road shape rather than assume an oval.
- When changing road height or width, also review the terrain cut parameters in `Road.ts`/`Terrain.ts`; otherwise asphalt can visually sink into the grass again.
- If road/grass intersections reappear, first adjust `terrainHardMargin`, `terrainShoulderMargin`, `apronWidth`, terrain mesh density, terrain polygon offset, and `roadY/shoulderY/apronY` separation before changing gameplay code.
- If you see striped shimmer/acne across the asphalt surface itself, check the directional light shadow settings in `LightingFactory.ts` first, especially `sun.shadow.bias` and `sun.shadow.normalBias`.
- For performance changes, prefer tuning `QualitySettings.ts` first before scattering constants across renderer, terrain, and decoration files.
- When updating road, terrain, decoration, camera, input, UI, or rendering behavior, prefer editing the corresponding class instead of adding more logic back into `main.ts`.
- If the structure changes again, update this file so future work starts with the right project map.
