// sound.js — tiny WebAudio sounds, generated in code. No audio files, no
// network, nothing to load: a few oscillators and a noise burst stand in for
// a whole sound bank. Sound starts only after a user gesture.

let audioCtx = null;
let muted = false;

export function setMuted(value) { muted = value; return muted; }
export function isMuted() { return muted; }

function ensureAudio() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, type, gain, when = 0) {
  const ctx = ensureAudio();
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function splash() {
  const ctx = ensureAudio();
  if (!ctx || muted) return;
  const dur = 0.25;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const amp = ctx.createGain();
  amp.gain.value = 0.18;
  src.connect(filter).connect(amp).connect(ctx.destination);
  src.start();
}

export function playCardSound() { tone(520, 0.12, 'triangle', 0.22); tone(780, 0.1, 'sine', 0.12, 0.04); }
export function playDrawSound() { tone(340, 0.08, 'sine', 0.12); }
export function playSurgeSound() { tone(660, 0.1, 'sine', 0.15); tone(990, 0.12, 'sine', 0.12, 0.06); }
export function playHookSound() { tone(220, 0.18, 'sawtooth', 0.1); splash(); }
export function playTideSound() { splash(); tone(180, 0.5, 'sine', 0.2); tone(360, 0.4, 'sine', 0.12, 0.12); }
export function playHitSound() { tone(140, 0.2, 'square', 0.16); }
export function playScoreSound() { tone(523, 0.12, 'triangle', 0.18); tone(659, 0.12, 'triangle', 0.18, 0.09); tone(784, 0.2, 'triangle', 0.18, 0.18); }
export function playWinFanfare() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, i * 0.13));
  tone(1318, 0.6, 'sine', 0.14, 0.55);
}
export function playLoseSound() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.16, i * 0.16)); }
export function unlockAudio() { ensureAudio(); }
