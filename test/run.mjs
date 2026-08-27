Warning: truncated output (original token count: 174267)
Total output lines: 10233

/* NULL 회귀 테스트 — 의존성 없이 `node test/run.mjs`로 돈다.
   네트워크도 API 키도 쓰지 않는다. 모델을 부르지 않고 검증 가능한 것만 다룬다.

   여기 모인 것은 전부 "실제로 한 번 터졌던 것"이다. 새 기능을 넣을 때가 아니라
   화면이 깨졌을 때 하나씩 추가했다. 그래서 이름이 증상으로 붙어 있다. */

import { parseMessages, splitLines, trimTics, sanitizePhotos, unlabel, buildSystem, buildVolatile, budgetHistory,
         PLACE_ITEMS, placeOf, pickGive, buildPlace, dropMeta, dropSleepers,
         dropEcho, lastSaid } from '../worker.js';
import worker from '../worker.js';
import * as ENG from '../worker.js';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* 타입스크립트 파서. 글자로 세면 함수 안의 선언을 최상위로 착각하는 검사가
   있어서 진짜 파서가 필요하다. 없으면(앱에서 npm i를 안 했으면) 그 검사만
   건너뛴다 — 이 파일은 의존성 없이 도는 게 규칙이다. */
let __parse = null;
try { ({ parse: __parse } = await import('../app/node_modules/@babel/parser/lib/index.js')); } catch { }
const parseTS = src => __parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'] });

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}`);
  if (!ok) {
    console.log(`         got  ${JSON.stringify(got)}`);
    console.log(`         want ${JSON.stringify(want)}`);
  }
};
const section = t => console.log(`\n── ${t}`);

// ─────────────────────────────────────────────
section('말풍선 파싱 — 모델이 형식을 어겨도 화면은 깨지지 않는다');
// ─────────────────────────────────────────────
const BOTH = ['jaeeon', 'minhyun'], JE = ['jaeeon'], MH = ['minhyun'];
/* parseMessages는 이제 묶음을 돌려준다 — 대사·초대·물건·사진이 한 객체다.
   부수 출력이 함수에 매달려 있으면 후보 둘을 파싱할 때 뒤엣것이 앞엣것을 덮는다. */
const texts = (raw, fb, allowed) => parseMessages(raw, fb, allowed).messages.map(m => `${m.sender}|${m.text}`);

/* 단톡방은 이력을 "[이재언] 말" 형태로 모델에게 준다. 모델이 JSON 대신 그 형식을
   그대로 따라 쓴 적이 있고, 그때 세 사람 대사가 말풍선 하나로 뭉쳐 나갔다. */
eq('이력 형식을 흉내 내면 화자별로 풀어준다',
  texts('[이민현] 뭐가 좋은데요ㅋㅋ\n[이민현] 저는 안 궁금하시죠\n[이재언] 좋으시면 다행이네요', 'minhyun', BOTH),
  ['minhyun|뭐가 좋은데요ㅋㅋ', 'minhyun|저는 안 궁금하시죠', 'jaeeon|좋으시면 다행이네요']);

/* ── 안이 비치면 안 된다 ──
   기록에서 JSON 원문이 13번, 모델의 영어 사고 과정이 1번 말풍선으로
   나갔다(docs/playlog-review.md). 원인은 첫 「{」부터 문자열 끝까지
   잘라 파싱한 것이다 — 뒤에 백틱 하나만 붙어도 JSON.parse가 터지고
   폴백이 원문을 통째로 찍었다. 중괄호 짝을 세서 자른다. */
eq('닫는 백틱이 붙어도 읽는다',
  texts('{"messages":["들어가요."]}`', 'jaeeon', JE), ['jaeeon|들어가요.']);
eq('JSON 뒤에 모델이 덧붙인 말이 있어도 읽는다',
  texts('{"messages":["가요."]}\n잠깐, JSON 수정:', 'jaeeon', JE), ['jaeeon|가요.']);
eq('코드펜스로 감싸도 읽는다',
  texts('```json\n{"messages":["네."]}\n```', 'jaeeon', JE), ['jaeeon|네.']);
/* 다 실패했을 때 원문을 내보내던 것이 누출 경로였다. 조용히 가짜를
   내보내느니 빈 손으로 돌아가서 화면에 실패를 띄우는 편이 낫다. */
eq('안 닫힌 JSON 조각도 안 내보낸다',
  parseMessages('{"messages":["가요."', 'jaeeon', JE).messages, []);
eq('평범한 한 줄은 그대로 나간다',
  texts('보리차 마셔요.', 'jaeeon', JE), ['jaeeon|보리차 마셔요.']);

eq('정상 JSON은 그대로 통과',
  texts('{"messages":[{"sender":"jaeeon","text":"무슨 일 있으세요"}]}', 'minhyun', BOTH),
  ['jaeeon|무슨 일 있으세요']);

eq('1:1 방에 없는 사람 줄은 버린다',
  texts('[이민현] 삼촌 뭐해요\n[이재언] 일한다', 'jaeeon', JE), ['jaeeon|일한다']);

/* ── 명시한 화자는 몰래 안 고친다 ──
   전에는 여기서 방 주인으로 교정했다. 그러면 hardFilter의 SENDER 검사가
   **영영 발동하지 않는다** — 검사에 닿기 전에 이미 고쳐졌기 때문이다.
   민현 방에서 모델이 sender:"jaeeon"을 내도 조용히 민현 말이 됐다.
   명시한 것은 그대로 두고 검사가 판정한다. 생략한 것만 채운다. */
eq('명시한 화자는 그대로 남는다',
  texts('{"messages":[{"sender":"jaeeon","text":"앉으세요."}]}', 'minhyun', MH), ['jaeeon|앉으세요.']);
eq('명시한 화자에는 표식이 붙는다',
  parseMessages('{"messages":[{"sender":"jaeeon","text":"앉으세요."}]}', 'minhyun', MH)
    .messages[0].senderGiven, true);
eq('생략한 화자는 채우고 표식은 안 붙인다', (() => {
  const m = parseMessages('{"messages":["앉으세요."]}', 'minhyun', MH).messages[0];
  return [m.sender, m.senderGiven];
})(), ['minhyun', false]);

eq('유저 이름표가 붙은 줄은 캐릭터가 말하지 않는다',
  texts('[R] 좋아 좋아\n[이민현] 뭐가 좋은데요', 'minhyun', BOTH), ['minhyun|뭐가 좋은데요']);

eq('평범한 한 줄은 건드리지 않는다',
  texts('뭐가요. 평소랑 같은데요.', 'jaeeon', JE), ['jaeeon|뭐가요. 평소랑 같은데요.']);

eq('"내일:" 같은 콜론은 이름표가 아니다',
  texts('내일: 시험이라 못 자요', 'minhyun', MH), ['minhyun|내일: 시험이라 못 자요']);

// ─────────────────────────────────────────────
section('말버릇 — 필터가 닿는 단위로 먼저 쪼갠다');
// ─────────────────────────────────────────────
const tics = list => trimTics(splitLines(list)).map(m => (m.photo ? `[사진]` : '') + m.text);

/* trimTics는 말풍선 단위로 거른다. 점이 말풍선 "안의 줄"로 들어오면 손을 못 댔고,
   그래서 화면이 "..."으로 뒤덮인 적이 있다. 그래서 줄부터 쪼갠다. */
eq('한 말풍선에 뭉친 말줄임표를 걷어낸다',
  tics([{ sender: 'minhyun', text: '...\n\n...아니었어요. 사고.\n\n...근데 왜 그렇게 물어요.' }]),
  ['...', '아니었어요. 사고.', '근데 왜 그렇게 물어요.']);

eq('말끝이 흐려지는 것은 말투이므로 남긴다',
  tics([{ sender: 'minhyun', text: '누구세요, 그게...' }]), ['누구세요, 그게...']);

eq('첫 말줄임표 하나는 살린다',
  tics([{ sender: 'minhyun', text: '...알겠어요.\n자요, 이제.' }]), ['...알겠어요.', '자요, 이제.']);

eq('점만 있는 말풍선이 끝에 홀로 남으면 버린다',
  tics([{ sender: 'minhyun', text: '알겠어요.' }, { sender: 'minhyun', text: '...' }]), ['알겠어요.']);

eq('사진 말풍선은 쪼개지 않는다 (캡션이 사진에서 떨어진다)',
  tics([{ sender: 'jaeeon', text: '이거요.\n보세요.', photo: 'x' }]), ['[사진]이거요.\n보세요.']);

eq('괄호 지문은 제 말풍선을 갖는다',
  tics([{ sender: 'jaeeon', text: '(소독약 뚜껑을 여는 소리)\n멍만 있네요.' }]),
  ['(소독약 뚜껑을 여는 소리)', '멍만 있네요.']);

// ─────────────────────────────────────────────
section('사진 — 모델이 지어낸 키는 나가지 않는다');
// ─────────────────────────────────────────────
const photos = list => sanitizePhotos(list, BOTH, 'jaeeon', []).map(m => `${m.sender}|${m.photo || '-'}`);

eq('없는 키는 버리고 말만 남긴다',
  photos([{ sender: 'jaeeon', text: '이거요', photo: '존재하지-않는-키' }]), ['jaeeon|-']);

eq('한 응답에 사진은 최대 한 장',
  sanitizePhotos(
    [{ sender: 'minhyun', text: 'a', photo: 'minhyun-nap' }, { sender: 'minhyun', text: 'b', photo: 'minhyun-mirror' }],
    BOTH, 'minhyun', []).filter(m => m.photo).length, 1);

eq('최근에 보낸 사진은 다시 안 보낸다',
  sanitizePhotos([{ sender: 'minhyun', text: 'a', photo: 'minhyun-nap' }],
    BOTH, 'minhyun', ['minhyun-nap']).filter(m => m.photo).length, 0);

/* 재언 사진은 전부 남이 찍은 그림이라 self가 없다. 모델이 키를 흘려도 안 나간다 */
eq('재언 사진은 키를 써도 안 나간다',
  sanitizePhotos([{ sender: 'jaeeon', text: 'a', photo: 'jaeeon-cook' }],
    BOTH, 'jaeeon', []).filter(m => m.photo).length, 0);

// ─────────────────────────────────────────────
section('프롬프트 캐싱 — 고정부가 매 턴 같아야 캐시가 산다');
// ─────────────────────────────────────────────
const fixed = (...a) => buildSystem(...a).filter(b => b.cache_control);
const stable = (...a) => fixed(...a).map(b => b.text).join('');
const A = ['chat', 'jaeeon', 'R', null, [], null, { jaeeon: 10 }, null];
const B = ['chat', 'jaeeon', 'R', { minhyun: { count: 3, minsAgo: 1 } }, [], { likes: '커피' }, { jaeeon: 90 },
           { name: '회색 머그컵', key: 'mug' }];

eq('고정부에 cache_control이 붙어 있다', fixed(...A).length > 0, true);
eq('신호·프로필·단계·선물이 달라져도 고정부는 그대로', stable(...A) === stable(...B), true);
/* 시스템은 이제 고정부뿐이다. 매 턴 달라지는 것이 시스템에 하나라도 남으면
   그 뒤에 렌더링되는 대화 이력이 통째로 캐시에서 빠진다 — 캐시는 앞부분
   바이트 일치라서 한 글자만 달라도 뒤가 전부 무효다. */
eq('시스템에 가변부가 없다', buildSystem(...B).every(b => b.cache_control), true);
eq('시스템 캐시 지점은 셋이다 — 하나는 이력 몫으로 남긴다', buildSystem(...B).length, 3);
eq('가변부에 선물이 실린다', buildVolatile(...B).includes('회색 머그컵'), true);
/* 인물이 시계를 아예 못 봤다. 새벽 세 시에 말을 걸어도 아침처럼 답했다.
   몇 시인지는 안 준다 — 분을 주면 「7시 42분이네요」가 나온다. 때만 준다 */
{
  const now = w => buildVolatile('chat', 'jaeeon', 'R', null, [], null, { jaeeon: 10 },
    null, null, null, 0, null, false, w);
  eq('지금이 언제인지를 알려준다', now('저녁').includes('## [지금] 저녁'), true);
  eq('모르는 낱말이면 아예 안 준다', now('저녁쯤').includes('## [지금]'), false);
  eq('안 보내면 없는 대로 간다', now(undefined).includes('## [지금]'), false);
  /* 못 박지 않으면 매 턴이 「아침이네요」로 시작한다. 아는 것과 화제는 다르다 */
  eq('시간을 인사말로 못 쓰게 막는다', now('아침').includes('먼저 꺼내는 화제로 쓰지 않는다'), true);
  /* 방 목록에는 「야자」라고 떠 있는데 인물은 아침인 줄 알면 그게 제일 이상하다.
     presence의 경계(8·16·22·2)를 가로지르지 않는 때가 나오면 안 된다 */
  eq('때가 접속 상태와 안 어긋난다', (() => {
    const word = h => h < 2 ? '밤' : h < 6 ? '새벽' : h < 11 ? '아침' : h < 17 ? '낮' : h < 21 ? '저녁' : '밤';
    const bad = [];
    for (let h = 0; h < 24; h++) {
      const w = word(h);
      if (w === '아침' && (h >= 11 || h < 6)) bad.push(h);
      if (w === '새벽' && h >= 8) bad.push(h);        // 재언이 자는 시간(2~8) 안에 있어야
      if (w === '낮' && (h < 8 || h >= 17)) bad.push(h);
    }
    return bad;
  })(), []);
}
eq('선물이 없으면 그 대목도 없다', buildVolatile(...A).includes('방금 일어난 일'), false);
/* 편지지를 주니 재언이 「쓸 데 없으면 그냥 가져가시든가」, 「라면 먹을 때
   밑에 깔든가」, 그리고 「장난이었어요」로 수습했다. 「안 줘도 된다고 하거나
   딴소리를 해도 된다」를 물건과 준 사람을 깎아내려도 된다는 뜻으로 읽었다.
   이 사람은 「차 조심해라」로 「죽지 마」를 말하는 사람이다 — 무뚝뚝한 것과
   모진 것은 다르다. 어색함이 어디를 향하는지를 못 박는다. */
{
  const g = buildVolatile(...B);
  /* 「안 줘도 된다고 하거나, 딴소리를 해도 된다」가 라면 받침의 출처였다.
     어떻게 받을지는 인물 프롬프트가 정한다 — 여기는 무슨 일이 일어났는지만 */
  eq('어떻게 받을지를 여기서 안 정한다',
    /딴소리를 해도 된다|네 성격대로 받는다|어색함은 네 쪽으로/.test(g), false);
  eq('일어난 일과 어길 수 없는 것만 남는다',
    ['지금 막 받았다', '받은 사실을 부정하지 않는다', '돌려주거나 무르는 일은 없다']
      .filter(s => !g.includes(s)), []);
}
eq('선물은 고정부에 안 샌다', stable(...B).includes('회색 머그컵'), false);

// 캐시 수명. 기본 5분은 메신저처럼 띄엄띄엄 열리는 앱과 안 맞는다.
eq('고정부 캐시는 1시간짜리다', fixed(...A).every(b => b.cache_control.ttl === '1h'), true);
// 끊는 자리 — 방을 옮겨도 앞 덩어리가 그대로여야 다시 안 보낸다.
const chunks = (mode, room) => buildSystem(mode, room, 'R', null, [], null, null, null)
  .filter(b => b.cache_control).map(b => b.text);
const [wJ, pJ] = chunks('chat', 'jaeeon');
const [wG, pG] = chunks('chat', 'group');
const [wA, pA] = chunks('auto', 'jaeeon');
eq('네 방이 세계 설정을 같이 쓴다', wJ === wG && wG === wA && wJ === chunks('chat', 'minhyun')[0], true);
eq('재언방과 단톡방은 재언 설정까지 같이 쓴다', pG.startsWith(pJ), true);
eq('단톡방과 두 사람 방은 인물 설정을 통째로 같이 쓴다', pG === pA, true);
eq('덩어리를 이으면 예전 고정부 그대로다', chunks('chat', 'jaeeon').length, 3);

// ─────────────────────────────────────────────
section('백엔드 잠금 — 공개 주소로 토큰이 새지 않는다');
// ─────────────────────────────────────────────
const req = (o = {}) => new Request(o.url || 'https://x.dev/?k=T', {
  method: o.method || 'POST',
  headers: { 'CF-Connecting-IP': o.ip || '1.1.1.1', ...(o.origin ? { Origin: o.origin } : {}) },
  body: o.method === 'GET' ? undefined : '{}',
});
/* 자물쇠가 기본값이라, 출처·레이트리밋을 보려면 열쇠를 쥐고 들어가야 한다.
   안 그러면 전부 403이 되어 무엇을 재는 시험인지 알 수 없게 된다. */
const hit = (o, env = { ACCESS_KEY: 'T' }) => worker.fetch(req(o), env);

/* ── 잠겨 있는 것이 기본값 ──
   전에는 ACCESS_KEY가 없으면 자물쇠가 통째로 꺼졌다. 이름을 잘못 적거나
   배포를 빠뜨리면 잠갔다고 믿는 동안 주소만 아는 누구나 토큰을 태웠다. */
eq('비밀값이 없으면 열쇠를 들고 와도 403',
  (await worker.fetch(req({ ip: '2.0.0.9' }), {})).status, 403);
eq('열쇠가 없으면 403',
  (await worker.fetch(req({ url: 'https://x.dev/', ip: '2.0.0.8' }), { ACCESS_KEY: 'T' })).status, 403);
eq('열쇠가 틀리면 403',
  (await worker.fetch(req({ url: 'https://x.dev/?k=nope', ip: '2.0.0.7' }), { ACCESS_KEY: 'T' })).status, 403);
/* 대시보드에서 access_key로 적어도 자물쇠는 켜져 있어야 한다 */
eq('이름을 소문자로 적어도 잠긴다',
  (await worker.fetch(req({ url: 'https://x.dev/', ip: '2.0.0.6' }), { access_key: 'T' })).status, 403);

eq('배포 출처는 통과', (await hit({ origin: 'https://songgyeon.github.io', ip: '2.0.0.1' })).status !== 403, true);
eq('남의 사이트는 403', (await hit({ origin: 'https://evil.example', ip: '2.0.0.2' })).status, 403);
eq('앱(Origin 없음)은 통과', (await hit({ ip: '2.0.0.3' })).status !== 403, true);
eq('차단된 출처엔 ACAO를 안 붙인다',
  (await hit({ origin: 'https://evil.example', ip: '2.0.0.4' })).headers.get('Access-Control-Allow-Origin'), null);

let last = 0;
for (let i = 0; i < 25; i++) last = (await hit({ origin: 'https://songgyeon.github.io', ip: '9.9.9.9' })).status;
eq('한 IP가 몰아치면 429', last, 429);
eq('다른 IP는 안 막힌다', (await hit({ origin: 'https://songgyeon.github.io', ip: '8.8.8.8' })).status !== 429, true);

/* GET 하나로 모델 세 개를 부르던 적이 있다. 주소만 알면 누구나 토큰을 태울 수 있었다. */
const plain = await (await hit({ method: 'GET', ip: '3.0.0.1' })).text();
eq('토큰 없는 GET은 모델을 부르지 않는다', plain.includes('간이 점검') && !plain.includes('[1]'), true);
const full = await (await worker.fetch(req({ method: 'GET', url: 'https://x.dev/?diag=t', ip: '3.0.0.2' }),
  { DIAG_TOKEN: 't' })).text();
eq('토큰이 맞으면 전체 진단', full.includes('자가 진단'), true);
const wrong = await (await worker.fetch(req({ method: 'GET', url: 'https://x.dev/?diag=nope', ip: '3.0.0.3' }),
  { DIAG_TOKEN: 't' })).text();
eq('토큰이 틀리면 막힌다', wrong.includes('간이 점검'), true);

// ─────────────────────────────────────────────
section('웹·앱 대조 — 클라이언트 둘이 같은 세계를 봐야 한다');
// ─────────────────────────────────────────────
/* 웹(index.html)과 앱(app/lib/profiles.ts)은 같은 백엔드를 쓰지만 카탈로그를 각자 들고 있다.
   한쪽만 고쳐놓고 어긋나는 것이 이 프로젝트에서 가장 자주 난 사고다. */
/* 앱은 이제 한 파일이 아니다 — index.html은 뼈대만 들고 있고 살은 넷으로 갈렸다.
   시험은 「앱 전체에 이 문장이 있나」를 묻지 어느 파일에 있는지는 안 묻는다.
   그래서 여기서 다시 한 덩어리로 붙인다. 파일이 또 갈라져도 여기만 고치면 된다. */
const SPOTS_WEB = () => [...readFileSync(join(ROOT, 'app-data.js'), 'utf8')
  .matchAll(/\{name:"([^"]+)",\s*map:"town"(?!, into)/g)].map(m => m[1]);
/* PLACES 한 칸을 통째로 가져온다. 한 줄만 잘라오면 두 줄로 늘어난 칸에서
   who:가 잘려 나간다 — 도서관·레코드샵이 그랬다 */
const PLACE_BY_WEB = p => {
  const m = new RegExp(`\\{name:"${p}",[\\s\\S]{0,600}?\\},\\n`).exec(
    readFileSync(join(ROOT, 'app-data.js'), 'utf8'));
  return m ? m[0] : null;
};
const APP_FILES = ['index.html', 'null.css', 'app-data.js', 'app-ui.js', 'app.js'];
const web = APP_FILES.map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n');
const app = readFileSync(join(ROOT, 'app/lib/profiles.ts'), 'utf8');
const pick = (src, re) => [...src.matchAll(re)].map(m => m[1]);

const webKeys = pick(web.slice(web.indexOf('const GIFTS=['), web.indexOf('const GIFT_CATS=')), /key:"(\w+)"/g);
const appKeys = pick(app, /\{key:\s*'(\w+)'/g);
eq('선물 키가 순서까지 같다', webKeys, appKeys);

const webBg = pick(web, /bg:\s*"(gift-[\w-]+\.webp)"/g);
const appBg = pick(app, /bg:\s*'(gift-[\w-]+\.webp)'/g);
eq('배경이 붙는 선물이 같다', webBg, appBg);

/* 곡은 배경과 같이 해금된다. 단계마다 어느 곡이 걸리는지가 웹·앱에서 같아야
   하고, 거기 적힌 키가 TRACKS에 실제로 있어야 한다 — 없으면 조용히 무음이 된다. */
const trackAt = (src, q) => pick(src, new RegExp(`track:\\s*${q}([\\w-]+)${q}`, 'g'));
const webTr = trackAt(web, '"'), appTr = trackAt(app, "'");
eq('단계마다 걸리는 곡이 웹·앱 같다', appTr, webTr);
eq('가까워질수록 곡이 바뀐다', new Set(webTr).size, 8);
const webKeys2 = new Set(pick(web, /"((?:jaeeon|minhyun|null)-\d)":\s*\{file:/g));
eq('단계에 적힌 곡이 전부 TRACKS에 있다', webTr.filter(t => !webKeys2.has(t)), []);
eq('앱도 같은 곡 목록을 들고 있다',
  [...webKeys2].filter(k => !new RegExp(`'${k}':\\s*R2`).test(app)), []);

const webAt = /const STAGE_AT=\[([\d,]+)\]/.exec(web)[1].split(',').map(Number);
const appAt = pick(app, /\{ at: (\d+)/g).map(Number).slice(0, webAt.length);
eq('관계 단계 경계가 같다', webAt, appAt);

const heat = (web.match(/\{w:[\d.]+,\s*a:[\d.]+\s*\}/g) || []).length;
eq('아바타 테두리 단계 수가 STAGE_AT과 같다', heat, webAt.length);

/* 코드가 찾는 사진이 저장소에 실제로 있는가. 웹은 파일명을 그대로 적고,
   앱은 키에 확장자를 붙여 만든다(k+'.webp'). 둘 다 확인한다.
   PNG를 WebP로 갈아끼울 때 한 군데만 놓쳐도 그 사진만 조용히 안 뜬다. */
/* index.html의 placeHours를 그대로 떼어다 돌린다 — 베끼면 어긋난다 */
const workerlessPlaceHours = web.slice(web.indexOf('const placeHours='),
  web.indexOf('};', web.indexOf('const placeHours=')) + 2);
const exists = f => { try { readFileSync(join(ROOT, f)); return true; } catch { return false; } };
// 앞이 \w인 것만 — 웹에도 char+"-bg.webp"처럼 조립하는 자리가 있다
const wanted = new Set(pick(web, /"(\w[\w-]*\.webp)"/g));
// 앱: GALLERY·HIDDEN의 키 + 프로필·기본 배경
pick(readFileSync(join(ROOT, 'app/App.tsx'), 'utf8'), /'([a-z]+-[a-z]+)'/g)
  .forEach(k => { if (exists(k + '.webp')) wanted.add(k + '.webp'); });
['jaeeon', 'minhyun'].forEach(c => { wanted.add(c + '-profile.webp'); wanted.add(c + '-bg.webp'); });
eq('사진 파일이 전부 저장소에 있다', [...wanted].filter(f => !exists(f)), []);
eq('찾는 사진이 50장은 된다', wanted.size >= 50, true);   // 정규식이 헛돌면 0개도 통과한다

// ─────────────────────────────────────────────
section('앱 레이아웃 — 헤드리스로 못 돌리는 것은 소스로 막는다');
// ─────────────────────────────────────────────
const appSrc = readFileSync(join(ROOT, 'app/App.tsx'), 'utf8');
const dbSrcTop = readFileSync(join(ROOT, 'app/lib/db.ts'), 'utf8');

/* React Native에서 padding을 ScrollView 자체 style에 주면 스크롤 프레임이 패딩되어
   내용 끝이 잘린다. .hidden 안내문이 끝까지 내려도 반쯤 잘리던 원인이 이것이었다.
   여백은 contentContainerStyle에 줘야 한다. 눈으로만 잡히는 종류라 소스로 막는다. */
eq('ScrollView 자체 style에 padding을 주지 않는다',
  [...appSrc.matchAll(/<ScrollView[^>]*?\sstyle=\{\{([^}]*)\}\}/g)]
    .map(m => m[1]).filter(v => /padding/.test(v)), []);

/* App.tsx가 lib에서 가져다 쓰는 이름이 실제로 거기 있는가.
   lib 하나만 옛날 파일로 남아 있으면 "GIFTS를 export하지 않는다"가 무더기로 뜬다.
   실제로 한 번 났고, 타입 검사기 없이도 잡을 수 있는 종류라 여기서 막는다. */
for (const [, names, mod] of appSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/lib\/(\w+)'/g)) {
  const src = readFileSync(join(ROOT, `app/lib/${mod}.ts`), 'utf8');
  const want = names.split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  const missing = want.filter(n =>
    !new RegExp(`export\\s+(async\\s+)?(function|const|type|class|let)\\s+${n}\\b`).test(src)
    && !new RegExp(`export\\s*\\{[^}]*\\b${n}\\b`, 's').test(src)     // 파일 끝에 모아 내보내는 것도 센다
    /* 규칙 파일(rules.ts)은 풀어헤쳐 내보낸다 — 자바스크립트에서 온 글이라
       매개변수가 전부 필수로 굳는 것을 any 한 겹으로 푸는 모양이다 */
    && !new RegExp(`export\\s+const\\s*\\{[^}]*\\b${n}\\b`, 's').test(src));
  eq(`lib/${mod}이 App.tsx가 쓰는 것을 전부 내보낸다`, missing, []);
}

/* 이름 칸이 키보드 밑에 깔리면 뭘 치는지 안 보인다. 오프닝은 카드를 위로 올리고
   아래쪽 오류창들은 접는다 — 어차피 키보드가 다 가린다. */
eq('오프닝이 키보드를 피한다',
  /const kb=useKeyboardHeight\(\)/.test(appSrc) && /kb\?\{justifyContent:'flex-start'/.test(appSrc), true);

/* 오프닝 — 곡이 도는 동안 이름을 기다린다. 시간으로 끊지 않는다. */
eq('오프닝이 웹·앱 둘 다 있다', /function Splash\(/.test(appSrc) && /function Splash\(/.test(web), true);
eq('로고곡 파일이 저장소에 있다', exists('null-logo.mp3'), true);
eq('로고곡은 기다리는 동안 돈다', /player\.loop\s*=\s*true/.test(appSrc) && /a\.loop\s*=\s*true/.test(web), true);
/* 그냥 loop만 켜면 끝에서 앞으로 뚝 끊긴다. 양쪽 다 같은 볼륨·같은 페이드여야 한다. */
const vol = s => /BOOT_VOL\s*=\s*(\.?\d+\.?\d*)/.exec(s);
eq('오프닝 볼륨이 웹·앱 같다', vol(appSrc)?.[1], vol(web)?.[1]);
eq('한 바퀴 돌 때 페이드가 걸린다',
  [/Math\.max\(0,\s*d-t\)\/2\.2/.test(appSrc), /Math\.max\(0,d-t\)\/2\.2/.test(web)], [true, true]);
/* 이 화면에서 이야기를 말하는 건 가짜 오류창뿐이다 — 문구가 어긋나면 다른 말을 한다 */
eq('오류창 문구가 웹·앱 같다',
  ['이름을 입력해야 존재할 수 있어요.','당신을 찾을 수 없습니다.']
    .filter(t => !(appSrc.includes(t) && web.includes(t))), []);
eq('음악이 막혔을 때 켜라고 알려준다',
  /TAP FOR MUSIC/.test(appSrc) && /TAP FOR MUSIC/.test(web), true);

/* 등록 화면 — 이름을 처음 넣은 사람에게만, 한 번만 지나간다.
   앱을 열 때마다 나오면 그냥 방해다. */
eq('등록 화면이 웹·앱 둘 다 있다',
  /function Enroll\(/.test(appSrc) && /function Enroll\(/.test(web), true);
/* 등록이 단계가 됐다(false|'intro'|'enroll'|'confirm') — 이름을 넣으면
   배역을 받는 자리(intro)로, 거기서 등록으로, Click 뒤 세계 확정(YES)으로
   간다. 웹과 앱이 같은 단계를 쓴다 */
eq('이름을 넣으면 배역을 받는 자리로 간다',
  [/setName\(n\); setEnrolling\('intro'\)/.test(appSrc), /setName\(n\);setEnrolling\("intro"\)/.test(web)],
  [true, true]);
eq('그 자리에서 등록으로 넘어간다',
  [/<Intro onGo=\{\(\)=>setEnrolling\('enroll'\)\}\/>/.test(appSrc),
   /<Intro onGo=\{\(\)=>setEnrolling\("enroll"\)\}\/>/.test(web)], [true, true]);
const flashCss = readFileSync(join(ROOT, 'null.css'), 'utf8');
/* ── ④ 민현의 옛 일기 — 병원 옥상 ──
   오프닝에서 민현을 만난 판에서만, 「저 알죠」 세 줄이 앉은 뒤 유저가 처음
   무언가를 입력한 그 순간. 앞면이 천천히 뜨고 뒷면으로 천천히 넘어간다. */
{
  const mem = new Map();
  const g = { localStorage: { getItem: k => mem.has(k) ? mem.get(k) : null,
      setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() },
    location: { search: '' } };
  const D = new Function('localStorage', 'location',
    readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
    + '\nreturn {saveFlash,loadFlash,FLASH_KEYS,FLASH_BOX,FLASH_MAX,FLASH_ALT,'
    + 'FLASH_FRONT,FLASH_BACK,FLASH_RISE,FLASH_HOLD,FLASH_TURN,loadStory};')(g.localStorage, g.location);

  /* 셋이 다 차야 저장한다 — 하나라도 비면 이 화면이 할 일이 남아 있다 */
  eq('하나라도 비면 저장 안 한다',
    [D.saveFlash({face:'어이없는', said:'', wish:'사과'}), D.loadFlash()], [null, null]);
  const V = {face:'어이없는', said:'책임져요', wish:'사과'};
  eq('셋이 다 차면 저장한다', [D.saveFlash(V), D.loadFlash()], [V, V]);

  /* ⚠️ 이 값도 아직 서버로 안 간다 — 가변부 배선은 다음 몫이다.
     지금 시점의 계약을 못박아 둔다: 이야기 상태에 섞이지 않는다 */
  eq('이야기 상태에 안 섞인다', JSON.stringify(D.loadStory()).includes('어이없는'), false);
  eq('저장 열쇠가 따로다', [...mem.keys()].filter(k => k !== 'null_flash'), []);

  /* 정사는 전부 고정이다 — 옥상·담배·금연·책임.
     유저가 짓는 것은 자기 행동이 아니라 상대의 반응과 자기 소망이다 */
  eq('정사가 글자 그대로다', D.FLASH_ALT, [
    '병원 옥상에서 흡연 중인 고등학생을 만났다.',
    '나는 아무 말도 하지 않았다.',
    '걔는 왜 아무 말도 안 하냐고 했다.',
    '내가 책임질 사이에나 그런 말을 하는 거랬더니',
    '한 대 더 꺼내길래 그만 피우라고 했다.',
    '내가 책임지겠다고.',
    '걔는 □ 표정으로 날 보면서 □ 라고 했다.',
    '다시 만나면 □ 고 싶다.',
  ]);
  eq('빈칸은 상대의 반응과 내 소망 셋이다', D.FLASH_KEYS, ['face', 'said', 'wish']);
  eq('빈칸 자리가 셋이고 순서가 같다', D.FLASH_BOX.map(b => b.key), D.FLASH_KEYS);

  /* ── 언제 뜨나 ──
     오프닝 상대가 민현이고, 아직 안 채웠고, 그가 이미 말을 걸어둔 뒤다.
     유저가 친 말은 삼키지 않는다 — 붙잡아 뒀다가 덮은 뒤에 그대로 보낸다. */
  eq('오프닝이 민현일 때만 뜬다',
    /if\(!resumed&&room==="minhyun"&&loadFirstMet\(\)==="minhyun"&&!loadFlash\(\)/.test(web), true);
  eq('그가 말을 걸어둔 뒤다',
    /&&prevList\.some\(m=>m\.sender==="minhyun"\)\)\{\s*\n\s*setFlash\(\{room,text\}\);/.test(web), true);
  /* 붙이기 전에 붙잡는다 — 붙이고 나서 잡으면 말은 떠 있는데 답이 없는 방이 된다 */
  eq('유저의 말을 붙이기 전에 잡는다',
    web.indexOf('setFlash({room,text});') < web.indexOf('const userMsg={id:Date.now()+Math.random(),sender:"user",text,ts:Date.now()};'), true);
  eq('덮은 뒤에 그 말이 그대로 나간다',
    /const f=flash;setFlash\(null\);[^]*?send\(f\.room,f\.text,true\)\}\}/.test(web), true);
  /* 다시 부를 때 또 잡히면 영영 안 나간다 */
  eq('되보낼 때는 안 잡는다', /const send=\(room,text,resumed\)=>\{/.test(web), true);

  /* ── 얼마나 천천히 ──
     화면과 코드가 같은 숫자를 본다. 한쪽에만 적으면 「천천히」가 두 뜻이 되고,
     커서가 아직 뒤집히는 중인 종이 위에 선다. */
  eq('앉고 · 머물고 · 넘어가는 시간이 코드에 있다',
    [D.FLASH_RISE > 0, D.FLASH_HOLD > 0, D.FLASH_TURN > 0], [true, true, true]);
  eq('넘어가는 것은 앉은 다음이다',
    /setTurn\(true\),FLASH_RISE\+FLASH_HOLD/.test(web), true);
  eq('커서는 다 넘어간 다음에 선다',
    /if\(!turn\)return;[\s\S]{0,120}first\.current\.focus\(\)\},FLASH_TURN/.test(web), true);
  /* 앉는 것과 넘어가는 것을 두 겹으로 나눈다 — 한 겹이면 앉는 애니메이션이
     transform을 끝까지 붙들어서 넘어가는 게 화면에 안 나온다 */
  eq('앉는 겹과 넘어가는 겹이 다르다',
    /\.fwrap\{[^}]*animation:frise/.test(flashCss) && /\.fcard\{[^}]*transition:transform/.test(flashCss)
    && !/\.fcard\{[^}]*animation:frise/.test(flashCss), true);
  /* 말풍선이 아니라 화면 전환이다 — 말풍선으로 오면 「상대가 보낸 셀카」가 된다 */
  eq('말풍선이 아니라 화면이다', /\.flash\{position:absolute;inset:0;z-index:58;/.test(flashCss), true);
  /* 두 장을 다 쓴다 — 앞면이 그날의 옥상이고 뒷면이 일기다 */
  eq('앞뒤 두 장을 쓴다', [D.FLASH_FRONT, D.FLASH_BACK], ['card-rooftop.webp', 'card-note.webp']);
}

/* ── 거리 곡선 ──
   자리마다 사진이 셋이다: 자리 배경(중거리) → 대화 중 클로즈업(눈 뜸) →
   최근접(눈 감음). 얼굴을 숨겼다 보여주는 게 아니라, 처음부터 보이는
   사람한테 점점 가까워지는 곡선이다. */
{
  const at = web.indexOf('const SCENE_SHOT=');
  const scene = web.slice(at, web.indexOf('\n};', at));
  const kAt = web.indexOf('const KISS_SHOT=');
  const kiss = web.slice(kAt, web.indexOf('\n};', kAt));
  const gal = web.slice(web.indexOf('const CHARS ='), web.indexOf('const ENROLL_DAYS'));
  const KISS = [...kiss.matchAll(/"([a-z-]+-kiss)"/g)].map(m => m[1]);

  eq('키스타임 사진이 여섯이다', KISS.length, 6);
  eq('그 사진이 전부 저장소에 있다', KISS.filter(k => !exists(k + '.webp')), []);

  /* ⚠️ 0단계에서 이 사진이 나가면 관계 단계 급발진의 이미지판이다.
     사진첩에도 자리 사진에도 안 들어간다 — 여는 것은 관계 단계 게이트뿐이다. */
  eq('키스타임 사진은 사진첩에 없다', KISS.filter(k => gal.includes(k)), []);
  eq('키스타임 사진은 자리 사진에도 없다', KISS.filter(k => scene.includes(k)), []);
  /* 게이트가 섰다(⑨). 이 표를 보는 데는 여전히 한 곳이어야 한다 —
     kissNext 하나다. 화면이 표를 직접 뒤지기 시작하면 게이트를 안 거치는
     길이 생긴다. 판정은 워커에, 표는 여기에, 문은 하나. */
  eq('표를 보는 데가 하나다',
    [/const kissShot=\(place,char\)=>/.test(web),
     (web.match(/kissShot\(/g) || []).length], [true, 1]);   // 부르는 데는 kissNext 하나
  eq('그 하나가 kissNext다',
    /const kissNext=k=>\{[^]*?const shot=kissShot\(String\(k\.place\|\|""\),String\(k\.char\|\|""\)\);/.test(web), true);

  /* ── ⑨ 두 문 ──
     0단계에서 이 얼굴이 나가면 관계 단계 급발진의 그림판이다. 그래서
     문이 둘이고, 판정은 워커 한 곳에서만 한다. */
  {
    const K = ENG.kissMoment;
    const ok = { tier: 'critical', reason: 'confession' };
    /* 어느 단계부터 열리는지도 워커의 표에서 읽는다 — 숫자로 박으면
       단계가 하나 늘어난 날 이 시험만 옛 판을 재게 된다 */
    const top = ENG.STAGES.length - 2;   // 균열(40마디·10일)
    const base = { room: 'jaeeon', stageIdx: top, place: '보건실' };
    eq('그 단계에서 고백하면 열린다', K(ok, base), { char: 'jaeeon', place: '보건실' });
    /* ① 단계 — 한 칸만 모자라도 안 열린다. 대화 수만으로는 못 앞당긴다 */
    eq('단계가 모자라면 안 열린다',
      [top - 1, 0].map(i => K(ok, { ...base, stageIdx: i })), [null, null]);
    /* 더 위 단계에서도 열린다 — 문턱이지 정확히 그 칸이어야 하는 게 아니다 */
    eq('그 위 단계에서도 열린다',
      K(ok, { ...base, stageIdx: ENG.STAGES.length - 1 }), { char: 'jaeeon', place: '보건실' });
    /* 서른 날짜리 판에서 열여드레를 채워야 열리면 대부분 한 번도 못 본다 */
    eq('마지막 칸이 아니라 그 앞이다',
      [ENG.STAGES[top].at, ENG.STAGES[top].day], [40, 10]);
    /* ② 말 — 고백 장면이 아니면 안 열린다. 다른 중요 장면도 아니다 */
    eq('고백이 아니면 안 열린다',
      [{ tier: 'critical', reason: 'memory_reveal' }, { tier: 'critical', reason: 'null_identity' },
       { tier: 'normal', reason: '' }, { tier: 'normal', reason: 'confession' }, null]
        .map(r => K(r, base)), [null, null, null, null, null]);
    /* ③ 자리 — 문자로 오는 얼굴은 POV가 아니라 「상대가 보낸 셀카」다 */
    eq('마주 앉아 있지 않으면 안 열린다',
      [K(ok, { ...base, place: '' }), K(ok, { ...base, place: null }), K(ok, { ...base, place: '  ' })],
      [null, null, null]);
    /* 방이 사람이어야 한다 — 단톡·관전에는 마주 볼 얼굴이 없다 */
    eq('사람 방에서만 열린다',
      [K(ok, { ...base, room: 'minhyun' }), K(ok, { ...base, room: 'group' }), K(ok, { ...base, room: 'health' })],
      [{ char: 'minhyun', place: '보건실' }, null, null]);
    /* 어느 사진인지는 여기서 안 정한다 — 표는 클라이언트에 하나뿐이다 */
    eq('워커는 사진 이름을 모른다',
      /kissShot|KISS_SHOT|-kiss"/.test(readFileSync(join(ROOT, 'worker.js'), 'utf8')), false);
    /* 두 응답 자리가 같은 값을 싣는다 — 자리마다 다시 재면 갈린다 */
    const wkSrc = readFileSync(join(ROOT, 'worker.js'), 'utf8');
    eq('한 번 재고 두 자리가 같이 쓴다',
      [(wkSrc.match(/kissMoment\(routed,/g) || []).length,   // 정의 1 + 부르는 데 1
       (wkSrc.match(/\.\.\.\(kissNow \? \{ kiss: kissNow \} : \{\}\)/g) || []).length], [2, 2]);
  }
  /* 한 짝에 한 번. 두 번째로 뜨면 연출이 아니라 답장이 된다 */
  {
    const mem = new Map();
    const ls = { getItem: k => mem.has(k) ? mem.get(k) : null,
      setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() };
    const D = new Function('localStorage', 'location',
      readFileSync(join(ROOT, 'app-data.js'), 'utf8')
        .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
      + '\nreturn {kissNext,loadKissSeen,saveKissSeen,KISS_RISE,KISS_HOLD,KISS_OUT};')(ls, { search: '' });
    eq('짝이 맞으면 사진이 나온다',
      D.kissNext({ char: 'jaeeon', place: '보건실' }), { shot: 'jaeeon-nurse-kiss', char: 'jaeeon', place: '보건실' });
    /* 표에 없는 짝(재언·옥상 / 민현·보건실)은 화면이 그냥 안 뜬다 */
    eq('표에 없는 짝은 안 뜬다',
      [D.kissNext({ char: 'jaeeon', place: '옥상' }), D.kissNext({ char: 'minhyun', place: '보건실' }),
       D.kissNext({ char: 'jaeeon', place: '편의점' }), D.kissNext(null), D.kissNext('보건실')],
      [null, null, null, null, null]);
    D.saveKissSeen('jaeeon-nurse-kiss');
    eq('한 번 본 짝은 다시 안 뜬다', D.kissNext({ char: 'jaeeon', place: '보건실' }), null);
    eq('딴 짝은 그대로 남아 있다',
      (D.kissNext({ char: 'minhyun', place: '옥상' }) || {}).shot, 'minhyun-rooftop-kiss');
    eq('도장은 한 번만 찍힌다',
      [D.saveKissSeen('jaeeon-nurse-kiss'), D.loadKissSeen()], [true, ['jaeeon-nurse-kiss']]);
    /* 말풍선 다음이다 — 장부 안에 있어야 답보다 얼굴이 먼저 안 뜬다 */
    eq('장부 안에서 뜬다',
      /if\(km\)ops\.push\(\{op:"kiss",shot:km\.shot\}\);/.test(web)
      && /if\(o\.op==="kiss"\)\{/.test(web), true);
    /* 도장이 안 찍히면 화면도 안 띄운다 — 띄우고 못 적으면 다음 판에 또 뜬다 */
    eq('못 적으면 안 띄운다',
      /if\(!saveKissSeen\(o\.shot\)\)return false;\s*\n\s*setKiss\(o\.shot\);/.test(web), true);
    /* 단추가 없다 — 유저가 고르는 장면이 아니라 유저가 보고 있는 것이다 */
    eq('단추 없이 저절로 접힌다',
      (() => {
        const k = web.slice(web.indexOf('function KissTime('), web.indexOf('\n}', web.indexOf('function KissTime(')));
        return [/setTimeout\(close,KISS_RISE\+KISS_HOLD\)/.test(k), /<button/.test(k), /onClick=\{close\}/.test(k)];
      })(), [true, false, true]);
    /* 접촉은 화면 밖이다 — 이 화면이 그리는 것은 눈 감은 얼굴 한 장뿐이다 */
    eq('사진 한 장이 전부다',
      /<img className="kshot" src=\{shot\.shot\+"\.webp"\} alt=""\/>/.test(web), true);
  }

  /* 자리마다 거리가 늘었다 — 중거리와 클로즈업은 자리 사진과 사진첩에 든다 */
  const NEAR = [...scene.matchAll(/"([a-z-]+-(?:mid|near|seat|fridge))"/g)].map(m => m[1]);
  eq('늘어난 자리 사진이 전부 저장소에 있다',
    [...new Set(NEAR)].filter(k => !exists(k + '.webp')), []);
  eq('늘어난 자리 사진이 사진첩에도 있다',
    [...new Set(NEAR)].filter(k => !gal.includes(k)), []);
  /* ── 물러난 사진 ──
     새 사진이 옛 사진의 자리를 이어받으면 옛 것은 자리에서 빠진다. 안 빼면
     같은 장면이 두 판으로 돌아 「이 사람이 여기서 뭘 하고 있었지」가 갈린다. */
  eq('편의점 conv는 물러났다',
    [/minhyun-conv/.test(web), exists('minhyun-conv.webp'),
     readFileSync(join(ROOT, 'worker.js'), 'utf8').includes('"minhyun-conv"'),
     readFileSync(join(ROOT, 'demo-lines.js'), 'utf8').includes('minhyun-conv')],
    [false, false, false, false]);
  /* 그 자리(편의점 냉장고 앞·젤리)는 새 사진이 그대로 이어받는다 */
  eq('그 자리는 새 사진이 이어받았다',
    /"minhyun-fridge": \{[\s\S]{0,120}편의점 냉장고 앞/
      .test(readFileSync(join(ROOT, 'worker.js'), 'utf8')), true);
  /* 재언의 빨래방은 자리 사진이 한 장이다 — 앉는 순간 보이는 것이 늘 같아야
     그 자리가 그 자리로 남는다. 옛 사진과 가까운 두 장은 사진첩 몫이다 */
  eq('재언 빨래방 자리 사진은 자리배경 한 장이다', (() => {
    const at2 = web.indexOf('const SCENE_SHOT=');
    const t = web.slice(at2, web.indexOf('\n};', at2));
    const i = t.indexOf('"빨래방":');
    return (t.slice(i, i + 400).match(/jaeeon:\[([^\]]*)\]/) || [])[1];
  })(), '"jaeeon-laundry-seat"');
  eq('물러난 것들은 사진첩에 남는다',
    ['jaeeon-laundry.webp', 'jaeeon-laundry-mid.webp', 'jaeeon-laundry-near.webp']
      .filter(k => !gal.includes(k)), []);

  /* ── 빈칸은 상자가 아니라 사진에 앉는다 ──
     자리를 상자 기준 퍼센트로 잡으면, 화면이 낮아져 사진이 상자 안에서
     작아지는 순간 칸이 딴 데로 간다. 폰에서 키보드가 올라오면 바로 그 일이
     났다 — 빈칸 줄이 화면 밖으로 잘리고 커서가 엉뚱한 줄 위에 섰다.
     사진과 빈칸 겹이 **같은 계산**으로 서야 한다: inset:0 + margin:auto + 비율. */
  const fitCss = readFileSync(join(ROOT, 'null.css'), 'utf8');
  eq('사진과 빈칸 겹이 같은 계산으로 선다', [
    /\.dshot\{position:absolute;inset:0;margin:auto;[^}]*aspect-ratio:1024\/1536/.test(fitCss),
    /\.dfit\{position:absolute;inset:0;margin:auto;[^}]*aspect-ratio:1024\/1536/.test(fitCss),
  ], [true, true]);
  /* 빈칸이 그 겹 안에 들어 있어야 퍼센트가 사진 기준이 된다 */
  eq('빈칸이 그 겹 안에 있다', [
    /<div className="dfit">\s*\n\s*<input className="dblank"/.test(web),
    /<div className="dfit">\s*\n\s*\{FLASH_BOX\.map/.test(web),
  ], [true, true]);
  /* 사진 칸과 단추 칸을 격자로 가른다 — 세로 flex면 사진의 높이만 줄고
     너비는 그대로라 비율이 깨진다 */
  eq('사진 칸과 단추 칸이 갈려 있다',
    [/\.diary\{[^}]*grid-template-rows:minmax\(0,1fr\) auto/.test(fitCss),
     /\.flash\{[^}]*grid-template-rows:minmax\(0,1fr\) auto/.test(fitCss)], [true, true]);

  /* 옥상은 셋이 다 있다 — 중거리·클로즈업·최근접 */
  eq('옥상에 거리 셋이 다 있다',
    [scene.includes('minhyun-rooftop-mid'), scene.includes('minhyun-rooftop-near'),
     kiss.includes('minhyun-rooftop-kiss')], [true, true, true]);
}

/* ── 사진은 창에 담는다 ──
   이 앱에서 「앱 위에 얹히는 것」은 전부 창이다(gift·bag·map·yaja.exe).
   사진만 검은 공백에 떠 있었다. 그 사진들은 전부 표면 위에 놓인 물건을 찍은
   것이라 이미 자기 세계를 들고 온다 — 검정은 그 세계를 버리고 두 번째 세계를
   하나 더 얹는 일이었다. 뒤로 앱이 비치면 떠난 게 아니라 가까이 본 게 된다. */
{
  const pvCss = readFileSync(join(ROOT, 'null.css'), 'utf8');
  eq('사진 보는 창이 하나다', (web.match(/function PhotoWin\(/g) || []).length, 1);
  /* 부르는 자리가 셋이다 — 사진첩·히든·말풍선(1:1·단톡). 각자 그리면 같은
     사진이 화면마다 다르게 열린다 */
  eq('세 자리가 같은 창을 쓴다',
    (web.match(/<PhotoWin shot=\{zoom\} onClose=\{\(\)=>setZoom\(null\)\}\/>/g) || []).length, 3);
  eq('검은 공백은 걷었다', [/lightbox/.test(web), /lightbox/.test(pvCss)], [false, false]);
  /* 뒤로 앱이 비친다 — 막이 불투명하면 떠난 게 된다 */
  eq('막은 반투명이다', /\.pvwin\{[^}]*background:rgba\(74,66,118,\.42\)/.test(pvCss), true);
  /* 창틀은 이 앱의 그 창틀이다 — 사진용 창을 따로 그리지 않는다 */
  eq('앱의 창틀을 쓴다',
    /className="dlg pvdlg"/.test(web) && /<div className="tb">photo<WinDots onClose=\{onClose\}\/><\/div>/.test(web), true);
  /* 알약은 사진에 붙는다 — 전에는 사진에서 한참 떨어져 아무 관계도 없이 떠 있었다 */
  eq('알약이 창 안에 붙는다', /\.pvfoot\{flex:none;display:flex/.test(pvCss), true);
  /* 두 모양을 다 받는다 — 말풍선은 파일 이름 한 줄, 사진첩·히든은 설명이 붙는다 */
  eq('설명 있는 사진도 같은 창이다',
    /const one=typeof shot==="string";/.test(web)
    && /const label=one\?"":shot\.label;/.test(web)
    && /\{label&&<div className="pvcap">/.test(web), true);
  /* 앱도 같은 창이다 — 두 판이 갈리면 같은 사진이 두 앱에서 다르게 열린다 */
  const pvApp = readFileSync(join(ROOT, 'app/App.tsx'), 'utf8');
  const pvDlg = readFileSync(join(ROOT, 'app/screens/Dialogs.tsx'), 'utf8');
  eq('앱도 사진 보는 창이 하나다', (pvDlg.match(/export function PhotoWin\(/g) || []).length, 1);
  eq('앱의 두 자리가 같은 창을 쓴다',
    (pvApp.match(/<PhotoWin shot=\{zoom\} onClose=\{\(\)=>setZoom\(null\)\}\/>/g) || []).length, 2);
  eq('앱도 앱의 창틀을 쓴다',
    /<Text style=\{dl\.tbT\}>photo<\/Text>/.test(pvDlg), true);
  eq('앱도 검은 공백을 걷었다',
    [/rl\.lbCard/.test(pvApp), /ch\.lb\}/.test(pvApp)], [false, false]);
}

/* ── 배역을 받는 자리 ──
   유저가 배역을 받은 줄 모르는 채로 첫 방에 들어가고 있었다. 그래서 뒤에
   「선생님」이라는 호칭이 설명 없이 성립하지 않았다. 교실에서 그렇게 불리는
   사람은 한 명뿐이고, 그 소리가 나를 향하면 설명 없이 안다 —
   그게 이 화면이 하는 일 전부다. */
eq('배역을 받는 자리가 웹·앱 둘 다 있다',
  [/function Intro\(/.test(web), /function Intro\(/.test(appSrc)], [true, true]);
const introCss = readFileSync(join(ROOT, 'null.css'), 'utf8');
/* 팝업이 아니라 전체 화면이다 — 팝업은 앞의 가짜 오류창과 문법이 겹친다 */
eq('전체 화면이지 팝업이 아니다',
  [/\.intro\{position:absolute;inset:0;z-index:56;/.test(introCss),
   !/className="dlgov"[^]{0,200}intro/.test(web)], [true, true]);
/* 두 화면의 글월이 같아야 한다 — 같은 자리인데 말이 다르면 다른 화면이다 */
for (const [label, src] of [['웹', web], ['앱', appSrc]])
  eq(`${label}의 배역 화면 글월이 같다`,
    ['뒷자리', '창가 쪽', '선생님— ', '선생님!', '현실에서 ', '이던 내가',
     '이 세계에서는 ', '교생?', 'NULL 채우러 가기 ♡'].filter(t => !src.includes(t)), []);
/* □□는 유저가 채우는 칸이 아니다 — 현실의 내 값이 비어 있다는 말이라
   비어 있는 채로 고정이다. 입력칸으로 만들면 이야기가 반대가 된다 */
for (const [label, src] of [['웹', web], ['앱', appSrc]])
  eq(`${label}의 □□는 입력칸이 아니다`,
    /(?:className="bk"|style=\{io\.bk\})[^]{0,40}(?:input|TextInput)/.test(src), false);
/* 교실을 앞에서 보는 시야다 — 교사만 서는 자리라 그 자리가 곧 호칭이다 */
for (const [label, src] of [['웹', introCss], ['앱', appSrc]])
  eq(`${label}은 교실 사진을 쓴다`, /place-class\.webp/.test(src), true);
/* 남은 날이 null인 것이 이 프로덕트의 이름이자 이야기다. 숫자로 바꾸면 안 된다. */
eq('DAYS LEFT는 null로 둔다',
  /DAYS LEFT[\s\S]{0,80}null/.test(appSrc) && /DAYS LEFT[\s\S]{0,80}null/.test(web), true);
/* 등록 화면은 읽는 화면이 아니라 채우는 화면이다. 여기서 채운 값이 그대로
   서버로 가서 인물이 알게 된다 — 빈칸이 없으면 그 통로가 끊긴다. */
eq('등록 화면에서 유저 프로필을 채운다',
  /const ENR_FIELDS=\[/.test(web) && /onSaveField=\{\(k,v\)/.test(web), true);
eq('채우는 칸이 you.txt와 같은 것들이다',
  ['subject','age','likes','dislikes'].filter(k => !new RegExp(`k:"${k}"`).test(web)), []);
/* 네 칸을 채우는 데 클릭이 네 번 필요하면 아무도 다 안 채운다.
   엔터를 치면 다음 칸이 열리도록 Blank의 열림 상태를 Enroll이 쥔다. */
eq('웹 등록 화면은 엔터로 다음 칸에 넘어간다',
  (web.match(/open=\{focus===i\}/g) || []).length >= 1
  && /onNext=\{\(\)=>setFocus\(i\+1/.test(web), true);
/* you.txt도 같은 칸을 같은 순서로 채운다. 한쪽만 넘어가면 그게 더 이상하다 */
eq('you.txt도 엔터로 넘어간다',
  (web.match(/open=\{focus===i\}/g) || []).length, 2);
eq('you.txt가 등록 화면과 같은 항목을 쓴다',
  /you\.txt[\s\S]{0,900}ENR_FIELDS\.map/.test(web), true);
eq('빈칸이 밖에서 여는 것과 혼자 여는 것을 둘 다 한다',
  /const ctl=typeof open==="boolean"/.test(web), true);
/* 이름 옆의 「edit」 딱지는 뗐다 — 커서가 이미 그 말을 한다 */
eq('이름 옆에 딱지가 없다',
  /className="pen"/.test(web) || /en\.pen/.test(appSrc), false);

/* HEAT는 stageIdx로 색인한다. 배열이 짧으면 마지막 단계에서 undefined를 읽고 터진다. */
const appHeat = (appSrc.match(/\{w:[\d.]+,\s*o:'[0-9a-f]{2}'\}/g) || []).length;
eq('앱 HEAT 길이가 단계 수와 같다', appHeat, webAt.length);

// ─────────────────────────────────────────────
section('데모 모드 — 키 없이 들어온 사람도 빈 화면을 보지 않는다');
// ─────────────────────────────────────────────
/* 대사와 매칭은 docs/dialogue-corpus.md에서 만들어진다. 손으로 고치는 파일이
   아니므로, 검사도 생성된 파일이 아니라 만들어진 결과의 동작을 본다. */
const demoSrc = readFileSync(join(ROOT, 'demo-lines.js'), 'utf8');
const demo = new Function(demoSrc +
  '\nreturn {demoAnswer,demoProactive,demoGreetWhen,demoSeed,demoReset,demoNorm,demoTokens,demoWhen,DEMO_SELFIE_RE,DEMO_PIC,DEMO_PIC_ANY,DEMO_CORPUS};')();
let seed = 3;
demo.demoSeed(() => ((seed = seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const C = demo.DEMO_CORPUS;
/* 사진은 제 말풍선으로 나간다("이거요." + 사진). 답이 맞았는지 볼 때는
   그 줄을 빼고 본다 — 안 그러면 사진이 붙었다는 이유로 전부 틀린 게 된다. */
const said = (room, t) => demo.demoAnswer(room, t, '윤하')
  .filter(m => !m.photo).map(m => m.text).join(' | ');

eq('문구집을 다 옮겼다', C.intents.length > 400, true);
eq('두 사람 다 답할 말이 있다',
  [C.intents.some(e => e.jaeeon), C.intents.some(e => e.minhyun)], [true, true]);

/* 문구집의 입력을 그대로 쳤을 때 제 답이 나와야 한다. 하나씩 눈으로 볼 수 없으니
   전부 돌려서 비율로 본다 — 매칭을 건드리면 여기가 먼저 떨어진다. */
let ok2 = 0, tot = 0;
for (const room of ['jaeeon', 'minhyun'])
  for (const e of C.intents) {
    if (!e[room]) continue;
    for (const q of e.q) {
      tot++;
      const want = e[room].map(x => x.join(' | '));
      if (want.includes(said(room, q))) ok2++;
    }
  }
eq(`문구집 입력이 제 답으로 간다 (${ok2}/${tot})`, ok2 / tot > 0.97, true);

/* 위험·안전이 제일 먼저다. 여기가 밀리면 사람이 다친다 */
eq('숨이 안 쉬어진다는 말에 119가 나온다', /119|사람 불러/.test(said('jaeeon', '숨이 안 쉬어져요')), true);
eq('죽고 싶다는 말에 혼자 두지 않는다', /혼자|119|연락/.test(said('minhyun', '죽고 싶어요')), true);
/* 힘들다는 말이 위험으로 새면 안 된다. 숨쉬기 힘들다와는 다른 말이다 */
eq('그냥 힘들다는 말은 위험이 아니다', /119/.test(said('jaeeon', '나 오늘 진짜 힘들었어')), false);

/* 알아듣지 못했을 때 아무 말이나 하지 않는다 */
eq('못 알아들으면 되묻는다',
  C.fallback.jaeeon.some(x => x.join(' | ') === said('jaeeon', 'asdkfjlsdf')), true);

/* 방마다 고르는 법이 다르다. 관전방은 유저가 장면 밖에 있으므로 두 사람 대화만 나온다 */
const watch = demo.demoAnswer('health', '둘이 뭐 해', '윤하');
eq('관전방은 두 사람이 주고받는다', new Set(watch.map(m => m.sender)).size, 2);
eq('관전방에 유저 말풍선은 없다', watch.some(m => m.sender === 'user'), false);
eq('단톡방도 두 사람이 주고받는다',
  new Set(demo.demoAnswer('group', '오늘 다 같이 뭐 먹을까요?', '윤하').map(m => m.sender)).size, 2);

/* 빈 답이 나가면 화면에서 타이핑 표시가 안 꺼진다. 큐에 안 들어가면 pump가
   안 돌기 때문이다. 엔진은 늘 무언가를 돌려주고, 그래도 비면 클라이언트가 끈다. */
let empties = 0;
for (const r of ['jaeeon', 'minhyun'])
  for (const t of ['네?', '네', '응', '?', '!', 'ㅇㅇ', '아', '뭐', '좋아해', 'ㅋㅋ',
                   '...', ' ', '1', 'ok', 'zzz', '네?', '네?', '네?'])
    if (!demo.demoAnswer(r, t, '윤하').length) empties++;
eq('짧은 입력에도 빈 답이 없다', empties, 0);
eq('큐가 비면 타이핑 표시를 끈다',
  /if\(!dropBatch\(id\)\)\{ saveFailed\(b\.room,null,id\); return false \}\s*\n\s*settle\(b\.room\);/.test(web)
  && /const settle=room=>\{ if\(roomIdle\(room\)\)setBusy/.test(web), true);
/* 셋 다 비어야 끈다 — 미완료 장부가 남아 있으면 아직 하는 중이다.
   말풍선이 끝났어도 지문·초대·표·자리 닫기가 남았으면 열지 않는다.
   그리고 보내는 손도 같은 자를 본다 */
eq('안 푼 덩어리가 있으면 그 방은 잠겨 있다',
  /const replaying=room=>loadBatches\(\)\.some\(b=>b\.room===room\);/.test(web)
  && /const roomIdle=room=>!queueRef\.current\.some\(q=>q\.room===room\)\s*\n\s*&& !inflightRef\.current\[room\] && !replaying\(room\);/.test(web)
  && /if\(replaying\(room\)\)\{ setBusy/.test(web), true);
/* 모듈 바깥에서 App 안의 것(storeRef 같은)을 참조하면 부를 때마다 터진다.
   그러면 콜백이 죽고 타이핑 표시가 영영 안 꺼진다. 실제로 그렇게 났다. */
const outside = web.slice(web.indexOf('/* ── 데모 모드 ──'), web.indexOf('function App()'));
eq('모듈 바깥에서 App 안의 것을 참조하지 않는다',
  ['storeRef', 'queueRef', 'viewRef', 'setBusy', 'setStore', 'unlockedRef']
    .filter(n => new RegExp('\\b' + n + '\\b').test(outside)), []);
/* 그래도 터질 수 있으니 데모 답은 통째로 감싸고, 터지면 표시를 끄고 콘솔에 남긴다 */
eq('데모 답이 터져도 화면은 안 멈춘다', /const demoSay=\(room,ask,gift\)=>\{[\s\S]{0,400}catch/.test(web), true);
/* 대사 파일을 따로 뺐으므로 캐시를 끊어줘야 고친 게 반영된다 */
eq('대사 파일에 캐시 무효화가 붙어 있다', /demo-lines\.js\?v=/.test(web), true);

/* 데모에서도 사진첩이 차야 한다. 서버가 붙여주던 걸 엔진이 대신 한다 —
   말에 걸리는 게 있으면 그 사진을, 없으면 가끔 아무거나.

   사진은 제 말풍선으로 나가야 한다. 남의 문장 끝에 붙였더니 "비 그치면
   알려줘요" 밑에 비 사진이 걸렸다. 보내는 사람의 뜻이 아니라 장식이 된다. */
[['jaeeon', '밥 먹었어요?'], ['jaeeon', '커피 마셨어요?'],
 ['minhyun', '사탕 있어요?'], ['minhyun', '졸려요']].forEach(([r, q]) => {
  demo.demoReset();
  const out = demo.demoAnswer(r, q, '윤하');
  eq(`"${q}"에 사진이 붙는다`, out.some(m => m.photo), true);
  const pic = out.filter(m => m.photo);
  eq(`"${q}" 사진은 제 말풍선으로 나간다`,
    pic.length === 1 && pic[0] === out[out.length - 1] && !!pic[0].text, true);
});
/* ── 매칭이 틀어졌던 자리 ── */

/* 어간을 한 자까지 깎으면 상관없는 말이 같은 말이 된다.
   "사랑해요" → 해요를 떼고 "사랑" → 조사 "랑"까지 떼면 "사".
   "사과해요"도 "사". 그래서 사랑한다는 말에 사과가 돌아왔다. */
eq('어간을 한 자로 깎지 않는다',
  ['사랑해요', '사과해요', '라면', '떡볶이'].map(w => demo.demoTokens(w)[0]),
  ['사랑', '사과', '라면', '떡볶']);
eq('사랑과 사과가 같은 말이 아니다',
  demo.demoTokens('사랑해요')[0] === demo.demoTokens('사과해요')[0], false);

/* 사람은 띄어쓰기를 안 하고 어미를 자른다. "뭐해"가 "뭐 해요?"에 안 걸렸다 —
   낱말로 쪼개면 "뭐"는 흔해서 버려지고 "해요"만 남아 영영 안 만난다. */
eq('"뭐해"와 "뭐 해요?"가 같은 답으로 간다',
  said('minhyun', '뭐해') === said('minhyun', '뭐 해요?')
  || ((C.intents.find(x => x.q.includes('뭐 해요?')).minhyun || [])
       .map(x => x.join(' | ')).includes(said('minhyun', '뭐해'))), true);
/* 길이를 안 보면 "좋아"가 "좋아하는 색 뭐예요"까지 삼킨다 */
demo.demoReset();
eq('짧은 앞부분이 긴 말을 삼키지 않는다',
  (C.intents.find(x => x.q.includes('단 거 좋아해요?')).minhyun || [])
    .map(x => x.join(' | ')).includes(said('minhyun', '좋아')), false);

/* "보고 싶어요"는 "삼촌 보고 싶어요"의 일부지만, 빠진 두 글자가 누구를
   보고 싶다는 건지를 통째로 바꾼다. 그래서 삼촌을 불러주겠다는 답이 나갔다. */
demo.demoReset();
eq('별칭이 덧붙인 주어를 무시하지 않는다',
  (C.intents.find(x => x.q.includes('삼촌 보고 싶어요')).minhyun || [])
    .map(x => x.join(' | ')).includes(said('minhyun', '보고싶어요')), false);

/* 고백은 이 장르에서 제일 중요한 입력인데 문구집에 없어서 폴백으로 빠졌다.
   "좋아해"는 세 글자라 다른 말 안에 통째로 들어간다 — "라멘 좋아해?"가
   고백으로 새면 안 된다. 입력이 별칭보다 크면 그 얹은 것이 화제다. */
['좋아해요', '좋아해', '사랑해요', '사랑해'].forEach(q => {
  ['jaeeon', 'minhyun'].forEach(r => {
    demo.demoReset();
    const e = C.intents.find(x => x.q.includes(q.replace('해', '해')) || x.q[0] === q);
    const answers = ((e && e[r]) || []).map(x => x.join(' | '));
    eq(`"${q}"가 ${r}의 고백 답으로 간다`,
      answers.length > 0 && answers.includes(said(r, q)), true);
  });
});
['라멘 좋아해?', '떡볶이 좋아해?'].forEach(q => ['jaeeon', 'minhyun'].forEach(r => {
  demo.demoReset();
  const conf = C.intents.find(x => x.q[0] === '좋아해요');
  eq(`"${q}"는 고백으로 안 샌다`,
    ((conf && conf[r]) || []).map(x => x.join(' | ')).includes(said(r, q)), false);
}));

/* ── 선물 ──
   물건을 받았는데 "무슨 말인지 잘 못 들었어요"가 돌아오면 그건 준 게 아니라
   허공에 던진 것이다. 이름을 문장으로 꾸며 매칭에 태우던 걸 열쇠로 바꿨다. */
/* GIFTS 표 안에서만 센다. 코드 아무 데서나 {key:"..."}를 세면 상관없는 것이
   섞인다 — 가방에 넣는 줄 하나가 열일곱 번째 선물로 잡혔다 */
const GIFT_KEYS = [...web.slice(web.indexOf('const GIFTS=['), web.indexOf('const GIFT_CATS'))
  .matchAll(/\{key:"([a-z]+)"/g)].map(m => m[1]);
eq('선물이 열여섯 개다', GIFT_KEYS.length, 16);
eq('모든 선물에 두 사람의 대답이 있다',
  GIFT_KEYS.filter(k => ['jaeeon', 'minhyun'].some(r => {
    demo.demoReset();
    const out = demo.demoAnswer(r, '', '윤하', { gift: k });
    return !out.length || /못 들었|못 알아/.test(out.map(m => m.text).join(' '));
  })), []);
/* 물건마다 다른 말이 나와야 한다. 다 같은 말이면 표가 아니라 폴백이다 */
eq('물건마다 대답이 다르다',
  new Set(GIFT_KEYS.map(k => { demo.demoReset();
    return demo.demoAnswer('minhyun', '', '윤하', { gift: k }).map(m => m.text).join('|'); })).size,
  GIFT_KEYS.length);
/* 표에 없는 물건을 줘도 받기는 받는다 */
demo.demoReset();
eq('모르는 물건도 받는다',
  demo.demoAnswer('jaeeon', '', '윤하', { gift: '없는물건' }).length > 0, true);
/* 열쇠가 클라이언트에서 엔진까지 실제로 넘어가야 한다 */
eq('웹·앱 둘 다 선물 열쇠를 넘긴다',
  /demoGiftKey/.test(web) && /demoReply\(char,line,name,gift\.key\)/.test(appSrc), true);

/* ── 자는 사람은 먼저 말을 안 건다 ──
   새벽 세 시에 처음 켜면 둘 다 몇 초 안에 인사를 보냈다. 목록에는 「자는 중」
   이라고 떠 있는데 그 사람 말풍선이 왔다. 그리고 유저가 없어도 세계가
   돌아간다는 앱인데, 켜자마자 둘이 인사하면 기다리고 있던 게 된다. */
/* ── 둘이 같이 자는 시간이 없다 ──
   재언 1~6시, 민현 3~8시였다. 세 시부터 여섯 시까지 셋이 겹쳐서, 그 세 시간은
   유저가 말 걸 사람이 아무도 없었다. 민현이 자러 가는 시각과 재언이 일어나는
   시각을 네 시 반에 맞물려 놓는다 — 한쪽이 자는 동안 다른 쪽이 깨 있다. */
const PRESENCE = (() => {
  const src = web.slice(web.indexOf('const weekNo='));
  return new Function(src.slice(0, src.indexOf('\n}\n') + 3)
    + '\nreturn presence;')();
})();
const AWAKE_AT = (id, h, mi = 0) => {
  const pr = PRESENCE(id, new Date(2026, 0, 6, h, mi));
  return !pr || pr.s !== "off";
};
eq('재언은 네 시 반에 일어난다',
  [AWAKE_AT('jaeeon', 4, 29), AWAKE_AT('jaeeon', 4, 30)], [false, true]);
eq('민현은 네 시 반에 잠든다',
  [AWAKE_AT('minhyun', 4, 29), AWAKE_AT('minhyun', 4, 30)], [true, false]);
/* 이게 이 수정의 전부다 — 아무도 없는 시간이 없다 */
eq('둘 다 자는 시각이 없다',
  Array.from({ length: 24 * 4 }, (_, i) => [Math.floor(i / 4), (i % 4) * 15])
    .filter(([h, mi]) => !AWAKE_AT('jaeeon', h, mi) && !AWAKE_AT('minhyun', h, mi)), []);
/* 점은 「자는 중」인데 그 사람이 인사를 보내면 그게 처음 고치려던 그림이다.
   일어나는 시각과 말 거는 시각이 같아야 한다 — 시계가 하나라 저절로 같다 */
eq('선톡도 같은 시계를 본다', (() => {
  const src = web.slice(web.indexOf('const weekNo='));
  const P = new Function(src.slice(0, src.indexOf('\n}\n') + 3)
    + 'const canGreet=(id,now)=>{const pr=presence(id,now);return !pr||pr.s!=="off"};'
    + '\nreturn canGreet;')();
  return !P('jaeeon', new Date(2026, 0, 6, 3, 0)) && P('jaeeon', new Date(2026, 0, 6, 5, 0))
    && !P('minhyun', new Date(2026, 0, 6, 6)) && P('minhyun', new Date(2026, 0, 6, 23));
})(), true);
eq('자는 창이 분으로 적혀 있다',
  /if\(mm>=60&&mm<270\) return off\("자는 중"\)/.test(web)
  && /if\(mm>=270&&mm<480\)   return off\("꺼짐"\)/.test(web), true);
/* ── ?awake ── 자는 시간에 붙잡고 볼 일이 있을 때만. 주소에 붙였을 때만 돈다 */
eq('깨워두는 스위치가 있다',
  /const AWAKE=\(\(\)=>\{[\s\S]{0,260}q\.has\("awake"\)/.test(web)
  && /const forcedAwake=id=>AWAKE==="all"\|\|\(Array\.isArray\(AWAKE\)&&AWAKE\.includes\(id\)\)/.test(web), true);
/* 점에 「깨워둠」이라고 적는다 — 이게 진짜 시계가 아니라는 걸 보이게 */
eq('깨워둔 것이 점에 보인다',
  /const off=t=>up\?\{s:"away",t:"깨워둠"\}:\{s:"off",t\};/.test(web), true);
/* 시험은 presence만 떼어 돌린다 — 거기엔 forcedAwake가 없다 */
eq('스위치가 없어도 presence가 돈다',
  /typeof forcedAwake==="function"&&forcedAwake\(id\)/.test(web), true);
/* 시각 상수(GREET_FROM)는 걷어냈다 — presence와 시계가 둘이면 어긋난다 */
eq('선톡 시계는 목록의 점과 같은 것 하나다', /GREET_FROM/.test(web), false);
eq('점이 꺼진 사람은 안 건다',
  /const canGreet=\(id,now\)=>\{\s*\n\s*const pr=presence\(id,now\);\s*\n\s*return !pr\|\|pr\.s!=="off";/.test(web), true);
/* ── 자는 사람은 답도 없다 ──
   먼저 안 거는 것만으로는 모자랐다. 밤에 말을 걸면 답은 꼬박꼬박 왔고,
   대신 재언이 「자요, 이제」를 서른세 분에 열다섯 번 말했다 — 끝내려는
   사람이 끝낼 수가 없었다. 무슨 말을 걸든 반드시 답이 오는 세계에는
   「답하지 않는다」는 수가 없어서다. 같은 시계의 off를 반대쪽에서도 본다 */
{
  const src = web.slice(web.indexOf('const weekNo='));
  const A = new Function(src.slice(0, src.indexOf('\n}\n') + 3)
    + 'const asleep=(id,now)=>{const pr=presence(id,now);return !!pr&&pr.s==="off"};'
    + 'const allAsleep=(room,now)=>(room==="group"?["jaeeon","minhyun"]:[room]).every(id=>asleep(id,now));'
    + '\nreturn allAsleep;')();
  const at = (h, m) => new Date(2026, 0, 6, h, m || 0);
  eq('자는 시간에는 안 부른다', A('jaeeon', at(2)), true);
  eq('깨어 있으면 부른다', A('jaeeon', at(23)), false);
  /* 단톡방은 한 사람만 깨 있어도 답이 온다 — 새벽 두 시의 민현이 그렇다.
     그리고 이제 둘이 같이 자는 시각이 없으므로(재언 1~4:30, 민현 4:30~8)
     단톡방은 어느 시각에도 조용해지지 않는다. 자는 쪽 말풍선은 워커가
     states를 보고 지운다 — 새벽 다섯 시의 단톡은 재언만 답한다. */
  eq('단톡방은 언제나 한 명은 답한다',
    [A('group', at(2)), A('group', at(5)), A('group', at(23))], [false, false, false]);
  eq('자는 쪽만 조용하다',
    [A('jaeeon', at(5)), A('minhyun', at(5))], [false, true]);
  /* 마주 앉아 있으면 안 본다 — 눈앞의 사람이 자는 건 자리가 닫힐 일이다 */
  eq('자리에서는 이 규칙을 안 본다', /mode==="chat"&&!payload\.place&&allAsleep\(/.test(web), true);
  /* 아무것도 안 뜨면 보낸 사람은 고장으로 읽는다 */
  eq('지문을 한 줄 남긴다', /자고 있다`/.test(web), true);
  /* 다섯 번 말 걸면 다섯 줄이 되면 안 된다 */
  eq('같은 줄을 연달아 안 쌓는다', /!last\.sys\|\|last\.text!==line/.test(web), true);
  /* 단톡방에서 자는 쪽의 말풍선은 워커가 지운다 — [지금] 줄은 부탁이고 이건 자물쇠다 */
  const D = (list, states) => dropSleepers(list, states).map(m => m.sender);
  const two = [{ sender:'jaeeon', text:'ㄱ' }, { sender:'minhyun', text:'ㄴ' }];
  eq('자는 사람 말풍선을 지운다', D(two, { jaeeon:'자는 중', minhyun:'안 자는 중' }), ['minhyun']);
  eq('민현의 꺼짐도 같이 본다', D(two, { jaeeon:'집', minhyun:'꺼짐' }), ['jaeeon']);
  eq('깨어 있으면 안 건드린다', D(two, { jaeeon:'집', minhyun:'야자' }), ['jaeeon', 'minhyun']);
  /* 다 지우면 빈 답이 된다 — 빈 화면은 고장으로 읽힌다 */
  eq('다 자면 차라리 그대로 둔다', D(two, { jaeeon:'자는 중', minhyun:'꺼짐' }), ['jaeeon', 'minhyun']);
  /* 지문에는 말한 사람이 없다. sender는 자리를 채운 값이지 유저가 한 말이
   아닌데 목록 미리보기가 「나: 이재언은 자고 있다」로 찍었다 — 내보내기에서
   한 번 고친 것과 같은 일이 목록에서 또 났다. 웹·앱 둘 다 본다 */
{
  eq('목록의 지문에는 「나:」를 안 붙인다',
    /last\.sys\?"· ":last\.sender==="user"\?"나: ":""/.test(web)
    && /last\.sender==='sys'\?'· ':last\.sender==='user'\?'나: ':''/.test(appSrc), true);
}
/* 자르는 것은 단추만. .ddwrap에도 overflow:hidden을 줬더니 그 안에 든
   드롭다운(.dd)까지 같이 잘려서 file·chat 메뉴가 안 열렸다 — 열리긴 했는데
   단추 상자 밖으로 못 나와 보이지 않았다 */
{
  const css = readFileSync(join(ROOT, 'null.css'), 'utf8');
  eq('감싼 쪽은 안 자른다', /\.ddwrap\{flex:0 1 auto;min-width:0\}/.test(css), true);
  eq('자르는 건 단추다', /\.mbtn\{flex:0 1 auto;min-width:0;overflow:hidden;max-width:100%\}/.test(css), true);
  /* 드롭다운은 단추 밖으로 나와야 한다 */
  eq('드롭다운은 절대 위치다', /\.dd\{position:absolute;left:0;top:calc\(100% \+ 5px\)/.test(css), true);
}
/* ── 유저가 먼저 가자고 하는 자리 ──
   자리를 여는 길이 둘뿐이었다. 지도에서 유저가 고르거나, 관계가 쌓여 인물이
   먼저 꺼내거나. 그래서 대화 중에 「편의점 가자」고 하면 인물에게는 그 자리를
   열 수단이 없었고, 열지도 못하면서 「지금 나가요」 「앞에서 봐요」를 되풀이하다
   끝났다. 규칙을 어긴 게 아니라 손이 없었던 것이다.
   새 조건은 안 만든다 — 지도 창이 「갈래요?」를 띄우는 조건 그대로다 */
{
  const src3 = web.slice(web.indexOf('const canGoWith='));
  const wSrc = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  const aSrc = readFileSync(join(ROOT, 'app/lib/api.ts'), 'utf8');
  eq('지도 창과 같은 조건을 본다',
    /placeOpen\(p,met\|\|\[\]\)&&placeHours\(p,now\)&&wendOnlyOk\(p,now\)&&!goneToday\(p\.name,now\)/
      .test(src3.slice(0, 400)), true);
  /* 그 사람이 갈 수 있는 자리여야 하고, 마주치는 자리는 그 시각에 나와 있어야 한다 */
  eq('그 사람이 갈 수 있는 데만 센다', /\(p\.who\|\|\[\]\)\.includes\(id\)/.test(src3.slice(0, 400)), true);
  eq('마주치는 자리는 나와 있어야 한다',
    /p\.meet!=="out"\|\|outAt\(p,now\)\.includes\(id\)/.test(src3.slice(0, 400)), true);
  /* 학교는 자리가 아니라 문이다 */
  eq('문은 자리가 아니다', /!p\.into/.test(src3.slice(0, 400)), true);
  /* 마주 앉은 턴에는 안 보낸다 — 워커도 place가 있으면 목록을 통째로 뺀다.
     보내기만 하고 검증만 열려 있으면 마주 앉은 장면 위로 초대 창이 뜬다 */
  eq('자리에서는 안 보낸다',
    /payload\.room!=="group"&&!payload\.place\)\s*\n\s*payload\.can_go=canGoWith/.test(web)
    && /room !== 'group' && !place \? \{ can_go: canGoWith/.test(aSrc), true);
  /* 억제와 검증이 같은 규칙을 봐야 한다. 유저가 가자고 해서 연 자리가
     검증에서 걸리면 화면에는 아무 일도 안 일어나고 말만 남는다 */
  eq('검증도 두 목록을 같이 본다',
    /openPlaces: place \? \[\] : \[\.\.\.openPlaces, \.\.\.canGo\]/.test(wSrc)
    && /settleInvite\(cand, attempt, place \? \[\] : \[\.\.\.openPlaces, \.\.\.canGo\]\)/.test(wSrc), true);
  /* 인물이 먼저 꺼내는 사다리(INVITES)와는 따로 둔다 — 그쪽은 관계가 쌓여야
     열리고, 이쪽은 유저가 이미 열어둔 문이다 */
  eq('두 목록은 따로 선다',
    /## \[유저가 가자고 하면 갈 수 있는 자리\]/.test(wSrc)
    && /이 목록은 \*\*먼저 꺼내는 데 쓰지 않는다/.test(wSrc), true);
  /* 목록에 없는 데를 대면 못 간다고 말한다 — 가는 척이 이 문제의 시작이었다 */
  eq('없는 곳은 못 간다고 말한다',
    /두 목록 어디에도 없으면 \*\*지금 갈 수 없는 곳이다/.test(wSrc), true);
  /* 워커는 PLACES 표가 없다. 이름만 받아 아는 자리인지만 본다 */
  eq('워커는 이름만 받아 확인한다',
    /body\.can_go\s*:\s*\[\]\)\s*\n\s*\.filter\(p => typeof p === "string" && PLACE_ITEMS\[p\]\)/.test(wSrc), true);
}
/* 관전방은 둘이 마주 앉은 자리다. 한 사람만 자도 그 대화는 없던 일이다 —
   재언이 자는데 「두 사람」방에서는 떠들고 있었다. 목록에 「자는 중」이 떠
   있는 사람이 옆방에서 말을 하면 그 점이 거짓말이 된다 */
{
  const src2 = web.slice(web.indexOf('const weekNo='));
  const B = new Function(src2.slice(0, src2.indexOf('\n}\n') + 3)
    + 'const asleep=(id,now)=>{const pr=presence(id,now);return !!pr&&pr.s==="off"};'
    + 'const bothAwake=now=>!asleep("jaeeon",now)&&!asleep("minhyun",now);'
    + '\nreturn bothAwake;')();
  const at2 = h => new Date(2026, 0, 6, h);
  /* 재언 1~6시, 민현 3~8시 — 둘을 합치면 1~8시가 조용하다 */
  eq('한쪽만 자도 관전은 안 만든다',
    [0, 2, 5, 7, 9, 23].map(h => B(at2(h))), [true, false, false, false, true, true]);
  /* 지금이 아니라 그 대화가 찍힐 시각으로 잰다 — 관전은 한 시간쯤 거슬러 찍힌다.
     그리고 생활리듬은 세계 시계로 본다 — 진짜 시각(new Date)으로 재면 스피드
     모드에서 화면의 「자는 중」과 관전이 딴말을 한다 */
  eq('찍힐 시각으로 잰다', /if\(!bothAwake\(gameAt\(at\)\)\)return;/.test(web), true);
  /* 하루 몫을 깎기 전에 본다. 순서가 반대면 만들지도 못한 대화에 몫만 나가고
     적어둔 사건(선물)까지 같이 지워진다 */
  eq('몫을 깎기 전에 본다',
    web.indexOf('if(!bothAwake(gameAt(at)))return;') < web.indexOf('saveAutoDay(`${day}|'), true);
  /* peek 단추는 지금 벌어지는 일이라 지금으로 잰다 — 인자 없는 bothAwake는
     nowClock()을 보므로 이미 세계 시계다 */
  eq('peek도 자면 안 부른다', /if\(!bothAwake\(\)\)\{/.test(web), true);
  eq('앱도 관전을 막는다',
    /if\(!bothAwake\(gameAt\(at\)\)\) return;/.test(appSrc)
    && /if\(!bothAwake\(\)\)\{/.test(appSrc), true);
  /* ── 자는 사람을 셋으로 세지 않는다 ──
     조건은 bothAwake라 한 명만 자도 막히는데 말은 「둘 다 자요」였다.
     새벽 두 시엔 재언만 자고 민현은 세 시까지 깨 있다 — 목록에 「안 자는 중」이
     떠 있는 사람을 두고 둘 다 잔다고 하면 그 점이 거짓말이 된다 */
  for (const [label, src] of [['웹', web], ['앱', appSrc]])
    eq(`${label}은 자는 사람만 세어 말한다`,
      /zz\.length>1\?['"]지금은 둘 다 자요 ♡['"]/.test(src)
      && /지금은 \$\{jos\(CHARS\[zz\[0\]\]\.name,\s*['"]이\/가['"]\)\} 자요 ♡/.test(src), true);
  eq('앱이 asleep을 들여온다', /openingFor, canGreet, asleep, allAsleep, bothAwake,/.test(appSrc), true);
  eq('앱도 몫을 깎기 전에 본다',
    appSrc.indexOf('if(!bothAwake(gameAt(at))) return;') < appSrc.indexOf("null_auto_day',`${day}|"), true);
}
/* 앱도 같은 자리에서 같은 시계를 본다 — 한쪽만 고치면 두 화면이 갈린다 */
  eq('앱도 자는 사람은 안 부른다',
    /if\(!\(sc0&&sc0\.room===room\)&&allAsleep\(room\)\)\{/.test(appSrc)
    && /자고 있다`/.test(appSrc), true);
  /* 자리에 같이 있는 턴에는 states를 안 넘긴다 */
  eq('자리에서는 워커도 안 지운다',
    /place \? null : states\)/.test(readFileSync(join(ROOT, 'worker.js'), 'utf8')), true);
}
/* 거는 길이 둘이다 — 목록에 앉아 있을 때, 그리고 방을 열 때 */
eq('선톡 함수 안에서도 막는다', /if\(!canGreet\(id\)\)return;/.test(web), true);
/* 뽑고 나서 막으면 그 판은 아무도 안 건다. 새벽에는 제일 오래 조용한 쪽이
   늘 재언이라, 민현이 영영 안 걸린다 */
eq('자는 쪽과 아직 출근 안 한 쪽을 후보에서 먼저 뺀다',
  /\["jaeeon","minhyun"\]\s*\n\s*\.filter\(id=>canGreet\(id\)&&!roomLock\(storeRef\.current,id\)\)\.map\(id=>\{/.test(web), true);
/* filter(canGreet)로 넘기면 두 번째 인자로 인덱스가 들어가 now가 0이 된다.
   0은 1970년이고 그 해의 시각은 UTC 기준이라 어느 쪽으로 튈지 모른다 */
eq('후보를 거를 때 인덱스를 시각으로 넘기지 않는다', /filter\(canGreet\)/.test(web), false);

/* ── 단톡방은 나중에 생긴다 ──
   민현이 「삼촌도 유저를 알고, 유저도 삼촌을 안다」를 알게 된 순간 그가 판다.
   유저는 초대를 받는다 — 왜 초대됐는지는 모른 채로. 그게 이 앱의 모양이다.
   알게 되는 근거는 새로 만들지 않는다. 이미 민현에게 보내고 있는 신호가 그거다 */
{
  const G = new Function(
    'const ROOMS=[{id:"jaeeon"},{id:"minhyun"},{id:"group"},{id:"health"}];'
    + web.slice(web.indexOf('const GROUP_AT=12;'), web.indexOf('/* ── 선물을 어디서 줄까 ──'))
        .replace(/const load\w+=[\s\S]*?;\n/g, '').replace(/const save\w+=[\s\S]*?;\n/g, '')
    + '\nreturn {groupReady,roomsOn};')();
  eq('양쪽에 쌓여야 열린다',
    [G.groupReady({jaeeon:new Array(12), minhyun:new Array(11)}),
     G.groupReady({jaeeon:new Array(12), minhyun:new Array(12)})], [false, true]);
  /* 이미 말이 오간 방은 도로 못 닫는다. 하던 사람의 기록이 사라지면 안 된다 */
  eq('이미 오간 방은 안 닫힌다', G.groupReady({group:new Array(3)}), true);
  eq('열리기 전에는 없는 방이다',
    [G.roomsOn(false).length, G.roomsOn(true).length], [3, 4]);
  eq('방 수도 같이 센다', /rooms \(\{roomsOn\(groupOn\)\.length\}\)/.test(web), true);
  /* 초대는 시스템창으로 온다. 유저는 왜 불렸는지 모른 채로 들어간다 */
  eq('초대는 시스템창이다',
    /\{groupNew&&<Dialog title="null\.exe"/.test(web)
    && /이민현이 방을 만들고 당신을 넣었어요/.test(web), true);
  eq('왜 불렀는지는 안 알려준다',
    /<span className="k2">이 유<\/span><span className="dot"\/><span className="v hush">비밀<\/span>/.test(web), true);
  /* 하던 사람에게는 창을 안 띄운다 — 놀랄 일이 아니다 */
  eq('하던 사람에게는 안 띄운다',
    /if\(!\(store\.msgs\.group\|\|\[\]\)\.length\)setGroupNew\(true\);/.test(web), true);
}

/* ── 선물은 만나서만 ──
   물건은 손에서 손으로 간다. 문자로는 못 준다 — 재언이 직접 말한 적이 있다.
   「말로 주는 CD가 어딨어요. 지금 손에 든 거예요?」
   모델이 스스로 막고 있던 것을 규칙으로 내린다 */
eq('만나고 있으면 바로 준다',
  /const here=c=>withChar===c;/.test(web)
  && /if\(!here\(c\)\)return;\s*\n\s*onSend\(c,pick,giftNote\(memo\)\); onClose\(\);/.test(web), true);
/* 이미 어느 자리에 있으면 그 사람에게만 준다. 딴 사람을 고르면 지금 자리를
   말없이 버리고 옮겨가는 그림이 된다 — 인사도 없이 */
eq('자리에 있으면 딴 사람은 못 고른다',
  /shut=done\|\|today\(c\)\|\|\(!!withChar&&!here\(c\)\)/.test(web)
  && /\(withChar&&!here\(c\)\)\?"NOT HERE"/.test(web), true);
eq('아니면 어디서 줄지 고른다',
  /\(sel\?\(poor\?`NEED ♡\$\{pick\.cost-hearts\}`:\(here\(c\)\?"SEND ♡":"WHERE ♡"\)\):"WRAP ♡"\)/.test(web), true);
/* 물건은 손에서 손으로 간다 — 그래서 선물이 만나러 가는 이유가 된다.
   상자는 안 두른다: 창 안에 창이 하나 더 생기고 이 창은 이미 테두리가 많다.
   웹과 앱이 같은 글월을 쓴다 — 한쪽만 고치면 두 화면의 말이 갈린다. */
eq('아무도 안 만났으면 그렇게 말한다',
  /선물은 What\? 주인공은 Who\? 장소는 Where\?/.test(web)
  && /만나서 전해봐요!/.test(web), true);
eq('그 줄에 상자를 두르지 않는다',
  /\.cshut\{[^}]*\}/.exec(web)[0].includes('box-shadow'), false);
eq('앱도 같은 글월을 쓴다',
  /선물은 What\? 주인공은 Who\? 장소는 Where\?/.test(appSrc)
  && /만나서 전해봐요!/.test(appSrc), true);
/* 주는 길이 둘이면 둘 다 잠가야 한다 */
eq('보내는 쪽에서도 막는다',
  /if\(!sc\|\|sc\.room!==char\)\{ setToast\("만나서 줘요 ♡"\); return \}/.test(web), true);

/* ── 어디서 줄까요 ──
   물건은 손에서 손으로 간다. 그래서 선물이 만나러 가는 이유가 된다 —
   지도를 도는 이유가 아이템 하나뿐이었는데 하나 늘었다 */
eq('자리 규칙을 하나도 안 봐준다',
  /const canMeet=p\.meet==="out" \? outAt\(p,now\)\.includes\(char\)/.test(web)
  && /goneToday\(p\.name,now\) \? "오늘은 벌써 다녀왔어요"/.test(web)
  && /!wendOnlyOk\(p,now\)\s*\? "주말에만"/.test(web)
  && /!placeHours\(p,now\)\s*\? placeWhen\(p,now\)/.test(web), true);
/* 아직 안 열린 자리는 아예 안 보인다. 모르는 자리는 없는 자리다 */
eq('안 열린 자리는 목록에 없다',
  /SPOTS\.filter\(p=>placeOpen\(p,met\)\)\.map/.test(web), true);
/* 못 가는 자리를 아예 빼면 왜 없는지를 모른다 — 흐리게 남겨 이유를 적는다 */
eq('못 가는 이유를 남긴다',
  /\{g\.ok\?"♡":g\.why\}/.test(web) && /\.cspot\.off\{opacity:\.5/.test(web), true);
/* 가서 다시 눌러 줘야 하면 두 번 일이고, 선물을 들고 간 사람이 빈손으로 앉는다 */
eq('가는 것과 주는 것을 한 번에 한다',
  /const giveGiftAt=\(char,gift,memo,place\)=>\{/.test(web)
  && /\{op:"stampGift",char\},\{op:"stampGone",place\},\{op:"goneTo",place\}/.test(web), true);
eq('자리 몫과 선물 몫을 둘 다 쓴다',
  /if\(giftedToday\(char\)\|\|goneToday\(place\)\)return;/.test(web), true);
/* 워커에게 자리와 선물을 같이 보낸다 — 마주 앉아 있고 방금 이걸 받았다 */
eq('자리와 선물을 같이 보낸다',
  /after_request:\{extra:\{place,gift:\{name:gift\.name,key:gift\.key,note\}\}\}/.test(web), true);
/* ── 가방은 준 사람을 같이 들고 간다 ──
   키만 보내니 워커에서 수수 방향이 사라졌다. 방향이 적힌 자리가 buildGift
   하나뿐이었고 그건 전부 유저→인물이라, 민현이 제가 준 젤리를 두고
   "사람 아까 핫팩 주더니 이제 젤리까지"라고 했다 */
eq('가방에 준 사람을 실어 보낸다',
  /const bagOut=\(\)=>bagRef\.current\.map\(b=>\(\{k:b\.key,from:b\.from\|\|""\}\)\);/.test(web), true);
eq('가방을 키만 보내던 자리가 없다', /bagRef\.current\.map\(b=>b\.key\)/.test(web), false);
{
  const w = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  /* 옛 프론트는 아직 문자열 배열을 보낸다. 둘 다 받아야 배포 순서가 안 엮인다 */
  eq('워커가 옛 가방도 받는다', /typeof b === "string"\s*\n\s*\? \{ key: b, from: "" \}/.test(w), true);
  eq('네가 준 것을 따로 적는다',
    /## 네가\s*\$\{u\}에게 준 것/.test(w)
    && /b\.from === room/.test(w), true);
  /* 그 줄은 매 턴 달라진다 — 고정부에 넣으면 캐시가 통째로 깨진다 */
  eq('가방은 가변부에 실린다',
    /\+ buildBag\(bag \|\| \[\], room, userName\)/.test(w)
    && w.indexOf('buildBag(bag || []') > w.indexOf('function buildVolatile'), true);
}


/* ── 첫 자리 ──
   전에는 앱을 켜면 둘이 인사를 보내는 걸로 시작했다. 그건 알림이지 만남이 아니다.
   지금은 시작한 시각이 첫 자리를 정한다. 거기서 한 사람을 만나고, 다른 한 사람은
   첫인사를 보낸다 — 그래서 첫 화면에서 이미 둘의 시간대가 갈린다. */
{
  const O = [...web.slice(web.indexOf('const OPENINGS=['), web.indexOf('const openingFor='))
    .matchAll(/\{from:(\d+),\s*place:"([^"]+)",\s*room:"(\w+)"/g)].map(m => [+m[1], m[2], m[3]]);
  eq('첫 자리가 여섯 띠다', O.length, 6);
  /* 19시만 timeWord에 없는 경계다 — 저녁 띠를 둘로 갈랐다. 퇴근하고 바로
     잡히는 자리와 한 번 들렀다 가는 자리는 같은 「저녁」이라도 시각이 다르다 */
  eq('시간 경계가 timeWord와 같다(19시만 뺀다)',
    O.map(o => o[0]).filter(h => h !== 19), [2, 6, 11, 17, 21]);
  eq('자리와 사람이 시각을 따라간다', O.map(o => o[1] + ':' + o[2]),
    ['편의점:minhyun', '후문 골목:minhyun', '보건실:jaeeon',
     '버스정류장:minhyun', '도서관:jaeeon', '빨래방:jaeeon']);
  /* 띠가 순서대로 늘어서 있어야 reverse().find()가 맞는 자리를 집는다 */
  eq('띠가 시각 순이다', O.map(o => o[0]), [...O.map(o => o[0])].sort((a, b) => a - b));
  /* 도서관은 9~22시라 19~21시가 통째로 열려 있는 시간 안에 든다 */
  eq('도서관은 그 시각에 열려 있다',
    /\{name:"도서관",\s+map:"town", hours:\[9,22\]/.test(web), true);
  /* 도서관은 wendOnly다 — 유저가 지도에서 골라 가는 것에 대한 규칙이라
     첫 자리에는 안 걸린다. 첫 자리를 여는 길이 wendOnlyOk를 안 봐야 한다 */
  eq('첫 자리는 wendOnly를 안 본다',
    /const o=openingFor\(\);[\s\S]{0,900}?setView\(o\.room\);/.test(web)
    && !/const o=openingFor\(\);[\s\S]{0,900}?wendOnlyOk/.test(web), true);
  /* 첫 자리도 다녀온 자리다 — 도장을 안 찍으면 같은 날 한 번 더 갈 수 있다 */
  eq('첫 자리도 도장을 찍는다',
    /if\(PLACE_BY\[o\.place\]\)localBatch\("open\|"\+o\.place,o\.room,\s*\n\s*\{local_ops:\[\{op:"goneTo",place:o\.place\},\{op:"stampGone",place:o\.place\}\]\}\);/.test(web), true);
  /* 21시부터 다음날 2시까지가 밤이다. 자정을 넘어가는 띠라 표에서 못 찾는다 —
     못 찾으면 마지막 것으로 떨어져야 새벽 한 시가 빨래방이 된다 */
  eq('자정을 넘는 띠는 마지막으로 떨어진다',
    /\|\|OPENINGS\[OPENINGS\.length-1\]/.test(web), true);
  /* 골목과 정류장은 지도에 없다. 귀갓길과 같은 길로 들어간다 */
  eq('지도에 없는 자리는 배경을 들고 온다',
    /place:"후문 골목",\s*room:"minhyun", bg:"minhyun-alley\.webp"/.test(web)
    && /place:"버스정류장",\s*room:"minhyun", bg:"minhyun-busstop\.webp"/.test(web), true);
  eq('그 배경이 저장소에 있다', ['minhyun-alley.webp', 'minhyun-busstop.webp'].filter(f => !exists(f)), []);
  /* 한 마디도 오간 적이 없을 때만 연다. 표식을 안 쓰므로 리스타트하면 저절로 다시 열린다 */
  eq('첫 자리는 아무 방도 비었을 때만 연다',
    /\["jaeeon","minhyun","group","health"\]\.some\(r=>\(storeRef\.current\.msgs\[r\]\|\|\[\]\)\.length\)\)return;/.test(web), true);
  /* ── 주말엔 정해진 자리가 없다 ──
     평일은 시간표가 사람을 어디 있게 한다. 주말은 그게 없어서 아무 데나
     있을 수 있고, 학교 넷은 통째로 닫힌다. 그래서 뽑는다 */
  {
    const W = [...web.slice(web.indexOf('const WEND_OPEN=['), web.indexOf('const openingFor='))
      .matchAll(/\{place:"([^"]+)",\s*room:"(\w+)"/g)].map(m => [m[1], m[2]]);
    eq('주말 후보가 여섯이다', W.length, 6);
    /* 학교 안 넷은 주말에 안 열린다(wend:false). 후보에 있으면 잠긴 문으로 보낸다 */
    eq('주말 후보에 학교가 없다',
      W.map(w => w[0]).filter(p => ['교실', '보건실', '옥상', '체육관', '학교'].includes(p)), []);
    /* 집은 뺐다 — 처음 만나는 날에 남의 집에 가 있을 수는 없다 */
    eq('주말 후보에 집이 없다', W.map(w => w[0]).includes('집'), false);
    /* 자리 임자와 만나는 사람이 어긋나면, 재언 자리에서 민현을 기다리게 된다 */
    eq('주말 후보도 자리 임자를 따른다',
      W.filter(([p, r]) => PLACE_BY_WEB(p) && !new RegExp(`who:\\[[^\\]]*"${r}"`).test(PLACE_BY_WEB(p))), []);
    /* 그 시각에 닫힌 자리는 뽑지 않는다. 새벽 세 시의 레코드샵 같은 것 */
    eq('열려 있는 자리에서만 뽑는다',
      /const open=WEND_OPEN\.filter\(o=>\{const p=PLACE_BY\[o\.place\];return !p\|\|placeHours\(p,d\)\}\);/.test(web), true);
    /* 지도에 없는 자리는 여는 시각이 없다. 늘 후보여야 한다 */
    eq('지도에 없는 자리도 주말 후보다',
      ['후문 골목', '버스정류장'].filter(p => !W.map(w => w[0]).includes(p)), []);
    /* 뽑을 게 하나도 없으면 평일 표로 떨어진다 — 빈 화면보다는 낫다 */
    eq('뽑을 게 없으면 평일 표로 떨어진다', /if\(open\.length\)return open\[/.test(web), true);
  }
  /* 밤에 처음 켜면 빨래방에서 재언을 만난다. 그 자리에 그의 사진이 없었다 —
     빈 방 그대로 있었다. 사진은 있었는데 표에 안 걸려 있었을 뿐이다.
     그 뒤로 자리마다 사진이 여럿이 됐다(중거리·클로즈업). 개수를 못박지 않고
     **그가 그 자리에 있는가**만 잰다 — 사진이 늘어날 때마다 시험을 고칠 일이 아니다 */
  eq('빨래방에도 재언이 깔린다', (() => {
    /* 「빨래방」이 적힌 표가 둘이다 — 자리 사진(SCENE_SHOT)과 키스타임(KISS_SHOT).
       앞의 것을 집으면 엉뚱한 표를 재게 된다. 자리 사진 표 안에서만 찾는다 */
    const at = web.indexOf('const SCENE_SHOT=');
    const tbl = web.slice(at, web.indexOf('\n};', at));
    const i = tbl.indexOf('"빨래방":');
    const t = tbl.slice(i, i + 300);
    /* 재언 쪽은 이제 자리배경 한 장이다 — 파일 이름을 박지 않고 그가 그 자리에
       있는가만 잰다. 사진이 갈릴 때마다 고칠 일이 아니다 */
    return i > 0 && /jaeeon:\[[^\]]*"jaeeon-laundry[^"]*"/.test(t)
                 && /minhyun:\[[^\]]*"minhyun-laundry[^"]*"/.test(t);
  })(), true);
  eq('그 사진이 저장소에 있다', exists('jaeeon-laundry.webp'), true);
  /* 첫 자리 다섯 곳에는 전부 그 사람이 깔려야 한다. 빈 방으로 시작해서
     입을 열면 그 사람이 화면이 되는 게 자리의 규칙이다 */
  eq('첫 자리에는 전부 그 사람이 깔린다',
    [['편의점','minhyun'],['보건실','jaeeon'],['빨래방','jaeeon'],['도서관','jaeeon']]
      .filter(([p, r]) => !new RegExp(`"${p}":[^}]*${r}:\\[`).test(web)), []);
  /* 자리에서 만난 사람 말고 다른 한 사람이 첫인사를 보낸다. 아래 선톡 추첨에
     맡기면 안 된다 — 자리 쪽 상태가 아직 화면에 안 앉아서 두 방이 다 비어
     보이고, 자리에서 만난 사람이 뽑혀 조용히 삼켜진다. 게다가 그 추첨은
     view가 바뀌면 정리와 함께 예약까지 취소돼서 자리로 넘어가는 순간 죽는다.
     실제로 다섯 띠 중 넷에서 첫인사가 안 왔다. 그래서 자리 여는 쪽에서 직접 건다 */
  /* 다만 주말이면 안 건다 — 그 사람은 학교에서 만나야 하는데 실습이
     월요일부터라 아직 출근을 안 했다. 월요일에 추첨이 데려온다 */
  eq('다른 한 사람이 첫인사를 보낸다',
    /const other=o\.room==="jaeeon"\?"minhyun":"jaeeon";\s*\n\s*if\(canGreet\(other\)&&!roomLock\(storeRef\.current,other\)\)\{/.test(web), true);
  /* 새벽이면 재언은 안 온다 — 여섯 시에 온다 */
  eq('그 첫인사도 자는 사람은 거른다', /if\(canGreet\(other\)&&!roomLock\(/.test(web), true);
  /* 직접 걸었으면 추첨은 일 분간 조용해야 한다. 안 그러면 둘이 같은 초에 온다 */
  eq('직접 건 뒤에는 추첨이 조용하다',
    /greetAtRef\.current=Date\.now\(\);\s*\/\/ 추첨은 일 분간 조용히/.test(web), true);
  /* 워커도 그 자리를 알아야 한다. 모르면 place가 서버에서 버려지고
     마주 앉아서 「지금 어디예요?」가 나온다 */
  eq('워커가 골목과 정류장을 안다', ['후문 골목', '버스정류장'].filter(p => !placeOf(p)), []);
  /* 첫 만남은 병원 옥상으로 옮겨졌다(리텐콘). 골목이 아직 「처음 마주친
     자리」를 주장하면 세계가 두 개의 첫 만남을 갖게 된다 */
  eq('골목은 처음 마주친 자리가 아니다',
    !/처음 마주친 자리/.test(buildPlace('후문 골목', true, 'minhyun'))
    && /등굣길에 지나는 길/.test(buildPlace('후문 골목', true, 'minhyun')), true);
  eq('정류장은 퇴근길이라고 적혀 있다',
    /퇴근길/.test(buildPlace('버스정류장', true, 'minhyun')), true);
  /* 귀갓길에만 붙던 「곧 내린다」가 골목·정류장에 따라오면 안 된다 */
  eq('귀갓길 꼬리말이 딴 자리에 안 붙는다',
    /곧 내린다/.test(buildPlace('귀갓길', true, 'jaeeon'))
    && !/곧 내린다/.test(buildPlace('후문 골목', true, 'minhyun')), true);
  eq('여기서도 사진은 안 보낸다',
    ['귀갓길', '후문 골목', '버스정류장'].filter(p => !/"photo"를 쓰지 않는다/
      .test(buildPlace(p, true, 'minhyun'))), []);
}
/* ── 자리 화면이 내용만큼만 서던 것 ──
   .screen은 position:absolute·inset:4px인데 .scenewrap이 뒤에서 relative로
   덮었다. 같은 힘이면 뒤가 이긴다 — 화면이 흐름으로 돌아가 말풍선 높이만큼만
   서고 아래 절반이 연보라로 남았다. 자리에 들어갈 때마다 그랬다 */
eq('자리 화면은 화면 자리를 안 벗어난다', /\.scenewrap\{position:/.test(web), false);
eq('그래도 어둠막의 기준은 있다', /\.screen\{position:absolute;inset:4px/.test(web), true);
/* 민현은 네 시 반까지 깨 있다. 두 시로 잡아놨더니 새벽에 그가 먼저 말을 거는데
   목록의 점은 「꺼짐」이었다 — 재언 쪽을 맞춘 것과 같은 이유다.
   세 시였던 것을 재언이 일어나는 시각에 붙였다 */
eq('민현은 네 시 반까지 깨 있다',
  /if\(mm>=22\*60\|\|mm<270\) return \{s:"on",  t:"안 자는 중"\}/.test(web), true);
{
  /* 글자 수로 자르면 문자열 한가운데서 끊긴다. 함수 끝(줄 맨 앞의 })까지 가져온다 */
  const src = web.slice(web.indexOf('const weekNo='));
  const body = src.slice(0, src.indexOf('\n}\n') + 3);
  const P = new Function(body + '\nreturn presence;')();
  eq('새벽 세 시에도 켜져 있다', P('minhyun', new Date(2026, 0, 6, 3, 10)).s, 'on');
  eq('네 시 반 넘으면 꺼진다', P('minhyun', new Date(2026, 0, 6, 4, 40)).s, 'off');
  /* 말을 거는 시각과 점이 어긋나면 안 된다 — 재언은 네 시 반이다 */
  eq('재언은 네 시 반에 깬다', [P('jaeeon', new Date(2026, 0, 6, 4, 20)).s,
    P('jaeeon', new Date(2026, 0, 6, 4, 40)).s], ['off', 'away']);
  /* 맞물린 자리. 한쪽이 자러 가는 그 시각에 다른 쪽이 일어난다 */
  eq('네 시 반에 자리를 바꾼다',
    [P('jaeeon', new Date(2026, 0, 6, 4, 30)).s, P('minhyun', new Date(2026, 0, 6, 4, 30)).s],
    ['away', 'off']);
  /* ── 주말의 접속 상태 ──
     토요일 낮에 「보건실」「수업 중」이 떠 있었다. 근무도 수업도 없는 날이다.
     이 값은 이제 워커에도 실리므로(states) 틀리면 화면만이 아니라 인물이 틀린다.
     잠은 주말에도 잔다 — 자는 창은 평일과 같다. 2026-01-10은 토요일이다. */
  eq('주말 낮엔 자리 이름이 없다', [P('jaeeon', new Date(2026, 0, 10, 13)).t,
    P('minhyun', new Date(2026, 0, 10, 13)).t], ['주말', '주말']);
  eq('주말에도 잠은 잔다', [P('jaeeon', new Date(2026, 0, 10, 3)).s,
    P('minhyun', new Date(2026, 0, 10, 5)).s], ['off', 'off']);
  eq('주말 밤에도 민현은 깨 있다', P('minhyun', new Date(2026, 0, 10, 23)).t, '안 자는 중');
}

/* ── 인물이 자기 상태를 안다 ──
   목록에는 「수업 중」이 떠 있는데 본인은 한가한 사람처럼 즉답했다. 새벽
   세 시의 재언도 멀쩡히 깨어 있는 답을 했다 — 화면이 아는 걸 프롬프트가
   몰랐다. 목록과 같은 함수(presence)의 값을 워커로 보내 [지금] 줄에 얹는다. */
eq('앱이 접속 상태를 보낸다', /payload\.states=st/.test(web), true);
eq('주말은 안 보낸다 — 요일이 이미 실려 있다', /pr\.t!=="주말"/.test(web), true);
{
  const v = (states, place) => buildVolatile('chat', 'minhyun', 'R', null, [], null, { minhyun: 5 },
    null, null, [], 1, place || null, false, '낮', '화요일', states);
  eq('상태가 [지금] 줄에 실린다', v({ minhyun: '수업 중' }).includes('낮 · 이민현: 수업 중'), true);
  eq('모르는 낱말은 안 싣는다 — 틀린 상태보다 없는 편이 낫다',
    v({ minhyun: '게임 중' }).includes('게임 중'), false);
  eq('그 방 사람 것만 싣는다', v({ jaeeon: '보건실', minhyun: '수업 중' }).includes('보건실'), false);
  eq('자리에 같이 있으면 뺀다 — 마주 앉았는데 수업 중이라니',
    v({ minhyun: '수업 중' }, '교실').includes('수업 중'), false);
  eq('단톡방은 둘 다 싣는다', buildVolatile('chat', 'group', 'R', null, [], null, { group: 5 },
    null, null, [], 1, null, false, '낮', '화요일', { jaeeon: '보건실', minhyun: '수업 중' })
    .includes('이재언: 보건실 · 이민현: 수업 중'), true);
  eq('관전방은 안 받는다 — 집이거나 보건실로 못박힌 방이다',
    buildVolatile('auto', 'jaeeon', 'R', null, [], null, null,
      null, null, [], 1, null, false, '낮', '화요일', { minhyun: '수업 중' }).includes('수업 중'), false);
}
/* 「첫날」이 아니라 「첫 주」다. 주말 저녁에 처음 켜는 사람이 있는데
   그날은 첫날이 아니고 애들도 없었다 */
eq('저녁 첫인사는 첫 주라고 한다',
  /첫 주인데 고생하셨어요/.test(readFileSync(join(ROOT, 'docs/dialogue-corpus.md'), 'utf8')), true);
eq('첫날이라고 우기지 않는다',
  /첫날인데 고생하셨어요/.test(readFileSync(join(ROOT, 'demo-lines.js'), 'utf8')), false);

/* 저녁에 처음 켜면 재언의 첫인사는 하루가 끝난 뒤에 온다 — 시제가 바뀐다 */
eq('저녁 첫인사는 지난 일을 묻는다', demo.demoGreetWhen(-1, 'jaeeon', new Date(2026, 0, 6, 19)), '하루 끝 인사');
eq('낮에는 앞일을 짐작한다', demo.demoGreetWhen(-1, 'jaeeon', new Date(2026, 0, 6, 9)), '첫 만남');
/* 민현에게는 그 갈래가 없다. 저녁이면 그는 선톡이 아니라 자리에서 만난다 */
eq('민현은 시각을 안 본다', demo.demoGreetWhen(-1, 'minhyun', new Date(2026, 0, 6, 19)), '첫 만남');
/* 절 이름에 「첫인사」나 「첫 만남」이 들어가면 고르는 쪽이 indexOf라 딸려 나온다 */
eq('새 절 이름이 기존 이름과 안 겹친다',
  ['첫인사', '첫 만남', '오랜만'].filter(n => '하루 끝 인사'.indexOf(n) >= 0), []);

/* ── 선물은 한 사람에게 하루에 하나 ──
   새벽 2시 43분에 이어폰, 2시 48분에 사진집. 같은 사람이 오 분 만에 같은
   반응을 두 번 했다 — 밀어내고, 값어치를 인정하고, 받고, 그러고 나서 고맙다고.
   한 번이면 그 사람이고 두 번이면 틀이다. 모델이 아니라 간격의 문제였다.
   막는 건 한 사람이 하루에 두 번 받는 것이지, 하루에 두 명에게 주는 게 아니다 */
eq('선물 몫은 사람마다 따로 센다',
  /const giftedToday=\(char,now\)=>loadGiftDay\(\)\[char\]===dayKey\(now\)/.test(web), true);
eq('한쪽에 줘도 다른 쪽 몫은 남는다',
  /const stampGift=\(char,now\)=>giftedToday\(char,now\)\|\|saveGiftDay\(\{\.\.\.loadGiftDay\(\),\[char\]:dayKey\(now\)\}\)/.test(web), true);
/* 선물 몫도 새벽 다섯 시에 넘어간다 — 저 이어폰과 사진집이 같은 날로
   묶여야 이 규칙에 걸린다. 자정 기준이면 둘 다 통과한다 */
eq('선물 몫도 새벽 다섯 시에 넘어간다', /giftedToday=\(char,now\)=>loadGiftDay\(\)\[char\]===dayKey/.test(web), true);
/* 창에서만 막으면 자물쇠가 아니다 — 주는 길이 둘이면 둘 다 잠가야 한다 */
eq('보내는 쪽에서도 막는다',
  /if\(giftedToday\(char\)\)\{ setToast\(`\$\{CHARS\[char\]\.name\} — one a day ♡`\); return \}/.test(web)
  && /\{op:"stampGift",char\}/.test(web), true);
eq('창에서도 막는다', /shut=done\|\|today\(c\)/.test(web), true);
/* 눌렀는데 아무 일도 안 일어나는 것보다 왜 안 되는지 적어주는 편이 낫다.
   한쪽만 잠긴 날에도 규칙은 알려준다 */
eq('왜 안 되는지 적어준다',
    /className="cshut">one a day ♡ each</.test(web) && /\.cshut\{/.test(web), true);
/* 이미 준 물건과 오늘 몫이 나간 것은 다른 이유다. 같은 회색 단추를 쓰되
   글자는 달라야 한다 — 「SENT」는 이 물건 얘기고 「TOMORROW」는 오늘 얘기다 */
eq('이미 준 것과 오늘 몫은 다른 말이다',
  /\{done\?"SENT ♡":today\(c\)\?"TOMORROW ♡"/.test(web), true);

/* 사진이 매 턴 나가면 사진첩이 아니라 슬라이드쇼다 */
demo.demoReset();
eq('사진을 연달아 보내지 않는다',
  ['밥 먹었어요?', '커피 마셨어요?', '사탕 있어요?'].map(q =>
    demo.demoAnswer('jaeeon', q, '윤하').some(m => m.photo)).filter(Boolean).length, 1);
/* 엔진이 부르는 사진 키가 클라이언트 사진첩에 실제로 있어야 한다.
   없는 키를 부르면 말만 남고 사진은 조용히 사라진다. */
const galleryKeys = [...web.matchAll(/"(jaeeon|minhyun)-[\w-]+\.webp"/g)].map(m => m[0].slice(1, -6));
const usedKeys = [...demo.DEMO_PIC.map(p => [p[1], p[2]]).flat(),
                  ...Object.values(demo.DEMO_PIC_ANY).flat()].filter(Boolean);
eq('데모가 부르는 사진이 전부 사진첩에 있다',
  usedKeys.filter(k => !galleryKeys.includes(k)), []);
/* 해금도 서버가 세어준다. 데모에는 서버가 없으니 같은 기준으로 센다 */
eq('데모에서도 .hidden이 열린다',
  /demoUnlocked/.test(web) && /h\.at/.test(appSrc), true);

/* 셀카. 민현만 보내고, 가까워지기 전에는 아낀다 — 처음부터 주면 그건
   셀카가 아니라 프로필 사진이다. 재언은 안 찍는 사람이라 대신 오라고 한다. */
const selfieFar = demo.demoAnswer('minhyun', '셀카 보여', '윤하', { close: false });
const selfieNear = demo.demoAnswer('minhyun', '셀카 보여', '윤하', { close: true });
eq('가까워지기 전에는 셀카를 안 보낸다', selfieFar.some(m => m.photo), false);
eq('가까워지면 보낸다', selfieNear.some(m => m.photo), true);
eq('보낼 때도 말이 먼저 나온다', selfieNear[0].text.length > 0, true);
eq('재언은 셀카를 안 보낸다',
  demo.demoAnswer('jaeeon', '셀카 보여', '윤하', { close: true }).some(m => m.photo), false);
eq('재언은 대신 오라고 한다',
  /보러 와요|가서 보여줄게요|보내줄게요|민현이한테/
    .test(demo.demoAnswer('jaeeon', '셀카 보내줘', '윤하').map(m => m.text).join(' ')), true);
['셀카 보여', '셀카 보내', '셀카 볼래', '셀카 줘', '얼굴 좀 보여줘'].forEach(t =>
  eq(`"${t}"를 셀카로 알아듣는다`, demo.DEMO_SELFIE_RE.test(t), true));
/* 가까움 판단이 웹·앱에서 같아야 한다. 어긋나면 한쪽에서만 사진이 온다 */
eq('가까움 기준이 웹·앱 같다',
  [/>=\s*40/.test(web), />=\s*40/.test(appSrc)], [true, true]);

/* 캐릭터가 먼저 거는 말. 만들어만 두고 아무 데서도 안 부르면 없는 것과 같다 */
eq('재언이 아침에 먼저 건다', demo.demoProactive('jaeeon', '아침', '윤하').length > 0, true);
eq('민현이 밤에 먼저 건다', demo.demoProactive('minhyun', '밤', '윤하').length > 0, true);
/* 상황 이름은 두 사람 문구집에 다 있어야 한다. 한쪽에만 있으면
   다른 한쪽은 아무거나 고른다 */
['아침', '밤', '몇 시간 뒤', '하루 뒤', '며칠 뒤', '별일 없는 날'].forEach(w =>
  eq(`"${w}"이 두 사람 다 있다`,
    ['jaeeon', 'minhyun'].every(c => C.proactive[c].some(p => (p.when + p.sec).includes(w))), true));
eq('아침에는 아침 얘기를 고른다', demo.demoWhen(10, 8), '아침');
eq('오래 안 왔으면 그 얘기를 먼저 한다', demo.demoWhen(60 * 30, 14), '하루 뒤');
/* 방금 깐 사람한테 며칠이나 지났는지 아냐고 물으면 안 된다 */
eq('처음 온 사람에게 오랜만이라고 하지 않는다', demo.demoWhen(-1, 14), '별일 없는 날');
eq('방을 열면 먼저 건다 — 웹·앱 둘 다',
  /demoGreet/.test(web) && /demoGreet/.test(appSrc), true);

/* 이름은 등록 화면에서 받아둔 걸 그대로 쓴다 */
eq('데모도 유저 이름을 부른다', /윤하/.test(said('jaeeon', '커피만 드시지 말고요')), true);

/* 손으로 쓴 대사가 통합본에 들어왔다. 다음 판에서 빠지면 여기서 걸린다 */
[['jaeeon', '약 열심히 발랐어요', '착하다'],
 ['jaeeon', '선생님 저 어디서 본 적 있어요?', '난 모르겠는데'],
 ['jaeeon', '선생님도 좀 쉬세요', '일하는 줄 알았구나'],
 ['minhyun', '담배 아직 안 피우지?', '책임은 언제 져요'],
 ['minhyun', '너 나 왜 좋아해?', '피치 못하는 거지'],
 ['minhyun', '너 왜 자꾸 보건실에 있어', '다른 사람 때문에']].forEach(([r, q, want]) => {
  /* 한 의도에 답이 여럿이라 한 번 불러서 그 줄이 나오길 기다리면 안 된다.
     여러 번 불러도 안 된다 — 같은 말을 두 번 보내면 반복 갈래로 새기 때문이다.
     그래서 둘로 나눠 본다. 그 줄이 아직 문구집에 있나, 그리고 이 입력이
     그 의도로 가나. 무작위가 안 끼므로 매번 같은 답이 나온다. */
  demo.demoReset();
  const e = C.intents.find(x => x.q.includes(q));
  const answers = ((e && e[r]) || []).map(x => x.join(' | '));
  eq(`손으로 쓴 "${want}"가 제자리에서 나온다`,
    answers.some(a => a.includes(want)) && answers.includes(said(r, q)), true);
});

/* 같은 말을 반복해도 같은 답만 나오지 않는다 */
const three = [0, 1, 2].map(() => said('jaeeon', '뭐 해요?'));
eq('같은 말을 반복해도 답이 돌아간다', new Set(three).size > 1, true);

/* 입력 정규화 — 같은 말인데 형태만 다른 것을 하나로 모은다 */
eq('ㅋ는 넉 자로 줄인다', demo.demoNorm('ㅋㅋㅋㅋㅋㅋㅋㅋ'), 'ㅋㅋㅋㅋ');
eq('물음표 반복은 하나로', demo.demoNorm('왜???'), '왜?');
eq('흔한 오타를 같은 말로 본다', demo.demoNorm('어떻해'), '어떡해');

/* 웹과 앱이 같은 데서 나온다. 어긋나면 두 클라이언트가 다른 말을 한다 */
const appDemo = readFileSync(join(ROOT, 'app/lib/demoLines.ts'), 'utf8');
eq('앱 데모가 웹과 같은 대사를 쓴다',
  appDemo.includes(demoSrc.slice(demoSrc.indexOf('var DEMO_CORPUS'),
    demoSrc.indexOf('var DEMO_CORPUS') + 200000).split('\nvar DEMO_TYPO')[0]), true);
eq('생성된 파일이라고 적어둔다',
  /자동 생성/.test(demoSrc) && /자동 생성/.test(appDemo), true);

/* ── 앱과 웹이 같은 규칙을 읽는다 ──
   전에는 앱이 표를 손으로 베껴 들고 있었다. 그래서 웹에 지도가 생기고 자리가
   생기고 점심이 생기는 동안 앱은 옛 규칙에 머물렀다 — 같은 이름을 단 다른
   물건이 됐고, 앱의 재언은 주말에도 보건실에 앉아 있었다.
   이제 app-data.js 하나가 원본이고 tools/build-rules.mjs가 app/lib/rules.ts를
   만든다. 문구집(build-demo.mjs)에서 이미 쓰던 방식이다. */
{
  const rules = readFileSync(join(ROOT, 'app/lib/rules.ts'), 'utf8');
  const data = readFileSync(join(ROOT, 'app-data.js'), 'utf8');
  eq('규칙 파일은 만들어진 것이라고 적어둔다',
    /손으로 고치지 않는다/.test(rules) && /build-rules\.mjs/.test(rules), true);
  /* 낡으면 조용히 갈라진다 — 생성기를 다시 돌린 결과와 파일이 같아야 한다.
     app-data.js를 고치고 생성기를 안 돌리면 여기서 걸린다. */
  eq('규칙 파일이 최신이다 (node tools/build-rules.mjs)', (() => {
    const body = data.replace(/^const \{useState,useEffect,useRef\} = React;\s*$/m, '');
    const strip = t => t.replace(/^const \{useState,useEffect,useRef\} = React;\s*$/m, '')
      .replace(/\/\* \(훅을 꺼내 쓰던 줄은 앱에서 뺀다 — 여기는 규칙만 산다\) \*\//, '');
    return strip(rules).includes(strip(body).trim().slice(0, 4000));
  })(), true);
  /* 앱이 규칙을 다시 적으면 그 순간부터 두 판이 된다 */
  eq('앱이 규칙을 다시 적지 않는다',
    ['function presence(', 'const ROOMS = [', 'const ENROLL_DAYS =', 'const AUTO_AWAY=',
     'const DDAY_MARKS=', 'const PHOTO_EVENT_AT='].filter(t => appSrc.includes(t)), []);
  eq('앱이 규칙 파일에서 가져다 쓴다', /from '\.\/lib\/rules'/.test(appSrc), true);
  /* 규칙이 딛고 서는 브라우저 것 둘을 앱이 만들어 준다 */
  const shim = readFileSync(join(ROOT, 'app/lib/shim.ts'), 'utf8');
  eq('앱이 localStorage와 location을 만들어 준다',
    /g\.localStorage *=/.test(shim) && /g\.location *=/.test(shim), true);
  /* 켤 때 한 번 통째로 읽어야 규칙이 저장된 값을 본다 — 안 하면 첫날처럼 보인다 */
  eq('켤 때 저장소를 메모리로 올린다',
    /await hydrateShim\(\)/.test(appSrc) && /getAllMeta/.test(shim), true);
  eq('리스타트하면 그 메모리도 비운다', /resetShim\(\)/.test(appSrc), true);

  /* ── 진짜로 불러지는가 ──
     한 번은 파일 끝에서 `export const {AV_V,...} = __rules`로 풀었는데, 위에
     이미 `const AV_V`가 있어서 같은 이름을 두 번 선언한 게 됐다. 앱이 아예
     안 켜졌는데 @ts-nocheck 때문에 타입 검사는 통과했다 — 불러봐야만 나오는
     종류다. 최상위에서 같은 이름이 두 번 선언되는지 본다. */
  eq('규칙 파일이 같은 이름을 두 번 선언하지 않는다', (() => {
    if (!__parse) return [];   // 파서가 없으면 건너뛴다
    /* 글자로 세면 함수 안의 선언까지 최상위로 친다 — 파서로 진짜 최상위만 본다 */
    const ast = parseTS(rules);
    const top = [];
    const take = d => {
      if (d.type === 'FunctionDeclaration' && d.id) top.push(d.id.name);
      if (d.type === 'VariableDeclaration') for (const v of d.declarations) {
        if (v.id.type === 'Identifier') top.push(v.id.name);
        if (v.id.type === 'ObjectPattern') for (const pr of v.id.properties)
          if (pr.value && pr.value.type === 'Identifier') top.push(pr.value.name);
      }
    };
    for (const node of ast.program.body) {
      take(node);
      if (node.type === 'ExportNamedDeclaration' && node.declaration) take(node.declaration);
    }
    return top.filter((n, i) => top.indexOf(n) !== i).slice(0, 5);
  })(), []);
  /* 규칙이 함수 안에 들어가 있어야 위 선언들이 내보내기와 안 부딪힌다 */
  eq('규칙은 함수 안에 산다', /function __build\(\): any \{/.test(rules), true);

  /* ── 글자가 아니라 답으로 대조한다 ──
     같은 파일에서 나왔다는 것만으로는 부족하다 — 생성기가 뭔가 흘렸으면
     조용히 다른 세계가 된다. 두 파일을 각각 돌려서 하루를 통째로 훑고
     같은 답이 나오는지 본다(평일·주말 × 24시각). */
  eq('웹과 앱의 규칙이 같은 답을 낸다', (() => {
    const box = () => {
      const mem = new Map();
      return { localStorage: { getItem: k => mem.has(k) ? mem.get(k) : null,
        setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() },
        location: { search: '' } };
    };
    const run = (src, names) => {
      const g = box();
      return new Function('localStorage', 'location', src + '\nreturn {' + names.join(',') + '};')
        (g.localStorage, g.location);
    };
    const NAMES = ['presence', 'placeHours', 'whoOut', 'openingFor', 'canGreet', 'jos',
      'groupReady', 'PLACES', 'placeWhen', 'wendOnlyOk'];
    const webBody = readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '');
    /* 규칙은 함수(__build) 안에 산다. 그 함수를 불러 받은 것으로 견준다 */
    /* 자를 자리는 «바꾼 뒤»의 글에서 찾아야 한다 — 원본 자리로 자르면
       길이가 달라져 export 줄이 남고, new Function이 그 자리에서 터진다 */
    const appBody = (() => {
      const t = rules.replace(/^\/\/ @ts-nocheck$/m, '').replace(/^import '\.\/shim';.*$/m, '')
        .replace(/: any/g, '');
      return t.slice(0, t.indexOf('const __rules'));
    })();
    const W = run(webBody, NAMES);
    const A = new Function('localStorage', 'location', appBody + '\nreturn __build();')
      (box().localStorage, box().location);
    const diff = [];
    const cmp = (label, f) => {
      const R0 = Math.random;   // 주말 오프닝은 뽑기다 — 같은 눈으로 고정해야 견줄 수 있다
      Math.random = () => 0.42; const a = JSON.stringify(f(W));
      Math.random = () => 0.42; const b = JSON.stringify(f(A));
      Math.random = R0;
      if (a !== b) diff.push(label);
    };
    for (const [wd, dd] of [['화', 6], ['토', 10]]) for (let h = 0; h < 24; h++) {
      const d = new Date(2026, 0, dd, h, 30);
      cmp(`presence ${wd}${h}`, R => ['jaeeon', 'minhyun'].map(id => R.presence(id, d)));
      cmp(`whoOut ${wd}${h}`, R => R.whoOut(d));
      cmp(`canGreet ${wd}${h}`, R => ['jaeeon', 'minhyun'].map(id => R.canGreet(id, d)));
      cmp(`openingFor ${wd}${h}`, R => { const o = R.openingFor(d); return o && [o.place, o.room]; });
      for (let i = 0; i < W.PLACES.length; i++)
        cmp(`${W.PLACES[i].name} ${wd}${h}`, R => [R.placeHours(R.PLACES[i], d), R.wendOnlyOk(R.PLACES[i], d)]);
    }
    for (const w of ['교실', '옥상', '레코드샵', '학교', '집'])
      cmp(`jos ${w}`, R => [R.jos(w, '으로/로'), R.jos(w, '을/를'), R.jos(w, '과/와')]);
    return diff.slice(0, 5);
  })(), []);
}

/* ── get cha — 첫 만남이 끝나면 그 사람의 메신저가 생긴다 ──
   방이 왜 생겼는지를 이 창 하나가 맡는다. 판마다 사람마다 한 번뿐이고,
   말하는 중에 덮으면 그 자리를 못 읽으므로 첫 마디가 다 앉은 뒤에 뜬다. */
{
  const box = () => {
    const mem = new Map();
    return { localStorage: { getItem: k => mem.has(k) ? mem.get(k) : null,
      setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() },
      location: { search: '' } };
  };
  const g = box();
  const D = new Function('localStorage', 'location',
    readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
    + '\nreturn {loadGetcha,saveGetcha};')(g.localStorage, g.location);
  eq('처음에는 아무도 안 받았다',
    [D.loadGetcha('minhyun'), D.loadGetcha('jaeeon')], [false, false]);
  D.saveGetcha('minhyun');
  eq('받은 사람만 적힌다',
    [D.loadGetcha('minhyun'), D.loadGetcha('jaeeon')], [true, false]);
  D.saveGetcha('minhyun'); D.saveGetcha('jaeeon');
  eq('두 번 적어도 한 번이다',
    JSON.parse(g.localStorage.getItem('null_getcha')), ['minhyun', 'jaeeon']);
  /* 깨진 값이 들어 있어도 창이 안 뜨는 쪽으로 죽지 않는다 */
  g.localStorage.setItem('null_getcha', '{{{');
  eq('깨진 값은 「아직 안 받음」이다', D.loadGetcha('minhyun'), false);

  const app = readFileSync(join(ROOT, 'app.js'), 'utf8');
  const ui = readFileSync(join(ROOT, 'app-ui.js'), 'utf8');
  const css = readFileSync(join(ROOT, 'null.css'), 'utf8');
  eq('오프닝이 아직 안 받은 사람만 예약한다',
    /if\(!loadGetcha\(o\.room\)\)getchaRef\.current=o\.room;/.test(app), true);
  /* ── 창은 자리에서 **나올 때** 뜬다 ──
     말풍선이 다 앉는 것은 오프닝이 끝난 게 아니다. 그때는 아직 그 사람과
     마주 서 있다 — 번호는 헤어지면서 주고받는 것이다. 자리를 닫는 길이
     여럿이라(나가기·귀갓길·자리 이동·시간 끝) 닫는 자리 한 곳에서 잡는다. */
  eq('첫 자리가 닫히는 순간에 연다',
    /const sceneClosed=sc=>\{\s*\n\s*if\(!sc\|\|getchaRef\.current!==sc\.room\)return;/.test(app), true);
  eq('열면서 적어둔다 — 새로고침으로 다시 안 뜬다',
    /getchaRef\.current=null;\s*\n\s*saveGetcha\(sc\.room\); setGetcha\(sc\.room\);/.test(app), true);
  eq('창이 화면에 붙어 있다', /\{getcha&&<GetCha char=\{getcha\} onClose=/.test(app), true);
  /* 토스트(45)가 대화창(40) 위에 뜨는 건 그대로 두고, 이 창일 때만 미룬다 */
  eq('창이 떠 있는 동안 알림은 세워둔다',
    /if\(!toast\|\|getcha\)return;/.test(app)
    && /\{toast&&!getcha&&<div className="toast">/.test(app), true);
  eq('창은 인물 이름을 CHARS에서 읽는다',
    /function GetCha\(\{char,onClose\}\)/.test(ui)
    && /\(CHARS\[char\]\|\|\{\}\)\.name/.test(ui), true);
  eq('문구는 정해진 한 줄이다',
    ui.includes('의 메신저를') && ui.includes('Get cha!')
    && ui.includes('( ⸝⸝´꒳`⸝⸝) ꫂ 💌'), true);
  /* .wbtn이 뒤에 나와서 한 클래스로는 진다 — 두 클래스로 못박아야 분홍이다 */
  eq('단추 색이 .wbtn에 안 먹힌다', /\.wbtn\.gcbtn\{/.test(css), true);
  eq('이 창만 어둡다', /\.dlg\.getcha\{background:linear-gradient\(180deg,#3d3170,#2b2352\)/.test(css), true);
}

/* ── 아직 출근하지 않은 사람 ──
   첫 자리에서 만난 사람의 방만 열린다. 다른 한 사람은 학교에서 만나야
   하는데 교생 실습이 월요일부터라 주말에는 그 자리가 없다. */
{
  const box = () => {
    const mem = new Map();
    return { localStorage: { getItem: k => mem.has(k) ? mem.get(k) : null,
      setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() },
      location: { search: '' } };
  };
  const g = box();
  const D = new Function('localStorage', 'location',
    readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
    + '\nreturn {roomLock,atWorkNow,presence,LOCK_LINES,SOON_LINES,WAIT_LINES};')(g.localStorage, g.location);
  const at = (dd, h) => new Date(2026, 0, dd, h, 30);
  const SAT = at(10, 14), TUE = at(6, 14);                 // 토요일 / 화요일 낮
  const empty = { msgs: {} };
  const talked = { msgs: { jaeeon: [{ sender: 'jaeeon', text: '왔어요?', ts: 1 }] } };
  /* 학교에 있는 동안에만 먼저 건다 — AT_WORK(보건실·수업 중·점심·야자) */
  eq('평일 낮에는 둘 다 학교에 있다',
    ['jaeeon', 'minhyun'].map(id => D.atWorkNow(id, TUE)), [true, true]);
  eq('주말에는 아무도 학교에 없다',
    ['jaeeon', 'minhyun'].map(id => D.atWorkNow(id, SAT)), [false, false]);
  /* 잠금 까닭이 셋이다 — 실습 전(주말) · 오늘 이따 · 오늘은 지났다.
     새벽 세 시에 「내일 만나요」는 틀린 말이라 출근 전과 퇴근 뒤를 가른다 */
  eq('주말 빈 방 — 실습이 아직이다', D.roomLock(empty, 'jaeeon', SAT), D.LOCK_LINES);
  eq('평일 낮 빈 방은 안 잠긴다', D.roomLock(empty, 'jaeeon', TUE), null);
  eq('출근 전에는 이따 만난다',
    [at(6, 3), at(6, 7)].map(d => D.roomLock(empty, 'jaeeon', d)),
    [D.SOON_LINES, D.SOON_LINES]);
  eq('퇴근 뒤에는 내일 만난다',
    [at(6, 17, 30), at(6, 23)].map(d => D.roomLock(empty, 'jaeeon', d)),
    [D.WAIT_LINES, D.WAIT_LINES]);
  /* 두 사람의 창이 다르다 — 재언은 퇴근까지, 민현은 야자까지.
     단 야자가 붙는 날이라야 그렇다. 1월 15일이 야자 주의 목요일이다 */
  eq('야자 날에는 재언이 퇴근해도 민현은 학교다',
    [D.roomLock(empty, 'jaeeon', at(15, 17)), D.roomLock(empty, 'minhyun', at(15, 17))],
    [D.WAIT_LINES, null]);
  /* 야자는 격주 목요일에만 붙는다. 없는 날 저녁에는 민현도 학교에 없다 —
     전에는 생활 리듬이 평일 저녁을 통째로 「야자」라고 불러서, 야자도 없는
     화요일 저녁에 안 만난 민현의 방이 열리고 선톡이 나갔다 */
  eq('야자 없는 평일 저녁에는 민현도 내일 만난다',
    [D.roomLock(empty, 'minhyun', at(6, 17)), D.roomLock(empty, 'minhyun', at(6, 20)),
     D.roomLock(empty, 'minhyun', at(8, 20))],
    [D.WAIT_LINES, D.WAIT_LINES, D.WAIT_LINES]);
  /* 시간표와 생활 리듬이 같은 날을 센다 — 이게 갈리면 위가 다시 어긋난다 */
  eq('야자 날을 한 군데서 센다',
    /const isYajaDay=\(now\)=>\{const d=now\|\|nowClock\(\);return d\.getDay\(\)===4&&isYajaWeek\(d\)\};/.test(web)
    && /if\(isYajaDay\(d\)\) return \{s:"on",  t:"야자"\};/.test(web)
    && /return DAY_SLOTS\.filter\(s=>s\.k!=="야자"\|\|isYajaDay\(d\)\);/.test(web), true);
  /* 말이 한 마디라도 오갔으면 이미 만난 것이다 — 밤에도 주말에도 안 잠긴다 */
  eq('만난 방은 언제든 안 잠긴다',
    [D.roomLock(talked, 'jaeeon', SAT), D.roomLock(talked, 'jaeeon', at(6, 3))], [null, null]);
  /* 단톡·관전은 제 조건(groupReady)이 따로 있다 */
  eq('단톡·관전은 여기 안 걸린다',
    [D.roomLock(empty, 'group', SAT), D.roomLock(empty, 'health', SAT)], [null, null]);
  eq('화면에 설 두 줄이 까닭마다 정해져 있다', [D.LOCK_LINES, D.SOON_LINES, D.WAIT_LINES],
    [['아직 출근하지 않았어요 ૮ ⸝⸝o̴̶̷᷄ ·̭ o̴̶̷̥᷅⸝⸝ ྀིა', '교생 실습은 월요일부터 ♡'],
     ['이따 만나요 ᜊ(੭ ˊ ᵕˋ)੭ : ﾟ.+', '조금만 기다려 ♡'],
     ['내일 만나요 ᜊ(੭ ˊ ᵕˋ)੭ : ﾟ.+', '조금만 기다려 ♡']]);

  const app = readFileSync(join(ROOT, 'app.js'), 'utf8');
  const ui = readFileSync(join(ROOT, 'app-ui.js'), 'utf8');
  const css = readFileSync(join(ROOT, 'null.css'), 'utf8');
  eq('방을 열 때 잠금이 같이 간다', /locked=\{roomLock\(store,view\)\}/.test(app), true);
  /* 방을 감추지 않는다 — 이 사람이 없는 게 아니라 아직 안 온 것이다.
     까닭은 화면 한가운데가 말한다(빈 방 안내와 같은 자리·같은 보라색) */
  /* 잠금 여부와 까닭이 한 자리에서 나온다 — 둘로 나누면 어긋난다 */
  eq('잠긴 방은 한가운데에 이유가 선다',
    /\{locked\?<div className="empty lockempty">\s*\n\s*\{locked\.map/.test(ui), true);
  /* 입력창은 자리를 지킨 채 잠긴다 — 빼버리면 방마다 화면 높이가 달라진다 */
  eq('입력창은 자리를 지키고 잠긴다',
    /className=\{"inputbar"\+\(locked\?" locked":""\)\}/.test(ui)
    && /disabled=\{!!locked\}/.test(ui)
    && /disabled=\{!!locked\|\|!v\.trim\(\)\|\|busy\}/.test(ui), true);
  eq('잠긴 입력창은 눌러도 안 써진다', /\.inputbar\.locked \.sunken\{/.test(css), true);

  /* ── 앱도 같은 규칙을 쓴다 ──
     규칙은 rules.ts로 건너가지만 화면은 앱이 따로 그린다. 한쪽만 고쳐지면
     같은 세계가 두 앱에서 다르게 군다 — 그게 이 파일이 있는 이유다. */
  const app2 = readFileSync(join(ROOT, 'app/App.tsx'), 'utf8');
  const dlg = readFileSync(join(ROOT, 'app/screens/Dialogs.tsx'), 'utf8');
  eq('앱도 같은 rules에서 잠금을 읽는다',
    /roomLock, loadGetcha, saveGetcha,\n(?:  .*\n)*\} from '\.\/lib\/rules'/.test(app2), true);
  eq('앱도 거는 길 넷을 다 막는다', [
    /if\(canGreet\(other\)&&!roomLock\(msgsForFlow\(\),other\)\)/.test(app2),   // 첫 자리
    /if\(roomLock\(msgsForFlow\(\),id\)\)return;/.test(app2),                   // greet 안쪽
    /\.filter\(id=>!roomLock\(msgsForFlow\(\),id\)\)/.test(app2),               // 추첨
    /if\(roomLock\(msgsForFlow\(\),id\)\) return;/.test(app2),                 // 방 열기
  ], [true, true, true, true]);
  eq('앱도 한가운데에 이유가 서고 입력창은 자리를 지킨다',
    /\{locked\.join\('\\n'\)\}/.test(app2)
    && /editable=\{!locked\}/.test(app2)
    && /disabled=\{!!locked\|\|!text\.trim\(\)\|\|typing\}/.test(app2), true);
  /* 앱의 오프닝은 await가 있어 순서가 글에 보인다 — 웹의 busy 감시와 같은 뜻 */
  /* 앱도 자리에서 나올 때 연다 — 이름만 걸어두고 putScene(null)이 연다 */
  eq('앱도 첫 자리에서 이름만 걸어둔다',
    /if\(!loadGetcha\(o\.room\)\) getchaRef\.current=o\.room;/.test(app2), true);
  eq('앱은 자리가 닫힐 때 연다',
    /if\(!v&&getchaRef\.current\)\{[\s\S]{0,240}saveGetcha\(who\); setGetcha\(who\);/.test(app2), true);
  eq('앱 창의 문구가 웹과 같다',
    dlg.includes('의 메신저를') && dlg.includes('Get cha!')
    && dlg.includes('( ⸝⸝´꒳`⸝⸝) ꫂ 💌') && dlg.includes('chat ♡'), true);
  eq('앱도 창이 떠 있는 동안 알림을 세워둔다', /\{toast&&!getcha&&<View/.test(app2), true);

  /* 그 규칙은 세계관 호칭 절에 있다 — 조건부 덩어리는 걷어냈다.
     같은 말을 두 군데에 두면 한쪽만 고쳐질 때 두 세계가 된다. */
  eq('규칙이 한 군데에만 있다', (() => {
    const w = ENG.buildSystem('chat', 'minhyun', '연', null, [], null, null, null, null, null, 3, '');
    const all = w.map(x => x.text).join('');
    return (all.match(/처음부터 교생인 걸 아는 게 아니라/g) || []).length;
  })(), 1);
  /* 둘 다 오는 자리는 유저가 고른다. 안 물으면 코드가 「말 많이 나눈 쪽」으로
     대신 고르는데 유저는 그 규칙을 볼 수 없다. 우연히 마주치는 자리
     (meet:"out")는 안 묻는 게 맞다 — 그게 그 자리의 성격이라서. */
  eq('둘 다 오는 자리만 누구랑 갈지 묻는다', (() => {
    const box2 = () => { const mem = new Map();
      return { getItem: k => mem.has(k) ? mem.get(k) : null,
        setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } };
    const D = new Function('localStorage', 'location',
      readFileSync(join(ROOT, 'app-data.js'), 'utf8')
        .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
      + '\nreturn {PLACES};')(box2(), { search: '' });
    const pick = D.PLACES.filter(p => p.pick).map(p => p.name).sort();
    const two = D.PLACES.filter(p => !p.into && (p.who || []).length === 2 && p.meet !== 'out')
      .map(p => p.name).sort();
    return [pick, two];
  })(), [['도서관', '레코드샵', '옥상'], ['도서관', '레코드샵', '옥상', '집']]);

  /* 세계가 언제 시작하는지가 제일 앞줄이다 — 뒤에 오는 조건절이 그걸 본다 */
  eq('첫 문장이 세계의 시작을 적는다', (() => {
    const w = ENG.buildSystem('chat', 'minhyun', '연', null, [], null, null, null, null, null, 3, '')[0].text;
    return w.trim().split('\n')[0].trim();
  })(), '유저의 첫 입력이 세계의 시작이다.');
  eq('세계관 호칭 절이 그대로다', (() => {
    const w = ENG.buildSystem('chat', 'minhyun', '연', null, [], null, null, null, null, null, 3, '')[0].text;
    return w.includes('학교가 아닌 장소에서 세계가 시작될 경우 유저를 "선생님"이라고 부르지 않는다.')
      && w.includes('한 번 부른 이후에는 자연스럽게 부르면 된다.');
  })(), true);

  /* ── 학교에서 만난 뒤부터 교생인 걸 안다 ──
     찍는 자리가 둘이다: 학교 안 자리에서 마주 앉을 때, 그리고 그 사람이
     학교에서 첫 연락을 걸 때. 웹·앱 양쪽에 다 있어야 한다. */
  const D2 = new Function('localStorage', 'location',
    readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
    + '\nreturn {loadStory,markSchoolMet,isSchoolPlace};')(box().localStorage, box().location);
  eq('처음에는 아무도 학교에서 안 만났다',
    D2.loadStory().schoolMet, { jaeeon: false, minhyun: false });
  D2.markSchoolMet('jaeeon');
  eq('만난 사람만 선다', D2.loadStory().schoolMet, { jaeeon: true, minhyun: false });
  D2.markSchoolMet('jaeeon');
  eq('되풀이해도 같다', D2.loadStory().schoolMet, { jaeeon: true, minhyun: false });
  eq('학교 안 자리가 다섯이다',
    ['학교', '교실', '보건실', '옥상', '체육관', '편의점', '도서관', '빨래방', '레코드샵', '집']
      .filter(p => D2.isSchoolPlace(p)), ['학교', '교실', '보건실', '옥상', '체육관']);
  eq('웹이 두 자리에서 찍는다',
    /if\(isSchoolPlace\(o\.scene\.place\)\)markSchoolMet\(o\.scene\.room\);/.test(web)
    && /if\(!list\.length&&atWorkNow\(id\)\)markSchoolMet\(id\);/.test(web), true);
  eq('앱도 두 자리에서 찍는다',
    /if\(v&&isSchoolPlace\(v\.place\)\)markSchoolMet\(v\.room\);/.test(app2)
    && /if\(!\(\(msgs as any\)\[id\]\|\|\[\]\)\.length&&atWorkNow\(id\)\)markSchoolMet\(id\);/.test(app2), true);
  /* 첫 자리가 학교 안이면(보건실) 거기서 안다. 밖이면 모른다 */
  eq('첫 자리도 학교면 찍는다',
    /if\(isSchoolPlace\(o\.place\)\)markSchoolMet\(o\.room\);/.test(web)
    && /if\(isSchoolPlace\(o\.place\)\)markSchoolMet\(o\.room\);/.test(app2), true);
  /* 방을 여는 것도 선톡 경로다 — 여기를 안 막으면 「아직 출근하지
     않았어요」 위에 타이핑 표시가 뜬다 */
  eq('잠긴 방은 열어도 말이 안 온다',
    /if\(roomLock\(storeRef\.current,id\)\)return;/.test(app), true);
  /* 재언 방은 옛 일기가 먼저다 — 선톡을 먼저 걸면 말이 도착한 방 위에 종이가
     덮여서, 첫 마디를 못 읽은 채로 일기를 읽게 된다 */
  eq('재언 방은 일기가 선톡보다 앞이다',
    /if\(id==="jaeeon"&&!loadDiary\(\)\)return setDiary\(true\);\s*\n\s*greet\(id,700\)/.test(app), true);
  eq('덮으면 그때 선톡이 걸린다',
    /const diaryDone=\(\)=>\{setDiary\(false\);greet\("jaeeon",700\)\}/.test(app), true);
  /* 선톡은 두 길로 나간다 — 방을 열 때, 그리고 목록의 추첨. 방 여는 쪽만
     막으면 추첨이 먼저 걸려서 그의 첫 마디를 읽은 뒤에 일기가 뜬다. */
  eq('추첨도 재언의 첫 마디를 붙잡는다',
    /if\(id==="jaeeon"&&!list\.length&&!loadDiary\(\)\)return;/.test(app), true);
  /* 첫 마디만 잡는다 — 이미 말이 오간 방은 평소대로다 */
  eq('이미 말이 오간 방은 안 막는다', /!list\.length&&!loadDiary\(\)/.test(app), true);
  /* 앱도 같은 순서다 — 두 판이 갈리면 뒤에 오는 쪽이 이긴다 */
  eq('앱도 일기가 선톡보다 앞이다',
    /if\(id==='jaeeon'&&!loadDiary\(\)\) return setDiary\(true\);/.test(app2), true);
  eq('앱도 덮으면 그때 선톡이 걸린다',
    /const diaryDone=\(v:string\)=>\{ saveDiary\(v\); setDiary\(false\); greet\('jaeeon',700\) \}/.test(app2), true);
  eq('앱의 추첨도 첫 마디를 붙잡는다',
    /if\(id==='jaeeon'&&!\(\(msgs as any\)\[id\]\|\|\[\]\)\.length&&!loadDiary\(\)\)return;/.test(app2), true);
  /* 앱도 잠긴 방에는 안 띄운다 — 잠금이 일기보다 앞이다 */
  eq('앱도 잠긴 방에는 안 띄운다',
    app2.indexOf("if(roomLock(msgsForFlow(),id)) return;")
      < app2.indexOf("if(id==='jaeeon'&&!loadDiary()) return setDiary(true);"), true);
  /* 두 화면의 글월은 규칙 파일 하나에서 온다 — 베껴 적으면 어긋난다 */
  eq('앱은 문안을 규칙 파일에서 가져온다',
    /DIARY_HEAD, DIARY_LINES, DIARY_TAIL_A, DIARY_TAIL_B, DIARY_MAX \} from '\.\.\/lib\/rules'/.test(dlg)
    && !/공부방|사탕/.test(dlg), true);
}

/* ── 앱이 워커에 보내는 것이 웹과 같다 ──
   payload가 다르면 같은 인물이 두 앱에서 다르게 군다. 웹이 얹는 것을
   앱도 다 얹어야 한다 — 특히 접속 상태와 자리는 인물의 대답을 바꾼다. */
{
  const api = readFileSync(join(ROOT, 'app/lib/api.ts'), 'utf8');
  eq('앱도 요일·때를 보낸다', /now: timeWord\(\)/.test(api) && /day: dayWord\(\)/.test(api), true);
  eq('앱도 접속 상태를 보낸다',
    /states/.test(api) && /presence\(id\)/.test(api) && /pr\.t !== '주말'/.test(api), true);
  /* 가방은 자리와 묶여 있었다. 풀었으므로 둘을 따로 본다 — place는 자리에
     앉았을 때만, 가방은 늘. 묶여 있으면 자리 밖에서 제가 준 것을 모른다 */
  eq('앱도 마주 앉은 자리를 보낸다',
    /\.\.\.\(place \? \{ place \} : \{\}\)/.test(api) && /\n    bag: bag \|\| \[\],/.test(api), true);
  eq('앱도 자리의 때와 선톡 표시를 보낸다',
    /place_over: true/.test(api) && /greet: true/.test(api), true);
  eq('앱도 문 닫은 자리를 보낸다', /closed: PLACES\.filter/.test(api), true);
  /* 선톡 지시문은 웹과 글자 그대로 같아야 한다 — 다르면 두 앱의 인물이 다르게 군다 */
  const ask = web.match(/const GREET_ASK="([^"]+)"/);
  eq('선톡 지시문이 웹과 같다', !!ask && appSrc.includes(ask[1]), true);
}

/* 실패했을 때 조용히 각본으로 갈아타면 진짜 장애를 못 알아챈다.
   한동안은 반대로 적혀 있었다 — 「앱도 서버가 죽으면 각본으로 넘어간다」가
   시험이었다. 웹에는 ?demo=1이 있어서 각본이 고른 것이었지만, 앱에는 그게
   없으니 실패 폴백이 유일한 각본 경로였다. 그래서 앱은 서버가 죽어도 아무
   티를 안 내고 대사를 읽었다. 지금은 원인이 콘솔과 화면 양쪽에 남는다. */
eq('실패한 까닭을 콘솔에 남긴다', /console\.error\([^)]*NULL/.test(appSrc), true);
eq('데모로 돌고 있으면 하단 바에 뜬다', /NULL v[\d.]+\{demo\?' · demo'/.test(appSrc), true);
/* 실패가 각본을 켜던 자리였다. 이제 DEMO는 손으로만 켠다 */
eq('실패는 각본 스위치를 못 켠다', /DEMO\.auto=true/.test(appSrc), false);

/* 배경 사진은 나중에 올라온다. 없는 파일을 걸면 RN은 아무 말 없이 빈 화면이 되므로
   onError로 기존 배경에 돌아가야 한다(웹의 useBg가 하는 일). */
eq('앱도 배경 사진이 없으면 원래 배경으로 돌아간다', /onError:\s*\(\)\s*=>/.test(appSrc), true);
/* 훅을 조건부 return 뒤에 두면 렌더마다 훅 수가 달라져 터진다. 웹에서 한 번 낸 사고다. */
eq('배경 훅이 조건부 return보다 위에 있다',
  appSrc.indexOf('const bg=useBgUri(') < appSrc.indexOf('if(!stage) return'), true);

// 메신저 BGM — 웹의 데스크 CD와 같은 곡을 쓴다
eq('앱도 메신저 BGM을 같은 파일로 튼다',
  /const MAIN_TRACK\s*=\s*'null-1'/.test(readFileSync(join(ROOT, 'app/lib/profiles.ts'), 'utf8'))
  && /const MAIN_TRACK="null-1"/.test(web), true);
/* 소개 영상(VHS 11초)은 걷어냈다. 오프닝이 이미 그 일을 하고 있었다 —
   Y2K 데스크톱에 도는 CD와 「당신을 찾을 수 없습니다」 오류창.
   오프닝이 두 개였고 결이 갈렸다. 되살아나면 그 갈라짐도 같이 돌아온다. */
eq('소개 영상은 웹·앱 어디에도 없다',
  /IntroFilm|FILM_SHOTS|FILM_LINES/.test(web) || /IntroFilm|FILM_SHOTS|FILM_LINES/.test(appSrc), false);

/* 등록 화면에서 채우는 빈칸. 웹에서만 고치고 앱을 안 고치는 일이 실제로 있었다.
   키와 꼬리말이 어긋나면 같은 값을 서버에 다르게 적어 보내게 된다. */
const enrOf = src => [...src.matchAll(/\{k:\s*['"](\w+)['"][^}]*?tail:\s*['"]([^'"]*)['"]/g)]
  .map(m => [m[1], m[2]]);
eq('등록 화면 빈칸이 웹·앱 같다', enrOf(appSrc), enrOf(web));
eq('등록 화면 빈칸이 네 칸이다', enrOf(web).length, 4);

/* etc. 팝업 문구 — 여기가 이 앱이 자기를 소개하는 유일한 자리다 */
const etcLines = ['안녕, NULL 기다렸어. ✧', 'the blank u fill in'];
eq('etc. 팝업 문구가 웹·앱 같다',
  etcLines.filter(t => !(appSrc.includes(t) && web.includes(t))), []);

/* 실습 D-카운트. 첫 대화한 날부터 하루씩 깎이므로 양쪽이 같은 날짜 수에서
   출발해야 한다. 한쪽만 고치면 웹과 앱의 D가 어긋난다. */
const enrollDays = src => (src.match(/ENROLL_DAYS\s*=\s*(\d+)/) || [])[1];
/* 앱은 이제 이 값을 베끼지 않고 규칙 파일에서 가져온다 — 값이 한 곳뿐이라
   어긋날 수가 없다. 대조하는 대신 베끼지 않았는지를 본다. */
eq('앱은 실습 기간을 안 베낀다', enrollDays(appSrc), undefined);
eq('실습 기간이 30일이다', enrollDays(web), '30');
/* 남은 날을 칸으로 그린다. 서른 칸이 다 차 있다가 앞에서 한 칸씩 빈다 —
   채워지는 게 아니라 비어가는 쪽이어야 이 이야기와 맞는다. */
eq('남은 날을 칸으로 그린다', /function DayBar/.test(web), true);
eq('칸 수가 실습 기간과 같다', /length:ENROLL_DAYS/.test(web), true);
eq('지난 날은 비고 오늘만 다르다',
  /i<gone\?"gone":i===gone\?"now"/.test(web), true);
eq('관전방에는 안 붙인다', /\{!watch&&<DayBar/.test(web), true);

eq('D-카운트를 양쪽 다 실습으로 쓴다',
  /실습 D-/.test(appSrc) && /실습 D-/.test(web), true);

/* 관전방 자동 채움. 선물·해금이 방아쇠고, 유저가 자리를 비운 뒤의 일로 찍는다.
   값이 어긋나면
   웹과 앱이 다른 속도로 쌓인다. 상한은 특히 중요하다 — 관전 프롬프트가
   제일 비싸다. */
const autoNum = (src, k) => (src.match(new RegExp(k + '\\s*=\\s*([\\d*]+)')) || [])[1];
['AUTO_AWAY', 'AUTO_MAX_DAY'].forEach(k =>
  eq(`앱은 관전 자동 채움 ${k}를 안 베낀다`, autoNum(appSrc, k), undefined));
eq('관전 자동 채움에 하루 상한이 있다', autoNum(web, 'AUTO_MAX_DAY'), '2');
// 방아쇠 네 개를 다 적어둬야 한다. 하나만 걸면 다른 쪽은 영영 안 열린다
['gift', 'unlock', 'met', 'photos', 'dday'].forEach(k =>
  eq(`관전 방아쇠에 ${k}가 웹·앱 둘 다 걸려 있다`,
    new RegExp(`kind:\\s*['"]${k}['"]`).test(web)
    && new RegExp(`kind:\\s*['"]${k}['"]`).test(appSrc), true));

/* 안 눌러도 쌓이는 방아쇠 둘. 값이 어긋나면 웹에서만 열리고 앱에서는 안 열린다.
   그리고 둘 다 한 번씩만 찍혀야 한다 — 사진이 여섯 장, 일곱 장 될 때마다
   같은 대화가 다시 나오면 그건 사건이 아니라 배경이 된다. */
['PHOTO_EVENT_AT'].forEach(k =>
  eq(`앱은 ${k}를 안 베낀다`, autoNum(appSrc, k), undefined));
const ddayMarks = src => (src.match(/DDAY_MARKS\s*=\s*\[([^\]]*)\]/) || [])[1];
eq('앱은 남은 날 방아쇠를 안 베낀다', ddayMarks(appSrc), undefined);
eq('남은 날 방아쇠가 7·3·1이다', ddayMarks(web).replace(/\s/g, ''), '7,3,1');
eq('한 번 찍은 사건은 웹·앱 둘 다 다시 안 찍는다',
  /null_ev_done/.test(web) && /null_ev_done/.test(appSrc), true);
/* 사진 방아쇠는 재언 쪽만 센다. 민현이 셀카는 "저 지금 여기 왔어요"라서
   장소도 사건도 아니고, 관전방은 민현이 여는 방이라 물을 사람이 없다. */
eq('사진 방아쇠는 재언에게만 걸린다',
  /kind:\s*["']photos["'],\s*to:\s*["']jaeeon["']/.test(web)
  && /kind:\s*["']photos["'],\s*to:\s*["']jaeeon["']/.test(appSrc), true);
// 유저가 보낸 사진은 안 센다. 재언이 찍은 것만 사건이 된다
eq('유저가 보낸 사진은 안 센다',
  /photo&&x\.sender!=="user"/.test(web)
  && /m\.photo&&m\.sender!=='user'/.test(appSrc), true);

/* 사건을 넘기더라도 무슨 말이 오갔는지는 안 준다. 이 선이 무너지면 정보
   비대칭이 통째로 풀린다 — 프롬프트로 부탁하지 말고 문장으로 못박아야 한다. */
const workerSrc = readFileSync(join(ROOT, 'worker.js'), 'utf8');
eq('사건은 auto에서만 받는다',
  /mode === "auto" && body\.event/.test(workerSrc), true);
eq('사건을 줘도 오간 말은 모른다고 못박는다',
  /무슨 말이 오갔는지는 모른다/.test(workerSrc), true);

/* 같이 가자는 제안. 서버는 갈 수 있는 자리만 열어두고 고르는 건 모델이 한다.
   거절한 곳을 다시 꺼내면 성격이 무너지므로 그건 서버가 막는다. */
eq('서버는 자리 목록만 연다', /function invitesFor/.test(workerSrc), true);
eq('이미 갔거나 거절한 곳은 다시 안 꺼낸다',
  /skip\.has\(v\.place\)/.test(workerSrc), true);
eq('제안은 1:1에서만 나온다', /mode !== "chat"/.test(workerSrc), true);
eq('같이 간 것도 관전방 사건이 된다', /event\.kind === "met"/.test(workerSrc), true);

/* 사진과 남은 날, 두 사건이 무엇을 못박는지. 민현이는 선생님 갤러리를 볼 수
   없다 — 찍는 것만 봤다. 그 선이 풀리면 물어볼 이유가 사라진다.
   남은 날은 주어를 비운 채로 오간다 — 세고 있었다고 말하는 쪽이 지는 대화다. */
eq('사진 사건은 찍는 것만 봤다고 못박는다',
  /받은 사람의 갤러리를 볼 방법은 없다/.test(workerSrc), true);
/* 어떻게 말할지("주어를 비운 채로", "들키는 쪽이 지는 대화")는 인물의 몫이다.
   여기는 무슨 일이 있었고 무엇을 아는지까지만 적는다 */
eq('남은 날 사건은 사실만 적는다',
  /떠날 날이 \$\{what\}일 남았다/.test(workerSrc)
  && !/들키는 쪽이 지는 대화|주어를 비운 채로/.test(workerSrc), true);

/* 누가 여느냐는 장면의 규칙이라 남긴다. 다만 왜 그런지(미끼를 던진다,
   물어야 답한다)는 인물 설명이라 뺐다 — 그건 인물 프롬프트가 할 말이다 */
eq('관전방은 민현이 연다', /첫 발화는 이민현이 한다/.test(workerSrc), true);
eq('왜 그런지는 여기서 안 설명한다',
  /미끼를 던진|물어야 답한다|경직된다|그걸 읽고 웃는다/.test(workerSrc), false);
/* 인물 블록에는 자율 대화 가이드가 더 이상 없다. 관전방에서 누가 먼저 말하는지는
   FORMAT_AUTO 한 군데서만 정해진다 — 두 사람의 성격 차이는 그 방에서 프롬프트가
   아니라 인물 설정만으로 나와야 한다. */
eq('자율 대화 가이드가 인물 블록에 없다',
  (workerSrc.match(/자율 대화 가이드/g) || []).length, 0);

/* 호칭. 교생은 신분이지 부르는 말이 아니다 — 두 사람 다 "선생님"이라고 부른다 */
/* 손으로 쓴 대사를 결 견본으로 프롬프트에 올렸다. 대사집이 아니라 견본이라는
   못이 같이 안 박히면 모델이 그대로 베껴 쓴다 — 예시가 늘수록 그 압력이 세진다. */
eq('예시가 현재 기록을 덮지 않는다고 못박는다',
  /대화 예시는 현재 기록을 덮어쓰지 않는다/.test(workerSrc), true);
eq('두 사람 다 대화 예시를 들고 있다',
  (workerSrc.match(/^대화 예시$/gm) || []).length, 2);
eq('재언은 유저에게 항상 존댓말이다',
  /유저에게는 항상 존댓말을 쓴다/.test(workerSrc), true);
/* 견본은 고정 블록에 있어야 한다. 가변부로 새면 매 턴 값을 다시 문다 */
eq('예시가 캐시되는 자리에 있다',
  buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null)
    .filter(b => b.cache_control).some(b => b.text.includes('대화 예시')), true);

eq('두 사람 다 유저를 선생님이라고 부른다',
  (workerSrc.match(/직접 부를 때의 호칭은 "선생님"이다/g) || []).length, 3);

/* 붙여 말하는 건 호흡 얘기지 쉼표 얘기가 아니다 */
eq('쉼표는 정상적으로 쓴다', /쉼표와 마침표는 정상적으로 쓴다/.test(workerSrc), true);
/* 자모 축약은 이제 TICS 한 군데서만 막는다 — 인물 블록에서는 빠졌다 */
eq('자모 축약을 프롬프트에서 막는다',
  (workerSrc.match(/자모 축약/g) || []).length >= 1, true);
eq('이름이 비었을 때도 선생님이다', !/userName \|\| "교생"/.test(workerSrc), true);
/* ── 인물은 인물 프롬프트에만 있다 ──
   코드가 쓴 글이 인물을 다시 설명하면 두 군데가 어긋나고, 어긋나면 뒤에
   오는 코드 쪽이 이긴다. 실제로 세 번 그랬다: 민현이 「무례하다」로,
   재언이 「열 자 안팎·말끝을 자른다」로 덮였고, 선물 앞에서는 「딴소리를
   해도 된다」가 라면 받침이 됐다. 이제 코드는 사실과 형식만 적는다. */
eq('코드가 인물을 다시 설명하지 않는다',
  ['존댓말인데 무례하다', '열 자 안팎', '말끝을 자른다', '물음표를 잘 안 쓴다',
   '뻔뻔하게 들러붙는다', '소거가 실패하기 시작한다', '한숨이 문장부호다',
   '무뚝뚝한 것과 모진 것은 다르다', '이 사람의 대표 문장']
    .filter(s => workerSrc.includes(s)), []);
/* 단계표에 인물 설명 칸이 다시 생기면 여기서 걸린다 */
eq('단계표는 이름과 문턱뿐이다', (() => {
  const t = workerSrc.slice(workerSrc.indexOf('const STAGES = ['));
  return [...new Set([...t.slice(0, t.indexOf('];')).matchAll(/(\w+):/g)].map(m => m[1]))].sort();
})(), ['at', 'day', 'name']);
/* 관계의 온도는 이제 숫자다 — 며칠째인지, 몇 번째 말인지 */
eq('지금까지는 숫자로만 준다', (() => {
  const t = buildVolatile('chat', 'jaeeon', 'R', null, [], null, { jaeeon: 40 }, null, null, null, 12);
  return /## \[지금까지\]/.test(t) && /만난 지 12일째/.test(t)
    && /떠나기까지 18일/.test(t) && /이 방에서 오간 말: 40번째/.test(t);
})(), true);
/* 「만난 지 0일째」는 아무 말도 아니다. 인물 설정의 첫 만남을 이미 끝난 일로
   읽고 첫날부터 아는 사이처럼 굴었다. 첫날은 첫날이라고 적는다 */
eq('첫날은 첫날이라고 적는다', (() => {
  const t = buildVolatile('chat', 'jaeeon', 'R', null, [], null, { jaeeon: 3 }, null, null, null, 0);
  return t.includes('오늘 처음 만났다') && !t.includes('0일째');
})(), true);
/* 단계표를 걷어내니 「며칠째면 어떤 상태인가」를 말하는 문장이 없었다.
   표를 다시 만드는 대신 원칙 한 줄을 세계관에 둔다 — 관계는 이미 있는 게
   아니라 쌓이는 것이라고. 이건 코드가 지어낸 말이 아니라 작가의 문장이다 */
eq('관계가 쌓이는 것이라고 못 박는다', (() => {
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  const w = wk.slice(wk.indexOf('const WORLD = `'), wk.indexOf('const JAEEON = `'));
  return /유저와 보내는 하루가 쌓일 때마다 감정이 달라진다\. 이미 가까운 사이가 아니다\. 가까워질 수 있는 사이다\./.test(w)
    && w.indexOf('가까워질 수 있는 사이다') < w.indexOf('이재언과 이민현\n\n이재언은 이민현을') + w.length;
})(), true);
eq('첫날 읽는 법을 슬롯에 적어둔다', (() => {
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  return /「오늘 처음 만났다」고 적혀 있으면 그 앞에 쌓인 것이 하나도 없다는 뜻이다/.test(wk);
})(), true);
/* 열쇠는 규칙 파일이 들고 있다 — 웹은 app-data.js, 앱은 rules.ts. 둘은 같은
   글에서 만들어지므로 열쇠가 어긋날 수가 없다. 화면(App.tsx)이 저장소에
   직접 쓰던 자리가 하나 있었는데, 그건 규칙 파일이 읽는 사본을 안 건드려서
   같은 판 안에서는 안 보였다 — 걷어내고 saveMet/saveRefused로 모았다. */
{
  const rulesSrc = readFileSync(join(ROOT, 'app/lib/rules.ts'), 'utf8');
  eq('다녀온 자리를 웹·앱 둘 다 들고 있다',
    /null_met/.test(web) && /null_met/.test(rulesSrc), true);
  eq('거절한 자리를 웹·앱 둘 다 들고 있다',
    /null_refused/.test(web) && /null_refused/.test(rulesSrc), true);
  eq('화면은 저장소에 직접 안 쓴다',
    !/setMeta\('null_(met|refused)'/.test(appSrc) && !/setMeta\(key,/.test(appSrc), true);
}

/* 영상이 없어졌으니 띠도 그 얘기를 안 한다 */
eq('흐르는 띠에 영상 안내가 없다',
  /press intro/.test(web) || /press intro/.test(appSrc), false);

/* ── 이름이 불린 만큼 채워지는 빈칸 ──
   방문자 수가 있던 자리다. 내가 내 대화를 세는 숫자라 아무것도 안 알려줬다.
   지금은 유저의 이름이 글자 단위로 차오른다 — 이 세계의 규칙이 "이름이 있어야
   존재한다"이고, 오프닝의 오류창이 그 말이다.

   "선생님"은 안 센다. 그걸 세면 250번짜리 노가다가 된다. 이름은 프롬프트에서
   아껴 쓰라고 박아뒀으니 잘 안 오르고, 한 칸이 차는 게 사건이 된다. */
eq('방문자 수는 뺐다', /visits/.test(web), false);
const nmSrc = web.slice(web.indexOf('const CALL_PER_LETTER'), web.indexOf('const ROOMS ='));
const NM = new Function(nmSrc + ';return {countCalls, filledLetters, CALL_PER_LETTER}')();
const S = t => ({ msgs: { jaeeon: [{ sender: 'jaeeon', text: t }] } });
eq('이름을 부르면 센다', NM.countCalls(S('윤하 씨.'), '윤하'), 1);
eq('한 줄에 두 번이면 두 번', NM.countCalls(S('윤하. 윤하.'), '윤하'), 2);
/* 이걸 세면 노가다가 된다 */
eq('선생님은 안 센다', NM.countCalls(S('선생님, 앉으세요.'), '윤하'), 0);
/* 유저가 제 이름을 쓰는 건 호명이 아니다 */
eq('유저가 제 이름을 쳐도 안 센다',
  NM.countCalls({ msgs: { jaeeon: [{ sender: 'user', text: '저 윤하예요' }] } }, '윤하'), 0);
eq('이름이 비면 아무것도 안 센다', NM.countCalls(S('아무 말'), ''), 0);
/* 글자 하나에 여러 번. 몇 번인지는 화면에 안 쓴다 */
eq('글자가 한 번에 하나씩 차지 않는다',
  [0, 3, 4, 8, 99].map(n => NM.filledLetters(n, '윤하')), [0, 0, 1, 2, 2]);
eq('이름 길이를 넘지 않는다', NM.filledLetters(999, '윤하'), 2);
eq('칸 수를 화면에 숫자로 안 쓴다', /\{calls\}/.test(web), false);

/* ── D-0 · 계속 살아갈지 ──
   이름이 다 불렸을 때만 남을 수 있다. 빈칸이 남았다는 건 끝까지 부를 사람이
   하나도 없었다는 말이다. */
eq('D-0에 묻는 창이 있다', /askDday/.test(web), true);
eq('이름이 다 차야 남을 수 있다', /nameFull\?answerDday\(true\)/.test(web), true);
eq('남기로 하면 날이 더 붙는다', /null_extend/.test(web), true);

/* 이름을 아껴 쓰라고 말해둔다 — 안 그러면 칸이 하루에 다 찬다.
   전에는 인물마다 적었고 지금은 세계관에 한 번 적혀 네 방이 같이 읽는다 */
eq('이름을 아껴 쓰라고 적어뒀다',
  /유저의 이름은 중요한 순간에만 부른다/.test(workerSrc), true);
/* 배경 파일이 없으면 CSS는 조용히 단색으로 떨어진다. 오류가 안 나서 못 알아챈다 */
/* body의 background를 그라데이션으로 다시 쓰면 바탕 그림이 통째로 덮인다.
   오류가 안 나서 파일이 없는 줄 알았다 */
/* 창이 배경보다 밝으면 바닥에 올려둔 종이로 보인다. 창 뒤에 빛을 둬서
   빛 속에 놓인 유리로 읽히게 한다. 창은 그 위에 있어야 한다 */
eq('창 뒤에 빛이 있다', /#root::before\{[^}]*radial-gradient/.test(web), true);
eq('창이 그 빛 위에 온다', /\.phone\{[^}]*z-index:1/.test(web), true);
eq('바탕 그림이 그라데이션에 안 덮인다',
  /body\{[^}]*background:linear-gradient/.test(web), false);
eq('바탕 그림이 저장소에 있다',
  (web.match(/url\("([a-z0-9-]+\.(?:webp|png))"\)/g) || [])
    .map(m => m.replace(/.*url\("|"\).*/g, '')).filter(f => !exists(f)), []);


// ─────────────────────────────────────────────
section('프로필이 바뀌면 목록이 알린다');
// ─────────────────────────────────────────────
/* 알림을 말풍선으로 넣지 않는 이유: 그건 그 사람이 나한테 한 말이 아니다.
   화면이 알리게 두고, 대화창은 대화만 담는다.
   알리는 방법은 아바타 둘레 하나뿐이다 — 이름 옆에 도장을 붙여봤는데
   목록이 시끄러워져서 뺐다. 다시 넣지 말 것. */
const profSrc = readFileSync(join(ROOT, 'app/lib/profiles.ts'), 'utf8');

/* 단계 사이에 실제로 달라진 것만 고른다. 웹의 stageDiff와 앱의 stageDiff가
   다른 걸 고르면 같은 지점에서 웹과 앱이 서로 다른 걸 알린다. */
const cut = (from, to) => web.slice(web.indexOf(from), web.indexOf(to));
/* PROFILES를 웹 소스에서 그대로 떼어내 돌린다 — 표를 손으로 베끼면 어긋난다 */
const webProfiles = new Function('return ' +
  cut('const PROFILES={', 'const stageDiff=').replace(/^const PROFILES=/, '').trim().replace(/;$/, ''))();
const webDiff = new Function('PROFILES',
  cut('const stageDiff=', '/* 프로필 뮤직') + ';return stageDiff');
const diff = webDiff(webProfiles);

eq('처음 들어온 사람에게는 알릴 것이 없다', diff('jaeeon', 0, 0), []);
eq('16에서는 배경과 상메가 바뀐다', diff('jaeeon', 0, 1), ['bg', 'status']);
eq('40에서는 곡까지 바뀐다', diff('jaeeon', 1, 2), ['bg', 'track', 'status']);
/* 두 단계를 한 번에 건너뛰어도 답은 "지금 무엇이 그때와 다른가" 하나다 */
eq('건너뛴 단계는 합쳐서 한 번만 센다', diff('minhyun', 0, 2), ['bg', 'track', 'status']);
eq('본 뒤로 안 오른 단계는 아무것도 안 알린다', diff('minhyun', 3, 2), []);

eq('앱도 같은 stageDiff를 들고 있다', /export function stageDiff/.test(profSrc), true);
eq('앱의 stageDiff도 같은 세 가지를 본다',
  /\['bg', 'track', 'status'\]/.test(profSrc), true);

/* 본 단계는 저장돼야 한다. 안 그러면 껐다 켤 때마다 다시 반짝인다 */
eq('본 단계를 웹·앱 둘 다 저장한다',
  /null_seen_stage/.test(web) && /null_seen_stage/.test(profSrc), true);
/* 방을 여는 걸로는 안 꺼진다 — 바뀐 건 대화가 아니라 프로필이다 */
eq('프로필을 열어야 표시가 꺼진다',
  /openProfile/.test(web) && /openProfile/.test(appSrc), true);
eq('목록이 본 단계를 넘겨받는다',
  /seenStage=\{seenStage\}/.test(web) && /seenStage=\{seenStage\}/.test(appSrc), true);
/* 대화를 다 지우면 본 기록도 같이 지워야 한다. 안 그러면 처음부터 다시
   시작했는데 "이미 봤다"고 남아 첫 단계 변화를 놓친다.
   웹은 다시 열어서 열 개를 한 번에 비운다. 앱은 다시 열 수가 없어 손으로 지운다 */
eq('새로 시작하면 본 기록도 지운다',
  /location\.reload\(\)/.test(web) && /setSeenStage\(\{\}\)/.test(appSrc), true);

/* 상태메시지는 두 군데에 적혀 있다 — 웹과 앱. 어긋나면 둘이 다른 문구를
   쓴다. 눈으로는 안 잡힌다. */
const STATUS_WANT = [
  ['별일 없어요.',    '수업 중. 아마도.'],
  ['문은 열어둘게요.', '기다리는 거 아니에요.'],
  ['어디 안 가요.',    '그 말 취소하면 안 돼요.'],
  ['아직 남았어요.',   '곧이잖아요. 지금이 아니라.'],
  ['남은 동안은 여기 있어요.', '안 알려줘도 알아요.'],
];
eq('웹 상메가 표와 같다',
  ['jaeeon', 'minhyun'].map((c, ci) => webProfiles[c].stages.map(s => s.status))
    .map((got, ci) => JSON.stringify(got) === JSON.stringify(STATUS_WANT.map(r => r[ci]))),
  [true, true]);
eq('앱 상메가 표와 같다',
  STATUS_WANT.flat().filter(t => !profSrc.includes(`'${t}'`)), []);
/* 경계 바로 아래는 앞 단계여야 한다. 한 칸씩 밀린 적이 있다.
   단계 경계는 STAGE_AT이 정하고 문구는 PROFILES가 들고 있어서, 둘을
   실제로 붙여봐야 밀렸는지 알 수 있다. */
const STAGE_AT = JSON.parse((web.match(/const STAGE_AT=(\[[^\]]*\])/) || [])[1]);
const stageIdx = n => { let i = 0; STAGE_AT.forEach((a, k) => { if (n >= a) i = k }); return i };
eq('경계 직전은 아직 앞 단계다',
  [['jaeeon', 39], ['minhyun', 15]].map(([c, n]) => webProfiles[c].stages[stageIdx(n)].status),
  ['문은 열어둘게요.', '수업 중. 아마도.']);
eq('경계에 닿으면 다음 단계다',
  [['jaeeon', 40], ['minhyun', 16]].map(([c, n]) => webProfiles[c].stages[stageIdx(n)].status),
  ['어디 안 가요.', '기다리는 거 아니에요.']);
/* 서버는 상메를 안 보낸다. 전에는 워커가 같은 표를 다시 계산해 응답에 실었고
   앱이 그걸 저장해 기본값보다 우선했는데, 오가는 게 늘 제 값의 메아리였다 —
   아무 일도 안 하면서, 한 번 저장되면 앱을 새로 빌드해도 옛 문구가 새 기본값을
   이기는 길만 냈다. 되살아나면 여기서 잡는다. */
eq('워커가 상메를 안 보낸다', /statusOf|const STATUS = \[/.test(workerSrc), false);

/* ── 1일은 1일이다 ──
   단계가 대화 수만 봤다. 유저는 하루에 백 개씩 보낸다. 그러면 첫날 밤에
   "떠날 날이 가까운 걸 안다"까지 간다 — 화면에는 D-29라고 적혀 있는데.
   이제 대화 수와 날짜를 둘 다 넘어야 다음 단계다. 느린 쪽이 정한다. */
const stageOf = new Function(workerSrc.slice(workerSrc.indexOf('const STAGES = ['),
  workerSrc.indexOf('function buildStage')) + ';return stageOf')();
eq('하루에 이백 개를 보내도 첫날은 처음이다', stageOf(200, 0).name, '처음');
eq('나흘이 지나야 익숙이다', [stageOf(16, 3).name, stageOf(16, 4).name], ['처음', '익숙']);
eq('날짜만 가도 대화가 모자라면 안 오른다', stageOf(10, 30).name, '처음');
eq('둘 다 넘으면 오른다', [stageOf(200, 10).name, stageOf(200, 18).name], ['균열', '시한']);

const unlockedKeys = new Function(workerSrc.slice(workerSrc.indexOf('const UNLOCKS = ['),
  workerSrc.indexOf('// 유저가 \'당신.txt\'')) + ';return unlockedKeys')();
const uk = (n, d) => unlockedKeys({ jaeeon: n, minhyun: n }, d).length;
/* ── 세계 시계는 하나다 ──
   한때 스피드 모드가 쌓인 대화를 날로 셌다(네 마디 = 하루). 그러면 인물이
   두 줄로 답하느냐 세 줄로 답하느냐가 달력을 민다. 실제로 그렇게 됐다 —
   민현이 수다스러운 판에서 재언 방의 D-일차가 같이 탔고, 첫날 아침 8시 47분에
   이미 37일째였다. 그래서 구조를 뗐다.
   이제 시각·D-일차·요일·도장·재회가 전부 이 시계 하나에서 나온다:
     리얼 1:1 · 스피드 1:4 · 켠 그 시각에서 출발 · 현실 7.5일에 게임 30일 */
const CLK = (dev) => new Function('__G',
  'const NULL_DEV=__G.NULL_DEV, localStorage=__G.localStorage;'
  + web.slice(web.indexOf('const ENROLL_DAYS'), web.indexOf('/* ── 이름이 불린 횟수 ──'))
  + web.slice(web.indexOf('/* 하루의 경계는 자정이 아니라'), web.indexOf('const loadDaySeen='))
  + 'return {saveMode,loadMode,speedOn,setWorldAt,worldNow,worldStart,worldDays,worldDaysOf,'
  + 'gameAt,dayKey,daysLeft,daysSince,nowClock,cameBackAt,dLeftAt,sys1Due,leaveTsOf,'
  + 'firstTsOf,SPEED_RATE,ENROLL_DAYS,DEV_TIME,devAddDay,devToLeft};')(
  { NULL_DEV: !!dev, localStorage: (() => { const v = {};
    return { getItem: k => (k in v ? v[k] : null), setItem: (k, x) => { v[k] = String(x) },
             removeItem: k => { delete v[k] } } })() });
{
  const D = CLK();
  const st = t => ({ msgs: { jaeeon: [{ ts: t, sender: 'user' }] } });
  const at = ms => { const t = Date.now() - ms; D.setWorldAt(t); return st(t) };
  eq('기본은 리얼이다', D.speedOn(), false);

  D.saveMode('speed');
  /* 150줄을 나누든 한 줄을 나누든 시계는 흐른 진짜 시간만 본다 */
  const s12 = at(12 * 60 * 1000);
  s12.msgs.jaeeon = Array.from({ length: 150 }, () => ({ ts: Date.now(), sender: 'char' }))
    .concat(s12.msgs.jaeeon);
  /* 세계는 **켠 그 시각**에서 출발한다. 전에는 첫날을 무조건 여덟 시로
     옮겨놓아서, 스피드 모드의 첫 자리가 늘 아침(후문 골목)이었다 */
  eq('출발 자리가 첫 말풍선 그 시각이다',
    Math.abs(D.worldStart().getTime() - (Date.now() - 12 * 60 * 1000)) < 2000, true);
  eq('현실 12분 · 150줄 → 세계로 48분 · day 0 · D-30',
    [Math.round((D.worldNow() - D.worldStart()) / 60000), D.worldDaysOf(s12), D.daysLeft(s12)],
    [48, 0, 30]);
  const s6 = at(6 * 3600 * 1000);
  /* 여섯 시간이 스물네 시간 — 하루 뒤 같은 시각이다. 벽시계 숫자로 재면
     서머타임 경계에서 한 시간 어긋나므로 흐른 폭으로 잰다 */
  eq('현실 6시간 → 세계로 하루 · day 1 · D-29',
    [Math.round((D.worldNow() - D.worldStart()) / 3600000), D.worldDaysOf(s6), D.daysLeft(s6)],
    [24, 1, 29]);
  /* 앱을 닫아둔 시간도 흐른다 — 「당신이 말하지 않아도 세계는 돌아갑니다」 */
  const s2d = at(2 * 864e5);
  eq('닫아둔 현실 이틀 → 게임 여드레', [D.worldDaysOf(s2d), D.daysLeft(s2d)], [8, 22]);
  eq('현실 7.5일이면 서른 날이다', D.worldDaysOf(at(7.5 * 864e5)), 30);

  /* ── 여기가 이번에 고친 것이다 ── 말풍선은 날짜에 손대지 않는다 */
  const many = at(12 * 60 * 1000);
  many.msgs = { jaeeon: Array(500).fill({ ts: many.msgs.jaeeon[0].ts, sender: 'char' }),
                minhyun: Array(944).fill({ ts: many.msgs.jaeeon[0].ts, sender: 'char' }) };
  eq('말풍선 1444개가 하루도 못 민다', D.worldDaysOf(many), 0);
  eq('도장도 말풍선을 안 본다', D.dayKey(), D.dayKey());

  D.saveMode('real');
  const r2d = at(2 * 864e5);
  eq('리얼은 현실 이틀이 이틀이다', [D.worldDaysOf(r2d), D.daysLeft(r2d)], [2, 28]);
  eq('리얼 모드는 진짜 지금이다', Math.abs(D.nowClock() - Date.now()) < 4000, true);
}
/* ── 개발 전용 시간 이동 ──
   한 판에 30일을 봐야 할 때가 있다. 공개 스피드 모드의 비율을 건드리지 않고
   「지금」에만 오프셋을 더한다. 과거 말풍선의 시각은 안 움직인다. */
{
  const off = CLK(false), on = CLK(true);
  eq('배포판에는 시간 이동이 없다', [off.DEV_TIME, on.DEV_TIME], [false, true]);
  const t = Date.now() - 60 * 1000;
  off.saveMode('speed'); off.setWorldAt(t); off.devAddDay(5);
  eq('배포판에서는 눌러도 안 움직인다', off.worldDaysOf(off.firstTsOf ? { msgs: { j: [{ ts: t }] } } : {}), 0);

  on.saveMode('speed'); on.setWorldAt(t);
  const store = { msgs: { jaeeon: [{ ts: t, sender: 'user' }] } };
  const past = on.gameAt(t).getTime();
  on.devAddDay(1);
  eq('+1일은 하루를 민다', on.worldDaysOf(store), 1);
  eq('+1일이 과거 말풍선 시각을 안 바꾼다', on.gameAt(t).getTime(), past);
  eq('출발 자리도 안 움직인다', on.worldStart().getTime(), past);
  on.devToLeft(on.daysLeft(store), 7);
  eq('D-7로 곧장 간다', on.daysLeft(store), 7);
  on.devToLeft(on.daysLeft(store), 0);
  eq('D-0로 곧장 간다', on.daysLeft(store), 0);
}
/* ── 시계 하나에서 나오는 것들 ── 도장·재회·가방 D-일차·첫날 통보 */
{
  const D = CLK();
  D.saveMode('speed');
  const t = Date.now() - 12 * 60 * 1000;
  D.setWorldAt(t);
  const store = { msgs: { jaeeon: [{ ts: t, sender: 'user' }] } };
  /* 스피드의 서른 날은 현실 7.5일이다 — 현실 30일로 재면 재회가 영영 안 온다 */
  eq('떠나는 날은 모드에 맞게 환산한다',
    Math.round((D.leaveTsOf(store) - t) / 864e5 * 10) / 10, 7.5);
  eq('아직은 재회가 아니다', D.cameBackAt(store), false);
  eq('떠난 뒤 유저 발화면 재회다',
    D.cameBackAt({ msgs: { jaeeon: [{ ts: t, sender: 'user' },
      { ts: D.leaveTsOf(store) + 1000, sender: 'user' }] } }), true);
  /* 가방의 「받은 날」도 세계 시계로 적는다 */
  eq('방금 받은 것은 D-30이다', D.dLeftAt(store, t), 30);
  eq('현실 여섯 시간 뒤에 받은 것은 D-29다', D.dLeftAt(store, t + 6 * 3600 * 1000), 29);
  /* 첫날 통보는 세계 시각으로 스무 시간이다 — 현실로 재면 나흘째에 온다 */
  eq('12분 만에는 아직 안 온다', D.sys1Due(store), false);
  const t5 = Date.now() - 5.1 * 3600 * 1000;    // 게임으로 20.4시간
  D.setWorldAt(t5);
  eq('현실 다섯 시간이면 온다', D.sys1Due({ msgs: { jaeeon: [{ ts: t5 }] } }), true);
}
/* 규칙이 시계를 둘 두지 않는다 — 하나라도 new Date()로 새면 그것만 진짜
   시각을 보고, 스피드 모드에서 시간표와 잠이 딴말을 한다 */
{
  const rules = readFileSync(join(ROOT, 'app-data.js'), 'utf8');
  eq('규칙층에 진짜 시계가 안 샌다', /\|\|new Date\(\)/.test(rules), false);
  /* 말풍선에 찍히는 시각도 세계 시계로 번역한다 — 프롬프트는 저녁이라는데
     화면이 오후 2시를 찍으면 화면이 거짓말이다. 저장(ts)은 진짜 epoch 그대로고
     번역은 그리는 순간에만 한다 */
  eq('찍히는 시각은 세계 시계로 번역한다',
    /const isToday=ts=>gameAt\(ts\)\.toDateString\(\)===nowClock\(\)\.toDateString\(\)/.test(rules), true);
}
/* ── F. 시계 통일 — 번역기는 하나다 ──
   gameAt(ts) 하나가 저장된 진짜 epoch를 세계 시각으로 번역한다. 리얼 모드에서는
   항등이라 아무것도 안 변하고, 스피드 모드에서는 앵커 날 아침 여덟 시에서
   출발해 흐른 진짜 시간 × SPEED_RATE만큼 간다. 실제로 굴려서 잰다 —
   모양만 보면 정의가 뒤집혀도 통과한다. */
{
  const F = new Function(
    'const localStorage={_v:{},getItem(k){return this._v[k]||null},setItem(k,v){this._v[k]=v}};'
    + web.slice(web.indexOf('const ENROLL_DAYS'), web.indexOf('/* ── 이름이 불린 횟수 ──'))
    + web.slice(web.indexOf('const fmtClock='), web.indexOf('/* ── 지금이 언제인가'))
    + 'return {saveMode,setWorldAt,gameAt,fmtClock,isToday,fmtDivider,fmtListTime,fmtDay,dividerGap,nowClock};')();
  /* 리얼 모드 — 번역은 항등이다 */
  F.saveMode('real');
  const t = new Date(2026, 0, 6, 14, 30).getTime();
  eq('리얼 모드의 gameAt은 항등이다', F.gameAt(t).getTime(), t);
  eq('리얼 모드 말풍선은 그대로 찍힌다', F.fmtClock(t), '오후 2:30');
  eq('리얼 모드 구분선은 진짜 십 분이다',
    [F.dividerGap(t, t + 11 * 60 * 1000), F.dividerGap(t, t + 9 * 60 * 1000)], [true, false]);
  /* 스피드 모드 — 일곱 시간 전에 시작했으면 게임으로 하루가 넘게 흘렀다 */
  F.saveMode('speed');
  const anchor = Date.now() - 7 * 3600 * 1000;
  F.setWorldAt(anchor);
  const early = anchor + 15 * 60 * 1000;          // 십오 분째에 찍힌 말
  /* 켠 시각에서 출발하므로 십오 분째는 앵커 + 한 시간이다 */
  eq('십오 분째 말풍선은 한 시간 뒤다',
    Math.round((F.gameAt(early).getTime() - anchor) / 60000), 60);
  /* 화면에 찍히는 글자도 번역된 시각이다 — 리얼 모드로 그 세계 시각을
     그대로 찍어 견준다(같은 입력을 두 번 넣으면 늘 같아서 자가 안 된다) */
  eq('말풍선도 번역돼 찍힌다', (() => {
    const world = F.gameAt(early).getTime();
    const spoken = F.fmtClock(early);
    F.saveMode('real'); const plain = F.fmtClock(world); F.saveMode('speed');
    return [spoken, spoken === plain];
  })(), [F.fmtClock(early), true]);
  /* 앵커보다 먼저 찍힌 ts는 앵커에 멈춘다 — 음수로 거슬러 올라가지 않는다 */
  eq('앵커 앞은 앵커에 멈춘다',
    F.gameAt(anchor - 3600 * 1000).getTime(), F.gameAt(anchor).getTime());
  /* 「오늘」도 세계의 오늘이다 — 첫날의 말은 이제 세계의 어제다 */
  eq('첫날 말풍선은 세계의 어제다', F.isToday(early), false);
  eq('지금 찍힌 말은 오늘이다', F.isToday(Date.now()), true);
  eq('어제 말풍선엔 날짜가 붙는다', /^\d+월 \d+일 오/.test(F.fmtDivider(early)), true);
  eq('목록도 어제는 날짜만 적는다', /^\d+월 \d+일$/.test(F.fmtListTime(early)), true);
  /* 구분선의 십 분도 게임 십 분이다 — 진짜 삼 분이면 게임 십이 분 */
  eq('구분선은 세계의 십 분으로 잰다',
    [F.dividerGap(early, early + 3 * 60 * 1000), F.dividerGap(early, early + 2 * 60 * 1000)], [true, false]);
  eq('첫 말 앞에는 늘 구분선이다', F.dividerGap(undefined, early), true);
  F.saveMode('real');
}
/* 저장은 진짜 epoch 그대로다 — ts·since·created_at에 gameAt을 쓰면 앵커(첫 ts)가
   번역된 시각을 도로 먹어 시계가 발산한다. 계약이 적은 최대 위험. */
{
  const everything = [web, appSrc, readFileSync(join(ROOT, 'app/lib/rules.ts'), 'utf8')].join('\n');
  eq('저장 ts에 번역기가 안 낀다', /ts:\s*gameAt\(/.test(everything), false);
  eq('since에도 안 낀다', /since:\s*gameAt\(/.test(everything), false);
  eq('created_at에도 안 낀다', /created_at:\s*gameAt\(/.test(everything), false);
  /* 안 바꿀 것 — 앵커·하루 열쇠·도장·선톡 간격은 번역 없이 그대로다 */
  const rules = readFileSync(join(ROOT, 'app-data.js'), 'utf8');
  eq('앵커는 진짜 첫 ts다', /const firstTsOf=store=>Object\.values\(\(store&&store\.msgs\)\|\|\{\}\)\.flat\(\)/.test(rules)
    && !/firstTsOf=[\s\S]{0,120}gameAt\(/.test(rules), true);
  /* 하루 열쇠는 **세계 달력**을 본다 — 인자가 오면 그건 이미 번역된 세계
     시각이라 다시 안 씌운다. 인자가 없으면 지금의 세계 시각이다 */
  eq('하루 열쇠는 세계 달력이다',
    /const d=now\?new Date\(now\):worldNow\(\); if\(d\.getHours\(\)<5\)d\.setDate\(d\.getDate\(\)-1\);/.test(rules), true);
  eq('도장도 그대로다', /const giftedToday=\(char,now\)=>loadGiftDay\(\)\[char\]===dayKey\(now\);/.test(rules)
    && /const goneToday=\(place,now\)=>loadGone\(\)\[place\]===dayKey\(now\);/.test(rules), true);
  eq('선톡 간격은 진짜 분으로 잰다', /const gapMin=list\.length\?Math\.round\(\(Date\.now\(\)-list\[list\.length-1\]\.ts\)\/60000\):-1;/.test(web), true);
  /* 시계 소스는 한 군데다 — 앱은 자기 fmtTime을 버리고 규칙 것을 쓴다 */
  eq('앱의 자체 fmtTime이 없다', /const fmtTime\s*=/.test(appSrc), false);
  eq('앱이 규칙의 시계를 들여온다', /fmtClock, fmtListTime, fmtDivider, dividerGap, gameAt,/.test(appSrc), true);
  eq('앱 내보내기에 시각이 붙는다', /내보낸 시각: '\+gameAt\(Date\.now\(\)\)\.toLocaleString\('ko-KR'\)/.test(appSrc)
    && /\[\$\{fmtDivider\(m\.created_at\)\}\]/.test(appSrc), true);
  eq('웹 내보내기 머리도 세계 시각이다', /내보낸 시각: "\+gameAt\(Date\.now\(\)\)\.toLocaleString\("ko-KR"\)/.test(web), true);
  /* 목록·상단바·구분선이 같은 번역을 본다 */
  eq('앱 목록·상단바·구분선이 규칙 시계를 쓴다', /fmtListTime\(last\.created_at\)/.test(appSrc)
    && /fmtClock\(Date\.now\(\)\)/.test(appSrc)
    && /fmtDivider\(m\.created_at\)/.test(appSrc)
    && /dividerGap\(prev&&prev\.created_at,m\.created_at\)/.test(appSrc), true);
  eq('웹 구분선도 세계 십 분이다', /const gap=dividerGap\(prev&&prev\.ts,m\.ts\);/.test(web), true);
  eq('방 목록의 자는 중도 세계 시계다', /const pr=presence\(r\.id,gameAt\(now\)\);/.test(web), true);
  /* 첫 만남 날짜도 세계 날짜다 — 앱 StatsPanel이 자체 MON·day로 진짜 달력을
     보면, 같은 첫 만남이 웹에서는 게임 날짜·앱에서는 현실 날짜로 갈린다 */
  eq('앱이 fmtDay를 들여온다', /fmtClock, fmtListTime, fmtDivider, dividerGap, gameAt, fmtDay,/.test(appSrc), true);
  eq('첫 만남 날짜는 규칙의 fmtDay다', /'first met u · '\+fmtDay\(first\)/.test(appSrc), true);
  eq('StatsPanel에 현실 시계가 안 남았다', (() => {
    const s = appSrc.indexOf('function StatsPanel(');
    const body = appSrc.slice(s, appSrc.indexOf('\nfunction ', s + 1));
    return s >= 0 && !/new Date\(/.test(body) && !/const MON=/.test(body);
  })(), true);
}
eq('시간표도 세계 시계를 본다', /function Timetable\(\{wend,onFillWend,onClose\}\)\{[\s\S]{0,220}const now=nowClock\(\);/.test(web), true);
/* 세계 시계의 출발 자리는 store가 바뀔 때마다 세운다 — 규칙들은 저장소를
   스스로 못 본다. 세는 것은 첫 말풍선의 시각 하나고, 말풍선 수는 안 들어간다 */
eq('웹이 첫 말풍선으로 시계를 세운다', /setWorldAt\(firstTsOf\(store\)\)/.test(web), true);
eq('앱은 DB 첫 행으로 세운다',
  /setAnchor\(await firstTsFromDB\(\)\)/.test(appSrc) && /setWorldAt\(anchor\)/.test(appSrc), true);
/* ── 말풍선이 달력을 못 민다 ──
   이 셋이 살아 있으면 인물의 수다가 D-일차를 태운다. 실제로 그렇게 됐다 */
for (const [label, src] of [['웹', web], ['앱', appSrc],
  ['앱 규칙', readFileSync(join(ROOT, 'app/lib/rules.ts'), 'utf8')]])
  eq(`${label}에 말풍선 달력이 안 남았다`,
    /speedCountOf|speedDaysOf|SPEED_PER_DAY|speedDay\(\)/.test(src), false);
/* 하루 한 번 도장·남은 날·지난 날이 다 같은 세계 시계를 본다 */
eq('도장은 세계 달력을 본다',
  /const dayKey=now=>\{\s*const d=now\?new Date\(now\):worldNow\(\);/.test(web), true);
eq('남은 날도 세계 시계다',
  /const daysLeft=store=>Math\.max\(0,ENROLL_DAYS\+loadExtend\(\)-worldDaysOf\(store\)\);/.test(web)
  && /const daysSince=store=>worldDaysOf\(store\);/.test(web), true);
/* 개발 오프셋은 「지금」에만 더한다 — gameAt에 넣으면 과거 말풍선 시각까지
   같이 움직이고, 일차 계산에서는 시작과 지금 양쪽에 들어가 상쇄된다 */
eq('개발 오프셋은 worldNow에만 있다',
  /const worldNow=\(\)=>new Date\(gameAt\(Date\.now\(\)\)\.getTime\(\)\+DEV_SKEW\);/.test(web)
  && !/DEV_SKEW/.test(web.slice(web.indexOf('const gameAt='), web.indexOf('const worldStart='))), true);
/* 시간 이동은 빌드 플래그 뒤에 있다 — localStorage로 켜지면 콘솔 한 줄로
   테스터의 판이 조용히 달라진다. 그리고 배포 기본값은 꺼진 채여야 한다 */
eq('시간 이동은 빌드가 켠다',
  /const DEV_TIME = typeof NULL_DEV !== "undefined" && !!NULL_DEV;/.test(web), true);
eq('배포 기본값은 꺼져 있다',
  /window\.NULL_DEV = false;/.test(readFileSync(join(ROOT, 'index.html'), 'utf8')), true);
eq('단추도 그 플래그 뒤다',
  /function DevTime\(\{left\}\)\{[\s\S]{0,120}if\(!DEV_TIME\)return null;/
    .test(readFileSync(join(ROOT, 'app-ui.js'), 'utf8')), true);

/* ── 앱도 같은 세계 시계를 본다 ──
   여기가 이번에 제일 크게 갈려 있던 자리다. 앱은 화면이 든 **최근 1000개**로
   첫 시각을 뽑고 현실 날짜로 D-일차를 따로 셌다 — 대화가 천 개를 넘으면
   앵커가 앞으로 밀려 지난 날이 도로 줄고, 스피드 판에서도 리얼처럼 셌다. */
{
  const api = readFileSync(join(ROOT, 'app/lib/api.ts'), 'utf8');
  eq('앱이 최근 1000개로 앵커를 안 잡는다', /firstTs=Object\.values\(msgs\)/.test(appSrc), false);
  eq('앱의 앵커는 DB 첫 행이다',
    /setAnchor\(await firstTsFromDB\(\)\)/.test(appSrc)
    && /getFirstMsg\(room\)/.test(api), true);
  eq('앱의 남은 날·지난 날도 규칙 것을 쓴다',
    /const dLeft=anchor\?daysLeft\(clockStore\)/.test(appSrc)
    && /const dayN=anchor\?daysSince\(clockStore\)/.test(appSrc), true);
  eq('앱의 재회도 세계 시계로 잰다', /m\.created_at>=leaveTsOf\(clockStore\)/.test(appSrc), true);
  eq('워커에 보내는 days도 세계 시계다',
    /setWorldAt\(first\);[\s\S]{0,120}daysSince\(/.test(api), true);
  /* 모드는 shim이 값을 퍼온 **뒤에** 읽어야 한다 — useState(loadMode)는 그
     전에 한 번 돌아서 늘 real로 굳었다. 스피드 판이 껐다 켜면 리얼이 됐다 */
  eq('모드는 저장소를 퍼온 뒤에 읽는다',
    /await hydrateShim\(\);[\s\S]{0,700}setMode\(loadMode\(\)\)/.test(appSrc), true);
  /* 새로 시작하면 앵커도 지운다 — 안 지우면 새 판이 옛 판의 D-일차를 문다 */
  eq('새로 시작하면 시계도 처음으로',
    /setAnchor\(0\); setWorldAt\(0\); setMode\(loadMode\(\)\)/.test(appSrc), true);
}

/* 모드는 판마다 하나고 등록 화면에서 고른다 — 중간에 바꾸면 D-N이 튄다.
   이제 곧바로 안 바꾼다. 되돌릴 수 없는 선택이라 창이 한 번 묻는다 —
   누르는 것은 setAskMode고, onMode는 창의 확정 단추만 부른다. */
for (const [label, src, re] of [
  ['웹', web, /<span className="lab">MODE<\/span>/],
  ['앱', appSrc, /<Text style=\{en\.rowL\}>MODE<\/Text>/],
])
  eq(`${label}은 등록 화면에서 고른다`, re.test(src) && /setAskMode\(k\)/.test(src), true);
/* 누르는 자리와 정하는 자리가 갈렸다 — 알약이 바로 onMode를 부르면 창이 장식이 된다 */
for (const [label, src] of [['웹', web], ['앱', appSrc]]) {
  eq(`${label}의 알약은 곧바로 안 바꾼다`, /onPress=\{\(\)=>onMode\(k\)\}|onClick=\{\(\)=>onMode\(k\)\}/.test(src), false);
  eq(`${label}은 창의 확정에서만 바꾼다`, /onYes=\{\(\)=>\{onMode\(askMode\)/.test(src), true);
}
/* 두 화면의 글월이 같아야 한다 — 같은 것을 고르는데 설명이 다르면 다른 기능이다 */
const dlgSrc = readFileSync(join(ROOT, 'app/screens/Dialogs.tsx'), 'utf8');
for (const [label, src] of [['웹', web], ['앱', appSrc + dlgSrc]]) {
  eq(`${label}의 모드 팝업 글월이 같다`,
    ['하루가 진짜로 지나갑니다. 앱을 꺼도 세계는 흐르고, 엔딩까지 한 달입니다.',
     '빠르게 진행됩니다. 현실 하루에 게임 나흘이 지나요.',
     '한 번 정하면 바꿀 수 없어요'].filter(t => !src.includes(t)), []);
}
/* ── 고른 것이 제목이 된다 ──
   확인창이 확인해야 하는 건 「무엇을 골랐는가」인데, 전에는 고른 값이 제일
   작고 그걸 설명하는 문장이 제일 컸다. */
{
  const mdCss = readFileSync(join(ROOT, 'null.css'), 'utf8');
  eq('고른 값이 제일 크다', (() => {
    const pick = (mdCss.match(/\.mdpick b\{[^}]*font-size:(\d+(?:\.\d+)?)px/) || [])[1];
    const body = (mdCss.match(/\.mdtx\{[^}]*font-size:(\d+(?:\.\d+)?)px/) || [])[1];
    return pick && body && Number(pick) > Number(body);
  })(), true);
  /* 「현실 하루에 게임 나흘」은 문장이 아니라 비율이다 — 눈금으로 말한다 */
  for (const [label, src] of [['웹', web], ['앱', dlgSrc]])
    eq(`${label}은 비율을 눈금으로 말한다`,
      /현 실/.test(src) && /게 임/.test(src) && /\[0,1,2,3\]\.map/.test(src), true);
  eq('real은 한 칸 · speed는 네 칸',
    [/real:\{t:"real", days:1,/.test(web), /speed:\{t:"speed", days:4,/.test(web),
     /real:\{days:1,/.test(dlgSrc), /speed:\{days:4,/.test(dlgSrc)], [true, true, true, true]);
  /* 경고는 점선 상자에서 꺼낸다 — 이 앱에서 점선 둥근 상자는 「채워야 할 빈칸」이라
     경고를 담으면 입력 안 한 칸처럼 보인다 */
  eq('경고가 점선 상자에 안 담긴다',
    /\.mdlock\{[^}]*(dashed|border:1px)/.test(mdCss), false);
  eq('자물쇠 한 줄로 단추 위에 붙는다',
    /\.mdlock\{display:flex;align-items:center;justify-content:center/.test(mdCss)
    && /<svg width="10" height="11"[\s\S]{0,320}한 번 정하면 바꿀 수 없어요/.test(web), true);
  eq('앱도 자물쇠 한 줄이다', /lockIco|lockArc|lockBox/.test(dlgSrc), true);
}
for (const [label, src] of [['웹', web], ['앱', appSrc]])
  eq(`${label}이 고른 것을 저장한다`,
    /onMode=\{m=>\{setMode\(m\);saveMode\(m\)\}\}/.test(src), true);
/* 두 모드의 글월이 같아야 한다 — 같은 것을 고르는데 설명이 다르면 다른 기능이다 */
for (const [label, src] of [['웹', web], ['앱', appSrc]])
  eq(`${label}의 모드 설명이 같다`,
    /현실 하루 = NULL 하루! ♡/.test(src) && /하루가 4배로 Speed up!/.test(src), true);
/* 설명은 알약 밑으로 내린다 — 라벨 밑에 붙으면 어느 알약 얘기인지 안 보인다.
   66(라벨) + 5(gap) 만큼 들여써야 알약과 왼쪽이 맞는다 */
eq('웹 설명이 알약 밑에 선다', /\.emhint\{flex:0 0 100%;padding-left:71px/.test(web), true);
eq('앱 설명이 알약 밑에 선다', /modeH:\{\.\.\.F,width:'100%',paddingLeft:71/.test(appSrc), true);
/* 얼굴은 통째로 한 덩어리다 — 안 묶으면 다음 줄에 「)੭່˙」만 남는다 */
eq('얼굴이 쪼개지지 않는다', /\.emhint \.kao\{white-space:nowrap\}/.test(web), true);
/* 고른 쪽은 Click! 단추와 같은 가족이다 — 눌리는 것으로 보여야 한다 */
eq('고른 알약이 눌리는 모양이다',
  /\.emode b\.on\{[\s\S]{0,220}box-shadow:inset 0 1px 0 #fff,0 2px 0 #edbcd6\}/.test(web)
  && /\.emode b:active\{transform:translateY\(1px\)\}/.test(web), true);
/* 줄이 하나 늘었다 — 애니메이션 칸을 안 늘리면 DAYS LEFT가 영영 안 뜬다 */
eq('앱이 줄 수를 맞춘다',
  /Array\.from\(\{length:ENR_FIELDS\.length\+2\}/.test(appSrc)
  && /anim\(rows\[5\]\)/.test(appSrc), true);
/* 웹은 CSS가 줄마다 지연을 준다. 다섯까지만 있으면 DAYS LEFT만 지연 0이라
   순서를 안 지키고 먼저 튀어나온다 — 한 줄씩 찍히는 게 이 화면의 전부인데 */
eq('웹도 줄 수를 맞춘다',
  /\.enr \.eline:nth-of-type\(6\)\{animation-delay:1\.55s\}/.test(web), true);
/* 바뀌는 것은 「실습이 얼마나 진행됐나」뿐이다. 「지금 몇 시인가」는 안 바뀐다 */
eq('잠과 시간표는 두 모드가 같다',
  /function presence\(id, now\)\{[\s\S]{0,400}?speedOn/.test(web), false);

/* ── 첫 칸은 첫날에, 뒤는 사흘에 하나씩 ──
   전에는 첫 칸이 사흘째에야 열렸다. 그때까지 이 탭은 잠긴 상자 열여덟 개고,
   무엇을 모으는 탭인지 알 길이 없다. 그리고 뒤쪽 넷이 23·24·25·26일에
   하루 간격으로 몰려 있었다 — 마지막 나흘에 여덟 개가 터지면 하나씩 읽히지
   않는다. 날짜 문은 0·3·6·9·13·17·20·23·26이다. */
eq('첫 칸은 첫날에 열린다', [uk(11, 0), uk(12, 0)], [0, 2]);
eq('날짜만 가도 대화가 모자라면 안 열린다', uk(10, 30), 0);
eq('사흘에 하나씩 온다',
  [uk(120, 0), uk(120, 3), uk(120, 13), uk(120, 20), uk(120, 26)], [2, 4, 10, 14, 18]);
/* 마지막 나흘에 몰리지 않는다 — 어느 나흘을 잘라도 넷을 넘지 않는다 */
eq('한 나흘에 몰리지 않는다',
  Array.from({ length: 28 }, (_, d) => uk(120, d + 3) - uk(120, d)).filter(n => n > 4), []);
/* 마지막 칸은 26일 그대로다 — 떠나기 나흘 전에 마지막 장이 열린다 */
eq('마지막 칸은 그대로 26일이다', [uk(120, 25), uk(120, 26)], [16, 18]);
/* 표가 세 군데 있다 — 워커·웹·앱. 하나만 고치면 화면에 뜨는 진행도와 실제
   해금 시점이 어긋나는데, 그건 눈으로 안 보인다. 키·조건을 통째로 대조한다. */
{
  const pick = (t, from, to, re) => [...t.slice(t.indexOf(from), t.indexOf(to)).matchAll(re)]
    .map(m => `${m[1]}:${m[2]}:${m[3]}`);
  const W = pick(workerSrc, 'const UNLOCKS = [', '/* 상태메시지',
    /key: "([^"]+)", room: "([a-z]+)", at: (\d+)/g);
  const H = pick(web, 'const HIDDEN=[', 'const HIDDEN_LABEL',
    /key:"([^"]+)",\s*file:[^,]+,\s*label:[^,]+, room:"([a-z]+)", at:(\d+)/g);
  /* 앱은 이 표를 안 들고 있다 — 규칙 파일에서 온다. 거기서 센다 */
  const A = pick(readFileSync(join(ROOT, 'app/lib/rules.ts'), 'utf8'),
    'const HIDDEN=[', 'const HIDDEN_LABEL',
    /key:"([^"]+)",\s*file:[^,]+,\s*label:[^,]+, room:"([a-z]+)", at:(\d+)/g);
  eq('해금 표가 18개다', [W.length, H.length, A.length], [18, 18, 18]);
  /* 안쪽까지 한쪽만 열리면 짝이 깨진다. 두 사람이 같은 수여야 한다 */
  eq('두 사람이 같은 수다',
    [W.filter(x => x.includes('jaeeon')).length, W.filter(x => x.includes('minhyun')).length], [9, 9]);
  /* 격자가 2단이라 표 순서가 그대로 왼쪽·오른쪽이 된다. 재언 둘이 연달아
     있으면 그 줄만 재언 둘이 되고, 그 아래로 두 사람이 통째로 어긋난다 */
  eq('표가 재언·민현 순으로 번갈아 있다',
    W.map((x, i) => x.includes(i % 2 ? 'minhyun' : 'jaeeon')).filter(v => !v).length, 0);
  eq('웹 격자가 2단이다', /grid-template-columns:repeat\(2,1fr\)/.test(web), true);
  eq('워커와 웹이 같은 표를 쓴다', W.filter((x, i) => x !== H[i]), []);
  eq('웹과 앱이 같은 표를 쓴다', H.filter((x, i) => x !== A[i]), []);
}

/* 안쪽 일곱은 종이다 — 일기 넉 장, 상담 기록 둘, 그리고 계정 하나.
   사진으로 보여주던 것들은 뺐다. 안으로 들어갈수록 사진이 아니라 기록이 나온다 */
eq('안쪽은 전부 기록이다', (() => {
  const late = unlockedKeys({ jaeeon: 120, minhyun: 120 }, 30)
    .filter(k => /^hidden-/.test(k));
  return [late.length, late.filter(k => /diary/.test(k)).length,
          late.filter(k => /counseling/.test(k)).length, late.filter(k => /sns/.test(k)).length];
})(), [8, 4, 2, 2]);
eq('말을 안 하면 날짜가 가도 안 열린다', uk(10, 30), 0);
/* .hidden의 "N more"가 대화만 세고 있었다. 날짜를 걸고 나니 120마디를 채워도
   "0 more"인데 안 열리는 칸이 생겼다. 남은 쪽만 보여주는 것도 답이 아니었다 —
   "12 more"가 어느 순간 "5일 뒤"로 바뀌면 속은 기분이 든다. 그렇다고 둘 다 쓰면
   규칙을 다 알려주는 셈이다. 그래서 숫자를 아예 안 쓴다. */
eq('남은 수를 세던 코드가 없다',
  /h\.at-\(counts\[h\.room\]/.test(web + appSrc), false);
eq('자물쇠는 남는다', /className="hlock"><LockIcon/.test(web) && /rl\.hlock/.test(appSrc), true);
/* 숫자를 __로 가려놓고 이름만 ???이면 말이 안 맞는다. 둘 다 빈칸으로 간다 */
eq('물음표를 안 쓴다', /"\?\?\?"|'\?\?\?'/.test(web + appSrc), false);

/* 세 군데가 같은 날짜를 써야 한다. 어긋나면 서버가 연기하는 단계와
   화면이 보여주는 단계가 따로 논다 */
const DAYS = [0, 4, 10, 18, 25];
eq('웹이 같은 날짜를 쓴다',
  JSON.parse((web.match(/const STAGE_DAY=(\[[^\]]*\])/) || [])[1]), DAYS);
eq('앱이 같은 날짜를 쓴다',
  JSON.parse((appSrc.match(/const STAGE_DAY=(\[[^\]]*\])/) || [])[1]), DAYS);
eq('워커가 같은 날짜를 쓴다',
  [0, 4, 10, 18].map(d => workerSrc.includes(`day: ${d},`)), [true, true, true, true]);
/* 클라이언트가 날짜를 안 보내면 서버는 셀 방법이 없다 */
eq('웹·앱 둘 다 날짜를 보낸다',
  /payload\.days=daysSince/.test(web) && /days: await buildDays\(\),/.test(readFileSync(join(ROOT, 'app/lib/api.ts'), 'utf8')), true);
eq('앱이 서버 상메를 저장하지 않는다', /saveStatus/.test(appSrc + profSrc), false);
eq('워커에 상메 문구가 남아 있지 않다',
  /별일 없어요\.|문은 열어둘게요\./.test(workerSrc), false);
/* 연기 지시에는 원래도 상메가 없다 */
eq('연기 지시와 상메는 표가 따로다', /status: \{ jaeeon/.test(workerSrc), false);
eq('안 쓴 문구도 남겨둔다', exists('docs/status-messages.md'), true);

/* 사진첩은 고정 목록인데 프롬프트가 "직접 찍은 사진을 보낼 수 있다"로 시작해서,
   모델이 지금 새로 찍을 수 있는 줄 알았다. 비니를 선물하니 "쓰고 찍을게요"를
   세 번 되풀이했고 세 번 다 아무것도 안 갔다 — 없는 키는 서버가 버리기 때문이다. */
eq('사진첩이 고정이라고 못 박았다', /사진첩은 아래가 전부다\. 새로 찍을 수 없다/.test(workerSrc), true);
eq('없는 사진을 찍는 척하지 말라고 했다', /찍는 척하지 않는다/.test(workerSrc), true);
/* 선물은 사진에 없다. 준 물건을 걸치고 찍은 사진은 목록에 없다 */
eq('선물은 사진에 안 나온다고 했다', /선물은 사진에 안 나온다/.test(workerSrc), true);

/* ── 같이 가자는 제안 ──
   서버가 "이번 답에 옥상 가자고 해라"라고 꽂던 것이다. 조건이 대화 수 하나뿐이라
   그 뒤로 매 턴 참이었고, 그래서 묻는 말에 답도 안 하고 딴 데 가자고 했다.
   굳이 맨날 어디를 갈 이유가 없다. 지금은 서버가 문만 열어두고 모델이 고른다. */
const invSrc = workerSrc.slice(workerSrc.indexOf('const INVITES ='), workerSrc.indexOf('function buildInvite'));
const INV = new Function(invSrc + ';return {invitesFor, pickInvite}')();
const open = (n, done = [], ref = []) => INV.invitesFor('chat', 'jaeeon', { jaeeon: n }, done, ref);

eq('서버가 자리를 정하지 않는다', /이번 답에 할 것/.test(workerSrc), false);
eq('문턱 전에는 문이 안 열린다', open(39), []);
eq('문턱을 넘으면 열린다', open(40), ['옥상']);
/* 열려 있어도 매 턴 꺼내는 게 아니다 — 안 꺼내는 게 기본이라고 말해둔다 */
eq('안 꺼내는 게 기본이다', /대부분의 턴에는 안 꺼낸다/.test(workerSrc), true);
eq('하던 얘기에서 이어질 때만', /지금 하던 얘기에서 자연스럽게 이어질 때/.test(workerSrc), true);
eq('무거우면 안 꺼낸다', /아프다고 했거나 가라앉아 있으면 안 꺼낸다/.test(workerSrc), true);

eq('다녀온 곳은 문이 닫힌다', open(125, ['옥상']), ['도서관', '빨래방']);
eq('거절당한 곳도 닫힌다', open(125, [], ['도서관']), ['옥상', '빨래방']);
eq('셋 다 끝나면 목록이 없다', open(125, ['옥상', '도서관', '빨래방']), []);
/* 목록이 비면 그 대목 자체가 프롬프트에서 빠진다 */
eq('열린 자리가 없으면 얘기도 안 꺼낸다',
  buildVolatile('chat', 'jaeeon', 'R', null, [], null, { jaeeon: 10 }, null, null, [])
    .includes('같이 가자고 할 수 있는 자리'), false);

/* 모델이 지어낸 장소로 약속이 잡히면 유저 화면에 없는 곳이 남는다 */
eq('지어낸 장소는 통과 못 한다', INV.pickInvite('한강', ['옥상', '도서관']), null);
eq('열린 자리는 통과한다', INV.pickInvite('옥상', ['옥상', '도서관']), '옥상');
eq('안 골랐으면 없다', [INV.pickInvite('', ['옥상']), INV.pickInvite(null, ['옥상'])], [null, null]);
/* 모델이 JSON 맨 위에 쓴 것을 읽어온다 */
/* 부수 출력은 묶음에 들어 있다. 함수 객체에 매달지 않는다 —
   후보를 둘 파싱하면 뒤엣것이 앞엣것을 덮어서 A 대사에 B의 자리가 붙는다. */
eq('모델이 고른 자리를 읽는다',
  parseMessages('{"invite":"옥상","messages":["갈래요?"]}', 'jaeeon', ['jaeeon']).invite, '옥상');
eq('안 고른 턴은 비어 있다',
  parseMessages('{"messages":["아뇨."]}', 'jaeeon', ['jaeeon']).invite, '');
eq('함수에 부수 출력이 안 남는다',
  [parseMessages.invite, parseMessages.give], [undefined, undefined]);

/* ── 제 이름을 호칭 자리에 ──
   「식사 맛있게 하세요」에 「이재언도요.」가 돌아왔다. 「선생님도요」가
   나와야 할 자리다(docs/playlog-review.md). */
eq('제 이름만 있는 말풍선은 버린다',
  dropMeta([{ sender: 'jaeeon', text: '이재언도요.' }, { sender: 'jaeeon', text: '잘 가요.' }])
    .map(m => m.text), ['잘 가요.']);
eq('문장 안의 제 이름은 안 건드린다',
  dropMeta([{ sender: 'jaeeon', text: '이재언이라고 불러도 돼요.' }]).length, 1);

/* 모델이 가끔 한자를 흘린다 — "那, 도서관 갈래요." 스무 살과 스물아홉 살이
   메신저에서 한자를 칠 일이 없다. */
eq('한자를 지우고 앞 구두점까지 정리한다',
  trimTics([{ sender: 'jaeeon', text: '那, 도서관 갈래요.' }]).map(m => m.text),
  ['도서관 갈래요.']);
eq('한자만 남은 말풍선은 버린다',
  trimTics([{ sender: 'jaeeon', text: '那' }]).length, 0);
eq('한글은 안 건드린다',
  trimTics([{ sender: 'jaeeon', text: '그럼 도서관 갈래요.' }]).map(m => m.text),
  ['그럼 도서관 갈래요.']);
/* 한자가 한글에 붙어 있으면 단어 안에 낀 것이다. 지우면 「生수」가 「수」로,
   「便의점」이 「의점」으로 남아 문장 가운데가 구멍 난다 — 기록에서 그렇게
   깨진 말풍선이 셋 나왔다(docs/playlog-review.md). 한 줄 없어지는 것은
   티가 안 나는데 깨진 단어는 티가 난다. */
eq('단어에 낀 한자는 그 말풍선을 버린다',
  trimTics([{ sender: 'jaeeon', text: '生수 사 먹는 게 편하죠.' },
            { sender: 'jaeeon', text: '네.' }]).map(m => m.text), ['네.']);
eq('뒤에 붙은 것도 버린다',
  trimTics([{ sender: 'jaeeon', text: '편의店 가서 사요.' },
            { sender: 'jaeeon', text: '네.' }]).map(m => m.text), ['네.']);

/* ── 제 이름을 호칭 자리에 ──
   「식사 맛있게 하세요」에 「이재언도요.」가 돌아왔다. 「선생님도요」가
   나와야 할 자리다(docs/playlog-review.md). */
eq('제 이름만 있는 말풍선은 버린다',
  dropMeta([{ sender: 'jaeeon', text: '이재언도요.' }, { sender: 'jaeeon', text: '잘 가요.' }])
    .map(m => m.text), ['잘 가요.']);
eq('문장 안의 제 이름은 안 건드린다',
  dropMeta([{ sender: 'jaeeon', text: '이재언이라고 불러도 돼요.' }]).length, 1);

/* 한자만 흘리는 게 아니다. "Table of contents"가 민현의 말로 화면에 떨어졌다.
   한글이 한 자도 없는데 영문이 든 말풍선은 모델이 흘린 조각이다. */
eq('영문만 있는 말풍선은 버린다',
  trimTics([{ sender: 'minhyun', text: '이거 왜 자꾸 생각나지.' },
            { sender: 'minhyun', text: 'Table of contents' }]).map(m => m.text),
  ['이거 왜 자꾸 생각나지.']);
/* 한글이 섞인 줄은 안 건드린다 — 노래 제목이나 상표를 말할 수 있어야 한다 */
eq('한글이 섞이면 영문도 남는다',
  trimTics([{ sender: 'minhyun', text: 'Online at 2AM 들어봤어요?' }]).map(m => m.text),
  ['Online at 2AM 들어봤어요?']);
/* 사진은 살리고 말만 지운다 — 사진까지 버리면 보낸 게 통째로 사라진다 */
eq('사진에 붙은 영문 조각만 지운다',
  trimTics([{ sender: 'minhyun', text: 'Table of contents', photo: 'minhyun-nap' }])
    .map(m => m.text + '|' + m.photo), ['|minhyun-nap']);
eq('점만 있는 줄은 그대로다',
  trimTics([{ sender: 'minhyun', text: '...' }]).map(m => m.text), ['...']);

/* ── 메아리 ──
   유저: 「흥」 → 민현: 「흥이래요.」 유저가 방금 쓴 말을 그대로 옮기고 인용
   어미만 붙인 줄이다. 세계관에 적어놨는데 또 나왔다 — 글자로 거른다. */
const echo = (said, ...말) =>
  dropEcho(말.map(text => ({ sender: 'minhyun', text })), said).map(m => m.text);
eq('되돌려준 말을 버린다',
  echo('흥', '흥이래요.', '그럼 어쩔 수 없죠.'), ['그럼 어쩔 수 없죠.']);
eq('인용 어미가 뭐든 본다',
  ['흥이래요', '흥이래', '흥이라뇨', '흥이라니요', '흥이랍니까']
    .filter(t => echo('흥', t, '됐어요.').length !== 1), []);
/* 앞뒤 구두점과 따옴표는 벗기고 맞대본다 — 모양이 달라도 같은 말이다 */
eq('구두점이 붙어도 같은 말이다',
  echo('흥!', '"흥이래요..."', '알았어요.'), ['알았어요.']);
/* 단톡·관전방에서는 [이름]이 앞에 붙고, 연달아 보낸 말은 줄바꿈으로 합쳐진다 */
eq('단톡에서도 방금 한 말을 찾는다',
  lastSaid([{ role: 'user', content: '[문리현] 안녕\n[문리현] 흥' }], 'chat'), '흥');
eq('관전에는 유저 차례가 없다',
  lastSaid([{ role: 'user', content: '(유저 부재. 두 사람의 대화를 생성하라.)' }], 'auto'), '');

/* 부분만 따온 것은 안 건드린다 — 어디까지가 인용인지 글자로는 못 가른다.
   짐작해서 지우면 멀쩡한 말을 먹는다. 그쪽은 프롬프트 몫이다 */
eq('부분 인용은 그냥 둔다',
  echo('학교에 비리로 수영장 만들어줘', '비리로 수영장을요.'), ['비리로 수영장을요.']);
/* 유저의 말과 안 맞으면 -래요는 그냥 남의 말 전하기다 */
eq('남의 말 전하는 건 안 버린다',
  ['삼촌이 오래요.', '노래', '내일 쉬래요.'].filter(t => echo('밥 먹었어요', t).length !== 1), []);
eq('사진은 안 버린다',
  dropEcho([{ sender: 'minhyun', text: '흥이래요.', photo: 'minhyun-nap' }], '흥').length, 1);
/* 지울 것이 유일한 말풍선이면 그냥 둔다 — 침묵이 메아리보다 나쁘다 */
eq('말풍선을 다 비우지는 않는다', echo('흥', '흥이래요.'), ['흥이래요.']);
/* trimTics가 앞의 말줄임표를 뗀 뒤라야 「...흥이래요.」도 같은 줄로 보인다 */
eq('말버릇 필터 뒤에 있다',
  /dropEcho\(\s*\n?\s*trimTics\(/.test(workerSrc), true);

eq('한국어로만 말하라고 했다', /한국어로만 말한다/.test(workerSrc), true);
/* 대신 갈 곳이 있다 — 넷은 프로필 배경으로 걸린다. 사진 대신 거기를 가리키게 한다.
   나머지 선물은 화면 어디에도 안 보이므로 "프로필 봐요"라고 하면 안 된다. */
const giftHint = k => buildVolatile('chat', 'minhyun', 'R', null, [], null, { minhyun: 50 },
  { name: 'x', key: k }).includes('이건 네 **프로필 배경**에 걸린다');
eq('배경이 되는 선물만 프로필을 가리킨다',
  ['beanie', 'mug', 'photobook', 'earphone', 'hotpack', 'candy', ''].map(giftHint),
  [true, true, true, true, false, false, false]);

/* 떠난 뒤의 한 쌍은 대화 수가 아니라 시계가 정한다. 대화 수에 걸어놨더니
   하루에 백스무 마디 하면 D-29에 작별 인사가 떴다. */
eq('120은 아직 떠나기 전 문구다',
  [webProfiles.jaeeon.stages[4].status, webProfiles.minhyun.stages[4].status],
  ['남은 동안은 여기 있어요.', '안 알려줘도 알아요.']);
eq('작별 인사는 D-0이 정한다',
  /STATUS_GONE=\{jaeeon:"잘 지내요\. 항상\.", minhyun:"모르는 걸로 할게요\."\}/.test(web)
  && /STATUS_GONE/.test(profSrc), true);
eq('웹은 떠났으면 단계를 무시한다',
  /dLeft===0\?\(back\?STATUS_BACK:STATUS_GONE\)\[char\]/.test(web), true);
/* 앱은 서버가 써준 상메를 쓰는데, 서버는 첫 대화가 언제였는지 모른다.
   그래서 D-0은 서버 값보다도 앞선다 */
/* D-0에서 멈춰만 두면 작별 인사를 걸어둔 사람과 무한히 대화하는 화면이 된다.
   떠난 뒤에 유저가 말을 걸었으면 그건 작별이 아니라 재회다. */
eq('다시 오면 작별 인사가 아니다',
  /STATUS_BACK=\{jaeeon:"아직 자리 있어요\.", minhyun:"이제 와요\?"\}/.test(web)
  && /STATUS_BACK/.test(profSrc), true);
/* 유저 발화만 센다 — 선톡만 오고 답을 안 한 건 다시 온 게 아니다 */
eq('재회 판정은 유저 발화만 센다',
  /sender==="user"&&m\.ts>=leaveAt/.test(web) && /cameBack/.test(appSrc), true);


/* flex 안에서 svg는 자리가 모자라면 폭 0까지 쭈그러든다. 글자는 최소 폭이
   있어서 버티는데 그림은 안 버틴다. peek 옆의 달이 그렇게 사라졌다. */
eq('메뉴바 아이콘이 쭈그러들지 않는다', /\.menubar svg\{flex:none\}/.test(web), true);
eq('관찰 버튼이 줄어들지 않는다', /\.moonbtn\{flex:none\}/.test(web), true);
/* 한 줄에 일곱 개가 앉는데 폭이 390이다. 줄이 넘치면 맨 끝 peek이 잘린다 */
eq('메뉴바가 한 줄로 고정이다', /flex-wrap:nowrap/.test(web), true);
eq('메뉴 글자가 안 접힌다', /\.mbtn\{[^}]*white-space:nowrap/.test(web), true);
/* 달은 「peek」일 때만 뜬다. 360에서 재봤더니 오른쪽에 남는 자리가 66px인데
   달 달린 peek이 70px이라 처음부터 넘치고 있었다 — 글자가 길어지는 두 상태
   (04:59 · ···)에는 달이 쓰던 자리를 글자가 쓴다. 재고 나서 60px로 고정했다 */
eq('달은 peek일 때만 뜬다',
  /\{!autoLoading&&left<=0&&<MoonIcon\/>\}\s*\n\s*<span>\{autoLoading/.test(web), true);
eq('관찰 버튼은 세 상태가 같은 폭이다',
  /\.menubar \.moonbtn\{padding:0 8px;gap:4px;min-width:60px;justify-content:center\}/.test(web), true);
/* 「time passing...」은 단추에 안 들어간다 — 넣으면 119px이라 줄이 넘친다.
   전광판이 상태를 흘려보내는 자리라 그 말은 거기서 한다 */
eq('흐르는 중이라는 말은 전광판이 한다',
  /\{autoLoading\s*\n?\s*\?<>✧ time passing\.\.\./.test(web), true);
eq('단추에는 긴 글자가 안 들어간다', /time passing\.\.\.":left>0/.test(web), false);

/* ── 대화 지우기 ──
   두 단계는 원래 있었다. 문제는 단계 수가 아니라 이웃이었다 — 이름 바꾸러
   여는 창 안에 지우기 버튼이 앉아 있었다. */
eq('프로필 창에 지우기가 없다',
  /restart/.test(web.slice(web.indexOf('function ProfileDialog'),
    web.indexOf('/* ── 방 목록'))), false);
eq('지우기는 etc. 안에 있다',
  /etcdel/.test(web) && /setPopup\('reset'\)/.test(appSrc), true);
/* 앱의 프로필에도 없어야 한다 — 웹만 옮기고 앱을 두면 둘이 따로 논다 */
eq('앱 프로필 창에도 지우기가 없다',
  /setPopup\('reset'\)/.test(appSrc.slice(appSrc.indexOf("popup==='profile'"),
    appSrc.indexOf("popup==='reset'"))), false);
/* "되돌릴 수 없다"는 추상이고 숫자는 구체다. 지우는 건 기록만이 아니라
   시계와 해금까지인데, 옛 경고문은 그 말을 안 했다 */
eq('경고가 지금 상태를 숫자로 보여준다',
  /d-\{dLeft\} · hidden \{unlocked\.length\}\/\{HIDDEN\.length\}/.test(web)
  && /실습 D-\{dLeft\} · 히든/.test(appSrc), true);
/* 앱에는 취소가 없었다. 실수로 열었을 때 나갈 문이 안 보이는 건
   지우기 쉬운 것보다 나쁘다 */
eq('웹·앱 둘 다 취소로 물러설 수 있다',
  /onClick=\{\(\)=>setConfirming\(false\)\}>nvm/.test(web)
  && /onPress=\{\(\)=>setPopup\('help'\)\}><Text style=\{mo\.btnT\}>취소/.test(appSrc), true);

/* ── 선톡 ──
   방을 열어야 말을 거는 건 메신저가 아니다. 안 보고 있을 때 와야 안 읽음이
   붙고, 안 읽음이 붙어야 열어볼 이유가 생긴다. */
eq('웹·앱 둘 다 목록에서 선톡이 온다',
  /greetAtRef/.test(web) && /greetAtRef/.test(appSrc), true);
/* 두 사람이 같은 초에 말을 걸면 사람이 아니라 알림이다 */
eq('한 번에 한 사람만 건다',
  /\.sort\(\(a,b\)=>\(b\.gap<0\?1e9:b\.gap\)-\(a\.gap<0\?1e9:a\.gap\)\)\[0\]/.test(web)
  && /\.sort\(\(a,b\)=>\(b\.gap<0\?1e9:b\.gap\)-\(a\.gap<0\?1e9:a\.gap\)\)\[0\]/.test(appSrc), true);
/* 목록을 떠나면 예약도 취소돼야 한다 — 안 그러면 방을 연 직후에 한 번 더 온다.
   선톡이 모델 호출로 바뀌면서 타이머를 지우는 것만으로는 부족해졌다. 지우기
   직전에 이미 발화한 타이머가 네트워크를 타면 떠난 뒤에 말이 도착한다.
   그래서 깃발(live)을 같이 내린다 — 둘 다 있어야 통과다. */
eq('목록을 떠나면 선톡 예약이 취소된다',
  /return\(\)=>\{live=false;clearTimeout\(t\)\};/.test(web)
  && /return\(\)=>\{live=false;clearTimeout\(t\)\};/.test(appSrc), true);
eq('예약이 터져도 깃발이 내려가 있으면 안 건다',
  /if\(live\)greet\(cand\.id,0\)/.test(web)
  && /if\(live\) greet\(cand\.id,0\)/.test(appSrc), true);

/* ── vibe ──
   유저 발화가 하나뿐이면 물음표 하나로 비율이 1.0이 돼서 "캐묻는 중"이
   확정됐다. 한 마디 묻고 나간 사람을 두고 관전방에서 "요즘 이것저것
   캐묻던데"가 나갔다. 관전방이 유저를 읽는 유일한 입력값이라 오독이 비싸다. */
const apiSrc = readFileSync(join(ROOT, 'app/lib/api.ts'), 'utf8');
eq('표본이 셋은 돼야 눈치를 본다', /userMsgs\.length < 3\) return undefined/.test(apiSrc), true);
/* '평소'는 필드가 없는 것과 정보량이 같은데 가변부에서 자리만 차지했다 */
eq("'평소'를 신호로 보내지 않는다", /return '평소'/.test(apiSrc), false);
eq('판정 넷은 그대로다',
  ['들뜸', '캐묻는 중', '말이 짧아짐', '길게 말하는 중'].filter(v => !apiSrc.includes(`'${v}'`)), []);

/* ── 도착 선톡 ──
   전에는 선톡이 데모 전용이라 키가 살아 있으면 아무도 먼저 말을 걸지 않았다.
   지금은 항상 오고, 문장은 문구집의 「도착 선톡」에서 고른다. */
eq('선톡이 데모 전용이 아니다',
  /!demoOn\(\)\|\|enrolling\)return/.test(web), false);
/* 방까지 넘긴다 — 저녁에 처음 켜면 재언만 시제가 다른 인사를 한다.
   민현에게는 그 갈래가 없다(저녁이면 그는 선톡이 아니라 자리에서 만난다) */
eq('웹·앱 둘 다 공백과 방으로 인사 갈래를 고른다',
  /demoProactive\(id,demoGreetWhen\(gapMin,id\),name\)/.test(web)
  && /demoProactive\(id,demoGreetWhen\(gapMin,id\),name\)/.test(appSrc), true);
/* 십 분 만에 다시 들어온 사람한테 「이제 와요?」를 하면 시계를 안 보는 사람이 된다 */
{
  const eng = readFileSync(join(ROOT, 'tools/demo-engine.js'), 'utf8');
  const g = new Function(eng.slice(eng.indexOf('function demoGreetWhen'),
    eng.indexOf('/* 캐릭터가 먼저 거는 말')) + '\nreturn demoGreetWhen')();
  eq('처음이면 첫 만남', g(-1), '첫 만남');
  eq('세 시간 뒤는 평소 인사', g(60 * 5), '첫인사');
  eq('하루를 넘겨야 늦었다고 한다', [g(60 * 23), g(60 * 25)], ['첫인사', '오랜만']);
}
/* 「오랜만」 줄이 평소 인사에 섞이면 안 된다. 절 이름에 '첫인사'가 들어가면
   indexOf 필터가 세 갈래를 다 삼킨다 — 한 번 그랬다 */
{
  const corpus = new Function(readFileSync(join(ROOT, 'demo-lines.js'), 'utf8')
    + '\nreturn DEMO_CORPUS')();
  const pick = (c, w) => (corpus.proactive[c] || [])
    .filter(p => (p.when + ' ' + p.sec).indexOf(w) >= 0)
    .reduce((n, p) => n + p.lines.length, 0);
  eq('갈래가 1·20·6이다',
    ['jaeeon', 'minhyun'].map(c => [pick(c, '첫 만남'), pick(c, '첫인사'), pick(c, '오랜만')]),
    [[1, 20, 6], [1, 20, 6]]);
  /* 첫인사는 한 번뿐이라 뽑기로 둘 이유가 없다. 한 사람에 하나씩 정해져 있다 */
  eq('첫 만남은 정해진 한 줄이다',
    ['jaeeon', 'minhyun'].map(c => (corpus.proactive[c] || [])
      .filter(p => p.when === '첫 만남').flatMap(p => p.lines).length), [1, 1]);
  eq('재언은 안내로 문을 연다',
    (corpus.proactive.jaeeon.find(p => p.when === '첫 만남').lines[0] || []).join(' / '),
    '새로 오셨죠. / 애들 때문에 정신 없으시겠네요. / 저한테는 편하게 메세지 주셔도 됩니다.');
  {
    const open = corpus.proactive.minhyun.find(p => p.when === '첫 만남').lines[0] || [];
    eq('민현은 확인과 청구서로 문을 연다', open.join(' / '),
      '선생님. / 저 알죠? / 선생님이 저 책임진다면서요.');
    /* 「책임」은 이 관계의 첫 단어다. 골목에서 유저가 꺼낸 말을 돌려주는 것 */
    eq('첫 마디에 책임이 들어 있다', /책임/.test(open.join(' ')), true);
    /* 첫 화면에서 옥상 장면부터 꺼내면 안 물었는데 들이미는 고발이 된다.
       「책임진다면서요」만 남기고, 장면은 유저가 물은 뒤에 나온다. */
    eq('첫 화면은 장면을 안 꺼낸다', /옥상|병원|담배/.test(open.join(' ')), false);
    /* 옥상도 협박도 사라진 건 아니다. 인물 설정과 결 견본에 그대로 있어서
       유저가 답한 뒤에 나온다 — 그때는 순서가 맞는다 */
    eq('옥상과 책임은 프롬프트에 남아 있다',
      /책임진댔다고 소문낼 거예요/.test(workerSrc) && /책임은 언제 져요/.test(workerSrc), true);
  }

  /* ── 되물으면 그때 병원 옥상을 꺼낸다 ──
     묻고 나서 들으면 해명이고, 안 물었는데 들으면 고발이다. 순서가 전부다. */
  {
    const E = new Function(readFileSync(join(ROOT, 'demo-lines.js'), 'utf8')
      + '\nreturn {demoProactive, demoAnswer, demoGreetWhen}')();
    const open = () => E.demoProactive('minhyun', E.demoGreetWhen(-1), '수연');
    const ask = t => E.demoAnswer('minhyun', t, '수연', {}).map(m => m.text).join(' / ');
    open();
    eq('되물으면 병원 옥상이 나온다', /병원 옥상에서 만났/.test(ask('무슨 말이에요?')), true);
    /* 표현이 갈려도 열려야 한다 — 여기서 안 열리면 첫 대화가 막힌다 */
    eq('말을 어떻게 바꿔 물어도 열린다',
      ['뭔 소리야', '네?', '무슨 책임이요', '기억 안 나는데', '누구세요', '제가요?']
        .filter(t => { open(); return !/병원 옥상에서 만났/.test(ask(t)); }), []);
    /* 아무 데서나 열리면 안 된다. 첫 선톡 바로 뒤에서만이다 */
    E.demoAnswer('minhyun', '밥 먹었어요?', '수연', {});
    eq('평범한 대화 뒤에는 안 열린다', /병원 옥상에서 만났/.test(ask('무슨 말이에요?')), false);
    /* 재언에게는 이 갈래가 없다 — 그 옥상은 민현만 아는 장면이다 */
    E.demoProactive('jaeeon', E.demoGreetWhen(-1), '수연');
    eq('재언은 이 갈래가 없다',
      /옥상|병원|담배/.test(E.demoAnswer('jaeeon', '무슨 말이에요?', '수연', {}).map(m => m.text).join(' ')), false);
  }

/* ── 첫 만남 리텐콘 — 병원 옥상 ──
   후문 골목 맞담이 병원 옥상으로 바뀌었다(작가 원문). 유저는 담배를 피우지
   않았고, 하늘을 보고 있다가 민현의 담배를 밟아 끄게 했다. 재활병원이라
   민현의 상담 기록과 같은 건물이다. 옛 설정이 한 조각이라도 남으면
   세계가 두 개의 첫 만남을 갖는다. */
{
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  eq('첫 만남은 병원 옥상이다',
    /이민현은 개학 전 재활 치료 중인 병원 옥상에서 유저를 만났다/.test(wk)
    && /교복을 입고 몰래 담배를 피우다 유저를 만났다/.test(wk), true);
  eq('유저는 담배를 피우지 않았다',
    !/유저도 옆에서 담배/.test(wk) && /유저는 하늘을 보고 있었다/.test(wk), true);
  eq('설명은 물을 때만 한 번이다',
    /물을 때만 병원 옥상 일을 설명한다/.test(wk)
    && /한 번 설명한 뒤에는 같은 장면을 계속 끌어오지 않는다/.test(wk), true);
  eq('담배는 새로 안 산다, 라이터는 남는다',
    /그날 이후 담배를 새로 사지 않았다/.test(wk)
    && /라이터는 되돌아갈 수 있는 문이다/.test(wk)
    && /매번 괄호 지문이나 효과음으로 말하지 않는다/.test(wk), true);
  /* 옛 설정 소탕. 시험 파일 자신이 걸리지 않게 낱말을 이어 붙인다 */
  const OLD = '맞' + '담';
  const files = ['worker.js', 'app-data.js', 'app-ui.js', 'app.js', 'demo-lines.js',
    'README.md', 'docs/dialogue-corpus.md', 'app/lib/rules.ts', 'app/lib/demoLines.ts'];
  eq('맞담은 어디에도 없다',
    files.filter(f => readFileSync(join(ROOT, f), 'utf8').includes(OLD)), []);
}

/* ── 세계 확정(YES)과 D-0의 WHO ──
   YES를 누른 순간에만 세계가 생긴다. 이름이 저장돼 있어도 확정 전이면
   메신저로 안 간다. 나이는 세계 고정값 25다. D-0의 STAY 뒤에는 WHO가
   서고, 상대는 한 명·한 번이다. 카피는 작가가 못박은 그대로 —
   「NULL을」로 고치지 않는다(NULL=널이라 조사가 없다). */
{
  /* 물음은 NULL을 가운데 두고 두 줄로 갈라져 있다. 이어 읽으면 한 문장이다 */
  eq('확정 카피가 정확하다',
    web.includes('{name}, 너는 이 세계에')
    && web.includes('존재하게 할 수 있을까?')
    && web.includes('거절은 거절해'), true);
  /* ── 현실의 나는 □□이다 ──
     그 칸은 안 채워진다. 채워지면 이 게임이 아니다 — 이 세계에서만 값이
     생긴다(교생). 게임 이름이 거기서 온다.
     한동안 등록 창 제목줄에 흐르고 있었다. 지금은 제 화면을 갖는다(Intro) —
     그 자리에서 유저가 배역을 받고, 읽고, 단추를 눌러 등록으로 온다. */
  eq('그 한 줄이 웹·앱 둘 다 있다',
    [web, appSrc].filter(src => !(src.includes('현실에서 ') && src.includes('이 세계에서는 ')
      && src.includes('교생?') && src.includes('(,,◕ᗝ◕,,)♡.ᐟ.ᐟ'))).length, 0);
  eq('제목줄이 흐른다',
    /\.etbrun>i\{[^}]*animation:slide 17s linear infinite/.test(web), true);
  /* 점 셋은 오른쪽에 그대로 붙어 있어야 한다 — 흐르는 쪽에만 flex를 준다 */
  eq('점 셋은 제자리다', /\.etbrun\{flex:1;min-width:0;overflow:hidden/.test(web), true);
  /* 같은 말을 두 번 하지 않는다 — 확정 화면에서는 걷었다.
     「!!!WARNING!!!」은 첫날 통보 창이 원래 쓰던 말이라 전역으로 세면 안 된다 */
  eq('확정 화면은 그 말을 다시 안 한다', (() => {
    const i = web.indexOf('function Confirm({name,onYes,onBack})');
    const box = web.slice(i, web.indexOf('/* ── 마지막 빈칸 ──', i));
    return /WARNING|현실에서|교생\?/.test(box);
  })(), false);
  /* 등록 제목줄도 그 말을 다시 안 한다 — 바로 앞 화면(Intro)이 전체 화면으로
     그 말을 하고, 유저는 그걸 읽고 단추를 눌러 여기로 온다. 그 다음 창이 같은
     문장을 또 흘리면 방금 읽은 것을 되돌려주는 게 된다. 자리는 새 문구로
     채우지 않고 다른 창과 같은 이름(null.exe)을 쓴다 — 문구를 지어내지 않는다. */
  for (const [label, src, box] of [
    ['웹', web, web.slice(web.indexOf('function Enroll('), web.indexOf('function Intro('))],
    ['앱', appSrc, appSrc.slice(appSrc.indexOf('function EnrTitle('), appSrc.indexOf('function Intro('))],
  ]) {
    eq(`${label} 등록 제목줄은 그 말을 다시 안 한다`, /현실에서|교생\?/.test(box), false);
    eq(`${label} 등록 제목줄은 다른 창과 같은 이름이다`, /null\.exe/.test(box), true);
  }
  /* 그 문장이 사라진 게 아니라 제 화면으로 옮겨간 것이다 */
  eq('그 말은 배역 화면에 산다',
    [/function Intro\([^]{0,900}이 세계에서는/.test(web),
     /function Intro\([^]{0,1500}이 세계에서는/.test(appSrc)], [true, true]);
  /* 창틀이 이미 색을 갖고 있다 — 띠가 제 배경을 또 그리면 창 위에 뜬 것처럼 보인다 */
  eq('제목줄 띠는 배경을 안 그린다',
    /function Marquee\(\{text,bare\}/.test(appSrc)
    && /\{!bare&&<LinearGradient/.test(appSrc), true);
  eq('NULL에 조사를 안 붙였다', /NULL을 존재/.test(web), false);
  eq('이름만으로는 메신저에 못 들어간다',
    /localStorage\.getItem\("null_name"\)&&!loadWorld\(\)\?"enroll":false/.test(web), true);
  eq('YES 연타는 한 번이다', /if\(pressed\)return;setPressed\(true\);onYes\(\)/.test(web), true);
  /* ── 이 창만 어둡다 ──
     앱은 전부 파스텔이라, 파스텔로 그린 이 창은 제일 무거운 물음인데
     화면에서는 또 하나의 알림처럼 가벼웠다. 장식을 더하는 대신 값을 뒤집는다 —
     어두운 판 한 장, 흰 글자, 분홍 단추. 그리고 물음이 NULL을 가운데 두고
     갈라져서, 커서가 깜빡이는 그 빈칸이 곧 나라는 말을 화면이 스스로 한다. */
  /* 주석에도 같은 말이 적혀 있다. 그림만 본다 — return부터가 그림이다 */
  const cnfBox = () => {
    const i = web.indexOf('function Confirm({name,onYes,onBack})');
    const j = web.indexOf('return <div className="enr">', i);
    return web.slice(j, web.indexOf('/* ── 마지막 빈칸 ──', j));
  };
  eq('확정 창은 어두운 판이다', ['className="dlg cwin"','className="cq"',
    'className="cslot"','className="cbox"','className="ccar"','className="cfacts"',
    'className="etcdel cyes"'].filter(c => !cnfBox().includes(c)), []);
  /* 물음이 빈칸을 감싼다 — 위 반쪽, [NULL], 아래 반쪽 */
  eq('물음이 NULL을 사이에 두고 갈라진다', (() => {
    const b = cnfBox();
    return b.indexOf('너는 이 세계에') < b.indexOf('className="cslot"')
        && b.indexOf('className="cslot"') < b.indexOf('존재하게 할 수 있을까?');
  })(), true);
  /* 속카드도 등록 카드도 여기 오면 안 된다 */
  eq('확정 창에 속카드가 없다', /className="(ttpanel|tttag|ecard)/.test(cnfBox()), false);
  /* .kill은 「정말 지울래?」 자리의 빨간 단추다. 여기 오면 경고처럼 읽힌다 */
  eq('YES는 위험 단추가 아니다', /wbtn kill/.test(cnfBox()), false);
  /* 새 이름을 지을 때마다 남의 이름을 밟았다 — .cback은 다른 화면의 BACK 단추였고
     .chint은 선물 화면의 힌트였다(왼쪽 여백 64px). 둘 다 스타일을 통째로
     뒤집어썼다. 그래서 이 창이 지은 이름은 전부 이 구역 안에서만 산다 */
  eq('확정 창이 남의 이름을 안 밟았다', (() => {
    const css = readFileSync(join(ROOT, 'null.css'), 'utf8');
    const mark = css.indexOf('/* ── 세계 확정 창 ──');
    return ['cwin','cq','cslot','cbox','ccar','cfacts','cnull','cyes','cwhint']
      .filter(n => [...css.matchAll(new RegExp(`(^|[^-\\w])\\.${n}\\b`, 'g'))]
        .some(m => m.index < mark));
  })(), []);
  eq('내가 덧댄 중복 규칙도 걷었다', (web.match(/^\.cback\{/gm) || []).length, 1);
  /* 현실 □□ / 이 세계 교생 — 한 줄로 나란히 놓이면 그 대비가 곧 이야기다 */
  eq('현실과 이세계가 나란히 있다',
    web.includes('<b>현실</b> <em className="cnull">□□</em>')
    && web.includes('<b>이세계</b> <em>교생 ♡</em>'), true);
  /* 단추 아래라야 「YES밖에 없다」는 농담이 산다 */
  eq('거절은 거절해가 단추 밑에 붙는다', (() => {
    const b = cnfBox();
    return b.indexOf('className="etcdel cyes"') < b.indexOf('거절은 거절해');
  })(), true);
  eq('앱도 같은 그림이다',
    /backgroundColor:'#372a5c'/.test(appSrc)
    && /<Text style=\{cf\.boxT\}>NULL/.test(appSrc)
    && /<Text style=\{cf\.factK\}>이세계<\/Text> 교생 ♡/.test(appSrc)
    && /maxWidth:290/.test(appSrc), true);
  /* 앱에도 깜빡임이 있어야 그 칸이 입력칸으로 읽힌다 */
  eq('앱의 커서도 깜빡인다', /setInterval\(\(\)=>setOn\(v=>!v\),500\)/.test(appSrc), true);
  /* AGE 행은 남기고 입력만 잠근다. YES에 25가 프로필로 박힌다 */
  eq('나이는 세계 고정값 25다',
    /f\.k==="age"/.test(web)
    && /title="세계의 고정값">25</.test(web)
    && /setProfile\(p=>\(\{\.\.\.p,age:"25"\}\)\)/.test(web), true);
  eq('YES 뒤에는 프로필이 잠긴다',
    /const rename=n=>\{if\(loadWorld\(\)\)return;/.test(web)
    && /\(k,v\)=>\{if\(loadWorld\(\)\)return;setProfile/.test(web), true);
  /* ── 마지막 빈칸 ──
     얼굴을 고르는 게 아니라 이름을 쓴다. 이 제품은 처음부터 끝까지 빈칸을
     채우는 이야기고, 마지막 칸도 그래야 한다. 이 세계에 있는 두 사람만
     들어가고 그 밖의 글자는 에러다 — 창을 하나 더 띄우지 않고 칸에서 낸다. */
  eq('마지막도 빈칸이다',
    web.includes('Stay with <WhoBlank onPick={pickWho}/>?')
    && web.includes('선택은 NEVER EVER! <span className="kao">')
    && web.includes('(ᐡ⊃ෆ  ̫ ෆ ᐡ)⊃︵ 💕💕💕')
    && /<span className="blank whoblank" onClick=\{\(\)=>setOn\(true\)\}>□□<\/span>/.test(web), true);
  /* 얼굴 단추는 걷었다. 지도의 「같이 갈 사람은 Who?」와는 다른 화면이다 */
  eq('D-0에는 얼굴 단추가 없다', (() => {
    const i = web.indexOf('{whoAsk&&<Dialog');
    return /whobtn/.test(web.slice(i, web.indexOf('</Dialog>}', i)));
  })(), false);
  eq('두 사람만 들어간다', (() => {
    const W = new Function(web.slice(web.indexOf('const WHO_NAMES='),
      web.indexOf('function WhoBlank')) + 'return WHO_NAMES;')();
    return [['이재언', W['이재언']], ['재언', W['재언']], ['이민현', W['이민현']],
      ['민현', W['민현']], ['수연', W['수연']], ['이재', W['이재']], ['', W['']]];
  })(), [['이재언','jaeeon'],['재언','jaeeon'],['이민현','minhyun'],
    ['민현','minhyun'],['수연',undefined],['이재',undefined],['',undefined]]);
  eq('틀린 이름은 칸에서 튕긴다',
    /setBad\(true\); setTimeout\(\(\)=>setBad\(false\),620\)/.test(web)
    && /\.whoin\.bad\{/.test(web), true);
  /* null | jaeeon | minhyun 단일값. 처음 저장된 값이 이긴다 */
  eq('상대는 한 명, 한 번이다',
    /if\(id!=="jaeeon"&&id!=="minhyun"\)return null;/.test(web)
    && /if\(loadPartner\(\)\)return null;/.test(web)
    && /if\(loadPartner\(\)\)return;/.test(web), true);
  /* 이름과 얼굴이 한 줄이다 — 「이재언이 NULL 기다리고 있어! ꒰ྀི⸝⸝> . <⸝⸝꒱ྀི」.
     얼굴을 아래로 떨어뜨리면 다른 카피가 된다 */
  eq('기다리고 있어 카피가 정확하다',
    web.includes('이재언이 NULL 기다리고 있어!')
    && web.includes('이민현이 NULL 기다리고 있어!')
    && web.includes('꒰ྀི⸝⸝> . <⸝⸝꒱ྀི'), true);
  eq('이름과 얼굴이 한 줄이다', (() => {
    const i = web.indexOf('기다리고 있어!":"이민현이');
    const tail = web.slice(i, i + 220);
    return /\{' '\}<span className="kao">/.test(tail) && !/<\/div>[\s\S]{0,40}kao/.test(tail);
  })(), true);
  /* ── 앱도 같은 문을 쓴다 ──
     웹만 고치면 두 화면이 다른 세계가 된다. 카피도 잠금도 같은 것이어야 한다 */
  eq('앱도 확정 화면을 지난다',
    /function Confirm\(\{name,onYes,onBack\}/.test(appSrc)
    && appSrc.includes('너는 이 세계에')
    && appSrc.includes('존재하게 할 수 있을까?')
    && appSrc.includes('거절은 거절해'), true);
  eq('앱도 이름만으로는 못 들어간다',
    /if\(!loadWorld\(\)\) setEnrolling\('enroll'\)/.test(appSrc), true);
  eq('앱도 나이가 고정값 25다',
    /f\.k==='age'/.test(appSrc)
    && /saveProfile\('age','25'\)/.test(appSrc), true);
  eq('앱도 YES 뒤에는 잠긴다',
    /const doRename=\(t:string\)=>\{if\(loadWorld\(\)\)return;/.test(appSrc)
    && /if\(loadWorld\(\)&&k!=='age'\)return;/.test(appSrc), true);
  eq('앱도 YES 연타는 한 번이다', /if\(pressed\)return; setPressed\(true\); onYes\(\)/.test(appSrc), true);
  /* 연장은 한 번 — 추가 30일이 끝나면 WHO도 연장도 다시 안 묻는다 */
  eq('두 번째 D-0는 없다',
    /ddayAns!==String\(dSpan\)&&!loadExtend\(\)/.test(web), true);
  /* STAY는 아직 답이 아니다 — WHO까지 골라야 답이 찍힌다 */
  eq('STAY만으로는 답이 안 찍힌다', /if\(yes\)\{ setWhoAsk\(true\); return \}/.test(web), true);
}

/* 다시 시작하면 첫 만남부터다. greetAtRef는 리액트 ref라 저장소를 비워도
   안 없어진다 — 방금 선톡을 받고 지웠으면 1분 동안 아무도 말을 안 걸었다.
   처음 들어온 화면에서 조용한 게 제일 나쁜 그림이다. */
eq('다시 시작하면 선톡 간격도 같이 지운다',
  /location\.reload\(\)/.test(web) && /greetAtRef\.current=0/.test(appSrc), true);

/* ── 「두 사람」 방의 첫 장면 ──
   처음 열었는데 비어 있으면 이 방이 무슨 방인지 알 길이 없고, 저 둘이 삼촌과
   조카라는 것도 못 듣는다. 화면에 「삼촌과 조카」라고 적어주는 건 설명이지
   이야기가 아니라서, 둘이 떠드는 걸 한 번 보여준다. */
/* ── 첫날의 통보 ──
   화면 구석의 null 칸이 무슨 뜻인지 알려주는 데가 d-0.exe 하나뿐이었다.
   서른 날이 다 끝난 뒤에 규칙을 알려주는 셈이라, 첫날에 판돈만 먼저 알린다.
   방법은 안 알려준다 — 존재값도 「비밀」이라 몇 칸인지조차 안 보인다. */
/* 390px로 못박아두면 그보다 좁은 폰에서 창이 화면보다 넓어져 오른쪽이 잘린다 */
eq('창 폭에도 상한이 있다', /\.phone\{[^}]*max-width:100vw/.test(web), true);
/* 보건실은 재언의 자리다. 「우리 둘 다 같은 날 갔네」가 나갔다 —
   재언을 방문객으로 취급한 말이다 */
eq('보건실이 누구 자리인지 적어뒀다',
  /보건실은 이재언의 일상적인 근무 장소다/.test(workerSrc)
  && /누가 찾아왔고 무슨 일이 생겼는지가 사건이다/.test(workerSrc), true);

/* 등록 화면인데 정작 이름만 못 고쳤다. 오타를 내면 목록의 edit 메뉴까지
   가야 했는데, 그때는 이미 두 사람이 그 이름으로 부르기 시작한 뒤다. */
eq('등록 화면에서 이름을 고칠 수 있다',
  /onRename=\{rename\}/.test(web) && /onRename=\{doRename\}/.test(appSrc), true);
/* 이 화면만 진보라라 1.5초짜리 어두운 화면 하나가 다른 앱처럼 끼어 있었다 */
eq('등록 화면이 다른 화면과 같은 색이다',
  /#17123a|#1e1848|#2a2159|#443a7d/.test(web) || /#17123a|#1e1848|#2a2159|#443a7d/.test(appSrc), false);

eq('첫날 통보가 있다', /title="null\.exe"/.test(web), true);
eq('스무 시간 뒤에 뜬다', /const SYS1_AFTER = 20\*60\*60\*1000/.test(web), true);
eq('한 번만 뜬다', /saveSys1\(\); setSys1\(true\)/.test(web) && /null_sys1/.test(web), true);
/* 채우는 법을 알려주면 첫날에 답이 나가버린다. 이름·부르다가 나오면 안 된다 */
{
  const i = web.indexOf('{sys1&&<Dialog'), j = web.indexOf('{askDday&&', i);
  const box = web.slice(i, j);
  eq('방법을 안 알려준다', ['이름', '부르', '불리'].filter(t => box.includes(t)), []);
  eq('존재값이 비밀이다', /존재값<\/span>[\s\S]*?비밀/.test(box), true);
  eq('판돈은 알려준다', /다 못 채우면 사라져요/.test(box), true);
  /* 다른 창과 같은 껍데기여야 한다 — 따로 만든 카드를 쓰면 저 창만 떠 보인다 */
  eq('d-0.exe와 같은 껍데기다', /className="ddq"/.test(box) && /className="wbtn"/.test(box), true);
}
/* 떠나는 날에는 d-0.exe가 할 말이 따로 있다 */
eq('마지막 날에는 안 뜬다', /if\(dLeft<=0\)return;/.test(web), true);

eq('웹·앱 둘 다 첫 장면을 깐다',
  /const seedWatch=/.test(web) && /const seedWatch=async/.test(appSrc), true);
eq('비어 있을 때만 깐다',
  /if\(\(storeRef\.current\.msgs\.health\|\|\[\]\)\.length\)return;/.test(web), true);
{
  const E = new Function(readFileSync(join(ROOT, 'demo-lines.js'), 'utf8')
    + '\nreturn {demoWatchOpen}')();
  const open = E.demoWatchOpen('수연');
  eq('첫 장면이 여섯 마디다', open.length, 6);
  /* 관계가 드러나야 한다. 「삼촌」 한 마디가 설명 대신이다 */
  eq('조카가 삼촌이라고 부른다', /삼촌/.test(open.map(m => m.text).join(' ')), true);
  eq('두 사람이 주고받는다',
    [open[0].sender, open[1].sender], ['jaeeon', 'minhyun']);
  /* 첫 장면이 할 일은 둘의 관계를 보여주는 것 하나뿐이다. 여기서 유저 얘기가
     섞이면 그게 흐려진다 — 유저는 아직 이 방에 등장하지 않는다. */
  eq('첫 장면에 유저가 안 나온다',
    /선생님|\{name\}/.test(open.map(m => m.text).join(' ')), false);
  /* 삼촌은 조카한테 반말을 쓴다. 이것도 관계를 말한다 */
  eq('삼촌 쪽이 반말이다',
    open.filter(m => m.sender === 'jaeeon').every(m => !/요[.?!]?$/.test(m.text)), true);
}

/* ── 실제 플레이에서 나온 것들 ── */

/* 「삼촌이 답장을 1분 전에 했다는 게 이상한 거지」가 나갔다. 직접 인용하지
   말라고 적어둬도 소용없다 — 인용할 숫자가 눈앞에 있으면 쓴다. 숫자를 안 준다. */
eq('눈치 신호에 숫자를 안 준다', /마지막 활동 \$\{s\.minsAgo\}분 전/.test(workerSrc), false);
{
  const W = new Function(workerSrc.slice(workerSrc.indexOf('function agoWord'),
    workerSrc.indexOf('function buildSignals')) + '\nreturn {agoWord, countWord}')();
  eq('시간이 말로 뭉쳐진다',
    [W.agoWord(1), W.agoWord(30), W.agoWord(200), W.agoWord(5000)].map(t => /\d/.test(t)), [false, false, false, false]);
  eq('개수도 말로 뭉쳐진다', /\d/.test(W.countWord(12)), false);
}
/* 몇 시간째 조용한 방은 눈치챌 게 없다. 그게 매 턴 붙어 있으면 화제가 된다 */
eq('알아챌 수 없는 신호는 안 보낸다',
  buildVolatile('chat', 'jaeeon', 'R', { minhyun: { count: 3, minsAgo: 600 } }, [], null, null, null)
    .includes('눈치 신호'), false);
eq('지금 벌어지는 일은 보낸다',
  buildVolatile('chat', 'jaeeon', 'R', { minhyun: { count: 3, minsAgo: 5 } }, [], null, null, null, null, null, 2)
    .includes('눈치 신호'), true);
/* 「얼굴 보니까 방금 삼촌이랑 얘기하고 온 사람 얼굴이라」가 첫날에 나갔다.
   민현은 유저가 삼촌과 아는 사이인지도 모르는 데서 시작한다 — 눈치를
   채려면 먼저 알아야 하고, 아는 데는 하루가 걸린다. */
eq('첫날에는 다른 방 신호를 안 준다',
  buildVolatile('chat', 'minhyun', 'R', { jaeeon: { count: 3, minsAgo: 5 } }, [], null, { jaeeon: 6 }, null, null, null, 0)
    .includes('눈치 신호'), false);
eq('하루 지나면 준다',
  buildVolatile('chat', 'minhyun', 'R', { jaeeon: { count: 3, minsAgo: 5 } }, [], null, { jaeeon: 6 }, null, null, null, 1)
    .includes('눈치 신호'), true);
/* 하루 만에 몰아서 하는 사람도 있다. 그만큼 했으면 드러날 만큼 된 것이다 */
eq('첫날이어도 많이 했으면 준다',
  buildVolatile('chat', 'minhyun', 'R', { jaeeon: { count: 3, minsAgo: 5 } }, [], null, { jaeeon: 40 }, null, null, null, 0)
    .includes('눈치 신호'), true);
/* 단톡방은 셋이 다 보고 있다 — 추론이 아니라 목격이라 막을 이유가 없다 */
eq('단톡방은 첫날에도 보인다',
  buildVolatile('chat', 'minhyun', 'R', { group: { count: 3, minsAgo: 5 } }, [], null, null, null, null, null, 0)
    .includes('단톡방'), true);
eq('처음부터 삼각형을 다 아는 건 아니라고 적어뒀다',
  /이민현은 처음부터 이재언과 유저의 과거를 알지 못한다/.test(workerSrc)
  && /두 사람의 반응을 지켜본 뒤에야/.test(workerSrc), true);
/* 신호가 없으면 다른 방도 없다. 있어도 내용은 모른다 */
eq('신호로만 짐작한다고 적어뒀다',
  /다른 1:1 대화의 내용도 알 수 없다/.test(workerSrc)
  && /눈치 신호나 유저가 직접 말한 경우에만 짐작할 수 있다/.test(workerSrc), true);

/* ── 지문이 대사와 한 말풍선에 섞여 나오던 것 ──
   「(옥상 바람에 눈 찌푸리며) 그거 아까 대답도 웅이었잖아요」가 통째로 말풍선이 됐다.
   지문으로 안 그려지고 괄호가 말풍선 안에 남는다. 앞뒤 괄호를 제 줄로 뗀다. */
{
  const t = x => splitLines([{ sender: 'minhyun', text: x }]).map(m => m.text);
  eq('앞에 붙은 지문을 뗀다', t('(눈 찌푸리며) 그거 아까 대답도 웅이었잖아요.'),
    ['(눈 찌푸리며)', '그거 아까 대답도 웅이었잖아요.']);
  eq('뒤에 붙은 지문도 뗀다', t('아무튼 됐어요. (비니 챙 만지작거리며)'),
    ['아무튼 됐어요.', '(비니 챙 만지작거리며)']);
  eq('원래 지문만 있는 줄은 그대로', t('(라이터 다시 주머니에 집어넣는다)'),
    ['(라이터 다시 주머니에 집어넣는다)']);
  /* 말 가운데 낀 괄호는 지문이 아니라 말의 일부다 — 건드리면 문장이 깨진다 */
  eq('가운데 괄호는 안 건드린다', t('이거(진짜)는 그냥 말이에요.'), ['이거(진짜)는 그냥 말이에요.']);
}
/* 사진을 말풍선 안에 두니 모델이 객체를 문자열로 만들어 text에 처넣었다 —
   {"text":"이거요","photo":"..."}가 그대로 말풍선에 찍혔다. 밖으로 뺀다. */
eq('사진은 messages 밖에서 온다',
  /"photo": "사진키"\]?\}/.test(workerSrc) && /messages 안에는 문자열만 넣는다/.test(workerSrc), true);
{
  const got = parseMessages('{"messages":["지금요?","이거 보세요."],"photo":"minhyun-mirror"}', 'minhyun', ['minhyun']).messages;
  eq('마지막 말풍선에 사진이 붙는다',
    [got.length, got[0].photo, got[1].photo], [2, undefined, 'minhyun-mirror']);
}
/* ── 지문을 없앴다 ──
   두 번 고쳤는데 두 번 다 다른 어미로 굳었다(「~하는 참」→「~는 소리」).
   매 턴 붙었고, 궁해지면 「이건 그냥 텍스트니까요」로 4벽을 깼다.
   메신저에서 상대가 보는 건 글자뿐이라는 게 원래 사실이다.
   그다음 판에서는 괄호를 뺀 채로 같은 짓을 했다 —
   「민현은 그냥 눈을 감는다.」가 말풍선으로 나갔고, 유저가 「왜 자꾸
   해설해」라고 묻자 「안 해요」 하고 세 번 더 했다. 그래서 금지를
   괄호가 아니라 3인칭 줄 자체에 건다. */
eq('행동을 묘사하지 않는다 — 괄호 여부와 무관하게',
  /\*\*행동을 묘사하지 않는다\.\*\* 괄호를 씌우든 안 씌우든 같다/.test(workerSrc), true);
eq('3인칭으로 적은 줄은 대사가 아니라고 못박았다',
  /3인칭으로 적는 줄은 대사가 아니다/.test(workerSrc), true);
eq('지문을 쓰라는 옛 지시가 남아 있지 않다',
  /행동 묘사는 괄호로 쓸 수 있다/.test(workerSrc), false);
/* 「같이 편의점에 갔다」를 마주 앉은 장면으로 알아듣고 지문으로 때웠다.
   금지가 아니라 지금 무슨 일이 벌어지는지를 알려준다 */
eq('메신저라는 상황을 설명해뒀다',
  /현재 장소가 따로 열리지 않았고 인물들이 떨어져 있다면 실제 문자 대화다/.test(workerSrc)
  && /상대의 표정, 손짓, 주변 행동은 직접 볼 수 없다/.test(workerSrc), true);
/* 자리에 같이 있을 때는 반대다. 그 자리가 끝나기 전에 다음 장소로 혼자 옮기지 않는다 */
eq('자리에 있을 때는 현장이라고 설명해뒀다',
  /장면이 끝나거나 장소가 바뀌기 전까지 현재 위치를 유지한다/.test(workerSrc)
  && /다음 장소로 연속 이동하지 않는다/.test(workerSrc), true);
/* 「몰라!」에 「모른대요」, 「응」에 「응이래요」 — 대화가 아니라 메아리였다.
   이 규칙이 세계관 맨 앞에 있을 때는 답을 쓰기까지 15,000자가 남았다.
   그동안 이것만 계속 깨졌다 — 「눈 말고 뭐가 있어요」 두 번, 「조는 중」 세 턴,
   「반응 안 했는데 / 했는데」 네 턴. 문장은 그대로 두고 자리만 옮겼다. */
eq('유저 말을 되받아 옮기지 말라고 적어뒀다',
  /유저의 단어를 어미만 바꿔 반복하는 대신/.test(workerSrc), true);
/* 장면 줄(승인된 사유·화자 순차 사건)까지 실은 뒤가 TURN이다 — TURN은 여전히 맨 뒤 */
eq('그 말은 가변부 맨 뒤에 있다',
  /const TURN = `\n## 이 턴\n유저의 가장 최근 발화가 짧더라도/.test(workerSrc)
  && /disclose && disclose\.text \? `\\n## \[지금 장면\]\\n\$\{disclose\.text\}\\n` : ""\)\s*\n\s*\+ TURN;/.test(workerSrc), true);
/* 세계관에 두고 왔으면 두 군데에 같은 말이 남는다 */
eq('세계관에는 안 남겼다',
  (workerSrc.match(/유저의 단어를 어미만 바꿔 반복하는 대신/g) || []).length, 1);

/* ── 순서가 곧 무게다 ──
   설정(외형·과거·취향)은 잘 지키는데 대화 규칙(반복·정보 없는 턴)만 계속
   깨졌다. 규칙이 없어서가 아니라 세계관 한가운데(3,385자 자리)에 묻혀서다.
   역할 바로 다음에 대화 원칙과 쓰는 법이 오고, 세계·사연은 그 뒤로 물렸다. */
{
  const w = workerSrc.slice(workerSrc.indexOf('const WORLD = `'), workerSrc.indexOf('const JAEEON = `'));
  eq('대화 원칙이 세계 설정보다 앞이다',
    w.indexOf('대화 원칙') > 0 && w.indexOf('대화 원칙') < w.indexOf('\n세계\n'), true);
  eq('쓰는 법도 앞이다 — 반복 규칙이 제일 많이 깨졌다',
    w.indexOf('## 쓰는 법') > 0 && w.indexOf('## 쓰는 법') < w.indexOf('정보 비대칭'), true);
  /* 쓰는 법은 방마다 같은 글인데 방마다 다른 ③블록에 실려 방 수만큼 캐시에
     써졌다. 공통 블록(①세계)으로 올라갔으니 ③에는 없어야 한다 */
  eq('쓰는 법이 공통 블록에만 있다', (() => {
    const [world, , rules] = buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null).map(b => b.text);
    const k = '입에 붙는 말일수록 간격을 둔다';
    return world.includes(k) && !rules.includes(k);
  })(), true);
  eq('자모 축약은 안 쓴다',
    /• 자모 축약은 쓰지 않는다\./.test(workerSrc), true);
  /* ── 말꼬리와 우기기 ──
     재언은 꼰대로, 민현은 없던 일을 있었다고 말하는 쪽으로 기울었다. 둘 다
     같은 뿌리다 — 유저가 무슨 뜻으로 말했는지보다 자기 말이 맞는 쪽을 고른다.
     인물 블록이 아니라 공통 세계관에 둔다. 방마다 같은 글이라 여기 두면
     캐시에 한 번만 쓰이고, 두 사람에게 똑같이 걸린다.
     순해지라는 말이 아니라는 단서가 같이 있어야 한다 — 서늘함과 집착은
     유저가 공들여 세운 결이라, 이 규칙이 그걸 깎으면 고친 게 아니다. */
  eq('말꼬리와 우기기를 공통 세계관에서 막는다', (() => {
    const [world, , rules] = buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null).map(b => b.text);
    return ['말꼬리를 잡지 않는다', '우기지 않는다',
            '대화 기록에 없는 일을 있었다고 하지 않는다',
            '순해지라는 말이 아니다'].every(s => world.includes(s))
      && !rules.includes('말꼬리를 잡지 않는다');
  })(), true);
  eq('두 사람에게 똑같이 걸린다',
    ['jaeeon', 'minhyun', 'group'].every(r =>
      buildSystem('chat', r, 'R', null, [], null, null, null)[0].text.includes('우기지 않는다')), true);
  /* ── 메아리 ──
     말꼬리 규칙을 적어놨는데도 「흥」에 「흥이래요」가 돌아왔다. 규칙은 있었지만
     예시가 「괜찮다면서요」 하나뿐이라 정정하지 말라는 말로만 읽힌 것이다.
     되돌려주기는 따로 세우고, 실제로 나온 줄을 예시로 박는다 — 규칙보다…54267 tokens truncated… 둘만 안다',
    handedFacts('jaeeon', 'bandaid').map(f => [f.fact_id, f.known_by.join('·')]),
    [['gift.bandaid.jaeeon_to_user', 'user·jaeeon'],
     ['item.bandaid.with_user', 'user·jaeeon']]);
  eq('모르는 물건은 사실이 안 된다', giftFacts('jaeeon', '없는것', false), []);

  /* ── 12. 준 기록은 수신자를 지킨다 ── */
  eq('준 기록이 평면 배열로 안 뭉친다', (() => {
    const F = buildFacts({ jaeeon: ['mug'], minhyun: ['letter'] }, [], null, '');
    return [factsForSpeaker({ facts: F }, 'jaeeon').map(f => f.fact_id),
            factsForSpeaker({ facts: F }, 'minhyun').map(f => f.fact_id)];
  })(), [['gift.mug.user_to_jaeeon', 'item.mug.with_jaeeon', 'item.letter.with_minhyun'],
         ['item.mug.with_jaeeon', 'gift.letter.user_to_minhyun', 'item.letter.with_minhyun']]);
  eq('이번 턴 선물은 지난 기록에서 뺀다',
    /k !== now/.test(workerSrc) && /const now = giftNow && giftNow\.key/.test(workerSrc), true);
  /* C1의 약속 — buildGiven이라는 이름으로, buildBag 옆에 있다.
     방향이 갈리는 두 파생이 나란히 보여야 갈림이 눈에 띈다. */
  eq('buildGiven이 buildBag 옆에 있다', (() => {
    const i = workerSrc.indexOf('function buildGiven(');
    const j = workerSrc.indexOf('function buildBag(');
    return i > 0 && j > 0 && j - i < 900 && i < j;
  })(), true);
  eq('준 기록 조립은 buildGiven 하나다',
    /const givenHistory = buildGiven\(body\.gifts, gift, room\);/.test(workerSrc), true);
  eq('웹이 준 기록을 수신자별로 보낸다', /payload\.gifts=giftsRef\.current/.test(web), true);
  /* §8.5 — 관전 **사건** 호출은 request()를 안 타는 raw fetch다. 여기에
     gifts가 안 실리면 워커가 출처·보유 사실을 못 만들어 발견 장면이
     영영 안 선다. 실패 시 사건이 큐에 남는 계약(ackAutoEvent가 저장 뒤)은
     기존 검사들이 지킨다 — 여기는 재료가 실리는 것만 본다. */
  eq('관전 사건 호출도 준 기록을 싣는다', (() => {
    const i = web.indexOf('mode:"auto",room:"health",user_name:name,counts:roomCounts()');
    return i > 0 && web.slice(i, i + 900).includes('gifts:giftsRef.current');
  })(), true);
  /* 앱도 같이 보낸다. 한쪽만 보내면 같은 세이브가 기기마다 다른 사실을 본다 */
  eq('앱도 준 기록을 보낸다', (apiSrc.match(/gifts: await loadGifts\(\)/g) || []).length, 2);
  eq('앱도 평면으로 안 뭉친다', /\.flat\(\)[\s\S]{0,40}gifts|gifts[\s\S]{0,20}\.flat\(\)/.test(apiSrc), false);

  /* ── 13. hasItem을 넷으로 갈랐다 ──
     한 값이 정반대 두 뜻으로 돌았다 — 코드는 「이미 가짐」, 꾸러미에는
     「건넬 수 있다」. 같은 값을 반대 뜻으로 재사용하지 않는다. */
  /* 남은 hasItem은 「전에는 이랬다」를 적은 주석 둘뿐이다. 코드에는 없다 */
  eq('hasItem이 코드에 안 남았다', (() => {
    return workerSrc.split('\n')
      .filter(l => /\bhasItem\b/.test(l) && !/^\s*(\/\*|\*|\/\/|\s{3})/.test(l)).length;
  })(), 0);
  eq('넷이 다 있다',
    ['placeItemOwned', 'placeItemAvailable', 'giftNow', 'givenHistory']
      .filter(k => !workerSrc.includes(k)), []);
  eq('건넬 수 있다는 가진 것의 반대다',
    /const placeItemAvailable = !!place && !!PLACE_ITEMS\[place\] && !placeItemOwned && talkedEnough;/.test(workerSrc), true);
  eq('꾸러미에 뜻이 뒤집혀 들어가지 않는다',
    /if \(placeItemAvailable\) here\.push\("이 자리에 건넬 수 있는 물건이 있다"\)/.test(workerSrc), true);

  /* ── 14. 구조화 Fact는 마지막 경계까지 산다 ──
     다음 단계(D)가 사실을 검사한다. Canon Critic이 fact_id를 돌려주면
     코드가 그 id가 이 턴에 실제로 있는지 봐야 한다. 중간에 문자열로
     납작해지면 id가 사라지고, 문자열을 도로 파싱하거나 없는 id를
     통과시키게 된다. Fact[]가 모델 호출 직전까지 살아 있어야 한다. */
  eq('꾸러미가 받는 것은 Fact[]다',
    /facts: stageFacts, here,/.test(workerSrc)
    && /: factsForSpeaker\(turnCtx, fallbackSender\);/.test(workerSrc), true);
  /* 사실이 아닌 것(자리·건넬 물건)은 facts에 안 섞는다 — fact_id가 없으므로
     검사가 판정할 수 없고, 섞이면 허용 id 집합이 오염된다 */
  eq('턴 조건은 사실과 따로 담는다',
    /const here = \[\];/.test(workerSrc) && !/turnFacts/.test(workerSrc), true);
  /* 문장은 프롬프트 직전에만 만든다. 그 결과를 facts라고 부르지 않는다 */
  eq('렌더 결과를 facts라고 안 부른다', (() => {
    const bad = workerSrc.split('\n').filter(l =>
      /(facts|Facts)\s*[:=]\s*(factLines|renderFacts)\(/.test(l));
    return bad;
  })(), []);
  eq('sceneHead가 마지막에 문장을 만든다', (() => {
    const f = workerSrc.slice(workerSrc.indexOf('function sceneHead('),
                              workerSrc.indexOf('function criticPacket('));
    return /const lines = \[\.\.\.factLines\(ctx\.facts, ctx\.userName\)/.test(f);
  })(), true);
  /* 허용 id 집합은 Fact[]에서 직접 만든다 — 문장을 다시 파싱하지 않는다 */
  eq('허용 id를 구조에서 뽑는다', (() => {
    const F = buildFacts({ jaeeon: ['mug'] }, [], null, 'jaeeon');
    return [...ENG.factIds(F)];
  })(), ['gift.mug.user_to_jaeeon', 'item.mug.with_jaeeon']);
  eq('허용 id는 문장을 안 본다', (() => {
    const f = workerSrc.slice(workerSrc.indexOf('function factIds('),
                              workerSrc.indexOf('function renderFacts('));
    return /factLines|match\(|split\(/.test(f);
  })(), false);
  /* ── fact_id가 각 단계 투영에서 그대로 살아남는다 ── */
  eq('투영이 fact_id를 안 건드린다', (() => {
    const F = buildFacts({ jaeeon: ['mug'], minhyun: ['letter'] }, [], null, '');
    const ctx = { facts: F };
    const all = new Set(F.map(f => f.fact_id));
    const projected = [
      ...factsForSpeaker(ctx, 'jaeeon'), ...factsForSpeaker(ctx, 'minhyun'),
      ...factsForSpeaker(ctx, 'user'), ...sharedFactsForRoom(ctx, ['jaeeon', 'minhyun']),
    ];
    /* 투영은 고르기만 한다. 새 id를 만들거나 이름을 바꾸지 않는다 */
    return projected.filter(f => !all.has(f.fact_id) || typeof f.known_by !== 'object');
  })(), []);

  /* ── 15. 원본 상태와 파생 사실이 어긋나지 않는다 ──
     owned·givenHistory가 저장된 원본이고 facts는 거기서 요청마다 파생한
     읽기 전용 결과다. 둘이 반대되는 값을 가지면 어느 쪽을 믿을지가 없다. */
  /* ── 물건의 정체성은 (수신자, 종류)다 ──
     처음에 종류 key만으로 「같은 물건이 두 곳에 있다」를 판정했다. 틀렸다.
     gift.key는 **상품 종류**지 세상에 하나뿐인 물건의 id가 아니다 —
     같은 머그컵을 재언에게 하나, 민현에게 하나 줄 수 있다. 코드도 그렇게
     막는다(app.js: `have.includes(gift.key)` — 수신자별로만).
     별도 instance_id가 없으므로 (수신자, 종류)를 하나의 물건으로 본다. */
  const checkFacts = (given, bag, F) => {
    const bad = [];
    const ids = F.map(f => f.fact_id);
    /* 같은 수령 사건이 두 번 기록되지 않는다 */
    ids.forEach((id, i) => { if (ids.indexOf(id) !== i) bad.push(`중복 기록 ${id}`); });
    /* 준 것은 전부 그 사람의 수령 사건과 보유 사실을 갖는다 */
    for (const [who, keys] of Object.entries(given))
      for (const k of keys) {
        if (!ids.includes(`item.${k}.with_${who}`)) bad.push(`보유 없음 ${k}/${who}`);
        if (!ids.includes(`gift.${k}.user_to_${who}`)) bad.push(`출처 없음 ${k}/${who}`);
      }
    /* 유저 가방에 있는 것은 유저 보유 사실을 갖는다 */
    for (const b of bag)
      if (!ids.includes(`item.${b.key}.with_user`)) bad.push(`가방 없음 ${b.key}`);
    /* 한 물건 정체성이 두 보유자를 갖지 않는다. 정체성이 (수신자, 종류)이므로
       비교 열쇠도 그 둘이다 — 종류만 보면 같은 컵 두 개가 충돌로 잡힌다. */
    const holder = {};
    for (const id of ids) {
      const m = id.match(/^item\.([^.]+)\.with_(.+)$/);
      if (!m) continue;
      const identity = `${m[2]}/${m[1]}`;              // 수신자 + 종류
      if (holder[identity] && holder[identity] !== m[2])
        bad.push(`두 곳에 있다 ${identity}`);
      holder[identity] = m[2];
    }
    /* 보유 사실이 있는데 원본에 근거가 없으면 그것도 모순이다 */
    for (const id of ids) {
      const m = id.match(/^item\.([^.]+)\.with_(.+)$/);
      if (!m || m[2] === 'user') continue;
      if (!(given[m[2]] || []).includes(m[1])) bad.push(`원본에 없는 보유 ${id}`);
    }
    return bad;
  };

  eq('파생 사실이 원본과 안 어긋난다', (() => {
    const given = { jaeeon: ['mug', 'coffee'], minhyun: ['letter'] };
    const bag = [{ key: 'bandaid', from: 'jaeeon' }];
    return checkFacts(given, bag, buildFacts(given, bag, null, ''));
  })(), []);

  /* ── 같은 종류를 둘에게 각각 하나씩 — 정상이다 ── */
  {
    const given = { jaeeon: ['mug'], minhyun: ['mug'] };
    const F = buildFacts(given, [], null, '');
    eq('같은 종류를 둘에게 줘도 통과한다', checkFacts(given, [], F), []);
    eq('두 수령 사건은 서로 다른 사건이다', F.map(f => f.fact_id),
      ['gift.mug.user_to_jaeeon', 'item.mug.with_jaeeon',
       'gift.mug.user_to_minhyun', 'item.mug.with_minhyun']);
    eq('각자 제 것을 보유한다', [
      factsForSpeaker({ facts: F }, 'jaeeon').some(f => f.fact_id === 'item.mug.with_jaeeon'),
      factsForSpeaker({ facts: F }, 'minhyun').some(f => f.fact_id === 'item.mug.with_minhyun'),
    ], [true, true]);
    /* 한쪽 출처가 다른 쪽으로 자동 전파되지 않는다 — 여기가 핵심이다 */
    eq('출처는 서로에게 안 샌다', [
      factsForSpeaker({ facts: F }, 'jaeeon').map(f => f.fact_id),
      factsForSpeaker({ facts: F }, 'minhyun').map(f => f.fact_id),
    ], [
      ['gift.mug.user_to_jaeeon', 'item.mug.with_jaeeon', 'item.mug.with_minhyun'],
      ['item.mug.with_jaeeon', 'gift.mug.user_to_minhyun', 'item.mug.with_minhyun'],
    ]);
    /* 종류가 같으니 문장도 같은 실물처럼 읽히면 안 된다.
       「회색 머그컵은 …에게 있다」를 나란히 두면 컵 하나가 두 곳에 있는 말이 된다. */
    eq('각자 하나씩 가진 것으로 읽힌다',
      ENG.factLines(factsForSpeaker({ facts: F }, 'jaeeon'), '선생님'),
      ['선생님이 이재언에게 회색 머그컵을 줬다.',
       '이재언에게 회색 머그컵이 있다.', '이민현에게 회색 머그컵이 있다.']);
  }

  /* ── 이건 반드시 걸려야 한다 ── */
  eq('같은 수령 사건 중복은 걸린다', (() => {
    const given = { jaeeon: ['mug'] };
    const F = buildFacts(given, [], null, '');
    return checkFacts(given, [], [...F, F[0]]).filter(x => x.startsWith('중복 기록'));
  })(), ['중복 기록 gift.mug.user_to_jaeeon']);
  eq('원본에 없는 보유는 걸린다', (() => {
    const given = { jaeeon: ['mug'] };
    const F = buildFacts({ jaeeon: ['mug'], minhyun: ['letter'] }, [], null, '');
    return checkFacts(given, [], F).filter(x => x.startsWith('원본에 없는 보유'));
  })(), ['원본에 없는 보유 item.letter.with_minhyun']);
  eq('원본에 있는데 사실이 없으면 걸린다',
    checkFacts({ jaeeon: ['mug'] }, [], []), ['보유 없음 mug/jaeeon', '출처 없음 mug/jaeeon']);
  eq('가방 물건이 빠지면 걸린다',
    checkFacts({}, [{ key: 'bandaid', from: 'jaeeon' }], []), ['가방 없음 bandaid']);

  /* ── 자리 물건과 선물 상품은 다른 namespace다 ──
     겹치면 (수신자, 종류) 정체성이 두 뜻을 갖게 된다. 지금은 안 겹친다. */
  eq('두 namespace가 안 겹친다', (() => {
    const place = [...workerSrc.matchAll(/key: "(\w+)",\s+name:/g)].map(m => m[1]);
    const gsrc = workerSrc.slice(workerSrc.indexOf('const GIFT_NAME_BY_KEY = {'),
                                 workerSrc.indexOf('};', workerSrc.indexOf('const GIFT_NAME_BY_KEY')));
    const gifts = [...gsrc.matchAll(/(\w+):"/g)].map(m => m[1]);
    return place.filter(k => gifts.includes(k));
  })(), []);
  /* 파생 결과를 상태처럼 고쳐 쓰지 않는다 — 어디서도 facts에 push하지 않는다 */
  eq('파생 사실을 상태처럼 안 고친다',
    /\.facts\.push\(|turnCtx\.facts\s*=|ctx\.facts\.push\(/.test(workerSrc), false);

  /* ── 16. 관전방에서 사라진 보유 정보가 교집합으로 온다 ──
     buildBag("health")가 비는 것은 맞다 — 전에는 room이 minhyun으로 떨어져
     「네가 준 것」이 두 사람 방에 실렸다. 그 정보가 이제 사실로 오는지 본다. */
  eq('관전 교집합은 보유만 준다', (() => {
    const F = buildFacts({ jaeeon: ['mug'] }, [], null, '');
    return sharedFactsForRoom({ facts: F }, ['jaeeon', 'minhyun']).map(f => f.fact_id);
  })(), ['item.mug.with_jaeeon']);
  eq('관전 교집합에 출처는 없다', (() => {
    const F = buildFacts({ jaeeon: ['mug'] }, [], null, '');
    return sharedFactsForRoom({ facts: F }, ['jaeeon', 'minhyun'])
      .some(f => f.fact_id.startsWith('gift.'));
  })(), false);
  eq('관전방 가방은 비어 있다', ENG.buildVolatile('auto', 'health', '선생님', null, [], null, null,
    null, null, [], 1, null, false, '저녁', '월요일', null, false, [],
    [{ key: 'bandaid', from: 'minhyun' }], '겨울', '', '', { facts: [] })
    .includes('네가 선생님에게 준 것'), false);

  /* ── 17. 지문이 앱에서도 끝까지 사건으로 간다 ──
     타입 선언만 보면 안 된다. api.ts의 **진짜 buildHistory를 굴려서** 나온
     것을 그대로 워커에 먹인다. 중간에서 user 문자열로 퇴화하면 여기서 걸린다. */
  await (async () => {
    const src = apiSrc.slice(apiSrc.indexOf('export function buildHistory('),
                             apiSrc.indexOf('\n}', apiSrc.indexOf('export function buildHistory(')) + 2);
    /* TS 구문이 셋뿐이라 벗겨서 그대로 돌린다. 못 벗기면 조용히 넘어가지
       않고 여기서 터진다 — 그게 신호다. */
    const js = src
      .replace('export function buildHistory(msgs: Msg[])', 'function buildHistory(msgs)')
      .replace(/ as const/g, '')
      .replace(/const out: typeof all = \[\];/, 'const out = [];');
    eq('앱 buildHistory에서 타입을 다 벗겼다', /:\s*(Msg|typeof|number|string)\b|as const/.test(js), false);
    const run = new Function('HISTORY_CHARS', js + '; return buildHistory;')(60000);
    /* 실제 선물 흐름 그대로다 — 지문을 넣고 바로 요청을 보내므로 끝이 지문이다 */
    const out = run([
      { sender: 'jaeeon', text: '왔어요.' },
      { sender: 'user', text: '(웃음)' },
      { sender: 'sys', text: '이재언이 회색 머그컵을 받았다' },
    ]);
    eq('앱이 사건에 타입을 붙인다', out.map(m => m.kind || ''), ['', '', 'event']);
    eq('앱이 사건을 괄호로 감싸지 않는다', out[2].content, '이재언이 회색 머그컵을 받았다');
    eq('앱에서 유저가 친 괄호는 그대로다', [out[1].content, out[1].kind], ['(웃음)', undefined]);
    /* 그 결과를 그대로 워커에 먹인다 */
    await runTurn({ mode: 'chat', room: 'jaeeon', user_name: '선생님', history: out });
    const saw = writerSaw();
    eq('앱 사건이 워커까지 사건으로 간다',
      saw.includes('[시스템 사건] 이재언이 회색 머그컵을 받았다'), true);
    eq('앱 유저 괄호는 사건이 안 된다', saw.includes('[시스템 사건] (웃음)'), false);
  })();
  /* 앱 저장 쪽도 갈라져 있어야 한다 — 코드가 만든 사건만 sys다 */
  eq('앱은 유저 입력을 sys로 안 넣는다',
    /insertMsg\(\{room,sender:'user',text,created_at/.test(appSrc)
    && /insertMsg\(\{room:char,sender:'sys',text:line/.test(appSrc), true);

  /* ── 18. 없는 것은 모르는 것이지 아닌 것이 아니다 ── */
  eq('없는 것은 아직 모르는 것이라고 적는다',
    renderFacts(giftFacts('jaeeon', 'mug', false), '선생님').includes('없다고 단정하지 않는다'), true);
  eq('목록을 읊지 말라고 적는다',
    renderFacts(giftFacts('jaeeon', 'mug', false), '선생님').includes('읊지 않는다'), true);
  eq('사실이 없으면 블록도 없다', renderFacts([], '선생님'), '');

  /* ══════ E-B — 감지·장면·전환을 요청 진입부터 끝까지 굴린다 ══════
     중요 장면은 쓰는 쪽 → 검사 둘 → 마무리를 탄다. 가짜가 단계마다 제
     역할로 답해야 502가 안 난다. */
  let sceneIp = 0;   // 요청마다 다른 IP — 레이트리밋 통을 나눠 쓴다
  const runScene = async (body, say) => {
    sent = [];
    globalThis.fetch = async (url, init) => {
      const c = JSON.parse(init.body);
      sent.push(c);
      const oai = String(url).includes('api.openai.com');
      const sys = oai
        ? (c.messages || []).filter(m => m.role === 'system').map(m => m.content).join('')
        : (Array.isArray(c.system) ? c.system : [{ text: c.system }]).map(b => b.text || '').join('');
      const rep = t => (oai ? fakeReplyOai(t, c.model) : fakeReply(t));
      if (sys.includes('대사를 쓰지 않는다 — 고르기만 한다'))
        return rep(JSON.stringify({ decision: 'ACCEPT', reject_codes: {} }));
      if (sys.includes('너는 이 세계의 사실만 본다') || sys.includes('이 사람이 이 사람다운지만 본다'))
        return rep(JSON.stringify({ problems: [] }));
      /* 마무리(FINALIZER_RULES가 system 배열 끝에 붙는다)와 쓰는 쪽 */
      return rep(JSON.stringify({ messages: [{ text: say || '네.' }] }));
    };
    try {
      const res = await worker.fetch(
        new Request('https://x/?k=열쇠', { method: 'POST', body: JSON.stringify(body),
          headers: { 'CF-Connecting-IP': '7.7.7.' + (++sceneIp) } }),
        /* 이 하네스는 **고르는 쪽의 투영**도 잰다 — 기본 경로(solo)에는
           그 단계가 없으므로 옛 경로를 명시한다. 재는 것은 투영 규칙이고,
           그 규칙은 두 경로가 같은 원본(stageFacts)을 쓴다. */
        { ANTHROPIC_API_KEY: 'sk-테스트', OPENAI_API_KEY: 'sk-가짜', ACCESS_KEY: '열쇠',
          ENGINE_MODE: 'hybrid', CANDIDATE_MODE: 'one' });
      return { status: res.status, data: await res.json() };
    } finally { globalThis.fetch = realFetch; }
  };
  const stagesOf = r => (r.data.stages || []).map(s => s.stage);

  /* ── 예약 없이 말에서 올라간다 (E4) ── */
  await (async () => {
    const r = await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      history: [{ role: 'user', content: '선생님 혹시 저 어디서 본 적 있지 않아요?' }] }, '…기억해요.');
    eq('감지가 중요 경로를 연다', r.status, 200);
    eq('검사 둘과 마무리가 실제로 돈다',
      ['canon', 'character', 'finalizer'].filter(s => !stagesOf(r).includes(s)), []);
    /* 예약이 아니므로 지울 것도 없다 */
    eq('감지로 올라간 장면에는 scene_ack가 없다', r.data.scene_ack, undefined);
    /* 승인된 사유가 쓰는 쪽 프롬프트에 실린다 (E6) */
    eq('쓰는 쪽이 지금 장면을 안다',
      writerSaw().includes('[지금 장면]') && writerSaw().includes('핵심 기억이 처음 공개된다'), true);
    /* 검증된 응답 뒤 전환이 나간다 (E3) */
    eq('기억이 hidden→opened로 움직인다',
      (r.data.effects || []).map(e => [e.key, e.from, e.to]),
      [['jaeeonMemory', 'hidden', 'opened']]);
  })();

  /* ── 캐묻기 다음의 선물 턴이 다시 오르지 않는다 ──
     적대 검증이 재현한 자리: 이력 끝이 지문(kind:event)인 후속 요청이
     지난 턴의 캐묻기로 또 중요 장면에 올라가고, 「인정」이라는 두 번째
     박자가 머그컵 건네는 턴에 소모됐다. */
  await (async () => {
    const r = await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      story: { jaeeonMemory: 'opened' }, gift: { name: '회색 머그컵', key: 'mug' },
      history: [
        { role: 'user', content: '선생님 혹시 저 어디서 본 적 있지 않아요?' },
        { role: 'assistant', content: '…기억해요.' },
        { role: 'user', kind: 'event', content: '이재언이 회색 머그컵을 받았다' },
      ] }, '이런 걸 왜 사요.');
    eq('선물 턴은 일반 경로다 — 지난 턴 캐묻기를 다시 안 읽는다',
      [r.status, stagesOf(r).includes('finalizer')], [200, false]);
    eq('기억도 안 움직인다 — 인정은 머그컵 턴에 소모되지 않는다',
      (r.data.effects || []).filter(e => e.type === 'story_transition'), []);
  })();
  /* 경험담은 잡담이다 — 잡담 두 턴에 20년 기억이 소모되면 안 된다 */
  await (async () => {
    const r = await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      history: [{ role: 'user', content: '나 스키 타본 적 있어' }] }, '스키 좋죠.');
    eq('경험담은 일반 경로다', [stagesOf(r).includes('finalizer'), r.data.effects || []],
      [false, []]);
  })();

  /* ── 드러낸 뒤에는 상태가 사실로 실리고, 다음 성공이 인정이다 ── */
  await (async () => {
    const r = await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      story: { jaeeonMemory: 'opened' },
      history: [{ role: 'user', content: '공부방 얘기 더 해주세요' }] }, '그 아이가 너였다.');
    eq('드러낸 기억이 사실로 실린다', writerSaw().includes('이제 와서 모른다고 할 수 없다'), true);
    eq('두 번째 성공이 인정이다',
      (r.data.effects || []).map(e => e.to), ['acknowledged']);
  })();

  /* ── 민현의 첫 만남 — 설명했는지는 답을 보고 정한다 ── */
  await (async () => {
    const asked = { mode: 'chat', room: 'minhyun', user_name: '선생님',
      history: [{ role: 'user', content: '우리 어디서 만났지?' }] };
    const a = await runScene(asked, '병원 옥상에서 만났잖아요.');
    eq('물었고 설명했으면 explained까지 간다',
      (a.data.effects || []).map(e => [e.from, e.to]), [['unseen', 'explained']]);
    const b = await runScene(asked, '그럼 그냥 모르는 사람이네요.');
    eq('도망가면 질문이 서 있는다 — pending',
      (b.data.effects || []).map(e => e.to), ['pending']);
    /* 서 있는 질문은 다음 턴 프롬프트에 실린다 — 이게 원래 잡으려던 버그다 */
    const c = await runScene({ ...asked, story: { firstContact: 'pending' },
      history: [{ role: 'user', content: '배고파' }] }, '저도요.');
    eq('서 있는 질문이 사실로 실린다', writerSaw().includes('아직 설명하지 않았다'), true);
    eq('딴 얘기 중에는 안 움직인다', c.data.effects || [], []);
  })();

  /* ── 정식 첫 연락이 상태기에 걸린다 — 문구집의 실제 흐름 그대로 ── */
  await (async () => {
    const opener = [
      { role: 'assistant', sender: 'minhyun', content: '선생님.' },
      { role: 'assistant', sender: 'minhyun', content: '저 알죠?' },
      { role: 'assistant', sender: 'minhyun', content: '선생님이 저 책임진다면서요.' },
    ];
    const asked = reply => ({ mode: 'chat', room: 'minhyun', user_name: '선생님',
      history: [...opener, { role: 'user', content: reply }] });
    /* 문구집 4028의 정식 설명으로 답하면 explained까지 간다 */
    const a = await runScene(asked('무슨 책임이요?'),
      '우리 저번에 병원 옥상에서 만났는데. 제가 학생이 담배 피우는데 왜 뭐라고 안 하냐니까.');
    eq('정식 답 뒤에 설명하면 unseen→explained',
      (a.data.effects || []).map(e => [e.key, e.from, e.to]),
      [['firstContact', 'unseen', 'explained']]);
    /* 회피하면 질문이 서 있는다 */
    const b = await runScene(asked('누구세요?'), '그럼 그냥 모르는 사람이네요.');
    eq('정식 답에 회피하면 unseen→pending',
      (b.data.effects || []).map(e => e.to), ['pending']);
    /* 같은 「네?」가 평범한 대화 뒤에서는 아무것도 안 세운다 */
    const c = await runScene({ mode: 'chat', room: 'minhyun', user_name: '선생님',
      history: [{ role: 'assistant', sender: 'minhyun', content: '내일 시험이에요.' },
                { role: 'user', content: '네?' }] }, '수학요.');
    eq('평범한 대화 뒤의 「네?」는 안 세운다', c.data.effects || [], []);
  })();

  /* ── 선택의 정체가 프롬프트에 실린다 — 두 방향 다 ── */
  await (async () => {
    /* 정해지는 턴(본인 방) — 아직 partnerKnown이 안 뒤집힌 상태에서도 안다 */
    const a = await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      partner: 'jaeeon', scene_reason: 'partner_confirm',
      history: [{ role: 'user', content: '당신이에요.' }] }, '…그래.');
    eq('정해지는 턴에 누구인지가 실린다',
      [a.data.scene_ack, writerSaw().includes('유저가 이재언을 상대로 정했다')],
      ['partner_confirm', true]);
    /* 본인 방이 아니면 그 사유는 안 열린다 */
    const w = await runScene({ mode: 'chat', room: 'minhyun', user_name: '선생님',
      partner: 'jaeeon', scene_reason: 'partner_confirm',
      history: [{ role: 'user', content: '있잖아' }] }, '네.');
    eq('남의 방에서는 정해지는 장면이 안 열린다',
      [w.data.scene_ack, stagesOf(w).includes('finalizer')], [undefined, false]);
    /* 처음 아는 턴(다른 쪽 방) — 누구인지까지 */
    const b = await runScene({ mode: 'chat', room: 'minhyun', user_name: '선생님',
      partner: 'jaeeon', scene_reason: 'partner_known',
      history: [{ role: 'user', content: '있잖아' }] }, '…알아요.');
    eq('처음 아는 턴에 누가 선택됐는지가 실린다',
      [b.data.scene_ack, writerSaw().includes('이재언을 상대로 정했다')],
      ['partner_known', true]);
    /* ack 뒤 — 지속 사실이 같은 정체를 유지한다. 반대 방향으로 확인 */
    await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      partner: 'minhyun', story: { partnerKnown: { jaeeon: true, minhyun: false } },
      history: [{ role: 'user', content: '안녕' }] }, '네.');
    eq('ack 뒤에도 누구인지가 남는다 — 반대 방향',
      writerSaw().includes('이재언은 유저가 이민현을 상대로 정했다는 것을 안다'), true);
    /* 한쪽만 알 때 다른 쪽 방에는 안 샌다 */
    await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      partner: 'jaeeon', story: { partnerKnown: { jaeeon: false, minhyun: true } },
      history: [{ role: 'user', content: '안녕' }] }, '네.');
    eq('한쪽만 알 때 다른 방에 안 샌다', writerSaw().includes('상대로 정했다'), false);
    /* 둘 다 알면 단톡이 공유 사실로 받는다 */
    await runScene({ mode: 'chat', room: 'group', user_name: '선생님',
      partner: 'jaeeon', story: { partnerKnown: { jaeeon: true, minhyun: true } },
      history: [{ role: 'user', content: '안녕' }] }, '[이재언] 네.');
    eq('둘 다 알면 단톡에 공유 사실로 실린다',
      writerSaw().includes('두 사람 다 그 사실을 안다'), true);
    /* 한쪽만 알면 단톡에도 없다 */
    await runScene({ mode: 'chat', room: 'group', user_name: '선생님',
      partner: 'jaeeon', story: { partnerKnown: { jaeeon: true, minhyun: false } },
      history: [{ role: 'user', content: '안녕' }] }, '[이재언] 네.');
    eq('한쪽만 알면 단톡에도 없다', writerSaw().includes('상대로 정했다'), false);
  })();

  const wk2 = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  /* ── 단톡 지식 분리 — 쓰는 쪽과 고르는 쪽이 같은 교집합을 본다 ── */
  await (async () => {
    const directorSaw = () => {
      const c = sent.find(x => (Array.isArray(x.system) ? x.system : [{ text: x.system }])
        .map(b => b.text || '').join('').includes('대사를 쓰지 않는다 — 고르기만 한다'));
      return c ? (c.messages || []).map(m => Array.isArray(m.content)
        ? m.content.map(b => b.text || '').join('\n') : m.content).join('\n') : '';
    };
    const run = pk => runScene({ mode: 'chat', room: 'group', user_name: '선생님',
      partner: 'jaeeon', story: { partnerKnown: pk },
      history: [{ role: 'user', content: '안녕' }] }, '[이재언] 네.');
    await run({ jaeeon: false, minhyun: true });
    eq('민현만 알 때 — 쓰는 쪽도 고르는 쪽도 못 본다',
      [writerSaw().includes('상대로 정했다'), directorSaw().includes('상대로 정했다')],
      [false, false]);
    await run({ jaeeon: true, minhyun: false });
    eq('재언만 알 때도 대칭이다',
      [writerSaw().includes('상대로 정했다'), directorSaw().includes('상대로 정했다')],
      [false, false]);
    await run({ jaeeon: true, minhyun: true });
    eq('둘 다 알면 두 단계가 같은 공유 사실을 본다',
      [writerSaw().includes('두 사람 다 그 사실을 안다'),
       directorSaw().includes('두 사람 다 그 사실을 안다')], [true, true]);
    /* 검사·마무리도 같은 원본(stageFacts)을 받는다 — 소스가 그 하나를 넘긴다 */
    eq('검사·마무리도 같은 투영을 받는다',
      /facts: stageFacts, here,/.test(wk2)
      && (wk2.match(/factsForSpeaker\(turnCtx, fallbackSender\)/g) || []).length === 1, true);
  })();

  /* ── 처음 아는 자리의 방별 라우팅 — 두 방향 전부 ── */
  await (async () => {
    const ask = (room, partner, extra) => runScene({ mode: room === 'health' ? 'auto' : 'chat',
      room, user_name: '선생님', partner, scene_reason: 'partner_known',
      history: [{ role: 'user', content: '있잖아' }], ...(extra || {}) },
      room === 'health' ? '[이재언] 네.' : room === 'group' ? '[이민현] 네.' : '네.');
    const shape = r => [r.data.scene_ack, stagesOf(r).includes('finalizer')];
    for (const [partner, other] of [['jaeeon', 'minhyun'], ['minhyun', 'jaeeon']]) {
      eq(`다른 쪽 1:1만 오른다 — partner:${partner}`,
        shape(await ask(other, partner)), ['partner_known', true]);
      eq(`본인 방은 안 오른다 — partner:${partner}`,
        shape(await ask(partner, partner)), [undefined, false]);
      eq(`이미 알면 안 오른다 — partner:${partner}`,
        shape(await ask(other, partner,
          { story: { partnerKnown: { [other]: true } } })), [undefined, false]);
    }
    eq('단톡은 안 오른다', shape(await ask('group', 'jaeeon')), [undefined, false]);
    eq('관전은 안 오른다', shape(await ask('health', 'jaeeon')), [undefined, false]);
    /* 모르는 방 이름은 대화는 민현 방으로 살리되, 장면은 그 위에서 안 태운다 */
    const odd = await runScene({ mode: 'chat', room: 'health', user_name: '선생님',
      partner: 'jaeeon', scene_reason: 'partner_known',
      history: [{ role: 'user', content: '있잖아' }] }, '네.');
    eq('chat의 health(모르는 방)도 장면을 안 태운다',
      [odd.status, odd.data.scene_ack, stagesOf(odd).includes('finalizer')],
      [200, undefined, false]);
    /* 잘못된 partner 값은 없는 것으로 눌린다 — 장면도 정체 사실도 없다 */
    const bad = await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      partner: '몰라', scene_reason: 'partner_confirm',
      history: [{ role: 'user', content: '당신이에요.' }] }, '네.');
    eq('잘못된 partner는 null로 눌린다',
      [bad.data.scene_ack, writerSaw().includes('상대로 정했다')], [undefined, false]);
  })();

  /* ── 예약된 WHO 장면 — 승인과 ack, 그리고 이미 아는 사람 ── */
  await (async () => {
    const base = { mode: 'chat', room: 'minhyun', user_name: '선생님', partner: 'jaeeon',
      scene_reason: 'partner_known', history: [{ role: 'user', content: '있잖아' }] };
    const a = await runScene(base, '…알아요.');
    eq('예약이 승인되면 그 사유가 ack로 돌아온다', a.data.scene_ack, 'partner_known');
    const b = await runScene({ ...base,
      story: { partnerKnown: { jaeeon: false, minhyun: true } } }, '네.');
    eq('이미 아는 사람에게는 그 장면이 다시 없다',
      [b.data.scene_ack, stagesOf(b).includes('finalizer')], [undefined, false]);
  })();

  /* ── 선톡·관전은 감지가 없다 ── */
  await (async () => {
    const g = await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님', greet: true,
      history: [{ role: 'user', content: '공부방 기억나요?' },
                { role: 'user', content: '(지금 시각에 맞는 안부를 한 줄)' }] }, '네.');
    eq('선톡 턴은 일반 경로다', stagesOf(g).includes('finalizer'), false);
    const w = await runScene({ mode: 'auto', room: 'health', user_name: '선생님',
      scene_reason: 'partner_known', partner: 'jaeeon',
      history: [{ role: 'user', content: '공부방 기억나요?' }] }, '[이재언] 네.');
    eq('관전은 항상 일반 경로다', [w.status, stagesOf(w).includes('finalizer')], [200, false]);
  })();

  /* ── E5는 고정부에 산다 — 캐시를 다시 깨지 않는 자리다 ── */
  await (async () => {
    await runScene({ mode: 'chat', room: 'jaeeon', user_name: '선생님',
      history: [{ role: 'user', content: '안녕' }] }, '네.');
    eq('아끼는 것 ≠ 모른다는 것이 캐시된 고정부에 있다',
      cachedPart().includes('아끼는 것 ≠ 모른다는 것'), true);
    eq('일반 턴에는 장면 줄이 없다', writerSaw().includes('[지금 장면]'), false);
  })();
}

/* 파이프라인을 실제로 굴려 본다 — 조각이 다 맞아도 이어붙인 데서 새는 것은
   여기서만 잡힌다 */
{
  const { writerAsk, splitCandidates, hardFilter, softSignals, readDecision, directorPacket } = ENG;

  eq('후보 하나면 지시가 안 붙는다', writerAsk(1), '');
  eq('후보 둘이면 모양을 못박는다',
    writerAsk(2).includes('{"candidates":[{"messages":[...]},{"messages":[...]}]}'), true);
  eq('후보 묶음을 뜯는다',
    splitCandidates(JSON.stringify({ candidates: [{ messages: [{ text: 'ㄱ' }] }, { messages: [{ text: 'ㄴ' }] }] })).length, 2);
  /* 모양이 어긋났다고 턴을 통째로 버리면 유저는 그냥 답이 안 온 것으로 본다 */
  eq('옛 모양은 후보 하나로 본다',
    splitCandidates(JSON.stringify({ messages: [{ text: 'ㄱ' }] })).length, 1);

  /* hardFilter는 Candidate만 받는다. 배열도 받던 옛 입구를 남기면 어떤
     경로는 새 검사를 온전히 받고 어떤 경로는 옛 검사만 받는다 —
     배열에는 id도 invite도 give도 없어서 절반이 통째로 안 돈다. */
  const cand = (messages, extra) => ({ id: 'A', originalMessages: messages, messages,
    invite: '', give: '', photo: '', signals: [], ...(extra || {}) });
  eq('빈 후보는 떨어진다', hardFilter(cand([]), ['minhyun'], {}), ['EMPTY']);
  eq('남의 화자는 떨어진다',
    hardFilter(cand([{ sender: 'x', text: 'ㄱ', senderGiven: true }]), ['minhyun'], {}), ['SENDER']);
  eq('안이 비치면 떨어진다',
    hardFilter(cand([{ sender: 'minhyun', text: '{"messages":' }]), ['minhyun'], {}), ['LEAK']);
  eq('멀쩡한 것은 안 떨어진다',
    hardFilter(cand([{ sender: 'minhyun', text: '아직 학교예요.' }]), ['minhyun'], {}), []);

  eq('매번 묻는 것은 신호다', softSignals([{ text: '밥 먹었어요?' }, { text: '어디예요?' }], []), ['ALL_QUESTIONS']);
  eq('상담사 말투는 신호다',
    softSignals([{ text: '정리하자면 이렇게 하시면 도움이 되실 거예요.' }], []).includes('COUNSELOR_TONE'), true);
  eq('멀쩡한 말에는 신호가 없다', softSignals([{ text: '아직 학교예요.' }], []), []);
  /* 신호지 판정이 아니다 — 여기서 자르지 않는다 */
  eq('최근에 한 말과 겹치면 신호다',
    softSignals([{ text: '오늘 학교 갔다 왔어요.' }], [{ role: 'assistant', content: '학교 갔다 왔어요' }])
      .includes('REPEATS_RECENT'), true);

  eq('판정을 읽는다', readDecision(JSON.stringify({ decision: 'B', reject_codes: {} }), ['A', 'B']).decision, 'B');
  eq('못 읽으면 다시 쓴다', readDecision('어느 쪽이 좋을까요', ['A', 'B']).decision, 'RETRY');
  eq('후보 하나에 A는 무효다', readDecision(JSON.stringify({ decision: 'A' }), ['ONE']).decision, 'RETRY');
  eq('후보 하나면 ACCEPT다', readDecision(JSON.stringify({ decision: 'ACCEPT' }), ['ONE']).decision, 'ACCEPT');
  /* A가 떨어지고 B만 남았다. 「B」는 유효하고 「A」는 없는 후보다 */
  /* A가 떨어지고 B만 남았다. 후보가 하나면 판정은 ACCEPT/RETRY다 —
     그래도 그 하나는 B고, 고르는 자리에서 A 자리를 집지 않는다. */
  eq('하나 남으면 ACCEPT로 받는다',
    [readDecision(JSON.stringify({ decision: 'ACCEPT' }), ['B']).decision,
     readDecision(JSON.stringify({ decision: 'A' }), ['B']).decision], ['ACCEPT', 'RETRY']);
  /* 없는 후보를 고르면 조용히 첫 후보로 떨어뜨리지 않는다 */
  eq('없는 후보는 안 집는다', (() => {
    const i = workerSrc.indexOf('picked = dec.decision === "ACCEPT" ? cands[0] : cands.find(c => c.id === dec.decision);');
    return i > 0 && workerSrc.slice(i, i + 220).includes('DIRECTOR_GHOST');
  })(), true);

  /* 꾸러미에 세계관이 통째로 들어가면 안 된다 */
  const pk = directorPacket({ who: 'minhyun', when: '저녁', place: '편의점', stage: '익숙 · 6일째',
    knows: '병원 옥상', facts: [], here: [], recent: [{ role: 'user', content: '뭐 해?' }] },
    [{ id: 'A', messages: [{ text: '골라요.' }], signals: [] },
     { id: 'B', messages: [{ text: '아직요.' }], signals: ['TOO_EXPLANATORY'] }]);
  eq('꾸러미에 후보 둘이 들어간다', pk.includes('후보 A') && pk.includes('후보 B'), true);
  eq('꾸러미에 코드 신호가 실린다', pk.includes('코드 신호: TOO_EXPLANATORY'), true);
  /* 성격표가 붙어 길어졌다. 그래도 인물 프롬프트 전체(이만 줄)보다는 훨씬 작다 */
  eq('꾸러미가 인물 프롬프트보다 훨씬 작다', pk.length < 2200, true);
  eq('꾸러미에 성격표가 실린다', pk.includes('minhyun.ask.short_check'), true);
  eq('꾸러미에 남의 성격표는 없다', pk.includes('jaeeon.voice.dry_haeyo'), false);
}

/* ══════════ 제안과 사건 — E-A단계 ══════════
   ── 왜 가르나 ──
   전에는 워커가 give를 그대로 응답에 실었고 클라이언트가 그걸 보고 가방에
   넣었다. 「제안」과 「사건」이 같은 값이면 같은 응답을 두 번 처리할 때
   두 번 일어난다. 그리고 자리를 닫을 때 자동으로 넣어주기까지 했다 —
   유저가 거절해도 들어가고, 인물이 준 적 없는 것이 가방에 있었다. */
{
  const { materializeEffects, makeEffect, mintEffectId, hardFilter } = ENG;
  const CAND = (extra) => ({ id: 'A', originalMessages: [], messages: [{ text: 'ㄱ' }],
    invite: '', give: '', photo: '', signals: [], ...(extra || {}) });
  const AT = { place: '옥상', room: 'minhyun', placeItemOwned: false,
    placeItemAvailable: true, openPlaces: [] };

  /* ── 검증된 제안만 사건이 된다 ── */
  eq('검증된 give가 Effect가 된다',
    materializeEffects('req-1', CAND({ give: 'can' }), AT),
    [{ id: mintEffectId('req-1', 'item_transfer', 'user', 'can'),
       type: 'item_transfer', from: 'minhyun', to: 'user', item: 'can' }]);
  /* 두 마디를 안 했으면 못 건넨다. 조건은 부르기 전에 계산돼 들어온다 */
  eq('두 마디 전에는 Effect가 없다',
    materializeEffects('req-1', CAND({ give: 'can' }), { ...AT, placeItemAvailable: false }), []);
  eq('이미 가졌으면 Effect가 없다',
    materializeEffects('req-1', CAND({ give: 'can' }), { ...AT, placeItemOwned: true }), []);
  eq('제안이 없으면 Effect도 없다', materializeEffects('req-1', CAND(), AT), []);
  eq('그 자리 물건이 아니면 Effect가 없다',
    materializeEffects('req-1', CAND({ give: 'note' }), AT), []);
  /* 자리 밖에서는 건넬 수 없다 */
  eq('자리가 없으면 Effect가 없다',
    materializeEffects('req-1', CAND({ give: 'can' }),
      { ...AT, place: null, placeItemAvailable: false }), []);

  /* ── 초대 ── */
  eq('열린 자리 초대는 Effect가 된다',
    materializeEffects('req-1', CAND({ invite: '옥상' }),
      { room: 'minhyun', place: null, openPlaces: ['옥상'] }),
    [{ id: mintEffectId('req-1', 'invite', 'minhyun', '옥상'),
       type: 'invite', place: '옥상', char: 'minhyun' }]);
  eq('지어낸 자리는 Effect가 안 된다',
    materializeEffects('req-1', CAND({ invite: '한강' }),
      { room: 'minhyun', place: null, openPlaces: ['옥상'] }), []);
  /* 지금 앉아 있는 자리로 다시 부르는 것은 모순이다 */
  eq('자리에 앉아서는 초대를 안 만든다',
    materializeEffects('req-1', CAND({ invite: '옥상' }),
      { room: 'minhyun', place: '옥상', openPlaces: [] }), []);

  /* ── id는 코드가 만든다 ── */
  eq('같은 재료면 같은 id다', (() => {
    const a = materializeEffects('req-1', CAND({ give: 'can' }), AT)[0].id;
    const b = materializeEffects('req-1', CAND({ give: 'can' }), AT)[0].id;
    return a === b;
  })(), true);
  eq('요청이 다르면 id도 다르다',
    materializeEffects('req-1', CAND({ give: 'can' }), AT)[0].id
      !== materializeEffects('req-2', CAND({ give: 'can' }), AT)[0].id, true);
  /* 모델이 id를 내도 안 쓴다 */
  eq('모델이 준 id는 무시한다',
    materializeEffects('req-1', CAND({ give: 'can', id: 'A', effect_id: '모델이지어낸것' }), AT)[0].id,
    mintEffectId('req-1', 'item_transfer', 'user', 'can'));
  /* 고른 후보의 것만 나간다 — 다른 후보의 제안을 집어올 길이 없다 */
  eq('고른 묶음의 제안만 사건이 된다', (() => {
    const A = CAND({ id: 'A', give: 'can' }), B = CAND({ id: 'B' });
    return [materializeEffects('r', A, AT).length, materializeEffects('r', B, AT).length];
  })(), [1, 0]);

  /* ── 자동 지급이 없다 ── */
  eq('닫는 손이 물건을 안 준다',
    /if\(o\.op==="closeScene"\)\{[\s\S]{0,300}setScene\(null\); sceneClosed\(sc\); return true;/.test(web), true);
  eq('앱의 닫는 손도 안 준다',
    /const closeScene=\(\)=>\{ putScene\(null\); \};/.test(appSrc), true);
  eq('웹·앱 어디에도 자동 지급이 없다',
    /talkedEnough\([^)]*\)\)\{[\s\S]{0,200}(takeItem|saveBag)/.test(web + appSrc), false);
  /* 워커가 두 마디 조건을 받아서 쓴다 — 응답 뒤가 아니라 부르기 전이다 */
  eq('두 마디 조건이 요청에 실린다',
    /talked_enough:talkedEnough\(sc,next\)/.test(web)
    && /talkedEnough:talkedEnoughIn\(sc,hist\)/.test(appSrc)
    && /talked_enough: !!talkedEnough/.test(apiSrc), true);

  /* ── 한 번만 적용한다 ── */
  eq('웹이 적용한 id를 적어둔다',
    /if\(loadEffDone\(\)\.indexOf\(e\.id\)>=0\)return\{status:"already_applied"\};/.test(web)
    && /if\(done\.indexOf\(e\.id\)<0\)done\.push\(e\.id\);/.test(web), true);
  /* 적기만 하는 게 아니라 적힌 것까지 다시 읽어 확인한다 — 관전 장부의
     어댑터가 이 판정을 그대로 쓰므로, 확인이 거짓이면 장부가 멈춘다 */
  eq('앱도 적용한 id를 적어둔다',
    /null_eff_done/.test(appSrc) && /if\(done\.includes\(e\.id\)\)return true;/.test(appSrc)
    && /return back\.includes\(e\.id\);/.test(appSrc), true);
  /* 방향을 본다 — 유저가 받는 것만 가방에 들어간다 */
  eq('웹·앱 둘 다 방향을 본다',
    /e\.to!=="user"/.test(web) && /e\.to==='user'/.test(appSrc), true);
  /* 앱이 give를 아예 안 보던 구멍을 막았다 */
  eq('앱이 이제 물건을 받는다',
    /await applyEffects\(data\?\.effects\);/.test(appSrc) && /item_transfer/.test(appSrc), true);
  eq('앱에 옛 invite 직접 적용이 없다',
    /if\(data\?\.invite\?\.place\) setInvite\(data\.invite\)/.test(appSrc), false);
  /* 상태를 바꾸는 길이 둘이면 두 번 일어난다 */
  eq('워커가 give·invite를 따로 안 싣는다', (() => {
    const i = workerSrc.indexOf('const effects = materializeEffects(reqId, picked, hardCtx);');
    const box = workerSrc.slice(i, i + 1400);
    return /invite: \{ place: invite/.test(box) || /give: \{ item: give/.test(box);
  })(), false);
  eq('기준선도 effects로 낸다',
    /const fx0 = materializeEffects\(reqId, c0, hardCtx\);/.test(workerSrc)
    && /effects: fx0/.test(workerSrc), true);

  /* ── 웹과 앱이 같은 Effect에서 같은 결과를 낸다 ──
     저장 방식은 다르다(localStorage vs SQLite meta). 그래도 같은 입력에서
     같은 최종 상태가 나와야 한다 — 아니면 기기마다 다른 가방을 든다. */
  {
    /* 두 적용 함수의 뼈대를 소스에서 그대로 뽑아 나란히 견준다 */
    const webBody = web.slice(web.indexOf('const markDone=e=>{'),
                              web.indexOf('const planEffects=fx=>{'));
    /* 앱은 하나짜리(applyOneEffect)와 루프(applyEffects)로 갈라졌다 —
       판정은 전부 하나짜리에 있으므로 둘을 함께 뜬다 */
    const appStart = appSrc.indexOf('const applyOneEffect=async(e:any)');
    const appBody = appSrc.slice(appStart, appSrc.indexOf('const applyUnlocked'));
    /* 같은 판정을 하는지 문장으로 맞춘다 — 둘 다 id 중복·방향·갈래를 본다 */
    const shape = t => [
      /e\.id/.test(t), /e\.type/.test(t),
      /item_transfer/.test(t), /invite/.test(t), /story_transition/.test(t),
      /to\s*!?===?\s*['"]user['"]/.test(t), /ITEMS\[e\.item\]/.test(t),
      /(indexOf\(e\.id\)>=0|includes\(e\.id\))/.test(t),
    ];
    eq('웹과 앱의 적용 판정이 같다', shape(webBody), shape(appBody));
    eq('둘 다 여덟 가지를 본다', shape(webBody), [true, true, true, true, true, true, true, true]);
    /* 같은 fixture를 두 번 넣으면 한 번과 같아야 한다 — 두 쪽 모두.
       웹은 갈래를 셋으로 가르므로 「이미 했다」가 상태로 드러난다 */
    eq('두 번 적용해도 한 번이다', (() => {
      const webTwice = /if\(loadEffDone\(\)\.indexOf\(e\.id\)>=0\)return\{status:"already_applied"\};/.test(webBody)
        && /if\(done\.indexOf\(e\.id\)<0\)done\.push\(e\.id\);/.test(web);
      const appTwice = /if\(done\.includes\(e\.id\)\)return true;/.test(appBody)
        && /done\.push\(e\.id\)/.test(appBody);
      return [webTwice, appTwice];
    })(), [true, true]);
    /* 가방에도 같은 물건을 두 번 안 넣는다 — id 검사와 별개의 두 번째 자물쇠 */
    eq('가방에도 두 번 안 넣는다',
      /if\(!bag\.some\(x=>x\.key===e\.item\)\)\{/.test(web)
      && /!bagRef\.current\.some\(\(b:any\)=>b\.key===e\.item\)/.test(appSrc), true);
    /* 참·거짓으로 뭉개지 않는다 — 「이미 가짐」과 「저장 실패」는 다른 일이다 */
    eq('갈래를 넷으로 가른다',
      ['applied', 'already_applied', 'not_applicable', 'storage_error']
        .filter(k => !webBody.includes(`status:"${k}"`)), []);
  }

  /* ── E-A 후속 · 실제로 돌려서 본다 ──
     소스 모양만 보는 검사는 시간 순서·리액트의 늦은 갱신·무상태 워커
     재시도를 못 잡는다. 여기서는 실제 상태를 만들어 굴린다. */
  {
    const store = {};
    globalThis.localStorage = { getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v)},
      removeItem:k=>{delete store[k]}, get length(){return Object.keys(store).length},
      key:i=>Object.keys(store)[i] };
    globalThis.location = { search:'' };
    globalThis.React = { useState:()=>[], useEffect:()=>{}, useRef:()=>({}) };
    const D = new Function(readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      + ';return {talkedEnoughIn,countUserSaid,SCENE_MIN_TALK,peekScene,ackScene,markScene}')();

    /* ── 정확히 두 번째 발화에서 열린다 ──
       전에는 방금 친 말이 빠진 목록으로 세서 세 번째부터 열렸다. */
    const sc = { room: 'minhyun', place: '옥상', since: 1000 };
    const said = n => Array.from({ length: n }, (_, i) => ({ sender: 'user', ts: 1000 + i }));
    eq('두 마디 조건이 정확히 두 번째다',
      [0, 1, 2, 3].map(n => D.talkedEnoughIn(sc, said(n))), [false, false, true, true]);
    /* 자리에 앉기 전에 한 말은 안 센다 */
    eq('자리 전에 한 말은 안 센다',
      D.talkedEnoughIn(sc, [{ sender: 'user', ts: 1 }, { sender: 'user', ts: 2 }]), false);
    /* 지문과 인물 말은 발화가 아니다 */
    eq('지문과 인물 말은 안 센다', D.talkedEnoughIn(sc, [
      { sender: 'user', ts: 1000, sys: true }, { sender: 'minhyun', ts: 1001 },
      { sender: 'user', ts: 1002 }]), false);
    /* 앱은 created_at, 웹은 ts — 같은 함수가 둘 다 받는다 */
    eq('웹·앱의 시각 칸을 둘 다 읽는다',
      D.talkedEnoughIn(sc, [{ sender: 'user', created_at: 1000 }, { sender: 'user', created_at: 1001 }]), true);

    /* ── 그 전의 give 제안은 탈락한다 ──
       프롬프트에 안 보여줬는데도 지어냈으면 그건 세계를 어긴 것이다.
       「받아요」가 화면에 뜨고 가방은 비는 일이 없어야 한다. */
    const two = { place: '옥상', room: 'minhyun', placeItemOwned: false };
    eq('두 마디 전 give는 후보째 떨어진다',
      hardFilter({ messages: [{ text: '이거 받아요.' }], give: 'can' }, ['minhyun'],
        { ...two, placeItemAvailable: false }), ['INVALID_GIVE']);
    eq('두 마디 뒤 give는 통과한다',
      hardFilter({ messages: [{ text: '이거 받아요.' }], give: 'can' }, ['minhyun'],
        { ...two, placeItemAvailable: true }), []);
    /* 프롬프트에도 안 보인다 — 이름조차 안 나가야 지어낼 거리가 없다 */
    eq('두 마디 전 프롬프트에 물건이 없다', (() => {
      const off = ENG.buildPlace('옥상', false, 'minhyun', false, '', false);
      const on = ENG.buildPlace('옥상', false, 'minhyun', false, '', true);
      return [/캔커피|"give"/.test(off), /캔커피/.test(on) && /"give"/.test(on)];
    })(), [false, true]);

    /* ── 승격 거절이면 pending을 지키지 않는다 ── */
    D.markScene('minhyun', 'confession');
    eq('거절된 장면은 남는다', (() => {
      const data = { messages: [{ text: 'ㄱ' }] };            // scene_ack 없음
      if (data.scene_ack === 'confession') D.ackScene('minhyun', 'confession');
      return D.peekScene('minhyun');
    })(), 'confession');
    eq('승인된 장면만 지운다', (() => {
      const data = { messages: [{ text: 'ㄱ' }], scene_ack: 'confession' };
      if (data.scene_ack === 'confession') D.ackScene('minhyun', 'confession');
      return D.peekScene('minhyun');
    })(), '');
    /* 다른 사유가 돌아와도 안 지운다 */
    D.markScene('minhyun', 'partner_known');
    eq('딴 사유가 오면 안 지운다', (() => {
      const data = { scene_ack: 'confession' };
      if (data.scene_ack === 'partner_known') D.ackScene('minhyun', 'partner_known');
      return D.peekScene('minhyun');
    })(), 'partner_known');
    D.ackScene('minhyun', 'partner_known');
  }

  /* ══════════ 웹 lifecycle · 앱을 진짜로 굴린다 ══════════
     여기까지의 검사는 소스 모양을 봤다. 그런데 남은 버그는 전부 **시간**에
     있었다 — 첫 말풍선이 뜨기 전에 껐다 켰을 때, 타이핑 도중에 껐을 때,
     다른 방 말풍선이 큐에 먼저 쌓여 있을 때. 그건 정규식으로 안 보인다.

     app.js의 논리부(화면 그리는 자리 앞까지)를 최소 리액트·가짜 시계·가짜
     저장소 위에서 실제로 돌린다. 새로고침은 **같은 저장소로 다시 켜는 것**
     으로 흉내낸다 — 그게 실제로 일어나는 일이다. */
  {
    const dataSrc = readFileSync(join(ROOT, 'app-data.js'), 'utf8');
    const CUT = '  const cameBack=cameBackOf(store);';   // 여기부터는 화면 조각(app-ui)을 부른다
    eq('논리부를 잘라낼 자리가 있다', web.includes(CUT) && web.includes('function App(){'), true);
    const APP_SRC = 'function App(){'
      + web.slice(web.indexOf('function App(){') + 'function App(){'.length, web.indexOf(CUT))
      + `\n  return { send, request, enqueue, commitTurn, resumeBatch, retry, openRoom, runAutoEvent,
        localBatch, headBatchOf,
        leaveScene, answerLeave, startWay: setWay, answerWay,
        openAsk, answerMove, answerAsk, answerInvite, giveGift, giveGiftAt,
        invite, busy, failed,
        get store(){ return storeRef.current }, get bag(){ return bagRef.current } };\n}`;

    /* ── 시계도 가짜여야 한다 ──
       타이머만 가짜로 두면 Date.now()와 캐릭터 수면 판정은 진짜 벽시계를
       본다. 민현이 자는 시각에 돌리면 요청이 모델까지 안 가고 「자고 있다」로
       끝나서, 같은 코드가 실행한 시각에 따라 통과와 실패로 갈렸다.
       **로컬 벽시계 성분으로** 기준 시각을 만든다 — new Date(2026,0,6,14,0)은
       어느 시간대에서 돌리든 그 지역의 화요일 오후 두 시다. 둘 다 깨어 있다. */
    const T0 = new Date(2026, 0, 6, 14, 0, 0).getTime();
    eq('하네스 기준 시각은 시간대와 무관하다',
      [new Date(T0).getHours(), new Date(T0).getDay()], [14, 2]);

    /* 저장소 하나를 두고 앱을 켠다. 같은 저장소로 다시 켜면 그게 새로고침이다 */
    const boot = (seed, reply, opt) => {
      const mem = new Map(Object.entries(seed || {}));
      const fail = (opt && opt.failKeys) || [];   // 저장 실패를 주입할 key
      /* 그 key의 n번째 쓰기만 실패시킨다. 켜는 것은 부팅이 끝난 뒤부터이고,
         값이 실제로 바뀌는 쓰기만 센다 — 리액트 effect가 같은 값을 한 번 더
         쓰는 것까지 세면 번호가 코드 모양에 딸려 흔들린다. */
      let armed = false;
      const nthFail = (opt && opt.failNth) || null;
      const localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null,
        setItem: (k, v) => {
          const t = String(v);
          if (fail.includes(k)) throw new Error('QuotaExceededError');
          if (nthFail && armed && nthFail.key === k && mem.get(k) !== t && nthFail.n())
            throw new Error('QuotaExceededError');
          mem.set(k, t);
        },
        removeItem: k => mem.delete(k),
        clear: () => mem.clear(), get length() { return mem.size }, key: i => [...mem.keys()][i] };
      let now = T0, seq = 0;
      const timers = [];
      const setT = (fn, ms) => { timers.push({ at: now + (ms || 0), n: seq++, fn }); return seq };
      /* app.js·app-data.js가 보는 Date를 통째로 갈아끼운다 */
      class FakeDate extends Date {
        constructor(...a) { if (!a.length) super(now); else super(...a) }
        static now() { return now }
      }
      const cells = []; let idx = 0, dirty = false, effects = [], probe = null;
      const React = {
        useState(init) {
          const k = idx++;
          if (!cells[k]) cells[k] = { v: typeof init === 'function' ? init() : init };
          const c = cells[k];
          return [c.v, nv => { c.v = typeof nv === 'function' ? nv(c.v) : nv; dirty = true }];
        },
        useRef(init) { const k = idx++; if (!cells[k]) cells[k] = { current: init }; return cells[k] },
        useEffect(fn, deps) {
          const k = idx++, prev = cells[k];
          const same = prev && prev.deps && deps && prev.deps.length === deps.length
            && deps.every((d, j) => Object.is(d, prev.deps[j]));
          cells[k] = { deps };
          if (!same) effects.push(fn);
        },
      };
      const sent = [];
      const App = new Function('React', 'localStorage', 'location', 'fetch',
        'setTimeout', 'clearTimeout', 'console', 'crypto', 'Date',
        dataSrc + '\n' + APP_SRC + '\nreturn App;')(
        React, localStorage, { search: '' },
        async (url, opt) => {
          const body = JSON.parse(opt.body); sent.push(body);
          return { ok: true, status: 200, json: async () => (reply ? reply(body) : { messages: [] }) };
        },
        setT, () => {}, { log() {}, error() {}, warn() {} }, globalThis.crypto, FakeDate);
      const render = () => {
        let guard = 0;
        do {
          if (++guard > 60) throw new Error('render loop');
          dirty = false; idx = 0; effects = [];
          probe = App();
          const fx = effects; effects = [];
          fx.forEach(f => f());
        } while (dirty);
      };
      /* 가짜 시계를 ms만큼 앞으로 감는다. fetch가 promise라 사이사이 비워준다 */
      const tick = async ms => {
        const end = now + ms;
        for (;;) {
          for (let i = 0; i < 4; i++) await Promise.resolve();
          timers.sort((a, b) => a.at - b.at || a.n - b.n);
          if (!timers.length || timers[0].at > end) break;
          const t = timers.shift(); now = t.at; t.fn(); render();
        }
        now = end;
        for (let i = 0; i < 4; i++) await Promise.resolve();
        render();
      };
      render();
      armed = true;
      return { get app() { return probe }, tick, render, sent,
        ls: k => { const v = mem.get(k); try { return JSON.parse(v) } catch (e) { return v } },
        dump: () => Object.fromEntries(mem) };
    };
    const ui = readFileSync(join(ROOT, 'app-ui.js'), 'utf8');
    const said = (W, r) => (W.app.store.msgs[r || 'minhyun'] || []).map(m => (m.sys ? '· ' : '') + m.text);
    /* 모델에게 실제로 나간 history 안의 지문 줄 */
    const outSys = W => (W.sent[W.sent.length - 1].history || [])
      .filter(h => h.kind === 'event').map(h => h.content);

    /* ── 첫 말풍선 전에 껐다 켠다 ──
       전에는 장면(scene_pend)이 답이 저장되기도 전에 지워졌다. 그 사이에
       새로고침하면 「한 번뿐인 고백은 소모됐는데 답은 한 줄도 없는」
       세이브가 남았다. 이제 답이 통째로 적힌 뒤에만 지운다. */
    {
      const rep = () => ({ messages: [{ text: 'ㄱ' }, { text: 'ㄴ' }, { text: 'ㄷ' }], scene_ack: 'confession' });
      const W = boot({ null_name: '윤하', null_scene_pend: JSON.stringify({ minhyun: 'confession' }) }, rep);
      W.app.send('minhyun', '있잖아');
      await W.tick(0);                       // 답은 왔고 첫 말풍선은 아직
      /* 장부가 먼저다. 이 시점에 바뀐 상태는 하나도 없다 —
         계획만 통째로 적혀 있고 장면은 아직 예약된 채다 */
      eq('그 시점에 답은 통째로 남아 있다',
        (W.ls('null_batch') || []).map(b => b.items.map(i => i.text)), [['ㄱ', 'ㄴ', 'ㄷ']]);
      eq('소모할 장면도 장부에 적혀 있다',
        (W.ls('null_batch') || []).map(b => b.scene_ack), ['confession']);
      eq('아직 아무것도 안 바꿨다',
        [W.ls('null_scene_pend'), said(W)], [{ minhyun: 'confession' }, ['있잖아']]);
      const W2 = boot(W.dump(), rep);        // ← 새로고침
      await W2.tick(5000);
      eq('첫 말풍선 전에 꺼도 답이 다 온다',
        (W2.app.store.msgs.minhyun || []).map(m => m.text), ['있잖아', 'ㄱ', 'ㄴ', 'ㄷ']);
      /* 다 푼 뒤에야 장면이 소모되고 장부가 지워진다 */
      eq('다 푼 뒤에 장면이 소모된다',
        [W2.ls('null_scene_pend'), W2.ls('null_batch')], [{}, []]);
    }

    /* ── 타이핑 도중에 껐다 켠다 ── */
    {
      const rep = () => ({ messages: [{ text: 'ㄱ' }, { text: 'ㄴ' }, { text: 'ㄷ' }] });
      const W = boot({ null_name: '윤하' }, rep);
      W.app.send('minhyun', '안녕');
      await W.tick(1200);
      eq('도중까지는 나온 만큼만 남는다', said(W), ['안녕', 'ㄱ', 'ㄴ']);
      eq('남은 것은 기록에 그대로 있다',
        (W.ls('null_batch') || []).map(b => b.items.map(i => i.text)), [['ㄷ']]);
      const W2 = boot(W.dump(), rep);        // ← 새로고침
      await W2.tick(5000);
      eq('끊긴 재생이 이어지고 두 번 안 붙는다',
        (W2.app.store.msgs.minhyun || []).map(m => m.text), ['안녕', 'ㄱ', 'ㄴ', 'ㄷ']);
    }

    /* ── 큐에 다른 방 말풍선이 먼저 쌓여 있다 ──
       큐는 방마다가 아니라 하나뿐이다. 전에는 「말 수 × 600ms」로 짐작해
       연출을 걸었는데, 앞에 넷이 쌓여 있으면 그 짐작은 어긋난다 —
       건네는 대사가 뜨기도 전에 「받았다」가 먼저 떴다. */
    {
      const eff = [{ id: 'e1', type: 'item_transfer', from: 'minhyun', to: 'user', item: 'can' }];
      const W = boot({ null_name: '윤하' }, b => b.room === 'minhyun'
        ? { messages: [{ text: '이거 드세요' }, { text: '따뜻해요' }], effects: eff }
        : { messages: [] });
      W.app.enqueue('jaeeon', [{ text: 'ja1' }, { text: 'ja2' }, { text: 'ja3' }, { text: 'ja4' }]);
      W.app.send('minhyun', '뭐해요');
      await W.tick(0);
      /* 계획이 먼저 남는다 — Effect 원본과 「받았다」 줄이 장부에 있고,
         가방도 표도 아직 안 바뀌었다 */
      eq('Effect가 장부에 그대로 있다',
        (W.ls('null_batch') || []).flatMap(b => b.effects.map(e => e.id)), ['e1']);
      eq('받았다 지문도 같이 남는다',
        (W.ls('null_batch') || []).flatMap(b => b.sys.map(s => s.text)),
        ['이민현에게 캔커피를 받았다']);
      eq('아직 가방도 표도 안 바뀌었다',
        [W.ls('null_bag'), W.ls('null_eff_done')], [undefined, undefined]);
      await W.tick(9000);
      eq('건네는 대사가 먼저, 받았다가 나중이다',
        said(W), ['뭐해요', '이거 드세요', '따뜻해요', '· 이민현에게 캔커피를 받았다']);
      eq('다 푼 뒤에 가방과 표가 남는다',
        [(W.ls('null_bag') || []).map(x => x.key), W.ls('null_eff_done')], [['can'], ['e1']]);
    }

    /* ── 초대는 답할 때까지 남는다 ──
       전에는 표만 즉시 찍고 창은 타이머 뒤에 열었다. 그 사이에 껐다 켜면
       「이미 초대했다」는 표만 남고 물음은 영영 안 왔다. */
    {
      const eff = [{ id: 'i1', type: 'invite', place: '옥상', char: 'minhyun' }];
      const rep = () => ({ messages: [{ text: '같이 갈래요' }], effects: eff });
      const W = boot({ null_name: '윤하' }, rep);
      W.app.send('minhyun', '뭐해요');
      await W.tick(0);
      eq('타이머 전이면 초대는 계획으로만 있다',
        [(W.ls('null_batch') || []).flatMap(b => b.effects.map(e => e.place)), W.ls('null_invite')],
        [['옥상'], undefined]);
      const W2 = boot(W.dump(), rep);        // ← 창 열리기 전에 새로고침
      await W2.tick(5000);
      eq('껐다 켜도 초대는 온다', [W2.ls('null_invite'), W2.app.invite],
        [[{ place: '옥상', char: 'minhyun' }], { place: '옥상', char: 'minhyun' }]);
      /* 창이 떠 있는 채로 또 껐다 켜도 물음은 남는다 */
      const W3 = boot(W2.dump(), rep);
      eq('창이 떠 있는 채로 꺼도 남는다', W3.app.invite, { place: '옥상', char: 'minhyun' });
      W3.app.answerInvite(false); W3.render();
      eq('답하면 그때 지워진다', [W3.ls('null_invite'), W3.app.invite], [undefined, null]);
    }

    /* ── 같은 답을 두 번 재생해도 한 번이다 ── */
    {
      const eff = [{ id: 'e9', type: 'item_transfer', from: 'minhyun', to: 'user', item: 'can' }];
      const rep = () => ({ messages: [{ text: 'ㄱ' }], effects: eff });
      const W = boot({ null_name: '윤하' }, rep);
      W.app.send('minhyun', '뭐해요');
      await W.tick(2000);
      const once = W.dump();
      const W2 = boot(once, rep);            // 다 끝난 뒤 새로고침
      await W2.tick(5000);
      eq('끝난 답은 다시 재생 안 된다', said(W2), ['뭐해요', 'ㄱ', '· 이민현에게 캔커피를 받았다']);
      eq('가방에도 하나뿐이다', (W2.ls('null_bag') || []).map(x => x.key), ['can']);
    }

    /* ══════ 사건은 정확히 한 번이다 ══════
       appendMsg가 storeRef까지 즉시 앞세우게 되면서, 「방금 붙인 것을 다시
       이어 붙이는」 옛 관용구가 사건을 두 벌로 만들었다. 화면과 저장에는
       한 번인데 **모델에게 가는 history와 counts에는 두 번**이라, 같은 일이
       두 번 일어난 것으로 읽히고 관계 단계·해금이 일찍 열린다.
       여덟 특수 경로를 전부 실제로 굴려서 셋을 맞춰본다:
         화면 · 영속 store · outbound history. counts도 같이 본다. */
    {
      const rep = () => ({ messages: [{ text: '네' }] });
      /* 지문이 화면·저장·history에 각각 몇 번인가 */
      const trace = (W, room, mark) => {
        const scr = (W.app.store.msgs[room] || []).filter(m => m.sys && m.text.includes(mark)).length;
        const kept = ((W.ls('null_store_v1') || { msgs: {} }).msgs[room] || [])
          .filter(m => m.sys && m.text.includes(mark)).length;
        const out = W.sent[W.sent.length - 1];
        const hist = (out.history || []).filter(h => String(h.content).includes(mark)).length;
        return [scr, kept, hist];
      };
      /* history 줄 수와 counts가 맞나 — counts가 부풀면 관계 단계가 앞당겨진다 */
      const counted = (W, room) => {
        const out = W.sent[W.sent.length - 1];
        return [(out.history || []).length, (out.counts || {})[room]];
      };
      const ONE = [1, 1, 1];

      /* ① 자리 자동 종료 — 한 시간 지난 자리를 열면 닫히고 작별을 부른다 */
      {
        const sc = { room: 'minhyun', place: '옥상', since: T0 - 3 * 3600e3 };
        const W = boot({ null_name: '윤하', null_scene: JSON.stringify(sc),
          null_store_v1: JSON.stringify({ msgs: { minhyun: [
            { id: 1, sender: 'user', text: '안녕', ts: T0 - 3 * 3600e3 }] }, unread: {} }) }, rep);
        await W.tick(0);
        eq('자리 자동 종료 — 나왔다가 한 번', trace(W, 'minhyun', '옥상에서 나왔다'), ONE);
        eq('자리 자동 종료 — history와 counts가 맞다', counted(W, 'minhyun'), [2, 2]);
      }
      /* ② 자리에서 직접 나가기 */
      {
        const sc = { room: 'minhyun', place: '옥상', since: T0 - 60e3 };
        const W = boot({ null_name: '윤하', null_scene: JSON.stringify(sc) }, rep);
        W.app.leaveScene(); W.render();       // X — 「나가기」 확인창
        W.app.answerLeave(true);
        await W.tick(0);
        eq('직접 나가기 — 나왔다가 한 번', trace(W, 'minhyun', '옥상에서 나왔다'), ONE);
        eq('직접 나가기 — history와 counts가 맞다', counted(W, 'minhyun'), [1, 1]);
      }
      /* ③ 귀갓길 */
      {
        const sc = { room: 'minhyun', place: '옥상', since: T0 - 60e3 };
        const W = boot({ null_name: '윤하', null_scene: JSON.stringify(sc) }, rep);
        W.app.startWay(sc); W.render();
        W.app.answerWay(true);
        await W.tick(0);
        eq('귀갓길 — 가는 길이 한 번', trace(W, 'minhyun', '버스를 타고 집에 가는 길'), ONE);
        eq('귀갓길 — history와 counts가 맞다', counted(W, 'minhyun'), [1, 1]);
      }
      /* ④·⑤ 초대 수락과 거절 */
      for (const [ok, mark] of [[true, '옥상에 가기로 했다'], [false, '옥상은 다음에 가기로 했다']]) {
        const W = boot({ null_name: '윤하',
          null_invite: JSON.stringify([{ place: '옥상', char: 'minhyun' }]) }, rep);
        W.app.answerInvite(ok);
        await W.tick(0);
        eq(`초대 ${ok ? '수락' : '거절'} — 지문이 한 번`, trace(W, 'minhyun', mark), ONE);
        eq(`초대 ${ok ? '수락' : '거절'} — history와 counts가 맞다`, counted(W, 'minhyun'), [1, 1]);
      }
      /* ⑥ 같이 자리 이동 */
      {
        const sc = { room: 'minhyun', place: '옥상', since: T0 - 60e3 };
        const W = boot({ null_name: '윤하', null_scene: JSON.stringify(sc),
          null_met: JSON.stringify(['교실', '보건실', '옥상']) }, rep);
        W.app.openAsk('체육관'); W.render();
        W.app.answerMove(true);
        await W.tick(0);
        eq('자리 이동 — 옮겼다가 한 번', trace(W, 'minhyun', '체육관으로 같이 자리를 옮겼다'), ONE);
        eq('자리 이동 — history와 counts가 맞다', counted(W, 'minhyun'), [1, 1]);
      }
      /* ⑦ 지도에서 자리 방문 — 자리 임자가 하나뿐이라 상대가 정해진다 */
      {
        const W = boot({ null_name: '윤하',
          null_met: JSON.stringify(['교실', '보건실', '옥상']) }, rep);
        W.app.openAsk('체육관'); W.render();
        W.app.answerAsk(true);
        await W.tick(0);
        eq('지도 방문 — 갔다가 한 번', trace(W, 'minhyun', '체육관에 갔다'), ONE);
        eq('지도 방문 — history와 counts가 맞다', counted(W, 'minhyun'), [1, 1]);
      }
      /* ⑧ 선물 전달 — 만나서 준다 */
      {
        const sc = { room: 'minhyun', place: '옥상', since: T0 - 60e3 };
        const W = boot({ null_name: '윤하', null_scene: JSON.stringify(sc) }, rep);
        W.app.giveGift('minhyun', { key: 'mug', name: '회색 머그컵' }, '');
        await W.tick(0);
        eq('선물 — 받았다가 한 번', trace(W, 'minhyun', '회색 머그컵을 받았다'), ONE);
        eq('선물 — history와 counts가 맞다', counted(W, 'minhyun'), [1, 1]);
      }
      /* ⑨ 선물을 들고 만나러 가기 — 방문과 선물이 **각각** 한 번 */
      {
        const W = boot({ null_name: '윤하', null_met: JSON.stringify(['옥상']) }, rep);
        W.app.giveGiftAt('minhyun', { key: 'mug', name: '회색 머그컵' }, '', '옥상');
        await W.tick(0);
        eq('들고 가기 — 방문이 한 번', trace(W, 'minhyun', '옥상에 갔다'), ONE);
        eq('들고 가기 — 선물이 한 번', trace(W, 'minhyun', '회색 머그컵을 받았다'), ONE);
        eq('들고 가기 — history와 counts가 맞다', counted(W, 'minhyun'), [2, 2]);
      }
    }

    /* ══════ 재생 중에는 그 방이 잠긴다 ══════
       새로고침으로 되살아난 답이 아직 다 안 떴는데 새 말을 받으면
       「유저 말 → 새 유저 말 → 옛 답 나머지」로 갈리고, 새 요청의 history에는
       아직 안 뜬 옛 답이 통째로 빠진다. */
    {
      const rep = () => ({ messages: [{ text: 'ㄱ' }, { text: 'ㄴ' }, { text: 'ㄷ' }] });
      const W = boot({ null_name: '윤하' }, rep);
      W.app.send('minhyun', '안녕');
      await W.tick(1200);
      const W2 = boot(W.dump(), rep);          // ← 재생 도중 새로고침
      eq('되살아난 방은 곧바로 잠긴다', W2.app.busy.minhyun, true);
      const before = W2.sent.length;
      W2.app.send('minhyun', '끼어들기');       // 화면에서도 막히지만 손으로도 눌러본다
      await W2.tick(0);
      eq('재생 중에는 새 요청이 안 나간다', W2.sent.length, before);
      await W2.tick(5000);
      eq('다 풀린 뒤에야 열린다', [W2.app.busy.minhyun, said(W2)],
        [false, ['안녕', 'ㄱ', 'ㄴ', 'ㄷ']]);
      W2.app.send('minhyun', '이제');
      await W2.tick(0);
      eq('열린 뒤에는 나간다', W2.sent.length, before + 1);
    }

    /* ══════ 같은 답을 두 번 적지 않는다 ══════
       늦게 온 답·재시도·되살아난 탭이 같은 id로 다시 올 수 있다. 반쯤 푼
       상태를 처음으로 되돌리면 이미 뜬 말풍선이 한 번 더 뜬다. */
    {
      const W = boot({ null_name: '윤하' }, () => ({ messages: [{ text: 'ㄱ' }, { text: 'ㄴ' }, { text: 'ㄷ' }] }));
      W.app.send('minhyun', '안녕');
      await W.tick(1200);                       // ㄱ·ㄴ까지 떴다
      const again = W.app.commitTurn(W.ls('null_batch')[0].id, 'minhyun',
        { messages: [{ text: 'ㄱ' }, { text: 'ㄴ' }, { text: 'ㄷ' }] }, {}, null);
      W.app.resumeBatch(again.id);
      await W.tick(5000);
      eq('부분 재생 중 같은 답이 또 와도 한 벌이다', said(W), ['안녕', 'ㄱ', 'ㄴ', 'ㄷ']);
      eq('남은 것만 들고 있었다', again.items.map(i => i.text), ['ㄷ']);
    }

    /* ══════ 미완료 장부는 오래됐다고 안 버린다 ══════
       전에는 slice(-8)이었다. 아홉 번째가 들어올 때 제일 오래된 **아직 안 푼**
       답이 조용히 사라져, 가방과 표만 남고 「받았다」 지문이 없어졌다. */
    {
      const W = boot({ null_name: '윤하' }, () => ({ messages: [{ text: 'ㄱ' }] }));
      for (let i = 0; i < 9; i++)
        W.app.commitTurn('b' + i, 'minhyun', { messages: [{ text: '답' + i }] }, {}, null);
      eq('아홉 개가 다 남는다', (W.ls('null_batch') || []).map(b => b.id),
        ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8']);
      /* 깨진 값이 섞여 있어도 앱이 안 죽는다 */
      const V = boot({ null_name: '윤하', null_batch: '{"nope":1}' }, null);
      eq('깨진 장부는 빈 것으로 읽는다', V.ls('null_batch'), { nope: 1 });
      eq('깨져 있어도 켜진다', !!V.app, true);
    }

    /* ══════ 두 방의 초대가 겹쳐도 앞엣것이 안 사라진다 ══════ */
    {
      const W = boot({ null_name: '윤하' }, b => b.room === 'jaeeon'
        ? { messages: [{ text: '같이 갈까요' }],
            effects: [{ id: 'iJ', type: 'invite', place: '편의점', char: 'jaeeon' }] }
        : { messages: [{ text: '가실래요' }],
            effects: [{ id: 'iM', type: 'invite', place: '옥상', char: 'minhyun' }] });
      W.app.send('jaeeon', '뭐해요');
      W.app.send('minhyun', '뭐해요');
      await W.tick(5000);
      eq('먼저 온 초대가 앞에 선다',
        (W.ls('null_invite') || []).map(x => x.place), ['편의점', '옥상']);
      eq('뜨는 것은 앞엣것 하나', W.app.invite, { place: '편의점', char: 'jaeeon' });
      W.app.answerInvite(false); W.render();
      eq('답하면 다음 것이 열린다',
        [W.app.invite, (W.ls('null_invite') || []).map(x => x.place)],
        [{ place: '옥상', char: 'minhyun' }, ['옥상']]);
      W.app.answerInvite(false); W.render();
      eq('다 답하면 비운다', [W.app.invite, W.ls('null_invite')], [null, undefined]);
      /* 옛 세이브의 단일 값도 읽는다 — 줄로 바뀌었다고 답 못 한 초대를 버리지 않는다 */
      const O = boot({ null_name: '윤하',
        null_invite: JSON.stringify({ place: '옥상', char: 'minhyun' }) }, null);
      eq('옛 단일 초대도 읽는다', O.app.invite, { place: '옥상', char: 'minhyun' });
    }

    /* ══════ 저장이 실패하면 아무것도 소모하지 않는다 ══════
       삼키고 넘어가면 「장면은 소모됐는데 답은 없음」이 저장 실패 하나로
       다시 만들어진다. */
    {
      const rep = () => ({ messages: [{ text: 'ㄱ' }], scene_ack: 'confession',
        effects: [{ id: 'eX', type: 'item_transfer', from: 'minhyun', to: 'user', item: 'can' }] });
      const seed = { null_name: '윤하', null_scene_pend: JSON.stringify({ minhyun: 'confession' }) };
      const W = boot(seed, rep, { failKeys: ['null_batch'] });
      W.app.send('minhyun', '있잖아');
      await W.tick(5000);
      eq('장부 저장이 실패하면 장면이 안 지워진다', W.ls('null_scene_pend'), { minhyun: 'confession' });
      eq('표도 안 찍힌다', W.ls('null_eff_done'), undefined);
      eq('재시도할 수 있게 실패로 남는다', !!W.app.failed.minhyun, true);
      /* 대화 저장 자체가 실패해도 마찬가지 */
      const V = boot(seed, rep, { failKeys: ['null_store_v1'] });
      V.app.send('minhyun', '있잖아');
      await V.tick(5000);
      eq('대화 저장이 실패해도 장면이 안 지워진다', V.ls('null_scene_pend'), { minhyun: 'confession' });
      eq('안 남은 말은 화면에도 안 남긴다', (V.app.store.msgs.minhyun || []).length, 0);
    }

    /* ══════ 장부는 write-ahead다 ══════
       저장 함수마다 if를 하나씩 더 붙이는 것으로는 안 된다. 실패를 알았을
       때는 이미 앞 단계 상태가 바뀐 뒤라 되돌릴 수도 이어갈 수도 없었다.
       key 하나씩을 실제로 실패시키고, 고친 뒤 이어서 돌려본다. */
    {
      const EFF = [{ id: 'eB', type: 'item_transfer', from: 'minhyun', to: 'user', item: 'can' }];
      const rep = () => ({ messages: [{ text: 'ㄱ' }], effects: EFF, scene_ack: 'confession' });
      const seed = () => ({ null_name: '윤하',
        null_scene_pend: JSON.stringify({ minhyun: 'confession' }) });

      /* ① 가방 저장만 실패 — 대사는 나가면 안 되고 장면도 안 지워진다 */
      {
        const W = boot(seed(), rep, { failKeys: ['null_bag'] });
        W.app.send('minhyun', '있잖아');
        await W.tick(9000);
        const fetches = W.sent.length;
        eq('가방이 안 남으면 장면도 안 지워진다', W.ls('null_scene_pend'), { minhyun: 'confession' });
        eq('표도 안 찍힌다', W.ls('null_eff_done'), undefined);
        eq('장부가 그대로 남는다', (W.ls('null_batch') || []).map(b => b.id.split('|')[1]), ['minhyun']);
        eq('받았다 지문도 안 뜬다', said(W).filter(t => t.includes('받았다')), []);
        eq('재시도할 수 있게 잠긴 채로 남는다',
          [!!W.app.failed.minhyun, W.app.busy.minhyun], [true, true]);
        /* ② 재시도는 모델을 다시 안 부른다 — 답은 이미 장부에 있다 */
        W.app.retry('minhyun');
        await W.tick(2000);
        eq('저장 실패 재시도는 API를 다시 안 부른다', W.sent.length, fetches);
      }

      /* ③ 장부 첫 쓰기만 실패 — 아무것도 안 바뀌고, 고치면 정확히 한 번 */
      {
        const W = boot(seed(), rep, { failKeys: ['null_batch'] });
        W.app.send('minhyun', '있잖아');
        await W.tick(9000);
        eq('장부가 안 써지면 아무것도 안 바뀐다',
          [W.ls('null_bag'), W.ls('null_eff_done'), W.ls('null_scene_pend')],
          [undefined, undefined, { minhyun: 'confession' }]);
        /* 고치고 다시 — 장부에 답이 없으니 이번엔 모델을 다시 부른다 */
        const V = boot(W.dump(), rep);
        V.app.send('minhyun', '있잖아');
        await V.tick(9000);
        eq('고친 뒤에는 가방·지문·표가 각각 한 번',
          [(V.ls('null_bag') || []).map(x => x.key), V.ls('null_eff_done'),
           said(V, 'minhyun').filter(t => t.includes('받았다')).length],
          [['can'], ['eB'], 1]);
      }

      /* ④ 표(effect_done) 첫 쓰기만 실패 — 중요 장면이 다시 발동하면 안 된다 */
      {
        const W = boot(seed(), rep, { failKeys: ['null_eff_done'] });
        W.app.send('minhyun', '있잖아');
        await W.tick(9000);
        eq('표가 안 찍히면 장면도 안 소모된다', W.ls('null_scene_pend'), { minhyun: 'confession' });
        eq('장부가 남아 이어서 할 수 있다', (W.ls('null_batch') || []).length, 1);
        const V = boot(W.dump(), rep);          // ← 고치고 다시 켠다
        await V.tick(9000);
        eq('이어서 돌리면 표가 찍히고 장면이 소모된다',
          [V.ls('null_eff_done'), V.ls('null_scene_pend'), (V.ls('null_batch') || []).length],
          [['eB'], {}, 0]);
        /* 이어서 도는 동안 모델은 한 번도 안 부른다 — 답은 이미 장부에 있다 */
        eq('복구는 API를 한 번도 안 부른다', V.sent.length, 0);
        eq('중요 장면이 다시 발동하지 않는다', V.app.store.msgs.minhyun.filter(m => m.text === 'ㄱ').length, 1);
      }

      /* ⑤ 말풍선은 끝났는데 뒤가 남은 batch — 입력이 열리면 안 된다 */
      {
        const W = boot(seed(), rep, { failKeys: ['null_bag'] });
        W.app.send('minhyun', '있잖아');
        await W.tick(9000);
        eq('말풍선은 다 떴다', said(W), ['있잖아', 'ㄱ']);
        eq('그래도 남은 일이 있으면 잠겨 있다',
          [(W.ls('null_batch') || [])[0].items.length, W.app.busy.minhyun], [0, true]);
        const before = W.sent.length;
        W.app.send('minhyun', '끼어들기');
        await W.tick(0);
        eq('뒤가 남은 batch에서도 새 요청이 안 나간다', W.sent.length, before);
      }

      /* ⑥ 초대 답변 — 지문 저장 실패와 초대 저장 실패 양쪽 */
      {
        const IV = JSON.stringify([{ place: '옥상', char: 'minhyun' }]);
        const A = boot({ null_name: '윤하', null_invite: IV }, () => ({ messages: [{ text: '네' }] }),
          { failKeys: ['null_store_v1'] });
        A.app.answerInvite(true); await A.tick(2000);
        eq('답 지문이 안 남으면 초대도 줄에 남는다',
          [(A.ls('null_invite') || []).map(x => x.place), A.sent.length], [['옥상'], 0]);
        eq('간 것으로 찍히지도 않는다', [A.ls('null_met'), A.ls('null_goneday')], [undefined, undefined]);
        const TWO = JSON.stringify([{ place: '옥상', char: 'minhyun' },
          { place: '편의점', char: 'jaeeon' }]);
        const B = boot({ null_name: '윤하', null_invite: TWO }, () => ({ messages: [{ text: '네' }] }),
          { failKeys: ['null_invite'] });
        B.app.answerInvite(true); await B.tick(2000);
        eq('초대를 못 빼면 요청도 안 나간다', B.sent.length, 0);
        eq('줄에 그대로 남아 다시 답할 수 있다',
          (B.ls('null_invite') || []).map(x => x.place), ['옥상', '편의점']);
        /* 고치고 이어서 — 답은 정확히 한 번 */
        const C = boot(B.dump(), () => ({ messages: [{ text: '네' }] }));
        C.app.retry('minhyun'); await C.tick(2000);
        eq('고친 뒤 답 지문이 한 번', said(C).filter(t => t.includes('옥상에 가기로 했다')).length, 1);
        eq('그때 앞엣것만 줄에서 빠진다',
          (C.ls('null_invite') || []).map(x => x.place), ['편의점']);
      }

      /* ⑦ 여덟 local 경로 — 메시지 저장이 실패하면 도장이 먼저 찍히면 안 된다 */
      {
        const rep2 = () => ({ messages: [{ text: '네' }] });
        const F = { failKeys: ['null_store_v1'] };
        const sc = { room: 'minhyun', place: '옥상', since: T0 - 60e3 };
        const cases = [
          ['자리 자동 종료', { null_scene: JSON.stringify({ ...sc, since: T0 - 3 * 3600e3 }) },
            W => {}],
          ['직접 나가기', { null_scene: JSON.stringify(sc) },
            W => { W.app.leaveScene(); W.render(); W.app.answerLeave(true) }],
          ['귀갓길', { null_scene: JSON.stringify(sc) },
            W => { W.app.startWay(sc); W.render(); W.app.answerWay(true) }],
          ['초대 수락', { null_invite: JSON.stringify([{ place: '옥상', char: 'minhyun' }]) },
            W => W.app.answerInvite(true)],
          ['초대 거절', { null_invite: JSON.stringify([{ place: '옥상', char: 'minhyun' }]) },
            W => W.app.answerInvite(false)],
          ['자리 이동', { null_scene: JSON.stringify(sc), null_met: JSON.stringify(['교실', '보건실', '옥상']) },
            W => { W.app.openAsk('체육관'); W.render(); W.app.answerMove(true) }],
          ['지도 방문', { null_met: JSON.stringify(['교실', '보건실', '옥상']) },
            W => { W.app.openAsk('체육관'); W.render(); W.app.answerAsk(true) }],
          ['선물', { null_scene: JSON.stringify(sc) },
            W => W.app.giveGift('minhyun', { key: 'mug', name: '회색 머그컵' }, '')],
          ['들고 가기', { null_met: JSON.stringify(['교실', '보건실', '옥상']) },
            W => W.app.giveGiftAt('minhyun', { key: 'mug', name: '회색 머그컵' }, '', '옥상')],
        ];
        const spoiled = [];
        for (const [label, extra, act] of cases) {
          const W = boot({ null_name: '윤하', ...extra }, rep2, F);
          act(W);
          await W.tick(2000);
          /* 메시지가 안 남았으면 도장·선물·자리·초대 어느 것도 소비되면 안 된다 */
          const dirty = ['null_goneday', 'null_giftday', 'null_gifts', 'null_met', 'null_way']
            .filter(k => JSON.stringify(W.ls(k)) !== JSON.stringify(
              extra[k] === undefined ? undefined : JSON.parse(extra[k])));
          const sceneGone = extra.null_scene && W.ls('null_scene') === undefined;
          const inviteGone = extra.null_invite && W.ls('null_invite') === undefined;
          if (dirty.length || sceneGone || inviteGone || W.sent.length)
            spoiled.push([label, dirty, !!sceneGone, !!inviteGone, W.sent.length]);
        }
        eq('메시지가 안 남으면 어떤 상태도 먼저 소비되지 않는다', spoiled, []);
      }

      /* ⑧ 저장 실패를 걷고 이어서 돌린 최종 상태가 무실패 실행과 같다 */
      {
        const run = async fail => {
          const W = boot({ null_name: '윤하', null_met: JSON.stringify(['교실', '보건실', '옥상']) },
            () => ({ messages: [{ text: '네' }] }), fail ? { failKeys: [fail] } : undefined);
          W.app.giveGiftAt('minhyun', { key: 'mug', name: '회색 머그컵' }, '', '옥상');
          await W.tick(3000);
          if (!fail) return W;
          const V = boot(W.dump(), () => ({ messages: [{ text: '네' }] }));   // 실패를 걷고 이어서
          await V.tick(3000);
          return V;
        };
        const clean = await run(null);
        const keys = ['null_store_v1', 'null_gifts', 'null_goneday', 'null_giftday',
          'null_met', 'null_auto_q', 'null_batch', 'null_scene'];
        const shot = W => keys.map(k => {
          const v = W.ls(k);
          /* 자리에 깔리는 얼굴은 여럿 중에 무작위로 뽑는다(sceneShot). 판마다
             다른 게 설계다 — 이 시험이 잴 것은 「실패를 걷고 이어서 돌린 끝이
             같은가」지 「같은 얼굴이 뽑혔는가」가 아니다. 그 한 칸만 뺀다.
             한 판 안에서 얼굴이 두 번 안 바뀌는 것은 swapShot의 sc.shot 자물쇠가
             지키고, 그건 바로 아래에서 따로 잰다. */
          if (k === 'null_scene') {
            const o = v && typeof v === 'object' ? { ...v } : v;
            if (o && typeof o === 'object') delete o.shot;
            return [k, JSON.stringify(o)];
          }
          if (k !== 'null_store_v1') return [k, JSON.stringify(v)];
          /* ts·id는 실행마다 다르다. 그리고 이어서 돌린 쪽은 모델을 다시
             안 부르므로(그게 계약이다) 인물의 답은 빼고 지문만 견준다 */
          const ms = (v && v.msgs && v.msgs.minhyun) || [];
          return [k, JSON.stringify(ms.filter(m => m.sys).map(m => m.text))];
        });
        const base = shot(clean);
        const diffs = [];
        for (const f of ['null_store_v1', 'null_gifts', 'null_goneday']) {
          const W = await run(f);
          shot(W).forEach(([k, v], i) => { if (v !== base[i][1]) diffs.push([f, k, v, base[i][1]]) });
        }
        eq('실패를 걷고 이어서 돌린 끝이 무실패와 같다', diffs, []);
        /* 한 판 안에서는 얼굴이 한 번만 뽑힌다 — 열 번 주고받는 동안 얼굴이
           계속 바뀌면 어지럽다. 이미 뽑혔으면 다시 안 뽑는 자물쇠가 그걸 지킨다 */
        eq('한 자리에서 얼굴은 한 번만 뽑는다',
          /if\(!sc\|\|sc\.room!==room\|\|sc\.shot\)return;/
            .test(readFileSync(join(ROOT, 'app.js'), 'utf8')), true);
      }
    }

    /* ══════ 장애가 난 뒤 실제로 복구되는가 ══════
       장부 구조가 맞아도 배선이 빠지면 유저는 못 빠져나온다. 말풍선 저장·
       장부에서 빼기·마지막 지우기를 각각 실패시키고, 화면의 재시도 단추를
       실제로 눌러서 끝까지 가는지 본다. */
    {
      /* n번째 저장만 실패시킨다 — 첫 쓰기는 되고 도중에 무너지는 자리 */
      const nth = (key, n) => { let i = 0; return { failKeys: [], failNth: { key, n: () => ++i === n } } };

      /* ① 말풍선 저장 실패 — 이름표를 잃으면 재시도가 아무것도 못 한다 */
      {
        const rep = () => ({ messages: [{ text: 'ㄱ' }, { text: 'ㄴ' }] });
        const W = boot({ null_name: '윤하' }, rep, nth('null_store_v1', 2));
        W.app.send('minhyun', '안녕');       // 1번째 쓰기 = 유저 말
        await W.tick(9000);                  // 2번째 쓰기 = 'ㄱ' → 실패
        const f = W.app.failed.minhyun;
        eq('말풍선 저장이 실패해도 이름표가 남는다',
          [!!f, !!(f && f.batch)], [true, true]);
        eq('그 batch가 실제로 장부에 있다',
          (W.ls('null_batch') || []).some(b => b.id === f.batch), true);
        const before = W.sent.length;
        W.app.retry('minhyun');
        await W.tick(9000);
        eq('재시도가 남은 것을 이어서 푼다', said(W), ['안녕', 'ㄱ', 'ㄴ']);
        eq('그 재시도는 API를 다시 안 부른다', W.sent.length, before);
        eq('끝나면 장부도 잠금도 없다',
          [(W.ls('null_batch') || []).length, !!W.app.failed.minhyun, !!W.app.busy.minhyun],
          [0, false, false]);
      }

      /* ② 장부에서 빼기 실패 — 조용히 삼키면 그 방이 영영 잠긴다 */
      {
        const rep = () => ({ messages: [{ text: 'ㄱ' }, { text: 'ㄴ' }] });
        const W = boot({ null_name: '윤하' }, rep, nth('null_batch', 2));
        W.app.send('minhyun', '안녕');       // 1번째 = 장부 쓰기
        await W.tick(9000);                  // 2번째 = 첫 말풍선 빼기 → 실패
        eq('빼기 실패도 이름표로 올라온다',
          !!(W.app.failed.minhyun && W.app.failed.minhyun.batch), true);
        const before = W.sent.length;
        W.app.retry('minhyun'); await W.tick(9000);
        eq('이어서 풀면 말이 두 번 안 붙는다', said(W), ['안녕', 'ㄱ', 'ㄴ']);
        eq('빼기 실패 복구도 API를 안 부른다', W.sent.length, before);
        eq('끝나면 풀린다',
          [(W.ls('null_batch') || []).length, !!W.app.busy.minhyun], [0, false]);
      }

      /* ③ 마지막 dropBatch 실패 — 다 했는데 장부가 안 지워지는 자리 */
      {
        const rep = () => ({ messages: [{ text: 'ㄱ' }] });
        const W = boot({ null_name: '윤하' }, rep, nth('null_batch', 3));
        W.app.send('minhyun', '안녕');       // 1=장부 쓰기 2=말풍선 빼기 3=마지막 지우기
        await W.tick(9000);
        eq('마지막 지우기 실패도 삼키지 않는다',
          !!(W.app.failed.minhyun && W.app.failed.minhyun.batch), true);
        W.app.retry('minhyun'); await W.tick(9000);
        eq('이어서 하면 장부가 지워지고 방이 열린다',
          [(W.ls('null_batch') || []).length, !!W.app.busy.minhyun, said(W)],
          [0, false, ['안녕', 'ㄱ']]);
      }

      /* ④ 화면의 단추를 실제로 누른다 — 잠긴 방에서도 보여야 한다 */
      {
        const rep = () => ({ messages: [{ text: 'ㄱ' }] });
        const W = boot({ null_name: '윤하' }, rep, nth('null_batch', 3));
        W.app.send('minhyun', '안녕');
        await W.tick(9000);
        /* 방 화면이 실제로 그리는 조건 그대로 — busy여도 failed가 이긴다 */
        const shows = (busy, failed) => [!!(busy && !failed), !!failed];
        eq('잠긴 방에서도 단추가 보인다',
          shows(W.app.busy.minhyun, W.app.failed.minhyun), [false, true]);
        eq('타이핑과 단추를 같이 안 띄운다',
          /\{busy&&!failed&&<div className="mrow"/.test(ui)
          && /\{failed&&<button className="retry"/.test(ui), true);
        eq('자리 화면도 같다',
          /\{busy&&!failed&&<div className="sline">/.test(ui)
          && (ui.match(/\{failed&&<button className="retry"/g) || []).length === 2, true);
        /* 그 자리에서 누른다 */
        W.app.retry('minhyun'); await W.tick(9000);
        eq('눌러서 빠져나온다',
          [(W.ls('null_batch') || []).length, !!W.app.failed.minhyun, !!W.app.busy.minhyun],
          [0, false, false]);
      }

      /* ⑤ local batch 복구는 캐릭터 답까지 이어간다 ──
         선물·초대·자리 이동은 아직 모델을 부르기 전이다. 상태와 지문만
         살아나고 답장이 영영 안 오면, 선물은 가방에 들어갔는데 상대는
         아무 말도 안 하는 판이 된다. */
      {
        const rep = () => ({ messages: [{ text: '고마워요' }] });
        const W = boot({ null_name: '윤하', null_met: JSON.stringify(['교실', '보건실', '옥상']) },
          rep, nth('null_store_v1', 1));      // 첫 지문 저장부터 실패
        W.app.giveGiftAt('minhyun', { key: 'mug', name: '회색 머그컵' }, '', '옥상');
        await W.tick(9000);
        eq('지문이 안 남으면 요청도 안 나간다', W.sent.length, 0);
        eq('이어갈 요청이 장부에 적혀 있다',
          (W.ls('null_batch') || []).map(b => b.after_request && b.after_request.extra.place), ['옥상']);
        /* 새로고침해도 이어갈 요청이 남아 있다 — closure가 아니라 장부다 */
        const V = boot(W.dump(), rep);
        await V.tick(9000);
        eq('복구하면 캐릭터 답을 정확히 한 번 이어간다',
          [V.sent.length, said(V).filter(t => t === '고마워요').length], [1, 1]);
        eq('그 요청에 자리와 선물이 실려 있다',
          [V.sent[0].place, V.sent[0].gift.key], ['옥상', 'mug']);
        /* history·counts는 장부를 쓸 때가 아니라 보낼 때의 세계로 조립된다 */
        eq('최신 상태로 다시 조립한다',
          [V.sent[0].counts.minhyun, (V.sent[0].history || []).length], [2, 2]);
        eq('끝나면 아무것도 안 남는다',
          [(V.ls('null_batch') || []).length, !!V.app.failed.minhyun, !!V.app.busy.minhyun],
          [0, false, false]);
      }

      /* ⑥ 모델 답을 이미 받은 batch의 복구는 API 0회 */
      {
        const rep = () => ({ messages: [{ text: 'ㄱ' }] });
        const W = boot({ null_name: '윤하' }, rep, nth('null_batch', 2));
        W.app.send('minhyun', '안녕');
        await W.tick(9000);
        const V = boot(W.dump(), rep);        // ← 새로고침으로 이어간다
        await V.tick(9000);
        eq('받은 답의 복구는 모델을 안 부른다', V.sent.length, 0);
        eq('그래도 끝까지 간다',
          [said(V), (V.ls('null_batch') || []).length, !!V.app.busy.minhyun],
          [['안녕', 'ㄱ'], 0, false]);
      }

      /* ⑦ 여덟 경로 전부 — 복구 뒤 답장이 정확히 한 번 */
      {
        const rep = () => ({ messages: [{ text: '네' }] });
        const sc = { room: 'minhyun', place: '옥상', since: T0 - 60e3 };
        const MET = JSON.stringify(['교실', '보건실', '옥상']);
        const cases = [
          ['자리 자동 종료', { null_scene: JSON.stringify({ ...sc, since: T0 - 3 * 3600e3 }) }, W => {}],
          ['직접 나가기', { null_scene: JSON.stringify(sc) },
            W => { W.app.leaveScene(); W.render(); W.app.answerLeave(true) }],
          ['귀갓길', { null_scene: JSON.stringify(sc) },
            W => { W.app.startWay(sc); W.render(); W.app.answerWay(true) }],
          ['초대 수락', { null_invite: JSON.stringify([{ place: '옥상', char: 'minhyun' }]) },
            W => W.app.answerInvite(true)],
          ['초대 거절', { null_invite: JSON.stringify([{ place: '옥상', char: 'minhyun' }]) },
            W => W.app.answerInvite(false)],
          ['자리 이동', { null_scene: JSON.stringify(sc), null_met: MET },
            W => { W.app.openAsk('체육관'); W.render(); W.app.answerMove(true) }],
          ['지도 방문', { null_met: MET },
            W => { W.app.openAsk('체육관'); W.render(); W.app.answerAsk(true) }],
          ['선물', { null_scene: JSON.stringify(sc) },
            W => W.app.giveGift('minhyun', { key: 'mug', name: '회색 머그컵' }, '')],
          ['들고 가기', { null_met: MET },
            W => W.app.giveGiftAt('minhyun', { key: 'mug', name: '회색 머그컵' }, '', '옥상')],
        ];
        const bad = [];
        for (const [label, extra, act] of cases) {
          const W = boot({ null_name: '윤하', ...extra }, rep, nth('null_store_v1', 1));
          act(W); await W.tick(9000);
          const V = boot(W.dump(), rep);       // 복구
          await V.tick(9000);
          const said1 = (V.app.store.msgs.minhyun || []).filter(m => m.text === '네').length;
          const left = (V.ls('null_batch') || []).length;
          /* 자리 만료처럼 스스로 다시 도는 길은 W에서 이미 이어질 수 있다 —
             둘을 합쳐 정확히 한 번이면 된다 */
          const calls = W.sent.length + V.sent.length;
          if (calls !== 1 || said1 !== 1 || left || V.app.failed.minhyun || V.app.busy.minhyun)
            bad.push([label, calls, said1, left, !!V.app.failed.minhyun, !!V.app.busy.minhyun]);
        }
        eq('여덟 경로 모두 복구 뒤 답장이 정확히 한 번', bad, []);
      }
    }

    /* ══════ 관전 사건은 대화가 남은 뒤에만 소모된다 ══════
       전에는 ackAutoEvent가 먼저였다. 저장이 실패하면 유저가 준 선물이
       없던 일이 된다. */
    {
      const ev = { id: 'gift|minhyun|머그컵', kind: 'gift', to: 'minhyun',
        name: '머그컵', created_at: T0 - 2 * 3600e3 };
      const seed = () => ({ null_name: '윤하', null_view: 'health',
        null_auto_q: JSON.stringify([ev]),
        null_auto_at: String(T0 - 2 * 3600e3),
        null_store_v1: JSON.stringify({ msgs: { health: [
          { id: 1, sender: 'minhyun', text: 'ㅇㅇ', ts: T0 - 2 * 3600e3 }] }, unread: {} }) });
      const rep = () => ({ messages: [{ sender: 'minhyun', text: '삼촌 그거 어디서 났어요' }] });
      const W = boot(seed(), rep);
      W.app.openRoom('health');
      await W.tick(2000);
      eq('관전이 성공하면 사건이 소모된다',
        [(W.ls('null_auto_q') || []).length, said(W, 'health').length], [0, 2]);
      /* 저장이 실패하면 사건은 줄에 그대로 남아 다음에 다시 시도된다 */
      const V = boot(seed(), rep, { failKeys: ['null_store_v1'] });
      V.app.openRoom('health');
      await V.tick(2000);
      eq('저장이 실패하면 사건이 안 소모된다',
        (V.ls('null_auto_q') || []).map(x => x.kind), ['gift']);
    }

    /* ══════ 이야기 상태 — E-B의 클라이언트 절반 ══════
       전환은 워커가 내고, 적용은 장부가 한다. 다른 Effect와 같은 규칙이다:
       저장이 남은 뒤에만 표를 찍고, 되풀이해도 결과가 같다. */
    {
      const TR = { id: 'r|story_transition|jaeeonMemory|opened', type: 'story_transition',
        key: 'jaeeonMemory', from: 'hidden', to: 'opened' };
      const rep = () => ({ messages: [{ text: '…그때 그 공부방.' }], effects: [TR] });

      /* 요청이 상태를 실어 나른다 — 워커는 아무것도 기억하지 않는다 */
      {
        const W = boot({ null_name: '윤하' }, rep);
        W.app.send('jaeeon', '저 어디서 본 적 있지 않아요?');
        await W.tick(0);
        eq('요청에 이야기 상태가 실린다', W.sent[0].story,
          { firstContact: 'unseen', jaeeonMemory: 'hidden',
            partnerKnown: { jaeeon: false, minhyun: false },
            schoolMet: { jaeeon: false, minhyun: false } });
        eq('출처 문답 단계도 실린다', W.sent[0].origin_phase, 'unasked');
        await W.tick(5000);
        eq('전환이 장부를 거쳐 적용된다', W.ls('null_story').jaeeonMemory, 'opened');
        eq('표도 찍혔다', W.ls('null_eff_done'), [TR.id]);
        /* 다음 요청은 움직인 상태를 나른다 */
        W.app.send('jaeeon', '더 얘기해줘요');
        await W.tick(0);
        eq('다음 요청이 새 상태를 나른다',
          W.sent[W.sent.length - 1].story.jaeeonMemory, 'opened');
      }
      /* 첫 말풍선 전에 꺼도 전환은 안 사라진다 — 장부가 들고 있다 */
      {
        const W = boot({ null_name: '윤하' }, rep);
        W.app.send('jaeeon', '저 아세요?');
        await W.tick(0);                      // 답은 왔고 아무것도 안 바뀌었다
        eq('그 시점엔 아직 hidden이다', [W.ls('null_story'), W.ls('null_eff_done')], [undefined, undefined]);
        const V = boot(W.dump(), rep);        // ← 새로고침
        await V.tick(5000);
        eq('껐다 켜도 전환이 정확히 한 번 적용된다',
          [V.ls('null_story').jaeeonMemory, V.ls('null_eff_done')], ['opened', [TR.id]]);
      }
      /* 상태 저장이 실패하면 표를 안 찍는다 — 다음에 마저 간다 */
      {
        const W = boot({ null_name: '윤하' }, rep, { failKeys: ['null_story'] });
        W.app.send('jaeeon', '저 아세요?');
        await W.tick(5000);
        eq('상태가 안 남으면 표도 없다',
          [W.ls('null_story'), W.ls('null_eff_done')], [undefined, undefined]);
        eq('장부가 남아 이어서 할 수 있다', (W.ls('null_batch') || []).length, 1);
        const V = boot(W.dump(), rep);        // ← 고치고 이어서
        await V.tick(5000);
        eq('고치면 상태와 표가 정확히 한 번',
          [V.ls('null_story').jaeeonMemory, V.ls('null_eff_done'), (V.ls('null_batch') || []).length],
          ['opened', [TR.id], 0]);
      }
      /* 이미 지나 있으면 한 것으로 친다 — 두 번 적용해도 같다 */
      {
        const W = boot({ null_name: '윤하',
          null_story: JSON.stringify({ jaeeonMemory: 'acknowledged' }) }, rep);
        W.app.send('jaeeon', '저 아세요?');
        await W.tick(5000);
        eq('뒤로 안 돌아간다', W.ls('null_story').jaeeonMemory, 'acknowledged');
        eq('그래도 표는 찍힌다 — 같은 id가 다시 안 온다', W.ls('null_eff_done'), [TR.id]);
      }
      /* WHO 장면이 실제로 성공해야 「안다」가 뒤집힌다 */
      {
        const rep2 = () => ({ messages: [{ text: '…알아요.' }], scene_ack: 'partner_known' });
        const seed = { null_name: '윤하', null_partner: 'jaeeon',
          null_scene_pend: JSON.stringify({ minhyun: 'partner_known' }) };
        const W = boot(seed, rep2);
        W.app.send('minhyun', '있잖아');
        await W.tick(0);
        eq('답이 오기만 해서는 안 뒤집힌다', W.ls('null_story'), undefined);
        await W.tick(5000);
        eq('답이 남은 뒤에 안다가 된다',
          [W.ls('null_story').partnerKnown.minhyun, W.ls('null_scene_pend')], [true, {}]);
        /* 선택된 본인의 장면(partner_confirm)도 「안다」가 된다 — 안 그러면
           아크가 끝난 뒤에도 정작 선택된 사람이 모르는 상태로 남는다 */
        const rep3 = () => ({ messages: [{ text: '…그래.' }], scene_ack: 'partner_confirm' });
        const U = boot({ null_name: '윤하', null_partner: 'jaeeon',
          null_scene_pend: JSON.stringify({ jaeeon: 'partner_confirm' }) }, rep3);
        U.app.send('jaeeon', '당신이에요');
        await U.tick(5000);
        eq('정해진 본인도 아는 상태가 된다',
          [U.ls('null_story').partnerKnown.jaeeon, U.ls('null_scene_pend')], [true, {}]);
        /* 거절된 장면(scene_ack 없음)은 안 뒤집는다 */
        const V = boot(seed, () => ({ messages: [{ text: '네.' }] }));
        V.app.send('minhyun', '있잖아');
        await V.tick(5000);
        eq('거절되면 예약도 상태도 남는다',
          [V.ls('null_story'), V.ls('null_scene_pend')], [undefined, { minhyun: 'partner_known' }]);
      }
    }

    /* ══════════ 관전 사건 — 대사와 송장이 같은 장부로 간다 (§8.5) ══════════
       전에는 응답에서 data.messages만 꺼내고 data.effects를 버렸다 —
       서버가 만든 택배에서 대사만 꺼내고 송장(공개 Effect)을 버리는 짓이라
       null_disclosed가 영영 안 갱신됐다. 여기는 실제 app.js를 굴려 잰다. */
    {
      /* created_at을 최근으로 둔다 — 한 시간 전으로 두면 배경 관전 효과
         (자리 비움)가 같은 사건을 제 길로도 집어 fetch가 두 번 된다.
         여기서 재는 것은 runAutoEvent 한 번의 장부이지 발화 조건이 아니다. */
      const EV = { id: 'gift|jaeeon|회색 머그컵', kind: 'gift', to: 'jaeeon',
        name: '회색 머그컵', created_at: T0 - 1000, status: 'pending' };
      const DEFF = { id: 'r1|disclosure|jaeeon|gift.mug.user_to_jaeeon', type: 'disclosure',
        fact_id: 'gift.mug.user_to_jaeeon', by: 'jaeeon',
        heard_by: ['jaeeon', 'minhyun'], room: 'health', at: T0 };
      const rep = () => ({
        messages: [{ sender: 'minhyun', text: '그 회색 머그컵 어디서 났어요?' },
                   { sender: 'jaeeon', text: '선생님이 준 거야.' }],
        effects: [DEFF] });
      const seedQ = { null_name: '연', null_gifts: JSON.stringify({ jaeeon: ['mug'] }),
        null_auto_q: JSON.stringify([EV]) };

      /* ── ① 성공 — 대사·공개·표·사건 소모가 전부 한 번에 ── */
      {
        const W = boot(seedQ, rep);
        await W.app.runAutoEvent(EV, T0 - 1000);
        await W.tick(60000);
        eq('관전 대사가 저장된다',
          (W.app.store.msgs.health || []).map(m => m.text),
          ['그 회색 머그컵 어디서 났어요?', '선생님이 준 거야.']);
        eq('공개 장부가 같은 장부에서 갱신된다',
          W.ls('null_disclosed'), { 'gift.mug.user_to_jaeeon': ['jaeeon', 'minhyun'] });
        eq('effect 표가 찍힌다', (W.ls('null_eff_done') || []).includes(DEFF.id), true);
        eq('사건은 마지막에 소모된다', W.ls('null_auto_q'), []);
        eq('장부가 비워졌다', W.ls('null_batch') || [], []);
        eq('fetch는 한 번이다', W.sent.length, 1);
        eq('관전 요청에 공개 장부가 실린다',
          [W.sent[0].mode, 'disclosed' in W.sent[0]], ['auto', true]);
      }

      /* ── ② 공개 저장이 실패하면 — 사건이 남고, 재개는 API를 안 부른다 ── */
      {
        const W = boot(seedQ, rep, { failKeys: ['null_disclosed'] });
        await W.app.runAutoEvent(EV, T0 - 1000);
        await W.tick(60000);
        eq('실패하면 사건이 남는다', (W.ls('null_auto_q') || []).length, 1);
        eq('실패하면 장부도 남는다', (W.ls('null_batch') || []).length, 1);
        eq('공개는 반영되지 않았다', W.ls('null_disclosed') || {}, {});
        /* 같은 저장소로 다시 켠다 — 이게 새로고침이다. 남은 장부로만 잇는다 */
        const W2 = boot(JSON.parse(JSON.stringify(W.dump())), rep);
        await W2.tick(60000);
        eq('재개는 API를 안 부른다', W2.sent.length, 0);
        eq('재개가 남은 것을 마저 한다',
          [W2.ls('null_disclosed'), W2.ls('null_auto_q'), (W2.ls('null_batch') || []).length],
          [{ 'gift.mug.user_to_jaeeon': ['jaeeon', 'minhyun'] }, [], 0]);
        eq('말풍선이 두 번 안 붙는다', (W2.app.store.msgs.health || []).length, 2);
      }

      /* ── ③ 회피 응답 — 공개 Effect가 없으면 장부도 그대로다 ── */
      {
        const avoid = () => ({ messages: [{ sender: 'minhyun', text: '그 회색 머그컵 어디서 났어요?' },
          { sender: 'jaeeon', text: '그건 왜.' }], effects: [] });
        const W = boot(seedQ, avoid);
        await W.app.runAutoEvent(EV, T0 - 1000);
        await W.tick(60000);
        eq('회피면 공개 장부가 안 변한다', W.ls('null_disclosed') || {}, {});
        eq('회피여도 발견 장면은 한 번 소모된다 — 무한 반복하지 않는다',
          W.ls('null_auto_q'), []);
      }

      /* ── ④ 말풍선 저장이 실패하면 공개까지 못 간다 ──
         순서 계약: 말풍선 → Effect(공개) → 사건. 대사가 안 남았는데
         「아는 사람」이 되는 길이 없어야 한다. */
      {
        const W = boot(seedQ, rep, { failKeys: ['null_store_v1'] });
        await W.app.runAutoEvent(EV, T0 - 1000);
        await W.tick(60000);
        eq('대화가 안 남으면 공개도 없다',
          [W.ls('null_disclosed') || {}, (W.ls('null_eff_done') || []).length], [{}, 0]);
        eq('대화가 안 남으면 사건도 안 지운다', (W.ls('null_auto_q') || []).length, 1);
        eq('장부는 남는다', (W.ls('null_batch') || []).length, 1);
        /* 고치고 다시 켠다 — 저장된 장부로만 잇는다 */
        const V = boot(JSON.parse(JSON.stringify(W.dump())), rep);
        await V.tick(60000);
        eq('재개가 API를 안 부른다', V.sent.length, 0);
        eq('재개가 남은 것을 정확히 한 번 한다',
          [(V.app.store.msgs.health || []).length, V.ls('null_disclosed'),
           V.ls('null_auto_q'), (V.ls('null_batch') || []).length],
          [2, { 'gift.mug.user_to_jaeeon': ['jaeeon', 'minhyun'] }, [], 0]);
      }

      /* ── ⑤ 장부가 남아 있으면 그 방은 잠긴다 — 새 관전을 안 부른다 ── */
      {
        const W = boot(seedQ, rep, { failKeys: ['null_disclosed'] });
        await W.app.runAutoEvent(EV, T0 - 1000);
        await W.tick(60000);
        eq('막힌 뒤에도 장부가 남아 있다', (W.ls('null_batch') || []).length, 1);
        const before = W.sent.length;
        /* 관전방을 열어 배경 효과를 여러 번 돌린다 — 잠겼으면 호출이 없다 */
        W.app.openRoom('health');
        await W.tick(60000);
        await W.tick(60000);
        eq('잠긴 방에서는 모델을 다시 안 부른다', W.sent.length, before);
      }

      /* ── ⑥ 방별 FIFO — 앞 덩어리가 끝나기 전에 뒤가 먼저 적용되지 않는다 ──
         전에는 부팅에서 전부 resume했다. 말풍선이 있는 앞 덩어리는 큐로
         넘어가고, 말풍선이 없는 뒤 덩어리는 그 자리에서 끝나버렸다. */
      {
        const W = boot({ null_name: '연' }, rep);
        /* 같은 방에 둘을 적는다: 앞은 말풍선(재생 큐), 뒤는 해금(즉시) */
        W.app.enqueue('health', [{ sender: 'minhyun', text: 'ㄱ' }, { sender: 'jaeeon', text: 'ㄴ' }]);
        W.app.localBatch('unlock|x', 'health', { unlocked: ['hidden-jaeeon-diary-200x-03-07'] });
        eq('뒤엣것은 아직 안 풀렸다', (W.ls('null_unlocked') || []).length, 0);
        eq('둘 다 장부에 남아 있다', (W.ls('null_batch') || []).length, 2);
        await W.tick(60000);
        eq('앞이 끝나면 뒤가 이어진다',
          [(W.app.store.msgs.health || []).length, (W.ls('null_unlocked') || []).length,
           (W.ls('null_batch') || []).length], [2, 1, 0]);
      }

      /* ── ⑦ 방이 다르면 서로 안 막는다 ── */
      {
        const W = boot({ null_name: '연' }, rep);
        W.app.enqueue('health', [{ sender: 'minhyun', text: 'ㄱ' }]);
        W.app.localBatch('unlock|y', 'jaeeon', { unlocked: ['hidden-jaeeon-diary-200x-03-07'] });
        eq('다른 방 것은 그 자리에서 끝난다', (W.ls('null_unlocked') || []).length, 1);
        await W.tick(60000);
        eq('둘 다 끝난다',
          [(W.app.store.msgs.health || []).length, (W.ls('null_batch') || []).length], [1, 0]);
      }
    }

    /* ══════════ 앱 관전 장부 엔진 — runAutoBatch (웹·앱 공용) ══════════
       Expo가 rules.ts로 받는 엔진을 여기서 어댑터 주입으로 직접 굴린다.
       순서·멱등·실패 정지가 코드로 강제되는지를 실행으로 잰다. */
    {
      const AB = new Function(
        'const localStorage={_v:{},getItem(k){return this._v[k]||null},setItem(k,v){this._v[k]=v},removeItem(k){delete this._v[k]}};'
        + dataSrc + '\nreturn runAutoBatch;')();
      const mk = opts => {
        const S = { msgs: [], fx: [], q: ['ev1'], batch: true, log: [] };
        const A = {
          saveMsg: async m => { S.log.push('msg:' + m.id);
            if (opts && opts.failMsg === m.id) return false;
            if (!S.msgs.includes(m.id)) S.msgs.push(m.id); return true; },
          applyEffect: async e => { S.log.push('fx:' + e.id);
            if (opts && opts.failFx) return false;
            if (!S.fx.includes(e.id)) S.fx.push(e.id); return true; },
          ackEvent: async id => { S.log.push('ack:' + id);
            S.q = S.q.filter(x => x !== id); return true; },
          dropBatch: async () => { S.log.push('drop'); S.batch = false; return true; },
        };
        return { S, A };
      };
      const B = { id: 'auto|ev1',
        messages: [{ id: 'a#0', text: 'ㄱ' }, { id: 'a#1', text: 'ㄴ' }],
        effects: [{ id: 'e1', type: 'disclosure' }], event_id: 'ev1' };

      /* 순서: 말풍선 → Effect → 사건 → 장부 */
      const ok = mk();
      eq('엔진 순서가 계약대로다', [await AB(B, ok.A), ok.S.log],
        [true, ['msg:a#0', 'msg:a#1', 'fx:e1', 'ack:ev1', 'drop']]);
      /* 대화 저장 실패 → 공개 미반영·사건 미소모 (SQLite 쓰기 실패와 같다) */
      const f1 = mk({ failMsg: 'a#1' });
      eq('대화가 실패하면 공개로 못 간다', [await AB(B, f1.A), f1.S.fx, f1.S.q, f1.S.batch],
        [false, [], ['ev1'], true]);
      /* 공개 저장 실패 → 사건 미소모 */
      const f2 = mk({ failFx: true });
      eq('공개가 실패하면 사건을 안 지운다', [await AB(B, f2.A), f2.S.q, f2.S.batch],
        [false, ['ev1'], true]);
      /* 재개 — 멱등 어댑터로 다시 돌리면 무실패 실행과 같은 끝 상태다 */
      const f3 = mk({ failFx: true });
      await AB(B, f3.A);                       // 중간에 멈춘다
      const again = mk(); again.S.msgs = f3.S.msgs; again.S.q = f3.S.q;
      eq('재개가 무실패 실행과 같은 상태로 끝난다',
        [await AB(B, again.A), again.S.msgs, again.S.fx, again.S.q, again.S.batch],
        [true, ['a#0', 'a#1'], ['e1'], [], false]);
      /* 이 엔진은 API를 모른다 — 재호출이 원리적으로 없다 */
      eq('엔진에 fetch가 없다', (() => {
        const i = dataSrc.indexOf('const runAutoBatch');
        return /fetch|XMLHttpRequest/.test(dataSrc.slice(i, dataSrc.indexOf('const loadDisclosed', i)));
      })(), false);

      /* ── 장부는 하나가 아니라 줄이다 (앱 쪽 FIFO) ──
         값 하나로 두면 앞엣것이 실패로 남아 있을 때 새 관전이 덮는다:
         아직 못 붙인 말풍선과 안 적힌 공개가 통째로 사라진다. */
      {
        const Q = new Function(
          'const localStorage={_v:{},getItem(k){return this._v[k]||null},setItem(k,v){this._v[k]=v},removeItem(k){delete this._v[k]}};'
          + dataSrc + '\nreturn {readAutoQueue,pushAutoBatch,runAutoQueue};')();
        eq('깨진 값에도 안 죽는다',
          [Q.readAutoQueue(''), Q.readAutoQueue('{{'), Q.readAutoQueue('null'), Q.readAutoQueue('[1,2]')],
          [[], [], [], []]);
        eq('옛 단일 장부도 줄로 읽는다',
          Q.readAutoQueue(JSON.stringify({ id: 'auto|a', messages: [] })).map(b => b.id), ['auto|a']);
        eq('같은 id는 두 번 안 들어간다', (() => {
          const one = Q.pushAutoBatch([], { id: 'auto|a' });
          return Q.pushAutoBatch(one, { id: 'auto|a' }).length;
        })(), 1);
        eq('id 없는 것은 안 들어간다', Q.pushAutoBatch([], { messages: [] }).length, 0);

        /* 줄을 순서대로 푼다. 실패하면 그 자리에서 멈추고 남은 줄을 준다 */
        const mkQ = opts => {
          const S = { msgs: [], fx: [], q: ['e1', 'e2'], left: null, log: [] };
          const A = {
            saveMsg: async m => { S.log.push('msg:' + m.id);
              if (opts && opts.failMsg === m.id) return false;
              if (!S.msgs.includes(m.id)) S.msgs.push(m.id); return true; },
            applyEffect: async e => { S.log.push('fx:' + e.id);
              if (opts && opts.failFx === e.id) return false;
              if (!S.fx.includes(e.id)) S.fx.push(e.id); return true; },
            ackEvent: async id => { S.log.push('ack:' + id); S.q = S.q.filter(x => x !== id); return true; },
            /* 줄에서 그 항목만 뺀다 — 앱 어댑터와 같은 계약이다 */
            dropBatch: async b => { S.log.push('drop:' + (b && b.id)); return true; },
          };
          return { S, A };
        };
        const B1 = { id: 'auto|e1', room: 'health', messages: [{ id: 'x#0' }],
          effects: [{ id: 'f1' }], event_id: 'e1' };
        const B2 = { id: 'auto|e2', room: 'health', messages: [{ id: 'y#0' }],
          effects: [{ id: 'f2' }], event_id: 'e2' };
        {
          const t = mkQ();
          eq('줄을 순서대로 푼다', [await Q.runAutoQueue([B1, B2], t.A), t.S.log],
            [[], ['msg:x#0', 'fx:f1', 'ack:e1', 'drop:auto|e1',
                  'msg:y#0', 'fx:f2', 'ack:e2', 'drop:auto|e2']]);
        }
        {
          /* 앞엣것이 막히면 뒤엣것은 시작도 안 한다 */
          const t = mkQ({ failFx: 'f1' });
          const left = await Q.runAutoQueue([B1, B2], t.A);
          eq('앞이 막히면 뒤는 안 푼다',
            [left.map(b => b.id), t.S.msgs, t.S.fx, t.S.q],
            [['auto|e1', 'auto|e2'], ['x#0'], [], ['e1', 'e2']]);
          /* 고치고 다시 — 남은 줄만 정확히 한 번 더 */
          const u = mkQ(); u.S.msgs = t.S.msgs.slice(); u.S.q = t.S.q.slice();
          eq('고치면 남은 줄이 이어진다',
            [await Q.runAutoQueue(left, u.A), u.S.msgs, u.S.fx, u.S.q],
            [[], ['x#0', 'y#0'], ['f1', 'f2'], []]);
        }
        {
          /* 대화가 안 남으면 그 덩어리의 공개·사건은 통째로 안 간다 */
          const t = mkQ({ failMsg: 'x#0' });
          eq('대화가 실패하면 공개·사건이 없다',
            [(await Q.runAutoQueue([B1, B2], t.A)).length, t.S.fx, t.S.q],
            [2, [], ['e1', 'e2']]);
        }
        /* ── 해금도 장부 안이다 ──
           밖에 두면 장부가 한 번 막혔다 풀릴 때 말풍선·공개는 복구되는데
           .hidden만 영영 안 열린다 — 기록에는 남았는데 열린 적이 없는 문. */
        {
          const R = new Function(
            'const localStorage={_v:{},getItem(k){return this._v[k]||null},setItem(k,v){this._v[k]=v},removeItem(k){delete this._v[k]}};'
            + dataSrc + '\nreturn runAutoBatch;')();
          const mkU = opts => {
            const S = { unlocked: null, acked: false, dropped: false, log: [] };
            return { S, A: {
              saveMsg: async () => { S.log.push('msg'); return true },
              applyEffect: async () => { S.log.push('fx'); return true },
              applyUnlocked: async ks => { S.log.push('unlock');
                if (opts && opts.failUnlock) return false;
                S.unlocked = ks; return true },
              ackEvent: async () => { S.log.push('ack'); S.acked = true; return true },
              dropBatch: async () => { S.log.push('drop'); S.dropped = true; return true },
            } };
          };
          const BU = { id: 'auto|u', room: 'health', messages: [{ id: 'u#0' }],
            effects: [{ id: 'e' }], unlocked: ['hidden-x'], event_id: 'ev' };
          const okU = mkU();
          eq('해금은 말풍선·Effect 뒤, 사건 소모 앞이다',
            [await R(BU, okU.A), okU.S.log, okU.S.unlocked],
            [true, ['msg', 'fx', 'unlock', 'ack', 'drop'], ['hidden-x']]);
          const badU = mkU({ failUnlock: true });
          eq('해금이 실패하면 사건을 안 지운다',
            [await R(BU, badU.A), badU.S.acked, badU.S.dropped], [false, false, false]);
          /* 해금이 없는 장부는 그 단계를 아예 안 탄다 */
          const noU = mkU();
          eq('해금이 없으면 안 부른다',
            [await R({ ...BU, unlocked: [] }, noU.A), noU.S.log],
            [true, ['msg', 'fx', 'ack', 'drop']]);
        }
      }
    }

    /* ── 앱 배선 소스 검사 — 엔진이 실제 관전 경로에 물려 있다 ── */
    {
      const appTsx = readFileSync(join(ROOT, 'app/App.tsx'), 'utf8');
      eq('앱 관전이 원자 장부를 쓴다',
        [/const data=await genAuto\(name,ev\?[\s\S]{0,300}await commitAutoTurn\(ev,at,data\)/.test(appTsx),
         /await commitAutoTurn\(null,Date\.now\(\),data\)/.test(appTsx)], [true, true]);
      /* 관전 응답(genAuto)이 applyExtras(즉시 적용)로 새는 길이 없어야
         한다 — 관전은 원자 장부(commitAutoTurn)만 탄다. 채팅 경로의
         applyExtras는 다른 길이라 여기서 안 잰다. */
      eq('앱 관전에서 Effect가 대화보다 먼저 적히는 길이 없다',
        /genAuto\([\s\S]{0,400}applyExtras/.test(appTsx), false);
      eq('앱이 공용 엔진과 멱등 열쇠를 쓴다',
        [/runAutoQueue\(list,autoAdapters\(\)\)/.test(appTsx), /hasMsgTrack\('health', m\.id\)/.test(appTsx)], [true, true]);
      eq('앱이 부팅에서 남은 장부를 잇는다',
        /if\(ready\) resumePendingAuto\(\)/.test(appTsx)
        && /getMeta\('null_auto_batch'\)/.test(appTsx), true);
      eq('규칙층이 엔진을 나른다', (() => {
        const rules = readFileSync(join(ROOT, 'app/lib/rules.ts'), 'utf8');
        return /const runAutoBatch=async\(b,A\)=>/.test(rules)
          && /const runAutoQueue=async\(list,A\)=>/.test(rules);
      })(), true);
      /* ── 줄에 붙이고, 줄에서 뺀다 ──
         덮어쓰면 앞엣것의 말풍선·공개가 통째로 사라진다. 그리고 다 풀릴
         때까지 그 방은 잠긴다 — 새 관전을 그 위에 얹지 않는다. */
      eq('앱이 장부를 덮지 않고 줄에 붙인다',
        /const queued=pushAutoBatch\(before,b\);/.test(appTsx)
        && /const before=readAutoQueue\(await getMeta\('null_auto_batch'\)\);/.test(appTsx), true);
      /* ── 장부를 만지는 일은 한 줄로 세운다 ──
         await가 셋이라 읽고-고치고-쓰는 사이가 열린다. 배경 관전과 유저의
         peek이 겹치면 둘 다 빈 줄을 읽고 각자 제 것만 써서 앞엣것이 통째로
         사라진다 — 덮어쓰기를 막으려던 변경이 경합으로 옮겨갈 뿐이다. */
      eq('앱이 장부 작업을 직렬화한다',
        /const autoGate=useRef<Promise<any>>\(Promise\.resolve\(\)\);/.test(appTsx)
        && /const inAutoGate=/.test(appTsx)
        && /return inAutoGate\(async\(\)=>\{/.test(appTsx)
        && /const drainAutoBatches=\(\):Promise<boolean>=>inAutoGate\(drainOnce\);/.test(appTsx), true);
      /* 잠금 표시는 예외가 나도 반드시 갱신된다 — 안 그러면 다 푼 방이
         잠긴 채 굳어 그 세션 내내 관전이 죽는다(catch{}가 삼킨다) */
      eq('잠금 표시를 finally로 세운다',
        /\}finally\{\s*\n\s*autoStuckRef\.current=leftN>0; setAutoStuck\(leftN>0\);/.test(appTsx), true);
      /* id 없는 장부를 지웠다고 치면 조용한 가짜 성공이 된다 */
      eq('앱이 id 없는 장부를 지웠다고 안 한다',
        /if\(!b\|\|typeof b\.id!=='string'\|\|!b\.id\)return false;/.test(appTsx), true);
      /* 해금이 장부 밖에 있으면 막혔다 풀릴 때 .hidden만 영영 안 열린다 */
      eq('해금도 장부 안이다',
        /if\(\(b\.unlocked\|\|\[\]\)\.length&&A\.applyUnlocked/.test(readFileSync(join(ROOT, 'app-data.js'), 'utf8'))
        && /unlocked:Array\.isArray\(data\?\.unlocked\)\?data\.unlocked:\[\],/.test(appTsx)
        && /applyUnlocked: async\(list:any\)=>/.test(appTsx), true);
      eq('앱이 줄에서 그 항목만 뺀다',
        /dropBatch: async\(b:any\)=>\{[\s\S]{0,300}filter\(\(x:any\)=>x&&x\.id!==id\)/.test(appTsx), true);
      /* ref로도 본다 — state는 다음 그림에서야 바뀌는데 부팅 재개는
         비동기라, 그 사이에 배경 효과가 동기적으로 가드를 지나 잠긴 방
         위로 유료 호출을 낸다. 웹은 localStorage를 동기로 읽어(headBatchOf)
         이 구멍이 없다. */
      eq('앱도 남은 줄이 있으면 그 방을 잠근다',
        /autoStuckRef\.current=leftN>0; setAutoStuck\(leftN>0\);/.test(appTsx)
        && /autoBusy\.current\|\|autoStuck\|\|autoStuckRef\.current/.test(appTsx), true);
      eq('잠긴 방에서는 모델 대신 남은 것을 잇는다',
        /if\(autoStuck\|\|autoStuckRef\.current\)\{ await drainAutoBatches\(\); return; \}/.test(appTsx), true);
      /* ══ 앱 관전 장부를 **실제로 굴린다** ══
         위는 전부 소스 정규식이다. 「코드에 이 글자가 있다」는 「이 코드가
         이 일을 한다」가 아니다 — 경합·고착·유실은 실행해야만 보인다.
         App.tsx에서 관전 부분만 잘라 가짜 저장소를 물리고 돌린다. */
      {
        const Q = new Function(
          'const localStorage={_v:{},getItem(k){return this._v[k]||null},setItem(k,v){this._v[k]=v},removeItem(k){delete this._v[k]}};'
          + readFileSync(join(ROOT, 'app-data.js'), 'utf8')
          + '\nreturn {readAutoQueue,pushAutoBatch,runAutoQueue};')();
        const cut = (from, to) => {
          const i = appSrc.indexOf(from);
          const j = appSrc.indexOf(to, i);
          return appSrc.slice(i, j);
        };
        /* 타입 주석만 벗긴다. 이 조각에 있는 것은 다섯 가지뿐이고
           (아래 검사가 남은 게 없음을 강제한다), 객체 리터럴의 `키:값`과
           겹치지 않는다 — `:any`·`:number`·`:Promise<…>`만 지운다. */
        const body = cut('const autoGate=useRef', 'const resumePendingAuto=')
          .replace('const inAutoGate=<T,>(fn:()=>Promise<T>):Promise<T>=>', 'const inAutoGate=(fn)=>')
          .replace(/useRef<[^(]*>\(/g, 'useRef(')
          .replace(/:Promise<boolean>/g, '')
          .replace(/:any\[\]/g, '').replace(/:any/g, '').replace(/:number/g, '');
        eq('앱 관전 조각에서 타입이 다 벗겨졌다',
          /:(any|number|string|boolean|Promise<)/.test(body), false);
        const mk = (opts = {}) => {
          const S = { meta: {}, msgs: [], fx: [], unlocked: [], q: ['e1'], stuck: false,
            calls: 0, reloads: 0 };
          const env = {
            useRef: v => ({ current: v }),
            setAutoStuck: v => { S.stuck = v },
            autoStuckRef: { current: false },
            getMeta: async k => { if (opts.failGet) throw new Error('db'); return S.meta[k] ?? null },
            setMeta: async (k, v) => { S.meta[k] = v },
            reload: async () => { S.reloads++; if (opts.failReload) throw new Error('db') },
            readAutoQueue: Q.readAutoQueue, pushAutoBatch: Q.pushAutoBatch,
            runAutoQueue: async (list, A) => { S.calls++; return await Q.runAutoQueue(list, A) },
            autoAdapters: () => ({
              saveMsg: async m => { if (opts.failMsg) return false;
                if (!S.msgs.includes(m.id)) S.msgs.push(m.id); return true },
              applyEffect: async e => { if (opts.failFx) return false;
                if (!S.fx.includes(e.id)) S.fx.push(e.id); return true },
              /* 실제 applyUnlocked와 같은 멱등이다 — 이미 열린 것은 안 센다
                 (App.tsx가 Set으로 합친다). 어댑터 멱등은 장부의 전제다 */
              applyUnlocked: async ks => {
                S.unlocked = [...new Set([...S.unlocked, ...ks])]; return true },
              ackEvent: async id => { S.q = S.q.filter(x => x !== id); return true },
              dropBatch: async b => {
                if (!b || typeof b.id !== 'string' || !b.id) return false;
                const next = Q.readAutoQueue(S.meta.null_auto_batch).filter(x => x && x.id !== b.id);
                S.meta.null_auto_batch = JSON.stringify(next); return true },
            }),
          };
          const keys = Object.keys(env);
          const fn = new Function(...keys, `${body}\nreturn { commitAutoTurn, drainAutoBatches };`);
          return { S, api: fn(...keys.map(k => env[k])) };
        };
        const DATA = { messages: [{ text: 'ㄱ' }, { text: 'ㄴ' }],
          effects: [{ id: 'fx1' }], unlocked: ['hidden-x'] };
        const EV1 = { id: 'e1', kind: 'gift' };

        /* 성공 — 말풍선·Effect·해금·사건이 한 번에 */
        {
          const t = mk();
          eq('앱 관전이 실제로 한 번에 반영된다',
            [await t.api.commitAutoTurn(EV1, 1000, DATA), t.S.msgs.length,
             t.S.fx, t.S.unlocked, t.S.q, t.S.stuck],
            [true, 2, ['fx1'], ['hidden-x'], [], false]);
          eq('다 풀면 줄이 빈다', Q.readAutoQueue(t.S.meta.null_auto_batch).length, 0);
        }
        /* ── 경합 — 서로 다른 두 관전이 겹쳐도 앞엣것이 안 사라진다 ──
           읽고-고치고-쓰는 사이에 await가 셋이다. 직렬화가 없으면 둘 다 빈
           줄을 읽고 각자 제 것만 써서 앞엣것이 통째로 증발한다. */
        {
          const t = mk();
          const [a, b] = await Promise.all([
            t.api.commitAutoTurn({ id: 'e1' }, 1000, { messages: [{ text: 'A0' }, { text: 'A1' }] }),
            t.api.commitAutoTurn({ id: 'e2' }, 2000, { messages: [{ text: 'B0' }, { text: 'B1' }] }),
          ]);
          eq('겹쳐 들어와도 둘 다 남는다', [a, b, t.S.msgs.length], [true, true, 4]);
          eq('겹쳐도 줄이 깨끗이 빈다', Q.readAutoQueue(t.S.meta.null_auto_batch).length, 0);
        }
        /* 같은 사건이 겹쳐 들어와도 아무것도 두 번 안 새겨진다.
           둘째가 참을 돌려주는 것은 「그 응답도 반영돼 있다」는 뜻이라 맞다 —
           재개가 멱등이라는 계약과 같은 말이다. 재는 것은 중복 0이다. */
        {
          const t = mk();
          await Promise.all([
            t.api.commitAutoTurn(EV1, 1000, DATA),
            t.api.commitAutoTurn(EV1, 1000, DATA),
          ]);
          eq('같은 사건이 겹쳐도 중복이 0이다',
            [t.S.msgs.length, t.S.fx, t.S.unlocked, t.S.q,
             Q.readAutoQueue(t.S.meta.null_auto_batch).length],
            [2, ['fx1'], ['hidden-x'], [], 0]);
        }
        /* ── 고착 — 예외가 나도 잠금 표시가 반드시 갱신된다 ── */
        {
          const t = mk({ failReload: true });
          await t.api.drainAutoBatches();
          eq('다 푼 방은 예외가 나도 안 잠긴다', [t.S.stuck, t.S.calls], [false, 0]);
        }
        {
          const t = mk({ failFx: true });
          await t.api.commitAutoTurn(EV1, 1000, DATA);
          eq('막히면 잠긴다', [t.S.stuck, t.S.q, t.S.unlocked], [true, ['e1'], []]);
          /* 고치고 다시 — 저장된 줄로만 잇는다 */
          const u = mk(); u.S.meta = { ...t.S.meta }; u.S.msgs = t.S.msgs.slice(); u.S.q = t.S.q.slice();
          eq('고치면 남은 것이 이어지고 잠금이 풀린다',
            [await u.api.drainAutoBatches(), u.S.msgs.length, u.S.fx, u.S.unlocked, u.S.q, u.S.stuck],
            [true, 2, ['fx1'], ['hidden-x'], [], false]);
        }
      }
      /* 웹도 같은 계약이다 — 관전 장부가 남아 있으면 새로 안 부른다 */
      eq('웹도 남은 관전 장부가 있으면 안 부른다',
        /if\(headBatchOf\("health"\)\)return;/.test(web), true);
      eq('웹이 방별로 머리부터 푼다',
        /const head=headBatchOf\(b\.room\);\s*\n\s*if\(head&&head\.id!==b\.id\)return false;/.test(web)
        && /const next=headBatchOf\(b\.room\);\s*\n\s*if\(next\)resumeBatch\(next\.id\);/.test(web), true);
    }
  }

  /* ── 워커가 승인한 것만 scene_ack로 돌려준다 ── */
  /* 예약한 그 사유가 올라갔을 때만 ack다. 워커가 스스로 감지해 올린
     장면은 예약이 아니라서 ack가 없다 — 지울 예약 자체가 없다 */
  eq('거절하면 scene_ack가 없다',
    /tier === "critical" && routed\.reason\s*\n\s*&& routed\.reason === String\(body\.scene_reason \|\| ""\)\.trim\(\)\s*\n\s*\? \{ scene_ack: routed\.reason \}/.test(workerSrc), true);
  eq('웹·앱이 일치할 때만 지운다',
    /data\.scene_ack===payload\.scene_reason/.test(web)
    && /data\.scene_ack===why/.test(appSrc), true);

  /* ── 커밋과 연출을 가른다 ──
     웹: 타이머만으로 커밋하면 그 사이 새로고침에 사라진다.
     앱: 인물의 말이 먼저 저장돼야 「받았다」가 뒤에 온다. */
  /* 표(effect_done)는 남을 것이 다 저장된 뒤에 찍는다.
     순서가 곧 안전이다: 가방 → 덩어리 → effect_done */
  /* ── 계획을 적는 자리에서는 아무것도 안 바꾼다 ──
     장부를 쓰기 전에 상태를 건드리면, 저장이 실패했을 때 되돌릴 수도
     이어갈 수도 없다. commitTurn은 putBatch만 한다. */
  eq('계획을 적는 자리는 상태를 안 바꾼다', (() => {
    const i = web.indexOf('const commitTurn=(id,room,data,payload,scene)=>{');
    const box = web.slice(i, web.indexOf('\n  };', i));
    return box.includes('return putBatch(b)?b:null;')
      && !/save(Bag|EffDone|Gifts|Scene|Invites|Unlocked)\(/.test(box)
      && !/applyEffect\(|applyOp\(|ackScene\(|ackAutoEvent\(/.test(box);
  })(), true);
  /* 실행기는 장부가 남은 뒤에만 돈다. 그리고 돌려주는 값은 「적혔나」다 —
     정상 대기(방별 FIFO)를 실패로 읽으면 귀갓길 창이 안 뜨고 초대가
     두 번 나간다. 거짓은 저장 자체가 안 됐을 때뿐이다. */
  eq('실행은 장부가 남은 뒤에만 한다',
    /if\(!putBatch\(newBatch\(id,room,plan\)\)\)\{ saveFailed\(room\); return false \}\s*\n\s*resumeBatch\(id\);\s*\n\s*return true;/.test(web), true);
  eq('대기와 저장 실패를 가른다',
    /if\(getBatch\(id\)\)\{ resumeBatch\(id\); return true \}/.test(web), true);
  /* 말이 안 남았으면 소모 단계로 안 넘어간다 */
  eq('대화가 안 남으면 아무것도 소모 안 한다', (() => {
    const i = web.indexOf('const finishBatch=id=>{');
    const box = web.slice(i, web.indexOf('return dropBatch(id)', i));
    return box.indexOf('if(!ok){ saveFailed(b.room,null,id); return false }')
         < box.indexOf('ackScene(b.room,b.scene_ack)');
  })(), true);
  eq('앱은 인물 말을 먼저 저장한다', (() => {
    const i = appSrc.indexOf('const data=await sendChat(room,name,hist,{reqId:rid');
    const box = appSrc.slice(i, i + 1400);
    return box.indexOf('await enqueue(room,data.messages)') < box.indexOf('await applyExtras(data)');
  })(), true);

  /* ── 유저 선물과 모델 Effect는 다른 길이다 ── */
  eq('유저 선물은 Effect를 안 탄다', (() => {
    const i = web.indexOf('const giveGift=(char,gift,memo)=>{');
    const box = web.slice(i, i + 1400);
    /* 유저가 직접 확정한 사건이라 모델의 「받았다」를 기다리지 않는다 —
       그래도 장부는 탄다. 저장 실패에 도장만 찍히면 안 되니까 */
    return box.includes('{op:"gift",char,key:gift.key}')
        && box.includes('{op:"event",ev:{kind:"gift"')
        && !box.includes('effects:');
  })(), true);
}

/* ══════════ 후보 묶음과 검사 — D단계 ══════════
   ── 왜 묶음인가 ──
   전에는 후보의 부수 출력이 parseMessages 함수에 매달려 있었다. 후보를
   둘 파싱하면 뒤엣것이 앞엣것을 덮는다 — A의 대사를 고르고 B의 give를
   가져오는 사고가 **구조적으로 가능**했다. 대사와 효과가 한 덩어리로
   움직여야 그 사고가 문법 오류가 된다. */
{
  const { parseMessages, hardFilter, readDecision, readProblems,
          criticPacket, finalizerPacket, directorPacket, sceneHead,
          CHAR_RULES, RULE_IDS, CANON_CODES, CHAR_CODES, rulesFor, makeFact, factIds } = ENG;
  const wk = workerSrc;
  const MH = ['minhyun'], BOTH = ['jaeeon', 'minhyun'];

  /* ── D0 후보 묶음 ── */
  eq('파싱은 묶음을 돌려준다', (() => {
    const b = parseMessages('{"messages":["가요."],"invite":"옥상","give":"can","photo":"minhyun-neon"}',
      'minhyun', MH);
    return [b.messages.length, b.invite, b.give, b.photo, b.parseStatus];
  })(), [1, '옥상', 'can', 'minhyun-neon', 'json']);
  eq('부수 출력이 함수에 안 남는다',
    [parseMessages.invite, parseMessages.give, parseMessages.photo], [undefined, undefined, undefined]);
  /* 두 후보를 잇달아 파싱해도 앞엣것이 안 덮인다 — 이게 옛 구조의 사고였다 */
  eq('두 후보의 부수 출력이 안 섞인다', (() => {
    const a = parseMessages('{"messages":["ㄱ"],"give":"can"}', 'minhyun', MH);
    const b = parseMessages('{"messages":["ㄴ"]}', 'minhyun', MH);
    return [a.give, b.give];
  })(), ['can', '']);
  eq('평문도 묶음이다', (() => {
    const b = parseMessages('그냥 한 줄', 'minhyun', MH);
    return [b.messages.length, b.parseStatus, b.invite];
  })(), [1, 'plain', '']);
  eq('읽을 것이 없으면 빈 묶음이다', parseMessages('{"messages":[', 'minhyun', MH).parseStatus, 'empty');
  /* pair는 한 호출에서 둘을 받기로 한 것이다. 하나만 오면 조용히 넘어가지 않는다 */
  /* 모든 경로에서다 — pair에 하나가 와도, one·single에 둘이 와도 스키마
     위반이다. 조건이 pair에만 걸려 있던 때는 one이 몰래 pair처럼 돌 수 있었다 */
  eq('후보 수가 안 맞으면 다시 쓴다', (() => {
    const i = wk.indexOf('if (pieces.length !== nCand)');
    return i > 0 && wk.slice(i, i + 200).includes('WRITER_SCHEMA');
  })(), true);
  /* 자리가 아니라 id로 가린다 */
  eq('후보를 id로 만든다', /const id = "AB"\[i\] \|\| `C\$\{i\}`;/.test(wk), true);
  eq('고를 때도 id로 찾는다',
    /cands\.find\(c => c\.id === dec\.decision\)/.test(wk), true);
  eq('고른 묶음에서 부수 출력을 꺼낸다',
    /const effects = materializeEffects\(reqId, picked, hardCtx\);/.test(wk)
    && /dropSleepers\(picked\.messages/.test(wk), true);

  /* ── D1 SENDER 복구 ──
     전에는 parseMessages가 정규화를 **먼저** 해서 이 검사가 영영 발화하지
     못했다. 민현 방에서 sender:"jaeeon"이 조용히 민현 말이 됐다. */
  eq('1:1의 명시적 오답 화자는 떨어진다', (() => {
    const b = parseMessages('{"messages":[{"sender":"jaeeon","text":"앉으세요."}]}', 'minhyun', MH);
    return hardFilter(b, MH, {});
  })(), ['SENDER']);
  eq('생략한 화자는 안 떨어진다', (() => {
    const b = parseMessages('{"messages":["앉으세요."]}', 'minhyun', MH);
    return hardFilter(b, MH, {});
  })(), []);
  eq('이름표 형식의 오답 화자도 떨어진다', (() => {
    const b = parseMessages('[이재언] 앉으세요.', 'minhyun', MH);
    return [b.parseStatus, hardFilter(b, MH, {})];
  })(), ['tagged', ['SENDER']]);
  eq('단톡의 허용 화자는 통과한다', (() => {
    const b = parseMessages('{"messages":[{"sender":"jaeeon","text":"ㄱ"},{"sender":"minhyun","text":"ㄴ"}]}',
      'minhyun', BOTH);
    return hardFilter(b, BOTH, {});
  })(), []);
  /* 정규화가 검사보다 앞서면 안 된다 — 소스로도 굳힌다 */
  eq('파서가 명시된 화자를 안 갈아치운다',
    /ok\.includes\(m\.sender\) \? m : \{ \.\.\.m, sender: fallbackSender \}/.test(wk), false);
  eq('검사가 명시 여부를 본다', /m\.senderGiven === undefined \? !!m\.sender : m\.senderGiven/.test(wk), true);

  /* ── D2 FACT_DENIAL — 다섯이 다 맞을 때만 ── */
  const GIFT = { giftNow: { key: 'mug', name: '회색 머그컵' }, giftRoom: 'jaeeon' };
  const say = (t, who) => ({ messages: [{ sender: who || 'jaeeon', text: t, senderGiven: true }] });
  eq('그 물건을 그 사람이 부정하면 hard다',
    hardFilter(say('회색 머그컵 받은 적 없어요.'), ['jaeeon'], GIFT), ['FACT_DENIAL']);
  eq('이번 턴 선물이 없으면 같은 말도 hard가 아니다',
    hardFilter(say('회색 머그컵 받은 적 없어요.'), ['jaeeon'], {}), []);
  eq('물건 이름이 없으면 hard가 아니다',
    hardFilter(say('그런 거 받은 적 없어요.'), ['jaeeon'], GIFT), []);
  eq('부정을 뒤집은 말은 hard가 아니다',
    hardFilter(say('회색 머그컵 안 받은 게 아니라 아직 안 썼어요.'), ['jaeeon'], GIFT), []);
  eq('다른 사람이 말하면 hard가 아니다',
    hardFilter(say('회색 머그컵 받은 적 없어요.', 'minhyun'), BOTH, GIFT), []);
  /* 같은 종류를 재언과 민현이 각각 가진 정상 상태 — 남의 것을 부정한 것이
     내 것 부정으로 세면 안 된다. 늘 (수신자, 종류)를 함께 본다. */
  eq('남의 같은 물건과 안 섞인다',
    hardFilter(say('민현이 회색 머그컵은 저한테 없어요.', 'minhyun'), BOTH,
      { giftNow: { key: 'mug', name: '회색 머그컵' }, giftRoom: 'jaeeon' }), []);
  eq('멀쩡한 감사는 hard가 아니다',
    hardFilter(say('회색 머그컵 잘 쓸게요.'), ['jaeeon'], GIFT), []);

  /* ── D2 초대·지급 제안 검사 ── */
  /* 잠긴 자리 제안으로 대사를 죽이지 않는다 — 억제할 것은 invite Effect
     하나뿐이고 그건 pickInvite가 확정 단계에서 null로 만든다 */
  eq('안 열린 자리 제안으로 후보가 떨어지지 않는다',
    hardFilter({ messages: [{ text: 'ㄱ' }], invite: '한강' }, MH, { openPlaces: ['옥상'] }), []);
  eq('그래도 그 자리는 Effect가 안 된다', INV.pickInvite('한강', ['옥상']), null);
  eq('열린 자리 제안은 통과한다',
    hardFilter({ messages: [{ text: 'ㄱ' }], invite: '옥상' }, MH, { openPlaces: ['옥상'] }), []);
  eq('열린 자리는 Effect가 된다', INV.pickInvite('옥상', ['옥상']), '옥상');
  eq('제안을 안 낸 것은 어긴 것이 아니다',
    hardFilter({ messages: [{ text: 'ㄱ' }] }, MH, { openPlaces: [] }), []);
  eq('자리 밖에서 건네겠다는 것은 떨어진다',
    hardFilter({ messages: [{ text: 'ㄱ' }], give: 'can' }, MH, { place: null, room: 'minhyun' }),
    ['INVALID_GIVE']);
  eq('이미 가진 물건을 또 건네면 떨어진다',
    hardFilter({ messages: [{ text: 'ㄱ' }], give: 'can' }, MH,
      { place: '옥상', placeItemOwned: true, room: 'minhyun' }), ['INVALID_GIVE']);
  eq('그 자리의 물건은 통과한다',
    hardFilter({ messages: [{ text: 'ㄱ' }], give: 'can' }, MH,
      { place: '옥상', placeItemOwned: false, placeItemAvailable: true, room: 'minhyun' }), []);
  /* 못 건네는 턴인데 give를 냈다 — 프롬프트에 안 보여줬는데도 지어낸 것이다 */
  eq('두 마디 전의 give는 떨어진다',
    hardFilter({ messages: [{ text: 'ㄱ' }], give: 'can' }, MH,
      { place: '옥상', placeItemOwned: false, placeItemAvailable: false, room: 'minhyun' }),
    ['INVALID_GIVE']);

  /* ── D 후속 · 입구가 하나다 ──
     안전 검사에 옛 입구를 남기면 「테스트는 통과했는데 저 경로만 안 걸러짐」이
     생기고, G에서 모델 차이가 아니라 후처리 차이를 비교하게 된다. */
  eq('검사가 배열을 안 받는다', (() => {
    const f = wk.slice(wk.indexOf('function hardFilter('), wk.indexOf('/* ── Soft Signal ──'));
    return /Array\.isArray\(cand\)/.test(f);
  })(), false);
  eq('생산 호출이 전부 Candidate다', (() => {
    /* hardFilter(무엇, …) 의 첫 인자가 배열 리터럴이거나 messages 배열이면 옛 모양이다 */
    return (wk.match(/hardFilter\(/g) || []).length === 8      // 정의 1 + 호출 7 (G3 후보·폴백 + §8.5 부분·합침 포함)
        && /hardFilter\(cand, chars, hardCtx\)/.test(wk)      // 일반·pair·one·auto·중요 + G3 후보 루프
        && /hardFilter\(fCand, chars, hardCtx\)/.test(wk)     // 마무리
        && /hardFilter\(fbCand, chars, hardCtx\)/.test(wk)    // G3 폴백
        && /hardFilter\(c0, chars, hardCtx\)/.test(wk)        // 기준선
        /* §8.5 화자 순차 — 부분 호출은 그 화자만, 필수 화자 검사는 합친 뒤 */
        && /hardFilter\(cand, \[speaker\], \{ \.\.\.hardCtx, requiredSpeakers: \[\] \}\)/.test(wk)
        && /hardFilter\(merged, chars, hardCtx\)/.test(wk)
        && !/hardFilter\(kept/.test(wk) && !/hardFilter\(\[/.test(wk);
  })(), true);
  /* 기준선도 같은 검사를 탄다. 전에는 아예 안 탔다 —
     새는 줄이 한쪽에서만 걸러지면 비교가 성립하지 않는다. */
  eq('기준선도 Candidate로 검사한다', (() => {
    const i = wk.indexOf('if (engineMode(env) === "legacy")');
    const box = wk.slice(i, i + 1600);
    return box.includes('const c0 = { id: "L"') && box.includes('hardFilter(c0, chars, hardCtx)');
  })(), true);
  eq('기준선 Candidate에 칸이 다 있다', (() => {
    const i = wk.indexOf('const c0 = { id: "L"');
    const box = wk.slice(i, i + 500);
    return ['originalMessages', 'messages:', 'invite:', 'give:', 'photo:', 'signals:']
      .filter(k => !box.includes(k));
  })(), []);
  /* hardCtx가 기준선보다 뒤에 정의되면 TDZ로 터진다 */
  eq('검사 재료가 기준선보다 앞에 있다',
    wk.indexOf('const hardCtx =') < wk.indexOf('if (engineMode(env) === "legacy")'), true);

  /* ── D 후속 · 파서에 숨은 상태가 없다 ──
     parseMessages.invite를 걷어낸 것과 같은 함정이다. 지금은 부르고 바로
     읽어서 안 섞이지만, 사이에 한 줄만 끼면 요청끼리 섞이는 길이 다시 생긴다. */
  eq('파서가 함수 속성을 안 쓴다',
    /(parseMessages|parseTagged|splitCandidates|readProblems|readDecision)\.[a-zA-Z_]+\s*=/.test(wk), false);
  eq('이름표 파서가 결과를 돌려준다',
    /return tagged \? \{ messages: out, intruder \} : null;/.test(wk), true);
  /* 앞 호출의 난입 표시가 다음 호출에 남으면 안 된다 */
  eq('난입 표시가 다음 파싱에 안 남는다', (() => {
    const a = parseMessages('[이재언] 앉으세요.', 'minhyun', MH);       // 난입
    const b = parseMessages('{"messages":["네."]}', 'minhyun', MH);      // 정상
    return [!!a.intruder, !!b.intruder];
  })(), [true, false]);
  eq('정상 다음의 난입도 정확히 잡는다', (() => {
    const a = parseMessages('{"messages":["네."]}', 'minhyun', MH);
    const b = parseMessages('[이재언] 앉으세요.', 'minhyun', MH);
    return [!!a.intruder, !!b.intruder];
  })(), [false, true]);
  /* 방이 바뀌면 판정도 바뀐다 — 앞 방의 결과가 남으면 안 된다 */
  eq('앞 방의 결과가 다음 방에 안 남는다', (() => {
    const a = parseMessages('[이재언] 앉으세요.', 'minhyun', MH);        // 민현 방 → 난입
    const b = parseMessages('[이재언] 앉으세요.', 'jaeeon', ['jaeeon']); // 재언 방 → 정상
    return [!!a.intruder, !!b.intruder, hardFilter(b, ['jaeeon'], {})];
  })(), [true, false, []]);
  /* 모든 줄이 난입이면 이름표째 말풍선으로 내보내지 않는다 */
  eq('난입뿐이면 평문으로 안 떨어진다', (() => {
    const b = parseMessages('[이재언] 앉으세요.', 'minhyun', MH);
    return [b.parseStatus, hardFilter(b, MH, {})];
  })(), ['tagged', ['SENDER']]);
  /* JSON 경로와 이름표 경로가 같은 묶음을 낸다 */
  eq('두 경로가 같은 계약을 낸다', (() => {
    const keys = o => Object.keys(o).sort().join(',');
    return keys(parseMessages('{"messages":["ㄱ"]}', 'minhyun', MH))
        === keys(parseMessages('[이민현] ㄱ', 'minhyun', MH));
  })(), true);

  /* ── D4 성격표 ── */
  eq('성격표에 새 인물이 없다',
    CHAR_RULES.filter(r => !/^(both|jaeeon|minhyun)\./.test(r.rule_id)), []);
  eq('성격표에 최소 축이 다 있다',
    ['no_counselor', 'no_puppetry', 'no_exposition', 'no_invention', 'no_rush']
      .filter(k => !CHAR_RULES.some(r => r.rule_id.includes(k))), []);
  eq('두 사람의 묻는 방식이 갈려 있다',
    [RULE_IDS.has('jaeeon.voice.indirect_curiosity'), RULE_IDS.has('minhyun.ask.short_check')],
    [true, true]);
  eq('제 화자 것과 공통만 받는다', (() => {
    const r = rulesFor('minhyun').map(x => x.rule_id);
    return [r.some(x => x.startsWith('both.')), r.some(x => x.startsWith('minhyun.')),
            r.some(x => x.startsWith('jaeeon.'))];
  })(), [true, true, false]);
  eq('rule_id에 중복이 없다', CHAR_RULES.length, RULE_IDS.size);

  /* ── D5·D6 Critic 스키마 ── */
  const FACTS = [makeFact('gift.mug.user_to_jaeeon', true, 'state', ['user', 'jaeeon'])];
  const AL = { candidates: new Set(['A', 'B']), facts: factIds(FACTS) };
  const canon = o => readProblems(JSON.stringify({ problems: [o] }), 'canon', AL);
  const chara = o => readProblems(JSON.stringify({ problems: [o] }), 'character', AL);
  eq('유효한 사실 문제는 통과한다',
    canon({ candidate: 'A', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon', code: 'FACT_DENIAL' }).ok, true);
  eq('없는 fact_id는 다시 쓴다',
    canon({ candidate: 'A', critic: 'canon', fact_id: 'gift.없는.것', code: 'FACT_DENIAL' }).ok, false);
  eq('fact_id가 없으면 다시 쓴다',
    canon({ candidate: 'A', critic: 'canon', code: 'FACT_DENIAL' }).ok, false);
  eq('사실 문제에 rule_id를 쓰면 다시 쓴다',
    canon({ candidate: 'A', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon',
            rule_id: 'both.voice.no_counselor', code: 'FACT_DENIAL' }).ok, false);
  eq('유효한 사람 문제는 통과한다',
    chara({ candidate: 'B', critic: 'character', rule_id: 'both.voice.no_counselor',
            code: 'COUNSELOR_TONE' }).ok, true);
  eq('없는 rule_id는 다시 쓴다',
    chara({ candidate: 'B', critic: 'character', rule_id: 'minhyun.없는규칙', code: 'VOICE_BREAK' }).ok, false);
  eq('사람 문제에 fact_id를 쓰면 다시 쓴다',
    chara({ candidate: 'B', critic: 'character', rule_id: 'both.voice.no_counselor',
            fact_id: 'gift.mug.user_to_jaeeon', code: 'VOICE_BREAK' }).ok, false);
  eq('없는 후보는 다시 쓴다',
    canon({ candidate: 'C', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon', code: 'FACT_DENIAL' }).ok, false);
  eq('모르는 코드는 다시 쓴다',
    canon({ candidate: 'A', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon', code: '이상함' }).ok, false);
  eq('검사 이름이 다르면 다시 쓴다',
    canon({ candidate: 'A', critic: 'character', fact_id: 'gift.mug.user_to_jaeeon', code: 'FACT_DENIAL' }).ok, false);
  eq('문제가 없으면 통과하고 비어 있다',
    (() => { const r = readProblems('{"problems":[]}', 'canon', AL); return [r.ok, r.problems.length]; })(),
    [true, 0]);
  /* 표식은 끝까지 남는다 — .flat()으로 뭉개지 않는다 */
  eq('후보 표식이 끝까지 남는다',
    readProblems(JSON.stringify({ problems: [
      { candidate: 'A', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon', code: 'FACT_DENIAL' },
      { candidate: 'B', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon', code: 'FACT_INVENTED' }] }),
      'canon', AL).problems.map(x => `${x.candidate}:${x.code}`),
    ['A:FACT_DENIAL', 'B:FACT_INVENTED']);
  /* 허용 목록은 Fact[]에서 직접 온다 — 문장을 파싱해 만들지 않는다 */
  eq('허용 fact_id를 구조에서 받는다',
    /const allowed = \{ candidates: new Set\(cands\.map\(c => c\.id\)\), facts: factIds\(stageFacts\) \}/.test(wk), true);

  /* 검사마다 다른 것을 준다 — 사실 목록과 성격표를 둘 다 주면 영역이 섞인다 */
  {
    const ctx = { who: 'minhyun', when: '저녁', place: null, stage: '익숙', knows: '',
      facts: FACTS, here: [], userName: '선생님', recent: [] };
    const cs = [{ id: 'A', messages: [{ text: 'ㄱ' }], signals: [] }];
    const pkC = criticPacket(ctx, cs, 'canon'), pkH = criticPacket(ctx, cs, 'character');
    eq('사실 검사는 fact_id 목록을 받는다',
      [pkC.includes('gift.mug.user_to_jaeeon'), pkC.includes('minhyun.ask.short_check')], [true, false]);
    eq('사람 검사는 rule_id 목록을 받는다',
      [pkH.includes('minhyun.ask.short_check'), pkH.includes('[사실 목록]')], [true, false]);
    eq('사실이 없으면 모르는 것이라고 적는다',
      criticPacket({ ...ctx, facts: [] }, cs, 'canon').includes('없는 것은 모르는 것이지 거짓이 아니다'), true);
  }

  /* ── D7 호출 수 ── */
  eq('검사를 후보마다 안 부른다', /cands\.map\([\s\S]{0,80}callStage\(env, meter, "(canon|character)"/.test(wk), false);
  /* canon 호출부는 둘이다 — 중요 장면 검사 하나, 관전 공개 갈래의 소유자
     정사 검사(ownValidate) 하나. 같은 계약(CANON_CRITIC·criticPacket·
     readProblems)의 재사용이지 새 검사기가 아니다. */
  eq('검사는 각각 한 번씩이다',
    [(wk.match(/callStage\(env, meter, "canon"/g) || []).length,
     (wk.match(/callStage\(env, meter, "character"/g) || []).length], [2, 1]);
  /* 사실을 어긴 후보가 다 빠지면 위를 안 부른다 — 틀린 재료로 값비싼 호출을
     하지 않는다 */
  eq('사실을 다 어기면 마무리를 안 부른다', (() => {
    const i = wk.indexOf('if (!survivors.length)');
    return i > 0 && wk.slice(i, i + 800).includes('continue;')
        && wk.indexOf('callStage(env, meter, "finalizer"') > i;
  })(), true);
  eq('마무리는 살아남은 후보만 받는다',
    /finalizerPacket\(sceneCtx, survivors, notes\.filter/.test(wk), true);

  /* ── D10 마무리 묶음 ── */
  eq('마무리도 제 묶음을 만든다',
    /const fCand = \{ id: "F"/.test(wk), true);
  eq('마무리가 원래 후보의 부수 출력을 안 물려받는다', (() => {
    const i = wk.indexOf('const fCand = { id: "F"');
    const box = wk.slice(i, i + 600);
    return box.includes('invite: fp.invite') && box.includes('give: fp.give')
        && !box.includes('picked.invite') && !box.includes('cands[0]');
  })(), true);
  eq('마무리 system은 비변이 복사 그대로다',
    /const finalizerSystem = \[\.\.\.system, \{ type: "text", text: FINALIZER_RULES \}\]/.test(wk), true);

  /* ── D11 재시도 피드백 ── */
  eq('재시도에 탈락 코드를 얹는다', /\[이전 시도 탈락\]/.test(wk), true);
  eq('재시도는 원본 이력을 안 건드린다', (() => {
    const i = wk.indexOf('const tries = attempt > 1 && lastCodes.length');
    const box = wk.slice(i, i + 700);
    /* 복사본을 만들고 마지막 발화만 갈아 끼운다. msgs.push가 있으면 오염이다 */
    return box.includes('const copy = msgs.slice();')
        && box.includes('copy[copy.length - 1] = { ...t, content: blocks };')
        && !box.includes('msgs.push(') && !box.includes('t.content.push(');
  })(), true);
  eq('첫 시도에는 안 붙는다', /attempt > 1 && lastCodes\.length/.test(wk), true);
  /* 검사의 자유 문장이나 못 읽은 원문을 넣지 않는다 — 유효한 코드·id만 */
  /* 마무리를 빼는 실험(NO_FINALIZER)에서는 사람 검사도 탈락 사유가 되므로
     rule_id가 실릴 수 있다. 그래도 실리는 것은 여전히 id와 코드뿐이다 —
     검사의 자유 문장이나 못 읽은 원문은 안 들어간다. */
  eq('탈락 코드는 id와 코드뿐이다', (() => {
    const i = wk.indexOf('lastCodes = notes.filter(n => denyCritics.includes(n.critic))');
    return i > 0 && wk.slice(i, i + 200)
      .includes('`${n.candidate}:${n.code}:${n.fact_id || n.rule_id || ""}`');
  })(), true);
  eq('후보 탈락도 id를 달고 간다', /fell\.push\(\.\.\.codes\.map\(c => `\$\{id\}:\$\{c\}`\)\)/.test(wk), true);
  /* 후보마다 덮어쓰면 마지막 것만 남아 안 고친 쪽이 다음에도 똑같이 떨어진다 */
  eq('탈락 코드를 후보마다 안 덮어쓴다',
    /const fell = \[\];/.test(wk) && /if \(fell\.length\) lastCodes = fell;/.test(wk), true);
  /* 검사가 헛소리를 하면 「문제 없음」이 아니라 다시 쓴다 */
  eq('검사 스키마가 어긋나면 다시 쓴다', /lastCodes = \["CRITIC_SCHEMA"\]/.test(wk), true);
}

/* ══════════ 첫 자리의 첫 마디 ══════════
   앱을 처음 켠 시각에 따라 메신저가 아니라 자리에서 먼저 만나는 날이 있다.
   전에는 그 첫 마디를 모델이 썼는데, 모델에게는 기록이 하나도 없으니
   아무 날의 아무 말처럼 나왔다 — 서로 처음 보는 자리인 걸 모르는 채로.
   게다가 그 방은 이제 비어 있지 않으니 「도착 선톡 · 첫 만남」의 정해진
   첫 마디가 그날 영영 안 나온다. 자리가 그 사람의 첫 마디를 삼킨 것이다. */
{
  const corpus = readFileSync(join(ROOT, 'docs/dialogue-corpus.md'), 'utf8');
  const demo = readFileSync(join(ROOT, 'demo-lines.js'), 'utf8');

  /* 여는 자리가 늘면 문구도 같이 늘어야 한다. 손으로 세지 않고 표에서 읽는다 —
     자리를 하나 더 만들고 문구를 안 쓰면 그날 아침이 조용하다. */
  const places = (() => {
    const src = web.slice(web.indexOf('const OPENINGS=['), web.indexOf('const openingFor='));
    return [...new Set([...src.matchAll(/place:"([^"]+)"/g)].map(m => m[1]))];
  })();
  eq('여는 자리가 일곱이다', places.length, 7);
  eq('자리마다 첫 마디가 있다',
    places.filter(p => !new RegExp(`"when":"${p}","sec":"첫 자리"`).test(demo)), []);
  eq('문구집에도 자리마다 있다',
    places.filter(p => !corpus.includes(`**상황. ${p}**`)), []);

  /* 첫 마디는 모델을 안 부른다 — 정해진 말이라 부를 이유가 없고,
     불러 봤자 기록이 없어서 아무 날의 아무 말이 나온다 */
  eq('첫 자리는 모델을 안 부른다', (() => {
    const i = web.indexOf('setScene(sc); saveScene(sc); setView(o.room);');
    const box = web.slice(i, i + 900);
    return box.includes('demoProactive(o.room,o.place,name)') && !box.includes('request(o.room,');
  })(), true);
  eq('앱도 첫 자리는 모델을 안 부른다',
    /const first=demoProactive\(o\.room,o\.place,name\);/.test(appSrc), true);
  /* 문구가 없으면 조용히 있느니 모델을 부른다 — 화면이 비는 것이 제일 나쁘다 */
  eq('문구가 없으면 모델로 넘어간다',
    /else await runTurn\(o\.room\);/.test(appSrc), true);

  /* 자리에서 만나도 그 사람의 결은 같아야 한다. 재언은 용건부터 만들고,
     민현은 아는 걸 아는 채로 연다. 옥상은 여기서 설명하지 않는다 —
     마주 보고 서서 그 얘기부터 꺼내면 인사가 아니라 고발이다. */
  const sect = corpus.slice(corpus.indexOf('## 첫 자리'), corpus.indexOf('## 마감 체크'));
  eq('첫 자리에서 옥상을 설명하지 않는다', /병원 옥상에서 만났|담배|라이터/.test(
    sect.split('\n').filter(l => l.startsWith('　')).join('\n')), false);
  /* 민현의 첫 마디는 늘 같은 수다 — 아는 걸 아는 채로 연다.
     넷이 같은 말로 열려도 한 판에 하나만 나오므로 겹쳐 들리지 않는다.
     「또」가 붙는 것이 정사다: 병원 옥상에서 이미 봤다. */
  eq('민현은 아는 채로 연다', (() => {
    const mine = sect.split('\n').filter(l => l.startsWith('　민현'));
    return mine.length === 4 && mine.every(l => l.includes('또 볼 줄은 몰랐는데. 저 알죠?'));
  })(), true);
  /* 재언도 용건부터 만드는 건 같다. 다만 학교 밖 자리(도서관·빨래방)에서는
     아직 새로 온 선생님인 줄 모르므로 「새로 오셨죠」로 열지 않는다 —
     그 말은 이미 인사를 나눈 사이여야 나온다. 보건실만 학교 안이다. */
  eq('재언은 용건부터 만든다', (() => {
    const mine = sect.split('\n').filter(l => l.startsWith('　재언'));
    return [mine.length, mine.filter(l => /새로 오/.test(l)).length];
  })(), [3, 1]);
  eq('학교 밖에서는 아는 척하지 않는다', (() => {
    const out = sect.split('\n').filter(l => l.startsWith('　재언') && !/편하게 앉으세요/.test(l));
    return out.length === 2 && out.every(l => !/새로 오/.test(l));
  })(), true);

  /* 실제로 뽑아 본다 — 표와 문구가 이어져 있어도 고르는 쪽이 못 찾으면 소용없다 */
  const E = (() => {
    const eng = readFileSync(join(ROOT, 'tools/demo-engine.js'), 'utf8');
    const lines = readFileSync(join(ROOT, 'demo-lines.js'), 'utf8');
    return new Function(lines + ';' + eng + ';return {demoProactive}')();
  })();
  for (const p of ['편의점', '후문 골목', '버스정류장', '레코드샵', '보건실', '도서관', '빨래방']) {
    const got = E.demoProactive(['보건실', '도서관', '빨래방'].includes(p) ? 'jaeeon' : 'minhyun', p, '리리');
    eq(`${p}에서 첫 마디가 나온다`, got.length >= 2, true);
  }
  /* 자리 이름으로 뽑는데 다른 선톡이 딸려 나오면 안 된다 —
     고르는 쪽이 indexOf라 낱말이 겹치면 엉뚱한 것이 나온다 */
  eq('평소 선톡이 자리 이름에 안 걸린다', (() => {
    const got = E.demoProactive('minhyun', '편의점', '리리');
    return got.some(m => /또 볼 줄은 몰랐는데/.test(m.text || m));
  })(), true);
}

/* ══════════ 쓰는 쪽에 주는 행동 어휘 ══════════
   고르는 엔진은 두 후보에 없는 설렘을 만들 수 없다. 그래서 쓰는 쪽에
   규칙을 더 쌓는 대신 재료를 준다 — 이 사람이 지금 단계에서 할 수 있는
   행동과, 무엇을 보고 있는지를.

   고정 대사를 늘리는 작업이 아니다. 상황에 따라 즉흥으로 조합할 어휘다. */
{
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  const ja = wk.slice(wk.indexOf('감정이 새는 자리'), wk.indexOf('이렇게는 말하지 않는다'));
  const mh = wk.slice(wk.indexOf('무엇을 보고 있나'), wk.indexOf('여기 적힌 것들이 이 인물을 착한 챗봇으로'));

  /* 재언은 원하는 것을 말하지도 자각하지도 않는다. 그러면 새는 데가 있어야
     한다 — 없으면 인물이 아니라 설정이 된다. */
  eq('재언에게 새는 자리가 있다',
    ['시간이 어긋날 때', '자리가 끝나갈 때', '다른 사람 얘기가 나올 때',
     '떠나는 날 얘기가 나올 때'].filter(k => !ja.includes(k)), []);
  /* 기본값이 돌봄이라, 원하는 것이 생기면 할 일로 바꿔서 처리한다.
     그 길로만 가면 인물이 간호사 한 명으로 납작해진다. */
  eq('돌봄이 아닌 길이 있다', ja.includes('돌봄으로 안 도망간다'), true);
  eq('단계마다 열리는 것이 다르다',
    ['처음:', '익숙:', '균열:', '시한:'].filter(k => !ja.includes(k)), []);

  /* 말꼬리 잡기는 붙잡는 방법 중 하나일 뿐이다. 그것만 하면 짜증나는 애가 된다 */
  eq('민현에게 다른 방법이 있다',
    ['붙잡는 방법', '먼저 자리를 말해둔다', '끝내지 않는다',
     '거절당하려고 조른다'].filter(k => !mh.includes(k)), []);
  eq('무엇을 보고 있는지가 있다', mh.includes('무엇을 보고 있나'), true);
  /* 없는 것을 지어내면 그게 날조다 */
  eq('있는 것만 본다', mh.includes('이번 턴에 실제로 있는 것만 고른다'), true);
  /* 장난은 겉이고, 알고 싶은 것이 따로 있다 */
  eq('장난 뒤에 확인하려는 것이 있다', mh.includes('장난 뒤에 확인하려는 것'), true);
  /* ── 여기에 대사를 적으면 안 된다 ──
     프롬프트의 대사 예시를 모델이 인용구로 받아 그대로 돌려쓴 전례가 있다.
     시그니처 외의 캐릭터 대사를 새로 하드코딩하지 않는다 — 이 절들은
     「이런 행동을 할 수 있다」지 「이렇게 말해라」가 아니다. */
  eq('보강한 절에 새 대사가 없다', (() => {
    const quoted = (ja + mh).match(/「[^」]{6,}」/g) || [];
    /* 이미 문구집에 있는 것과 금지 예시로 든 것만 남는다 */
    const known = ['「그거 놓고 갔어요」', '「밥 먹어요」', '「왜 안 먹었어요」', '「알겠어요」',
      '「그 뒤에」', '「저 거기 있을게요」', '「그건 만나서요」',
      '「가까이 오지 마」', '「알았어요. 안 그럴게요.」', '「그럼 어디까지 괜찮아요?」',
      '「그럼 그냥 있을게요.」'];
    return quoted.filter(q => known.indexOf(q) < 0);
  })(), []);
  eq('불안하면 말이 달라진다',
    ['문장이 짧아진다', '물음표가 없어진다'].filter(k => !mh.includes(k)), []);
  /* 라이터는 안에서만 도는 단서다 — 매번 지문으로 꺼내면 효과음이 된다 */
  eq('라이터는 안에서만 돈다',
    mh.includes('괄호 지문이나 효과음으로 매번 꺼내지 않는다'), true);
  /* 거절을 다 같게 듣지 않는다 — 물러나는 것과 포기하는 것은 다르다 */
  eq('거절마다 다르게 답한다', mh.includes('물러설 때와 한 번 더 갈 때'), true);
  eq('물러나는 것과 포기가 다르다',
    mh.includes('물러나는 것과 포기하는 것은 다르다'), true);

  /* 재료지 대본이 아니다 — 이 절들이 고정 대사표가 되면 안 된다 */
  eq('행동 어휘지 대사표가 아니다',
    ja.includes('아래는 대사가 아니라 할 수 있는 행동이다')
    && mh.includes('아래는 대사가 아니라 볼 수 있는 것들이다'), true);
}

/* ══════════ 중요한 장면 ══════════
   여기서는 고르는 단계를 따로 안 탄다. 검사 둘이 나란히 돌아 경계를
   그어주고, 마무리하는 쪽이 그 안에서 후보 선택과 문장 완성을 함께 맡는다.
   정확성만큼 감정의 체온과 말하지 않은 것이 중요한 자리라 고르기만 해서는
   모자라기 때문이다. */
{
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  const { sceneTier, CRITICAL_REASONS, criticPacket, finalizerPacket, readProblems, sceneHead } = ENG;

  /* ── 무엇이 중요한지는 코드가 정한다 ──
     모델이 「이건 중요해 보여요」라고 말하는 것만으로 올리지 않는다.
     안 그러면 모든 턴이 중요해지고 값만 두 배가 된다. */
  eq('사유가 목록에 있어야 올라간다',
    sceneTier('그냥 중요해요', { partner: 'minhyun', days: 40, unlocked: ['x'] }).tier, 'normal');
  eq('상태가 받쳐줘야 올라간다',
    sceneTier('partner_confirm', { partner: null, days: 40, unlocked: ['x'] }).tier, 'normal');
  eq('둘 다 맞으면 올라간다',
    sceneTier('partner_confirm', { room: 'minhyun', partner: 'minhyun', days: 40, unlocked: [] }).tier, 'critical');
  eq('떠나는 날은 날짜가 받쳐줘야 한다',
    sceneTier('dday_choice', { partner: null, days: 3, unlocked: [] }).tier, 'normal');
  eq('해금이 없으면 기억 공개도 아니다',
    sceneTier('memory_reveal', { partner: null, days: 40, unlocked: [] }).tier, 'normal');
  eq('사유가 없으면 일반 턴이다', sceneTier('', {}).tier, 'normal');
  /* 단순한 질투·플러팅·다툼·선물·장소 이동은 목록에 없다 — 평소의 설렘은
     일반 경로에서도 나와야 한다 */
  eq('평범한 일은 목록에 없다',
    ['jealousy', 'flirt', 'fight', 'gift', 'move'].filter(k => CRITICAL_REASONS[k]), []);

  /* ── 검사 둘은 다른 것을 본다 ──
     하나는 정사만, 하나는 사람만. 같은 것을 보면 둘을 부를 이유가 없다. */
  eq('한쪽은 사실만 본다',
    /문장이 좋은지 나쁜지는 보지 않는다\. 사실만 본다\./.test(wk), true);
  eq('한쪽은 사람만 본다',
    /너는 이 사람이 이 사람다운지만 본다\. 사실 관계는 보지 않는다\./.test(wk), true);
  eq('검사 둘이 나란히 돈다', /Promise\.all\(\[\s*\n\s*callStage\(env, meter, "canon"/.test(wk), true);
  /* ── 마무리에게 세계를 준다 ──
     `system + "\n\n" + FINALIZER_RULES`였다. buildSystem은 블록 배열이라
     문자열과 더하면 "[object Object],[object Object]…"가 됐다 —
     이 작품에서 제일 중요한 자리를 세계관도 인물도 규칙도 없이 쓰고 있었다. */
  eq('마무리가 세계를 받는다',
    /const finalizerSystem = \[\.\.\.system, \{ type: "text", text: FINALIZER_RULES \}\]/.test(wk), true);
  /* 주석에는 남아 있다 — 왜 이렇게 됐는지가 거기 적혀 있다. 코드만 본다 */
  eq('문자열로 더하지 않는다', /[^`]system \+ "\\n\\n" \+ FINALIZER_RULES/.test(wk), false);
  /* push()면 같은 배열을 재시도 때 쓰는 쪽이 다시 받는다 — 규칙이 쌓인다 */
  eq('마무리 규칙을 원본에 밀어넣지 않는다', /system\.push\(/.test(wk), false);
  eq('마무리가 그 사본으로 불린다',
    /callStage\(env, meter, "finalizer",\s*\n\s*finalizerSystem,/.test(wk), true);

  /* ── 원문은 운영 로그에 안 남긴다 ──
     쓰는 쪽 응답 600자를 매 턴 찍고 있었다. 그건 대화 원문이다. */
  eq('응답 원문은 개발 플래그 뒤에 있다', (() => {
    const raw = wk.match(/^\s*(console\.log|devLog)\(`\[NULL\] (응답|기준선 응답)/gm) || [];
    return raw.length === 3 && raw.every(x => x.includes('devLog('));   // 일반·기준선 + §8.5 부분 호출
  })(), true);
  eq('플래그는 기본으로 꺼져 있다', /let DEV_LOG = false;/.test(wk), true);
  eq('플래그는 요청 진입에서 읽는다', /DEV_LOG = devFlag\(env\);/.test(wk), true);
  /* 갈래와 건수는 늘 남긴다 — 그게 없으면 어느 필터가 도는지도 모른다 */
  eq('버린 갈래는 플래그 없이도 남는다', (() => {
    const f = wk.slice(wk.indexOf('function dropped('), wk.indexOf('function dropMeta('));
    return /console\.log\(`\[NULL\] 버렸다 ▶ \$\{why\}`\)/.test(f) && /devLog\(/.test(f);
  })(), true);
  /* 검사도 마무리도 같은 장면을 봐야 한다 — 다른 장면을 보면 검사가 잡은
     것을 마무리가 이해할 수 없다 */
  eq('검사와 마무리가 같은 머리를 쓴다', (() => {
    const a = wk.slice(wk.indexOf('function criticPacket('), wk.indexOf('/* ── 못 읽은 것은'));
    const b = wk.slice(wk.indexOf('function finalizerPacket('), wk.indexOf('/* 안이 비치는 모양'));
    return a.includes('sceneHead(ctx)') && b.includes('sceneHead(ctx)');
  })(), true);

  /* ── 마무리는 경계 안에서만 쓴다 ── */
  eq('마무리가 새 사건을 못 만든다',
    /\[사실\]에 없는 사건·과거·유저 행동·유저 감정·관계 상태를 만드는 것/.test(wk), true);
  eq('마무리도 같은 검사줄을 탄다', (() => {
    const i = wk.indexOf('const fp = parseMessages(finRaw, fallbackSender, chars);');
    const box = wk.slice(i, i + 700);
    return box.includes('dropEcho(') && box.includes('sanitizePhotos(')
        && box.includes('hardFilter(fCand, chars, hardCtx)');
  })(), true);
  /* 위를 썼다고 빠져나가면 여기가 유일하게 안 걸러지는 자리가 된다 */
  eq('마무리가 걸리면 다시 쓴다', (() => {
    const i = wk.indexOf('const fCodes = hardFilter(fCand, chars, hardCtx);');
    return i > 0 && wk.slice(i, i + 140).includes('continue;');
  })(), true);
  eq('중요 장면은 고르는 단계를 안 탄다', (() => {
    const i = wk.indexOf('if (tier === "critical") {');
    const box = wk.slice(i, wk.indexOf('const packet = directorPacket(sceneCtx, cands);', i));
    return !box.includes('"director"');
  })(), true);

  /* 검사는 후보 전부를 한 번에 본다 — 어느 후보 것인지가 답에 남아야 한다.
     `.flat()`으로 합치던 때는 표식이 사라져 마무리가 어느 쪽을 고칠지 몰랐다. */
  const ALLOW = { candidates: new Set(['A', 'B']), facts: new Set(['gift.mug.user_to_jaeeon']) };
  eq('검사 답이 후보 표식을 지킨다',
    readProblems(JSON.stringify({ problems: [
      { candidate: 'A', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon', code: 'FACT_DENIAL' }] }),
      'canon', ALLOW).problems,
    [{ candidate: 'A', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon', code: 'FACT_DENIAL' }]);
  /* ── 못 읽은 것은 「문제 없음」이 아니다 ──
     전에는 파싱 실패에 빈 배열을 돌려줬다. 검사가 헛소리를 해도 깨끗하다고
     보고하고 넘어간다 — 검사가 있는데 없는 것과 같다. */
  eq('못 읽으면 다시 쓴다', readProblems('음 글쎄요', 'canon', ALLOW).ok, false);
  eq('problems가 배열이 아니면 다시 쓴다',
    readProblems(JSON.stringify({ problems: '없음' }), 'canon', ALLOW).ok, false);

  /* facts는 Fact[]다 — sceneHead가 마지막에 문장으로 바꾼다.
     here는 사실이 아니라 이번 턴의 조건이라 따로 담는다. */
  const ctx = { who: 'minhyun', when: '저녁', place: null, stage: '시한 · 30일째',
    knows: '병원 옥상', userName: '선생님',
    facts: [ENG.makeFact('item.mug.with_jaeeon', true, 'state', ['minhyun'])],
    here: ['상대가 정해졌다'], recent: [{ role: 'user', content: '너로 할게' }] };
  const cands = [{ id: 'A', messages: [{ text: '진짜요?' }], signals: [] },
                 { id: 'B', messages: [{ text: '알았어요.' }], signals: ['TOO_EXPLANATORY'] }];
  eq('꾸러미에 사실이 실린다',
    sceneHead(ctx).join('\n').includes('[사실] 이재언에게 회색 머그컵이 있다. · 상대가 정해졌다'), true);
  /* 꾸러미가 받는 것은 Fact[]다. 문장은 여기서 처음 만들어진다 —
     그래서 다음 단계가 fact_id를 그대로 들고 검사할 수 있다. */
  eq('꾸러미는 구조를 들고 있다', typeof ctx.facts[0].fact_id, 'string');
  const notes1 = [{ candidate: 'A', critic: 'canon', fact_id: 'gift.mug.user_to_jaeeon', code: 'FACT_DENIAL' }];
  eq('마무리 꾸러미에 검사 결과가 실린다',
    finalizerPacket(ctx, cands, notes1)
      .includes('- 후보 A · 사실 · FACT_DENIAL — gift.mug.user_to_jaeeon'), true);
  /* 사실이 틀린 것과 사람이 틀린 것은 고치는 법이 다르다 */
  eq('어느 검사가 잡았는지도 실린다',
    finalizerPacket(ctx, cands, [{ candidate: 'B', critic: 'character',
      rule_id: 'both.voice.no_counselor', code: 'COUNSELOR_TONE' }])
      .includes('- 후보 B · 사람 · COUNSELOR_TONE — both.voice.no_counselor'), true);
  eq('마무리 꾸러미도 짧다', finalizerPacket(ctx, cands, notes1).length < 900, true);

  /* ── 예약과 완료를 가른다 ──
     전에는 꺼내면서 지웠다. **요청을 보내기 전에** 지우는 것이라, 그 요청이
     실패하면 장면이 통째로 증발했다 — 고백도 기억 공개도 다시는 안 온다.
     한 번짜리인 것은 맞지만 「한 번 **성공**」이어야 한다. */
  const S = (() => {
    const store = {};
    globalThis.localStorage = { getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v)},
      removeItem:k=>{delete store[k]}, get length(){return Object.keys(store).length},
      key:i=>Object.keys(store)[i] };
    globalThis.location = { search:'' };
    globalThis.React = { useState:()=>[], useEffect:()=>{}, useRef:()=>({}) };
    const src = readFileSync(join(ROOT, 'app-data.js'), 'utf8');
    return new Function(src + ';return {markScene,peekScene,ackScene,SCENE_REASONS,'
      + 'pushAutoEvent,peekAutoEvent,ackAutoEvent,loadEffDone,saveEffDone}')();
  })();
  S.markScene('minhyun', 'partner_confirm');
  eq('예약한 것이 나온다', S.peekScene('minhyun'), 'partner_confirm');
  /* 읽어도 안 지운다 — 요청이 실패하면 다시 실려야 한다 */
  eq('읽어도 그대로 남는다', S.peekScene('minhyun'), 'partner_confirm');
  eq('성공해야 지운다', [S.ackScene('minhyun', 'partner_confirm'), S.peekScene('minhyun')],
    [true, '']);
  /* 같은 ack를 두 번 해도 상태가 같다 */
  eq('두 번 지워도 같다', S.ackScene('minhyun', 'partner_confirm'), false);
  /* 남의 장면을 대신 지우지 않는다 */
  eq('다른 방 것은 안 건드린다', (() => {
    S.markScene('jaeeon', 'confession'); S.markScene('minhyun', 'partner_known');
    S.ackScene('jaeeon', 'confession');
    return [S.peekScene('jaeeon'), S.peekScene('minhyun')];
  })(), ['', 'partner_known']);
  /* 그 사이 다른 사유가 예약됐으면 그건 아직 안 끝난 것이다 */
  eq('그 사이 바뀐 사유는 안 지운다', (() => {
    S.markScene('minhyun', 'confession');
    return [S.ackScene('minhyun', 'partner_known'), S.peekScene('minhyun')];
  })(), [false, 'confession']);
  S.ackScene('minhyun', 'confession');
  S.markScene('minhyun', '아무 말');
  eq('목록에 없는 말은 예약이 안 된다', S.peekScene('minhyun'), '');

  /* ── 관전 사건은 줄을 선다 ──
     전에는 한 칸이었다. 선물을 연달아 둘 주면 앞엣것이 그냥 사라졌다 —
     그 사건에 대한 두 사람의 대화가 영영 안 나온다. */
  eq('둘을 넣으면 둘 다 남는다', (() => {
    S.pushAutoEvent({ kind: 'gift', to: 'jaeeon', name: '머그컵' });
    S.pushAutoEvent({ kind: 'gift', to: 'minhyun', name: '편지지' });
    return S.peekAutoEvent().name;                     // 오래된 것부터
  })(), '머그컵');
  eq('실패하면 그대로 남는다', S.peekAutoEvent().name, '머그컵');
  eq('성공한 것만 지운다', (() => {
    S.ackAutoEvent(S.peekAutoEvent().id);
    return S.peekAutoEvent().name;                     // 둘째가 그대로 남아 있다
  })(), '편지지');
  eq('같은 사건은 두 번 안 들어간다', (() => {
    const a = S.pushAutoEvent({ kind: 'gift', to: 'minhyun', name: '편지지' });
    S.ackAutoEvent(S.peekAutoEvent().id);
    return [a, S.peekAutoEvent()];
  })(), [false, null]);
  eq('없는 것을 지워도 조용하다', S.ackAutoEvent('없는id'), false);

  /* ── 같은 사건을 두 번 새기지 않는다 ── */
  eq('적용한 id가 쌓이고 상한이 있다', (() => {
    S.saveEffDone(Array.from({ length: 250 }, (_, i) => `id${i}`));
    const a = S.loadEffDone();
    return [a.length, a[0], a[a.length - 1]];
  })(), [200, 'id50', 'id249']);
  /* 웹과 앱이 같은 낱말을 쓴다 — 다르면 서버가 한쪽만 승인한다 */
  eq('사유 낱말이 서버와 같다',
    S.SCENE_REASONS.filter(r => !CRITICAL_REASONS[r]), []);

  /* 고른 쪽과 안 고른 쪽은 같은 사건이지만 다른 장면이다 */
  eq('두 사람 다 이 일을 안다', (() => {
    const i = web.indexOf('const other=(got||id)==="jaeeon"?"minhyun":"jaeeon";');
    const box = web.slice(i, i + 300);
    return box.includes('markScene(got||id,"partner_confirm")')
        && box.includes('markScene(other,"partner_known")');
  })(), true);
  /* 재시도는 같은 요청이라 워커가 이미 그 사유를 봤다 */
  /* ── 재시도에도 싣는다 ──
     전에는 앱이 재시도면 뺐다. 「워커가 이미 봤다」는 전제였는데 워커는
     상태를 안 들고 있다 — 첫 호출이 실패하고 재시도하면 그 턴이 중요
     장면이 아니라 일반 턴으로 내려간다. 웹은 payload를 재사용해 그대로
     실려 있었고, 앱만 새 payload를 만들어서 빠졌다. */
  eq('재시도에도 사유가 실린다',
    /if\(!payload\.scene_reason\)\{[\s\S]{0,200}const why=peekScene\(bucket\);/.test(web)
    && /const why=peekScene\(room\);/.test(appSrc)
    && !/retry\?'':peekScene/.test(appSrc), true);
  /* 재시도는 같은 논리 요청이라 이름표도 같다 */
  eq('재시도가 같은 이름표를 쓴다',
    /const rid=startTurn\(room,retry\);/.test(appSrc), true);
  /* 답이 저장된 뒤에만 지운다 — 웹·앱 둘 다 */
  eq('성공한 뒤에 장면을 지운다',
    /scene_ack:\(payload\.scene_reason&&data&&data\.scene_ack===payload\.scene_reason\)\s*\n?\s*\?payload\.scene_reason:""/.test(web)
    && /ackScene\(b\.room,b\.scene_ack\);/.test(web) && /ackScene\(room,why\)/.test(appSrc), true);
  eq('앱도 같은 이름으로 보낸다',
    /sceneReason \? \{ scene_reason: sceneReason \} : \{\}/.test(apiSrc)
    && /loadPartner\(\) \? \{ partner: loadPartner\(\) \} : \{\}/.test(apiSrc), true);
}

/* ══════════ 이야기 상태와 장면 감지 — E-B ══════════
   ── 왜 상태 기계인가 ──
   「어디서 만났지」를 물었는데 민현이 「그럼 그냥 모르는 사람이네요」로
   도망갔다가 두 턴 뒤에야 설명했다. 규칙은 프롬프트에 있었다 — 없던 것은
   「질문이 아직 서 있다」는 상태다. 상태가 사실로 실려야 다음 턴에도
   압력이 남는다.
   ── 왜 감지가 워커에만 있나 (E4) ──
   기억·고백 정규식을 웹과 앱에 복제하면 두 판정이 갈리고, 갈린 것을
   아무도 모른다. 클라이언트는 화면의 선택(D-0·WHO)만 예약한다. */
{
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  const { approveReason, detectScene, sceneTier, storyFacts, materializeEffects,
          makeStoryState, factsForSpeaker, makeTurnContext, mintEffectId, makeEffect,
          MEMORY_PROBE, FIRSTMEET_ASK, FIRSTMEET_EXPLAIN, CONFESS_SAY, NULL_PROBE } = ENG;

  /* ── 감지 정밀도 — 오탐이 미탐보다 비싸다 (B단계의 교훈 그대로) ── */
  eq('기억 캐묻기 — 잡아야 할 것', [
    '선생님 혹시 저 어디서 본 적 있지 않아요?', '우리 전에 만난 적 있죠',
    '공부방 다니셨어요?', '사탕 목걸이 기억나요?', '20년 전에 무슨 일 있었어요?',
    '저 기억 안 나세요?', '저 아세요?',
  ].filter(t => !MEMORY_PROBE.test(t)), []);
  eq('기억 캐묻기 — 놓아줘야 할 것', [
    '어디서 봤더라 그 배우', '그 영화 본 적 있어요?', '기억력이 좋으시네요',
    '옛날 얘기 해주세요', '우리 반 애들 만난 적 있어요?', '어제 본 드라마 얘기예요',
    /* 적대 검증이 실행으로 재현한 오탐들 — 경험담·복합동사·어절 경계 */
    '나 그거 본 적 있어', '나 일본 가본 적 있어', '나 스키 타본 적 있어',
    '나 예전에 여기 와본 적 있어', '우리 그거 본 적 있지 않아?', '저 그거 본 적 있어요',
    '먼저 가본 적 있어요?', '나 요즘 기억력이 나빠졌어', '우리 약속 기억나요?',
  ].filter(t => MEMORY_PROBE.test(t)), []);
  eq('고백 — 잡아야 할 것', [
    '좋아해요', '좋아해', '선생님을 좋아해요', '선생님이 좋아요', '사랑해요',
    '사귀자', '사귀고 싶어요', '고백할 게 있어요', '너를 좋아해',
  ].filter(t => !CONFESS_SAY.test(t)), []);
  eq('고백 — 놓아줘야 할 것', [
    '저 떡볶이 좋아해요', '이 노래 좋아해요', '민트초코 좋아해요',
    '날씨가 좋아요', '기분이 좋아요', '쌤 오늘 기분 좋아요?',
    /* 적대 검증이 재현한 오탐들 — 무제약 사랑해·3인칭 진술 */
    '떡볶이 사랑해요', '민초 사랑해', '우리 엄마 사랑해', '부모님을 사랑해야지',
    '가사에 사랑해가 나와요', '학생들이 선생님을 좋아해요',
  ].filter(t => CONFESS_SAY.test(t)), []);
  eq('고백 — 사랑해도 사람을 향할 때다', [
    '사랑해요', '사랑해', '정말 사랑해', '선생님을 사랑해요', '너를 사랑해',
  ].filter(t => !CONFESS_SAY.test(t)), []);
  /* 1인칭 표지가 있어야 한다 — 「어디서 만났더라」 홀말은 제3자 얘기일 수
     있어 놓아준다. 못 잡으면 다음에 또 물으면 되지만, 헛잡으면 없던 질문이
     영속 상태(pending)로 선다. */
  eq('첫 만남 질문 — 잡아야 할 것', [
    '우리 어디서 만났지?', '나 어떻게 알아?', '우리 아는 사이야?', '우리 언제 만났더라',
    '우리 어디서 본 적 있지?',
  ].filter(t => !FIRSTMEET_ASK.test(t)), []);
  eq('첫 만남 질문 — 놓아줘야 할 것', [
    '내일 어디서 만나요?', '친구를 어떻게 알게 됐어?', '만나서 반가워',
    /* 적대 검증이 재현한 오탐들 — 제3자·진술·계획 */
    '삼촌이랑은 어떻게 만났어요?', '여자친구랑 어떻게 만났어요?', '고양이는 어디서 만났어?',
    '둘이 어디서 만난 거야?', '둘이 아는 사이야?', '재언 씨랑 아는 사이예요?',
    '옛날에 알던 사이처럼 편하네요', '어디서 만났는지 까먹었대', '우리 어제 만났잖아',
    '우리 언제 만나?',
  ].filter(t => FIRSTMEET_ASK.test(t)), []);
  /* ── 첫 선톡 바로 뒤의 정식 답들 (문구집 4019의 게이트) ──
     민현의 「저 알죠? / 책임진다면서요」 뒤에 유저가 실제로 치는 답은
     질문 문형이 아니다. 직전 발화가 그 선톡일 때만 질문으로 센다. */
  {
    const OPEN = '선생님이 저 책임진다면서요.';
    const REPLIES = ['무슨 말이에요', '뭔 소리예요', '무슨 소리야', '네?', '누구세요',
      '기억 안 나는데', '무슨 책임이요', '뭘 책임져요', '제가요?'];
    eq('첫 선톡 뒤의 정식 답이 전부 걸린다', REPLIES.filter(t =>
      !(ENG.FIRSTMEET_OPEN.test(OPEN) && ENG.FIRSTMEET_REPLY.test(t))), []);
    eq('「저 알죠?」 뒤에도 걸린다',
      ENG.FIRSTMEET_OPEN.test('저 알죠?'), true);
    /* 같은 말이 평범한 대화 뒤에서는 질문이 아니다 */
    eq('평범한 말 뒤의 「네?」는 질문이 아니다', REPLIES.filter(t =>
      ENG.FIRSTMEET_OPEN.test('내일 시험이에요.') && ENG.FIRSTMEET_REPLY.test(t)), []);
    eq('직접 질문 경로는 그대로다', FIRSTMEET_ASK.test('우리 어디서 만났지?'), true);
  }

  /* 설명 판정 — 낱말 하나가 아니라 병원 옥상이라는 짝이거나 만난 문장이다 */
  eq('설명 판정 — 잡아야 할 것', [
    '병원 옥상에서 만났잖아요.', '옥상에서 봤잖아요.', '재활하던 병원요.', '재활 치료 받던 데요.',
  ].filter(t => !FIRSTMEET_EXPLAIN.test(t)), []);
  eq('설명 판정 — 놓아줘야 할 것', [
    '병원 가 봐요. 약도 챙기고.', '감기 걸리면 병원 가요', '옥상에서 컵라면 먹었어요',
    '재활용 쓰레기 버리고 올게요', '옥상 문 잠겼던데요',
  ].filter(t => FIRSTMEET_EXPLAIN.test(t)), []);

  /* ── 받아들임 판정 (explained → recognized) ──
     설명했다와 통했다는 다른 사건이다. 여기서 보는 것은 유저 발화고,
     기억해냈는지가 아니라 사실로 받아들였는지다 — 유저는 끝까지 기억 못 한다.
     부정이 이긴다: 수긍하는 말이 같이 있어도 부정이 있으면 안 넘어간다. */
  const takes = t => ENG.FIRSTMEET_TAKE.test(t) && !ENG.FIRSTMEET_DENY.test(t);
  eq('받아들임 — 잡아야 할 것', [
    '아 그때 그 사람이구나.', '그랬구나. 기억은 안 나는데.', '그런 일이 있었네요.',
    '그랬나 봐요.', '아 옥상이었어요?',
  ].filter(t => !takes(t)), []);
  eq('받아들임 — 놓아줘야 할 것', [
    '누구세요?', '그런 적 없는데요.', '모르겠는데요.',
    '사람 잘못 보신 것 같아요.', '오늘 날씨 좋네요.',
    '그랬구나. 근데 사람 잘못 보신 것 같은데요.',   // 부정이 이긴다
  ].filter(t => takes(t)), []);

  /* ── 사유별 승인 조건 (E6) — 뭉뚱그리지 않는다 ── */
  const ST0 = { firstContact: 'unseen', jaeeonMemory: 'hidden',
                partnerKnown: { jaeeon: false, minhyun: false } };
  const CTX = o => ({ room: 'jaeeon', mode: 'chat', greet: false, partner: null,
    days: 10, unlocked: [], story: ST0, originPhase: '', lastUser: '', lastChar: '',
    stageIdx: 1, ...o });
  eq('기억 공개 — 캐묻는 말이면 승인',
    approveReason('memory_reveal', CTX({ lastUser: '저 어디서 본 적 있지 않아요?' })), true);
  eq('기억 공개 — 민현 방에서는 아니다',
    approveReason('memory_reveal', CTX({ room: 'minhyun', lastUser: '저 어디서 본 적 있지 않아요?' })), false);
  eq('기억 공개 — 재언 일기가 열렸으면 승인',
    approveReason('memory_reveal', CTX({ unlocked: ['hidden-jaeeon-diary-200x-03-07'] })), true);
  /* 다른 캐릭터의 히든이나 무관한 해금은 승인 근거가 아니다 */
  eq('기억 공개 — 무관한 해금으로는 안 열린다',
    approveReason('memory_reveal', CTX({ unlocked: ['minhyun-bag', 'jaeeon-playlist', 'hidden-minhyun-sns-1'] })), false);
  eq('기억 공개 — 이미 인정했으면 다시 없다',
    approveReason('memory_reveal', CTX({ lastUser: '공부방 기억나요?',
      story: { ...ST0, jaeeonMemory: 'acknowledged' } })), false);
  eq('고백 — 처음 단계에서는 장면이 아니다',
    approveReason('confession', CTX({ stageIdx: 0, lastUser: '좋아해요' })), false);
  eq('고백 — 단계가 차고 실제 발화면 승인',
    approveReason('confession', CTX({ lastUser: '좋아해요' })), true);
  eq('고백 — 떡볶이는 고백이 아니다',
    approveReason('confession', CTX({ lastUser: '저 떡볶이 좋아해요' })), false);
  eq('정체 — 출처 상태·직전 문답·되물음 셋이 다 맞아야 한다',
    [approveReason('null_identity', CTX({ originPhase: 'revealed_from_start',
       lastChar: '처음부터.', lastUser: '처음부터라니 무슨 말이에요?' })),
     approveReason('null_identity', CTX({ originPhase: 'revealed_from_start',
       lastChar: '네.', lastUser: '무슨 말이에요?' })),
     approveReason('null_identity', CTX({ originPhase: 'claimed_told',
       lastChar: '처음부터.', lastUser: '무슨 말이에요?' }))], [true, false, false]);
  /* CTX 기본 방이 jaeeon이다 — 다른 쪽 방에서만 「처음 안다」가 열린다 */
  eq('처음 아는 자리 — 상대가 있고, 다른 쪽 방이고, 아직 모를 때만',
    [approveReason('partner_known', CTX({ partner: 'minhyun' })),
     approveReason('partner_known', CTX({ partner: 'minhyun',
       story: { ...ST0, partnerKnown: { jaeeon: true, minhyun: false } } })),
     approveReason('partner_known', CTX({ partner: 'jaeeon' })),   // 본인 방이다
     approveReason('partner_known', CTX({}))], [true, false, false, false]);
  eq('정해지는 자리는 본인 방에서만',
    [approveReason('partner_confirm', CTX({ partner: 'jaeeon' })),
     approveReason('partner_confirm', CTX({ partner: 'minhyun' }))], [true, false]);
  /* 아직 코드가 확인할 상태 근거가 없는 사유는 안 올린다 */
  eq('근거 없는 사유는 예약해도 안 올라간다',
    [approveReason('irreversible', CTX({})), approveReason('conflict_result', CTX({}))],
    [false, false]);

  /* ── 감지는 예약 없이도 올린다. 화면 선택 사유는 감지로 안 올린다 ── */
  eq('예약이 없어도 말이 그 장면이면 올라간다',
    sceneTier('', CTX({ lastUser: '공부방 기억나요?' })), { tier: 'critical', reason: 'memory_reveal' });
  /* 히든 키는 문을 열어두는 것이지 문을 지나는 것이 아니다 — 감지에 쓰면
     일기가 열린 날부터 「점심 뭐 먹지」까지 전부 중요 장면이 된다 */
  eq('상태만으로는 감지가 안 오른다',
    detectScene(CTX({ unlocked: ['hidden-jaeeon-diary-200x-03-07'], lastUser: '점심 뭐 먹지' })), '');
  eq('그 상태에서 예약하면 오른다',
    sceneTier('memory_reveal', CTX({ unlocked: ['hidden-jaeeon-diary-200x-03-07'],
      lastUser: '점심 뭐 먹지' })).tier, 'critical');
  eq('선톡 턴에는 감지가 없다',
    detectScene(CTX({ greet: true, lastUser: '공부방 기억나요?' })), '');
  eq('관전 경로에는 감지가 없다',
    detectScene(CTX({ mode: 'auto', lastUser: '공부방 기억나요?' })), '');
  /* 감지의 재료는 이력 **맨 끝**의 유저 발화다. 끝이 지문이면 이번 턴에
     유저는 아무 말도 안 한 것 — 지난 턴의 캐묻기를 다시 집으면 선물 턴이
     그 캐묻기로 또 올라가고 상태가 한 칸 더 갔다(적대 검증이 재현). */
  eq('이력 끝이 지문이면 이번 턴 발화가 없다', ENG.lastUserUtterance([
    { role: 'user', content: '공부방 기억나요?' },
    { role: 'assistant', content: '…' },
    { role: 'user', kind: 'event', content: '이재언이 회색 머그컵을 받았다' },
  ]), '');
  eq('이력 끝이 유저 말이면 그 말이다', ENG.lastUserUtterance([
    { role: 'user', content: '공부방 기억나요?' },
  ]), '공부방 기억나요?');
  eq('거절된 예약이라도 감지가 잡으면 그 사유로 간다',
    sceneTier('partner_known', CTX({ lastUser: '공부방 기억나요?' })).reason, 'memory_reveal');
  eq('D-0·WHO는 감지 목록에 없다', (() => {
    const t = wk.slice(wk.indexOf('function detectScene('), wk.indexOf('function sceneTier('));
    return t.includes('"memory_reveal"') && t.includes('["confession", "null_identity"]')
      && !/dday_choice|partner_confirm|partner_known/.test(t);
  })(), true);

  /* ── 이야기 상태는 사실이 되어 화자별로 투영된다 ── */
  eq('기본값은 사실을 안 만든다 — 없는 것은 unknown이다', storyFacts(makeStoryState({})), []);
  {
    const F = storyFacts(makeStoryState({ firstContact: 'pending', jaeeonMemory: 'acknowledged',
      partnerKnown: { jaeeon: true, minhyun: false } }));
    const ctx = makeTurnContext({}, { facts: F });
    eq('민현의 서 있는 질문은 민현이 안다',
      factsForSpeaker(ctx, 'minhyun').map(f => f.fact_id).includes('story.first_contact.pending'), true);
    eq('재언은 그 질문을 모른다 — 방이 다르다',
      factsForSpeaker(ctx, 'jaeeon').map(f => f.fact_id).includes('story.first_contact.pending'), false);
    eq('재언의 인정은 재언이 안다',
      factsForSpeaker(ctx, 'jaeeon').map(f => f.fact_id).includes('story.jaeeon_memory.acknowledged'), true);
    eq('민현은 삼촌의 기억을 모른다',
      factsForSpeaker(ctx, 'minhyun').some(f => f.fact_id.startsWith('story.jaeeon_memory')), false);
    eq('상대를 아는 것도 그 사람만',
      [factsForSpeaker(ctx, 'jaeeon').some(f => f.fact_id === 'story.partner_known.jaeeon'),
       factsForSpeaker(ctx, 'minhyun').some(f => f.fact_id === 'story.partner_known.minhyun')], [true, false]);
  }

  /* ── 「안다」에는 누구인지가 들어 있어야 한다 ──
     최근 대화가 잘리면 이 사실이 유일한 근거다. 정해졌다는 것만 남고
     누구인지가 없으면, 재언은 자기가 선택됐는지도 모른다. */
  {
    const one = who => storyFacts(makeStoryState({ partnerId: 'jaeeon',
      partnerKnown: { [who]: true } })).map(f => f.value).join(' ');
    eq('본인은 자신이 선택된 것을 안다', one('jaeeon').includes('유저가 자신을 상대로 정했다'), true);
    eq('다른 쪽은 누가 선택됐는지 안다', one('minhyun').includes('유저가 이재언을 상대로 정했다'), true);
    const rev = storyFacts(makeStoryState({ partnerId: 'minhyun',
      partnerKnown: { jaeeon: true } })).map(f => f.value).join(' ');
    eq('반대 방향도 정확하다', rev.includes('유저가 이민현을 상대로 정했다'), true);
    /* 둘 다 알면 공유 사실 하나가 되어 단톡 교집합에 실린다 */
    const both = storyFacts(makeStoryState({ partnerId: 'jaeeon',
      partnerKnown: { jaeeon: true, minhyun: true } }));
    const ctx2 = makeTurnContext({}, { facts: both });
    eq('둘 다 알면 공유 사실이 된다',
      [both.map(f => f.fact_id), ENG.sharedFactsForRoom(ctx2, ['jaeeon', 'minhyun']).length],
      [['story.partner_known.both'], 1]);
    /* 한쪽만 알 때는 교집합에 없다 — 공동방에 새지 않는다 */
    const half = makeTurnContext({}, { facts: storyFacts(makeStoryState({ partnerId: 'jaeeon',
      partnerKnown: { minhyun: true } })) });
    eq('한쪽만 알면 공동방에 없다', ENG.sharedFactsForRoom(half, ['jaeeon', 'minhyun']), []);
    /* 그 장면이 벌어지는 턴 — 아직 안 뒤집힌 상태에서도 누구인지가 실린다 */
    eq('정해지는 턴의 사실', ENG.partnerSceneFacts('partner_confirm', 'jaeeon', 'jaeeon')
      .map(f => [f.fact_id, f.known_by.join('·')]),
      [['story.partner_choice.confirm', 'jaeeon·user']]);
    eq('처음 아는 턴의 사실은 누구인지를 말한다',
      ENG.partnerSceneFacts('partner_known', 'minhyun', 'jaeeon')[0].value.includes('이재언을 상대로 정했다'), true);
    eq('상대가 없으면 장면 사실도 없다', ENG.partnerSceneFacts('partner_confirm', 'jaeeon', null), []);
    /* TurnContext도 상대를 안다 — 모르는 값은 null로 눌린다 */
    eq('문맥이 상대를 든다', [
      makeTurnContext({ partnerId: 'jaeeon' }, {}).partnerId,
      makeTurnContext({ partnerId: 'minhyun' }, {}).partnerId,
      makeTurnContext({ partnerId: '몰라' }, {}).partnerId,
    ], ['jaeeon', 'minhyun', null]);
  }
  /* ── 처음 아는 자리는 다른 쪽의 정확한 1:1 방뿐이다 ──
     room ≠ partner로만 걸면 group·health까지 지나간다 */
  eq('공동방에서는 처음 아는 장면이 안 열린다',
    ['group', 'health', 'jaeeon'].map(r =>
      approveReason('partner_known', CTX({ room: r, partner: 'jaeeon' }))), [false, false, false]);
  eq('다른 쪽 1:1만 열린다 — 두 방향',
    [approveReason('partner_known', CTX({ room: 'minhyun', partner: 'jaeeon' })),
     approveReason('partner_known', CTX({ room: 'jaeeon', partner: 'minhyun' }))], [true, true]);
  eq('첫 반응도 본인 방에서만',
    [approveReason('partner_first_reaction', CTX({ room: 'jaeeon', partner: 'jaeeon' })),
     approveReason('partner_first_reaction', CTX({ room: 'minhyun', partner: 'jaeeon' }))], [true, false]);

  /* ── 전환은 검증된 응답 뒤에만, 코드가 만든다 (E3) ── */
  const CAND = texts => ({ id: 'A', originalMessages: [], messages: texts.map(t => ({ text: t })),
    invite: '', give: '', photo: '', parseStatus: 'json', signals: [] });
  const MC = o => ({ room: 'minhyun', story: makeStoryState({}), sceneReason: '', firstMeetAsked: false, ...o });
  eq('물었고 설명했으면 unseen→explained', materializeEffects('r1',
    CAND(['병원 옥상에서 만났잖아요.']), MC({ firstMeetAsked: true })),
    [{ id: mintEffectId('r1', 'story_transition', 'firstContact', 'explained'),
       type: 'story_transition', key: 'firstContact', from: 'unseen', to: 'explained' }]);
  eq('물었는데 도망갔으면 unseen→pending — 질문이 서 있는다', materializeEffects('r1',
    CAND(['그럼 그냥 모르는 사람이네요.']), MC({ firstMeetAsked: true }))[0].to, 'pending');
  eq('서 있던 질문에 설명하면 pending→explained', materializeEffects('r1',
    CAND(['재활하던 병원요.']), MC({ story: makeStoryState({ firstContact: 'pending' }) })),
    [{ id: mintEffectId('r1', 'story_transition', 'firstContact', 'explained'),
       type: 'story_transition', key: 'firstContact', from: 'pending', to: 'explained' }]);
  eq('서 있는데 또 딴소리면 그대로 남는다', materializeEffects('r1',
    CAND(['배고파요.']), MC({ story: makeStoryState({ firstContact: 'pending' }) })), []);
  eq('안 물었으면 아무것도 안 움직인다', materializeEffects('r1', CAND(['안녕하세요.']), MC({})), []);
  const JC = o => ({ room: 'jaeeon', story: makeStoryState({}), sceneReason: 'memory_reveal', ...o });
  eq('기억 공개 장면이 끝까지 가면 hidden→opened',
    materializeEffects('r1', CAND(['…그때 그 공부방.']), JC({}))[0].to, 'opened');
  /* 승인된 장면이라도 답이 기억을 한 마디도 안 건드리면 안 움직인다 —
     장면은 다시 오면 되지만 전진은 되돌릴 수 없다 */
  eq('도망간 답에는 기억이 안 움직인다',
    materializeEffects('r1', CAND(['…아뇨. 밥은 먹었어요?']), JC({})), []);
  /* 선톡 턴에는 상태가 안 움직인다 — 유저의 턴이 아니다 */
  eq('선톡 턴에는 전환이 없다', [
    materializeEffects('r1', CAND(['…그때 그 공부방.']), JC({ greet: true })),
    materializeEffects('r1', CAND(['병원 옥상에서 만났잖아요.']),
      MC({ firstMeetAsked: true, greet: true }))], [[], []]);
  eq('두 번째 공개가 인정이다 — opened→acknowledged',
    materializeEffects('r1', CAND(['그 아이가 너였다.']),
      JC({ story: makeStoryState({ jaeeonMemory: 'opened' }) }))[0].to, 'acknowledged');
  eq('인정한 뒤에는 더 갈 데가 없다', materializeEffects('r1', CAND(['네.']),
    JC({ story: makeStoryState({ jaeeonMemory: 'acknowledged' }) })), []);
  eq('승인 없는 턴에는 기억이 안 움직인다', materializeEffects('r1', CAND(['공부방…']),
    JC({ sceneReason: '' })), []);
  eq('같은 재료면 같은 id다 — 재시도가 두 번 세지 않는다',
    materializeEffects('r1', CAND(['병원 옥상에서 봤잖아요.']), MC({ firstMeetAsked: true }))[0].id,
    materializeEffects('r1', CAND(['병원 옥상에서 만났어요.']), MC({ firstMeetAsked: true }))[0].id);
  eq('전환은 뒤로 못 간다', (() => {
    try { makeEffect('r', { type: 'story_transition', key: 'jaeeonMemory', from: 'opened', to: 'hidden' }); return 'ok'; }
    catch (e) { return 'throw'; }
  })(), 'throw');

  /* ── E4 — 감지는 워커에만 있다 ──
     재언의 옛 일기(③) 문안에는 「공부방」과 「사탕」이 그대로 들어 있다.
     그건 감지가 아니라 화면에 그리는 글이고, 확정 문안이라 글자를 못 바꾼다.
     그 덩어리만 잘라내고 나머지에 같은 검사를 건다 — 클라이언트가 그 말을
     **찾기 시작하면** 여전히 걸린다. */
  const CUT_DIARY = src =>
    src.replace(/\/\* ── 재언의 옛 일기 ──[^]*?const DIARY_MAX ?= ?\d+;/g, '');
  eq('클라이언트에 기억·고백 정규식이 없다',
    [/공부방|사탕\s*목걸이/.test(CUT_DIARY(web)), /공부방|사탕/.test(CUT_DIARY(appSrc)),
     /MEMORY_PROBE|CONFESS_SAY|FIRSTMEET_ASK/.test(web + appSrc)], [false, false, false]);
  /* 문안은 글이지 자가 아니다 — 그 덩어리 안에 찾는 코드가 없어야 한다 */
  eq('일기 문안은 찾는 코드가 아니다', (() => {
    const m = web.match(/\/\* ── 재언의 옛 일기 ──[^]*?const DIARY_MAX ?= ?\d+;/);
    return !m || /RegExp|\.test\(|\.match\(|\.exec\(/.test(m[0]);
  })(), false);
  /* 잘라낸 게 진짜 그 덩어리인지 — 아무것도 안 잘렸으면 위 검사가 헛돈다 */
  eq('잘라낸 덩어리에 그 말이 들어 있다',
    /공부방/.test(web.match(/\/\* ── 재언의 옛 일기 ──[^]*?const DIARY_MAX ?= ?\d+;/)[0]), true);
  eq('클라이언트가 예약하는 것은 화면의 선택뿐이다',
    [...web.matchAll(/markScene\([^,]+,"([a-z_]+)"\)/g)].map(m => m[1])
      .filter(r => !['dday_choice', 'partner_confirm', 'partner_known'].includes(r)), []);
  eq('관전방 예약이 사라졌다 — 죽은 배선이었다',
    /markScene\("health"/.test(web), false);
  /* 상태는 클라이언트가 나르고, 판정은 워커가 한다 */
  eq('웹이 이야기 상태를 실어 보낸다',
    /payload\.story=loadStory\(\);/.test(web)
    && /payload\.origin_phase=originPhase\(bucket\)/.test(web), true);
  eq('앱도 같은 이름으로 실어 보낸다',
    /story: loadStory\(\),/.test(apiSrc) && /origin_phase: originPhase\(room\)/.test(apiSrc), true);

/* ── ③ 재언 일기의 빈칸은 서버로 안 간다 ──
   문서의 「서버 전달 경계」다. 서버로 가는 빈칸은 민현 온보딩(④) 하나뿐이고,
   재언 일기는 유저만의 비밀이라 브라우저 밖으로 안 나간다.

   글자로 재지 않는다 — 「payload에 안 넣었다」는 소스를 읽어서는 증명이 안
   된다. 실제로 보내는 함수를 돌려서 **나간 본문**을 뒤진다. */
{
  const mem = new Map();
  const g = { localStorage: { getItem: k => mem.has(k) ? mem.get(k) : null,
      setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() },
    location: { search: '' } };
  const D = new Function('localStorage', 'location',
    readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
    + '\nreturn {saveDiary,loadDiary,DIARY_MAX,DIARY_LINES,DIARY_HEAD,DIARY_TAIL_A,DIARY_TAIL_B,loadStory};')(g.localStorage, g.location);
  const SECRET = '어린애';
  eq('채운 값이 저장된다', [D.saveDiary(SECRET), D.loadDiary()], [SECRET, SECRET]);
  /* 이야기 상태(서버로 가는 것)에는 안 섞인다 */
  eq('이야기 상태에 안 섞인다', JSON.stringify(D.loadStory()).includes(SECRET), false);
  /* 저장 자리도 따로다 — 이야기 상태와 같은 열쇠를 쓰면 언젠가 같이 실려 나간다 */
  eq('저장 열쇠가 이야기 상태와 다르다',
    [...mem.keys()].filter(k => k !== 'null_diary'), []);
  /* 소스 쪽 계약도 같이 못박는다 — payload에 손대는 자리에 이 값이 없다 */
  eq('보내는 자리에 일기 값이 없다', (() => {
    const send = web.slice(web.indexOf('payload.request_id=rid;'), web.indexOf('payload.story=loadStory();') + 200);
    return /loadDiary|null_diary/.test(send);
  })(), false);
  eq('어떤 payload 줄에도 안 실린다',
    [...web.matchAll(/payload\.[A-Za-z_]+ *= *([^;\n]+)/g)].map(m => m[1])
      .filter(v => /loadDiary|null_diary|DIARY/.test(v)), []);
  /* 프롬프트로도 안 간다 — 워커가 그 이름을 아예 모른다 */
  eq('워커는 그 값을 모른다',
    /null_diary|loadDiary|DIARY_TAIL/.test(readFileSync(join(ROOT, 'worker.js'), 'utf8')), false);
  /* 확정 문안 — 글자 그대로다. 한 글자라도 바뀌면 20년 전 그 아이의 글이 아니다 */
  eq('일기 문안이 글자 그대로다',
    [D.DIARY_HEAD, ...D.DIARY_LINES, D.DIARY_TAIL_A + 'ㅁ' + D.DIARY_TAIL_B],
    ['200X.XX.XX',
     '엄마가 이제 이사를 간다고 공부방을 안 한다고 했다.',
     '나는 속상해서 울었는데 엄마가 사탕을 줬다.',
     '그래도 계속 눈물이 났다.',
     '나중에 크면 다시 이 동네에 올 거다.',
     '왜냐하면 나는 ㅁ니까.']);
  /* 「엄마가 사탕을 줬다」에서 멈춘다 — 누구에게 줬는지는 어떤 화면도 발설하지 않는다 */
  eq('사탕을 누구에게 줬는지는 안 적는다',
    D.DIARY_LINES.some(l => /목걸이|재언|민현|삼촌/.test(l)), false);
}

/* ══════════ ④ 엽서 뒷면 — 나가는 유일한 빈칸 ══════════
   문서의 「서버 전달 경계」: 서버로 가는 빈칸은 민현 온보딩(④) 하나뿐이고
   재언 일기(③)·이름(⑤)·히든(⑥)·선물(⑧)은 전부 클라이언트 온리다.
   ④는 나가되 **가변부에만** 나간다 — 고정부에 넣으면 값이 바뀔 때마다
   캐시가 통째로 깨진다. */
{
  const mem = new Map();
  const ls = { getItem: k => mem.has(k) ? mem.get(k) : null,
    setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() };
  const D = new Function('localStorage', 'location',
    readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
    + '\nreturn {saveFlash,loadFlash,flashSayLine,flashSaid,markFlashSaid,FLASH_SAY_A,FLASH_SAY_B,FLASH_KEYS};')(ls, { search: '' });

  /* ── 복귀 대사는 조립이다 ── 모델을 안 부른다 */
  eq('아직 안 채웠으면 나갈 줄이 없다', D.flashSayLine(), null);
  D.saveFlash({ face: '이상한', said: '진짜요', wish: '또 보고' });
  eq('둘째 칸만 끼운다', D.flashSayLine(), '선생님, 그때 제가 진짜요라고 했잖아요.');
  /* 셋을 한 번에 쏟으면 되울림이 아니라 요약이 된다 — 나머지 둘은 안 들어간다 */
  eq('나머지 둘은 이 줄에 없다',
    /이상한|또 보고/.test(D.flashSayLine()), false);
  /* 「___라고」는 인용 구문이라 받침이 뭐든 조사가 안 깨진다 */
  eq('받침이 달라도 문장이 안 깨진다', (() => {
    const out = [];
    for (const w of ['네', '싫어', '책임져요', '몰라']) {
      D.saveFlash({ face: 'x', said: w, wish: 'y' });
      out.push(D.flashSayLine());
    }
    return out;
  })(), ['선생님, 그때 제가 네라고 했잖아요.', '선생님, 그때 제가 싫어라고 했잖아요.',
         '선생님, 그때 제가 책임져요라고 했잖아요.', '선생님, 그때 제가 몰라라고 했잖아요.']);
  /* 한 번만 나간다. null_flash가 차 있다는 것만으로는 「아직 안 했다」와
     「이미 했다」를 못 가르므로 도장을 따로 찍는다 */
  eq('처음엔 도장이 없다', D.flashSaid(), false);
  eq('찍으면 남는다', [D.markFlashSaid(), D.flashSaid()], [true, true]);
  /* 도장을 못 찍으면 안 내보낸다 — 내보내고 못 적으면 다음 턴에 또 온다 */
  eq('못 적으면 안 내보낸다',
    /if\(line&&markFlashSaid\(\)\)\{/.test(web), true);
  /* 덮은 그 턴이 아니라 **다음 턴**이다 */
  eq('되보내는 턴에는 안 나간다',
    /if\(!resumed&&room==="minhyun"&&loadFlash\(\)&&!flashSaid\(\)\)\{/.test(web), true);
  /* 모델을 안 부른다 — originGate와 같은 층이다 */
  eq('모델을 안 부른다', (() => {
    const i = web.indexOf('if(!resumed&&room==="minhyun"&&loadFlash()&&!flashSaid())');
    const blk = web.slice(i, web.indexOf('const lastSaid=', i));
    return [/enqueue\(room,\[\{sender:"minhyun",text:line\}\]\)/.test(blk), /request\(/.test(blk)];
  })(), [true, false]);

  /* ── 나가되 가변부에만 ── */
  eq('민현 방에서만 싣는다',
    /if\(bucket==="minhyun"\)\{ const fl=loadFlash\(\); if\(fl\)payload\.flash=fl; \}/.test(web), true);
  const B = ENG.buildFlash;
  const F = { face: '이상한', said: '진짜요', wish: '또 보고' };
  eq('재언 방에는 안 실린다', B(F, 'jaeeon'), '');
  eq('단톡·관전에도 안 실린다', [B(F, 'group'), B(F, 'health')], ['', '']);
  eq('안 채웠으면 줄이 없다', [B(null, 'minhyun'), B({}, 'minhyun')], ['', '']);
  eq('셋이 다 들어간다', (() => {
    const t = B(F, 'minhyun');
    return [t.includes('"이상한"'), t.includes('"진짜요"'), t.includes('"또 보고"')];
  })(), [true, true, true]);
  /* 사진에 적힌 틀과 같은 말로 적어야 한다. 원화가 마지막 줄을
     「□ 하고 싶다」에서 「□고 싶다」로 고쳐 오면서 빈칸이 동사 어간을
     받게 됐다 — 워커가 「"또 보고" 하고 싶다」라고 적으면 두 벌이 된다 */
  eq('소망 문장이 사진과 같은 틀이다',
    B({ wish: '또 보고' }, 'minhyun').includes('다시 만나면 "또 보고"고 싶다고 적혀 있다'), true);
  /* 유저가 지어낸 그날의 말이지 정사가 아니다 — 확인·인용을 시키지 않는다 */
  eq('읊지 말라고 적혀 있다',
    /확인받으려 하지 않고, 그대로 읊지도 않는다/.test(B(F, 'minhyun')), true);
  /* 채운 값이 길어도 프롬프트가 안 부푼다 */
  eq('한 칸에 스무 자까지', (() => {
    const t = B({ said: '가'.repeat(80) }, 'minhyun');
    return t.includes('가'.repeat(21));
  })(), false);

  /* ⚠️ 고정부에는 절대 안 간다. 고정부를 짓는 함수가 이 값을 아예 못 본다 */
  eq('고정부는 이 값을 모른다', (() => {
    const sys = ENG.buildSystem('chat', 'minhyun', '연', null, [], null, null, null, null, null, 3, '');
    return JSON.stringify(sys).includes('이상한') || JSON.stringify(sys).includes('병원 옥상, 그날');
  })(), false);
  eq('고정부 조립에서 buildFlash를 안 부른다', (() => {
    const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
    const i = wk.indexOf('function buildSystem(');
    const blk = wk.slice(i, wk.indexOf('\nfunction ', i + 10));
    return /buildFlash/.test(blk);
  })(), false);

  /* ── 엽서를 끝까지 채우면 민현이 말한 것이다 ── */
  eq('덮으면 explained로 간다',
    /applyStoryTransition\(\{key:"firstContact",to:"explained"\}\)/.test(web), true);
  /* recognized까지 여기서 찍지 않는다 — 그건 유저가 받아들인 자리고 대화가 정한다 */
  eq('recognized는 여기서 안 찍는다',
    /applyStoryTransition\(\{key:"firstContact",to:"recognized"\}\)/.test(web), false);
}

/* ══════════ ⑥ 히든 제목 빈칸 · ⑧ 선물 빈칸 ══════════
   ⑥ 잠긴 칸의 □는 원래 「몇 글자짜리 이름인가」만 알려주는 표시였다. 이제
   그 자리에 커서가 서고, 제목을 맞히면 그 칸이 열린다. 퀴즈가 아니다 —
   맞았다고도 틀렸다고도 알려주는 화면이 없다. 열린 칸이 답이다.

   ⑧ 선물 쪽지는 빈 종이가 아니라 틀이다. 채우는 것은 「받고 어떻게 되면
   좋겠는가」 한 자리뿐이고, 인물에게는 조립된 문장 한 줄이 간다. */
{
  const mem = new Map();
  const ls = { getItem: k => mem.has(k) ? mem.get(k) : null,
    setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() };
  const D = new Function('localStorage', 'location',
    readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
    + '\nreturn {hidMask,hidGuess,HID_MAX,HIDDEN,HIDDEN_LABEL,giftNote,GIFT_WISH_MAX,GIFT_NOTE_A,GIFT_NOTE_B};')(ls, { search: '' });
  const appSrc2 = readFileSync(join(ROOT, 'app/App.tsx'), 'utf8');

  /* □ 하나가 글자 하나다 — 그게 유일한 힌트라 개수가 어긋나면 못 맞힌다 */
  eq('□는 글자 수를 말한다', D.hidMask('재언의 가방'), '□□□ □□');
  eq('빈 자리는 그대로 둔다', D.hidMask('민현 상담 기록 · 1'), '□□ □□ □□ □ □');
  /* 제목을 그대로 치면 열린다. 띄어쓰기와 가운뎃점은 안 본다 —
     몇 글자인지는 □가 이미 말해줬으니 막히는 건 낱말이어야지 서식이면 안 된다 */
  eq('제목을 치면 맞는다', [
    D.hidGuess('jaeeon-bag', '재언의 가방'),
    D.hidGuess('jaeeon-bag', '재언의가방'),
    D.hidGuess('hidden-jaeeon-diary-200x-03-07', '재언의 일기 3월 7일'),
    D.hidGuess('hidden-minhyun-sns-2', '@mhy.wav 2'),
  ], [true, true, true, true]);
  /* 낱말이 다르면 안 열린다. 서식만 봐주는 것이지 「비슷하면」이 아니다 */
  eq('딴 이름은 안 맞는다', [
    D.hidGuess('jaeeon-bag', '재언 가방'),
    D.hidGuess('jaeeon-bag', '민현의 가방'),
    D.hidGuess('jaeeon-bag', ''),
    D.hidGuess('jaeeon-bag', '   '),
    D.hidGuess('없는키', '재언의 가방'),
  ], [false, false, false, false, false]);
  /* 열여덟 칸 전부 자기 제목으로 열리고, 남의 제목으로는 안 열린다 */
  eq('열여덟 칸이 다 제 이름으로 열린다',
    D.HIDDEN.filter(h => !D.hidGuess(h.key, h.label)).map(h => h.key), []);
  eq('남의 이름으로는 안 열린다',
    D.HIDDEN.filter(h => D.hidGuess(h.key, '재언의 가방') && h.key !== 'jaeeon-bag').map(h => h.key), []);
  /* 판정도 값도 이 기기에서 끝난다 — 워커는 「맞혔는지」를 물어볼 데가 없다 */
  eq('워커는 맞히기를 모른다',
    /hidGuess|hidMask|HID_MAX/.test(readFileSync(join(ROOT, 'worker.js'), 'utf8')), false);
  eq('맞힌 것도 payload에 안 실린다',
    [...web.matchAll(/payload\.[A-Za-z_]+ *= *([^;\n]+)/g)].map(m => m[1])
      .filter(v => /hidGuess|guessHidden/.test(v)), []);
  /* 「정답!」이 뜨면 그때부터 이건 퀴즈다. 열린 칸이 답이어야 한다 */
  eq('맞혀도 알려주지 않는다', (() => {
    const f = web.slice(web.indexOf('const guessHidden=key=>{'), web.indexOf('const applyUnlocked=list=>{'));
    return [/setToast\("저장이 안 돼요"\)/.test(f), /localBatch|markEvent|op:"event"/.test(f),
            (f.match(/setToast/g) || []).length];
  })(), [true, false, 1]);
  /* 저장이 막히면 안 연다 — 화면만 열리고 다음 판에 다시 잠기면
     무엇을 맞혔는지가 아니라 무엇이 고장 났는지를 세게 된다 */
  eq('저장을 확인하고 연다',
    /if\(!saveUnlocked\(next\)\|\|!loadUnlocked\(\)\.includes\(key\)\)/.test(web), true);
  eq('앱도 저장을 먼저 하고 화면을 나중에 바꾼다',
    /await setMeta\('null_unlocked',JSON\.stringify\(\[\.\.\.cur,key\]\)\);\s*\n\s*setUnlocked\(/.test(appSrc2), true);
  /* 잠긴 칸을 눌렀을 때 뜨던 「still locked」 팻말이 커서로 바뀐다 */
  eq('잠긴 칸을 누르면 커서가 선다',
    [/:setGuess\(h\.key\)\}>/.test(web), /still locked ♡/.test(web),
     /:setGuess\(h\.key\)\}>/.test(appSrc2), /'still locked'/.test(appSrc2)],
    [true, false, true, false]);
  /* 대화로 열리는 길은 그대로다 — 빈칸이 그 길을 대신하는 게 아니라 옆에 선다 */
  eq('쌓여서 열리는 길이 남아 있다',
    /const demoUnlocked=msgs=>/.test(web) && /h\.at&&d>=h\.day/.test(web), true);

  /* ⑧ 틀은 확정 문안이다 — 글자가 바뀌면 유저가 채우는 자리도 바뀐다 */
  eq('선물 쪽지 틀이 글자 그대로다',
    D.GIFT_NOTE_A + 'ㅁㅁㅁㅁ' + D.GIFT_NOTE_B, '이걸 받고 ㅁㅁㅁㅁ면 좋겠어! (*ˊᵕˋ*)੭ ੈ 💝');
  /* 인물에게 가는 것은 조립된 한 줄이다. 빈칸 값만 보내면 쪽지에 「웃으」라고만 적힌다 */
  eq('조립해서 보낸다', D.giftNote('웃으'), '이걸 받고 웃으면 좋겠어! (*ˊᵕˋ*)੭ ੈ 💝');
  eq('안 채우면 쪽지가 없다', [D.giftNote(''), D.giftNote('   '), D.giftNote(null)], ['', '', '']);
  /* 60자 잘림에 걸리면 끝의 카오모지가 잘려 나간다 — 빈칸 쪽을 먼저 자른다 */
  eq('조립한 줄이 쪽지 한도 안에 있다', D.giftNote('가'.repeat(80)).length <= 60, true);
  eq('빈칸도 한도만큼만 받는다', D.giftNote('가'.repeat(80)).includes('가'.repeat(D.GIFT_WISH_MAX + 1)), false);
  /* 주는 길 둘 다 조립된 줄을 보낸다 — 한쪽만 고치면 쪽지가 자리마다 달라진다 */
  eq('주는 길 둘이 같은 줄을 보낸다',
    [/onSend\(c,pick,giftNote\(memo\)\)/.test(web), /onSendAt\(to,pick,giftNote\(memo\),g\.place\)/.test(web),
     /onSend\(c,pick,giftNote\(memo\)\)/.test(appSrc2)], [true, true, true]);
  /* 자유 노트는 물러난다 — 남아 있으면 두 길이 서로 다른 쪽지를 만든다 */
  eq('빈 종이가 물러났다',
    [/textarea className="cmemo"/.test(web), /placeholder="P\.S\. ♡"/.test(web + appSrc2)], [false, false]);
}

/* ══════════ 이름 줄 · {이름} pics · 엽서 뒤집기 ══════════
   이름 칸은 글자마다 하나였다. 이름이 두 자면 칸도 둘이라, 불릴 때마다
   뭐가 채워지는지 안 보이고 한 번 켜지면 그걸로 절반이었다. 한 줄로 바꾼다.

   cam 탭은 「받은 사진」이었다. 유저가 채운 둘(일기·엽서)은 받은 게 아니라
   자기가 쓴 것이라 자기 이름으로 따로 선다. 엽서는 눌러서 뒤집는다. */
{
  const mem = new Map();
  const ls = { getItem: k => mem.has(k) ? mem.get(k) : null,
    setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear() };
  const D = new Function('localStorage', 'location',
    readFileSync(join(ROOT, 'app-data.js'), 'utf8')
      .replace(/^const \{useState,useEffect,useRef\} = React;$/m, '')
    + '\nreturn {userPics,saveDiary,saveFlash,DIARY_IMG,DIARY_BOX,FLASH_FRONT,FLASH_BACK,FLASH_BOX,FLASH_KEYS};')(ls, { search: '' });
  const dlg2 = readFileSync(join(ROOT, 'app/screens/Dialogs.tsx'), 'utf8');
  const appSrc3 = readFileSync(join(ROOT, 'app/App.tsx'), 'utf8');
  const css2 = readFileSync(join(ROOT, 'null.css'), 'utf8');

  /* 칸은 글자 수만큼이고 안에 든 것은 언제나 □다 — 채워지는 것은 칸이지
     이름이 아니다. 이름을 칸에 적으면 아직 안 불린 이름이 먼저 보인다 */
  eq('칸에 이름을 넣지 않는다',
    [/className=\{"nmbx"\+\(i<lit\?" on":i===lit\?" next":""\)\}>□<\/span>/.test(web),
     /\{i<lit\?c:"□"\}/.test(web), /className="nmbar"/.test(web)], [true, false, false]);
  eq('칸 수는 이름 글자 수다', /\{letters\.map\(\(c,i\)=>/.test(web), true);

  /* {이름} pics — 채운 것만 선다 */
  eq('아무것도 안 채웠으면 없다', D.userPics().length, 0);
  D.saveDiary('어린애');
  eq('일기를 채우면 한 장', D.userPics().map(x => [x.src, (x.fill || []).map(f => f.text)]),
    [[D.DIARY_IMG, ['어린애']]]);
  D.saveFlash({ face: '이상한', said: '진짜요', wish: '또 보고' });
  const mine = D.userPics();
  eq('엽서까지 채우면 두 장', mine.length, 2);
  /* 앞면은 옥상 사진 한 장이다 — 채운 칸은 뒷면에 있다 */
  eq('엽서 앞면에는 채운 칸이 없다', [(mine[1].fill || []).length, mine[1].src], [0, D.FLASH_FRONT]);
  eq('뒷면에 셋이 제자리로 간다',
    [mine[1].back, mine[1].backFill.map(f => [f.key, f.text])],
    [D.FLASH_BACK, [['face', '이상한'], ['said', '진짜요'], ['wish', '또 보고']]]);
  /* 빈칸 값은 여전히 기기 밖으로 안 나간다 — 여기서 하는 일은 보여주기뿐 */
  eq('보여줘도 서버로는 안 간다',
    /userPics|null_flash|null_diary/.test(readFileSync(join(ROOT, 'worker.js'), 'utf8')), false);
  eq('cam 탭이 유저 몫을 따로 세운다',
    /const mine=userPics\(\);/.test(web) && /\{name\|\|"당신"\} · \{mine\.length\} pics/.test(web), true);
  eq('앱도 같은 구역을 세운다',
    /const mine=userPics\(\); if\(!mine\.length\)return null;/.test(appSrc3)
    && /\{name\|\|'당신'\} · \{mine\.length\} pics/.test(appSrc3), true);

  /* 엽서는 눌러서 뒤집는다 — 뒤집는 단추를 따로 달지 않는다 */
  eq('누르면 넘어간다',
    /onClick=\{flip\?\(\)=>setBack\(b=>!b\):null\}/.test(web)
    && /const now=back&&flip\?flip:src;/.test(web), true);
  eq('뒷면 단추가 없다', /뒤집기|FLIP|flip ♡/.test(web), false);
  eq('딴 사진을 열면 다시 앞면부터', /useEffect\(\(\)=>\{setBack\(false\)\},\[key\]\);/.test(web), true);
  eq('앱도 눌러서 뒤집는다',
    /<Pressable disabled=\{!flip\} onPress=\{\(\)=>setBack\(b=>!b\)\}>/.test(dlg2)
    && /useEffect\(\(\)=>\{ setBack\(false\) \}, \[keyOf\]\);/.test(dlg2), true);
  /* 빈칸은 사진 상자가 아니라 사진에 앉는다 — 설명 칸까지 감싸면 그만큼 밀린다 */
  eq('빈칸이 사진에 앉는다',
    /<div className="pvshot">/.test(web)
    && /\.pvshot\{position:relative\}/.test(css2)
    && /\.pvfit\{position:absolute;inset:0;pointer-events:none\}/.test(css2), true);

  /* ⑧ 빈칸은 밑줄이 아니라 칸이다. 글자는 가운데 */
  eq('선물 빈칸이 칸이다',
    [/input\.cwish\{[^}]*text-align:center/.test(css2),
     /input\.cwish\{[^}]*border:1px solid/.test(css2),
     /input\.cwish\{[^}]*border-bottom:1px dashed/.test(css2)], [true, true, false]);
  eq('앱의 선물 빈칸도 칸이다', (() => {
    const m = appSrc3.match(/wish:\{[^}]*\}/);
    return m && [/textAlign:'center'/.test(m[0]),
                 /borderWidth:1,borderColor:'#e3d3c4',borderRadius:5/.test(m[0]),
                 /dashed/.test(m[0])];
  })(), [true, true, false]);
}

  eq('앱도 전환을 실제로 적용한다',
    /const r=applyStoryTransition\(e\);/.test(appSrc)
    && /if\(r==='fail'\)return false;/.test(appSrc)
    && /if\(why==='partner_known'\|\|why==='partner_confirm'\)markPartnerKnown\(room\);/.test(appSrc), true);

  /* ── E5 — 아끼는 것 ≠ 모른다는 것 ── */
  eq('그 말이 고정부에 있다',
    wk.includes('아끼는 것 ≠ 모른다는 것')
    && wk.includes('"기억 안 나요" "그런 일 없어요" "우연이겠죠"는 20년째 기억하는 사람이 할 수 없는 말')
    && wk.includes('말이 짧아지는 것, 화제를 옮기는 것, 확인해주지 않는 것'), true);

  /* ── E6 — 판정이 프롬프트보다 먼저다 ── */
  eq('판정 → 사실 원본 → 프롬프트 순서다', (() => {
    const i = wk.indexOf('const routed = mode !== "chat"');
    const j = wk.indexOf('const turnCtx = makeTurnContext(');
    const k = wk.indexOf('const volatile = discloseNow ? ""');
    return i > 0 && i < j && j < k;
  })(), true);
  eq('승인된 사유만 장면 줄이 된다',
    /ctx && ctx\.sceneReason && CRITICAL_REASONS\[ctx\.sceneReason\]/.test(wk)
    && /if \(ctx\.scene && CRITICAL_REASONS\[ctx\.scene\]\) L\.push\(`\[장면\]/.test(wk), true);
}

/* ══════════ 시그니처 문장과 한 번짜리 사건 ══════════
   고정 대사를 전부 없애는 것도 아니고, 중요한 장면을 통째로 고정하는 것도
   아니다. 현이 문구 자체를 확정한 소수의 문장만 정확히 고정한다 — 그 밖의
   캐릭터 대사를 새로 하드코딩하지 않는다. */
{
  const rules = readFileSync(join(ROOT, 'app/lib/rules.ts'), 'utf8');
  const corpus = readFileSync(join(ROOT, 'docs/dialogue-corpus.md'), 'utf8');
  const demo = readFileSync(join(ROOT, 'demo-lines.js'), 'utf8');

  /* ── 민현의 첫 연락 ──
     정확히 세 말풍선이고 모델을 안 부른다. 병원 옥상을 여기서 설명하지
     않는다 — 첫 화면에서 그 장면부터 꺼내면 안 물었는데 들이미는 고발이
     된다. 유저가 한 말만 돌려주는 것이 이 세 줄이다. */
  eq('민현의 첫 연락이 정확히 세 줄이다',
    corpus.includes('민현 — 선생님. / 저 알죠? / 선생님이 저 책임진다면서요.'), true);
  eq('그 세 줄이 생성물에도 그대로 있다',
    demo.includes('["선생님.","저 알죠?","선생님이 저 책임진다면서요."]'), true);
  /* 각본 자리라 모델을 안 탄다 — 빈 방은 greet의 모델 가지(gapMin>=0)에 안 걸린다 */
  eq('빈 방의 첫인사는 모델을 안 부른다',
    /if\(gapMin>=0&&!demoOn\(\)\)\{/.test(web) && /if\(gapMin>=0&&!DEMO\.auto\)\{/.test(appSrc), true);
  /* ── 표는 하기 전에 찍는다 ──
     방을 700밀리초 안에 두 번 열면 첫 연락이 두 번 나갔다. 아직 저장되기
     전이라 두 번째가 봐도 방이 비어 있다. 하고 나서 찍으면 그 사이가 열린다. */
  eq('첫 연락은 한 번만 나간다',
    /if\(gapMin<0&&!markOnce\("first:"\+id\)\)return;/.test(web)
    && /if\(gapMin<0&&!markOnce\('first:'\+id\)\)return;/.test(appSrc), true);
  eq('관전방 첫 장면도 한 번만 깔린다',
    /markOnce\("watch:open"\)/.test(web) && /markOnce\('watch:open'\)/.test(appSrc), true);
  eq('표를 찍는 자리가 하는 자리보다 앞이다', (() => {
    const i = web.indexOf('const greet=(id,delay)=>');
    const box = web.slice(i, web.indexOf('const seedWatch=', i));
    return box.indexOf('markOnce("first:"+id)') < box.indexOf('demoProactive(');
  })(), true);
  eq('표는 웹과 앱이 같은 함수다',
    /const markOnce=id=>\{const a=loadEvDone\(\);if\(a\.indexOf\(id\)>=0\)return false;/.test(web)
    && /const markOnce=id=>\{const a=loadEvDone\(\);if\(a\.indexOf\(id\)>=0\)return false;/.test(rules), true);

  /* ── 프로필 출처 ──
     YES를 누른 순간 등록값이 세계의 빈칸에 들어갔고, 두 사람은 처음부터
     알고 있다 — 등록 화면도 앱도 모르는 채로. 캐물으면 인물마다 딱 한 번.
     모델은 안 부른다: 맡기면 매번 다르게 둘러대다가 결국 설명이 된다. */
  eq('두 마디가 현이 못박은 그대로다',
    /const ORIGIN_TOLD="선생님이 알려줬잖아요\.";/.test(web)
    && /const ORIGIN_START="처음부터\.";/.test(web), true);
  eq('출처 문답은 모델을 안 부른다', (() => {
    const i = web.indexOf('const gate=lastSaid&&originGate(');
    const box = web.slice(i, web.indexOf('const giveGift=', i));
    return box.includes('enqueue(room,[{sender:lastSaid.sender,text:gate.line}]);')
        && box.indexOf('return;') < box.indexOf('request(');   // 열리면 그 자리에서 끝난다
  })(), true);
  eq('앱도 같은 판정 함수를 쓴다',
    /const gate=lastSaid&&originGate\(text,lastSaid\.text,lastSaid\.sender,profile,name\)/.test(appSrc), true);

  /* 판정은 코드가 한다 — 따로 모델을 불러 분류하지 않는다.
     아래는 진짜로 굴려 본다: 오발이 이 기능의 유일한 실패 방식이다. */
  const G = (() => {
    const store = {};
    globalThis.localStorage = { getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v)},
      removeItem:k=>{delete store[k]}, get length(){return Object.keys(store).length},
      key:i=>Object.keys(store)[i] };
    globalThis.location = { search:'' };
    globalThis.React = { useState:()=>[], useEffect:()=>{}, useRef:()=>({}) };
    const src = readFileSync(join(ROOT, 'app-data.js'), 'utf8');
    return new Function(src + ';return {originGate,originPhase,setOriginPhase}')();
  })();
  const prof = { subject:'국어', likes:'고양이', dislikes:'비' };
  const ask = (said, prev, who) => { const g = G.originGate(said, prev, who, prof, '리리'); return g && g.line; };

  eq('방금 말한 등록값을 캐물으면 열린다', ask('그거 어떻게 알아요?', '선생님 국어 맡으셨죠?', 'minhyun'),
    '선생님이 알려줬잖아요.');
  /* 관계없는 「어떻게 알아?」에 열리면 그게 오발이다 */
  eq('아무 데서나 열리지 않는다', ask('그거 어떻게 알아요?', '오늘 비 온대요.', 'jaeeon'), null);
  eq('아무 질문에나 열리지 않는다', ask('밥 먹었어요?', '선생님 국어 맡으셨죠?', 'jaeeon'), null);
  eq('취향을 말한 뒤에도 열린다', ask('어떻게 알았어요?', '고양이 좋아하시잖아요.', 'jaeeon'),
    '선생님이 알려줬잖아요.');
  /* 두 번째는 방금 제가 한 말을 물고 늘어질 때만이다 */
  G.setOriginPhase('minhyun', 'claimed_told');
  eq('두 번째는 그 말을 물고 늘어질 때만', ask('내가 언제 알려줬어', '선생님이 알려줬잖아요.', 'minhyun'),
    '처음부터.');
  G.setOriginPhase('jaeeon', 'claimed_told');
  eq('직전이 딴말이면 두 번째도 안 열린다', ask('내가 언제', '그냥 알았어요.', 'jaeeon'), null);
  /* 인물마다 한 번이고, 한 사람의 상태가 다른 사람을 안 건드린다 */
  G.setOriginPhase('minhyun', 'revealed_from_start');
  eq('끝난 인물에게는 다시 안 나온다', ask('그거 어떻게 알아요?', '선생님 국어 맡으셨죠?', 'minhyun'), null);
  eq('상태는 인물마다 따로다', G.originPhase('jaeeon'), 'claimed_told');
}

/* ── 요청 하나에 이름표 하나 ──
   앞으로 한 턴이 모델 여러 번을 타게 된다. 그러면 답이 늦어지고, 그 사이
   유저가 다시 보내거나 방을 들락거릴 수 있다. 먼저 보낸 요청의 답이 뒤늦게
   도착해 지금 화면에 붙으면 딴말이 된다. 이름표로 가린다.
   워커는 상태를 안 들고 있으므로 판정은 프론트 몫이고, 워커는 비춰만 준다. */
{
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  eq('요청에 이름표를 단다',
    /payload\.request_id=rid;/.test(web) && /inflightRef\.current\[bucket\]=rid;/.test(web), true);
  eq('워커가 이름표를 비춰준다',
    /const reqId = typeof body\.request_id === "string"/.test(wk)
    && /\.\.\.\(reqId \? \{ request_id: reqId \} : \{\}\)/.test(wk), true);
  /* 늦게 온 답은 성공도 실패도 지금 화면을 안 건드린다 */
  eq('늦게 온 답은 버린다',
    (web.match(/if\(inflightRef\.current\[bucket\]!==rid\)return;/g) || []).length, 2);
  /* ── 짧은 강제 타임아웃은 안 둔다 ──
     한 턴이 Writer → Critic 둘 → Finalizer를 타면 90초는 짧다. 거기에 RETRY가
     한 번 붙으면 멀쩡한 답을 스스로 끊는다 — 그건 고장이 아니라 느린 것이다.
     그렇다고 무한정 기다리지도 않는다: 스피너가 영원히 도는 화면이 제일 나쁘다 */
  eq('오래 걸려도 안 깨지고 영영은 안 기다린다',
    /const REQ_TIMEOUT=180000;/.test(web)
    && /new AbortController\(\)/.test(web)
    && /e&&e\.name==="AbortError"/.test(web), true);
  /* 재시도는 새 요청이 아니라 같은 요청을 다시 부르는 것이다 — 이름표를
     새로 뽑으면 워커가 멱등 처리를 붙일 때 같은 턴을 두 번 센다 */
  eq('재시도는 같은 이름표를 쓴다', /const rid=payload\.request_id\s*\n?\s*\|\|/.test(web), true);
  /* ── 오류와 사용자 취소를 가른다 ──
     유저가 다음 말을 보내면 앞 요청은 밀려난다. 그건 고장이 아니므로 아무
     말 없이 물러난다 — 재시도 단추도 원인 줄도 안 띄우고 스피너도 안 끈다
     (그 스피너는 지금 도는 새 요청의 것이다). */
  eq('밀려난 요청은 고장으로 안 뜬다', (() => {
    const i = web.indexOf('}catch(e){\n      clearTimeout(killer);');
    const box = web.slice(i, web.indexOf('setFailed(f=>({...f,[bucket]:{payload,detail}}))', i));
    return box.indexOf('if(inflightRef.current[bucket]!==rid)return;')
         < box.indexOf('setBusy(b=>({...b,[bucket]:false}));');
  })(), true);
  /* 실패는 실패로 보인다 — 각본으로 메우지 않는다(?demo=1만 예외) */
  eq('실패를 각본으로 안 메운다',
    /setFailed\(f=>\(\{\.\.\.f,\[bucket\]:\{payload,detail\}\}\)\)/.test(web), true);
  /* ── 앱도 같은 규칙이다 ──
     웹만 고치면 같은 고장이 앱에서만 조용해진다. 앱에는 ?demo=1이 없으므로
     실패 폴백이 곧 유일한 데모 경로였고, 그래서 서버가 죽으면 앱은 아무
     티도 안 내고 각본을 읽었다. */
  eq('앱도 요청에 이름표를 단다',
    /\{reqId:rid,/.test(appSrc) && /reqId \? \{ request_id: reqId \} : \{\}/.test(apiSrc), true);
  eq('앱은 재시도에 같은 이름표를 쓴다',
    /keep&&ridRef\.current\[room\]\?ridRef\.current\[room\]:newRid\(\)/.test(appSrc)
    && /runTurn\(room,undefined,true\)/.test(appSrc), true);
  /* 성공도 실패도 늦게 오면 화면을 안 건드린다 — 세 자리(선물·대화·관전) 모두 */
  /* 세 자리 모두 성공 쪽과 실패 쪽 양쪽을 막아야 한다 — 한쪽만 막으면
     늦게 터진 옛 실패가 지금 도는 요청 위에 재시도를 띄운다 */
  eq('앱도 늦게 온 답을 버린다', (() => {
    const site = (from, to) => appSrc.slice(appSrc.indexOf(from), appSrc.indexOf(to));
    return [
      ['const giveGift = async', '/* 실측.'],
      ['const runTurn = async', '/* 재시도는 같은 논리 요청'],
      ['const handleAuto = async', '/* 선물이나 해금이 있으면'],
    ].filter(([a, b]) => (site(a, b).match(/stale\((?:char|room|'health'),rid\)/g) || []).length !== 2)
     .map(([a]) => a);
  })(), []);
  eq('앱은 실패를 각본으로 안 메운다',
    !/fallToDemo/.test(appSrc) && /setFailed\(\{room,detail\}\)/.test(appSrc), true);
  /* 실패한 까닭이 화면에 안 뜨면 「그냥 답이 없네」로 읽힌다 */
  eq('앱도 실패 원인을 화면에 적는다',
    /failed\.detail&&<Text style=\{ch\.retryWhy\}>/.test(appSrc), true);
  /* 방을 옮기면 남의 방 실패가 따라다녔다 */
  eq('앱의 실패는 그 방에만 뜬다',
    /failed=\{failed&&failed\.room===view\.id\?failed:null\}/.test(appSrc), true);
}

eq('웹 아바타 링이 돈다', /\.avatar\.nu::after/.test(web) && /@keyframes nuspin/.test(web), true);
eq('앱 아바타 링이 돈다', /function NuRing/.test(appSrc), true);

// ─────────────────────────────────────────────
/* README가 "90개 회귀 테스트"라고 적어둔 채 159개가 더 늘어 있었다. 읽는 사람은
   그 숫자를 믿는다. 틀리면 여기서 잡고, 고칠 숫자를 알려준다. */
{
  const want = pass + fail + 1;            // 이 검사 자신을 포함한 총수
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const got = (readme.match(/(\d+)개 회귀 테스트/) || [])[1];
  eq(`README가 시험 수를 맞게 적었다 (지금 ${want}개)`, Number(got), want);
}

console.log(`\n${fail ? '실패' : '통과'} — ${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
