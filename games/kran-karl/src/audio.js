// Alle Sounds werden per WebAudio synthetisiert – keine Dateien nötig
let ac = null;
let master = null;
let noiseBuf = null;
let muted = false;
let volume = 0.8;

export function unlockAudio() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.375 * volume;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

// v: 0..1 (Optionen)
export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = 0.375 * volume;
}

const ready = () => ac && !muted && volume > 0;

function tone(freq, { to = freq, type = 'sine', dur = 0.15, vol = 0.4, delay = 0 } = {}) {
  if (!ready()) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.3, vol = 0.4, freq = 1000, to = freq, filter = 'lowpass', delay = 0 } = {}) {
  if (!ready()) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  grab() {
    tone(320, { to: 520, type: 'square', dur: 0.07, vol: 0.15 });
    tone(640, { type: 'square', dur: 0.05, vol: 0.1, delay: 0.07 });
  },
  release() { tone(520, { to: 260, type: 'triangle', dur: 0.12, vol: 0.25 }); },
  nope() { tone(160, { to: 120, type: 'square', dur: 0.15, vol: 0.15 }); },
  land() {
    noise({ dur: 0.18, vol: 0.5, freq: 600, to: 150 });
    tone(110, { to: 50, dur: 0.22, vol: 0.5 });
  },
  perfect(combo) {
    sfx.land();
    const base = 523 * 2 ** ((Math.min(combo, 8) - 1) / 12);
    [0, 4, 7, 12].forEach((s, i) => tone(base * 2 ** (s / 12), { type: 'triangle', dur: 0.18, vol: 0.22, delay: 0.05 + i * 0.07 }));
  },
  tip() { tone(300, { to: 110, type: 'sawtooth', dur: 0.4, vol: 0.12 }); },
  splash() {
    noise({ dur: 0.7, vol: 0.6, freq: 2500, to: 200 });
    tone(200, { to: 60, dur: 0.3, vol: 0.3 });
  },
  gull() {
    tone(1100, { to: 700, type: 'sawtooth', dur: 0.12, vol: 0.12 });
    tone(1200, { to: 650, type: 'sawtooth', dur: 0.14, vol: 0.12, delay: 0.15 });
  },
  glass() {
    noise({ dur: 0.5, vol: 0.4, freq: 3000, to: 6000, filter: 'highpass' });
    for (let i = 0; i < 5; i++) tone(2000 + Math.random() * 3000, { dur: 0.15, vol: 0.08, delay: i * 0.05 + Math.random() * 0.05 });
  },
  clang() {
    tone(180, { to: 170, type: 'triangle', dur: 0.3, vol: 0.25 });
    noise({ dur: 0.08, vol: 0.2, freq: 2000 });
  },
  horn() {
    tone(98, { type: 'sawtooth', dur: 1.6, vol: 0.18 });
    tone(147, { type: 'sawtooth', dur: 1.6, vol: 0.12 });
  },
  tick() {
    tone(880, { type: 'square', dur: 0.05, vol: 0.1 });
    tone(880, { type: 'square', dur: 0.05, vol: 0.1, delay: 0.2 });
  },
  star() { [0, 7, 12].forEach((s, i) => tone(660 * 2 ** (s / 12), { type: 'triangle', dur: 0.2, vol: 0.2, delay: i * 0.08 })); },
  buy() {
    tone(880, { type: 'square', dur: 0.06, vol: 0.12 });
    tone(1320, { type: 'square', dur: 0.14, vol: 0.12, delay: 0.07 });
  },
  move() { tone(500, { type: 'square', dur: 0.03, vol: 0.06 }); },
  thunder() {
    noise({ dur: 1.4, vol: 0.7, freq: 400, to: 60 });
    tone(70, { to: 35, dur: 1.0, vol: 0.4, delay: 0.05 });
  },
  boatHorn() {
    tone(220, { type: 'sawtooth', dur: 0.25, vol: 0.14 });
    tone(220, { type: 'sawtooth', dur: 0.5, vol: 0.14, delay: 0.35 });
  },
  truck() { noise({ dur: 0.6, vol: 0.25, freq: 180, to: 320 }); },
  refill() { tone(400, { to: 600, type: 'triangle', dur: 0.1, vol: 0.15 }); },
  win() { [0, 4, 7, 12, 16].forEach((s, i) => tone(440 * 2 ** (s / 12), { type: 'square', dur: 0.15, vol: 0.12, delay: i * 0.1 })); },
  crush() {
    noise({ dur: 0.35, vol: 0.6, freq: 900, to: 120 });
    tone(90, { to: 40, type: 'square', dur: 0.3, vol: 0.25 });
  },
  shatter() {
    noise({ dur: 0.3, vol: 0.35, freq: 4000, to: 7000, filter: 'highpass' });
    for (let i = 0; i < 4; i++) tone(2500 + i * 700, { dur: 0.08, vol: 0.07, delay: i * 0.04 });
  },
  thaw() { tone(400, { to: 120, type: 'sine', dur: 0.6, vol: 0.2 }); },
  plug() {
    tone(1200, { type: 'square', dur: 0.04, vol: 0.08 });
    tone(1600, { type: 'square', dur: 0.05, vol: 0.08, delay: 0.05 });
  },
  whistle() {
    tone(2200, { to: 2400, type: 'sine', dur: 0.18, vol: 0.18 });
    tone(2200, { to: 2600, type: 'sine', dur: 0.35, vol: 0.18, delay: 0.22 });
  },
  monkey() {
    for (let i = 0; i < 3; i++) tone(700 + i * 90, { to: 1100, type: 'square', dur: 0.07, vol: 0.08, delay: i * 0.09 });
  },
  crack() { noise({ dur: 0.25, vol: 0.4, freq: 2500, to: 600, filter: 'bandpass' }); },
  feederHorn() {
    tone(196, { type: 'sawtooth', dur: 0.9, vol: 0.14 });
    tone(262, { type: 'sawtooth', dur: 0.9, vol: 0.1 });
  },
  wind() { noise({ dur: 1.2, vol: 0.25, freq: 300, to: 900, filter: 'bandpass' }); },
  achievement() { [0, 4, 7, 11, 12].forEach((s, i) => tone(784 * 2 ** (s / 12), { type: 'triangle', dur: 0.16, vol: 0.18, delay: i * 0.07 })); },
  page() { noise({ dur: 0.12, vol: 0.2, freq: 3000, to: 1500, filter: 'highpass' }); },
  over() { [7, 4, 0, -5].forEach((s, i) => tone(330 * 2 ** (s / 12), { type: 'sawtooth', dur: 0.3, vol: 0.12, delay: i * 0.22 })); },
};
