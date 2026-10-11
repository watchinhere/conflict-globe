import * as THREE from 'three';
import { R, D2R, R2D, EARTH_KM, scene, sunDir, shared, maxAniso, T, CLOUD_FN, earthMat, ll2v } from './core.js';

// 고해상도 지형 패치: Esri 위성사진 + NASA 야간 조명 + Terrarium 고도(과장 배율 EXAG)
export const EXAG = 2.2;
const G = 8, SEG = 96, ELEV_PX = 512;
export const terrain = { version: 0, valid: false, z: 0, x0: 0, y0: 0, n: 1, heights: null };
export const patch = { key: '', busy: false, last: 0, fade: 0, active: false };
export const heightUnits = (h) => Math.max(h, 0) * EXAG / (EARTH_KM * 1000);

const mkCanvas = (px, smooth = true) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const ctx = cv.getContext('2d', { willReadFrequently: !smooth });
  ctx.imageSmoothingEnabled = smooth;
  return [cv, ctx];
};
const [dayCv, dayCtx] = mkCanvas(256 * G);
const [nightCv, nightCtx] = mkCanvas(256 * G);
const [labelCv, labelCtx] = mkCanvas(256 * G);
const [, elevCtx] = mkCanvas(ELEV_PX, false);
const mkTex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
const dayTex = mkTex(dayCv), nightTex = mkTex(nightCv), labelTex = mkTex(labelCv);

const PATCH_VS = `
attribute vec2 aEq; varying vec2 vUv; varying vec2 vEq; varying vec3 vN; varying vec3 vNrm;
void main(){ vUv=uv; vEq=aEq; vNrm=normal; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`;
const PATCH_FS = `
uniform sampler2D map, nightMap, brcMap, labelMap; uniform vec3 sunDir; uniform float uTime, cloudAmt, uFade;
varying vec2 vUv; varying vec2 vEq; varying vec3 vN; varying vec3 vNrm;
${CLOUD_FN}
void main(){
  vec3 N=normalize(vN); float NdL=dot(N,sunDir);
  float dayMix=smoothstep(-0.10,0.20,NdL);
  float relief=max(dot(normalize(vNrm),sunDir),0.);
  vec3 c=texture2D(map,vUv).rgb;
  vec3 col=c*(mix(max(NdL,0.),relief,0.75)*1.45+0.03);
  float cl=cloudAt(vEq);
  vec3 cloudCol=vec3(1.)*(max(NdL,0.)*1.0+0.006);
  col=mix(col,cloudCol,cl*0.93);
  vec3 lights=texture2D(nightMap,vUv).rgb*vec3(1.,.82,.6)*2.6*(1.-cl*0.85);
  col=col*dayMix+lights*(1.-dayMix)+c*0.012;
  vec4 lb=texture2D(labelMap,vUv);
  col=mix(col,lb.rgb*1.15,lb.a);
  float edge=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x)*smoothstep(0.,.1,vUv.y)*smoothstep(1.,.9,vUv.y);
  gl_FragColor=vec4(col,edge*uFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const geo = new THREE.BufferGeometry();
{
  const n = (SEG + 1) * (SEG + 1);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  geo.setAttribute('aEq', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const idx = [];
  for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++) { const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  geo.setIndex(idx);
}
export const patchMesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
  uniforms: { map: { value: dayTex }, nightMap: { value: nightTex }, labelMap: { value: labelTex }, brcMap: { value: T.brc }, sunDir: { value: sunDir }, uTime: shared.uTime,
    cloudAmt: earthMat.uniforms.cloudAmt, uFade: { value: 0 } },
  vertexShader: PATCH_VS, fragmentShader: PATCH_FS, transparent: true, depthWrite: true, side: THREE.DoubleSide,
}));
patchMesh.renderOrder = -1; patchMesh.visible = false; patchMesh.frustumCulled = false;
scene.add(patchMesh);

function loadImg(url) {
  return new Promise((res) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    const to = setTimeout(() => res(null), 10000);
    im.onload = () => { clearTimeout(to); res(im); }; im.onerror = () => { clearTimeout(to); res(null); };
    im.src = url;
  });
}
// z 레벨 패치 영역(x0..x0+G, y0..y0+G)을 zSrc 레벨 타일로 채운다
async function drawSet(ctx, px, urlFn, zSrc, z, x0, y0) {
  const f = 2 ** (z - zSrc), nS = 2 ** zSrc, cell = px / G, jobs = [];
  for (let ty = Math.floor(y0 / f); ty <= Math.ceil((y0 + G) / f) - 1; ty++)
    for (let tx = Math.floor(x0 / f); tx <= Math.ceil((x0 + G) / f) - 1; tx++) {
      if (ty < 0 || ty >= nS) continue;
      const x = ((tx % nS) + nS) % nS;
      jobs.push(loadImg(urlFn(zSrc, x, ty)).then((im) => ({ im, px: (tx * f - x0) * cell, py: (ty * f - y0) * cell, s: cell * f })));
    }
  const tiles = await Promise.all(jobs);
  return { tiles, ok: tiles.filter((t) => t.im).length / Math.max(1, tiles.length), draw: () => { for (const t of tiles) if (t.im) ctx.drawImage(t.im, t.px, t.py, t.s, t.s); } };
}
const merc = (lat) => (1 - Math.log(Math.tan(lat * D2R) + 1 / Math.cos(lat * D2R)) / Math.PI) / 2;

export async function updatePatch(now, alt, center) {
  if (patch.busy || now - patch.last < 450) return;
  patch.last = now;
  if (alt > 0.6 || !center) {
    if (alt > 0.6) { patchMesh.visible = false; patch.key = ''; patch.active = false; terrain.valid = false; terrain.version++; }
    return;
  }
  const r = center.length(), lat = Math.max(-84, Math.min(84, 90 - Math.acos(center.y / r) * R2D));
  let lon = Math.atan2(center.z, -center.x) * R2D - 180; if (lon < -180) lon += 360;
  const z = Math.max(3, Math.min(14, Math.round(Math.log2(20 * Math.cos(lat * D2R) / Math.max(alt, 0.002)))));
  const n = 2 ** z, tx = (lon + 180) / 360 * n, ty = merc(lat) * n;
  const x0 = Math.round(tx) - G / 2, y0 = Math.max(0, Math.min(n - G, Math.round(ty) - G / 2));
  const key = `${z}/${x0}/${y0}`;
  if (key === patch.key) return;
  patch.busy = true;
  const esriRef = (svc) => (zz, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/${svc}/MapServer/tile/${zz}/${y}/${x}`;
  const [day, night, elev, places, roads] = await Promise.all([
    drawSet(dayCtx, 256 * G, (zz, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zz}/${y}/${x}`, z, z, x0, y0),
    drawSet(nightCtx, 256 * G, (zz, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/${zz}/${y}/${x}.png`, Math.min(z, 8), z, x0, y0),
    drawSet(elevCtx, ELEV_PX, (zz, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zz}/${x}/${y}.png`, Math.min(z, 12), z, x0, y0),
    drawSet(labelCtx, 256 * G, esriRef('World_Boundaries_and_Places'), z, z, x0, y0),
    z >= 8 ? drawSet(labelCtx, 256 * G, esriRef('World_Transportation'), z, z, x0, y0) : null,
  ]);
  patch.busy = false;
  if (day.ok < 0.6) return;
  dayCtx.fillStyle = '#1b2a1e'; dayCtx.fillRect(0, 0, 256 * G, 256 * G); day.draw(); dayTex.needsUpdate = true;
  labelCtx.clearRect(0, 0, 256 * G, 256 * G); roads?.draw(); places.draw(); labelTex.needsUpdate = true;
  nightCtx.fillStyle = '#000'; nightCtx.fillRect(0, 0, 256 * G, 256 * G); night.draw(); nightTex.needsUpdate = true;
  elevCtx.fillStyle = 'rgb(128,0,0)'; elevCtx.fillRect(0, 0, ELEV_PX, ELEV_PX); elev.draw();
  const px = elevCtx.getImageData(0, 0, ELEV_PX, ELEV_PX).data;
  const heights = new Float32Array((SEG + 1) * (SEG + 1));
  const P = geo.attributes.position.array, U = geo.attributes.uv.array, E = geo.attributes.aEq.array;
  let k = 0;
  for (let j = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++) {
    const sx = Math.min(ELEV_PX - 1, Math.round(i / SEG * (ELEV_PX - 1))), sy = Math.min(ELEV_PX - 1, Math.round(j / SEG * (ELEV_PX - 1)));
    const o = (sy * ELEV_PX + sx) * 4;
    const h = px[o] * 256 + px[o + 1] + px[o + 2] / 256 - 32768;
    heights[k] = h;
    const X = x0 + G * i / SEG, Yt = y0 + G * j / SEG;
    const lo = X / n * 360 - 180, la = Math.atan(Math.sinh(Math.PI * (1 - 2 * Yt / n))) * R2D;
    const v = ll2v(la, lo, R + 0.00035 + heightUnits(h));
    P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z;
    U[k * 2] = i / SEG; U[k * 2 + 1] = 1 - j / SEG;
    E[k * 2] = (lo + 180) / 360; E[k * 2 + 1] = (la + 90) / 180;
    k++;
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.uv.needsUpdate = true; geo.attributes.aEq.needsUpdate = true;
  geo.computeVertexNormals();
  Object.assign(terrain, { valid: elev.ok > 0.5, z, x0, y0, n, heights });
  terrain.version++;
  patch.key = key; patch.fade = 0; patchMesh.visible = true; patch.active = true;
}

// 위경도의 지형 높이(m, 해수면 이하는 0). 패치 밖이면 0.
export function heightAt(lat, lon) {
  if (!terrain.valid) return 0;
  const { n, x0, y0, heights } = terrain;
  let dx = (lon + 180) / 360 * n - x0;
  dx = ((dx % n) + n) % n;
  const dy = merc(Math.max(-84, Math.min(84, lat))) * n - y0;
  if (dx < 0 || dx > G || dy < 0 || dy > G) return 0;
  const gx = dx / G * SEG, gy = dy / G * SEG, i = Math.min(SEG - 1, Math.floor(gx)), j = Math.min(SEG - 1, Math.floor(gy)), fx = gx - i, fy = gy - j;
  const at = (a, b) => Math.max(0, heights[b * (SEG + 1) + a]);
  return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
}
