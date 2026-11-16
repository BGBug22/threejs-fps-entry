[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/BGBug22/threejs-fps-entry/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/BGBug22/threejs-fps-entry/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

Entry for the [make.fun threejs-fps-02 bounty](https://make.fun/bounty/threejs-fps-02) — "Make the best three.js tactical FPS", $1,000 in USDC.

# EMBERLINE v2 — Tactical FPS

A round-based tactical FPS in the browser, built with three.js 0.187.0 and no
build step: static files, no network, single-player against bots.

**The game.** You are Ember, attacking a bright sunset yard ("Yard 7 —
Emberline Works") with four bot teammates against five Ashen defenders. Plant
the Spark at Foundry (Site A) or Silos (Site B), or eliminate the other team.
First to 5 rounds (max 9) takes the yard. Between rounds you earn money —
$300 per kill, $300 for planting, $3,250 for a round win — and spend it on
better guns (SMG-9, VK-47, M4R Carbine, AWP-L), a plated vest, and grenades.

**v2 — what the winners do that v1 did not.** Bots hear gunfire and explosions,
turn toward the sound, walk over to look, and say so on the radio ("Vex: Heard
shots, Short A"), and they play a team plan shown in the HUD ("PLAN: SPLIT A —
YOU: ENTRY A"). Frag, smoke and flash grenades (keys 4/5/6, buyable): smoke
blooms a grey cloud that blocks bot sight for 12 seconds, flash blinds anyone
looking at the pop, frag explodes with radius damage. A live minimap (top left)
shows teammates, last-seen enemies and the Spark. The yard is bright sunset,
not dark dusk, with giant site signs ("A — FOUNDRY · SITE A", "B — SILOS ·
SITE B", "YARD 7 — EMBERLINE WORKS") that read at a glance. The view-model gun
is built from receiver, barrel, muzzle brake, magazine, foregrip, stock, sight
and rail, with a star-shaped muzzle flash and tracers.

**Controls.** WASD move, mouse aim, left click fire, R reload, Space jump,
Ctrl crouch, E plant the Spark (hold still on a site), B buy menu (freeze
time), 1–5 / wheel switch weapons, 4 frag / 5 smoke / 6 flash grenades, right
mouse scope the AWP-L, Tab scoreboard, M mute, Esc release the mouse.

**How it plays.** Bots walk a waypoint graph, hold or push sites, rotate when
the Spark is planted, and fight with the same hitscan rules you do — damage,
headshots, armour, spread while moving. A bot that hears your shots
investigates and calls it in; a bot that sees you calls "Contact at Short A,
rotating". The bomb ticks 35 seconds once planted and only a defuse stops it.
If you go down, you spectate a teammate (click to cycle) until the next round.

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

- `game/index.html` — page, HUD (minimap, radio log, plan, grenades), import map (`three` → vendored three.js)
- `game/src/main.js` — match loop: rounds, economy, shooting, spectating, `?shot=` modes
- `game/src/world.js` — the yard: sites, lanes, cover, waypoints, lights, giant site signs
- `game/src/player.js` — movement, collision, health and armour
- `game/src/weapons.js` — the five guns and the multi-part view model
- `game/src/bots.js` — the nine bots: waypoints, perception, hearing, radio callouts, team plan, bursts, plant/defuse
- `game/src/bomb.js` — the Spark: carry, drop, plant, 35 s countdown
- `game/src/grenades.js` — frag, smoke and flash: throws, fuses, radius damage, sight-blocking smoke, blinding flash
- `game/src/fx.js` — tracers, impact sparks, explosion, smoke clouds, flash pop
- `game/src/audio.js` — synthesised WebAudio sounds, no audio files
- `game/src/input.js` — keys, mouse look, pointer lock
- `game/src/hud.js` — the DOM HUD: minimap, radio log, plan line, grenade counts
- `game/src/palette.js` — the bright sunset palette
- `game/vendor/three/` — three.js 0.187.0, byte-for-byte from the kit
- `screenshots/` — four real renders of the game (start, buy, play, end)
- `shots.json` — the four `?shot=` modes the screenshots were taken with

**Shots.** The screenshots are deterministic: `?shot=start|buy|play|end&seed=1`
sets the scene (menu, buy menu, a live firefight 7 seconds in, match over)
and the game sets `window.__shotReady` once the frame is painted. The play
shot scripts a real fight: a smoke toward Site A, a flash mid-fight, aimed
shots that kill, and a final shot right before the capture so the frame holds
the star muzzle flash and a fresh tracer.

All art, names and sounds are original — no assets from any commercial game.
