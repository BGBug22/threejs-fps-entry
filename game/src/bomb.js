// The Spark: the objective device. It starts with the player, drops where its
// carrier falls, can be picked up by an Ember, and once planted ticks down 35
// seconds to a detonation only a defuse can stop. Its blinking light and beeps
// speed up as the timer runs out.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const DETONATE_SECONDS = 35;

export function createBomb(scene) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.22, 0.3),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#1d1712'), roughness: 0.6, metalness: 0.4 }),
  );
  body.castShadow = true;
  const lightMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent) }),
  );
  lightMesh.position.set(0.14, 0.13, 0);
  group.add(body, lightMesh);
  const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 4, 2);
  light.position.y = 0.3;
  group.add(light);
  group.visible = false;
  scene.add(group);

  const bomb = {
    state: 'idle', // idle | carried | dropped | planted
    carrier: null, // 'player' | bot | null
    site: null,
    pos: new THREE.Vector3(),
    detonateIn: DETONATE_SECONDS,
    beepAt: 0,
    blinkAt: 0,
    lightOn: false,
  };

  function placeAt(pos) {
    bomb.pos.copy(pos);
    group.position.set(pos.x, 0.12, pos.z);
  }

  return {
    state: bomb,
    reset() {
      bomb.state = 'carried';
      bomb.carrier = 'player';
      bomb.site = null;
      bomb.detonateIn = DETONATE_SECONDS;
      bomb.beepAt = 0;
      group.visible = false;
    },
    drop(pos) {
      bomb.state = 'dropped';
      bomb.carrier = null;
      placeAt(pos);
      group.visible = true;
    },
    pickup(actor) {
      bomb.state = 'carried';
      bomb.carrier = actor;
      group.visible = false;
    },
    plant(site, pos) {
      bomb.state = 'planted';
      bomb.carrier = null;
      bomb.site = site;
      bomb.detonateIn = DETONATE_SECONDS;
      bomb.beepAt = 0;
      placeAt(pos);
      group.visible = true;
    },
    update(dt, ctx) {
      if (bomb.state !== 'planted') return;
      bomb.detonateIn -= dt;
      const interval = bomb.detonateIn > 20 ? 1.0 : bomb.detonateIn > 10 ? 0.5 : 0.25;
      bomb.beepAt -= dt;
      if (bomb.beepAt <= 0) {
        bomb.beepAt = interval;
        ctx.sound('beep');
      }
      bomb.blinkAt -= dt;
      if (bomb.blinkAt <= 0) {
        bomb.blinkAt = interval / 2;
        bomb.lightOn = !bomb.lightOn;
        lightMesh.material.color.setHex(bomb.lightOn ? 0xff2a1a : 0xff8c2e);
        light.intensity = bomb.lightOn ? 6 : 0;
      }
      if (bomb.detonateIn <= 0) ctx.onDetonate();
    },
  };
}
