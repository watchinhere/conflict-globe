import * as THREE from 'three';
import { R, D2R, R2D, scene, camera, ll2v, view } from './core.js';
import { countryKo } from './data.js';

// Natural Earth 1:50m 국경·도시(한국어 이름)와 역지오코딩
export const geo = { ready: false, countries: [], cities: [] };
const layer = document.getElementById('geolabels');
const mats = {
  border: new THREE.LineBasicMaterial({ color: 0xf2f5fa, transparent: true, opacity: 0.45, depthWrite: false }),
  admin: new THREE.LineBasicMaterial({ color: 0xc9d6e8, transparent: true, opacity: 0.18, depthWrite: false }),
};

function lines(rings, r, closed) {
  const pos = [];
  for (const f of rings) {
    const n = f.length / 2, last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n, x0 = f[i * 2], y0 = f[i * 2 + 1], x1 = f[j * 2], y1 = f[j * 2 + 1];
      if (Math.abs(x1 - x0) > 180) continue;
      const a = ll2v(y0, x0, r), b = ll2v(y1, x1, r);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
const mkLabel = (cls, text) => {
  const el = document.createElement('div');
  el.className = cls; el.textContent = text; el.hidden = true;
  layer.appendChild(el);
  return el;
};

export async function loadGeo() {
  const [countries, cities, admin1] = await Promise.all(['countries', 'cities', 'admin1'].map((n) => fetch(`data/${n}.json`).then((r) => r.json())));
  const rings = [];
  geo.countries = countries.map((c) => {
    let bb = [180, 90, -180, -90];
    for (const poly of c.p) { rings.push(...poly); const o = poly[0]; for (let i = 0; i < o.length; i += 2) { bb = [Math.min(bb[0], o[i]), Math.min(bb[1], o[i + 1]), Math.max(bb[2], o[i]), Math.max(bb[3], o[i + 1])]; } }
    const short = countryKo(c.en);
    const ko = short !== c.en ? short : c.ko;
    return { ...c, ko, bb, n: ll2v(c.ly, c.lx).normalize(), el: mkLabel(`glab country r${Math.min(c.r, 6)}`, ko), w: 0 };
  });
  const border = new THREE.LineSegments(lines(rings, R + 0.00025, true), mats.border);
  const adm = new THREE.LineSegments(lines(admin1, R + 0.0002, false), mats.admin);
  border.renderOrder = adm.renderOrder = 1;
  scene.add(border, adm);
  geo.border = border; geo.admin = adm;
  geo.cities = cities.map(([ko, en, lat, lon, sr, pop, cap]) => ({ ko, en, lat, lon, sr, pop, cap, n: ll2v(lat, lon).normalize(), el: mkLabel(`glab city${cap === 2 ? ' cap' : ''}`, ko), w: 0 }))
    .sort((a, b) => a.sr - b.sr || b.pop - a.pop);
  geo.ready = true;
}

/* ---------- reverse geocoding ---------- */
function inRing(r, x, y) {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function countryAt(lat, lon) {
  for (const c of geo.countries) {
    if (lon < c.bb[0] || lon > c.bb[2] || lat < c.bb[1] || lat > c.bb[3]) continue;
    for (const poly of c.p) if (inRing(poly[0], lon, lat) && !poly.slice(1).some((h) => inRing(h, lon, lat))) return c;
  }
  return null;
}
const DIR8 = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
function distKm(la1, lo1, la2, lo2) {
  const a = Math.sin((la2 - la1) * D2R / 2) ** 2 + Math.cos(la1 * D2R) * Math.cos(la2 * D2R) * Math.sin((lo2 - lo1) * D2R / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
export function locate(lat, lon) {
  if (!geo.ready) return null;
  const c = countryAt(lat, lon);
  let best = null, bd = Infinity;
  for (const p of geo.cities) { const d = distKm(lat, lon, p.lat, p.lon); if (d < bd) { bd = d; best = p; } }
  let near = '';
  if (best && bd < 400) {
    if (bd < 12) near = `${best.ko}`;
    else {
      const y = Math.sin((lon - best.lon) * D2R) * Math.cos(lat * D2R);
      const x = Math.cos(best.lat * D2R) * Math.sin(lat * D2R) - Math.sin(best.lat * D2R) * Math.cos(lat * D2R) * Math.cos((lon - best.lon) * D2R);
      const brg = (Math.atan2(y, x) * R2D + 360) % 360;
      near = `${best.ko} ${DIR8[Math.round(brg / 45) % 8]}쪽 ${Math.round(bd)}km`;
    }
  }
  return { country: c ? c.ko : '해상', near, city: best, km: bd };
}
export const coordText = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;

/* ---------- labels ---------- */
const tmp = new THREE.Vector3();
function place(item, boxes, W, H, h, lift) {
  tmp.copy(item.n).multiplyScalar(R + lift).project(camera);
  if (tmp.z > 1 || Math.abs(tmp.x) > 1.05 || Math.abs(tmp.y) > 1.05) { item.el.hidden = true; return; }
  const x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
  if (item.el.hidden) { item.el.hidden = false; if (!item.w) item.w = item.el.offsetWidth || 60; }
  const b = [x - item.w / 2 - 3, y - h / 2 - 2, x + item.w / 2 + 3, y + h / 2 + 2];
  if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) { item.el.hidden = true; return; }
  boxes.push(b);
  item.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
}
export function placeGeoLabels(boxes, W, H) {
  if (!geo.ready) return;
  const alt = view.alt, cam = camera.position, edge = R * 1.004;
  geo.border.material.opacity = 0.2 + 0.3 * THREE.MathUtils.smoothstep(alt, 0.05, 0.6);
  geo.admin.visible = alt < 1.3;
  const rMax = alt > 2.4 ? 2 : alt > 1.6 ? 3 : alt > 1.0 ? 4 : alt > 0.55 ? 5 : 7;
  const sMax = alt > 2.0 ? -1 : alt > 1.3 ? 1 : alt > 0.8 ? 2 : alt > 0.45 ? 4 : alt > 0.22 ? 7 : 10;
  for (const c of geo.cities) {
    if ((c.sr <= sMax || (c.cap === 2 && sMax >= 1)) && c.n.dot(cam) > edge) place(c, boxes, W, H, 16, 0.0008);
    else c.el.hidden = true;
  }
  for (const c of geo.countries) {
    if (c.r <= rMax && c.n.dot(cam) > edge) place(c, boxes, W, H, 18, 0.001);
    else c.el.hidden = true;
  }
}
