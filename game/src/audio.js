// Sound, synthesized live with WebAudio — no audio files, no network. A
// low engine drone whose pitch follows the throttle, a bright chime when a
// ring is flown, a dull thud on a crash, and a little fanfare when a leg is
// completed. Everything is created on first user gesture (browsers require
// it) and silenced with M.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine drone: two detuned saws through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 58;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    osc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    osc2.start();
    this._engineOsc2 = osc2;
  }

  setEngine(throttle, airborne) {
    if (!this.ctx || !this.engineGain) return;
    const target = this.muted ? 0 : airborne ? 0.02 + throttle * 0.05 : 0.012;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    const freq = 48 + throttle * 55;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    if (this._engineOsc2) this._engineOsc2.frequency.setTargetAtTime(freq * 1.01, this.ctx.currentTime, 0.1);
  }

  _tone(freq, dur, type, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  ring() {
    this._tone(880, 0.18, 'sine', 0.16);
    this._tone(1318, 0.28, 'sine', 0.14, 0.07);
  }

  fuel() {
    this._tone(659, 0.15, 'triangle', 0.14);
    this._tone(988, 0.22, 'triangle', 0.12, 0.06);
  }

  crash() {
    this._tone(110, 0.4, 'square', 0.2);
    this._tone(55, 0.5, 'sawtooth', 0.18, 0.05);
  }

  legComplete() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.3, 'triangle', 0.15, i * 0.09));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.04, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }
}
