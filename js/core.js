import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const R = 1, D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const EARTH_KM = 6371;
export const app = {};
export const view = { ring: 1, alt: 2 };

export const canvas = document.getElementById('globe');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.01, 300);
camera.position.set(0.9, 1.3, 2.9);

const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
export const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

export const shared = { uTime: { value: 0 }, uPixel: { value: 600 } };
export const sunDir = new THREE.Vector3(1, 0, 0);

export const sunLight = new THREE.DirectionalLight(0xfff2e0, 2.8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.0;
Object.assign(sunLight.shadow.camera, { left: -0.03, right: 0.03, top: 0.03, bottom: -0.03, near: 0.001, far: 1 });
scene.add(sunLight, sunLight.target);
export const ambient = new THREE.AmbientLight(0xa9bcdc, 1.0);
scene.add(ambient);
// 폭발·화염 조명 (개수가 바뀌면 셰이더가 재컴파일되므로 고정 3개)
export const fxLights = [0, 1, 2].map(() => {
  const l = new THREE.PointLight(0xff9a40, 0, 0.05, 2);
  l.userData = { t0: -99, power: 0, dur: 0.5, scale: 0.02 };
  scene.add(l);
  return l;
});

export function ll2v(lat, lon, r = R) {
  const phi = (lon + 180) * D2R, th = (90 - lat) * D2R;
  return new THREE.Vector3(-r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi));
}
export function v2ll(v) {
  const r = v.length();
  let lon = Math.atan2(v.z, -v.x) * R2D - 180;
  if (lon < -180) lon += 360;
  return { lat: 90 - Math.acos(Math.max(-1, Math.min(1, v.y / r))) * R2D, lon };
}

/* ---------- textures ---------- */
export const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
loader.setCrossOrigin('anonymous');
export const maxAniso = renderer.capabilities.getMaxAnisotropy();
function tex(url, srgb = true) {
  const t = loader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  return t;
}
export const T = {
  day: tex('https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg'),
  night: tex('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/earth_night_4096.jpg'),
  brc: tex('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/earth_bump_roughness_clouds_4096.jpg', false),
  water: tex('https://unpkg.com/three-globe@2.31.0/example/img/earth-water.png', false),
  sky: tex('https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png'),
};
T.brc.wrapS = THREE.RepeatWrapping;

/* ---------- earth ---------- */
export const EARTH_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
void main(){ vUv=uv; vN=normalize((modelMatrix*vec4(normal,0.)).xyz); vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
export const CLOUD_FN = `
float cloudAt(vec2 uv){ return smoothstep(0.14,0.85,texture2D(brcMap,uv+vec2(uTime*0.0007,0.)).b)*cloudAmt; }`;
const EARTH_FS = `
uniform sampler2D dayMap, nightMap, brcMap, waterMap;
uniform vec3 sunDir; uniform float uTime, cloudAmt;
varying vec2 vUv; varying vec3 vN; varying vec3 vP;
${CLOUD_FN}
void main(){
  vec3 N=normalize(vN);
  vec3 east=cross(vec3(0.,1.,0.),N); float el=length(east); east = el>1e-4 ? east/el : vec3(1.,0.,0.);
  vec3 north=cross(N,east);
  vec2 tx=vec2(1./4096.,0.), ty=vec2(0.,1./2048.);
  float hE=texture2D(brcMap,vUv+tx).r-texture2D(brcMap,vUv-tx).r;
  float hN=texture2D(brcMap,vUv+ty).r-texture2D(brcMap,vUv-ty).r;
  vec3 n=normalize(N-(east*hE+north*hN)*2.6);
  float NdL=dot(N,sunDir);
  float ndl=max(dot(n,sunDir),0.);
  float dayMix=smoothstep(-0.10,0.20,NdL);
  vec3 day=texture2D(dayMap,vUv).rgb;
  vec3 night=texture2D(nightMap,vUv).rgb;
  float water=texture2D(waterMap,vUv).r;
  vec3 V=normalize(cameraPosition-vP);
  vec3 H=normalize(sunDir+V);
  float cl=cloudAt(vUv);
  vec2 so=vec2(dot(sunDir,east),dot(sunDir,north))*0.003;
  float cs=cloudAt(vUv-so);
  vec3 col=day*(ndl*1.4+0.012);
  col*=1.-0.5*cs*dayMix;
  float sp=pow(max(dot(n,H),0.),80.)*1.6+pow(max(dot(N,H),0.),10.)*0.12;
  col+=vec3(1.,.92,.8)*sp*water*smoothstep(0.,0.12,NdL)*(1.-cl);
  vec3 cloudCol=vec3(1.)*(max(NdL,0.)*1.0+0.006);
  cloudCol*=mix(vec3(1.,.55,.32),vec3(1.),smoothstep(0.,0.28,NdL));
  col=mix(col,cloudCol,cl*0.93);
  vec3 lights=night*vec3(1.,.8,.55)*2.8*(1.-cl*0.85);
  col=col*dayMix+lights*(1.-dayMix)*(1.-smoothstep(-0.25,0.05,NdL)*0.6)+day*0.008;
  float fr=pow(1.-max(dot(N,V),0.),4.);
  vec3 atm=mix(vec3(1.,.42,.18),vec3(.30,.58,1.),smoothstep(-.05,.35,NdL));
  col+=atm*fr*smoothstep(-.25,.4,NdL)*1.1;
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const earthMat = new THREE.ShaderMaterial({
  uniforms: { dayMap: { value: T.day }, nightMap: { value: T.night }, brcMap: { value: T.brc }, waterMap: { value: T.water },
    sunDir: { value: sunDir }, uTime: shared.uTime, cloudAmt: { value: 1 } },
  vertexShader: EARTH_VS, fragmentShader: EARTH_FS,
});
export const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 128), earthMat);
scene.add(earth);

export const atmoMat = new THREE.ShaderMaterial({
  uniforms: { sunDir: { value: sunDir }, inside: { value: 0 } },
  vertexShader: EARTH_VS,
  fragmentShader: `
uniform vec3 sunDir; uniform float inside;
varying vec3 vN; varying vec3 vP;
void main(){
  vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vP);
  float k=clamp(-dot(N,V)/0.258,0.,1.);
  float inten=pow(k,2.4);
  float s=dot(normalize(vP),sunDir);
  vec3 c=mix(vec3(1.,.5,.25),vec3(.35,.62,1.),smoothstep(-.1,.35,s));
  gl_FragColor=vec4(c*inten*smoothstep(-.35,.3,s)*mix(1.3,.5,inside),1.);
}`,
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 128, 64), atmoMat));

scene.add(new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32),
  new THREE.MeshBasicMaterial({ map: T.sky, side: THREE.BackSide, color: 0x6e6e6e, depthWrite: false, toneMapped: false })));

const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 128;
{
  const g = glowCanvas.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,250,235,.6)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
}
const sunTex = new THREE.CanvasTexture(glowCanvas); sunTex.colorSpace = THREE.SRGBColorSpace;
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: 0xfff0d0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
sun.scale.setScalar(16);
scene.add(sun);

export function updateSun() {
  const d = Date.now() / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * D2R;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const e = (23.439 - 0.00000036 * d) * D2R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) * R2D;
  const dec = Math.asin(Math.sin(e) * Math.sin(L)) * R2D;
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lon = ((ra - gmst * 15 + 540) % 360 + 360) % 360 - 180;
  sunDir.copy(ll2v(dec, lon)).normalize();
  sun.position.copy(sunDir).multiplyScalar(120);
}
updateSun();
