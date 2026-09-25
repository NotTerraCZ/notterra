import { Scene } from './scene.js';
import { ICONS } from './icons.js';

const $ = (s) => document.querySelector(s);
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

// --- uložené volby (jen pohodlí, nemusí fungovat) ---
const load = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
let fxOn = !motionQuery.matches;
if (load('fx') === '0') fxOn = false;
if (load('fx') === '1') fxOn = true;
let time = load('time') === 'day' ? 'day' : 'night';
let weather = ['clear', 'rain', 'fog'].includes(load('weather')) ? load('weather') : 'clear';

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
    'The sakura smell lovely 🌸',
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
  day: ['Good morning! ☀️', 'Rise and shine! 🌸'],
  night: ['Good night… 🌙', 'Look at the stars ✨'],
  sunny: ['What a sunny day! ☀️'],
  clear: ['Clear skies tonight ✨'],
  rain: ["Brr, it's raining! ☔", 'Splish splash! 🌧️'],
  fog: ['So foggy… 🌫️', 'Where did everyone go? 🌫️'],
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
  time,
  weather,
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
  save('fx', fxOn ? '1' : '0');
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
  // klik do scény nesmí začít označovat text ani tahat obrázky
  if (e.pointerType === 'mouse') e.preventDefault();
  if (scene.click(e.clientX, e.clientY) === 'ball') {
    document.body.classList.add('grabbing');
    window.getSelection()?.removeAllRanges();
  }
});
addEventListener('selectstart', (e) => {
  if (document.body.classList.contains('grabbing')) e.preventDefault();
});
addEventListener('dragstart', (e) => e.preventDefault());
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

// --- den/noc a počasí ---
const timeBtn = $('#time-btn');
const weatherBtn = $('#weather-btn');
const themeColor = document.querySelector('meta[name="theme-color"]');
const WEATHER_NEXT = { clear: 'rain', rain: 'fog', fog: 'clear' };
const weatherName = (w) => (w === 'rain' ? 'Rainy' : w === 'fog' ? 'Foggy' : time === 'day' ? 'Sunny' : 'Clear');
function renderTheme() {
  document.body.classList.toggle('day', time === 'day');
  themeColor.setAttribute('content', time === 'day' ? '#4a8ee6' : '#140f2e');
  const tName = time === 'day' ? 'Day' : 'Night';
  timeBtn.querySelector('.ico-slot').innerHTML = time === 'day' ? ICONS.sun : ICONS.moon;
  timeBtn.querySelector('.lbl').textContent = tName;
  timeBtn.title = `${tName} – switch to ${time === 'day' ? 'night' : 'day'}`;
  timeBtn.setAttribute('aria-label', timeBtn.title);
  const wName = weatherName(weather);
  weatherBtn.querySelector('.ico-slot').innerHTML = ICONS[weather];
  weatherBtn.querySelector('.lbl').textContent = wName;
  weatherBtn.title = `${wName} – change weather`;
  weatherBtn.setAttribute('aria-label', weatherBtn.title);
}
renderTheme();
timeBtn.addEventListener('click', () => {
  time = time === 'day' ? 'night' : 'day';
  scene.setTheme(time, weather);
  renderTheme();
  save('time', time);
  say(pick(LINES[time]), 2200);
});
weatherBtn.addEventListener('click', () => {
  weather = WEATHER_NEXT[weather];
  scene.setTheme(time, weather);
  renderTheme();
  save('weather', weather);
  say(pick(weather === 'clear' ? LINES[time === 'day' ? 'sunny' : 'clear'] : LINES[weather]), 2200);
});

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
