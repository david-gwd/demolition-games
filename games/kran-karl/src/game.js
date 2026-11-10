import {
  W, GRAVITY, BOX_W, BOX_H, GROUND_Y, SEA_Y, QUAY_X1, PIER_X0, PUB, STACK_X, STAR_TIME, STAR_PERFECT,
  clamp, rnd, frand, fpick,
} from './config.js';
import { Crane } from './crane.js';
import { Ship, HEEL_SLIDE, SLIPPERY_SLIDE, FEEDER_TIME } from './ship.js';
import { World, TRUCK_H } from './world.js';
import { Events } from './events.js';
import { Box, drawLoad } from './container.js';
import { getLevel } from './level.js';
import { getMods } from './shop.js';
import { lineFor, WEIGHT_NAMES, REEFER_TIME } from './content.js';
import { freshShiftStats } from './achievements.js';
import { sfx } from './audio.js';
import { tag } from './ui.js';

const IDLE = { left: false, right: false, up: false, down: false };
const PERFECT_OFFSET = 8;
const TRUCK_PERFECT = 10;
const SLIP_OFFSET = 16; // auf glattem Deck rutscht ab diesem Versatz weiter
// Greifen: maximaler Abstand seitlich / nach oben und maximales Hakentempo
const GRAB_DX = 36;
const GRAB_DY = 22;
const GRAB_SPEED = 200;
const ALIVE_PATIENCE = 6; // Sekunden am Haken, bevor Lebendfracht seekrank wird
const FEEDER_SHAPE = { cols: 3, layers: 2, deckLeft: 222, deckY: 410, name: 'FEEDER FRIEDA', small: true };

const hitsBox = (bx, by, hh, cx, cy, r) => Math.abs(cx - bx) < BOX_W / 2 + r && Math.abs(cy - by) < hh + r;
const overlapsPub = (x, y, hh) => x + BOX_W / 2 > PUB.x0 && x - BOX_W / 2 < PUB.x1
  && y + hh > PUB.y0 - 16 && y - hh < PUB.y1;

export class Game {
  constructor(ui) {
    this.ui = ui;
    this.crane = new Crane();
    this.ship = new Ship();
    this.feeder = null;
    this.world = new World();
    this.events = new Events();
    this.mods = getMods();
    this.score = 0;
    this.mood = 100;
    this.stats = freshShiftStats();
    this.ghost = null;
    this.recorder = null;
    this.steps = 0;
  }

  get ships() { return this.feeder ? [this.ship, this.feeder] : [this.ship]; }

  // key: Schicht-Schlüssel (z. B. "2-5"); mods: Werkstatt; look: Kosmetik
  startLevel(key, mods = this.mods, look = null) {
    this.level = getLevel(key);
    this.levelN = this.level.n;
    this.mode = this.level.mode;
    this.mods = mods;
    this.windDir = rnd() < 0.5 ? -1 : 1;
    this.crane.reset(mods, look);
    const cargoOpts = { harbor: this.level.harbor, reefers: this.level.reefers };
    this.ship.reset(this.level, cargoOpts);
    this.feeder = this.level.feeder ? new Ship(FEEDER_SHAPE) : null;
    this.feeder?.reset(this.level);
    this.world.reset(this.level, this.ship.planColors, look);
    this.events.reset(this.level, mods);
    this.boxes = [];
    this.score = 0;
    this.timeLeft = this.level.time;
    this.mood = 100;
    this.combo = 0;
    this.perfects = 0;
    this.delivered = 0;
    this.feederShipped = 0; // Container, die mit dem Feeder schon abgefahren sind
    this.goalTime = null; // Restzeit in dem Moment, in dem das Soll erreicht wurde
    this.bonus = 0;
    this.phase = 'play'; // idle | play | depart | fired
    this.outcome = null;
    this.loseReason = '';
    this.endTimer = 0;
    this.time = 0;
    this.wind = 0;
    this.warned = false;
    this.heelWarnCd = 0;
    this.slideCd = 0;
    this.pubCd = 0;
    this.sickCd = 0;
    this.stats = freshShiftStats();
    this.rareFound = new Set();
    this.steps = 0;
    this.lines = this.world.theme.lines;
    const unload = this.mode === 'unload';
    this.ui.reset();
    this.ui.showBanner(
      this.level.daily ? this.level.name : `Schicht ${this.level.endless ? '∞' : this.levelN}: ${this.level.name}`,
      `${unload ? 'Lösche' : 'Lade'} ${this.level.goal} Container in ${this.level.time} Sekunden`,
    );
    const ev = this.level.events;
    const intro = ['fog', 'night', 'snowstorm', 'monsoon', 'floes', 'tide'].find(e => ev.includes(e));
    if (intro && Math.random() < 0.6) this.say(intro);
    else if (this.level.slippery && Math.random() < 0.4) this.say('slippery');
    else if (this.level.reefers && !unload) this.say('reefer');
    else this.say(unload ? 'startUnload' : 'start');
  }

  say(key, cargo = null) { this.ui.say(lineFor(key, this.lines, cargo)); }

  // Geladene bzw. gelöschte Container (beim Laden zählt der Feeder mit)
  progress() {
    if (this.mode === 'unload') return this.delivered;
    return this.ship.count() + this.feederShipped + (this.feeder ? this.feeder.count() : 0);
  }

  perfectsNeeded() { return Math.ceil(this.level.goal * STAR_PERFECT); }

  // Ergebnis der Schicht: Sterne (Soll, Zeit, Perfekt) und Lohn
  result() {
    const won = this.outcome === 'win';
    return {
      won,
      score: this.score,
      stars: [
        won,
        won && this.goalTime !== null && this.goalTime >= this.level.time * STAR_TIME,
        won && this.perfects >= this.perfectsNeeded(),
      ],
      coins: Math.max(0, Math.floor(this.score / (won ? 10 : 20))),
    };
  }

  // Boden unter einem Objekt der halben Breite halfW (Kai, Stapel/Lkw, Steg) – über Wasser: Infinity.
  // Der leere Haken setzt beim Löschen zusätzlich auf Deck und Stapeln des Schiffs auf.
  floorAt(x, halfW, onShip = false) {
    if (Math.abs(x - STACK_X) < BOX_W / 2 + halfW) return this.world.stackTopY();
    if (x - halfW < QUAY_X1 || x + halfW > PIER_X0) return GROUND_Y;
    return onShip ? this.ship.floorAt(x, halfW) : Infinity;
  }

  changeMood(d) {
    this.mood = clamp(this.mood + (d < 0 ? d * this.mods.moodMul : d), 0, 100);
    if (this.mood <= 0 && this.phase === 'play') {
      this.phase = 'fired';
      this.endTimer = 1.6;
      this.loseReason = 'Der Chef hat die Nerven verloren.';
      this.say('fired');
    }
  }

  endLevel(reason) {
    if (this.phase !== 'play') return;
    this.phase = 'depart';
    this.ship.departing = true;
    this.endTimer = 3.2;
    sfx.horn();
    if (reason === 'full') {
      this.bonus = Math.ceil(this.timeLeft) * 10;
      this.score += this.bonus;
      this.say('full');
    } else {
      this.say('depart');
    }
  }

  update(dt, input, action) {
    this.time += dt;
    const lv = this.level;
    this.wind = lv.wind
      ? this.windDir * lv.wind * this.events.windFactor
        * clamp(0.6 + 0.4 * Math.sin(this.time * 0.45) + 0.3 * Math.sin(this.time * 1.9), 0, 1.3)
      : 0;

    const playing = this.phase === 'play';
    if (playing) {
      this.steps++;
      this.recorder?.step(this.crane);
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (!this.warned && this.timeLeft <= 10) {
        this.warned = true;
        this.say('timeLow');
        sfx.tick();
      }
      if (this.goalTime === null && this.progress() >= lv.goal) {
        this.goalTime = this.timeLeft;
        this.ui.float('Soll erfüllt!', W / 2, 160, '#7ee081', true);
        this.say('goal');
        sfx.star();
      }
      if (this.timeLeft <= 0) this.endLevel('time');
      else if (this.mode === 'unload' && this.shipCleared()) this.endLevel('full');
    }

    const hookOnShip = this.mode === 'unload' && !this.crane.cargo;
    if (this.crane.update(dt, playing ? input : IDLE, this.wind, (x, hw) => this.floorAt(x, hw, hookOnShip))) sfx.clang();
    if (playing && action) this.handleAction();

    this.events.update(dt, this);
    for (const s of this.ships) {
      s.boost = this.events.waveBoost;
      s.tide = this.events.tide;
      s.update(dt);
      this.updateHeel(dt, s);
    }
    this.world.tide = this.events.tide;
    if (this.feeder) this.updateFeeder(dt);
    this.world.update(dt, this.wind);
    if (this.world.friendArrived) {
      this.world.friendArrived = false;
      this.say('gullFriend');
    }
    this.refillStack();
    this.updateBoxes(dt);
    this.checkHangingCargo(dt);
    if (playing) this.tickReefers(dt);
    this.ui.update(dt);

    if (this.phase === 'depart' || this.phase === 'fired') {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.outcome) {
        if (this.phase === 'fired') {
          this.outcome = 'lose';
        } else if (this.progress() >= lv.goal) {
          this.outcome = 'win';
        } else {
          this.outcome = 'lose';
          this.loseReason = `Nur ${this.progress()} von ${lv.goal} Containern ${this.mode === 'unload' ? 'gelöscht' : 'an Bord'}.`;
        }
      }
    }
  }

  // Löschen: Schiff leer, nichts hängt mehr am Haken, nichts fliegt mehr
  shipCleared() {
    return !this.ship.count() && !this.crane.cargo && !this.boxes.some(b => b.state === 'falling' || b.state === 'tipping');
  }

  // Feeder: liegt FEEDER_TIME Sekunden, fährt dann (oder wenn voll) ab und kommt leer wieder
  updateFeeder(dt) {
    const f = this.feeder;
    const d = f.dock;
    if (d.phase === 'docked') {
      if (this.phase !== 'play') return;
      d.timer -= dt;
      if (f.isFull()) {
        this.score += 300;
        this.stats.feederFull++;
        this.ui.float('Frieda voll! +300', f.pivotX, f.pivotY - 90, '#7ee081', true);
        this.say('feederFull');
        this.leaveFeeder();
      } else if (d.timer <= 0) {
        this.say(f.count() ? 'feederLeave' : 'feederEmpty');
        this.leaveFeeder();
      }
    } else if (d.phase === 'leaving') {
      d.p = Math.min(1, d.p + dt / 2.5);
      if (d.p >= 1) {
        this.feederShipped += f.count();
        f.cols.forEach(c => { c.length = 0; });
        d.phase = 'away';
        d.wait = 4;
      }
    } else if (d.phase === 'away') {
      d.wait -= dt;
      if (d.wait <= 0 && this.phase === 'play') d.phase = 'arriving';
    } else if (d.phase === 'arriving') {
      d.p = Math.max(0, d.p - dt / 2.5);
      if (d.p <= 0) {
        d.phase = 'docked';
        d.timer = FEEDER_TIME;
        this.say('feederArrive');
      }
    }
  }

  leaveFeeder() {
    this.feeder.dock.phase = 'leaving';
    sfx.feederHorn();
  }

  // Spreader-Taste: Doppelgriff an/aus
  toggleSpreader() {
    const c = this.crane;
    if (!this.mods.spreader) {
      this.ui.float('Doppel-Spreader gibt\'s in der Werkstatt', c.hookX, c.hookY - 18);
      sfx.nope();
      return;
    }
    c.double = !c.double;
    this.ui.float(c.double ? 'Doppelgriff AN' : 'Doppelgriff aus', c.hookX, c.hookY - 18, '#ffd23f');
    sfx.move();
  }

  handleAction() {
    const c = this.crane;
    if (c.cargo) {
      const p = c.cargoCenter();
      const v = c.hookVelocity();
      const box = new Box(c.cargo, p.x, p.y, c.extra);
      box.vx = v.vx;
      box.vy = v.vy;
      box.angle = -c.theta;
      box.spin = -c.omega * 0.6;
      this.boxes.push(box);
      c.cargo = null;
      c.extra = null;
      sfx.release();
      return;
    }

    const reachX = GRAB_DX + this.mods.grabBonus;
    const reachY = GRAB_DY + this.mods.grabBonus;
    const far = dx => (dx < 90 ? 'Weiter zur Mitte!' : 'Hier gibt\'s nix zu greifen.');
    const stack = this.world.stack;
    let target = null; // beim Löschen: oberster Container einer Schiffsspalte
    let problem = null;
    if (this.mode === 'unload') {
      target = this.ship.topAt(c.hookX, reachX);
      if (!target) problem = 'Schiff ist leer!';
      else if (target.dist > reachX) problem = far(target.dist);
      else if (target.y - (c.hookY + 4) > reachY) problem = 'Tiefer!';
    } else {
      const dx = Math.abs(c.hookX - STACK_X);
      if (!stack.length) problem = 'Nachschub kommt gleich!';
      else if (dx > reachX) problem = far(dx);
      else if (this.world.stackTopY() - (c.hookY + 4) > reachY) problem = 'Tiefer!';
    }
    if (!problem) {
      const v = c.hookVelocity();
      if (Math.hypot(v.vx, v.vy) > GRAB_SPEED) problem = 'Zu wackelig!';
    }
    if (problem) {
      this.ui.float(problem, c.hookX, c.hookY - 18);
      sfx.nope();
      return;
    }
    // Doppelgriff: der obere Container wird zum `extra`, der darunter zur Hauptladung
    const two = c.double && (target ? this.ship.cols[target.col].length >= 2 : stack.length >= 2);
    if (target) {
      const top = this.ship.removeTop(target.col).cargo;
      if (two) {
        c.cargo = this.ship.removeTop(target.col).cargo;
        c.extra = top;
      } else c.cargo = top;
    } else {
      const top = stack.pop();
      if (two) {
        c.cargo = stack.pop();
        c.extra = top;
      } else c.cargo = top;
    }
    if (c.double && !two) this.ui.float('Nur einer da', c.hookX, c.hookY - 18, '#ffd6a0');
    if (two) this.stats.doubles++;
    for (const cargo of [c.cargo, c.extra]) {
      if (!cargo) continue;
      cargo.hang = 0;
      // Kühlware vom Schiff: ab jetzt läuft die Uhr bis zum Lkw
      if (cargo.reefer && cargo.cold == null && !cargo.thawed) cargo.cold = REEFER_TIME.unload;
      if (cargo.rare && !cargo.seen) this.discoverRare(cargo);
    }
    sfx.grab();
  }

  discoverRare(cargo) {
    cargo.seen = true;
    this.stats.rare++;
    this.rareFound.add(cargo.id);
    this.ui.float('SELTENE FRACHT!', this.crane.hookX, this.crane.hookY - 30, '#ffd23f', true);
    sfx.star();
  }

  refillStack() {
    if (this.mode === 'unload') return;
    if (this.world.stack.length || Math.abs(this.crane.hookX - STACK_X) < 90) return;
    this.world.refillStack();
    sfx.refill();
    this.ui.float('Nachschub!', STACK_X, this.world.stackTopY() - 16, '#bfe8ff');
    this.dust(STACK_X, GROUND_Y - 4);
  }

  dust(x, y) {
    this.world.particles.burst(10, () => ({
      x: x + frand(-30, 30), y, vx: frand(-60, 60), vy: frand(-40, -10),
      drag: 3, life: 0.6, size: 5, color: '#c9c2b4',
    }));
  }

  // Schlagseite (und auf glattem Deck auch das Rollen) lässt den obersten äußeren Container abrutschen
  updateHeel(dt, s) {
    if (s === this.ship) {
      this.slideCd -= dt;
      this.heelWarnCd -= dt;
    }
    const slippery = this.level.slippery;
    if (!s.heelOn && !slippery) return;
    if (s.heelOn && Math.abs(s.heel) > 0.1 && this.heelWarnCd <= 0) {
      this.heelWarnCd = 6;
      this.say('heel');
    }
    const tilt = slippery ? s.angle : s.heel;
    if (Math.abs(tilt) <= (slippery ? SLIPPERY_SLIDE : HEEL_SLIDE) || this.slideCd > 0 || !s.docked) return;

    // oberster Container der äußersten belegten Spalte auf der tiefen Seite rutscht ab
    const side = Math.sign(tilt);
    const order = [...Array(s.colCount).keys()];
    if (side > 0) order.reverse();
    const i = order.find(k => s.cols[k].length);
    if (i === undefined) return;
    const b = s.removeTop(i);
    const p = s.toWorld(s.colX(i), -BOX_H * (s.cols[i].length + 0.5));
    const box = new Box(b.cargo, p.x, p.y);
    box.vx = side * 110;
    box.vy = -20;
    box.angle = s.angle;
    box.spin = side * 2.5;
    box.ignoreCol = i;
    box.ignoreT = 0.4;
    box.ship = s;
    this.boxes.push(box);
    this.slideCd = 1.4;
    this.ui.float('Rutscht!', p.x, p.y - 20, '#ff9d5c', true);
    this.say('slide');
    sfx.tip();
  }

  updateBoxes(dt) {
    for (const b of this.boxes) {
      b.t += dt;
      if (b.state === 'falling') this.updateFalling(b, dt);
      else if (b.state === 'tipping') this.updateTipping(b, dt);
      else if (b.state === 'sinking') this.updateSinking(b, dt);
      else if (b.state === 'floating') this.updateFloating(b, dt);
    }
    this.boxes = this.boxes.filter(b => !b.dead);
  }

  updateFalling(b, dt) {
    const px = b.x, py = b.y;
    const hh = b.h / 2;
    const weight = b.cargo.weight + (b.extra?.weight || 0);
    b.vy += GRAVITY * (b.cargo.floaty ? 0.45 : 1) * dt;
    b.vx += this.wind * 0.4 / (0.6 + weight) * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.angle += b.spin * dt;
    b.ignoreT -= dt;

    for (const g of this.world.gulls) {
      if (g.hittable && !b.hitGulls.has(g) && hitsBox(b.x, b.y, hh, g.x, g.y, 12)) {
        b.hitGulls.add(g);
        this.hitGull(g);
      }
    }
    if (!b.hitPub && overlapsPub(b.x, b.y, hh)) {
      b.hitPub = true;
      this.hitPub(b.x, b.y);
      b.vx = -Math.abs(b.vx) * 0.4 - 60;
      b.spin = -3;
    }

    // Kai, Stapel/Lkw oder Steg
    const floor = this.floorAt(b.x, 10);
    if (b.y + hh >= floor && py + hh <= floor + 8) {
      this.dockLanding(b);
      return;
    }

    for (const s of this.ships) {
      if (!s.docked) continue;
      const local = s.toLocal(b.x, b.y);
      const prevLocal = s.toLocal(px, py);
      const skip = b.ignoreT > 0 && b.ship === s ? b.ignoreCol : -1;
      const res = s.collide(local, prevLocal, skip, hh, b.extra ? 2 : 1);
      if (!res) continue;
      if (res.type === 'land' && this.level.slippery && res.offset > SLIP_OFFSET) {
        // glattes Deck: rutscht über die Kante
        this.startTipping(b, s, local, res.dir, -s.cols[res.col].length * BOX_H, 'Ausgerutscht!');
        return;
      }
      if (res.type === 'land') {
        this.landOnShip(b, res, s);
        return;
      }
      if (res.type === 'tip') {
        this.startTipping(b, s, local, res.dir, res.top, 'Wackel …');
        return;
      }
      if (res.type === 'push') {
        b.x = s.toWorld(res.x, local.y).x;
        b.vx = res.dir * Math.max(40, Math.abs(b.vx) * 0.3);
        sfx.clang();
      }
    }

    if (!b.hitBoat && this.events.boat && this.boatHit(b)) {
      b.hitBoat = true;
      this.hitBoat(b);
    }

    const floe = this.events.floes.length ? this.events.floeAt(b.x, b.y + hh, x => this.world.waveY(x)) : null;
    if (floe) this.iceLanding(b, floe);
    else if (b.y > this.world.waveY(b.x)) this.splash(b);
    else if (b.x < -100 || b.x > W + 100) b.dead = true;
  }

  // Trifft ein Container die Barkasse?
  boatHit(b) {
    const boat = this.events.boat;
    const by = SEA_Y + this.events.tide + 18;
    return Math.abs(b.x - boat.x) < 62 && b.y + b.h / 2 > by - 16 && b.y < by + 6;
  }

  startTipping(b, s, local, dir, top, text) {
    b.state = 'tipping';
    b.tipT = 0;
    b.tipDir = dir;
    b.tipShip = s;
    b.tipLocal = { x: local.x, y: top - b.h / 2 };
    this.combo = 0;
    this.ui.float(text, b.x, b.y - 24, '#ffd6a0');
    sfx.tip();
  }

  updateTipping(b, dt) {
    const s = b.tipShip;
    b.tipT += dt;
    const k = Math.min(1, b.tipT / 0.4);
    const p = s.toWorld(b.tipLocal.x + b.tipDir * 32 * k * k, b.tipLocal.y + 6 * k * k);
    b.x = p.x;
    b.y = p.y;
    b.angle = s.angle + b.tipDir * 0.8 * k * k;
    if (k >= 1) {
      b.state = 'falling';
      b.vx = b.tipDir * 90;
      b.vy = 40;
      b.spin = b.tipDir * 3.5;
    }
  }

  updateSinking(b, dt) {
    b.y += 25 * dt;
    b.x += b.vx * dt;
    b.vx *= 0.98;
    b.angle += b.spin * dt;
    b.spin *= 0.97;
    if (Math.random() < 0.25) {
      this.world.particles.add({
        x: b.x + frand(-20, 20), y: b.y - 10, vy: -40, vx: frand(-10, 10),
        life: 1, size: frand(2, 4), shape: 'ring', color: 'rgba(220,245,255,0.8)',
      });
    }
    if (b.t > 3) b.dead = true;
  }

  // Container treibt auf einer Eisscholle davon
  updateFloating(b) {
    const f = b.floe;
    b.x = f.x + b.dx;
    b.y = this.world.waveY(f.x) - 6 - b.h / 2 + Math.max(0, b.t - 2.5) * 12;
    b.angle = Math.sin(b.t * 2) * 0.05;
    if (b.t > 4 || f.x < QUAY_X1 || f.x > W) b.dead = true;
  }

  iceLanding(b, floe) {
    b.state = 'floating';
    b.floe = floe;
    b.dx = clamp(b.x - floe.x, -floe.w / 2 + 10, floe.w / 2 - 10);
    b.t = 0;
    this.combo = 0;
    this.stats.iced++;
    this.score -= 20;
    this.changeMood(-5);
    this.ui.float('Auf Eis gelegt! -20', b.x, b.y - 30, '#bfe8ff', true);
    this.say('iced', b.cargo);
    sfx.crack();
  }

  // Punkte, Laune und Effekte für eine geglückte Landung; (x, y) = Oberkante des Containers
  reward(perfect, x, y, cargos) {
    const insp = this.events.inspecting;
    this.stats.landed += cargos.length;
    if (perfect) {
      this.combo++;
      this.perfects++;
      this.stats.perfects++;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      const pts = 100 * this.combo * (insp ? 2 : 1) * cargos.length;
      this.score += pts;
      this.ui.float(`PERFEKT! +${pts}`, x, y - 12, '#ffe14d', true);
      if (this.combo > 1) this.ui.float(`Combo x${this.combo}`, x, y + 10, '#ffb84d');
      if (insp) {
        this.stats.inspectorPerfect++;
        if (Math.random() < 0.5) this.say('inspectorGood');
      }
      this.changeMood(6);
      sfx.perfect(this.combo);
      this.world.particles.burst(14, i => {
        const a = (i / 14) * Math.PI * 2;
        return { x, y: y + BOX_H / 2, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, drag: 4, life: 0.7, size: 3, color: '#ffe14d' };
      });
      if (!insp && Math.random() < 0.4) this.say('perfect');
    } else if (insp) {
      // unter Aufsicht zählt nur Perfektion
      this.combo = 0;
      this.ui.float('Inspektor: mangelhaft! +0', x, y - 12, '#ff8a7a', true);
      this.changeMood(-8);
      sfx.land();
      this.say('inspectorBad');
    } else {
      this.combo = 0;
      const pts = 50 * cargos.length;
      this.score += pts;
      this.ui.float(`+${pts}`, x, y - 12, '#fff');
      this.changeMood(3);
      sfx.land();
      if (Math.random() < 0.25) this.say('ok');
    }
    this.world.particles.burst(8, i => ({
      x: x + (i % 2 ? 1 : -1) * BOX_W / 2, y: y + BOX_H, vx: (i % 2 ? 1 : -1) * frand(20, 70), vy: frand(-30, -5),
      drag: 3, life: 0.5, size: 4, color: '#d8d2c4',
    }));
    // Zerbrechliches übersteht nur saubere Landungen
    if (!perfect) {
      for (const c of cargos) if (c.fragile && !c.broken) this.breakCargo(c, x, y);
    }
    for (const c of cargos) this.rareLanded(c, x, y);
  }

  breakCargo(c, x, y) {
    c.broken = true;
    this.stats.broken++;
    this.score -= 50;
    this.changeMood(-5);
    this.ui.float('Kaputt! -50', x, y - 40, '#ff8a7a', true);
    this.say('fragile');
    sfx.shatter();
    this.world.particles.burst(12, () => ({
      x: x + frand(-20, 20), y: y + 6, vx: frand(-120, 120), vy: frand(-180, -40), gravity: GRAVITY,
      vr: frand(-10, 10), life: 0.8, size: 2.5, shape: 'rect', color: '#cfefff',
    }));
  }

  rareLanded(c, x, y) {
    if (!c.rare || c.landed) return;
    c.landed = true;
    this.ui.say(c.land);
    if (c.bonus) {
      this.score += c.bonus;
      this.ui.float(`${c.name} +${c.bonus}`, x, y - 56, '#ffd23f', true);
    }
    if (c.chefDesk) this.changeMood(15);
  }

  landOnShip(b, res, s) {
    b.dead = true;
    if (this.mode === 'unload') {
      // wieder aufs Schiff gestellt: zählt nicht
      for (const c of b.cargos) s.addBox(res.col, c, 0.08);
      this.combo = 0;
      this.ui.float('Zurückgestellt', b.x, b.y - 24, '#ffd6a0');
      this.say('back');
      sfx.land();
      return;
    }
    const perfect = res.offset < PERFECT_OFFSET;
    let crushed = null;
    for (const c of b.cargos) crushed = s.place(res.col, c, perfect ? 0 : 0.08, this.level.stackRule) || crushed;
    const top = s.topOf(res.col);
    if (crushed) {
      this.crush(crushed, top.x, top.y);
    } else {
      this.reward(perfect, top.x, top.y, b.cargos);
    }

    if (s.plan && b.cargos.some(c => s.plan[res.col] === c.color)) {
      this.score += 50;
      this.ui.float('Ladeplan! +50', top.x, top.y - 34, b.cargo.color, true);
      this.changeMood(2);
      if (Math.random() < 0.3) this.say('plan');
    }
    if (s.plugs.has(res.col)) {
      for (const c of b.cargos) {
        if (!c.reefer || c.thawed || c.plugged) continue;
        c.plugged = true;
        this.stats.reefersOk++;
        this.score += 50;
        this.ui.float('Strom drauf! +50', top.x, top.y - 52, '#bfe8ff', true);
        sfx.plug();
      }
    }

    if (s === this.ship && s.isFull() && this.phase === 'play') this.endLevel('full');
  }

  // Stapelregel verletzt: der leichtere Container darunter ist platt
  crush(cargo, x, y) {
    this.combo = 0;
    this.stats.crushes++;
    this.score -= 50;
    this.changeMood(-8);
    this.ui.float('Zerquetscht! -50', x, y - 16, '#ff8a7a', true);
    this.say('crush', cargo);
    sfx.crush();
    this.world.particles.burst(16, () => ({
      x: x + frand(-30, 30), y: y + BOX_H, vx: frand(-150, 150), vy: frand(-160, -30), gravity: GRAVITY,
      vr: frand(-8, 8), life: 0.9, size: 3, shape: 'rect', color: cargo.color,
    }));
  }

  dockLanding(b) {
    b.dead = true;
    this.dust(b.x, b.y + b.h / 2);
    if (b.x >= W / 2) {
      this.combo = 0;
      sfx.land();
      this.ui.float('Falsche Adresse!', b.x, b.y - 20, '#ffd6a0', true);
      this.say('pier');
      this.changeMood(-6);
    } else if (this.mode === 'unload') {
      this.deliver(b);
    } else {
      this.combo = 0;
      sfx.land();
      for (const c of b.cargos) if (this.world.stack.length < 6) this.world.stack.push(c);
      this.ui.float('Retoure!', b.x, b.y - 20, '#ffd6a0', true);
      this.say('dock');
      this.changeMood(-4);
    }
  }

  // Löschen: Container steht am Kai – auf dem Lkw (gut) oder daneben (zählt, gibt aber Abzug)
  deliver(b) {
    const off = Math.abs(b.x - STACK_X);
    const onTruck = this.world.truck.state === 'ready' && off < BOX_W / 2 + 10;
    const n = b.cargos.length;
    this.delivered += n;
    for (const c of b.cargos) {
      if (c.reefer && !c.thawed) {
        c.cold = null; // angekommen: der Lkw kühlt
        if (onTruck) this.stats.reefersOk++;
      }
    }
    if (!onTruck) {
      this.combo = 0;
      this.score += 25 * n;
      this.stats.landed += n;
      sfx.land();
      this.ui.float(`Daneben! +${25 * n}`, b.x, b.y - 20, '#ffd6a0', true);
      this.say('beside');
      this.changeMood(-2);
      for (const c of b.cargos) if (c.fragile && !c.broken) this.breakCargo(c, b.x, b.y);
      return;
    }
    this.world.loadTruck(b.cargo, b.extra, b.x - STACK_X);
    sfx.truck();
    this.reward(off < TRUCK_PERFECT, b.x, GROUND_Y - TRUCK_H - b.h, b.cargos);
  }

  splash(b) {
    b.state = 'sinking';
    b.t = 0;
    b.vx *= 0.3;
    b.spin *= 0.3;
    this.combo = 0;
    this.stats.splashes++;
    const y = this.world.waveY(b.x);
    const big = b.cargos.some(c => c.bigSplash);
    this.world.particles.burst(big ? 70 : 28, () => ({
      x: b.x + frand(-25, 25), y, vx: frand(-160, 160) * (big ? 1.6 : 1), vy: frand(-380, -120) * (big ? 1.5 : 1),
      gravity: GRAVITY, life: 0.9, size: frand(2, 4), color: '#bfe8ff',
    }));
    sfx.splash();
    this.ui.float('PLATSCH!', b.x, y - 30, '#7fd3ff', true);
    const rare = b.cargos.find(c => c.rare);
    const ducks = b.cargos.find(c => c.ducks);
    if (rare) {
      this.ui.say(rare.splash);
      if (rare.chefDesk) this.changeMood(-20);
    } else if (ducks) {
      this.world.spawnDucks(b.x, 14);
      this.stats.ducks += 14;
      this.say('ducks');
    } else {
      this.say('splash', b.cargo);
    }
    this.changeMood(-10);
  }

  hitGull(g) {
    g.hit();
    this.stats.gullHits++;
    this.world.particles.burst(12, () => ({
      x: g.x, y: g.y, vx: frand(-80, 80), vy: frand(-120, 20), gravity: 60, drag: 2,
      vr: frand(-6, 6), life: 1.6, size: 5, shape: 'rect', color: g.kind === 'parrot' ? fpick(['#e2302d', '#2a9d4a', '#2b7bd9']) : g.kind === 'puffin' ? '#222' : '#fff',
    }));
    sfx.gull();
    this.score -= 30;
    this.ui.float('-30 Vogel!', g.x, g.y - 20, '#ff8a7a', true);
    this.say('gull');
    this.changeMood(-10);
  }

  hitPub(x, y) {
    this.world.breakPub();
    this.stats.pubHits++;
    this.world.particles.burst(16, () => ({
      x: PUB.x0 + 20, y: PUB.y0 + 38, vx: frand(-150, 60), vy: frand(-200, 0), gravity: GRAVITY,
      vr: frand(-10, 10), life: 0.9, size: 3, shape: 'rect', color: '#cfefff',
    }));
    sfx.glass();
    if (this.mods.insured) {
      this.ui.float('KNEIPE! (versichert)', x - 30, y - 20, '#ffd6a0', true);
      this.say('insured');
      this.changeMood(-8);
      return;
    }
    this.score -= 100;
    this.ui.float('-100 KNEIPE!', x - 30, y - 20, '#ff6b5b', true);
    this.say('pub');
    this.changeMood(-25);
  }

  // Container prallt von der Barkasse ab (und landet danach meist im Wasser)
  hitBoat(b) {
    b.vy = -230;
    b.vx = (Math.sign(b.x - this.events.boat.x) || 1) * 90;
    b.spin = frand(-4, 4);
    sfx.clang();
    this.score -= 50;
    this.ui.float('-50 Barkasse!', b.x, b.y - 30, '#ff8a7a', true);
    this.say('boatHit');
    this.changeMood(-6);
  }

  // Auch der hängende Container kann Vögel und Kneipe erwischen; Lebendfracht wird seekrank
  checkHangingCargo(dt) {
    this.pubCd -= dt;
    this.sickCd -= dt;
    const c = this.crane;
    if (!c.cargo || this.phase === 'idle') return;
    const p = c.cargoCenter();
    const hh = c.loadH / 2;
    for (const g of this.world.gulls) {
      if (g.hittable && hitsBox(p.x, p.y, hh, g.x, g.y, 12)) this.hitGull(g);
    }
    if (this.pubCd <= 0 && overlapsPub(p.x, p.y, hh)) {
      this.pubCd = 2;
      this.hitPub(p.x, p.y);
      c.omega = -c.omega * 0.6;
    }
    if (this.phase !== 'play') return;
    for (const cargo of [c.cargo, c.extra]) {
      if (!cargo?.alive) continue;
      // starkes Pendeln lässt die Geduld schneller schwinden
      cargo.hang = (cargo.hang || 0) + dt * (1 + clamp(Math.abs(c.omega) * 1.5, 0, 2));
      if (cargo.hang > ALIVE_PATIENCE) {
        this.changeMood(-2 * dt);
        if (this.sickCd <= 0) {
          this.sickCd = 5;
          this.say('sick', cargo);
        }
      }
    }
  }

  // Kühlcontainer tauen ohne Strom auf. Beim Laden: oben im Stapel, am Haken, im Flug und auf Spalten ohne Stecker.
  tickReefers(dt) {
    const tick = (c, x, y) => {
      if (!c?.reefer || c.thawed || c.cold == null || c.plugged) return;
      c.cold -= dt;
      if (c.cold > 0) return;
      c.thawed = true;
      this.stats.thawed++;
      this.score -= 100;
      this.changeMood(-10);
      this.ui.float('Aufgetaut! -100', x, y - 20, '#c99a6a', true);
      this.say('thaw');
      sfx.thaw();
    };
    // im Stapel läuft nur die Uhr des obersten – der Rest wartet im Kühllager
    const stack = this.world.stack;
    if (stack.length) tick(stack[stack.length - 1], STACK_X, this.world.stackTopY());
    const cc = this.crane.cargoCenter();
    tick(this.crane.cargo, cc.x, cc.y);
    tick(this.crane.extra, cc.x, cc.y);
    for (const b of this.boxes) for (const c of b.cargos) tick(c, b.x, b.y);
    if (this.mode === 'load') {
      for (const s of this.ships) {
        s.cols.forEach((col, i) => {
          if (s.plugs.has(i)) return;
          const p = s.topOf(i);
          col.forEach(e => tick(e.cargo, p.x, p.y));
        });
      }
    }
  }

  // Namensschild der hängenden bzw. nächsten Fracht, mit Timern
  cargoTag(c) {
    let t = `${c.name} · ${WEIGHT_NAMES[c.weight]}`;
    if (c.reefer && !c.thawed && c.cold != null && !c.plugged) t += ` · ❄ ${Math.ceil(c.cold)} s`;
    if (c.alive) t += c.hang > ALIVE_PATIENCE ? ' · seekrank!' : ` · ♥ ${Math.ceil(ALIVE_PATIENCE - (c.hang || 0))} s`;
    if (c.fragile && !c.name.includes('zerbrechlich')) t += ' · zerbrechlich';
    return t;
  }

  draw(ctx, hud) {
    const w = this.world;
    w.drawBackground(ctx);
    this.feeder?.draw(ctx);
    w.drawLand(ctx, this.wind);
    for (const b of this.boxes) if (b.state === 'sinking') drawLoad(ctx, b.cargo, b.extra, b.x, b.y, b.angle);
    this.ship.draw(ctx);
    w.drawWater(ctx);
    w.drawDucks(ctx);
    this.events.drawWorld(ctx, this);
    for (const b of this.boxes) if (b.state !== 'sinking') drawLoad(ctx, b.cargo, b.extra, b.x, b.y, b.angle);
    if (hud && this.ghost) this.ghost.draw(ctx, this.steps);
    this.crane.draw(ctx);
    this.events.drawAbove(ctx);
    w.drawGulls(ctx);
    w.particles.draw(ctx);
    w.drawAmbient(ctx, this.wind);
    this.events.drawFront(ctx, this);

    if (hud) {
      const c = this.crane;
      if (c.cargo) {
        const p = c.cargoCenter();
        tag(ctx, this.cargoTag(c.extra || c.cargo), p.x, p.y + c.loadH / 2 + 16);
        if (c.extra) tag(ctx, this.cargoTag(c.cargo), p.x, p.y + c.loadH / 2 + 34);
      } else if (w.stack.length) {
        const top = w.stack[w.stack.length - 1];
        tag(ctx, `Nächster: ${this.cargoTag(top)}`, STACK_X, w.stackTopY() - 10);
      }
      this.ui.drawHud(ctx, this);
    }
    this.ui.drawChef(ctx, this.mood, w.theme.chef);
    this.ui.drawFloaters(ctx);
  }
}
