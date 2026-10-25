// Interspecies Dialogue · SHOWCASE (English edition) — boot, loader, field orchestration, hero, beats, gates, nav, cursor, dock.
import { $, $$, clamp, lerp, damp, mq, onFrame, frame, track, measure, measureHooks, scroll, visible, scramble, countUp, fmtInt, fmtTime, toast, loadVideo, safePlay } from './util.js';
import { createField } from './field.js';
import { engine, TRACKS } from './audio.js';
import { initSections } from './sections.js';

const root = document.documentElement;
root.classList.add('js');
const REDUCED = mq.reduced;
if (REDUCED) root.classList.add('no-motion');
if (!mq.coarse && !REDUCED && matchMedia('(pointer: fine)').matches) root.classList.add('has-cursor');
window.__sc = { engine };

/* ================= GRAIN ================= */
(function grain() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), d = g.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    $('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
  } catch (e) { /* decorative only */ }
})();

/* ================= FIELD ================= */
const canvas = $('#field');
let field = null;
try { field = createField(canvas); } catch (e) { console.warn('field failed', e); }
if (field) root.classList.add('has-gl'); else { canvas.style.display = 'none'; root.classList.add('no-gl'); }
window.__sc.field = field;

/* ================= DATA ================= */
// site.json is shared with the Chinese edition; notes-en.json adds English renderings of the lab notes (tooltips only)
const notesP = fetch('data/notes-en.json').then((r) => r.json()).then((j) => j.notes || {}).catch((e) => { console.warn('notes-en.json', e); return {}; });
const dataP = fetch('data/site.json').then((r) => r.json()).then((d) => notesP.then((n) => { d.notesEn = n; return d; })).catch((e) => { console.warn('site.json', e); return null; });

/* ================= LOADER ================= */
const loader = $('.loader');
(function ticks() {
  const g = $('.loader-ring .ticks'); if (!g) return;
  let s = '';
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, major = i % 6 === 0;
    const r1 = 92, r2 = major ? 80 : 86;
    s += `<line class="${major ? 'major' : ''}" x1="${100 + Math.cos(a) * r1}" y1="${100 + Math.sin(a) * r1}" x2="${100 + Math.cos(a) * r2}" y2="${100 + Math.sin(a) * r2}"/>`;
  }
  g.innerHTML = s;
})();
const loadState = { p: 0, target: 0.15, done: false };
const t0 = performance.now();
// fonts load non-blocking (display=swap); never hold the page for them for more than a moment
const fontsP = (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]) : Promise.resolve());
fontsP.then(() => { loadState.target = Math.max(loadState.target, 0.6); });
dataP.then(() => { loadState.target = Math.max(loadState.target, 0.4); });
Promise.all([fontsP, dataP, new Promise((r) => setTimeout(r, REDUCED ? 100 : 900))]).then(() => { loadState.target = 1; });
const pctEl = $('[data-loader-pct]'), magEl = $('[data-loader-mag]'), smpEl = $('[data-loader-sample]');
function finishLoad() {
  if (loadState.done) return;
  loadState.done = true;
  if (loader) loader.classList.add('is-done');
  document.body.classList.remove('is-loading');
  if (field) { field.target.iris = 2.0; field.target.blur = 0; }
  heroIntro();
  measure();
  setTimeout(measure, 800);
}
setTimeout(() => { loadState.target = 1; }, 1800); // never block on a slow CDN, font or data file
let loadLast = performance.now();
onFrame(() => {
  if (loadState.done) return;
  // the inline 7 s fail-safe in index.html may already have removed the loader on a very slow network
  if (!pctEl || !loader) { finishLoad(); return; }
  // wall-clock step (the frame loop clamps dt to 0.1 s, which stretched the loader on slow first frames)
  const now = performance.now(), step = Math.min(0.5, (now - loadLast) / 1000); loadLast = now;
  loadState.p = Math.min(loadState.target, loadState.p + step * (REDUCED ? 10 : 1.25));
  const p = loadState.p;
  if (p > 0.86) loader.classList.add('is-closing'); // read-out fades before the iris opens
  pctEl.textContent = String(Math.round(p * 100)).padStart(3, '0');
  magEl.textContent = p < 0.35 ? '×200' : p < 0.7 ? '×500' : '×1000';
  smpEl.textContent = fmtInt(28800000 * p);
  if (field) {
    // the field is seen through the eyepiece ring: iris radius in units of screen height
    const ringR = Math.min(innerWidth * 0.46, 260) / 2 * 0.94;
    field.target.iris = ringR / innerHeight * (0.35 + 0.65 * p);
    field.target.blur = 1.1 - p * 0.75;
  }
  if (p >= 0.999) finishLoad();
});

/* ================= HERO ================= */
const chars = $$('.title .ch');
function heroIntro() {
  const en = $('.title-en');
  const gs = window.gsap;
  if (REDUCED) return;
  if (gs) {
    gs.fromTo(chars, { yPercent: 60, opacity: 0, filter: 'blur(18px)', scaleY: 1.6 },
      { yPercent: 0, opacity: 1, filter: 'blur(0px)', scaleY: 1, duration: 1.4, ease: 'expo.out', stagger: 0.11, delay: 0.15 });
    gs.fromTo('.hero .eyebrow, .hero-lead, .hero-lead-en, .hero-actions, .hero-hint, .hud', { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.07, delay: 0.7 });
  }
  setTimeout(() => glitchBurst(900), 650);
  if (en) setTimeout(() => scramble(en, en.dataset.scramble, 1300), 500);
}
function glitchBurst(dur = 500) {
  if (REDUCED) return;
  const end = performance.now() + dur;
  function step() {
    const live = performance.now() < end;
    for (const c of chars) {
      if (live && Math.random() < 0.6) {
        const a = Math.random() * 90, b = Math.random() * (95 - a);
        c.style.setProperty('--go', '1');
        c.style.setProperty('--gx1', `${(Math.random() - 0.5) * 26}px`);
        c.style.setProperty('--gy1', `${(Math.random() - 0.5) * 6}px`);
        c.style.setProperty('--gx2', `${(Math.random() - 0.5) * 30}px`);
        c.style.setProperty('--t1', `${a}%`); c.style.setProperty('--b1', `${b}%`);
        c.style.setProperty('--t2', `${Math.random() * 80}%`); c.style.setProperty('--b2', `${Math.random() * 20}%`);
        c.style.transform = Math.random() < 0.3 ? `translateX(${(Math.random() - 0.5) * 14}px)` : '';
      } else {
        c.style.setProperty('--go', '0'); c.style.transform = '';
      }
    }
    if (live) setTimeout(step, 55 + Math.random() * 40);
    else for (const c of chars) { c.style.setProperty('--go', '0'); c.style.transform = ''; }
  }
  step();
}
if (!REDUCED) {
  (function idleGlitch() { setTimeout(() => { if (scroll.y < innerHeight) glitchBurst(220 + Math.random() * 300); idleGlitch(); }, 3200 + Math.random() * 4200); })();
  $('.title').addEventListener('pointerenter', () => glitchBurst(380));
}

// HUD readouts
const hud = { ap: $('[data-hud="ap"]'), xy: $('[data-hud="xy"]'), bands: $('[data-hud="bands"]'), fps: $('[data-hud="fps"]') };
let hudT = 0;

/* ================= POINTER ================= */
const pointer = { x: innerWidth * 0.62, y: innerHeight * 0.5, moved: false };
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true;
  if (field) field.setMouse(e.clientX / innerWidth, 1 - e.clientY / innerHeight, 1);
}, { passive: true });
document.addEventListener('pointerleave', () => { if (field) field.setMouse(field.mouse.tx, field.mouse.ty, 0); });

// custom cursor
const cursor = $('.cursor');
if (root.classList.contains('has-cursor')) {
  const dot = $('.cursor-dot'), ring = $('.cursor-ring'), label = $('.cursor-label');
  const c = { x: pointer.x, y: pointer.y };
  onFrame((t, dt) => {
    c.x = damp(c.x, pointer.x, 14, dt); c.y = damp(c.y, pointer.y, 14, dt);
    dot.style.transform = `translate(${pointer.x}px, ${pointer.y}px)`;
    ring.style.transform = `translate(${c.x}px, ${c.y}px)`;
  });
  document.addEventListener('pointerover', (e) => {
    const h = e.target.closest('a, button, [data-cursor], canvas.sculpt-canvas, canvas.carousel-canvas, .uc');
    cursor.classList.toggle('is-hover', !!h);
    label.textContent = h ? (h.dataset.cursor || (h.matches('canvas') ? 'DRAG' : h.matches('.uc') ? 'PLAY' : 'OPEN')) : '';
  });
  addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  addEventListener('pointerup', () => cursor.classList.remove('is-down'));
}
// magnetic buttons
if (!mq.coarse && !REDUCED) {
  for (const el of $$('.magnetic')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.28}px, ${dy * 0.36}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transition = 'transform .6s cubic-bezier(.2,.7,.1,1)'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 600); });
  }
}

/* ================= SMOOTH SCROLL ================= */
let lenis = null;
function initLenis() {
  if (REDUCED || !window.Lenis || mq.coarse) return;
  try {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
    onFrame(() => lenis.raf(performance.now()));
    window.__sc.lenis = lenis;
    if (window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);
  } catch (e) { console.warn('lenis', e); lenis = null; }
}
// The page can still grow above the target while a jump is running (sections settling on a cold load),
// and a smooth scroll keeps the target it computed at the start, so it can stop short. Once the scroll
// has come to rest, re-aim at the target (at most twice). Any user input cancels the correction.
let jumpTok = 0;
for (const t of ['wheel', 'touchstart', 'keydown']) addEventListener(t, () => { jumpTok++; }, { passive: true });
function aimAt(el) {
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
  else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
}
function settleOn(el, tok) {
  let tries = 0, lastY = NaN, still = 0, t0 = performance.now();
  const check = () => {
    if (tok !== jumpTok) return;
    const y = window.scrollY;
    if (Math.abs(y - lastY) < 1) still++; else { still = 0; lastY = y; }
    if (still < 3 && performance.now() - t0 < 6000) { setTimeout(check, 120); return; }
    const off = el.getBoundingClientRect().top;
    const atEnd = y >= document.documentElement.scrollHeight - innerHeight - 1;
    if (Math.abs(off) > 2 && !(off > 0 && atEnd) && tries < 2) {
      tries++; still = 0; lastY = NaN; t0 = performance.now();
      aimAt(el); setTimeout(check, 200);
    }
  };
  setTimeout(check, 200);
}
function scrollToEl(el, moveFocus = true) {
  if (!el) return;
  const tok = ++jumpTok;
  aimAt(el);
  settleOn(el, tok);
  // move keyboard focus with the jump (skip link, nav), without a second scroll
  if (moveFocus) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    try { el.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  }
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  e.preventDefault();
  scrollToEl(el);
  nav.classList.remove('is-open'); navToggle.setAttribute('aria-expanded', 'false');
  history.replaceState(null, '', '#' + id);
});

/* ================= NAV + READHEAD ================= */
const nav = $('.nav'), navToggle = $('.nav-toggle');
navToggle.addEventListener('click', () => {
  const o = nav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(o));
});
const navLinks = $$('.nav a');
const navTargets = navLinks.map((a) => document.getElementById(a.dataset.nav)).filter(Boolean);
const readBar = $('.readhead-bar'), readCount = $('[data-readhead]');

/* ================= PALETTE ZONES ================= */
const zones = $$('[data-palette], .solid, .beats, .foot').map((el) => ({ el, top: 0, bottom: 0 }));
const solids = $$('.solid').map((el) => ({ el, top: 0, bottom: 0 }));
measureHooks.push((y) => {
  for (const z of zones.concat(solids)) { const r = z.el.getBoundingClientRect(); z.top = r.top + y; z.bottom = r.bottom + y; }
  // nested zones (e.g. the sound deck inside #sound) must win: sort so inner (later-starting) come first
  zones.sort((a, b) => b.top - a.top);
});
let currentPal = 'plant';
function zoneAt(yAbs) {
  for (const z of zones) if (z.top <= yAbs && z.bottom > yAbs) return z.el;
  return null;
}

/* ================= BEATS ================= */
const beats = $$('.beat');
const beatIdx = $('[data-beat-idx]'), beatRail = $('.beats-rail i');
let beatMood = 'plant', beatActive = -1;
const counted = new Set();
if (!REDUCED) {
  for (const b of beats) {
    // split the line into per-word spans for the reveal (spaces stay plain text so lines still wrap; inner elements kept)
    const zh = $('.beat-zh', b);
    const walk = (node) => {
      for (const ch of Array.from(node.childNodes)) {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of ch.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
            const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s);
          }
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && !ch.classList.contains('big-num') && !ch.classList.contains('glitchy')) walk(ch);
        else if (ch.nodeType === 1) ch.classList.add('w');
      }
    };
    walk(zh);
  }
  track($('#beats'), (p) => {
    const n = beats.length;
    const f = p * n;
    const idx = Math.min(n - 1, Math.floor(f));
    beatRail.style.transform = `scaleX(${p})`;
    beats.forEach((b, i) => {
      if (f < i - 0.2 || f > i + 1.2) {
        if (b._vis !== 0) { b._vis = 0; b.style.opacity = '0'; b.setAttribute('aria-hidden', 'true'); }
        if (!(i === n - 1 && f >= n - 1)) return;
      }
      b._vis = 1;
      const local = clamp(f - i);           // 0..1 inside its slot
      // the first beat is already readable at the top of the section; later ones fade in fast
      const inA = i === 0 ? 1 : clamp(local / 0.15), outA = clamp((local - 0.85) / 0.15);
      const vis = i === n - 1 ? inA : inA * (1 - outA);
      b.style.opacity = vis.toFixed(3);
      b.style.transform = `translateY(${(1 - inA) * 30 - outA * 40}px)`;
      const ws = b._ws || (b._ws = $$('.w', b));
      const k = i === 0 ? 1 : clamp(local / 0.2);
      ws.forEach((w, j) => {
        // a soft front about three words wide sweeps through the line
        const wp = clamp(k * (ws.length + 3) / 3 - j / 3);
        w.style.opacity = wp.toFixed(3);
        w.style.filter = wp < 1 ? `blur(${(1 - wp) * 10}px)` : '';
      });
      b.setAttribute('aria-hidden', vis < 0.5 ? 'true' : 'false');
    });
    if (idx !== beatActive) {
      beatActive = idx;
      beatIdx.textContent = String(idx + 1).padStart(2, '0');
      beatMood = beats[idx].dataset.mood;
      // numbers in the beats are shown as-is (a count-up made them read 182 / 77 mid-animation)
      if (beatMood === 'ai' && field) field.kick(0.9);
    }
  }, 'pin');
}

/* ================= GATES (torn black panels) ================= */
function tornPath(edge, seed, amp, n = 26, top = true) {
  // polygon covering the panel with a jagged free edge (percent coords)
  const pts = [];
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i <= n; i++) {
    const x = i / n * 100 + (i > 0 && i < n ? (rnd() - 0.5) * (100 / n) * 0.8 : 0);
    const y = edge + (rnd() - 0.5) * amp + (rnd() < 0.15 ? (rnd() - 0.5) * amp * 2.2 : 0);
    pts.push(`${x.toFixed(2)}% ${clamp(y, 0, 100).toFixed(2)}%`);
  }
  return top ? `polygon(0% 0%, 100% 0%, ${pts.reverse().join(', ')})` : `polygon(${pts.join(', ')}, 100% 100%, 0% 100%)`;
}
for (const g of $$('.gate')) {
  const top = $('.tear-top', g), bot = $('.tear-bot', g), title = $('.gate-title', g);
  if (REDUCED) continue;
  let seed = 1 + Math.floor(Math.random() * 1e6), lastStep = -1;
  track(g, (p) => {
    // panels part from the centre: a lit crack is already open at p=0, wide open by ~0.5
    const open = clamp((p + 0.06) / 0.55);
    const e = open * open * (3 - 2 * open);
    const step = Math.floor(p * 9);
    if (step !== lastStep) { lastStep = step; seed = (seed * 48271) % 2147483647; } // re-tear on each step, like a scene cut
    top.style.clipPath = tornPath(100, seed, 10 + e * 26, 24, true);
    bot.style.clipPath = tornPath(0, seed + 7, 10 + e * 26, 24, false);
    top.style.transform = `translateY(${-e * 100}%)`;
    bot.style.transform = `translateY(${e * 100}%)`;
    const tIn = clamp(p / 0.2), tOut = clamp((p - 0.82) / 0.18);
    title.style.opacity = ((0.35 + 0.65 * tIn) * (1 - tOut)).toFixed(3);
    title.style.transform = `scale(${1.25 - tIn * 0.25 + e * 0.12}) translateY(${-tOut * 60}px)`;
    title.style.filter = `blur(${(1 - tIn) * 6 + tOut * 10}px)`;
  }, 'pin');
}

/* ================= REVEALS ================= */
if (!REDUCED && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((ents) => {
    let k = 0;
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      el.style.transitionDelay = `${Math.min(k++, 6) * 0.08}s`;
      el.classList.add('is-in');
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  // .draw = decoration-only reveal (e.g. credit hairlines): the text is never hidden
  $$('.reveal, .draw').forEach((el) => io.observe(el));
} else { $$('.reveal, .draw').forEach((el) => el.classList.add('is-in')); }

// count-up stats
for (const el of $$('.stat b[data-count]')) {
  if (REDUCED) continue;
  el.textContent = '0';
  let done = false;
  visible(el, (v) => { if (v && !done) { done = true; countUp(el, +el.dataset.count, 1600); } });
}

/* ================= LISTEN / DOCK ================= */
const dock = $('[data-dock]');
const dockTitle = $('[data-dock-title]'), dockTime = $('[data-dock-time]'), dockSpec = $('.dock-spec');
const dctx = dockSpec.getContext('2d');
function startListening(id) {
  engine.select(id || (engine.track ? engine.track.id : TRACKS[0].id), true);
  dock.classList.add('is-shown');
}
for (const b of $$('[data-listen]')) b.addEventListener('click', () => {
  if (engine.playing) engine.pause(); else startListening();
});
$('[data-dock-toggle]').addEventListener('click', () => { if (!engine.track) startListening(); else engine.toggle(); });
function syncPlaying() {
  root.classList.toggle('is-playing', engine.playing);
  $$('[data-listen]').forEach((b) => { const t = b.querySelector('.btn-txt'); t.firstChild.textContent = engine.playing ? 'Pause' : 'Listen'; t.querySelector('small').textContent = engine.playing ? 'NOW PLAYING' : engine.track ? 'PAUSED' : 'SOUND OFF'; });
  $('[data-dock-toggle]').setAttribute('aria-label', engine.playing ? 'Pause' : 'Play');
}
engine.addEventListener('play', syncPlaying);
engine.addEventListener('pause', syncPlaying);
engine.addEventListener('track', () => { dockTitle.textContent = engine.track.title; dock.classList.add('is-shown'); });
engine.addEventListener('blocked', () => toast('The browser blocked autoplay. Click or tap the page to start.'));
engine.addEventListener('mediaerror', () => toast('The audio file did not load. Please reload the page and try again.'));
// other media with sound pause the engine (and vice versa)
// 'film' = the YouTube film (js/thefilm.js); it pauses itself when any other sound starts
document.addEventListener('sound:exclusive', (e) => {
  if (e.detail !== 'engine' && engine.playing) engine.pause();
  if (e.detail === 'engine' || e.detail === 'film') for (const v of $$('video[data-sound-el]')) if (!v.paused) v.pause();
});
document.addEventListener('play', (e) => {
  const v = e.target;
  if (v && v.tagName === 'VIDEO' && !v.muted) document.dispatchEvent(new CustomEvent('sound:exclusive', { detail: 'video' }));
}, true);

/* ================= MAIN FRAME ================= */
let frames = 0, acc = 0, accT = 0, staticKey = '', liteTick = false;
const liteZones = $$('#film, #dial, #letter, .foot').map((el) => ({ el, top: 0, bottom: 0 }));
measureHooks.push((y) => { for (const l of liteZones) { const r = l.el.getBoundingClientRect(); l.top = r.top + y; l.bottom = r.bottom + y; } });
onFrame((t, dt) => {
  const b = engine.update(dt);
  // nav + readhead
  const p = clamp(scroll.y / scroll.max);
  readBar.style.transform = `scaleX(${p})`;
  readCount.textContent = fmtInt(p * 28800000);
  // field palette & intensity
  if (field) {
    const z = zoneAt(scroll.y + scroll.vh * 0.5);
    let pal = 'plant', fade = 0.42, freeze = 0, tear = 0, sat = 1, zoom = 5.4, open = 0, blur = 0;
    if (z) {
      if (z.classList.contains('beats')) { pal = beatMood; fade = 0.9; zoom = 4.6; if (pal === 'void') { freeze = 1; sat = 0.15; } if (pal === 'ai') tear = 0.18; }
      else if (z.classList.contains('hero')) { pal = 'plant'; fade = 1; }
      else if (z.classList.contains('gate')) { pal = z.dataset.palette; fade = 1; zoom = 3.6; open = 0.25; }
      else if (z.classList.contains('foot')) { pal = 'fusion'; fade = 0.5; zoom = 4.8; freeze = 0.85; sat = 0.55; blur = 0.25; }
      // reading zones: the field steps back (dimmer, calmer, less saturated) so body text stays legible
      else { pal = z.dataset.palette || currentPal; fade = mq.small ? 0.15 : 0.18; zoom = 6.2; blur = mq.small ? 0 : 0.42; sat = 0.7; }
    }
    if (b.level > 0.02) fade = Math.min(1, fade + b.level * (fade < 0.3 ? 0.12 : 0.25));
    currentPal = pal;
    field.setPalette(pal);
    Object.assign(field.target, { fade, freeze, tear, sat, zoom, open });
    if (loadState.done) field.target.blur = blur;
    field.setBands(b);
    // skip rendering while an opaque section covers the whole viewport
    let covered = false;
    // skip the field while opaque sections hide (almost) all of it; the thin edges keep the last frame
    let cov = 0;
    for (const s of solids) cov += Math.max(0, Math.min(s.bottom, scroll.y + scroll.vh) - Math.max(s.top, scroll.y));
    covered = cov / scroll.vh > 0.86;
    field.update(t, dt, scroll.y);
    if (REDUCED) {
      // static field: one still frame per palette, re-rendered only when the chapter changes
      const key = `${pal}|${fade}|${freeze}|${loadState.done}|${innerWidth}x${innerHeight}`;
      if (key !== staticKey && !covered) { staticKey = key; if (loadState.done) { field.target.iris = 2; field.target.blur = blur; } field.snap(); field.render(12.3); }
    } else if (!covered) {
      // behind the dense pinned scenes (film strip, dial, letter, footer) the dim field only needs ~30 fps
      const yc = scroll.y + scroll.vh * 0.5;
      const lite = liteZones.some((l) => l.top <= yc && l.bottom > yc);
      if (lite) {
        liteTick = !liteTick;
        if (liteTick) field.render(t);
        accT = 0; frames = 0; // frame pacing is not representative here; don't adapt resolution on it
      } else {
        const s0 = performance.now();
        field.render(t);
        acc += performance.now() - s0; accT += dt; frames++;
        if (accT > 1.2) { field.adapt((accT / Math.max(1, frames)) * 1000); acc = 0; accT = 0; frames = 0; }
      }
    }
    // HUD
    hudT += dt;
    if (hudT > 0.12 && scroll.y < scroll.vh && !REDUCED) {
      hudT = 0;
      const ap = 18 + 22 * (0.5 + 0.5 * Math.sin(t * 0.6)) + field.mouse.on * 30 + b.bass * 25;
      hud.ap.textContent = `${ap.toFixed(1).padStart(4, '0')}%`;
      hud.xy.innerHTML = `${String(Math.round(pointer.x * 0.73)).padStart(4, '0')} · ${String(Math.round(pointer.y * 0.73)).padStart(4, '0')} <span style="text-transform:none">μm</span>`;
      hud.bands.textContent = `${b.bass.toFixed(2)} / ${b.high.toFixed(2)}`;
      hud.fps.textContent = `${Math.round(frame.fps)} FPS · ${Math.round(field.quality * 100)}% RES`;
    }
  }
  // dock mini spectrum
  if (dock.classList.contains('is-shown') && engine.freq && !mq.small) {
    const w = dockSpec.width, h = dockSpec.height;
    dctx.clearRect(0, 0, w, h);
    if (engine.playing) {
      const n = 30;
      for (let i = 0; i < n; i++) {
        const v = engine.freq[Math.floor(Math.pow(i / n, 1.7) * 380) + 2] / 255;
        dctx.fillStyle = i / n > 0.6 ? '#7eb8ff' : '#c8ff40';
        dctx.fillRect(i * 4, h - v * h, 2.5, v * h);
      }
    }
  }
  if (engine.track) dockTime.textContent = `${fmtTime(engine.el.currentTime)} / ${fmtTime(engine.el.duration || engine.track.dur)}`;
});

// active nav
setInterval(() => {
  let active = null;
  for (const s of navTargets) { const r = s.getBoundingClientRect(); if (r.top < innerHeight * 0.45) active = s.id; }
  navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === active));
}, 300);

/* ================= GLOBAL KEYS ================= */
// capture phase: Escape still closes the lightbox while focus is inside native video controls,
// and Tab stays inside the open dialog (focus trap)
addEventListener('keydown', (e) => {
  const lb = $('[data-lightbox]');
  if (!lb || lb.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); $('[data-lb-close]').click(); }
}, true);
document.addEventListener('focusin', (e) => {
  const lb = $('[data-lightbox]');
  if (lb && !lb.hidden && !lb.contains(e.target)) $('[data-lb-close]').focus();
});

/* ================= BOOT SECTIONS ================= */
function whenLibs(cb) {
  // gsap/lenis are deferred classic scripts; wait for DOMContentLoaded (they run before it)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb, { once: true }); else cb();
}
whenLibs(() => {
  initLenis();
  if (window.gsap && window.ScrollTrigger) { try { window.gsap.registerPlugin(window.ScrollTrigger); } catch (e) { /* ignore */ } }
  dataP.then((data) => {
    initSections({ data, field, engine, reduced: REDUCED, scrollToEl, startListening, lenis });
    measure();
  });
});
addEventListener('load', () => { measure(); setTimeout(measure, 1500); });
