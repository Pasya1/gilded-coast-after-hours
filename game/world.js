import * as THREE from './vendor/three.min.js';
import { randomGenerator, roadsX, roadsZ } from './math.js';
import { material } from './actors.js';

class CityGeometry {
  constructor(scene) { this.scene = scene; this.batches = new Map(); this.dummy = new THREE.Object3D(); this.obstacles = []; this.buildings = []; }
  add(shape, color, scale, position, rotation = [0, 0, 0], extra = {}) {
    const key = shape + color + JSON.stringify(extra);
    if (!this.batches.has(key)) this.batches.set(key, { shape, color, extra, items: [] });
    this.batches.get(key).items.push({ scale, position, rotation });
  }
  box(color, w, h, d, x, y, z, extra) { this.add('box', color, [w, h, d], [x, y, z], [0, 0, 0], extra); }
  finish() {
    const shapes = { box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(0.5, 0.55, 1, 7), cone: new THREE.ConeGeometry(0.5, 1, 7), sphere: new THREE.SphereGeometry(0.5, 8, 6) };
    for (const batch of this.batches.values()) {
      const mesh = new THREE.InstancedMesh(shapes[batch.shape], material(batch.color, batch.extra), batch.items.length);
      batch.items.forEach((item, i) => { this.dummy.position.set(...item.position); this.dummy.scale.set(...item.scale); this.dummy.rotation.set(...item.rotation); this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix); });
      mesh.receiveShadow = true; mesh.castShadow = batch.color !== '#ffedba' && batch.color !== '#fff1c5'; mesh.computeBoundingSphere(); this.scene.add(mesh);
    }
  }
}

export function textSign(scene, text, x, y, z, width = 12, color = '#fff0c7', background = '#254b4c', rotation = 0) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = color; ctx.font = 'bold 50px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 65, 470);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, emissive: '#fff3c7', emissiveIntensity: 0.12, side: THREE.DoubleSide }));
  mesh.position.set(x, y, z); mesh.rotation.y = rotation; scene.add(mesh); return mesh;
}

export function createCoastalCity(scene) {
  const city = new CityGeometry(scene), rng = randomGenerator(68018);
  const palette = ['#d89c85', '#f0c6a0', '#e2b3a0', '#d78683', '#d5c4a1', '#b2c1b0', '#e3ba81'];
  const obstacles = city.obstacles;
  city.box('#87aa9c', 440, 1.5, 455, -39, -1.4, 0);
  city.box('#e8c99b', 350, 0.7, 384, -23, -0.35, 0);
  city.box('#f1d6a2', 38, 0.1, 389, 130, 0.04, 0);
  city.box('#e3c8a3', 23, 0.18, 385, 108, 0.08, 0);
  city.box('#c0b390', 2, 0.23, 385, 119, 0.12, 0);
  // All of the city roads form one connected, drivable grid.
  for (const x of roadsX) city.box('#58666a', 15, 0.12, 367, x, 0.06, 0);
  for (const z of roadsZ) city.box('#58666a', 330, 0.14, 15, -22, 0.08, z);
  for (const x of roadsX) for (let z = -178; z < 180; z += 7) {
    if (roadsZ.some(r => Math.abs(r - z) < 11)) continue;
    city.box('#e6c684', 0.13, 0.025, 3.3, x - 0.16, 0.17, z); city.box('#e6c684', 0.13, 0.025, 3.3, x + 0.16, 0.17, z);
    city.box('#d8d4bb', 0.14, 0.025, 5, x - 6.1, 0.17, z); city.box('#d8d4bb', 0.14, 0.025, 5, x + 6.1, 0.17, z);
  }
  for (const z of roadsZ) for (let x = -176; x < 143; x += 7) {
    if (roadsX.some(r => Math.abs(r - x) < 11)) continue;
    city.box('#e6c684', 3.3, 0.025, 0.16, x, 0.18, z);
  }
  for (const x of roadsX) for (const z of roadsZ) {
    for (let i = -3; i <= 3; i++) {
      city.box('#e5dfc8', 0.8, 0.025, 3, x + i * 1.5, 0.2, z + 9);
      city.box('#e5dfc8', 3, 0.025, 0.8, x + 9, 0.2, z + i * 1.5);
    }
  }

  function palm(x, z, height = 9) {
    city.add('cylinder', '#a88767', [0.72, height, 0.72], [x, height / 2, z], [0.05, 0, -0.07]);
    city.add('sphere', '#628662', [2.4, 1.4, 2.4], [x - 0.3, height, z]);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      city.add('cone', i % 2 ? '#5f946d' : '#447b61', [1.9, 6.5, 0.42], [x + Math.cos(a) * 2.5, height - 0.15, z + Math.sin(a) * 2.5], [Math.sin(a) * 1.38, 0, -Math.cos(a) * 1.38]);
    }
    city.box('#c4b697', 2.6, 0.25, 2.6, x, 0.16, z);
  }
  function lamp(x, z) {
    city.box('#536969', 0.18, 6.3, 0.18, x, 3.15, z);
    city.box('#536969', 1.8, 0.16, 0.16, x + 0.7, 6.25, z);
    city.box('#fff1c5', 1, 0.17, 0.5, x + 1.1, 6.14, z, { emissive: '#ffe1a0', emissiveIntensity: 0.8 });
  }
  function building(x, z, w, d, h, color, name) {
    obstacles.push({ x, z, w, d }); city.buildings.push({ x, z, w, d, h, color });
    city.box(color, w, h, d, x, h / 2 + 0.3, z);
    city.box('#f6d9b7', w + 0.6, 0.52, d + 0.6, x, h + 0.4, z);
    city.box('#c09a7f', w + 0.2, 0.5, d + 0.2, x, 0.35, z);
    city.box('#a9b2a2', 3, 1.1, 3.4, x + w / 4, h + 1.1, z - d / 5);
    for (let y = 3; y < h - 1; y += 3.8) {
      for (let xx = -w / 2 + 2.5; xx < w / 2 - 1; xx += 4) {
        const lit = rng() > 0.7, c = lit ? '#eed8a0' : '#56868a';
        city.box(c, 1.8, 1.9, 0.09, x + xx, y, z + d / 2 + 0.06, lit ? { emissive: '#ffc77b', emissiveIntensity: 0.2 } : undefined);
        city.box('#56868a', 1.8, 1.9, 0.09, x + xx, y, z - d / 2 - 0.06);
      }
      for (let zz = -d / 2 + 2.5; zz < d / 2 - 1; zz += 4) {
        city.box('#56868a', 0.09, 1.9, 1.8, x + w / 2 + 0.06, y, z + zz);
        city.box('#56868a', 0.09, 1.9, 1.8, x - w / 2 - 0.06, y, z + zz);
      }
    }
    city.box('#376d6c', w * 0.8, 0.25, 3, x, 3.15, z + d / 2 + 1.3);
    city.box('#315b60', 2, 2.8, 0.12, x + 2, 1.65, z + d / 2 + 0.08);
    if (name) textSign(scene, name, x, Math.min(5.2, h - 1), z + d / 2 + 0.14, Math.min(w * 0.8, 17));
  }

  const shops = ['CITRUS CLUB', 'LAGO APARTMENTS', 'COASTAL RECORDS', 'LATE CHECKOUT', 'PALM HOTEL', 'SALT & SUN', 'ORBIT CINEMA', 'MARÉ MARKET'];
  for (const x of [-120, -60, 0, 60]) for (const z of [-120, -60, 0, 60, 120]) {
    city.box('#d3be9f', 45, 0.3, 45, x, 0.17, z);
    if (x === 60 && z === 60) {
      building(61, 61, 31, 23, 7.4, '#e69987', 'MOONROOM');
      for (let stripe = 0; stripe < 10; stripe++) city.box(stripe % 2 ? '#edd4ad' : '#4d8d83', 2.9, 0.35, 4, 47.95 + stripe * 2.9, 3.3, 75);
      for (const xx of [50, 56, 66, 72]) { city.box('#56868a', 4.6, 2.3, 0.12, xx, 1.6, 72.65); city.box('#e8cb9e', 0.12, 2.4, 0.16, xx, 1.6, 72.72); }
      for (const xx of [52, 63]) { city.add('cylinder', '#986f52', [1.8, 0.16, 1.8], [xx, 1.1, 79]); city.box('#6b7d6a', 0.12, 1, 0.12, xx, 0.5, 79); city.box('#b18d68', 1.2, 0.13, 0.6, xx - 1.4, 0.65, 79); }
      textSign(scene, 'DINER / OPEN LATE', 61, 1.7, 72.8, 8, '#f0c478');
    }
    else if (x === -120 && z === -60) { building(-129, -52, 29, 26, 8.5, '#91ad9f', 'IVO’S MOTOR WORKS'); city.box('#526d6d', 10, 4, 0.2, -130, 2.3, -38.8); }
    else if (x === -60 && z === 60) { building(-56, 57, 28, 23, 12, '#bf9f99', 'WEST RELAY'); city.box('#344950', 2.2, 1.6, 1.4, -77, 1.1, 77); city.box('#7de3cb', 1.4, 0.7, 0.1, -77, 1.4, 77.8, { emissive: '#3fffd0', emissiveIntensity: 1 }); }
    else if (x === -120 && z === 120) { building(-124, 122, 30, 27, 8.5, '#dec996', 'CASA TRANQUILA'); palm(-104, 138, 8); }
    else if (x === 0 && z === 0) {
      city.box('#91ab7e', 42, 0.15, 42, 0, 0.35, 0); city.box('#d9c69e', 44, 0.08, 4, 0, 0.48, 0); city.box('#d9c69e', 4, 0.08, 44, 0, 0.48, 0);
      city.add('cylinder', '#d6c5a0', [13, 0.9, 13], [0, 0.8, 0]); city.add('cylinder', '#62b5af', [11, 0.16, 11], [0, 1.3, 0]);
      city.add('sphere', '#e6d1a7', [2, 3.8, 2], [0, 2.5, 0]); for (const a of [-1, 1]) for (const b of [-1, 1]) palm(a * 14, b * 14, 10);
      textSign(scene, 'SOLSTICE SQUARE', 0, 2.2, 19, 15);
    } else {
      const color = palette[Math.floor(rng() * palette.length)], tall = z < -40 && x < 50;
      const h = tall ? 15 + Math.floor(rng() * 5) * 4 : 7 + Math.floor(rng() * 3) * 3.8;
      building(x - 5, z - 4, 24 + rng() * 9, 24 + rng() * 8, h, color, shops[Math.floor(rng() * shops.length)]);
      if (rng() > 0.45) building(x + 13, z + 12, 9, 10, 5.6, palette[Math.floor(rng() * palette.length)]);
      palm(x - 18, z + 18, 7 + rng() * 3);
    }
  }

  // Coast promenade, beach clubs, a working harbor, and the independent radio pier.
  for (let z = -174; z < 181; z += 24) { palm(109, z, 9 + rng() * 3); lamp(101, z + 11); }
  for (let z = -170; z < 180; z += 40) {
    city.box('#866c57', 3.4, 0.22, 0.65, 116, 0.7, z); city.box('#55716b', 0.18, 0.7, 0.6, 114.8, 0.35, z); city.box('#55716b', 0.18, 0.7, 0.6, 117.2, 0.35, z);
    if (z > -100) { city.add('cone', z % 80 === 10 ? '#eaa494' : '#f0ddae', [5.5, 1.4, 5.5], [134, 3.3, z + 6]); city.box('#ac8c65', 0.15, 3.1, 0.15, 134, 1.6, z + 6); city.box('#e5c4a3', 2, 0.4, 3.8, 130, 0.4, z + 7); }
  }
  city.box('#b5b5a0', 42, 0.45, 64, 126, 0.15, -148);
  for (const p of [{ x: 113, z: -168 }, { x: 134, z: -168 }, { x: 136, z: -130 }]) {
    obstacles.push({ ...p, w: 7, d: 13 }); city.box(p.x === 113 ? '#b8755f' : '#648f94', 7, 4.6, 13, p.x, 2.6, p.z);
    for (let zz = -5; zz <= 5; zz += 1.7) city.box('#a1b3aa', 7.05, 0.09, 0.08, p.x, 4.93, p.z + zz);
  }
  city.box('#8c8372', 70, 0.5, 10, 155, 0.35, -151);
  city.box('#a49b82', 47, 0.4, 12, 146, 0.3, 29);
  city.box('#355c65', 9, 5, 10, 135, 2.8, 16); textSign(scene, 'AFTER HOURS / 88.4', 135, 4.3, 21.1, 12, '#f7d591', '#304857');
  city.box('#c2c9bc', 0.35, 21, 0.35, 137, 12, 15);
  for (let y = 8; y < 23; y += 4) city.box('#d4d0b7', 5 - y / 7, 0.1, 0.2, 137, y, 15);
  city.add('sphere', '#ffb280', [0.7, 0.7, 0.7], [137, 23, 15], [0, 0, 0], { emissive: '#ff4422', emissiveIntensity: 2 });
  textSign(scene, 'PIER 8', 120, 5.5, -122, 10);
  // Skyline and terraced hills frame the city without enclosing playable streets.
  for (let i = 0; i < 22; i++) {
    const x = -205 + i * 17, h = 15 + rng() * 45;
    city.box(i % 2 ? '#bbaa9f' : '#c3b4a8', 12 + rng() * 12, h, 17, x, h / 2, -238 - rng() * 55);
  }
  for (let i = 0; i < 13; i++) city.add('cone', i % 2 ? '#789181' : '#91a18a', [110, 40 + rng() * 60, 100], [-245 - rng() * 40, 8, -250 + i * 43], [0, rng() * 3, 0]);
  for (const x of roadsX) for (const z of roadsZ) { lamp(x - 10, z - 12); if (rng() > 0.5) city.box('#50877c', 1.3, 1.6, 1.3, x + 11, 0.9, z - 15); }
  for (let i = 0; i < 40; i++) {
    const x = -172 + rng() * 273, z = roadsZ[i % 6] + 11;
    city.box('#bba58a', 0.8, 0.7, 1, x, 0.55, z); city.box('#e9bc69', 0.4, 0.1, 0.4, x, 0.95, z);
  }
  city.finish();

  const water = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1800, 1, 1), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, fogColor: { value: new THREE.Color('#dbc7af') } },
    vertexShader: 'varying vec3 p; void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: 'uniform float time; uniform vec3 fogColor; varying vec3 p; void main(){float wave=sin(p.z*.63+p.x*.2+time*.8)*sin(p.x*.23-time*.5);float foam=pow(max(0.,sin(p.z*1.3+p.x*.4+time)),20.)*.13;vec3 c=mix(vec3(.16,.51,.52),vec3(.37,.68,.65),wave*.25+.5)+foam;float haze=smoothstep(200.,850.,distance(p,cameraPosition));gl_FragColor=vec4(mix(c,fogColor,haze),1.);}'
  })); water.rotation.x = -Math.PI / 2; water.position.set(899, -0.45, 0); scene.add(water);
  // Simple original boats are made from geometry, never downloaded assets.
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1, 10), material(i % 2 ? '#e8dcc2' : '#d2876e')); hull.position.y = 0.2; boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.5, 3.8), material('#fff0d0')); cabin.position.set(0, 1.3, 1); boat.add(cabin); boat.position.set(165 + i % 2 * 17, 0, -170 + i * 32); scene.add(boat);
  }
  return { obstacles, buildings: city.buildings, water, update(time) { water.material.uniforms.time.value = time; } };
}
