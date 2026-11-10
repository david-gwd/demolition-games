import { W, H } from './config.js';
import { actionFor } from './settings.js';

const DIRS = ['left', 'right', 'up', 'down'];
// Standard-Gamepad: A=0, B=1, X=2, Start=9, Steuerkreuz 12–15
const PAD = { action: 0, back: 1, spreader: 2, pause: 9, up: 12, down: 13, left: 14, right: 15 };

// Gehaltene Richtungen in `held`, die Aktion (Greifen/Loslassen) als einmaliges Ereignis.
// Für Menüs zusätzlich: einzelne Tastendrücke (`presses`) und Tipp-Position in Spielfeld-Pixeln (`tap`).
// Tastatur, Touch-Knöpfe und Gamepad landen alle hier.
export class Input {
  constructor(canvas, buttons, { onFirst, onMute, onBlur }) {
    this.held = { left: false, right: false, up: false, down: false };
    this.keys = { left: false, right: false, up: false, down: false };
    this.pad = { left: false, right: false, up: false, down: false };
    this.padPrev = {};
    this.pending = false;
    this.presses = [];
    this.tap = null;
    this.capture = null; // Optionen: nächste Taste geht an diesen Callback

    window.addEventListener('keydown', e => {
      onFirst();
      if (this.capture) {
        e.preventDefault();
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
      if (e.code === 'KeyM') { onMute(); return; }
      const k = actionFor(e.code);
      if (!k) return;
      e.preventDefault();
      if (k === 'action') { if (!e.repeat) this.pending = true; return; }
      if (!e.repeat) this.presses.push(k);
      if (k in this.keys) this.keys[k] = true;
    });
    window.addEventListener('keyup', e => {
      const k = actionFor(e.code);
      if (k in this.keys) this.keys[k] = false;
    });
    window.addEventListener('blur', () => {
      for (const k in this.keys) this.keys[k] = false;
      onBlur?.();
    });

    canvas.addEventListener('pointerdown', e => {
      onFirst();
      const r = canvas.getBoundingClientRect();
      this.tap = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
      this.pending = true;
    });

    buttons.forEach(btn => {
      const k = btn.dataset.key;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        onFirst();
        btn.classList.add('on');
        if (k === 'mute') onMute();
        else if (k === 'action') this.pending = true;
        else {
          this.presses.push(k);
          if (k in this.keys) this.keys[k] = true;
        }
      });
      const up = () => {
        btn.classList.remove('on');
        if (k in this.keys) this.keys[k] = false;
      };
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, up));
    });
  }

  // Einmal pro Frame: Gamepad abfragen und gehaltene Richtungen zusammenführen
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find(p => p && p.connected);
    const now = {};
    if (gp) {
      const b = i => !!gp.buttons[i]?.pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      for (const [k, i] of Object.entries(PAD)) now[k] = b(i);
      now.left ||= ax < -0.5;
      now.right ||= ax > 0.5;
      now.up ||= ay < -0.5;
      now.down ||= ay > 0.5;
      for (const k of Object.keys(PAD)) {
        if (!now[k] || this.padPrev[k]) continue;
        if (k === 'action') this.pending = true;
        else this.presses.push(k);
      }
    }
    this.padPrev = now;
    for (const k of DIRS) {
      this.pad[k] = !!now[k];
      this.held[k] = this.keys[k] || this.pad[k];
    }
  }

  captureNext(cb) { this.capture = cb; }

  takePresses() {
    const p = this.presses;
    this.presses = [];
    return p;
  }

  takeTap() {
    const t = this.tap;
    this.tap = null;
    return t;
  }

  takeAction() {
    const a = this.pending;
    this.pending = false;
    return a;
  }
}
