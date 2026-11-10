// Tastatur + Maus in Spielkoordinaten. endFrame() nach jedem Update-Schritt aufrufen.
export function createInput(canvas, W, H) {
  const inp = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: W / 2, y: H / 2, down: false, clicked: false, released: false },
    wheel: 0,
    down(code) { return this.keys.has(code); },
    hit(code) { return this.pressed.has(code); },
    endFrame() {
      this.pressed.clear();
      this.mouse.clicked = false;
      this.mouse.released = false;
      this.wheel = 0;
    },
  };

  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) inp.pressed.add(e.code);
    inp.keys.add(e.code);
  });
  addEventListener('keyup', (e) => inp.keys.delete(e.code));
  addEventListener('blur', () => { inp.keys.clear(); inp.mouse.down = false; });

  addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    inp.mouse.x = ((e.clientX - r.left) / r.width) * W;
    inp.mouse.y = ((e.clientY - r.top) / r.height) * H;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    inp.mouse.down = true;
    inp.mouse.clicked = true;
  });
  addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !inp.mouse.down) return;
    inp.mouse.down = false;
    inp.mouse.released = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    inp.wheel += Math.sign(e.deltaY);
  }, { passive: false });

  return inp;
}
