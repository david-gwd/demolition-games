import { C } from '../shared/palette.js';
import { fillEllipse, rect, line } from '../shared/draw.js';
import { drawText, drawTextCentered, textWidth } from '../shared/pixelfont.js';
import { Particles, Bursts, Floaters, Shake, makeOverlay } from '../shared/fx.js';
import { createInput } from '../shared/input.js';
import { fitCanvas, startLoop } from '../shared/loop.js';
import { sfx, unlockAudio, toggleMute } from '../shared/audio.js';
import { loadNum, saveNum } from '../shared/store.js';
import { W, H, buildArena, drawSignLights } from './arena.js';
import { CREW, bakeCrew } from './crew.js';
import { makePlayer, updatePlayer, drawPlayer, drawPlayerShadow } from './player.js';
import { bakeEnemies, updateEnemies, drawEnemy, drawEnemyShadow, drawEnemyLines } from './enemies.js';
import { updateBullets, drawBullets } from './bullets.js';
import { bakePickups, updatePickups, drawPickups } from './pickups.js';
import { updateWaves, drawSpawns, queueSpawn } from './waves.js';
import { bakeHUD, drawHUD, drawCrosshair } from './hud.js';
import { INTRO } from './text.js';

const HIGH_KEY = 'four-color-showdown-high';

const canvas = document.getElementById('game');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
fitCanvas(canvas, W, H);

const input = createInput(canvas, W, H);
addEventListener('mousedown', unlockAudio);
addEventListener('keydown', unlockAudio);

bakeCrew(); bakeEnemies(); bakePickups(); bakeHUD();
const arena = buildArena();
const overlay = makeOverlay(W, H);

let high = loadNum(HIGH_KEY);
let state = 'title', stateT = 0, frame = 0;
let g = newGame();

function newGame() {
  const game = {
    input, p: makePlayer(), enemies: [], bullets: [], pickups: [], spawns: [], queue: [],
    parts: new Particles(), bursts: new Bursts(), floats: new Floaters(), shake: new Shake(),
    wave: 0, waveState: 'clear', waveT: 0, interT: 2.5, spawnTimer: 0,
    score: 0, combo: 0, comboT: 0, marked: false, hint: null, time: 0,
    radio: '', radioT: 0, radioMax: 0, newHigh: false,
  };
  game.say = (text) => { game.radio = text; game.radioT = game.radioMax = (textWidth(text) + 290) / 40; };
  game.queueSpawn = (type) => queueSpawn(game, type);
  game.say(INTRO);
  return game;
}

function setState(s) { state = s; stateT = 0; }

function step(dt) {
  g.time += dt;
  g.marked = g.enemies.some((e) => e.type === 'drone');
  updatePlayer(g, dt);
  updateWaves(g, dt);
  updateEnemies(g, dt);
  updateBullets(g, dt);
  updatePickups(g, dt);
  g.parts.update(dt); g.bursts.update(dt); g.floats.update(dt); g.shake.update(dt);
  if (g.comboT > 0 && (g.comboT -= dt) <= 0) g.combo = 0;
  if (g.radioT > 0) g.radioT -= dt;
  if (g.hint) g.hint.t -= dt;
}

function update(dt) {
  stateT += dt;
  if (input.hit('KeyM')) toggleMute();
  const go = input.mouse.clicked || input.hit('Enter');
  const pause = input.hit('KeyP') || input.hit('Escape');

  if (state === 'title') {
    g.time += dt;
    if (go) { g = newGame(); setState('play'); }
  } else if (state === 'play') {
    if (pause) setState('pause');
    else {
      step(dt);
      if (g.p.hp <= 0) {
        if (g.score > high) { high = g.score; saveNum(HIGH_KEY, high); g.newHigh = true; }
        sfx.over();
        setState('over');
      }
    }
  } else if (state === 'pause') {
    if (pause || go) setState('play');
  } else if (state === 'over') {
    g.time += dt;
    g.parts.update(dt); g.bursts.update(dt); g.floats.update(dt); g.shake.update(dt);
    if (stateT > 1 && go) { g = newGame(); setState('play'); }
  }
  input.endFrame();
}

addEventListener('blur', () => { if (state === 'play') setState('pause'); });

// ---------- Rendern ----------
function drawWorld() {
  const [sx, sy] = g.shake.offset();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.drawImage(arena, 0, 0);
  drawSignLights(ctx, g.time);
  drawPickups(ctx, g);
  drawSpawns(ctx, g);
  drawEnemyLines(ctx, g);
  const actors = [...g.enemies, g.p];
  if (state !== 'title') {
    drawPlayerShadow(ctx, g.p);
  }
  for (const e of g.enemies) drawEnemyShadow(ctx, e);
  actors.sort((a, b) => a.y - b.y);
  for (const a of actors) {
    if (a === g.p) { if (state !== 'title') drawPlayer(ctx, g); }
    else drawEnemy(ctx, g, a);
  }
  drawBullets(ctx, g);
  g.parts.draw(ctx);
  g.bursts.draw(ctx);
  g.floats.draw(ctx);
  ctx.restore();
}

function drawTitle() {
  ctx.fillStyle = 'rgba(27,25,24,0.74)';
  ctx.fillRect(0, 0, W, H);
  const t1 = 'FOUR COLOR';
  let x = W / 2 - textWidth(t1, 3) / 2, ci = 0;
  for (const ch of t1) {
    if (ch !== ' ') drawText(ctx, x, 16, ch, CREW[ci++ % 4].color, 3, C.ink);
    x += 12;
  }
  drawTextCentered(ctx, W / 2 + 2, 36, 'SHOWDOWN', C.pink, 5);
  drawTextCentered(ctx, W / 2, 34, 'SHOWDOWN', C.paper, 5, C.ink);

  CREW.forEach((c, i) => {
    const cx = 70 + i * 60, bob = Math.round(Math.sin(g.time * 4 + i) * 1.5);
    fillEllipse(ctx, cx, 101, 9, 2, C.black);
    ctx.drawImage(c.frames[0].r, cx - 10, 70 + bob, 20, 30);
    drawTextCentered(ctx, cx, 106, c.name, c.color);
  });

  drawTextCentered(ctx, W / 2, 118, 'A KILLJOY ZAP-EM-UP FROM THE ZONES', C.mustard);
  drawTextCentered(ctx, W / 2, 130, 'WASD MOVE - MOUSE AIM + SHOOT - 1-4 SWAP - SPACE DASH', C.grey);
  drawTextCentered(ctx, W / 2, 138, 'ONLY THE MATCHING COLOR BREAKS A SHIELD - P PAUSE - M MUTE', C.grey);
  if (Math.floor(g.time * 2.5) % 2 === 0) drawTextCentered(ctx, W / 2, 152, 'CLICK TO ZAP', C.y, 2, C.ink);
  if (high) drawTextCentered(ctx, W / 2, 170, `HI ${String(high).padStart(5, '0')}`, C.dgrey);
}

function drawPause() {
  rect(ctx, 0, 0, W - 1, H - 1, C.white);
  rect(ctx, 6, 6, W - 7, H - 7, C.white, C.grey);
  rect(ctx, 7, 7, W - 8, H - 8, C.white);
  drawText(ctx, 14, 14, 'BL/IND', C.ink, 2);
  drawText(ctx, 14, 26, 'BETTER LIVING INDUSTRIES', C.dgrey);
  const cx = W / 2, cy = 66;
  fillEllipse(ctx, cx, cy, 22, 22, C.ink);
  fillEllipse(ctx, cx, cy, 20, 20, C.white);
  rect(ctx, cx - 8, cy - 9, cx - 5, cy - 3, C.ink);
  rect(ctx, cx + 5, cy - 9, cx + 8, cy - 3, C.ink);
  for (let a = 0.35; a < Math.PI - 0.35; a += 0.06) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(Math.round(cx + Math.cos(a) * 12) - 1, Math.round(cy + 1 + Math.sin(a) * 10), 2, 2);
  }
  drawTextCentered(ctx, W / 2, 98, 'EVERYTHING IS PERFECT.', C.ink, 2);
  drawTextCentered(ctx, W / 2, 114, 'YOUR HAPPINESS HAS BEEN PAUSED FOR YOUR SAFETY.', C.dgrey);
  if (Math.floor(stateT * 2) % 2 === 0) drawTextCentered(ctx, W / 2, 140, 'PRESS P TO RESUME', C.ink);
  drawTextCentered(ctx, W / 2, 160, 'REMEMBER TO REPORT ANY SUSPICIOUS ACTIVITY.', C.grey);
  // Killjoy-Graffiti über dem sauberen Screen
  drawText(ctx, 226, 124, 'NOT FOR', C.pink, 2);
  drawText(ctx, 236, 136, 'LONG!', C.pink, 2);
  line(ctx, 224, 148, 294, 144, C.pink, 0, 2);
}

function drawOver() {
  ctx.fillStyle = 'rgba(27,25,24,0.62)';
  ctx.fillRect(0, 0, W, H);
  drawTextCentered(ctx, W / 2, 34, 'KILLJOYS', C.pink, 4, C.ink);
  drawTextCentered(ctx, W / 2, 58, 'NEVER DIE', C.pink, 4, C.ink);
  drawTextCentered(ctx, W / 2, 92, `WAVE ${String(g.wave).padStart(2, '0')}  -  ${String(g.score).padStart(5, '0')} CARBONS`, C.paper, 1, C.ink);
  if (g.newHigh) {
    if (Math.floor(stateT * 4) % 2 === 0) drawTextCentered(ctx, W / 2, 104, 'NEW HIGH SCORE!', C.mustard, 1, C.ink);
  } else {
    drawTextCentered(ctx, W / 2, 104, `HI ${String(high).padStart(5, '0')}`, C.grey, 1, C.ink);
  }
  if (stateT > 1 && Math.floor(stateT * 2.5) % 2 === 0) drawTextCentered(ctx, W / 2, 134, 'CLICK TO RISE AGAIN', C.y, 2, C.ink);
}

function render() {
  frame++;
  if (state === 'pause') { drawPause(); return; }
  drawWorld();
  if (state === 'play' || state === 'over') drawHUD(ctx, g);
  if (state === 'title') drawTitle();
  if (state === 'over') drawOver();
  drawCrosshair(ctx, g);
  ctx.drawImage(overlay[(frame >> 2) & 3], 0, 0);
}

// Nur zum Testen: showdown/?debug macht den Spielzustand in der Konsole erreichbar
if (new URLSearchParams(location.search).has('debug')) {
  window.fcs = { get g() { return g; }, get state() { return state; } };
}

startLoop(update, render);
