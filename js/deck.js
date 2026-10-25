// Sound deck: track list, seek bar with peaks, movement markers, and a live
// three.js visualiser — a spectral terrain under a giant stoma whose pore opens with the bass.
import { $, $$, clamp, lerp, damp, mq, onFrame, visible, fmtTime, toast } from './util.js';
import { TRACKS } from './audio.js';

export async function initDeck({ engine, reduced, startListening }) {
  const list = $('[data-tracks]');
  list.innerHTML = TRACKS.map((t, i) => `<li data-id="${t.id}"><button><span class="t-n">${String(i + 1).padStart(2, '0')}</span><span class="t-t">${t.title}<small>${t.sub}</small></span><span class="t-d">${fmtTime(t.dur)}</span></button></li>`).join('');
  list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) startListening(li.dataset.id); });
  for (const b of $$('[data-play-track]')) b.addEventListener('click', () => startListening(b.dataset.playTrack));
  const playAt = (s) => { engine.select('one-pass-read-full-600s', true, s); $('.dock').classList.add('is-shown'); };
  for (const b of $$('[data-play-at]')) b.addEventListener('click', () => playAt(+b.dataset.playAt));
  for (const b of $$('[data-seekto]')) b.addEventListener('click', () => playAt(+b.dataset.seekto));
  const tog = $('[data-deck-toggle]'), tLabel = $('[data-deck-label]');
  tog.addEventListener('click', () => { if (!engine.track) startListening(); else engine.toggle(); });
  const nowT = $('[data-now-title]'), nowM = $('[data-now-meta]');
  const sync = () => {
    const t = engine.track;
    nowT.textContent = t ? t.title : '—';
    nowM.textContent = t ? `${t.sub} · ${t.meta}` : 'Press play, and the picture grows with the sound';
    $$('li', list).forEach((li) => li.classList.toggle('is-current', !!t && li.dataset.id === t.id));
    $$('.piece').forEach((p) => p.classList.toggle('is-current', !!t && p.dataset.playTrack === t.id));
    tLabel.firstChild.textContent = engine.playing ? 'Pause' : 'Play';
    tLabel.querySelector('small').textContent = engine.playing ? 'NOW PLAYING' : t ? 'PAUSED' : 'SOUND OFF';
    tog.classList.toggle('is-on', engine.playing);
    drawSeek();
    marks();
  };
  ['track', 'play', 'pause', 'peaks'].forEach((ev) => engine.addEventListener(ev, sync));

  // ---- seek ----
  const seek = $('[data-seek]'), scv = $('.seek-canvas', seek), sg = scv.getContext('2d'), head = $('[data-seek-head]');
  const cur = $('[data-cur]'), dur = $('[data-dur]'), marksEl = $('[data-seek-marks]');
  function drawSeek() {
    const r = scv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    scv.width = Math.max(10, r.width * d); scv.height = Math.max(10, r.height * d);
    const W = scv.width, H = scv.height;
    sg.clearRect(0, 0, W, H);
    const pk = engine.track && engine.peaks[engine.track.id];
    const n = pk ? pk.peaks.length : 200;
    const prog = engine.el.duration ? engine.el.currentTime / engine.el.duration : 0;
    for (let i = 0; i < n; i++) {
      const v = pk ? Math.max(0.02, pk.peaks[i]) : 0.03, rm = pk ? pk.rms[i] : 0.02;
      const x = i / n * W, w = Math.max(1, W / n - 1 * d);
      const played = i / n < prog;
      sg.fillStyle = played ? 'rgba(200,255,64,.85)' : 'rgba(216,213,208,.22)';
      sg.fillRect(x, H / 2 - v * H * 0.48, w, v * H * 0.96);
      sg.fillStyle = played ? 'rgba(200,255,64,1)' : 'rgba(216,213,208,.4)';
      sg.fillRect(x, H / 2 - rm * H * 0.48, w, rm * H * 0.96);
    }
  }
  function marks() {
    const t = engine.track;
    if (t && t.opr) marksEl.innerHTML = [[73, 'II'], [167, 'III'], [283, 'IV'], [433, 'V'], [509, '509 s']].map(([s, l]) => `<span class="${s === 509 ? 'm509' : ''}" style="left:${s / 600 * 100}%">${l}</span>`).join('');
    else marksEl.innerHTML = '';
  }
  let seeking = false;
  const seekTo = (e) => { const r = seek.getBoundingClientRect(); engine.seek((e.clientX - r.left) / r.width); };
  seek.addEventListener('pointerdown', (e) => { if (!engine.track) return; seeking = true; seek.setPointerCapture(e.pointerId); seekTo(e); });
  seek.addEventListener('pointermove', (e) => { if (seeking) seekTo(e); });
  seek.addEventListener('pointerup', () => { seeking = false; });
  seek.addEventListener('keydown', (e) => {
    if (!engine.el.duration) return;
    if (e.key === 'ArrowRight') engine.el.currentTime += 5; else if (e.key === 'ArrowLeft') engine.el.currentTime -= 5; else if (e.key === ' ') { e.preventDefault(); engine.toggle(); }
  });
  addEventListener('resize', drawSeek);
  sync();
  let lastDraw = 0;
  const mvHead = $('[data-mv-head]');
  onFrame((t) => {
    const el = engine.el, D = el.duration || (engine.track ? engine.track.dur : 0);
    const p = D ? el.currentTime / D : 0;
    head.style.left = `${p * 100}%`;
    seek.setAttribute('aria-valuenow', String(Math.round(p * 100)));
    seek.setAttribute('aria-valuetext', `${fmtTime(el.currentTime)} / ${fmtTime(D)}`);
    cur.textContent = fmtTime(el.currentTime); dur.textContent = fmtTime(D);
    if (engine.playing && t - lastDraw > 0.5) { lastDraw = t; drawSeek(); }
    const isOpr = engine.track && engine.track.opr;
    mvHead.classList.toggle('is-on', !!isOpr);
    if (isOpr) mvHead.style.left = `${p * 100}%`;
  });

  // ---- static waveforms on the four piece cards ----
  for (const c of $$('.pc-wave')) {
    const id = c.dataset.peaks;
    engine.loadPeaks(id).then((pk) => {
      if (!pk) return;
      const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      c.width = Math.max(10, r.width * d); c.height = Math.max(10, r.height * d);
      const g = c.getContext('2d'), W = c.width, H = c.height, n = pk.peaks.length;
      for (let i = 0; i < n; i++) {
        const v = pk.peaks[i];
        g.fillStyle = `rgba(126,184,255,${0.25 + v * 0.6})`;
        g.fillRect(i / n * W, H - v * H, Math.max(1, W / n - 0.5), v * H);
      }
    });
  }

  // ---- visualiser ----
  const stage = $('.deck-stage'), canvas = $('.viz-canvas');
  let on = false;
  visible(stage, (v) => { on = v; }, '50px');
  try {
    if (document.documentElement.classList.contains('no-gl')) throw new Error('no WebGL');
    const THREE = await import('three');
    threeViz(THREE, canvas, stage, engine, () => on, reduced);
  } catch (e) {
    console.warn('three unavailable, 2D visualiser', e);
    flatViz(canvas, engine, () => on);
  }
}

function threeViz(THREE, canvas, stage, engine, isOn, reduced) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mq.small ? 1.25 : 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05060a, 14, 46);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 3.6, 12.5);

  // terrain
  const BX = 128, RZ = 72, Wd = 30, Dp = 34;
  const geo = new THREE.PlaneGeometry(Wd, Dp, BX - 1, RZ - 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -Dp / 2 + 6);
  const pos = geo.attributes.position;
  const rowAttr = new Float32Array(BX * RZ);
  for (let r = 0; r < RZ; r++) for (let b = 0; b < BX; b++) rowAttr[r * BX + b] = r;
  geo.setAttribute('aRow', new THREE.BufferAttribute(rowAttr, 1));
  const tmat = new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLvl: { value: 0 } }]),
    vertexShader: `
      attribute float aRow; varying float vRow; varying float vH; varying float vX;
      #include <fog_pars_vertex>
      void main(){ vRow = aRow; vH = position.y; vX = position.x;
        vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform float uLvl; varying float vRow; varying float vH; varying float vX;
      #include <fog_pars_fragment>
      void main(){
        float fr = fract(vRow);
        float line = 1.0 - smoothstep(0.0, 0.16, min(fr, 1.0 - fr));
        float h = clamp(vH / 4.2, 0.0, 1.0);
        vec3 lo = vec3(0.49, 0.72, 1.0), mid = vec3(0.78, 1.0, 0.25), hi = vec3(1.0, 0.31, 0.85);
        vec3 c = mix(lo, mid, smoothstep(0.05, 0.45, h));
        c = mix(c, hi, smoothstep(0.5, 0.95, h));
        vec3 col = vec3(0.012, 0.014, 0.022) + c * (line * (0.38 + 1.7*h) + h*0.16);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  // rows are in "row units" so that fract(vRow) marks each history line
  const terrain = new THREE.Mesh(geo, tmat);
  scene.add(terrain);

  // stoma made of the spectrum: outer guard cells and an opening pore
  const NP = 256;
  const ringGeo = (n) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); return g; };
  const outer = new THREE.LineLoop(ringGeo(NP), new THREE.LineBasicMaterial({ color: 0xc8ff40, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const outer2 = new THREE.LineLoop(ringGeo(NP), new THREE.LineBasicMaterial({ color: 0x7eb8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pore = new THREE.LineLoop(ringGeo(128), new THREE.LineBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const poreFill = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
  const stoma = new THREE.Group();
  stoma.add(outer, outer2, pore, poreFill);
  stoma.position.set(0, 5.2, -10);
  scene.add(stoma);

  // history ring buffer (row 0 = newest, nearest the viewer)
  const hist = Array.from({ length: RZ }, () => new Float32Array(BX));
  const binMap = new Int32Array(BX);
  function fit() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.fov = camera.aspect < 1 ? 66 : 50;
    camera.updateProjectionMatrix();
  }
  fit(); addEventListener('resize', fit);
  let acc = 0, time = 0, smooth = new Float32Array(NP), mx = 0, my = 0;
  stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; });
  const idle = (b, t) => {
    // gentle synthetic spectrum while silent, so the stage never looks dead
    const x = Math.abs(b / BX - 0.5) * 2;
    return (0.18 + 0.14 * Math.sin(t * 0.7 + x * 9) + 0.1 * Math.sin(t * 1.9 - x * 23)) * Math.exp(-x * 2.2) + 0.03;
  };
  onFrame((t, dt) => {
    if (!isOn()) return;
    time += dt;
    const playing = engine.playing && engine.freq;
    const F = engine.freq;
    if (playing && !binMap[BX - 1]) {
      const n = F.length;
      for (let b = 0; b < BX; b++) { const d = Math.abs(b / (BX - 1) - 0.5) * 2; binMap[b] = Math.min(n - 1, Math.floor(Math.pow(d, 2.1) * n * 0.7) + 1); }
    }
    acc += dt;
    if (acc > 1 / 30) {
      acc = 0;
      const last = hist.pop(); hist.unshift(last);
      for (let b = 0; b < BX; b++) last[b] = playing ? Math.max(Math.pow(F[binMap[b]] / 255, 1.5), idle(b, time) * 0.3) : idle(b, time);
      const p = pos.array;
      for (let r = 0; r < RZ; r++) {
        const fade = 1 - r / RZ * 0.55;
        const row = hist[r];
        for (let b = 0; b < BX; b++) {
          // geometry rows run back-to-front; flip so row 0 is nearest
          const vi = ((RZ - 1 - r) * BX + b) * 3;
          const center = 1 - Math.abs(b / (BX - 1) - 0.5) * 0.5;
          p[vi + 1] = row[b] * 4.2 * fade * center;
        }
      }
      pos.needsUpdate = true;
    }
    // stoma geometry
    const bands = engine.bands;
    const ap = clamp(0.06 + bands.bass * 0.85 + (playing ? 0 : 0.12 + 0.1 * Math.sin(time * 0.8)));
    const op = outer.geometry.attributes.position.array, op2 = outer2.geometry.attributes.position.array;
    for (let i = 0; i < NP; i++) {
      const a = i / NP * Math.PI * 2;
      const k = Math.abs(Math.cos(a)) * 0.999;   // symmetric: bass swells the guard cells' bellies
      const bin = playing ? F[Math.floor(Math.pow(k, 1.6) * 300) + 2] / 255 : idle(k * BX, time + i * 0.01);
      smooth[i] = lerp(smooth[i], bin, 0.35);
      const R = 1 + smooth[i] * 0.55;
      op[i * 3] = Math.cos(a) * 4.4 * R; op[i * 3 + 1] = Math.sin(a) * 2.7 * R; op[i * 3 + 2] = 0;
      const R2 = 1 + smooth[(i + 64) % NP] * 0.3;
      op2[i * 3] = Math.cos(a) * 4.0 * R2; op2[i * 3 + 1] = Math.sin(a) * 2.35 * R2; op2[i * 3 + 2] = 0;
    }
    outer.geometry.attributes.position.needsUpdate = true; outer2.geometry.attributes.position.needsUpdate = true;
    const pp = pore.geometry.attributes.position.array;
    for (let i = 0; i < 128; i++) {
      const a = i / 128 * Math.PI * 2;
      pp[i * 3] = Math.cos(a) * 2.6; pp[i * 3 + 1] = Math.sin(a) * (0.05 + ap * 1.25); pp[i * 3 + 2] = 0.01;
    }
    pore.geometry.attributes.position.needsUpdate = true;
    poreFill.scale.set(2.6, 0.05 + ap * 1.25, 1);
    poreFill.material.opacity = 0.08 + ap * 0.35;
    stoma.rotation.z = Math.sin(time * 0.15) * 0.05;
    const s = 1 + bands.level * 0.06;
    stoma.scale.set(s, s, s);
    camera.position.x = damp(camera.position.x, mx * 3, 2, dt);
    camera.position.y = damp(camera.position.y, 3.6 - my * 1.5, 2, dt);
    camera.lookAt(0, 2.2, -8);
    renderer.render(scene, camera);
  });
}

function flatViz(canvas, engine, isOn) {
  const g = canvas.getContext('2d');
  onFrame((t) => {
    if (!isOn()) return;
    const r = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(r.width)) { canvas.width = r.width; canvas.height = r.height; }
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    const F = engine.freq, n = 96;
    for (let i = 0; i < n; i++) {
      const v = F && engine.playing ? F[Math.floor(Math.pow(i / n, 2) * 600) + 2] / 255 : 0.1 + 0.08 * Math.sin(t + i * 0.2);
      g.fillStyle = i / n > 0.6 ? '#7eb8ff' : '#c8ff40';
      g.fillRect(i / n * W, H * 0.8 - v * H * 0.6, W / n - 2, v * H * 0.6);
    }
  });
}
