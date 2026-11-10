import { W, H, SEA_Y, GROUND_Y, GANTRY_Y, STACK_X, QUAY_X1, PIER_X0, PUB, GRAVITY, rand, rnd, frand, clamp } from './config.js';
import { Gull } from './world.js';
import { label } from './ui.js';
import { lineFor } from './content.js';
import { sfx } from './audio.js';

export const EVENT_NAMES = {
  fog: 'Nebel', night: 'Nacht', swarm: 'Schwarm', boat: 'Barkasse', storm: 'Gewitter', tide: 'Gezeiten',
  inspector: 'Inspektor', floes: 'Eisschollen', snowstorm: 'Schneesturm', monsoon: 'Monsun', monkeys: 'Affen',
};

const FIRST_DELAY = { swarm: 8, boat: 10, storm: 6, snowstorm: 5, monsoon: 6, inspector: 12, monkeys: 8 };
const GUSTY = { storm: 1.6, snowstorm: 1.7, monsoon: 1.5 };
const SWARM_SHAPE = [[0, 0], [32, -14], [32, 14], [64, -28], [64, 28]];
const BOAT_DY = 18;
const TIDE_AMP = 34;
const TIDE_PERIOD = 70;
const INSPECT_TIME = 20;
const ROPE_TOP = GANTRY_Y + 10;
const MONKEY_RIDE = 5;

// Besondere Vorkommnisse einer Schicht – auch mehrere gleichzeitig
export class Events {
  constructor() {
    this.dark = null;
    this.reset({ events: [] });
  }

  // mods: Werkstatt (Windmesser warnt früher, Scheinwerfer sehen weiter)
  reset(level, mods = {}) {
    this.types = new Set(level.events || []);
    this.early = mods.earlyWarn || 0;
    this.lights = mods.lights || 1;
    this.clear = mods.clearSight || 0;
    this.lines = null;
    this.t = 0;
    this.windFactor = 1;
    this.waveBoost = 1;
    this.tide = 0;
    this.timers = {};
    for (const t of this.types) this.timers[t] = FIRST_DELAY[t] ?? 0;
    this.swarmWarn = null;
    this.boatWarn = 0;
    this.boat = null;
    this.gustType = Object.keys(GUSTY).find(t => this.types.has(t)) || null;
    this.gustWarn = 0;
    this.gust = 0;
    this.flash = 0;
    this.inspect = 0;
    this.inspectWarn = 0;
    this.inspX = -40;
    this.floes = this.types.has('floes')
      ? Array.from({ length: 3 }, (_, i) => ({ x: QUAY_X1 + 120 + i * 230 + rand(-40, 40), w: rand(52, 78), v: rand(10, 20) * (rnd() < 0.5 ? -1 : 1) }))
      : [];
    this.monkey = this.types.has('monkeys')
      ? { state: 'perch', x: rand(300, 700), y: GANTRY_Y - 12, vx: 0, vy: 0, k: 0, ride: 0, cd: FIRST_DELAY.monkeys, t: 0 }
      : null;
    this.fog = Array.from({ length: 7 }, () => ({ x: rand(QUAY_X1, W), y: rand(230, 410), r: rand(120, 200), v: rand(8, 20) }));
  }

  has(t) { return this.types.has(t); }
  get inspecting() { return this.inspect > 0; }

  say(g, key, cargo = null) { g.ui.say(lineFor(key, g.world.theme.lines, cargo)); }

  update(dt, g) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    const live = g.phase === 'play';
    let boost = 1;
    if (this.has('swarm')) this.updateSwarm(dt, g, live);
    if (this.has('boat')) boost = Math.max(boost, this.updateBoat(dt, g, live));
    if (this.gustType) this.updateGusts(dt, g, live);
    if (this.has('fog') || this.has('snowstorm')) {
      for (const f of this.fog) {
        f.x += (f.v + g.wind * 0.1) * dt;
        if (f.x > W + f.r) f.x = QUAY_X1 - f.r;
        if (f.x < QUAY_X1 - f.r) f.x = W + f.r;
      }
    }
    if (this.has('tide')) this.tide = TIDE_AMP * Math.sin((this.t / TIDE_PERIOD) * Math.PI * 2);
    if (this.has('inspector')) this.updateInspector(dt, g, live);
    if (this.has('floes')) boost = Math.max(boost, this.updateFloes(dt, g));
    if (this.monkey) this.updateMonkey(dt, g, live);
    this.waveBoost += (boost - this.waveBoost) * Math.min(1, dt * 1.2);
  }

  updateSwarm(dt, g, live) {
    if (this.swarmWarn) {
      this.swarmWarn.t -= dt;
      if (this.swarmWarn.t > 0) return;
      const { side, y } = this.swarmWarn;
      for (const [back, dy] of SWARM_SHAPE) {
        g.world.gulls.push(new Gull({ x: (side < 0 ? -30 : W + 30) + side * back, y: y + dy, dir: -side, speed: 150 }, g.world.theme.critter));
      }
      this.swarmWarn = null;
      this.timers.swarm = rand(16, 22);
      return;
    }
    this.timers.swarm -= dt;
    if (this.timers.swarm <= 0 && live) {
      const side = rnd() < 0.5 ? -1 : 1; // Seite, von der der Schwarm kommt
      this.swarmWarn = { t: 2 + this.early, side, y: rand(150, 250) };
      g.ui.say(`Schwarm von ${side < 0 ? 'links' : 'rechts'}!`);
      sfx.gull();
    }
  }

  // Die Barkasse kommt von rechts, dreht vor dem Kai und tuckert wieder hinaus. Gibt den Wellen-Faktor zurück.
  updateBoat(dt, g, live) {
    const b = this.boat;
    if (b) {
      b.x += b.dir * 110 * dt;
      if (b.dir < 0 && b.x < QUAY_X1 + 70) b.dir = 1;
      if (b.dir > 0 && b.x > W + 80) {
        this.boat = null;
        this.timers.boat = rand(12, 18);
      }
    } else if (this.boatWarn > 0) {
      this.boatWarn -= dt;
      if (this.boatWarn <= 0) this.boat = { x: W + 70, dir: -1 };
    } else {
      this.timers.boat -= dt;
      if (this.timers.boat <= 0 && live) {
        this.boatWarn = 1.5 + this.early;
        this.say(g, 'boat');
        sfx.boatHorn();
      }
    }
    // Bugwelle: Schiff schaukelt stärker, solange die Barkasse in der Nähe ist
    return this.boat && Math.abs(this.boat.x - g.ship.pivotX) < 260 ? 2.2 : 1;
  }

  // Böen für Gewitter, Schneesturm und Monsun
  updateGusts(dt, g, live) {
    const type = this.gustType;
    if (this.gust > 0) {
      this.gust -= dt;
    } else if (this.gustWarn > 0) {
      this.gustWarn -= dt;
      if (this.gustWarn <= 0) this.gust = 2.5;
    } else {
      this.timers[type] -= dt;
      if (this.timers[type] <= 0 && live) {
        this.gustWarn = 1.5 + this.early;
        this.timers[type] = rand(7, 11);
        if (type === 'snowstorm') {
          sfx.wind();
        } else {
          this.flash = type === 'storm' || rnd() < 0.3 ? 0.3 : 0;
          if (this.flash) sfx.thunder();
          else sfx.wind();
        }
        if (rnd() < 0.5) this.say(g, 'gust');
      }
    }
    this.windFactor += ((this.gust > 0 ? GUSTY[type] : 1) - this.windFactor) * Math.min(1, dt * 3);
  }

  updateInspector(dt, g, live) {
    const target = this.inspect > 0 || this.inspectWarn > 0 ? 150 : -40;
    this.inspX += clamp(target - this.inspX, -90 * dt, 90 * dt);
    if (this.inspect > 0) {
      this.inspect -= dt;
      if (this.inspect <= 0) {
        this.say(g, 'inspectorGone');
        this.timers.inspector = rand(18, 26);
      }
      return;
    }
    if (this.inspectWarn > 0) {
      this.inspectWarn -= dt;
      if (this.inspectWarn <= 0) this.inspect = INSPECT_TIME;
      return;
    }
    this.timers.inspector -= dt;
    if (this.timers.inspector <= 0 && live) {
      this.inspectWarn = 2 + this.early;
      this.say(g, 'inspectorCome');
      sfx.whistle();
    }
  }

  // Treibende Eisschollen; gibt den Wellen-Faktor zurück
  updateFloes(dt, g) {
    let near = false;
    const s = g.ship;
    for (const f of this.floes) {
      f.x += f.v * dt;
      if (f.x > W + f.w) f.x = QUAY_X1 - f.w;
      if (f.x < QUAY_X1 - f.w) f.x = W + f.w;
      if (Math.abs(f.x - s.pivotX) < s.width / 2 + 30) near = true;
    }
    return near ? 1.6 : 1;
  }

  // Scholle unter einem fallenden Container (Mittelpunkt x, Unterkante bottom)?
  floeAt(x, bottom, waveY) {
    for (const f of this.floes) {
      if (Math.abs(x - f.x) < f.w / 2 + 10 && bottom >= waveY(f.x) - 6) return f;
    }
    return null;
  }

  // Affe: sitzt auf der Kranbrücke, rutscht am Seil auf die Fracht und räumt aus, wenn man ihn nicht abschüttelt
  updateMonkey(dt, g, live) {
    const m = this.monkey;
    const c = g.crane;
    m.t += dt;
    if (m.state === 'perch') {
      m.y = GANTRY_Y - 12;
      m.x += clamp(c.x - 40 - m.x, -50 * dt, 50 * dt);
      m.cd -= dt;
      if (m.cd <= 0 && live && c.cargo) {
        m.state = 'climb';
        m.k = 0;
        this.say(g, 'monkeyOn');
        sfx.monkey();
      }
    } else if (m.state === 'climb' || m.state === 'climbUp') {
      if (m.state === 'climb') {
        m.k += dt / 1.6;
        if (!c.cargo) m.state = 'climbUp';
        else if (m.k >= 1) { m.state = 'ride'; m.ride = MONKEY_RIDE; }
      } else {
        m.k -= dt / 1.2;
        if (m.k <= 0) { m.state = 'perch'; m.cd = rand(12, 16); }
      }
      const k = clamp(m.k, 0, 1);
      m.x = c.x + (c.hookX - c.x) * k + 5;
      m.y = ROPE_TOP + (c.hookY - ROPE_TOP) * k - 6;
    } else if (m.state === 'ride') {
      const sn = Math.sin(-c.theta), cs = Math.cos(-c.theta);
      m.x = c.hookX + 18 * cs + 4 * sn;
      m.y = c.hookY + 18 * sn - 4 * cs;
      if (!c.cargo) {
        this.dropMonkey(c);
        return;
      }
      c.omega += frand(-1, 1) * 4 * dt;
      if (Math.abs(c.theta) > 0.5) {
        this.dropMonkey(c);
        g.stats.monkeysShaken++;
        g.score += 30;
        g.ui.float('Affe abgeschüttelt! +30', m.x, m.y - 20, '#7ee081', true);
        this.say(g, 'monkeyOff');
        sfx.monkey();
        return;
      }
      m.ride -= dt;
      if (m.ride <= 0) {
        const target = c.extra || c.cargo;
        Object.assign(target, {
          name: 'Leer (der Affe war\'s)', weight: 1, empty: true,
          reefer: false, cold: null, thawed: false, alive: false, fragile: false, rare: false, ducks: false, id: undefined,
        });
        g.stats.monkeysStole++;
        g.changeMood(-5);
        g.ui.float('Ausgeräumt!', m.x, m.y - 20, '#ff9d5c', true);
        this.say(g, 'monkeySteal');
        sfx.monkey();
        m.state = 'climbUp';
        m.k = 1;
      }
    } else if (m.state === 'fall') {
      m.vy += GRAVITY * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const onLand = m.x < QUAY_X1 || m.x > PIER_X0;
      if (onLand && m.y >= GROUND_Y - 8) {
        m.y = GROUND_Y - 8;
        m.state = 'run';
      } else if (!onLand && m.y > g.world.waveY(m.x)) {
        m.state = 'swim';
        g.world.particles.burst(10, () => ({
          x: m.x + frand(-8, 8), y: g.world.waveY(m.x), vx: frand(-60, 60), vy: frand(-160, -60),
          gravity: GRAVITY, life: 0.6, size: 2, color: '#bfe8ff',
        }));
        sfx.splash();
      }
    } else if (m.state === 'swim') {
      m.x = Math.max(QUAY_X1 - 2, m.x - 45 * dt);
      m.y = g.world.waveY(m.x) - 2;
      if (m.x <= QUAY_X1) { m.state = 'run'; m.y = GROUND_Y - 8; }
    } else if (m.state === 'run') {
      // zum linken Kranbein laufen und hochklettern
      if (m.x > 13) {
        m.x = Math.max(13, m.x - 90 * dt);
        m.y = GROUND_Y - 8;
      } else {
        m.y -= 80 * dt;
        if (m.y <= GANTRY_Y - 12) { m.state = 'perch'; m.cd = rand(10, 15); }
      }
    }
  }

  dropMonkey(c) {
    const m = this.monkey;
    const v = c.hookVelocity();
    m.state = 'fall';
    m.vx = v.vx * 0.8 + (Math.sign(c.theta) || 1) * 60;
    m.vy = Math.min(v.vy, 0) - 120;
  }

  // Wird direkt nach dem Wasser gezeichnet: Barkasse, Schollen, Inspektor, schwimmender Affe
  drawWorld(ctx, g) {
    for (const f of this.floes) this.drawFloe(ctx, f, g.world);
    if (this.boat) this.drawBoat(ctx);
    if (this.has('inspector') && this.inspX > -30) this.drawInspector(ctx);
    const m = this.monkey;
    if (m && ['fall', 'swim', 'run'].includes(m.state)) this.drawMonkey(ctx, m);
  }

  // Nach dem Kran: Affe auf der Brücke, am Seil oder auf der Fracht
  drawAbove(ctx) {
    const m = this.monkey;
    if (m && ['perch', 'climb', 'climbUp', 'ride'].includes(m.state)) this.drawMonkey(ctx, m);
  }

  drawBoat(ctx) {
    const b = this.boat;
    ctx.save();
    ctx.translate(b.x, SEA_Y + this.tide + BOAT_DY + Math.sin(this.t * 3) * 1.5);
    ctx.scale(b.dir, 1);
    // Kielwasser
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(-40 - i * 16, 6);
      ctx.quadraticCurveTo(-48 - i * 16, 1, -56 - i * 16, 6);
    }
    ctx.stroke();
    // Rumpf
    ctx.fillStyle = '#7a3b1e';
    ctx.beginPath();
    ctx.moveTo(-38, -8);
    ctx.lineTo(44, -8);
    ctx.lineTo(32, 8);
    ctx.lineTo(-34, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(-38, -10, 80, 3);
    // Kajüte + Schornstein
    ctx.fillStyle = '#f0e2c0';
    ctx.fillRect(-22, -26, 34, 16);
    ctx.fillStyle = '#9fd8f5';
    for (const wx of [-18, -7, 4]) ctx.fillRect(wx, -22, 7, 7);
    ctx.fillStyle = '#c0261b';
    ctx.fillRect(-14, -38, 8, 12);
    ctx.fillStyle = 'rgba(240,240,240,0.7)';
    for (let i = 0; i < 3; i++) {
      const p = (this.t * 1.5 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(-10 - p * 22, -42 - p * 18, 3 + p * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFloe(ctx, f, world) {
    const y = world.waveY(f.x);
    const hw = f.w / 2;
    ctx.fillStyle = '#f2f8fb';
    ctx.beginPath();
    ctx.moveTo(f.x - hw, y - 2);
    ctx.lineTo(f.x - hw + 8, y - 7);
    ctx.lineTo(f.x + hw - 12, y - 8);
    ctx.lineTo(f.x + hw, y - 3);
    ctx.lineTo(f.x + hw - 4, y + 4);
    ctx.lineTo(f.x - hw + 4, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(140, 190, 220, 0.7)';
    ctx.fillRect(f.x - hw + 4, y + 1, f.w - 8, 3);
  }

  // Strenger Herr mit Klemmbrett
  drawInspector(ctx) {
    const x = this.inspX, y = GROUND_Y;
    const step = this.inspect > 0 ? 0 : Math.sin(this.t * 12) * 2;
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(x - 3 + step, y - 12, 3, 12);
    ctx.fillRect(x + 1 - step, y - 12, 3, 12);
    ctx.fillStyle = '#56606e';
    ctx.fillRect(x - 6, y - 30, 12, 19);
    ctx.fillStyle = '#f2c48d';
    ctx.beginPath();
    ctx.arc(x, y - 36, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 7, y - 43, 14, 3);
    ctx.fillRect(x - 4.5, y - 49, 9, 6);
    ctx.fillStyle = '#c9a26b';
    ctx.fillRect(x + 5, y - 28, 8, 11);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y - 26, 6, 8);
    if (this.inspect > 0) {
      label(ctx, `${Math.ceil(this.inspect)}`, x, y - 56, { size: 14, color: '#ffd23f', align: 'center' });
    }
  }

  drawMonkey(ctx, m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    if (m.state === 'fall') ctx.rotate(m.t * 8);
    const swim = m.state === 'swim';
    if (!swim) {
      // Schwanz
      ctx.strokeStyle = '#6b4423';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.quadraticCurveTo(-14, 6 + Math.sin(m.t * 6) * 3, -12, -4);
      ctx.stroke();
      ctx.fillStyle = '#7a4f2a';
      ctx.beginPath();
      ctx.ellipse(0, 3, 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7a4f2a';
    ctx.beginPath();
    ctx.arc(0, -6, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-5.5, -7, 2.2, 0, Math.PI * 2);
    ctx.arc(5.5, -7, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.ellipse(0, -5, 3.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(-2, -7, 1.3, 1.3);
    ctx.fillRect(0.8, -7, 1.3, 1.3);
    if (m.state === 'ride') {
      // Banane
      ctx.strokeStyle = '#ffd400';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(7, -2, 4, -0.5, 1.4);
      ctx.stroke();
    }
    ctx.restore();
    if (m.state === 'ride') {
      label(ctx, `${Math.ceil(m.ride)}`, m.x, m.y - 18, { size: 13, color: '#ffd23f', align: 'center' });
    }
  }

  // Liegt über der ganzen Szene, aber unter HUD und Chef
  drawFront(ctx, g) {
    const blink = Math.floor(this.t * 5) % 2 === 0;
    if (this.has('fog')) this.drawFog(ctx, 0.55 * (1 - this.clear));
    if (this.has('night')) this.drawNight(ctx, g);
    if (this.has('storm')) this.drawRain(ctx, g, 'rgba(18, 26, 48, 0.3)', 90);
    if (this.has('monsoon')) this.drawRain(ctx, g, 'rgba(16, 48, 40, 0.28)', 140);
    if (this.has('snowstorm')) this.drawSnowstorm(ctx, g);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.8, this.flash * 3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.gustType && (this.gustWarn > 0 || this.gust > 0) && blink) {
      label(ctx, this.gust > 0 ? '⚠ BÖE!' : '⚠ Böe kommt!', W / 2, 140, { size: 22, color: '#ffd23f', align: 'center' });
    }
    if (this.swarmWarn && blink) {
      const left = this.swarmWarn.side < 0;
      label(ctx, left ? '⚠ Schwarm ▶' : '◀ Schwarm ⚠', left ? 16 : W - 16, this.swarmWarn.y, { size: 18, color: '#ffd23f', align: left ? 'left' : 'right' });
    }
    if (this.boatWarn > 0 && blink) {
      label(ctx, '◀ Barkasse ⚠', W - 16, SEA_Y - 14, { size: 18, color: '#ffd23f', align: 'right' });
    }
    if (this.inspectWarn > 0 && blink) {
      label(ctx, '⚠ Inspektor kommt!', STACK_X + 60, GROUND_Y - 150, { size: 18, color: '#ffd23f', align: 'center' });
    }
  }

  drawFog(ctx, base) {
    const density = base + 0.3 * Math.sin(this.t * 0.25) * (base / 0.55);
    ctx.fillStyle = 'rgba(228, 236, 242, 0.16)';
    ctx.fillRect(0, 0, W, H);
    for (const f of this.fog) {
      const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      gr.addColorStop(0, `rgba(236, 242, 246, ${density})`);
      gr.addColorStop(0.6, `rgba(236, 242, 246, ${density * 0.6})`);
      gr.addColorStop(1, 'rgba(236, 242, 246, 0)');
      ctx.fillStyle = gr;
      ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
  }

  drawNight(ctx, g) {
    if (!this.dark) {
      this.dark = document.createElement('canvas');
      this.dark.width = W;
      this.dark.height = H;
    }
    const d = this.dark.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(5, 10, 28, 0.84)';
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const k = this.lights;
    const light = (x, y, r, a = 1) => {
      const gr = d.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.75})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = gr;
      d.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const c = g.crane;
    const lamp = g.ship.lanternPos();
    light(c.hookX, c.hookY + 20, 135 * k);
    light(STACK_X, GROUND_Y - 60, 125 * k);
    light(lamp.x, lamp.y, 95 * k);
    light(g.ship.pivotX, g.ship.pivotY - 30, 230 * k, 0.5);
    if (g.feeder) light(g.feeder.pivotX, g.feeder.pivotY - 20, 130 * k, 0.5);
    light(PUB.x0 + 20, PUB.y0 + 40, 60, 0.8);
    ctx.drawImage(this.dark, 0, 0, W, H);
  }

  // Regen: Tropfen ohne eigenen Zustand, Schräglage folgt dem Wind
  drawRain(ctx, g, tint, drops) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    const slant = g.wind * 0.25;
    ctx.strokeStyle = 'rgba(200, 225, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < drops; i++) {
      const y = (i * 53.7 + this.t * 720) % (H + 40) - 20;
      const x = ((i * 97.3 + y * slant / 720 * 2) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.moveTo(x, y);
      ctx.lineTo(x + slant * 0.03, y + 16);
    }
    ctx.stroke();
  }

  drawSnowstorm(ctx, g) {
    this.drawFog(ctx, 0.38 * (1 - this.clear));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const drift = g.wind * 0.6;
    for (let i = 0; i < 160; i++) {
      const y = (i * 37.9 + this.t * (90 + (i % 5) * 20)) % (H + 20) - 10;
      const x = ((i * 61.7 + this.t * drift + Math.sin(this.t * 2 + i) * 8) % W + W) % W;
      ctx.fillRect(x, y, 2 + (i % 2), 2 + (i % 2));
    }
  }
}
