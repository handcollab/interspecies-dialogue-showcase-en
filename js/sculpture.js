// the 200 curated segments as 200 breathing stomata in 3D (three.js, one instanced draw call).
import * as THREE from 'three';
import { $, $$, clamp, damp, mq, onFrame, visible } from './util.js';
import { GROUPS, GROUP_ORDER, PLANTS_DISPLAY, PLANTS_SHORT, methodEn } from './const.js';

const VS = `
attribute vec3 aPos; attribute vec3 aColor; attribute float aAp; attribute float aSize; attribute float aPhase; attribute float aHi; attribute float aHov;
uniform float uScale;
varying vec2 vUv; varying vec3 vCol; varying float vAp; varying float vHi; varying float vHov; varying float vPh;
void main(){
  vUv = uv; vCol = aColor; vAp = aAp; vHi = aHi; vHov = aHov; vPh = aPhase;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  float s = aSize * uScale * (0.4 + 0.6*aHi) * (1.0 + 0.7*aHov) * smoothstep(3.0, 11.0, -mv.z);
  mv.xy += position.xy * s * vec2(1.6, 1.0);
  gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform float uTime;
varying vec2 vUv; varying vec3 vCol; varying float vAp; varying float vHi; varying float vHov; varying float vPh;
void main(){
  vec2 p = (vUv - 0.5) * vec2(1.6, 1.0) * 2.0;
  float br = 0.5 + 0.5*sin(uTime*(0.7 + vPh*0.6) + vPh*6.2831);
  float ap = vAp * (0.5 + 0.5*br);
  float e = length(p / vec2(1.22, 0.76));
  float ep = length(p / vec2(0.74, 0.035 + 0.4*ap));
  float guard = 1.0 - smoothstep(0.84, 1.0, e);
  float pore = 1.0 - smoothstep(0.7, 1.0, ep);
  float rim = exp(-pow((ep - 1.0)*2.8, 2.0)) * guard;
  float halo = exp(-e*e*1.4);
  vec3 col = vCol * (guard*(0.28 + 0.55*sqrt(max(0.0, 1.0 - e*e))) + rim*0.85);
  col *= 1.0 - pore*0.85;
  col += vCol * pore * ap * 1.1;
  col += vCol * halo * (0.08 + ap*0.38);
  col += vec3(1.0) * vHov * (rim*0.9 + halo*0.25);
  float a = clamp(guard*0.9 + halo*0.45, 0.0, 1.0) * (0.06 + 0.94*vHi);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
}`;

export function initSculpture(data, { reduced }) {
  const stage = $('[data-sculpt-stage]'), canvas = $('.sculpt-canvas', stage), labelsEl = $('.sculpt-labels', stage);
  const tip = $('[data-tip]'), countEl = $('[data-sculpt-count]'), legend = $('[data-legend-live]');
  const recs = data.records, N = recs.length;
  const notesEn = data.notesEn || {}; // English renderings of the lab notes, by record id (data/notes-en.json)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mq.small ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070708, 0.018);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);

  // ---- data prep ----
  const D0 = Date.UTC(2025, 11, 10);
  const dayOf = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - D0) / 864e5); };
  const byDay = new Map();
  recs.forEach((r, i) => { r._day = dayOf(r.d); r._dow = new Date(r.d + 'T00:00:00Z').getUTCDay(); if (!byDay.has(r._day)) byDay.set(r._day, []); byDay.get(r._day).push(i); });
  recs.forEach((r) => { r._j = byDay.get(r._day).indexOf(recs.indexOf(r)); });
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const MAXD = days[days.length - 1];

  // ---- geometry ----
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index; geo.setAttribute('position', base.getAttribute('position')); geo.setAttribute('uv', base.getAttribute('uv'));
  geo.instanceCount = N;
  const aPos = new Float32Array(N * 3), aColor = new Float32Array(N * 3), aAp = new Float32Array(N), aSize = new Float32Array(N), aPhase = new Float32Array(N), aHi = new Float32Array(N).fill(1), aHov = new Float32Array(N);
  const col = new THREE.Color();
  recs.forEach((r, i) => {
    col.set(GROUPS[r.g].color); aColor.set([col.r, col.g, col.b], i * 3);
    aAp[i] = GROUPS[r.g].ap;
    aSize[i] = r.h == null ? 0.8 : 0.5 + (r.h - 38) / 28 * 0.85;
    aPhase[i] = Math.random();
  });
  const mk = (arr, n, dyn) => { const a = new THREE.InstancedBufferAttribute(arr, n); if (dyn) a.setUsage(THREE.DynamicDrawUsage); return a; };
  const attr = { pos: mk(aPos, 3, true), hi: mk(aHi, 1, true), hov: mk(aHov, 1, true) };
  geo.setAttribute('aPos', attr.pos); geo.setAttribute('aColor', mk(aColor, 3)); geo.setAttribute('aAp', mk(aAp, 1));
  geo.setAttribute('aSize', mk(aSize, 1)); geo.setAttribute('aPhase', mk(aPhase, 1)); geo.setAttribute('aHi', attr.hi); geo.setAttribute('aHov', attr.hov);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: 0.62 } } });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // dust for depth
  const dn = 700, dpos = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) { dpos[i * 3] = (Math.random() - 0.5) * 70; dpos[i * 3 + 1] = (Math.random() - 0.5) * 40; dpos[i * 3 + 2] = (Math.random() - 0.5) * 70; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0x7eb8ff, size: 0.06, transparent: true, opacity: 0.35, depthWrite: false }));
  scene.add(dust);

  // guide lines per layout
  const guideMat = new THREE.LineBasicMaterial({ color: 0x8a8781, transparent: true, opacity: 0 });
  let guide = null;

  // ---- layouts ----
  const fib = (j, n, R) => { // point j of n on a sphere of radius R
    const y = 1 - (j + 0.5) / n * 2, r = Math.sqrt(1 - y * y), th = j * 2.39996;
    return [Math.cos(th) * r * R, y * R, Math.sin(th) * r * R];
  };
  const L = {
    spiral() {
      const out = new Float32Array(N * 3), lab = [], gl = [];
      const P = (day) => { const a = day / MAXD * Math.PI * 2.25 - Math.PI * 0.5, R = 5.5 + day * 0.07; return [Math.cos(a) * R, (day / MAXD - 0.5) * 9, Math.sin(a) * R]; };
      recs.forEach((r, i) => {
        const [x, y, z] = P(r._day); const j = r._j, rr = 0.42 * Math.sqrt(j), th = j * 2.39996;
        out.set([x + Math.cos(th) * rr, y + Math.sin(th) * rr * 0.6, z + Math.sin(th) * rr], i * 3);
      });
      for (let d = 0; d <= MAXD; d += 0.5) gl.push(...P(d));
      for (const [d, t] of [[0, '2025-12-10 <b>WATER</b>'], [28, '2026-01-07 <b>BLUE LIGHT</b>'], [54, '2026-02-02 <b>HANDHELD</b>'], [63, '2026-02-11']]) { const p = P(d); lab.push([p[0], p[1] + 1.4, p[2], t]); }
      return { out, lab, line: gl, dist: 24, look: [0, 0, 0], spin: true };
    },
    calendar() {
      const out = new Float32Array(N * 3), lab = [], seg = [];
      const off = new Date(Date.UTC(2025, 11, 10)).getUTCDay();
      const W = (day) => Math.floor((day + off) / 7);
      recs.forEach((r, i) => { const w = W(r._day); out.set([(w - 4.5) * 2.3, -3 + r._j * 0.62, (r._dow - 3) * 2.3], i * 3); });
      for (let w = 0; w <= 9; w++) for (let d = 0; d < 7; d++) { const x = (w - 4.5) * 2.3, z = (d - 3) * 2.3; seg.push(x - 0.8, -3.5, z, x + 0.8, -3.5, z); }
      const dn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      for (let d = 0; d < 7; d++) lab.push([(-1 - 4.5) * 2.3, -3.5, (d - 3) * 2.3, dn[d]]);
      for (const [w, t] of [[0, 'DEC'], [4, 'JAN'], [8, 'FEB']]) lab.push([(w - 4.5) * 2.3, -3.6, 4.5 * 2.3 / 1.3 + 2, t]);
      return { out, lab, seg, dist: 27, look: [0, -0.5, 0], spin: true };
    },
    outcome() {
      const out = new Float32Array(N * 3), lab = [];
      GROUP_ORDER.forEach((g, gi) => {
        const idx = recs.map((r, i) => (r.g === g ? i : -1)).filter((i) => i >= 0);
        const R = 0.9 * Math.cbrt(idx.length) + 0.3, cx = (gi - 2) * 5.6;
        idx.forEach((i, j) => { const [x, y, z] = fib(j, idx.length, R); out.set([cx + x, y, z], i * 3); });
        lab.push([cx, -R - 1.4, 0, `${GROUPS[g].en.toUpperCase()} <b>${idx.length}</b>`]);
      });
      return { out, lab, dist: 27, look: [0, 0, 0], th: 0, ph: 1.25 };
    },
    plant() {
      const out = new Float32Array(N * 3), lab = [];
      [0, 1, 2, 3].forEach((p, pi) => {
        const idx = recs.map((r, i) => (r.p === p ? i : -1)).filter((i) => i >= 0);
        idx.sort((a, b) => GROUP_ORDER.indexOf(recs[a].g) - GROUP_ORDER.indexOf(recs[b].g));
        const R = 1.0 * Math.cbrt(idx.length) + 0.2, cx = [-7.5, 0.5, 6.8, 10.6][pi];
        idx.forEach((i, j) => { const [x, y, z] = fib(j, idx.length, R); out.set([cx + x, y, z], i * 3); });
        lab.push([cx, -R - 1.3, 0, `${PLANTS_SHORT[p]} <b>${idx.length}</b>`]);
      });
      return { out, lab, dist: 28, look: [1.2, 0, 0], th: 0, ph: 1.2 };
    },
    climate() {
      const out = new Float32Array(N * 3), lab = [], seg = [];
      const tx = (t) => (t - 24.5) * 2.4, hy = (h) => (h - 52) * 0.3, dz = (d) => (d / MAXD - 0.5) * 12;
      recs.forEach((r, i) => {
        if (r.t == null || r.h == null) out.set([-10, 4 + r._j * 0.5, dz(r._day)], i * 3);
        else out.set([tx(r.t) + (Math.random() - 0.5) * 0.5, hy(r.h) + (Math.random() - 0.5) * 0.2, dz(r._day)], i * 3);
      });
      const x0 = tx(21.5), x1 = tx(27.5), y0 = hy(36), y1 = hy(68), z0 = dz(0), z1 = dz(MAXD);
      seg.push(x0, y0, z0, x1, y0, z0, x0, y0, z0, x0, y1, z0, x0, y0, z0, x0, y0, z1);
      for (let t = 22; t <= 27; t++) { seg.push(tx(t), y0, z0, tx(t), y0 - 0.25, z0); lab.push([tx(t), y0 - 0.9, z0, `${t}°C`]); }
      for (const h of [40, 50, 60]) lab.push([x0 - 1.1, hy(h), z0, `${h}%`]);
      lab.push([x1 + 1.8, y0, z0, 'TEMPERATURE']); lab.push([x0, y1 + 0.8, z0, 'HUMIDITY']); lab.push([x0, y0, z1 + 1.2, 'DATE →']);
      lab.push([-10, 3, 0, 'NOT RECORDED']);
      return { out, lab, seg, dist: 26, look: [-1, 0, 0], th: 0.45, ph: 1.3 };
    },
  };

  // ---- state ----
  const cur = new Float32Array(N * 3), from = new Float32Array(N * 3);
  let layout = L.spiral(), t0 = -10, labels = [];
  // start scattered so the first reveal is a morph
  for (let i = 0; i < N * 3; i++) cur[i] = (Math.random() - 0.5) * 16;
  const cam = { th: 0.6, ph: 0.95, dist: layout.dist, tdist: layout.dist, vth: 0, look: new THREE.Vector3(), tlook: new THREE.Vector3() };
  const filt = { plant: -1, stim: '', scope: -1, off: new Set() };
  const hiT = new Float32Array(N).fill(1);
  let hover = -1, time = 0, lastDrag = -10;
  function setLabels(lab) {
    labelsEl.innerHTML = lab.map((l) => `<span>${l[3]}</span>`).join('');
    labels = lab.map((l, i) => ({ v: new THREE.Vector3(l[0], l[1], l[2]), el: labelsEl.children[i], w: 0 }));
  }
  function setGuide(lay) {
    if (guide) { scene.remove(guide); guide.geometry.dispose(); }
    guide = null;
    const pts = lay.line || lay.seg; if (!pts) return;
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    guide = lay.line ? new THREE.Line(gg, guideMat) : new THREE.LineSegments(gg, guideMat);
    guideMat.opacity = 0;
    scene.add(guide);
  }
  function go(name) {
    layout = L[name]();
    from.set(cur); t0 = time;
    cam.tdist = layout.dist * (mq.small ? 1.35 : 1); cam.tlook.set(...layout.look);
    if (name === 'calendar') cam.ph = Math.min(cam.ph, 0.85);
    if (!layout.spin) { // bring the camera round to the readable side, the shortest way
      const tau = Math.PI * 2;
      cam.th = ((cam.th % tau) + tau) % tau; if (cam.th - layout.th > Math.PI) cam.th -= tau;
    }
    setLabels(layout.lab); setGuide(layout);
    $$('[data-layout]').forEach((b) => b.classList.toggle('is-on', b.dataset.layout === name));
  }
  function refilter() {
    let n = 0; const cnt = {};
    recs.forEach((r, i) => {
      const ok = (filt.plant < 0 || r.p === filt.plant) && (!filt.stim || r.st === filt.stim) && (filt.scope < 0 || r.sc === filt.scope) && !filt.off.has(r.g);
      hiT[i] = ok ? 1 : 0;
      if (ok) { n++; cnt[r.g] = (cnt[r.g] || 0) + 1; }
    });
    countEl.textContent = `Showing ${n} / ${N} segments`;
    legend.innerHTML = GROUP_ORDER.map((g) => `<li data-g="${g}" class="${filt.off.has(g) ? 'is-off' : ''}" role="button" tabindex="0" aria-pressed="${!filt.off.has(g)}"><i style="background:${GROUPS[g].color}"></i>${GROUPS[g].en} <b>${cnt[g] || 0}</b></li>`).join('');
  }
  legend.addEventListener('click', (e) => { const li = e.target.closest('li'); if (!li) return; const g = li.dataset.g; filt.off.has(g) ? filt.off.delete(g) : filt.off.add(g); refilter(); });
  legend.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } });
  const pills = (attr, fn) => $$(`[${attr}]`).forEach((b) => b.addEventListener('click', () => { $$(`[${attr}]`).forEach((x) => x.classList.toggle('is-on', x === b)); fn(b.getAttribute(attr)); refilter(); }));
  pills('data-f-plant', (v) => { filt.plant = +v; });
  pills('data-f-stim', (v) => { filt.stim = v; });
  pills('data-f-scope', (v) => { filt.scope = +v; });
  $$('[data-layout]').forEach((b) => b.addEventListener('click', () => go(b.dataset.layout)));
  refilter(); go('spiral');

  // ---- interaction ----
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, th: cam.th, ph: cam.ph, moved: 0 }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); });
  addEventListener('pointerup', () => { drag = null; });
  const mouse = { x: -1, y: -1 };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      cam.th = drag.th - dx * 0.006;
      if (e.pointerType !== 'touch') cam.ph = clamp(drag.ph - dy * 0.005, 0.12, 1.5);
      cam.vth = 0;
    }
    pick(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => { mouse.x = -1; hover = -1; tip.hidden = true; });
  const v3 = new THREE.Vector3();
  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect();
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) {
      if (hiT[i] < 0.5) continue;
      v3.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]).project(camera);
      if (v3.z > 1) continue;
      const sx = (v3.x * 0.5 + 0.5) * r.width, sy = (-v3.y * 0.5 + 0.5) * r.height;
      const d = Math.hypot(sx - mouse.x, sy - mouse.y);
      if (d < bd) { bd = d; best = i; }
    }
    hover = bd < 16 ? best : -1;
    if (hover >= 0) {
      const rec = recs[hover], G = GROUPS[rec.g];
      tip.style.borderLeftColor = G.color;
      tip.innerHTML = `<span class="t-h">#${String(rec.id).padStart(3, '0')} · ${rec.d}<span class="t-o" style="background:${G.color}">${G.en.toUpperCase()}</span></span>`
        + `<b>${PLANTS_DISPLAY[rec.p]}</b> · ${rec.sc ? 'Dino-Lite handheld' : 'MICROTECH benchtop'} · ${rec.ma ? '≈' : ''}${rec.m}×<br>`
        + `stimulus <b>${methodEn(rec.me)}</b>${rec.h != null ? ` · humidity <b>${rec.h}%</b>` : ''}${rec.t != null ? ` · <b>${rec.t}°C</b>` : ''}${rec.y ? ` · annotation #${rec.y}` : ''}`
        + (rec.n ? `<span class="t-n">“${escapeHtml(notesEn[rec.id] || rec.n)}”${notesEn[rec.id] ? '<small>NOTE, TRANSLATED</small>' : ''}</span>` : '<span class="t-n" style="color:#8a8781">(no note)</span>');
      tip.hidden = false;
      const tx = Math.min(innerWidth - tip.offsetWidth - 12, cx + 18), ty = Math.min(innerHeight - tip.offsetHeight - 12, cy + 18);
      tip.style.left = `${tx}px`; tip.style.top = `${ty}px`;
    } else tip.hidden = true;
  }
  canvas.addEventListener('click', (e) => { if (mq.coarse) { pick(e.clientX, e.clientY); clearTimeout(tip._t); tip._t = setTimeout(() => { tip.hidden = true; }, 3500); } });

  // ---- size / visibility ----
  function fit() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
  }
  fit(); addEventListener('resize', fit);
  let on = false;
  visible(stage, (v) => { on = v; if (!v) tip.hidden = true; }, '100px');

  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  onFrame((t, dt) => {
    if (!on) return;
    time += dt;
    mat.uniforms.uTime.value = reduced ? 0 : time;
    // morph with a per-instance stagger and an arc through space
    const tgt = layout.out;
    for (let i = 0; i < N; i++) {
      const k = reduced ? 1 : clamp((time - t0 - (i / N) * 0.7) / 1.1);
      const e = ease(k), lift = Math.sin(k * Math.PI) * 1.8;
      const o = i * 3;
      cur[o] = from[o] + (tgt[o] - from[o]) * e;
      cur[o + 1] = from[o + 1] + (tgt[o + 1] - from[o + 1]) * e + lift;
      cur[o + 2] = from[o + 2] + (tgt[o + 2] - from[o + 2]) * e;
      aHi[i] = damp(aHi[i], hiT[i], 6, dt);
      aHov[i] = damp(aHov[i], i === hover ? 1 : 0, 10, dt);
    }
    aPos.set(cur); attr.pos.needsUpdate = true; attr.hi.needsUpdate = true; attr.hov.needsUpdate = true;
    if (drag) lastDrag = time;
    if (!drag && !reduced && time - lastDrag > 4) {
      if (layout.spin) cam.th += dt * 0.07;
      else { cam.th = damp(cam.th, layout.th + Math.sin(time * 0.25) * 0.3, 1.4, dt); cam.ph = damp(cam.ph, layout.ph, 1.4, dt); }
    }
    cam.dist = damp(cam.dist, cam.tdist, 2.5, dt);
    cam.look.lerp(cam.tlook, 1 - Math.exp(-3 * dt));
    camera.position.set(cam.look.x + Math.sin(cam.th) * Math.sin(cam.ph) * cam.dist, cam.look.y + Math.cos(cam.ph) * cam.dist, cam.look.z + Math.cos(cam.th) * Math.sin(cam.ph) * cam.dist);
    camera.lookAt(cam.look);
    guideMat.opacity = damp(guideMat.opacity, 0.35, 2, dt);
    dust.rotation.y += dt * 0.01;
    renderer.render(scene, camera);
    // project labels
    const r = canvas.clientWidth, h = canvas.clientHeight;
    for (const l of labels) {
      v3.copy(l.v).project(camera);
      const vis = v3.z < 1;
      l.el.style.opacity = vis ? '1' : '0';
      // English labels are long: keep each one inside the stage (width measured once, labels are centred on their point)
      if (!l.w) l.w = l.el.offsetWidth;
      const x = (v3.x * 0.5 + 0.5) * r, half = l.w / 2 + 6;
      l.el.style.left = `${half * 2 < r ? clamp(x, half, r - half) : x}px`; l.el.style.top = `${(-v3.y * 0.5 + 0.5) * h}px`;
    }
    if (hover >= 0 && !drag && mouse.x >= 0 && Math.random() < 0.2) { /* keep tooltip anchored while orbiting */ }
  });
  window.__sc.sculpture = { go, renderer, screenOf(i) {
    const r = canvas.getBoundingClientRect();
    v3.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]).project(camera);
    return [r.left + (v3.x * 0.5 + 0.5) * r.width, r.top + (-v3.y * 0.5 + 0.5) * r.height];
  } };
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
