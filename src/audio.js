// Original procedural sound: a laid-back electric-piano score with walking
// bass and brushed hats, a city ambience bed that follows traffic and time
// of day, and short effects. Nothing is downloaded and nothing plays until
// the player switches sound on.
export class CityAudio {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.timer = null;
    this.step = 0;
    this.next = 0;
    this.ambience = { traffic: 0, population: 0, night: false };
    this.bar = 0;
  }

  async toggle() {
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      this.context = new Audio();
      this.master = this.context.createGain();
      this.master.gain.value = 0.07;
      this.master.connect(this.context.destination);
      this.music = this.context.createGain();
      this.music.gain.value = 1;
      this.music.connect(this.master);
      this.buildAmbience();
    }
    this.enabled = !this.enabled;
    if (this.enabled) {
      await this.context.resume();
      this.next = this.context.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 120);
      this.schedule();
      this.applyAmbience();
    } else {
      clearInterval(this.timer);
      this.timer = null;
      await this.context.suspend();
    }
    return this.enabled;
  }

  // Filtered noise bed: distant traffic hum plus a soft breeze.
  buildAmbience() {
    const ctx = this.context;
    const seconds = 3;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const hum = ctx.createBiquadFilter(); hum.type = "lowpass"; hum.frequency.value = 180; hum.Q.value = 0.7;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    src.connect(hum); hum.connect(this.humGain); this.humGain.connect(this.master);
    const breeze = ctx.createBiquadFilter(); breeze.type = "bandpass"; breeze.frequency.value = 900; breeze.Q.value = 0.5;
    this.breezeGain = ctx.createGain(); this.breezeGain.gain.value = 0.05;
    src.connect(breeze); breeze.connect(this.breezeGain); this.breezeGain.connect(this.master);
    src.start();
  }

  // Called by the game each month with the current city mood.
  setAmbience(state) {
    this.ambience = { ...this.ambience, ...state };
    this.applyAmbience();
  }
  applyAmbience() {
    if (!this.context || !this.humGain) return;
    const t = this.context.currentTime;
    const a = this.ambience;
    const hum = Math.min(0.6, 0.05 + a.traffic / 120 + Math.min(0.25, a.population / 200000)) * (a.night ? 0.6 : 1);
    this.humGain.gain.setTargetAtTime(hum, t, 0.8);
    this.breezeGain.gain.setTargetAtTime(a.night ? 0.03 : 0.06, t, 0.8);
  }

  note(midi, time, duration, gain = 0.3, type = "sine", dest = this.music) {
    if (!this.context) return;
    const osc = this.context.createOscillator(), env = this.context.createGain();
    osc.type = type;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(env); env.connect(dest);
    osc.start(time); osc.stop(time + duration + 0.03);
    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }

  // Brushed hat: a short burst of filtered noise.
  hat(time, gain = 0.05, open = false) {
    const ctx = this.context;
    const len = open ? 0.18 : 0.06;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000;
    const env = ctx.createGain(); env.gain.value = gain;
    src.connect(hp); hp.connect(env); env.connect(this.music);
    src.start(time);
    src.onended = () => { src.disconnect(); hp.disconnect(); env.disconnect(); };
  }

  // Eight bars of ii–V–I colour in F, swung sixteenths.
  schedule() {
    if (!this.enabled || document.hidden) return;
    const ctx = this.context;
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    const chords = [
      [50, 53, 57, 60], [43, 47, 50, 53], [48, 52, 55, 57], [48, 52, 55, 59],
      [53, 57, 60, 64], [46, 50, 53, 57], [50, 53, 57, 60], [43, 47, 50, 53],
    ];
    const bassLines = [
      [38, 41, 45, 48], [31, 35, 38, 41], [36, 40, 43, 47], [36, 40, 43, 45],
      [41, 45, 48, 52], [34, 38, 41, 45], [38, 41, 45, 47], [31, 35, 38, 43],
    ];
    const step = 60 / 96 / 4; // 96 bpm sixteenths
    while (this.next < ctx.currentTime + 0.4) {
      const beat = this.step % 16, bar = Math.floor(this.step / 16) % 8;
      const chord = chords[bar], bass = bassLines[bar];
      const swing = beat % 2 ? step * 0.32 : 0;
      const t = this.next + swing;
      if (beat === 0 || beat === 10) for (let i = 0; i < 4; i++) this.note(chord[i], t + i * 0.012, beat === 0 ? 1.4 : 0.8, 0.13);
      if (beat % 4 === 0) this.note(bass[beat / 4], t, 0.5, 0.32, "triangle");
      if (beat % 2 === 0) this.hat(t, beat % 8 === 4 ? 0.06 : 0.035, beat === 12);
      if ([2, 7, 9, 14].includes(beat) && (bar + beat) % 3 !== 0) this.note(chord[(beat + bar) % 4] + 12, t, 0.35, 0.09);
      if (beat === 15 && bar % 2 === 1) this.note(chord[2] + 12, t, 0.3, 0.07);
      this.next += step;
      this.step++;
    }
    // Occasional birdsong by day, a distant horn in heavy traffic.
    if (Math.random() < 0.06 && !this.ambience.night) {
      const t = ctx.currentTime + Math.random() * 0.3;
      for (let i = 0; i < 3; i++) this.note(88 + Math.floor(Math.random() * 6), t + i * 0.09, 0.08, 0.05, "sine", this.master);
    }
    if (Math.random() < this.ambience.traffic / 900) {
      const t = ctx.currentTime;
      this.note(58, t, 0.25, 0.06, "sawtooth", this.master);
      this.note(62, t, 0.25, 0.04, "sawtooth", this.master);
    }
  }

  effect(kind = "click") {
    if (!this.enabled) return;
    const t = this.context.currentTime;
    if (kind === "build") { this.note(48, t, 0.09, 0.2, "triangle", this.master); this.note(55, t + 0.055, 0.16, 0.12, "sine", this.master); }
    else if (kind === "error") this.note(38, t, 0.12, 0.2, "triangle", this.master);
    else if (kind === "disaster") { for (let i = 0; i < 6; i++) this.note(30 - i, t + i * 0.12, 0.6, 0.25, "sawtooth", this.master); }
    else if (kind === "siren") { for (let i = 0; i < 4; i++) { this.note(72, t + i * 0.5, 0.25, 0.08, "square", this.master); this.note(79, t + i * 0.5 + 0.25, 0.25, 0.08, "square", this.master); } }
    else if (kind === "cash") { this.note(76, t, 0.12, 0.12, "sine", this.master); this.note(83, t + 0.08, 0.2, 0.1, "sine", this.master); }
    else this.note(72, t, 0.06, 0.12, "triangle", this.master);
  }
}
