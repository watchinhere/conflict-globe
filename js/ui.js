import { app } from './core.js';
import { CATS, LEVEL_RANK, ASOF, iconFor, catName, groupName, levelName, casLabel } from './data.js';
import { locate, relabelGeo } from './geo.js';
import { sites } from './sites.js';
import { feeds, loadGdelt, tierLabel, firstNum, norm } from './live.js';
import { t, tx, isEn, I18N, onLang, setLang, applyStatic, mt } from './i18n.js';

const $ = (id) => document.getElementById(id);
export const active = new Set(Object.keys(CATS));
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('cg.' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('cg.' + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } } };
const ui = { q: '', sort: store.get('sort', 'severity'), collapsed: new Set(store.get('collapsed', [])) };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (s) => (!s ? '' : /T\d/.test(s) ? s.slice(0, 10).replace(/-/g, '.') : s.replace(/-/g, '.'));
const num = (n) => Number(n).toLocaleString(isEn() ? 'en-US' : 'ko-KR');
export function since(start) {
  if (!start) return '';
  const iso = /^\d{4}$/.test(start) ? `${start}-01-01` : /^\d{4}-\d{2}$/.test(start) ? `${start}-01` : start;
  const s = new Date(iso), now = new Date();
  if (isNaN(s)) return '';
  const hours = (now - s) / 3600e3;
  if (hours < 24) return hours < 1 ? t('started') : t('hours', { n: Math.floor(hours) });
  const days = Math.floor(hours / 24);
  if (days < 45) return t('days', { n: days });
  const months = (now.getUTCFullYear() - s.getUTCFullYear()) * 12 + (now.getUTCMonth() - s.getUTCMonth());
  const y = Math.floor(months / 12), m = months % 12;
  return y ? (m ? t('ym', { y, m }) : t('years', { y })) : t('months', { n: m });
}
const coord = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
export function relTime(d) {
  if (!d) return '—';
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return t('justNow');
  if (s < 3600) return t('minAgo', { n: Math.floor(s / 60) });
  if (s < 86400) return t('hrAgo', { n: Math.floor(s / 3600) });
  return t('dayAgo', { n: Math.floor(s / 86400) });
}
const trUrl = (text) => `https://translate.google.com/?sl=auto&tl=${I18N.lang}&text=${encodeURIComponent(text)}&op=translate`;
const levelPill = (lv) => `<span class="lvl ${esc(lv)}">${esc(levelName(lv))}</span>`;
const nameOf = (ev) => tx(ev, 'name');
// 부제: 한국어 화면에서만 영어 원명을 덧붙인다 (영어 화면에 한국어를 보이지 않음)
const altName = (ev) => { if (isEn()) return ''; const a = ev.nameEn || ev.en; return a && a !== nameOf(ev) ? a : ''; };

export function casOf(ev) {
  const k = ev.cas?.items?.find((i) => i.k === 'killed');
  if (k) return { text: (isEn() && k.vEn) || k.v, num: ev.cas.killedNum ?? firstNum(k.v) };
  if (ev.wikiRow) {
    const r = ev.wikiRow, use26 = firstNum(r.f26) > 0, v = use26 ? r.f26 : r.cum;
    if (firstNum(v)) return { text: `${v}${use26 ? ' (2026)' : ''}`, num: firstNum(v) };
  }
  if (ev.newsCas?.killed) return { text: `${num(ev.newsCas.killed)}+`, num: ev.newsCas.killed };
  return null;
}

// 사망자 어림값: 전체 / 최근 1년. 자동 수집 사건은 위키백과 행(누적 / 2026년)으로 대신한다.
export function deathsOf(ev) {
  const en = isEn();
  if (ev.deaths) return { total: (en && ev.deaths.totalEn) || ev.deaths.total, year: (en && ev.deaths.yearEn) || ev.deaths.year };
  const r = ev.wikiRow;
  if (r && (r.cum || r.f26)) return { total: r.cum || '—', year: r.f26 ? `${r.f26} (2026)` : '—' };
  return null;
}

// 상단 요약 두 칸: 사망자가 없거나 집계가 없으면 구금·부상 같은 다른 피해를 보여 준다
export function headStats(ev) {
  const d = deathsOf(ev), en = isEn(), hm = ev.harm, P = (p) => p[en ? 1 : 0];
  const noDeaths = d && /^(0명?|집계 없음|no count)$/.test(d.total);
  if (d && !noDeaths) return [[t('dTotal'), d.total], [t('dYear'), d.year]];
  if (!hm) return d ? [[t('dTotal'), d.total], [t('dYear'), d.year]] : null;
  const out = [];
  if (hm.x) out.push([casLabel(hm.x[0]), en ? hm.x[2] : hm.x[1]]);
  if (!/^(0명?|해당 없음|n\/a|집계 없음|no count)$/.test(P(hm.inj))) out.push([t('hInj'), P(hm.inj)]);
  if (out.length < 2) out.push([t('hDisp'), P(hm.disp)]);
  return out.slice(0, 2);
}

/* ---------- 자동 번역: 한국어 모드에서 영어뿐인 이름·요약·동향을 채운다 ---------- */
let fillRun = 0;
async function fillKoNames() {
  if (isEn()) return;
  const run = ++fillRun;
  const todo = sites.filter((s) => s.ev.auto && !s.ev.nameKo && s.ev.name);
  await Promise.all(todo.map(async (s) => {
    const out = await mt(s.ev.name, 'ko');
    if (out && run === fillRun) { s.ev.nameKo = out; s.ev.nameMT = true; s.refreshTag(); }
  }));
  if (run === fillRun && todo.length) { renderList(); if (app.selected && !$('panel').hidden) renderPanel(app.selected, true); }
}
async function fillKoPanel(site) {
  const ev = site.ev, jobs = [];
  if (ev.summary && !ev.summaryKo && !ev.summaryTried) {
    ev.summaryTried = true;
    jobs.push(mt(ev.summary, 'ko').then((o) => { if (o) { ev.summaryKo = o; ev.summaryMT = true; } }));
  }
  for (const n of ev.news || []) if (!n.textKo && !n.koTried) { n.koTried = true; jobs.push(mt(n.text, 'ko').then((o) => { if (o) n.textKo = o; })); }
  if (!jobs.length) return;
  await Promise.all(jobs);
  if (app.selected === site && !isEn()) renderPanel(site, true);
}

/* ---------- filters ---------- */
export function renderFilters() {
  const counts = {};
  for (const s of sites) counts[s.cat] = (counts[s.cat] || 0) + 1;
  $('filters').innerHTML = Object.entries(CATS).map(([k, c]) =>
    `<button type="button" class="chip" data-cat="${k}" aria-pressed="${active.has(k)}" style="--c:${c.color}"><span class="box"></span><span class="nm">${esc(catName(k))}</span><span class="ct">${String(counts[k] || 0).padStart(2, '0')}</span></button>`).join('');
  const total = Object.keys(CATS).length;
  $('filterSum').textContent = `${t('type')} · ${active.size === total ? t('filterAll') : `${active.size}/${total}`}`;
}
// 필터는 접을 수 있다. 화면 폭(휴대폰/PC)별로 마지막 상태를 따로 기억하고, 휴대폰은 접힌 채로 시작
const fKey = () => (innerWidth <= 760 ? 'filtersOpenM' : 'filtersOpen');
function setFilterOpen(open, save) {
  $('filterBox').classList.toggle('shut', !open);
  $('filterToggle').setAttribute('aria-expanded', String(open));
  if (save) store.set(fKey(), open);
}
setFilterOpen(store.get(fKey(), innerWidth > 760), false);
$('filterToggle').addEventListener('click', () => setFilterOpen($('filterBox').classList.contains('shut'), true));
$('filters').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  const k = b.dataset.cat; active.has(k) ? active.delete(k) : active.add(k);
  renderFilters(); renderList();
});

/* ---------- list ---------- */
const GROUP_ORDER = ['conflict', 'unrest', 'rights'];
const sorters = {
  severity: (a, b) => (LEVEL_RANK[a.ev.level] ?? 9) - (LEVEL_RANK[b.ev.level] ?? 9) || (!!a.ev.auto - !!b.ev.auto) || (b.ev.intensity || 0) - (a.ev.intensity || 0) || (casOf(b.ev)?.num || 0) - (casOf(a.ev)?.num || 0),
  recent: (a, b) => (Date.parse(b.ev.start) || 0) - (Date.parse(a.ev.start) || 0),
  casualties: (a, b) => (casOf(b.ev)?.num || 0) - (casOf(a.ev)?.num || 0),
};
const CODE = { war: 'WAR', clash: 'SKR', riot: 'RIOT', protest: 'PRT', oppression: 'HRV' };
function evCode(ev) {
  let h = 0;
  for (const ch of String(ev.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${CODE[ev.cat] || 'EVT'}-${String(h % 10000).padStart(4, '0')}`;
}
function itemHTML(s) {
  const ev = s.ev, hs = headStats(ev);
  return `<button type="button" class="item${s === app.selected ? ' sel' : ''}" data-id="${esc(ev.id)}" style="--c:${s.color}">
    <span class="ix-main">
      <span class="ix-top">${levelPill(ev.level)}${ev.auto ? `<span class="ix-auto">${t('autoTag')}</span>` : ''}<span class="ix-age">${since(ev.start)}</span></span>
      <b class="ix-name">${esc(nameOf(ev))}</b>
      <span class="ix-sub">${esc(tx(ev, 'region'))}</span>
    </span>
    ${hs ? `<span class="ix-kia">${hs.map(([l, v], i) => `<small>${esc(l)}</small><b${i ? ' class="yr"' : ''}>${esc(v)}</b>`).join('')}</span>` : ''}
  </button>`;
}
export function renderList() {
  const q = norm(ui.q);
  const pool = sites.filter((s) => active.has(s.cat) && (!q || norm(`${s.ev.name} ${s.ev.nameKo || ''} ${s.ev.en} ${s.ev.region} ${s.ev.regionEn || ''}`).includes(q)));
  const html = GROUP_ORDER.map((g) => {
    const list = pool.filter((s) => CATS[s.cat].group === g).sort(sorters[ui.sort]);
    if (!list.length) return '';
    const open = !ui.collapsed.has(g) || !!q;
    return `<section class="grp${open ? '' : ' shut'}" data-g="${g}">
      <button type="button" class="grp-h" data-g="${g}" aria-expanded="${open}"><span>${esc(groupName(g))}</span><span class="n">${String(list.length).padStart(2, '0')}</span><svg viewBox="0 0 24 24" class="chev"><path d="M6 9l6 6 6-6"/></svg></button>
      <div class="grp-b">${list.map(itemHTML).join('')}</div>
    </section>`;
  }).join('');
  $('listCount').textContent = t('tracked', { n: pool.length });
  $('list').innerHTML = html || `<p class="empty">${esc(t('empty'))}</p>`;
}
$('list').addEventListener('click', (e) => {
  const h = e.target.closest('.grp-h');
  if (h) { const g = h.dataset.g; ui.collapsed.has(g) ? ui.collapsed.delete(g) : ui.collapsed.add(g); store.set('collapsed', [...ui.collapsed]); renderList(); return; }
  const b = e.target.closest('.item'); if (!b) return;
  const s = sites.find((x) => x.ev.id === b.dataset.id); if (s) select(s, true);
});
$('search').addEventListener('input', (e) => { ui.q = e.target.value; renderList(); });
$('sort').value = ui.sort;
$('sort').addEventListener('change', (e) => { ui.sort = e.target.value; store.set('sort', ui.sort); renderList(); });

/* ---------- selection & panel ---------- */
export function select(site, fly) {
  if (app.selected) { app.selected.hl = 1; app.selected.tag.classList.remove('sel'); }
  app.selected = site;
  site.hl = 1.7; site.tag.classList.add('sel');
  if (fly) app.focusOn(site);
  renderPanel(site); renderList();
  if (innerWidth <= 760) $('rail').classList.add('collapsed');
}
export function closePanel() {
  $('panel').hidden = true;
  if (app.selected) { app.selected.hl = 1; app.selected.tag.classList.remove('sel'); app.selected = null; renderList(); }
}
app.select = select; app.closePanel = closePanel;

function casSection(ev) {
  const items = ev.cas?.items || [], row = ev.wikiRow, nc = ev.newsCas, en = isEn();
  const matchedMain = row && (ev.wiki || []).some((k) => norm(row.main) === norm(k));
  let h = '', extra = '';
  // 사망자는 상단 요약칸에 있으므로 여기서는 그 밖의 피해만 보여 준다
  const hm = ev.harm, L = (p) => esc(p[en ? 1 : 0]);
  if (hm) {
    const cells = [['injured', t('hInj'), hm.inj], ['civ', t('hCiv'), hm.civ], ['displaced', t('hDisp'), hm.disp]];
    if (hm.x) cells.push([hm.x[0], casLabel(hm.x[0]), [hm.x[1], hm.x[2]]]);
    // 상단 요약칸에 이미 나온 항목은 빼서 중복을 없앤다
    const shown = new Set((headStats(ev) || []).map(([l]) => l));
    const rest = cells.filter(([, lab, v]) => !shown.has(lab) && !/^(0명?|해당 없음|n\/a)$/.test(v[en ? 1 : 0]));
    if (rest.length) h += `<div class="h-grid">${rest.map(([k, lab, v]) => `<div class="k-${k}"><small>${esc(lab)}</small><b>${L(v)}</b></div>`).join('')}</div><p class="d-note">${t('dNote')}</p>`;
  }
  // 최근 주요 사건별 사상자 (누적 수치는 위에 있으므로 개별 사건만)
  const V = (v) => (Array.isArray(v) ? v[en ? 1 : 0] : en ? v : v && /^[\d,.–+~ ]+$/.test(v) ? v.replace(/(\+?)$/, '명$1') : v);
  if (ev.recent?.length) h += `<p class="d-sub">${t('recentH')}</p><ul class="inc">${ev.recent.map((r) => `<li><time>${esc(r.d)}</time><p>${esc(en ? r.en : r.ko)}</p><div class="inc-n">${
    [[t('killed'), r.k, 'k'], [t('injured'), r.i, 'i'], ...(r.x ? [['', r.x, 'x']] : [])].filter(([, v]) => v).map(([lab, v, c]) => `<span class="${c}">${lab ? `${esc(lab)} ` : ''}<b>${esc(V(v))}</b></span>`).join('')}</div></li>`).join('')}</ul>`;
  if (row) extra += `<div class="auto-stat"><div class="as-h"><span class="tag-auto">${esc(t('autoTally'))}</span><span>${esc(t('autoTallyD'))}${matchedMain || ev.auto ? '' : ` · ${esc(t('parentRow', { name: row.name }))}`}</span></div>
      <div class="stat-row"><div><small>${t('cum')}</small><b>${esc(row.cum || '—')}</b></div><div><small>${t('y25')}</small><b>${esc(row.f25 || '—')}</b></div><div><small>${t('y26')}</small><b>${esc(row.f26 || '—')}</b></div></div>
      <p class="as-note">${esc(tierLabel(row.tier))} · ${t('hourly')}</p></div>`;
  if (nc) extra += `<div class="auto-stat"><div class="as-h"><span class="tag-auto news">${esc(t('newsTally'))}</span><span>${esc(t('newsTallyD'))}</span></div>
      <div class="stat-row"><div><small>${t('killed')}</small><b>${nc.killed ? t('people', { n: num(nc.killed) }) : '—'}</b></div><div><small>${t('injured')}</small><b>${nc.injured ? t('people', { n: num(nc.injured) }) : '—'}</b></div><div><small>${t('lastMention')}</small><b>${fmtDate(nc.at)}</b></div></div></div>`;
  // 출처가 다른 자동 집계는 수치가 엇갈리므로, 정리된 수치가 있으면 접어 둔다
  if (extra) h += h ? `<details class="more-stat"><summary>${t('otherTally')}</summary>${extra}</details>` : extra;
  return h || `<p class="cas-src">${esc(t('noCas'))}</p>`;
}
function factsFor(ev) {
  const f = [[t('fRegion'), esc(tx(ev, 'region'))]];
  const loc = locate(ev.lat, ev.lon);
  if (loc && ev.approx) f.push([t('fPlace'), `${esc(loc.country)} <small>${esc(t('approx'))}</small>`]);
  else if (loc) f.push([t('fPlace'), `${esc(loc.country)}${loc.near ? ` <small>${esc(loc.near)}</small>` : ''}`]);
  if (ev.zoneNames?.length) f.push([t('fZone'), esc(ev.zoneNames.map((z) => (isEn() ? z.en : z.ko)).join(', '))]);
  f.push([t('fPeriod'), `${fmtDate(ev.start)} – ${t('now')} <small>${since(ev.start)}</small>`]);
  return f;
}
export function renderPanel(site, keepScroll) {
  const ev = site.ev, panel = $('panel'), en = isEn(), top = panel.scrollTop;
  const news = (ev.news || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const srcLabel = ev.auto ? t(ev.auto === 'wiki' ? 'autoWiki' : 'autoNews') : t('curated', { d: ASOF.replace(/-/g, '.') });
  let summary = tx(ev, 'summary');
  if (!summary && ev.tier) summary = t('tierSummary', { tier: tierLabel(ev.tier) });
  const needKo = !en && ((ev.auto && ev.summary && !ev.summaryKo && !ev.summaryTried) || news.some((n) => !n.textKo && !n.koTried));
  const sumMT = !en && ev.summaryMT;
  const points = tx(ev, 'points') || [];
  const qLocal = en ? ev.q : ev.qko || ev.q;
  panel.style.setProperty('--c', site.color);
  panel.innerHTML = `
    <div class="p-bar"><span class="src">${esc(srcLabel)}</span>
      <button type="button" class="close" id="pClose" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="p-hero">
      <span class="badge">${iconFor(ev.cat)}${esc(catName(ev.cat))}</span>
      <h2>${esc(nameOf(ev))}</h2>
      ${altName(ev) ? `<p class="en">${esc(altName(ev))}</p>` : ''}
      <div class="p-meta"><div><small>${t('mStatus')}</small><b>${levelPill(ev.level)}</b></div>${(headStats(ev) || [[t('dTotal'), '—'], [t('dYear'), '—']]).map(([l, v]) => `<div><small>${esc(l)}</small><b class="kia">${esc(v)}</b></div>`).join('')}</div>
    </div>
    <section class="p-sec"><h3>${t('sitrep')}${sumMT ? `<span class="r">${t('mtNote')}</span>` : ''}</h3>
      <p class="sum">${esc(summary)}</p>
      ${sumMT ? `<p class="mt-src"><a href="${trUrl(ev.summary)}" target="_blank" rel="noopener">${t('translate')}</a></p>` : ''}
      ${needKo ? `<p class="mt-wait">${t('translating')}</p>` : ''}
      ${points.length ? `<ul class="pts">${points.map((p) => `<li>${esc(p.replace(' [출처 미확인]', ''))}${p.includes('[출처 미확인]') ? `<em class="unv">${t('unverified')}</em>` : ''}</li>`).join('')}</ul>` : ''}</section>
    <section class="p-sec"><h3>${t('casH')}</h3>${casSection(ev)}</section>
    <section class="p-sec"><h3>${t('basics')}</h3><dl class="facts">${factsFor(ev).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
    ${news.length ? `<section class="p-sec"><h3>${t('timeline')}<span class="r">${t('timelineR')}</span></h3>
      <ol class="timeline">${news.map((n) => `<li><time>${fmtDate(n.date)}</time><p>${esc(!en && n.textKo ? n.textKo : n.text)}</p><div class="tl-links">${n.sources.slice(0, 3).map((s) => `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>`).join('')}${!en && n.textKo ? `<a class="tr" href="${trUrl(n.text)}" target="_blank" rel="noopener">${t('translate')}</a>` : ''}</div></li>`).join('')}</ol></section>` : ''}
    <section class="p-sec"><h3>${t('sources')}</h3>
      <ul class="arts">${(ev.articles || []).map((a) => `<li><a href="${esc(a.u)}" target="_blank" rel="noopener"><b>${esc(a.t)}</b><span>${esc(a.s)}${a.d ? ' · ' + esc(a.d === '갱신 중' ? t('updating') : a.d) : ''}</span></a></li>`).join('')}</ul></section>
    <section class="p-sec"><h3>${t('intercept')}<span class="r">${t('interceptR')}</span></h3><ul class="arts" id="live"><li class="msg">${t('gdeltWait')}</li></ul>
      <div class="more">
        <a href="https://news.google.com/search?q=${encodeURIComponent(qLocal)}&hl=${en ? 'en-US&gl=US&ceid=US:en' : 'ko&gl=KR&ceid=KR:ko'}" target="_blank" rel="noopener">${en ? t('newsEn') : t('newsKo')}</a>
        <a href="https://news.google.com/search?q=${encodeURIComponent(en ? ev.qko || ev.q : ev.q)}&hl=${en ? 'ko&gl=KR&ceid=KR:ko' : 'en-US&gl=US&ceid=US:en'}" target="_blank" rel="noopener">${en ? t('newsKo') : t('newsEn')}</a>
      </div></section>
    <p class="note">${ev.auto ? t('noteAuto') : t('noteCur', { d: ASOF.replace(/-/g, '.') })}</p>`;
  panel.hidden = false;
  panel.scrollTop = keepScroll ? top : 0;
  $('pClose').addEventListener('click', closePanel);
  if (needKo) fillKoPanel(site);
  loadGdelt(ev, (r) => {
    const box = $('live'); if (!box) return;
    if (r.state === 'retry') { box.innerHTML = `<li class="msg">${t('gdeltRetry')}</li>`; return; }
    if (r.state === 'error') {
      box.innerHTML = `<li class="msg">${t('gdeltErr')}<button type="button" id="retry">${t('retry')}</button></li>`;
      box.querySelector('#retry').addEventListener('click', () => renderPanel(site));
      return;
    }
    if (!r.arts.length) { box.innerHTML = `<li class="msg">${t('gdeltNone')}</li>`; return; }
    box.innerHTML = r.arts.map((a) => {
      const d = a.seendate ? `${a.seendate.slice(0, 4)}.${a.seendate.slice(4, 6)}.${a.seendate.slice(6, 8)} ${a.seendate.slice(9, 11)}:${a.seendate.slice(11, 13)} UTC` : '';
      return `<li><a href="${esc(a.url)}" target="_blank" rel="noopener"><b>${esc(a.title)}</b><span>${esc(a.domain)} · ${d}</span></a></li>`;
    }).join('');
    renderFeeds();
  });
}

/* ---------- feeds & clock ---------- */
export function renderFeeds() {
  const list = Object.values(feeds), ok = list.filter((f) => f.ok).length, bad = list.filter((f) => f.ok === false).length;
  $('feedSum').textContent = `LINK ${ok}/${list.length}`;
  $('feedDot').className = 'sq ' + (bad ? 'warn' : ok ? 'ok' : '');
  $('feedList').innerHTML = list.map((f) => {
    const status = f.ok === null ? t(f.every ? 'feedLoading' : 'feedOnDemand')
      : f.ok ? t('feedOk', { n: f.n ? t('feedN', { n: num(f.n) }) : '', ago: relTime(f.at), every: f.every ? t('feedEvery', { m: f.every }) : '' })
        : t('feedFail', { e: f.err || t('rateLimited') });
    return `<li><span class="sq ${f.ok ? 'ok' : f.ok === false ? 'bad' : ''}"></span><div><b>${esc(t(f.key))}</b><small>${esc(status)}</small></div></li>`;
  }).join('');
}
$('feedBtn').addEventListener('click', (e) => { const p = $('feedPop'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden)); });
document.addEventListener('click', (e) => { if (!e.target.closest('#feedBtn, #feedPop')) $('feedPop').hidden = true; });

function tick() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  $('utc').textContent = `${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  const k = new Date(d.getTime() + 9 * 3600e3);
  $('kst').textContent = `${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
setInterval(tick, 1000); tick();
setInterval(renderFeeds, 15000);

const railLabel = () => { $('railToggle').textContent = t($('rail').classList.contains('collapsed') ? 'railOpen' : 'railClose'); };
$('railToggle').addEventListener('click', () => { $('rail').classList.toggle('collapsed'); railLabel(); });
if (innerWidth <= 760) $('rail').classList.add('collapsed');

/* ---------- language ---------- */
document.getElementById('langSw').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lang]');
  if (b) setLang(b.dataset.lang);
});
onLang(() => {
  relabelGeo();
  for (const s of sites) s.refreshTag();
  railLabel();
  app.refreshUI(true);
  fillKoNames();
});
applyStatic();
railLabel();

let pending = 0, forcePanel = false;
app.refreshUI = (force) => {
  if (force) forcePanel = true;
  if (pending) return;
  pending = setTimeout(() => {
    pending = 0;
    renderFilters(); renderList(); renderFeeds();
    $('subline').textContent = t('subline', { n: num(sites.length) });
    if (app.selected && !$('panel').hidden && (forcePanel || document.activeElement?.closest?.('#panel') == null)) renderPanel(app.selected, true);
    forcePanel = false;
    fillKoNames();
  }, 60);
};
