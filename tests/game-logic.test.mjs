import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../game/vendor/three.min.js';
import { updateDrive, moveWithCollisions, circleOverlapsBox, segmentBlocked, distance } from '../game/math.js';
import { newStory, advanceStory, startJob, missionView, places, objectiveInReach } from '../game/story.js';
import { CityNavigation } from '../game/navigation.js';
import { validSave, readSavedNight } from '../game/persistence.js';
import { createCoastalCity } from '../game/world.js';

test('driving accelerates, brakes into reverse, and handbrake dissipates speed', () => {
  const car = { speed: 0, angle: 0, maxSpeed: 43, acceleration: 18 };
  for (let i = 0; i < 300; i++) updateDrive(car, { forward: true }, 1 / 60);
  assert.ok(car.speed > 35 && car.speed <= 43);
  for (let i = 0; i < 240; i++) updateDrive(car, { reverse: true }, 1 / 60);
  assert.ok(car.speed < -5 && car.speed >= -11);
  car.speed = 35;
  for (let i = 0; i < 60; i++) updateDrive(car, { handbrake: true }, 1 / 60);
  assert.ok(car.speed < 3.5);
});

test('collision substeps stop a fast car from tunneling through a thin wall', () => {
  const wall = { x: 0, z: 0, w: 2, d: 40 }, car = { x: -30, z: 0 };
  assert.equal(moveWithCollisions(car, 80, 0, 1.5, [wall]), true);
  assert.ok(car.x <= -2.4);
  assert.equal(circleOverlapsBox(car.x, car.z, 1.5, wall), false);
  assert.equal(segmentBlocked({ x: -20, z: 0 }, { x: 20, z: 0 }, [wall]), true);
  assert.equal(segmentBlocked({ x: -20, z: 25 }, { x: 20, z: 25 }, [wall]), false);
});

test('all three story chapters have ordered progression and a reachable conclusion', () => {
  let story = newStory();
  assert.equal(advanceStory(story, 'ledger').stage, 'meet');
  for (const event of ['talk', 'coupe', 'ledger', 'clear', 'handover']) story = advanceStory(story, event);
  assert.equal(story.stage, 'interlude'); assert.equal(story.completed, 1);
  assert.equal(advanceStory(story, 'handover').completed, 1);
  story = startJob(story, 1);
  for (const event of ['guards', 'take', 'handover']) story = advanceStory(story, event);
  assert.equal(story.completed, 2);
  story = startJob(story, 2);
  for (let i = 0; i < 3; i++) story = advanceStory(story, 'drop');
  assert.equal(story.stage, 'broadcast'); assert.deepEqual(missionView(story, 'story').target, places.broadcast);
  story = advanceStory(story, 'broadcast'); assert.equal(story.won, true); assert.equal(story.completed, 3); assert.equal(story.stage, 'ending');
});

test('mission interactions require physical proximity, and pursuit starts with a real survival objective', () => {
  const view = missionView(newStory(), 'story');
  assert.equal(objectiveInReach(view, { x: 99, z: 87 }), false);
  assert.equal(objectiveInReach(view, places.mara), true);
  assert.match(missionView(newStory(), 'pursuit', { time: 35 }).objective, /55s/);
  assert.equal(missionView(newStory(), 'pursuit', { time: 90 }).progress, 1);
});

test('every story destination is outside buildings, and patrol navigation connects them', () => {
  // Canvas sign rendering is irrelevant to collision/layout testing; scene geometry is the real generator.
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) };
  const world = createCoastalCity(new THREE.Scene()), navigation = new CityNavigation(world.obstacles);
  assert.ok(world.buildings.length > 20);
  for (const [name, point] of Object.entries(places)) {
    assert.equal(world.obstacles.some(b => circleOverlapsBox(point.x, point.z, 0.7, b)), false, name + ' is not inside a building');
    const route = navigation.findPath({ x: 90, z: 90 }, point);
    assert.ok(route.length > 0, name + ' has a patrol route');
    assert.ok(distance(route.at(-1), point) < 9, name + ' is accessible from the street grid');
    for (const step of route) assert.equal(world.obstacles.some(b => circleOverlapsBox(step.x, step.z, 1.5, b)), false);
  }
  delete globalThis.document;
});

const saveFixture = () => ({ version: 1, state: { mode: 'story', player: { x: 99, z: 87, angle: 0, health: 80 }, story: newStory(), challenge: { time: 0, won: false }, money: 250, ammo: 8, reserve: 72, time: 12, wanted: 1 }, carId: null, cars: [{ id: 0, x: 96, z: 77, angle: 0, health: 100 }] });
test('saved nights preserve progress and reject corrupt or out-of-world data', () => {
  const data = saveFixture(); data.state.story.stage = 'cache'; data.state.money = 1150;
  assert.equal(validSave(data), true);
  const storage = { getItem: () => JSON.stringify(data) };
  assert.equal(readSavedNight(storage).state.story.stage, 'cache'); assert.equal(readSavedNight(storage).state.money, 1150);
  assert.equal(readSavedNight({ getItem: () => '{broken' }), null);
  assert.equal(readSavedNight({ getItem() { throw new Error('Storage unavailable'); } }), null);
  const bad = saveFixture(); bad.state.player.x = Infinity; assert.equal(validSave(bad), false);
  bad.state.player.x = 0; bad.state.story.stage = 'nonexistent'; assert.equal(validSave(bad), false);
});
