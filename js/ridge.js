// 53 annotated aperture curves as a breathing ridgeline with a sweeping read head.
// Drawn with WebGL (three.js, orthographic, pixel space): filled strips occlude the rows behind,
// soft ribbons give the glow. Labels are HTML, so text never touches the canvas.
import { $, clamp, mq, onFrame, visible, fmtMS } from './util.js';
import { GROUPS, GROUP_ORDER, PLANTS_DISPLAY, methodEn } from './const.js';

const RIB_VS = `
attribute float aSide; attribute float aU;
varying float vSide; varying float vU;
void main(){ vSide = aSide; vU = aU; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RIB_FS = `
uniform vec3 uColor; uniform float uAlpha; uniform float uSoft; uniform float uDash;
varying float vSide; varying float vU;
void main(){
  float e = 1.0 - abs(vSide);
  float a = mix(smoothstep(0.0, 0.6, e), e*e, uSoft) * uAlpha;
  if (uDash > 0.0 && fract(vU / uDash) > 0.5) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export async function initRidge(data, { reduced }) {
  const stage = $('.ridge-stage'), canvas = $('.ridge-canvas'), tip = $('[data-ridge-tip]');
  const fail = (e) => {
    console.warn('ridge: unavailable', e);
    stage.classList.add('ridge-off');
    stage.insertAdjacentHTML('beforeend', '<p class="fine ridge-note">This device cannot show the curve chart; the raw data for all 53 curves can be downloaded in the Data section below.</p>');
  };
  let THREE, renderer;
  if (document.documentElement.classList.contains('no-gl')) { fail('no-gl'); return; }
  try { THREE = await import('three'); } catch (e) { fail(e); return; }
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { fail(e); return; }
  const curves = data.curves.slice().sort((a, b) => a.id - b.id);
  const N = curves.length, recs = data.records;
  const T_MAX = 106 * 60, T_BREAK = 60 * 60, BREAK_FR = 0.86;
  const xOfT = (t) => (t <= T_BREAK ? (t / T_BREAK) * BREAK_FR : BREAK_FR + (t - T_BREAK) / (T_MAX - T_BREAK) * (1 - BREAK_FR));
  const valAt = (a, t) => {
    if (t <= a[0][0]) return a[0][1];
    for (let i = 1; i < a.length; i++) if (t <= a[i][0]) { const [t0, v0] = a[i - 1], [t1, v1] = a[i]; const k = (t - t0) / Math.max(1, t1 - t0); return v0 + (v1 - v0) * k * k * (3 - 2 * k); }
    return a[a.length - 1][1];
  };
  for (const c of curves) {
    c.end = Math.max(c.dur || 0, c.a[c.a.length - 1][0]);
    c.ts = []; for (let t = 0; t < c.end; t += 45) c.ts.push(t); c.ts.push(c.end);
    c.vs = c.ts.map((t) => valAt(c.a, t));
    c.peak = Math.max(...c.a.map((p) => p[1]));
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);
  let W = 1, H = 1;
  const L = { l: 0, r: 0, t: 0, b: 0 };
  const row = (k) => {
    const f = k / (N - 1), s = 0.58 + 0.42 * f, span = H - L.t - L.b, top = span * 0.24 * 0.58;
    return { s, base: L.t + top + f * (span - top), amp: span * 0.24 * s };
  };
  const px = (k, t) => { const { s } = row(k); return (L.l + W - L.r) / 2 + (xOfT(t) - 0.5) * (W - L.l - L.r) * s; };

  const mkRib = (n) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const side = new Float32Array(n * 2), u = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setAttribute('aU', new THREE.BufferAttribute(u, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    return g;
  };
  const ribMat = (color, alpha, soft, dash = 0, add = false) => new THREE.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, transparent: true, depthTest: false, depthWrite: false,
    blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uSoft: { value: soft }, uDash: { value: dash } } });
  const rows = curves.map((c, k) => {
    const n = c.ts.length;
    const fill = new THREE.Mesh(mkRib(n), new THREE.MeshBasicMaterial({ color: 0x090909, depthTest: false, depthWrite: false }));
    const glow = new THREE.Mesh(mkRib(n), ribMat(GROUPS[c.g].color, 0.2, 1, 0, true));
    const line = new THREE.Mesh(mkRib(n), ribMat(GROUPS[c.g].color, 0.9, 0));
    const nz = (c.nz || []).filter(([a]) => a < c.end);
    let noise = null;
    if (nz.length) {
      const g = mkRib(nz.length * 2);
      const ix = []; for (let j = 0; j < nz.length; j++) { const a = j * 4; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(ix);
      noise = new THREE.Mesh(g, ribMat('#ff8c00', 0.38, 0, 5));
    }
    for (const m of [fill, glow, line, noise]) if (m) m.frustumCulled = false;
    fill.renderOrder = k * 4; glow.renderOrder = k * 4 + 1; line.renderOrder = k * 4 + 2; if (noise) noise.renderOrder = k * 4 + 3;
    scene.add(fill, glow, line); if (noise) scene.add(noise);
    return { c, fill, glow, line, noise, nz };
  });
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
  dotGeo.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
  const dots = new THREE.Points(dotGeo, new THREE.ShaderMaterial({ transparent: true, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uPR: { value: 1 } },
    vertexShader: 'attribute float aS; uniform float uPR; void main(){ gl_PointSize = aS * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(1.0, 1.0, 0.92, a); }' }));
  dots.renderOrder = 9999; dots.frustumCulled = false; scene.add(dots);
  const sweepGeo = new THREE.BufferGeometry(); sweepGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
  const sweep = new THREE.Line(sweepGeo, new THREE.LineBasicMaterial({ color: 0xc8ff40, transparent: true, opacity: 0.45, depthTest: false }));
  sweep.renderOrder = 9998; sweep.frustumCulled = false; scene.add(sweep);

  const lab = document.createElement('div'); lab.className = 'ridge-labels'; lab.setAttribute('aria-hidden', 'true'); stage.appendChild(lab);
  const sweepLbl = document.createElement('span'); sweepLbl.className = 'rl-sweep';
  function layoutLabels() {
    const fr = row(N - 1);
    let h = '';
    // narrow stages: drop the 90′ tick (it runs into 105′) and fold the compression note into the left label
    const narrow = W < 600;
    for (const m of (narrow ? [0, 15, 30, 45, 60, 105] : [0, 15, 30, 45, 60, 90, 105])) h += `<span class="rl-tick" style="left:${px(N - 1, m * 60)}px;top:${fr.base + 10}px">${m}′</span>`;
    h += `<span class="rl-axis" style="left:${L.l}px;top:${fr.base + 28}px">${narrow ? 'RECORDING TIME (MIN) · 60′+ COMPRESSED →' : 'RECORDING TIME (MIN) →'}</span>`;
    if (!narrow) h += `<span class="rl-axis" style="left:${px(N - 1, T_BREAK) + 10}px;top:${fr.base + 28}px">// 60′+ COMPRESSED</span>`;
    h += `<span class="rl-axis rl-date" style="left:${px(0, 0)}px;top:${row(0).base - 18}px">2025-12-10</span>`;
    h += `<span class="rl-axis rl-date" style="left:${px(N - 1, 0)}px;top:${fr.base - 18}px">2026-02-11</span>`;
    h += `<span class="rl-legend">${GROUP_ORDER.map((g) => { const n = curves.filter((c) => c.g === g).length; return n ? `<span><i style="background:${GROUPS[g].color}"></i>${GROUPS[g].en} ${n}</span>` : ''; }).join('')}<span><i class="nz"></i>Noise</span></span>`;
    lab.innerHTML = h; lab.appendChild(sweepLbl);
  }
  let hover = -1;
  function ribbon(geo, xs, ys, w) {
    const p = geo.attributes.position.array, u = geo.attributes.aU.array, n = xs.length;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let tx = xs[i1] - xs[i0], ty = ys[i1] - ys[i0];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nx = -ty * w / 2, ny = tx * w / 2;
      p[i * 6] = xs[i] - nx; p[i * 6 + 1] = ys[i] - ny; p[i * 6 + 3] = xs[i] + nx; p[i * 6 + 4] = ys[i] + ny;
      if (i) acc += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
      u[i * 2] = u[i * 2 + 1] = acc;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.aU.needsUpdate = true;
  }
  function build(time) {
    const sweepT = reduced ? T_MAX * 0.42 : ((time * 0.085) % 1.15) * T_MAX;
    const dp = dotGeo.attributes.position.array, ds = dotGeo.attributes.aS.array;
    for (let k = 0; k < N; k++) {
      const R = rows[k], c = R.c, { s, base, amp } = row(k);
      const br = reduced ? 1 : 1 + 0.07 * Math.sin(time * 1.3 + k * 0.45);
      const n = c.ts.length;
      const xs = new Float32Array(n), ys = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const wob = reduced ? 0 : Math.sin(time * 2.1 + c.ts[i] * 0.004 + k) * 0.7;
        xs[i] = px(k, c.ts[i]); ys[i] = base - (c.vs[i] + wob) / 100 * amp * br;
      }
      const fp = R.fill.geometry.attributes.position.array;
      for (let i = 0; i < n; i++) { fp[i * 6] = xs[i]; fp[i * 6 + 1] = ys[i]; fp[i * 6 + 3] = xs[i]; fp[i * 6 + 4] = base + 1.5; }
      R.fill.geometry.attributes.position.needsUpdate = true;
      const isH = k === hover, dim = hover >= 0 && !isH;
      ribbon(R.glow.geometry, xs, ys, (isH ? 14 : 8) * s);
      ribbon(R.line.geometry, xs, ys, (isH ? 2.6 : 1.5) * s);
      R.line.material.uniforms.uColor.value.set(isH ? '#ffffff' : GROUPS[c.g].color);
      R.line.material.uniforms.uAlpha.value = dim ? 0.3 : 0.55 + 0.45 * s;
      R.glow.material.uniforms.uAlpha.value = dim ? 0.05 : isH ? 0.45 : 0.16 + 0.1 * s;
      if (R.noise) {
        const np = R.noise.geometry.attributes.position.array, nu = R.noise.geometry.attributes.aU.array;
        R.nz.forEach(([a, b], j) => {
          const x0 = px(k, a), x1 = px(k, Math.min(b, c.end)), y = base + 4, w = 1.1;
          np.set([x0, y - w, 0, x0, y + w, 0, x1, y - w, 0, x1, y + w, 0], j * 12);
          nu.set([x0, x0, x1, x1], j * 4);
        });
        R.noise.geometry.attributes.position.needsUpdate = true; R.noise.geometry.attributes.aU.needsUpdate = true;
      }
      if (sweepT <= c.end) {
        const v = valAt(c.a, sweepT);
        dp[k * 3] = px(k, sweepT); dp[k * 3 + 1] = base - v / 100 * amp * br; ds[k] = (3 + v / 14) * s;
      } else ds[k] = 0;
    }
    dotGeo.attributes.position.needsUpdate = true; dotGeo.attributes.aS.needsUpdate = true;
    const fr = row(N - 1);
    sweepGeo.attributes.position.array.set([px(0, sweepT), row(0).base - row(0).amp, 0, px(N - 1, sweepT), fr.base + 4, 0]);
    sweepGeo.attributes.position.needsUpdate = true;
    sweep.visible = sweepT < T_MAX;
    sweepLbl.style.display = sweep.visible ? '' : 'none';
    sweepLbl.style.transform = `translate(${px(N - 1, sweepT)}px, ${fr.base + 10}px)`;
    sweepLbl.textContent = fmtMS(Math.min(sweepT, T_MAX));
    renderer.render(scene, cam);
  }
  function fit() {
    const r = stage.getBoundingClientRect();
    W = Math.max(10, r.width); H = Math.max(10, r.height);
    L.l = mq.small ? 14 : 120; L.r = mq.small ? 14 : 70; L.t = 46; L.b = 54;
    renderer.setSize(W, H, false);
    cam.left = 0; cam.right = W; cam.top = 0; cam.bottom = H; cam.updateProjectionMatrix();
    dots.material.uniforms.uPR.value = renderer.getPixelRatio();
    layoutLabels();
    build(0);
  }
  fit(); addEventListener('resize', fit);

  function pick(mx, my) {
    let best = -1, bd = 1e9;
    for (let k = 0; k < N; k++) {
      const c = curves[k], { s, base, amp } = row(k);
      const xf = (mx - (L.l + W - L.r) / 2) / ((W - L.l - L.r) * s) + 0.5;
      if (xf < 0 || xf > 1) continue;
      const t = xf <= BREAK_FR ? xf / BREAK_FR * T_BREAK : T_BREAK + (xf - BREAK_FR) / (1 - BREAK_FR) * (T_MAX - T_BREAK);
      if (t > c.end + 60) continue;
      const dd = Math.abs(my - (base - valAt(c.a, t) / 100 * amp));
      if (dd < bd) { bd = dd; best = k; }
    }
    return bd < 16 ? best : -1;
  }
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    hover = pick(mx, my);
    if (hover >= 0) {
      const c = curves[hover], rec = recs[c.e - 1];
      tip.hidden = false;
      tip.innerHTML = `<b>#${c.id}</b> · ${c.d} · ${PLANTS_DISPLAY[c.p]} · ${c.ma ? '≈' : ''}${c.m}× · ${methodEn(c.me)}<br>peak aperture <b>${c.peak}%</b> · about <b>${Math.round(c.end / 60)}</b> min recorded · outcome: ${GROUPS[c.g].en.toLowerCase()}${c.amb ? ' · largest of several stomata' : ''}${rec && rec.h != null ? ` · humidity ${rec.h}%` : ''}`;
      tip.style.left = `${Math.max(6, Math.min(r.width - tip.offsetWidth - 10, mx + 14))}px`; tip.style.top = `${my + 16}px`;
    } else tip.hidden = true;
    if (reduced) build(0);
  });
  canvas.addEventListener('pointerleave', () => { hover = -1; tip.hidden = true; if (reduced) build(0); });
  let on = false;
  visible(stage, (v) => { on = v; });
  window.__sc.ridge = { build, pointOf(k, frac) {
    const c = curves[k], r = canvas.getBoundingClientRect(), t = c.end * frac, { base, amp } = row(k);
    return [r.left + px(k, t), r.top + base - valAt(c.a, t) / 100 * amp];
  } };
  if (reduced) return;
  let acc = 0, time = 0;
  onFrame((t, dt) => {
    if (!on) return;
    time += dt; acc += dt;
    if (acc < 1 / 40) return;
    acc = 0;
    build(time);
  });
}
