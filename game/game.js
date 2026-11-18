import * as THREE from './vendor/three.min.js';
import { createCoastalCity } from './world.js';
import { createPopulation, createPersonMesh, createCarMesh, createActorLabel, animatePerson, material } from './actors.js';
import { CoastAudio } from './audio.js';
import { CoastHUD, districtAt } from './hud.js';
import { CityNavigation } from './navigation.js';
import { clamp, lerp, distance, nearest, roadsX, roadsZ, angleDelta, moveWithCollisions, segmentBlocked, circleOverlapsBox, updateDrive } from './math.js';
import { places, newStory, missionView, advanceStory, startJob, storyJobs, objectiveInReach, dialogue } from './story.js';
import { SAVE_KEY, validSave, readSavedNight } from './persistence.js';

const scene = new THREE.Scene(); scene.background = new THREE.Color('#e1bca5'); scene.fog = new THREE.Fog('#dfbdab', 135, 460);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
document.querySelector('#viewport').append(renderer.domElement);
scene.add(new THREE.HemisphereLight('#fff1d2', '#6d8e89', 1.9));
const sun = new THREE.DirectionalLight('#ffd8ae', 2.7); sun.position.set(-90, 130, 75); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -145; sun.shadow.camera.right = 145; sun.shadow.camera.top = 145; sun.shadow.camera.bottom = -145; sun.shadow.camera.far = 420; sun.shadow.normalBias = 0.08; sun.shadow.bias = -0.0002; scene.add(sun); scene.add(sun.target);
const world = createCoastalCity(scene), navigation = new CityNavigation(world.obstacles), population = createPopulation(scene);
const playerMesh = createPersonMesh('#35a79e', true); scene.add(playerMesh);
const mara = createPersonMesh('#f4d49e'); mara.position.set(places.mara.x - 1.1, 0.2, places.mara.z); mara.rotation.y = 0.5; scene.add(mara);
const audio = new CoastAudio();
const hud = new CoastHUD(handleAction);
const cops = [], guards = [], particles = [], supplies = [
  { x: 102, z: 111, cooldown: 0 }, { x: -141, z: -23, cooldown: 0 }, { x: -88, z: 142, cooldown: 0 }, { x: 36, z: -142, cooldown: 0 },
];
let state, checkpoint, currentCar = null, title = true, paused = false, failed = false;
let cameraZoom = 1, cameraTarget = new THREE.Vector3(91, 0, 80), mapFrame = 0;
let dialogueHide = 0, nextShot = 0, damageFlash = 0, interaction = null, zoomMode = false, hitmarker = 0;
const keys = new Set(), mouse = { x: innerWidth * 0.62, y: innerHeight * 0.53, down: false, inside: false };
const raycaster = new THREE.Raycaster(), mouseVector = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5), aimPoint = new THREE.Vector3();
const targetMarker = createObjectiveMarker(), supplyMarkers = supplies.map(s => createSupplyMarker(s));
const ledger = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 1.1), material('#e8b759', { metalness: 0.25 })); ledger.position.set(places.cache.x, 0.72, places.cache.z); scene.add(ledger);

function freshState(mode = 'story') {
  return { mode, player: { x: 99, z: 87, angle: 0, health: 100 }, money: 250, ammo: 12, reserve: 96, reloading: 0, wanted: 0, heat: 0, seen: false, lastKnown: null, arrest: 0, time: 0, story: newStory(), challenge: { time: 0, won: false }, kills: 0, stolen: 0 };
}
state = freshState();

function createObjectiveMarker() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.12, 6, 64), new THREE.MeshBasicMaterial({ color: '#ffd87c', transparent: true, opacity: 0.85 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.22; group.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 6, 40, 1, true), new THREE.MeshBasicMaterial({ color: '#ffdb91', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 3.1; group.add(beam);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), new THREE.MeshStandardMaterial({ color: '#ffe5a4', emissive: '#ffc54c', emissiveIntensity: 0.6, roughness: 0.4 })); diamond.position.y = 5.5; group.add(diamond); group.userData = { ring, diamond, beam }; scene.add(group); return group;
}
function createSupplyMarker(supply) {
  const group = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: '#85e3ce' });
  const a = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.35), m), b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.7, 0.35), m); group.add(a, b); group.position.set(supply.x, 2.7, supply.z); scene.add(group); return group;
}

function carById(id) { return population.cars.find(c => c.id === id && c.health > 0); }
function vehicle() { return currentCar; }
function showDialogue(key) { if (dialogue[key]) hud.say(...dialogue[key]); }
function clearCops() { for (const cop of cops) { scene.remove(cop.mesh); scene.remove(cop.officer); } cops.length = 0; }
function clearGuards() { for (const guard of guards) scene.remove(guard.mesh); guards.length = 0; }
function resetCars() {
  for (const c of population.cars) {
    if (c.initial) Object.assign(c, c.initial);
    else c.initial = { x: c.x, z: c.z, angle: c.angle, traffic: c.traffic, axis: c.axis, dir: c.dir, speed: c.speed };
    c.health = 100; c.occupied = false; c.stolen = false; c.mesh.visible = true;
  }
}
resetCars();

function serialize() {
  return { version: 1, state: structuredClone(state), carId: currentCar?.id ?? null, cars: population.cars.map(c => ({ id: c.id, x: c.x, z: c.z, angle: c.angle, health: clamp(c.health, 0, 100), stolen: c.stolen, traffic: c.traffic })), guards: guards.map(g => g.health) };
}
function readSave() { try { return readSavedNight(localStorage); } catch { return null; } }
function saveGame(notify = true) {
  if (title || failed) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); hud.el.continue.disabled = false; if (notify) hud.toast('NIGHT SAVED / Your place on the coast is safe.'); }
  catch { if (notify) hud.toast('This browser could not save. Checkpoints still work this session.'); }
}
function rememberCheckpoint() { checkpoint = serialize(); }
function restore(data, retry = false) {
  if (!validSave(data)) return false;
  resetCars(); clearCops(); clearGuards(); currentCar = null;
  state = structuredClone(data.state); state.reloading = 0; state.arrest = 0;
  nextShot = 0;
  state.player.health = retry ? 100 : clamp(state.player.health || 100, 1, 100);
  state.player.x = clamp(state.player.x, -175, 143); state.player.z = clamp(state.player.z, -178, 178);
  state.wanted = retry ? 0 : clamp(Math.floor(state.wanted || 0), 0, 5); state.heat = 12 + state.wanted * 4;
  state.ammo = retry ? 12 : clamp(state.ammo, 0, 12); state.reserve = Math.max(retry ? 72 : 0, state.reserve);
  for (const dataCar of data.cars) { const car = population.cars.find(c => c.id === dataCar.id); if (car) Object.assign(car, dataCar, { speed: 0, occupied: false, health: retry && dataCar.id === data.carId ? 100 : dataCar.health }); }
  if (data.carId !== null) { currentCar = carById(data.carId); if (currentCar) { currentCar.occupied = true; currentCar.traffic = false; state.player.x = currentCar.x; state.player.z = currentCar.z; } }
  if (state.story.job === 1 && !['interlude', 'ending'].includes(state.story.stage)) spawnGuards(data.guards);
  failed = false; title = false; paused = false; closePanels(); hud.show('start', false); hud.show('hud'); cameraTarget.set(state.player.x, 0, state.player.z);
  if (state.wanted) addPolice(); rememberCheckpoint(); return true;
}

function startMode(mode) {
  resetCars(); clearCops(); clearGuards(); currentCar = null; state = freshState(mode);
  nextShot = 0;
  title = false; failed = false; paused = false; closePanels(); hud.show('start', false); hud.show('hud'); audio.unlock();
  if (mode === 'pursuit') {
    const car = population.getaway; car.x = 90; car.z = 43; car.angle = 0; currentCar = car; car.occupied = true; car.traffic = false; car.stolen = true;
    state.player.x = car.x; state.player.z = car.z; raiseWanted(3); addPolice(); addPolice();
    hud.say('COAST RUNNER / RADIO', 'The bridge is watched. Stay alive for ninety seconds, then disappear. You have the fastest car on the coast. Make it count.', 8);
  } else if (mode === 'story') hud.say('MARA / 88.4 FM', 'You made it. I am outside the Moonroom diner. Look for the gold ring. There is something you need to see.', 8);
  else hud.toast('YOUR NIGHT / F to borrow a car. Tab for the story radio.', 5);
  cameraTarget.set(state.player.x, 0, state.player.z); rememberCheckpoint();
}

function closePanels() { for (const id of ['pause', 'radio', 'help', 'map-modal', 'failure', 'ending']) hud.show(id, false); keys.clear(); mouse.down = false; }
function togglePanel(id) {
  const wasOpen = !hud.el[id].hidden; closePanels();
  if (!wasOpen) { hud.show(id); paused = true; if (id === 'radio') hud.jobs(state.story); }
  else paused = false;
}
function handleAction(action, value) {
  audio.unlock(); audio.effect('ui');
  if (['story', 'roam', 'pursuit'].includes(action)) return startMode(action);
  if (action === 'continue') { if (!restore(readSave())) hud.toast('No usable save was found. Start a new night.'); return; }
  if (action === 'resume') { closePanels(); paused = false; }
  if (action === 'save') saveGame();
  if (action === 'help') togglePanel('help');
  if (action === 'radio' && !title) togglePanel('radio');
  if (action === 'mute') { const muted = audio.toggle(); hud.el['start-audio'].textContent = muted ? 'Sound off ♩' : 'Sound on ♪'; hud.toast(muted ? 'AUDIO MUTED' : 'AUDIO ON'); }
  if (['close-help', 'close-radio', 'close-map', 'close-ending'].includes(action)) { closePanels(); paused = false; }
  if (action === 'retry') { if (state.mode === 'pursuit') startMode('pursuit'); else if (checkpoint) { restore(checkpoint, true); hud.toast('CHECKPOINT RESTORED / A second chance.'); } else startMode(state.mode); }
  if (action === 'title') { closePanels(); title = true; paused = false; hud.show('hud', false); hud.show('start'); hud.el.continue.disabled = !readSave(); }
  if (action === 'job') {
    const job = Number(value); if (job < 0 || job > state.story.completed || job > 2) return;
    state.mode = 'story'; state.story = startJob(state.story, job); clearGuards(); if (job === 1) spawnGuards();
    closePanels(); paused = false; hud.say(job === 1 ? 'IVO / RADIO' : 'MARA / RADIO', storyJobs[job].briefing, 10); rememberCheckpoint();
  }
}

window.addEventListener('keydown', e => {
  if (['Tab', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  const key = e.key.toLowerCase(); if (e.repeat) { keys.add(key); return; }
  audio.unlock();
  if (key === 'escape') {
    if (failed) return;
    const panel = ['help', 'radio', 'map-modal', 'ending'].some(id => !hud.el[id].hidden);
    if (panel) { closePanels(); paused = false; } else if (!title) togglePanel('pause'); return;
  }
  if (key === 'h') return handleAction('help');
  if (key === 'n') return handleAction('mute');
  if (title || failed) return;
  if (key === 'tab') return togglePanel('radio');
  if (key === 'm') return togglePanel('map-modal');
  if (key === 'k') return saveGame();
  if (key === 'c') { zoomMode = !zoomMode; cameraZoom = zoomMode ? 0.72 : 1; }
  if (paused) return;
  if (key === 'f') interact();
  if (key === 'r') reload();
  keys.add(key);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); mouse.down = false; if (!title && !failed && !paused) togglePanel('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); mouse.down = false; if (!title && !failed && !paused) togglePanel('pause'); } });
renderer.domElement.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; });
renderer.domElement.addEventListener('mouseleave', () => { mouse.inside = false; mouse.down = false; });
renderer.domElement.addEventListener('mousedown', e => { audio.unlock(); if (e.button === 0 && !title && !paused) mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); cameraZoom = clamp(cameraZoom + e.deltaY * 0.001, 0.68, 1.5); }, { passive: false });
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function findInteraction() {
  const view = missionView(state.story, state.mode, state.challenge);
  if (view.target && objectiveInReach(view, state.player) && !currentCar && !['car', 'relay', 'route'].includes(state.story.stage)) return { type: 'mission', label: state.story.stage === 'meet' ? 'Talk to Mara' : state.story.stage === 'cache' ? 'Take the harbor ledger' : state.story.stage === 'transmitter' ? 'Take the transmitter' : state.story.stage === 'broadcast' ? 'Broadcast the evidence' : state.wanted ? 'Lose the police before the handover' : 'Hand over the evidence' };
  if (currentCar) {
    if (distance(currentCar, places.garage) < 7 && Math.abs(currentCar.speed) < 1.5 && currentCar.health < 95 && state.money >= 150) return { type: 'repair', label: 'Ivo’s garage / repair this vehicle / $150' };
    return { type: 'exit', label: Math.abs(currentCar.speed) > 8 ? 'Bail out of vehicle' : 'Exit vehicle' };
  }
  const supply = supplies.find(s => distance(s, state.player) < 3.6);
  if (supply) return { type: 'supply', supply, label: supply.cooldown > 0 ? `Supplies restocking / ${Math.ceil(supply.cooldown)}s` : 'Restock health + ammunition' };
  let closest = null, range = 4.5;
  for (const car of population.cars) { const d = distance(car, state.player); if (car.health > 0 && d < range) { closest = car; range = d; } }
  if (closest) return { type: 'enter', car: closest, label: `${closest.stolen ? 'Enter' : 'Borrow'} ${closest.type === 'coupe' ? 'Sunbird GT' : closest.type === 'van' ? 'Harborline van' : 'Caldera sedan'}` };
  return null;
}
function interact() {
  interaction = findInteraction(); if (!interaction) return;
  if (interaction.type === 'exit') return exitCar();
  if (interaction.type === 'repair') {
    if (state.money < 150) return hud.toast('Ivo needs $150 for the parts. Complete jobs to earn money.');
    state.money -= 150; currentCar.health = 100; audio.effect('reward'); hud.toast('MOTOR WORKS / Vehicle repaired. −$150'); return;
  }
  if (interaction.type === 'enter') {
    const car = interaction.car;
    if (Math.abs(car.speed) > 8) { hud.toast('Wait for the vehicle to slow down.'); return; }
    car.occupied = true; car.traffic = false; currentCar = car; state.player.x = car.x; state.player.z = car.z;
    if (!car.stolen) { car.stolen = true; state.stolen++; raiseWanted(1); hud.toast('VEHICLE BORROWED / Its owner called the coast patrol.'); }
    audio.effect('enter'); if (state.mode === 'story' && state.story.stage === 'car' && car.id === population.getaway.id) progressStory('coupe'); return;
  }
  if (interaction.type === 'supply') {
    if (interaction.supply.cooldown > 0) return;
    state.player.health = 100; state.ammo = 12; state.reserve = 120; interaction.supply.cooldown = 30; audio.effect('reward'); hud.toast('RESTOCKED / Health + ammunition'); return;
  }
  if (interaction.type === 'mission') {
    const stage = state.story.stage;
    if (stage === 'meet') progressStory('talk');
    if (stage === 'cache') { progressStory('ledger'); raiseWanted(2); addPolice(); }
    if (stage === 'deliver' || stage === 'safe') { if (state.wanted) hud.toast('No police at the handover. Lose your tail first.'); else progressStory('handover'); }
    if (stage === 'transmitter') { progressStory('take'); raiseWanted(3); }
    if (stage === 'broadcast') progressStory('broadcast');
  }
}
function exitCar() {
  if (!currentCar) return;
  const car = currentCar, options = [
    { x: car.x + Math.cos(car.angle) * 2.3, z: car.z + Math.sin(car.angle) * 2.3 },
    { x: car.x - Math.cos(car.angle) * 2.3, z: car.z - Math.sin(car.angle) * 2.3 },
    { x: car.x - Math.sin(car.angle) * 3.7, z: car.z + Math.cos(car.angle) * 3.7 },
  ];
  const spot = options.find(p => !world.obstacles.some(b => circleOverlapsBox(p.x, p.z, 0.7, b)) && p.x > -178 && p.x < 146 && p.z > -181 && p.z < 182);
  if (!spot) { hud.toast('The door is blocked. Move the vehicle.'); return; }
  currentCar = null; car.occupied = false; state.player.x = spot.x; state.player.z = spot.z;
  if (Math.abs(car.speed) > 12) damagePlayer(12); car.speed *= 0.5; audio.effect('enter');
}
function progressStory(event) {
  const before = state.story, after = advanceStory(before, event); if (after.stage === before.stage && after.checkpoint === before.checkpoint) return;
  state.story = after; audio.effect('ui'); if (dialogue[event]) showDialogue(event);
  if (after.stage === 'interlude') {
    const reward = storyJobs[before.job].reward; state.money += reward; audio.effect('reward'); hud.toast(`JOB COMPLETE / +$${reward.toLocaleString('en-US')} / Tab for the next chapter`, 6);
    if (before.job === 1) showDialogue('decoded'); saveGame(false);
  }
  if (after.stage === 'ending') {
    state.money += 3000; state.wanted = 0; state.heat = 0; audio.effect('reward'); hud.toast('STORY COMPLETE / +$3,000', 7); saveGame(false);
    setTimeout(() => { if (!title && state.story.stage === 'ending') { paused = true; hud.show('ending'); } }, 4500);
  }
  rememberCheckpoint();
}

function reload() {
  if (currentCar || state.reloading > 0 || state.ammo >= 12) return;
  if (state.reserve <= 0) return hud.toast('Out of ammunition. Blue + markers have supplies.');
  state.reloading = 1.25; audio.effect('reload');
}
function damagePlayer(amount) {
  if (failed) return;
  state.player.health = clamp(state.player.health - amount, 0, 100); damageFlash = Math.min(0.7, damageFlash + 0.25); audio.effect('hit');
  if (state.player.health <= 0) fail('Down, but not out.', 'The coast patrol got the upper hand. Retry from your last checkpoint.');
}
function fail(titleText, description) {
  failed = true; paused = true; mouse.down = false; keys.clear(); hud.el['failure-title'].textContent = titleText; hud.el['failure-copy'].textContent = description; hud.show('failure');
}
function raiseWanted(level) {
  const before = state.wanted; state.wanted = clamp(Math.max(state.wanted, level), 0, 5); state.heat = 12 + state.wanted * 4;
  state.lastKnown = { x: state.player.x, z: state.player.z }; state.seen = true;
  if (before < state.wanted) audio.effect('alert');
}

function spawnGuards(healthValues) {
  clearGuards();
  [{ x: -80, z: 66 }, { x: -69, z: 80 }, { x: -83, z: 54 }].forEach((p, i) => {
    const mesh = createPersonMesh('#ac6257'); mesh.scale.setScalar(1.08); mesh.userData.gun.visible = true; const label = createActorLabel('ARMED LOOKOUT'); mesh.add(label); scene.add(mesh);
    guards.push({ ...p, mesh, label, health: healthValues?.[i] ?? 65, cooldown: 0.5 + i * 0.4, down: false, angle: 0 });
  });
}
function addPolice() {
  if (cops.filter(c => c.health > 0).length >= Math.min(6, state.wanted + 1)) return;
  const player = state.player, n = cops.length, choices = [
    { x: nearest(roadsX, player.x - 65), z: nearest(roadsZ, player.z - 50) },
    { x: nearest(roadsX, player.x + 65), z: nearest(roadsZ, player.z + 50) },
    { x: nearest(roadsX, player.x), z: nearest(roadsZ, player.z - 100) },
    { x: nearest(roadsX, player.x - 100), z: nearest(roadsZ, player.z) },
  ];
  let point = choices[n % choices.length]; if (distance(point, player) < 36) point = { x: -150, z: player.z < 0 ? 150 : -150 };
  const mesh = createCarMesh('#e8e4d1', 'sedan', true), officer = createPersonMesh('#2a4d65'); scene.add(mesh); scene.add(officer);
  cops.push({ ...point, mesh, officer, infantry: { x: point.x, z: point.z, health: 65 }, deployed: false, angle: 0, speed: 0, health: 140, route: [], routeTimer: 0, shootTimer: 2, collisionTimer: 0, age: 0, patrol: 0, police: true });
}

function spawnParticles(x, y, z, color, count = 9, force = 4) {
  for (let i = 0; i < count; i++) {
    if (particles.length > 160) break;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })); mesh.position.set(x, y, z); scene.add(mesh);
    particles.push({ mesh, vx: (Math.random() - 0.5) * force, vy: 1 + Math.random() * force, vz: (Math.random() - 0.5) * force, life: 0.5 + Math.random() * 0.45, maxLife: 1 });
  }
}
function tracer(from, to, hostile = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(from.x, 1.2, from.z), new THREE.Vector3(to.x, 1.2, to.z)]);
  const mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: hostile ? '#f49672' : '#fff0a0', transparent: true, opacity: 0.85 })); scene.add(mesh); particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0.09, maxLife: 0.09, line: true });
}
function shoot() {
  if (state.reloading > 0 || currentCar || state.time < nextShot) return;
  if (state.ammo <= 0) { reload(); return; }
  nextShot = state.time + 0.23; state.ammo--; audio.effect('shot');
  const origin = state.player, dx = Math.sin(origin.angle), dz = -Math.cos(origin.angle);
  let target = { x: origin.x + dx * 48, z: origin.z + dz * 48 }, best = 48, hit = null;
  const candidates = [...guards.filter(g => g.health > 0).map(g => ({ actor: g, kind: 'guard', radius: 1.3 })), ...cops.filter(c => c.health > 0).map(c => ({ actor: c, kind: 'cop', radius: 2.4 })), ...cops.filter(c => c.deployed && c.infantry.health > 0).map(c => ({ actor: c.infantry, kind: 'officer', radius: 1.2 })), ...population.pedestrians.filter(p => !p.down).map(p => ({ actor: p, kind: 'pedestrian', radius: 1 })), ...population.cars.filter(c => c.health > 0).map(c => ({ actor: c, kind: 'car', radius: 2 }))];
  for (const candidate of candidates) {
    const a = candidate.actor, rx = a.x - origin.x, rz = a.z - origin.z, along = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx);
    if (along > 0.6 && along < best && side < candidate.radius && !segmentBlocked(origin, a, world.obstacles)) { hit = candidate; best = along; target = { x: a.x, z: a.z }; }
  }
  for (let d = 1; d < best; d += 0.8) {
    const x = origin.x + dx * d, z = origin.z + dz * d;
    if (world.obstacles.some(b => circleOverlapsBox(x, z, 0.05, b))) { target = { x, z }; hit = null; break; }
  }
  tracer(origin, target); spawnParticles(origin.x + dx, 1.4, origin.z + dz, '#ffe4a0', 3, 2); spawnParticles(target.x, 1.1, target.z, '#f5cf91', 5, 2);
  raiseWanted(['cop', 'officer'].includes(hit?.kind) ? 3 : Math.max(1, state.wanted));
  for (const p of population.pedestrians) if (distance(origin, p) < 45) p.panic = 6;
  if (hit) {
    hitmarker = 0.15;
    if (hit.kind === 'pedestrian') { hit.actor.down = 12; raiseWanted(3); }
    else {
      hit.actor.health -= hit.kind === 'car' ? 24 : 34;
      if (hit.actor.health <= 0) {
        state.kills++; audio.effect('hit');
        if (hit.kind === 'guard') { state.reserve += 12; hud.toast('LOOKOUT DISARMED / +12 ammunition', 2); }
        if (hit.kind === 'cop' || hit.kind === 'officer') { raiseWanted(Math.min(5, state.wanted + 1)); hud.toast('PATROL DOWN / Reinforcements requested.', 3); }
      }
    }
  }
}

function updatePlayer(dt) {
  const p = state.player;
  if (state.reloading > 0) { state.reloading -= dt; if (state.reloading <= 0) { const count = Math.min(12 - state.ammo, state.reserve); state.ammo += count; state.reserve -= count; } }
  if (currentCar) {
    const car = currentCar;
    const motion = updateDrive(car, { forward: keys.has('w') || keys.has('arrowup'), reverse: keys.has('s') || keys.has('arrowdown'), left: keys.has('a') || keys.has('arrowleft'), right: keys.has('d') || keys.has('arrowright'), handbrake: keys.has(' ') }, dt);
    const speedBefore = Math.abs(car.speed), collided = moveWithCollisions(car, motion.dx, motion.dz, 1.6, world.obstacles);
    if (collided && speedBefore > 3 && (!car.bump || state.time - car.bump > 0.5)) {
      car.bump = state.time; car.health -= speedBefore * 0.55; car.speed *= -0.22; damageFlash = 0.18; audio.effect('hit'); spawnParticles(car.x, 0.8, car.z, '#ffd38a', 8);
    }
    for (const other of [...population.cars, ...cops]) {
      if (other === car || other.health <= 0 || distance(car, other) > 3.4) continue;
      if (speedBefore > 4 && (!car.bump || state.time - car.bump > 0.6)) { car.bump = state.time; car.health -= speedBefore * 0.2 + 1; other.health -= speedBefore * 0.45; car.speed *= 0.46; other.speed *= -0.2; spawnParticles(car.x, 1, car.z, '#ffd28b'); raiseWanted(other.police ? 3 : 1); audio.effect('hit'); }
    }
    for (const person of [...population.pedestrians, ...guards]) {
      if ((person.down || person.health <= 0) || distance(car, person) > 2.2 || speedBefore < 8) continue;
      if ('health' in person) person.health = 0; else person.down = 12;
      raiseWanted(2); car.speed *= 0.8;
    }
    car.health = clamp(car.health, 0, 100); p.x = car.x; p.z = car.z; p.angle = car.angle;
    if (car.health <= 0) { spawnParticles(car.x, 1, car.z, '#f6a464', 24, 7); exitCar(); damagePlayer(30); car.speed = 0; hud.toast('VEHICLE DISABLED / Find another ride.', 5); }
    else if (car.health < 28 && Math.random() < dt * 12) spawnParticles(car.x, 1.4, car.z - 1, '#777b73', 1, 1);
  } else {
    let dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    let dz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    const moving = !!(dx || dz), speed = keys.has('shift') ? 9.2 : 5.5;
    if (moving) { const length = Math.hypot(dx, dz); dx /= length; dz /= length; moveWithCollisions(p, dx * speed * dt, dz * speed * dt, 0.65, world.obstacles); if (!mouse.inside) p.angle = Math.atan2(dx, -dz); }
    if (mouse.inside) {
      mouseVector.set(mouse.x / innerWidth * 2 - 1, 1 - mouse.y / innerHeight * 2); raycaster.setFromCamera(mouseVector, camera);
      if (raycaster.ray.intersectPlane(ground, aimPoint)) p.angle = Math.atan2(aimPoint.x - p.x, -(aimPoint.z - p.z));
    }
    animatePerson(playerMesh, moving, state.time, mouse.inside);
    if (mouse.down) shoot();
  }
  playerMesh.visible = !currentCar; playerMesh.position.set(p.x, 0.2, p.z); playerMesh.rotation.y = -p.angle;
}

function updateTraffic(dt) {
  for (const car of population.cars) {
    if (car.traffic && !car.occupied && car.health > 0) {
      let cruise = car.cruise, nextRoad = car.axis === 'z' ? nearest(roadsZ, car.z) : nearest(roadsX, car.x), along = car.axis === 'z' ? car.z : car.x;
      const red = Math.floor(state.time / 9) % 2 === (car.axis === 'z' ? 1 : 0), before = (nextRoad - along) * car.dir;
      if (red && before > 9 && before < 15) cruise = 0;
      for (const other of population.cars) {
        if (other === car || other.health <= 0) continue;
        const dx = other.x - car.x, dz = other.z - car.z, inFront = dx * Math.sin(car.angle) - dz * Math.cos(car.angle);
        if (inFront > 0 && inFront < 8 && Math.abs(dx * Math.cos(car.angle) + dz * Math.sin(car.angle)) < 2.4) cruise = 0;
      }
      if (!currentCar && distance(car, state.player) < 6) cruise = 0;
      car.speed = lerp(car.speed, cruise, 1 - Math.exp(-2.5 * dt));
      const intersection = car.axis + nextRoad;
      if (Math.abs(along - nextRoad) < 0.8 && car.lastIntersection !== intersection && !red) {
        car.lastIntersection = intersection;
        if (Math.random() < 0.28) {
          const oldAxis = car.axis; car.axis = oldAxis === 'z' ? 'x' : 'z'; car.dir = Math.random() < 0.5 ? -1 : 1;
          if (car.axis === 'x') { car.z = nextRoad - car.dir * 3; car.x = nearest(roadsX, car.x); }
          else { car.x = nextRoad + car.dir * 3; car.z = nearest(roadsZ, car.z); }
        }
      }
      car.angle = car.axis === 'z' ? car.dir > 0 ? Math.PI : 0 : car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.axis === 'z') car.z += car.dir * car.speed * dt; else car.x += car.dir * car.speed * dt;
      if (car.z > 178) car.z = -177; if (car.z < -178) car.z = 177; if (car.x > 140) car.x = -174; if (car.x < -175) car.x = 139;
    } else if (!car.occupied && Math.abs(car.speed) > 0.03) { car.speed *= Math.exp(-2 * dt); moveWithCollisions(car, Math.sin(car.angle) * car.speed * dt, -Math.cos(car.angle) * car.speed * dt, 1.6, world.obstacles); }
    car.mesh.position.set(car.x, 0.15, car.z); car.mesh.rotation.y = -car.angle; car.mesh.visible = distance(car, state.player) < 190 || title;
    if (car.health <= 0) car.mesh.rotation.z = 0.08;
  }
}

function updatePedestrians(dt) {
  for (const p of population.pedestrians) {
    if (p.down) { p.down -= dt; p.mesh.rotation.z = Math.PI / 2; p.mesh.position.set(p.x, 0.3, p.z); if (p.down <= 0) { p.down = 0; p.mesh.rotation.z = 0; } continue; }
    let target = p.waypoints[p.waypoint], speed = p.speed;
    if (p.panic > 0) { p.panic -= dt; target = { x: p.x + (p.x - state.player.x), z: p.z + (p.z - state.player.z) }; speed = 4.5; }
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
    if (d < 1.1) p.waypoint = (p.waypoint + 1) % p.waypoints.length;
    else { moveWithCollisions(p, dx / d * speed * dt, dz / d * speed * dt, 0.48, world.obstacles); p.mesh.rotation.y = -Math.atan2(dx, -dz); }
    p.mesh.position.set(p.x, 0.23, p.z); p.mesh.visible = distance(p, state.player) < 115 || title; animatePerson(p.mesh, d > 0.3, state.time + p.phase);
  }
}

function updatePolice(dt) {
  if (state.wanted && Math.floor(state.time * 0.16) !== Math.floor((state.time - dt) * 0.16)) addPolice();
  state.seen = false; let closeOfficer = false;
  for (const cop of cops) {
    cop.age += dt; cop.routeTimer -= dt; cop.shootTimer -= dt; cop.collisionTimer -= dt;
    if (cop.health <= 0) { cop.speed = 0; cop.mesh.rotation.z = 0.1; cop.officer.visible = false; continue; }
    const dist = distance(cop, state.player), visible = dist < (currentCar ? 71 : 51) && !segmentBlocked(cop, state.player, world.obstacles);
    if (state.wanted && visible) { state.seen = true; state.lastKnown = { x: state.player.x, z: state.player.z }; }
    const active = state.wanted > 0, goal = active ? visible ? state.player : state.lastKnown || state.player : { x: -150, z: -150 };
    if (cop.routeTimer <= 0) { cop.routeTimer = 1.6 + cops.indexOf(cop) * 0.06; cop.route = navigation.findPath(cop, goal); }
    while (cop.route.length && distance(cop, cop.route[0]) < 4) cop.route.shift();
    let target = visible && dist < 47 ? state.player : cop.route[0] || goal;
    if (segmentBlocked(cop, target, world.obstacles) && cop.route.length) target = cop.route[0];
    const desiredAngle = Math.atan2(target.x - cop.x, -(target.z - cop.z));
    const turn = angleDelta(desiredAngle, cop.angle); cop.angle += clamp(turn, -2.5 * dt, 2.5 * dt);
    const stopped = !currentCar && visible && dist < 16;
    const desiredSpeed = stopped ? 0 : active ? (Math.abs(turn) > 0.75 ? 10 : 25 + state.wanted * 1.8) : 11;
    cop.speed = lerp(cop.speed, desiredSpeed, 1 - Math.exp(-2.6 * dt));
    if (distance(cop, target) > 2) {
      const hit = moveWithCollisions(cop, Math.sin(cop.angle) * cop.speed * dt, -Math.cos(cop.angle) * cop.speed * dt, 1.55, world.obstacles);
      if (hit) { cop.speed *= 0.5; cop.routeTimer = 0; }
    }
    if (active && currentCar && dist < 3.7 && cop.collisionTimer <= 0) { cop.collisionTimer = 1.2; currentCar.health -= 7; damageFlash = 0.12; cop.speed *= -0.35; spawnParticles(cop.x, 1, cop.z, '#ffe0ad', 6); }
    const deploy = active && !currentCar && dist < 32 && cop.infantry.health > 0; cop.officer.visible = deploy;
    if (deploy) {
      const officer = cop.infantry;
      if (!cop.deployed) { officer.x = cop.x + Math.cos(cop.angle) * 2.2; officer.z = cop.z + Math.sin(cop.angle) * 2.2; }
      const od = distance(officer, state.player), dx = state.player.x - officer.x, dz = state.player.z - officer.z;
      if (od > 2.2 && od < 35 && !segmentBlocked(officer, state.player, world.obstacles)) moveWithCollisions(officer, dx / od * 2.6 * dt, dz / od * 2.6 * dt, 0.6, world.obstacles);
      cop.officer.position.set(officer.x, 0.22, officer.z); cop.officer.rotation.y = -Math.atan2(dx, -dz); animatePerson(cop.officer, od > 2.3, state.time, true);
      if (od < 28 && cop.shootTimer <= 0 && !segmentBlocked(officer, state.player, world.obstacles)) { cop.shootTimer = 2.6; tracer(officer, state.player, true); damagePlayer(6); }
      if (od < 2.6) closeOfficer = true;
    } else if (active && currentCar && visible && dist < 27 && cop.shootTimer <= 0) { cop.shootTimer = 2.1; tracer(cop, state.player, true); currentCar.health -= 3; }
    cop.deployed = deploy;
    cop.mesh.position.set(cop.x, 0.15, cop.z); cop.mesh.rotation.y = -cop.angle; cop.mesh.visible = dist < 200;
    for (let i = 0; i < cop.mesh.userData.lights.length; i++) cop.mesh.userData.lights[i].visible = active && Math.floor(state.time * 8) % 2 === i;
  }
  if (state.wanted) {
    if (state.seen) state.heat = 12 + state.wanted * 4;
    else { state.heat -= dt * (state.lastKnown && distance(state.player, state.lastKnown) < 44 ? 0.35 : 1); if (state.heat <= 0) { state.wanted = 0; state.heat = 0; hud.toast('HEAT LOST / The coast patrol lost your trail.', 5); audio.effect('reward'); } }
  }
  state.arrest = closeOfficer ? state.arrest + dt : Math.max(0, state.arrest - dt * 2);
  if (state.arrest >= 3) fail('Busted.', 'The coast patrol boxed you in. Stay moving, use cover, or find a fast car.');
}

function updateGuards(dt) {
  for (const guard of guards) {
    guard.mesh.position.set(guard.x, 0.2, guard.z);
    guard.label.visible = guard.health > 0 && distance(guard, state.player) < 65;
    if (guard.health <= 0) { guard.mesh.rotation.z = Math.PI / 2; guard.mesh.position.y = 0.3; continue; }
    const d = distance(guard, state.player), visible = d < 31 && !segmentBlocked(guard, state.player, world.obstacles);
    guard.mesh.rotation.y = -Math.atan2(state.player.x - guard.x, -(state.player.z - guard.z)); animatePerson(guard.mesh, false, state.time, true); guard.cooldown -= dt;
    if (visible && guard.cooldown <= 0) { guard.cooldown = 1.8; tracer(guard, state.player, true); if (currentCar) currentCar.health -= 5; else damagePlayer(9); }
  }
}

function updateMissions(dt) {
  const story = state.story;
  if (state.mode === 'story') {
    if (story.stage === 'escape' && !state.wanted) progressStory('clear');
    if (story.stage === 'relay' && guards.length && guards.every(g => g.health <= 0)) progressStory('guards');
    if (story.stage === 'route') {
      story.clock += dt;
      if (story.clock >= 180) { fail('Signal lost.', 'The dead-drop signal went dark. Retry the checkpoint and keep the Sunbird moving.'); return; }
      const view = missionView(story, 'story');
      if (distance(state.player, view.target) < 5.5 && currentCar) { progressStory('drop'); state.money += 100; raiseWanted(2); hud.toast(`DEAD DROP ${Math.min(3, state.story.checkpoint)} / 3 SECURED`, 3); }
    }
  }
  if (state.mode === 'pursuit' && !state.challenge.won) {
    state.challenge.time += dt;
    if (state.challenge.time >= 90 && !state.wanted) { state.challenge.won = true; state.money += 2500; hud.toast('COAST RUNNER COMPLETE / +$2,500', 10); audio.effect('reward'); saveGame(false); hud.say('88.4 FM / COAST RUNNER', 'Ninety seconds. No tail. A clean escape. The night is yours now.', 8); rememberCheckpoint(); }
  }
  ledger.visible = state.mode === 'story' && story.job === 0 && ['meet', 'car', 'cache'].includes(story.stage);
  for (let i = 0; i < supplies.length; i++) { supplies[i].cooldown = Math.max(0, supplies[i].cooldown - dt); supplyMarkers[i].rotation.y = state.time * 0.5; supplyMarkers[i].position.y = 2.6 + Math.sin(state.time * 2 + i) * 0.2; }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); particles.splice(i, 1); continue; }
    p.mesh.material.opacity = clamp(p.life / p.maxLife, 0, 1);
    if (!p.line) { p.vy -= dt * 8; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; }
  }
}

function updateCamera(dt) {
  const focus = title ? new THREE.Vector3(80 + Math.sin(performance.now() * 0.00007) * 8, 0, 73) : new THREE.Vector3(state.player.x, 0, state.player.z);
  cameraTarget.lerp(focus, 1 - Math.exp(-5 * dt));
  const zoom = (currentCar ? 1.09 : 0.93) * cameraZoom;
  camera.position.set(cameraTarget.x + 9 * zoom, 53 * zoom, cameraTarget.z + 58 * zoom);
  camera.lookAt(cameraTarget.x, 0.8, cameraTarget.z - 8 * zoom);
  sun.position.set(cameraTarget.x - 90, 130, cameraTarget.z + 75); sun.target.position.set(cameraTarget.x, 0, cameraTarget.z);
}

function updateUI(dt) {
  const view = missionView(state.story, state.mode, state.challenge);
  hud.update(state, view, currentCar, dt);
  interaction = findInteraction(); hud.prompt(interaction?.label);
  targetMarker.visible = !!view.target;
  if (view.target) {
    targetMarker.position.set(view.target.x, 0, view.target.z); targetMarker.userData.diamond.rotation.y = state.time * 1.2; targetMarker.userData.diamond.position.y = 5.3 + Math.sin(state.time * 2) * 0.4;
    const screen = new THREE.Vector3(view.target.x, 7, view.target.z).project(camera), onScreen = screen.z < 1 && Math.abs(screen.x) < 0.92 && Math.abs(screen.y) < 0.8;
    hud.show('target-label', onScreen && distance(state.player, view.target) < 110);
    if (onScreen) { hud.el['target-label'].style.left = `${(screen.x + 1) * innerWidth / 2}px`; hud.el['target-label'].style.top = `${(1 - screen.y) * innerHeight / 2}px`; hud.el['target-label'].textContent = (state.story.stage === 'car' ? 'SUNBIRD GT' : state.story.stage === 'meet' ? 'MARA / MOONROOM' : '◆ OBJECTIVE') + ` / ${Math.round(distance(state.player, view.target))} M`; }
  } else hud.show('target-label', false);
  if ((mapFrame++ % 3) === 0 || !hud.el['map-modal'].hidden) {
    hud.map(hud.minimap, state, world, population.cars, cops, supplies, view);
    if (!hud.el['map-modal'].hidden) hud.map(hud.fullmap, state, world, population.cars, cops, supplies, view, true);
  }
  hud.el.crosshair.style.display = !currentCar && mouse.inside && !paused ? 'block' : 'none';
  hud.el.crosshair.style.left = mouse.x + 'px'; hud.el.crosshair.style.top = mouse.y + 'px'; hud.el.crosshair.style.filter = hitmarker > 0 ? 'drop-shadow(0 0 5px #f8c768)' : '';
}

let previous = performance.now();
function frame(now) {
  requestAnimationFrame(frame); const dt = Math.min(0.04, (now - previous) / 1000); previous = now;
  if (!paused) {
    state.time += dt; world.update(state.time);
    if (!title && !failed) { updatePlayer(dt); updatePolice(dt); updateGuards(dt); updateMissions(dt); }
    updateTraffic(dt); updatePedestrians(dt); updateParticles(dt);
  }
  updateCamera(dt);
  damageFlash = Math.max(0, damageFlash - dt * 1.4); hud.el.damage.style.opacity = damageFlash; hitmarker = Math.max(0, hitmarker - dt);
  if (!title) updateUI(paused ? 0 : dt);
  audio.update(state.time, currentCar?.speed || 0, !!currentCar, state.wanted ? Math.min(999, ...cops.filter(c => c.health > 0).map(c => distance(c, state.player))) : 999, !paused && !title);
  renderer.render(scene, camera);
}
hud.el.continue.disabled = !readSave();
hud.show('loading', false);
updateCamera(1); requestAnimationFrame(frame);
console.info('Gilded Coast ready. WASD: move/drive. F: interact. Mouse: aim/fire. Tab: radio. M: map. K: save.');
