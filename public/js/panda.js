// Procedurálně kreslená pixel-art červená panda (sedící, čelem k divákovi).
// Sprite se skládá z částí (ocas, uši, tělo, tlapky, hlava), pak se dokreslí
// obličej, vnitřní linky a obrys. Hotové snímky se cachují podle stavu.

import { hex, hash2, clamp } from './util.js';

export const PW = 72;
export const PH = 63;
export const AX = 28; // kotva (střed spodku těla)
export const AY = 61;

const P = (...h) => h.map(hex);
const RED = P('#6f2610', '#a8421a', '#cc6129', '#e88a44');
const HEAD = P('#7d2c12', '#b9501f', '#d9722f', '#f39a52');
const DARK = P('#140909', '#261212', '#3a1d1a', '#522b25');
const WHITE = P('#b8a7a4', '#e3d7d0', '#f6efe9', '#ffffff');
const EARIN = P('#2a0f0c', '#47201a');
const BAND_L = P('#944318', '#c46a2a', '#df8b42', '#f3ad63');
const BAND_D = P('#3f150a', '#5f2311', '#7c3217', '#96421f');

const OUT = hex('#1a0b0d');
const LINE_RED = hex('#521a0a');
const LINE_DARK = hex('#070303');
const LINE_BAND = hex('#3a1208');
const TEAR = hex('#6e230d');
const NOSE = hex('#170b0d');
const NOSE_HL = hex('#7a4b4b');
const MOUTH = hex('#3a1917');
const BLUSH = hex('#ff8098');
const EYE = hex('#0f0708');
const TONGUE = hex('#e45f73');

// Světlo přichází zleva shora (lucerna + měsíc).
function shade(nx, ny, x, y, seed, grain = 0.26) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  let l = -0.62 * nx - 0.5 * ny + 0.6 * nz - 0.22;
  l += (hash2(x, y, seed) - 0.5) * grain;
  return l > 0.5 ? 3 : l > 0.16 ? 2 : l > -0.22 ? 1 : 0;
}

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

export class Panda {
  constructor() {
    this.cache = new Map();
  }

  key(s) {
    return `${s.bob}|${s.tail}|${s.eye}|${s.lx},${s.ly}|${s.ear}|${s.blush ? 1 : 0}|${s.mouth}`;
  }

  get(s) {
    const k = this.key(s);
    let f = this.cache.get(k);
    if (!f) {
      if (this.cache.size > 500) this.cache.clear();
      f = this.build(s);
      this.cache.set(k, f);
    }
    return f;
  }

  build(s) {
    const N = PW * PH;
    const part = new Int8Array(N).fill(-1);
    const col = new Array(N).fill(null);
    const tailT = new Float32Array(N);

    const hx = 28;
    const hy = 24 + s.bob;

    // --- ocas: disky podél Bézierovy křivky, pootočené kolem kořene ---
    const a = s.tail * 0.05; // úhel v radiánech
    const p0 = [37, 55];
    const rot = (p) => {
      const dx = p[0] - p0[0], dy = p[1] - p0[1];
      const c = Math.cos(a), sn = Math.sin(a);
      return [p0[0] + dx * c - dy * sn, p0[1] + dx * sn + dy * c];
    };
    const p1 = rot([55, 58]), p2 = rot([63, 40]), p3 = rot([54, 27]);
    const tailPts = [];
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      const [x, y] = bez(p0, p1, p2, p3, t);
      const r = t < 0.35 ? 5 + 2.2 * (t / 0.35) : 7.2 - 3.4 * Math.pow((t - 0.35) / 0.65, 1.6);
      tailPts.push([x, y, r, t]);
    }
    const inTail = new Uint8Array(N);
    const tailNx = new Float32Array(N), tailNy = new Float32Array(N);
    for (const [cx, cy, r, t] of tailPts) {
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
          if (x < 0 || y < 0 || x >= PW || y >= PH) continue;
          const dx = x - cx, dy = y - cy;
          const ang = Math.atan2(dy, dx);
          const fluff = (hash2(Math.round(ang * 3), Math.round(t * 20), 3) - 0.5) * 1.1;
          const rr = r + fluff;
          if (dx * dx + dy * dy <= rr * rr) {
            const i = y * PW + x;
            inTail[i] = 1;
            tailT[i] = t;
            tailNx[i] = dx / rr;
            tailNy[i] = dy / rr;
          }
        }
    }

    const ell = (x, y, cx, cy, rx, ry) => {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      return nx * nx + ny * ny <= 1 ? [nx, ny] : null;
    };

    // uši (natočené elipsy se špičkou)
    const earAng = [-0.4 - (s.ear === 'L' ? 0.28 : 0), 0.4 + (s.ear === 'R' ? 0.28 : 0)];
    const earC = [
      [hx - 12, hy - 10.5 + (s.ear === 'L' ? 1 : 0)],
      [hx + 12, hy - 10.5 + (s.ear === 'R' ? 1 : 0)],
    ];
    const ear = (x, y, k) => {
      const [cx, cy] = earC[k];
      const an = earAng[k];
      const dx = x - cx, dy = y - cy;
      const c = Math.cos(an), sn = Math.sin(an);
      const u = dx * c + dy * sn;
      const v = -dx * sn + dy * c;
      const ry = 6.4;
      const rx = 5.4 * clamp(0.86 + 0.4 * (v / ry), 0.42, 1.2);
      const e = (u / rx) ** 2 + (v / ry) ** 2;
      return e <= 1 ? [u / rx, v / ry, e] : null;
    };

    const Z = { tail: 0, ear: 1, body: 2, feet: 3, arm: 4, head: 5 };

    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const i = y * PW + x;
        let r;
        // hlava + lícní chmýří
        const hd = ell(x, y, hx, hy, 14.5, 11.5);
        const chL = ell(x, y, hx - 12, hy + 5, 3.9, 3.1);
        const chR = ell(x, y, hx + 12, hy + 5, 3.9, 3.1);
        const ax = Math.abs(x - hx);
        const tuft =
          (y === hy + 7 && ax === 16) ||
          (y === hy + 8 && (ax === 15 || ax === 12)) ||
          (y === hy + 9 && ax === 14);
        if (hd || chL || chR || tuft) {
          part[i] = Z.head;
          if (hd && !((chL || chR) && Math.abs(hd[0]) > 0.62)) {
            col[i] = HEAD[shade(hd[0], hd[1], x - hx, y - hy, 11, 0.16)];
          } else {
            const c = chL || chR || [0.5, 0.9];
            col[i] = WHITE[c[1] > 0.45 ? 1 : c[1] < -0.35 ? 3 : 2];
          }
          continue;
        }
        // přední tlapky
        const armL = ell(x, y, 22, 50, 3.7, 8.6);
        const armR = ell(x, y, 34, 50, 3.7, 8.6);
        if (armL || armR) {
          const c = armL || armR;
          part[i] = Z.arm;
          let t = shade(c[0], c[1], x, y, 21);
          if (c[1] > 0.72) t = Math.min(3, t + 1); // polštářky
          col[i] = DARK[t];
          continue;
        }
        // zadní nohy
        const ftL = ell(x, y, 16, 58, 5.6, 3.2);
        const ftR = ell(x, y, 40, 58, 5.6, 3.2);
        if (ftL || ftR) {
          const c = ftL || ftR;
          part[i] = Z.feet;
          col[i] = DARK[shade(c[0], c[1], x, y, 31)];
          continue;
        }
        // tělo
        const bd = ell(x, y, 28, 47, 12.8, 13.5);
        if (bd) {
          part[i] = Z.body;
          const chest = Math.abs(bd[0]) < 0.56 + bd[1] * 0.12;
          col[i] = (chest ? DARK : RED)[shade(bd[0], bd[1], x, y, 41)];
          continue;
        }
        // uši
        const eL = ear(x, y, 0);
        const eR = ear(x, y, 1);
        if (eL || eR) {
          const c = eL || eR;
          part[i] = Z.ear;
          if (c[2] > 0.42) col[i] = WHITE[clamp(shade(c[0], c[1], x, y, 51) + 1, 1, 3)];
          else col[i] = EARIN[c[1] > 0.1 ? 0 : 1];
          continue;
        }
        // ocas
        if (inTail[i]) {
          part[i] = Z.tail;
          const t = tailT[i];
          const band = Math.floor(t * 7.2);
          const pal = t > 0.9 ? BAND_D : band % 2 === 0 ? BAND_L : BAND_D;
          col[i] = pal[shade(tailNx[i], tailNy[i], x, y, 61)];
        }
      }

    // --- vnitřní linky (sel-out) mezi částmi různé hloubky ---
    const lineCol = [LINE_BAND, WHITE[0], LINE_RED, LINE_DARK, LINE_DARK, null];
    const fixed = [];
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const i = y * PW + x;
        const p = part[i];
        if (p < 0 || p === Z.head) continue;
        const nb = [
          x > 0 ? part[i - 1] : -1,
          x < PW - 1 ? part[i + 1] : -1,
          y > 0 ? part[i - PW] : -1,
          y < PH - 1 ? part[i + PW] : -1,
        ];
        if (nb.some((q) => q > p)) {
          let lc = lineCol[p];
          if (p === Z.body && col[i] && DARK.includes(col[i])) lc = LINE_DARK;
          fixed.push(i, lc);
        }
      }
    for (let k = 0; k < fixed.length; k += 2) col[fixed[k]] = fixed[k + 1];

    // --- obličej ---
    const put = (x, y, c) => {
      if (x < 0 || y < 0 || x >= PW || y >= PH) return;
      const i = y * PW + x;
      if (part[i] !== Z.head) return;
      col[i] = c;
    };
    const fx = s.lx, fy = s.ly;
    // čenich (bílý)
    for (let y = hy - 1; y <= hy + 10; y++)
      for (let x = hx - 8; x <= hx + 8; x++) {
        const m = ell(x, y, hx + fx, hy + 5 + fy, 6.6, 4.6);
        if (m) put(x, y, WHITE[m[1] > 0.55 ? 1 : m[0] < -0.3 && m[1] < 0 ? 3 : 2]);
      }
    // obočí
    for (const sx of [-1, 1]) {
      const bx = hx + sx * 7 + fx, by = hy - 6 + fy;
      for (let y = by - 2; y <= by + 2; y++)
        for (let x = bx - 3; x <= bx + 3; x++) if (ell(x, y, bx, by, 2.4, 1.4)) put(x, y, WHITE[2]);
    }
    // slzné pruhy
    const lex = hx - 8 + fx, rex = hx + 6 + fx, ey = hy - 2 + fy; // levé oko je 3 px široké
    for (const [x, y] of [[lex, ey + 3], [lex, ey + 4], [lex - 1, ey + 5], [lex - 1, ey + 6]]) put(x, y, TEAR);
    for (const [x, y] of [[rex + 2, ey + 3], [rex + 2, ey + 4], [rex + 3, ey + 5], [rex + 3, ey + 6]]) put(x, y, TEAR);
    // oči
    for (const ex of [lex, rex]) {
      if (s.eye === 'open') {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(ex + x, ey + y, EYE);
        put(ex + 1, ey, WHITE[3]);
        put(ex + 2, ey + 1, NOSE_HL);
      } else if (s.eye === 'happy') {
        for (const [x, y] of [[-1, 2], [0, 1], [1, 0], [2, 1], [3, 2]]) put(ex + x, ey + y, EYE);
      } else {
        // zavřené (mrk / spánek)
        for (const [x, y] of [[-1, 1], [0, 2], [1, 2], [2, 2], [3, 1]]) put(ex + x, ey + y, EYE);
      }
    }
    // nos
    const nx0 = hx - 1 + fx, ny0 = hy + 2 + fy;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) put(nx0 + x, ny0 + y, NOSE);
    put(nx0, ny0, NOSE_HL);
    // pusa
    const mx = hx + fx, my = hy + 4 + fy;
    put(mx, my, MOUTH);
    if (s.mouth === 'open') {
      for (const [x, y] of [[-1, 1], [0, 1], [1, 1], [-1, 2], [1, 2]]) put(mx + x, my + y, MOUTH);
      put(mx, my + 2, TONGUE);
    } else {
      for (const [x, y] of [[-2, 1], [0, 1], [2, 1], [-1, 2], [1, 2]]) put(mx + x, my + y, MOUTH);
    }
    if (s.blush) {
      for (const [x, y] of [[-10, 3], [-9, 3], [9, 3], [10, 3]]) put(hx + x + fx, hy + y + fy, BLUSH);
    }

    // --- složení + obrys ---
    const data = new Uint8ClampedArray(N * 4);
    for (let i = 0; i < N; i++) {
      const c = col[i];
      if (!c) continue;
      data[i * 4] = c[0];
      data[i * 4 + 1] = c[1];
      data[i * 4 + 2] = c[2];
      data[i * 4 + 3] = 255;
    }
    const mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) mask[i] = data[i * 4 + 3] ? 1 : 0;
    for (let y = 0; y < PH; y++)
      for (let x = 0; x < PW; x++) {
        const i = y * PW + x;
        if (mask[i]) continue;
        if (
          (x > 0 && mask[i - 1]) ||
          (x < PW - 1 && mask[i + 1]) ||
          (y > 0 && mask[i - PW]) ||
          (y < PH - 1 && mask[i + PW])
        ) {
          data[i * 4] = OUT[0];
          data[i * 4 + 1] = OUT[1];
          data[i * 4 + 2] = OUT[2];
          data[i * 4 + 3] = 255;
        }
      }
    const alpha = new Uint8Array(N);
    for (let i = 0; i < N; i++) alpha[i] = data[i * 4 + 3];
    const cv = document.createElement('canvas');
    cv.width = PW;
    cv.height = PH;
    cv.getContext('2d').putImageData(new ImageData(data, PW, PH), 0, 0);
    return { canvas: cv, alpha, headY: hy - 18 };
  }
}
