// Battle feedback: tracers, impact sparks and the bomb explosion. Everything is
// pooled and fades fast, so a long firefight never leaks meshes.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const TRACER_POOL = 24;
const TRACER_LIFE = 0.09;
const SPARK_COUNT = 320;

export function createFx(scene) {
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
    shake = Math.max(0, shake - dt * 1.8);
  }

  return {
    tracer,
    impact,
    explosion,
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
      shake = 0;
    },
  };
}
