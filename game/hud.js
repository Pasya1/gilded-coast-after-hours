import { clamp, distance, roadsX, roadsZ, nearest } from './math.js';
import { storyJobs } from './story.js';

export const districtAt = (x, z) => x > 99 ? z < -112 ? 'HARBOR / PIER 8' : 'PALM PROMENADE' : x < -95 ? z > 95 ? 'CASA DISTRICT' : 'WEST QUARTER' : z < -48 ? 'CITRUS DOWNTOWN' : z > 90 ? 'SUNSET VILLAS' : 'SOLSTICE DISTRICT';
export class CoastHUD {
  constructor(action) {
    this.el = Object.fromEntries([...document.querySelectorAll('[id]')].map(e => [e.id, e]));
    this.minimap = this.el.minimap.getContext('2d'); this.fullmap = this.el.fullmap.getContext('2d');
    document.addEventListener('click', e => { const button = e.target.closest('button[data-action]'); if (button && !button.disabled) action(button.dataset.action, button.dataset.job); });
    this.toastTimer = 0; this.dialogueTimer = 0;
  }
  show(id, show = true) { this.el[id].hidden = !show; }
  toast(text, seconds = 3) { this.el.toast.textContent = text; this.el.toast.style.opacity = 1; this.toastTimer = seconds; }
  say(speaker, words, seconds = 9) { this.el.speaker.textContent = speaker; this.el.speech.textContent = words; this.show('dialogue'); this.dialogueTimer = seconds; }
  update(state, view, car, dt) {
    const e = this.el;
    if ((this.toastTimer -= dt) <= 0) e.toast.style.opacity = 0;
    if ((this.dialogueTimer -= dt) <= 0) this.show('dialogue', false);
    e.chapter.textContent = view.chapter; e['mission-title'].textContent = view.title; e.objective.textContent = view.objective;
    e.progress.style.width = `${view.progress * 100}%`;
    const meters = view.target ? Math.round(distance(state.player, view.target)) : 0;
    e['objective-distance'].textContent = view.target ? `◆ ${meters} M  /  ${meters < 5 ? 'PRESS F TO INTERACT' : 'FOLLOW THE GOLD MARKER'}` : view.hint;
    e.money.textContent = '$' + state.money.toLocaleString('en-US');
    e.wanted.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    e.wanted.style.color = state.wanted && !state.seen ? '#92c9cf' : '#f3c873';
    e['heat-status'].textContent = state.wanted ? state.seen ? 'POLICE IN PURSUIT' : `SEARCHING / ${Math.ceil(state.heat)}s` : 'OFF THE RADAR';
    e.health.textContent = Math.ceil(state.player.health); e['health-fill'].style.width = state.player.health + '%';
    e['health-fill'].style.background = state.player.health < 30 ? '#ee9a80' : '#80d7b3';
    e.ammo.innerHTML = state.reloading > 0 ? 'RELOADING…' : `${state.ammo} <small>/ ${state.reserve}</small>`;
    e['weapon-label'].textContent = car ? 'IN VEHICLE' : 'SERVICE PISTOL';
    e.district.textContent = districtAt(state.player.x, state.player.z);
    e['map-caption'].textContent = view.target ? `OBJECTIVE / ${meters} M` : state.wanted ? 'PATROLS ARE SEARCHING' : 'GILDED COAST';
    this.show('vehicle-panel', !!car);
    if (car) {
      e['car-name'].textContent = car.police ? 'COAST PATROL' : car.type === 'coupe' ? 'SUNBIRD GT' : car.type === 'van' ? 'HARBORLINE VAN' : 'CALDERA SEDAN';
      e.speed.textContent = Math.round(Math.abs(car.speed) * 3.6); e['car-health'].style.width = car.health + '%';
      e['car-health'].style.background = car.health < 30 ? '#efa482' : '#80d7c0';
      e['car-state'].textContent = car.health < 26 ? 'ENGINE DAMAGED / FIND ANOTHER CAR' : 'SPACE · HANDBRAKE / F · EXIT';
    }
    const mins = 18 * 60 + 42 + Math.floor(state.time / 14);
    e.clock.textContent = `${Math.floor(mins / 60) % 24}:${String(mins % 60).padStart(2, '0')}`;
    this.show('arrest', state.arrest > 0.15); e.arrest.querySelector('i').style.width = `${state.arrest / 3 * 100}%`;
    e['control-hints'].innerHTML = car ? '<span><kbd>W S</kbd> ACCELERATE / BRAKE</span><span><kbd>A D</kbd> STEER</span><span><kbd>F</kbd> EXIT</span><span><kbd>TAB</kbd> RADIO</span><span><kbd>ESC</kbd> PAUSE</span>' : '<span><kbd>W A S D</kbd> MOVE</span><span><kbd>SHIFT</kbd> SPRINT</span><span><kbd>F</kbd> INTERACT</span><span><kbd>TAB</kbd> RADIO</span><span><kbd>ESC</kbd> PAUSE</span>';
  }
  prompt(text) { this.show('interaction', !!text); if (text) this.el.interaction.querySelector('span').textContent = text; }
  jobs(story) {
    this.el['job-list'].innerHTML = storyJobs.map((job, i) => `<button class="job" data-action="job" data-job="${i}" ${i > story.completed ? 'disabled' : ''}><span>0${i + 1}</span><span><strong>${job.title}</strong><p>${job.briefing}</p><small>${i < story.completed ? 'COMPLETED · REPLAY' : i > story.completed ? 'LOCKED · COMPLETE THE PREVIOUS JOB' : 'AVAILABLE'} / $${job.reward.toLocaleString('en-US')}</small></span></button>`).join('');
  }
  map(ctx, state, world, cars, cops, supplies, view, full = false) {
    const w = ctx.canvas.width, h = ctx.canvas.height, scale = full ? 1.2 : 1.58;
    const center = full ? { x: -15, z: 0 } : state.player;
    const px = x => w / 2 + (x - center.x) * scale, pz = z => h / 2 + (z - center.z) * scale;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#315d60'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a9b7f'; ctx.fillRect(px(-185), pz(-190), 330 * scale, 380 * scale);
    ctx.fillStyle = '#c9ba8b'; ctx.fillRect(px(115), pz(-190), 30 * scale, 380 * scale);
    ctx.strokeStyle = '#586e6b'; ctx.lineWidth = 15 * scale; ctx.beginPath();
    for (const x of roadsX) { ctx.moveTo(px(x), pz(-185)); ctx.lineTo(px(x), pz(185)); }
    for (const z of roadsZ) { ctx.moveTo(px(-180), pz(z)); ctx.lineTo(px(145), pz(z)); } ctx.stroke();
    ctx.strokeStyle = '#c3c1a2'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#c8bd9d'; for (const b of world.buildings) ctx.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * scale, b.d * scale);
    ctx.fillStyle = '#6b936e'; ctx.fillRect(px(-21), pz(-21), 42 * scale, 42 * scale);
    if (state.wanted && state.lastKnown) {
      ctx.fillStyle = '#cc726d29'; ctx.strokeStyle = '#ed8f7c88'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(px(state.lastKnown.x), pz(state.lastKnown.z), 44 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (view.target) {
      ctx.strokeStyle = '#f6ce7d'; ctx.lineWidth = full ? 2 : 2.5; ctx.setLineDash([4, 4]); ctx.beginPath();
      ctx.moveTo(px(state.player.x), pz(state.player.z));
      const rx = nearest(roadsX, state.player.x), tz = nearest(roadsZ, view.target.z);
      ctx.lineTo(px(rx), pz(state.player.z)); ctx.lineTo(px(rx), pz(tz)); ctx.lineTo(px(view.target.x), pz(tz)); ctx.lineTo(px(view.target.x), pz(view.target.z)); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const c of cars) { if (c.health <= 0) continue; ctx.fillStyle = c.occupied ? '#f7d38c' : '#e0ded066'; ctx.fillRect(px(c.x) - 1.3, pz(c.z) - 2, 2.6, 4); }
    for (const c of cops) { if (c.health <= 0) continue; ctx.fillStyle = Math.floor(state.time * 4) % 2 ? '#ee8c79' : '#86c6e7'; ctx.beginPath(); ctx.arc(px(c.x), pz(c.z), full ? 4 : 3.4, 0, Math.PI * 2); ctx.fill(); }
    for (const s of supplies) { ctx.fillStyle = '#92e7d1'; ctx.font = `bold ${full ? 17 : 14}px Arial`; ctx.textAlign = 'center'; ctx.fillText('+', px(s.x), pz(s.z) + 5); }
    if (view.target) {
      const x = clamp(px(view.target.x), 11, w - 11), z = clamp(pz(view.target.z), 12, h - 12);
      ctx.save(); ctx.translate(x, z); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#f7ce76'; ctx.shadowColor = '#193c43'; ctx.shadowBlur = 4; ctx.fillRect(-4.5, -4.5, 9, 9); ctx.restore();
    }
    ctx.save(); ctx.translate(px(state.player.x), pz(state.player.z)); ctx.rotate(state.player.angle || 0); ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 3); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fillStyle = '#f9f5d8'; ctx.strokeStyle = '#193840'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fill(); ctx.restore();
    if (full) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#e9e5bd'; ctx.font = 'bold 11px Arial';
      for (const label of [['WEST QUARTER', -125, 12], ['CITRUS DOWNTOWN', -47, -171], ['SOLSTICE', -3, 16], ['SUNSET VILLAS', -14, 171], ['HARBOR', 122, -108]]) ctx.fillText(label[0], px(label[1]), pz(label[2]));
      ctx.save(); ctx.translate(px(165), pz(40)); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#c2dfce'; ctx.font = 'italic 20px Georgia'; ctx.fillText('The Gilded Sea', 0, 0); ctx.restore();
    }
  }
}
