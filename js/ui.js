import { app } from './core.js';
import { CATS, GROUPS, LEVELS, LEVEL_RANK, CAS_LABEL, ASOF, iconFor } from './data.js';
import { locate } from './geo.js';
import { sites } from './sites.js';
import { feeds, loadGdelt, TIER_KO, firstNum, norm } from './live.js';

const $ = (id) => document.getElementById(id);
export const active = new Set(Object.keys(CATS));
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('cg.' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('cg.' + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } } };
const ui = { q: '', sort: store.get('sort', 'severity'), collapsed: new Set(store.get('collapsed', [])) };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (s) => {
  if (!s) return '';
  if (/T\d/.test(s)) return s.slice(0, 10).replace(/-/g, '.');
  return s.replace(/-/g, '.');
};
export function since(start) {
  if (!start) return '';
  const iso = /^\d{4}$/.test(start) ? `${start}-01-01` : /^\d{4}-\d{2}$/.test(start) ? `${start}-01` : start;
  const s = new Date(iso), now = new Date();
  if (isNaN(s)) return '';
  const hours = (now - s) / 3600e3;
  if (hours < 24) return hours < 1 ? '방금 시작' : `${Math.floor(hours)}시간째`;
  const days = Math.floor(hours / 24);
  if (days < 45) return `${days}일째`;
  const months = (now.getUTCFullYear() - s.getUTCFullYear()) * 12 + (now.getUTCMonth() - s.getUTCMonth());
  const yy = Math.floor(months / 12), mm = months % 12;
  return yy ? `${yy}년${mm ? ' ' + mm + '개월' : ''}째` : `${mm}개월째`;
}
const coord = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
export function relTime(d) {
  if (!d) return '—';
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return '방금'; if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`; return `${Math.floor(s / 86400)}일 전`;
}
const trUrl = (t) => `https://translate.google.com/?sl=auto&tl=ko&text=${encodeURIComponent(t)}&op=translate`;
const levelPill = (lv) => `<span class="lvl ${esc(lv)}">${LEVELS[lv] || esc(lv)}</span>`;

export function casOf(ev) {
  const k = ev.cas?.items?.find((i) => i.k === 'killed');
  if (k) return { text: k.v, num: ev.cas.killedNum ?? firstNum(k.v) };
  if (ev.wikiRow) {
    const r = ev.wikiRow, use26 = firstNum(r.f26) > 0, v = use26 ? r.f26 : r.cum;
    if (firstNum(v)) return { text: `${v}${use26 ? ' (2026)' : ''}`, num: firstNum(v) };
  }
  if (ev.newsCas?.killed) return { text: `${ev.newsCas.killed.toLocaleString('ko-KR')}+ (보도)`, num: ev.newsCas.killed };
  return null;
}

/* ---------- filters ---------- */
export function renderFilters() {
  const counts = {};
  for (const s of sites) counts[s.cat] = (counts[s.cat] || 0) + 1;
  $('filters').innerHTML = Object.entries(CATS).map(([k, c]) =>
    `<button type="button" class="chip" data-cat="${k}" aria-pressed="${active.has(k)}" style="--c:${c.color}"><span class="box"></span><span class="nm">${c.ko}</span><span class="ct">${String(counts[k] || 0).padStart(2, '0')}</span></button>`).join('');
}
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
  const ev = s.ev, cas = casOf(ev);
  return `<button type="button" class="item${s === app.selected ? ' sel' : ''}" data-id="${esc(ev.id)}" style="--c:${s.color}">
    <span class="ix-main">
      <span class="ix-top"><span class="ix-code">${evCode(ev)}</span>${levelPill(ev.level)}${ev.auto ? '<span class="ix-auto" title="실시간 자동 수집">AUTO</span>' : ''}<span class="ix-age">${since(ev.start)}</span></span>
      <b class="ix-name">${esc(ev.name)}</b>
      <span class="ix-sub">${esc(ev.region)}</span>
    </span>
    ${cas ? `<span class="ix-kia" title="사망"><small>KIA</small><b>${esc(cas.text)}</b></span>` : ''}
  </button>`;
}
export function renderList() {
  const q = norm(ui.q);
  const pool = sites.filter((s) => active.has(s.cat) && (!q || norm(`${s.ev.name} ${s.ev.en} ${s.ev.region} ${s.ev.short || ''}`).includes(q)));
  const html = GROUP_ORDER.map((g) => {
    let list = pool.filter((s) => CATS[s.cat].group === g).sort(sorters[ui.sort]);
    if (!list.length) return '';
    const total = list.length, open = !ui.collapsed.has(g) || !!q;
    return `<section class="grp${open ? '' : ' shut'}" data-g="${g}">
      <button type="button" class="grp-h" data-g="${g}" aria-expanded="${open}"><span>${GROUPS[g]}</span><span class="n">${String(total).padStart(2, '0')}</span><svg viewBox="0 0 24 24" class="chev"><path d="M6 9l6 6 6-6"/></svg></button>
      <div class="grp-b">${list.map(itemHTML).join('')}</div>
    </section>`;
  }).join('');
  $('listCount').textContent = `${pool.length} TRACKED`;
  $('list').innerHTML = html || '<p class="empty">조건에 맞는 사건이 없습니다. 위의 유형 필터나 검색어를 확인하세요.</p>';
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
  const items = ev.cas?.items || [], row = ev.wikiRow, nc = ev.newsCas;
  const matchedMain = row && (ev.wiki || []).some((k) => norm(row.main) === norm(k));
  let h = '';
  if (items.length) h += `<div class="cas-grid">${items.map((i) => `<div class="cas-cell k-${i.k}"><span class="lab">${CAS_LABEL[i.k] || i.k}</span><b>${esc(i.v)}</b><small>${esc(i.d)}</small></div>`).join('')}</div>`;
  if (ev.cas?.src) h += `<p class="cas-src">${esc(ev.cas.src)}</p>`;
  if (row) h += `<div class="auto-stat"><div class="as-h"><span class="tag-auto">자동 집계</span><span>위키백과 ‘진행 중인 무력 분쟁 목록’${matchedMain || ev.auto ? '' : ` · 상위 분쟁 ‘${esc(row.name)}’ 기준`}</span></div>
      <div class="stat-row"><div><small>누적 사망</small><b>${esc(row.cum || '—')}</b></div><div><small>2025년</small><b>${esc(row.f25 || '—')}</b></div><div><small>2026년</small><b>${esc(row.f26 || '—')}</b></div></div>
      <p class="as-note">${esc(TIER_KO[row.tier] || '')} · 매시간 자동 갱신</p></div>`;
  if (nc) h += `<div class="auto-stat"><div class="as-h"><span class="tag-auto news">보도 추출</span><span>최근 7일 위키백과 ‘오늘의 사건’ 문장에서 자동 추출한 최대치</span></div>
      <div class="stat-row"><div><small>사망</small><b>${nc.killed ? nc.killed.toLocaleString('ko-KR') + '명' : '—'}</b></div><div><small>부상</small><b>${nc.injured ? nc.injured.toLocaleString('ko-KR') + '명' : '—'}</b></div><div><small>최근 언급</small><b>${fmtDate(nc.at)}</b></div></div></div>`;
  return h || '<p class="cas-src">아직 집계된 사상자 정보가 없습니다.</p>';
}
function factsFor(ev) {
  const f = [['지역', esc(ev.region)]];
  const loc = locate(ev.lat, ev.lon);
  if (loc) f.push(['국가 · 도시', `${esc(loc.country)}${loc.near ? ` <small>${esc(loc.near)}</small>` : ''}`]);
  f.push(['진행 시기', `${fmtDate(ev.start)} – 현재 <small>${since(ev.start)}</small>`]);
  f.push(['좌표', `<span class="mono">${coord(ev.lat, ev.lon)}</span>`]);
  return f;
}
export function renderPanel(site) {
  const ev = site.ev, c = CATS[ev.cat], panel = $('panel');
  const news = (ev.news || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const srcLabel = { wiki: '위키백과 분쟁 목록에서 자동 추가', news: '위키백과 오늘의 사건에서 자동 추가' }[ev.auto];
  panel.style.setProperty('--c', site.color);
  panel.innerHTML = `
    <div class="p-bar"><span>DOSSIER</span><span class="code">${evCode(ev)}</span><span class="src">${srcLabel || `큐레이션 ${ASOF.replace(/-/g, '.')} + 실시간`}</span>
      <button type="button" class="close" id="pClose" aria-label="닫기"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="p-hero">
      <span class="badge">${iconFor(ev.cat)}${c.ko}</span>
      <h2>${esc(ev.name)}</h2>
      <p class="en">${esc(ev.en)}</p>
      <div class="p-meta"><div><small>STATUS</small><b>${levelPill(ev.level)}</b></div><div><small>DURATION</small><b>${since(ev.start)}</b></div><div><small>KIA</small><b class="kia">${casOf(ev) ? esc(casOf(ev).text) : '—'}</b></div></div>
    </div>
    <section class="p-sec"><h3><span class="k">CASUALTIES</span>사상자 · 피해</h3>${casSection(ev)}</section>
    <dl class="facts">${factsFor(ev).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <section class="p-sec"><h3><span class="k">SITREP</span>진행 상황${ev.summaryLang === 'en' ? `<a class="tr" href="${trUrl(ev.summary)}" target="_blank" rel="noopener">한국어로 번역</a>` : ''}</h3>
      <p class="sum">${esc(ev.summary)}</p>
      ${ev.points?.length ? `<ul class="pts">${ev.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</section>
    ${news.length ? `<section class="p-sec"><h3><span class="k">TIMELINE</span>최근 동향<span class="r">위키백과 · 30분 갱신</span></h3>
      <ol class="timeline">${news.map((n) => `<li><time>${fmtDate(n.date)}</time><p>${esc(n.text)}</p><div class="tl-links">${n.sources.slice(0, 3).map((s) => `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a>`).join('')}<a class="tr" href="${trUrl(n.text)}" target="_blank" rel="noopener">번역</a></div></li>`).join('')}</ol></section>` : ''}
    <section class="p-sec"><h3><span class="k">SOURCES</span>관련 기사</h3>
      <ul class="arts">${(ev.articles || []).map((a) => `<li><a href="${esc(a.u)}" target="_blank" rel="noopener"><b>${esc(a.t)}</b><span>${esc(a.s)}${a.d ? ' · ' + esc(a.d) : ''}</span></a></li>`).join('')}</ul></section>
    <section class="p-sec"><h3><span class="k">INTERCEPT</span>실시간 뉴스<span class="r">GDELT · 7일</span></h3><ul class="arts" id="live"><li class="msg">최신 기사를 찾는 중…</li></ul>
      <div class="more">
        <a href="https://news.google.com/search?q=${encodeURIComponent(ev.qko || ev.q)}&hl=ko&gl=KR&ceid=KR:ko" target="_blank" rel="noopener">Google 뉴스 (한국어)</a>
        <a href="https://news.google.com/search?q=${encodeURIComponent(ev.q)}&hl=en-US&gl=US&ceid=US:en" target="_blank" rel="noopener">Google News (English)</a>
        <a href="https://earth.google.com/web/@${ev.lat},${ev.lon},2000a,120000d,35y,0h,0t,0r" target="_blank" rel="noopener">Google Earth에서 보기</a>
      </div></section>
    <p class="note">${ev.auto ? '실시간 피드에서 자동으로 수집된 사건입니다. 영어 원문 요약과 자동 추출 수치는 오류가 있을 수 있으니 출처를 함께 확인하세요.' : `요약은 ${ASOF.replace(/-/g, '.')}까지의 공개 보도를 정리한 것이며, 자동 집계·최근 동향은 실시간으로 덧붙습니다. 사상자 수치에는 교전 당사자의 주장이 포함될 수 있습니다.`}</p>`;
  panel.hidden = false;
  panel.scrollTop = 0;
  $('pClose').addEventListener('click', closePanel);
  loadGdelt(ev, (r) => {
    const box = $('live'); if (!box) return;
    if (r.state === 'retry') { box.innerHTML = '<li class="msg">뉴스 서버가 붐벼 다시 요청하는 중…</li>'; return; }
    if (r.state === 'error') {
      box.innerHTML = '<li class="msg">실시간 뉴스 서버(GDELT)가 요청을 제한하고 있습니다. 잠시 뒤 다시 시도하거나 아래 Google 뉴스를 이용하세요.<button type="button" id="retry">다시 시도</button></li>';
      box.querySelector('#retry').addEventListener('click', () => renderPanel(site));
      return;
    }
    if (!r.arts.length) { box.innerHTML = '<li class="msg">최근 7일간 GDELT에 잡힌 기사가 없습니다.</li>'; return; }
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
  $('feedList').innerHTML = list.map((f) => `<li><span class="sq ${f.ok ? 'ok' : f.ok === false ? 'bad' : ''}"></span><div><b>${esc(f.name)}</b>
    <small>${f.ok === null ? (f.every ? '불러오는 중' : '사건 선택 시 조회') : f.ok ? `${f.n ? f.n.toLocaleString('ko-KR') + '건 · ' : ''}${relTime(f.at)} 갱신${f.every ? ` · ${f.every}분마다` : ''}` : `실패 · ${esc(f.err || '요청 제한')} · 자동 재시도`}</small></div></li>`).join('');
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

$('railToggle').addEventListener('click', (e) => {
  const r = $('rail'); r.classList.toggle('collapsed');
  e.currentTarget.textContent = r.classList.contains('collapsed') ? '사건 목록 펼치기' : '사건 목록 접기';
});
if (innerWidth <= 760) $('rail').classList.add('collapsed');

let pending = 0;
app.refreshUI = () => {
  if (pending) return;
  pending = setTimeout(() => {
    pending = 0;
    renderFilters(); renderList(); renderFeeds();
    $('subline').textContent = `추적 중인 사건 ${sites.length.toLocaleString('ko-KR')}건 · 분쟁·시위 자동 갱신`;
    if (app.selected && !$('panel').hidden && document.activeElement?.closest?.('#panel') == null) {
      const top = $('panel').scrollTop; renderPanel(app.selected); $('panel').scrollTop = top;
    }
  }, 60);
};
