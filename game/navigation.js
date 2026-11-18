import { bounds, clamp, circleOverlapsBox } from './math.js';

// A small navigation grid gives patrols real routes around city blocks and through alleys.
export class CityNavigation {
  constructor(obstacles, step = 6) {
    this.step = step; this.width = Math.floor((bounds.maxX - bounds.minX) / step) + 1; this.height = Math.floor((bounds.maxZ - bounds.minZ) / step) + 1;
    this.blocked = new Uint8Array(this.width * this.height);
    for (let z = 0; z < this.height; z++) for (let x = 0; x < this.width; x++) {
      const p = this.point(z * this.width + x);
      this.blocked[z * this.width + x] = obstacles.some(b => circleOverlapsBox(p.x, p.z, 2.1, b)) ? 1 : 0;
    }
  }
  point(index) { return { x: bounds.minX + index % this.width * this.step, z: bounds.minZ + Math.floor(index / this.width) * this.step }; }
  closest(p) {
    const x = clamp(Math.round((p.x - bounds.minX) / this.step), 0, this.width - 1), z = clamp(Math.round((p.z - bounds.minZ) / this.step), 0, this.height - 1);
    const at = z * this.width + x;
    if (!this.blocked[at]) return at;
    let best = -1, dist = Infinity;
    for (let zz = Math.max(0, z - 7); zz <= Math.min(this.height - 1, z + 7); zz++) for (let xx = Math.max(0, x - 7); xx <= Math.min(this.width - 1, x + 7); xx++) {
      const id = zz * this.width + xx, d = (xx - x) ** 2 + (zz - z) ** 2;
      if (!this.blocked[id] && d < dist) { dist = d; best = id; }
    }
    return best;
  }
  findPath(from, to) {
    const start = this.closest(from), finish = this.closest(to);
    if (start < 0 || finish < 0) return [];
    const parent = new Int32Array(this.blocked.length).fill(-1), queue = [start]; parent[start] = start;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor]; if (current === finish) break;
      const x = current % this.width, z = Math.floor(current / this.width);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, zz = z + dz;
        if (xx < 0 || zz < 0 || xx >= this.width || zz >= this.height) continue;
        const next = zz * this.width + xx;
        if (this.blocked[next] || parent[next] !== -1) continue;
        parent[next] = current; queue.push(next);
      }
    }
    if (parent[finish] === -1) return [];
    const path = []; let current = finish;
    while (current !== start) { path.push(this.point(current)); current = parent[current]; }
    return path.reverse();
  }
}
