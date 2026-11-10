// localStorage kann fehlen oder werfen (private Fenster) – dann gibt es eben keinen Highscore
export function loadNum(key, fallback = 0) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : Number(v) || fallback;
  } catch (e) {
    return fallback;
  }
}

export function saveNum(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) { /* egal */ }
}
