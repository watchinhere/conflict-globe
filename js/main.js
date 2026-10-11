import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { R, canvas, camera, composer, renderer, shared, sunDir, sunLight, ambient, fxLights, manager, earthMat, atmoMat, updateSun, app, view } from './core.js';
import { EVENTS } from './data.js';
import { sites, upsert } from './sites.js';
import { updatePatch, patch, patchMesh } from './terrain.js';
import { renderFilters, renderList, renderFeeds, active, closePanel } from './ui.js';
import { startLive } from './live.js';
import { loadGeo, placeGeoLabels, locate, coordText } from './geo.js';
import { updateTiles } from './tiles.js';
import { loadZones, syncZones, updateZones } from './zones.js';
import { t as tr } from './i18n.js';

const $ = (id) => document.getElementById(id);
manager.onProgress = (_u, done, total) => { $('loadMsg').textContent = tr('loadingN', { done, total }); };
manager.onLoad = () => $('loader').classList.add('done');
manager.onError = () => { $('loadMsg').className = 'err'; $('loadMsg').textContent = tr('loadErr'); };

/* ---------- camera ---------- */
const Y = new THREE.Vector3(0, 1, 0);
let controls = null, mode = 'global', flight = null, idleSince = performance.now();
function makeControls(target) {
  controls?.dispose();
  controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false;
  if (mode === 'global') { controls.minDistance = R + 0.008; controls.maxDistance = 7; controls.zoomSpeed = 0.9; }
  else { controls.minDistance = 0.008; controls.maxDistance = 0.6; controls.maxPolarAngle = 1.4; controls.zoomSpeed = 0.8; controls.rotateSpeed = 0.5; }
  controls.autoRotateSpeed = 0.35;
  controls.addEventListener('start', () => { idleSince = Infinity; controls.autoRotate = false; canvas.classList.add('drag'); });
  controls.addEventListener('end', () => { idleSince = performance.now(); canvas.classList.remove('drag'); });
  controls.update();
}
makeControls(new THREE.Vector3());

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function slerpV(a, b, e) {
  const ang = a.angleTo(b);
  if (ang < 1e-5) return a.clone();
  const s = Math.sin(ang);
  return a.clone().multiplyScalar(Math.sin((1 - e) * ang) / s).add(b.clone().multiplyScalar(Math.sin(e * ang) / s));
}
function flyTo(p1, t1, u1, newMode, dur = 2.4) {
  controls.enabled = false;
  const p0 = camera.position.clone();
  flight = { p0, t0: controls.target.clone(), u0: camera.up.clone(), p1, t1, u1, mode: newMode, k: 0, dur, ang: p0.clone().normalize().angleTo(p1.clone().normalize()) };
}
function stepFlight(dt) {
  const f = flight;
  f.k = Math.min(1, f.k + dt / f.dur);
  const e = ease(f.k), r0 = f.p0.length(), r1 = f.p1.length();
  const dir = slerpV(f.p0.clone().normalize(), f.p1.clone().normalize(), e);
  const hump = Math.sin(Math.PI * e) * Math.min(1.4, f.ang * 0.85);
  camera.position.copy(dir.multiplyScalar(r0 + (r1 - r0) * e + hump));
  const up = f.u0.clone().lerp(f.u1, e);
  camera.up.copy(up.lengthSq() > 1e-4 ? up.normalize() : f.u1);
  camera.lookAt(f.t0.clone().lerp(f.t1, e));
  if (f.k >= 1) {
    mode = f.mode; camera.up.copy(f.u1); camera.position.copy(f.p1);
    makeControls(f.t1); flight = null;
    $('globeBtn').hidden = mode === 'global';
  }
}
function setFocus(site) {
  if (app.focused === site) return;
  if (app.focused) { app.focused.focused = false; app.focused.setCasters(false); }
  app.focused = site;
  if (site) { site.focused = true; site.ensureDetail(); site.setCasters(true); }
}
app.focusOn = (site) => {
  setFocus(site);
  const N = site.normal, P = site.root.position.clone();
  const east = new THREE.Vector3().crossVectors(Y, N);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = new THREE.Vector3().crossVectors(N, east);
  const d = 0.034 + 0.034 * site.size;
  flyTo(P.clone().addScaledVector(N, d * 0.72).addScaledVector(north, -d * 0.7), P, N.clone(), 'focus');
};
function goGlobal() {
  setFocus(null);
  if (mode === 'global' && !flight) return;
  const dir = (flight ? flight.t1 : controls.target).clone();
  if (dir.lengthSq() < 1e-6) dir.copy(camera.position);
  flyTo(dir.normalize().multiplyScalar(R + 1.7), new THREE.Vector3(), Y.clone(), 'global', 2);
}
app.goGlobal = goGlobal;
$('globeBtn').addEventListener('click', goGlobal);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.target.closest?.('input')) { closePanel(); goGlobal(); } });

/* ---------- picking ---------- */
let down = null, hover = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
  if (moved > 6) return;
  const s = pickAt(e.clientX, e.clientY);
  if (s) app.select(s, true);
});
let pointer = null, locAt = 0, zoneAt = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerleave', () => { pointer = null; });
function hitGlobe(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction, b = o.dot(d), c = o.lengthSq() - R * R, disc = b * b - c;
  return disc < 0 ? null : o.clone().addScaledVector(d, -b - Math.sqrt(disc));
}
function updateLoc() {
  const p = (pointer && hitGlobe(pointer.x, pointer.y)) || viewCenter();
  const el = $('loc');
  if (!p) { el.hidden = true; return; }
  const r = p.length(), lat = 90 - Math.acos(p.y / r) * 180 / Math.PI;
  let lon = Math.atan2(p.z, -p.x) * 180 / Math.PI - 180; if (lon < -180) lon += 360;
  const l = locate(lat, lon);
  if (!l) return;
  el.hidden = false;
  el.innerHTML = `<span class="lk mono">${pointer ? 'CURSOR' : 'CENTER'}</span><b>${l.country}</b>${l.near ? `<span>${l.near}</span>` : ''}<span class="mono">${coordText(lat, lon)}</span>`;
}
canvas.addEventListener('pointermove', (e) => {
  pointer = { x: e.clientX, y: e.clientY };
  if (e.buttons) return;
  const s = pickAt(e.clientX, e.clientY);
  if (s !== hover) { if (hover && hover !== app.selected) hover.tag.classList.remove('sel'); hover = s; if (s) s.tag.classList.add('sel'); }
  canvas.classList.toggle('hot', !!s);
});
function pickAt(x, y) {
  let best = null, bd = Infinity;
  for (const s of sites) {
    if (!s.vis) continue;
    const d = Math.hypot(s.sx - x, s.sy - y), th = Math.max(16, Math.min(160, s.pr * 0.75));
    if (d < th && d < bd) { bd = d; best = s; }
  }
  return best;
}

/* ---------- loop ---------- */
const clock = new THREE.Clock(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const attrib = $('attrib');
function viewCenter() {
  if (mode === 'focus') return controls.target.clone();
  const o = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
  const b = o.dot(d), c = o.lengthSq() - R * R, disc = b * b - c;
  if (disc < 0) return null;
  return o.clone().addScaledVector(d, -b - Math.sqrt(disc));
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  shared.uTime.value += dt;
  const t = shared.uTime.value, now = performance.now();

  if (flight) stepFlight(dt);
  else {
    if (mode === 'global') {
      controls.rotateSpeed = Math.max(0.02, Math.min(1, (camera.position.length() - R) * 0.55));
      controls.autoRotate = !reduce && !app.selected && now - idleSince > 20000;
    } else if (camera.position.distanceTo(controls.target) > 0.5) goGlobal();
    controls.update();
  }
  const alt = camera.position.length() - R;
  view.alt = alt;
  camera.near = Math.max(0.0004, Math.min(0.5, alt * 0.3));
  camera.updateProjectionMatrix();
  shared.uPixel.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
  earthMat.uniforms.cloudAmt.value = 0.15 + 0.85 * THREE.MathUtils.smoothstep(alt, 0.05, 0.7);
  view.ring = 0.3 + 0.7 * THREE.MathUtils.smoothstep(alt, 0.08, 0.8);
  atmoMat.uniforms.inside.value = alt < 0.035 ? 1 : 0;

  updateTiles(now);
  updatePatch(now, alt, viewCenter());
  if (patchMesh.visible) { patch.fade = Math.min(1, patch.fade + dt * 2.5); patchMesh.material.uniforms.uFade.value = patch.fade; }
  attrib.textContent = tr(patch.active ? 'attribPatch' : 'attribBase');

  // 폭발 섬광 감쇠, 지속 조명은 사이트가 매 프레임 다시 켠다
  for (let i = 0; i < 2; i++) {
    const l = fxLights[i], u = l.userData, k = (t - u.t0) / u.dur;
    l.intensity = k >= 0 && k < 1 ? u.power * 8 * (0.3 * u.scale) ** 2 * (1 - k) ** 2 : 0;
    l.distance = u.scale * 1.6;
  }
  fxLights[2].intensity = 0;

  const foc = app.focused;
  ambient.intensity = foc ? 0.4 + 0.6 * THREE.MathUtils.smoothstep(foc.normal.dot(sunDir), -0.1, 0.25) : 1.0;
  if (foc && foc.normal.dot(sunDir) > 0.02) {
    const sc = foc.uScale.value;
    foc.root.getWorldPosition(tmp);
    sunLight.position.copy(tmp).addScaledVector(sunDir, 0.3);
    sunLight.target.position.copy(tmp);
    const cam = sunLight.shadow.camera;
    cam.left = cam.bottom = -sc * 1.4; cam.right = cam.top = sc * 1.4; cam.near = 0.2; cam.far = 0.4;
    cam.updateProjectionMatrix();
  } else {
    sunLight.position.copy(sunDir).multiplyScalar(10); sunLight.target.position.set(0, 0, 0);
  }

  pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  const scaleBase = Math.min(0.09, Math.max(0.022, 0.016 + alt * 0.035));
  const camP = camera.position, W = innerWidth, H = innerHeight, showMinor = alt < 0.5;
  const tagCands = [];
  let builds = 0;
  for (const s of sites) {
    const sc = scaleBase * s.size;
    const facing = s.normal.dot(camP) > R + 0.002 - sc * 0.5;
    sph.center.copy(s.root.position); sph.radius = sc * 1.4;
    const on = active.has(s.cat) && facing && frustum.intersectsSphere(sph);
    s.root.visible = on; s.vis = on;
    if (!on) { s.tag.hidden = true; continue; }
    s.root.scale.setScalar(sc); s.uScale.value = sc;
    s.updateTerrain(sc);
    tmp.copy(s.root.position).addScaledVector(s.normal, sc * 0.18).project(camera);
    s.sx = (tmp.x * 0.5 + 0.5) * W; s.sy = (-tmp.y * 0.5 + 0.5) * H;
    tmp2.copy(s.root.position).addScaledVector(camera.up, sc).project(camera);
    s.pr = Math.hypot((tmp2.x - tmp.x) * 0.5 * W, (tmp2.y - tmp.y) * 0.5 * H);
    const want = s.pr > (s.detailOn ? 26 : 36) || s === foc;
    if (want && !s.detail && builds < 2) { s.ensureDetail(); builds++; }
    s.detailOn = want && !!s.detail;
    if (s.detail) s.detail.visible = s.detailOn;
    s.bfx.visible = !s.detailOn;
    s.update(t);
    const minor = !!s.ev.minor;
    if ((!minor || showMinor || s === app.selected) && !(s === app.selected && mode === 'focus' && !flight)) tagCands.push(s);
    else s.tag.hidden = true;
  }
  if (app.selected && tagCands.includes(app.selected)) tagCands.unshift(...tagCands.splice(tagCands.indexOf(app.selected), 1));
  const boxes = [];
  for (const s of tagCands) {
    s.tag.hidden = false;
    if (!s.tagW) s.tagW = s.tag.offsetWidth || 120;
    const b = [s.sx - s.tagW / 2 - 2, s.sy - 32, s.sx + s.tagW / 2 + 2, s.sy + 4];
    if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) { s.tag.hidden = true; continue; }
    boxes.push(b);
    s.tag.style.transform = `translate(${s.sx.toFixed(1)}px,${s.sy.toFixed(1)}px) translate(-50%,-140%)`;
  }
  placeGeoLabels(boxes, W, H);
  updateZones(t, active, app.selected, alt);
  if (now - zoneAt > 2000) { zoneAt = now; syncZones(sites); }
  if (now - locAt > 150) { locAt = now; updateLoc(); }
  composer.render();
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */
for (const ev of EVENTS) upsert(ev);
renderFilters(); renderList(); renderFeeds();
app.refreshUI();
requestAnimationFrame(frame);
setInterval(updateSun, 10000);
startLive();
loadGeo().then(() => app.refreshUI()).catch((e) => console.warn('geo data', e));
loadZones().then(() => syncZones(sites)).then(() => app.refreshUI()).catch((e) => console.warn('zones', e));
