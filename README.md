# EMBERLINE — Tactical FPS

A round-based tactical FPS in the browser, built with three.js 0.187.0 and no
build step: static files, no network, single-player against bots.

**The game.** You are Ember, attacking a dusk industrial yard ("Yard 7 —
Emberline Works") with four bot teammates against five Ashen defenders. Plant
the Spark at Foundry (Site A) or Silos (Site B), or eliminate the other team.
First to 5 rounds (max 9) takes the yard. Between rounds you earn money —
$300 per kill, $300 for planting, $3,250 for a round win — and spend it on
better guns (SMG-9, VK-47, M4R Carbine, AWP-L) and a plated vest.

**Controls.** WASD move, mouse aim, left click fire, R reload, Space jump,
Ctrl crouch, E plant the Spark (hold still on a site), B buy menu (freeze
time), 1–5 / wheel switch weapons, right mouse scope the AWP-L, Tab
scoreboard, M mute, Esc release the mouse.

**How it plays.** Bots walk a waypoint graph, hold or push sites, rotate when
the Spark is planted, and fight with the same hitscan rules you do — damage,
headshots, armour, spread while moving. The bomb ticks 35 seconds once planted
and only a defuse stops it. If you go down, you spectate a teammate (click to
cycle) until the next round.

**Run it.**

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

**Hand it in.**

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library (`vendor/makefun-threejs.ts`).

**Layout.**

- `game/index.html` — page, HUD, import map (`three` → vendored three.js)
- `game/src/main.js` — match loop: rounds, economy, shooting, spectating, `?shot=` modes
- `game/src/world.js` — the yard: sites, lanes, cover, waypoints, lights
- `game/src/player.js` — movement, collision, health and armour
- `game/src/weapons.js` — the five guns and the view model
- `game/src/bots.js` — the nine bots: waypoints, perception, bursts, plant/defuse
- `game/src/bomb.js` — the Spark: carry, drop, plant, 35 s countdown
- `game/src/fx.js` — tracers, impact sparks, explosion
- `game/src/audio.js` — synthesised WebAudio sounds, no audio files
- `game/src/input.js` — keys, mouse look, pointer lock
- `game/src/hud.js` — the DOM HUD
- `game/src/palette.js` — the dusk palette
- `game/vendor/three/` — three.js 0.187.0, byte-for-byte from the kit
- `screenshots/` — four real renders of the game (start, buy, play, end)
- `shots.json` — the four `?shot=` modes the screenshots were taken with

**Shots.** The screenshots are deterministic: `?shot=start|buy|play|end&seed=1`
sets the scene (menu, buy menu, a live firefight 7 seconds in, match over)
and the game sets `window.__shotReady` once the frame is painted.

All art, names and sounds are original — no assets from any commercial game.
