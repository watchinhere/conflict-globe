// 언어 설정 · 화면 문구 사전 · 자동 번역
const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } } };
export const I18N = { lang: store.get('cg.lang', (navigator.language || 'ko').toLowerCase().startsWith('ko') ? 'ko' : 'en') };
export const isEn = () => I18N.lang === 'en';

const DICT = {
  ko: {
    title: '분쟁 관측 지구본', banner: '공개 출처 정보 · GDELT · Esri · Natural Earth 실시간 집계',
    feedNote: '모든 데이터는 브라우저가 각 기관 공개 API에서 직접 받아옵니다.', type: '유형',
    railOpen: '사건 목록 펼치기', railClose: '사건 목록 접기', search: '사건 · 국가 검색',
    sortSev: '심각한 순', sortKia: '사망자 많은 순', sortNew: '최근 시작 순', globe: '◎ 전체 보기',
    hint: '드래그 회전 · 스크롤 확대 · 클릭 상세 · ESC 전체 보기', canvas: '3D 지구본: 드래그로 회전, 스크롤로 확대, 표시 지점 클릭 시 상세 정보',
    loading: '위성 영상을 불러오는 중', loadingN: '위성 영상을 불러오는 중 ({done}/{total})', loadErr: '위성 텍스처를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침하십시오.',
    subline: '추적 중인 사건 {n}건 · 실시간 동기화', empty: '조건에 맞는 사건이 없습니다. 위의 유형 필터나 검색어를 확인하십시오.',
    tracked: '{n}건', curated: '큐레이션 {d} + 실시간', autoWiki: '위키백과 분쟁 목록에서 자동 추가', autoNews: '위키백과 오늘의 사건에서 자동 추가',
    casH: '인명 피해', sitrep: '무슨 일이 일어나고 있나', basics: '기본 정보', dTotal: '전체 사망', dYear: '최근 1년', dTotalL: '전체 사망자', dYearL: '최근 1년 사망자', dNote: '사망자는 위 요약칸 참고. 여러 기관 집계를 바탕으로 한 어림값이라 정확하지 않을 수 있습니다.', dDetail: '출처별 자세한 수치', recentH: '최근 주요 사건', hInj: '부상자', hCiv: '민간인 사망', hDisp: '피란민 · 난민', mStatus: '현재 상황', mDur: '지속 기간', unverified: '출처 확인 안 됨', casFrom: '출처:', otherTally: '다른 기관의 자동 집계 보기 (기준이 달라 수치가 다를 수 있음)', autoTag: '자동 수집', timeline: '최근 동향', timelineR: '위키백과 · 30분 갱신', sources: '관련 기사', intercept: '실시간 뉴스', interceptR: 'GDELT · 7일',
    translate: '원문 번역 보기', translating: '한국어로 번역하는 중…', updating: '갱신 중', mtNote: '자동 번역',
    fRegion: '지역', fZone: '분쟁 지역', fPlace: '국가 · 도시', fPeriod: '진행 시기', fCoord: '좌표', now: '현재', approx: '정확한 위치 정보 없음 · 국가 중심에 표시',
    autoTally: '자동 집계', autoTallyD: '위키백과 ‘진행 중인 무력 분쟁 목록’', parentRow: '상위 분쟁 ‘{name}’ 기준', cum: '누적 사망', y25: '2025년', y26: '2026년', hourly: '매시간 자동 갱신',
    newsTally: '보도 추출', newsTallyD: '최근 7일 위키백과 ‘오늘의 사건’ 문장에서 자동 추출한 최대치', killed: '사망', injured: '부상', lastMention: '최근 언급', people: '{n}명',
    noCas: '아직 집계된 사상자 정보가 없습니다.', newsKo: 'Google 뉴스 (한국어)', newsEn: 'Google News (English)', earth: 'Google Earth에서 보기',
    noteAuto: '실시간 피드에서 자동으로 수집된 사건입니다. 자동 번역과 자동 추출 수치는 오류가 있을 수 있으니 출처를 함께 확인하십시오.',
    noteCur: '요약은 {d}까지의 공개 보도를 정리한 것이며, 자동 집계·최근 동향은 실시간으로 덧붙습니다. 사상자 수치에는 교전 당사자의 주장이 포함될 수 있습니다.',
    gdeltWait: '최신 기사를 찾는 중…', gdeltRetry: '뉴스 서버가 붐벼 다시 요청하는 중…', gdeltErr: '실시간 뉴스 서버(GDELT)가 요청을 제한하고 있습니다. 잠시 뒤 다시 시도하거나 아래 Google 뉴스를 이용하십시오.',
    retry: '다시 시도', gdeltNone: '최근 7일간 GDELT에 잡힌 기사가 없습니다.', linkHead: 'DATA LINKS',
    feedLoading: '불러오는 중', feedOnDemand: '사건 선택 시 조회', feedOk: '{n}{ago} 갱신{every}', feedEvery: ' · {m}분마다', feedFail: '실패 · {e} · 자동 재시도', feedN: '{n}건 · ', rateLimited: '요청 제한',
    attribPatch: '위성사진·지명 © Esri, Maxar, Earthstar Geographics · 고도 Mapzen Terrarium · 야간 NASA GIBS · 국경 Natural Earth',
    attribBase: '위성사진 © Esri, Maxar, Earthstar Geographics · 야간 NASA Black Marble · 국경·지명 Natural Earth · 데이터: 위키백과, GDELT',
    atSea: '해상', near: '{city} {dir}쪽 {km}km', justNow: '방금', minAgo: '{n}분 전', hrAgo: '{n}시간 전', dayAgo: '{n}일 전',
    started: '방금 시작', hours: '{n}시간째', days: '{n}일째', months: '{n}개월째', years: '{y}년째', ym: '{y}년 {m}개월째',
    fileMode: '이 앱은 로컬 서버에서 실행해야 합니다.<br>같은 폴더의 <b>실행.bat</b>을 더블클릭하십시오.',
    tierMajor: '대규모 전쟁 (연간 전투 사망 1만 명 이상)', tierMinor: '소규모 전쟁 (연간 1,000–9,999명)', tierConflict: '분쟁 (연간 100–999명)', tierSkirmish: '충돌·교전 (연간 100명 미만)',
    tierSummary: '{tier}으로 분류된 분쟁입니다.', feedWiki: '위키백과 · 진행 중인 무력 분쟁 목록', feedNews: '위키백과 · 오늘의 사건 (최근 7일)', feedGdelt: 'GDELT · 사건별 실시간 기사',
  },
  en: {
    title: 'Conflict Watch Globe', banner: 'Open-source intelligence · GDELT · Esri · Natural Earth live aggregation',
    feedNote: 'All data is fetched directly by your browser from each provider’s public API.', type: 'Type',
    railOpen: 'Show event list', railClose: 'Hide event list', search: 'Search events · countries',
    sortSev: 'Most severe', sortKia: 'Most deaths', sortNew: 'Most recent', globe: '◎ Whole globe',
    hint: 'DRAG rotate · SCROLL zoom · CLICK details · ESC reset', canvas: '3D globe: drag to rotate, scroll to zoom, click a marker for details',
    loading: 'Loading satellite imagery', loadingN: 'Loading satellite imagery ({done}/{total})', loadErr: 'Could not load satellite textures. Check your connection and reload.',
    subline: '{n} events tracked · live sync', empty: 'No events match. Check the type filters or your search.',
    tracked: '{n} events', curated: 'Curated {d} + live', autoWiki: 'Auto-added from Wikipedia conflict list', autoNews: 'Auto-added from Wikipedia current events',
    casH: 'Human toll', sitrep: 'What is happening', basics: 'Key facts', dTotal: 'Total deaths', dYear: 'Last 12 mo', dTotalL: 'Total deaths', dYearL: 'Deaths, last 12 months', dNote: 'Rough estimates drawn from several tallies; may be inaccurate.', dDetail: 'Detailed figures by source', recentH: 'Recent major incidents', hInj: 'Injured', hCiv: 'Civilian deaths', hDisp: 'Displaced · refugees', mStatus: 'Status', mDur: 'Duration', unverified: 'source not verified', casFrom: 'Source:', otherTally: 'Show other automatic tallies (different methods, figures may differ)', autoTag: 'auto', timeline: 'Latest developments', timelineR: 'Wikipedia · every 30 min', sources: 'Sources', intercept: 'Live news', interceptR: 'GDELT · 7 days',
    translate: 'Translate original', translating: 'Translating…', updating: 'updating', mtNote: 'Machine translation',
    fRegion: 'Region', fZone: 'Affected areas', fPlace: 'Country · City', fPeriod: 'Period', fCoord: 'Coordinates', now: 'present', approx: 'No precise location · shown at country centre',
    autoTally: 'AUTO TALLY', autoTallyD: 'Wikipedia “List of ongoing armed conflicts”', parentRow: 'parent conflict “{name}”', cum: 'Cumulative deaths', y25: '2025', y26: '2026', hourly: 'refreshed hourly',
    newsTally: 'NEWS EXTRACT', newsTallyD: 'Highest figures extracted from Wikipedia current-events entries (last 7 days)', killed: 'Killed', injured: 'Injured', lastMention: 'Last mention', people: '{n}',
    noCas: 'No casualty figures yet.', newsKo: 'Google News (Korean)', newsEn: 'Google News (English)', earth: 'Open in Google Earth',
    noteAuto: 'Collected automatically from live feeds. Machine translations and extracted figures may contain errors; check the sources.',
    noteCur: 'Summary reflects public reporting up to {d}; auto tallies and latest developments are appended live. Casualty figures may include claims by parties to the conflict.',
    gdeltWait: 'Searching latest articles…', gdeltRetry: 'News server busy, retrying…', gdeltErr: 'The GDELT news server is rate-limiting requests. Try again shortly or use Google News below.',
    retry: 'Retry', gdeltNone: 'No GDELT articles in the last 7 days.', linkHead: 'DATA LINKS',
    feedLoading: 'loading', feedOnDemand: 'queried when an event is opened', feedOk: '{n}updated {ago}{every}', feedEvery: ' · every {m} min', feedFail: 'failed · {e} · retrying', feedN: '{n} items · ', rateLimited: 'rate limited',
    attribPatch: 'Imagery & labels © Esri, Maxar, Earthstar Geographics · Elevation Mapzen Terrarium · Night NASA GIBS · Borders Natural Earth',
    attribBase: 'Imagery © Esri, Maxar, Earthstar Geographics · Night NASA Black Marble · Borders & places Natural Earth · Data: Wikipedia, GDELT',
    atSea: 'At sea', near: '{km} km {dir} of {city}', justNow: 'just now', minAgo: '{n} min ago', hrAgo: '{n} h ago', dayAgo: '{n} d ago',
    started: 'just started', hours: '{n} h', days: '{n} days', months: '{n} mo', years: '{y} yr', ym: '{y} yr {m} mo',
    fileMode: 'This app must run from a local server.<br>Double-click <b>실행.bat</b> in the same folder.',
    tierMajor: 'Major war (10,000+ combat deaths per year)', tierMinor: 'Minor war (1,000–9,999 per year)', tierConflict: 'Conflict (100–999 per year)', tierSkirmish: 'Skirmishes (fewer than 100 per year)',
    tierSummary: 'Classified as: {tier}.', feedWiki: 'Wikipedia · List of ongoing armed conflicts', feedNews: 'Wikipedia · Current events (last 7 days)', feedGdelt: 'GDELT · live articles per event',
  },
};
export const t = (k, v = {}) => String(DICT[I18N.lang][k] ?? DICT.ko[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');

// 사건 텍스트: 한국어 모드는 xxKo → xx, 영어 모드는 xxEn → xx
export function tx(ev, k) {
  if (isEn()) return ev[k + 'En'] ?? ev[k];
  return ev[k + 'Ko'] ?? ev[k];
}

const listeners = [];
export const onLang = (f) => listeners.push(f);
export function applyStatic() {
  document.documentElement.lang = I18N.lang;
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === I18N.lang));
}
export function setLang(l) {
  if (l === I18N.lang) return;
  I18N.lang = l;
  store.set('cg.lang', l);
  applyStatic();
  for (const f of listeners) f();
}

/* ---------- machine translation (Google gtx, fallback MyMemory) ---------- */
let mtCache = {};
try { mtCache = JSON.parse(localStorage.getItem('cg.mt') || '{}'); } catch { mtCache = {}; }
let saveTimer = 0;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const keys = Object.keys(mtCache);
      if (keys.length > 1500) for (const k of keys.slice(0, keys.length - 1500)) delete mtCache[k];
      localStorage.setItem('cg.mt', JSON.stringify(mtCache));
    } catch { /* 저장 불가 */ }
  }, 800);
};
const inflight = new Map();
let active = 0;
const waiters = [];
const slot = () => (active < 4 ? (active++, Promise.resolve()) : new Promise((r) => waiters.push(r)));
const release = () => { const w = waiters.shift(); if (w) w(); else active--; };
async function gtx(text, tl) {
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`);
  if (!r.ok) throw new Error(r.status);
  const j = await r.json();
  return (j[0] || []).map((s) => s[0]).join('');
}
async function mymemory(text, tl) {
  const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=en|${tl}`);
  const j = await r.json();
  if (j.responseStatus !== 200) throw new Error(j.responseStatus);
  return j.responseData.translatedText;
}
export function mt(text, tl = 'ko') {
  if (!text) return Promise.resolve(text);
  const key = `${tl}:${text}`;
  if (mtCache[key]) return Promise.resolve(mtCache[key]);
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    await slot();
    try {
      let out = null;
      try { out = await gtx(text.slice(0, 4500), tl); } catch { try { out = await mymemory(text, tl); } catch { out = null; } }
      if (out) { mtCache[key] = out; persist(); }
      return out;
    } finally { release(); inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}
export const mtCached = (text, tl = 'ko') => mtCache[`${tl}:${text}`];
