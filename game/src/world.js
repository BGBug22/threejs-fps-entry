// Yard 7 "Emberline Works": a dusk industrial yard, 36 x 28 m, built from boxes and
// cylinders. Two bomb sites (A Foundry north-west, B Silos north-east), three lanes
// (west, mid, east) split by a mid wall with three gaps, and cover everywhere a
// firefight needs it. Every solid is a collider for players and bots and a surface
// a bullet stops on. Waypoints are the graph the bots walk.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const WAYPOINTS = [
  // x, z, links
  [0, 11.5, [1, 2, 5]], // 0 attacker spawn
  [-7, 8, [0, 3, 5]], // 1
  [7, 8, [0, 4, 5]], // 2
  [-14, 6, [1, 6, 14]], // 3 west lane south
  [14, 6, [2, 7, 15]], // 4 east lane south
  [0, 4, [0, 1, 2, 8]], // 5 mid south
  [-14, -5, [3, 9, 14]], // 6 west lane north
  [14, -5, [4, 10, 15]], // 7 east lane north
  [0, -5, [5, 8, 16, 17]], // 8 mid north
  [-12, -9, [6, 16, 11]], // 9 site A
  [12, -9, [7, 17, 12]], // 10 site B
  [-7, -11.5, [9, 13, 16]], // 11 defender west
  [7, -11.5, [10, 13, 17]], // 12 defender east
  [0, -11.5, [11, 12, 8]], // 13 defender mid
  [-14, 0, [3, 6]], // 14 west mid
  [14, 0, [4, 7]], // 15 east mid
  [-8, -9, [8, 9, 11]], // 16 A approach
  [8, -9, [8, 10, 12]], // 17 B approach
];

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const mats = {};
  for (const name of ['canvas', 'surface', 'hairline', 'ink', 'muted', 'accent', 'teal']) {
    mats[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'teal' ? 0.5 : 0.92,
      metalness: name === 'accent' || name === 'teal' ? 0.25 : 0.04,
    });
  }
  const rustMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a4a22'), roughness: 0.85, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2b211a'), roughness: 0.95, metalness: 0.05 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff7a1a'), emissive: new THREE.Color('#ff6a00'), emissiveIntensity: 2.2, roughness: 0.6,
  });

  const colliders = [];
  const shootables = [];

  function box(w, h, d, x, y, z, mat, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }
  function cylinder(rTop, rBottom, h, x, y, z, mat, segments = 18) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const half = Math.max(rTop, rBottom);
    colliders.push(new THREE.Box3(new THREE.Vector3(x - half, y - h / 2, z - half), new THREE.Vector3(x + half, y + h / 2, z + half)));
    shootables.push(mesh);
    return mesh;
  }

  // Floor and outer walls (open sky so the low sun reaches the yard).
  box(36.4, 0.4, 28.4, 0, -0.2, 0, darkMat);
  box(0.4, 5, 28.4, -18.2, 2.5, 0, mats.surface);
  box(0.4, 5, 28.4, 18.2, 2.5, 0, mats.surface);
  box(36.4, 5, 0.4, 0, 2.5, -14.2, mats.surface);
  box(36.4, 5, 0.4, 0, 2.5, 14.2, mats.surface);

  // Mid wall at z = -2 with three gaps: west [-14,-11], mid [-2,2], east [11,14].
  box(4, 4, 0.5, -16, 2, -2, mats.surface);
  box(9, 4, 0.5, -6.5, 2, -2, mats.surface);
  box(9, 4, 0.5, 6.5, 2, -2, mats.surface);
  box(4, 4, 0.5, 16, 2, -2, mats.surface);
  // Low wall caps over the mid gap so the lane reads as a doorway.
  box(4.4, 0.8, 0.6, 0, 4.2, -2, mats.hairline);

  // Site A "Foundry" (north-west): furnace with a glowing mouth, pipes, a low platform.
  box(4.2, 3.2, 2.2, -13.5, 1.6, -11.8, rustMat);
  const furnaceMouth = box(2.2, 1.1, 0.3, -13.5, 0.9, -10.6, glowMat, false);
  furnaceMouth.castShadow = false;
  cylinder(0.35, 0.35, 5.5, -15.2, 2.75, -12.4, darkMat);
  cylinder(0.35, 0.35, 4.6, -11.6, 2.3, -12.6, darkMat);
  box(4.5, 0.5, 3, -12, 0.25, -7.2, mats.hairline); // low platform (standable)
  box(1.2, 1.1, 1.2, -8.2, 0.55, -10.6, mats.hairline);

  // Site B "Silos" (north-east): three tall silos and a gantry beam.
  cylinder(1.5, 1.5, 5.2, 10.6, 2.6, -10.8, mats.surface);
  cylinder(1.5, 1.5, 5.2, 13.8, 2.6, -10.8, mats.surface);
  cylinder(1.5, 1.5, 4.4, 12.2, 2.2, -7.4, rustMat);
  box(5.6, 0.5, 0.5, 12.2, 5.4, -10.8, mats.hairline, false);
  box(1.2, 1.1, 1.2, 8.4, 0.55, -10.6, mats.hairline);

  // Cover: shipping containers and crates on the three lanes.
  box(6, 2.6, 2.4, -9, 1.3, 3.5, mats.teal);
  box(6, 2.6, 2.4, 9, 1.3, 3.5, rustMat);
  box(2.4, 2.6, 6, -15.6, 1.3, -6.5, mats.surface);
  box(2.4, 2.6, 6, 15.6, 1.3, -6.5, mats.surface);
  box(1.2, 1.2, 1.2, -4.5, 0.6, 6.5, mats.hairline);
  box(1.2, 1.2, 1.2, 4.5, 0.6, 6.5, mats.hairline);
  box(1.2, 1.2, 1.2, -3.4, 0.6, -5.4, mats.hairline);
  box(1.2, 1.2, 1.2, 3.4, 0.6, -5.4, mats.hairline);
  box(1.2, 2.4, 1.2, -0.0, 1.2, 8.8, mats.hairline);
  box(2.2, 0.9, 1.2, -6.5, 0.45, -11.6, mats.hairline);
  box(2.2, 0.9, 1.2, 6.5, 0.45, -11.6, mats.hairline);
  // Pillar mid-yard so the centre lane is not one open sightline.
  box(1.4, 3.4, 1.4, 0, 1.7, 0.5, mats.hairline);

  // Site markers: painted floor plates so each site reads at a glance.
  const plateA = new THREE.Mesh(new THREE.CircleGeometry(4.5, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.16 }));
  plateA.rotation.x = -Math.PI / 2;
  plateA.position.set(-12, 0.02, -9);
  group.add(plateA);
  const plateB = new THREE.Mesh(new THREE.CircleGeometry(4.5, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.teal), transparent: true, opacity: 0.16 }));
  plateB.rotation.x = -Math.PI / 2;
  plateB.position.set(12, 0.02, -9);
  group.add(plateB);

  // Light: a low warm sun from the west, a cool dusk fill, and a sky gradient.
  const sky = new THREE.HemisphereLight(new THREE.Color('#5a6b8a'), new THREE.Color('#2a1c12'), 1.25);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(new THREE.Color('#ffb45e'), 3.0);
  sun.position.set(-22, 12, 10);
  sun.target.position.set(4, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#4a6a8a'), 0.7);
  fill.position.set(10, 12, -12);
  scene.add(fill);
  const furnaceLight = new THREE.PointLight(new THREE.Color('#ff6a00'), 22, 14, 1.8);
  furnaceLight.position.set(-13.5, 1.4, -10.2);
  scene.add(furnaceLight);
  const siloLight = new THREE.PointLight(new THREE.Color('#39c2d7'), 10, 12, 1.8);
  siloLight.position.set(12.2, 4.5, -9);
  scene.add(siloLight);

  const waypoints = WAYPOINTS.map(([x, z, links]) => ({ p: new THREE.Vector3(x, 0, z), links }));

  return {
    colliders,
    shootables,
    group,
    waypoints,
    sites: {
      A: { center: new THREE.Vector3(-12, 0, -9), radius: 4.5, name: 'Foundry' },
      B: { center: new THREE.Vector3(12, 0, -9), radius: 4.5, name: 'Silos' },
    },
    spawns: {
      attack: [
        new THREE.Vector3(-5, 0, 11.5),
        new THREE.Vector3(-2.5, 0, 12.3),
        new THREE.Vector3(0, 0, 11.5),
        new THREE.Vector3(2.5, 0, 12.3),
        new THREE.Vector3(5, 0, 11.5),
      ],
      defend: [
        new THREE.Vector3(-6, 0, -11.5),
        new THREE.Vector3(-3, 0, -12.3),
        new THREE.Vector3(0, 0, -11.5),
        new THREE.Vector3(3, 0, -12.3),
        new THREE.Vector3(6, 0, -11.5),
      ],
    },
  };
}
