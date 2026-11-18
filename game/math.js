export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const roadsX = [-150, -90, -30, 30, 90];
export const roadsZ = [-150, -90, -30, 30, 90, 150];
export const bounds = { minX: -179, maxX: 147, minZ: -182, maxZ: 183 };
export const nearest = (values, x) => values.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function randomGenerator(seed = 93147) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

export function circleOverlapsBox(x, z, radius, box) {
  const dx = x - clamp(x, box.x - box.w / 2, box.x + box.w / 2);
  const dz = z - clamp(z, box.z - box.d / 2, box.z + box.d / 2);
  return dx * dx + dz * dz < radius * radius;
}

export function moveWithCollisions(body, dx, dz, radius, obstacles) {
  const previous = { x: body.x, z: body.z };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / Math.max(radius * 0.7, 0.2)));
  let collided = false;
  for (let i = 0; i < steps; i++) {
    const x = clamp(body.x + dx / steps, bounds.minX + radius, bounds.maxX - radius);
    if (!obstacles.some(b => circleOverlapsBox(x, body.z, radius, b))) body.x = x;
    else collided = true;
    const z = clamp(body.z + dz / steps, bounds.minZ + radius, bounds.maxZ - radius);
    if (!obstacles.some(b => circleOverlapsBox(body.x, z, radius, b))) body.z = z;
    else collided = true;
  }
  if (Math.abs(body.x - previous.x - dx) > 0.05 || Math.abs(body.z - previous.z - dz) > 0.05) collided = true;
  return collided;
}

export function segmentBlocked(a, b, obstacles) {
  const samples = Math.ceil(distance(a, b) / 2);
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    if (obstacles.some(o => Math.abs(lerp(a.x, b.x, t) - o.x) < o.w / 2 && Math.abs(lerp(a.z, b.z, t) - o.z) < o.d / 2)) return true;
  }
  return false;
}

export function updateDrive(car, input, dt) {
  const throttle = (input.forward ? 1 : 0) - (input.reverse ? 1 : 0);
  const braking = (throttle < 0 && car.speed > 1.5) || (throttle > 0 && car.speed < -1.5);
  car.speed += throttle * (braking ? 28 : throttle < 0 ? 10 : car.acceleration || 16) * dt;
  car.speed *= Math.exp(-(input.handbrake ? 2.5 : throttle ? 0.11 : 0.65) * dt);
  car.speed = clamp(car.speed, -11, car.maxSpeed || 38);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.angle -= steer * clamp(Math.abs(car.speed) / 10, 0, 1) * Math.sign(car.speed) * (input.handbrake ? 2.7 : 1.65) * dt;
  return { dx: Math.sin(car.angle) * car.speed * dt, dz: -Math.cos(car.angle) * car.speed * dt };
}

export function routeTo(target, position) {
  const roadX = nearest(roadsX, position.x), roadZ = nearest(roadsZ, position.z);
  const targetX = nearest(roadsX, target.x), targetZ = nearest(roadsZ, target.z);
  if (Math.abs(position.x - roadX) > 9 && Math.abs(position.z - roadZ) > 9) return { x: roadX, z: position.z };
  if (Math.abs(position.x - roadX) < Math.abs(position.z - roadZ)) {
    if (Math.abs(position.z - targetZ) > 10) return { x: roadX, z: targetZ };
    return { x: targetX, z: targetZ };
  }
  if (Math.abs(position.x - targetX) > 10) return { x: targetX, z: roadZ };
  return { x: targetX, z: targetZ };
}
