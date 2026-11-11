import {
  W, H, SEA_Y, GROUND_Y, QUAY_X1, PIER_X0, PUB, GANTRY_Y, STACK_X, BOX_W, BOX_H, rand, rnd,
} from './config.js';
import { drawBox } from './container.js';
import { randomCargo } from './content.js';
import { harbor } from './harbors.js';
import { DEFAULT_PAINT } from './crane.js';

const STACK_SIZE = 4;
export const TRUCK_H = 16; // Höhe der Lkw-Ladefläche über dem Kai
const SKYLINE = [
  [205, 40, 30], [250, 26, 52], [282, 60, 22], [350, 30, 40], [388, 70, 18], [470, 24, 60],
  [500, 50, 28], [565, 36, 44], [610, 80, 16], [700, 28, 50], [735, 60, 26], [800, 40, 36],
];
const MOUNTAINS = [[180, 70, 80], [260, 110, 120], [380, 90, 70], [470, 130, 110], [600, 100, 90], [720, 140, 120], [860, 90, 70]];
const HILLS = [[160, 110, 40], [330, 150, 58], [520, 120, 44], [700, 170, 62], [900, 120, 46]];
const PALMS = [[240, 0.9], [300, 0.7], [560, 1], [610, 0.75], [770, 0.85]];

export class Particles {
  constructor() { this.list = []; }

  add(p) {
    this.list.push({
      x: 0, y: 0, vx: 0, vy: 0, life: 1, age: 0, size: 3, color: '#fff',
      gravity: 0, drag: 0, shape: 'circle', rot: 0, vr: 0, ...p,
    });
  }

  burst(n, make) { for (let i = 0; i < n; i++) this.add(make(i)); }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      p.vy += p.gravity * dt;
      const f = Math.max(0, 1 - p.drag * dt);
      p.vx *= f;
      p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.list = this.list.filter(p => p.age < p.life).slice(-600);
  }

  draw(ctx) {
    for (const p of this.list) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 'rect') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
      } else if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

// Aussehen der Flugtiere: Möwe (Heimathafen), Papageitaucher (Eis), Papagei (Tropen)
const BIRDS = {
  gull: { wing: '#3b3b3b', body: '#fff', head: '#fff', beak: '#f29a1d', beakLen: 6 },
  puffin: { wing: '#1d1d1d', body: '#262626', head: '#f2f2f2', beak: '#ff6a2a', beakLen: 7 },
  parrot: { wing: '#2a9d4a', body: '#e2302d', head: '#e2302d', beak: '#ffd23f', beakLen: 5 },
};

export class Gull {
  // pass: {x, y, dir, speed} – Vogel eines Schwarms, fliegt einmal durchs Bild und kommt nicht wieder
  constructor(pass = null, kind = 'gull') {
    this.kind = kind;
    this.pass = !!pass;
    this.dead = false;
    this.angry = false; // wurde getroffen: kommt schneller und mit Verstärkung zurück
    this.bringFriend = false;
    this.spawn(true);
    if (pass) {
      this.x = pass.x;
      this.y = this.baseY = pass.y;
      this.dir = pass.dir;
      this.speed = pass.speed;
    }
  }

  spawn(initial) {
    this.x = initial ? rand(260, 800) : (rnd() < 0.5 ? -30 : W + 30);
    this.dir = initial ? (rnd() < 0.5 ? -1 : 1) : (this.x < 0 ? 1 : -1);
    this.baseY = rand(120, 260);
    this.y = this.baseY;
    this.vy = 0;
    this.speed = rand(45, 85) * (this.angry ? 1.3 : 1);
    this.state = 'fly'; // fly | stunned | flee | gone
    this.timer = 0;
    this.t = rand(0, 10);
    if (!initial && this.angry) this.bringFriend = true;
  }

  get hittable() { return this.state === 'fly'; }

  hit() {
    this.state = 'stunned';
    this.timer = 2.2;
    this.vy = -60;
    this.angry = true;
  }

  update(dt, waveY) {
    this.t += dt;
    if (this.state === 'fly') {
      this.x += this.dir * this.speed * dt;
      this.y = this.baseY + Math.sin(this.t * 2) * 10;
      if (this.pass) {
        if ((this.dir < 0 && this.x < -40) || (this.dir > 0 && this.x > W + 40)) this.dead = true;
      } else {
        if (this.x < 220 && this.dir < 0) this.dir = 1;
        if (this.x > 820 && this.dir > 0) this.dir = -1;
      }
    } else if (this.state === 'stunned') {
      this.timer -= dt;
      this.vy += 300 * dt;
      this.y += this.vy * dt;
      const water = waveY(this.x) - 8;
      if (this.y > water) { this.y = water; this.vy = 0; }
      if (this.timer <= 0) {
        this.state = 'flee';
        this.dir = rnd() < 0.5 ? -1 : 1;
      }
    } else if (this.state === 'flee') {
      this.x += this.dir * 170 * dt;
      this.y -= 90 * dt;
      if (this.x < -40 || this.x > W + 40) { this.state = 'gone'; this.timer = 3; }
    } else if (this.state === 'gone') {
      this.timer -= dt;
      if (this.pass) this.dead = true;
      else if (this.timer <= 0) this.spawn(false);
    }
  }

  draw(ctx) {
    if (this.state === 'gone') return;
    const st = BIRDS[this.kind] || BIRDS.gull;
    const stunned = this.state === 'stunned';
    ctx.save();
    ctx.translate(this.x, this.y);
    if (stunned) ctx.rotate(Math.sin(this.t * 10) * 0.4);
    ctx.scale(this.dir, 1);
    const flap = stunned ? -2 : Math.sin(this.t * (this.state === 'flee' ? 22 : 12)) * 8;

    ctx.strokeStyle = st.wing;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-15, -2 - flap);
    ctx.quadraticCurveTo(-7, -8 - flap * 0.4, 0, 0);
    ctx.quadraticCurveTo(7, -8 - flap * 0.4, 15, -2 - flap);
    ctx.stroke();

    ctx.fillStyle = st.body;
    ctx.beginPath();
    ctx.ellipse(0, 2, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.kind === 'puffin') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(1, 4, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = st.head;
    ctx.beginPath();
    ctx.arc(8, -1, 4, 0, Math.PI * 2);
    ctx.fill();
    if (this.kind === 'parrot') {
      ctx.fillStyle = '#2b7bd9';
      ctx.beginPath();
      ctx.moveTo(-8, 2);
      ctx.lineTo(-18, 6);
      ctx.lineTo(-8, 5);
      ctx.fill();
    }
    ctx.fillStyle = st.beak;
    ctx.beginPath();
    ctx.moveTo(11, -2.5);
    ctx.lineTo(11 + st.beakLen, 0);
    ctx.lineTo(11, this.kind === 'puffin' ? 2.5 : 1);
    ctx.fill();

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (stunned) {
      ctx.moveTo(7, -3); ctx.lineTo(10, 0);
      ctx.moveTo(10, -3); ctx.lineTo(7, 0);
    } else {
      ctx.arc(9, -2, 0.8, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();

    if (stunned) {
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 3; i++) {
        const a = this.t * 5 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(a) * 12, this.y - 14 + Math.sin(a) * 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export class World {
  constructor() {
    this.particles = new Particles();
    this.gulls = [];
    this.ducks = [];
    this.stack = [];
    this.t = 0;
    this.waveAmp = 1;
    this.tide = 0;
    this.pubBroken = false;
    this.landlordT = 0;
    this.unload = false;
    this.palette = null;
    this.theme = harbor('hafen');
    this.cargoOpts = {};
    this.look = { paint: DEFAULT_PAINT, deco: 'none' };
    this.friendArrived = false;
    this.records = { far: 0, toss: 0 }; // für die Kreidetafel: weitester Wurf, bester Feierabend
    this.truck = { x: STACK_X, state: 'ready', cargo: null, extra: null, dx: 0 };
    this.clouds = [
      { x: 120, y: 110, s: 1 }, { x: 420, y: 150, s: 0.7 }, { x: 640, y: 95, s: 1.2 }, { x: 880, y: 170, s: 0.8 },
    ];
  }

  // palette: Farben des Ladeplans (oder null); look: Kosmetik (Kranlack, Kneipen-Deko)
  reset(level, palette = null, look = null) {
    this.unload = level.mode === 'unload';
    this.palette = palette;
    this.theme = harbor(level.harbor);
    this.cargoOpts = { harbor: this.theme.id, reefers: level.reefers || 0, mode: level.mode };
    if (look) this.look = look;
    this.truck = { x: STACK_X, state: 'ready', cargo: null, extra: null, dx: 0 };
    this.maxGulls = level.gulls + 3;
    this.gulls = Array.from({ length: level.gulls }, () => new Gull(null, this.theme.critter));
    this.ducks = [];
    this.particles.list = [];
    this.pubBroken = false;
    this.landlordT = 0;
    this.tide = 0;
    this.friendArrived = false;
    this.waveAmp = 1.5 + level.wave * 0.35;
    this.refillStack();
  }

  // Beim Löschen steht statt des Stapels ein Lkw am Kai
  refillStack() {
    this.stack = this.unload ? [] : Array.from({ length: STACK_SIZE }, () => randomCargo(this.palette, 0, this.cargoOpts));
  }

  stackTopY() {
    if (this.unload) return this.truck.state === 'ready' ? GROUND_Y - TRUCK_H : GROUND_Y;
    return GROUND_Y - this.stack.length * BOX_H;
  }

  loadTruck(cargo, extra, dx) {
    this.truck.cargo = cargo;
    this.truck.extra = extra;
    this.truck.dx = dx;
    this.truck.state = 'leaving';
    this.truck.wait = 0.35;
  }

  updateTruck(dt) {
    const t = this.truck;
    if (t.state === 'leaving') {
      t.wait -= dt;
      if (t.wait > 0) return;
      t.x -= 320 * dt;
      if (t.x < -110) { t.cargo = null; t.extra = null; t.state = 'arriving'; }
    } else if (t.state === 'arriving') {
      t.x = Math.min(STACK_X, t.x + 320 * dt);
      if (t.x >= STACK_X) t.state = 'ready';
    }
  }

  waveY(x) {
    return SEA_Y + this.tide + Math.sin(x * 0.025 + this.t * 2.1) * this.waveAmp
      + Math.sin(x * 0.061 - this.t * 1.3) * this.waveAmp * 0.5;
  }

  spawnDucks(x, n) {
    for (let i = 0; i < n; i++) this.ducks.push({ x: x + rand(-30, 30), vx: rand(-25, 25), phase: rand(0, 6) });
    this.ducks = this.ducks.slice(-60);
  }

  breakPub() {
    this.pubBroken = true;
    this.landlordT = 3.5;
  }

  update(dt, wind) {
    this.t += dt;
    this.landlordT = Math.max(0, this.landlordT - dt);
    const waveY = x => this.waveY(x);
    for (const g of this.gulls) g.update(dt, waveY);
    // Getroffene Vögel bringen bei der Rückkehr Verstärkung mit
    for (const g of [...this.gulls]) {
      if (!g.bringFriend) continue;
      g.bringFriend = false;
      if (this.gulls.length >= this.maxGulls) continue;
      const friend = new Gull(null, this.theme.critter);
      friend.spawn(false);
      friend.x = g.x - g.dir * 40;
      friend.dir = g.dir;
      friend.baseY = g.baseY + rand(-30, 30);
      friend.speed = g.speed * 0.95;
      this.gulls.push(friend);
      this.friendArrived = true;
    }
    this.gulls = this.gulls.filter(g => !g.dead);
    if (this.unload) this.updateTruck(dt);
    for (const d of this.ducks) {
      d.vx += rand(-1, 1) * 20 * dt + wind * 0.02 * dt;
      d.x += d.vx * dt;
    }
    this.ducks = this.ducks.filter(d => d.x > QUAY_X1 - 10 && d.x < W + 20);
    for (const c of this.clouds) {
      c.x += (6 + wind * 0.08) * dt;
      if (c.x > W + 80) c.x = -80;
      if (c.x < -80) c.x = W + 80;
    }
    this.particles.update(dt);
  }

  drawBackground(ctx) {
    const th = this.theme;
    const sky = ctx.createLinearGradient(0, 0, 0, 362);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 362);

    const sunR = th.id === 'tropen' ? 40 : 32;
    ctx.fillStyle = 'rgba(255, 243, 176, 0.35)';
    ctx.beginPath();
    ctx.arc(780, 120, sunR + 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = th.sun;
    ctx.beginPath();
    ctx.arc(780, 120, sunR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of this.clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 20 * c.s, c.y - 8 * c.s, 22 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 42 * c.s, c.y, 16 * c.s, 0, Math.PI * 2);
      ctx.fill();
    }

    if (th.id === 'eis') this.drawMountains(ctx);
    else if (th.id === 'tropen') this.drawHills(ctx);
    else {
      ctx.fillStyle = th.skyline;
      for (const [x, w, h] of SKYLINE) ctx.fillRect(x, 362 - h, w, h);
      // ferner Containerkran
      ctx.strokeStyle = th.skyline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(660, 362); ctx.lineTo(660, 290); ctx.lineTo(720, 290);
      ctx.moveTo(640, 296); ctx.lineTo(720, 296);
      ctx.stroke();
    }

    const far = ctx.createLinearGradient(0, 360, 0, 440);
    far.addColorStop(0, th.far[0]);
    far.addColorStop(1, th.far[1]);
    ctx.fillStyle = far;
    ctx.fillRect(0, 360, W, 80);

    if (th.id === 'eis') {
      // Eisberg in der Ferne
      ctx.fillStyle = '#f2f8fb';
      ctx.beginPath();
      ctx.moveTo(300, 372); ctx.lineTo(322, 346); ctx.lineTo(336, 354); ctx.lineTo(352, 338); ctx.lineTo(380, 372);
      ctx.fill();
      ctx.fillStyle = 'rgba(150, 190, 215, 0.6)';
      ctx.beginPath();
      ctx.moveTo(336, 354); ctx.lineTo(352, 338); ctx.lineTo(380, 372); ctx.lineTo(346, 372);
      ctx.fill();
    }
  }

  drawMountains(ctx) {
    for (const [x, w, h] of MOUNTAINS) {
      ctx.fillStyle = this.theme.skyline;
      ctx.beginPath();
      ctx.moveTo(x - w, 362);
      ctx.lineTo(x, 362 - h);
      ctx.lineTo(x + w, 362);
      ctx.fill();
      ctx.fillStyle = '#f7fbfd';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, 362 - h * 0.7);
      ctx.lineTo(x, 362 - h);
      ctx.lineTo(x + w * 0.3, 362 - h * 0.7);
      ctx.lineTo(x + w * 0.1, 362 - h * 0.62);
      ctx.lineTo(x - w * 0.05, 362 - h * 0.72);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawHills(ctx) {
    ctx.fillStyle = this.theme.skyline;
    for (const [x, w, h] of HILLS) {
      ctx.beginPath();
      ctx.ellipse(x, 362, w, h, 0, Math.PI, 0);
      ctx.fill();
    }
    for (const [x, s] of PALMS) {
      const top = 362 - 64 * s;
      ctx.strokeStyle = '#7a5a32';
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(x, 362);
      ctx.quadraticCurveTo(x + 10 * s, 362 - 34 * s, x + 4 * s, top);
      ctx.stroke();
      ctx.strokeStyle = '#2f8a4a';
      ctx.lineWidth = 3.5 * s;
      for (const a of [-2.6, -2, -1.2, -0.5, 0.1]) {
        ctx.beginPath();
        ctx.moveTo(x + 4 * s, top);
        ctx.quadraticCurveTo(x + 4 * s + Math.cos(a) * 16 * s, top + Math.sin(a) * 16 * s - 6 * s,
          x + 4 * s + Math.cos(a) * 28 * s, top + Math.sin(a) * 14 * s + 8 * s);
        ctx.stroke();
      }
    }
  }

  drawLand(ctx, wind) {
    const th = this.theme;
    // Kai
    ctx.fillStyle = th.quay[0];
    ctx.fillRect(0, GROUND_Y, QUAY_X1, H - GROUND_Y);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = GROUND_Y + 40; y < H; y += 28) { ctx.moveTo(0, y); ctx.lineTo(QUAY_X1, y); }
    ctx.stroke();
    ctx.fillStyle = th.quay[1];
    ctx.fillRect(0, GROUND_Y, QUAY_X1, 8);
    for (let x = 0; x < QUAY_X1; x += 16) {
      ctx.fillStyle = (x / 16) % 2 ? '#222' : '#f2c12e';
      ctx.fillRect(x, GROUND_Y + 8, 16, 5);
    }
    ctx.fillStyle = '#333';
    ctx.fillRect(170, GROUND_Y - 12, 10, 12);
    ctx.fillRect(167, GROUND_Y - 14, 16, 4);

    // Steg
    ctx.fillStyle = '#5b3d24';
    for (let x = PIER_X0 + 6; x < W; x += 28) ctx.fillRect(x, GROUND_Y + 10, 7, H - GROUND_Y);
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(PIER_X0, GROUND_Y, W - PIER_X0, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    for (let x = PIER_X0 + 15; x < W; x += 15) { ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y + 12); }
    ctx.stroke();
    if (th.snow) {
      ctx.fillStyle = '#f4f8fb';
      ctx.fillRect(PIER_X0, GROUND_Y - 2, W - PIER_X0, 3);
    }

    this.drawPub(ctx, wind);
    this.drawChalkboard(ctx);
    this.drawGantry(ctx);

    this.stack.forEach((c, i) => drawBox(ctx, c, STACK_X, GROUND_Y - BOX_H * (i + 0.5)));
    if (this.unload) this.drawTruck(ctx);
  }

  // Kreidetafel der Kneipe, aufgestellt am Kai: die Wurf-Rekorde
  drawChalkboard(ctx) {
    const { far, toss } = this.records;
    if (!far && !toss) return;
    const x = 24, y = GROUND_Y - 44, w = 42, h = 34;
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(x + 4, y + h, 3, 10);
    ctx.fillRect(x + w - 7, y + h, 3, 10);
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#26332c';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e8ece4';
    ctx.font = 'bold 7px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REKORDE', x + w / 2, y + 9);
    ctx.fillRect(x + 8, y + 11, w - 16, 1);
    ctx.font = '7px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillText(`Wurf ${far} m`, x + w / 2, y + 21);
    ctx.fillText(`Abend ${toss}`, x + w / 2, y + 30);
  }

  // Kranbrücke im gekauften Lack
  drawGantry(ctx) {
    const p = this.look.paint || DEFAULT_PAINT;
    ctx.strokeStyle = p.line;
    ctx.lineWidth = 2;
    for (const lx of [6, 942]) {
      ctx.fillStyle = p.leg;
      ctx.fillRect(lx, GANTRY_Y, 14, GROUND_Y - GANTRY_Y);
      ctx.beginPath();
      for (let y = GANTRY_Y; y < GROUND_Y - 20; y += 24) {
        ctx.moveTo(lx + 2, y); ctx.lineTo(lx + 12, y + 12); ctx.lineTo(lx + 2, y + 24);
      }
      ctx.stroke();
    }
    ctx.fillStyle = p.beam;
    ctx.fillRect(0, GANTRY_Y - 10, W, 12);
    if (p.camo) {
      ctx.fillStyle = p.camo;
      for (let x = 7; x < W; x += 37) {
        ctx.beginPath();
        ctx.ellipse(x, GANTRY_Y - 4 + ((x * 7) % 5) - 2, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const lx of [6, 942]) {
        for (let y = GANTRY_Y + 20; y < GROUND_Y; y += 45) {
          ctx.beginPath();
          ctx.ellipse(lx + 7, y, 4, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.beginPath();
    for (let x = 0; x < W; x += 20) { ctx.moveTo(x, GANTRY_Y - 9); ctx.lineTo(x + 10, GANTRY_Y + 1); ctx.lineTo(x + 20, GANTRY_Y - 9); }
    ctx.stroke();
    if (this.theme.snow) {
      ctx.fillStyle = '#f4f8fb';
      ctx.fillRect(0, GANTRY_Y - 13, W, 3);
    }
  }

  drawTruck(ctx) {
    const t = this.truck;
    const y = GROUND_Y;
    // Parkmarkierung bleibt am Kai stehen
    ctx.fillStyle = 'rgba(255, 210, 63, 0.9)';
    ctx.beginPath();
    ctx.moveTo(STACK_X - 5, y + 7);
    ctx.lineTo(STACK_X + 5, y + 7);
    ctx.lineTo(STACK_X, y + 1);
    ctx.fill();

    ctx.save();
    ctx.translate(t.x, 0);
    if (t.cargo) drawBox(ctx, t.cargo, t.dx, y - TRUCK_H - BOX_H / 2);
    if (t.extra) drawBox(ctx, t.extra, t.dx, y - TRUCK_H - BOX_H * 1.5);
    // Ladefläche
    ctx.fillStyle = '#4a5560';
    ctx.fillRect(-38, y - TRUCK_H, 76, 7);
    ctx.fillStyle = '#2f3840';
    ctx.fillRect(-34, y - TRUCK_H + 7, 68, 3);
    // Führerhaus (fährt nach links ab)
    ctx.fillStyle = '#2f8f5b';
    ctx.beginPath();
    ctx.roundRect(-64, y - 34, 24, 30, [6, 3, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#bfe8ff';
    ctx.fillRect(-61, y - 30, 12, 10);
    ctx.fillStyle = '#1d1d1d';
    for (const wx of [-52, -22, 24]) {
      ctx.beginPath();
      ctx.arc(wx, y - 5, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#9aa1a8';
    for (const wx of [-52, -22, 24]) {
      ctx.beginPath();
      ctx.arc(wx, y - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPub(ctx, wind) {
    const style = this.theme.pub.style;
    let roofTop;
    if (style === 'iglu') roofTop = this.drawIglu(ctx);
    else if (style === 'hut') roofTop = this.drawHut(ctx);
    else roofTop = this.drawTavern(ctx);
    this.drawDeco(ctx, style);
    this.drawLandlord(ctx);
    this.drawVane(ctx, wind, roofTop);
  }

  // Klassische Hafenkneipe; gibt die Dachspitze zurück
  drawTavern(ctx) {
    const { x0, x1, y0, y1 } = PUB;
    const mx = (x0 + x1) / 2;
    ctx.fillStyle = '#c4834f';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = y0 + 22; y < y1; y += 8) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();

    ctx.fillStyle = '#8e2b22';
    ctx.beginPath();
    ctx.moveTo(x0 - 8, y0);
    ctx.lineTo(mx, y0 - 26);
    ctx.lineTo(x1 + 8, y0);
    ctx.fill();

    this.drawSign(ctx, x0 + 3, y0 + 4, x1 - x0 - 6, '#2d1c10', '#ffd27a');
    this.drawWindow(ctx, x0 + 7, y0 + 28, 26, 22, '#ffe9a8', '#5a3418');
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(x1 - 26, y1 - 36, 18, 36);
    return y0 - 26;
  }

  // Iglu-Imbiss im Eishafen
  drawIglu(ctx) {
    const { x0, x1, y1 } = PUB;
    const mx = (x0 + x1) / 2;
    const top = 306;
    ctx.fillStyle = '#eef5f9';
    ctx.beginPath();
    ctx.ellipse(mx, y1, (x1 - x0) / 2 + 4, y1 - top, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 130, 160, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 5; k++) {
      const y = y1 - (y1 - top) * k / 5;
      const half = ((x1 - x0) / 2 + 4) * Math.sqrt(1 - (k / 5) ** 2);
      ctx.moveTo(mx - half, y);
      ctx.lineTo(mx + half, y);
      for (let x = mx - half + ((k % 2) * 8) + 8; x < mx + half; x += 16) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + (y1 - top) / 5);
      }
    }
    ctx.stroke();
    // Eingangstunnel
    ctx.fillStyle = '#dfeaf1';
    ctx.beginPath();
    ctx.ellipse(x1 - 12, y1, 16, 24, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3a4a58';
    ctx.beginPath();
    ctx.ellipse(x1 - 12, y1, 8, 15, 0, Math.PI, 0);
    ctx.fill();
    this.drawSign(ctx, mx - 30, top - 4, 60, '#3a4a58', '#bfe8ff');
    this.drawWindow(ctx, x0 + 10, 336, 22, 18, '#ffe9a8', '#9fb6c6');
    return top - 4;
  }

  // Strandbar im Tropenhafen
  drawHut(ctx) {
    const { x0, x1, y0, y1 } = PUB;
    const mx = (x0 + x1) / 2;
    ctx.fillStyle = '#d9a85b';
    ctx.fillRect(x0, y0 + 6, x1 - x0, y1 - y0 - 6);
    ctx.strokeStyle = 'rgba(90, 55, 20, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = x0 + 6; x < x1; x += 8) { ctx.moveTo(x, y0 + 6); ctx.lineTo(x, y1); }
    ctx.stroke();
    // Palmblattdach mit Fransen
    ctx.fillStyle = '#6f9a3a';
    ctx.beginPath();
    ctx.moveTo(x0 - 12, y0 + 10);
    ctx.lineTo(mx, y0 - 24);
    ctx.lineTo(x1 + 12, y0 + 10);
    ctx.fill();
    ctx.strokeStyle = '#4f7426';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0 - 10; x <= x1 + 10; x += 6) { ctx.moveTo(x, y0 + 8); ctx.lineTo(x + 2, y0 + 16); }
    ctx.stroke();
    this.drawSign(ctx, x0 + 3, y0 + 18, x1 - x0 - 6, '#5a3418', '#ffe066');
    this.drawWindow(ctx, x0 + 7, y0 + 38, 30, 16, '#ffd9a0', '#5a3418');
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(x1 - 24, y1 - 32, 16, 32);
    return y0 - 24;
  }

  drawSign(ctx, x, y, w, bg, fg) {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, 14);
    ctx.fillStyle = fg;
    ctx.font = 'bold 7px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.theme.pub.sign, x + w / 2, y + 10);
  }

  drawWindow(ctx, wx, wy, w, h, glass, frame) {
    this.windowPos = { x: wx, y: wy, w, h };
    if (this.pubBroken) {
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(wx, wy, w, h);
      ctx.strokeStyle = '#e8f6ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx, wy + 4); ctx.lineTo(wx + 10, wy + h / 2); ctx.lineTo(wx + 6, wy + h);
      ctx.moveTo(wx + 10, wy + h / 2); ctx.lineTo(wx + w, wy + 6);
      ctx.moveTo(wx + 10, wy + h / 2); ctx.lineTo(wx + w - 6, wy + h);
      ctx.stroke();
    } else {
      ctx.fillStyle = glass;
      ctx.fillRect(wx, wy, w, h);
      ctx.fillStyle = frame;
      ctx.fillRect(wx + w / 2 - 1, wy, 2, h);
      ctx.fillRect(wx, wy + h / 2 - 1, w, 2);
    }
  }

  // Kneipen-Deko aus der Werkstatt
  drawDeco(ctx, style) {
    const deco = this.look.deco;
    if (!deco || deco === 'none') return;
    const { x0, x1, y0, y1 } = PUB;
    const mx = (x0 + x1) / 2;
    if (deco === 'lights') {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        if (style === 'iglu') {
          const a = Math.PI + k * Math.PI;
          pts.push([mx + Math.cos(a) * 42, y1 + Math.sin(a) * 74 + 6]);
        } else {
          const top = style === 'hut' ? y0 - 20 : y0 - 22;
          const base = style === 'hut' ? y0 + 10 : y0;
          const x = x0 - 8 + k * (x1 - x0 + 16);
          pts.push([x, base - (1 - Math.abs(k - 0.5) * 2) * (base - top)]);
        }
      }
      const colors = ['#ff4d4d', '#ffd23f', '#4dd2ff', '#7ee081'];
      pts.forEach(([x, y], i) => {
        const on = (Math.floor(this.t * 3) + i) % 3 !== 0;
        ctx.fillStyle = on ? colors[i % colors.length] : 'rgba(80,80,80,0.6)';
        ctx.beginPath();
        ctx.arc(x, y + 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (deco === 'flowers') {
      const w = this.windowPos;
      if (!w) return;
      ctx.fillStyle = '#7a4a22';
      ctx.fillRect(w.x - 2, w.y + w.h, w.w + 4, 6);
      const colors = ['#ff5d8f', '#ffd23f', '#ff7a1a', '#c77dff'];
      for (let i = 0; i < 5; i++) {
        const fx = w.x + 2 + i * (w.w / 4.5);
        ctx.fillStyle = '#3fa34d';
        ctx.fillRect(fx - 0.5, w.y + w.h - 4, 1.5, 5);
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(fx, w.y + w.h - 5, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (deco === 'neon') {
      const on = Math.floor(this.t * 1.5) % 6 !== 0;
      ctx.save();
      ctx.font = 'bold 10px "Trebuchet MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ff4dd2';
      ctx.shadowBlur = on ? 10 : 0;
      ctx.fillStyle = on ? '#ffb3f0' : '#7a4a6e';
      ctx.fillText('OFFEN', x1 - 17, y1 - 42);
      ctx.restore();
    }
  }

  // Wütender Wirt in der Tür
  drawLandlord(ctx) {
    if (this.landlordT <= 0) return;
    const { x0, x1, y0, y1 } = PUB;
    const mx = (x0 + x1) / 2;
    const sx = Math.sin(this.t * 30) * 1.5;
    ctx.fillStyle = '#e2614a';
    ctx.beginPath();
    ctx.arc(x1 - 17 + sx, y1 - 28, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x1 - 24, y1 - 20, 14, 20);
    ctx.fillStyle = '#e2614a';
    ctx.beginPath();
    ctx.arc(x1 - 4, y1 - 32 + Math.sin(this.t * 25) * 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 16px "Trebuchet MS", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.strokeText('HEEY!!', mx + sx * 2, y0 - 70);
    ctx.fillStyle = '#c0261b';
    ctx.fillText('HEEY!!', mx + sx * 2, y0 - 70);
  }

  // Windfahne auf dem Dach
  drawVane(ctx, wind, roofTop) {
    const mx = (PUB.x0 + PUB.x1) / 2;
    const top = roofTop - 34;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, roofTop);
    ctx.lineTo(mx, top);
    ctx.stroke();
    ctx.fillStyle = '#e8472b';
    ctx.beginPath();
    if (Math.abs(wind) < 5) {
      ctx.moveTo(mx, top);
      ctx.lineTo(mx + 4, top + 14);
      ctx.lineTo(mx, top + 16);
    } else {
      const dir = Math.sign(wind);
      const len = 12 + Math.abs(wind) * 0.12;
      const flutter = Math.sin(this.t * 14) * 2;
      ctx.moveTo(mx, top);
      ctx.lineTo(mx + dir * len, top + 5 + flutter);
      ctx.lineTo(mx, top + 10);
    }
    ctx.fill();
  }

  drawWater(ctx) {
    const [c0, c1] = this.theme.water;
    const grad = ctx.createLinearGradient(0, SEA_Y - 10, 0, H);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(QUAY_X1, H);
    for (let x = QUAY_X1; x <= W; x += 8) ctx.lineTo(x, this.waveY(x));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = QUAY_X1; x <= W; x += 8) {
      if (x === QUAY_X1) ctx.moveTo(x, this.waveY(x));
      else ctx.lineTo(x, this.waveY(x));
    }
    ctx.stroke();
  }

  drawDucks(ctx) {
    for (const d of this.ducks) {
      const y = this.waveY(d.x) - 3;
      const dir = d.vx >= 0 ? 1 : -1;
      ctx.fillStyle = '#ffd400';
      ctx.beginPath();
      ctx.ellipse(d.x, y, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(d.x + dir * 4, y - 5, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2711d';
      ctx.fillRect(d.x + dir * 6.5 - (dir < 0 ? 3 : 0), y - 5, 3, 2);
    }
  }

  drawGulls(ctx) {
    for (const g of this.gulls) g.draw(ctx);
  }

  // Leichter Schneefall im Eishafen (ohne eigenen Zustand)
  drawAmbient(ctx, wind) {
    if (!this.theme.snow) return;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 45; i++) {
      const y = (i * 71.3 + this.t * 40) % (H + 20) - 10;
      const x = ((i * 113.7 + Math.sin(this.t * 0.8 + i) * 14 + y * wind * 0.003) % W + W) % W;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
