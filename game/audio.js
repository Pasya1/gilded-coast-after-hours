export class CoastAudio {
  constructor() { this.context = null; this.muted = false; this.lastBeat = 0; this.lastNote = -1; this.note = 0; }
  unlock() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
      this.master = this.context.createGain(); this.master.gain.value = 0.18; this.master.connect(this.context.destination);
      this.engine = this.context.createOscillator(); this.engine.type = 'sawtooth';
      this.engineGain = this.context.createGain(); this.engineGain.gain.value = 0;
      const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 320;
      this.engine.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master); this.engine.start();
    }
    this.context.resume();
  }
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.18; return this.muted; }
  tone(frequency, duration = 0.12, type = 'sine', volume = 0.3, end = frequency) {
    if (!this.context) return;
    const t = this.context.currentTime, oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, t); oscillator.frequency.exponentialRampToValueAtTime(Math.max(12, end), t + duration);
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(t); oscillator.stop(t + duration + 0.02);
  }
  effect(kind) {
    if (kind === 'shot') { this.tone(145, 0.09, 'sawtooth', 0.8, 32); this.tone(1800, 0.025, 'square', 0.17, 160); }
    if (kind === 'hit') this.tone(88, 0.16, 'triangle', 0.7, 27);
    if (kind === 'reload') { this.tone(620, 0.06, 'square', 0.12, 440); setTimeout(() => this.tone(870, 0.07, 'square', 0.13), 220); }
    if (kind === 'enter') this.tone(180, 0.18, 'triangle', 0.5, 84);
    if (kind === 'alert') { this.tone(490, 0.2, 'square', 0.16, 330); }
    if (kind === 'reward') [523, 659, 784, 1046].forEach((note, i) => setTimeout(() => this.tone(note, 0.26, 'sine', 0.28), i * 100));
    if (kind === 'ui') this.tone(720, 0.06, 'sine', 0.2, 900);
  }
  update(time, speed, driving, policeDistance, active) {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(38 + Math.abs(speed) * 5, t, 0.12);
    this.engineGain.gain.setTargetAtTime(driving && active ? 0.15 + Math.abs(speed) * 0.003 : 0, t, 0.08);
    if (active && policeDistance < 75 && time - this.lastBeat > 0.38) {
      this.lastBeat = time; this.tone(Math.floor(time * 2.6) % 2 ? 560 : 780, 0.32, 'sine', 0.11 * (1 - policeDistance / 90));
    }
    if (active && policeDistance >= 75 && (time < this.lastNote || time - this.lastNote > 0.72)) {
      // An original, sparse eight-note radio motif, synthesized rather than sampled.
      const motif = [174.61, 220, 261.63, 293.66, 261.63, 220, 196, 146.83];
      this.lastNote = time; this.tone(motif[this.note++ % motif.length], 0.65, 'triangle', 0.045);
    }
  }
}
