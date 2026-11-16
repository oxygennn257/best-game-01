// All sound is synthesised with WebAudio — no audio files, no network.
// The context is created lazily on the first user gesture (browsers block
// audio before interaction). Every effect is a short oscillator/noise burst.

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.2, lowpass = 1200, delay = 0) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  shoot() { tone(720, 0.08, 'square', 0.08, 320); },
  hit() { noise(0.06, 0.12, 2400); },
  boom() { noise(0.35, 0.28, 700); tone(110, 0.3, 'sine', 0.22, 38); },
  pickup() { tone(880, 0.09, 'sine', 0.14, 1320); },
  hurt() { tone(180, 0.25, 'sawtooth', 0.16, 70); noise(0.15, 0.14, 900); },
  wave() { tone(392, 0.16, 'triangle', 0.18); tone(523, 0.22, 'triangle', 0.18, null, 0.14); },
  buy() { tone(660, 0.08, 'triangle', 0.16); tone(990, 0.12, 'triangle', 0.16, null, 0.07); },
  denied() { tone(160, 0.14, 'square', 0.12, 110); },
  over() {
    tone(392, 0.3, 'triangle', 0.18);
    tone(311, 0.3, 'triangle', 0.18, null, 0.28);
    tone(233, 0.55, 'triangle', 0.2, null, 0.56);
  },
  win() {
    tone(523, 0.16, 'triangle', 0.18);
    tone(659, 0.16, 'triangle', 0.18, null, 0.14);
    tone(784, 0.3, 'triangle', 0.2, null, 0.28);
  },
};

// A quiet two-note lantern drone that hums while the game runs. Started once
// per session after the first gesture; kept very low so it never tires.
let droneOn = false;
export function startDrone() {
  const c = ensure();
  if (!c || droneOn || muted) return;
  droneOn = true;
  const g = c.createGain();
  g.gain.value = 0.035;
  g.connect(master);
  for (const [freq, detune] of [[110, 0], [164.8, 4], [220, -3]]) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(g);
    osc.start();
  }
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);
  lfo.start();
}
