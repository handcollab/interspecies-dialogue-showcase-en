// Section behaviours that need no 3D library: plant charts, microscope scrub, collage,
// lazy videos, filmstrip, projector wall, uncanny room, dial, read-once letter, echoes, pipeline, footer.
import { $, $$, clamp, lerp, damp, mq, onFrame, track, measure, scroll, visible, scramble, fmtInt, fmtMS, toast, loadVideo, safePlay } from './util.js';
import { GROUPS, GROUP_ORDER, PLANTS_DISPLAY, AIGC_CATS } from './const.js';

export function initSections(ctx) {
  const { data, reduced } = ctx;
  const steps = [
    () => data && plantBars(data),
    () => data && phaseBars(data),
    () => data && scope(data, reduced),
    () => lazyVideos(reduced),
    () => collage(reduced),
    () => { const sh = $('[data-sheet]'); if (sh && !reduced) { const img = $('img', sh); track(sh, (p) => { img.style.setProperty('--sx', `${-p * 33.3}%`); }, 'pass'); } },
    () => film(reduced),
    () => wall(reduced),
    () => soundVideos(),
    () => data && uncanny(data, reduced),
    () => dial(reduced),
    () => letter(reduced),
    () => echoes(reduced),
    () => pipe(reduced),
    () => footer(),
    () => marquee(),
    // the heavy WebGL scenes (and three.js itself) start only when the visitor scrolls near them
    () => whenNear('.ridge-stage', () => import('./ridge.js').then((m) => data && m.initRidge(data, ctx))),
    () => whenNear('#sound', () => import('./deck.js').then((m) => m.initDeck(ctx))),
    () => whenNear('[data-sculpt-stage]', () => (document.documentElement.classList.contains('no-gl') ? Promise.reject(new Error('no WebGL')) : import('./sculpture.js').then((m) => data && m.initSculpture(data, ctx))).catch((e) => { console.warn('sculpture', e); fallbackNote('[data-sculpt-stage]', 'This device cannot show the 3D data sculpture; the data can still be downloaded below.'); })),
    () => whenNear('[data-carousel]', () => import('./carousel.js').then((m) => data && m.initCarousel(data, ctx)).catch((e) => console.warn('carousel', e))),
  ];
  for (const s of steps) { try { const r = s(); if (r && r.catch) r.catch((e) => console.warn(e)); } catch (e) { console.warn(e); } }
}

// run `fn` once, when `sel` comes within ~1.5 viewports (or immediately without IntersectionObserver)
function whenNear(sel, fn, margin = '150% 0px 150% 0px') {
  const el = $(sel);
  const go = () => { try { const r = fn(); if (r && r.catch) r.catch((e) => console.warn(e)); } catch (e) { console.warn(e); } };
  if (!el || !('IntersectionObserver' in window)) { go(); return; }
  const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: margin });
  io.observe(el);
}

/* ---------- marquee: the 13 small frames load together once the strip is near ---------- */
function marquee() {
  const box = $('.marquee'); if (!box) return;
  const imgs = $$('img', box);
  imgs.forEach((im) => { im.decoding = 'async'; });
  visible(box, (on) => { if (on) imgs.forEach((im) => { im.loading = 'eager'; }); }, '1000px 0px 1000px 0px');
}

function fallbackNote(sel, msg) {
  const el = $(sel); if (!el) return;
  const p = document.createElement('p');
  p.className = 'fine'; p.style.cssText = 'position:absolute;inset:auto 0 45% 0;text-align:center';
  p.textContent = msg; el.appendChild(p);
}

/* ---------- species outcome bars ---------- */
function plantBars(data) {
  for (const el of $$('[data-plant-bar]')) {
    const pi = +el.dataset.plantBar;
    const rows = data.records.filter((r) => r.p === pi);
    const c = {}; for (const r of rows) c[r.g] = (c[r.g] || 0) + 1;
    el.innerHTML = GROUP_ORDER.filter((g) => c[g]).map((g) => `<i style="flex:${c[g]};background:${GROUPS[g].color}" title="${GROUPS[g].en} ${c[g]}"></i>`).join('');
  }
}

/* ---------- outcomes by phase ---------- */
function phaseBars(data) {
  // r.v is the sheet's variable, kept in Chinese in the data: 水 = water
  const phases = [
    { en: 'WATER · BENCHTOP', f: (r) => r.sc === 0 && r.v === '水' },
    { en: 'LIGHT · BENCHTOP', f: (r) => r.sc === 0 && r.v !== '水' },
    { en: 'BLUE LIGHT · HANDHELD', f: (r) => r.sc === 1 },
  ];
  const box = $('[data-phase-bars]');
  box.innerHTML = phases.map((ph) => {
    const rows = data.records.filter(ph.f);
    const c = {}; for (const r of rows) c[r.g] = (c[r.g] || 0) + 1;
    const segs = GROUP_ORDER.filter((g) => c[g]).map((g) => `<i style="flex:${c[g]};background:${GROUPS[g].color}"><b>${c[g]}</b></i>`).join('');
    return `<div class="pbar"><span>${ph.en}</span><div class="pbar-track" aria-label="${ph.en.toLowerCase()}: ${GROUP_ORDER.filter((g) => c[g]).map((g) => GROUPS[g].en.toLowerCase() + ' ' + c[g]).join(', ')}">${segs}</div><span>${rows.length}</span></div>`;
  }).join('');
  $('[data-legend-static]').innerHTML = GROUP_ORDER.map((g) => `<li><i style="background:${GROUPS[g].color}"></i>${GROUPS[g].en}</li>`).join('');
  if (!ctxReduced()) {
    const segs = $$('.pbar-track i', box);
    segs.forEach((s) => { s.style.transform = 'scaleX(0)'; });
    let done = false;
    visible(box, (v) => {
      if (!v || done) return; done = true;
      segs.forEach((s, i) => { s.style.transition = `transform 1.1s cubic-bezier(.2,.7,.1,1) ${i * 0.05}s`; requestAnimationFrame(() => { s.style.transform = 'scaleX(1)'; }); });
    });
  }
}
const ctxReduced = () => document.documentElement.classList.contains('no-motion');

/* ---------- microscope scrub ---------- */
function scope(data, reduced) {
  const sec = $('#scope');
  const cvs = $('.scope-canvas', sec);
  const g = cvs.getContext('2d');
  const timeEl = $('[data-scope-time]'), titleEl = $('[data-scope-title]'), enEl = $('[data-scope-en]');
  const notesEl = $('[data-scope-notes]'), head = $('[data-scope-head]'), ticksEl = $('[data-scope-ticks]'), magEl = $('[data-scope-mag]');
  // reticle ticks
  const rt = $('.r-ticks', sec); let s = '';
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r1 = 196, r2 = i % 5 ? 189 : 180; s += `<line x1="${200 + Math.cos(a) * r1}" y1="${200 + Math.sin(a) * r1}" x2="${200 + Math.cos(a) * r2}" y2="${200 + Math.sin(a) * r2}"/>`; }
  rt.innerHTML = s;
  const strips = data.strips;
  // English for the strips in site.json (whose own text is Chinese), by strip index; notes as the spreadsheet records them
  const STRIPS_EN = [
    { title: 'One stoma, from closed to open in 40 minutes', tag: 'PURPLE HEART · 500× · BLUE LIGHT', mag: '500×',
      notes: 'Spreadsheet: near 0% until about 17 min, about 30% at 19:30, about 55% at 25:25, then falling back. From 36 min the light changes and the picture turns green.' },
    { title: 'A second stoma on the same leaf', tag: 'PURPLE HEART · 500× · BLUE LIGHT', mag: '500×',
      notes: 'Same recording and same timepoints as the first strip.' },
    { title: 'A slow opening in a <span class="nw">60-minute</span> recording', tag: 'PURPLE HEART · 500× · BLUE LIGHT', mag: '500×',
      notes: 'Spreadsheet: about 0% at 0–13 min, 20–40% at 24–38 min, 40–100% at 38–46 min (striking). The light shifts at about 8 min, yellow to green.' },
    { title: 'Late to open, but striking', tag: 'PURPLE HEART · ≈700× · HANDHELD MICROSCOPE', mag: '≈700×',
      notes: 'Spreadsheet: slower to open and close, but striking; about 60% open from 47 to 61 min. The handheld microscope gives a softer picture.' },
  ];
  let cur = 2, imgs = [], prog = reduced ? 0.6 : 0;
  function load(i) {
    cur = i;
    const st = strips[i], en = STRIPS_EN[i] || { title: st.en, tag: '', mag: '500×', notes: '' };
    imgs = st.frames.map((f) => { const im = new Image(); im.decoding = 'async'; im.src = 'assets/' + f; im.onload = draw; return im; });
    if (STRIPS_EN[i]) titleEl.innerHTML = en.title; else titleEl.textContent = en.title;
    enEl.textContent = `${en.tag} · `;
    const dEl = document.createElement('span'); dEl.className = 'nw'; dEl.textContent = st.date; enEl.append(dEl);
    magEl.textContent = en.mag;
    notesEl.textContent = en.notes;
    const t0 = st.times[0], tN = st.times[st.times.length - 1];
    let lastL = -99;
    ticksEl.innerHTML = st.times.map((t, k) => {
      const x = (t - t0) / (tN - t0) * 100;
      const show = x - lastL > 9 && (k === st.times.length - 1 || x < 92 || k === st.times.length - 1);
      if (show) lastL = x;
      return `<span style="left:${x}%" data-l="${show ? st.labels[k] : ''}"></span>`;
    }).join('');
    $$('.scope-tabs button').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.strip === i)));
    draw();
  }
  function fit() {
    const r = cvs.getBoundingClientRect();
    const d = Math.min(2, devicePixelRatio || 1);
    cvs.width = Math.max(10, Math.round(r.width * d)); cvs.height = Math.max(10, Math.round(r.height * d));
    draw();
  }
  function drawImg(im, a, zoom) {
    if (!im || !im.complete || !im.naturalWidth) return;
    const W = cvs.width, H = cvs.height;
    const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom;
    const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    g.globalAlpha = a;
    g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }
  function draw() {
    const st = strips[cur]; if (!st) return;
    const n = imgs.length, f = clamp(prog) * (n - 1);
    const i = Math.min(n - 2, Math.floor(f)), k = f - i;
    g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, cvs.width, cvs.height);
    const zoom = 1.05 + prog * 0.12;
    drawImg(imgs[i], 1, zoom);
    drawImg(imgs[i + 1], k * k * (3 - 2 * k), zoom);
    g.globalAlpha = 1;
    // eyepiece vignette + lime rim
    const W = cvs.width, H = cvs.height, R = W / 2;
    const grd = g.createRadialGradient(R, R, R * 0.55, R, R, R);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.85, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const t = lerp(st.times[i], st.times[i + 1], k);
    timeEl.textContent = fmtMS(t);
    const t0 = st.times[0], tN = st.times[st.times.length - 1];
    head.style.left = `${(t - t0) / (tN - t0) * 100}%`;
  }
  $$('.scope-tabs button').forEach((b) => b.addEventListener('click', () => load(+b.dataset.strip)));
  // frames are fetched only when the microscope is about a screen and a half away
  let started = false;
  visible(sec, (on) => { if (on && !started) { started = true; load(cur); } }, '150% 0px 150% 0px');
  fit(); addEventListener('resize', fit);
  if (!reduced) track(sec, (p) => { prog = clamp((p - 0.06) / 0.88); draw(); }, 'pin');
  else {
    // reduced motion: a plain range slider replaces scroll scrubbing
    const r = document.createElement('input');
    r.type = 'range'; r.min = 0; r.max = 1000; r.value = 600; r.setAttribute('aria-label', 'Time in the recording');
    r.style.cssText = 'width:100%;margin-top:14px;accent-color:#c8ff40';
    r.addEventListener('input', () => { prog = r.value / 1000; draw(); });
    $('.scope-track', sec).after(r);
  }
}

/* ---------- lazy autoplay muted videos ---------- */
function lazyVideos(reduced) {
  // posters are lazy too: set from data-poster when the video is about a screen away
  for (const v of $$('video[data-poster]')) {
    visible(v, (on) => { if (on && !v.poster) v.poster = v.dataset.poster; }, '900px 900px 900px 900px');
  }
  const vids = $$('video[data-autoplay]');
  for (const v of vids) {
    v.muted = true; v.setAttribute('muted', '');
    if (reduced) {
      // no autoplay: tap to play
      v.addEventListener('click', () => { loadVideo(v); v.paused ? safePlay(v) : v.pause(); });
      v.style.cursor = 'pointer';
      continue;
    }
    visible(v, (on) => {
      if (on) { loadVideo(v); safePlay(v); } else if (!v.paused) v.pause();
    }, '200px 0px 200px 0px');
  }
  // explainer: wire the source near the viewport, but never preload the bytes
  for (const v of $$('video[data-sound-el]')) {
    visible(v, (on) => { if (on) loadVideo(v); }, '600px');
  }
}

/* ---------- collage parallax ---------- */
function collage(reduced) {
  if (reduced || mq.small) return;
  for (const el of $$('.cl[data-speed]')) {
    const sp = parseFloat(el.dataset.speed);
    const m = $('img, video', el);
    track(el, (p) => { el.style.transform = `translateY(${(p - 0.5) * sp * -600}px)`; if (m) m.style.transform = `scale(1.12) translateY(${(p - 0.5) * 30}px)`; }, 'pass');
  }
}

/* ---------- filmstrip ---------- */
function film(reduced) {
  // phones get a plain vertical list (see the 860px media query); the pinned strip clipped its text
  if (reduced || mq.small) return;
  const sec = $('#film'), trackEl = $('[data-film-track]'), bar = $('[data-film-bar]'), idx = $('[data-film-idx]');
  const frames = $$('.frame', trackEl);
  let width = 0;
  const m = () => { width = trackEl.scrollWidth - innerWidth; };
  m(); addEventListener('resize', m); setTimeout(m, 1200);
  let skew = 0, last = '';
  track(sec, (p) => {
    const e = clamp((p - 0.04) / 0.92);
    trackEl.style.transform = `translate3d(${-e * width}px,0,0)`;
    bar.style.transform = `scaleX(${e})`;
    const i = Math.round(e * (frames.length - 1));
    const v = frames[i] ? frames[i].dataset.v : '';
    if (v !== last) { last = v; idx.textContent = v; }
  }, 'pin');
  onFrame((t, dt) => {
    const target = clamp(-scroll.vel * 0.0035, -7, 7);
    skew = damp(skew, target, 6, dt);
    if (Math.abs(skew) > 0.01 || Math.abs(target) > 0.01) trackEl.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
  });
}

/* ---------- projector wall ---------- */
function wall(reduced) {
  const sec = $('#wall'), cvs = $('.dust', sec), g = cvs.getContext('2d');
  const vid = $('.wall-video', sec), btn = $('[data-wall-sound]'), label = $('[data-wall-label]');
  const parts = Array.from({ length: mq.small ? 60 : 140 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), s: Math.random() * 0.6 + 0.2, side: Math.random() < 0.5 ? 0 : 1 }));
  let on = false, W = 0, H = 0;
  const fit = () => { const r = cvs.getBoundingClientRect(); const d = Math.min(1.5, devicePixelRatio || 1); W = cvs.width = Math.round(r.width * d); H = cvs.height = Math.round(r.height * d); };
  fit(); addEventListener('resize', fit);
  visible(sec, (v) => { on = v; });
  if (!reduced) onFrame((t, dt) => {
    if (!on) return;
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y -= dt * 0.012 * p.s; p.x += Math.sin(t * 0.3 + p.z * 9) * dt * 0.004;
      if (p.y < 0.08) p.y = 0.95;
      // keep particles inside the two beams (cones from the projectors up to the wall)
      const by = p.y, cx = p.side ? 0.73 : 0.27;
      const spread = (1 - by) * 0.23 + 0.01;
      const x = cx + (p.x - 0.5) * 2 * spread;
      const a = (0.15 + 0.5 * p.z) * clamp((by - 0.08) * 4) * (0.6 + 0.4 * Math.sin(t * 2 + p.z * 20));
      g.fillStyle = p.side ? `rgba(160,255,210,${a})` : `rgba(255,170,240,${a})`;
      g.fillRect(x * W, by * H, 1.6 + p.z * 1.8, 1.6 + p.z * 1.8);
    }
  });
  let withSound = false;
  btn.addEventListener('click', () => {
    withSound = !withSound;
    loadVideo(vid);
    if (withSound) {
      vid.dataset.prev = vid.currentSrc;
      vid.pause();
      vid.removeAttribute('loop');
      vid.src = 'assets/works/showcase/dual-showcase-40s.mp4';
      vid.poster = 'assets/works/showcase/dual-showcase-40s-poster.webp';
      vid.muted = false; vid.volume = 1;
      vid.setAttribute('data-sound-el', '');
      document.dispatchEvent(new CustomEvent('sound:exclusive', { detail: 'video' }));
      safePlay(vid);
      label.firstChild.textContent = 'Back to the silent loop';
      btn.classList.add('is-on');
    } else revert();
  });
  function revert() {
    withSound = false;
    vid.pause(); vid.muted = true; vid.setAttribute('loop', '');
    vid.removeAttribute('data-sound-el');
    vid.src = 'assets/works/loops/dual-loop-01.mp4';
    vid.poster = 'assets/works/loops/dual-loop-01-poster.webp';
    safePlay(vid);
    label.firstChild.textContent = 'Play 40 seconds with sound';
    btn.classList.remove('is-on');
  }
  vid.addEventListener('ended', () => { if (withSound) revert(); });
  document.addEventListener('sound:exclusive', (e) => { if ((e.detail === 'engine' || e.detail === 'film') && withSound) revert(); });
}

/* ---------- videos with sound -> lightbox ---------- */
function soundVideos() {
  const lb = $('[data-lightbox]'), media = $('[data-lb-media]'), cap = $('[data-lb-cap]'), close = $('[data-lb-close]');
  let lastFocus = null;
  function open(src, poster, title) {
    lastFocus = document.activeElement;
    media.innerHTML = '';
    const v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.autoplay = true; v.src = src; if (poster) v.poster = poster;
    v.setAttribute('data-sound-el', '');
    media.appendChild(v);
    cap.textContent = title || '';
    lb.hidden = false;
    document.dispatchEvent(new CustomEvent('sound:exclusive', { detail: 'video' }));
    safePlay(v);
    // focus after this event turn: a keyboard Enter that opened the dialog must not also "click" Close
    requestAnimationFrame(() => { if (!lb.hidden) close.focus(); });
    if (window.__sc.lenis) window.__sc.lenis.stop();
  }
  function shut() {
    const v = $('video', media); if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    media.innerHTML = ''; lb.hidden = true;
    if (window.__sc.lenis) window.__sc.lenis.start();
    if (lastFocus) lastFocus.focus();
  }
  close.addEventListener('click', shut);
  lb.addEventListener('click', (e) => { if (e.target === lb) shut(); });
  for (const b of $$('[data-sound-video]')) b.addEventListener('click', () => open(b.dataset.soundVideo, b.dataset.poster, b.dataset.title));
  window.__sc.openVideo = open;
}

/* ---------- uncanny dark room ---------- */
function uncanny(data, reduced) {
  const showB = $('[data-uncanny-show]'), hideB = $('[data-uncanny-hide]'), room = $('#uncanny-room'), grid = $('[data-uncanny-grid]'), sec = $('#uncanny');
  const canWebm = document.createElement('video').canPlayType('video/webm; codecs="vp9"');
  function build() {
    grid.innerHTML = data.aigc.uncanny.map((it, i) => `
      <figure class="uc" tabindex="0" role="button" aria-label="Play: ${it.en}" data-id="${it.id}">
        <img src="assets/aigc/uncanny/${it.id}-800.webp" alt="${it.en} (AI-generated)" loading="lazy" decoding="async" width="800" height="451">
        <i>${String(i + 1).padStart(2, '0')}</i>
        <figcaption>${it.en}<br><span style="color:#8a8781">AIGC · 5 S · SILENT</span></figcaption>
      </figure>`).join('');
    for (const f of $$('.uc', grid)) {
      const play = () => {
        let v = $('video', f);
        if (!v) {
          v = document.createElement('video');
          v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
          v.src = `assets/aigc/uncanny/${f.dataset.id}${canWebm ? '-480.webm' : '.mp4'}`;
          f.insertBefore(v, f.firstChild.nextSibling);
        }
        f.classList.add('is-playing'); safePlay(v);
      };
      const stop = () => { const v = $('video', f); if (v) v.pause(); f.classList.remove('is-playing'); };
      if (!mq.coarse) { f.addEventListener('pointerenter', play); f.addEventListener('pointerleave', stop); }
      f.addEventListener('click', () => (f.classList.contains('is-playing') && mq.coarse ? stop() : play()));
      f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.classList.contains('is-playing') ? stop() : play(); } });
    }
  }
  showB.addEventListener('click', () => {
    build();
    room.hidden = false;
    sec.classList.add('is-open');
    room.classList.remove('is-lit'); void room.offsetWidth; room.classList.add('is-lit');
    showB.hidden = true; hideB.hidden = false;
    showB.setAttribute('aria-expanded', 'true');
    measure();
  });
  hideB.addEventListener('click', () => {
    for (const v of $$('video', grid)) v.pause();
    grid.innerHTML = ''; room.hidden = true; room.classList.remove('is-lit');
    sec.classList.remove('is-open');
    showB.hidden = false; hideB.hidden = true;
    showB.setAttribute('aria-expanded', 'false');
    showB.focus();
    measure();
  });
}

/* ---------- human dial: circular hours vs a straight sample line ---------- */
function dial(reduced) {
  const sec = $('#dial'); if (!sec) return;
  const svg = $('.dial', sec);
  const tk = $('.d-ticks', svg); let s = '';
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * Math.PI * 2, h = i % 4 === 0, h6 = i % 24 === 0;
    const r1 = 200, r2 = h6 ? 178 : h ? 188 : 194;
    s += `<line class="${h ? 'h6' : ''}" x1="${Math.sin(a) * r1}" y1="${-Math.cos(a) * r1}" x2="${Math.sin(a) * r2}" y2="${-Math.cos(a) * r2}"/>`;
  }
  tk.innerHTML = s;
  const sun = $('.d-sun', svg), arc = $('.d-arc', svg);
  const clock = $('[data-dial-clock]'), name = $('[data-dial-name]'), en = $('[data-dial-en]'), piece = $('[data-dial-piece]');
  const rows = $$('.drow', sec), samples = $('[data-dial-samples]'), line = $('[data-dial-line]');
  // hour of the dancer's day, and the section of the narrative table it belongs to
  const names = [['Genesis', 'GENERATION'], ['Noon', 'GENERATION'], ['Dusk', 'DIALOGUE'], ['Reset', 'FUSION']];
  // piece minutes -> hour of the dancer's day (piecewise, per the narrative table)
  const map = [[0, 0], [7, 12], [11, 18], [18, 24], [20, 24]];
  const hourAt = (m) => { for (let i = 1; i < map.length; i++) if (m <= map[i][0]) { const [a, ha] = map[i - 1], [b, hb] = map[i]; return ha + (hb - ha) * (m - a) / (b - a); } return 24; };
  let lastRow = -1;
  function set(p) {
    const min = p * 20;
    const hr = hourAt(min);
    const ang = hr / 24 * Math.PI * 2;
    sun.setAttribute('cx', (Math.sin(ang) * 200).toFixed(2));
    sun.setAttribute('cy', (-Math.cos(ang) * 200).toFixed(2));
    const large = ang > Math.PI ? 1 : 0;
    const ex = Math.sin(Math.min(ang, Math.PI * 2 - 0.0001)) * 200, ey = -Math.cos(Math.min(ang, Math.PI * 2 - 0.0001)) * 200;
    arc.setAttribute('d', hr <= 0.001 ? '' : `M0 -200 A200 200 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    const hh = Math.floor(hr % 24), mm = Math.floor((hr % 1) * 60);
    clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    piece.textContent = `PIECE ${fmtMS(min * 60)} / 20:00`;
    const row = min < 7 ? 0 : min < 11 ? 1 : min < 18 ? 2 : 3;
    if (row !== lastRow) {
      lastRow = row;
      rows.forEach((r, i) => r.classList.toggle('is-on', i === row));
      name.textContent = names[row][0]; en.textContent = names[row][1];
    }
    samples.textContent = fmtInt(p * 57600000);
    line.style.transform = `scaleX(${p})`;
  }
  if (reduced) { set(1); rows.forEach((r) => r.classList.add('is-on')); return; }
  set(0);
  track(sec, (p) => set(clamp((p - 0.05) / 0.9)), 'pin');
}

/* ---------- letter that can only be read once ---------- */
function letter(reduced) {
  const box = $('[data-readonce]'); if (!box) return;
  if (reduced) { document.documentElement.classList.add('no-readonce'); return; }
  // the read head moves word by word (spaces stay plain text so the lines wrap as usual)
  const cs = [];
  for (const p of $$('p', box)) {
    const txt = p.textContent; p.textContent = '';
    for (const part of txt.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { p.appendChild(document.createTextNode(part)); continue; }
      const s = document.createElement('span'); s.className = 'c'; s.textContent = part; p.appendChild(s); cs.push(s);
    }
  }
  const N = cs.length; let lastHead = 0;
  const WIN = 6;
  track($('#letter'), (p) => {
    const headF = clamp((p - 0.18) / 0.5) * (N + WIN);
    const head = Math.floor(headF);
    // the read head only moves forward: once read, it stays read
    if (head <= lastHead) return;
    for (let i = Math.max(0, lastHead - WIN - 1); i < Math.min(N, head + 1); i++) {
      const c = cs[i];
      const d = head - i;
      c.className = d < 0 ? 'c' : d === 0 ? 'c head' : d < WIN ? 'c on' : 'c read';
    }
    lastHead = head;
  }, 'pass');
}

/* ---------- echoes: AI side decodes into its misreading ---------- */
function echoes(reduced) {
  if (reduced) return;
  for (const el of $$('[data-scramble-in]')) {
    const txt = el.textContent; let done = false;
    el.style.minHeight = el.offsetHeight + 'px';
    visible(el, (v) => { if (v && !done) { done = true; scramble(el, txt, 1600); } }, '0px 0px -15% 0px');
  }
}

/* ---------- pipeline pulses ---------- */
function pipe(reduced) {
  const p = $('[data-pipe]'); if (!p || reduced || mq.small || !Element.prototype.animate) return;
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('i'); d.className = 'pulse'; p.appendChild(d);
    d.animate([{ left: '0%', opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { left: 'calc(100% - 70px)', opacity: 0 }],
      { duration: 4200, iterations: Infinity, delay: i * 1400, easing: 'linear' });
  }
}

/* ---------- footer read head ---------- */
function footer() {
  const f = $('.foot'), head = $('[data-foot-head]'), bar = $('.foot-read');
  track(f, (p) => { head.style.setProperty('--x', `${clamp(p / 0.7) * (bar.clientWidth - 2)}px`); }, 'pass');
}
