import { EVENTS, COUNTRIES, findCountries, countryKo } from './data.js';
import { sites, upsert, removeWhere } from './sites.js';
import { app } from './core.js';

export const feeds = {
  wiki: { name: '위키백과 · 진행 중인 무력 분쟁 목록', every: 60, ok: null, at: 0, n: 0 },
  news: { name: '위키백과 · 오늘의 사건 (최근 7일)', every: 30, ok: null, at: 0, n: 0 },
  gdelt: { name: 'GDELT · 사건별 실시간 기사', every: 0, ok: null, at: 0, n: 0 },
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
function nudge(lat, lon, selfId) {
  for (let k = 0; k < 5; k++) {
    if (!sites.some((s) => s.id !== selfId && Math.abs(s.ev.lat - lat) < 1.1 && Math.abs(s.ev.lon - lon) < 1.1)) break;
    lon += 1.5; lat += k % 2 ? 0.6 : -0.6;
  }
  return [lat, lon];
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
async function fetchExtracts(recs) {
  for (const [lang, list] of [['ko', recs.filter((r) => r.ko && r.extract === undefined)], ['en', null]]) {
    const todo = list || recs.filter((r) => !r.extract && r.extractTried !== true);
    for (let i = 0; i < todo.length; i += 20) {
      const chunk = todo.slice(i, i + 20), titles = chunk.map((r) => (lang === 'ko' ? r.ko : r.title));
      try {
        const j = await wjson({ action: 'query', titles: titles.join('|'), prop: 'extracts', exintro: 1, explaintext: 1, exsentences: 3, exlimit: 20, redirects: 1 }, lang);
        const m = resolveMap(j.query, titles);
        for (const p of j.query.pages || []) for (const t of m.get(p.title) || []) {
          const r = chunk[titles.indexOf(t)];
          if (r && p.extract) { r.extract = p.extract.replace(/\s+/g, ' ').trim(); r.extractLang = lang; }
        }
      } catch (e) { console.warn('extract', e); }
      for (const r of chunk) { if (lang === 'en') r.extractTried = true; else if (r.extract === undefined) r.extract = null; }
    }
  }
}

/* ---------- 1) 진행 중인 무력 분쟁 목록 ---------- */
const TIERS = ['major', 'minor', 'conflict', 'skirmish'];
export const TIER_KO = { major: '대규모 전쟁 (연간 전투 사망 1만 명 이상)', minor: '소규모 전쟁 (연간 1,000–9,999명)', conflict: '분쟁 (연간 100–999명)', skirmish: '충돌·교전 (연간 100명 미만)' };
async function loadWiki() {
  const doc = await parsePage('List_of_ongoing_armed_conflicts');
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
  if (!rows.length) throw new Error('표 구조를 읽지 못함');
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
  await fetchInfo(auto.map((r) => r.main));
  await fetchExtracts([...new Set(auto.map((r) => info.get(norm(r.main))).filter(Boolean))]);
  const ids = new Set();
  for (const row of auto) {
    const rec = info.get(norm(row.main)) || {};
    let lat = rec.lat, lon = rec.lon;
    if (lat == null && row.countries[0]) [lat, lon] = COUNTRIES[row.countries[0]];
    if (lat == null) continue;
    const id = 'wiki:' + row.main;
    [lat, lon] = nudge(lat, lon, id);
    ids.add(id);
    upsert({
      id, auto: 'wiki', cat: row.tier === 'major' || row.tier === 'minor' ? 'war' : 'clash', name: rec.ko || row.name, en: row.main,
      region: row.countries.map(countryKo).join(' · ') || '—', lat, lon, start: row.start, level: 'active',
      intensity: { major: 3, minor: 2, conflict: 1, skirmish: 1 }[row.tier], size: { major: 0.85, minor: 0.7, conflict: 0.55, skirmish: 0.45 }[row.tier], minor: row.tier === 'skirmish',
      summary: rec.extract || `${TIER_KO[row.tier]}으로 분류된 분쟁입니다.`, summaryLang: rec.extract ? rec.extractLang : 'ko',
      wiki: row.links.slice(0, 8), wikiRow: row, points: [],
      articles: [{ t: `${row.main} — Wikipedia`, s: 'Wikipedia (영문)', d: '갱신 중', u: wikiUrl(row.main) }, ...(rec.ko ? [{ t: `${rec.ko} — 위키백과`, s: '위키백과 (한국어)', d: '', u: wikiUrl(rec.ko, 'ko') }] : [])],
      q: row.main.replace(/\(.*?\)/g, '').trim(), q2: row.countries[0] || row.main.split(' ')[0], qko: rec.ko || row.name,
    });
  }
  removeWhere((s) => s.ev.auto === 'wiki' && !ids.has(s.id));
  return rows.length;
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
  const doc = await parsePage('Portal:Current_events');
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
  if (!items.length) throw new Error('오늘의 사건을 읽지 못함');
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
    if (lat == null && countries[0]) [lat, lon] = COUNTRIES[countries[0]];
    if (lat == null) continue;
    const kinds = list.map((i) => i.kind), cat = kinds.includes('riot') ? 'riot' : kinds.includes('protest') ? 'protest' : 'clash';
    const rec = info.get(norm(key)) || {}, id = 'news:' + key;
    [lat, lon] = nudge(lat, lon, id);
    ids.add(id);
    upsert({
      id, auto: 'news', cat, name: rec.ko || key, en: key, region: countries.map(countryKo).join(' · ') || '—', lat, lon,
      start: list[list.length - 1].date, level: 'active', intensity: 1, size: 0.45, minor: true,
      summary: list[0].text, summaryLang: 'en', points: [], wiki: [key], news: list,
      articles: list.flatMap((i) => i.sources.slice(0, 2).map((s) => ({ t: `${s.t} 보도 (${i.date})`, s: s.t, d: i.date, u: s.u }))).slice(0, 6),
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
