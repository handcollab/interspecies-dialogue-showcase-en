// AIGC gallery: an infinite, draggable WebGL arc of 28 clips that bend with velocity,
// split RGB as they fly, and ripple + come alive (video texture) under the cursor.
import { $, $$, clamp, lerp, damp, mq, onFrame, visible, safePlay } from './util.js';
import { AIGC_CATS } from './const.js';

const VS = `
uniform float uVel; uniform float uHover;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  float b = sin(uv.x * 3.14159);
  p.z += b * uVel * 0.55 + uHover * 0.22 * b;
  p.y += b * uVel * 0.04;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FS = `
uniform sampler2D uTex; uniform float uVel; uniform float uHover; uniform float uTime; uniform float uFocus; uniform vec2 uMouse;
varying vec2 vUv;
void main(){
  vec2 uv = (vUv - 0.5) * (1.0 - 0.06*uHover) + 0.5;
  vec2 d = uv - uMouse; float r = length(d * vec2(1.77, 1.0));
  uv += normalize(d + 1e-5) * sin(r*42.0 - uTime*6.0) * 0.006 * uHover * smoothstep(0.35, 0.0, r);
  float sh = abs(uVel)*0.018 + uHover*0.003;
  vec3 c = vec3(texture2D(uTex, uv + vec2(sh, 0.0)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(sh, 0.0)).b);
  float L = dot(c, vec3(0.299, 0.587, 0.114));
  float k = max(uFocus, uHover);
  c = mix(vec3(L)*0.55, c, 0.3 + 0.7*k) * (0.55 + 0.45*k);
  float e = smoothstep(0.0, 0.015, vUv.x)*smoothstep(1.0, 0.985, vUv.x)*smoothstep(0.0, 0.025, vUv.y)*smoothstep(1.0, 0.975, vUv.y);
  gl_FragColor = vec4(c*e, 1.0);
}`;

export async function initCarousel(data, { reduced }) {
  const box = $('[data-carousel]'), canvas = $('.carousel-canvas', box), dom = $('[data-carousel-dom]', box);
  const items = data.aigc.styled;
  const capCat = $('[data-cc-cat]'), capT = $('[data-cc-title]'), capEn = $('[data-cc-en]');
  const canWebm = !!document.createElement('video').canPlayType('video/webm; codecs="vp9"');
  const clipSrc = (it, small) => `assets/aigc/${it.cat}/${it.id}${small && canWebm ? '-480.webm' : '.mp4'}`;
  const setCap = (it) => { capCat.textContent = AIGC_CATS[it.cat].en; capT.textContent = it.en; capEn.textContent = `${String(items.indexOf(it) + 1).padStart(2, '0')} / ${items.length} · AIGC · 5 S · SILENT`; };
  setCap(items[0]);
  const thumb = (it) => `assets/aigc/${it.cat}/${it.id}-800.webp`;
  const openFull = (it) => window.__sc.openVideo && window.__sc.openVideo(clipSrc(it, false), thumb(it), `${AIGC_CATS[it.cat].en} · ${it.en} — AIGC, 5 s, silent`);

  // DOM fallback (touch devices, reduced motion, or no three.js)
  function buildDom() {
    box.classList.add('no-gl-carousel');
    dom.innerHTML = items.map((it, i) => `<div class="cc-item" role="listitem" data-i="${i}" tabindex="0"><img loading="lazy" decoding="async" src="${thumb(it)}" alt="${it.en} (frame from an AIGC animation)" width="800" height="451"><span>${AIGC_CATS[it.cat].en} · ${String(i + 1).padStart(2, '0')}</span></div>`).join('');
    const playIn = (el) => {
      if ($('video', el)) return;
      const it = items[+el.dataset.i];
      const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.src = clipSrc(it, true);
      el.appendChild(v); safePlay(v);
    };
    if (!reduced) {
      let pageOn = false;
      const inView = new Set();
      const sync = () => {
        for (const el of $$('.cc-item', dom)) {
          const v = $('video', el);
          if (pageOn && inView.has(el)) { playIn(el); const w = $('video', el); if (w && w.paused) safePlay(w); }
          else if (v && !v.paused) v.pause();
        }
      };
      const io = new IntersectionObserver((ents) => {
        for (const e of ents) {
          if (e.intersectionRatio > 0.6) { inView.add(e.target); setCap(items[+e.target.dataset.i]); } else inView.delete(e.target);
        }
        sync();
      }, { root: dom, threshold: [0, 0.6, 1] });
      $$('.cc-item', dom).forEach((el) => io.observe(el));
      visible(box, (on) => { pageOn = on; sync(); });
    }
    dom.addEventListener('click', (e) => { const el = e.target.closest('.cc-item'); if (el) { if (reduced) playIn(el); else openFull(items[+el.dataset.i]); } });
    $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      const i = items.findIndex((it) => it.cat === b.dataset.cat);
      const el = dom.children[i]; if (el) dom.scrollTo({ left: el.offsetLeft - (dom.clientWidth - el.clientWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
    }));
  }
  if (reduced || mq.coarse || document.documentElement.classList.contains('no-gl')) { buildDom(); return; }
  let THREE, renderer;
  try { THREE = await import('three'); } catch (e) { buildDom(); return; }
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { console.warn('carousel: no WebGL, DOM gallery instead', e); buildDom(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const loader = new THREE.TextureLoader();
  const H = 2.55, Wd = H * 1248 / 704, GAP = 0.32, STEP = Wd + GAP, TOTAL = STEP * items.length;
  const geo = new THREE.PlaneGeometry(Wd, H, 32, 1);
  const meshes = items.map((it, i) => {
    const tex = loader.load(thumb(it));
    tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS,
      uniforms: { uTex: { value: tex }, uVel: { value: 0 }, uHover: { value: 0 }, uTime: { value: 0 }, uFocus: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) } } });
    const m = new THREE.Mesh(geo, mat);
    m.userData = { i, it, poster: tex, video: null, vtex: null, hov: 0, idle: 0 };
    scene.add(m);
    return m;
  });
  function fit() {
    const r = box.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.position.z = camera.aspect < 1.2 ? 12.5 : 8.8;
    camera.updateProjectionMatrix();
  }
  fit(); addEventListener('resize', fit);

  const st = { off: 0, target: 0, vel: 0, drag: null, moved: 0, hover: -1, focus: -1, on: false };
  visible(box, (v) => { st.on = v; if (!v) meshes.forEach(stopVideo); }, '80px');
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(-9, -9);
  canvas.addEventListener('pointerdown', (e) => { st.drag = { x: e.clientX, t: st.target }; st.moved = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (st.drag) { const dx = e.clientX - st.drag.x; st.moved = Math.max(st.moved, Math.abs(dx)); st.target = st.drag.t - dx * 0.012; }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (st.drag && st.moved < 6 && st.hover >= 0) openFull(items[st.hover]);
    st.drag = null;
  });
  canvas.addEventListener('pointerleave', () => { ndc.set(-9, -9); });
  canvas.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); st.target += e.deltaX * 0.01; } }, { passive: false });
  // keyboard: arrow keys move one clip when the gallery is focused
  canvas.tabIndex = 0; canvas.removeAttribute('aria-hidden');
  canvas.setAttribute('role', 'region'); canvas.setAttribute('aria-roledescription', 'carousel');
  canvas.setAttribute('aria-label', 'AIGC animations: left and right arrow keys to move, Enter to open');
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Enter') e.preventDefault();
    if (e.key === 'ArrowRight') st.target = (Math.round(st.target / STEP) + 1) * STEP;
    else if (e.key === 'ArrowLeft') st.target = (Math.round(st.target / STEP) - 1) * STEP;
    else if (e.key === 'Enter' && !e.repeat && st.focus >= 0) openFull(items[st.focus]);
  });
  $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    const i = items.findIndex((it) => it.cat === b.dataset.cat);
    const curI = Math.round(st.target / STEP);
    const base = curI - (((curI % items.length) + items.length) % items.length);
    st.target = (base + i) * STEP;
    $$('[data-cat]').forEach((x) => x.classList.toggle('is-on', x === b));
  }));

  function startVideo(m) {
    const u = m.userData;
    u.idle = 0;
    if (!u.video) {
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
      v.src = clipSrc(u.it, true);
      u.video = v;
      u.vtex = new THREE.VideoTexture(v);
      u.vtex.minFilter = THREE.LinearFilter; u.vtex.generateMipmaps = false;
      v.addEventListener('playing', () => { if (u.video === v) m.material.uniforms.uTex.value = u.vtex; }, { once: true });
    }
    if (u.video.paused) safePlay(u.video);
  }
  function stopVideo(m) {
    const u = m.userData;
    if (!u.video) return;
    u.video.pause();
    m.material.uniforms.uTex.value = u.poster;
    u.vtex.dispose(); u.video.removeAttribute('src'); u.video.load();
    u.video = null; u.vtex = null;
  }
  let time = 0;
  onFrame((t, dt) => {
    if (!st.on) return;
    time += dt;
    if (!st.drag && st.hover < 0) st.target += dt * 0.12;
    const prev = st.off;
    st.off = damp(st.off, st.target, 5, dt);
    st.vel = damp(st.vel, (st.off - prev) / Math.max(dt, 1e-3), 8, dt);
    const v = clamp(st.vel * 0.12, -1.2, 1.2);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(meshes, false);
    const hov = hits.length ? hits[0].object.userData.i : -1;
    st.hover = hov;
    let bestD = 1e9, focus = -1;
    for (const m of meshes) {
      const u = m.userData;
      let x = u.i * STEP - st.off;
      x = ((x % TOTAL) + TOTAL * 1.5) % TOTAL - TOTAL / 2;
      const z = -x * x * 0.085;
      m.position.set(x, 0, z);
      m.rotation.y = -x * 0.085;
      m.visible = Math.abs(x) < 16;
      const ad = Math.abs(x);
      if (ad < bestD) { bestD = ad; focus = u.i; }
      const isH = u.i === hov;
      u.hov = damp(u.hov, isH ? 1 : 0, 8, dt);
      const U = m.material.uniforms;
      U.uHover.value = u.hov; U.uVel.value = v; U.uTime.value = time;
      U.uFocus.value = damp(U.uFocus.value, ad < STEP * 0.5 ? 1 : 0, 5, dt);
      if (isH && hits[0].uv) U.uMouse.value.copy(hits[0].uv);
      const s = 1 + u.hov * 0.06;
      m.scale.set(s, s, 1);
    }
    if (focus !== st.focus) { st.focus = focus; setCap(items[focus]); }
    for (const m of meshes) {
      const u = m.userData;
      const want = m.visible && (u.i === st.focus || u.i === hov);
      if (want) startVideo(m);
      else if (u.video) { u.idle += dt; if (u.idle > 1.2) stopVideo(m); }
    }
    renderer.render(scene, camera);
  });
}
