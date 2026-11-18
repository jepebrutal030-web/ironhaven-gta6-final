# IRONHAVEN — Open-World Crime Game

[![make.fun](https://make.fun/bounty/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/bounty/gta6-01/badge-submissions.svg)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/bounty/gta6-01/badge-prize.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun **gta6-01** bounty. Everything is original — the city, characters, vehicles, names, story, art, sound and music. No Rockstar Games name, logo, character, map or asset.

## Play

Open `game/index.html` in a desktop browser (serve `game/` from any static HTTP server, e.g. `python3 -m http.server` inside `game/`), or run `node serve.ts` if present. Keyboard + mouse, no network request, no build step.

- **WASD** move / drive · **Mouse** look (click to lock) · **Click** shoot · **R** reload
- **E** enter / exit car · **Shift** sprint / boost · **Space** jump / handbrake
- **1 / 2 / 3** weapons (Pistol, SMG, Shotgun) · **P** pause / save · **M** mute

## The game

- A 392×392 m city, 7×7 blocks: downtown glass towers, brick residential streets, and a harbor with docks, warehouses, shipping containers and a gantry crane over the sea.
- **5 story missions** — Homecoming ($300), Pickup ($500), Getaway ($700), Shakedown ($1,000), Harbor Job ($1,500) — with objectives, distance and timers, and an ending screen.
- **8 car models**, 22 traffic cars, 36 pedestrians, 14 stealable parked cars.
- **Wanted 0–5** with police pursuit cars that ram, foot cops who arrest you (BUSTED), and WASTED on death.
- **Combat** with aim-corrected shooting, hitmarkers, ammo and reload.
- **HUD** with health, money, wanted stars, objective + distance + timer, speedometer, ammo, crosshair, damage vignette, and a live 2D minimap.
- **Synth soundtrack** (~100 BPM, A minor) and sound effects, all generated with WebAudio — zero audio files.
- **Autosave** to localStorage; start screen, pause menu, BUSTED / WASTED / ending screens.

## Tech

- Three.js 0.187.0, vendored under `game/vendor/three/` (import map in `game/index.html`).
- Procedural everything: canvas-textured buildings (window grids, brick/glass districts), textured roads with lane markings and crosswalks, trees, street lamps, traffic lights.
- Sun + PCFSoft shadows, ACES tone mapping, antialias, bright facades.
- Source is split by system under `game/src/` (`world`, `vehicles`, `people`, `police`, `weapons`, `missions`, `hud`, `audio`, `render`, `game`, `shots`).

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`. Outside the grader, `MAKEFUN_OUTPUT_DIR` stands in for `/output`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT. See `starter/LICENSE` for the kit starter's license.
