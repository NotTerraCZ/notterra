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
const pet = touch ? 'Ťukni na mě! 🐾' : 'Pohlaď mě myší… 🐾';
const LINES = {
  hello: ['Ahoj! Vítej u NotTerry 🌸', 'Čau! Vítej 🌸'],
  idle: [
    'Mrkni na můj YouTube! 🎬',
    'Přidej se na Slime SMP! 🟩',
    pet,
    'Sakury dneska krásně voní 🌸',
    'Mňam… bambus by bodl 🎋',
    'Klikni na mě! ✨',
    'Zkus kliknout do nebe ✨',
    'Hry najdeš na itch.io 🎮',
    'Uvidíme se na Discordu! 💬',
  ],
  boop: ['Hehe! 💕', 'To lechtá! 😆', 'Ještě! ✨', 'Boop! 🐾', 'Jsi super! 💖'],
  wake: ['Hm?! Už jsem vzhůru! 👀', 'Jééé, návštěva! 🌸'],
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
  },
});

function setFx(on) {
  fxOn = on;
  document.body.classList.toggle('fx-off', !on);
  const btn = $('#fx-toggle');
  btn.textContent = on ? '✿ efekty: zap' : '✿ efekty: vyp';
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
    const overPanda = !isUi(e.target) && scene.isOverPanda(e.clientX, e.clientY);
    document.body.classList.toggle('over-panda', overPanda);
  },
  { passive: true }
);
addEventListener('pointerdown', (e) => {
  if (isUi(e.target)) return;
  scene.click(e.clientX, e.clientY);
});
addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') scene.pointerLeave();
});
document.documentElement.addEventListener('pointerleave', () => scene.pointerLeave());
addEventListener('blur', () => scene.pointerLeave());

let resizeT = 0;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => scene.resize(), 120);
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
