// The five weapons: one sidearm everyone owns, three rifles and a bolt sniper.
// Each definition is the whole balance of the gun: damage, headshot multiplier,
// magazine, fire gap, reload time and how much moving opens its spread. Bots use
// the same definitions, so a gunfight is fair on both sides.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  p9: {
    id: 'p9', name: 'P9 Sidearm', price: 0, damage: 26, headMult: 3.2,
    mag: 15, reserve: 60, gap: 0.21, reloadTime: 1.4,
    spreadStill: 0.004, spreadMove: 0.03, auto: false, zoom: 1,
    blurb: 'Reliable. Free.',
  },
  smg: {
    id: 'smg', name: 'SMG-9', price: 1500, damage: 24, headMult: 3.0,
    mag: 28, reserve: 112, gap: 0.075, reloadTime: 1.7,
    spreadStill: 0.006, spreadMove: 0.035, auto: true, zoom: 1,
    blurb: 'Close quarters hose.',
  },
  vk47: {
    id: 'vk47', name: 'VK-47', price: 2700, damage: 36, headMult: 3.4,
    mag: 25, reserve: 75, gap: 0.105, reloadTime: 2.0,
    spreadStill: 0.003, spreadMove: 0.026, auto: true, zoom: 1,
    blurb: 'Hard hitting, loud.',
  },
  m4r: {
    id: 'm4r', name: 'M4R Carbine', price: 3100, damage: 33, headMult: 3.4,
    mag: 30, reserve: 90, gap: 0.09, reloadTime: 1.9,
    spreadStill: 0.0025, spreadMove: 0.022, auto: true, zoom: 1,
    blurb: 'Accurate at range.',
  },
  awp: {
    id: 'awp', name: 'AWP-L', price: 4750, damage: 110, headMult: 2.0,
    mag: 5, reserve: 20, gap: 1.4, reloadTime: 3.0,
    spreadStill: 0.0006, spreadMove: 0.05, auto: false, zoom: 2.6,
    blurb: 'One shot. Scope it.',
  },
};

export const ARMOR_PRICE = 650;
export const ARMOR_VALUE = 50;

// The view model: a box-built gun that lives on the camera, with a muzzle flash
// and a kick that settles back. It owns the magazine and the reload, never the ray.
export function createWeaponView(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.3 });

  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), body);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.08), accent);
  sight.position.set(0, 0.075, -0.1);
  model.add(receiver, barrel, stock, sight);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  const state = { id: 'p9', def: WEAPONS.p9, mag: WEAPONS.p9.mag, reserve: WEAPONS.p9.reserve, cooldown: 0, reloadLeft: 0, flash: 0, kick: 0 };

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = -0.42 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (state.def.reloadTime - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const need = state.def.mag - state.mag;
        const take = Math.min(need, state.reserve);
        state.mag += take;
        state.reserve -= take;
      }
    }
  }

  return {
    state,
    step,
    setWeapon(id, keepAmmo = true) {
      const def = WEAPONS[id];
      if (!def) return;
      const wasSame = state.id === id;
      const oldMag = state.mag;
      state.id = id;
      state.def = def;
      if (keepAmmo && wasSame) {
        // same gun re-selected: keep the magazine, keep the reserve
        state.mag = Math.min(def.mag, oldMag);
      } else {
        state.mag = def.mag;
        state.reserve = def.reserve;
      }
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
    },
    setAmmo(mag, reserve) {
      state.mag = mag;
      state.reserve = reserve;
    },
    ready() {
      return state.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    pullTrigger() {
      state.cooldown = state.def.gap;
      state.flash = 0.06;
      state.kick = state.id === 'awp' ? 0.12 : 0.055;
    },
    takeRound() {
      if (state.mag <= 0) return false;
      state.mag -= 1;
      return true;
    },
    reload() {
      if (state.reloadLeft > 0 || state.mag === state.def.mag || state.reserve === 0) return false;
      state.reloadLeft = state.def.reloadTime;
      return true;
    },
    spread(speed) {
      return state.def.spreadStill + Math.min(1, speed / 5.4) * state.def.spreadMove;
    },
    refill() {
      state.mag = state.def.mag;
      state.reserve = state.def.reserve;
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
    },
  };
}
