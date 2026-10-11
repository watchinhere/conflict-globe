import * as THREE from 'three';
import { R, D2R, scene, camera, ll2v } from './core.js';
import { canonCountry, findCountries } from './data.js';

// 분쟁 지역 채색: 국가 전체가 아니라 해당 주·도(Natural Earth admin-1)만 사선 해칭으로 칠한다
const ZONES = {
  ukraine: ['Ukraine', ['donets', 'luhans', 'zapor', 'kherson', 'kharkiv']],
  sudan: ['Sudan', ['kordofan', 'kurdufan']],
  iran: ['Iran', ['tehran']],
  yemen: ['Yemen', ['hudayd', 'hodeid', 'hajjah', 'taizz', "ta'izz"]],
  drc: ['Democratic Republic of the Congo', ['nord-kivu', 'north kivu', 'sud-kivu', 'south kivu']],
  afpak: [['Afghanistan', ['kunar', 'nangarhar']], ['Pakistan', ['khyber', 'n.w.f.p', 'federally administered']]],
  ethiopia: ['Ethiopia', ['tigray']],
  sahel: ['Mali', ['segou', 'mopti']],
  gaza: ['Palestine', ['gaza']],
  lebanon: ['Lebanon', ['south', 'nabat']],
  haiti: ['Haiti', ['=ouest']],
  belgium: ['Belgium', ['brussels', 'bruxelles', 'liege']],
  delhi: ['India', ['delhi']],
  uyghur: ['China', ['xinjiang']],
  rohingya: ['Myanmar', ['rakhine', 'arakan']],
  darfur: ['Sudan', ['darfur']],
};
const fold = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

const VS = 'void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }';
const FS = `uniform vec3 uColor; uniform float uAlpha;
void main(){ float s=step(0.55,fract((gl_FragCoord.x+gl_FragCoord.y)/9.)); gl_FragColor=vec4(uColor,uAlpha*(0.45+0.55*s)); }`;

export const zones = { ready: false, provinces: [], byEvent: new Map() };
let readyResolve;
const ready = new Promise((r) => { readyResolve = r; });
export async function loadZones() {
  const list = await fetch(`data/provinces.json${new URL(import.meta.url).search}`).then((r) => r.json());
  zones.provinces = list.map((p) => {
    let bb = [180, 90, -180, -90];
    for (const poly of p.p) { const o = poly[0]; for (let i = 0; i < o.length; i += 2) bb = [Math.min(bb[0], o[i]), Math.min(bb[1], o[i + 1]), Math.max(bb[2], o[i]), Math.max(bb[3], o[i + 1])]; }
    return { ...p, c: canonCountry(p.a) || p.a, f: fold(p.n), bb };
  });
  zones.ready = true;
  readyResolve();
}
function inRing(r, x, y) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function provinceAt(lat, lon) {
  for (const p of zones.provinces) {
    if (lon < p.bb[0] || lon > p.bb[2] || lat < p.bb[1] || lat > p.bb[3]) continue;
    for (const poly of p.p) if (inRing(poly[0], lon, lat) && !poly.slice(1).some((h) => inRing(h, lon, lat))) return p;
  }
  return null;
}
function provincesFor(ev) {
  const spec = ZONES[ev.id];
  if (spec) {
    const groups = Array.isArray(spec[0]) ? spec : [spec];
    const out = [];
    for (const [country, pats] of groups) for (const p of zones.provinces) if (p.c === country && pats.some((k) => (k[0] === '=' ? p.f === k.slice(1) : p.f.includes(k))) && !out.includes(p)) out.push(p);
    if (out.length) return out;
  }
  // 정확한 위치가 없는 분쟁은 특정 지역이 아니라 나라 전체의 문제로 보고 국가 전체를 칠한다
  if (ev.approx || ev.nationwide) {
    const country = findCountries(ev.regionEn || ev.en || '')[0];
    return country ? zones.provinces.filter((p) => p.c === country) : [];
  }
  const p = provinceAt(ev.lat, ev.lon);
  return p ? [p] : [];
}

/* ---------- geometry ---------- */
function subdivide(tris, maxDeg) {
  const out = [];
  const stack = tris.slice();
  while (stack.length) {
    const t = stack.pop();
    const [a, b, c] = t, d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const ab = d(a, b), bc = d(b, c), ca = d(c, a), m = Math.max(ab, bc, ca);
    if (m <= maxDeg || out.length > 60000) { out.push(t); continue; }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (m === ab) { const k = mid(a, b); stack.push([a, k, c], [k, b, c]); }
    else if (m === bc) { const k = mid(b, c); stack.push([a, b, k], [a, k, c]); }
    else { const k = mid(c, a); stack.push([a, b, k], [k, b, c]); }
  }
  return out;
}
function buildZone(provs, color) {
  const pos = [], line = [], r = R + 0.0004;
  let cx = 0, cy = 0, cz = 0, n = 0;
  for (const p of provs) for (const poly of p.p) {
    const rings = poly.map((f) => {
      const pts = [];
      for (let i = 0; i < f.length; i += 2) pts.push(new THREE.Vector2(f[i], f[i + 1]));
      if (pts.length > 1 && pts[0].equals(pts[pts.length - 1])) pts.pop();
      return pts;
    });
    const outer = rings[0], holes = rings.slice(1);
    let faces;
    try { faces = THREE.ShapeUtils.triangulateShape(outer, holes); } catch { continue; }
    const all = [...outer, ...holes.flat()];
    const tris = subdivide(faces.map((f) => f.map((i) => [all[i].x, all[i].y])), 0.8);
    for (const t of tris) for (const [lo, la] of t) { const v = ll2v(la, lo, r); pos.push(v.x, v.y, v.z); cx += v.x; cy += v.y; cz += v.z; n++; }
    for (const ring of rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const va = ll2v(a.y, a.x, r + 0.0001), vb = ll2v(b.y, b.x, r + 0.0001);
      line.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
    }
  }
  if (!n) return null;
  const col = new THREE.Color(color);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const fill = new THREE.Mesh(fg, new THREE.ShaderMaterial({ uniforms: { uColor: { value: col }, uAlpha: { value: 0.2 } }, vertexShader: VS, fragmentShader: FS,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
  const edge = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.75, depthWrite: false, depthTest: false }));
  fill.renderOrder = 1; edge.renderOrder = 1; fill.frustumCulled = edge.frustumCulled = false;
  const g = new THREE.Group(); g.add(fill, edge); scene.add(g);
  const center = new THREE.Vector3(cx, cy, cz).normalize();
  let ang = 0;
  for (let i = 0; i < pos.length; i += 9) ang = Math.max(ang, center.angleTo(new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2])));
  return { g, fill, edge, center, ang, names: provs.map((p) => ({ ko: p.k || p.n, en: p.n })) };
}
function dispose(z) { scene.remove(z.g); z.fill.geometry.dispose(); z.fill.material.dispose(); z.edge.geometry.dispose(); z.edge.material.dispose(); }

// 사이트 목록과 동기화 (새 사건 추가·삭제·위치 보정 반영)
export async function syncZones(sites) {
  await ready;
  const live = new Set();
  for (const s of sites) {
    const key = `${s.ev.lat.toFixed(2)},${s.ev.lon.toFixed(2)},${s.ev.approx ? 1 : 0}`;
    live.add(s.id);
    const cur = zones.byEvent.get(s.id);
    if (cur && cur.key === key) continue;
    if (cur?.z) dispose(cur.z);
    const provs = provincesFor(s.ev);
    const z = provs.length ? buildZone(provs, s.color) : null;
    zones.byEvent.set(s.id, { key, z, site: s });
    s.ev.zoneNames = z?.names || null;
  }
  for (const [id, v] of zones.byEvent) if (!live.has(id)) { if (v.z) dispose(v.z); zones.byEvent.delete(id); }
}
const camDir = new THREE.Vector3();
export function updateZones(t, active, selected, alt) {
  camDir.copy(camera.position).normalize();
  const horizon = Math.acos(Math.min(1, R / camera.position.length()));
  for (const { z, site } of zones.byEvent.values()) {
    if (!z) continue;
    const on = active.has(site.cat) && Math.acos(Math.max(-1, Math.min(1, z.center.dot(camDir)))) < horizon + z.ang;
    z.g.visible = on;
    if (!on) continue;
    const sel = site === selected;
    // 멀리서는 깜빡여 눈에 띄게, 가까이서는 지도를 가리지 않도록 잔잔하게
    const far = THREE.MathUtils.smoothstep(alt, 0.35, 0.9), blink = 0.5 + 0.5 * Math.sin(t * 4 + (site.id.length % 7));
    const base = sel ? 0.3 + 0.08 * Math.sin(t * 2.2) : alt < 0.3 ? 0.12 : 0.2;
    z.fill.material.uniforms.uAlpha.value = base * (1 - far) + far * (0.08 + 0.42 * blink);
    z.edge.material.opacity = (sel ? 0.95 : 0.6) * (1 - far) + far * (0.35 + 0.65 * blink);
  }
}
