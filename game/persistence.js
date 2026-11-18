const stages = new Set(['meet', 'car', 'cache', 'escape', 'deliver', 'relay', 'transmitter', 'safe', 'route', 'broadcast', 'interlude', 'ending']);
export const SAVE_KEY = 'gilded-coast-after-hours-v1';
const inRange = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;

export function validSave(data) {
  if (!data || data.version !== 1 || !['story', 'roam', 'pursuit'].includes(data.state?.mode)) return false;
  const { player, story, challenge } = data.state;
  if (!player || !inRange(player.x, -180, 148) || !inRange(player.z, -183, 184) || !inRange(player.health, 0, 100) || !Number.isFinite(player.angle)) return false;
  if (!story || !stages.has(story.stage) || !Number.isInteger(story.job) || !inRange(story.job, 0, 2) || !inRange(story.completed, 0, 3) || !inRange(story.checkpoint, 0, 3)) return false;
  if (!inRange(data.state.money, 0, 1e9) || !inRange(data.state.ammo, 0, 12) || !inRange(data.state.reserve, 0, 1e6) || !inRange(data.state.time, 0, 1e9) || !inRange(data.state.wanted, 0, 5)) return false;
  if (!challenge || !inRange(challenge.time, 0, 1e9) || !Array.isArray(data.cars) || data.cars.length > 100) return false;
  if (data.carId !== null && !Number.isInteger(data.carId)) return false;
  return data.cars.every(car => Number.isInteger(car.id) && inRange(car.x, -180, 148) && inRange(car.z, -183, 184) && Number.isFinite(car.angle) && inRange(car.health, 0, 100));
}

export function readSavedNight(storage) {
  try { const data = JSON.parse(storage.getItem(SAVE_KEY)); return validSave(data) ? data : null; }
  catch { return null; }
}
