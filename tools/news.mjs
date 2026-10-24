// 20분마다 실행(GitHub Actions): 주요 언론 RSS에서 분쟁 관련 헤드라인을 모아 data/breaking.json에 쓴다.
// 기사 본문은 저장하지 않는다. 제목·출처·링크·시각만 남기고, 한국어 제목은 기계 번역해 둔다.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data/breaking.json');
const KEEP_H = 48, MAX = 160;
const { EVENTS, findCountries } = await import('../js/data.js');

const FEEDS = [
  ['BBC', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
  ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
  ['The Guardian', 'https://www.theguardian.com/world/rss'],
  ['DW', 'https://rss.dw.com/rdf/rss-en-world'],
  ['France 24', 'https://www.france24.com/en/rss'],
  ['UN News', 'https://news.un.org/feed/subscribe/en/news/all/rss.xml'],
  ['NPR', 'https://feeds.npr.org/1004/rss.xml'],
];
// 분쟁·폭력·시위·탄압과 관련된 기사만 남긴다
const CONFLICT = /\b(war|wars|warfare|attack(s|ed|ers)?|strike(s|d)?|air ?strikes?|drone|missile|rocket|shell(ing|ed)|bomb(s|ing|ed)?|explosion|blast|killed|kills|killing|dead|deaths?|death toll|wounded|injured|casualt|massacre|gunmen|gunfire|shot dead|clash(es|ed)?|fighting|offensive|troops|soldiers|army|military|militants?|militia|rebels?|insurgen|jihad|terror|hostages?|kidnap|abduct|siege|ceasefire|truce|invasion|occupied|annex|coup|junta|protest(s|ers|ed)?|demonstrat|riot(s|ing)?|unrest|crackdown|tear gas|curfew|uprising|persecut|genocide|ethnic cleansing|refugees?|displaced|famine|humanitarian|airport.*(closed|targeted)|front ?line)\b/i;
// 자연재해·사고·질병은 다루지 않는다
const EXCLUDE = /\b(earthquake|quake|tremor|typhoon|hurricane|cyclone|tornado|flood(s|ing)?|landslide|mudslide|wildfire|bushfire|volcan|eruption|tsunami|storm|heatwave|drought|avalanche|ebola|cholera|outbreak|pandemic|virus|plane crash|train crash|derail|ferry (capsiz|sink)|snorkel|octopus|elephant|football|cricket|tennis|olympic)/i;
// 큐레이션 사건별 식별어. 국가명만으로는 같은 나라의 다른 사건이 섞이므로 사건마다 따로 둔다
const KEYS = {
  ukraine: /ukrain|kyiv|kiev|donetsk|kharkiv|zaporizh|kherson|pokrovsk|kupiansk|russia(n)?\b.{0,40}\b(strike|attack|drone|missile|offensive|troops|forces)/i,
  sudan: /(?<!south )\bsudan(?!ese pound)|\bRSF\b|rapid support forces|khartoum|el[- ]?fasher|kordofan|omdurman|el[- ]?obeid/i,
  darfur: /darfur|el[- ]?fasher/i,
  southsudan: /south sudan|\bjuba\b/i,
  iran: /\biran|tehran|\bIRGC\b|islamic republic/i,
  yemen: /yemen|houthi|sanaa|hodeidah|\baden\b|red sea/i,
  myanmar: /myanmar|burma|naypyidaw|sagaing|rakhine|kachin|arakan army|shan state/i,
  rohingya: /rohingya|cox'?s bazar/i,
  drc: /\bcongo|\bDRC\b|\bM23\b|\bgoma\b|kinshasa|ituri|\bkivu/i,
  afpak: /taliban|\bTTP\b|khyber|waziristan|afghanistan.{0,40}pakistan|pakistan.{0,40}afghanistan/i,
  balochistan: /balochistan|baloch|quetta/i,
  ethiopia: /ethiopia|tigray|amhara|\bfano\b|oromia/i,
  sahel: /\bmali\b|bamako|\bJNIM\b|\bsahel/i,
  burkina: /burkina/i,
  niger: /\bniger\b(?!ia)|niamey/i,
  benin: /\bbenin\b/i,
  nigeria: /nigeria|borno|boko haram|\bISWAP\b|zamfara|kaduna|plateau state/i,
  cameroon: /cameroon|anglophone/i,
  gaza: /\bgaza|\bhamas\b|rafah|khan younis/i,
  westbank: /west bank|jenin|nablus|ramallah|tulkarm|hebron|settlers?\b/i,
  lebanon: /lebanon|hezbollah|beirut/i,
  syria: /\bsyria|damascus|aleppo|idlib|alawite|sweida|suwayda/i,
  haiti: /haiti|port-au-prince/i,
  belgium: /(belgi(um|an)|brussels).{0,60}(protest|strike|march|riot|demonstrat)|(protest|strike|march|riot|demonstrat).{0,60}(belgi(um|an)|brussels)/i,
  delhi: /\bdelhi\b/i,
  uyghur: /uyghur|uighur|xinjiang/i,
  somalia: /somali|al-shabaab|mogadishu/i,
  mexico: /mexic|cartel|sinaloa|culiac/i,
  colombia: /colombia|\bELN\b|\bFARC\b|catatumbo/i,
  mozambique: /mozambique|cabo delgado/i,
  thaicambo: /thai.{0,40}cambod|cambod.{0,40}thai/i,
};
const known = new Set(EVENTS.map((e) => e.id));
for (const k of Object.keys(KEYS)) if (!known.has(k)) delete KEYS[k];

const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
async function readFeed([src, url]) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConflictWatchGlobe/1.0; +https://watchinhere.github.io/conflict-globe/)' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const xml = await r.text();
  // RSS 2.0과 RDF(DW) 모두 <item> 안에 title·link·날짜가 있다. CDATA는 벗겨낸다
  const pick = (block, ...names) => {
    for (const n of names) {
      const m = block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i'));
      if (m) return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
    }
    return '';
  };
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(([it]) => {
    const at = new Date(clean(pick(it, 'pubDate', 'dc:date')));
    const about = it.match(/rdf:about="([^"]+)"/)?.[1];
    return { src, t: clean(pick(it, 'title')), u: clean(pick(it, 'link')) || about, at: isNaN(at) ? null : at.toISOString(), desc: clean(pick(it, 'description')) };
  }).filter((x) => x.t && x.u && x.at);
}
async function toKo(text) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`);
      if (r.ok) return ((await r.json())[0] || []).map((s) => s[0]).join('');
    } catch { /* 재시도 */ }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return null;
}

const prev = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{"items":[]}'));
const byId = new Map((prev.items || []).map((x) => [x.id, x]));
const cutoff = Date.now() - KEEP_H * 3600e3;
const status = {};
for (const f of FEEDS) {
  try {
    const list = await readFeed(f);
    let kept = 0;
    for (const it of list) {
      if (Date.parse(it.at) < cutoff) continue;
      const text = `${it.t} ${it.desc}`;
      if (!CONFLICT.test(text) || EXCLUDE.test(it.t)) continue;
      const id = createHash('sha1').update(it.u).digest('hex').slice(0, 12);
      const ev = Object.entries(KEYS).filter(([, re]) => re.test(text)).map(([k]) => k);
      const old = byId.get(id);
      byId.set(id, { id, t: it.t, ko: old?.t === it.t ? old.ko : undefined, src: it.src, u: it.u, at: it.at, ev, cc: findCountries(text).slice(0, 3) });
      kept++;
    }
    status[f[0]] = { ok: true, n: kept };
  } catch (e) { status[f[0]] = { ok: false, err: e.message }; console.warn(f[0], e.message); }
}
// 같은 사건을 여러 언론이 다루면 제목이 거의 같다: 앞 8단어가 같으면 최신 하나만 둔다
const seen = new Set();
const items = [...byId.values()].filter((x) => Date.parse(x.at) >= cutoff).sort((a, b) => b.at.localeCompare(a.at))
  .filter((x) => { const k = x.t.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 8).join(' '); if (seen.has(k)) return false; seen.add(k); return true; })
  .slice(0, MAX);
let translated = 0;
for (const x of items) if (!x.ko) { x.ko = await toKo(x.t); if (x.ko) translated++; await new Promise((r) => setTimeout(r, 250)); }
const changed = JSON.stringify(items) !== JSON.stringify(prev.items || []);
if (changed) await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), sources: status, items }, null, 1) + '\n');
console.log(`items ${items.length} (${items.filter((x) => x.ev.length).length} matched), translated ${translated}, changed ${changed}`, JSON.stringify(status));
