// The nine bots: four Ember friendlies and five Ashen enemies. Each bot walks the
// waypoint graph, holds or pushes a site, and fights with the same hitscan rules as
// the player. Attackers carry the objective; defenders hold the sites and rotate
// when the bomb is planted. All randomness comes from the rng main.js passes in,
// so a seeded run replays the same.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS } from './weapons.js';

const EMBER_NAMES = ['Vex', 'Mira', 'Juno', 'Kade'];
const ASHEN_NAMES = ['Rook', 'Sable', 'Ivo', 'Nyx', 'Dax'];
const RADIUS = 0.34;
const HEIGHT = 1.72;
const EYE = 1.5;
const CHEST = 1.25;

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

function nearestNode(waypoints, pos) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < waypoints.length; i += 1) {
    const d = waypoints[i].p.distanceToSquared(pos);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function findPath(waypoints, from, to) {
  if (from === to) return [to];
  const prev = new Array(waypoints.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const next of waypoints[cur].links) {
      if (prev[next] === -1) { prev[next] = cur; queue.push(next); }
    }
  }
  if (prev[to] === -1) return [to];
  const path = [];
  let cur = to;
  while (cur !== from) { path.unshift(cur); cur = prev[cur]; }
  return path;
}

export function createBots(scene, world) {
  const list = [];
  const hitMeshes = [];
  const probe = new THREE.Box3();
  const tmpV = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function makeHealthBar() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent: true }));
    sprite.scale.set(0.95, 0.12, 1);
    sprite.position.y = 1.98;
    return { canvas, texture, sprite };
  }

  function drawHealthBar(bot) {
    const { canvas, texture } = bot.bar;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, 64, 8);
    c.fillStyle = 'rgba(10,10,10,0.75)';
    c.fillRect(0, 0, 64, 8);
    const f = Math.max(0, bot.health / 100);
    c.fillStyle = f > 0.55 ? '#7dc383' : f > 0.28 ? '#f0a830' : '#e5484d';
    c.fillRect(1, 1, 62 * f, 6);
    texture.needsUpdate = true;
  }

  function buildBotMesh(team) {
    const teamColor = team === 'ember' ? PALETTE.accent : PALETTE.teal;
    const group = new THREE.Group();
    const torsoMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(teamColor), roughness: 0.6, metalness: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#241c16'), roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), torsoMat);
    torso.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), skinMat);
    head.position.y = 1.56;
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), torsoMat);
    helmet.position.y = 1.66;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), darkMat);
    legL.position.set(-0.13, 0.31, 0);
    const legR = legL.clone();
    legR.position.x = 0.13;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.55), darkMat);
    gun.position.set(0.28, 1.18, -0.2);
    group.add(torso, head, helmet, legL, legR, gun);
    group.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
    return { group, torso, head };
  }

  function overlaps(x, z) {
    probe.min.set(x - RADIUS, 0.02, z - RADIUS);
    probe.max.set(x + RADIUS, HEIGHT - 0.02, z + RADIUS);
    for (const collider of world.colliders) if (probe.intersectsBox(collider)) return true;
    return false;
  }

  function moveBot(bot, dt, wx, wz, speed) {
    const len = Math.hypot(wx, wz) || 1;
    const vx = (wx / len) * speed;
    const vz = (wz / len) * speed;
    const nx = bot.pos.x + vx * dt;
    if (!overlaps(nx, bot.pos.z)) bot.pos.x = nx;
    const nz = bot.pos.z + vz * dt;
    if (!overlaps(bot.pos.x, nz)) bot.pos.z = nz;
    bot.group.position.set(bot.pos.x, 0, bot.pos.z);
  }

  function faceToward(bot, x, z) {
    const dx = x - bot.pos.x;
    const dz = z - bot.pos.z;
    bot.yaw = Math.atan2(-dx, -dz);
    bot.group.rotation.y = bot.yaw;
  }

  function botEye(bot) {
    return tmpV.set(bot.pos.x, bot.pos.y + EYE, bot.pos.z);
  }

  function hasLineOfSight(ctx, bot, from, to) {
    tmpDir.copy(to).sub(from);
    const dist = tmpDir.length();
    if (dist < 0.01) return true;
    tmpDir.divideScalar(dist);
    const hit = ctx.raycast(from, tmpDir, dist - 0.2, bot);
    return !hit;
  }

  function pickWeapon(round, rng, sniper) {
    if (sniper) return 'awp';
    if (round <= 1) return rng() < 0.6 ? 'p9' : 'smg';
    if (round === 2) return rng() < 0.5 ? 'smg' : 'vk47';
    const r = rng();
    if (r < 0.4) return 'vk47';
    if (r < 0.8) return 'm4r';
    return 'smg';
  }

  function spawnRound(round, seed) {
    const rng = mulberry32(seed);
    for (const bot of list) scene.remove(bot.group);
    list.length = 0;
    hitMeshes.length = 0;
    const mk = (team, name, index, spawnPos, yaw, sniper) => {
      const { group, torso, head } = buildBotMesh(team);
      const bar = makeHealthBar();
      group.add(bar.sprite);
      group.position.copy(spawnPos);
      group.rotation.y = yaw;
      scene.add(group);
      const weaponId = pickWeapon(round, rng, sniper);
      const bot = {
        id: `${team}-${index}`, name, team, group, torso, head, bar,
        pos: spawnPos.clone(), yaw, health: 100, armor: round >= 2 ? 50 : 0,
        weaponId, def: WEAPONS[weaponId],
        mag: WEAPONS[weaponId].mag, reserve: WEAPONS[weaponId].reserve,
        cooldown: 0, reloadLeft: 0, state: 'hold', goalSite: team === 'ember' ? (rng() < 0.6 ? 'A' : 'B') : (index % 2 === 0 ? 'A' : 'B'),
        path: [], pathIdx: 0, target: null, targetKind: null, lastSeen: 0,
        reactionAt: 0, burstLeft: 0, burstPause: 0, strafeDir: 1, strafeUntil: 0,
        speed: 3.6, plantProgress: 0, defuseProgress: 0, alive: true, carrier: false,
        fallT: 0, scanAt: rng() * 0.15, siteNode: 0,
        laneOffset: (index - (team === 'ember' ? 1.5 : 2)) * 0.9,
      };
      torso.userData.bot = bot;
      torso.userData.part = 'torso';
      head.userData.bot = bot;
      head.userData.part = 'head';
      drawHealthBar(bot);
      hitMeshes.push(torso, head);
      list.push(bot);
      return bot;
    };
    for (let i = 0; i < 4; i += 1) {
      mk('ember', EMBER_NAMES[i], i, world.spawns.attack[i + 1], 0, false);
    }
    for (let i = 0; i < 5; i += 1) {
      mk('ashen', ASHEN_NAMES[i], i, world.spawns.defend[i], Math.PI, i === 4 && round >= 3);
    }
    // Ember bots 0-1 push A, 2-3 push B; Ashen hold: 0-1 A, 2-3 B, 4 mid.
    list.filter((b) => b.team === 'ember').forEach((b, i) => { b.goalSite = i < 2 ? 'A' : 'B'; });
    list.filter((b) => b.team === 'ashen').forEach((b, i) => { b.goalSite = i === 4 ? 'A' : (i % 2 === 0 ? 'A' : 'B'); });
  }

  function aliveCount(team) {
    return list.filter((b) => b.team === team && b.alive).length;
  }

  function step(dt, ctx) {
    const rng = ctx.rng;
    for (const bot of list) {
      if (!bot.alive) {
        if (bot.fallT < 1) {
          bot.fallT = Math.min(1, bot.fallT + dt / 0.4);
          bot.group.rotation.x = -bot.fallT * 1.45;
        }
        continue;
      }
      bot.cooldown = Math.max(0, bot.cooldown - dt);
      if (bot.reloadLeft > 0) {
        bot.reloadLeft = Math.max(0, bot.reloadLeft - dt);
        if (bot.reloadLeft === 0) {
          const need = bot.def.mag - bot.mag;
          const take = Math.min(need, bot.reserve);
          bot.mag += take;
          bot.reserve -= take;
        }
      }
      if (ctx.phase !== 'live') continue;

      // --- perception, staggered ---
      bot.scanAt -= dt;
      if (bot.scanAt <= 0) {
        bot.scanAt = 0.15 + rng() * 0.1;
        scanForEnemy(bot, ctx);
      }

      const bomb = ctx.bomb;
      if (bot.team === 'ashen' && bomb.state === 'planted') bot.goalSite = bomb.site;
      if (bot.team === 'ember' && bomb.state === 'planted') bot.goalSite = bomb.site;

      // --- plant / defuse ---
      if (bot.carrier && bot.team === 'ember' && bomb.state === 'carried') {
        const site = world.sites[bot.goalSite];
        const dSite = Math.hypot(bot.pos.x - site.center.x, bot.pos.z - site.center.z);
        if (dSite < 2.5 && !bot.target) {
          bot.state = 'plant';
          bot.plantProgress += dt / 3.5;
          if (bot.plantProgress >= 1) { bot.plantProgress = 0; ctx.onPlanted(bot.goalSite, bot); }
          continue;
        }
        bot.plantProgress = 0;
      }
      if (bot.team === 'ashen' && bomb.state === 'planted') {
        const dBomb = Math.hypot(bot.pos.x - bomb.pos.x, bot.pos.z - bomb.pos.z);
        if (dBomb < 3 && !bot.target) {
          bot.state = 'defuse';
          bot.defuseProgress += dt / 5;
          if (bot.defuseProgress >= 1) { bot.defuseProgress = 0; ctx.onDefused(bot); }
          continue;
        }
        bot.defuseProgress = 0;
      }
      // --- fetch a dropped bomb (Ember only) ---
      if (bot.team === 'ember' && bomb.state === 'dropped' && !bot.carrier) {
        const dBomb = Math.hypot(bot.pos.x - bomb.pos.x, bot.pos.z - bomb.pos.z);
        if (dBomb < 1.4) {
          bot.carrier = true;
          ctx.onPickup(bot);
          bot.state = 'push';
        } else if (bot.state !== 'engage') {
          bot.state = 'fetch';
          walkTo(bot, bomb.pos.x, bomb.pos.z, dt, 4.4);
          continue;
        }
      }

      // --- combat ---
      if (bot.target) {
        const t = bot.target;
        const tPos = t.kind === 'player' ? ctx.playerPos : t.bot.pos;
        const tAlive = t.kind === 'player' ? ctx.playerAlive : t.bot.alive;
        if (!tAlive) { bot.target = null; bot.state = bot.team === 'ember' ? 'push' : 'hold'; }
        else {
          const dist = Math.hypot(tPos.x - bot.pos.x, tPos.z - bot.pos.z);
          faceToward(bot, tPos.x, tPos.z);
          if (ctx.time >= bot.reactionAt) {
            if (bot.burstPause > 0) {
              bot.burstPause -= dt;
            } else if (bot.burstLeft > 0 && bot.cooldown === 0 && bot.reloadLeft === 0) {
              fireAt(bot, t, dist, ctx);
              bot.burstLeft -= 1;
              if (bot.burstLeft === 0) bot.burstPause = 0.8 + rng() * 0.6;
            } else if (bot.burstLeft === 0 && bot.burstPause <= 0) {
              bot.burstLeft = 2 + Math.floor(rng() * 3);
            }
          }
          // strafe while engaging
          if (ctx.time > bot.strafeUntil) {
            bot.strafeDir = rng() < 0.5 ? -1 : 1;
            bot.strafeUntil = ctx.time + 0.7 + rng() * 0.7;
          }
          const sx = Math.cos(bot.yaw) * bot.strafeDir;
          const sz = -Math.sin(bot.yaw) * bot.strafeDir;
          moveBot(bot, dt, sx, sz, 1.6);
          continue;
        }
      }

      // --- movement ---
      if (bot.team === 'ember') {
        const site = world.sites[bot.goalSite];
        walkTo(bot, site.center.x, site.center.z, dt, bot.speed);
        if (Math.hypot(bot.pos.x - site.center.x, bot.pos.z - site.center.z) < 2.2) bot.state = 'hold';
        else bot.state = 'push';
      } else {
        // defenders hold near their site, or rotate to the planted site
        const goal = bomb.state === 'planted' ? world.sites[bomb.site].center : world.sites[bot.goalSite].center;
        const d = Math.hypot(bot.pos.x - goal.x, bot.pos.z - goal.z);
        if (d > 3.5) {
          walkTo(bot, goal.x, goal.z, dt, bomb.state === 'planted' ? 4.8 : bot.speed);
          bot.state = 'push';
        } else {
          bot.state = 'hold';
          bot.yaw += Math.sin(ctx.time * 0.5 + bot.id.charCodeAt(6)) * 0.002;
          bot.group.rotation.y = bot.yaw;
        }
      }
    }
  }

  function walkTo(bot, x, z, dt, speed) {
    const from = nearestNode(world.waypoints, bot.pos);
    const to = nearestNode(world.waypoints, tmpV.set(x, 0, z));
    if (bot.path.length === 0 || bot.pathTarget !== to) {
      bot.path = findPath(world.waypoints, from, to);
      bot.pathIdx = 0;
      bot.pathTarget = to;
    }
    let dest = null;
    while (bot.pathIdx < bot.path.length) {
      const node = world.waypoints[bot.path[bot.pathIdx]];
      if (Math.hypot(node.p.x - bot.pos.x, node.p.z - bot.pos.z) < 0.9) bot.pathIdx += 1;
      else { dest = node.p; break; }
    }
    if (!dest) dest = tmpV.set(x, 0, z);
    // Each bot walks a line parallel to the path, offset sideways, so the squad
    // advances abreast instead of stacking up and blocking each other's fire.
    const dx0 = dest.x - bot.pos.x;
    const dz0 = dest.z - bot.pos.z;
    const len0 = Math.hypot(dx0, dz0) || 1;
    const tx = dest.x + (-dz0 / len0) * bot.laneOffset;
    const tz = dest.z + (dx0 / len0) * bot.laneOffset;
    const dx = tx - bot.pos.x;
    const dz = tz - bot.pos.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.05) {
      faceToward(bot, tx, tz);
      moveBot(bot, dt, dx / len, dz / len, speed);
    }
  }

  function scanForEnemy(bot, ctx) {
    const eye = botEye(bot);
    const candidates = [];
    // The player is Ember: only Ashen bots count them as an enemy.
    if (ctx.playerAlive && bot.team === 'ashen') candidates.push({ kind: 'player', pos: ctx.playerPos, bot: null });
    for (const other of list) {
      if (other.team !== bot.team && other.alive) candidates.push({ kind: 'bot', pos: other.pos, bot: other });
    }
    let best = null;
    let bestD = 20; // only fight inside 20 m: further away, keep pushing instead of stalling in a long-range duel through a gap
    for (const c of candidates) {
      const d = Math.hypot(c.pos.x - bot.pos.x, c.pos.z - bot.pos.z);
      if (d > bestD) continue;
      const chest = tmpDir.set(c.pos.x, c.pos.y + CHEST, c.pos.z);
      if (hasLineOfSight(ctx, bot, eye, chest)) { best = c; bestD = d; }
    }
    if (best) {
      if (!bot.target) bot.reactionAt = ctx.time + 0.4 + ctx.rng() * 0.5;
      bot.target = best;
      bot.targetKind = best.kind;
      bot.state = 'engage';
    } else if (bot.target) {
      bot.target = null;
      bot.state = bot.team === 'ember' ? 'push' : 'hold';
    }
  }

  function fireAt(bot, t, dist, ctx) {
    if (bot.mag <= 0) {
      if (bot.reserve > 0 && bot.reloadLeft === 0) bot.reloadLeft = bot.def.reloadTime;
      return;
    }
    bot.mag -= 1;
    bot.cooldown = bot.def.gap;
    const eye = botEye(bot);
    const tPos = t.kind === 'player' ? ctx.playerPos : t.bot.pos;
    const headshot = ctx.rng() < 0.14;
    const aimY = tPos.y + (headshot ? 1.56 : CHEST);
    const spread = 0.006 + dist * 0.0009;
    const dir = new THREE.Vector3(
      tPos.x - eye.x + (ctx.rng() * 2 - 1) * spread * dist,
      aimY - eye.y + (ctx.rng() * 2 - 1) * spread * dist,
      tPos.z - eye.z + (ctx.rng() * 2 - 1) * spread * dist,
    ).normalize();
    const muzzle = new THREE.Vector3(bot.pos.x, bot.pos.y + 1.25, bot.pos.z).addScaledVector(dir, 0.6);
    const hit = ctx.raycast(eye, dir, 80, bot);
    const end = hit ? hit.point : eye.clone().addScaledVector(dir, 80);
    ctx.tracer(muzzle, end, bot.team === 'ember' ? 0xffc46b : 0x7de3f0);
    if (ctx.nearPlayer(bot.pos)) ctx.sound('shot', bot.def.id);
    if (hit && hit.object) {
      ctx.impact(hit.point);
      const hitBot = hit.object.userData.bot;
      if (hitBot && hitBot.team !== bot.team && hitBot.alive) {
        ctx.damageBot(hitBot, bot.def.damage * (hit.object.userData.part === 'head' ? bot.def.headMult : 1), hit.object.userData.part, bot.name);
      } else if (hit.object.userData.player && ctx.playerAlive && bot.team === 'ashen') {
        ctx.damagePlayer(bot.def.damage * (hit.object.userData.part === 'head' ? bot.def.headMult : 1), bot.pos, bot.name);
      }
    }
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    let left = amount;
    if (bot.armor > 0) {
      const absorbed = Math.min(bot.armor, left * 0.5);
      bot.armor -= absorbed;
      left -= absorbed;
    }
    bot.health -= left;
    drawHealthBar(bot);
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.target = null;
      bot.fallT = 0;
      bot.bar.sprite.visible = false;
      return true;
    }
    return false;
  }

  return {
    list,
    hitMeshes,
    spawnRound,
    step,
    aliveCount,
    damage,
    reset() {
      for (const bot of list) scene.remove(bot.group);
      list.length = 0;
      hitMeshes.length = 0;
    },
  };
}
