import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shared, fxLights } from './core.js';

export const rnd = Math.random;
export const pick = (a) => a[(rnd() * a.length) | 0];
export const lerp = (a, b, k) => a + (b - a) * k;
export function discPt(r) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r; return [Math.cos(a) * d, Math.sin(a) * d]; }
export function ringPt(r0, r1) { const a = rnd() * Math.PI * 2, d = r0 + rnd() * (r1 - r0); return [Math.cos(a) * d, Math.sin(a) * d]; }
export const rotY = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

/* =========================================================================
   CANVAS TEXTURES
   ========================================================================= */
export function canvasTex(size, draw, { srgb = true, wrap = false, h } = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h || size;
  draw(c.getContext('2d'), size, h || size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function blob(g, x, y, r, c0, c1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
}
export const TX = {
  soft: canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.85)');
    gr.addColorStop(0.55, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
  flame: canvasTex(64, (g, s) => {
    g.translate(s / 2, s * 0.62); g.scale(0.62, 1.45);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.28);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 0.28, 0, 7); g.fill();
  }),
  smoke: canvasTex(128, (g, s) => {
    for (let i = 0; i < 18; i++) {
      const r = s * (0.12 + rnd() * 0.16), a = rnd() * 7, d = rnd() * s * 0.18, v = (205 + rnd() * 50) | 0;
      blob(g, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, r, `rgba(${v},${v},${v},.34)`, `rgba(${v},${v},${v},0)`);
    }
  }),
  glow: canvasTex(256, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
  ring: canvasTex(256, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.72, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }),
  scorch: canvasTex(512, (g, s) => {
    for (let i = 0; i < 260; i++) { const [x, y] = discPt(s * 0.43); blob(g, s / 2 + x, s / 2 + y, s * (0.01 + rnd() * 0.05), 'rgba(30,24,18,.28)', 'rgba(30,24,18,0)'); }
    for (let i = 0; i < 80; i++) { const [x, y] = discPt(s * 0.4); blob(g, s / 2 + x, s / 2 + y, s * (0.006 + rnd() * 0.02), 'rgba(10,8,6,.8)', 'rgba(24,19,14,0)'); }
  }),
  camoGreen: camo('#4f5a38', ['#3c4529', '#66704a', '#2d331f']),
  camoSand: camo('#8b7d5c', ['#a2916a', '#6f6247', '#b8a77e']),
  facade: canvasTex(128, (g, s) => {
    g.fillStyle = '#c9c3b8'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = rnd() < 0.15 ? '#141414' : '#2f3a46';
      g.fillRect(8 + x * 30, 6 + y * 20, 18, 12);
    }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, s - 6, s, 6);
  }),
  windows: canvasTex(128, (g, s) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) {
      if (rnd() < 0.42) { g.fillStyle = pick(['#ffd28a', '#ffe6b0', '#fff1d6', '#9fd0ff']); g.fillRect(8 + x * 30, 6 + y * 20, 18, 12); }
    }
  }),
};
function camo(base, cols) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) { g.fillStyle = pick(cols); g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 8 + rnd() * 26, 5 + rnd() * 14, rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
  }, { wrap: true });
}

/* =========================================================================
   PARTICLES
   ========================================================================= */
export const hex3 = (h) => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };

const PART_VS = `
attribute float aSeed; attribute float aSize;
uniform float uTime,uPixel,uScale,uRise,uSpeed,uJitter,uGrav,uSpread;
uniform vec2 uGrow,uWind;
varying float vLife; varying float vSeed;
void main(){
  float sp=uSpeed*(0.75+0.5*fract(aSeed*91.7));
  float life=fract(uTime*sp+aSeed*17.31);
  vec3 p=position;
  p.y+=life*uRise*(0.55+0.45*fract(aSeed*7.13))-uGrav*life*life;
  float an=aSeed*628.3;
  p.xz+=vec2(cos(an),sin(an))*uSpread*life*(0.4+0.6*fract(aSeed*3.7));
  p.xz+=uWind*life*life;
  p.x+=sin(uTime*2.3+aSeed*50.)*uJitter*life;
  p.z+=cos(uTime*1.9+aSeed*31.)*uJitter*life;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  float sz=aSize*mix(uGrow.x,uGrow.y,life);
  gl_PointSize=max(sz*uScale*uPixel/(-mv.z),0.);
  gl_Position=projectionMatrix*mv;
  vLife=life; vSeed=aSeed;
}`;
const PART_FS = `
uniform sampler2D uMap; uniform vec3 uC0,uC1,uC2; uniform float uAlpha,uFadeIn,uFlicker,uTime,uBright,uRot;
varying float vLife; varying float vSeed;
void main(){
  vec2 c=gl_PointCoord-0.5; float a=(vSeed*6.2831+vLife*1.3)*uRot;
  c=mat2(cos(a),-sin(a),sin(a),cos(a))*c;
  vec4 t=texture2D(uMap,c+0.5);
  vec3 col=vLife<0.5?mix(uC0,uC1,vLife*2.):mix(uC1,uC2,vLife*2.-1.);
  col=pow(col,vec3(2.2))*uBright;
  float fl=1.-uFlicker*0.5*(sin(uTime*23.+vSeed*90.)*0.5+0.5);
  float alpha=t.a*uAlpha*smoothstep(0.,uFadeIn,vLife)*(1.-vLife)*fl;
  if(alpha<0.003) discard;
  gl_FragColor=vec4(col*t.rgb,alpha);
}`;
export function emitter(site, o) {
  const n = o.count, pos = new Float32Array(n * 3), seed = new Float32Array(n), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [x, z] = o.place ? o.place(i) : discPt(o.radius ?? 0.2);
    pos[i * 3] = x; pos[i * 3 + 1] = rnd() * (o.yJit || 0); pos[i * 3 + 2] = z;
    seed[i] = rnd(); size[i] = o.size[0] + rnd() * (o.size[1] - o.size[0]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime, uPixel: shared.uPixel, uScale: site.uScale,
      uRise: { value: o.rise }, uSpeed: { value: o.speed }, uJitter: { value: o.jitter || 0 }, uGrav: { value: o.grav || 0 }, uSpread: { value: o.spread || 0 },
      uGrow: { value: new THREE.Vector2(...o.grow) }, uWind: { value: new THREE.Vector2(...(o.wind || [0, 0])) },
      uMap: { value: o.map || TX.soft }, uC0: { value: hex3(o.colors[0]) }, uC1: { value: hex3(o.colors[1]) }, uC2: { value: hex3(o.colors[2]) },
      uAlpha: { value: o.alpha ?? 1 }, uFadeIn: { value: o.fadeIn ?? 0.08 }, uFlicker: { value: o.flicker || 0 }, uBright: { value: o.bright ?? 1 },
      uRot: { value: o.map === TX.flame ? 0.15 : 1 },
    },
    vertexShader: PART_VS, fragmentShader: PART_FS, transparent: true, depthWrite: false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = o.additive ? 4 : 3;
  pts.position.set(o.cx || 0, o.y || 0, o.cz || 0);
  (o.parent || site.g).add(pts);
  if (site.conform && !o.parent) { const by = o.y || 0; site.conform(() => { pts.position.y = by + site.groundY(o.cx || 0, o.cz || 0); }); }
  return pts;
}
export const fireFx = (site, o) => emitter(site, { rise: 0.07, speed: 0.95, size: [0.04, 0.08], grow: [1, 0.3], colors: ['#fff2c2', '#ff8a1e', '#a01c04'], additive: true, jitter: 0.01, flicker: 0.6, map: TX.flame, bright: 2.2, ...o });
export const smokeFx = (site, o) => emitter(site, { rise: 0.7, speed: 0.13, size: [0.09, 0.16], grow: [0.5, 3.0], wind: [0.25, 0.1], colors: ['#2e2723', '#4d4845', '#7d7a78'], alpha: 0.55, fadeIn: 0.12, map: TX.smoke, ...o });

const BURST_VS = `
attribute vec3 aDir; attribute float aSeed; attribute float aSize;
uniform float uTime,uPixel,uScale,uStart,uDur,uRadius,uKind; uniform vec3 uOrigin;
varying float vLife; varying float vSeed;
void main(){
  float life=(uTime-uStart)/uDur;
  vLife=clamp(life,0.,1.); vSeed=aSeed;
  float e=1.-pow(1.-vLife,3.);
  vec3 p;
  if(uKind>1.5){
    p=uOrigin+aDir*uRadius*2.6*vLife*(0.5+fract(aSeed*7.7));
    p.y+=uRadius*2.2*vLife*(0.6+fract(aSeed*3.1))-uRadius*5.0*vLife*vLife;
  } else {
    p=uOrigin+aDir*uRadius*e*(0.45+0.55*fract(aSeed*13.1));
    if(uKind>0.5) p.y+=vLife*uRadius*1.8*(0.5+fract(aSeed*5.3));
  }
  vec4 mv=modelViewMatrix*vec4(p,1.);
  float g=uKind>1.5?(1.-vLife*0.6):(uKind>0.5?(0.6+vLife*2.4):(0.5+vLife*1.2));
  float sz=(life<0.||life>1.)?0.:aSize*g*uRadius/0.07;
  gl_PointSize=sz*uScale*uPixel/(-mv.z);
  gl_Position=projectionMatrix*mv;
}`;
const BURST_FS = `
uniform sampler2D uMap; uniform float uKind;
varying float vLife; varying float vSeed;
void main(){
  vec4 t=texture2D(uMap,gl_PointCoord);
  vec3 col; float a;
  if(uKind<0.5){
    col=vLife<0.25?mix(vec3(1.,.97,.85),vec3(1.,.62,.16),vLife/.25):mix(vec3(1.,.62,.16),vec3(.3,.07,.02),(vLife-.25)/.75);
    col*=3.0; a=pow(1.-vLife,1.7)*1.2;
  } else if(uKind<1.5){
    col=mix(vec3(.16,.14,.13),vec3(.46,.44,.43),vLife);
    a=smoothstep(0.,.12,vLife)*(1.-vLife)*0.8;
  } else {
    col=vec3(1.,.75,.35)*4.0; a=1.-vLife;
  }
  col=pow(col,vec3(2.2));
  a*=t.a; if(a<0.004) discard;
  gl_FragColor=vec4(col*t.rgb,a);
}`;
function burstPoints(site, n, kind, parent) {
  const dir = new Float32Array(n * 3), seed = new Float32Array(n), size = new Float32Array(n), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() * 0.8 + 0.1, rnd() - 0.5).normalize();
    dir.set([v.x, v.y, v.z], i * 3); seed[i] = rnd();
    size[i] = kind === 1 ? 0.05 + rnd() * 0.05 : kind === 2 ? 0.006 + rnd() * 0.006 : 0.035 + rnd() * 0.04;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uPixel: shared.uPixel, uScale: site.uScale, uStart: { value: -999 }, uDur: { value: [0.9, 3.2, 1.1][kind] },
      uRadius: { value: 0.07 }, uKind: { value: kind }, uOrigin: { value: new THREE.Vector3() }, uMap: { value: kind === 1 ? TX.smoke : TX.soft } },
    vertexShader: BURST_VS, fragmentShader: BURST_FS, transparent: true, depthWrite: false,
    blending: kind === 1 ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false; p.renderOrder = kind === 1 ? 3 : 5;
  (parent || site.g).add(p);
  return p;
}

let lightIdx = 0;
const _v = new THREE.Vector3();
export function flash(site, x, y, z, power, dur = 0.45, color = 0xff9a40) {
  if (!site.focused) return;
  const l = fxLights[lightIdx++ % 2];
  site.root.updateMatrixWorld();
  l.position.copy(site.root.localToWorld(_v.set(x, y + 0.03, z)));
  l.color.set(color);
  Object.assign(l.userData, { t0: shared.uTime.value, power, dur, scale: site.uScale.value });
}

export class Explosions {
  constructor(site, n, { shock = true } = {}) {
    this.site = site; this.items = []; this.i = 0;
    for (let k = 0; k < n; k++) {
      const ring = shock ? decal(site, TX.ring, 0.5, 0xffd6a0, 0, true, 0.004, { conform: false }) : null;
      this.items.push({ pts: [burstPoints(site, 26, 0), burstPoints(site, 14, 1), burstPoints(site, 16, 2)], ring, t0: -99, r: 0.07, x: 0, z: 0 });
    }
    if (shock) site.on((t) => {
      for (const it of this.items) {
        if (!it.ring) continue;
        const k = (t - it.t0) / 0.55;
        if (k < 0 || k > 1) { it.ring.visible = false; continue; }
        it.ring.visible = true;
        const s = it.r * (0.6 + k * 3.2);
        it.ring.scale.set(s, 1, s);
        it.ring.material.opacity = (1 - k) * 0.55;
      }
    });
  }
  fire(x, z, r, y) {
    const it = this.items[this.i++ % this.items.length], t = shared.uTime.value;
    const gy = y ?? (this.site.groundY(x, z) + 0.004);
    for (const p of it.pts) { const u = p.material.uniforms; u.uOrigin.value.set(x, gy, z); u.uStart.value = t; u.uRadius.value = r; }
    it.t0 = t; it.r = r;
    if (it.ring) it.ring.position.set(x, gy - 0.002, z);
    flash(this.site, x, gy, z, r / 0.07);
  }
}

const GLOW_VS = `
attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
uniform float uPixel,uScale; varying vec3 vC; varying float vA;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uScale*uPixel/(-mv.z); gl_Position=projectionMatrix*mv; vC=aColor; vA=aAlpha; }`;
const GLOW_FS = `
uniform sampler2D uMap; varying vec3 vC; varying float vA;
void main(){ vec4 t=texture2D(uMap,gl_PointCoord); float a=t.a*vA; if(a<0.004) discard; gl_FragColor=vec4(pow(vC,vec3(2.2))*2.5*t.rgb,a); }`;
export class Glows {
  constructor(site, n, parent) {
    this.n = n; this.k = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.alpha = new Float32Array(n); this.size = new Float32Array(n);
    const geo = this.geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: { uPixel: shared.uPixel, uScale: site.uScale, uMap: { value: TX.soft } },
      vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.pts.frustumCulled = false; this.pts.renderOrder = 6;
    (parent || site.g).add(this.pts);
  }
  clear() { this.k = 0; }
  add(x, y, z, r, g, b, a, s) {
    if (this.k >= this.n) return;
    const i = this.k++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.alpha[i] = a; this.size[i] = s;
  }
  commit() {
    this.geo.setDrawRange(0, this.k);
    for (const k of ['position', 'aColor', 'aAlpha', 'aSize']) this.geo.attributes[k].needsUpdate = true;
  }
}
export class Tracers {
  constructor(site, n, color = [1, 0.82, 0.45]) {
    this.n = n; this.items = []; this.color = color;
    this.pos = new Float32Array(n * 6); this.col = new Float32Array(n * 6);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const l = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    l.frustumCulled = false; l.renderOrder = 6;
    site.g.add(l);
  }
  add(a, b, t, dur) { if (this.items.length < this.n) this.items.push({ a, b, t0: t, dur }); }
  update(t) {
    this.items = this.items.filter((it) => t - it.t0 < it.dur);
    let k = 0;
    for (const it of this.items) {
      const p = (t - it.t0) / it.dur, p2 = Math.min(1, p + 0.3), f = 1 - p;
      for (let j = 0; j < 3; j++) {
        this.pos[k * 6 + j] = it.a[j] + (it.b[j] - it.a[j]) * p;
        this.pos[k * 6 + 3 + j] = it.a[j] + (it.b[j] - it.a[j]) * p2;
        this.col[k * 6 + j] = this.color[j] * f * 0.6; this.col[k * 6 + 3 + j] = this.color[j] * f * 2;
      }
      k++;
    }
    this.geo.setDrawRange(0, k * 2);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

/* =========================================================================
   GROUND DECALS (지형을 따라 휘는 격자 평면)
   ========================================================================= */
export const GEO = {};
GEO.plane = new THREE.PlaneGeometry(1, 1);
GEO.grid = new THREE.PlaneGeometry(1, 1, 20, 20).rotateX(-Math.PI / 2);

export function decal(site, tex, r, color, opacity, additive, off = 0.0015, { parent, conform = true } = {}) {
  const geo = conform ? GEO.grid.clone() : GEO.flat;
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.scale.set(r * 2, 1, r * 2); m.position.y = off; m.renderOrder = 2;
  (parent || site.g).add(m);
  if (conform && site.ground) site.ground(m);
  return m;
}
GEO.flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function groundMesh(site, w, d, material, off = 0.0012) {
  const geo = new THREE.PlaneGeometry(1, 1, 16, 16).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, material);
  m.scale.set(w, 1, d); m.position.y = off; m.receiveShadow = true;
  site.g.add(m);
  if (site.ground) site.ground(m);
  return m;
}

/* =========================================================================
   MODELS
   ========================================================================= */
{
  const body = () => new THREE.CylinderGeometry(0.0042, 0.0052, 0.016, 6).translate(0, 0.018, 0);
  const head = () => new THREE.SphereGeometry(0.0043, 8, 6).translate(0, 0.0305, 0);
  const helmet = () => new THREE.SphereGeometry(0.0053, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.0312, 0);
  const legsStatic = () => new THREE.BoxGeometry(0.004, 0.011, 0.007).translate(0, 0.0055, 0);
  GEO.person = mergeGeometries([body(), head(), legsStatic()]);
  GEO.soldierTop = mergeGeometries([body(), head(), helmet(), new THREE.BoxGeometry(0.021, 0.0026, 0.0026).translate(0.009, 0.021, 0.0035),
    new THREE.BoxGeometry(0.006, 0.009, 0.008).translate(-0.004, 0.02, 0)]);
  GEO.leg = new THREE.BoxGeometry(0.0034, 0.0115, 0.0034).translate(0, -0.0057, 0);
  GEO.police = mergeGeometries([body(), head(), helmet(), legsStatic(), new THREE.BoxGeometry(0.003, 0.024, 0.016).translate(0.008, 0.015, 0)]);
  GEO.sign = mergeGeometries([new THREE.BoxGeometry(0.0015, 0.03, 0.0015).translate(0.004, 0.04, 0), new THREE.BoxGeometry(0.002, 0.015, 0.024).translate(0.004, 0.057, 0)]);
  GEO.hut = mergeGeometries([new THREE.CylinderGeometry(0.011, 0.011, 0.012, 8).translate(0, 0.006, 0), new THREE.ConeGeometry(0.016, 0.014, 8).translate(0, 0.019, 0)]);
  GEO.box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  GEO.boulder = new THREE.IcosahedronGeometry(0.008, 0);
  GEO.car = mergeGeometries([new THREE.BoxGeometry(0.042, 0.011, 0.02).translate(0, 0.0075, 0), new THREE.BoxGeometry(0.022, 0.009, 0.018).translate(-0.002, 0.0175, 0)]);
  GEO.truck = mergeGeometries([new THREE.BoxGeometry(0.05, 0.012, 0.022).translate(0, 0.008, 0), new THREE.BoxGeometry(0.016, 0.012, 0.02).translate(0.013, 0.02, 0),
    new THREE.CylinderGeometry(0.0015, 0.0015, 0.016, 4).rotateZ(Math.PI / 2).translate(-0.01, 0.022, 0)]);
  GEO.post = new THREE.CylinderGeometry(0.0012, 0.0012, 0.03, 4).translate(0, 0.015, 0);

  // 전차: 차체(경사 장갑·측면 스커트), 바퀴·궤도, 포탑(뒷부분·해치), 포신(머즐 브레이크)
  GEO.tankHull = mergeGeometries([
    new THREE.BoxGeometry(0.1, 0.02, 0.056).translate(-0.004, 0.031, 0),
    new THREE.BoxGeometry(0.03, 0.005, 0.056).rotateZ(-0.6).translate(0.053, 0.034, 0),
    new THREE.BoxGeometry(0.112, 0.012, 0.004).translate(0, 0.027, 0.031),
    new THREE.BoxGeometry(0.112, 0.012, 0.004).translate(0, 0.027, -0.031),
    new THREE.BoxGeometry(0.032, 0.004, 0.044).translate(-0.04, 0.043, 0),
  ]);
  const wheels = [];
  for (let i = 0; i < 6; i++) for (const z of [0.026, -0.026]) wheels.push(new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 10).rotateX(Math.PI / 2).translate(-0.045 + i * 0.018, 0.0105, z));
  for (const z of [0.026, -0.026]) {
    wheels.push(new THREE.BoxGeometry(0.118, 0.003, 0.012).translate(0, 0.0205, z));
    wheels.push(new THREE.BoxGeometry(0.106, 0.003, 0.012).translate(0, 0.0015, z));
  }
  GEO.tankRun = mergeGeometries(wheels);
  GEO.turret = mergeGeometries([
    new THREE.CylinderGeometry(0.023, 0.028, 0.018, 8).scale(1.2, 1, 1).translate(0, 0.009, 0),
    new THREE.BoxGeometry(0.024, 0.014, 0.036).translate(-0.031, 0.008, 0),
    new THREE.CylinderGeometry(0.006, 0.0065, 0.006, 8).translate(-0.008, 0.021, 0.01),
    new THREE.BoxGeometry(0.012, 0.012, 0.02).translate(0.028, 0.008, 0),
    new THREE.CylinderGeometry(0.0034, 0.004, 0.075, 8).rotateZ(Math.PI / 2).translate(0.068, 0.008, 0),
    new THREE.CylinderGeometry(0.005, 0.005, 0.009, 8).rotateZ(Math.PI / 2).translate(0.106, 0.008, 0),
    new THREE.CylinderGeometry(0.0004, 0.0004, 0.03, 3).translate(-0.03, 0.03, -0.012),
  ]);
  // 공격 헬기
  GEO.heli = mergeGeometries([
    new THREE.SphereGeometry(0.016, 12, 8).scale(1.7, 0.85, 0.75),
    new THREE.CylinderGeometry(0.0035, 0.0065, 0.07, 6).rotateZ(Math.PI / 2).translate(-0.058, 0.004, 0),
    new THREE.BoxGeometry(0.012, 0.016, 0.002).translate(-0.093, 0.011, 0),
    new THREE.BoxGeometry(0.01, 0.002, 0.05).translate(-0.002, -0.004, 0),
    new THREE.BoxGeometry(0.004, 0.006, 0.004).translate(0.002, -0.008, 0.024),
    new THREE.BoxGeometry(0.004, 0.006, 0.004).translate(0.002, -0.008, -0.024),
    new THREE.BoxGeometry(0.05, 0.002, 0.002).translate(0, -0.017, 0.011),
    new THREE.BoxGeometry(0.05, 0.002, 0.002).translate(0, -0.017, -0.011),
    new THREE.CylinderGeometry(0.002, 0.002, 0.008, 6).translate(0, 0.016, 0),
  ]);
  GEO.rotor = mergeGeometries([new THREE.BoxGeometry(0.12, 0.0012, 0.005), new THREE.BoxGeometry(0.005, 0.0012, 0.12)]);
  GEO.rotorDisc = new THREE.CircleGeometry(0.06, 32).rotateX(-Math.PI / 2);
  GEO.tailRotor = new THREE.BoxGeometry(0.0015, 0.022, 0.003);
  // 전투기
  GEO.jet = mergeGeometries([
    new THREE.CylinderGeometry(0.004, 0.006, 0.07, 8).rotateZ(Math.PI / 2),
    new THREE.ConeGeometry(0.004, 0.02, 8).rotateZ(-Math.PI / 2).translate(0.045, 0, 0),
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.012, 0, 0), new THREE.Vector3(-0.02, 0, 0.04), new THREE.Vector3(-0.026, 0, 0.04), new THREE.Vector3(-0.022, 0, 0), new THREE.Vector3(-0.026, 0, -0.04), new THREE.Vector3(-0.02, 0, -0.04)]).setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]),
    new THREE.BoxGeometry(0.014, 0.014, 0.0015).translate(-0.03, 0.007, 0),
  ].map((g) => {
    g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    return g.index ? g.toNonIndexed() : g;
  }));
}

export const MAT = {
  inst: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.02 }),
  flat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
  track: new THREE.MeshStandardMaterial({ color: 0x1e1d1b, roughness: 0.95, metalness: 0.3 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x3e3f44, roughness: 1 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x4a4e52, roughness: 0.6, metalness: 0.5 }),
  rotorDisc: new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  jet: new THREE.MeshStandardMaterial({ color: 0x7d858c, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }),
  shadow: new THREE.ShadowMaterial({ opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
};
export function facadeMat() {
  return new THREE.MeshStandardMaterial({ map: TX.facade, emissiveMap: TX.windows, emissive: 0xffd8a0, emissiveIntensity: 0, roughness: 0.9 });
}

const _o = new THREE.Object3D(), _c = new THREE.Color();
export function setInst(mesh, i, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix(); mesh.setMatrixAt(i, _o.matrix);
}
export function paint(mesh, i, hex) { mesh.setColorAt(i, _c.set(hex)); }
export function instanced(site, geo, n, mat = MAT.inst, { shadow = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.userData.caster = shadow;
  site.g.add(m);
  return m;
}
// 정적 인스턴스: 지형이 바뀌면 높이를 다시 맞춘다
export function placeStatic(site, mesh, items) {
  const apply = () => {
    items.forEach((it, i) => setInst(mesh, i, it.x, (it.y || 0) + site.groundY(it.x, it.z), it.z, it.ry || 0, it.sx ?? 1, it.sy ?? it.sx ?? 1, it.sz ?? it.sx ?? 1, it.rx || 0, it.rz || 0));
    mesh.instanceMatrix.needsUpdate = true;
  };
  apply();
  site.conform(apply);
  return apply;
}

export function makeTank(tex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.25 });
  const hull = new THREE.Mesh(GEO.tankHull, mat);
  const run = new THREE.Mesh(GEO.tankRun, MAT.track);
  const turret = new THREE.Mesh(GEO.turret, mat);
  turret.position.set(0.004, 0.041, 0);
  for (const m of [hull, run, turret]) m.userData.caster = true;
  g.add(hull, run, turret);
  return { g, turret };
}
export function makeHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(GEO.heli, new THREE.MeshStandardMaterial({ color: 0x3d4434, roughness: 0.6, metalness: 0.3 }));
  const rotor = new THREE.Mesh(GEO.rotor, MAT.track); rotor.position.y = 0.021;
  const disc = new THREE.Mesh(GEO.rotorDisc, MAT.rotorDisc); disc.position.y = 0.021;
  const tail = new THREE.Mesh(GEO.tailRotor, MAT.track); tail.position.set(-0.094, 0.012, 0.004);
  for (const m of [body, rotor]) m.userData.caster = true;
  g.add(body, rotor, disc, tail);
  return { g, rotor, tail };
}
export function makeJet() {
  const m = new THREE.Mesh(GEO.jet, MAT.jet);
  m.userData.caster = true;
  return m;
}
