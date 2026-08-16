# FLOOD ESCAPE

**When the water rises, every decision matters.**

A compact browser survival/adventure game: navigate a flooding city, collect
emergency supplies, decide who you rescue, and reach the evacuation point
before the water or the clock beats you.

Created for the **BTT Web Game Jam — Summer 2026**.
Game concept, direction and design: **Muhammed Suleiman Jibril**.
Built with AI-assisted development.

## Play

| Key | Action |
| --- | --- |
| W A S D / Arrows | Move |
| SHIFT | Sprint (uses stamina) |
| E | Interact / talk / evacuate |
| 1 / 2 | Drink water / use first aid |
| ESC | Pause (or skip the intro) |

Three levels: **The Rising**, **Cut Off**, **Last Exit**. Water rises in real
time — deep water slows you down and drains health; raised courtyards and
sidewalks stay dry longest. Helping a survivor costs 15 seconds but grants a
rescue token, score, and a raft that makes deep water survivable.

## Run locally

```bash
bun install     # or: npm install
bun run dev     # http://localhost:8080
```

## Production build

```bash
bun run build   # outputs a deployable build
bun run preview
```

Fully client-side — no backend, database, or account required. Deployable to
any static/edge host (Vercel, Netlify, Cloudflare).

## Project structure

```
src/game/levels.ts   level definitions, city map generation
src/game/engine.ts   game state, flood system, objectives, scoring
src/game/render.ts   canvas renderer (city, water, minimap)
src/game/audio.ts    procedural WebAudio music and SFX
src/components/game/FloodEscape.tsx   menus, cinematic intro, HUD
src/routes/index.tsx route that mounts the game
```
