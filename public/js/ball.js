// Plážové míčky: pixelový sprite + jednoduchá fyzika (gravitace, odrazy,
// kutálení, srážky mezi sebou i s pandou). Dají se chytit a hodit.

import { hex, clamp, lerp } from './util.js';
import { AY } from './panda.js';

export const BR = 6; // poloměr v herních pixelech
const MAX = 8;
const FRAMES = 24;
const BANDS = ['#ff6fa8', '#fff3f6', '#ffd35a', '#fff3f6', '#62c6ff'].map(hex);
const OUT = hex('#1a0c12');
const HI = hex('#ffffff');

let frames = null;

function buildFrames() {
  const S = BR * 2 + 3;
  const c = BR + 1;
  const rr = (BR + 0.35) ** 2;
  frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const rot = (f / FRAMES) * Math.PI * 2;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const d = new Uint8ClampedArray(S * S * 4);
    const inside = (x, y) => (x - c) ** 2 + (y - c) ** 2 <= rr;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        if (!inside(x, y)) {
          const edge = inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1);
          if (edge) {
            d[i] = OUT[0]; d[i + 1] = OUT[1]; d[i + 2] = OUT[2]; d[i + 3] = 255;
          }
          continue;
        }
        const dx = x - c, dy = y - c;
        // otočení v rovině obrazovky = kutálení doleva/doprava
        const rx = dx * cs + dy * sn, ry = -dx * sn + dy * cs;
        const half = Math.sqrt(Math.max(0.01, rr - ry * ry));
        const u = clamp(rx / half, -0.999, 0.999);
        let col = BANDS[Math.floor(((u + 1) / 2) * BANDS.length)];
        // světlo zleva shora (v prostoru obrazovky, neotáčí se)
        const l = -(dx + dy) / (BR * 1.45);
        const k = l > 0.5 ? 1.1 : l < -0.45 ? 0.68 : l < -0.05 ? 0.85 : 1;
        if ((dx === -2 && dy === -3) || (dx === -3 && dy === -2) || (dx === -2 && dy === -2)) col = HI;
        d[i] = Math.min(255, col[0] * k);
        d[i + 1] = Math.min(255, col[1] * k);
        d[i + 2] = Math.min(255, col[2] * k);
        d[i + 3] = 255;
      }
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    cv.getContext('2d').putImageData(new ImageData(d, S, S), 0, 0);
    frames.push(cv);
  }
}

export class Balls {
  constructor(scene) {
    this.s = scene;
    this.list = [];
    this.held = null;
    this.target = null;
    this.hitCool = 0;
    this.minX = 0; // levá stěna (na desktopu pravý okraj panelu s odkazy)
  }

  get count() {
    return this.list.length;
  }

  floor() {
    return this.s.L.panda.y;
  }

  spawn() {
    const L = this.s.L, r = this.s.r;
    if (this.list.length >= MAX) {
      const old = this.list.shift();
      if (old === this.held) this.held = null;
      this.s.burst(old.x + this.s.nearOff.x, old.y + this.s.nearOff.y);
    }
    const lo = Math.max(this.minX + BR * 2, L.portrait ? L.W * 0.3 : L.W * 0.5);
    const hi = L.portrait ? L.W * 0.8 : L.W * 0.74;
    const x = lo < hi ? lo + r() * (hi - lo) : L.W * 0.7;
    this.list.push({ x, y: -BR - 4 - r() * 10, vx: (r() - 0.5) * 2.4, vy: 0, rot: r() * 6.28, floor: false });
    return this.list.length;
  }

  clear() {
    for (const b of this.list) this.s.burst(b.x + this.s.nearOff.x, b.y + this.s.nearOff.y);
    this.list = [];
    this.held = null;
  }

  at(x, y, pad = 3) {
    for (let k = this.list.length - 1; k >= 0; k--) {
      const b = this.list[k];
      if ((b.x - x) ** 2 + (b.y - y) ** 2 <= (BR + pad) ** 2) return b;
    }
    return null;
  }

  grab(x, y) {
    const b = this.at(x, y, 4);
    if (!b) return null;
    this.held = b;
    this.target = { x, y };
    b.vx = 0;
    b.vy = 0;
    return b;
  }

  release() {
    const b = this.held;
    if (!b) return;
    b.vx = clamp(b.vx, -8, 8);
    b.vy = clamp(b.vy, -9, 8);
    this.held = null;
  }

  // pohyb kurzoru (souřadnice scény) – drží míček, nebo do něj šťouchne
  pointer(x, y, mvx, mvy) {
    this.target = { x, y };
    if (this.held) return;
    const sp = Math.hypot(mvx, mvy);
    if (sp < 0.8) return;
    for (const b of this.list) {
      if ((b.x - x) ** 2 + (b.y - y) ** 2 <= (BR + 2) ** 2) {
        b.vx += mvx * 0.55;
        b.vy += mvy * 0.55 - 0.6;
      }
    }
  }

  update(dt, k60) {
    if (!this.list.length) return;
    if (!frames) buildFrames();
    const L = this.s.L;
    const fl = this.floor();
    const G = 0.22;
    this.hitCool -= dt;

    for (const b of this.list) {
      if (b === this.held && this.target) {
        const tx = clamp(this.target.x, this.minX + BR, L.W - BR);
        const ty = Math.min(this.target.y, fl - BR);
        const k = Math.max(0.5, k60);
        b.vx = lerp(b.vx, (tx - b.x) / k, 0.5);
        b.vy = lerp(b.vy, (ty - b.y) / k, 0.5);
        b.x = tx;
        b.y = ty;
        b.rot += (b.vx / BR) * k60 * 0.5;
        continue;
      }
      b.vy += G * k60;
      b.x += b.vx * k60;
      b.y += b.vy * k60;
      b.floor = false;
      if (b.y + BR >= fl) {
        b.y = fl - BR;
        if (b.vy > 0) b.vy = b.vy > 1.2 ? -b.vy * 0.62 : 0;
        b.vx *= Math.pow(0.975, k60);
        if (Math.abs(b.vx) < 0.02) b.vx = 0;
        b.floor = true;
      }
      if (b.x - BR < this.minX) {
        b.x = this.minX + BR;
        b.vx = Math.abs(b.vx) * 0.75;
      } else if (b.x + BR > L.W) {
        b.x = L.W - BR;
        b.vx = -Math.abs(b.vx) * 0.75;
      }
      b.rot += (b.vx / BR) * k60 * (b.floor ? 1 : 0.45);
      this.hitPanda(b);
    }

    // srážky míčků mezi sebou
    const n = this.list.length;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = this.list[i], c = this.list[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= BR * 2 || d < 0.001) continue;
        const nx = dx / d, ny = dy / d;
        const push = (BR * 2 - d) / 2;
        if (a !== this.held) { a.x -= nx * push; a.y -= ny * push; }
        if (c !== this.held) { c.x += nx * push; c.y += ny * push; }
        const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (rel < 0) {
          const imp = -rel * 0.9;
          if (a !== this.held) { a.vx -= nx * imp; a.vy -= ny * imp; }
          if (c !== this.held) { c.vx += nx * imp; c.vy += ny * imp; }
        }
      }
  }

  // panda jako dva kruhy (hlava + tělo)
  hitPanda(b) {
    const s = this.s, P = s.L.panda;
    const jump = s.pstate.jump;
    const circles = [
      [P.x, P.y - AY + 24 - jump, 14],
      [P.x, P.y - 14, 13],
    ];
    for (const [cx, cy, cr] of circles) {
      const dx = b.x - cx, dy = b.y - cy;
      const d = Math.hypot(dx, dy);
      const min = BR + cr;
      if (d >= min || d < 0.001) continue;
      const nx = dx / d, ny = dy / d;
      b.x = cx + nx * min;
      b.y = cy + ny * min;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= 1.75 * vn * nx;
        b.vy -= 1.75 * vn * ny;
        if (-vn > 1.4 && this.hitCool <= 0) {
          this.hitCool = 0.6;
          s.pandaHit();
        }
      }
    }
  }

  // míček, na který se má panda dívat (drží se nebo letí)
  lookTarget() {
    if (this.held) return this.held;
    let best = null, bs = 0.9;
    for (const b of this.list) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > bs) {
        bs = sp;
        best = b;
      }
    }
    return best;
  }

  drawShadows(ctx, ox, oy) {
    if (!this.list.length) return;
    const fl = this.floor();
    for (const b of this.list) {
      const h = fl - (b.y + BR);
      const w = Math.max(2, Math.round(BR + 1 - h * 0.06));
      ctx.fillStyle = `rgba(6,4,14,${clamp(0.42 - h * 0.004, 0.06, 0.42).toFixed(2)})`;
      ctx.fillRect(Math.round(b.x + ox - w), Math.round(fl + oy - 1), w * 2, 2);
    }
  }

  draw(ctx, ox, oy) {
    if (!frames || !this.list.length) return;
    for (const b of this.list) {
      const a = ((b.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const f = frames[Math.floor((a / (Math.PI * 2)) * FRAMES) % FRAMES];
      ctx.drawImage(f, Math.round(b.x + ox - BR - 1), Math.round(b.y + oy - BR - 1));
    }
  }
}
