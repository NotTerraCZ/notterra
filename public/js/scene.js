// Animovaná pixel-art scéna: noční obloha, měsíc, Fuji, stará pagoda,
// kvetoucí sakura, lucerny, světlušky, padající okvětní lístky a červená panda.

import { Pix, rng, hash2, noise1, fbm1, hex, mixc, css, bayer, clamp, lerp } from './util.js';
import { Panda, PW, PH, AX, AY } from './panda.js';
import { Balls } from './ball.js';

const M = 12; // okraj vrstev kvůli paralaxe (v herních pixelech)
const C = (h) => hex(h);

const SKY = [
  [0.0, '#090716'],
  [0.2, '#141032'],
  [0.38, '#261850'],
  [0.54, '#432064'],
  [0.67, '#6e2a6f'],
  [0.78, '#a3427a'],
  [0.87, '#d4677c'],
  [0.94, '#f39284'],
  [1.0, '#ffb68e'],
];

const PETAL = ['#ffd3e2', '#ffadc9', '#f58bb2', '#ffe8f0'].map(C);
const BLOSSOM = ['#7b2b63', '#b24a82', '#e0729f', '#fca4c3', '#ffd2e3'].map(C);

// ---------------------------------------------------------------------------
// Rozvržení podle poměru stran

function layout(W, H) {
  const portrait = W / H < 0.95;
  const groundY = Math.round(H * (portrait ? 0.8 : 0.78));
  const s = H > 330 ? 2 : 1; // násobek detailu budov na vysokých obrazovkách
  const L = {
    W, H, portrait, groundY, s,
    moon: { x: Math.round(W * (portrait ? 0.27 : 0.56)), y: Math.round(H * (portrait ? 0.13 : 0.2)), r: portrait ? 13 : 15 },
    fuji: { x: Math.round(W * (portrait ? 0.72 : 0.38)) },
    pagoda: { x: Math.round(W * (portrait ? 0.27 : 0.56)), y: groundY - 3 },
    tree: { x: Math.round(W * (portrait ? 0.96 : 0.905)), y: groundY + 7 },
    panda: { x: Math.round(W * (portrait ? 0.56 : 0.765)), y: groundY + 16 },
    toro: { x: Math.round(W * (portrait ? 0.2 : 0.665)), y: groundY + 13 },
  };
  if (portrait) L.panda.y = Math.round(groundY + (H - groundY) * 0.42);
  return L;
}

// ---------------------------------------------------------------------------
// Obloha

function genSky(L) {
  const { W, H, groundY, moon } = L;
  const P = new Pix(W, H);
  const stops = SKY.map(([p, c]) => [p, C(c)]);
  const skyAt = (t) => {
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
    return mixc(c0, c1, clamp((t - p0) / (p1 - p0), 0, 1));
  };
  const horizon = groundY - 4;
  const n = Math.max(12, Math.round(horizon / 6));
  const levels = [];
  for (let k = 0; k < n; k++) levels.push(skyAt(k / (n - 1)).map(Math.round));
  const halo = C('#f6b9d8');
  const Rh = moon.r * 4.2;
  for (let y = 0; y < H; y++) {
    const t = clamp(y / horizon, 0, 1);
    const f = t * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const u = f - i;
    for (let x = 0; x < W; x++) {
      let c = u > bayer(x, y) ? levels[i + 1] : levels[i];
      const d = Math.hypot(x - moon.x, y - moon.y);
      if (d < Rh) {
        const g = Math.pow(1 - (d - moon.r) / (Rh - moon.r), 1.7) * 0.5;
        const q = Math.floor(g * 7 + bayer(x + 1, y + 2)) / 7;
        if (q > 0) c = mixc(c, halo, Math.min(q, 0.55));
      }
      P.set(x, y, c);
    }
  }
  // statické hvězdy
  const r = rng(7);
  const count = Math.round((W * H) / 260);
  const starCols = ['#ffffff', '#f3e8ff', '#ffe9c9', '#d9e4ff'].map(C);
  for (let k = 0; k < count; k++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(Math.pow(r(), 1.5) * horizon * 0.72);
    const fade = 1 - y / (horizon * 0.72);
    P.set(x, y, starCols[k % 4], (0.25 + r() * 0.6) * fade);
  }
  return P.canvas();
}

function genTwinkles(L, r) {
  const out = [];
  const n = Math.round((L.W * L.groundY) / 1800) + 8;
  for (let k = 0; k < n; k++) {
    out.push({
      x: Math.floor(r() * L.W),
      y: Math.floor(Math.pow(r(), 1.6) * L.groundY * 0.6),
      ph: r() * 6.28,
      sp: 0.6 + r() * 1.8,
      big: r() < 0.28,
    });
  }
  return out;
}

function genMoon(R) {
  const S = R * 2 + 3;
  const P = new Pix(S, S);
  const c0 = C('#fff6e4'), c1 = C('#f6e2c2'), c2 = C('#e6caa2'), c3 = C('#ffffff');
  const cx = R + 1, cy = R + 1;
  const craters = [[-0.35, -0.2, 0.22], [0.25, 0.3, 0.16], [0.4, -0.35, 0.12], [-0.1, 0.45, 0.1], [0.05, -0.05, 0.08]];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > R + 0.3) continue;
      let c = c0;
      const lit = (-dx - dy) / R;
      if (lit < -0.85) c = c2;
      else if (lit < -0.35) c = c1;
      else if (lit > 0.9 && d < R - 1) c = c3;
      for (const [ax, ay, ar] of craters) {
        const e = Math.hypot(dx / R - ax, dy / R - ay);
        if (e < ar) c = e < ar * 0.55 ? c1 : mixc(c, c2, 0.6);
      }
      P.set(x, y, c);
    }
  return P.canvas();
}

function genCloud(r, w) {
  const h = Math.round(w * 0.32) + 6;
  const P = new Pix(w, h);
  const base = h - 2;
  const blobs = [];
  const n = 3 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) {
    const rad = 3 + r() * (w / 6);
    const x = rad + r() * (w - rad * 2);
    blobs.push([x, base - rad * 0.55, rad]);
  }
  const inside = (x, y) => y <= base && blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br);
  const top = C('#b389bd'), top2 = C('#825a99'), mid = C('#4e2e6a'), bot = C('#98466f');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      let c = mid;
      if (!inside(x, y - 1)) c = top;
      else if (!inside(x, y - 2) && bayer(x, y) > 0.3) c = top2;
      else if (y >= base - 1 || !inside(x, y + 1)) c = bot;
      P.set(x, y, c, 0.92);
    }
  return P.canvas();
}

// ---------------------------------------------------------------------------
// Hory

function genFar(L) {
  const { W, H, groundY, fuji } = L;
  const P = new Pix(W + 2 * M, H + 2 * M, M, M);
  // Fuji
  const fb = groundY - 2;
  const fh = Math.round(H * (L.portrait ? 0.24 : 0.36));
  const half = fh * 2.05;
  const bodyLit = C('#4d3b7a'), bodyShade = C('#33275c'), haze = C('#7a3d80');
  const snowLit = C('#f1e6fb'), snowShade = C('#b3a1d6'), snowDim = C('#7d6aa8');
  for (let x = -M; x < W + M; x++) {
    const d = Math.abs(x - fuji.x);
    if (d > half) continue;
    const hgt = fh * Math.pow(1 - Math.max(d, 3.5) / half, 1.75);
    const top = Math.round(fb - hgt);
    const snowLine = 0.74 + (fbm1(x * 0.12, 5) - 0.5) * 0.1;
    const ext = 0.26 * Math.pow(noise1(x * 0.55, 13), 2.5);
    for (let y = top; y <= fb + M; y++) {
      const rel = (fb - y) / fh;
      const lit = x >= fuji.x;
      let c = lit ? bodyLit : bodyShade;
      if (rel > snowLine) c = lit ? snowLit : snowShade;
      else if (rel > snowLine - ext && bayer(x, y) > (snowLine - rel) / ext) c = lit ? snowShade : snowDim;
      const hz = Math.pow(1 - clamp(rel, 0, 1), 2.2) * 0.75;
      const q = Math.floor(hz * 5 + bayer(x, y)) / 5;
      if (q > 0) c = mixc(c, haze, q);
      P.set(x, y, c);
    }
  }
  // vzdálené hřebeny
  const rA = C('#2b204f'), rAl = C('#3e2f6c'), hazeA = C('#5a2c6b');
  for (let x = -M; x < W + M; x++) {
    const yv = groundY - H * 0.1 - fbm1(x * 0.018, 21) * H * 0.12;
    const yn = groundY - H * 0.1 - fbm1((x + 1) * 0.018, 21) * H * 0.12;
    const top = Math.round(yv);
    for (let y = top; y <= groundY + M; y++) {
      let c = y === top && yn < yv + 0.2 ? rAl : rA;
      const rel = clamp((y - top) / (groundY - top + 1), 0, 1);
      const q = Math.floor(rel * 4 + bayer(x, y)) / 4;
      if (q > 0) c = mixc(c, hazeA, q * 0.7);
      P.set(x, y, c);
    }
  }
  // mlha
  mist(P, L, groundY - H * 0.06, H * 0.055, C('#c47aac'), 0.34, -M, W + M);
  return P.canvas();
}

function mist(P, L, cy, hw, col, amp, x0, x1) {
  for (let y = Math.floor(cy - hw); y <= Math.ceil(cy + hw); y++) {
    const a = (1 - Math.abs(y - cy) / hw) * amp;
    for (let x = x0; x < x1; x++) {
      const w = a * (0.6 + fbm1(x * 0.04 + y * 0.2, 3) * 0.8);
      const q = Math.floor(w * 8 + bayer(x, y)) / 8;
      if (q > 0) P.set(x, y, col, q);
    }
  }
}

function genHills(L) {
  const { W, H, groundY } = L;
  const P = new Pix(W + 2 * M, H + 2 * M, M, M);
  const base = C('#1b1533'), rim = C('#35295c'), tree = C('#171129'), treeRim = C('#2e2452');
  const r = rng(99);
  const ridge = new Float32Array(W + 2 * M);
  for (let x = -M; x < W + M; x++) ridge[x + M] = groundY - H * 0.035 - fbm1(x * 0.03, 77) * H * 0.07;
  for (let x = -M; x < W + M; x++) {
    const top = Math.round(ridge[x + M]);
    for (let y = top; y <= groundY + M; y++) P.set(x, y, y === top ? rim : base);
  }
  // stromy na hřebeni
  for (let x = -M; x < W + M; ) {
    const top = ridge[x + M];
    const th = 3 + Math.floor(r() * 7);
    const round = r() < 0.55;
    for (let dy = 0; dy <= th; dy++) {
      const hw = round ? Math.round(Math.sqrt(Math.max(0, 1 - ((dy - th / 2) / (th / 2 + 0.5)) ** 2)) * (th / 2 + 0.5)) : Math.round((dy / th) * th * 0.45);
      for (let dx = -hw; dx <= hw; dx++) P.set(x + dx, Math.round(top) - th + dy + 1, dy === 0 || (dx === -hw && dy < th / 2) ? treeRim : tree);
    }
    x += 2 + Math.floor(r() * 6);
  }
  mist(P, L, groundY - H * 0.012, H * 0.03, C('#b06a9e'), 0.28, -M, W + M);
  return P.canvas();
}

// ---------------------------------------------------------------------------
// Pagoda + zeď chrámu (střední vrstva)

function genMid(L, lights) {
  const { W, H, groundY, s } = L;
  const P = new Pix(W + 2 * M, H + 2 * M, M, M);
  const px = L.pagoda.x;

  // zadní zeď areálu
  const wallBot = groundY - 3, wallH = 8 * s;
  const wx0 = px - Math.round(W * 0.28), wx1 = px + Math.round(W * 0.24);
  const plaster = C('#9a8cb0'), plasterD = C('#76688f'), line = C('#bcaed2'), cap = C('#2a2342'), capHi = C('#6c5f92'), post = C('#3a2432');
  for (let x = wx0; x <= wx1; x++) {
    for (let y = wallBot - wallH; y <= wallBot; y++) {
      const ry = y - (wallBot - wallH);
      let c = ry < 2 ? plasterD : plaster;
      if (s > 1 && ry > 3 && ry % 3 === 0) c = line;
      if ((x - wx0) % (22 * s) === 0) c = post;
      P.set(x, y, c);
    }
    P.set(x, wallBot - wallH - 1, cap);
    P.set(x, wallBot - wallH - 2, cap);
    P.set(x, wallBot - wallH - 3, capHi);
  }
  for (const ex of [wx0 - 1, wx0 - 2, wx1 + 1, wx1 + 2]) {
    P.set(ex, wallBot - wallH - 1, cap);
    P.set(ex, wallBot - wallH - 2, cap);
  }
  // pás trávy za zdí/před zdí
  const midG = C('#1b2530'), midGt = C('#27333f');
  for (let x = -M; x < W + M; x++)
    for (let y = wallBot + 1; y <= groundY + M; y++) P.set(x, y, y === wallBot + 1 ? midGt : midG);

  drawPagoda(P, px, groundY - 1, s, lights);

  // malé kamenné lucerny u pagody
  for (const dx of [-30 * s, 30 * s]) {
    const lx = px + dx, ly = groundY - 1;
    const st = C('#5d5570'), stL = C('#7c7392');
    P.rect(lx - 1, ly - 2, 3, 2, st);
    P.rect(lx, ly - 5, 1, 3, st);
    P.rect(lx - 1, ly - 7, 3, 2, C('#ffcf7a'));
    P.rect(lx - 2, ly - 8, 5, 1, stL);
    P.set(lx, ly - 9, stL);
    lights.push({ x: lx, y: ly - 6, r: 10, col: 'warm', a: 0.5, layer: 'mid', core: 2 });
  }
  return P.canvas();
}

function drawPagoda(P, cx, baseY, s, lights) {
  const stone = C('#5c5470'), stoneL = C('#827a99'), stoneD = C('#3a3448');
  const wall = C('#a2332c'), wallL = C('#c24a38'), wallD = C('#6a1e1e'), beam = C('#d0a060');
  const roof = C('#2d2645'), roof2 = C('#3a3259'), roofHi = C('#7d71a6'), fascia = C('#18132a'), under = C('#3b1e28');
  const gold = C('#e8b450'), goldD = C('#94692c');
  const glow = C('#ffc873'), glowHi = C('#fff0bf'), lattice = C('#b36a2c');

  // kamenná podesta
  const bw = 46 * s, bh = 4 * s;
  for (let y = 0; y < bh; y++)
    for (let x = -bw / 2; x <= bw / 2; x++) P.set(cx + x, baseY - y, y === bh - 1 ? stoneL : y === 0 ? stoneD : stone);
  // schody
  for (let k = 0; k < 3; k++) P.rect(cx - 5 * s + k, baseY - k, 10 * s + 1 - 2 * k, 1, stoneL);

  let y = baseY - bh;
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const ww = (32 - i * 4) * s;
    const wh = (i === 0 ? 14 : 8) * s;
    const x0 = Math.round(cx - ww / 2), x1 = Math.round(cx + ww / 2);
    const yt = y - wh + 1;
    // zábradlí/balkon u vyšších pater
    if (i > 0) {
      for (let x = x0 - 2; x <= x1 + 2; x++) {
        P.set(x, y, stoneD);
        P.set(x, y - 2, beam);
        if ((x - x0) % 2 === 0) P.set(x, y - 1, wallD);
      }
    }
    for (let yy = yt; yy <= (i > 0 ? y - 3 : y); yy++)
      for (let x = x0; x <= x1; x++) {
        let c = wall;
        if (x === x0 || x === x1 || x === cx || (ww > 20 && (x === x0 + Math.round(ww / 4) || x === x1 - Math.round(ww / 4)))) c = wallD;
        else if (x < cx - ww / 4) c = wallL;
        if (yy <= yt + 1) c = under;
        P.set(x, yy, c);
      }
    // okna / dveře
    if (i === 0) {
      const dw = 7 * s, dh = 9 * s;
      for (let yy = y - dh; yy <= y; yy++)
        for (let x = cx - Math.floor(dw / 2); x <= cx + Math.floor(dw / 2); x++)
          P.set(x, yy, (x - cx) % 2 === 0 ? lattice : yy < y - dh + 2 ? glowHi : glow);
      lights.push({ x: cx, y: y - dh / 2, r: 26 * s, col: 'warm', a: 0.55, layer: 'mid', core: dw / 2 });
      for (const sx of [-1, 1]) {
        const wx = cx + sx * Math.round(ww / 3.2);
        for (let yy = y - 8 * s; yy <= y - 4 * s; yy++)
          for (let x = wx - s; x <= wx + s; x++) P.set(x, yy, (yy + x) % 2 ? glow : lattice);
        lights.push({ x: wx, y: y - 6 * s, r: 12 * s, col: 'warm', a: 0.35, layer: 'mid', core: 2 });
      }
    } else {
      const wy = y - 5 * s;
      for (let yy = wy - Math.max(1, s * 2 - 1); yy <= wy + 1; yy++)
        for (let x = cx - 1 - (s - 1); x <= cx + 1 + (s - 1); x++) P.set(x, yy, x === cx ? lattice : glow);
      lights.push({ x: cx, y: wy, r: 11 * s, col: 'warm', a: 0.32, layer: 'mid', core: 2 });
    }
    y = yt - 1;

    // střecha
    const nextW = i < tiers - 1 ? (32 - (i + 1) * 4) * s : 6 * s;
    const ov = (13 - i) * s;
    const eaveW = ww + ov * 2;
    const rh = 6 * s;
    const topW = nextW + 4;
    const lift = (ax) => {
      const k = Math.max(0, (ax - (eaveW / 2 - 7 * s)) / (7 * s));
      return Math.round(3.2 * s * k * k);
    };
    const roofTop = y - rh - 1;
    for (let ax = -Math.ceil(eaveW / 2); ax <= Math.ceil(eaveW / 2); ax++) {
      const a = Math.abs(ax);
      if (a > eaveW / 2) continue;
      let r0 = 0;
      while (r0 < rh - 1 && topW / 2 + (eaveW / 2 - topW / 2) * Math.pow(r0 / (rh - 1), 1.9) < a) r0++;
      const lf = lift(a);
      const yTop = roofTop + r0 - lf;
      const yBot = roofTop + rh + 1 - lf;
      for (let yy = yTop; yy <= yBot; yy++) {
        let c = (ax & 1) ? roof : roof2;
        if (yy === yTop) c = roofHi;
        if (yy >= yBot - 1) c = fascia;
        P.set(cx + ax, yy, c);
      }
      if (a < eaveW / 2 - 2 && a > ww / 2) P.set(cx + ax, yBot + 1, under);
    }
    // ozdoby na špičkách + zvonky
    for (const sx of [-1, 1]) {
      const tx = Math.round(cx + sx * eaveW / 2);
      const ty = roofTop + rh + 1 - lift(eaveW / 2);
      P.set(tx, ty - 1, gold);
      P.set(tx, ty, goldD);
      P.set(tx - sx, ty + 1, goldD);
      P.set(tx - sx, ty + 2, gold);
      lights.push({ x: tx - sx, y: ty + 2, r: 5, col: 'gold', a: 0.35, layer: 'mid', core: 1 });
    }
    y = roofTop;
  }
  // sórin (věžička)
  const sh = 22 * s;
  for (let k = 0; k < sh; k++) {
    const yy = y - k;
    P.set(cx, yy, goldD);
    if (k > 3 && k < sh - 6 && k % 2 === 0) {
      P.set(cx - 1, yy, gold);
      P.set(cx + 1, yy, goldD);
      if (s > 1) { P.set(cx - 2, yy, gold); P.set(cx + 2, yy, goldD); }
    }
  }
  // šperk nahoře
  const jy = y - sh;
  P.set(cx, jy - 2, glowHi);
  P.set(cx - 1, jy - 1, gold); P.set(cx, jy - 1, glowHi); P.set(cx + 1, jy - 1, gold);
  P.set(cx, jy, gold);
  lights.push({ x: cx, y: jy - 1, r: 9, col: 'gold', a: 0.55, layer: 'mid', core: 2 });
  // plamenný ornament
  for (let k = -2; k <= 2; k++) P.set(cx + k, jy + 5, k % 2 ? goldD : gold);
}

// ---------------------------------------------------------------------------
// Popředí: zem, cesta, sakura, kamenná lucerna

function genNear(L, lights, canopy) {
  const { W, H, groundY } = L;
  const P = new Pix(W + 2 * M, H + 2 * M, M, M);
  const r = rng(1234);

  // zem
  const gTip = C('#4a6b55'), g1 = C('#2c4238'), g2 = C('#20322d'), g3 = C('#172421'), g4 = C('#0f1817');
  for (let x = -M; x < W + M; x++) {
    const bump = Math.round((fbm1(x * 0.15, 8) - 0.5) * 3);
    const tuft = hash2(x, 0, 12) > 0.8 ? 1 + Math.floor(hash2(x, 1, 12) * 2) : 0;
    const top = groundY + bump - tuft;
    for (let y = top; y <= H + M; y++) {
      const d = (y - groundY) / (H - groundY);
      let c;
      if (y <= top) c = gTip;
      else if (d < 0.15) c = bayer(x, y) < 0.5 - d * 3 ? g1 : g2;
      else if (d < 0.5) c = bayer(x, y) < (0.5 - d) * 3 ? g2 : g3;
      else c = bayer(x, y) < (1 - d) * 2 ? g3 : g4;
      P.set(x, y, c);
    }
  }
  // stébla trávy
  for (let k = 0; k < W * 0.9; k++) {
    const x = Math.floor(r() * (W + 2 * M)) - M;
    const y = groundY + 3 + Math.floor(r() * (H - groundY));
    const d = (y - groundY) / (H - groundY);
    const c = mixc(C('#3d5e4b'), C('#1a2a26'), d);
    P.set(x, y, c);
    P.set(x + (r() < 0.5 ? -1 : 1), y - 1, c);
  }
  // kamenná cesta k pagodě
  const stL = C('#7a7493'), st = C('#57516d'), stD = C('#393449'), stSh = C('#0e1414');
  const px0 = L.pagoda.x, py0 = groundY + 1;
  const px1 = L.portrait ? L.W * 0.46 : L.W * 0.52, py1 = H + 4;
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const sx = lerp(px0, px1, t * t) + Math.sin(t * 5) * 4;
    const sy = lerp(py0, py1, Math.pow(t, 1.25));
    const rx = lerp(3, 9, t), ry = lerp(1, 3, t);
    for (let y = Math.floor(sy - ry - 1); y <= Math.ceil(sy + ry + 1); y++)
      for (let x = Math.floor(sx - rx - 1); x <= Math.ceil(sx + rx + 1); x++) {
        const e = ((x - sx) / rx) ** 2 + ((y - sy) / ry) ** 2;
        const e2 = ((x - sx) / rx) ** 2 + ((y - sy - 1) / ry) ** 2;
        if (e <= 1) P.set(x, y, y < sy - ry * 0.35 ? stL : e > 0.7 && y > sy ? stD : st);
        else if (e2 <= 1) P.set(x, y, stSh);
      }
  }

  // kamenná lucerna (tóró)
  drawToro(P, L.toro.x, L.toro.y, lights);

  // --- sakura ---
  const tree = new Pix(W + 2 * M, H + 2 * M, M, M);
  const segs = [];
  const tips = [];
  const tx = L.tree.x, ty = L.tree.y;
  const grow = (x, y, ang, len, th, depth) => {
    let a = ang;
    const steps = Math.max(2, Math.round(len));
    for (let i = 0; i < steps; i++) {
      a = clamp(a + (r() - 0.5) * 0.1, -Math.PI + 0.1, -0.08);
      x += Math.cos(a);
      y += Math.sin(a);
      segs.push([x, y, Math.max(0.6, th * (1 - (i / steps) * 0.3)) / 2, depth]);
      if (depth <= 2 && i > steps * 0.4 && r() < 0.12) tips.push([x, y, depth]);
    }
    if (depth <= 0 || th < 1.3) {
      tips.push([x, y, depth]);
      return;
    }
    const n = depth >= 3 ? 2 : r() < 0.6 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      let na = a + (k - (n - 1) / 2) * (0.55 + r() * 0.35) + (r() - 0.5) * 0.25;
      na = clamp(na, -Math.PI + 0.18, -0.12); // větve nerostou dolů
      grow(x, y, na, len * (0.6 + r() * 0.2), th * 0.64, depth - 1);
    }
  };
  const hScale = L.portrait ? 0.9 : 1;
  const trunkLen = (groundY - L.H * 0.47) * hScale;
  // kmen
  let x = tx, y = ty, a = -Math.PI / 2 - 0.06;
  const trunkPts = [];
  for (let i = 0; i < trunkLen; i++) {
    a += (i < trunkLen * 0.5 ? -0.004 : 0.006) + (r() - 0.5) * 0.04;
    x += Math.cos(a);
    y += Math.sin(a);
    const th = lerp(12, 8, i / trunkLen) + (i < 6 ? (6 - i) * 0.9 : 0);
    segs.push([x, y, th / 2, 5]);
    trunkPts.push([x, y]);
  }
  const top = trunkPts[trunkPts.length - 1];
  const mid = trunkPts[Math.floor(trunkPts.length * 0.62)];
  const reachL = L.portrait ? W * 0.3 : clamp(Math.min(H * 0.36, tx - L.pagoda.x - 50), 55, 110);
  grow(mid[0], mid[1], -Math.PI + 0.42, reachL * 0.55, 6, 4); // dlouhá větev doleva
  grow(top[0], top[1], -Math.PI + 0.85, reachL * 0.42, 6, 4); // nahoru doleva
  grow(top[0], top[1], -Math.PI / 2 + 0.25, reachL * 0.35, 5, 3); // nahoru
  grow(top[0], top[1], -0.5, reachL * 0.3, 5, 3); // doprava
  grow(mid[0] + 1, mid[1] - 4, -0.45, reachL * 0.24, 4, 2); // doprava níž

  // kořeny
  for (const [dx, len] of [[-1, 9], [1, 7]]) {
    let rx = tx, ry = ty - 3;
    for (let i = 0; i < len; i++) {
      rx += dx * 1;
      ry += 0.35;
      segs.push([rx, ry, lerp(3, 0.8, i / len), 5]);
    }
  }

  // květy: zadní vrstva (tmavší)
  const blobs = [];
  for (const [bx, by, d] of tips) {
    if (by > groundY - H * 0.2) continue;
    const rad = d >= 2 ? 6 + r() * 5 : 4 + r() * 4;
    blobs.push([bx + (r() - 0.5) * 4, by - 1 + (r() - 0.5) * 4, rad]);
  }
  blobs.sort((p, q) => p[1] - q[1]);
  let minY = Infinity, maxY = -Infinity;
  for (const b of blobs) {
    minY = Math.min(minY, b[1] - b[2]);
    maxY = Math.max(maxY, b[1] + b[2]);
  }
  const drawBlob = (T, bx, by, rad, back) => {
    for (let yy = Math.floor(by - rad - 2); yy <= Math.ceil(by + rad + 2); yy++)
      for (let xx = Math.floor(bx - rad - 2); xx <= Math.ceil(bx + rad + 2); xx++) {
        const dx = xx - bx, dy = yy - by;
        const ang = Math.atan2(dy, dx);
        const rr = rad + (hash2(Math.round(ang * 4 + bx), Math.round(by), 5) - 0.5) * 2.6;
        const d = Math.hypot(dx, dy);
        if (d > rr) continue;
        const nx = dx / rr, ny = dy / rr;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let l = -0.55 * nx - 0.7 * ny + 0.45 * nz - 0.1;
        l -= ((yy - minY) / (maxY - minY + 1)) * 0.45;
        l += (hash2(xx, yy, 17) - 0.5) * 0.45;
        if (back) l -= 0.55;
        const idx = l > 0.62 ? 4 : l > 0.25 ? 3 : l > -0.12 ? 2 : l > -0.5 ? 1 : 0;
        T.set(xx, yy, BLOSSOM[idx]);
        if (idx >= 3 && hash2(xx, yy, 23) > 0.93) T.set(xx, yy, C('#fff1f6'));
      }
  };
  for (const [bx, by, rad] of blobs) drawBlob(tree, bx + 2, by + 2, rad * 1.05, true);

  // větve a kmen
  const bark = [C('#1d1016'), C('#35202a'), C('#4f3140'), C('#6d4a57')];
  for (const [sx, sy, sr] of segs) {
    for (let yy = Math.floor(sy - sr); yy <= Math.ceil(sy + sr); yy++)
      for (let xx = Math.floor(sx - sr); xx <= Math.ceil(sx + sr); xx++) {
        const dx = xx - sx, dy = yy - sy;
        if (dx * dx + dy * dy > sr * sr + 0.3) continue;
        const nx = sr > 0.8 ? dx / sr : 0;
        let t = nx < -0.45 ? 3 : nx < 0.1 ? 2 : nx < 0.6 ? 1 : 0;
        if (sr > 2 && hash2(xx, Math.floor(yy / 3), 31) > 0.82) t = Math.max(0, t - 1);
        tree.set(xx, yy, bark[t]);
      }
  }
  // přední květy
  for (const [bx, by, rad] of blobs) drawBlob(tree, bx, by, rad, false);
  tree.outline(C('#150b12'));
  canopy.push(...blobs.map(([bx, by, rad]) => ({ x: bx, y: by, r: rad })));
  // místa pro visící lucerny
  canopy.hang = [];
  const branchSegs = segs.filter((sg) => sg[3] === 4 && sg[1] > minY + 8 && sg[0] < tx - 16);
  branchSegs.sort((p, q) => p[0] - q[0]);
  if (branchSegs.length) {
    canopy.hang.push(branchSegs[Math.floor(branchSegs.length * 0.18)]);
    canopy.hang.push(branchSegs[Math.floor(branchSegs.length * 0.62)]);
  }

  // stín pod stromem + spadané lístky
  for (let k = 0; k < W * 1.1; k++) {
    const gx = tx + (r() - 0.62) * W * 0.55;
    const gy = groundY + 1 + Math.pow(r(), 1.4) * (H - groundY);
    P.set(gx, gy, PETAL[Math.floor(r() * 3)], 0.55 + r() * 0.45);
  }
  // sloučit strom do vrstvy
  const out = P.canvas();
  out.getContext('2d').drawImage(tree.canvas(), 0, 0);
  return out;
}

function drawToro(P, x, y, lights) {
  const st = C('#6a6380'), stL = C('#918aa8'), stD = C('#433d55'), out = C('#1a1622');
  const glow = C('#ffcf73'), glowHi = C('#fff1c4');
  const rows = [
    // [dy, halfWidth, color]
    [0, 6, stD], [-1, 6, st], [-2, 5, stL],
    [-3, 2, st], [-4, 2, st], [-5, 2, st], [-6, 2, st], [-7, 2, st], [-8, 2, stL],
    [-9, 5, stD], [-10, 5, st], [-11, 5, stL],
    [-12, 4, st], [-13, 4, st], [-14, 4, st], [-15, 4, st], [-16, 4, st],
    [-17, 7, stD], [-18, 6, st], [-19, 5, stL], [-20, 3, stL],
    [-21, 1, st], [-22, 1, stL], [-23, 0, stL],
  ];
  const T = new Pix(20, 30, 10, 26);
  for (const [dy, hw, c] of rows) for (let dx = -hw; dx <= hw; dx++) T.set(dx, dy, dx === -hw && hw > 1 ? mixc(c, stL, 0.5) : c);
  // zdvižené rohy stříšky
  T.set(-7, -18, stD); T.set(7, -18, stD); T.set(-8, -19, stL); T.set(8, -19, stL);
  // okénko s ohněm
  for (let dy = -15; dy <= -13; dy++) for (let dx = -2; dx <= 2; dx++) T.set(dx, dy, Math.abs(dx) < 1 && dy === -14 ? glowHi : glow);
  T.set(-2, -15, st); T.set(2, -15, st);
  T.outline(out);
  const tc = T.d;
  for (let j = 0; j < 30; j++)
    for (let i = 0; i < 20; i++) {
      const k = (j * 20 + i) * 4;
      if (tc[k + 3]) P.set(x + i - 10, y + j - 26, [tc[k], tc[k + 1], tc[k + 2]]);
    }
  lights.push({ x, y: y - 14, r: 34, col: 'warm', a: 0.75, layer: 'near', core: 3, flicker: true });
}

function genFront(L) {
  const { W, H } = L;
  const P = new Pix(W + 2 * M, H + 2 * M, M, M);
  const c = C('#0a100f'), c2 = C('#111a18');
  for (let x = -M; x < W + M; x++) {
    const h = Math.round(3 + fbm1(x * 0.08, 44) * 7 + (hash2(x, 2, 4) > 0.86 ? 4 + hash2(x, 3, 4) * 7 : 0));
    for (let y = H - h; y <= H + M; y++) P.set(x, y, y === H - h ? c2 : c);
  }
  return P.canvas();
}

// ---------------------------------------------------------------------------
// Záře (dithered halo sprite)

const glowCache = new Map();
function haloSprite(r, col) {
  const k = `${r}|${col}`;
  let cv = glowCache.get(k);
  if (cv) return cv;
  const S = r * 2 + 1;
  const P = new Pix(S, S);
  const c = C(col);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d >= 1) continue;
      const g = Math.pow(1 - d, 1.8);
      const q = Math.floor(g * 6 + bayer(x, y)) / 6;
      if (q > 0) P.set(x, y, c, q);
    }
  cv = P.canvas();
  glowCache.set(k, cv);
  return cv;
}

const LIGHT_COL = { warm: '#ff9a4a', gold: '#ffc861', pink: '#ff7fb6', moon: '#c8b4ff', fly: '#c8ff6a' };
const CORE_COL = { warm: '#ffd08a', gold: '#ffe29a', pink: '#ffb3d6', moon: '#fff1d6', fly: '#eaffb0' };

// ---------------------------------------------------------------------------

export class Scene {
  constructor(canvas, bloom, opts = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.bcv = bloom;
    this.bctx = bloom.getContext('2d');
    this.reduced = !!opts.reduced;
    this.onPanda = opts.onPanda || (() => {});
    this.bubble = opts.bubble || null;
    this.panda = new Panda();
    this.mouse = { x: -999, y: -999, vx: 0, vy: 0, inside: false, sx: 0.5, sy: 0.5, lastMove: 0 };
    this.par = { x: 0, y: 0 };
    this.t = 0;
    this.r = rng(Date.now() & 0xffff);
    this.fx = { sparks: [], bursts: [], hearts: [], zs: [], shoot: null, nextShoot: 6 };
    this.balls = new Balls(this);
    this.nearOff = { x: 0, y: 0 };
    this.pstate = {
      bob: 0, tail: 0, eye: 'open', lx: 0, ly: 0, ear: '', blush: false, mouth: 'w',
      nextBlink: 2, blinkT: 0, earT: 0, nextEar: 5, jump: 0, jumpV: 0, happyT: 0, sleep: false,
      tailPh: 0, tailSpeed: 1, talkT: 0, lookTimer: 0, idleLook: [0, 0], petAcc: 0,
    };
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    // Na mobilu se výška mění při schování lišty prohlížeče – pro stejnou šířku
    // držíme největší výšku, ať se scéna při scrollu nepřekresluje.
    if (this.lastVW !== vw) this.maxVH = 0;
    this.lastVW = vw;
    this.maxVH = Math.max(this.maxVH || 0, window.innerHeight);
    const vh = this.maxVH;
    const dw = vw * dpr, dh = vh * dpr;
    const scale = Math.max(2, Math.round(Math.min(dh / 230, dw / 200)));
    const W = Math.ceil(dw / scale), H = Math.ceil(dh / scale);
    if (this.L && this.L.W === W && this.L.H === H && this.scale === scale) return;
    this.scale = scale;
    this.cssScale = scale / dpr;
    for (const c of [this.cv, this.bcv]) {
      c.width = W;
      c.height = H;
      c.style.width = `${(W * scale) / dpr}px`;
      c.style.height = `${(H * scale) / dpr}px`;
    }
    this.bcv.style.filter = `blur(${Math.round(this.cssScale * 3.2)}px)`;
    this.ctx.imageSmoothingEnabled = false;
    this.build(layout(W, H));
  }

  build(L) {
    this.L = L;
    const lights = [];
    const canopy = [];
    this.sky = genSky(L);
    this.moonCv = genMoon(L.moon.r);
    this.far = genFar(L);
    this.hills = genHills(L);
    this.mid = genMid(L, lights);
    this.near = genNear(L, lights, canopy);
    this.front = genFront(L);
    this.lights = lights;
    this.canopy = canopy;
    this.hang = (canopy.hang || []).map(([x, y], k) => ({ x, y, len: 7 + k * 5, ph: k * 1.7 }));
    const r = rng(42);
    this.twinkles = genTwinkles(L, r);
    this.clouds = [];
    const nc = Math.max(3, Math.round(L.W / 90));
    for (let k = 0; k < nc; k++) {
      const w = 28 + Math.floor(r() * 44);
      this.clouds.push({ cv: genCloud(r, w), x: r() * (L.W + 80) - 40, y: 8 + r() * L.groundY * 0.42, sp: 0.6 + r() * 1.4 });
    }
    this.initParticles();
  }

  initParticles() {
    const L = this.L;
    // lístky
    const n = this.reduced ? 20 : Math.round(clamp(L.W * L.H / 1100, 40, 130));
    this.petals = [];
    for (let k = 0; k < n; k++) {
      const p = {};
      this.spawnPetal(p, true);
      this.petals.push(p);
    }
    // světlušky
    const nf = this.reduced ? 5 : Math.round(clamp(L.W / 26, 8, 20));
    this.flies = [];
    for (let k = 0; k < nf; k++) {
      this.flies.push({
        x: L.W * (0.25 + this.r() * 0.75),
        y: L.groundY - this.r() * L.H * 0.3 + 10,
        a: this.r() * 6.28,
        ph: this.r() * 6.28,
        sp: 0.12 + this.r() * 0.15,
      });
    }
  }

  setReduced(v) {
    if (this.reduced === v) return;
    this.reduced = v;
    if (this.L) this.initParticles();
  }

  isOverToy(cx, cy) {
    const [x, y] = this.toLogical(cx, cy);
    return this.hitPanda(x, y) || !!this.balls.at(x - this.nearOff.x, y - this.nearOff.y, 4);
  }

  spawnPetal(p, initial) {
    const L = this.L;
    const r = this.r;
    if (this.canopy.length && r() < 0.7) {
      const b = this.canopy[Math.floor(r() * this.canopy.length)];
      p.x = b.x + (r() - 0.5) * b.r * 1.6;
      p.y = b.y + (r() - 0.5) * b.r * 1.2;
    } else {
      p.x = r() * (L.W + 40);
      p.y = -4 - r() * 20;
    }
    if (initial) {
      p.x = r() * L.W;
      p.y = r() * L.H * 0.9;
    }
    p.vx = -0.15 - r() * 0.25;
    p.vy = 0.1 + r() * 0.15;
    p.fall = 0.1 + r() * 0.14;
    p.ph = r() * 6.28;
    p.fr = 0.8 + r() * 1.6;
    p.c = Math.floor(r() * PETAL.length);
    p.big = r() < 0.65;
    p.land = L.groundY + 2 + r() * (L.H - L.groundY - 4);
    p.life = -1;
  }

  // --- vstupy -------------------------------------------------------------
  toLogical(cx, cy) {
    const d = window.devicePixelRatio || 1;
    return [(cx * d) / this.scale, (cy * d) / this.scale];
  }

  pointerMove(cx, cy, now) {
    const [x, y] = this.toLogical(cx, cy);
    const m = this.mouse;
    if (m.inside) {
      m.vx = lerp(m.vx, x - m.x, 0.5);
      m.vy = lerp(m.vy, y - m.y, 0.5);
    }
    const dist = Math.hypot(x - m.x, y - m.y);
    m.x = x;
    m.y = y;
    m.inside = true;
    m.sx = cx / window.innerWidth;
    m.sy = cy / window.innerHeight;
    m.lastMove = now;
    this.balls.pointer(x - this.nearOff.x, y - this.nearOff.y, m.vx, m.vy);
    if (!this.reduced && dist > 0.6) {
      const n = Math.min(3, Math.ceil(dist / 5));
      for (let k = 0; k < n; k++) this.spark(x - (m.vx * k) / n, y - (m.vy * k) / n);
    }
    // hlazení pandy
    if (this.hitPanda(x, y)) {
      const ps = this.pstate;
      ps.petAcc += dist;
      if (ps.petAcc > 14) {
        ps.petAcc = 0;
        ps.happyT = Math.max(ps.happyT, 0.9);
        this.heart();
      }
    }
    if (this.pstate.sleep) this.wake();
  }

  pointerLeave() {
    this.mouse.inside = false;
  }

  click(cx, cy) {
    const [x, y] = this.toLogical(cx, cy);
    if (this.balls.grab(x - this.nearOff.x, y - this.nearOff.y)) return 'ball';
    if (this.hitPanda(x, y)) {
      this.boop();
      return true;
    }
    this.burst(x, y);
    return false;
  }

  pointerUp() {
    this.balls.release();
  }

  ballAt(cx, cy) {
    const [x, y] = this.toLogical(cx, cy);
    return !!this.balls.at(x - this.nearOff.x, y - this.nearOff.y, 4);
  }

  spawnBall() {
    if (this.pstate.sleep) this.wake();
    return this.balls.spawn();
  }

  clearBalls() {
    this.balls.clear();
  }

  // levá hranice pro míčky v CSS px (0 = okraj obrazovky)
  setBallWall(px) {
    const [x] = this.toLogical(px, 0);
    this.balls.minX = px > 0 ? Math.min(this.L.W * 0.6, x - this.nearOff.x) : 0;
  }

  // míček trefil pandu
  pandaHit() {
    const ps = this.pstate;
    if (ps.sleep) this.wake();
    ps.happyT = Math.max(ps.happyT, 0.8);
    ps.tailSpeed = 3;
    if (ps.jump <= 0 && this.r() < 0.5) ps.jumpV = 1.4;
    this.heart();
    this.onPanda('ball');
  }

  hitPanda(x, y) {
    const f = this.pandaFrame;
    if (!f) return false;
    const sx = Math.floor(x - f.x), sy = Math.floor(y - f.y);
    if (sx < 0 || sy < 0 || sx >= PW || sy >= PH) return false;
    return f.alpha[sy * PW + sx] > 0;
  }

  boop() {
    const ps = this.pstate;
    if (ps.sleep) this.wake();
    if (ps.jump <= 0) ps.jumpV = 2.1;
    ps.happyT = 1.6;
    ps.tailSpeed = 4;
    for (let k = 0; k < 4; k++) setTimeout(() => this.heart(), k * 90);
    this.onPanda('boop');
  }

  wake() {
    const ps = this.pstate;
    ps.sleep = false;
    ps.eye = 'open';
    this.onPanda('wake');
  }

  say(active) {
    this.pstate.talkT = active ? 2.2 : 0;
  }

  spark(x, y) {
    const r = this.r;
    this.fx.sparks.push({
      x, y,
      vx: (r() - 0.5) * 0.5,
      vy: (r() - 0.5) * 0.5 + 0.1,
      life: 0, max: 0.5 + r() * 0.6,
      c: r() < 0.5 ? '#fff4fa' : r() < 0.5 ? '#ffb3d1' : '#ffd98f',
      petal: r() < 0.35,
    });
  }

  burst(x, y) {
    const r = this.r;
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + r() * 0.3;
      const sp = 0.8 + r() * 1.6;
      this.fx.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4, life: 0, max: 0.8 + r() * 0.7, c: PETAL[k % 4], petal: true, grav: 0.035 });
    }
    this.fx.bursts.push({ x, y, life: 0 });
    // lístky poblíž odfouknout
    for (const p of this.petals) {
      const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
      if (d < 40 && d > 0.1) {
        const f = (1 - d / 40) * 2.2;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
        if (p.life >= 0) p.life = -1;
      }
    }
  }

  heart() {
    const f = this.pandaFrame;
    if (!f) return;
    this.fx.hearts.push({ x: f.x + AX + (this.r() - 0.5) * 26, y: f.y - 2, vy: -0.35 - this.r() * 0.2, life: 0, ph: this.r() * 6 });
  }

  // --- aktualizace --------------------------------------------------------
  update(dt, now) {
    this.t += dt;
    const L = this.L, m = this.mouse, t = this.t;
    const k60 = dt * 60;

    // paralaxa (myš nebo pomalý samovolný pohyb)
    let tx, ty;
    if (this.reduced) {
      tx = 0; ty = 0;
    } else if (m.inside && now - m.lastMove < 8000) {
      tx = (m.sx - 0.5) * 2;
      ty = (m.sy - 0.5) * 2;
    } else {
      tx = Math.sin(t * 0.15) * 0.4;
      ty = Math.cos(t * 0.11) * 0.2;
    }
    this.par.x = lerp(this.par.x, tx, 1 - Math.pow(0.04, dt));
    this.par.y = lerp(this.par.y, ty, 1 - Math.pow(0.04, dt));
    m.vx *= Math.pow(0.02, dt);
    m.vy *= Math.pow(0.02, dt);

    // vítr
    const wind = -0.18 + Math.sin(t * 0.23) * 0.12 + Math.sin(t * 0.07 + 2) * 0.1;
    for (const p of this.petals) {
      if (p.life >= 0) {
        p.life -= dt;
        if (p.life < 0) this.spawnPetal(p, false);
        continue;
      }
      const sway = Math.sin(t * p.fr + p.ph);
      p.vx += (wind + sway * 0.18 - p.vx) * 0.02 * k60;
      p.vy += (p.fall + Math.cos(t * p.fr + p.ph) * 0.06 - p.vy) * 0.03 * k60;
      if (m.inside) {
        const dx = p.x - m.x, dy = p.y - m.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 900 && d2 > 0.01) {
          const d = Math.sqrt(d2), f = 1 - d / 30;
          p.vx += (m.vx * 0.05 + (dx / d) * 0.05) * f * k60;
          p.vy += (m.vy * 0.05 + (dy / d) * 0.04) * f * k60;
        }
      }
      p.x += p.vx * k60;
      p.y += p.vy * k60;
      if (p.y >= p.land && p.vy > 0) {
        p.y = Math.round(p.land);
        p.life = 3 + this.r() * 6;
      }
      if (p.x < -12 || p.x > L.W + 14 || p.y > L.H + 4 || p.y < -30) this.spawnPetal(p, false);
    }

    // světlušky
    for (const f of this.flies) {
      f.a += (Math.sin(t * 0.7 + f.ph) * 0.03 + (this.r() - 0.5) * 0.08) * k60;
      let vx = Math.cos(f.a) * f.sp, vy = Math.sin(f.a) * f.sp * 0.7;
      if (m.inside) {
        const dx = m.x - f.x, dy = m.y - f.y, d = Math.hypot(dx, dy);
        if (d < 70 && d > 6) {
          vx += (dx / d) * 0.12;
          vy += (dy / d) * 0.12;
        }
      }
      f.x += vx * k60;
      f.y += vy * k60;
      if (f.y < L.groundY - L.H * 0.42) f.a = Math.PI / 2;
      if (f.y > L.groundY + 14) f.a = -Math.PI / 2;
      if (f.x < L.W * 0.12) f.a = 0;
      if (f.x > L.W + 4) f.a = Math.PI;
    }

    // mraky
    for (const c of this.clouds) {
      c.x += c.sp * dt * 1.2;
      if (c.x > L.W + 20) c.x = -c.cv.width - 20;
    }

    // efekty
    const fx = this.fx;
    for (const s of fx.sparks) {
      s.life += dt;
      s.x += s.vx * k60;
      s.y += s.vy * k60;
      s.vy += (s.grav || 0.004) * k60;
      s.vx *= Math.pow(0.3, dt);
    }
    fx.sparks = fx.sparks.filter((s) => s.life < s.max);
    if (fx.sparks.length > 400) fx.sparks.splice(0, fx.sparks.length - 400);
    for (const b of fx.bursts) b.life += dt;
    fx.bursts = fx.bursts.filter((b) => b.life < 0.5);
    for (const h of fx.hearts) {
      h.life += dt;
      h.y += h.vy * k60;
    }
    fx.hearts = fx.hearts.filter((h) => h.life < 1.4);
    for (const z of fx.zs) {
      z.life += dt;
      z.y -= 0.12 * k60;
      z.x += Math.sin(z.life * 3) * 0.1 * k60;
    }
    fx.zs = fx.zs.filter((z) => z.life < 2.4);

    // padající hvězda
    fx.nextShoot -= dt;
    if (!this.reduced && fx.nextShoot <= 0 && !fx.shoot) {
      fx.shoot = { x: L.W * (0.35 + this.r() * 0.6), y: 4 + this.r() * L.groundY * 0.25, vx: -2.6 - this.r(), vy: 1.1 + this.r() * 0.5, life: 0 };
      fx.nextShoot = 9 + this.r() * 14;
    }
    if (fx.shoot) {
      const s = fx.shoot;
      s.life += dt;
      s.x += s.vx * k60;
      s.y += s.vy * k60;
      if (s.life > 0.9) fx.shoot = null;
    }

    this.balls.update(dt, k60);
    this.updatePanda(dt, now);
  }

  updatePanda(dt, now) {
    const ps = this.pstate, m = this.mouse, L = this.L;
    const t = this.t;
    // dýchání
    ps.bob = Math.sin(t * (ps.sleep ? 1.6 : 2.6)) > 0.25 ? 1 : 0;
    // ocas
    ps.tailPh += dt * (1.1 + ps.tailSpeed * 1.4);
    ps.tailSpeed = lerp(ps.tailSpeed, ps.sleep ? 0.2 : 1, 1 - Math.pow(0.3, dt));
    ps.tail = Math.round(Math.sin(ps.tailPh) * (ps.happyT > 0 ? 6 : 4));
    // skok
    if (ps.jumpV !== 0 || ps.jump > 0) {
      ps.jump += ps.jumpV * dt * 60;
      ps.jumpV -= 0.16 * dt * 60;
      if (ps.jump <= 0) {
        ps.jump = 0;
        ps.jumpV = 0;
      }
    }
    // uši
    ps.nextEar -= dt;
    if (ps.nextEar <= 0) {
      ps.ear = this.r() < 0.5 ? 'L' : 'R';
      ps.earT = 0.25;
      ps.nextEar = 3 + this.r() * 6;
    }
    if (ps.earT > 0) {
      ps.earT -= dt;
      if (ps.earT <= 0) ps.ear = '';
    }
    // spánek
    if (!ps.sleep && now - m.lastMove > 25000 && ps.happyT <= 0 && ps.talkT <= 0) {
      ps.sleep = true;
      this.onPanda('sleep');
    }
    if (ps.sleep && this.r() < dt * 0.7) {
      const f = this.pandaFrame;
      if (f) this.fx.zs.push({ x: f.x + AX + 10, y: f.y + 6, life: 0 });
    }
    // oči
    ps.happyT -= dt;
    ps.nextBlink -= dt;
    if (ps.nextBlink <= 0) {
      ps.blinkT = 0.14;
      ps.nextBlink = 2 + this.r() * 4;
    }
    ps.blinkT -= dt;
    if (ps.sleep) ps.eye = 'sleep';
    else if (ps.happyT > 0) ps.eye = 'happy';
    else if (ps.blinkT > 0) ps.eye = 'blink';
    else ps.eye = 'open';
    ps.blush = ps.happyT > 0;
    // pusa při mluvení
    ps.talkT -= dt;
    ps.mouth = ps.talkT > 0 && Math.sin(t * 16) > 0 ? 'open' : ps.happyT > 0.8 ? 'open' : 'w';
    // pohled za myší
    const hx = L.panda.x, hy = L.panda.y - 36;
    let lx = 0, ly = 0;
    const ball = ps.sleep ? null : this.balls.lookTarget();
    if (ball) {
      const dx = ball.x - hx, dy = ball.y - hy;
      lx = Math.abs(dx) > 8 ? Math.sign(dx) : 0;
      ly = dy > 16 ? 1 : dy < -20 ? -1 : 0;
    } else if (m.inside && now - m.lastMove < 6000) {
      const dx = m.x - hx, dy = m.y - hy;
      lx = Math.abs(dx) > 10 ? Math.sign(dx) : 0;
      ly = dy > 18 ? 1 : dy < -22 ? -1 : 0;
    } else if (!ps.sleep) {
      ps.lookTimer -= dt;
      if (ps.lookTimer <= 0) {
        ps.idleLook = [Math.floor(this.r() * 3) - 1, this.r() < 0.3 ? -1 : 0];
        ps.lookTimer = 1.5 + this.r() * 3;
      }
      [lx, ly] = ps.idleLook;
    }
    ps.lx = lx;
    ps.ly = ly;
  }

  // --- kreslení -----------------------------------------------------------
  draw() {
    const { ctx, L, par } = this;
    const { W, H } = L;
    const t = this.t;
    const off = (k) => [Math.round(-M - par.x * k * 10), Math.round(-M - par.y * k * 5)];
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    ctx.drawImage(this.sky, 0, 0);
    // třpytivé hvězdy
    for (const s of this.twinkles) {
      const a = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
      if (a < 0.15) continue;
      ctx.fillStyle = `rgba(255,248,255,${a.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, 1, 1);
      if (s.big && a > 0.7) {
        ctx.fillStyle = `rgba(255,220,245,${(a * 0.55).toFixed(2)})`;
        ctx.fillRect(s.x - 1, s.y, 1, 1);
        ctx.fillRect(s.x + 1, s.y, 1, 1);
        ctx.fillRect(s.x, s.y - 1, 1, 1);
        ctx.fillRect(s.x, s.y + 1, 1, 1);
      }
    }
    // padající hvězda
    const sh = this.fx.shoot;
    if (sh) {
      for (let k = 0; k < 14; k++) {
        const a = (1 - k / 14) * Math.min(1, (0.9 - sh.life) * 3);
        ctx.fillStyle = `rgba(255,240,250,${a.toFixed(2)})`;
        ctx.fillRect(Math.round(sh.x - sh.vx * k * 0.5), Math.round(sh.y - sh.vy * k * 0.5), 1, 1);
      }
    }
    // měsíc
    const [mox, moy] = off(0.05);
    const mx = L.moon.x + mox + M, my = L.moon.y + moy + M;
    ctx.drawImage(this.moonCv, mx - L.moon.r - 1, my - L.moon.r - 1);
    // mraky
    const [cox] = off(0.08);
    for (const c of this.clouds) ctx.drawImage(c.cv, Math.round(c.x + cox + M), Math.round(c.y));

    let [ox, oy] = off(0.15);
    ctx.drawImage(this.far, ox, oy);
    [ox, oy] = off(0.25);
    ctx.drawImage(this.hills, ox, oy);

    // paprsky měsíčního světla
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const ang = Math.PI / 2 + (k - 2.5) * 0.28 + Math.sin(t * 0.1 + k) * 0.03;
      const wdt = 0.035 + (k % 3) * 0.015;
      const a = 0.028 + 0.018 * Math.sin(t * 0.4 + k * 1.7);
      const len = H * 1.4;
      ctx.fillStyle = `rgba(255,205,235,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(ang - wdt) * len, my + Math.sin(ang - wdt) * len);
      ctx.lineTo(mx + Math.cos(ang + wdt) * len, my + Math.sin(ang + wdt) * len);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const [mdx, mdy] = off(0.4);
    ctx.drawImage(this.mid, mdx, mdy);
    const [nx, ny] = off(0.7);
    ctx.drawImage(this.near, nx, ny);
    const nox = nx + M, noy = ny + M;
    this.nearOff.x = nox;
    this.nearOff.y = noy;

    // visící lucerny
    const hangLights = [];
    for (const h of this.hang) {
      const sw = Math.sin(t * 1.3 + h.ph) * 0.14;
      const bx = h.x + nox, by = h.y + noy;
      const ex = Math.round(bx + Math.sin(sw) * h.len), ey = Math.round(by + Math.cos(sw) * h.len);
      ctx.fillStyle = '#1a1015';
      for (let k = 0; k <= h.len; k++) ctx.fillRect(Math.round(bx + Math.sin(sw) * k), Math.round(by + Math.cos(sw) * k), 1, 1);
      this.drawChochin(ctx, ex, ey + 1);
      hangLights.push({ x: ex, y: ey + 5, r: 22, col: 'warm', a: 0.6, core: 3, flicker: true, abs: true });
    }

    // panda
    this.balls.drawShadows(ctx, nox, noy);
    this.drawPanda(ctx, nox, noy);
    this.balls.draw(ctx, nox, noy);

    // okvětní lístky
    for (const p of this.petals) {
      const x = Math.round(p.x), y = Math.round(p.y);
      const a = p.life >= 0 ? Math.min(1, p.life / 1.5) : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = css(PETAL[p.c]);
      const fr = Math.floor((Math.sin(t * p.fr * 2 + p.ph) + 1) * 2) % 4;
      if (!p.big || p.life >= 0) ctx.fillRect(x, y, p.big ? 2 : 1, 1);
      else if (fr === 0) ctx.fillRect(x, y, 2, 1);
      else if (fr === 1) {
        ctx.fillRect(x, y, 1, 1);
        ctx.fillRect(x + 1, y + 1, 1, 1);
      } else if (fr === 2) ctx.fillRect(x, y, 1, 2);
      else ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    // světla (pixelové záře)
    ctx.globalCompositeOperation = 'lighter';
    const allLights = [];
    const [mlx, mly] = off(0.4);
    for (const l of this.lights) {
      const lx = l.layer === 'mid' ? l.x + mlx + M : l.x + nox;
      const ly = l.layer === 'mid' ? l.y + mly + M : l.y + noy;
      allLights.push({ ...l, x: lx, y: ly });
    }
    allLights.push(...hangLights);
    for (const l of allLights) {
      let a = l.a;
      if (l.flicker && !this.reduced) a *= 0.82 + 0.1 * Math.sin(t * 9 + l.x) + 0.08 * Math.sin(t * 23 + l.y);
      const spr = haloSprite(Math.round(l.r), LIGHT_COL[l.col]);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.drawImage(spr, Math.round(l.x - l.r), Math.round(l.y - l.r));
    }
    // světlušky
    for (const f of this.flies) {
      const g = 0.5 + 0.5 * Math.sin(t * 2.2 + f.ph);
      ctx.globalAlpha = 0.25 + g * 0.5;
      const spr = haloSprite(5, LIGHT_COL.fly);
      ctx.drawImage(spr, Math.round(f.x) - 5, Math.round(f.y) - 5);
      ctx.globalAlpha = 0.4 + g * 0.6;
      ctx.fillStyle = '#f1ffb8';
      ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
    }
    // světlo kurzoru
    const m = this.mouse;
    if (m.inside && !this.reduced) {
      ctx.globalAlpha = 0.32;
      const spr = haloSprite(26, LIGHT_COL.pink);
      ctx.drawImage(spr, Math.round(m.x) - 26, Math.round(m.y) - 26);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // popředí
    const [fox, foy] = off(1.1);
    ctx.drawImage(this.front, fox, foy);

    this.drawFx(ctx);
    this.drawBloom(allLights, mx, my);
  }

  drawChochin(ctx, x, y) {
    // papírová lucerna 5×7
    const rows = [
      [0, 1, '#2a1616'],
      [1, 2, '#d8452f'],
      [2, 2, '#ff8a4f'],
      [3, 2, '#ffb36a'],
      [4, 2, '#ff8a4f'],
      [5, 2, '#d8452f'],
      [6, 1, '#2a1616'],
    ];
    for (const [dy, hw, c] of rows) {
      ctx.fillStyle = c;
      ctx.fillRect(x - hw, y + dy, hw * 2 + 1, 1);
    }
    ctx.fillStyle = '#9e2a1e';
    ctx.fillRect(x - 2, y + 2, 1, 3);
    ctx.fillRect(x + 2, y + 2, 1, 3);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(x, y + 7, 1, 2);
  }

  drawPanda(ctx, nox, noy) {
    const ps = this.pstate, L = this.L;
    const f = this.panda.get(ps);
    const bx = L.panda.x + nox, by = L.panda.y + noy;
    const jy = Math.round(ps.jump);
    // stín
    const sw = Math.max(8, 22 - jy);
    ctx.fillStyle = 'rgba(6,4,14,0.45)';
    ctx.fillRect(bx - sw + 2, by - 1, sw * 2, 2);
    ctx.fillRect(bx - sw + 5, by + 1, sw * 2 - 6, 1);
    const x = bx - AX, y = by - AY - jy;
    ctx.drawImage(f.canvas, x, y);
    this.pandaFrame = { x, y, alpha: f.alpha };
    // bublina nad hlavou
    if (this.bubble) {
      const k = this.cssScale;
      this.bubble.style.transform = `translate(${Math.round((bx + 2) * k)}px, ${Math.round((y + 4) * k)}px)`;
    }
  }

  drawFx(ctx) {
    const fx = this.fx;
    for (const s of fx.sparks) {
      const a = 1 - s.life / s.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = typeof s.c === 'string' ? s.c : css(s.c);
      const x = Math.round(s.x), y = Math.round(s.y);
      if (s.petal) ctx.fillRect(x, y, s.life % 0.4 < 0.2 ? 2 : 1, 1);
      else {
        ctx.fillRect(x, y, 1, 1);
        if (s.life < s.max * 0.35) {
          ctx.globalAlpha = a * 0.5;
          ctx.fillRect(x - 1, y, 1, 1);
          ctx.fillRect(x + 1, y, 1, 1);
          ctx.fillRect(x, y - 1, 1, 1);
          ctx.fillRect(x, y + 1, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
    for (const b of fx.bursts) {
      const r = 3 + b.life * 34;
      ctx.globalAlpha = 1 - b.life / 0.5;
      ctx.fillStyle = '#ffd6e8';
      const n = Math.round(r * 5);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        ctx.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r), 1, 1);
      }
    }
    // srdíčka
    const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
    for (const h of fx.hearts) {
      ctx.globalAlpha = Math.min(1, (1.4 - h.life) * 2);
      const x = Math.round(h.x + Math.sin(h.life * 5 + h.ph) * 2), y = Math.round(h.y);
      HEART.forEach((row, j) =>
        [...row].forEach((ch, i) => {
          if (ch !== 'X') return;
          ctx.fillStyle = i === 1 && j === 1 ? '#ffd0de' : j >= 3 ? '#d9345f' : '#ff5d8f';
          ctx.fillRect(x + i - 2, y + j, 1, 1);
        })
      );
    }
    // Zzz
    const ZZ = ['XXXX', '..X.', '.X..', 'XXXX'];
    for (const z of fx.zs) {
      ctx.globalAlpha = Math.min(1, z.life * 2, (2.4 - z.life) * 1.5);
      ctx.fillStyle = '#e8ddff';
      ZZ.forEach((row, j) => [...row].forEach((ch, i) => ch === 'X' && ctx.fillRect(Math.round(z.x) + i, Math.round(z.y) + j, 1, 1)));
    }
    ctx.globalAlpha = 1;
  }

  drawBloom(lights, mx, my) {
    const b = this.bctx, L = this.L, t = this.t;
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, L.W, L.H);
    b.globalCompositeOperation = 'lighter';
    // měsíc
    b.globalAlpha = 0.75;
    b.fillStyle = '#ffe6cc';
    b.beginPath();
    b.arc(mx, my, L.moon.r + 1, 0, Math.PI * 2);
    b.fill();
    b.globalAlpha = 0.18;
    b.fillStyle = '#ff9fd0';
    b.beginPath();
    b.arc(mx, my, L.moon.r * 2.6, 0, Math.PI * 2);
    b.fill();
    for (const l of lights) {
      let a = l.a;
      if (l.flicker && !this.reduced) a *= 0.8 + 0.2 * Math.sin(t * 11 + l.x);
      b.globalAlpha = clamp(a, 0, 1);
      b.fillStyle = CORE_COL[l.col];
      const c = l.core || 2;
      b.fillRect(Math.round(l.x - c), Math.round(l.y - c), c * 2 + 1, c * 2 + 1);
      b.globalAlpha = clamp(a * 0.25, 0, 1);
      b.fillStyle = LIGHT_COL[l.col];
      b.beginPath();
      b.arc(l.x, l.y, l.r * 0.45, 0, Math.PI * 2);
      b.fill();
    }
    for (const f of this.flies) {
      b.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.2 + f.ph));
      b.fillStyle = '#dcff8a';
      b.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3);
    }
    for (const s of this.fx.sparks) {
      if (s.petal) continue;
      b.globalAlpha = (1 - s.life / s.max) * 0.8;
      b.fillStyle = s.c;
      b.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 3, 3);
    }
    const sh = this.fx.shoot;
    if (sh) {
      b.globalAlpha = 0.8;
      b.fillStyle = '#fff';
      b.fillRect(Math.round(sh.x) - 1, Math.round(sh.y) - 1, 3, 3);
    }
    const m = this.mouse;
    if (m.inside && !this.reduced) {
      b.globalAlpha = 0.22;
      b.fillStyle = '#ff9cc8';
      b.beginPath();
      b.arc(m.x, m.y, 9, 0, Math.PI * 2);
      b.fill();
    }
    b.globalAlpha = 1;
  }
}
