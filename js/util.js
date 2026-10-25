// Shared helpers: math, DOM, frame scheduler, scroll progress, text effects.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const mq = {
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  coarse: matchMedia('(pointer: coarse)').matches,
  small: matchMedia('(max-width: 860px)').matches,
};

export function fmtTime(s) {
  if (!isFinite(s)) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
export function fmtMS(s) {
  if (!Number.isFinite(s)) return '--:--';   // frames not loaded yet
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
export const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

/* ---------- single frame loop ---------- */
const subs = new Set();
let lastT = performance.now();
let running = false;
export const frame = { t: 0, dt: 0.016, fps: 60 };
function loop(now) {
  const dt = Math.min(0.1, Math.max(0.001, (now - lastT) / 1000));
  lastT = now;
  frame.t = now / 1000; frame.dt = dt;
  frame.fps = lerp(frame.fps, 1 / dt, 0.05);
  for (const f of subs) {
    try { f(frame.t, dt); } catch (e) { console.error(e); subs.delete(f); }
  }
  requestAnimationFrame(loop);
}
export function onFrame(fn) {
  subs.add(fn);
  if (!running) { running = true; requestAnimationFrame(loop); }
  return () => subs.delete(fn);
}

/* ---------- scroll progress registry ---------- */
const tracked = [];
export const scroll = { y: 0, vh: innerHeight, vw: innerWidth, vel: 0, max: 1 };
export const measureHooks = [];
export function measure() {
  scroll.vh = innerHeight; scroll.vw = innerWidth;
  scroll.max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const y = scrollY;
  for (const t of tracked) {
    const r = t.el.getBoundingClientRect();
    t.top = r.top + y; t.h = r.height;
  }
  for (const h of measureHooks) { try { h(y); } catch (e) { console.warn(e); } }
}
export function track(el, cb, mode = 'pin') {
  // mode 'pin': 0 when el top hits viewport top, 1 when el bottom hits viewport bottom
  // mode 'pass': 0 when el top enters viewport bottom, 1 when el bottom leaves viewport top
  const t = { el, cb, mode, top: 0, h: 1, p: -1 };
  tracked.push(t);
  const r = el.getBoundingClientRect(); t.top = r.top + scrollY; t.h = r.height;
  return t;
}
let lastY = scrollY;
onFrame((time, dt) => {
  const y = scrollY;
  scroll.vel = lerp(scroll.vel, (y - lastY) / Math.max(dt, 0.001), 0.2);
  lastY = y; scroll.y = y;
  for (const t of tracked) {
    let p;
    if (t.mode === 'pin') p = clamp((y - t.top) / Math.max(1, t.h - scroll.vh));
    else p = clamp((y + scroll.vh - t.top) / Math.max(1, t.h + scroll.vh));
    if (Math.abs(p - t.p) > 1e-5) { t.p = p; t.cb(p); }
  }
});
let mTimer;
addEventListener('resize', () => { clearTimeout(mTimer); mTimer = setTimeout(measure, 120); });
if ('ResizeObserver' in window) {
  new ResizeObserver(() => { clearTimeout(mTimer); mTimer = setTimeout(measure, 120); }).observe(document.body);
}

/* ---------- visibility ---------- */
export function visible(el, cb, margin = '0px') {
  if (!('IntersectionObserver' in window)) { cb(true); return; }
  const io = new IntersectionObserver((ents) => { for (const e of ents) cb(e.isIntersecting, e); }, { rootMargin: margin });
  io.observe(el);
  return io;
}

/* ---------- text effects ---------- */
// neutral glyphs only (no kana: on a zh-TW page they read as Japanese); the target's own characters are mixed in
const GLYPHS = '01░▒▓█·/\\|<>#%+=';
export function scramble(el, text, dur = 900, onDone) {
  const len = text.length;
  const start = performance.now();
  const order = Array.from({ length: len }, (_, i) => i / len * 0.6 + Math.random() * 0.4);
  const pool = GLYPHS + text.replace(/\s/g, '');
  function step(now) {
    const p = clamp((now - start) / dur);
    let out = '';
    for (let i = 0; i < len; i++) {
      const c = text[i];
      if (c === ' ' || p >= order[i]) out += c;
      else out += pool[(Math.random() * pool.length) | 0];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(step); else { el.textContent = text; onDone && onDone(); }
  }
  requestAnimationFrame(step);
}
export function countUp(el, to, dur = 1400) {
  const start = performance.now();
  const fmt = to >= 1000 ? fmtInt : (v) => String(Math.round(v));
  function step(now) {
    const p = clamp((now - start) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(to * e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function toast(msg, ms = 3200) {
  const t = $('[data-toast]');
  if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- lazy video ---------- */
export function loadVideo(v) {
  if (v.dataset.loaded) return;
  v.dataset.loaded = '1';
  for (const s of v.querySelectorAll('source[data-src]')) { s.src = s.dataset.src; }
  if (v.dataset.src) v.src = v.dataset.src;
  try { v.load(); } catch (e) { /* ignore */ }
}
export function safePlay(v) {
  const p = v.play();
  if (p && p.catch) p.catch(() => {});
}
