import * as THREE from './vendor/three.min.js';
import { randomGenerator, roadsX, roadsZ } from './math.js';

const materials = new Map();
export function material(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra }));
  return materials.get(key);
}
const cube = new THREE.BoxGeometry(1, 1, 1);
const tire = new THREE.CylinderGeometry(0.42, 0.42, 0.29, 12);
const hubGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.31, 8);
function part(group, color, size, position, extra = {}) {
  const mesh = new THREE.Mesh(cube, material(color, extra)); mesh.scale.set(...size); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}

export function createCarMesh(color = '#e7ad47', type = 'coupe', police = false) {
  const group = new THREE.Group(), van = type === 'van', sport = type === 'coupe';
  part(group, police ? '#eeeade' : color, [2.25, 0.62, van ? 5.2 : 4.6], [0, 0.78, 0]);
  part(group, '#27383a', [2.15, 0.23, 4.5], [0, 0.42, 0]);
  part(group, police ? '#203b50' : color, [1.95, van ? 1.32 : 0.7, van ? 3.7 : 2.15], [0, van ? 1.55 : 1.43, van ? 0.3 : 0.2]);
  part(group, '#8ac2c1', [1.82, van ? 0.72 : 0.53, van ? 3.5 : 2.12], [0, van ? 1.62 : 1.45, van ? 0.26 : 0.15], { metalness: 0.25, roughness: 0.18 });
  part(group, police ? '#eeeade' : color, [1.97, 0.16, van ? 3.72 : 2.18], [0, van ? 2.27 : 1.85, van ? 0.3 : 0.2]);
  part(group, police ? '#243b50' : color, [2.02, 0.18, 1.25], [0, 1.08, -1.47]);
  if (sport) { part(group, '#222f35', [0.19, 0.035, 3.9], [-0.37, 1.18, -0.1]); part(group, '#222f35', [0.19, 0.035, 3.9], [0.37, 1.18, -0.1]); }
  part(group, '#d1d3c7', [2.32, 0.18, 0.16], [0, 0.62, -2.3]);
  part(group, '#34454b', [2.32, 0.18, 0.16], [0, 0.62, 2.3]);
  for (const x of [-0.77, 0.77]) {
    part(group, '#fff0c1', [0.52, 0.19, 0.07], [x, 0.9, -2.33], { emissive: '#ffce74', emissiveIntensity: 0.7 });
    part(group, '#e55d52', [0.5, 0.18, 0.07], [x, 0.9, 2.33], { emissive: '#ff4238', emissiveIntensity: 0.4 });
  }
  const wheels = [];
  for (const x of [-1.13, 1.13]) for (const z of [-1.4, 1.4]) {
    const wheel = new THREE.Mesh(tire, material('#20292c')); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.43, z); wheel.castShadow = true; group.add(wheel); wheels.push(wheel);
    const hub = new THREE.Mesh(hubGeometry, material('#a1aba6', { metalness: 0.4 })); hub.rotation.z = Math.PI / 2; hub.position.copy(wheel.position); group.add(hub);
  }
  if (police) {
    part(group, '#193e58', [2.27, 0.24, 2.7], [0, 0.88, 0.2]);
    part(group, '#202a35', [1.55, 0.12, 0.45], [0, 1.99, 0]);
    group.userData.lights = [part(group, '#ff4c4c', [0.63, 0.22, 0.4], [-0.4, 2.13, 0], { emissive: '#ff1515', emissiveIntensity: 2 }), part(group, '#55a7ff', [0.63, 0.22, 0.4], [0.4, 2.13, 0], { emissive: '#126aff', emissiveIntensity: 2 })];
  }
  group.userData.wheels = wheels;
  return group;
}

export function createPersonMesh(color = '#30aa9d', player = false) {
  const group = new THREE.Group();
  const torso = part(group, color, [0.7, 0.77, 0.36], [0, 1.23, 0]);
  part(group, '#c88d6e', [0.42, 0.45, 0.4], [0, 1.88, 0]);
  part(group, '#283135', [0.44, 0.16, 0.42], [0, 2.1, 0.025]);
  const left = part(group, player ? '#e2d8ba' : '#354451', [0.26, 0.72, 0.28], [-0.2, 0.48, 0]);
  const right = part(group, player ? '#e2d8ba' : '#354451', [0.26, 0.72, 0.28], [0.2, 0.48, 0]);
  const armL = part(group, color, [0.23, 0.69, 0.27], [-0.48, 1.19, 0]);
  const armR = part(group, color, [0.23, 0.69, 0.27], [0.48, 1.19, 0]);
  const gun = part(group, '#29383c', [0.14, 0.15, 0.57], [0.49, 1.18, -0.5]); gun.visible = player;
  group.userData = { left, right, armL, armR, torso, gun };
  if (player) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.86, 32), new THREE.MeshBasicMaterial({ color: '#c0fff0', side: THREE.DoubleSide, transparent: true, opacity: 0.78 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; group.add(ring);
  }
  return group;
}

export function animatePerson(mesh, walk, time, armed = false) {
  const d = mesh.userData, step = Math.sin(time * 10) * (walk ? 0.55 : 0);
  d.left.rotation.x = step; d.right.rotation.x = -step;
  d.armL.rotation.x = -step * 0.7; d.armR.rotation.x = armed ? -0.9 : step * 0.7;
  d.gun.visible = armed;
}

const statusTextures = new Map();
export function createActorLabel(text, color = '#f2a08b') {
  const key = text + color;
  if (!statusTextures.has(key)) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#16313ae6'; ctx.fillRect(0, 8, 256, 48);
    ctx.fillStyle = color; ctx.font = 'bold 23px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; statusTextures.set(key, texture);
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: statusTextures.get(key), depthTest: false, transparent: true })); sprite.position.y = 3.4; sprite.scale.set(5.6, 1.4, 1); return sprite;
}

export function createPopulation(scene) {
  const random = randomGenerator(1432), cars = [], pedestrians = [];
  const colors = ['#d77d65', '#56a9a2', '#ead5ab', '#f0b64b', '#667f9f', '#c1bf9b', '#493f58', '#dbdacc'];
  function addCar(x, z, color, type, angle = 0, traffic = false) {
    const mesh = createCarMesh(color, type); mesh.position.set(x, 0.05, z); mesh.rotation.y = -angle; scene.add(mesh);
    const car = { id: cars.length, x, z, angle, speed: 0, health: 100, maxSpeed: type === 'coupe' ? 43 : type === 'van' ? 28 : 35, acceleration: type === 'coupe' ? 18 : 14, color, type, traffic, mesh, occupied: false, stolen: false, turnWait: 0, lastIntersection: '', axis: 'z', dir: 1 };
    cars.push(car); return car;
  }
  const getaway = addCar(96, 77, '#e9b74b', 'coupe', 0);
  for (let i = 0; i < 13; i++) {
    const x = roadsX[i % roadsX.length] + (i % 2 ? 5.5 : -5.5), z = -127 + Math.floor(i / roadsX.length) * 113 + random() * 14;
    addCar(x, z, colors[i % colors.length], i % 5 === 0 ? 'van' : i % 3 === 0 ? 'coupe' : 'sedan', i % 2 ? 0 : Math.PI);
  }
  for (let i = 0; i < 13; i++) {
    const axis = i % 2 ? 'x' : 'z', dir = i % 4 < 2 ? 1 : -1;
    const x = axis === 'z' ? roadsX[i % 5] + dir * 3 : -160 + random() * 310;
    const z = axis === 'x' ? roadsZ[i % 6] - dir * 3 : -170 + random() * 330;
    const angle = axis === 'z' ? dir > 0 ? Math.PI : 0 : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const c = addCar(x, z, colors[(i + 4) % colors.length], i % 5 === 0 ? 'van' : 'sedan', angle, true);
    c.axis = axis; c.dir = dir; c.speed = 9 + random() * 4; c.cruise = c.speed;
  }
  for (let i = 0; i < 36; i++) {
    const bx = [-120, -60, 0, 60][i % 4], bz = [-120, -60, 0, 60, 120][Math.floor(i / 4) % 5];
    const waypoints = [{ x: bx - 19, z: bz - 19 }, { x: bx + 19, z: bz - 19 }, { x: bx + 19, z: bz + 19 }, { x: bx - 19, z: bz + 19 }];
    const index = i % 4, point = waypoints[index], mesh = createPersonMesh(colors[i % 8]); scene.add(mesh);
    pedestrians.push({ x: point.x, z: point.z, mesh, waypoint: (index + 1) % 4, waypoints, speed: 1.1 + random(), panic: 0, phase: random() * 10, down: 0 });
  }
  return { cars, pedestrians, getaway, addCar };
}
