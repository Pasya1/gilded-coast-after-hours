import { distance } from './math.js';

export const places = {
  mara: { x: 72, z: 80 }, coupe: { x: 96, z: 77 },
  cache: { x: 123, z: -151 }, garage: { x: -141, z: -29 },
  relay: { x: -77, z: 79 }, safe: { x: -141, z: 151 },
  broadcast: { x: 127, z: 29 },
};
export const storyJobs = [
  { title: 'BORROWED TIME', subtitle: '01 / THE HARBOR LEDGER', reward: 900, briefing: 'Mara Vale has one night to expose the syndicate buying her neighborhood. Lift a getaway car, recover a harbor ledger, and bring it to Ivo without a police tail.' },
  { title: 'DEAD AIR', subtitle: '02 / CUT THE WIRE', reward: 1800, briefing: 'The ledger points to a private surveillance relay. Clear the three armed lookouts, take its transmitter, and reach the safehouse. Ivo will decode the final route.' },
  { title: 'LAST LIGHT', subtitle: '03 / A CITY THAT LISTENS', reward: 3000, briefing: 'Three dead drops prove who bought the coast. Collect them in order within three minutes, then take the evidence to the independent radio pier. The whole city gets to hear it.' },
];
export const checkpoints = [{ x: -30, z: 90 }, { x: -30, z: -90 }, { x: 90, z: -90 }];

export function newStory() {
  return { job: 0, stage: 'meet', completed: 0, checkpoint: 0, clock: 0, won: false };
}

export function missionView(story, mode, challenge = {}) {
  if (mode === 'pursuit') return {
    title: 'COAST RUNNER', chapter: 'HOT PURSUIT / SURVIVAL',
    objective: challenge.won ? 'Escape complete. The coast is yours.' : `Survive ${Math.max(0, Math.ceil(90 - (challenge.time || 0)))}s, then lose all wanted stars.`,
    hint: 'Break line of sight. Alleys and the beach road buy you time.',
    target: null, progress: Math.min(1, (challenge.time || 0) / 90),
  };
  if (mode === 'roam') return { title: 'THE NIGHT IS YOURS', chapter: 'FREE ROAM / GILDED COAST', objective: 'Explore the coast. Open the radio to begin the story.', hint: 'F enters cars · Tab opens your radio · blue + signs refill supplies', target: null, progress: 0 };
  const job = storyJobs[story.job] || storyJobs[2];
  const views = {
    meet: ['Meet Mara outside the Moonroom diner.', 'Walk into the gold ring, then press F to talk.', places.mara, 0],
    car: ['Borrow the gold Sunbird coupe.', 'Find the car with the gold marker. Press F beside its door.', places.coupe, 0.18],
    cache: ['Recover the harbor ledger at Pier 8.', 'Drive north along Coast Avenue. Leave the car and press F at the case.', places.cache, 0.4],
    escape: ['Lose your police tail.', 'Leave the red search area and stay out of sight until the stars clear.', null, 0.62],
    deliver: ['Bring the ledger to Ivo’s garage.', 'Park nearby. Press F in the gold ring to hand it over.', places.garage, 0.82],
    relay: ['Clear the three armed relay lookouts.', 'Aim with your mouse. Fire with left click, reload with R.', places.relay, 0.22],
    transmitter: ['Take the surveillance transmitter.', 'Press F beside the relay console.', places.relay, 0.52],
    safe: ['Deliver the transmitter to the safehouse.', 'Lose the heat, then press F at the safehouse.', places.safe, 0.8],
    route: [`Collect dead drop ${story.checkpoint + 1} of 3. / ${Math.max(0, Math.ceil(180 - story.clock))}s left`, 'Drive through the gold ring before the dead-drop signal is cut.', checkpoints[Math.min(2, story.checkpoint)], 0.15 + story.checkpoint * 0.2],
    broadcast: ['Broadcast the evidence from the radio pier.', 'Leave your vehicle and press F at the transmitter. Make the city listen.', places.broadcast, 0.86],
    interlude: ['Job complete. A new voice is on the radio.', 'Press Tab for the next chapter. Your progress has been saved.', null, 1],
    ending: ['Gilded Coast heard the truth.', 'The story is complete. Keep exploring, or replay a job from the radio.', null, 1],
  };
  const [objective, hint, target, progress] = views[story.stage] || views.meet;
  return { title: job.title, chapter: job.subtitle, objective, hint, target, progress };
}

export function advanceStory(story, event) {
  const next = { ...story };
  const stage = story.stage;
  if (stage === 'meet' && event === 'talk') next.stage = 'car';
  if (stage === 'car' && event === 'coupe') next.stage = 'cache';
  if (stage === 'cache' && event === 'ledger') next.stage = 'escape';
  if (stage === 'escape' && event === 'clear') next.stage = 'deliver';
  if (stage === 'deliver' && event === 'handover') { next.stage = 'interlude'; next.completed = Math.max(1, next.completed); }
  if (stage === 'relay' && event === 'guards') next.stage = 'transmitter';
  if (stage === 'transmitter' && event === 'take') next.stage = 'safe';
  if (stage === 'safe' && event === 'handover') { next.stage = 'interlude'; next.completed = Math.max(2, next.completed); }
  if (stage === 'route' && event === 'drop') { next.checkpoint++; if (next.checkpoint >= 3) next.stage = 'broadcast'; }
  if (stage === 'broadcast' && event === 'broadcast') { next.stage = 'ending'; next.completed = 3; next.won = true; }
  return next;
}

export function startJob(story, job) {
  return { ...story, job, stage: ['meet', 'relay', 'route'][job], checkpoint: 0, clock: 0, won: false };
}

export function objectiveInReach(view, actor, range = 4.3) {
  return !!view.target && distance(view.target, actor) < range;
}

export const dialogue = {
  talk: ['MARA VALE', 'This coast used to belong to people. Now it belongs to a signature. Take the Sunbird. Pier 8 has the ledger that can change that.'],
  ledger: ['MARA / RADIO', 'That is it. Harbor security called it in. Lose the patrols before you bring it to Ivo.'],
  handover: ['IVO SERRANO', 'Every payment, every shell company. But the wiretap can bury us. There is a relay in the west quarter. We need its transmitter.'],
  take: ['IVO / RADIO', 'Got the signal. Bring it to the safehouse. No company, please.'],
  decoded: ['MARA / RADIO', 'Three dead drops. One broadcast. We make it before the coast falls asleep.'],
  broadcast: ['AFTER HOURS / 88.4 FM', 'You are listening to Gilded Coast. Tonight, the names behind the waterfront deal are on every radio. Some things are still worth stealing back.'],
};
