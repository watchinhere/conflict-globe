// 큐레이션 데이터: 2026-10-10까지 공개 보도 종합. 실시간 갱신분은 live.js가 덧붙인다.
export const ASOF = '2026-10-10';

export const CATS = {
  war:        { ko: '전쟁',          color: '#ff4a4a', group: 'conflict' },
  clash:      { ko: '국지전',        color: '#ff6b9a', group: 'conflict' },
  riot:       { ko: '폭동',          color: '#ffbe3d', group: 'unrest' },
  protest:    { ko: '대규모 시위',   color: '#5aa9ff', group: 'unrest' },
  oppression: { ko: '소수민족 탄압', color: '#b48cff', group: 'rights' },
};
export const GROUPS = { conflict: '전쟁 · 무력 분쟁', unrest: '폭동 · 시위', rights: '인권 · 탄압' };
export const LEVELS = { escalating: '격화', active: '진행 중', stalemate: '교착', ceasefire: '불안한 휴전' };
export const LEVEL_RANK = { escalating: 0, active: 1, stalemate: 2, ceasefire: 3 };
export const CAS_LABEL = { killed: '사망', injured: '부상', displaced: '피란', detained: '구금 · 연행', missing: '실종' };

const P = {
  war: '<path d="M3.5 15.5h17l-1.6 4h-13.8z"/><path d="M6.5 15.5v-3.2h8.5l2.2 3.2"/><path d="M13 13l7.5-2.8"/>',
  clash: '<circle cx="12" cy="12" r="6"/><path d="M12 2.5v6M12 15.5v6M2.5 12h6M15.5 12h6"/>',
  riot: '<path d="M13.5 2 5 14h6.2L10 22l9-12.5h-6.4z"/>',
  protest: '<path d="M3 10v4h3l7.5 4.5v-13L6 10z"/><path d="M17.5 9a4 4 0 0 1 0 6"/>',
  oppression: '<path d="M6 3v18M12 3v18M18 3v18M3 8h18M3 16h18"/>',
};
export const iconFor = (cat) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[cat]}</svg>`;

export const EVENTS = [
  { id: 'ukraine', cat: 'war', name: '러시아–우크라이나 전쟁', en: 'Russia–Ukraine War', region: '우크라이나 동부 (도네츠크·하르키우·자포리자 전선)', lat: 48.3, lon: 37.6, start: '2022-02-24', level: 'stalemate', intensity: 3, air: true,
    wiki: ['Russo-Ukrainian war', 'Russian invasion of Ukraine', 'Russo-Ukrainian war (2022–present)', 'Russian strikes against Ukrainian infrastructure'],
    summary: '러시아군이 도네츠크·하르키우·자포리자 축에서 공세를 이어가고 있지만, 우크라이나군 총사령관은 2026년 상반기 러시아군의 진격 속도가 절반 이하로 줄었다고 밝혔습니다. 8월에는 우크라이나군이 쿠피안스크·보로바 방면에서 일부 지역을 되찾았습니다. 반면 민간인 피해는 6–7월 2022년 이후 최고치를 기록했습니다.',
    points: ['ISW(9월 2일): 푸틴은 현 전선 동결과 실질적인 평화협상에 응하지 않겠다는 입장을 반복', '7월 민간인 사망 437명·부상 2,610명으로 2022년 5월 이후 최다 (유엔)', '러시아는 하르키우·자포리자 축의 마을 점령을 주장하나 독립 검증은 되지 않음'],
    cas: { items: [{ k: 'killed', v: '16,431명+', d: '민간인 누적 (2022.2–2026.7 중순)' }, { k: 'injured', v: '48,613명+', d: '민간인 누적' }, { k: 'killed', v: '15,280명', d: '2026년 1–8월 민간인 사상(사망+부상)' }], killedNum: 16431,
      src: '유엔 인권사무소(OHCHR·HRMMU). 양측 군 사상자는 공개되지 않으며 수십만 명으로 추정됩니다.' },
    articles: [
      { t: 'Russian Offensive Campaign Assessment, September 2, 2026', s: 'ISW / Critical Threats', d: '2026-09-02', u: 'https://www.criticalthreats.org/analysis/russian-offensive-campaign-assessment-september-2-2026' },
      { t: 'War in Ukraine leaves over 15,000 civilians dead or injured in first eight months of 2026, UN reports', s: 'Ukrainska Pravda', d: '2026-10-04', u: 'https://www.pravda.com.ua/eng/news/2026/10/04/8056350/' },
      { t: 'Syrsky: In 2026, the pace of the Russian troops’ advance slowed by more than half', s: 'LIGA.net', d: '2026', u: 'https://news.liga.net/en/war/news/syrsky-in-2026-the-pace-of-the-russian-troops-advance-slowed-by-more-than-half' },
    ], q: 'Ukraine Russia war front', q2: 'Ukraine', qko: '우크라이나 전쟁 전황' },

  { id: 'sudan', cat: 'war', name: '수단 내전', en: 'Sudanese Civil War (SAF vs RSF)', region: '수단 코르도판 (엘오베이드 일대)', lat: 13.18, lon: 30.22, start: '2023-04-15', level: 'active', intensity: 3, air: true,
    wiki: ['Sudanese civil war (2023–present)', 'War in Sudan (2023–present)', 'Sudanese civil war'],
    summary: '수단군(SAF)과 준군사조직 신속지원군(RSF)의 내전입니다. 2025년 10월 RSF가 엘파셰르를 함락한 뒤 코르도판 3개 주가 주 전장이 됐습니다. 8월 말 RSF가 여러 지역에서 반격했고, 수단군은 옴두르만–엘오베이드 수출도로의 요충지를 되찾았습니다.',
    points: ['부르한 수단군 사령관: 연내 RSF 격퇴 공언', '2026년 2월 쿼드(미국·사우디·UAE·이집트) 평화안 발표 이후에도 교전 지속', '10월까지 이어지는 우기로 기동 제약'],
    cas: { items: [{ k: 'killed', v: '4만–15만 명', d: 'WHO 최소 4만 명, IRC·미 특사 최대 15만 명 추정' }, { k: 'displaced', v: '약 1,400만 명', d: '국내 900만 · 국외 440만 (2026.4)' }], killedNum: 40000,
      src: 'WHO, 유엔 뉴스(2026.4), IRC. 현장 접근 제한으로 실제 사망자는 공식 집계보다 훨씬 많을 수 있습니다.' },
    articles: [
      { t: 'Africa File: Sudan RSF counterattacks, August 20, 2026', s: 'Critical Threats', d: '2026-08-20', u: 'https://www.criticalthreats.org/analysis/sudan-rsf-splm-issp-lakirawa-nigeria-africa-file-august-20-2026' },
      { t: 'Sudan’s army chief vows to defeat RSF by year-end', s: 'Anadolu Agency', d: '2026', u: 'https://aa.com.tr/en/middle-east/sudan-s-army-chief-vows-to-defeat-rsf-by-year-end/4017544' },
      { t: 'Sudan: 14 million displaced as war enters fourth year', s: 'EMPHNET', d: '2026-04', u: 'https://epinews.emphnet.net/en/news/sudan-14-million-displaced-hunger-and-attacks-on-health-continue-as-war-enters-fourth-year' },
    ], q: 'Sudan RSF army', q2: 'Sudan', qko: '수단 내전 RSF' },

  { id: 'iran', cat: 'war', name: '미국·이스라엘–이란 전쟁', en: '2026 Iran war', region: '이란 (테헤란 등) · 걸프 일대', lat: 35.69, lon: 51.39, start: '2026-02-28', level: 'escalating', intensity: 2, air: true,
    wiki: ['2026 Iran war', '2026 Iran–United States war', 'Iran–Israel conflict', 'Iran–United States relations'],
    summary: '2026년 2월 28일 미국과 이스라엘의 대이란 공습으로 시작됐습니다. 4월 8일 조건부 휴전 뒤 7월 호르무즈 해협 선박 공격과 요르단 미군기지 미사일 공격으로 다시 충돌했고, 9월 1–2일에도 공습을 주고받았습니다.',
    points: ['10월 초 미 국방부가 중부사령부에 대규모 전투작전 재개 준비를 마치라고 지시 (Just Security, 10월 8일)', '미·이란 간 종전 협상은 현재 없음 (영국 하원 도서관)', '전쟁은 레바논·예멘·사우디 전선으로 확산'],
    cas: { items: [{ k: 'killed', v: '3,468명', d: '이란 보건부, 2.28–4.8 개전 40일' }, { k: 'injured', v: '26,500명+', d: '같은 기간' }, { k: 'killed', v: '3,636–7,650명', d: '인권단체 추정 (HRANA·Hengaw, 군인 포함)' }], killedNum: 3468,
      src: '이란 보건부·HRANA·Hengaw. 7월 이후 재충돌 사상자는 포함되지 않았고, 인터넷 차단으로 독립 검증이 어렵습니다.' },
    articles: [
      { t: 'Early Edition: October 8, 2026', s: 'Just Security', d: '2026-10-08', u: 'https://justsecurity.org/160040/early-edition-october-8-2026' },
      { t: 'Iran war live: Trump says renewed US-Iran clashes will not last', s: 'Al Jazeera', d: '2026-09-03', u: 'https://www.aljazeera.com/news/liveblog/2026/9/3/iran-war-live-trump-says-renewed-us-iran-clashes-will-not-last-too' },
      { t: 'Iran reports 3,468 dead in war with US, Israel', s: 'ARY News', d: '2026-04', u: 'https://arynews.tv/iran-reports-3468-dead-war-us-israel' },
    ], q: 'Iran United States strikes', q2: 'Iran', qko: '이란 미국 공습' },

  { id: 'yemen', cat: 'war', name: '예멘 전쟁 · 후티–사우디 충돌', en: 'Yemen War / Houthi–Saudi front', region: '예멘 홍해 연안 · 사우디 남부', lat: 14.8, lon: 42.95, start: '2014-09-21', level: 'escalating', intensity: 2, air: true,
    wiki: ['Yemeni civil war (2014–present)', 'Red Sea crisis', 'Houthi movement', 'Saudi Arabian-led intervention in Yemen'],
    summary: '사우디와 연합 예멘군이 후티 반군이 한 달 전 장악한 홍해 연안과 바브엘만데브 해협 일대를 되찾기 위해 대규모 지상·공중 공세에 나섰습니다. 후티는 10월 6–8일 리야드·아브하 공항과 아람코 라비그 정유시설을 미사일과 드론으로 공격했습니다.',
    points: ['후티, 사우디 영공 운항 항공사에 “최후 경고”', '아덴 국제공항도 탄도미사일·드론 공격 받음'],
    cas: { items: [{ k: 'killed', v: '3명', d: '10.6–7 사우디 공항 피격' }, { k: 'injured', v: '36명', d: '같은 공격 (아브하 28명·리야드 8명)' }, { k: 'killed', v: '약 37만 7천 명', d: '전쟁 전체 (간접 사망 포함, 유엔개발계획 2021 추정)' }], killedNum: 377000,
      src: '사우디 민항청(10월), 유엔개발계획(UNDP).' },
    articles: [
      { t: 'Iran-backed Houthis attack Saudi Arabia airports, killing 3', s: 'AP / Honolulu Star-Advertiser', d: '2026-10-07', u: 'https://www.staradvertiser.com/2026/10/07/breaking-news/iran-backed-houthis-attack-saudi-arabia-airports-killing-3/' },
      { t: 'Yemen’s Houthis claim attacks on Saudi airports, military bases', s: 'The Express Tribune', d: '2026-10', u: 'https://tribune.com.pk/story/2633438/yemens-houthis-claim-attacks-on-saudi-airports-military-bases' },
    ], q: 'Houthi Saudi Yemen', q2: 'Houthi', qko: '후티 사우디 예멘' },

  { id: 'myanmar', cat: 'war', name: '미얀마 내전', en: 'Myanmar Civil War', region: '미얀마 사가잉·라카인·카친·친주', lat: 22.0, lon: 95.8, start: '2021-02-01', level: 'active', intensity: 2, air: true,
    wiki: ['Myanmar civil war (2021–present)', 'Myanmar civil war', 'Myanmar conflict', 'Arakan Army'],
    summary: '2021년 쿠데타 이후 군정과 저항세력·소수민족 무장단체 사이의 내전입니다. 9월 라카인주에서는 아라칸군(AA)과 군정의 교전이 연일 이어졌고, 카친·친주에서는 군정 공습으로 민간인이 숨졌습니다.',
    points: ['ACLED: 2026년 상반기 집단 살해 10여 건, 민간인 450명 이상 사망', '민 아웅 흘라잉, 야권 배제 선거 뒤 대통령 취임', '1,600만 명 이상 인도적 지원 필요 (유엔, 2026.7)'],
    cas: { items: [{ k: 'killed', v: '약 10만 명', d: '2021년 이후 누적 (로이터)' }, { k: 'displaced', v: '약 380만 명', d: '국내 피란 (유엔, 2026.7)' }, { k: 'killed', v: '982명', d: '2025년 군 공습에 의한 민간인 사망 (유엔)' }], killedNum: 100000,
      src: '로이터, 유엔 OCHA·인권사무소.' },
    articles: [
      { t: 'Myanmar military escalates civilian killings, monitor warns amid diplomatic push', s: 'News Tribune (AP)', d: '2026-07-27', u: 'https://www.newstribune.com/news/2026/jul/27/myanmar-military-escalates-civilian-killings-monitor-warns-amid-diplomatic-push/' },
      { t: 'OCHA Myanmar Humanitarian Update No. 51', s: 'UN OCHA', d: '2026-03-09', u: 'https://myanmar.un.org/sites/default/files/2026-03/OCHA%20Myanmar%20-%20Humanitarian%20Update%20No.%2051%20%289_March_2026%29.pdf' },
    ], q: 'Myanmar junta Arakan Army', q2: 'Myanmar', qko: '미얀마 내전' },

  { id: 'drc', cat: 'war', name: '콩고민주공화국 동부 분쟁 (M23)', en: 'Eastern DR Congo / M23 conflict', region: '북키부 마시시·왈리칼레, 남키부 고원', lat: -1.4, lon: 28.82, start: '2022-03-28', level: 'active', intensity: 2,
    wiki: ['M23 campaign (2022–present)', 'Kivu conflict', 'M23 offensive', 'March 23 Movement', 'Democratic Republic of the Congo–Rwanda relations'],
    summary: '르완다가 지원하는 M23(AFC) 연합과 콩고군(FARDC)·부룬디군·와잘렌도 민병대가 싸우고 있습니다. 9월 중순 정부군이 남부 마시시에서 진전을 이뤘지만 25일께 응궁구 방면에서 공세가 멈췄습니다. 남키부 고원 미넴브웨 일대가 가장 치열한 전선입니다.',
    points: ['왈리칼레 RP529 도로에서 거점 주인이 여러 차례 바뀜', '9월 초 마시시–왈리칼레 경계 교전으로 새 피란 행렬', '일부 수치는 교전 당사자 주장으로 미확인'],
    cas: { items: [{ k: 'killed', v: '1,500명+', d: 'M23의 우비라 점령 (2025.12, 지방 당국)' }, { k: 'killed', v: '171구', d: '2026.2 우비라 인근 집단매장지' }, { k: 'displaced', v: '700만 명+', d: '콩고 전체 누적 (UNHCR)' }], killedNum: 1500,
      src: '지방 당국, AP, UNHCR. 2026년 전체 사망자 공식 집계는 없습니다.' },
    articles: [
      { t: 'Congo War Security Review — September 25, 2026', s: 'Critical Threats', d: '2026-09-25', u: 'https://www.criticalthreats.org/briefs/congo-war-security-review/september-25-2026' },
      { t: '171 bodies found in mass graves in eastern Congo, an official says', s: 'AP / CFJC Today', d: '2026-02-26', u: 'https://cfjctoday.com/2026/02/26/171-bodies-found-in-mass-graves-in-eastern-congo-an-official-says/' },
    ], q: 'Congo M23 Kivu', q2: 'M23', qko: '콩고 M23' },

  { id: 'afpak', cat: 'war', name: '아프가니스탄–파키스탄 전쟁', en: '2026 Afghanistan–Pakistan war', region: '아프간 쿠나르·헬만드 · 파키스탄 북서부 국경', lat: 34.85, lon: 71.1, start: '2026-02-21', level: 'escalating', intensity: 2, air: true,
    wiki: ['2026 Afghanistan–Pakistan war', 'Afghanistan–Pakistan border skirmishes', 'Insurgency in Khyber Pakhtunkhwa', 'Tehrik-i-Taliban Pakistan'],
    summary: '2025년 10월 휴전이 무너진 뒤 파키스탄이 2026년 2월 “공개 전쟁”을 선언했습니다. 9월 18일 파키스탄 북서부 자폭 테러로 31명이 숨지자, 파키스탄은 쿠나르·헬만드 등 아프간 영토를 세 차례 공습했습니다.',
    points: ['9월 30일 공습에 대해 파키스탄은 “테러범 22명 사살”, 탈레반은 “민간인 9명 사망” 주장', '10월 초 3주째 공습 지속 (FDD Long War Journal)'],
    cas: { items: [{ k: 'killed', v: '1,100명+', d: '아프간 민간인 사상(사망+부상), 2026년 (UNAMA)' }, { k: 'killed', v: '31명', d: '9.18 파키스탄 북서부 자폭 테러' }, { k: 'injured', v: '100명+', d: '같은 테러' }], killedNum: 31,
      src: 'UNAMA, FDD Long War Journal. 양측 전투원 사상자 주장은 서로 크게 엇갈립니다.' },
    articles: [
      { t: 'Pakistan launches new strikes as conflict with Taliban persists into third week', s: 'FDD’s Long War Journal', d: '2026-10-05', u: 'https://www.fdd.org/analysis/2026/10/05/pakistan-launches-new-strikes-as-conflict-with-taliban-persist-into-third-week/' },
      { t: '2026 Afghanistan–Pakistan war', s: 'Wikipedia', d: '갱신 중', u: 'https://en.wikipedia.org/wiki/2026_Afghanistan%E2%80%93Pakistan_war' },
    ], q: 'Pakistan Afghanistan airstrikes', q2: 'Taliban Pakistan', qko: '파키스탄 아프가니스탄 공습' },

  { id: 'ethiopia', cat: 'war', name: '에티오피아 반군 대공세 · 에리트레아 개입', en: '2026 Ethiopian offensive', region: '에티오피아 티그라이 (아디그라트 일대)', lat: 14.28, lon: 39.46, start: '2026-09-23', level: 'escalating', intensity: 2, air: true,
    wiki: ['2026 Ethiopian offensive', 'Fano insurgency', 'Ethiopian civil conflict (2018–present)', 'Eritrea–Ethiopia relations'],
    summary: '9월 23일 에티오피아 반군 연합(EPFAS)이 티그라이에서 정부군(ENDF)을 상대로 대규모 공세를 시작했습니다. 에리트레아군이 에티오피아 영내에 있다는 보도가 나왔고, 10월 1일에는 아디스아바바가 드론 공격을 받았습니다.',
    points: ['10월 8–9일 정부군, 아디그라트 인근 에리트레아군에 드론 공습', '현재 정보는 주로 위키백과 정리에 기반, 교차 확인 필요'],
    cas: { items: [], killedNum: 0, src: '아직 신뢰할 만한 사상자 집계가 없습니다. 아래 자동 집계와 최근 보도를 참고하세요.' },
    articles: [
      { t: '2026 Ethiopian offensive', s: 'Wikipedia', d: '갱신 중', u: 'https://en.wikipedia.org/wiki/2026_Ethiopian_offensive' },
      { t: 'Early Edition: October 8, 2026', s: 'Just Security', d: '2026-10-08', u: 'https://justsecurity.org/160040/early-edition-october-8-2026' },
    ], q: 'Ethiopia Tigray Eritrea', q2: 'Tigray', qko: '에티오피아 티그라이' },

  { id: 'sahel', cat: 'war', name: '사헬 지하디스트 분쟁 (말리)', en: 'Sahel insurgency — Mali', region: '말리 중부 (세구·몹티·세바레)', lat: 14.5, lon: -4.6, start: '2012-01-17', level: 'escalating', intensity: 2,
    wiki: ['Mali War', 'Jihadist insurgency in Burkina Faso', 'Insurgency in the Sahel', 'Jama\'at Nasr al-Islam wal Muslimin'],
    summary: '알카에다 연계 JNIM이 4월 투아레그 분리주의 단체 FLA와 함께 전국 동시 공격을 벌여 말리 국방장관이 숨졌습니다. 9월 10일 디우라 기지 공격으로 말리군 100명 이상이 숨진 것으로 추정되며, 9월 18–20일에는 바마코 외곽 검문소와 세바레 드론 격납고가 공격받았습니다.',
    points: ['JNIM, 포로가 된 말리군 영상 공개', '부르키나파소로 공세 확대 우려'],
    cas: { items: [{ k: 'killed', v: '50–130명', d: '9.10 디우라 기지 공격 말리군 사망 (보도별 상이)' }, { k: 'detained', v: '93명', d: 'JNIM이 주장하는 포로 수' }], killedNum: 120,
      src: 'AFP·로이터 보안 소식통, JNIM 주장(미검증).' },
    articles: [
      { t: 'Al Qaeda-linked militants kill more than 100 Malian soldiers in attack this month, sources say', s: 'Polity (Reuters)', d: '2026-09-21', u: 'https://www.polity.org.za/article/al-qaeda-linked-militants-kill-more-than-100-malian-soldiers-in-attack-this-month-sources-say-2026-09-21' },
      { t: 'Sahel Morning Brief — 20 September 2026', s: 'The Sahel Brief', d: '2026-09-20', u: 'https://buttondown.com/TheSahelBrief/archive/sahel-morning-brief-20-september-2026/' },
    ], q: 'Mali JNIM attack', q2: 'Mali', qko: '말리 JNIM' },

  { id: 'gaza', cat: 'clash', name: '가자지구 분쟁', en: 'Gaza — fragile ceasefire', region: '팔레스타인 가자지구', lat: 31.42, lon: 34.37, start: '2023-10-07', level: 'ceasefire', intensity: 2, size: 0.7, air: true,
    wiki: ['Gaza war', 'Gaza–Israel conflict', 'Gaza war ceasefire', 'Israeli–Palestinian conflict'],
    summary: '2025년 10월 10일 휴전이 발효됐지만 이스라엘군의 공습·포격·드론 공격과 지상 작전은 멈추지 않았습니다. 휴전 이후 사망자는 1,300명을 넘었고, 양측은 서로 휴전 위반을 주장하고 있습니다.',
    points: ['WHO: 병원 36곳 중 19곳만 부분 가동, 완전 가동 병원 없음', '가자 면적의 약 3분의 2가 접근 불가 또는 심각한 제한 (유엔)'],
    cas: { items: [{ k: 'killed', v: '73,922명', d: '2023.10.7 이후 누적 (9.23)' }, { k: 'injured', v: '174,995명', d: '같은 기간' }, { k: 'killed', v: '1,326명', d: '2025.10.10 휴전 이후 (9.1)' }], killedNum: 73922,
      src: '가자 보건부(유엔 인용). 이스라엘은 수치에 이의를 제기합니다.' },
    articles: [
      { t: 'Weekly summary of the War on Gaza, September 4, 2026', s: 'Gaza Unlocked', d: '2026-09-04', u: 'https://gazaunlocked.org/posts/weekly-gaza-update-september-4' },
      { t: 'Gaza health officials say 7 killed', s: 'Oman Observer (AFP)', d: '2026-09', u: 'https://www.omanobserver.om/article/1190256/world/region/gaza-health-officials-say-7-killed' },
    ], q: 'Gaza Israel strike ceasefire', q2: 'Gaza', qko: '가자지구' },

  { id: 'lebanon', cat: 'clash', name: '이스라엘–헤즈볼라 (레바논)', en: '2026 Lebanon war', region: '레바논 남부 · 이스라엘 북부', lat: 33.27, lon: 35.45, start: '2026-03-02', level: 'ceasefire', intensity: 1, size: 0.6, air: true,
    wiki: ['2026 Lebanon war', 'Israel–Hezbollah conflict (2023–present)', 'Israel–Hezbollah conflict', 'Hezbollah'],
    summary: '이란 전쟁 개시 며칠 뒤 헤즈볼라가 이스라엘 북부로 로켓을 쏘면서 시작됐습니다. 4월 16일 잠정 휴전과 6월 19일 미국·카타르 중재 휴전이 있었으나, 이스라엘은 헤즈볼라 무장해제 전에는 완전한 휴전은 없다는 입장입니다.',
    points: ['1993년 이후 첫 이스라엘–레바논 직접 협상'],
    cas: { items: [{ k: 'killed', v: '4,000명+', d: '이스라엘 공습에 의한 레바논 측 사망' }, { k: 'displaced', v: '100만 명+', d: '레바논 내 피란' }], killedNum: 4000, src: '레바논 보건 당국 (위키백과 집계).' },
    articles: [
      { t: '2026 Lebanon war', s: 'Wikipedia', d: '갱신 중', u: 'https://en.wikipedia.org/wiki/2026_Lebanon_war' },
      { t: 'Israel and Hezbollah agree to ceasefire amid U.S.-Iran peace agreement', s: 'FDD (Fox LiveNOW)', d: '2026-06-19', u: 'https://www.fdd.org/in_the_news/2026/06/19/israel-and-hezbollah-agree-to-ceasefire-amid-u-s-iran-peace-agreement/' },
    ], q: 'Hezbollah Israel Lebanon', q2: 'Hezbollah', qko: '레바논 헤즈볼라' },

  { id: 'haiti', cat: 'clash', name: '아이티 갱단 전쟁', en: 'Haiti gang war', region: '아이티 포르토프랭스 · 퀼드삭 평원', lat: 18.55, lon: -72.33, start: '2021-07-07', level: 'escalating', intensity: 2, size: 0.65,
    wiki: ['Haitian crisis (2018–present)', 'Gang war in Haiti', 'Haitian gang war', 'Viv Ansanm'],
    summary: '갱단이 수도 포르토프랭스의 약 90%를 장악했습니다. 8월 23일 켄스코프에서 피란민이 머물던 교회가 습격당해 40명 넘게 숨지고 50명 이상이 납치됐습니다.',
    points: ['국제 안정화군 약 1,500명, 목표 5,500명에 크게 못 미침', '12월 총선 예정'],
    cas: { items: [{ k: 'killed', v: '3,050명', d: '2026년 1–6월 (1분기 1,642 + 2분기 1,408)' }, { k: 'injured', v: '656명', d: '2026년 2분기' }, { k: 'displaced', v: '약 150만 명', d: '국내 피란' }], killedNum: 3050,
      src: '유엔 아이티 통합사무소(BINUH), 유엔 인권최고대표(10.2: 2026년 사상자 5,700명+).' },
    articles: [
      { t: 'Violência de gangues no Haiti matou 5,7 mil em 2026, diz ONU', s: 'O Povo', d: '2026-10-03', u: 'https://www.opovo.com.br/noticias/mundo/2026/10/03/violencia-de-gangues-no-haiti-matou-57-mil-em-2026-diz-onu.html' },
      { t: 'At least 1,408 killed in Haiti as UN warns gang violence is spreading', s: 'Caribbean National Weekly', d: '2026', u: 'https://www.caribbeannationalweekly.com/posts/at-least-1408-killed-in-haiti-as-un-warns-gang-violence-is-spreading' },
    ], q: 'Haiti gang', q2: 'Haiti', qko: '아이티 갱단' },

  { id: 'belgium', cat: 'riot', name: '벨기에 반긴축 폭동', en: 'Belgium anti-austerity unrest', region: '벨기에 브뤼셀 · 리에주', lat: 50.845, lon: 4.357, start: '2026-10-02', level: 'active', intensity: 2, size: 0.55,
    wiki: ['2026 Belgian protests', 'Belgian anti-austerity protests'],
    summary: '정부의 100억 유로 긴축안에 반대하는 전국 파업 집회(약 3만 명)가 10월 9일 브뤼셀에서 열렸고, 복면을 쓴 청년 무리가 중앙역 근처에서 경찰과 충돌했습니다. 경찰은 물대포와 최루탄을 썼습니다.',
    points: ['리에주에서 학생 시위가 폭동으로 번져 집회 금지령', '노조 측: 폭력 행위자는 본 집회와 무관'],
    cas: { items: [{ k: 'killed', v: '0명', d: '사망자 보고 없음' }, { k: 'injured', v: '경찰 수십 명', d: '리에주 충돌' }, { k: 'detained', v: '220명+', d: '브뤼셀 약 20명 + 리에주 200명 이상' }], killedNum: 0, src: 'Euronews, DW, The Belgian Times.' },
    articles: [
      { t: 'Police and protesters clash in Brussels as anti-austerity rally disrupts city', s: 'Euronews', d: '2026-10-09', u: 'https://www.euronews.com/2026/10/09/police-and-protesters-clash-in-brussels-as-anti-austerity-rally-disrupts-city' },
      { t: 'Thousands flood Brussels streets as anti-austerity protests erupt into clashes with police', s: 'Fox News', d: '2026-10-09', u: 'https://www.foxnews.com/world/thousands-flood-brussels-streets-anti-austerity-protests-erupt-clashes-police' },
    ], q: 'Brussels protest austerity police', q2: 'Brussels', qko: '브뤼셀 시위' },

  { id: 'delhi', cat: 'protest', name: '인도 델리 Z세대 반정부 시위', en: '2026 Delhi Jantar Mantar protests', region: '인도 뉴델리', lat: 28.62, lon: 77.21, start: '2026-10-09', level: 'escalating', intensity: 2, size: 0.55,
    wiki: ['2026 Delhi Jantar Mantar protests', 'Cockroach Janta Party', 'Sansad Chalo march', 'Censorship in India'],
    summary: 'Z세대 주도 정당 CJP(Cockroach Janta Party)가 기아네시 쿠마르 선거관리위원장 규탄과 의회 행진(Sansad Chalo)을 조직하자, 당국이 뉴델리에 고강도 보안 봉쇄를 하고 시위대 수천 명을 연행했습니다. 아르빈드 케지리왈 등 야권 지도부도 연행됐습니다.',
    points: ['아카슈바니 바완 인근에서 바리케이드 붕괴 뒤 투석', '유엔, 시위대·시민사회·변호사·언론인 대규모 구금에 우려 표명'],
    cas: { items: [{ k: 'killed', v: '0명', d: '사망자 보고 없음' }, { k: 'injured', v: '경찰 2명', d: '투석 (10.10)' }, { k: 'detained', v: '7,000명+', d: '10.10 연행 (당국 발표)' }], killedNum: 0, src: 'Outlook India, BBC, The Guardian.' },
    articles: [
      { t: 'CJP Protest LIVE Updates: Kejriwal, Mamata Banerjee, AAP and TMC leaders detained', s: 'Outlook India', d: '2026-10-10', u: 'https://outlookindia.com/national/cjp-protest-live-updates-abhijeet-dipke-delhi-india-bloc-cec-row-latest-updates-october-10' },
      { t: 'Police detain anti-government Cockroach party leader amid Delhi protests', s: 'The Guardian', d: '2026-10-10', u: 'https://www.theguardian.com/world/video/2026/oct/10/police-detain-anti-government-cockroach-party-leader-amid-delhi-protests-video' },
    ], q: 'Delhi protest Cockroach', q2: 'Delhi protest', qko: '델리 시위' },

  { id: 'uyghur', cat: 'oppression', variant: 'camp', name: '위구르족 탄압 (신장)', en: 'Persecution of Uyghurs in Xinjiang', region: '중국 신장위구르자치구', lat: 42.6, lon: 84.6, start: '2017', level: 'active', intensity: 2, size: 0.7,
    wiki: ['Persecution of Uyghurs in China', 'Xinjiang internment camps', 'Uyghur genocide'],
    summary: '중국 정부가 위구르족 등 무슬림 소수민족을 대규모 구금·감시·강제노동 체제로 통제하고 있다는 국제적 비판이 이어지고 있습니다. 중국은 2019년 수용소 대부분을 닫았다고 밝혔지만 미 국무부는 다수가 여전히 수감돼 있다고 봅니다.',
    points: ['2026년 1월 중국, 신장 강제노동에 대한 유엔 전문가 우려 거부', '인권단체들, 각국에 대응 강화 촉구 (HRW, 2026년 1월)'],
    cas: { items: [{ k: 'detained', v: '최대 100만 명+', d: '2017–2019 수용소 구금 추정 (유엔 인종차별철폐위원회 인용 보고)' }], killedNum: 0, src: '유엔 CERD(2018), 미 국무부 인권보고서. 중국 정부는 직업훈련 시설이라고 주장합니다.' },
    articles: [
      { t: 'Persecution of Uyghurs in Xinjiang: Torture, Crimes Against Humanity, and Genocide', s: 'Hoover Institution', d: '', u: 'https://www.hoover.org/node/379149' },
      { t: 'Uyghurs — latest coverage', s: 'Arab News', d: '2026', u: 'https://www.arabnews.com/tag/uyghurs' },
    ], q: 'Uyghur Xinjiang', q2: 'Uyghur', qko: '위구르 신장' },

  { id: 'rohingya', cat: 'oppression', variant: 'village', name: '로힝야족 박해 (미얀마 라카인)', en: 'Persecution of the Rohingya', region: '미얀마 라카인주 북부 · 방글라데시 국경', lat: 20.8, lon: 92.45, start: '2017-08-25', level: 'active', intensity: 2, size: 0.6,
    wiki: ['Rohingya genocide', 'Rohingya people', 'Rohingya refugee crisis'],
    summary: '라카인주에서 미얀마군과 아라칸군(AA)의 전투가 이어지는 가운데, 로힝야족이 양측 모두로부터 초법적 살해·납치·무차별 폭격 피해를 입고 있다는 보고가 나오고 있습니다.',
    points: ['미 국무부, 2023년 로힝야 처우를 “인종청소”로 규정', '유엔, 2017년 대학살 재연 우려 경고'],
    cas: { items: [{ k: 'killed', v: '6,700명+', d: '2017.8 군 소탕작전 첫 한 달 (국경없는의사회 추정)' }, { k: 'displaced', v: '약 100만 명', d: '방글라데시 콕스바자르 난민촌' }], killedNum: 6700, src: '국경없는의사회(MSF), UNHCR.' },
    articles: [
      { t: 'UN fears repeat of 2017 atrocities against Rohingyas', s: 'The Sun (Malaysia)', d: '', u: 'https://thesun.my/world/un-fears-repeat-of-2017-atrocities-against-rohingyas-GK12901676' },
      { t: 'US report: ‘Ethnic cleansing’ of Rohingya took place last year', s: 'Radio Free Asia', d: '2024-04-22', u: 'https://www.rfa.org/english/news/myanmar/rohinya-ethnic-cleansing-04222024152550.html' },
    ], q: 'Rohingya Rakhine', q2: 'Rohingya', qko: '로힝야' },

  { id: 'darfur', cat: 'oppression', variant: 'village', name: '다르푸르 비아랍계 주민 학살', en: 'Ethnic killings in Darfur', region: '수단 북다르푸르 (엘파셰르)', lat: 13.63, lon: 25.35, start: '2023-04', level: 'active', intensity: 2, size: 0.6,
    wiki: ['Siege of El Fasher', 'El Fasher massacre', 'Masalit massacres', 'War in Darfur (2023–present)'],
    summary: 'RSF가 2025년 10월 오랜 포위 끝에 엘파셰르를 함락한 뒤 비아랍계 주민을 겨냥한 집단 살해가 보고됐습니다. 2023년 서다르푸르 엘제네이나의 마살리트족 학살에 이어 국제사회는 제노사이드 위험을 경고하고 있습니다.',
    points: ['보호책임 국제센터(GR2P): 다르푸르 주민에 대한 잔학행위 위험 최고 단계', '엘파셰르 함락 이후 대규모 피란과 인도적 접근 차단'],
    cas: { items: [{ k: 'killed', v: '1만–1만5천 명', d: '2023 엘제네이나 마살리트족 학살 (유엔 전문가 패널)' }, { k: 'killed', v: '1,500명+', d: '2025.10 엘파셰르 함락 직후 (수단 의사네트워크 주장)' }], killedNum: 10000, src: '유엔 수단 전문가 패널, 수단 의사네트워크.' },
    articles: [
      { t: 'Sudan — Populations at risk', s: 'Global Centre for the Responsibility to Protect', d: '갱신 중', u: 'https://www.globalr2p.org/countries/sudan/' },
      { t: 'War in Sudan: Humanitarian collapse, fighting, deadlock', s: 'Al Jazeera', d: '2025-12-31', u: 'https://www.aljazeera.com/news/2025/12/31/war-in-sudan-humanitarian-collapse-fighting-deadlock-december-2025' },
    ], q: 'Darfur RSF El Fasher', q2: 'Darfur', qko: '다르푸르 엘파셰르' },
];

// 국가 중심 좌표 [위도, 경도, 한국어명]
export const COUNTRIES = {
  'Afghanistan': [33.9, 67.7, '아프가니스탄'], 'Albania': [41.15, 20.17, '알바니아'], 'Algeria': [28.0, 1.66, '알제리'], 'Angola': [-11.2, 17.87, '앙골라'],
  'Argentina': [-38.4, -63.6, '아르헨티나'], 'Armenia': [40.07, 45.04, '아르메니아'], 'Australia': [-25.3, 133.8, '호주'], 'Austria': [47.5, 14.55, '오스트리아'],
  'Azerbaijan': [40.14, 47.58, '아제르바이잔'], 'Bahrain': [26.07, 50.56, '바레인'], 'Bangladesh': [23.68, 90.36, '방글라데시'], 'Belarus': [53.7, 27.95, '벨라루스'],
  'Belgium': [50.5, 4.47, '벨기에'], 'Benin': [9.31, 2.32, '베냉'], 'Bolivia': [-16.29, -63.59, '볼리비아'], 'Bosnia and Herzegovina': [43.92, 17.68, '보스니아 헤르체고비나'],
  'Botswana': [-22.33, 24.68, '보츠와나'], 'Brazil': [-14.24, -51.93, '브라질'], 'Bulgaria': [42.73, 25.49, '불가리아'], 'Burkina Faso': [12.24, -1.56, '부르키나파소'],
  'Burundi': [-3.37, 29.92, '부룬디'], 'Cambodia': [12.57, 104.99, '캄보디아'], 'Cameroon': [7.37, 12.35, '카메룬'], 'Canada': [56.13, -106.35, '캐나다'],
  'Central African Republic': [6.61, 20.94, '중앙아프리카공화국'], 'Chad': [15.45, 18.73, '차드'], 'Chile': [-35.68, -71.54, '칠레'], 'China': [35.86, 104.2, '중국'],
  'Colombia': [4.57, -74.3, '콜롬비아'], 'Democratic Republic of the Congo': [-4.04, 21.76, '콩고민주공화국'], 'Republic of the Congo': [-0.23, 15.83, '콩고공화국'],
  'Costa Rica': [9.75, -83.75, '코스타리카'], 'Croatia': [45.1, 15.2, '크로아티아'], 'Cuba': [21.52, -77.78, '쿠바'], 'Cyprus': [35.13, 33.43, '키프로스'],
  'Czech Republic': [49.82, 15.47, '체코'], 'Denmark': [56.26, 9.5, '덴마크'], 'Djibouti': [11.83, 42.59, '지부티'], 'Dominican Republic': [18.74, -70.16, '도미니카공화국'],
  'Ecuador': [-1.83, -78.18, '에콰도르'], 'Egypt': [26.82, 30.8, '이집트'], 'El Salvador': [13.79, -88.9, '엘살바도르'], 'Eritrea': [15.18, 39.78, '에리트레아'],
  'Estonia': [58.6, 25.01, '에스토니아'], 'Ethiopia': [9.15, 40.49, '에티오피아'], 'Fiji': [-17.71, 178.07, '피지'], 'Finland': [61.92, 25.75, '핀란드'],
  'France': [46.23, 2.21, '프랑스'], 'Gabon': [-0.8, 11.61, '가봉'], 'Georgia': [42.32, 43.36, '조지아'], 'Germany': [51.17, 10.45, '독일'], 'Ghana': [7.95, -1.02, '가나'],
  'Greece': [39.07, 21.82, '그리스'], 'Guatemala': [15.78, -90.23, '과테말라'], 'Guinea': [9.95, -9.7, '기니'], 'Guinea-Bissau': [11.8, -15.18, '기니비사우'],
  'Haiti': [18.97, -72.29, '아이티'], 'Honduras': [15.2, -86.24, '온두라스'], 'Hungary': [47.16, 19.5, '헝가리'], 'Iceland': [64.96, -19.02, '아이슬란드'],
  'India': [20.59, 78.96, '인도'], 'Indonesia': [-0.79, 113.92, '인도네시아'], 'Iran': [32.43, 53.69, '이란'], 'Iraq': [33.22, 43.68, '이라크'], 'Ireland': [53.41, -8.24, '아일랜드'],
  'Israel': [31.05, 34.85, '이스라엘'], 'Italy': [41.87, 12.57, '이탈리아'], 'Ivory Coast': [7.54, -5.55, '코트디부아르'], 'Jamaica': [18.11, -77.3, '자메이카'],
  'Japan': [36.2, 138.25, '일본'], 'Jordan': [30.59, 36.24, '요르단'], 'Kazakhstan': [48.02, 66.92, '카자흐스탄'], 'Kenya': [-0.02, 37.91, '케냐'], 'Kosovo': [42.6, 20.9, '코소보'],
  'Kuwait': [29.31, 47.48, '쿠웨이트'], 'Kyrgyzstan': [41.2, 74.77, '키르기스스탄'], 'Laos': [19.86, 102.5, '라오스'], 'Latvia': [56.88, 24.6, '라트비아'],
  'Lebanon': [33.85, 35.86, '레바논'], 'Lesotho': [-29.61, 28.23, '레소토'], 'Liberia': [6.43, -9.43, '라이베리아'], 'Libya': [26.34, 17.23, '리비아'],
  'Lithuania': [55.17, 23.88, '리투아니아'], 'Madagascar': [-18.77, 46.87, '마다가스카르'], 'Malawi': [-13.25, 34.3, '말라위'], 'Malaysia': [4.21, 101.98, '말레이시아'],
  'Mali': [17.57, -4.0, '말리'], 'Mauritania': [21.01, -10.94, '모리타니'], 'Mexico': [23.63, -102.55, '멕시코'], 'Moldova': [47.41, 28.37, '몰도바'],
  'Mongolia': [46.86, 103.85, '몽골'], 'Montenegro': [42.71, 19.37, '몬테네그로'], 'Morocco': [31.79, -7.09, '모로코'], 'Mozambique': [-18.67, 35.53, '모잠비크'],
  'Myanmar': [21.91, 95.96, '미얀마'], 'Namibia': [-22.96, 18.49, '나미비아'], 'Nepal': [28.39, 84.12, '네팔'], 'Netherlands': [52.13, 5.29, '네덜란드'],
  'New Zealand': [-40.9, 174.89, '뉴질랜드'], 'Nicaragua': [12.87, -85.21, '니카라과'], 'Niger': [17.61, 8.08, '니제르'], 'Nigeria': [9.08, 8.68, '나이지리아'],
  'North Korea': [40.34, 127.51, '북한'], 'North Macedonia': [41.61, 21.75, '북마케도니아'], 'Norway': [60.47, 8.47, '노르웨이'], 'Oman': [21.51, 55.92, '오만'],
  'Pakistan': [30.38, 69.35, '파키스탄'], 'Palestine': [31.95, 35.23, '팔레스타인'], 'Panama': [8.54, -80.78, '파나마'], 'Papua New Guinea': [-6.31, 143.96, '파푸아뉴기니'],
  'Paraguay': [-23.44, -58.44, '파라과이'], 'Peru': [-9.19, -75.02, '페루'], 'Philippines': [12.88, 121.77, '필리핀'], 'Poland': [51.92, 19.15, '폴란드'],
  'Portugal': [39.4, -8.22, '포르투갈'], 'Qatar': [25.35, 51.18, '카타르'], 'Romania': [45.94, 24.97, '루마니아'], 'Russia': [55.75, 37.6, '러시아'], 'Rwanda': [-1.94, 29.87, '르완다'],
  'Saudi Arabia': [23.89, 45.08, '사우디아라비아'], 'Senegal': [14.5, -14.45, '세네갈'], 'Serbia': [44.02, 21.01, '세르비아'], 'Sierra Leone': [8.46, -11.78, '시에라리온'],
  'Singapore': [1.35, 103.82, '싱가포르'], 'Slovakia': [48.67, 19.7, '슬로바키아'], 'Slovenia': [46.15, 14.99, '슬로베니아'], 'Solomon Islands': [-9.65, 160.16, '솔로몬 제도'],
  'Somalia': [5.15, 46.2, '소말리아'], 'South Africa': [-30.56, 22.94, '남아프리카공화국'], 'South Korea': [35.91, 127.77, '대한민국'], 'South Sudan': [6.88, 31.31, '남수단'],
  'Spain': [40.46, -3.75, '스페인'], 'Sri Lanka': [7.87, 80.77, '스리랑카'], 'Sudan': [12.86, 30.22, '수단'], 'Sweden': [60.13, 18.64, '스웨덴'], 'Switzerland': [46.82, 8.23, '스위스'],
  'Syria': [34.8, 38.99, '시리아'], 'Taiwan': [23.7, 120.96, '대만'], 'Tajikistan': [38.86, 71.28, '타지키스탄'], 'Tanzania': [-6.37, 34.89, '탄자니아'], 'Thailand': [15.87, 100.99, '태국'],
  'Timor-Leste': [-8.87, 125.73, '동티모르'], 'Togo': [8.62, 0.82, '토고'], 'Tonga': [-21.18, -175.2, '통가'], 'Tunisia': [33.89, 9.54, '튀니지'], 'Turkey': [38.96, 35.24, '튀르키예'],
  'Turkmenistan': [38.97, 59.56, '투르크메니스탄'], 'Uganda': [1.37, 32.29, '우간다'], 'Ukraine': [48.38, 31.17, '우크라이나'], 'United Arab Emirates': [23.42, 53.85, '아랍에미리트'],
  'United Kingdom': [54.0, -2.0, '영국'], 'United States': [39.5, -98.35, '미국'], 'Uruguay': [-32.52, -55.77, '우루과이'], 'Uzbekistan': [41.38, 64.59, '우즈베키스탄'],
  'Vanuatu': [-15.38, 166.96, '바누아투'], 'Venezuela': [6.42, -66.59, '베네수엘라'], 'Vietnam': [14.06, 108.28, '베트남'], 'Western Sahara': [24.22, -12.89, '서사하라'],
  'Yemen': [15.55, 48.52, '예멘'], 'Zambia': [-13.13, 27.85, '잠비아'], 'Zimbabwe': [-19.02, 29.15, '짐바브웨'], 'Puerto Rico': [18.22, -66.59, '푸에르토리코'],
  'Greenland': [71.7, -42.6, '그린란드'], 'Bahamas': [25.03, -77.4, '바하마'], 'Belize': [17.19, -88.5, '벨리즈'], 'Bhutan': [27.51, 90.43, '부탄'],
  'Brunei': [4.54, 114.73, '브루나이'], 'Mauritius': [-20.35, 57.55, '모리셔스'], 'Trinidad and Tobago': [10.69, -61.22, '트리니다드 토바고'], 'Guyana': [4.86, -58.93, '가이아나'],
  'Suriname': [3.92, -56.03, '수리남'], 'Eswatini': [-26.52, 31.47, '에스와티니'], 'Equatorial Guinea': [1.65, 10.27, '적도기니'], 'Gambia': [13.44, -15.31, '감비아'],
  'Cape Verde': [16.0, -24.01, '카보베르데'], 'Comoros': [-11.88, 43.87, '코모로'], 'Maldives': [3.2, 73.22, '몰디브'], 'Micronesia': [7.43, 150.55, '미크로네시아'],
  'Guam': [13.44, 144.79, '괌'], 'Hong Kong': [22.32, 114.17, '홍콩'], 'Macau': [22.2, 113.54, '마카오'], 'New Caledonia': [-20.9, 165.6, '뉴칼레도니아'],
  'French Polynesia': [-17.68, -149.4, '프랑스령 폴리네시아'], 'Dominica': [15.41, -61.37, '도미니카연방'], 'Barbados': [13.19, -59.54, '바베이도스'], 'Samoa': [-13.76, -172.1, '사모아'], 'Kashmir': [34.08, 74.8, '카슈미르'],
};
const ALIASES = {
  'U.S.': 'United States', 'US': 'United States', 'USA': 'United States', 'United States of America': 'United States',
  'UK': 'United Kingdom', 'Britain': 'United Kingdom', 'England': 'United Kingdom', 'Scotland': 'United Kingdom',
  'DR Congo': 'Democratic Republic of the Congo', 'Democratic Republic of Congo': 'Democratic Republic of the Congo', 'Congo, The Democratic Republic of the': 'Democratic Republic of the Congo',
  'The Bahamas': 'Bahamas', 'Swaziland': 'Eswatini', 'Cabo Verde': 'Cape Verde', 'Iran (Islamic Republic of)': 'Iran', 'Syrian Arab Republic': 'Syria',
  'United Republic of Tanzania': 'Tanzania', 'Republic of Moldova': 'Moldova', "Lao People's Democratic Republic": 'Laos', 'Bolivia (Plurinational State of)': 'Bolivia',
  'Venezuela (Bolivarian Republic of)': 'Venezuela', 'Russian Fed.': 'Russia', 'Turkiye': 'Turkey', 'Taiwan, China': 'Taiwan', 'Alaska': 'United States', 'Hawaii': 'United States',
  'California': 'United States', 'Texas': 'United States', 'Florida': 'United States', 'DRC': 'Democratic Republic of the Congo', 'Congo-Kinshasa': 'Democratic Republic of the Congo', 'DR of the Congo': 'Democratic Republic of the Congo',
  'Congo-Brazzaville': 'Republic of the Congo', 'Gaza Strip': 'Palestine', 'Gaza': 'Palestine', 'West Bank': 'Palestine', 'State of Palestine': 'Palestine',
  'Burma': 'Myanmar', 'Türkiye': 'Turkey', "Côte d'Ivoire": 'Ivory Coast', 'Czechia': 'Czech Republic', 'East Timor': 'Timor-Leste', 'Republic of Korea': 'South Korea',
  'Korea': 'South Korea', 'Russian Federation': 'Russia', 'Syrian': 'Syria', 'UAE': 'United Arab Emirates', 'Viet Nam': 'Vietnam', 'Lao PDR': 'Laos',
  'Ukrainian': 'Ukraine', 'Russian': 'Russia', 'Israeli': 'Israel', 'Palestinian': 'Palestine', 'Iranian': 'Iran', 'Iraqi': 'Iraq', 'Sudanese': 'Sudan',
  'Pakistani': 'Pakistan', 'Afghan': 'Afghanistan','Nigerian': 'Nigeria', 'Kenyan': 'Kenya', 'Somali': 'Somalia', 'Ethiopian': 'Ethiopia',
  'Malian': 'Mali', 'Burkinabe': 'Burkina Faso', 'Congolese': 'Democratic Republic of the Congo', 'Haitian': 'Haiti', 'Lebanese': 'Lebanon', 'Yemeni': 'Yemen',
  'Turkish': 'Turkey', 'Chinese': 'China', 'Japanese': 'Japan', 'Filipino': 'Philippines', 'Indonesian': 'Indonesia', 'Mexican': 'Mexico', 'Colombian': 'Colombia',
  'Venezuelan': 'Venezuela', 'Peruvian': 'Peru', 'Bangladeshi': 'Bangladesh', 'Nepali': 'Nepal', 'Serbian': 'Serbia', 'Georgian': 'Georgia', 'French': 'France',
  'German': 'Germany', 'Belgian': 'Belgium', 'Spanish': 'Spain', 'Italian': 'Italy', 'Greek': 'Greece', 'Thai': 'Thailand', 'Cambodian': 'Cambodia',
  'Libyan': 'Libya', 'Egyptian': 'Egypt', 'Moroccan': 'Morocco', 'Tunisian': 'Tunisia', 'Algerian': 'Algeria', 'Mozambican': 'Mozambique', 'Cameroonian': 'Cameroon',
  'Ecuadorian': 'Ecuador', 'Bolivian': 'Bolivia', 'Argentine': 'Argentina', 'Brazilian': 'Brazil', 'Chilean': 'Chile', 'Saudi': 'Saudi Arabia',
};
const ALL_NAMES = [...Object.keys(COUNTRIES), ...Object.keys(ALIASES)].sort((a, b) => b.length - a.length);
const NAME_RE = new RegExp(`(?<![\\w-])(${ALL_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');
export const canonCountry = (n) => (COUNTRIES[n] ? n : ALIASES[n] || null);
export function findCountries(text) {
  const out = [];
  for (const m of String(text || '').matchAll(NAME_RE)) {
    const c = canonCountry(m[1]);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}
export const countryKo = (n) => COUNTRIES[canonCountry(n)]?.[2] || n;
