// The living epidermis: a full-screen, hand-written WebGL stomata field.
// Pass 1 renders Voronoi cells + guard-cell pairs into a reduced-size texture;
// pass 2 composites to screen with tears, chromatic split, focus blur, iris and grain.
import { clamp, lerp, damp, mq } from './util.js';

const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

const FIELD = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uAspect, uMouseOn, uBass, uHigh, uFreeze, uZoom, uOpen, uWall2, uPx;
uniform vec2 uMouse, uPan;
uniform vec3 uBg, uCell, uWall, uGuard, uGlow;
vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
float h1(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h1(i),h1(i+vec2(1,0)),f.x), mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x), f.y); }
const vec2 ANI = vec2(0.62, 1.0);
vec2 feat(vec2 c){ vec2 o = h2(c); return 0.5 + 0.36*sin(uTime*0.07 + 6.2831*o); }
void main(){
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 m = (uMouse - 0.5) * vec2(uAspect, 1.0);
  vec2 dm = p - m;
  float lens = exp(-dot(dm,dm)/0.03) * uMouseOn;
  p = m + dm * (1.0 - 0.3*lens);
  float zoom = uZoom * (1.0 - 0.05*uBass);
  vec2 q = p * zoom + uPan;
  vec2 x = q * ANI;
  vec2 n = floor(x), f = fract(x);
  vec2 mg = vec2(0.0), mr = vec2(0.0); float md = 8.0;
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){
    vec2 g = vec2(float(i),float(j));
    vec2 r = g + feat(n+g) - f;
    float d = dot(r,r);
    if (d < md){ md = d; mr = r; mg = g; }
  }
  float bd = 8.0;
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){
    vec2 g = mg + vec2(float(i),float(j));
    vec2 r = g + feat(n+g) - f;
    vec2 dr = r - mr;
    if (dot(dr,dr) > 1e-5) bd = min(bd, dot(0.5*(mr+r), normalize(dr)));
  }
  vec2 cid = n + mg;
  float rnd = h1(cid), rnd2 = h1(cid + 17.31);
  float inner = smoothstep(0.0, 0.45, bd);
  float light = 0.5 + 0.5*vn(q*0.33 + vec2(uTime*0.025, -uTime*0.018));
  vec3 cellCol = uCell * (0.65 + 0.7*rnd2) * (0.5 + 0.65*inner) * (0.55 + 0.6*light);
  vec3 col = mix(uBg, cellCol, 0.8 + 0.2*inner);
  float wall = 1.0 - smoothstep(0.012, 0.038, bd);
  float halo = exp(-bd*13.0);
  col += uWall * (wall*0.72 + halo*0.16) * (0.5 + 0.5*light) * uWall2;

  if (rnd < 0.4) {
    vec2 lp = -mr / ANI;
    float ang = (rnd2 - 0.5) * 0.7;
    float cs = cos(ang), sn = sin(ang);
    lp = mat2(cs, -sn, sn, cs) * lp;
    lp /= (0.82 + 0.32*rnd2);
    vec2 cq = q + mr / ANI;
    vec2 cp = (cq - uPan) / zoom;
    vec2 dc = cp - m;
    float near = exp(-dot(dc,dc)/0.018) * uMouseOn;
    float ph = rnd * 40.0;
    float br = 0.5 + 0.5*sin(uTime*(0.22 + 0.4*rnd2) + ph);
    br = smoothstep(0.3, 1.0, br);
    float ap = clamp(uOpen + br*0.6*(1.0 - uFreeze) + near*1.2 + uBass*(0.3 + 0.5*rnd2), 0.0, 1.0);
    ap *= 1.0 - 0.9*uFreeze*(1.0 - near);
    float e = length(lp / vec2(0.37, 0.25));
    float pw = max(0.014 + 0.105*ap, uPx*1.0);
    float ep = length(lp / vec2(0.215, pw));
    float guard = 1.0 - smoothstep(0.9, 1.0, e);
    float pore = 1.0 - smoothstep(0.8, 1.0, ep);
    float rim = exp(-pow((ep - 1.0)*2.6, 2.0)) * guard;
    float seam = (1.0 - smoothstep(0.0, max(0.014, uPx*0.6), abs(lp.y))) * step(0.215, abs(lp.x)) * guard;
    float sub = exp(-pow((e - 1.4)*8.0, 2.0));
    float pil = sqrt(max(0.0, 1.0 - e*e));
    float spk = smoothstep(0.55, 0.95, vn(lp*14.0 + rnd*13.0)) * guard * (1.0 - pore);
    vec3 gcol = uGuard * (0.32 + 0.8*pil) * (0.85 + 0.3*spk);
    col = mix(col, gcol, guard*0.93);
    col += uWall * sub * 0.32 * uWall2;
    col = mix(col, uGuard*0.2, seam*0.7);
    vec3 pc = mix(uBg*0.3, uGlow*1.15, ap*0.85);
    col = mix(col, pc, pore);
    col += uGlow * rim * (0.18 + 1.15*ap);
    col += uGlow * pore * ap * 0.5 * (0.7 + 0.3*sin(uTime*3.0 + ph));
    col += uGlow * exp(-e*2.0) * ap * 0.16;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const POST = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime, uTear, uAberr, uBlur, uIris, uFade, uAspect, uScan, uSat;
float h1(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
vec3 S(vec2 uv){ return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb; }
void main(){
  vec2 uv = vUv;
  float t = floor(uTime*14.0);
  float row = floor(uv.y*46.0);
  float r = h1(vec2(row, t));
  float big = step(1.0 - uTear*0.42, r);
  float r2 = h1(vec2(floor(uv.y*8.0), t + 3.1));
  float blk = step(1.0 - uTear*0.22, r2);
  uv.x += (h1(vec2(row, t + 7.0)) - 0.5)*0.13*big + (r2 - 0.5)*0.06*blk;
  float ab = uAberr + uTear*0.012 + big*0.012;
  vec3 col;
  if (uBlur > 0.002) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 10; i++) {
      float a = float(i)*0.6283;
      vec2 o = vec2(cos(a), sin(a))*uBlur*0.018*vec2(1.0/uAspect, 1.0);
      acc += S(uv + o) + S(uv + o*0.45);
    }
    col = acc / 20.0;
  } else {
    col.r = S(uv + vec2(ab, 0.0)).r;
    col.g = S(uv).g;
    col.b = S(uv - vec2(ab, 0.0)).b;
  }
  col *= 1.0 - (uScan + big*0.6)*0.22*(0.5 + 0.5*sin(vUv.y*uRes.y*1.7));
  col += vec3(0.9,1.0,0.6) * big * 0.05;
  float L = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(L), col, uSat);
  vec2 c = (vUv - 0.5)*vec2(uAspect, 1.0);
  float d = length(c);
  col *= 1.0 - smoothstep(0.4, 1.3, d)*0.8;
  col *= 1.0 - smoothstep(uIris - 0.02, uIris, d);
  col += (h1(vUv*uRes + fract(uTime*7.0)*91.0) - 0.5)*0.045;
  col *= uFade;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

export const PALETTES = {
  plant:  { bg: [0.012, 0.03, 0.012], cell: [0.075, 0.17, 0.05], wall: [0.45, 0.72, 0.16], guard: [0.34, 0.8, 0.3], glow: [0.78, 1.0, 0.25] },
  ai:     { bg: [0.01, 0.012, 0.04], cell: [0.11, 0.06, 0.25], wall: [0.42, 0.62, 1.0], guard: [0.2, 0.9, 0.7], glow: [1.0, 0.3, 0.86] },
  human:  { bg: [0.04, 0.018, 0.006], cell: [0.25, 0.1, 0.03], wall: [1.0, 0.52, 0.05], guard: [0.95, 0.7, 0.4], glow: [1.0, 0.62, 0.12] },
  fusion: { bg: [0.03, 0.0, 0.03], cell: [0.36, 0.03, 0.22], wall: [0.3, 1.0, 0.62], guard: [0.7, 1.0, 0.55], glow: [0.78, 1.0, 0.25] },
  void:   { bg: [0.02, 0.02, 0.02], cell: [0.075, 0.075, 0.075], wall: [0.22, 0.22, 0.22], guard: [0.3, 0.3, 0.3], glow: [0.45, 0.45, 0.45] },
};

export function createField(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function prog(fs) {
    const p = gl.createProgram();
    const v = sh(gl.VERTEX_SHADER, VERT), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const pf = prog(FIELD), pp = prog(POST);
  if (!pf || !pp) return null;
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  let fw = 0, fh = 0, W = 0, H = 0;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let quality = mq.small || mq.coarse ? 0.55 : 0.7;
  function allocFbo() {
    const nw = Math.max(64, Math.round(W * quality * 0.82)), nh = Math.max(64, Math.round(H * quality * 0.82));
    if (nw === fw && nh === fh) return;
    fw = nw; fh = nh;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function resize() {
    // the screen pass is cheap; still cap it so large displays stay fast
    const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    const s = Math.min(dpr, 1.25) * (quality < 0.5 ? 0.8 : 1);
    W = Math.max(64, Math.round(cw * s)); H = Math.max(64, Math.round(ch * s));
    canvas.width = W; canvas.height = H;
    allocFbo();
  }
  resize();
  addEventListener('resize', resize);

  // state (current -> target, damped)
  const cur = JSON.parse(JSON.stringify(PALETTES.plant));
  let target = PALETTES.plant;
  const st = { fade: 1, zoom: 5.4, freeze: 0, tear: 0, sat: 1, open: 0, iris: 0.06, blur: 1, aberr: 0.0015, scan: 0, wall2: 1 };
  const tg = { ...st, iris: 2.0, blur: 0 };
  const mouse = { x: 0.62, y: 0.5, tx: 0.62, ty: 0.5, on: 0, ton: 0 };
  const pan = { x: 0, y: 0 };
  let bands = { bass: 0, high: 0, onset: 0 };
  let tearKick = 0;
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { location.reload(); });

  const api = {
    gl, state: st, target: tg,
    setPalette(name) { target = PALETTES[name] || PALETTES.plant; },
    setMouse(x, y, on = 1) { mouse.tx = x; mouse.ty = y; mouse.ton = on; },
    setBands(b) { bands = b; },
    kick(v = 1) { tearKick = Math.max(tearKick, v); },
    get quality() { return quality; },
    get mouse() { return mouse; },
    renderEnabled: true,
    update(t, dt, scrollY) {
      for (const k of ['bg', 'cell', 'wall', 'guard', 'glow']) for (let i = 0; i < 3; i++) cur[k][i] = damp(cur[k][i], target[k][i], 2.2, dt);
      for (const k in tg) st[k] = damp(st[k], tg[k], k === 'iris' || k === 'blur' ? 2.4 : 3, dt);
      mouse.x = damp(mouse.x, mouse.tx, 6, dt); mouse.y = damp(mouse.y, mouse.ty, 6, dt);
      mouse.on = damp(mouse.on, mouse.ton, 3, dt);
      tearKick = Math.max(0, tearKick - dt * 2.2);
      pan.x = t * 0.035 + scrollY * 0.00022;
      pan.y = -scrollY * 0.0009;
    },
    render(t) {
      if (lost) return;
      const aspect = W / H;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, fw, fh);
      gl.useProgram(pf.p);
      const u = pf.u;
      gl.uniform1f(u.uTime, t); gl.uniform1f(u.uAspect, aspect);
      gl.uniform2f(u.uMouse, mouse.x, mouse.y); gl.uniform1f(u.uMouseOn, mouse.on);
      gl.uniform1f(u.uBass, bands.bass || 0); gl.uniform1f(u.uHigh, bands.high || 0);
      gl.uniform1f(u.uFreeze, st.freeze); gl.uniform1f(u.uZoom, st.zoom); gl.uniform1f(u.uOpen, st.open);
      gl.uniform1f(u.uWall2, st.wall2);
      gl.uniform1f(u.uPx, st.zoom / Math.max(1, fh));
      gl.uniform2f(u.uPan, pan.x, pan.y);
      gl.uniform3fv(u.uBg, cur.bg); gl.uniform3fv(u.uCell, cur.cell); gl.uniform3fv(u.uWall, cur.wall);
      gl.uniform3fv(u.uGuard, cur.guard); gl.uniform3fv(u.uGlow, cur.glow);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.useProgram(pp.p);
      const v = pp.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(v.uTex, 0);
      gl.uniform2f(v.uRes, W, H); gl.uniform1f(v.uTime, t); gl.uniform1f(v.uAspect, aspect);
      const tear = clamp(st.tear + (bands.high || 0) * 0.55 + (bands.onset || 0) * 0.9 + tearKick);
      gl.uniform1f(v.uTear, tear);
      gl.uniform1f(v.uAberr, st.aberr + (bands.high || 0) * 0.004);
      gl.uniform1f(v.uBlur, st.blur); gl.uniform1f(v.uIris, st.iris);
      gl.uniform1f(v.uFade, st.fade); gl.uniform1f(v.uScan, st.scan + tear * 0.5);
      gl.uniform1f(v.uSat, st.sat);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    snap() {
      // reduced motion: jump straight to the target state (no tweening)
      for (const k of ['bg', 'cell', 'wall', 'guard', 'glow']) cur[k] = target[k].slice();
      Object.assign(st, tg);
      mouse.x = mouse.tx; mouse.y = mouse.ty; mouse.on = 0;
    },
    adapt(avgMs) {
      // dynamic resolution: keep the field near 60 fps
      const before = quality;
      if (avgMs > 24 && quality > 0.3) quality = Math.max(0.3, quality * 0.82);
      else if (avgMs < 18.5 && quality < 0.95) quality = Math.min(0.95, quality * 1.06);
      if (Math.abs(before - quality) > 0.01) resize();
    },
    resize,
  };
  return api;
}
