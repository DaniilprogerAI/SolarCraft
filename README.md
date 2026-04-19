# SolarCraft — Solarpunk Voxel Sandbox

A Minecraft-style voxel sandbox with solarpunk aesthetics, built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).

**Play live:** https://dist-jivsvbgw.devinapps.com

## Features

- Chunked voxel world with per-chunk greedy-ish meshing and vertex-colored blocks
- Procedural terrain (rolling hills, moss/grass/sand biomes, lakes, scattered trees, wildflowers)
- First-person pointer-lock controls with AABB collision, jump, and toggleable flight
- Left-click / right-click block break and place via DDA voxel raycasting
- 9-slot hotbar with keyboard (1–9) and mouse-wheel selection
- Warm solarpunk palette: lush grass, oak, planks, terracotta, tinted glass, solar panels, glow lanterns (real point lights), wildflowers
- Atmospheric fog, hemisphere + directional + ambient lighting, gentle sun drift
- Near-spawn landmark: terracotta terrace with a glass atrium, solar-panel roof, and glowing lanterns

## Controls

| Keys | Action |
|---|---|
| `WASD` | Move |
| `Space` | Jump / fly up |
| `Shift` | Sneak / fly down |
| `Ctrl` | Run / fast-fly |
| `F` | Toggle fly mode |
| `1`–`9` | Select hotbar slot |
| Mouse wheel | Cycle hotbar |
| Left click | Break block |
| Right click | Place block |
| `Esc` | Release mouse |

## Development

```bash
npm install
npm run dev      # start Vite dev server on http://localhost:5173
npm run build    # produce static build in dist/
npm run preview  # preview the production build
```

## Project layout

```
index.html        # HTML shell, start-screen overlay, and styling
src/
  main.js         # scene, lighting, main loop, input wiring
  world.js        # chunked voxel storage, terrain gen, meshing, raycasting
  player.js       # first-person controls + AABB voxel collision
  blocks.js       # solarpunk block palette (colors / flags / faces)
  noise.js        # tiny deterministic value-noise FBM for terrain
  ui.js           # hotbar DOM rendering
```
