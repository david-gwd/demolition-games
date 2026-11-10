// Palette aus DANGER_DAYS_BIBLE.md §4.2 (aus den Inspirationsbildern gemessen)
export const RGB = {
  ink: [27, 25, 24], paper: [229, 227, 224],
  y: [242, 210, 27], yd: [216, 180, 44],
  g: [75, 196, 48], lime: [189, 220, 39],
  b: [34, 161, 226], bd: [19, 84, 195],
  r: [193, 56, 39], o: [224, 84, 23], pink: [214, 48, 87],
  sky: [85, 155, 147], skyf: [111, 139, 119], skyl: [161, 196, 178], skyp: [200, 214, 190],
  sand: [223, 213, 163], ochre: [207, 167, 89], shadow: [186, 160, 104],
  rust: [150, 86, 30], rustd: [96, 43, 15], mustard: [236, 171, 37],
  white: [255, 255, 255], grey: [190, 190, 186], dgrey: [110, 108, 104], black: [17, 17, 17],
  skin: [226, 172, 128], pale: [214, 204, 196], denim: [52, 64, 110], suit: [52, 50, 56],
  cactus: [92, 140, 78], cactusd: [58, 96, 56],
  asphalt: [84, 76, 70], asphaltl: [104, 95, 86], mint: [146, 190, 168],
};

const css = ([r, g, b]) => `rgb(${r},${g},${b})`;

export const C = Object.fromEntries(Object.entries(RGB).map(([k, v]) => [k, css(v)]));

// Mischt zwei Palettenfarben, f = 0 → a, f = 1 → b
export function mix(a, b, f) {
  const A = RGB[a], B = RGB[b];
  return css(A.map((v, i) => Math.round(v + (B[i] - v) * f)));
}
