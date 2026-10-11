import * as THREE from 'three';
import { R, D2R, R2D, scene, camera, sunDir, shared, T, CLOUD_FN, earthMat, maxAniso, ll2v } from './core.js';

// 구글어스식 쿼드트리 위성 타일: 화면에 보이는 모든 곳을 거리에 맞는 해상도의 Esri 타일로 채운다
const MINZ = 2, MAXZ = 16, MAX_LOADING = 10, MAX_CACHE = 450, SPLIT_PX = 360;
const tileUrl = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const group = new THREE.Group();
scene.add(group);
const cache = new Map();
let loading = 0, lastUpdate = 0;
export const tileStats = { visible: 0, loading: 0, maxZ: 0 };

const VS = `
attribute vec2 aEq; varying vec2 vUv; varying vec2 vEq; varying vec3 vP;
void main(){ vUv=uv; vEq=aEq; vP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const FS = `
uniform sampler2D map, nightMap, brcMap; uniform vec3 sunDir; uniform float uTime, cloudAmt;
varying vec2 vUv; varying vec2 vEq; varying vec3 vP;
${CLOUD_FN}
void main(){
  vec3 N=normalize(vP); float NdL=dot(N,sunDir);
  float dayMix=smoothstep(-0.10,0.20,NdL);
  vec3 c=texture2D(map,vUv).rgb;
  vec3 col=c*(max(NdL,0.)*1.3+0.025);
  float cl=cloudAt(vEq);
  vec3 cloudCol=vec3(1.)*(max(NdL,0.)*1.0+0.006);
  cloudCol*=mix(vec3(1.,.55,.32),vec3(1.),smoothstep(0.,0.28,NdL));
  col=mix(col,cloudCol,cl*0.93);
  vec3 lights=texture2D(nightMap,vEq).rgb*vec3(1.,.8,.55)*2.8*(1.-cl*0.85);
  col=col*dayMix+lights*(1.-dayMix)*(1.-smoothstep(-0.25,0.05,NdL)*0.6)+c*0.012;
  vec3 V=normalize(cameraPosition-vP);
  float fr=pow(1.-max(dot(N,V),0.),4.);
  vec3 atm=mix(vec3(1.,.42,.18),vec3(.30,.58,1.),smoothstep(-.05,.35,NdL));
  col+=atm*fr*smoothstep(-.25,.4,NdL)*1.1;
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const sharedUniforms = { nightMap: { value: T.night }, brcMap: { value: T.brc }, sunDir: { value: sunDir }, uTime: shared.uTime, cloudAmt: earthMat.uniforms.cloudAmt };

const mercLat = (yt, n) => Math.atan(Math.sinh(Math.PI * (1 - 2 * yt / n))) * R2D;
function makeTile(z, x, y) {
  const n = 2 ** z, lon0 = x / n * 360 - 180, lon1 = (x + 1) / n * 360 - 180, latN = mercLat(y, n), latS = mercLat(y + 1, n);
  const latC = mercLat(y + 0.5, n), lonC = (lon0 + lon1) / 2;
  const c = ll2v(latC, lonC), nrm = c.clone().normalize();
  let rad = 0;
  for (const [la, lo] of [[latN, lon0], [latN, lon1], [latS, lon0], [latS, lon1], [latN, lonC], [latS, lonC]]) rad = Math.max(rad, ll2v(la, lo).distanceTo(c));
  const w = Math.max((lon1 - lon0) * D2R * Math.cos(latC * D2R), (latN - latS) * D2R);
  return { key: `${z}/${x}/${y}`, z, x, y, c, n: nrm, rad, ang: Math.asin(Math.min(1, rad)), w, state: 'new', mesh: null, used: 0 };
}
function buildMesh(t, tex) {
  const { z, x, y } = t, n = 2 ** z, seg = z <= 2 ? 64 : z === 3 ? 32 : z === 4 ? 16 : 8;
  const r = R + 0.00004 + z * 0.000004, center = t.c.clone().multiplyScalar(r);
  const cnt = (seg + 1) ** 2, pos = new Float32Array(cnt * 3), uv = new Float32Array(cnt * 2), eq = new Float32Array(cnt * 2), idx = [];
  let k = 0;
  for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
    const lon = (x + i / seg) / n * 360 - 180, lat = mercLat(y + j / seg, n), v = ll2v(lat, lon, r).sub(center);
    pos.set([v.x, v.y, v.z], k * 3); uv.set([i / seg, 1 - j / seg], k * 2); eq.set([(lon + 180) / 360, (lat + 90) / 180], k * 2); k++;
  }
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + 1, c2 = a + seg + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aEq', new THREE.BufferAttribute(eq, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...sharedUniforms, map: { value: tex } }, vertexShader: VS, fragmentShader: FS }));
  m.position.copy(center);
  m.frustumCulled = false;
  m.visible = false;
  group.add(m);
  t.mesh = m;
}
function load(t) {
  t.state = 'loading'; loading++;
  const im = new Image();
  im.crossOrigin = 'anonymous';
  const done = (ok) => {
    loading--;
    if (!ok) { t.state = 'failed'; t.failedAt = performance.now(); return; }
    const tex = new THREE.Texture(im);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso; tex.needsUpdate = true;
    buildMesh(t, tex);
    t.state = 'ready';
  };
  im.onload = () => done(true);
  im.onerror = () => done(false);
  im.src = tileUrl(t.z, t.x, t.y);
}
function get(z, x, y) {
  const key = `${z}/${x}/${y}`;
  let t = cache.get(key);
  if (!t) { t = makeTile(z, x, y); cache.set(key, t); }
  return t;
}
function readyAncestor(t) {
  for (let dz = 1; t.z - dz >= MINZ; dz++) {
    const a = cache.get(`${t.z - dz}/${t.x >> dz}/${t.y >> dz}`);
    if (a?.state === 'ready') return a;
  }
  return null;
}
function dispose(t) {
  if (t.mesh) { group.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.uniforms.map.value.dispose(); t.mesh.material.dispose(); }
  cache.delete(t.key);
}

const frustum = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere(), camDir = new THREE.Vector3();
export function updateTiles(now) {
  if (now - lastUpdate < 100) return;
  lastUpdate = now;
  const cam = camera.position, cd = cam.length();
  camDir.copy(cam).normalize();
  const horizon = Math.acos(Math.min(1, R / cd));
  pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
  const k = (innerHeight / 2) / Math.tan(camera.fov * D2R / 2);
  const selected = [], stack = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) stack.push(get(MINZ, x, y));
  while (stack.length) {
    const t = stack.pop();
    if (Math.acos(Math.max(-1, Math.min(1, t.n.dot(camDir)))) > horizon + t.ang) continue;
    sph.center.copy(t.c); sph.radius = t.rad;
    if (!frustum.intersectsSphere(sph)) continue;
    const d = Math.max(1e-6, cam.distanceTo(t.c) - t.rad * 0.5);
    if (t.z < MAXZ && t.w / d * k > SPLIT_PX && selected.length + stack.length < 260) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) stack.push(get(t.z + 1, t.x * 2 + dx, t.y * 2 + dy));
    } else selected.push(t);
  }
  const show = new Set(), pending = [];
  for (const t of selected) {
    t.used = now;
    if (t.state === 'ready') { show.add(t); continue; }
    if (t.state === 'new' || (t.state === 'failed' && now - t.failedAt > 30000)) pending.push(t);
    const a = readyAncestor(t);
    if (a) { a.used = now; show.add(a); }
  }
  pending.sort((a, b) => a.z - b.z || cam.distanceTo(a.c) - cam.distanceTo(b.c));
  for (const t of pending) { if (loading >= MAX_LOADING) break; load(t); }
  let maxZ = 0;
  for (const t of cache.values()) if (t.mesh) { t.mesh.visible = show.has(t); if (t.mesh.visible) maxZ = Math.max(maxZ, t.z); }
  if (cache.size > MAX_CACHE) {
    const old = [...cache.values()].filter((t) => !show.has(t) && t.state !== 'loading').sort((a, b) => a.used - b.used);
    for (const t of old.slice(0, cache.size - MAX_CACHE)) dispose(t);
  }
  Object.assign(tileStats, { visible: show.size, loading, maxZ });
}
