const KEY = 'kran-karl-settings';

// Pro Aktion zwei Tasten: die erste lässt sich in den Optionen neu belegen
export const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  action: ['Space', 'Enter'],
  spreader: ['KeyE', 'KeyQ'],
  pause: ['KeyP', 'Backspace'],
};

export const KEY_NAMES = {
  left: 'Links', right: 'Rechts', up: 'Seil hoch', down: 'Seil runter',
  action: 'Greifen / Los', spreader: 'Doppelgriff', pause: 'Pause',
};

const fresh = () => ({
  volume: 0.8,
  easy: false,
  ghost: true,
  keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)),
});

// Einstellungen (Ton, Tasten, Einsteigermodus, Geist) – getrennt vom Spielstand
export const settings = (() => {
  let s = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') s = { ...s, ...raw, keys: { ...s.keys, ...raw.keys } };
  } catch { /* egal */ }
  return s;
})();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* egal */ }
}

export function resetKeys() {
  settings.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
  saveSettings();
}

// Taste (KeyboardEvent.code) -> Aktion
export function actionFor(code) {
  if (code === 'Escape') return 'back';
  for (const [k, codes] of Object.entries(settings.keys)) if (codes.includes(code)) return k;
  return null;
}

export function keyLabel(code) {
  const special = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    Space: 'Leertaste', Enter: 'Enter', Backspace: 'Rück', ShiftLeft: 'Shift', ShiftRight: 'Shift',
    ControlLeft: 'Strg', ControlRight: 'Strg', Tab: 'Tab',
  };
  if (special[code]) return special[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
