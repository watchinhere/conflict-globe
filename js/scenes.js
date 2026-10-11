import * as THREE from 'three';
import { sunDir, fxLights, view } from './core.js';
import {
  rnd, pick, discPt, rotY, TX, GEO, MAT, emitter, fireFx, smokeFx, Explosions, Glows, Tracers, decal, groundMesh,
  instanced, setInst, paint, placeStatic, makeTank, makeHeli, makeJet, facadeMat, flash,
} from './fx.js';

export const nightOf = (site) => 1 - THREE.MathUtils.smoothstep(site.normal.dot(sunDir), -0.08, 0.12);
const _v = new THREE.Vector3();

/* ---------- shared bits ---------- */
function pulse(site, r = 1, period = 2.8, color = site.color) {
  const m = decal(site, TX.ring, r, color, 0.8, true, 0.003, { conform: false });
  const ph = rnd() * period;
  site.on((t) => {
    const k = ((t + ph) % period) / period;
    m.scale.set(r * 2 * (0.2 + k), 1, r * 2 * (0.2 + k));
    m.material.opacity = (1 - k) * 0.75 * site.hl * view.ring;
  });
}
function shadowCatcher(site, size = 2.4) {
  const m = groundMesh(site, size, size, MAT.shadow, 0.0018);
  m.renderOrder = 3;
  site.shadowMesh = m;
}
function persistentLight(site, x, y, z, power, color = 0xff7a2a, flicker = 0.3) {
  site.on((t) => {
    if (!site.focused) return;
    const l = fxLights[2];
    site.root.updateMatrixWorld();
    l.position.copy(site.root.localToWorld(_v.set(x, y + site.groundY(x, z), z)));
    l.color.set(color);
    const s = site.uScale.value;
    l.distance = s * 2.5;
    l.intensity = power * 6 * (0.3 * s) ** 2 * (1 - flicker + flicker * (0.6 + 0.4 * Math.sin(t * 13) * Math.sin(t * 7.3)));
  });
}
function townBlocks(site, n, place, hmin, hmax, ruinedFrac = 0.35) {
  const fm = facadeMat();
  site.on(() => { fm.emissiveIntensity = nightOf(site) * 1.6; });
  const m = instanced(site, GEO.box, n, fm), items = [], ruins = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = place(i), ruined = rnd() < ruinedFrac;
    const it = { x, z, ry: rnd() * 0.5, sx: 0.022 + rnd() * 0.03, sy: ruined ? 0.006 + rnd() * 0.012 : hmin + rnd() * (hmax - hmin), sz: 0.022 + rnd() * 0.03 };
    items.push(it);
    paint(m, i, ruined ? pick(['#4a4642', '#5a554e', '#3a3632']) : pick(['#ffffff', '#efe6d8', '#d8d4cc', '#f4ede2']));
    if (ruined) ruins.push(it);
  }
  placeStatic(site, m, items);
  if (ruins.length) {
    const rb = instanced(site, GEO.boulder, ruins.length * 5, MAT.flat), rItems = [];
    ruins.forEach((r) => { for (let k = 0; k < 5; k++) rItems.push({ x: r.x + (rnd() - 0.5) * 0.05, z: r.z + (rnd() - 0.5) * 0.05, ry: rnd() * 6, sx: 0.4 + rnd() * 0.8, rx: rnd() * 3 }); });
    rItems.forEach((_, i) => paint(rb, i, pick(['#6b655c', '#59544d', '#7d766b'])));
    placeStatic(site, rb, rItems);
  }
  return items;
}
function streetWithLamps(site, len, wid) {
  groundMesh(site, len, wid, MAT.asphalt, 0.0012);
  const lamps = new Glows(site, 40), pools = [], pts = [];
  for (let x = -len / 2 + 0.06; x < len / 2; x += 0.13) for (const s of [1, -1]) pts.push([x, s * wid * 0.47]);
  for (const [x, z] of pts) { const d = decal(site, TX.glow, 0.05, 0xffc27a, 0.22, true, 0.0025, { conform: false }); d.position.set(x, 0.0025, z * 0.85); pools.push(d); }
  site.on(() => {
    const night = nightOf(site);
    lamps.clear();
    for (const [x, z] of pts) lamps.add(x, 0.03 + site.groundY(x, z), z, 1, 0.78, 0.45, 0.9 * night, 0.022);
    lamps.commit();
    for (const p of pools) { p.material.opacity = 0.25 * night; p.position.y = 0.0025 + site.groundY(p.position.x, p.position.z); }
  });
}

/* =========================================================================
   BEACON (멀리서 보이는 가벼운 표지)
   ========================================================================= */
export function BEACON(site) {
  const ev = site.ev;
  const col = site.color, r = 1;
  const g = decal(site, TX.glow, r, col, 0.22, true, 0.002, { conform: false });
  site.on(() => { g.material.opacity = 0.22 * site.hl * view.ring; });
  pulse(site, r * 1.15, 2.8, col);
  site.g = site.bfx;
  if (ev.cat === 'war' || ev.cat === 'clash') {
    const gl = new Glows(site, 8, site.bfx);
    site.on((t) => {
      gl.clear();
      for (let i = 0; i < 8; i++) { const k = (t * (0.6 + i * 0.13) + i * 0.37) % 1; if (k < 0.12) { const a = i * 2.4, d = 0.15 + (i % 4) * 0.12; gl.add(Math.cos(a) * d, 0.02, Math.sin(a) * d, 1, 0.7, 0.3, 1 - k / 0.12, 0.12); } }
      gl.commit();
    });
  }
  site.g = site.beacon;
}

/* =========================================================================
   전쟁 · 국지전
   ========================================================================= */
function buildBattle(site, cfg) {
  const { tanks = 3, soldiers = 16, town = 14, burning = 3, artillery = 0.8, pool = 7, urban = false, heli = 0, jet = false } = cfg;
  decal(site, TX.scorch, 0.95, 0xffffff, 0.65, false, 0.001);
  shadowCatcher(site);
  const spots = townBlocks(site, town, () => discPt(urban ? 0.36 : 0.2), 0.015, urban ? 0.07 : 0.035, urban ? 0.4 : 0.35);
  for (let k = 0; k < burning; k++) {
    const s = spots[k];
    fireFx(site, { count: 14, radius: 0.012, cx: s.x, cz: s.z, y: s.sy * 0.7 });
    smokeFx(site, { count: 26, radius: 0.012, cx: s.x, cz: s.z, y: s.sy });
  }
  if (burning) persistentLight(site, spots[0].x, spots[0].sy + 0.01, spots[0].z, 0.8);
  const ex = new Explosions(site, pool), glow = new Glows(site, 120), tr = new Tracers(site, 36);
  const sides = [{ dir: 1, tex: TX.camoGreen, cloth: ['#4f5b3a', '#5d6845', '#475236'] }, { dir: -1, tex: TX.camoSand, cloth: ['#7d7258', '#8e8265', '#6f664f'] }];
  const tankUnits = [], squads = [];
  for (const sd of sides) {
    for (let k = 0; k < tanks; k++) {
      const tk = makeTank(sd.tex), baseX = -sd.dir * (0.5 + rnd() * 0.12), z = -0.34 + 0.68 * (k + 0.5) / tanks + (rnd() - 0.5) * 0.08;
      tk.g.rotation.y = sd.dir > 0 ? 0 : Math.PI;
      site.g.add(tk.g);
      tankUnits.push({ tk, sd, baseX, z, ph: rnd() * 10, next: 1 + rnd() * 4, flash: -9, recoil: 0 });
    }
    const top = instanced(site, GEO.soldierTop, soldiers), legL = instanced(site, GEO.leg, soldiers), legR = instanced(site, GEO.leg, soldiers);
    const men = [];
    for (let i = 0; i < soldiers; i++) {
      const c = pick(sd.cloth); paint(top, i, c); paint(legL, i, '#2f3326'); paint(legR, i, '#2f3326');
      men.push({ x: -sd.dir * (0.2 + rnd() * 0.2), z: (rnd() - 0.5) * 0.8, ph: rnd() * 10, next: rnd() * 3, flash: -9, cx: 0, cz: 0 });
    }
    squads.push({ sd, top, legL, legR, men });
  }
  const helis = [];
  for (let i = 0; i < heli; i++) {
    const h = makeHeli(); site.g.add(h.g);
    helis.push({ ...h, r: 0.32 + i * 0.12, h: 0.2 + i * 0.05, sp: (0.18 + i * 0.05) * (i % 2 ? -1 : 1), ph: rnd() * 6, next: 2 + rnd() * 3 });
  }
  const jetM = jet ? makeJet() : null;
  if (jetM) { jetM.visible = false; site.g.add(jetM); }
  let jetRun = null, nextJet = 4 + rnd() * 6;
  const shells = [], rockets = [], bombs = [];
  let nextArt = 1 + rnd() * 2;
  site.on((t) => {
    glow.clear();
    for (const u of tankUnits) {
      const { tk, sd } = u;
      u.recoil *= 0.9;
      const x = u.baseX + sd.dir * (0.07 * Math.sin(t * 0.13 + u.ph) - u.recoil);
      tk.g.position.set(x, site.groundY(x, u.z), u.z);
      tk.turret.rotation.y = 0.28 * Math.sin(t * 0.37 + u.ph);
      const ry = tk.g.rotation.y, tr0 = tk.turret.rotation.y;
      const [mx, mz] = rotY(0.004 + 0.111 * Math.cos(tr0), -0.111 * Math.sin(tr0), ry);
      const mzPos = [x + mx, tk.g.position.y + 0.049, u.z + mz];
      if (t > u.next) {
        u.next = t + 2.4 + rnd() * 3.6; u.flash = t; u.recoil = 0.012;
        const bx = sd.dir * (0.25 + rnd() * 0.3), bz = (rnd() - 0.5) * 0.75;
        shells.push({ a: mzPos, b: [bx, site.groundY(bx, bz) + 0.004, bz], t0: t, dur: 0.5 + rnd() * 0.2 });
        flash(site, mzPos[0], mzPos[1], mzPos[2], 0.6, 0.15, 0xffc070);
      }
      const fk = (t - u.flash) / 0.14;
      if (fk < 1) { glow.add(...mzPos, 1, 0.75, 0.35, 1 - fk, 0.08); glow.add(...mzPos, 1, 1, 0.9, 1 - fk, 0.03); }
    }
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i], k = (t - s.t0) / s.dur;
      if (k >= 1) { ex.fire(s.b[0], s.b[2], 0.07 + rnd() * 0.03); shells.splice(i, 1); continue; }
      glow.add(s.a[0] + (s.b[0] - s.a[0]) * k, s.a[1] + (s.b[1] - s.a[1]) * k + Math.sin(Math.PI * k) * 0.05, s.a[2] + (s.b[2] - s.a[2]) * k, 1, 0.85, 0.5, 1, 0.022);
    }
    for (let q = 0; q < squads.length; q++) {
      const { sd, top, legL, legR, men } = squads[q], foe = squads[1 - q].men, ry = sd.dir > 0 ? 0 : Math.PI;
      for (let i = 0; i < men.length; i++) {
        const m = men[i];
        const adv = Math.sin(t * 0.22 + m.ph) * 0.06, run = Math.abs(Math.cos(t * 0.22 + m.ph));
        m.cx = m.x + sd.dir * adv; m.cz = m.z + Math.sin(t * 0.3 + m.ph * 2) * 0.01;
        const gy = site.groundY(m.cx, m.cz), bob = Math.abs(Math.sin(t * 9 + m.ph)) * 0.0025 * run, sw = Math.sin(t * 9 + m.ph) * 0.7 * run;
        setInst(top, i, m.cx, gy + bob, m.cz, ry);
        const [lx, lz] = rotY(0, 0.0022, ry);
        setInst(legL, i, m.cx + lx, gy + 0.0115 + bob, m.cz + lz, ry, 1, 1, 1, 0, sw);
        setInst(legR, i, m.cx - lx, gy + 0.0115 + bob, m.cz - lz, ry, 1, 1, 1, 0, -sw);
        if (t > m.next) {
          m.next = t + 0.5 + rnd() * 2.6; m.flash = t;
          const f = pick(foe);
          tr.add([m.cx + sd.dir * 0.02, gy + 0.021, m.cz], [f.cx, site.groundY(f.cx, f.cz) + 0.015, f.cz], t, 0.11);
        }
        if (t - m.flash < 0.07) glow.add(m.cx + sd.dir * 0.021, gy + 0.021, m.cz, 1, 0.85, 0.5, 1, 0.016);
      }
      top.instanceMatrix.needsUpdate = true; legL.instanceMatrix.needsUpdate = true; legR.instanceMatrix.needsUpdate = true;
    }
    for (const h of helis) {
      const a = t * h.sp + h.ph, x = Math.cos(a) * h.r, z = Math.sin(a) * h.r, y = site.groundY(0, 0) + h.h + Math.sin(t * 0.9 + h.ph) * 0.015;
      h.g.position.set(x, y, z);
      const dir = Math.sign(h.sp);
      h.g.rotation.set(0, Math.atan2(-Math.cos(a) * dir, -Math.sin(a) * dir), 0);
      h.g.rotateX(-0.22 * dir); h.g.rotateZ(-0.12);
      h.rotor.rotation.y = t * 40; h.tail.rotation.z = t * 60;
      glow.add(x - 0.09 * Math.cos(h.g.rotation.y), y + 0.012, z + 0.09 * Math.sin(h.g.rotation.y), 1, 0.2, 0.2, (Math.sin(t * 8) > 0.6) ? 1 : 0, 0.012);
      if (t > h.next) {
        h.next = t + 2.2 + rnd() * 2.5;
        const tx = (rnd() - 0.5) * 0.9, tz = (rnd() - 0.5) * 0.7;
        rockets.push({ a: [x, y - 0.01, z], b: [tx, site.groundY(tx, tz) + 0.004, tz], t0: t, dur: 0.45 });
        rockets.push({ a: [x, y - 0.01, z], b: [tx + 0.04, site.groundY(tx, tz) + 0.004, tz + 0.03], t0: t + 0.12, dur: 0.45 });
      }
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const s = rockets[i], k = (t - s.t0) / s.dur;
      if (k < 0) continue;
      if (k >= 1) { ex.fire(s.b[0], s.b[2], 0.06); rockets.splice(i, 1); continue; }
      const p = [s.a[0] + (s.b[0] - s.a[0]) * k, s.a[1] + (s.b[1] - s.a[1]) * k, s.a[2] + (s.b[2] - s.a[2]) * k];
      glow.add(...p, 1, 0.8, 0.45, 1, 0.025);
      for (let j = 1; j < 4; j++) { const kk = Math.max(0, k - j * 0.05); glow.add(s.a[0] + (s.b[0] - s.a[0]) * kk, s.a[1] + (s.b[1] - s.a[1]) * kk, s.a[2] + (s.b[2] - s.a[2]) * kk, 0.7, 0.7, 0.7, 0.35 / j, 0.03); }
    }
    if (jetM) {
      if (!jetRun && t > nextJet) {
        const z0 = (rnd() - 0.5) * 0.6, z1 = (rnd() - 0.5) * 0.6, s = rnd() < 0.5 ? 1 : -1;
        jetRun = { a: [-1.5 * s, 0.5, z0], b: [1.5 * s, 0.5, z1], t0: t, dur: 2.4, dropped: 0 };
      }
      if (jetRun) {
        const k = (t - jetRun.t0) / jetRun.dur, { a, b } = jetRun;
        if (k >= 1) { jetRun = null; jetM.visible = false; nextJet = t + 7 + rnd() * 8; }
        else {
          const p = [a[0] + (b[0] - a[0]) * k, a[1] + site.groundY(0, 0), a[2] + (b[2] - a[2]) * k];
          jetM.visible = true; jetM.position.set(...p);
          jetM.rotation.set(0, Math.atan2(-(b[2] - a[2]), b[0] - a[0]), 0);
          jetM.scale.setScalar(1.6);
          const dx = (b[0] - a[0]) / 3, dz = (b[2] - a[2]) / 3, l = Math.hypot(dx, dz);
          glow.add(p[0] - dx / l * 0.06, p[1], p[2] - dz / l * 0.06, 1, 0.6, 0.3, 1, 0.03);
          for (let j = 1; j < 8; j++) glow.add(p[0] - dx / l * 0.06 * j * 1.6, p[1] + 0.002, p[2] - dz / l * 0.06 * j * 1.6, 0.85, 0.88, 0.95, 0.4 * (1 - j / 8), 0.03 + j * 0.006);
          if (k > 0.38 + jetRun.dropped * 0.06 && jetRun.dropped < 4) { jetRun.dropped++; bombs.push({ x: p[0], z: p[2], y0: p[1], vx: dx / l * 0.5, vz: dz / l * 0.5, t0: t }); }
        }
      }
      for (let i = bombs.length - 1; i >= 0; i--) {
        const bm = bombs[i], dt = t - bm.t0, y = bm.y0 - 0.9 * dt * dt, x = bm.x + bm.vx * dt, z = bm.z + bm.vz * dt;
        const gy = site.groundY(x, z);
        if (y <= gy + 0.004) { ex.fire(x, z, 0.11); bombs.splice(i, 1); continue; }
        glow.add(x, y, z, 0.6, 0.6, 0.6, 0.6, 0.012);
      }
    }
    if (t > nextArt) {
      nextArt = t + (0.6 + rnd()) / artillery;
      const [x, z] = discPt(0.62); ex.fire(x, z, 0.09 + rnd() * 0.05);
    }
    glow.commit(); tr.update(t);
  });
}

/* =========================================================================
   폭동 · 시위
   ========================================================================= */
function buildRiot(site) {
  shadowCatcher(site, 1.8);
  streetWithLamps(site, 1.5, 0.44);
  townBlocks(site, 18, (i) => [-0.68 + (i % 9) * 0.16 + rnd() * 0.03, (i < 9 ? 1 : -1) * (0.3 + rnd() * 0.08)], 0.04, 0.1, 0.1);
  const crowd = instanced(site, GEO.person, 130), people = [];
  for (let i = 0; i < 130; i++) {
    paint(crowd, i, pick(['#2a2a30', '#43434b', '#5f2a2a', '#22304a', '#555', '#1a1a1a', '#6d5a3a']));
    people.push({ x: -0.55 + rnd() * 0.47, z: (rnd() - 0.5) * 0.36, ph: rnd() * 10, cx: 0, cz: 0 });
  }
  const pol = instanced(site, GEO.police, 22), cops = [];
  for (let i = 0; i < 22; i++) { paint(pol, i, '#1b2433'); cops.push({ x: 0.1 + (i % 2) * 0.03, z: -0.19 + (Math.floor(i / 2) / 10) * 0.38 }); }
  const vans = instanced(site, GEO.truck, 2);
  placeStatic(site, vans, [{ x: 0.33, z: 0.09, ry: Math.PI, sx: 1.3 }, { x: 0.36, z: -0.1, ry: Math.PI, sx: 1.3 }]);
  paint(vans, 0, '#d9dde4'); paint(vans, 1, '#d9dde4');
  const cars = instanced(site, GEO.car, 3), carPos = [[-0.3, 0.05], [-0.15, -0.12], [-0.42, -0.06]];
  placeStatic(site, cars, carPos.map(([x, z]) => ({ x, z, ry: rnd() * 3 })));
  carPos.forEach(([x, z], i) => {
    paint(cars, i, '#1a1817');
    fireFx(site, { count: 18, radius: 0.015, cx: x, cz: z, y: 0.012, rise: 0.06 });
    smokeFx(site, { count: 26, radius: 0.012, cx: x, cz: z, y: 0.02, rise: 0.75 });
  });
  persistentLight(site, carPos[0][0], 0.03, carPos[0][1], 1.2);
  emitter(site, { count: 50, place: () => [-0.08 + rnd() * 0.16, (rnd() - 0.5) * 0.4], rise: 0.07, speed: 0.16, size: [0.06, 0.12], grow: [0.5, 2.6],
    wind: [-0.18, 0], colors: ['#e1e4e6', '#cdd1d4', '#bcc1c5'], alpha: 0.33, map: TX.smoke, fadeIn: 0.1 });
  const ex = new Explosions(site, 4, { shock: false }), glow = new Glows(site, 40), flying = [];
  let next = 0.5;
  site.on((t) => {
    glow.clear();
    const surge = Math.max(0, Math.sin(t * 0.45)) * 0.05;
    people.forEach((p, i) => {
      p.cx = p.x + surge * (0.5 + 0.5 * Math.sin(p.ph)) + Math.sin(t * 1.3 + p.ph) * 0.006;
      p.cz = p.z + Math.cos(t * 1.1 + p.ph) * 0.006;
      setInst(crowd, i, p.cx, site.groundY(p.cx, p.cz) + Math.abs(Math.sin(t * 7 + p.ph)) * 0.003, p.cz, Math.sin(t + p.ph) * 0.6);
    });
    crowd.instanceMatrix.needsUpdate = true;
    cops.forEach((c, i) => setInst(pol, i, c.x - surge * 0.15, site.groundY(c.x, c.z), c.z, Math.PI));
    pol.instanceMatrix.needsUpdate = true;
    const blink = Math.floor(t * 4) % 2, vy = site.groundY(0.34, 0) + 0.034;
    glow.add(0.33, vy, 0.09, blink ? 1 : 0.1, 0.1, blink ? 0.1 : 1, 1, 0.05);
    glow.add(0.36, vy, -0.1, blink ? 0.1 : 1, 0.1, blink ? 1 : 0.1, 1, 0.05);
    if (t > next) {
      next = t + 0.3 + rnd() * 0.7;
      const p = pick(people), c = pick(cops);
      flying.push({ a: [p.cx, site.groundY(p.cx, p.cz) + 0.03, p.cz], b: [c.x - 0.02, site.groundY(c.x, c.z) + 0.005, c.z + (rnd() - 0.5) * 0.04], t0: t, dur: 0.7, molotov: rnd() < 0.4 });
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i], k = (t - f.t0) / f.dur;
      if (k >= 1) { if (f.molotov) ex.fire(f.b[0], f.b[2], 0.035); flying.splice(i, 1); continue; }
      const y = f.a[1] + (f.b[1] - f.a[1]) * k + Math.sin(Math.PI * k) * 0.08;
      if (f.molotov) glow.add(f.a[0] + (f.b[0] - f.a[0]) * k, y, f.a[2] + (f.b[2] - f.a[2]) * k, 1, 0.55, 0.15, 1, 0.025);
      else glow.add(f.a[0] + (f.b[0] - f.a[0]) * k, y, f.a[2] + (f.b[2] - f.a[2]) * k, 0.4, 0.4, 0.4, 0.5, 0.012);
    }
    glow.commit();
  });
}

function buildProtest(site) {
  shadowCatcher(site, 1.9);
  streetWithLamps(site, 1.7, 0.36);
  townBlocks(site, 24, (i) => [-0.8 + (i % 12) * 0.14 + rnd() * 0.02, (i < 12 ? 1 : -1) * (0.26 + rnd() * 0.1)], 0.05, 0.14, 0);
  const N = 320, crowd = instanced(site, GEO.person, N), people = [];
  const cloth = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#f4a261', '#2a9d8f', '#e9c46a', '#264653', '#ffffff', '#ff7aa2'];
  for (let i = 0; i < N; i++) { paint(crowd, i, pick(cloth)); people.push({ x: -0.8 + rnd() * 1.6, z: (rnd() - 0.5) * 0.3, ph: rnd() * 10 }); }
  const NS = 80, signs = instanced(site, GEO.sign, NS);
  for (let i = 0; i < NS; i++) paint(signs, i, pick(['#ffffff', '#ffe066', '#ff6b6b', '#4cc9f0', '#f8f9fa']));
  const pol = instanced(site, GEO.police, 12), copItems = [];
  for (let i = 0; i < 12; i++) { paint(pol, i, '#1b2433'); copItems.push({ x: -0.6 + (i % 6) * 0.24, z: i < 6 ? 0.19 : -0.19, ry: i < 6 ? -Math.PI / 2 : Math.PI / 2 }); }
  placeStatic(site, pol, copItems);
  let last = 0;
  site.on((t) => {
    const dt = Math.min(0.05, t - last); last = t;
    people.forEach((p, i) => {
      p.x += dt * 0.014; if (p.x > 0.8) p.x -= 1.6;
      const z = p.z + Math.sin(t * 0.8 + p.ph) * 0.004, y = site.groundY(p.x, z) + Math.abs(Math.sin(t * 5 + p.ph)) * 0.0025;
      setInst(crowd, i, p.x, y, z, Math.sin(t * 0.5 + p.ph) * 0.3);
      if (i < NS) setInst(signs, i, p.x, y + Math.max(0, Math.sin(t * 2.2 + p.ph)) * 0.006, z, Math.sin(t * 0.5 + p.ph) * 0.3);
    });
    crowd.instanceMatrix.needsUpdate = true; signs.instanceMatrix.needsUpdate = true;
  });
}

/* =========================================================================
   소수민족 탄압
   ========================================================================= */
function buildCamp(site) {
  shadowCatcher(site, 1.6);
  groundMesh(site, 0.7, 0.7, new THREE.MeshStandardMaterial({ color: 0x8d8576, roughness: 1 }), 0.0012);
  const H = 0.33, step = 0.035, perim = [];
  for (let s = -H; s < H - 1e-6; s += step) perim.push([s, -H], [H, s], [-s, H], [-H, -s]);
  const posts = instanced(site, GEO.post, perim.length);
  perim.forEach((_, i) => paint(posts, i, '#5d5f62'));
  placeStatic(site, posts, perim.map(([x, z]) => ({ x, z })));
  const wire = [];
  for (const y of [0.012, 0.022, 0.03]) {
    const c = [[-H, -H], [H, -H], [H, H], [-H, H], [-H, -H]];
    for (let i = 0; i < 4; i++) wire.push(c[i][0], y, c[i][1], c[i + 1][0], y, c[i + 1][1]);
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  const wl = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x9aa0a6 }));
  site.g.add(wl); site.conform(() => { wl.position.y = site.groundY(0, 0); });
  const blocks = instanced(site, GEO.box, 8);
  for (let i = 0; i < 8; i++) paint(blocks, i, i % 3 ? '#9ea3a8' : '#7d8288');
  placeStatic(site, blocks, Array.from({ length: 8 }, (_, i) => ({ x: i % 2 ? 0.14 : -0.14, z: -0.22 + Math.floor(i / 2) * 0.1, sx: 0.13, sy: 0.028, sz: 0.045 })));
  const lights = [], coneGeo = new THREE.ConeGeometry(0.05, 1, 16, 1, true).translate(0, -0.5, 0);
  const towers = instanced(site, GEO.box, 8), tItems = [];
  for (const [x, z] of [[-H, -H], [H, -H], [H, H], [-H, H]]) {
    tItems.push({ x, z, sx: 0.012, sy: 0.07, sz: 0.012 }, { x, z, y: 0.07, sx: 0.03, sy: 0.02, sz: 0.03 });
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    cone.renderOrder = 5; site.g.add(cone);
    const spot = decal(site, TX.glow, 0.05, 0xfff1c4, 0.6, true, 0.003, { conform: false });
    lights.push({ cone, spot, x, z, ph: rnd() * 6 });
  }
  tItems.forEach((_, i) => paint(towers, i, i % 2 ? '#55585c' : '#3f4245'));
  placeStatic(site, towers, tItems);
  const det = instanced(site, GEO.person, 54), pris = [];
  for (let i = 0; i < 54; i++) { paint(det, i, pick(['#59606b', '#646b75', '#505660'])); pris.push({ row: i % 9, col: Math.floor(i / 9), ph: rnd() * 6 }); }
  const guards = instanced(site, GEO.soldierTop, 6);
  for (let i = 0; i < 6; i++) paint(guards, i, '#2b3026');
  const v = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  site.on((t) => {
    const night = nightOf(site);
    for (const L of lights) {
      const a = t * 0.5 + L.ph, gx = L.x * 0.35 + Math.cos(a) * 0.22, gz = L.z * 0.35 + Math.sin(a) * 0.22, ty = 0.088 + site.groundY(L.x, L.z), gy = site.groundY(gx, gz);
      L.cone.position.set(L.x, ty, L.z);
      v.set(gx - L.x, gy - ty, gz - L.z); const len = v.length(); v.normalize();
      L.cone.quaternion.setFromUnitVectors(down, v); L.cone.scale.set(1, len, 1);
      L.cone.material.opacity = 0.03 + 0.12 * night;
      L.spot.position.set(gx, gy + 0.003, gz); L.spot.material.opacity = 0.15 + 0.5 * night;
    }
    pris.forEach((p, i) => { const x = -0.12 + p.row * 0.022, z = 0.1 + p.col * 0.025 + Math.sin(t * 0.6 + p.ph) * 0.002; setInst(det, i, x, site.groundY(x, z), z, -Math.PI / 2); });
    det.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 6; i++) {
      const s = ((t * 0.02 + i / 6) % 1) * 4, side = Math.floor(s), f = s - side, H2 = H + 0.04;
      const pts = [[-H2, -H2], [H2, -H2], [H2, H2], [-H2, H2], [-H2, -H2]];
      const x = pts[side][0] + (pts[side + 1][0] - pts[side][0]) * f, z = pts[side][1] + (pts[side + 1][1] - pts[side][1]) * f;
      setInst(guards, i, x, site.groundY(x, z) + Math.abs(Math.sin(t * 6 + i)) * 0.002, z, [0, -Math.PI / 2, Math.PI, Math.PI / 2][side]);
    }
    guards.instanceMatrix.needsUpdate = true;
  });
}

function buildVillage(site) {
  decal(site, TX.scorch, 0.8, 0xffffff, 0.5, false, 0.001);
  shadowCatcher(site, 1.8);
  const huts = instanced(site, GEO.hut, 44, MAT.flat), items = [], spots = [];
  for (let i = 0; i < 44; i++) {
    const [x, z] = discPt(0.36), burnt = i < 18;
    items.push({ x, z, ry: rnd() * 6, sx: burnt ? 0.9 : 1, sy: burnt ? 0.55 : 1, sz: burnt ? 0.9 : 1 });
    paint(huts, i, burnt ? pick(['#1d1814', '#2a221b']) : pick(['#a8875c', '#b89a6c', '#8e7451']));
    if (i < 6) spots.push([x, z]);
  }
  placeStatic(site, huts, items);
  for (const [x, z] of spots) {
    fireFx(site, { count: 16, radius: 0.012, cx: x, cz: z, y: 0.006, rise: 0.06 });
    smokeFx(site, { count: 22, radius: 0.012, cx: x, cz: z, y: 0.015, rise: 0.8 });
  }
  persistentLight(site, spots[0][0], 0.02, spots[0][1], 1);
  const trucks = instanced(site, GEO.truck, 4);
  for (let i = 0; i < 4; i++) paint(trucks, i, pick(['#c2b48f', '#a59870', '#7d7a62']));
  const NR = 70, ref = instanced(site, GEO.person, NR), walkers = [];
  for (let i = 0; i < NR; i++) { paint(ref, i, pick(['#d9a441', '#8e3b46', '#4b6584', '#c9c2b8', '#6a4c93', '#e17055'])); walkers.push({ k: rnd(), z: (rnd() - 0.5) * 0.18, ph: rnd() * 6, sp: 0.018 + rnd() * 0.01 }); }
  site.on((t) => {
    for (let i = 0; i < 4; i++) {
      const a = t * 0.12 + i * Math.PI / 2, r = 0.42 + (i % 2) * 0.06, x = Math.cos(a) * r, z = Math.sin(a) * r;
      setInst(trucks, i, x, site.groundY(x, z), z, -a);
    }
    trucks.instanceMatrix.needsUpdate = true;
    walkers.forEach((w, i) => {
      const k = (w.k + t * w.sp) % 1, x = 0.2 + k * 0.6, z = w.z + Math.sin(k * 6 + w.ph) * 0.02;
      setInst(ref, i, x, site.groundY(x, z) + Math.abs(Math.sin(t * 6 + w.ph)) * 0.002, z, 0, k > 0.9 ? (1 - k) * 10 : 1);
    });
    ref.instanceMatrix.needsUpdate = true;
  });
}

export const BUILD = {
  war: (s) => buildBattle(s, { tanks: s.ev.intensity >= 3 ? 3 : 2, soldiers: 12 + (s.ev.intensity || 2) * 3, artillery: 0.35 + (s.ev.intensity || 2) * 0.25,
    heli: (s.ev.intensity || 2) >= 2 ? 1 + ((s.ev.intensity || 2) >= 3 ? 1 : 0) : 0, jet: !!s.ev.air }),
  clash: (s) => buildBattle(s, { tanks: (s.ev.intensity || 1) >= 2 ? 1 : 0, soldiers: 9, town: 26, urban: true, burning: 4, artillery: 0.35, pool: 5, jet: !!s.ev.air }),
  riot: buildRiot,
  protest: buildProtest,
  oppression: (s) => (s.ev.variant === 'camp' ? buildCamp(s) : buildVillage(s)),
};
