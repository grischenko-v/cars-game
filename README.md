# Cars Game

Browser racing game with a drivable Ford Mustang, generated race track, AI opponents, lap timing, minimap, textured world, and speed-feel camera effects.

## Demo

GitHub Pages: https://grischenko-v.github.io/cars-game/

## Technologies

- TypeScript
- Vite
- Three.js
- GLTFLoader for `.glb` car model loading
- OrbitControls for camera interaction
- Vue runtime DOM for reactive HUD widgets
- Canvas 2D overlay for speed-line effects
- GitHub Actions
- GitHub Pages

## Features

- Generated closed racing track
- Player car physics with steering, drifting, braking, traction loss, and gear shifting
- Two AI opponents with standings and collision physics
- Lap counter, stopwatch, lap times, and restart after finish
- Minimap with all cars
- Textured asphalt, grass, trees, houses, rocks, sand, and dirt patches
- Dynamic camera FOV and speed-line overlay for stronger speed perception

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
