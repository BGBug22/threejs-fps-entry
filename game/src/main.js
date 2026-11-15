// EMBERLINE — main loop. Owns the match: rounds, freeze/buy time, economy,
// the objective, shooting, spectating and the deterministic ?shot= modes the
// kit's screenshots use. Bots, movement and the world live in their own modules;
// this file only wires them together.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { WEAPONS, ARMOR_PRICE, ARMOR_VALUE, createWeaponView } from './weapons.js';
import { createFx } from './fx.js';
import { createBots } from './bots.js';
import { createBomb } from './bomb.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';

const STEP = 1 / 60;
const ROUND_TIME = 100;
const FREEZE_TIME = 5;
const WIN_ROUNDS = 5;
const MAX_ROUNDS = 9;
const START_MONEY = 800;
const KILL_REWARD = 300;
const PLANT_REWARD = 300;
const WIN_REWARD = 3250;
const LOSS_REWARD = 1900;
const LOSS_STREAK_BONUS = 500;
const LOSS_CAP = 3400;
const WEAPON_ORDER = ['p9', 'smg', 'vk47', 'm4r', 'awp'];

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');
const seedParam = parseInt(params.get('seed') || '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedBase = shotMode ? seedParam : (Date.now() % 100000);
const rng = mulberry32(seedBase);

// --- renderer / scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('app').prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 220);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders);
const weaponView = createWeaponView(camera);
const fx = createFx(scene);
const bots = createBots(scene, world);
const bomb = createBomb(scene);
const audio = createAudio();
const input = createInput(renderer.domElement, (locked) => {
  if (locked) {
    if (paused) { paused = false; hud.hideOverlay(); }
  } else if (phase === 'live' && player.state.alive && !shotMode) {
    paused = true;
    hud.showOverlay('paused');
  }
});
const hud = createHud();

// --- match state ---
let time = 0;
let phase = 'menu'; // menu | freeze | live | over
let paused = false;
let freezeTimer = FREEZE_TIME;
let roundTimer = ROUND_TIME;
let plantProgress = 0;
let bobPhase = 0;
let bobY = 0;
let prevFire = false;
let prevKeys = new Set();
let spectateTarget = null;
const match = { ember: 0, ashen: 0, round: 1, money: START_MONEY, lossStreak: 0 };
const owned = new Set(['p9']);
const ammoStore = {};

// --- invisible player hitboxes for bot fire ---
const playerMeshes = new Set();
const playerTorso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.15, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
playerTorso.userData.player = true;
playerTorso.userData.part = 'torso';
const playerHead = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.46), new THREE.MeshBasicMaterial({ visible: false }));
playerHead.userData.player = true;
playerHead.userData.part = 'head';
scene.add(playerTorso, playerHead);
playerMeshes.add(playerTorso);
playerMeshes.add(playerHead);

// --- helpers ---
const raycaster = new THREE.Raycaster();
function raycast(origin, dir, maxDist, exclude) {
  raycaster.set(origin, dir);
  raycaster.far = maxDist;
  const targets = world.shootables.concat(bots.hitMeshes, [playerTorso, playerHead]);
  const hits = raycaster.intersectObjects(targets, false);
  for (const hit of hits) {
    const obj = hit.object;
    if (exclude instanceof Set && exclude.has(obj)) continue;
    if (exclude && obj.userData.bot === exclude) continue;
    if (obj.userData.bot && !obj.userData.bot.alive) continue;
    if (obj.userData.player && !player.state.alive) continue;
    return hit;
  }
  return null;
}

function sound(kind, arg) {
  if (audio.muted) return;
  switch (kind) {
    case 'shot': audio.shot(arg || weaponView.state.id); break;
    case 'dry': audio.dry(); break;
    case 'reload': audio.reload(); break;
    case 'hit': audio.hit(false); break;
    case 'kill': audio.hit(true); break;
    case 'hurt': audio.hurt(); break;
    case 'plant': audio.plantTick(); break;
    case 'beep': audio.beep(); break;
    case 'buy': audio.buy(); break;
    case 'roundWin': audio.roundWin(); break;
    case 'roundLose': audio.roundLose(); break;
    case 'explosion': audio.explosion(); break;
    case 'click': audio.click(); break;
    default: break;
  }
}

function siteAt(pos) {
  for (const [name, site] of Object.entries(world.sites)) {
    if (Math.hypot(pos.x - site.center.x, pos.z - site.center.z) < site.radius) return name;
  }
  return null;
}

function updateScoreboard() {
  const emberRows = [['You', player.state.alive]];
  for (const b of bots.list) if (b.team === 'ember') emberRows.push([b.name, b.alive]);
  const ashenRows = bots.list.filter((b) => b.team === 'ashen').map((b) => [b.name, b.alive]);
  const fill = (el, rows) => {
    el.innerHTML = rows.map(([n, a]) => `<div class="sb-row${a ? '' : ' dead'}"><span>${n}</span><span>${a ? 'ALIVE' : 'DOWN'}</span></div>`).join('');
  };
  fill(document.getElementById('sb-ember'), emberRows);
  fill(document.getElementById('sb-ashen'), ashenRows);
}

// --- combat ---
function damageBot(bot, amount, part, attackerName) {
  const died = bots.damage(bot, amount);
  if (died) {
    hud.killfeed(attackerName, bot.name, part === 'head', 'ember');
    if (attackerName === 'You') {
      match.money += KILL_REWARD;
      hud.setMoney(match.money);
    }
    if (bot.carrier) bomb.drop(bot.pos);
    updateScoreboard();
    checkRoundEnd();
  }
  return died;
}

function damagePlayer(amount, fromPos, attackerName) {
  if (shotMode === 'play') return; // god mode for the action screenshot
  if (!player.state.alive || phase !== 'live') return;
  const died = player.damage(amount);
  hud.damageFlash();
  sound('hurt');
  if (died) {
    hud.killfeed(attackerName, 'You', false, 'ashen');
    if (bomb.state.carrier === 'player') bomb.drop(player.state.position);
    spectateTarget = bots.list.find((b) => b.team === 'ember' && b.alive) || null;
    hud.setSpectate(spectateTarget ? spectateTarget.name : null);
    hud.banner('YOU ARE DOWN', spectateTarget ? `Spectating ${spectateTarget.name}` : 'Your team fights on', 2600);
    input.releaseLock();
    updateScoreboard();
    checkRoundEnd();
  }
}

function tryShoot() {
  const w = weaponView.state;
  if (!w.ready()) {
    if (w.mag === 0 && w.reserve > 0) { weaponView.reload(); sound('reload'); }
    else if (w.mag === 0) sound('dry');
    return;
  }
  weaponView.pullTrigger();
  weaponView.takeRound();
  const def = w.def;
  const zoomed = input.state.zooming && def.id === 'awp';
  const spread = weaponView.spread(player.groundSpeed()) * (zoomed ? 0.4 : 1);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.x += (Math.random() * 2 - 1) * spread;
  dir.y += (Math.random() * 2 - 1) * spread;
  dir.z += (Math.random() * 2 - 1) * spread;
  dir.normalize();
  const origin = camera.position.clone();
  const muzzle = camera.localToWorld(new THREE.Vector3(0.24, -0.16, -0.7));
  const hit = raycast(origin, dir, 120, playerMeshes);
  const end = hit ? hit.point.clone() : origin.clone().addScaledVector(dir, 120);
  fx.tracer(muzzle, end);
  sound('shot', def.id);
  player.recoil(def.id === 'awp' ? 0.05 : 0.011, (Math.random() - 0.5) * 0.006);
  if (hit) {
    fx.impact(hit.point);
    const hitBot = hit.object.userData.bot;
    if (hitBot && hitBot.alive) {
      const dmg = def.damage * (hit.object.userData.part === 'head' ? def.headMult : 1);
      const died = damageBot(hitBot, dmg, hit.object.userData.part, 'You');
      hud.hitMarker(died);
      sound(died ? 'kill' : 'hit');
    }
  }
  if (w.mag === 0 && w.reserve > 0) { weaponView.reload(); sound('reload'); }
}

function switchWeapon(id) {
  if (!owned.has(id)) return;
  const cur = weaponView.state.id;
  ammoStore[cur] = { mag: weaponView.state.mag, reserve: weaponView.state.reserve };
  weaponView.setWeapon(id, false);
  const stored = ammoStore[id];
  if (stored) weaponView.setAmmo(stored.mag, stored.reserve);
  hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, WEAPONS[id].name.toUpperCase());
  sound('click');
}

// --- rounds ---
function checkRoundEnd() {
  if (phase !== 'live') return;
  const emberAlive = (player.state.alive ? 1 : 0) + bots.aliveCount('ember');
  const ashenAlive = bots.aliveCount('ashen');
  if (ashenAlive === 0) { endRound('ember', 'Ashen team eliminated'); return; }
  if (emberAlive === 0 && bomb.state.state !== 'planted') endRound('ashen', 'Ember team eliminated');
}

function endRound(winner, reason) {
  if (phase !== 'live') return;
  phase = 'over';
  if (winner === 'ember') {
    match.ember += 1;
    match.money += WIN_REWARD;
    match.lossStreak = 0;
  } else {
    match.ashen += 1;
    match.money += Math.min(LOSS_CAP, LOSS_REWARD + match.lossStreak * LOSS_STREAK_BONUS);
    match.lossStreak += 1;
  }
  hud.setScore(match.ember, match.ashen, match.round);
  hud.setMoney(match.money);
  hud.banner(winner === 'ember' ? 'EMBER WINS THE ROUND' : 'ASHEN WINS THE ROUND', reason, 3600);
  sound(winner === 'ember' ? 'roundWin' : 'roundLose');
  hud.plantProgress(null);
  hud.hideBuy();
  hud.setSpectate(null);
  spectateTarget = null;
  bomb.reset();
  const matchOver = match.ember >= WIN_ROUNDS || match.ashen >= WIN_ROUNDS || match.round >= MAX_ROUNDS;
  if (matchOver) {
    setTimeout(() => {
      phase = 'menu';
      hud.showOverlay('end', `${match.ember} - ${match.ashen}`);
      input.releaseLock();
    }, 3200);
  } else {
    setTimeout(() => { if (phase === 'over') startRound(match.round + 1); }, 4000);
  }
}

function startRound(n) {
  match.round = n;
  phase = 'freeze';
  freezeTimer = FREEZE_TIME;
  roundTimer = ROUND_TIME;
  plantProgress = 0;
  spectateTarget = null;
  const armor = player.state.armor;
  player.reset(world.spawns.attack[0], 0);
  player.state.armor = armor;
  bots.spawnRound(n, seedBase + n * 101 + 7);
  bomb.reset();
  fx.clear();
  hud.setScore(match.ember, match.ashen, match.round);
  hud.setMoney(match.money);
  hud.setAlive(5, 5);
  hud.setBombStatus('Spark with you — plant at Foundry or Silos');
  hud.plantProgress(null);
  hud.setSpectate(null);
  hud.hideBanner();
  updateScoreboard();
  hud.showBuy(Object.values(WEAPONS), match.money, weaponView.state.id, player.state.armor > 0);
  hud.banner(`ROUND ${n}`, n === 1 ? 'Plant the Spark or eliminate the Ashen team' : 'First to 5 rounds takes the yard', 2200);
}

function startMatch() {
  match.ember = 0;
  match.ashen = 0;
  match.round = 1;
  match.money = START_MONEY;
  match.lossStreak = 0;
  owned.clear();
  owned.add('p9');
  for (const k of Object.keys(ammoStore)) delete ammoStore[k];
  weaponView.setWeapon('p9', false);
  hud.hideOverlay();
  startRound(1);
}

// --- bot context ---
const ctx = {
  get time() { return time; },
  get phase() { return phase; },
  get playerPos() { return player.state.position; },
  get playerAlive() { return player.state.alive; },
  bomb: bomb.state,
  rng,
  raycast: (o, d, m, ex) => raycast(o, d, m, ex),
  damageBot: (bot, amount, part, name) => damageBot(bot, amount, part, name),
  damagePlayer: (amount, from, name) => damagePlayer(amount, from, name),
  tracer: (a, b, c) => fx.tracer(a, b, c),
  impact: (p) => fx.impact(p),
  sound: (kind, arg) => sound(kind, arg),
  nearPlayer: (pos) => pos.distanceTo(player.state.position) < 30,
  onPlanted: (site, bot) => {
    bomb.plant(site, bot.pos);
    hud.banner('SPARK PLANTED', `${bot.name} planted at Site ${site} — detonation in 35s`, 3000);
    sound('plant');
  },
  onDefused: (bot) => {
    hud.banner('SPARK DEFUSED', `${bot.name} defused the Spark`, 3000);
    endRound('ashen', 'Spark defused');
  },
  onPickup: (bot) => {
    bomb.pickup(bot);
    hud.setBombStatus(`${bot.name} carries the Spark`);
  },
};

const bombCtx = {
  sound: (kind) => sound(kind),
  onDetonate: () => {
    fx.explosion(bomb.state.pos);
    sound('explosion');
    endRound('ember', 'Spark detonated');
  },
};

// --- input wiring ---
hud.onPlay(() => {
  audio.resume();
  if (phase === 'menu') startMatch();
  else if (paused) input.requestLock();
});

hud.onBuy((id) => {
  if (phase !== 'freeze') return;
  if (id === 'armor') {
    if (match.money >= ARMOR_PRICE && player.state.armor <= 0) {
      match.money -= ARMOR_PRICE;
      player.state.armor = ARMOR_VALUE;
      sound('buy');
      hud.setMoney(match.money);
      hud.showBuy(Object.values(WEAPONS), match.money, weaponView.state.id, player.state.armor > 0);
    }
    return;
  }
  const w = WEAPONS[id];
  if (!w || owned.has(id) || match.money < w.price) return;
  match.money -= w.price;
  owned.add(id);
  switchWeapon(id);
  hud.setMoney(match.money);
  hud.showBuy(Object.values(WEAPONS), match.money, weaponView.state.id, player.state.armor > 0);
});

renderer.domElement.addEventListener('click', () => {
  if (shotMode) return;
  if (!player.state.alive && phase === 'live') {
    const alive = bots.list.filter((b) => b.team === 'ember' && b.alive);
    if (alive.length) {
      const cur = alive.indexOf(spectateTarget);
      spectateTarget = alive[(cur + 1) % alive.length];
      hud.setSpectate(spectateTarget.name);
    }
    return;
  }
  if ((phase === 'freeze' || phase === 'live') && !input.isLocked()) input.requestLock();
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- fixed step ---
function pressed(code) {
  return input.state.keys.has(code) && !prevKeys.has(code);
}

function fixedStep(dt) {
  time += dt;
  const keys = input.state.keys;
  const zoomed = input.state.zooming && weaponView.state.id === 'awp' && phase === 'live' && player.state.alive;

  if (!paused) {
    if (phase === 'freeze') {
      freezeTimer -= dt;
      if (freezeTimer <= 0) {
        phase = 'live';
        hud.hideBuy();
        hud.banner('GO!', 'Round in progress', 1400);
        sound('click');
        if (!input.isLocked() && !shotMode) {
          paused = true;
          hud.showOverlay('paused');
        }
      }
    } else if (phase === 'live') {
      if (bomb.state.state !== 'planted') {
        roundTimer -= dt;
        if (roundTimer <= 0) endRound('ashen', 'Time expired — the Spark was never planted');
      }
      bomb.update(dt, bombCtx);
    }

    if (phase === 'live' && player.state.alive) {
      const { x: dx, y: dy } = input.takeLook();
      if (input.isLocked() && (dx || dy)) player.look(dx, dy, 0.0022 * (zoomed ? 0.4 : 1));
      player.step(dt, keys);
      bobPhase += player.groundSpeed() * dt * 1.7;
      bobY = Math.sin(bobPhase * 2) * 0.03 * Math.min(1, player.groundSpeed() / 5);

      // firing
      const firing = input.state.firing;
      const semi = !weaponView.state.def.auto;
      if (firing && (!semi || !prevFire)) tryShoot();
      prevFire = firing;

      if (pressed('KeyR') && weaponView.reload()) sound('reload');
      if (weaponView.state.mag === 0 && weaponView.state.reserve > 0 && weaponView.state.reloadLeft === 0) {
        weaponView.reload();
        sound('reload');
      }
      for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
        if (pressed(`Digit${i + 1}`)) switchWeapon(WEAPON_ORDER[i]);
      }

      // plant channel
      if (bomb.state.state === 'carried' && bomb.state.carrier === 'player') {
        const site = siteAt(player.state.position);
        if (site && keys.has('KeyE') && player.groundSpeed() < 1.0) {
          plantProgress += dt / 3.5;
          hud.plantProgress(plantProgress, `PLANTING THE SPARK — SITE ${site}`);
          if (plantProgress >= 1) {
            bomb.plant(site, player.state.position);
            match.money += PLANT_REWARD;
            hud.setMoney(match.money);
            hud.banner('SPARK PLANTED', `Site ${site} — detonation in 35s`, 3000);
            sound('plant');
            plantProgress = 0;
            hud.plantProgress(null);
          }
        } else {
          if (plantProgress > 0) plantProgress = Math.max(0, plantProgress - dt * 2);
          hud.plantProgress(plantProgress > 0 ? plantProgress : null, 'PLANTING…');
        }
      } else {
        plantProgress = 0;
        hud.plantProgress(null);
      }

      // pick up a dropped Spark
      if (bomb.state.state === 'dropped' && player.state.position.distanceTo(bomb.state.pos) < 1.4) {
        bomb.pickup('player');
        hud.banner('SPARK RECOVERED', 'Plant it at Foundry or Silos', 2000);
        sound('buy');
      }
    }

    if (pressed('KeyB') && phase === 'freeze') {
      const menu = document.getElementById('buy-menu');
      if (menu.hidden) hud.showBuy(Object.values(WEAPONS), match.money, weaponView.state.id, player.state.armor > 0);
      else hud.hideBuy();
    }
    if (pressed('Tab')) {
      const sb = document.getElementById('scoreboard');
      sb.hidden = !sb.hidden;
      if (!sb.hidden) updateScoreboard();
    }
    if (pressed('KeyM')) {
      audio.setMuted(!audio.muted);
      hud.banner(audio.muted ? 'SOUND OFF' : 'SOUND ON', '', 1200);
    }

    bots.step(dt, ctx);
    weaponView.step(dt);
    fx.step(dt);
    prevKeys = new Set(keys);
  }

  // hitboxes follow the player
  playerTorso.position.set(player.state.position.x, player.state.position.y + 0.575, player.state.position.z);
  playerHead.position.set(player.state.position.x, player.state.position.y + 1.55, player.state.position.z);

  // HUD sync
  hud.setHealth(player.state.health, player.state.armor);
  hud.setAmmo(weaponView.state.mag, weaponView.state.reserve, weaponView.state.def.name.toUpperCase());
  hud.setMoney(match.money);
  if (phase === 'freeze') hud.setTimer(freezeTimer, 'freeze');
  else if (bomb.state.state === 'planted') hud.setTimer(bomb.state.detonateIn, 'live');
  else hud.setTimer(roundTimer, 'live');
  hud.setAlive((player.state.alive ? 1 : 0) + bots.aliveCount('ember'), bots.aliveCount('ashen'));
  hud.setCrosshairSpread(4 + weaponView.spread(player.groundSpeed()) * 900);
  const scopeEl = document.getElementById('scope');
  const crossEl = document.getElementById('crosshair');
  scopeEl.hidden = !zoomed;
  crossEl.style.visibility = zoomed || !player.state.alive ? 'hidden' : 'visible';
  if (bomb.state.state === 'carried') {
    hud.setBombStatus(bomb.state.carrier === 'player'
      ? 'Spark with you — plant at Foundry or Silos'
      : `${bomb.state.carrier.name} carries the Spark`);
  } else if (bomb.state.state === 'dropped') {
    hud.setBombStatus('Spark dropped — pick it up');
  } else if (bomb.state.state === 'planted') {
    hud.setBombStatus(`Spark planted at Site ${bomb.state.site} — detonation in ${Math.ceil(bomb.state.detonateIn)}s`);
  }
}

// --- render ---
function render() {
  if (player.state.alive) {
    camera.position.set(player.state.position.x, player.state.position.y + player.state.eye + bobY, player.state.position.z);
    camera.rotation.y = player.state.yaw;
    camera.rotation.x = player.state.pitch;
  } else if (spectateTarget) {
    camera.position.set(spectateTarget.pos.x, spectateTarget.pos.y + 1.56, spectateTarget.pos.z);
    camera.rotation.y = spectateTarget.yaw;
    camera.rotation.x = 0;
  }
  const shake = fx.shake;
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * 0.12 * shake;
    camera.position.y += (Math.random() - 0.5) * 0.12 * shake;
    camera.rotation.z = (Math.random() - 0.5) * 0.02 * shake;
  } else {
    camera.rotation.z = 0;
  }
  const zoomed = input.state.zooming && weaponView.state.id === 'awp' && phase === 'live' && player.state.alive;
  const targetFov = zoomed ? 75 / 2.6 : 75;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * 0.2;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
}

// --- shot modes ---
function setupShot() {
  if (shotMode === 'start') {
    startRound(1);
    hud.hideBuy();
    player.state.yaw = 0;
    player.state.pitch = 0.02;
  } else if (shotMode === 'buy') {
    startRound(1);
    hud.hideOverlay();
  } else if (shotMode === 'play') {
    match.money = 800;
    owned.add('vk47');
    switchWeapon('vk47');
    player.state.armor = 50;
    player.reset(new THREE.Vector3(-5, 0, 4), -0.4);
    phase = 'live';
    roundTimer = ROUND_TIME;
    bots.spawnRound(1, seedBase + 108);
    bomb.reset();
    hud.hideOverlay();
    hud.hideBuy();
    updateScoreboard();
    // The sim runs 420 fixed steps synchronously, with no render in between — so
    // the meshes' matrixWorld would go stale and every raycast would test the bots
    // at their spawn (or origin) instead of where they walked to. Sync the graph
    // before each step, the way the renderer does once per frame in live play.
    scene.updateMatrixWorld(true);
    for (let i = 0; i < 420; i += 1) {
      fixedStep(STEP);
      scene.updateMatrixWorld(true);
      if (phase !== 'live') break;
    }
  } else if (shotMode === 'end') {
    match.ember = 5;
    match.ashen = 3;
    match.round = 9;
    hud.setScore(5, 3, 9);
    bots.spawnRound(9, seedBase + 916);
    hud.showOverlay('end', '5 - 3');
    player.reset(new THREE.Vector3(-8, 0, -2), 0.5);
    phase = 'menu';
  }
  requestAnimationFrame(() => {
    render();
    requestAnimationFrame(() => {
      render();
      window.__shotReady = true;
    });
  });
}

if (shotMode) {
  setupShot();
} else {
  hud.showOverlay('start');
  requestAnimationFrame(() => {
    render();
    window.__shotReady = true;
  });
}

// --- main loop ---
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.1);
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    fixedStep(STEP);
    acc -= STEP;
    steps += 1;
  }
  if (steps === 5) acc = 0;
  render();
}
requestAnimationFrame(frame);
