// Skaliert das Canvas ganzzahlig auf die größtmögliche Fenstergröße
export function fitCanvas(canvas, W, H) {
  const fit = () => {
    const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
  };
  addEventListener('resize', fit);
  fit();
}

// Fester Zeitschritt für die Logik, Rendern einmal pro Frame
export function startLoop(update, render, step = 1 / 60) {
  let acc = 0, last = performance.now();
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= step) { update(step); acc -= step; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
