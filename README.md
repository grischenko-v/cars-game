# Cars Game

Browser racing game with a drivable Ford Mustang, generated race track, competitive AI opponents, lap timing, minimap, textured world, and speed-feel camera effects.

## Demo

GitHub Pages: https://grischenko-v.github.io/cars-game/

## Technologies

- TypeScript
- Vite
- Three.js
- GLTFLoader for `.glb` car model loading
- OrbitControls for camera interaction
- Vue runtime DOM for reactive HUD widgets
- Canvas 2D overlay for speed-focus effects
- GitHub Actions
- GitHub Pages

## Features

- Generated long closed racing track with longer straights, smoother corners, variable `1..6` lane sections, matching lane markings, smooth asphalt width transitions, and special turn sections: hairpins, chicanes, double-apex corners, banked corners, and S-curves
- Player car physics with steering, drifting, braking, traction loss, seven-speed gear shifting, and surface-dependent speed limits
- Six AI opponents with rail-like racing-line logic, calculated late braking points, speed limits from 95% to 80% of player speed, lightweight anti-overlap separation, and collision physics
- F1-style staggered seven-slot start grid on a stable 2-lane section with a checkered start/finish line; the player starts from the last row
- Lap counter, stopwatch, lap times, and restart after finish
- Minimap with all cars
- Analog speedometer and tachometer
- Brake/skid trails, speed-focus feedback, and finish statistics
- Opaque textured asphalt with worn patches/cracks, edge-adjacent grass/sand terrain, continuous non-passable guardrails on wide sections, road signs, trees, houses, rocks, sand, and dirt patches
- Dynamic camera FOV and peripheral focus/blur overlay for stronger speed perception

## Local Development

```bash
npm install
npm run dev
```

The project uses a Vite base path for GitHub Pages. For local dev, open the URL shown by Vite. If the server runs on port `8080`, the app is available at:

```text
http://localhost:8080/cars-game/
```

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
```

## Assets

- Car model: `public/models/car.glb`
- Textures: `public/textures`
- Initial model/assets were created or prepared with AI-assisted tooling.

## Deployment

The app is deployed to GitHub Pages from the `gh-pages` branch via GitHub Actions.
