import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { R, canvas, camera, composer, renderer, shared, sunDir, sunLight, ambient, fxLights, manager, earthMat, atmoMat, updateSun, app, view } from './core.js';
import { EVENTS, CATS, catName, levelName, casLabel } from './data.js';
import { sites, upsert } from './sites.js';
import { updatePatch, patch, patchMesh } from './terrain.js';
import { renderFilters, renderList, renderFeeds, active, closePanel } from './ui.js';
import { startLive } from './live.js';
import { loadGeo, placeGeoLabels, locate, coordText } from './geo.js';
import { updateTiles } from './tiles.js';
import { loadZones, syncZones, updateZones } from './zones.js';
import { t as tr, isEn, setLang } from './i18n.js';

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

// 비행은 '지면 조준점 · 거리 · 기울기 · 방위'로 기술한다. 조준점은 대원 경로를, 거리는 로그 공간을 따라가고
// 수평 이동은 높이에 비례해 진행시켜(van Wijk & Nuij 방식) 높이 떠서 건너가고 낮게 내려앉는다.
const ease = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k);
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const FOCUS_TILT = Math.atan2(0.7, 0.72), FOCUS_DIST = Math.hypot(0.72, 0.7);
function frameAt(g) {
  const east = new THREE.Vector3().crossVectors(Y, g);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  return { east, north: new THREE.Vector3().crossVectors(g, east) };
}
// 지금 카메라가 보고 있는 조준점·거리·기울기·방위
function currentPose() {
  const T = flight?.T ? flight.T.clone() : mode === 'focus' ? controls.target.clone() : camera.position.clone().setLength(R);
  const g = T.clone().normalize(), v = camera.position.clone().sub(T), dist = v.length();
  const tau = Math.acos(Math.min(1, Math.max(-1, v.dot(g) / dist)));
  const h = v.clone().addScaledVector(g, -v.dot(g)), { east, north } = frameAt(g);
  const psi = h.lengthSq() < 1e-10 ? 0 : Math.atan2(-h.dot(east), -h.dot(north));
  return { g, r: T.length(), dist, tau, psi };
}
function applyPose(g, r, dist, tau, psi) {
  const { east, north } = frameAt(g);
  const fwd = north.multiplyScalar(Math.cos(psi)).addScaledVector(east, Math.sin(psi));
  const T = g.clone().multiplyScalar(r);
  camera.position.copy(T).addScaledVector(g, Math.cos(tau) * dist).addScaledVector(fwd, -Math.sin(tau) * dist);
  camera.up.copy(fwd);
  camera.lookAt(T);
  return T;
}
function flyTo(T1, dist1, tau1, newMode, dur) {
  controls.enabled = false;
  const a = currentPose(), g1 = T1.clone().normalize(), ang = a.g.angleTo(g1);
  const L0 = Math.log(a.dist), L1 = Math.log(dist1);
  // 기본 시간은 건너는 거리와 확대 폭에 맞춘다
  dur ??= Math.min(4.2, 1.6 + ang * 0.9 + Math.abs(L1 - L0) * 0.16);
  // 두 지점이 한 화면에 들어올 만큼 떠오른다
  const peak = Math.log(Math.min(2.6, Math.max(a.dist, dist1, R * ang * 1.1)));
  const B = Math.max(0, peak - (L0 + L1) / 2);
  const logD = (e) => L0 + (L1 - L0) * e + B * Math.sin(Math.PI * e);
  const cum = [0];
  for (let i = 1; i <= 64; i++) cum.push(cum[i - 1] + Math.exp(logD((i - 0.5) / 64)));
  const psi0 = Math.atan2(Math.sin(a.psi), Math.cos(a.psi));
  flight = { a, g1, r1: T1.length(), ang, tau1, logD, cum, psi0, mode: newMode, k: 0, dur, dt: 1 / 60 };
  return new Promise((done) => { flight.done = done; });
}
function stepFlight(dt) {
  const f = flight;
  // 프레임 시간 흔들림이 움직임에 그대로 드러나지 않게 평활
  f.dt += (dt - f.dt) * 0.25;
  f.k = Math.min(1, f.k + f.dt / f.dur);
  const e = ease(f.k), i = e * 64, lo = Math.floor(i), c = f.cum;
  const u = (c[Math.min(64, lo)] + (c[Math.min(64, lo + 1)] - c[Math.min(64, lo)]) * (i - lo)) / c[64];
  const g = f.ang < 1e-5 ? f.g1.clone() : f.a.g.clone().applyAxisAngle(new THREE.Vector3().crossVectors(f.a.g, f.g1).normalize(), f.ang * u);
  const tau = f.a.tau * (1 - smooth(0, 0.35, e)) + f.tau1 * smooth(0.55, 1, e);
  const T = f.T = applyPose(g, f.a.r + (f.r1 - f.a.r) * e, Math.exp(f.logD(e)), tau, f.psi0 * (1 - smooth(0, 0.45, e)));
  if (f.k >= 1) {
    flight = null;
    mode = f.mode;
    if (mode === 'global') { camera.up.copy(Y); makeControls(new THREE.Vector3()); }
    else { camera.up.copy(g); makeControls(T); }
    $('globeBtn').hidden = mode === 'global';
    f.done();
  }
}
function setFocus(site) {
  if (app.focused === site) return;
  if (app.focused) { app.focused.focused = false; app.focused.setCasters(false); }
  app.focused = site;
  if (site) { site.focused = true; site.ensureDetail(); site.setCasters(true); }
}
app.focusOn = (site, dur) => {
  setFocus(site);
  const d = 0.034 + 0.034 * site.size;
  return flyTo(site.root.position.clone(), d * FOCUS_DIST, FOCUS_TILT, 'focus', dur);
};
function goGlobal(dur) {
  setFocus(null);
  if (mode === 'global' && !flight) return Promise.resolve();
  return flyTo(currentPose().g.multiplyScalar(R), 1.7, 0, 'global', dur);
}
app.goGlobal = goGlobal;
$('globeBtn').addEventListener('click', () => goGlobal());
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
// 기사 페이지의 "지구본에서 보기" 링크(index.html#ukraine 등)로 들어오면 해당 분쟁으로 이동
const deep = sites.find((s) => s.id === decodeURIComponent(location.hash.slice(1)));
if (deep) manager.onLoad = () => { $('loader').classList.add('done'); setTimeout(() => app.select(deep, true), 600); };

/* ---------- 영상 녹화 모드: ?rec=ukraine,sudan&speed=1&tags=0 ---------- */
// 화면 장식을 숨기고 SPACE(또는 클릭)로 시작하면 지정한 분쟁을 차례로 천천히 날아가 확대한다
const qs = new URLSearchParams(location.search);
if (qs.has('rec')) {
  document.body.classList.add('rec');
  if (['ko', 'en'].includes(qs.get('lang'))) setLang(qs.get('lang'));
  if (qs.get('tags') === '1') document.body.classList.add('rec-tags');
  const slow = Math.max(0.3, Math.min(4, 1 / (+qs.get('speed') || 1)));
  const ids = qs.get('rec').split(',').map((s) => s.trim()).filter(Boolean);
  const cap = document.createElement('div'), gate = document.createElement('div');
  cap.className = 'recCap'; gate.className = 'recGate mono';
  document.body.append(cap, gate);
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
  const caption = (s) => {
    const ev = s.ev, en = isEn(), cas = (ev.cas?.items || []).find((i) => i.k === 'killed');
    cap.style.setProperty('--c', CATS[ev.cat]?.color || '#e3aa45');
    cap.innerHTML = `<p class="mono">${catName(ev.cat)} · ${levelName(ev.level)} · ${en ? 'SINCE' : '시작'} ${String(ev.start).slice(0, 7).replace('-', '.')}</p>`
      + `<h2>${en ? ev.en || ev.name : ev.nameKo || ev.name}</h2><p>${(en ? ev.regionEn || ev.region : ev.region) || ''}</p>`
      + (cas ? `<p class="kia mono"><span>${casLabel('killed')}</span>${en ? cas.vEn || cas.v : cas.v}</p>` : '');
    cap.classList.add('on');
  };
  // 머무는 동안 천천히 돌되, 회전 속도를 서서히 올렸다 내린다
  const spin = (sec) => new Promise((done) => {
    const t0 = performance.now(), top = 0.45 / slow;
    controls.autoRotate = true;
    const tick = () => {
      const k = (performance.now() - t0) / 1000 / sec;
      if (k >= 1) { controls.autoRotate = false; controls.autoRotateSpeed = 0.35; return done(); }
      controls.autoRotateSpeed = top * smooth(0, 0.25, k) * (1 - smooth(0.75, 1, k));
      requestAnimationFrame(tick);
    };
    tick();
  });
  async function run() {
    gate.hidden = true;
    const list = ids.map((id) => sites.find((s) => s.id === id)).filter(Boolean);
    for (const s of list) {
      cap.classList.remove('on');
      await app.focusOn(s, 9 * slow);
      caption(s);
      await spin(8 * slow);
    }
    cap.classList.remove('on');
    setFocus(null);
    const last = list[list.length - 1];
    if (last) await flyTo(last.root.position.clone().setLength(R), 1.9, 0, 'global', 5 * slow);
    cap.innerHTML = `<h2>${tr('title')}</h2><p class="mono">watchinhere.github.io/conflict-globe</p>`;
    cap.style.setProperty('--c', '#e3aa45');
    cap.classList.add('on', 'end');
  }
  manager.onLoad = () => {
    $('loader').classList.add('done');
    gate.textContent = 'REC READY · SPACE / CLICK';
    const go = (e) => { if (e.type === 'keydown' && e.code !== 'Space') return; e.preventDefault(); removeEventListener('keydown', go); gate.removeEventListener('click', go); run(); };
    addEventListener('keydown', go); gate.addEventListener('click', go);
  };
}
renderFilters(); renderList(); renderFeeds();
app.refreshUI();
requestAnimationFrame(frame);
setInterval(updateSun, 10000);
startLive();
loadGeo().then(() => app.refreshUI()).catch((e) => console.warn('geo data', e));
loadZones().then(() => syncZones(sites)).then(() => app.refreshUI()).catch((e) => console.warn('zones', e));
