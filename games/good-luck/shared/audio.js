// Synthetische Soundeffekte per WebAudio, keine Asset-Dateien
let ac = null, master = null, noiseBuf = null, muted = false;
const VOLUME = 0.22;

export function unlockAudio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ac.destination);
    } catch (e) { return; }
  }
  if (ac.state === 'suspended') ac.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : VOLUME;
  return muted;
}
export const isMuted = () => muted;

function tone(type, f0, f1, dur, vol = 0.5, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, freq = 1200, delay = 0) {
  if (!ac || muted) return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + dur);
}

export const sfx = {
  zap: (pitch = 1) => tone('square', 880 * pitch, 220 * pitch, 0.08, 0.16),
  heavy: (charge = 0) => { tone('sawtooth', 260 + charge * 220, 60, 0.22, 0.3); noise(0.15, 0.2, 2000); },
  bounce: () => tone('triangle', 1200, 600, 0.05, 0.12),
  hit: () => tone('square', 300, 120, 0.06, 0.16),
  tink: () => tone('triangle', 2400, 1800, 0.06, 0.16),
  kill: () => { noise(0.25, 0.32, 1800); tone('square', 220, 55, 0.2, 0.18); },
  boom: () => { noise(0.7, 0.5, 1400); tone('sine', 120, 30, 0.6, 0.5); },
  hurt: () => { tone('sawtooth', 200, 50, 0.3, 0.32); noise(0.2, 0.3, 900); },
  swap: () => { tone('square', 500, 900, 0.05, 0.1); tone('square', 900, 1300, 0.05, 0.08, 0.05); },
  dash: () => noise(0.12, 0.18, 3000),
  pickup: () => [523, 659, 784].forEach((f, i) => tone('square', f, f, 0.08, 0.13, i * 0.07)),
  wave: () => [392, 523, 659, 784].forEach((f, i) => tone('square', f, f * 1.01, 0.1, 0.12, i * 0.09)),
  enemyShot: () => tone('sine', 620, 300, 0.08, 0.06),
  telegraph: () => tone('square', 160, 160, 0.12, 0.08),
  alarm: () => [0, 0.25, 0.5].forEach((d) => tone('sawtooth', 440, 330, 0.2, 0.16, d)),
  over: () => [392, 330, 262, 196].forEach((f, i) => tone('square', f, f * 0.98, 0.22, 0.14, i * 0.2)),
};
