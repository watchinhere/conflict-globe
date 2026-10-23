// 매일 실행(GitHub Actions): 위키백과에서 최신 동향·집계를 받아 정적 기사·목록·사이트맵을 다시 만든다.
// 사용: node tools/build.mjs   (저장소 루트에서)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { DOMParser } from 'linkedom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://watchinhere.github.io/conflict-globe/';
const ISSUES = 'https://github.com/watchinhere/conflict-globe/issues';
const POLICY_DATE = '2026-10-23';
const TODAY = new Date().toISOString().slice(0, 10);
const KEEP_DAYS = 45, KEEP_ITEMS = 12;
const UA = 'ConflictWatchGlobe/1.0 (https://github.com/watchinhere/conflict-globe)';

const { EVENTS, CATS, ASOF } = await import('../js/data.js');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => String(s).replace(/-/g, '.');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = async (p, d) => { try { return JSON.parse(await readFile(join(ROOT, p), 'utf8')); } catch { return d; } };
async function write(p, s) { await mkdir(dirname(join(ROOT, p)), { recursive: true }); await writeFile(join(ROOT, p), s); }

/* ---------- 위키백과 ---------- */
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[–—]/g, '-').replace(/_/g, ' ').trim();
const matchTitle = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || a.startsWith(b + ' (') || a.startsWith(b + ' -') || b.startsWith(a + ' (')); };
const titleOf = (a) => { try { return decodeURIComponent((a.getAttribute('href') || '').replace(/^\/wiki\//, '').split('#')[0]).replace(/_/g, ' '); } catch { return ''; } };
const clean = (el) => (el?.textContent || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
async function parsePage(page) {
  const u = `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&page=${encodeURIComponent(page)}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${page}: HTTP ${r.status}`);
  return new DOMParser().parseFromString(`<html><body>${(await r.json()).parse.text}</body></html>`, 'text/html');
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
// 진행 중인 무력 분쟁 목록에서 큐레이션 사건별 누적·올해 사망자 집계를 찾는다
async function loadTallies() {
  const doc = await parsePage('List_of_ongoing_armed_conflicts');
  const tables = [...doc.querySelectorAll('table.wikitable')].slice(0, 4);
  const rows = [];
  for (const t of tables) {
    const grid = tableGrid(t), head = (grid[0] || []).map(clean);
    const year = head[6]?.match(/\d{4}/)?.[0] || TODAY.slice(0, 4);
    for (let r = 1; r < grid.length; r++) {
      const c = grid[r];
      if (!c || c.length < 7 || c[1].tagName === 'TH' || (r > 1 && grid[r - 1]?.[1] === c[1])) continue;
      const links = [...c[1].querySelectorAll('a[href^="/wiki/"]')].map(titleOf).filter((x) => x && !x.includes(':'));
      if (links.length) rows.push({ links, cum: clean(c[4]), cur: clean(c[6]), year });
    }
  }
  const out = {};
  for (const ev of EVENTS) {
    let best = null, bi = 1e9;
    for (const row of rows) row.links.forEach((l, i) => {
      const ki = (ev.wiki || []).findIndex((k) => matchTitle(l, k));
      if (ki >= 0 && ki * 100 + i < bi) { bi = ki * 100 + i; best = row; }
    });
    if (best && (best.cum || best.cur)) out[ev.id] = { cum: best.cum, cur: best.cur, year: best.year, page: best.links[0] };
  }
  return out;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dayISO(id) {
  const m = String(id).match(/(\d{4})_(\w+)_(\d{1,2})/);
  return m ? `${m[1]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}
function walk(li, chain, date, out) {
  const kids = [...li.children];
  const direct = kids.filter((x) => x.tagName === 'A' && (x.getAttribute('href') || '').startsWith('/wiki/')).map(titleOf);
  const sub = kids.find((x) => x.tagName === 'UL');
  const hasExt = kids.some((x) => x.tagName === 'A' && x.classList.contains('external'));
  if (sub && !hasExt) { for (const c of sub.children) walk(c, chain.concat(direct), date, out); return; }
  const clone = li.cloneNode(true);
  clone.querySelectorAll('ul, sup').forEach((u) => u.remove());
  const sources = [...clone.querySelectorAll('a.external')].map((a) => ({ t: a.textContent.replace(/[()]/g, '').trim(), u: a.getAttribute('href') }));
  clone.querySelectorAll('a.external').forEach((a) => a.remove());
  const text = clone.textContent.replace(/\s+/g, ' ').trim();
  const links = [...clone.querySelectorAll('a[href^="/wiki/"]')].map(titleOf).filter(Boolean);
  if (text) out.push({ date, chain, links, text, sources: sources.slice(0, 3) });
  if (sub) for (const c of sub.children) walk(c, chain.concat(direct), date, out);
}
// 최근 7일 '오늘의 사건'에서 큐레이션 사건과 연결되는 항목
async function loadNews() {
  const doc = await parsePage('Portal:Current_events');
  const items = [];
  for (const day of doc.querySelectorAll('.current-events-main')) {
    const date = dayISO(day.id), content = day.querySelector('.current-events-content');
    if (!date || !content) continue;
    for (const el of content.children) if (el.tagName === 'UL') for (const li of el.children) walk(li, [], date, items);
  }
  if (!items.length) throw new Error('current events parse error');
  const out = {};
  for (const it of items) {
    const titles = [...it.chain, ...it.links];
    const ev = EVENTS.find((e) => (e.wiki || []).some((k) => titles.some((t) => matchTitle(t, k))));
    if (ev) (out[ev.id] ||= []).push({ date: it.date, text: it.text, sources: it.sources });
  }
  return out;
}

/* ---------- 번역 (Google gtx) ---------- */
async function toKo(text) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`);
      if (r.ok) return ((await r.json())[0] || []).map((s) => s[0]).join('');
    } catch { /* 재시도 */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}

/* ---------- 상태 갱신 ---------- */
const state = await read('data/recent.json', { updated: '', news: {}, tallies: {} });
let news = {}, tallies = state.tallies || {};
try { news = await loadNews(); } catch (e) { console.warn('news', e.message); }
try { tallies = { ...tallies, ...await loadTallies() }; } catch (e) { console.warn('tallies', e.message); }
const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
let translated = 0;
for (const ev of EVENTS) {
  const old = state.news[ev.id] || [], add = news[ev.id] || [];
  const merged = [...add.filter((n) => !old.some((o) => o.text === n.text)), ...old]
    .filter((n) => n.date >= cutoff).sort((a, b) => b.date.localeCompare(a.date)).slice(0, KEEP_ITEMS);
  for (const n of merged) if (!n.ko) { n.ko = await toKo(n.text); if (n.ko) translated++; await sleep(300); }
  if (merged.length) state.news[ev.id] = merged; else delete state.news[ev.id];
}
state.tallies = tallies;
state.updated = TODAY;
await write('data/recent.json', JSON.stringify(state, null, 1) + '\n');
console.log(`news: ${Object.values(news).flat().length} new matched, ${translated} translated; tallies: ${Object.keys(tallies).length}`);

/* ---------- 페이지 ---------- */
const LV = { ko: { escalating: '격화', active: '진행 중', stalemate: '교착', ceasefire: '불안한 휴전' }, en: { escalating: 'Escalating', active: 'Active', stalemate: 'Stalemate', ceasefire: 'Fragile ceasefire' } };
const CL = { ko: { killed: '사망', injured: '부상', displaced: '피란', detained: '구금 · 연행', missing: '실종' }, en: { killed: 'Killed', injured: 'Injured', displaced: 'Displaced', detained: 'Detained', missing: 'Missing' } };
const T = {
  ko: { site: '분쟁 관측 지구본', home: '지구본', list: '분쟁 목록', about: '소개', privacy: '개인정보처리방침', terms: '이용약관', contact: '문의', other: 'English',
    region: '지역', start: '시작', status: '현재 상황', updated: '최종 업데이트', keys: '주요 동향', recent: '최근 소식', recentNote: '위키백과 ‘오늘의 사건’에서 매일 자동 수집 · 한국어는 기계 번역',
    tally: '위키백과 사망자 집계', tallyCum: '누적', tallyCur: '{y}년', cas: '사상자 · 피해', sources: '출처', open: '3D 지구본에서 이 분쟁 보기',
    casNone: '신뢰할 만한 집계가 아직 없습니다. 3D 지구본의 상세 패널에서 위키백과 실시간 집계를 확인할 수 있습니다.',
    liveNote: '개요와 사상자 수치는 {a} 기준으로 정리했고, 최근 소식과 위키백과 집계는 매일 자동으로 갱신됩니다({d}).',
    listTitle: '진행 중인 분쟁 목록', listLede: '분쟁 관측 지구본이 추적하는 주요 무력 분쟁·시위·인권 사안입니다. 각 항목은 공개 보도를 바탕으로 정리한 개요와 사상자 현황, 출처를 담고 있습니다.',
    latest: '최근 7일 주요 소식',
    groups: { conflict: '전쟁 · 무력 분쟁', unrest: '폭동 · 시위', rights: '인권 · 탄압' }, copy: '공개 출처 정보(OSINT) 기반 비영리 시각화 프로젝트' },
  en: { site: 'Conflict Watch Globe', home: 'Globe', list: 'Conflicts', about: 'About', privacy: 'Privacy', terms: 'Terms', contact: 'Contact', other: '한국어',
    region: 'Region', start: 'Began', status: 'Status', updated: 'Updated', keys: 'Key developments', recent: 'Latest news', recentNote: 'Collected daily from the Wikipedia Current events portal',
    tally: 'Wikipedia fatality tally', tallyCum: 'Total', tallyCur: '{y}', cas: 'Casualties · Impact', sources: 'Sources', open: 'View this conflict on the 3D globe',
    casNone: 'No reliable tally yet. The event panel on the 3D globe shows the live Wikipedia tally.',
    liveNote: 'The overview and casualty figures summarise reporting as of {a}; latest news and the Wikipedia tally refresh automatically every day ({d}).',
    listTitle: 'Ongoing conflicts', listLede: 'Major armed conflicts, protests and human-rights crises tracked by Conflict Watch Globe. Each entry summarises public reporting with casualty figures and sources.',
    latest: 'Highlights from the last 7 days',
    groups: { conflict: 'War · Armed conflict', unrest: 'Riots · Protests', rights: 'Human rights' }, copy: 'A non-commercial visualisation project built on open-source information (OSINT)' },
};
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">';
const ICON = (await readFile(join(ROOT, 'index.html'), 'utf8')).match(/<link rel="icon"[^>]*>/)[0];
const CSSV = createHash('sha1').update(await readFile(join(ROOT, 'css/pages.css'))).digest('hex').slice(0, 8);
const ogPath =(id, lang) => `og/${lang}/${id}.jpg`;
const evName = (ev, en) => (en ? ev.en : ev.name);
const newsText = (n, en) => (en ? n.text : n.ko || n.text);

function page({ lang, path, alt, title, desc, body, current, wide, image, ld }) {
  const t = T[lang], up = '../'.repeat(path.split('/').length - 1), pre = lang === 'en' ? 'en/' : '';
  const nav = [['index.html', t.home], [`${pre}conflicts/index.html`, t.list, 'list'], [`${pre}about.html`, t.about, 'about'], [`${pre}privacy.html`, t.privacy, 'privacy'], [`${pre}contact.html`, t.contact, 'contact']];
  const img = `${BASE}${image || 'og.jpg'}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${t.site}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}${path}">
${alt ? `<link rel="alternate" hreflang="${lang === 'ko' ? 'en' : 'ko'}" href="${BASE}${alt}"><link rel="alternate" hreflang="${lang}" href="${BASE}${path}">` : ''}
<meta property="og:type" content="article"><meta property="og:site_name" content="${t.site}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${BASE}${path}"><meta property="og:image" content="${img}">${image ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : ''}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${img}">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
${ICON}
${FONTS}
<link rel="stylesheet" href="${up}css/pages.css?v=${CSSV}">
</head>
<body>
<header class="site-head"><div class="in">
  <a class="brand" href="${up}index.html"><small>GCM-01</small>${t.site}</a>
  <nav>${nav.map(([h, l, k]) => `<a href="${up}${h}"${k === current ? ' aria-current="page"' : ''}>${l}</a>`).join('')}${alt ? `<a class="lang" href="${up}${alt}" hreflang="${lang === 'ko' ? 'en' : 'ko'}">${t.other}</a>` : ''}</nav>
</div></header>
<main${wide ? ' class="wide"' : ''}>
${body}
</main>
<footer class="site-foot"><div class="in">
  ${nav.slice(1).map(([h, l]) => `<a href="${up}${h}">${l}</a>`).join('')}<a href="${up}${pre}terms.html">${t.terms}</a>
  <span class="cp">© 2026 ${t.site} · ${t.copy}</span>
</div></footer>
</body>
</html>
`;
}
const lastmod = {};
function conflictPage(ev, lang) {
  const t = T[lang], en = lang === 'en';
  const name = evName(ev, en), region = en ? ev.regionEn || ev.region : ev.region;
  const summary = en ? ev.summaryEn : ev.summary, points = (en ? ev.pointsEn : ev.points) || [];
  const cat = en ? CATS[ev.cat].en : CATS[ev.cat].ko;
  const items = ev.cas?.items || [], src = en ? ev.cas?.srcEn : ev.cas?.src;
  const recent = state.news[ev.id] || [], tal = state.tallies[ev.id];
  const mod = [ASOF, recent[0]?.date || ''].sort().pop();
  const path = `${en ? 'en/' : ''}conflicts/${ev.id}.html`, alt = `${en ? '' : 'en/'}conflicts/${ev.id}.html`;
  lastmod[path] = mod;
  const body = `<p class="eyebrow">${esc(cat)}</p>
<h1>${esc(name)}</h1>
<p class="lede">${esc(summary)}</p>
<dl class="meta"><div><dt>${t.region}</dt><dd>${esc(region)}</dd></div><div><dt>${t.start}</dt><dd class="mono">${fmt(ev.start)}</dd></div><div><dt>${t.status}</dt><dd>${LV[lang][ev.level]}</dd></div><div><dt>${t.updated}</dt><dd class="mono"><time datetime="${mod}">${fmt(mod)}</time></dd></div></dl>
${recent.length ? `<h2>${t.recent}</h2><ul class="news">${recent.slice(0, 8).map((n) => `<li><time class="mono" datetime="${n.date}">${fmt(n.date).slice(5)}</time><span>${esc(newsText(n, en))}${n.sources.length ? ` <small>${n.sources.map((s) => `<a href="${esc(s.u)}" rel="noopener nofollow">${esc(s.t)}</a>`).join(' · ')}</small>` : ''}</span></li>`).join('')}</ul><p class="note">${t.recentNote}</p>` : ''}
${points.length ? `<h2>${t.keys}</h2><ul>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
<h2>${t.cas}</h2>
${items.length ? `<div class="cas">${items.map((i) => `<div><span>${CL[lang][i.k]}</span><b>${esc(en ? i.vEn || i.v : i.v)}</b><small>${esc(en ? i.dEn || i.d : i.d)}</small></div>`).join('')}</div>` : `<p>${t.casNone}</p>`}
${src && items.length ? `<p class="note">${esc(src)}</p>` : ''}
${tal ? `<p class="tally"><b>${t.tally}</b>${tal.cum ? ` <span>${t.tallyCum} <em class="mono">${esc(tal.cum)}</em></span>` : ''}${tal.cur ? ` <span>${t.tallyCur.replace('{y}', tal.year)} <em class="mono">${esc(tal.cur)}</em></span>` : ''} <a href="https://en.wikipedia.org/wiki/List_of_ongoing_armed_conflicts" rel="noopener">Wikipedia</a></p>` : ''}
<h2>${t.sources}</h2>
<ul class="sources">${(ev.articles || []).map((a) => `<li><a href="${esc(a.u)}" rel="noopener">${esc(a.t)}</a> <small>${esc(a.s)}${a.d && !/갱신/.test(a.d) ? ' · ' + esc(a.d) : ''}</small></li>`).join('')}</ul>
<p class="note">${t.liveNote.replace('{a}', fmt(ASOF)).replace('{d}', fmt(state.updated))}</p>
<a class="cta" href="../${en ? '../' : ''}index.html#${ev.id}">◎ ${t.open}</a>`;
  const desc = String(summary).slice(0, 155);
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: name, description: desc, inLanguage: lang, image: `${BASE}${ogPath(ev.id, lang)}`,
    datePublished: '2026-10-23', dateModified: mod, mainEntityOfPage: `${BASE}${path}`, author: { '@type': 'Organization', name: t.site }, publisher: { '@type': 'Organization', name: t.site } };
  return { path, html: page({ lang, path, alt, title: name, desc, body, current: 'list', image: ogPath(ev.id, lang), ld }) };
}
function listPage(lang) {
  const t = T[lang], en = lang === 'en', path = `${en ? 'en/' : ''}conflicts/index.html`;
  const week = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const latest = EVENTS.flatMap((ev) => (state.news[ev.id] || []).filter((n) => n.date >= week).slice(0, 2).map((n) => ({ ev, n })))
    .sort((a, b) => b.n.date.localeCompare(a.n.date)).slice(0, 10);
  lastmod[path] = state.updated;
  const body = `<p class="eyebrow">TARGET LIST</p><h1>${t.listTitle}</h1><p class="lede">${t.listLede}</p>
${latest.length ? `<h2>${t.latest}</h2><ul class="news">${latest.map(({ ev, n }) => `<li><time class="mono" datetime="${n.date}">${fmt(n.date).slice(5)}</time><span><a href="${ev.id}.html">${esc(evName(ev, en))}</a> — ${esc(newsText(n, en))}</span></li>`).join('')}</ul>` : ''}
${Object.keys(t.groups).map((g) => {
    const evs = EVENTS.filter((e) => CATS[e.cat].group === g);
    return evs.length ? `<h2>${t.groups[g]}</h2><div class="grid">${evs.map((e) => `<a class="card" style="--c:${CATS[e.cat].color}" href="${e.id}.html"><span class="k">${esc(en ? CATS[e.cat].en : CATS[e.cat].ko)} · ${LV[lang][e.level]}</span><b>${esc(evName(e, en))}</b><span>${esc(en ? e.regionEn || e.region : e.region)}</span></a>`).join('')}</div>` : '';
  }).join('\n')}`;
  return { path, html: page({ lang, path, alt: `${en ? '' : 'en/'}conflicts/index.html`, title: t.listTitle, desc: t.listLede, body, current: 'list', wide: true }) };
}
const STATIC = (await import('./static-pages.mjs')).staticPages({ fmt, UPDATED: POLICY_DATE, ISSUES });
function staticPage(key, lang) {
  const [title, lede, body] = STATIC[key][lang];
  const en = lang === 'en', path = `${en ? 'en/' : ''}${key}.html`, alt = `${en ? '' : 'en/'}${key}.html`;
  lastmod[path] = key === 'about' ? state.updated : POLICY_DATE;
  return { path, html: page({ lang, path, alt, title, desc: lede, body: `<p class="eyebrow">${key.toUpperCase()}</p><h1>${title}</h1><p class="lede">${lede}</p>${body}`, current: key }) };
}

const out = [];
for (const lang of ['ko', 'en']) {
  for (const ev of EVENTS) out.push(conflictPage(ev, lang));
  out.push(listPage(lang));
  for (const k of Object.keys(STATIC)) out.push(staticPage(k, lang));
}
for (const o of out) await write(o.path, o.html);
const urls = [['', state.updated], ...out.map((o) => [o.path, lastmod[o.path]])];
await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `  <url><loc>${BASE}${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`);
await write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);

// 공유 카드는 카드에 들어가는 내용이 바뀐 것만 다시 그린다 (tools/og.mjs가 처리)
const manifest = await read('og/manifest.json', {});
const template = await readFile(join(ROOT, 'tools/og-card.html'));
const cardSig = (ev, lang) => createHash('sha1').update(JSON.stringify([lang, evName(ev, lang === 'en'), ev.cat, ev.level, ev.start, ev.lat, ev.lon, ev.region, ev.regionEn, (ev.cas?.items || []).map((i) => [i.k, i.v, i.vEn])]))
  .update(template).digest('hex').slice(0, 12);
const todo = [];
for (const lang of ['ko', 'en']) for (const ev of EVENTS) {
  const sig = cardSig(ev, lang), p = ogPath(ev.id, lang);
  let exists = true;
  try { await readFile(join(ROOT, p)); } catch { exists = false; }
  if (!exists || manifest[p] !== sig) todo.push({ id: ev.id, lang, path: p, sig });
}
await write('tools/.og-todo.json', JSON.stringify(todo));
console.log(`pages: ${out.length}, og cards to render: ${todo.length}`);
