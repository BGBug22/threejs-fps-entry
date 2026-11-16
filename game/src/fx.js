// Battle feedback: tracers, impact sparks and the bomb explosion. Everything is
// pooled and fades fast, so a long firefight never leaks meshes.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const TRACER_POOL = 24;
const TRACER_LIFE = 0.35;
const SPARK_COUNT = 320;
const SMOKE_POOL = 6;
const SMOKE_LIFE = 12;
const SMOKE_RADIUS = 2.4;

export function createFx(scene) {
  let elapsed = 0;
  const tracers = [];
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const material = new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerCursor = 0;

  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARK_COUNT * 3);
  const sparkVel = new Float32Array(SPARK_COUNT * 3);
  const sparkLife = new Float32Array(SPARK_COUNT);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({ color: new THREE.Color(PALETTE.accent), size: 0.07, transparent: true, opacity: 0.95, depthWrite: false });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  let sparkCursor = 0;

  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a2e'), transparent: true, opacity: 0, depthWrite: false }),
  );
  boom.visible = false;
  scene.add(boom);
  const boomLight = new THREE.PointLight(new THREE.Color('#ff7a1a'), 0, 30, 1.6);
  scene.add(boomLight);
  let boomLife = 0;
  let shake = 0;

  // Smoke clouds: pooled groups of soft grey spheres that bloom where a smoke
  // grenade lands and hang for 12 s. A cloud blocks sight (bots.js asks
  // smokeBlocks before it lets a bot see through), never bullets.
  const smokes = [];
  const smokeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfd6d4'), transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < SMOKE_POOL; i += 1) {
    const group = new THREE.Group();
    const parts = [];
    for (let j = 0; j < 3; j += 1) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), smokeMat.clone());
      ball.position.set((j - 1) * 1.1, j === 1 ? 0.5 : 0.1, (j % 2 === 0 ? 0.6 : -0.6));
      ball.scale.set(1.4, 0.9, 1.4);
      group.add(ball);
      parts.push(ball);
    }
    group.visible = false;
    scene.add(group);
    smokes.push({ group, parts, life: 0, pos: new THREE.Vector3(), radius: SMOKE_RADIUS });
  }
  let smokeCursor = 0;

  // Molotov fire: pooled patches of flame cones + a light, burning ~6 s. A fire
  // zone is area denial: grenades.js ticks damage on anything standing in it.
  const FIRE_POOL = 3;
  const FIRE_LIFE = 6;
  const FIRE_RADIUS = 3.2;
  const fires = [];
  for (let i = 0; i < FIRE_POOL; i += 1) {
    const group = new THREE.Group();
    const cones = [];
    for (let j = 0; j < 5; j += 1) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 2.2, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(j % 2 ? '#ffd23e' : '#ff7a1a'), transparent: true, opacity: 0.88, depthWrite: false }),
      );
      cone.position.set((j % 3 - 1) * 1.5, 1.1, j < 3 ? -1.1 : 1.1);
      group.add(cone);
      cones.push(cone);
    }
    group.visible = false;
    scene.add(group);
    const light = new THREE.PointLight(new THREE.Color('#ff7a1a'), 0, 12, 1.8);
    scene.add(light);
    fires.push({ group, cones, light, life: 0, pos: new THREE.Vector3(), radius: FIRE_RADIUS });
  }
  let fireCursor = 0;

  function fire(pos) {
    const f = fires[fireCursor];
    fireCursor = (fireCursor + 1) % FIRE_POOL;
    f.pos.copy(pos);
    f.pos.y = 0;
    f.group.position.copy(f.pos);
    f.life = FIRE_LIFE;
    f.group.visible = true;
    f.light.position.set(pos.x, 1.2, pos.z);
    f.light.intensity = 60;
  }

  // Flash pop: a white sphere + light at the burst, gone in a blink.
  const flashBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 14, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0, depthWrite: false }),
  );
  flashBall.visible = false;
  scene.add(flashBall);
  const flashLight = new THREE.PointLight(new THREE.Color('#ffffff'), 0, 18, 1.6);
  scene.add(flashLight);
  let flashLife = 0;

  function smoke(pos) {
    const cloud = smokes[smokeCursor];
    smokeCursor = (smokeCursor + 1) % SMOKE_POOL;
    cloud.pos.copy(pos);
    cloud.pos.y = Math.max(1.1, pos.y);
    cloud.group.position.copy(cloud.pos);
    cloud.life = SMOKE_LIFE;
    cloud.group.visible = true;
    cloud.group.scale.setScalar(0.3);
  }

  // Segment-sphere test: does the sight line from -> to pass through a live cloud?
  function smokeBlocks(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const lenSq = dx * dx + dy * dy + dz * dz;
    for (const cloud of smokes) {
      if (cloud.life <= 0) continue;
      const cx = cloud.pos.x - from.x;
      const cy = cloud.pos.y - from.y;
      const cz = cloud.pos.z - from.z;
      let t = lenSq > 0 ? (cx * dx + cy * dy + cz * dz) / lenSq : 0;
      t = Math.max(0, Math.min(1, t));
      const px = from.x + dx * t - cloud.pos.x;
      const py = from.y + dy * t - cloud.pos.y;
      const pz = from.z + dz * t - cloud.pos.z;
      if (px * px + py * py + pz * pz < cloud.radius * cloud.radius) return true;
    }
    return false;
  }

  function flashBurst(pos) {
    flashBall.position.copy(pos);
    flashBall.position.y = Math.max(1.2, pos.y + 0.4);
    flashBall.visible = true;
    flashLife = 0.35;
    flashLight.position.copy(flashBall.position);
    flashLight.intensity = 120;
  }

  function tracer(from, to, color = 0xffc46b) {
    const t = tracers[tracerCursor];
    tracerCursor = (tracerCursor + 1) % TRACER_POOL;
    const pos = t.line.geometry.attributes.position.array;
    pos[0] = from.x; pos[1] = from.y; pos[2] = from.z;
    pos[3] = to.x; pos[4] = to.y; pos[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.line.material.opacity = 0.9;
    t.life = TRACER_LIFE;
  }

  function impact(point, color = 0xffc46b) {
    for (let n = 0; n < 10; n += 1) {
      const i = sparkCursor;
      sparkCursor = (sparkCursor + 1) % SPARK_COUNT;
      sparkPos[i * 3] = point.x;
      sparkPos[i * 3 + 1] = point.y;
      sparkPos[i * 3 + 2] = point.z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2.5 + 0.5;
      const speed = Math.random() * 3 + 1;
      sparkVel[i * 3] = Math.cos(a) * speed;
      sparkVel[i * 3 + 1] = up;
      sparkVel[i * 3 + 2] = Math.sin(a) * speed;
      sparkLife[i] = 0.35 + Math.random() * 0.25;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkMat.color.setHex(color);
  }

  function explosion(point) {
    boom.position.copy(point);
    boom.position.y = Math.max(1.2, point.y + 0.6);
    boom.visible = true;
    boomLife = 0.9;
    boomLight.position.copy(boom.position);
    boomLight.intensity = 160;
    shake = 1;
    for (let n = 0; n < 90; n += 1) {
      const i = sparkCursor;
      sparkCursor = (sparkCursor + 1) % SPARK_COUNT;
      sparkPos[i * 3] = point.x;
      sparkPos[i * 3 + 1] = point.y + 0.5;
      sparkPos[i * 3 + 2] = point.z;
      const a = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 3;
      sparkVel[i * 3] = Math.cos(a) * speed;
      sparkVel[i * 3 + 1] = Math.random() * 8 + 2;
      sparkVel[i * 3 + 2] = Math.sin(a) * speed;
      sparkLife[i] = 0.6 + Math.random() * 0.5;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  }

  function step(dt) {
    elapsed += dt;
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, (t.life / TRACER_LIFE) * 0.9);
    }
    let anySpark = false;
    for (let i = 0; i < SPARK_COUNT; i += 1) {
      if (sparkLife[i] <= 0) continue;
      anySpark = true;
      sparkLife[i] -= dt;
      sparkVel[i * 3 + 1] -= 12 * dt;
      sparkPos[i * 3] += sparkVel[i * 3] * dt;
      sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
      sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
      if (sparkPos[i * 3 + 1] < 0.02) { sparkPos[i * 3 + 1] = 0.02; sparkVel[i * 3 + 1] *= -0.3; }
      if (sparkLife[i] <= 0) sparkPos[i * 3 + 1] = -100;
    }
    if (anySpark) sparkGeo.attributes.position.needsUpdate = true;
    if (boomLife > 0) {
      boomLife -= dt;
      const k = 1 - Math.max(0, boomLife) / 0.9;
      const scale = 1 + k * 11;
      boom.scale.set(scale, scale, scale);
      boom.material.opacity = Math.max(0, 0.85 * (1 - k));
      boomLight.intensity = Math.max(0, 160 * (1 - k));
      if (boomLife <= 0) { boom.visible = false; boomLight.intensity = 0; }
    }
    for (const cloud of smokes) {
      if (cloud.life <= 0) continue;
      cloud.life -= dt;
      const age = SMOKE_LIFE - Math.max(0, cloud.life);
      const grow = Math.min(1, age / 1.2);
      cloud.group.scale.setScalar(0.3 + 0.7 * grow);
      const fade = cloud.life < 3 ? Math.max(0, cloud.life / 3) : 1;
      for (const ball of cloud.parts) ball.material.opacity = 0.55 * fade;
      if (cloud.life <= 0) cloud.group.visible = false;
    }
    if (flashLife > 0) {
      flashLife -= dt;
      const k = Math.max(0, flashLife) / 0.35;
      flashBall.material.opacity = 0.95 * k;
      flashBall.scale.setScalar(1 + (1 - k) * 4);
      flashLight.intensity = 120 * k;
      if (flashLife <= 0) { flashBall.visible = false; flashLight.intensity = 0; }
    }
    // Molotov flames flicker and shrink as the pool burns out.
    for (const f of fires) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const k = Math.max(0, f.life) / FIRE_LIFE;
      for (let i = 0; i < f.cones.length; i += 1) {
        const s = (0.7 + 0.3 * Math.sin(elapsed * 13 + i * 2.1)) * (0.5 + 0.5 * k);
        f.cones[i].scale.set(s, s * (0.8 + 0.4 * k), s);
      }
      f.light.intensity = 60 * k;
      if (f.life <= 0) { f.group.visible = false; f.light.intensity = 0; }
    }
    shake = Math.max(0, shake - dt * 1.8);
  }

  return {
    tracer,
    impact,
    explosion,
    smoke,
    smokeBlocks,
    flashBurst,
    fire,
    fireZones() { return fires.filter((f) => f.life > 0); },
    step,
    get shake() { return shake; },
    clear() {
      for (const t of tracers) { t.life = 0; t.line.material.opacity = 0; }
      sparkLife.fill(0);
      for (let i = 0; i < SPARK_COUNT; i += 1) sparkPos[i * 3 + 1] = -100;
      sparkGeo.attributes.position.needsUpdate = true;
      boomLife = 0;
      boom.visible = false;
      boomLight.intensity = 0;
      for (const cloud of smokes) { cloud.life = 0; cloud.group.visible = false; }
      flashLife = 0;
      flashBall.visible = false;
      flashLight.intensity = 0;
      for (const f of fires) { f.life = 0; f.group.visible = false; f.light.intensity = 0; }
      shake = 0;
    },
  };
}
