// Pixelgenaue Zeichenhelfer ohne Antialiasing
export const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// Rechteck mit inklusiven Koordinaten (wie in den Mockups), optional mit 1px-Kontur
export function rect(ctx, x0, y0, x1, y1, fill, outline = null) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (outline) {
    ctx.fillStyle = outline; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = fill; ctx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
  } else {
    ctx.fillStyle = fill; ctx.fillRect(x0, y0, w, h);
  }
}

// Mischt c2 in c1 per Bayer-Matrix, t = Anteil von c2 (0..1)
export function ditherRect(ctx, x0, y0, x1, y1, c1, c2, t) {
  ctx.fillStyle = c1; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = c2;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) if (BAYER[y & 3][x & 3] < t * 16) ctx.fillRect(x, y, 1, 1);
  }
}

export function fillPoly(ctx, pts, col) {
  ctx.fillStyle = col;
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const sy = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + (sy - y1) / (y2 - y1) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
      if (b > a) ctx.fillRect(a, y, b - a, 1);
    }
  }
}

export function fillEllipse(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

// Gepunkteter Ring, phase dreht ihn
export function ring(ctx, cx, cy, r, col, step = 0.35, phase = 0) {
  ctx.fillStyle = col;
  for (let a = 0; a < Math.PI * 2 - 0.01; a += step) {
    ctx.fillRect(Math.round(cx + Math.cos(a + phase) * r), Math.round(cy + Math.sin(a + phase) * r), 1, 1);
  }
}

// Bresenham-Linie, dash = Länge von Strich und Lücke (0 = durchgehend)
export function line(ctx, x0, y0, x1, y1, col, dash = 0, size = 1) {
  ctx.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  for (;;) {
    if (!dash || ((n / dash) | 0) % 2 === 0) ctx.fillRect(x0, y0, size, size);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    n++;
  }
}

// Deterministischer Zufall für vorgerenderte Hintergründe
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
