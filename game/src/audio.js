// Audio: WebAudio synth music (~100 BPM, A minor) + SFX. Zero audio files.
import { TUNE } from './config.js';

const NOTE = { A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, C5: 523.25, E5: 659.25 };

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this._step = 0;
    this._nextT = 0;
    this._timer = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this._startMusic();
    this._startEngine();
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }
  // ---- music: 8-step loop, A minor, ~100 BPM ----
  _startMusic() {
    const spb = 60 / TUNE.musicBpm / 2; // 8th notes
    this._nextT = this.ctx.currentTime + 0.1;
    const bassLine = [NOTE.A2, NOTE.A2, NOTE.C3, NOTE.E3, NOTE.A2, NOTE.A2, NOTE.G3, NOTE.E3];
    const padChords = [[NOTE.A3, NOTE.C4, NOTE.E4], [NOTE.A3, NOTE.C4, NOTE.E4], [NOTE.C4, NOTE.E4, NOTE.G4], [NOTE.A3, NOTE.C4, NOTE.E4]];
    const arp = [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.C5, NOTE.A4, NOTE.E5, NOTE.G4, NOTE.E4];
    const tick = () => {
      if (!this.ctx) return;
      while (this._nextT < this.ctx.currentTime + 0.25) {
        const i = this._step % 8;
        this._note(bassLine[i], this._nextT, spb * 0.95, 'triangle', 0.34);
        if (i % 4 === 0) {
          const ch = padChords[(this._step / 4) % 4 | 0];
          for (const n of ch) this._note(n, this._nextT, spb * 3.6, 'sine', 0.07);
        }
        if (this._step % 2 === 0) this._note(arp[i], this._nextT, spb * 0.7, 'square', 0.045);
        // hat tick
        this._hat(this._nextT);
        this._nextT += spb;
        this._step++;
      }
      this._timer = setTimeout(tick, 90);
    };
    tick();
  }
  _note(freq, t, dur, type, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _hat(t) {
    const len = 0.04;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(t);
  }
  // ---- engine hum ----
  _startEngine() {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 42;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = this.ctx.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(this.sfxGain);
    o.start();
    this.engineOsc = o; this.engineGain = g;
  }
  setEngine(speed, inCar) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = inCar ? 0.05 + Math.min(0.12, Math.abs(speed) * 0.0028) : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.12);
    this.engineOsc.frequency.setTargetAtTime(42 + Math.abs(speed) * 1.6, t, 0.1);
  }
  // ---- siren ----
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      const g = this.ctx.createGain(); g.gain.value = 0.035;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.55;
      const lg = this.ctx.createGain(); lg.gain.value = 220;
      lfo.connect(lg); lg.connect(o.frequency);
      o.frequency.value = 780;
      o.connect(g); g.connect(this.sfxGain);
      o.start(); lfo.start();
      this.sirenOsc = o; this.sirenGain = g; this._sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch (e) { /* noop */ }
      this.sirenOsc = null; this.sirenGain = null;
    }
  }
  // ---- one-shots ----
  _burst(dur, type, freq, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }
  shot() { this._noise(0.12, 0.5, 2400, 'highpass'); this._burst(0.09, 'square', 160, 0.28, 60); }
  reload() { this._burst(0.07, 'square', 520, 0.12, 380); setTimeout(() => this._burst(0.07, 'square', 700, 0.12, 520), 140); }
  hit() { this._burst(0.08, 'sine', 880, 0.2, 660); }
  pickup() { this._burst(0.12, 'sine', 660, 0.2, 990); setTimeout(() => this._burst(0.14, 'sine', 990, 0.2, 1320), 110); }
  crash() { this._noise(0.25, 0.5, 300); this._burst(0.22, 'sine', 90, 0.4, 40); }
  click() { this._burst(0.05, 'square', 900, 0.1, 700); }
  busted() { this._burst(0.5, 'sawtooth', 220, 0.2, 110); }
  wasted() { this._burst(0.8, 'sawtooth', 180, 0.22, 55); }
  mission() { this._burst(0.16, 'sine', 523, 0.2, 784); setTimeout(() => this._burst(0.2, 'sine', 784, 0.2, 1046), 150); }
}
