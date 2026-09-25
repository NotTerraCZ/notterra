import { Scene } from './scene.js';

const $ = (s) => document.querySelector(s);
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

// --- uložená volba efektů (jen pohodlí, nemusí fungovat) ---
let fxOn = !motionQuery.matches;
try {
  const v = localStorage.getItem('fx');
  if (v === '0') fxOn = false;
  if (v === '1') fxOn = true;
} catch {}

// --- bublina pandy ---
const bubble = $('#bubble');
const bubbleText = bubble.querySelector('.bubble-in');
const touch = matchMedia('(hover: none)').matches;
const pet = touch ? 'Tap me! 🐾' : 'Pet me with your mouse… 🐾';
const LINES = {
  hello: ['Hi! Welcome to NotTerra 🌸', 'Hey there! Welcome 🌸'],
  idle: [
    'Check out my YouTube! 🎬',
    'Join Slime SMP! 🟩',
    pet,
    'The sakura smell lovely tonight 🌸',
    'Mmm… some bamboo would be nice 🎋',
    'Click me! ✨',
    'Try clicking the sky ✨',
    'My games are on itch.io 🎮',
    'Add me on Steam! 🕹️',
    'See you on Discord! 💬',
  ],
  boop: ['Hehe! 💕', 'That tickles! 😆', 'Again! ✨', 'Boop! 🐾', "You're awesome! 💖"],
  wake: ["Huh?! I'm awake! 👀", 'Yay, a visitor! 🌸'],
  ball: ['Boing! 🏐', 'Nice throw! ✨', 'Hey! 😆', 'Again, again! 🐾', 'My head! 😵'],
  sleep: ['Zzz… 💤'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let bubbleTimer = 0;
let lastSay = 0;
function say(text, ms = 2600) {
  bubbleText.textContent = text;
  bubble.classList.add('show');
  scene.say(true);
  lastSay = performance.now();
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => {
    bubble.classList.remove('show');
    scene.say(false);
  }, ms);
}

// --- scéna ---
const scene = new Scene($('#scene'), $('#bloom'), {
  reduced: !fxOn,
  bubble,
  onPanda: (ev) => {
    if (ev === 'boop') say(pick(LINES.boop), 1600);
    else if (ev === 'wake') say(pick(LINES.wake), 2200);
    else if (ev === 'sleep') say(LINES.sleep[0], 2000);
    else if (ev === 'ball' && performance.now() - lastSay > 2500) say(pick(LINES.ball), 1500);
  },
});

function setFx(on) {
  fxOn = on;
  document.body.classList.toggle('fx-off', !on);
  const btn = $('#fx-toggle');
  btn.textContent = on ? '✿ effects: on' : '✿ effects: off';
  btn.setAttribute('aria-pressed', String(on));
  scene.setReduced(!on);
}
setFx(fxOn);
$('#fx-toggle').addEventListener('click', () => {
  setFx(!fxOn);
  try {
    localStorage.setItem('fx', fxOn ? '1' : '0');
  } catch {}
});

// --- vstupy ---
const isUi = (el) => el && el.closest && el.closest('.card, .foot, a, button');
addEventListener(
  'pointermove',
  (e) => {
    scene.pointerMove(e.clientX, e.clientY, performance.now());
    const overToy = !isUi(e.target) && scene.isOverToy(e.clientX, e.clientY);
    document.body.classList.toggle('over-panda', overToy);
  },
  { passive: true }
);
addEventListener('pointerdown', (e) => {
  if (isUi(e.target)) return;
  if (scene.click(e.clientX, e.clientY) === 'ball') document.body.classList.add('grabbing');
});
const release = (e) => {
  scene.pointerUp();
  document.body.classList.remove('grabbing');
  if (e.pointerType !== 'mouse') scene.pointerLeave();
};
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
// na dotykových displejích nescrollovat, když prst chytá míček
addEventListener(
  'touchstart',
  (e) => {
    const t = e.touches[0];
    if (t && !isUi(e.target) && scene.ballAt(t.clientX, t.clientY)) e.preventDefault();
  },
  { passive: false }
);
addEventListener(
  'touchmove',
  (e) => {
    if (scene.balls.held) e.preventDefault();
  },
  { passive: false }
);
document.documentElement.addEventListener('pointerleave', () => scene.pointerLeave());
addEventListener('blur', () => scene.pointerLeave());

let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    scene.resize();
    syncWall();
  }, 120);
});

// --- smyčka (max ~60 fps) ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const el = now - last;
  if (el < 15) return;
  last = now;
  scene.update(Math.min(0.05, el / 1000), now);
  scene.draw();
  // občas panda něco řekne
  if (now - lastSay > 16000 && !scene.pstate.sleep && document.visibilityState === 'visible') say(pick(LINES.idle));
}
requestAnimationFrame(frame);
setTimeout(() => say(pick(LINES.hello), 3200), 1400);
lastSay = performance.now();

// --- míčky ---
const ballBtn = $('#ball-btn');
const clearBtn = $('#ball-clear');
const syncBalls = () => {
  clearBtn.hidden = scene.balls.count === 0;
};
// na desktopu se míčky nekutálí pod panel s odkazy
const panel = $('.panel');
const syncWall = () => {
  const wide = innerWidth > 760;
  scene.setBallWall(wide ? panel.getBoundingClientRect().right + 16 : 0);
};
syncWall();
ballBtn.addEventListener('click', () => {
  scene.spawnBall();
  syncBalls();
});
clearBtn.addEventListener('click', () => {
  scene.clearBalls();
  syncBalls();
});

// --- karty: náklon a světlo za kurzorem ---
const cards = [...document.querySelectorAll('.card')];
for (const card of cards) {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', `${x * 100}%`);
    card.style.setProperty('--my', `${y * 100}%`);
    if (fxOn && e.pointerType === 'mouse') {
      card.style.setProperty('--ry', `${(x - 0.5) * 5}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * 5}deg`);
    }
  });
  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
}

// --- profilovka: záložní "N", když se obrázek nenačte ---
const avatar = $('#avatar');
const img = avatar.querySelector('img');
const noImg = () => avatar.classList.add('noimg');
img.addEventListener('error', noImg);
if (img.complete && img.naturalWidth === 0) noImg();

$('#year').textContent = String(new Date().getFullYear());
