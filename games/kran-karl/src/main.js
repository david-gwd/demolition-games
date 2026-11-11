import { W, H, setSeed } from './config.js';
import { Input } from './input.js';
import { UI, TITLE_BTNS } from './ui.js';
import { Game } from './game.js';
import { Progress } from './progress.js';
import { Screens } from './screens.js';
import { getMods, getLook } from './shop.js';
import { getLevel, levelKey, today, CHAPTERS } from './level.js';
import { checkAchievements, freshShiftStats } from './achievements.js';
import { noteFor, PROMOTIONS } from './story.js';
import { harbor } from './harbors.js';
import { GhostRecorder, GhostPlayer } from './ghost.js';
import { settings } from './settings.js';
import { unlockAudio, toggleMute, setVolume, sfx } from './audio.js';

const STEP = 1 / 120;
const SCREEN_DELAY = 0.6; // verhindert versehentliches Wegklicken der Screens
const MENU_DELAY = 0.25;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const spreaderBtn = document.querySelector('[data-key="spreader"]');
let scale = 1;

function resize() {
  const r = canvas.getBoundingClientRect();
  scale = Math.max(1, (r.width * (window.devicePixelRatio || 1)) / W);
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
}
window.addEventListener('resize', resize);
resize();
setVolume(settings.volume);

const progress = new Progress();
const ui = new UI();
const game = new Game(ui);
const input = new Input(canvas, document.querySelectorAll('[data-key]'), {
  onFirst: unlockAudio,
  onMute: () => { ui.muted = toggleMute(); },
  onBlur: () => { if (state === 'playing') go('paused'); },
});
const screens = new Screens(progress, input);

// title | select | shop | achievements | options | playing | paused | note | levelEnd | gameOver | promotion | tossEnd
let state = 'title';
let screenT = 0;
let titleCursor = 0;
let optionsReturn = 'title';
let result = null; // Ergebnis der letzten Schicht (Game.result())
let newRecord = false;
let tossRec = null; // Ergebnis des letzten Feierabend-Weitwurfs (Progress.recordToss)
let pendingKey = null; // Schicht hinter dem Zettel vom Chef
let promotion = null; // Kapitel, dessen Beförderung gezeigt wird
let pendingPromotion = null;

function go(next) {
  state = next;
  screenT = 0;
}

// Rekorde für die Kreidetafel an der Kneipe
function showRecords() {
  game.world.records = { far: progress.stats.longestThrow || 0, toss: progress.data.toss.allTime };
}

function showTitle() {
  setSeed(null);
  game.startLevel(levelKey(Math.max(1, progress.openChapters()), 1), getMods(), getLook(progress));
  showRecords();
  game.phase = 'idle';
  ui.reset();
  go('title');
}

// Schichtplan – vorher eine noch nicht gefeierte Beförderung nachholen
function showSelect() {
  const c = progress.pendingPromotion();
  if (c) {
    progress.markPromoted(c);
    showPromotion(c);
    return;
  }
  go('select');
}

function showPromotion(c) {
  promotion = c;
  progress.addCoins(PROMOTIONS[c].bonus);
  // Kapitel-Abzeichen gleich mit freischalten
  toastAchievements(checkAchievements(progress, freshShiftStats(), { won: false, level: {}, result: { stars: [false] }, progress }));
  sfx.win();
  go('promotion');
}

// Erste Schicht eines Kapitels oder neue Schicht: erst der Zettel vom Chef
function requestLevel(key) {
  const note = noteFor(key);
  if (note && !progress.data.notes[key]) {
    pendingKey = key;
    progress.data.notes[key] = true;
    progress.save();
    sfx.page();
    go('note');
    return;
  }
  startLevel(key);
}

function startLevel(key) {
  const lv = getLevel(key);
  setSeed(lv.daily ? lv.seed : null);
  const mods = getMods(progress.upgrades, settings.easy);
  if (lv.daily) ui.best = progress.data.daily.date === key ? progress.data.daily.best : 0;
  else if (lv.toss) ui.best = progress.data.toss.date === key ? progress.data.toss.best : 0;
  else ui.best = progress.bestFor(key);
  game.startLevel(key, mods, getLook(progress));
  showRecords();
  game.ghost = settings.ghost ? GhostPlayer.load(key) : null;
  game.recorder = new GhostRecorder();
  if (spreaderBtn) spreaderBtn.hidden = !mods.spreader;
  go('playing');
}

function toastAchievements(list) {
  for (const a of list) {
    ui.toast(`Abzeichen: ${a.name}${a.coins ? ` (+${a.coins} €)` : ''}`);
    sfx.achievement();
  }
}

function saveRare() {
  let changed = false;
  for (const id of game.rareFound) {
    if (progress.data.rareSeen[id]) continue;
    progress.data.rareSeen[id] = true;
    changed = true;
  }
  if (changed) progress.save();
}

// Feierabend-Weitwurf: kein Lohn, keine Schicht – nur Rekorde, weitester Wurf und Abzeichen
function finishToss() {
  const lv = game.level;
  result = game.result();
  tossRec = progress.recordToss(lv, result.score, game.stats.longestThrow);
  newRecord = tossRec.newRecord;
  if (newRecord) game.recorder.save(lv.key);
  saveRare();
  toastAchievements(checkAchievements(progress, game.stats, { won: false, level: lv, result, progress }));
  showRecords();
  sfx.win();
  go('tossEnd');
}

function finishLevel() {
  const lv = game.level;
  if (lv.toss) {
    finishToss();
    return;
  }
  result = game.result();
  const rec = progress.record(lv, result);
  result.dailyFirst = !!rec.first;
  newRecord = rec.newRecord;
  if (newRecord) game.recorder.save(lv.key);
  saveRare();
  progress.addStats(game.stats, result.won);
  if (result.won && !game.stats.pubHits && !lv.endless && !lv.daily) {
    const list = progress.data.pubClean[lv.chapter] ||= [];
    if (!list.includes(lv.n)) list.push(lv.n);
    progress.save();
  }
  toastAchievements(checkAchievements(progress, game.stats, { won: result.won, level: lv, result, progress }));
  pendingPromotion = rec.promoted;
  // Cursor im Schichtplan: nach einem Sieg auf die nächste Schicht
  if (result.won) screens.focusNext(lv);
  else if (!lv.daily) screens.focusLevel(lv.key);
  if (result.won) sfx.win();
  else sfx.over();
  go(result.won ? 'levelEnd' : 'gameOver');
}

function afterResult() {
  if (pendingPromotion) {
    const c = pendingPromotion;
    pendingPromotion = null;
    // Kapitel 3 hat kein nächstes Kapitel: die Beförderung zum Schluss gibt's trotzdem
    showPromotion(c);
    return;
  }
  showSelect();
}

function updateMenu(presses, act, tap) {
  const back = presses.includes('back');
  const ready = screenT > MENU_DELAY;
  if (state === 'title') {
    for (const k of presses) {
      if (k === 'left' || k === 'right' || k === 'up' || k === 'down') {
        titleCursor = 1 - titleCursor;
        sfx.move();
      }
    }
    if (tap) {
      const i = TITLE_BTNS.findIndex(b => tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h);
      if (i < 0) return;
      titleCursor = i;
    } else if (!act) return;
    if (screenT <= SCREEN_DELAY) return;
    if (titleCursor === 0) showSelect();
    else { optionsReturn = 'title'; go('options'); }
  } else if (state === 'select') {
    if (back) { showTitle(); return; }
    const cmd = ready ? screens.updateSelect(presses, act, tap) : null;
    if (cmd?.type === 'start') requestLevel(cmd.key);
    else if (cmd?.type === 'daily') startLevel(`daily-${today()}`);
    else if (cmd?.type === 'toss') startLevel(`toss-${today()}`);
    else if (cmd?.type) go(cmd.type);
  } else if (state === 'shop') {
    if (back || (ready && screens.updateShop(presses, act, tap))) go('select');
  } else if (state === 'achievements') {
    if (back || (ready && screens.updateAchievements(presses, act, tap))) go('select');
  } else if (state === 'options') {
    if ((back && !screens.opt.waiting) || (ready && screens.updateOptions(presses, act, tap))) go(optionsReturn);
  } else if (state === 'paused') {
    if (back || presses.includes('pause')) { go('playing'); return; }
    const cmd = ready ? screens.updatePause(presses, act, tap) : null;
    if (cmd === 'resume') go('playing');
    else if (cmd === 'restart') startLevel(game.level.key);
    else if (cmd === 'options') { optionsReturn = 'paused'; go('options'); }
    else if (cmd === 'quit') {
      // Schicht abbrechen: zählt nicht, kein Lohn
      saveRare();
      game.phase = 'idle';
      setSeed(null);
      if (!game.level.daily) screens.focusLevel(game.level.key);
      go('select');
    }
  } else if (state === 'note') {
    if (back) { go('select'); return; }
    if ((act || tap) && screenT > SCREEN_DELAY) startLevel(pendingKey);
  } else if (state === 'promotion') {
    if ((act || tap) && screenT > SCREEN_DELAY * 1.5) {
      const next = promotion + 1;
      if (CHAPTERS[next - 1]) screens.focusLevel(levelKey(next, 1));
      promotion = null;
      go('select');
    }
  } else if ((act || tap) && screenT > SCREEN_DELAY) {
    afterResult();
  }
}

let acc = 0;
let last = performance.now();
let action = false;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  screenT += dt;

  input.poll();
  const presses = input.takePresses();
  const tap = input.takeTap();
  const act = input.takeAction();
  if (state === 'playing') {
    if (act) action = true;
    if (presses.includes('back') || presses.includes('pause')) go('paused');
    if (presses.includes('spreader')) game.toggleSpreader();
  } else {
    updateMenu(presses, act, tap);
  }

  const frozen = state === 'paused' || (state === 'options' && optionsReturn === 'paused');
  if (frozen) {
    acc = 0;
  } else {
    acc += dt;
    while (acc >= STEP) {
      game.update(STEP, input.held, action);
      action = false;
      acc -= STEP;
    }
  }
  ui.updateToasts(dt);

  if (state === 'playing') {
    toastAchievements(checkAchievements(progress, game.stats));
    if (game.rareFound.size) saveRare();
    if (game.outcome) finishLevel();
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  game.draw(ctx, state === 'playing' || frozen);
  if (state === 'title') ui.drawTitle(ctx, titleCursor);
  else if (state === 'select') screens.drawSelect(ctx, screenT);
  else if (state === 'shop') screens.drawShop(ctx, screenT);
  else if (state === 'achievements') screens.drawAchievements(ctx, screenT);
  else if (state === 'options') screens.drawOptions(ctx, screenT);
  else if (state === 'paused') screens.drawPause(ctx, screenT);
  else if (state === 'note') {
    const lv = getLevel(pendingKey);
    ui.drawNote(ctx, noteFor(pendingKey), lv, harbor(lv.harbor).name, screenT);
  } else if (state === 'promotion') {
    const next = CHAPTERS[promotion];
    ui.drawPromotion(ctx, PROMOTIONS[promotion], next ? next.name : null, screenT);
  } else if (state === 'levelEnd') ui.drawLevelEnd(ctx, game, result, newRecord, screenT);
  else if (state === 'gameOver') ui.drawGameOver(ctx, game, result, newRecord);
  else if (state === 'tossEnd') ui.drawTossEnd(ctx, game, tossRec, progress.data.toss.best, progress.data.toss.allTime);
  ui.drawToasts(ctx);

  requestAnimationFrame(frame);
}

// ?debug macht das Spiel in der Konsole greifbar, ?debug&level=2-5 springt direkt in eine Schicht
const params = new URLSearchParams(location.search);
showTitle();
if (params.has('debug')) {
  Object.assign(window, { game, progress, screens, settings });
  const key = params.get('level');
  if (key) startLevel(/^\d+$/.test(key) ? levelKey(1, Number(key)) : key);
}
requestAnimationFrame(frame);
