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

// The view model: a multi-part gun that lives on the camera — receiver, long
// barrel with a muzzle brake, angled magazine, foregrip, stock and a sight on
// top — with a star-shaped muzzle flash and a kick that settles back. It owns
// the magazine and the reload, never the ray.
export function createWeaponView(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#241a12'), roughness: 0.6, metalness: 0.3 });

  const model = new THREE.Group();
  // Dark rifle, bright accents: the gun must read as a gun, not a pale plank.
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.46), dark);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.44), grip);
  barrel.position.set(0, 0.03, -0.42);
  const brake = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.09), accent);
  brake.position.set(0, 0.03, -0.66);
  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.09), accent);
  magazine.position.set(0, -0.13, 0.02);
  magazine.rotation.x = 0.25;
  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), grip);
  foregrip.position.set(0, -0.09, -0.3);
  foregrip.rotation.x = 0.3;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.24), dark);
  stock.position.set(0, -0.02, 0.32);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.1), accent);
  sight.position.set(0, 0.085, -0.08);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.3), body);
  rail.position.set(0, 0.06, -0.28);
  model.add(receiver, barrel, brake, magazine, foregrip, stock, sight, rail);
  model.scale.setScalar(1.15);
  model.position.set(0.28, -0.25, -0.46);
  camera.add(model);

  // Star-shaped muzzle flash: a canvas-drawn 4-point star, additive, so the
  // shot reads as a burst of light even in a still screenshot.
  function starTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 64);
    g.fillStyle = '#ffd23e';
    g.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      const r = i % 2 === 0 ? 62 : 14;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 0, 16, 0, Math.PI * 2);
    g.fill();
    const texture = new THREE.CanvasTexture(c);
    return texture;
  }
  // The star must read against a bright sunset yard, so it draws on top of
  // the world (like a real view-model flash) and is bigger than the v1 flash.
  // Normal blending, not additive: an additive star vanishes against the
  // bright orange walls and the white smoke, a solid yellow star reads on
  // any background.
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: starTexture(), transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.28, -0.22, -1.0);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 6);
  flashLight.position.set(0.28, -0.2, -0.7);
  camera.add(flashLight);

  const state = { id: 'p9', def: WEAPONS.p9, mag: WEAPONS.p9.mag, reserve: WEAPONS.p9.reserve, cooldown: 0, reloadLeft: 0, flash: 0, kick: 0 };

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);
    model.position.z = -0.46 + state.kick;
    model.rotation.x = state.kick * 2.2;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 22 : 0;
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
      state.flash = 0.2;
      state.kick = state.id === 'awp' ? 0.12 : 0.055;
      // Show the flash immediately: in the screenshot the frame loop may not
      // run another fixed step before the capture, and step() is the only
      // other place that sets flash.visible — without this the star never
      // appears in a captured frame.
      flash.visible = true;
      flashLight.intensity = 22;
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
