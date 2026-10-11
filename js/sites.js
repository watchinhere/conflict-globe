import * as THREE from 'three';
import { R, ll2v, v2ll, app, scene } from './core.js';
import { CATS } from './data.js';
import { terrain, heightAt, heightUnits } from './terrain.js';
import { BUILD, BEACON } from './scenes.js';

export const sites = [];
const byId = new Map();
export const sitesRoot = new THREE.Group();
scene.add(sitesRoot);
const Y = new THREE.Vector3(0, 1, 0), AX = new THREE.Vector3(), AZ = new THREE.Vector3(), W = new THREE.Vector3();
const HF = 15, HF_EXT = 1.3;
export const labelsEl = document.getElementById('labels');

export class Site {
  constructor(ev) {
    this.ev = ev; this.id = ev.id; this.cat = ev.cat;
    this.color = CATS[ev.cat].color;
    this.size = ev.size ?? (ev.cat === 'war' ? 1 : 0.7);
    this.uScale = { value: 0.05 };
    this.hl = 1; this.focused = false; this.vis = false; this.detailOn = false;
    this.fns = []; this.bfns = []; this.conformFns = []; this.grounds = []; this.world = [];
    this.hf = null; this.hfScale = 0; this.hfVersion = -1;
    this.sx = 0; this.sy = 0; this.pr = 0;
    this.root = new THREE.Group();
    this.spin = new THREE.Quaternion().setFromAxisAngle(Y, Math.random() * Math.PI * 2);
    this.place(ev.lat, ev.lon);
    this.beacon = new THREE.Group(); this.bfx = new THREE.Group(); this.beacon.add(this.bfx);
    this.root.add(this.beacon);
    this.detail = null;
    this.g = this.beacon;
    BEACON(this);
    sitesRoot.add(this.root);
    this.tag = document.createElement('button');
    this.tag.type = 'button';
    this.tag.addEventListener('click', () => app.select?.(this, true));
    labelsEl.appendChild(this.tag);
    this.refreshTag();
  }
  place(lat, lon) {
    this.normal = ll2v(lat, lon).normalize();
    this.pos = this.normal.clone().multiplyScalar(R + 0.0005);
    this.root.position.copy(this.pos);
    this.root.quaternion.setFromUnitVectors(Y, this.normal).multiply(this.spin);
    this.hfVersion = -1;
  }
  refreshTag() {
    const ev = this.ev;
    this.tag.className = 'tag' + (ev.minor ? ' small' : '') + (ev.auto ? ' auto' : '');
    this.tag.style.setProperty('--c', this.color);
    this.tag.textContent = ev.short || ev.name;
    this.tagW = 0;
  }
  on(fn) { (this.g === this.detail && this.detail ? this.fns : this.bfns).push(fn); }
  conform(fn) { this.conformFns.push(fn); }
  ground(mesh) { this.grounds.push(mesh); this.applyGround(mesh); }
  addWorld(obj) { sitesRoot.add(obj); this.world.push(obj); }
  ensureDetail() {
    if (this.detail) return;
    this.detail = new THREE.Group();
    this.root.add(this.detail);
    this.g = this.detail;
    try { BUILD[this.cat](this); } catch (e) { console.error('scene build failed', this.id, e); }
    this.g = this.beacon;
    this.setCasters(this.focused);
  }
  setCasters(on) {
    if (!this.detail) return;
    this.detail.traverse((o) => { if (o.userData.caster) o.castShadow = on; });
    if (this.shadowMesh) this.shadowMesh.visible = on;
  }
  groundY(x, z) {
    const hf = this.hf;
    if (!hf) return 0;
    const gx = Math.max(0, Math.min(HF - 1.001, (x / HF_EXT * 0.5 + 0.5) * (HF - 1)));
    const gz = Math.max(0, Math.min(HF - 1.001, (z / HF_EXT * 0.5 + 0.5) * (HF - 1)));
    const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j;
    const v = (hf[j * HF + i] * (1 - fx) + hf[j * HF + i + 1] * fx) * (1 - fz) + (hf[(j + 1) * HF + i] * (1 - fx) + hf[(j + 1) * HF + i + 1] * fx) * fz;
    return v / this.uScale.value;
  }
  applyGround(m) {
    const p = m.geometry.attributes.position;
    if (!this.hf && !m.userData.bent) return;
    m.userData.bent = !!this.hf;
    for (let i = 0; i < p.count; i++) p.setY(i, this.groundY(m.position.x + p.getX(i) * m.scale.x, m.position.z + p.getZ(i) * m.scale.z));
    p.needsUpdate = true;
  }
  updateTerrain(scale) {
    if (terrain.version === this.hfVersion && Math.abs(scale - this.hfScale) < this.hfScale * 0.04) return;
    this.hfVersion = terrain.version; this.hfScale = scale;
    const hc = terrain.valid ? heightAt(this.ev.lat, this.ev.lon) : 0, hcU = heightUnits(hc);
    this.root.position.copy(this.normal).multiplyScalar(R + 0.0005 + hcU);
    let hf = null;
    if (terrain.valid) {
      hf = new Float32Array(HF * HF);
      AX.set(1, 0, 0).applyQuaternion(this.root.quaternion); AZ.set(0, 0, 1).applyQuaternion(this.root.quaternion);
      let any = false;
      for (let j = 0; j < HF; j++) for (let i = 0; i < HF; i++) {
        const x = (i / (HF - 1) * 2 - 1) * HF_EXT, z = (j / (HF - 1) * 2 - 1) * HF_EXT;
        W.copy(this.normal).addScaledVector(AX, x * scale).addScaledVector(AZ, z * scale);
        const ll = v2ll(W), dh = heightUnits(heightAt(ll.lat, ll.lon)) - hcU;
        hf[j * HF + i] = dh;
        if (Math.abs(dh) > 2e-7) any = true;
      }
      if (!any) hf = null;
    }
    const changed = !!hf || !!this.hf;
    this.hf = hf;
    if (!changed) return;
    for (const m of this.grounds) this.applyGround(m);
    for (const f of this.conformFns) f();
  }
  update(t) {
    for (const f of this.bfns) f(t);
    if (this.detailOn) for (const f of this.fns) f(t);
  }
  dispose() {
    sitesRoot.remove(this.root);
    for (const o of this.world) { sitesRoot.remove(o); o.geometry?.dispose(); o.material?.dispose(); }
    this.root.traverse((o) => {
      if (o.isPoints || o.isLineSegments || o.isLine) { o.geometry.dispose(); o.material.dispose(); }
      else if (o.isInstancedMesh) o.dispose();
    });
    this.tag.remove();
  }
}

export const getSite = (id) => byId.get(id);
export function upsert(ev) {
  const s = byId.get(ev.id);
  if (!s) { const n = new Site(ev); sites.push(n); byId.set(ev.id, n); return n; }
  const moved = Math.abs(ev.lat - s.ev.lat) + Math.abs(ev.lon - s.ev.lon) > 0.15;
  Object.assign(s.ev, ev);
  if (moved) s.place(ev.lat, ev.lon);
  s.refreshTag();
  return s;
}
export function removeWhere(pred) {
  for (const s of [...sites]) {
    if (!pred(s)) continue;
    s.dispose();
    sites.splice(sites.indexOf(s), 1);
    byId.delete(s.id);
    if (app.selected === s) app.closePanel?.();
  }
}
