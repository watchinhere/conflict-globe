import { EVENTS, COUNTRIES, findCountries, countryKo, canonCountry } from './data.js';
import { countryAt, geoReady, geo } from './geo.js';
import { sites, upsert, removeWhere, getSite } from './sites.js';
import { app } from './core.js';
import { t } from './i18n.js';

export const feeds = {
  wiki: { key: 'feedWiki', every: 60, ok: null, at: 0, n: 0 },
  news: { key: 'feedNews', every: 30, ok: null, at: 0, n: 0 },
  gdelt: { key: 'feedGdelt', every: 0, ok: null, at: 0, n: 0 },
};

/* ---------- helpers ---------- */
export const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[–—]/g, '-').replace(/_/g, ' ').trim();
const matchTitle = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || a.startsWith(b + ' (') || a.startsWith(b + ' -') || b.startsWith(a + ' (')); };
const titleOf = (a) => { try { return decodeURIComponent((a.getAttribute('href') || '').replace(/^\/wiki\//, '').split('#')[0]).replace(/_/g, ' '); } catch { return ''; } };
const clean = (el) => (el?.textContent || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
export const wikiUrl = (t, host = 'en') => `https://${host}.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
async function wjson(params, host = 'en') {
  const u = new URL(`https://${host}.wikipedia.org/w/api.php`);
  for (const [k, v] of Object.entries({ ...params, format: 'json', formatversion: 2, origin: '*' })) u.searchParams.set(k, v);
  return getJSON(u);
}
async function parsePage(page) {
  const j = await wjson({ action: 'parse', page, prop: 'text', redirects: 1 });
  return new DOMParser().parseFromString(j.parse.text, 'text/html');
}
function resolveMap(q, titles) {
  const m = new Map();
  for (const t of titles) {
    let f = t;
    for (const n of q.normalized || []) if (n.from === f) f = n.to;
    for (const r of q.redirects || []) if (r.from === f) f = r.to;
    if (!m.has(f)) m.set(f, []);
    m.get(f).push(t);
  }
  return m;
}
function tableGrid(t) {
  const grid = [];
  [...t.querySelectorAll('tr')].forEach((tr, ri) => {
    grid[ri] ||= [];
    let ci = 0;
    for (const cell of tr.children) {
      while (grid[ri][ci]) ci++;
      const rs = +cell.getAttribute('rowspan') || 1, cs = +cell.getAttribute('colspan') || 1;
      for (let a = 0; a < rs; a++) for (let b = 0; b < cs; b++) (grid[ri + a] ||= [])[ci + b] = cell;
      ci += cs;
    }
  });
  return grid;
}
const firstNum = (s) => { const m = String(s || '').replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? +m[0] : 0; };
// 육지 판정은 국경 데이터가 준비된 뒤에만 의미가 있다
const onLand = (lat, lon) => !geo.ready || !!countryAt(lat, lon);
const crowded = (lat, lon, selfId) => sites.some((s) => s.id !== selfId && Math.abs(s.ev.lat - lat) < 1.1 && Math.abs(s.ev.lon - lon) < 1.1);
const NUDGES = [[0, 0], [0.8, 1.2], [-0.8, -1.2], [1.2, -0.8], [-1.2, 0.8], [0, 1.6], [0, -1.6], [1.6, 0], [-1.6, 0], [1.4, 1.4], [-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4]];
function nudge(lat, lon, selfId) {
  const land = onLand(lat, lon);
  for (const [a, b] of NUDGES) {
    const la = lat + a, lo = lon + b;
    if (land && !onLand(la, lo)) continue;
    if (!crowded(la, lo, selfId)) return [la, lo];
  }
  return [lat, lon];
}
// 국가 중심점이 바다(군도 국가 등)면 그 나라 안의 가장 가까운 도시로 옮긴다
function countryPoint(country) {
  const [lat, lon] = COUNTRIES[country];
  if (!geo.ready) return [lat, lon];
  const c = countryAt(lat, lon);
  if (c && canonCountry(c.en) === country) return [lat, lon];
  let best = null, bd = Infinity;
  for (const p of geo.cities) {
    p.cc ??= canonCountry(countryAt(p.lat, p.lon)?.en || '') || '';
    if (p.cc !== country) continue;
    const d = (p.lat - lat) ** 2 + ((p.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2 - (p.cap === 2 ? 4 : 0);
    if (d < bd) { bd = d; best = p; }
  }
  return best ? [best.lat, best.lon] : [lat, lon];
}

/* ---------- Wikipedia page info (한국어 제목·좌표·요약) ---------- */
const info = new Map();
async function fetchInfo(titles) {
  const need = [...new Set(titles.filter(Boolean))].filter((t) => !info.has(norm(t)));
  for (let i = 0; i < need.length; i += 50) {
    const chunk = need.slice(i, i + 50);
    try {
      const j = await wjson({ action: 'query', titles: chunk.join('|'), prop: 'langlinks|coordinates', lllang: 'ko', lllimit: 'max', colimit: 'max', redirects: 1 });
      const m = resolveMap(j.query, chunk);
      for (const p of j.query.pages || []) {
        const rec = { title: p.title, ko: p.langlinks?.[0]?.title || null, lat: p.coordinates?.[0]?.lat, lon: p.coordinates?.[0]?.lon };
        for (const t of m.get(p.title) || []) info.set(norm(t), rec);
        info.set(norm(p.title), rec);
      }
    } catch (e) { console.warn('wiki info', e); }
    for (const t of chunk) if (!info.has(norm(t))) info.set(norm(t), { title: t });
  }
}
// 영어 요약은 모든 문서, 한국어 요약은 한국어 문서가 있을 때만
async function fetchExtracts(recs) {
  for (const lang of ['en', 'ko']) {
    const field = lang === 'en' ? 'extractEn' : 'extractKo';
    const todo = recs.filter((r) => r[field] === undefined && (lang === 'en' || r.ko));
    for (let i = 0; i < todo.length; i += 20) {
      const chunk = todo.slice(i, i + 20), titles = chunk.map((r) => (lang === 'ko' ? r.ko : r.title));
      try {
        const j = await wjson({ action: 'query', titles: titles.join('|'), prop: 'extracts', exintro: 1, explaintext: 1, exsentences: 3, exlimit: 20, redirects: 1 }, lang);
        const m = resolveMap(j.query, titles);
        for (const p of j.query.pages || []) for (const t of m.get(p.title) || []) {
          const r = chunk[titles.indexOf(t)];
          if (r && p.extract) r[field] = p.extract.replace(/\s+/g, ' ').trim();
        }
      } catch (e) { console.warn('extract', e); }
      for (const r of chunk) if (r[field] === undefined) r[field] = null;
    }
  }
}

/* ---------- 1) 진행 중인 무력 분쟁 목록 ---------- */
// "(Thai: …; Malay: …)" 같은 언어 병기 괄호는 번역을 망가뜨리므로 제거
const stripGloss = (s) => s.replace(/\s*\((?:[^()]*?(?:[A-Z][a-z]+|[가-힣]+어)\s*:)[^()]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
const TIERS = ['major', 'minor', 'conflict', 'skirmish'];
export const tierLabel = (tier) => t({ major: 'tierMajor', minor: 'tierMinor', conflict: 'tierConflict', skirmish: 'tierSkirmish' }[tier] || '');
async function loadWiki() {
  const [doc] = await Promise.all([parsePage('List_of_ongoing_armed_conflicts'), Promise.race([geoReady, sleep(15000)])]);
  const tables = [...doc.querySelectorAll('table.wikitable')].slice(0, 4);
  const rows = [];
  tables.forEach((t, ti) => {
    const grid = tableGrid(t);
    for (let r = 1; r < grid.length; r++) {
      const c = grid[r];
      if (!c || c.length < 7 || c[1].tagName === 'TH') continue;
      if (r > 1 && grid[r - 1]?.[1] === c[1]) continue;
      const links = [...c[1].querySelectorAll('a[href^="/wiki/"]')].map(titleOf).filter((x) => x && !/^(File|Category|Help|Template|Wikipedia):/.test(x));
      if (!links.length) continue;
      rows.push({ tier: TIERS[ti], start: clean(c[0]).match(/\d{4}/)?.[0] || clean(c[0]), main: links[0], links, name: c[1].querySelector('a')?.textContent.trim() || links[0],
        countries: findCountries(clean(c[3])), cum: clean(c[4]), f25: clean(c[5]), f26: clean(c[6]) });
    }
  });
  if (!rows.length) throw new Error('table parse error');
  const consumed = new Set();
  for (const ev of EVENTS) {
    let best = null, bi = 1e9;
    for (const row of rows) row.links.forEach((l, i) => {
      const ki = (ev.wiki || []).findIndex((k) => matchTitle(l, k));
      if (ki < 0) return;
      consumed.add(row);
      if (ki * 100 + i < bi) { bi = ki * 100 + i; best = row; }
    });
    ev.wikiRow = best;
  }
  const auto = rows.filter((r) => !consumed.has(r));
  await fetchInfo(auto.flatMap((r) => r.links.slice(0, 6)));
  await fetchExtracts([...new Set(auto.map((r) => info.get(norm(r.main))).filter(Boolean))]);
  const ids = new Set();
  for (const row of auto) {
    const rec = info.get(norm(row.main)) || {};
    const withCoord = row.links.slice(0, 6).map((l) => info.get(norm(l))).find((r) => r?.lat != null);
    let lat = withCoord?.lat, lon = withCoord?.lon, approx = false;
    if (lat == null && refined.has('wiki:' + row.main)) [lat, lon] = refined.get('wiki:' + row.main);
    if (lat == null && row.countries[0]) { [lat, lon] = countryPoint(row.countries[0]); approx = true; }
    if (lat == null) continue;
    const id = 'wiki:' + row.main;
    [lat, lon] = nudge(lat, lon, id);
    ids.add(id);
    upsert({
      id, auto: 'wiki', cat: row.tier === 'major' || row.tier === 'minor' ? 'war' : 'clash', name: row.name, nameEn: row.name, nameKo: rec.ko || undefined, en: row.main,
      region: row.countries.map(countryKo).join(' · ') || '—', regionEn: row.countries.join(' · ') || '—', lat, lon, approx, start: row.start, level: 'active', tier: row.tier,
      intensity: { major: 3, minor: 2, conflict: 1, skirmish: 1 }[row.tier], size: { major: 0.85, minor: 0.7, conflict: 0.55, skirmish: 0.45 }[row.tier], minor: row.tier === 'skirmish',
      summary: stripGloss(rec.extractEn || ''), summaryKo: rec.extractKo ? stripGloss(rec.extractKo) : undefined,
      wiki: row.links.slice(0, 8), wikiRow: row, points: [],
      articles: [{ t: `${row.main} — Wikipedia`, s: 'Wikipedia (EN)', d: '', u: wikiUrl(row.main) }, ...(rec.ko ? [{ t: `${rec.ko} — 위키백과`, s: 'Wikipedia (KO)', d: '', u: wikiUrl(rec.ko, 'ko') }] : [])],
      q: row.main.replace(/\(.*?\)/g, '').trim(), q2: row.countries[0] || row.main.split(' ')[0], qko: rec.ko || row.name,
    });
  }
  removeWhere((s) => s.ev.auto === 'wiki' && !ids.has(s.id));
  refineLocations(auto.filter((r) => sites.some((s) => s.id === 'wiki:' + r.main && s.ev.approx)));
  return rows.length;
}

// 좌표 없는 분쟁: 문서 첫 문단에 링크된 지명 중 해당 국가 안에 있는 첫 장소로 위치를 보정
const leadCache = new Map(), refined = new Map();
async function leadLinks(title) {
  if (leadCache.has(title)) return leadCache.get(title);
  let out = [];
  try {
    const j = await wjson({ action: 'parse', page: title, prop: 'text', section: 0, redirects: 1 });
    const doc = new DOMParser().parseFromString(j.parse?.text || '', 'text/html');
    out = [...doc.querySelectorAll('p a[href^="/wiki/"]')].map(titleOf)
      .filter((x) => x && !x.includes(':') && !canonCountry(x) && !/^\d/.test(x)).slice(0, 40);
  } catch { /* 무시 */ }
  leadCache.set(title, out);
  return out;
}
async function refineLocations(rows) {
  if (!rows.length) return;
  await Promise.race([geoReady, sleep(20000)]);
  const lists = [];
  for (let i = 0; i < rows.length; i += 6) lists.push(...await Promise.all(rows.slice(i, i + 6).map((r) => leadLinks(r.main))));
  await fetchInfo(lists.flat());
  let moved = 0;
  rows.forEach((row, i) => {
    const placed = lists[i].map((l) => info.get(norm(l))).filter((r) => r?.lat != null).map((r) => ({ r, c: canonCountry(countryAt(r.lat, r.lon)?.en || '') }));
    const hit = row.countries.map((cn) => placed.find((p) => p.c === cn)).find(Boolean);
    if (hit) {
      const r = hit.r;
      const id = 'wiki:' + row.main, [lat, lon] = nudge(r.lat, r.lon, id);
      refined.set(id, [lat, lon]);
      if (getSite(id)) upsert({ id, lat, lon, approx: false });
      moved++;
    }
  });
  if (moved) app.refreshUI?.();
}

/* ---------- 2) 오늘의 사건 (최근 7일) ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dayISO(id) {
  const m = String(id).match(/(\d{4})_(\w+)_(\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}
function walk(li, chain, section, date, out) {
  const kids = [...li.children];
  const direct = kids.filter((x) => x.tagName === 'A' && (x.getAttribute('href') || '').startsWith('/wiki/')).map(titleOf);
  const sub = kids.find((x) => x.tagName === 'UL');
  const hasExt = kids.some((x) => x.tagName === 'A' && x.classList.contains('external'));
  if (sub && !hasExt) { for (const c of sub.children) walk(c, chain.concat(direct), section, date, out); return; }
  const clone = li.cloneNode(true);
  clone.querySelectorAll('ul, sup').forEach((u) => u.remove());
  const sources = [...clone.querySelectorAll('a.external')].map((a) => ({ t: a.textContent.replace(/[()]/g, '').trim(), u: a.getAttribute('href') }));
  clone.querySelectorAll('a.external').forEach((a) => a.remove());
  const text = clone.textContent.replace(/\s+/g, ' ').trim();
  const links = [...clone.querySelectorAll('a[href^="/wiki/"]')].map(titleOf).filter(Boolean);
  if (text) out.push({ date, section, chain, links, text, sources });
  if (sub) for (const c of sub.children) walk(c, chain.concat(direct), section, date, out);
}
const RIOT_RE = /\briot|unrest|looting|tear gas|clash(?:es|ed)? with (?:police|security)|violent protest|water cannon|rubber bullets|curfew/i;
const PROTEST_RE = /\bprotest|demonstrat|rally|rallies|\bmarch(?:es|ed)?\b|strike action|general strike|sit-in/i;
function classify(it) {
  const s = it.section.toLowerCase(), all = `${it.text} ${it.chain.join(' ')}`;
  if (s.includes('armed conflict') || s.includes('attacks')) return RIOT_RE.test(all) && PROTEST_RE.test(all) ? 'riot' : 'conflict';
  if (RIOT_RE.test(all) && (PROTEST_RE.test(all) || /riot/i.test(all))) return 'riot';
  if (PROTEST_RE.test(all)) return 'protest';
  return null;
}
const WORDN = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, dozen: 12, dozens: 24, scores: 40, hundreds: 200, thousands: 2000 };
const NUM = `(\\d[\\d,]*(?:\\.\\d+)?(?:\\s*(?:million|thousand))?|${Object.keys(WORDN).join('|')})`;
const Q = '(?:at least|more than|over|nearly|about|around|some|up to|almost|another)?\\s*';
const toN = (s) => { s = s.toLowerCase().replace(/,/g, '').trim(); const n = parseFloat(s); if (isNaN(n)) return WORDN[s] || 0; return n * (/million/.test(s) ? 1e6 : /thousand/.test(s) ? 1e3 : 1); };
const RX = {
  killed: [new RegExp(`${Q}\\b${NUM}\\s+(?:[a-z-]+\\s+){0,3}?(?:are|were|have been|has been|had been|is|was|being)?\\s*(?:killed|dead|died|deaths|fatalities|massacred)`, 'gi'),
    new RegExp(`(?:killing|kills|killed|leaving)\\s+${Q}\\b${NUM}`, 'gi'), new RegExp(`death toll (?:rises|climbs|reaches|stands at|of)\\s+(?:to\\s+)?${Q}\\b${NUM}`, 'gi')],
  injured: [new RegExp(`${Q}\\b${NUM}\\s+(?:[a-z-]+\\s+){0,3}?(?:are|were|have been|has been|had been|is|was|being)?\\s*(?:injured|wounded|hurt)`, 'gi'),
    new RegExp(`(?:injuring|wounding|injures|wounds)\\s+${Q}\\b${NUM}`, 'gi')],
};
export function extractCas(text) {
  const out = { killed: 0, injured: 0 };
  for (const k of ['killed', 'injured']) for (const re of RX[k]) for (const m of text.matchAll(re)) {
    const n = toN(m[1]);
    if (n >= 1900 && n <= 2100 && !/people|civilians|soldiers|persons|others|children/i.test(m[0])) continue;
    out[k] = Math.max(out[k], n);
  }
  return out;
}
function sumCas(news) {
  if (!news?.length) return null;
  let killed = 0, injured = 0, at = '';
  for (const it of news) { const c = it.cas || extractCas(it.text); killed = Math.max(killed, c.killed); injured = Math.max(injured, c.injured); if (c.killed || c.injured) at = at > it.date ? at : it.date; }
  return killed || injured ? { killed, injured, at } : null;
}
async function loadNews() {
  const [doc] = await Promise.all([parsePage('Portal:Current_events'), Promise.race([geoReady, sleep(15000)])]);
  const items = [];
  for (const day of doc.querySelectorAll('.current-events-main')) {
    const date = dayISO(day.id), content = day.querySelector('.current-events-content');
    if (!content) continue;
    let section = '';
    for (const el of content.children) {
      if (el.tagName === 'P' || el.getAttribute('role') === 'heading') section = el.textContent.trim();
      else if (el.tagName === 'UL') for (const li of el.children) walk(li, [], section, date, items);
    }
  }
  if (!items.length) throw new Error('current events parse error');
  for (const s of sites) s.ev.news = [];
  const groups = new Map();
  for (const it of items) {
    it.kind = classify(it);
    if (!it.kind) continue;
    it.cas = extractCas(it.text);
    const titles = [...it.chain, ...it.links];
    let site = null;
    for (const s of sites) {
      if (s.ev.auto === 'news') continue;
      const keys = [...(s.ev.wiki || []), s.ev.auto ? s.ev.en : null].filter(Boolean);
      if (keys.some((k) => titles.some((t) => matchTitle(t, k)))) { site = s; break; }
    }
    if (site) { if (!site.ev.news.some((n) => n.text === it.text)) site.ev.news.push(it); continue; }
    const key = it.chain[it.chain.length - 1] || it.links[0];
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  await fetchInfo([...groups.keys(), ...[...groups.values()].flat().flatMap((i) => [...i.chain, ...i.links.slice(0, 5)])]);
  const ids = new Set();
  for (const [key, list] of groups) {
    list.sort((a, b) => b.date.localeCompare(a.date));
    let lat, lon;
    for (const t of [key, ...list.flatMap((i) => [...i.chain].reverse()), ...list.flatMap((i) => i.links)]) {
      const r = info.get(norm(t));
      if (r?.lat != null) { lat = r.lat; lon = r.lon; break; }
    }
    const countries = findCountries(list.map((i) => `${i.text} ${i.chain.join(' ')} ${i.links.join(' ')}`).join(' '));
    if (lat == null && countries[0]) [lat, lon] = countryPoint(countries[0]);
    if (lat == null) continue;
    const kinds = list.map((i) => i.kind), cat = kinds.includes('riot') ? 'riot' : kinds.includes('protest') ? 'protest' : 'clash';
    const rec = info.get(norm(key)) || {}, id = 'news:' + key;
    [lat, lon] = nudge(lat, lon, id);
    ids.add(id);
    upsert({
      id, auto: 'news', cat, name: key, nameEn: key, nameKo: rec.ko || undefined, en: key,
      region: countries.map(countryKo).join(' · ') || '—', regionEn: countries.join(' · ') || '—', lat, lon,
      start: list[list.length - 1].date, level: 'active', intensity: 1, size: 0.45, minor: true,
      summary: list[0].text, points: [], wiki: [key], news: list,
      articles: list.flatMap((i) => i.sources.slice(0, 2).map((s) => ({ t: `${s.t} · ${i.date}`, s: s.t, d: i.date, u: s.u }))).slice(0, 6),
      q: key.replace(/\(.*?\)/g, '').trim(), q2: countries[0] || key.split(' ')[0], qko: rec.ko || key,
    });
  }
  removeWhere((s) => s.ev.auto === 'news' && !ids.has(s.id));
  for (const s of sites) s.ev.newsCas = sumCas(s.ev.news);
  return items.filter((i) => i.kind).length;
}

/* ---------- 6) GDELT (사건 선택 시) ---------- */
let gdeltLast = 0, liveToken = 0, gdeltQueue = Promise.resolve();
const gdeltCache = new Map();
function gdeltFetch(q, token, onRetry) {
  const job = gdeltQueue.then(async () => {
    if (gdeltCache.has(q)) return gdeltCache.get(q);
    if (token !== liveToken) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) onRetry?.();
      const wait = gdeltLast + 5600 - Date.now();
      if (wait > 0) await sleep(wait);
      if (token !== liveToken) return null;
      gdeltLast = Date.now();
      let txt = '';
      try {
        const r = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=8&format=json&sort=datedesc&timespan=7d`);
        txt = (await r.text()).trim();
      } catch { /* GDELT는 요청 제한 응답에 CORS 헤더를 붙이지 않는다 */ }
      if (!txt.startsWith('{')) { gdeltLast = Date.now() + 4000; continue; }
      const arts = JSON.parse(txt).articles || [];
      gdeltCache.set(q, arts);
      feeds.gdelt.ok = true; feeds.gdelt.at = Date.now();
      return arts;
    }
    feeds.gdelt.ok = false; feeds.gdelt.at = Date.now();
    throw new Error('rate-limited');
  });
  gdeltQueue = job.catch(() => {});
  return job;
}
export async function loadGdelt(ev, render) {
  const token = ++liveToken;
  const queries = [...new Set([ev.q, ev.q2].filter(Boolean))];
  let arts = [];
  try {
    for (const q of queries) {
      arts = (await gdeltFetch(q, token, () => token === liveToken && render({ state: 'retry' }))) ?? [];
      if (token !== liveToken) return;
      if (arts.length) break;
    }
  } catch { if (token === liveToken) render({ state: 'error' }); return; }
  if (token === liveToken) render({ state: 'ok', arts });
}

/* ---------- scheduler ---------- */
async function job(key, fn) {
  const f = feeds[key];
  try { f.n = await fn(); f.ok = true; f.err = ''; } catch (e) { console.warn(key, e); f.ok = false; f.err = String(e.message || e); }
  f.at = Date.now();
  app.refreshUI?.();
}
export async function startLive() {
  await job('wiki', loadWiki);
  await job('news', loadNews);
  setInterval(() => job('news', loadNews), 30 * 60e3);
  setInterval(async () => { await job('wiki', loadWiki); }, 60 * 60e3);
}
export { firstNum };
