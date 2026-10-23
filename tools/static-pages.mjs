// 소개·정책 페이지 본문. build.mjs가 불러 쓴다.
export const staticPages = ({ fmt, UPDATED, ISSUES }) => {
  return {
  about: {
    ko: ['소개', '분쟁 관측 지구본은 전 세계의 전쟁·무력 분쟁·대규모 시위·소수민족 탄압을 3D 위성 지구본 위에 표시하는 공개 출처 정보(OSINT) 시각화 프로젝트입니다.', `
<h2>무엇을 보여주나요</h2>
<p>지구본에는 진행 중인 분쟁이 일어나는 주·도 단위 지역이 채색되어 표시되고, 각 지점을 누르면 분쟁의 개요, 진행 기간, 사상자 현황, 최근 동향, 관련 기사가 나타납니다. 확대하면 실제 위성사진과 지형, 지명 위에서 분쟁의 규모에 따라 달라지는 상황 시뮬레이션을 볼 수 있습니다. 시뮬레이션은 규모를 직관적으로 보여주기 위한 상징적 표현이며 실제 병력 배치나 전투 장면을 재현한 것이 아닙니다.</p>
<h2>데이터와 방법</h2>
<ul>
<li><b>큐레이션 사건:</b> 주요 분쟁 25건은 유엔·국제기구·통신사·연구기관의 공개 보도를 바탕으로 개요와 사상자 수치를 직접 정리하고 출처를 함께 표기합니다.</li>
<li><b>자동 수집:</b> 위키백과 ‘진행 중인 무력 분쟁 목록’(60분마다)과 ‘오늘의 사건’(30분마다)을 읽어 새 분쟁과 최근 동향을 자동으로 덧붙입니다. 보도 문장에서 사상자 수를 자동 추출하는 기능은 오류가 있을 수 있어 항상 ‘자동’으로 구분해 표시합니다.</li>
<li><b>실시간 기사:</b> GDELT 프로젝트의 공개 API로 사건별 최근 7일 기사를 보여줍니다.</li>
<li><b>지도:</b> 위성사진은 Esri World Imagery, 야간 영상은 NASA Black Marble, 고도는 Mapzen Terrarium, 국경·지명은 Natural Earth 데이터를 사용합니다.</li>
</ul>
<h2>한계와 원칙</h2>
<p>사상자 수치에는 교전 당사자의 주장이 포함될 수 있고, 기관마다 집계 방식이 다릅니다. 이 사이트는 특정 국가나 세력을 지지하지 않으며, 수치가 엇갈릴 때는 범위와 출처를 함께 보여주는 것을 원칙으로 합니다. 오류를 발견하면 <a href="contact.html">문의</a> 페이지로 알려주세요.</p>`],
    en: ['About', 'Conflict Watch Globe is an open-source intelligence (OSINT) visualisation project that maps wars, armed conflicts, mass protests and the persecution of minorities on a 3D satellite globe.', `
<h2>What it shows</h2>
<p>The globe shades the provinces where ongoing conflicts take place. Selecting a marker opens an overview, duration, casualty figures, latest developments and related reporting. Zoomed in, you can see satellite imagery, terrain and place names, along with a situation simulation that scales with the size of the conflict. The simulation is a symbolic way to convey scale; it does not reproduce real troop positions or combat.</p>
<h2>Data and methods</h2>
<ul>
<li><b>Curated events:</b> 25 major conflicts are summarised by hand from public reporting by the UN, international organisations, news agencies and research institutes, with sources listed.</li>
<li><b>Automatic collection:</b> Wikipedia’s List of ongoing armed conflicts (hourly) and Current events portal (every 30 minutes) add new conflicts and recent developments. Casualty numbers extracted automatically from news text may contain errors and are always labelled as automatic.</li>
<li><b>Live articles:</b> the GDELT Project’s public API lists articles from the last 7 days for each event.</li>
<li><b>Maps:</b> imagery from Esri World Imagery, night lights from NASA Black Marble, elevation from Mapzen Terrarium, borders and places from Natural Earth.</li>
</ul>
<h2>Limits and principles</h2>
<p>Casualty figures may include claims by parties to a conflict, and organisations count differently. This site does not support any state or faction; where figures disagree, we show the range together with the sources. If you spot an error, please tell us via the <a href="contact.html">contact</a> page.</p>`],
  },
  privacy: {
    ko: ['개인정보처리방침', `최종 수정일: ${fmt(UPDATED)}. 분쟁 관측 지구본(이하 ‘사이트’)은 회원가입이나 로그인 기능이 없으며, 이용자의 이름·이메일 등 개인정보를 직접 수집하지 않습니다.`, `
<h2>1. 이용자 기기에 저장되는 정보</h2>
<p>사이트는 언어 설정, 목록 정렬 방식, 자동 번역 결과 캐시를 이용자 브라우저의 로컬 저장소(localStorage)에 저장합니다. 이 정보는 이용자 기기에만 남으며 운영자에게 전송되지 않습니다. 브라우저 설정에서 사이트 데이터를 삭제하면 지워집니다.</p>
<h2>2. 외부 서비스로 전송되는 요청</h2>
<p>지도와 실시간 정보를 표시하기 위해 브라우저가 다음 서비스에 직접 요청을 보냅니다. 이 과정에서 각 서비스는 IP 주소, 브라우저 정보 등 일반적인 접속 기록을 받을 수 있으며, 처리 방식은 각 서비스의 정책을 따릅니다.</p>
<ul><li>Esri(위성사진·지명 타일), NASA GIBS(야간 영상), Amazon S3의 Mapzen Terrarium(고도), unpkg·jsDelivr(지도 라이브러리·텍스처), Google Fonts(글꼴)</li>
<li>위키백과 API(분쟁 목록·오늘의 사건), GDELT 프로젝트(실시간 기사)</li>
<li>Google 번역(영어로만 제공되는 사건명·요약을 한국어로 번역할 때 해당 문장)</li></ul>
<h2>3. 광고와 쿠키</h2>
<p>사이트는 Google AdSense 광고를 게재할 수 있습니다. Google을 포함한 제3자 공급업체는 쿠키를 사용하여 이용자의 이 사이트 또는 다른 웹사이트 방문 기록을 바탕으로 광고를 게재합니다. Google은 광고 쿠키를 사용하여 이용자의 사이트 방문 기록에 기반한 광고를 이용자에게 게재할 수 있습니다.</p>
<p>이용자는 <a href="https://adssettings.google.com" rel="noopener">Google 광고 설정</a>에서 맞춤 광고를 끌 수 있으며, <a href="https://www.aboutads.info" rel="noopener">www.aboutads.info</a>에서 제3자 공급업체의 맞춤 광고용 쿠키 사용을 거부할 수 있습니다. Google의 데이터 사용 방식은 <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">Google 파트너 사이트 정책</a>에서 확인할 수 있습니다. 유럽경제지역·영국·스위스 이용자에게는 광고 쿠키 사용 전에 동의 여부를 묻습니다.</p>
<h2>4. 문의</h2>
<p>개인정보 관련 문의는 <a href="contact.html">문의</a> 페이지를 이용해 주세요.</p>`],
    en: ['Privacy policy', `Last updated: ${UPDATED}. Conflict Watch Globe (the “site”) has no accounts or sign-in and does not directly collect personal information such as names or email addresses.`, `
<h2>1. Information stored on your device</h2>
<p>The site stores your language choice, list sort order and a cache of machine translations in your browser’s local storage. This stays on your device and is never sent to us. Clearing site data in your browser removes it.</p>
<h2>2. Requests to third-party services</h2>
<p>To display maps and live information, your browser contacts the following services directly. They may receive standard access data such as your IP address and browser details, handled under their own policies.</p>
<ul><li>Esri (imagery and label tiles), NASA GIBS (night imagery), Mapzen Terrarium on Amazon S3 (elevation), unpkg and jsDelivr (libraries and textures), Google Fonts</li>
<li>Wikipedia API (conflict list, current events), the GDELT Project (live articles)</li>
<li>Google Translate (only the text being translated, when English-only items are shown in Korean)</li></ul>
<h2>3. Advertising and cookies</h2>
<p>The site may show Google AdSense ads. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites. Google’s use of advertising cookies enables it and its partners to serve ads to you based on your visits to this and/or other sites on the Internet.</p>
<p>You can opt out of personalised advertising in <a href="https://adssettings.google.com" rel="noopener">Google Ads Settings</a>, and opt out of third-party vendors’ use of cookies for personalised advertising at <a href="https://www.aboutads.info" rel="noopener">www.aboutads.info</a>. See <a href="https://policies.google.com/technologies/partner-sites" rel="noopener">how Google uses data from partner sites</a>. Visitors from the EEA, UK and Switzerland are asked for consent before advertising cookies are used.</p>
<h2>4. Contact</h2>
<p>For privacy questions, please use the <a href="contact.html">contact</a> page.</p>`],
  },
  terms: {
    ko: ['이용약관 · 면책', `최종 수정일: ${fmt(UPDATED)}. 사이트를 이용하면 아래 내용에 동의한 것으로 봅니다.`, `
<h2>정보의 성격</h2>
<p>사이트의 모든 정보는 공개 보도와 공개 데이터를 정리한 참고 자료입니다. 분쟁 상황은 빠르게 바뀌며, 사상자 수치에는 교전 당사자의 주장이 포함될 수 있습니다. 여행·안전·투자 등 중요한 판단에는 각국 정부와 국제기구의 공식 발표를 확인하세요.</p>
<h2>시뮬레이션</h2>
<p>지구본 위의 전차·병력·시위 군중 등은 분쟁 규모를 직관적으로 보여주기 위한 상징적 표현이며 실제 위치나 장면이 아닙니다.</p>
<h2>저작권과 출처</h2>
<p>위성사진·지도·데이터의 권리는 각 제공처(Esri, NASA, Natural Earth, 위키백과, GDELT 등)에 있습니다. 기사 링크는 원 출처로 연결되며 사이트는 기사 본문을 복제하지 않습니다.</p>
<h2>책임의 한계</h2>
<p>운영자는 정보의 정확성과 최신성을 위해 노력하지만 이를 보증하지 않으며, 정보 이용으로 생긴 손해에 책임지지 않습니다. 외부 사이트의 내용은 해당 사이트의 책임입니다.</p>`],
    en: ['Terms of use', `Last updated: ${UPDATED}. By using the site you agree to the following.`, `
<h2>Nature of the information</h2>
<p>Everything on the site is reference material compiled from public reporting and open data. Conflicts change quickly and casualty figures may include claims by the parties involved. For decisions about travel, safety or investment, rely on official statements from governments and international organisations.</p>
<h2>Simulations</h2>
<p>Tanks, troops and crowds on the globe are symbolic representations of scale, not real positions or scenes.</p>
<h2>Copyright and sources</h2>
<p>Rights to imagery, maps and data belong to their providers (Esri, NASA, Natural Earth, Wikipedia, GDELT and others). Article links point to the original sources; the site does not reproduce article text.</p>
<h2>Limitation of liability</h2>
<p>We work to keep information accurate and current but cannot guarantee it, and we are not liable for losses arising from its use. External sites are responsible for their own content.</p>`],
  },
  contact: {
    ko: ['문의', '오류 제보, 출처 추가 요청, 사이트 관련 문의를 받습니다.', `
<h2>문의 방법</h2>
<p>GitHub 저장소의 이슈 게시판에 글을 남겨 주세요. 확인 후 답변드립니다.</p>
<p><a class="cta" href="${ISSUES}" rel="noopener">GitHub 이슈로 문의하기</a></p>
<h2>오류를 제보할 때</h2>
<ul><li>해당 분쟁 이름이나 페이지 주소</li><li>잘못된 내용과 바른 내용</li><li>근거가 되는 기사나 공식 자료 링크</li></ul>`],
    en: ['Contact', 'We welcome error reports, source suggestions and questions about the site.', `
<h2>How to reach us</h2>
<p>Please open an issue on the GitHub repository and we will respond there.</p>
<p><a class="cta" href="${ISSUES}" rel="noopener">Contact us via GitHub Issues</a></p>
<h2>When reporting an error</h2>
<ul><li>The conflict name or page address</li><li>What is wrong and what is correct</li><li>A link to supporting reporting or an official source</li></ul>`],
  },
  };
};
