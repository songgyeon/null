/* NULL 회귀 테스트 — 의존성 없이 `node test/run.mjs`로 돈다.
   네트워크도 API 키도 쓰지 않는다. 모델을 부르지 않고 검증 가능한 것만 다룬다.

   여기 모인 것은 전부 "실제로 한 번 터졌던 것"이다. 새 기능을 넣을 때가 아니라
   화면이 깨졌을 때 하나씩 추가했다. 그래서 이름이 증상으로 붙어 있다. */

import { parseMessages, splitLines, trimTics, sanitizePhotos, unlabel, buildSystem, buildVolatile, budgetHistory,
         PLACE_ITEMS, placeOf, pickGive, buildPlace, dropMeta, dropSleepers } from '../worker.js';
import worker from '../worker.js';
import { readFileSync } from 'node:fs';
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
const texts = (raw, fb, allowed) => parseMessages(raw, fb, allowed).map(m => `${m.sender}|${m.text}`);

/* 단톡방은 이력을 "[이재언] 말" 형태로 모델에게 준다. 모델이 JSON 대신 그 형식을
   그대로 따라 쓴 적이 있고, 그때 세 사람 대사가 말풍선 하나로 뭉쳐 나갔다. */
eq('이력 형식을 흉내 내면 화자별로 풀어준다',
  texts('[이민현] 뭐가 좋은데요ㅋㅋ\n[이민현] 저는 안 궁금하시죠\n[이재언] 좋으시면 다행이네요', 'minhyun', BOTH),
  ['minhyun|뭐가 좋은데요ㅋㅋ', 'minhyun|저는 안 궁금하시죠', 'jaeeon|좋으시면 다행이네요']);

eq('정상 JSON은 그대로 통과',
  texts('{"messages":[{"sender":"jaeeon","text":"무슨 일 있으세요"}]}', 'minhyun', BOTH),
  ['jaeeon|무슨 일 있으세요']);

eq('1:1 방에 없는 사람 줄은 버린다',
  texts('[이민현] 삼촌 뭐해요\n[이재언] 일한다', 'jaeeon', JE), ['jaeeon|일한다']);

eq('1:1 JSON의 엉뚱한 sender는 방 주인으로 교정',
  texts('{"messages":[{"sender":"jaeeon","text":"앉으세요."}]}', 'minhyun', MH), ['minhyun|앉으세요.']);

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
    [{ sender: 'jaeeon', text: 'a', photo: 'jaeeon-treat' }, { sender: 'jaeeon', text: 'b', photo: 'jaeeon-care' }],
    BOTH, 'jaeeon', []).filter(m => m.photo).length, 1);

eq('최근에 보낸 사진은 다시 안 보낸다',
  sanitizePhotos([{ sender: 'jaeeon', text: 'a', photo: 'jaeeon-treat' }],
    BOTH, 'jaeeon', ['jaeeon-treat']).filter(m => m.photo).length, 0);

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
const req = (o = {}) => new Request(o.url || 'https://x.dev/', {
  method: o.method || 'POST',
  headers: { 'CF-Connecting-IP': o.ip || '1.1.1.1', ...(o.origin ? { Origin: o.origin } : {}) },
  body: o.method === 'GET' ? undefined : '{}',
});
const hit = (o, env = {}) => worker.fetch(req(o), env);

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
eq('등록 화면은 이름을 넣은 순간에만 뜬다',
  [/setName\(n\);\s*setEnrolling\(true\)/.test(appSrc), /setName\(n\);setEnrolling\(true\)/.test(web)],
  [true, true]);
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
eq('큐가 비면 타이핑 표시를 끈다', /queueRef\.current\.length===before/.test(web), true);
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
  const src = web.slice(web.indexOf('function presence'));
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
  const src = web.slice(web.indexOf('function presence'));
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
  const src = web.slice(web.indexOf('function presence'));
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
    /p\.meet!=="out"\|\|whoOut\(now\)\.includes\(id\)/.test(src3.slice(0, 400)), true);
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
    /pickInvite\(parseMessages\.invite, place \? \[\] : \[\.\.\.openPlaces, \.\.\.canGo\]\)/.test(wSrc), true);
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
  const src2 = web.slice(web.indexOf('function presence'));
  const B = new Function(src2.slice(0, src2.indexOf('\n}\n') + 3)
    + 'const asleep=(id,now)=>{const pr=presence(id,now);return !!pr&&pr.s==="off"};'
    + 'const bothAwake=now=>!asleep("jaeeon",now)&&!asleep("minhyun",now);'
    + '\nreturn bothAwake;')();
  const at2 = h => new Date(2026, 0, 6, h);
  /* 재언 1~6시, 민현 3~8시 — 둘을 합치면 1~8시가 조용하다 */
  eq('한쪽만 자도 관전은 안 만든다',
    [0, 2, 5, 7, 9, 23].map(h => B(at2(h))), [true, false, false, false, true, true]);
  /* 지금이 아니라 그 대화가 찍힐 시각으로 잰다 — 관전은 한 시간쯤 거슬러 찍힌다 */
  eq('찍힐 시각으로 잰다', /if\(!bothAwake\(new Date\(at\)\)\)return;/.test(web), true);
  /* 하루 몫을 깎기 전에 본다. 순서가 반대면 만들지도 못한 대화에 몫만 나가고
     적어둔 사건(선물)까지 같이 지워진다 */
  eq('몫을 깎기 전에 본다',
    web.indexOf('if(!bothAwake(new Date(at)))return;') < web.indexOf('saveAutoDay(`${day}|'), true);
  /* peek 단추는 지금 벌어지는 일이라 지금으로 잰다 */
  eq('peek도 자면 안 부른다', /if\(!bothAwake\(\)\)\{/.test(web), true);
  eq('앱도 관전을 막는다',
    /if\(!bothAwake\(new Date\(at\)\)\) return;/.test(appSrc)
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
    appSrc.indexOf('if(!bothAwake(new Date(at))) return;') < appSrc.indexOf("null_auto_day',`${day}|"), true);
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
eq('자는 쪽은 후보에서 먼저 뺀다',
  /\["jaeeon","minhyun"\]\.filter\(id=>canGreet\(id\)\)\.map\(id=>\{/.test(web), true);
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
  && /if\(!here\(c\)\)return;\s*\n\s*onSend\(c,pick,memo\); onClose\(\);/.test(web), true);
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
  /const canMeet=p\.meet==="out" \? whoOut\(now\)\.includes\(char\)/.test(web)
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
  && /stampGift\(char\); stampGone\(place\);/.test(web), true);
eq('자리 몫과 선물 몫을 둘 다 쓴다',
  /if\(giftedToday\(char\)\|\|goneToday\(place\)\)return;/.test(web), true);
/* 워커에게 자리와 선물을 같이 보낸다 — 마주 앉아 있고 방금 이걸 받았다 */
eq('자리와 선물을 같이 보낸다',
  /place,bag:bagOut\(\),gift:\{name:gift\.name,key:gift\.key,note\}\}\);/.test(web), true);
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
    /const o=openingFor\(\);[\s\S]{0,600}?setView\(o\.room\);/.test(web)
    && !/const o=openingFor\(\);[\s\S]{0,600}?wendOnlyOk/.test(web), true);
  /* 첫 자리도 다녀온 자리다 — 도장을 안 찍으면 같은 날 한 번 더 갈 수 있다 */
  eq('첫 자리도 도장을 찍는다',
    /if\(PLACE_BY\[o\.place\]\)\{ goneTo\(o\.place\); stampGone\(o\.place\) \}/.test(web), true);
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
     빈 방 그대로 있었다. 사진은 있었는데 표에 안 걸려 있었을 뿐이다 */
  eq('빨래방에도 재언이 깔린다',
    /"빨래방":\s*\{minhyun:\["minhyun-laundry"\], ?jaeeon:\["jaeeon-laundry"\]\}/.test(web), true);
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
  eq('다른 한 사람이 첫인사를 보낸다',
    /const other=o\.room==="jaeeon"\?"minhyun":"jaeeon";\s*\n\s*if\(canGreet\(other\)\)\{/.test(web), true);
  /* 새벽이면 재언은 안 온다 — 여섯 시에 온다 */
  eq('그 첫인사도 자는 사람은 거른다', /if\(canGreet\(other\)\)\{/.test(web), true);
  /* 직접 걸었으면 추첨은 일 분간 조용해야 한다. 안 그러면 둘이 같은 초에 온다 */
  eq('직접 건 뒤에는 추첨이 조용하다',
    /greetAtRef\.current=Date\.now\(\);\s*\/\/ 추첨은 일 분간 조용히/.test(web), true);
  /* 워커도 그 자리를 알아야 한다. 모르면 place가 서버에서 버려지고
     마주 앉아서 「지금 어디예요?」가 나온다 */
  eq('워커가 골목과 정류장을 안다', ['후문 골목', '버스정류장'].filter(p => !placeOf(p)), []);
  eq('골목은 처음 마주친 자리라고 적혀 있다',
    /처음 마주친 자리/.test(buildPlace('후문 골목', true, 'minhyun')), true);
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
  const src = web.slice(web.indexOf('function presence'));
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
  /const stampGift=\(char,now\)=>saveGiftDay\(\{\.\.\.loadGiftDay\(\),\[char\]:dayKey\(now\)\}\)/.test(web), true);
/* 선물 몫도 새벽 다섯 시에 넘어간다 — 저 이어폰과 사진집이 같은 날로
   묶여야 이 규칙에 걸린다. 자정 기준이면 둘 다 통과한다 */
eq('선물 몫도 새벽 다섯 시에 넘어간다', /giftedToday=\(char,now\)=>loadGiftDay\(\)\[char\]===dayKey/.test(web), true);
/* 창에서만 막으면 자물쇠가 아니다 — 주는 길이 둘이면 둘 다 잠가야 한다 */
eq('보내는 쪽에서도 막는다',
  /if\(giftedToday\(char\)\)\{ setToast\(`\$\{CHARS\[char\]\.name\} — one a day ♡`\); return \}/.test(web)
  && /stampGift\(char\);/.test(web), true);
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

/* ── 앱이 워커에 보내는 것이 웹과 같다 ──
   payload가 다르면 같은 인물이 두 앱에서 다르게 군다. 웹이 얹는 것을
   앱도 다 얹어야 한다 — 특히 접속 상태와 자리는 인물의 대답을 바꾼다. */
{
  const api = readFileSync(join(ROOT, 'app/lib/api.ts'), 'utf8');
  eq('앱도 요일·때를 보낸다', /now: timeWord\(\)/.test(api) && /day: dayWord\(\)/.test(api), true);
  eq('앱도 접속 상태를 보낸다',
    /states/.test(api) && /presence\(id\)/.test(api) && /pr\.t !== '주말'/.test(api), true);
  eq('앱도 마주 앉은 자리를 보낸다', /\{ place, bag: bag \|\| \[\] \}/.test(api), true);
  eq('앱도 자리의 때와 선톡 표시를 보낸다',
    /place_over: true/.test(api) && /greet: true/.test(api), true);
  eq('앱도 문 닫은 자리를 보낸다', /closed: PLACES\.filter/.test(api), true);
  /* 선톡 지시문은 웹과 글자 그대로 같아야 한다 — 다르면 두 앱의 인물이 다르게 군다 */
  const ask = web.match(/const GREET_ASK="([^"]+)"/);
  eq('선톡 지시문이 웹과 같다', !!ask && appSrc.includes(ask[1]), true);
}

/* 실패했을 때 조용히 각본으로 갈아타면 진짜 장애를 못 알아챈다.
   원인은 콘솔에, 표시는 하단 바에 — 웹이 하는 것과 같아야 한다. */
eq('앱도 서버가 죽으면 각본으로 넘어간다', /catch[\s\S]{0,80}fallToDemo/.test(appSrc), true);
eq('넘어간 이유를 콘솔에 남긴다', /console\.error\([^)]*NULL/.test(appSrc), true);
eq('데모로 돌고 있으면 하단 바에 뜬다', /NULL v[\d.]+\{demo\?' · demo'/.test(appSrc), true);

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
  const w = wk.slice(wk.indexOf('const WORLD = `'), wk.indexOf('const JAEEON'));
  return /유저와 보내는 하루가 쌓일 때마다 감정이 달라진다\. 이미 가까운 사이가 아니다\. 가까워질 수 있는 사이다\./.test(w)
    && w.indexOf('가까워질 수 있는 사이다') < w.indexOf('이재언과 이민현\n\n이재언은 이민현을') + w.length;
})(), true);
eq('첫날 읽는 법을 슬롯에 적어둔다', (() => {
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  return /「오늘 처음 만났다」고 적혀 있으면 그 앞에 쌓인 것이 하나도 없다는 뜻이다/.test(wk);
})(), true);
eq('다녀온 자리를 웹·앱 둘 다 들고 있다',
  /null_met/.test(web) && /null_met/.test(appSrc), true);
eq('거절한 자리를 웹·앱 둘 다 들고 있다',
  /null_refused/.test(web) && /null_refused/.test(appSrc), true);

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
/* ── 두 시계 ──
   리얼 모드는 진짜 달력을 본다. 스피드 모드는 쌓인 대화를 날로 센다.
   사다리를 새로 놓을 필요가 없었다 — 원래 숫자가 「하루에 네 마디」로
   놓여 있었다(at 12·26·44·64·90·116 ↔ day 3·7·11·15·20·26 ≒ at÷4). */
{
  const D = new Function(
    'const localStorage={_v:{},getItem(k){return this._v[k]||null},setItem(k,v){this._v[k]=v}};'
    + web.slice(web.indexOf('const SPEED_PER_DAY='), web.indexOf('const loadExtend='))
    + 'return {SPEED_PER_DAY,saveMode,speedOn,speedCountOf,speedDaysOf,'
    + 'setSpeedAt,speedDay,speedNow,nowClock};')();
  eq('네 마디가 하루다',
    [D.speedDaysOf({ msgs: { jaeeon: Array(11) } }), D.speedDaysOf({ msgs: { jaeeon: Array(12) } })],
    [2, 3]);
  /* 많이 나눈 쪽으로 센다 — 한쪽만 파도 다른 방 것은 그 방 대화 수가 막는다 */
  eq('많이 나눈 쪽으로 센다',
    D.speedDaysOf({ msgs: { jaeeon: Array(116), minhyun: Array(0) } }), 29);
  /* ── 단톡도 센다 ──
     1:1 둘만 셌더니 스피드 모드에서 단톡에만 있으면 시계가 통째로 멈췄다.
     백스무 마디를 떠들어도 지난 날이 그대로고, 가상 시계도 안 돌아 같은
     시각·같은 요일에 얼어붙는다. 그러다 1:1로 옮기면 시간이 훅 뛴다 */
  eq('단톡에서 떠들어도 날이 간다',
    [0, 30, 120].map(n => D.speedDaysOf({ msgs: { jaeeon: Array(4), minhyun: Array(4), group: Array(n) } })),
    [1, 7, 30]);
  /* 관전은 유저가 말한 게 아니라 자리를 비운 사이에 찍힌 것이다 —
     그걸로 날이 가면 안 켜고 둔 시간이 진도가 된다 */
  eq('관전은 날을 못 민다',
    D.speedDaysOf({ msgs: { jaeeon: Array(4), minhyun: Array(4), health: Array(120) } }), 1);
  /* 116마디면 마지막 칸(day 26)에 닿는다 — 리얼 모드의 26일과 같은 자리다 */
  eq('마지막 칸에 대화로 닿는다', D.speedDaysOf({ msgs: { jaeeon: Array(116) } }) >= 26, true);
  eq('기본은 리얼이다', D.speedOn(), false);
  /* ── 시각도 진행을 따라 돈다 ──
     날짜만 당기고 시각을 진짜 시계로 두면, 한 판이 실제 이십 분이라 새벽 세
     시에 시작한 사람은 판이 끝날 때까지 새벽 세 시다. 재언은 1시~4:30 자니까
     한 번도 안 깨고, 시간표도 안 돌고, 학교도 내내 닫혀 있다. */
  D.saveMode('speed');
  const anchor = new Date(2026, 0, 6, 22, 40).getTime();   // 밤에 시작해도
  D.setSpeedAt(0, anchor);
  eq('아침 여덟 시에서 출발한다',
    [D.speedNow().getHours(), D.speedNow().getMinutes()], [8, 0]);
  /* 한 마디에 하루의 1/SPEED_PER_DAY. 네 마디면 꼭 하루다 */
  D.setSpeedAt(2, anchor); eq('두 마디면 반나절이다', D.speedNow().getHours(), 20);
  D.setSpeedAt(4, anchor);
  eq('네 마디면 다음 날 아침이다',
    [D.speedNow().getHours(), D.speedNow().getDate()], [8, 7]);
  /* 네 칸이 8·14·20·2시다. 자는 사람이 있는 칸은 밤 하나뿐이고, 그 칸도
     민현은 깨 있다 — 어느 칸에 서도 말 걸 사람이 있어야 한다 */
  eq('네 칸이 출근·수업·저녁·밤에 얹힌다',
    [0, 1, 2, 3].map(n => { D.setSpeedAt(n, anchor); return D.speedNow().getHours(); }),
    [8, 14, 20, 2]);
  /* 날 수와 시계가 어긋나면 D-N과 시간표가 딴말을 한다 */
  eq('날 수와 시계가 같은 것을 센다', [0, 3, 4, 11, 116].filter(n => {
    D.setSpeedAt(n, anchor);
    const a = new Date(anchor); a.setHours(8, 0, 0, 0);
    return Math.floor((D.speedNow() - a) / 864e5) !== D.speedDay();
  }), []);
  /* 재언은 1시~4:30 잔다. 진행하다 보면 자는 자리도 지나가야 한다 —
     한 판 내내 깨어 있거나 한 판 내내 자면 그건 시계가 아니다 */
  const hours = Array.from({ length: 40 }, (_, n) => { D.setSpeedAt(n, anchor); return D.speedNow().getHours(); });
  eq('하루가 실제로 돈다', new Set(hours).size >= 4, true);
  D.saveMode('real');
  eq('리얼 모드는 진짜 지금이다', Math.abs(D.nowClock() - Date.now()) < 4000, true);
}
/* 규칙이 시계를 둘 두지 않는다 — 하나라도 new Date()로 새면 그것만 진짜
   시각을 보고, 스피드 모드에서 시간표와 잠이 딴말을 한다 */
{
  const rules = readFileSync(join(ROOT, 'app-data.js'), 'utf8');
  eq('규칙층에 진짜 시계가 안 샌다', /\|\|new Date\(\)/.test(rules), false);
  /* 말풍선에 찍히는 시각은 진짜다. 그건 진짜로 일어난 일이다 */
  eq('찍히는 시각은 진짜 그대로다', /const isToday=ts=>\{const d=new Date\(ts\),n=new Date\(\)/.test(rules), true);
}
eq('시간표도 세계 시계를 본다', /function Timetable\(\{wend,onFillWend,onClose\}\)\{[\s\S]{0,220}const now=nowClock\(\);/.test(web), true);
/* 시계는 store가 바뀔 때마다 감는다 — 규칙들은 대화 수를 스스로 못 본다 */
for (const [label, src] of [['웹', web], ['앱', appSrc]])
  eq(`${label}이 시계를 감는다`, /setSpeedAt\(speedCountOf\(/.test(src), true);
/* 하루 한 번 도장이 다 dayKey를 본다 — 스피드 모드에서 진짜 달력을 그대로
   보면 대화로 날을 넘겨도 선물은 진짜 내일까지 못 준다 */
eq('스피드 모드의 하루는 대화가 정한다',
  /if\(speedOn\(\)\)return "s"\+speedDay\(\);/.test(web), true);
eq('남은 날도 두 시계를 본다',
  /if\(speedOn\(\)\)return Math\.max\(0,span-speedDaysOf\(store\)\);/.test(web)
  && /if\(speedOn\(\)\)return speedDaysOf\(store\);/.test(web), true);
/* dayKey는 시각만 받는 순수 함수라 대화 수를 스스로 못 본다 — 앱이 넣어준다.
   안 넣으면 「s0」에 얼어붙어 선물도 자리도 영영 하루치로 잠긴다 */

/* 모드는 판마다 하나고 등록 화면에서 고른다 — 중간에 바꾸면 D-N이 튄다 */
for (const [label, src, re] of [
  ['웹', web, /<span className="lab">MODE<\/span>/],
  ['앱', appSrc, /<Text style=\{en\.rowL\}>MODE<\/Text>/],
])
  eq(`${label}은 등록 화면에서 고른다`, re.test(src) && /onMode\(k\)/.test(src), true);
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
parseMessages('{"invite":"옥상","messages":["갈래요?"]}', 'jaeeon', ['jaeeon']);
eq('모델이 고른 자리를 읽는다', parseMessages.invite, '옥상');
parseMessages('{"messages":["아뇨."]}', 'jaeeon', ['jaeeon']);
eq('안 고른 턴은 비어 있다', parseMessages.invite, '');

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
    /* 첫 화면에서 맞담부터 꺼내면 그 장면을 모르는 플레이어는 학생이랑
       담배 피우고 다니는 교생이 된다. 꺼낼 거면 유저가 무슨 말을 했고
       나중에 어떻게 했는지가 같이 나와야 한다 — 지금은 아예 안 꺼낸다. */
    eq('맞담을 꺼내면 책임도 같이 나온다',
      !/맞담/.test(open.join(' ')) || (/책임/.test(open.join(' ')) && /금연/.test(open.join(' '))), true);
    /* 골목도 협박도 사라진 건 아니다. 인물 설정과 결 견본에 그대로 있어서
       유저가 답한 뒤에 나온다 — 그때는 순서가 맞는다 */
    eq('골목과 책임은 프롬프트에 남아 있다',
      /맞담했다고 소문낼 거예요/.test(workerSrc) && /책임은 언제 져요/.test(workerSrc), true);
  }

  /* ── 되물으면 그때 골목을 꺼낸다 ──
     묻고 나서 들으면 해명이고, 안 물었는데 들으면 고발이다. 순서가 전부다. */
  {
    const E = new Function(readFileSync(join(ROOT, 'demo-lines.js'), 'utf8')
      + '\nreturn {demoProactive, demoAnswer, demoGreetWhen}')();
    const open = () => E.demoProactive('minhyun', E.demoGreetWhen(-1), '수연');
    const ask = t => E.demoAnswer('minhyun', t, '수연', {}).map(m => m.text).join(' / ');
    open();
    eq('되물으면 골목이 나온다', /후문에서 맞담/.test(ask('무슨 말이에요?')), true);
    /* 표현이 갈려도 열려야 한다 — 여기서 안 열리면 첫 대화가 막힌다 */
    eq('말을 어떻게 바꿔 물어도 열린다',
      ['뭔 소리야', '네?', '무슨 책임이요', '기억 안 나는데', '누구세요', '제가요?']
        .filter(t => { open(); return !/후문에서 맞담/.test(ask(t)); }), []);
    /* 아무 데서나 열리면 안 된다. 첫 선톡 바로 뒤에서만이다 */
    E.demoAnswer('minhyun', '밥 먹었어요?', '수연', {});
    eq('평범한 대화 뒤에는 안 열린다', /후문에서 맞담/.test(ask('무슨 말이에요?')), false);
    /* 재언에게는 이 갈래가 없다 — 20년 전은 유저가 몰라야 한다 */
    E.demoProactive('jaeeon', E.demoGreetWhen(-1), '수연');
    eq('재언은 이 갈래가 없다',
      /후문|맞담/.test(E.demoAnswer('jaeeon', '무슨 말이에요?', '수연', {}).map(m => m.text).join(' ')), false);
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
  const got = parseMessages('{"messages":["지금요?","이거 보세요."],"photo":"minhyun-mirror"}', 'minhyun', ['minhyun']);
  eq('마지막 말풍선에 사진이 붙는다',
    [got.length, got[0].photo, got[1].photo], [2, undefined, 'minhyun-mirror']);
}
/* ── 괄호 지문을 없앴다 ──
   두 번 고쳤는데 두 번 다 다른 어미로 굳었다(「~하는 참」→「~는 소리」).
   매 턴 붙었고, 궁해지면 「이건 그냥 텍스트니까요」로 4벽을 깼다.
   메신저에서 상대가 보는 건 글자뿐이라는 게 원래 사실이다. */
eq('괄호로 행동을 묘사하지 않는다',
  /\*\*괄호로 행동을 묘사하지 않는다\.\*\*/.test(workerSrc), true);
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
eq('그 말은 가변부 맨 뒤에 있다',
  /const TURN = `\n## 이 턴\n유저의 가장 최근 발화가 짧더라도/.test(workerSrc)
  && /\+ \(place \? "" : buildCanGo\(canGo\)\)\s*\n\s*\+ TURN;/.test(workerSrc), true);
/* 세계관에 두고 왔으면 두 군데에 같은 말이 남는다 */
eq('세계관에는 안 남겼다',
  (workerSrc.match(/유저의 단어를 어미만 바꿔 반복하는 대신/g) || []).length, 1);

/* ── 순서가 곧 무게다 ──
   설정(외형·과거·취향)은 잘 지키는데 대화 규칙(반복·정보 없는 턴)만 계속
   깨졌다. 규칙이 없어서가 아니라 세계관 한가운데(3,385자 자리)에 묻혀서다.
   역할 바로 다음에 대화 원칙과 쓰는 법이 오고, 세계·사연은 그 뒤로 물렸다. */
{
  const w = workerSrc.slice(workerSrc.indexOf('const WORLD = `'), workerSrc.indexOf('const JAEEON'));
  eq('대화 원칙이 세계 설정보다 앞이다',
    w.indexOf('대화 원칙') > 0 && w.indexOf('대화 원칙') < w.indexOf('\n세계\n'), true);
  eq('쓰는 법도 앞이다 — 반복 규칙이 제일 많이 깨졌다',
    w.indexOf('## 쓰는 법') > 0 && w.indexOf('## 쓰는 법') < w.indexOf('정보 비대칭'), true);
  /* 쓰는 법은 방마다 같은 글인데 방마다 다른 ③블록에 실려 방 수만큼 캐시에
     써졌다. 공통 블록(①세계)으로 올라갔으니 ③에는 없어야 한다 */
  eq('쓰는 법이 공통 블록에만 있다', (() => {
    const [world, , rules] = buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null).map(b => b.text);
    return world.includes('같은 소재를 반복하지 않는다') && !rules.includes('같은 소재를 반복하지 않는다');
  })(), true);
  /* 민현의 대화 예시에 「같이 웃어요ㅋㅋㅋㅋㅋ」가 있다. 전면 금지와 예시가
     서로 딴말을 하면 모델이 아무거나 고른다 — 예시가 상한이라고 적는다 */
  eq('자모 축약은 예시만큼만 허용한다',
    /\[대화 예시\]에 나오는 쓰임만 예외다/.test(workerSrc), true);
  /* 작품 규칙이 세계관 원칙과 FACTS에 두 판으로 적혀 있었다 — FACTS가 다 말한다 */
  eq('작품 규칙은 FACTS에만 있다',
    !/실존 작품은 각 인물의 취향 목록/.test(workerSrc)
    && /실제로 존재하는 것만 말한다/.test(workerSrc), true);
  /* 말풍선 개수는 방마다 다르다(1:1은 1~3, 관전방은 4~8) — 세계관이 1~3을
     못박으면 관전방 형식과 딴말이 된다. 개수는 출력 형식만 정한다 */
  eq('분량 규칙이 형식과 안 싸운다', !/말풍선 1~3개면 충분하다/.test(workerSrc), true);
  /* 재료(신호)는 두엇인데 열 발화를 채우라니 같은 말이 반복됐다 —
     「민현인 왜 같은 말만 하지」가 여기서 나왔다 */
  eq('관전방은 4~8발화고 재료가 떨어지면 끝낸다',
    /4~8개 발화/.test(workerSrc) && !/6~10개 발화/.test(workerSrc)
    && /할 말이 떨어지면 거기서 끝낸다/.test(workerSrc), true);
  /* 「("그 선생님...")」 예시가 3인칭 거리두기를 가르쳤다 —
     실제로 「삼촌 국어 교생 선생님이랑」이 나왔다 */
  eq('유저를 어떻게 부를지 예시로 안 가르친다', workerSrc.includes('그 선생님'), false);
  /* 프론트 장소 이름은 레코드샵이다. 프롬프트만 레코드숍이면 대사가 UI와 어긋난다 */
  eq('가게 표기가 한 가지다', workerSrc.includes('레코드숍'), false);
}
{
  /* 가변부는 마지막 유저 발화 바로 뒤에 붙는다 — 프롬프트에서 제일 마지막이다 */
  const v = buildVolatile('chat', 'minhyun', '선생님', null, [], null, { minhyun: 20 }, null, null, [], 2, null, false);
  eq('그 말이 가변부의 마지막 줄이다',
    v.trimEnd().endsWith('했던 요구를 되풀이하지 않고, 대화를 착하게 닫지 않는다.'), true);
  /* ── 방금 나간 사람에게 나가는 중이라고 하던 것 ──
   자리에서 나오면 프론트가 자리를 먼저 닫고 부르므로 place가 안 실린다.
   그러면 모델에게는 그냥 문자 대화로 보이고, 「보건실에서 나왔다」 지문 한 줄만
   유저가 한 말처럼 들어간다. 그래서 이미 나간 사람을 두고 「오늘 벌써 두 번째
   나가는 거예요」라고 진행형으로 말했다 — 나가는 중이 아니라 나간 뒤인데. */
{
  const 나감 = (place, room = 'jaeeon') => buildVolatile('chat', room, '리현', null, [], null,
    { [room]: 20 }, null, null, [], 3, null, false, '낮', '화요일', null, false, null, [], '여름', place);
  eq('나갔다고 알려준다',
    나감('보건실').includes('리현이 보건실에서 나갔다. 눈앞에 없다 — 여기서부터 다시 문자다.'), true);
  eq('진행형으로 말하지 말라고 한다',
    나감('보건실').includes('이미 나간 뒤다. 나가는 중인 것처럼 말하지 않는다.'), true);
  /* 귀갓길에서 나오는 건 나오는 게 아니라 도착하는 것이다 — 프론트 지문과 같다 */
  eq('귀갓길은 도착이다', 나감('귀갓길').includes('리현이 집에 도착했다'), true);
  /* 안 나간 턴에는 안 붙는다 — 가변부는 캐시가 안 걸린 정가 자리다 */
  eq('평소에는 안 붙는다', 나감('').includes('## 방금 일어난 일'), false);
  /* 자리에 앉아 있는 동안에는 나간 게 아니다 — place와 같이 오지 않는다 */
  const w = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  eq('자리에 있으면 안 본다',
    /const left = mode === "chat" && !place \? \(body\.left \|\| ""\)/.test(w), true);
  /* 프론트가 나간 자리를 실어 보내야 한다 — 안 보내면 위가 다 소용없다 */
  eq('프론트가 나간 자리를 보낸다',
    /request\(sc\.room,\{mode:"chat",room:sc\.room,user_name:name,left:sc\.place,/.test(web), true);
}

/* ── 단톡의 지난 대화가 요약도 없이 사라지던 것 ──
   원문 창 밖으로 밀려난 대화는 요약이 들고 있다. 그런데 요약을 만드는 쪽에
   `!CHARS[room]` 가드가 있어서 1:1 둘만 요약됐고, 단톡은 들고 있는 게 없었다.
   창(HISTORY_CHARS)을 넘는 순간 그 앞은 없던 일이 된다 — 두 사람이 앞서 한
   말을 잊고, 정해둔 것을 다시 정하고, 시간 순서가 어긋난 소리를 한다.
   워커는 진작부터 감당하고 있었다. 프론트 가드 한 줄이 막고 있었을 뿐이다. */
{
  /* 이제 방을 아예 안 가린다 — 단톡도 관전도 요약한다 */
  eq('웹이 방을 안 가린다',
    /const rollSummary=async room=>\{[\s\S]{0,900}?if\(demoOn\(\)\|\|summingRef\.current\[room\]\)return;/.test(web), true);
  eq('CHARS만 보던 가드가 없다', /if\(!CHARS\[room\]\|\|demoOn\(\)/.test(web), false);
  /* 앱은 원래 방을 안 가렸다 — 웹만 막혀 있었다 */
  eq('앱은 방을 안 가린다',
    /const rollLater=\(room:string\)=>\{\s*\n\s*if\(demoOn\(\)\|\|summingRef\.current\[room\]\)return;/.test(appSrc), true);
  /* 요약을 만들어도 실어 보내지 않으면 소용없다 */
  eq('채팅·관전 요청에 요약이 실린다',
    /if\(payload\.mode==="chat"\|\|payload\.mode==="auto"\)\{\s*\n\s*const t=loadSum\(payload\.room\|\|bucket\)\.text; if\(t\)payload\.summary=t; \}/.test(web), true);
  /* 요약이 들고 있는 데까지는 빼고 보낸다 — 안 빼면 같은 얘기를 두 번 싣는다 */
  eq('관전도 요약 뒤부터 보낸다',
    (web.match(/buildHistory\(sinceSum\("health",storeRef\.current\.msgs\.health\|\|\[\]\)\)/g) || []).length, 2);
  eq('관전 요약을 굴린다', /setTimeout\(\(\)=>rollSummary\("health"\),1200\);/.test(web), true);
  /* 워커가 단톡 요약을 받는다 — room 검증에 group이 있어야 엉뚱한 방이 안 된다 */
  const w = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  /* ── 요약일 때만 넷을 받는다 ──
     요약은 인물 블록도 형식도 안 쓰는 압축이라 방을 안 가려도 된다. 그런데
     chat·auto에서 health를 방으로 받으면 buildSystem이 인물 블록을 못 골라
     minhyun으로 떨어진다 — 엉뚱한 방 프롬프트가 된다. */
  eq('요약은 네 방을 받는다',
    /mode === "summarize"\s*\n\s*\? \["jaeeon", "minhyun", "group", "health"\]/.test(w), true);
  eq('대화는 세 방만 받는다',
    /: \["jaeeon", "minhyun", "group"\];\s*\n\s*const room = ROOMS_OK\.includes\(body\.room\)/.test(w), true);
  /* 요약 갈래는 room을 안 쓴다 — 그래서 넷을 받아도 안전하다 */
  {
    const i = w.indexOf('if (mode === "summarize") {');
    eq('요약 갈래가 room을 안 본다', w.slice(i, w.indexOf('\n    }', i)).includes('room'), false);
  }
}

/* ── 관전 대화는 한 덩이로 서야 한다 ──
   유저가 보는 것은 이 몇 마디뿐인데 모델이 긴 대화의 한 토막처럼 썼다.
   첫 줄이 「몰라요. 배고프면 먹겠죠.」로 물음 없는 대답이었고, 재언이
   「매점 가라며.」라고 민현이 하지도 않은 말을 인용했다. 그 앞은 영영 없다. */
{
  const 관전 = buildSystem('auto', 'jaeeon', 'R', null, [], null, null, null)
    .map(b => b.text).join('');
  eq('한 덩이로 쓰라고 한다', 관전.includes('**이 몇 마디만 보고도 읽혀야 한다.**'), true);
  eq('첫 발화가 대답이면 안 된다고 한다',
    /첫 발화는 말을 여는 말이다[\s\S]{0,80}대답으로\n?\s*시작하지 않는다/.test(관전), true);
  eq('안 한 말을 인용하지 말라고 한다',
    관전.includes('**서로 안 한 말을 인용하지 않는다**'), true);
  /* ── 인용 어미 ──
     「매점 가라며」가 나왔는데 민현은 바로 「가요, 가」로 받았다. 의도는
     「매점 간다며」였다 — 한 말을 받는 자리에 시킨 말을 받는 어미를 썼고,
     그러면 시킨 적 없는 사람이 시킨 게 된다. 없는 말을 지어낸 게 아니라
     어미가 틀린 것이다. */
  eq('인용 어미를 바로 쓰라고 한다',
    관전.includes('상대가 **한** 말을 받을 때는 「간다며」이고')
    && 관전.includes('상대가 **시킨** 말을 받을 때가 「가라며」다'), true);
  /* 지난 관전 대화는 이력으로 실려 간다 — 거기 있는 말까지 막으면 안 된다 */
  eq('지난 대화는 인용해도 된다', 관전.includes('지난 대화에 있는 말은 인용해도 된다'), true);
  /* 1:1·단톡은 유저가 그 자리에 있어서 앞말이 실제로 있다. 거기엔 안 붙인다 */
  for (const r of ['jaeeon', 'group'])
    eq(`${r} 방에는 안 붙는다`,
      buildSystem('chat', r, 'R', null, [], null, null, null).map(b => b.text).join('')
        .includes('**이 몇 마디만 보고도 읽혀야 한다.**'), false);
}

/* ── 자리에서 본 사진도 모은다 ──
   gallery에는 jaeeon-laundry·minhyun-nap 같은 자리 사진(SCENE_SHOT)이 들어
   있는데, 그건 말풍선이 아니라 화면 배경이라 대화 기록에 안 남는다. album이
   기록만 훑으니 영영 안 열리는 칸이었다 — 빨래방에서 그 사람을 마주 보고
   앉아 있었는데 사진첩에는 없는 것이다. */
{
  const F = new Function(
    'const localStorage={_v:{},getItem(k){return this._v[k]||null},setItem(k,v){this._v[k]=v}};'
    + web.slice(web.indexOf('const loadShots='),
        web.indexOf('}', web.indexOf('loadShots().forEach(k=>set.add(k));')) + 1)
    + 'return {loadShots,stampShot,seenPhotos};')();
  eq('처음엔 비어 있다', F.seenPhotos({}).size, 0);
  F.stampShot('jaeeon-laundry');
  eq('본 것이 사진첩에 꽂힌다', [...F.seenPhotos({})], ['jaeeon-laundry']);
  /* 같은 자리에 여러 번 앉아도 한 장이다 */
  F.stampShot('jaeeon-laundry');
  eq('같은 사진이 두 번 안 꽂힌다', F.loadShots().length, 1);
  /* 받은 사진과 본 사진이 한 앨범에 모인다 */
  eq('받은 것과 본 것이 같이 모인다',
    [...F.seenPhotos({ jaeeon: [{ photo: 'jaeeon-mug' }] })].sort(),
    ['jaeeon-laundry', 'jaeeon-mug']);
  F.stampShot('');
  eq('빈 값은 안 꽂힌다', F.loadShots().length, 1);
  /* 자리 사진이 gallery에 있어야 cam에 뜬다 — 없으면 모아도 안 보인다 */
  const 자리사진 = [...web.slice(web.indexOf('const SCENE_SHOT={'), web.indexOf('const WAY="귀갓길"'))
    .matchAll(/"([a-z]+-[a-z]+)"/g)].map(m => m[1]);
  eq('자리 사진이 다 gallery에 있다',
    자리사진.filter(k => !web.includes(`"${k}.webp"`)), []);
  /* 배경을 켜는 그 자리에서 적어야 한다 — 웹·앱 둘 다 */
  eq('웹이 본 것을 적어둔다', /if\(shot\)\{[\s\S]{0,200}stampShot\(shot\);/.test(web), true);
  eq('앱이 본 것을 적어둔다',
    (appSrc.match(/if\(shot\)stampShot\(shot\);/g) || []).length, 2);
  /* 앱이 손으로 앨범을 다시 만들면 웹과 어긋난다 — 같은 함수를 쓴다 */
  eq('앱도 같은 함수로 앨범을 만든다', /const album=seenPhotos\(msgs\);/.test(appSrc), true);
}

/* ── 계절을 안 알려주면 지어낸다 ──
   요일과 때만 보내고 계절을 안 보냈다. 그래서 팔월에 민현이 「눈이 그제보다
   덜 오네요」라고 했다. 날씨는 창밖을 보면 바로 나오는 말이라, 안 알려주면
   지어낸다. 달까지는 안 준다 — 날짜를 주면 날짜를 세기 시작한다. */
{
  const 계절 = new Function(web.slice(web.indexOf('const seasonWord='),
    web.indexOf('/* ── 자는 사람은 먼저 말을 안 건다 ──')) + 'return seasonWord;')();
  eq('달을 계절로 옮긴다',
    [1, 3, 5, 6, 8, 9, 11, 12].map(m => 계절(new Date(2026, m - 1, 15))),
    ['겨울', '봄', '봄', '여름', '여름', '가을', '가을', '겨울']);
  /* 워커는 UTC로 돌고 어느 엣지에 뜨는지도 그때그때다 — 프론트가 재서 보낸다 */
  for (const [label, src] of [['웹', web], ['앱', readFileSync(join(ROOT, 'app/lib/api.ts'), 'utf8')]])
    eq(`${label}이 계절을 보낸다`, /season(:|=)\s*seasonWord\(\)/.test(src), true);
  const w = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  eq('워커가 계절을 받는다',
    /const season = SEASON_WORDS\.includes\(body\.season\) \? body\.season : null;/.test(w), true);
  /* 아는 낱말만 받는다 — 모르는 값이 그대로 프롬프트에 박히면 안 된다 */
  eq('아는 계절만 받는다', /const SEASON_WORDS = \["봄", "여름", "가을", "겨울"\];/.test(w), true);
  const v = buildVolatile('chat', 'jaeeon', 'R', null, [], null, { jaeeon: 10 }, null, null, [], 3,
    null, false, '저녁', '화요일', null, false, null, [], '여름');
  eq('지금 줄에 계절이 앞선다', v.includes('## [지금] 여름 화요일 저녁'), true);
  /* 값은 가변부, 설명은 고정부 */
  const 규칙 = buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null).map(b => b.text).join('');
  eq('설명은 고정부에 있다', 규칙.includes('## 날씨와 계절 (지어내지 않기)'), true);
  eq('여름에 눈이 안 온다고 적었다', 규칙.includes('여름에 눈이 오지 않는다'), true);
  /* 「그제보다 덜 오네요」 — 없던 날을 근거로 삼는 것도 같이 막는다 */
  eq('어제 날씨도 지어내지 않는다',
    규칙.includes('어제·그제 날씨를 지어내지 않는다'), true);
}

/* ── 두 사람이 서로에 대해 같은 것을 알아야 한다 ──
   방이 갈려 있어서 이 둘은 서로가 무슨 말을 했는지 못 본다(그게 이 프로덕트의
   구조다). 그래서 안 박아두면 각 방에서 따로 지어내고, 유저만 두 개의 이야기를
   듣는다. 실제로 재언은 「혼자 살면 이렇게 돼요」라고 해놓고 한 시간 뒤에
   「같이 살아요」라고 했고, 점심은 민현이 「집에서 먹는다」 재언이 「급식실
   간다」고 갈렸다. */
{
  const 방들 = ['jaeeon', 'minhyun', 'group'].map(r =>
    buildSystem('chat', r, 'R', null, [], null, null, null).map(b => b.text).join(''));
  const 관전 = buildSystem('auto', 'jaeeon', 'R', null, [], null, null, null).map(b => b.text).join('');
  /* 네 방이 같은 글자를 봐야 한다 — 한 방만 알면 그 방에서만 맞는 말이 된다 */
  for (const [i, t] of [...방들, 관전].entries())
    eq(`${i}번째 방이 공용 사실을 본다`, t.includes('## 두 사람에 대한 사실 (지어내지 않기)'), true);
  for (const 사실 of ['둘은 **같이 산다.**', '이재언은 지금 혼자 살지 않는다',
                      '이재언의 점심은 **학교에서** 먹는다',
                      '이민현의 점심은 **집에 가서** 먹는다'])
    eq(`「${사실}」이 네 방에 다 있다`,
      [...방들, 관전].filter(t => !t.includes(사실)).length, 0);
  /* 어긋남은 하나뿐이고 일부러다 — 사고가 아니라 설계라고 적어둬야 재현된다 */
  eq('점심의 어긋남이 설계로 적혀 있다',
    방들[0].includes('이재언은 그렇게 알고 있다') && 방들[0].includes('일부러 그렇다'), true);
  /* 「혼자 살며 익혔다」가 현재로 읽혔다. 그 문장이 원인이다 */
  const 재언블록 = 방들[0];
  eq('혼자 살던 것은 과거로 적혀 있다',
    /민현이 오기 전 혼자 살던 몇 해 동안 익혔다/.test(재언블록)
    && /지금은 혼자 살지 않는다/.test(재언블록), true);
  eq('혼자 살며라는 말이 안 남아 있다', /혼자 살며 익혔다/.test(재언블록), false);
}

/* ── 수위는 인물마다 다르다 ──
   공통 바닥(WORLD)은 네 방이 다 쓰는 조각이라 여기에 한 사람 기준을 적으면
   다른 사람에게도 걸린다. 재언은 스물아홉·스물여덟 성인 둘이고, 민현은 고3에
   유저는 그 학교 교생이다. 같은 줄일 수가 없다. 바닥만 공통으로 두고 범위는
   인물 블록에서 정한다 — 조각 2가 이미 인물별로 갈려 있어 캐시도 안 깨진다. */
{
  const 세계 = buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null)
    .map(b => b.text)[0];
  eq('공통 바닥은 17세다', /17세 이용가 기준을 유지한다/.test(세계), true);
  /* 바닥이 바닥으로만 있어야 한다 — 여기에 범위를 적으면 둘 다에게 걸린다 */
  eq('바닥은 범위를 정하지 않는다',
    /각 인물 프롬프트의 「거리와 접촉」에 적힌 것을 따른다/.test(세계), true);
  eq('행위는 어디에서도 안 쓴다', /성행위는 쓰지 않는다/.test(세계), true);
  eq('몸은 옷 위까지다', /몸은 옷 위까지만 말한다/.test(세계), true);

  const 재언 = buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null).map(b => b.text).join('');
  const 민현 = buildSystem('chat', 'minhyun', 'R', null, [], null, null, null).map(b => b.text).join('');
  /* 재언 — 성인 둘. 키스를 컷으로 끊지 않고 허리·입술까지 든다 */
  eq('재언은 허리와 입술까지다',
    /목덜미, \*\*허리\*\*, 등, 끌어안기, \*\*입술\*\*/.test(재언), true);
  eq('재언은 키스를 컷으로 끊지 않는다',
    /키스를 장면 전환으로 끊지 않는다/.test(재언), true);
  /* 말이 더 위험한 사람이다 — 그게 이 인물의 자리다 */
  eq('재언은 말이 더 위험하다',
    /제일 위험한 자리는 몸이 아니라 말이다/.test(재언), true);
  /* 민현 — 고3이고 유저는 그 학교 교생이다. 세지는 것은 몸이 아니라 집착이다 */
  eq('민현에게 성적인 말을 안 시킨다', /성적인 말은 하지 않는다/.test(민현), true);
  eq('민현은 안 놓아주는 쪽으로 센다',
    /\*\*안 놓아주는 쪽\*\*이고, 그게 더 무섭다/.test(민현), true);
  eq('민현은 거리를 좁히지 붙잡지 않는다',
    /붙잡는 게 아니라 \*\*거리를 좁히는 것\*\*으로 한다/.test(민현), true);
  /* ── 안 만지고 아는 것 ──
     몸에 관한 것도 닿아서가 아니라 봐서 안다. 「샴푸 바꿨죠」라고 하고
     어떻게 아느냐고 물으면 대답하지 않는다 — 이 애 설계가 원래
     「무서운 건 몸이 아니라 알고 있다는 것」이다 */
  eq('민현은 안 만지고 안다',
    /몸에 관한 것도 \*\*닿아서가 아니라 봐서\*\* 안다/.test(민현), true);
  eq('그 결의 예시가 있다',
    /민현: 샴푸 바꿨죠\. \/ 어제까진 다른 거였는데\./.test(민현), true);
  /* ── 조르되 받아내지 않는다 ──
     유저의 집은 INVITES에도 없다(편의점·레코드샵·체육관뿐). 이 애도 그걸
     알아서 조른다 — 받아낼 생각이 아니라 거절당하려고 하는 말이다.
     실제로 가는 일은 없다는 것을 같이 적어둔다 */
  eq('조르는 건 거절당하려고 하는 말이다',
    /받아낼 생각으로 하는 말이 아니라 거절당하려고 하는 말\*\*이다/.test(민현)
    && /실제로 가는 일은 없다/.test(민현), true);
  /* 한 줄로 이어져야 한다. 「…싶은데」에서 자르고 다음 변주로 넘기면
     말줄임표가 하는 일이 없어진다 — 조르기 전의 그 뜸이 이 말의 전부다 */
  eq('그 말의 예시가 있다',
    /민현: 선생님 머리카락에서 샴푸향 나요\. 저도 그거 쓰고 싶은데\.\.\. 초대해주세요\./.test(민현), true);
  eq('민현이 갈 수 있는 자리에 집이 없다',
    /minhyun: \[\{ at: 40, place: "편의점" \}, \{ at: 80, place: "레코드샵" \}, \{ at: 120, place: "체육관" \}\]/.test(workerSrc)
    && !/minhyun:[^\]]*"집"/.test(workerSrc), true);
  /* 재언 것이 민현에게 새면 안 된다. 조각이 갈려 있어야 그게 지켜진다 */
  eq('재언의 범위가 민현에게 안 샌다',
    ['키스를 장면 전환으로 끊지 않는다', '아침에 아직 같은 집'].filter(t => 민현.includes(t)), []);
}

/* ── 결이 흘러내리는 것 ──
     대화 예시는 고정부 한참 앞에 있고 이력은 뒤로 갈수록 길어진다. 그러면
     모델이 예시가 아니라 제가 몇 턴 전에 뱉은 밋밋한 말을 견본으로 삼는다.
     재언은 「자요」를 열 번 되풀이하는 잔소리꾼이 되고, 민현은 매 응답을
     「농담이고, 이 닦고 자요」로 닫는 착한 챗봇이 된다 — 둘 다 예시에는
     없는 말이다. 응답 직전인 여기서 한 번 더 붙잡는다 */
  eq('지난 말을 견본으로 삼지 말라고 한다',
    v.includes('지난 네 말이 아니라 「대화 예시」가 견본이다'), true);
  /* 왜 그러면 안 되는지는 고정부의 인물 블록에 있다 — 설명은 고정부, 값은 가변부 */
  for (const [who, 말] of [['jaeeon', '같은 요구를 두 번 하지 않는다'],
                           ['jaeeon', '말꼬리를 잡지 않는다'],
                           ['jaeeon', '훈계하지 않는다'],
                           ['minhyun', '착한 결론으로 닫지 않는다'],
                           ['minhyun', '스스로 수위를 낮추지 않는다'],
                           ['minhyun', '상대를 안심시키지 않는다']])
    eq(`${who}의 「${말}」이 고정부에 있다`,
      buildSystem('chat', who, 'R', null, [], null, null, null).map(b => b.text).join('').includes(말), true);
}
/* 유저가 「임현 씨」라고 하니 「아 잘못 말했네요」로 자기 이름을 바꿨다 */
eq('자기 이름은 고정이다',
  /이름은 고정된 사실이다/.test(workerSrc)
  && /인물이 자기 이름을 잊거나 다른 이름으로 받아들이지 않는다/.test(workerSrc), true);
/* 생각을 꺼두면 판단이 필요한 자리에서 제일 먼저 무너진다.
   그리고 medium으로는 모자랐다 — 설정(외형·과거·취향)은 지키는데
   「유저 낱말을 어미만 바꿔 되돌리지 않는다」 같은 미세한 줄에서 계속
   미끄러졌다. 15,000자 안에서 그 몇 줄이 묻힌다 */
eq('대사 모델의 생각을 켜고 힘을 줬다',
  /\{ id: "claude-sonnet-5", effort: "high", noThinking: false \}/.test(workerSrc), true);
/* 아이콘이 없으면 브라우저가 /favicon.ico를 찾다가 404를 낸다 */
eq('탭 아이콘이 있다', /<link rel="icon" href="data:image\/svg\+xml/.test(web), true);

/* 라면 하나 먹는 데 뚜껑·젓가락·국물 소리가 다 붙어 말풍선보다 괄호가 많았다 */
eq('행동 지문은 한 응답에 하나만',
  trimTics([{ sender: 'minhyun', text: '(뚜껑을 만지작거린다)' },
            { sender: 'minhyun', text: '잘 먹을게요.' },
            { sender: 'minhyun', text: '(면발 후루룩)' },
            { sender: 'minhyun', text: '근데 이거로 다예요?' },
            { sender: 'minhyun', text: '(라면 국물 마시는 소리)' }]).map(m => m.text),
  ['(뚜껑을 만지작거린다)', '잘 먹을게요.', '근데 이거로 다예요?']);

/* 가자고 해놓고 갈게요 했더니 아무 말도 없이 대화가 멈췄다 */
eq('같이 가기로 하면 상대가 답을 한다',
  /const next=\[\.\.\.\(storeRef\.current\.msgs\[iv\.char\]\|\|\[\]\),sys\];/.test(web)
  && /await runTurn\(iv\.char\);/.test(appSrc), true);

/* 세계관이 열리는 자리라 문장을 고정한다 — 각본만이 아니라 모델도 */
eq('첫 연락 두 대목이 프롬프트에도 박혀 있다',
  /"선생님이 저 책임진다면서요\."/.test(workerSrc)
  && /"그래서 책임은 어떻게 질 건데요\?"/.test(workerSrc), true);
eq('설명은 유저가 물었을 때만',
  /유저가 누구인지 모르겠다고 하거나 무슨 책임이냐고 물을 때만/.test(workerSrc), true);
/* 이미 한 장면을 다시 시작하면 관계가 매일 처음으로 돌아간다 */
eq('첫 연락은 초기 상태에서만 쓴다',
  /대화 기록에 이미 등장했다면 다시 반복하지 않는다/.test(workerSrc), true);
  /* 절 이름에 '첫인사'가 들어가면 indexOf 필터가 첫 만남까지 삼킨다 — 한 번 그랬다 */
  eq('평소 인사에 첫 만남이 안 섞인다',
    ['jaeeon', 'minhyun'].map(c => (corpus.proactive[c] || [])
      .filter(p => (p.when + ' ' + p.sec).indexOf('첫인사') >= 0)
      .some(p => p.when === '첫 만남')), [false, false]);
}
/* 각본으로 돌렸으니 워커에는 선톡 모드가 없어야 한다 — 죽은 갈래를 남기지 않는다 */
eq('워커에 선톡 모드가 없다', /"greet"/.test(workerSrc), false);

/* ── 이력을 캐시에 태운다 ──
   전에는 이력 상한이 30이었다. 말풍선이 한 턴에 두셋이니 실질 열 턴 —
   어제 한 얘기를 못 기억했다. 그렇다고 그냥 늘리면 매 턴 정가로 다 낸다.
   시스템 끝에 있던 가변부를 대화 뒤로 옮겨야 이력이 캐시 대상이 된다. */
eq('워커가 개수가 아니라 글자로 센다', /MAX_HISTORY_CHARS = 60000/.test(workerSrc), true);
eq('웹·앱도 같은 예산을 쓴다',
  /const HISTORY_CHARS=12000/.test(web) && /HISTORY_CHARS = 12000/.test(apiSrc), true);

/* ── 요약 ──
   원문 창 밖으로 밀려난 대화는 요약이 들고 있다. 없으면 그냥 없던 일이 된다. */
eq('요약이 고정부에 들어간다 — 300턴에 한 번 바뀌므로 캐시에 얹혀 간다', (() => {
  const withSum = buildSystem('chat', 'jaeeon', 'R', null, [], null, { jaeeon: 10 }, null, null, [], 5, '옥상에 갔다.');
  return withSum.every(b => b.cache_control) && withSum.map(b => b.text).join('').includes('옥상에 갔다.');
})(), true);
eq('요약이 없으면 그 대목도 없다',
  buildSystem('chat', 'jaeeon', 'R', null, [], null, { jaeeon: 10 }, null, null, [], 5, '')
    .map(b => b.text).join('').includes('## [그동안 있었던 일]'), false);
/* 요약은 압축이지 연기가 아니다. 여기가 작은 모델 자리다 */
eq('요약은 하이쿠가 쓴다', /SUMMARY_MODEL = \{ id: "claude-haiku-4-5"/.test(workerSrc), true);
/* 인물 프롬프트를 쓰면 압축하러 가서 2만 자를 다시 읽는 꼴이다 */
eq('요약 호출은 인물 프롬프트를 안 쓴다',
  /askSummary\(env,\s*\n?\s*\[\{ type: "text", text: SUMMARIZE/.test(workerSrc), true);
eq('웹·앱 둘 다 요약 뒤부터만 원문을 보낸다',
  /sinceSum\(room,next\)/.test(web) && /m\.created_at > \(sum\.upto \|\| 0\)/.test(apiSrc), true);
/* 다 뭉치면 방금 하던 얘기까지 요약으로만 남아 말투가 끊긴다 */
eq('뭉칠 때 끝은 남긴다',
  /TAIL_KEEP=4000/.test(web) && /TAIL_KEEP = 4000/.test(apiSrc), true);

/* ── 매 턴 붙는 설명을 캐시되는 자리로 옮겼다 ──
   가변부는 캐시가 안 걸린 정가 자리다. 897자 중 680자가 매번 똑같은 글자였고
   그 897자가 캐시된 18,671자의 절반 값이었다. */
{
  const sig = { minhyun: { count: 12, minsAgo: 8, vibe: '들뜸' } };
  const prof = { subject: '국어', likes: '커피' };
  const v = buildVolatile('chat', 'jaeeon', 'R', sig, ['jaeeon-mug'], prof, { jaeeon: 90 }, null, null, ['옥상'], 12);
  eq('가변부에 설명이 안 남아 있다',
    ['이 숫자를 보고 스스로 가늠한다', '목록을 읊지 말고', '눈치챈 것처럼만',
     '대부분의 턴에는 안 꺼낸다'].filter(t => v.includes(t)), []);
  eq('설명은 고정부에 있다',
    ['이 숫자를 보고 스스로 가늠한다', '목록을 읊지 말고', '눈치챈 사람처럼만',
     '대부분의 턴에는 안 꺼낸다'].filter(t =>
      !buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null).map(b => b.text).join('').includes(t)), []);
  eq('값은 가변부에 남아 있다',
    ['옥상', '커피', '들뜸', 'jaeeon-mug'].filter(t => !v.includes(t)), []);
  eq('가변부가 400자 밑이다 — 전에는 897자였다', v.length < 400, true);
}
/* 갈 자리가 애초에 안 열리는 방에 조건 설명만 실리면 그것도 낭비다 */
eq('단톡·두 사람 방에는 자리 설명이 안 붙는다',
  ['group', 'auto'].map(k => buildSystem(k === 'auto' ? 'auto' : 'chat', k === 'auto' ? 'jaeeon' : 'group',
    'R', null, [], null, null, null).map(b => b.text).join('').includes('대부분의 턴에는 안 꺼낸다')),
  [false, false]);

/* 캐시가 안 맞아도 오류가 안 난다. 실측을 안 보면 정가를 무는 줄 모른다 */
eq('응답에 실측 토큰이 실린다', /usage: lastUsage/.test(workerSrc), true);
eq('웹·앱 둘 다 실측을 찍는다',
  /cache_read_input_tokens/.test(web) && /cache_read_input_tokens/.test(appSrc), true);

/* ── 같은 규칙을 두 번 적지 않는다 ──
   한 요청에 같이 실리는 덩어리들에 같은 말이 두세 판으로 적혀 있었다.
   값보다 문제는 따로 있다 — 한 규칙이 세 군데 있으면 하나를 고칠 때 나머지
   둘이 남아서, 프롬프트가 자기 자신과 다른 말을 하기 시작한다. */
{
  /* 세는 대상은 프롬프트다. 소스 주석에 같은 말이 나오는 건 중복이 아니다 —
     주석은 모델이 안 읽는다. 그래서 주석을 걷어내고 센다. */
  const promptSrc = workerSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* 자기 심리 해설 금지 — 세계관에 한 번, 인물마다 한 번씩 적혀 있다.
     세 군데는 지은이가 일부러 겹쳐둔 것이고, 여기서 세는 건 그게 더 늘지 않게 하려는 것이다 */
  eq('심리 해설 금지가 세 군데를 안 넘는다',
    (promptSrc.match(/심리를 이론처럼 설명하지 않는다|심리 구조를 해설하지 않는다/g) || []).length, 3);
  /* 1번이 최애라는 말은 인물마다 자기 목록에서 한다 — FACTS가 또 말하지 않는다 */
  eq('최애 규칙은 인물 블록에만',
    (workerSrc.match(/각 목록의 첫 번째가 가장 좋아하는 작품이다/g) || []).length, 2);
  /* 침묵을 말줄임표로 대신하지 말라는 말이 TICS에 두 번, 인물에 한 번 있었다 */
  eq('침묵 규칙이 겹치지 않는다',
    (workerSrc.match(/침묵은 점 세 개가 아니라/g) || []).length, 0);
  /* 존댓말 예시가 ★규칙 안과 [말투 예시]에 같은 문장으로 들어 있었다 */
  eq('존댓말 예시가 두 번 나오지 않는다',
    ['괜찮으시면 됐어요.', '우산 가져가세요, 비 와요.']
      .filter(t => (workerSrc.match(new RegExp(t.replace(/[.]/g, '\\.'), 'g')) || []).length > 1), []);
}

/* ── 말투 예시가 문구집과 어긋나지 않는다 ──
   프롬프트의 예문은 문구집에서 뽑은 결이어야 한다. 어긋나면 모델이 문구집에
   없는 말투로 연기한다 — 데모(각본)와 라이브(모델)가 다른 사람이 된다. */
{
  const corpus = readFileSync(join(ROOT, 'docs/dialogue-corpus.md'), 'utf8');
  const say = who => corpus.split(/\r?\n/).map(l => l.replace(/\\$/, '').trim())
    .filter(l => l.startsWith(who + ' —')).map(l => l.slice(who.length + 2).trim());
  const J = say('재언'), M = say('민현');
  eq('문구집을 제대로 읽었다', J.length > 1000 && M.length > 1000, true);
  /* 재언은 문구집 1,321줄에서 한 번도 -습니다/-습니까를 쓰지 않는다 */
  /* 딱 하나 있다 — 처음 말을 거는 줄이다. 아직 아는 사이가 아닐 때만 허용된
     어미라서, 여기가 늘어나면 규칙이 무너진 것이다. */
  eq('문구집의 재언은 첫 마디에서만 -ㅂ니다를 쓴다',
    J.filter(t => /(습니다|습니까|입니다|됩니다)/.test(t)),
    ['새로 오셨죠. / 애들 때문에 정신 없으시겠네요. / 저한테는 편하게 메세지 주셔도 됩니다.',
     '첫 주인데 고생하셨어요. / 애들 때문에 정신 없으셨겠네요. / 저한테는 편하게 메세지 주셔도 됩니다.']);
  eq('프롬프트도 그 예외를 적어뒀다', /첫 인사처럼 아직 모르는 사이에서는/.test(workerSrc), true);
  /* 그러니 프롬프트 예문에도 없어야 한다. 이름 밝히는 자리 하나만 예외 */
  /* 규칙 문장 자체는 세지 않는다 — 따옴표 안의 예문만 본다 */
  /* 말투 절부터 끝까지 — 규칙과 대화 예시가 다 여기 있다. 첫 인사용 두 마디만 예외다 */
  eq('재언 예문에 -ㅂ니다가 없다', (() => {
    const j = workerSrc.match(/const JAEEON = `([\s\S]*?)`;/)[1];
    return (j.slice(j.indexOf('말투의 핵심')).match(/"[^"]+"/g) || [])
      .filter(q => /(습니다|습니까|입니다|됩니다)/.test(q));
  })(), ['"이재언입니다"', '"메시지 주셔도 됩니다"']);
  /* 민현은 유저에게도 삼촌에게도 존댓말이다 */
  eq('문구집의 민현은 반말을 안 쓴다', M.filter(t => /(^뭐야|삼촌도 참|설명인데\.)/.test(t)).length, 0);
  eq('민현 말투 예시에도 반말이 없다', (() => {
    const m = workerSrc.match(/const MINHYUN = `([\s\S]*?)`;/)[1];
    const i = m.indexOf('말투의 핵심'), j = m.length;
    return ['뭐야', '삼촌도 참'].filter(t => m.slice(i, j).includes(t));
  })(), []);
}
eq('서른 마디에서 자르던 건 없다',
  /slice\(-30\)/.test(web) || /slice\(-30\)/.test(apiSrc) || /MAX_HISTORY\b/.test(workerSrc), false);
{
  const h = n => Array.from({ length: n }, (_, i) => ({ role: 'user', content: 'x'.repeat(100) }));
  eq('예산 안이면 통째로 간다', budgetHistory(h(5), 1000).length, 5);
  eq('넘치면 오래된 쪽부터 뺀다', budgetHistory(h(20), 1000).length, 10);
  /* 뒤에서 자르면 캐시된 앞부분이 매 턴 달라져 한 번도 못 읽는다 */
  const kept = budgetHistory(h(3).map((m, i) => ({ role: 'user', content: String(i) })), 2);
  eq('남는 건 늘 최근 쪽이다', kept[kept.length - 1].content, '2');
  eq('예산이 0이어도 한 마디는 남긴다', budgetHistory(h(5), 0).length, 1);
}
/* 캐시 지점은 마지막 유저 발화에 찍고, 가변부는 그 뒤에 표시 없이 붙인다.
   가변부에 지점을 찍으면 매 턴 다른 키가 되어 쓰기만 하고 못 읽는다. */
eq('지점은 가변부 앞에 찍는다',
  /: \[\{ type: "text", text: tail\.content, cache_control: CACHE \}\];/.test(workerSrc)
  && /if \(volatile\) blocks\.push\(\{ type: "text", text: volatile \}\);/.test(workerSrc), true);
/* 선톡 턴은 예외다 — 마지막 턴이 저장 안 되는 지시문이라 접두가 재현될 수
   없고, 찍어봐야 2배 요금으로 쓰고 영영 못 읽는 항목이 된다 */
eq('선톡 턴에는 이력 지점을 안 찍는다',
  /body\.greet === true\s*\n\s*\? \[\{ type: "text", text: tail\.content \}\]/.test(workerSrc), true);
/* 앱은 최근 것부터 가져와야 한다. ASC LIMIT이면 200개가 넘는 순간
   제일 오래된 200개가 돌아온다 — 화면에도 프롬프트에도 옛날 것만 남는다 */
{
  const dbSrc = readFileSync(join(ROOT, 'app/lib/db.ts'), 'utf8');
  eq('getMsgs가 최근 것부터 가져온다',
    /ORDER BY created_at DESC LIMIT \?\)'\s*\n?\s*\+ ' ORDER BY created_at ASC/.test(dbSrc), true);
  eq('D-30은 제일 처음 말로 센다', /export async function getFirstMsg/.test(dbSrc)
    && /await getFirstMsg\(room\)/.test(apiSrc), true);
}


/* ── JSX 문법 ──
   여기까지 index.html은 문자열로만 봤다. 그래서 태그 하나가 안 닫혀도
   전부 통과했고, 화면은 새하얗게 뜬다. 파서가 있으면 실제로 읽어본다.
   앱 쪽 node_modules에 얹혀 가므로 없으면 조용히 건너뛴다 — 이 파일의
   의존성 없음 원칙은 지킨다. */
{
  let parse = null;
  try { ({ parse } = await import('../app/node_modules/@babel/parser/lib/index.js')); } catch { }
  if (!parse) {
    console.log('  --   JSX 문법 (파서가 없어 건너뜀 — app에서 npm i 하면 돈다)');
  } else {
    /* 바벨을 타는 파일 둘. 여기서 안 읽히면 브라우저에서도 안 읽히고 화면이 하얗다 */
    for (const f of ['app-ui.js', 'app.js']) {
      const src = readFileSync(join(ROOT, f), 'utf8');
      eq(`${f}를 찾았다`, src.length > 1000, true);
      let err = '';
      try { parse(src, { sourceType: 'script', plugins: ['jsx'] }); }
      catch (e) { err = e.message; }
      eq(`${f}의 JSX가 실제로 파싱된다`, err, '');
    }
    /* 데이터 파일은 바벨을 안 탄다. JSX가 한 줄이라도 섞이면 브라우저가
       그 자리에서 문법 오류를 내고 나머지가 통째로 안 실린다 */
    let derr = '';
    try { parse(readFileSync(join(ROOT, 'app-data.js'), 'utf8'), { sourceType: 'script' }); }
    catch (e) { derr = e.message; }
    eq('app-data.js에는 JSX가 안 섞였다', derr, '');
  }
}

/* ── 파일이 넷으로 갈렸다 ──
   한 파일에 3,500줄이 있었다. 빌드 도구를 들이지 않고 나누려면 순서가 전부다 —
   데이터가 먼저, 화면 조각이 다음, 앱이 마지막. 하나라도 어긋나면 화면이 하얗다. */
{
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  eq('갈라진 파일이 전부 있다', APP_FILES.filter(f => !exists(f)), []);
  eq('index.html은 뼈대만 남았다', html.split('\n').length < 60, true);
  const order = ['null.css', 'app-data.js', 'app-ui.js', 'app.js'].map(f => html.indexOf(f));
  eq('싣는 차례가 데이터 → 화면 → 앱이다',
    order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), true);
  /* 데이터에는 JSX가 없어서 바벨을 안 태운다 — 태우면 그만큼 늦게 뜬다 */
  /* 판 번호가 없으면 브라우저가 옛 파일을 계속 쓴다. peek 넘치는 걸 고쳐
     올렸는데 CSS에만 번호가 없어서 그대로 넘쳤다 — 화면으로는 배포가 된 것처럼
     보이고 사람은 안 고쳐졌다고 한다. 넷이 같은 번호여야 한다 */
  {
    const v = [...html.matchAll(/(null\.css|app-data\.js|app-ui\.js|app\.js)\?v=(\d+)/g)];
    eq('갈라진 파일에 판 번호가 다 붙었다', v.length, 4);
    eq('넷이 같은 판이다', new Set(v.map(m => m[2])).size, 1);
  }
  eq('데이터는 바벨을 안 탄다', /<script src="app-data\.js/.test(html), true);
  eq('화면과 앱은 바벨을 탄다',
    /<script type="text\/babel" src="app-ui\.js/.test(html)
    && /<script type="text\/babel" src="app\.js/.test(html), true);
  /* 지우고 다시 여는 표식은 리액트가 뜨기 전에 읽혀야 한다 */
  eq('비우는 자리가 화면보다 앞이다', html.indexOf('null_wipe') < html.indexOf('app-data.js'), true);
}

/* 「같이 가기로 했다」를 메신저 화면 그대로 두면 마주 앉은 걸 그릴 방법이 없다.
   자리에 가면 그 자리를 깔고 말풍선을 걷는다 */
eq('자리마다 배경 사진이 있다', ['교실','보건실','옥상','도서관','빨래방','편의점','레코드샵','집']
  .filter(p => !new RegExp(`name:"${p}",[^}]*?bg:"place-`).test(web)), []);
eq('배경 파일이 전부 저장소에 있다',
  (web.match(/"(place-[\w-]+\.webp)"/g) || []).map(s => s.slice(1, -1))
    .filter(f => !exists(f)), []);
eq('자리에 가면 말풍선을 걷는다',
  /const bg=scene&&\(scene\.shot\|\|scene\.bg\|\|PLACE_BG\[scene\.place\]\)/.test(web)
  && /className="screen scenewrap"/.test(web), true);
/* 사진이 없는 자리(교실)도 열려야 한다 — 배경만 없고 자리는 자리다 */
eq('배경이 없어도 자리는 열린다', /if\(scene\)\{/.test(web), true);
/* 훅이 자리 분기보다 아래 있으면 자리에 들어가고 나올 때 훅 개수가 달라져 리액트가 터진다 */
eq('스크롤 훅이 자리 분기보다 위에 있다',
  web.indexOf('el.scrollTop=el.scrollHeight') < web.indexOf('const bg=scene&&(scene.shot'), true);
/* 장소 사진만 쓸 때는 아래가 우연히 어두워서 그림자만으로 버텼다. 이제 인물
   사진이 깔리는데 그건 보장이 없다 — minhyun-window는 아래가 흰 프린트다 */
eq('아래쪽에 어둠막을 깐다',
  /\.scenewrap::before\{content:"";position:absolute;left:0;right:0;bottom:0;height:58%/.test(web)
  && /\.scenewrap \.stext\{[^}]*text-shadow/.test(web), true);
/* 들어간 순간엔 빈 방이고 그 사람이 입을 열면 그 사람이 화면이 된다.
   짝은 지어내지 않았다 — 사진 설명이 이미 어디인지 말하고 있다 */
eq('첫 답에 배경이 그 사람으로 바뀐다',
  /if\(sc&&sc\.room===room&&!sc\.shot\)\{/.test(web)
  && /const shot=sceneShot\(sc\.place,room\)/.test(web), true);
eq('자리마다 그 사람 사진이 짝지어져 있다', (() => {
  const t = web.slice(web.indexOf('const SCENE_SHOT={'));
  const body = t.slice(0, t.indexOf('\n};'));
  const keys = [...body.matchAll(/"([a-z]+-[a-z]+)"/g)].map(m => m[1]);
  const files = [...web.matchAll(/"((?:jaeeon|minhyun)-[a-z]+)\.webp"/g)].map(m => m[1]);
  return keys.filter(k => !files.includes(k));           // 없는 사진을 가리키면 빈 방이 된다
})(), []);
/* 교실만 낮/저녁이 갈린다 — desk는 짝이 찍어준 것(수업 중), nap은 자기가 찍은 것(빈 교실) */
eq('교실은 낮과 저녁이 다르다',
  /"교실":\s*\{minhyun:\{day:\["minhyun-window","minhyun-desk"\], eve:\["minhyun-nap"\]\}/.test(web), true);
eq('새로고침해도 그 자리에 남는다', /const loadScene=/.test(web) && /saveScene\(sc\)/.test(web), true);
/* ── 자리는 방의 연장이 아니라 장면이다 ──
   방의 마지막 여섯 줄을 그냥 깔았더니 아까 문자로 주고받던 말이 교실 배경
   위에 얹혔다. 선물 받은 반응이 교실에서 나오고 첫 연락이 교실에서 나왔다. */
eq('자리에 온 뒤의 말만 보여준다', /m\.ts>=\(scene\.since\|\|0\)/.test(web), true);
/* 자리로 들어가는 길은 둘이다 — 인물의 초대, 그리고 지도에서 내가 고르는 것.
   어느 쪽이든 들어간 시각을 찍어야 앞의 대화가 배경 위로 안 새어 나온다 */
/* 다섯 — 첫 자리로, 초대를 받아서, 지도에서 골라서, 선물을 들고 가서,
   그리고 귀갓길로 이어져서 */
/* 여섯 번째는 같이 자리를 옮길 때다(answerMove) */
eq('자리에 들어갈 때 시각을 찍는다',
  (web.match(/since:Date\.now\(\)/g) || []).length, 6);

/* ── 이름표가 말풍선 안으로 새는 것 ──
   누가 말하는지는 sender로만 밝히라고 형식에 적어뒀는데, 관전방은 이력을
   「[이재언] 말」로 넣어주다 보니 모델이 그 모양을 따라 text에 「민현: 」을
   박아 보낸다. 말풍선마다 이름이 찍히고 sender는 다 같아서 아바타가 뭉친다. */
{
  const B = ['jaeeon', 'minhyun'];
  const one = (sender, text, allowed = B) => unlabel([{ sender, text }], allowed)[0];
  eq('쌍점 이름표를 뗀다', one('minhyun', '민현: 네네.').text, '네네.');
  eq('성을 뗀 이름표도 화자를 바꾼다',
    [one('minhyun', '재언: 실수라니까.').sender, one('minhyun', '재언: 실수라니까.').text],
    ['jaeeon', '실수라니까.']);
  eq('대괄호 이름표도 뗀다',
    [one('minhyun', '[이재언] 애들 준다고 했잖아.').sender, one('minhyun', '[이재언] 애들 준다고 했잖아.').text],
    ['jaeeon', '애들 준다고 했잖아.']);
  /* 「삼촌」은 부르는 말이다. 이름표로 치면 「삼촌, 아까 그 커피」가 통째로 잘린다 */
  eq('부르는 말은 안 건드린다', one('minhyun', '삼촌, 아까 그 커피 왜 시켰어요.').text,
    '삼촌, 아까 그 커피 왜 시켰어요.');
  eq('유저 이름표는 이름으로 안 본다', one('jaeeon', '선생님: 안녕하세요').text, '선생님: 안녕하세요');
  /* 1:1 방에 상대가 끼어들면 안 된다 — 이름만 떼고 화자는 그대로 둔다 */
  eq('이 방에 없는 사람은 말하지 못한다',
    [one('jaeeon', '민현: 삼촌 뭐해요', ['jaeeon']).sender, one('jaeeon', '민현: 삼촌 뭐해요', ['jaeeon']).text],
    ['jaeeon', '삼촌 뭐해요']);
  eq('이름표뿐인 줄은 버린다', unlabel([{ sender: 'minhyun', text: '민현:' }], B).length, 0);
  eq('사진만 있는 말풍선은 안 버린다',
    unlabel([{ sender: 'minhyun', text: '', photo: 'minhyun-conv' }], B).length, 1);
}

/* ── 지도와 가방 ──
   초대는 저쪽이 정하고 지도는 이쪽이 정한다. 자리마다 받아오는 게 하나씩 있다. */
{
  /* 체육관은 아직 배경 사진이 없다. 자리는 icon으로 센다 — bg로 세면 빠진다 */
  const names = [...web.matchAll(/\{name:"([^"]+)",[^}]*?icon:/g)].map(m => m[1])
    .filter(n => n !== '학교');
  eq('지도에 아홉 자리가 있다', names.length, 9);
  /* 대화 수나 날짜로는 안 열린다. 다녀와야 열린다 —
     앉아서 말만 쌓아도 지도가 넓어지면 그건 지도가 아니라 또 하나의 게이지다 */
  eq('지도는 대화 수로 안 열린다', /\{name:"[^"]+",[^}]*?\bat:/.test(web), false);
  /* 학교는 자리가 아니라 문이라 처음부터 열려 있다 — 세는 데서 뺀다 */
  eq('교실과 보건실만 처음부터 열려 있다',
    [...web.matchAll(/\{name:"([^"]+)",[^}]*?need:\[\]/g)].map(m => m[1]).filter(n => n !== '학교'),
    ['교실', '보건실']);
  /* need에 적힌 자리가 목록에 없으면 그 자리는 영영 안 열린다 */
  {
    const all = new Set(names);
    const bad = [...web.matchAll(/\{name:"([^"]+)",[^}]*?need:\[([^\]]*)\]/g)]
      .flatMap(m => (m[2].match(/"([^"]+)"/g) || []).map(s => s.slice(1, -1)))
      .filter(n => !all.has(n));
    eq('앞자리가 전부 지도에 있다', bad, []);
  }
  /* 여덟 자리가 두 자리에서 다 닿아야 한다 — 안 닿으면 영영 못 가는 자리가 생긴다 */
  {
    const need = Object.fromEntries([...web.matchAll(/\{name:"([^"]+)",[^}]*?need:\[([^\]]*)\]/g)]
      .map(m => [m[1], (m[2].match(/"([^"]+)"/g) || []).map(s => s.slice(1, -1))]));
    const been = new Set();
    for (let i = 0; i < names.length; i++)
      for (const n of names) if (need[n].every(p => been.has(p))) been.add(n);
    eq('여덟 자리에 전부 닿는다', names.filter(n => !been.has(n)), []);
  }
  /* 자리 이름은 워커와 프론트가 같아야 한다 — 다르면 place가 서버에서 버려지고
     프롬프트에 자리 얘기가 아예 안 붙는다 */
  eq('자리 이름이 워커와 같다', names.filter(n => !PLACE_ITEMS[n]), []);
  /* 물건 키도 마찬가지. 어긋나면 pickGive가 전부 null을 뱉어 가방이 안 찬다 */
  const items = [...web.matchAll(/\{name:"([^"]+)",[^}]*item:"(\w+)"/g)];
  eq('물건 키가 워커와 같다',
    items.filter(([, n, k]) => PLACE_ITEMS[n] && PLACE_ITEMS[n].key !== k).map(m => m[1]), []);
  eq('물건마다 ITEMS에 설명이 있다',
    items.filter(([, , k]) => !new RegExp(`\\n  ${k}:\\s*\\{name:`).test(web)).map(m => m[2]), []);
  eq('편의점은 하리보, 도서관은 책, 레코드샵은 음반',
    [PLACE_ITEMS['편의점'].key, PLACE_ITEMS['도서관'].key, PLACE_ITEMS['레코드샵'].key],
    ['haribo', 'book', 'lp']);
  eq('빌린 것은 표시가 남는다', /book:\s*\{name:"빌린 책",\s*cat:"기록",\s*lent:true/.test(web), true);
}
eq('모르는 자리는 안 받는다', [placeOf('편의점'), placeOf('용궁'), placeOf('')], ['편의점', null, null]);
eq('그 자리 물건만 인정한다',
  [pickGive('haribo', '편의점', false), pickGive('book', '편의점', false), pickGive('haribo', null, false)],
  ['haribo', null, null]);
eq('이미 받았으면 또 안 준다', pickGive('haribo', '편의점', true), null);
{
  const t = buildPlace('편의점', false, 'minhyun');
  eq('자리 블록은 마주 보고 있다고 알린다', /마주 보고/.test(t) && /어디냐고 묻지 않는다/.test(t), true);
  eq('자리 블록에 건넬 것이 적힌다', /"give": "haribo"/.test(t), true);
  eq('이미 받았으면 건넬 것은 안 적는다', /give/.test(buildPlace('편의점', true, 'minhyun')), false);
  eq('자리에 없으면 블록도 없다', buildPlace(null, false, 'minhyun'), '');
  /* 재언은 보건실에 있는 게 일이고 민현은 교실에 앉아 있다. 「불러줘서 왔어요」가
     자기 교실에서 나오면 안 된다 — 찾아온 쪽은 유저다 */
  eq('자기 자리에 있는 사람은 불려 나온 게 아니다',
    /여기는 원래 네 자리다/.test(buildPlace('보건실', true, 'jaeeon'))
    && /찾아온 쪽이 \{user_name\}이다/.test(buildPlace('교실', true, 'minhyun')), true);
  eq('남의 자리에 가면 따로 만난 자리다',
    /따로 만난 자리다/.test(buildPlace('보건실', true, 'minhyun'))
    && !/여기는 원래 네 자리다/.test(buildPlace('옥상', true, 'jaeeon')), true);
    eq('교실과 보건실에 임자가 적혀 있다',
    (web.match(/own:"(minhyun|jaeeon)"/g) || []).length, 2);
}
/* 마주 앉아서 어디 가자고 하면 지금 여기가 어디가 되는지 알 수가 없다 */
eq('자리에 있는 동안엔 갈 자리를 안 꺼낸다',
  /\[같이 가자고 할 수 있는 자리\]/.test(
    buildVolatile('chat', 'minhyun', '선생님', null, [], null, { minhyun: 60 }, null, null, ['옥상'], 5, '편의점', false)),
  false);
eq('자리에 없으면 갈 자리는 그대로 나온다',
  /\[같이 가자고 할 수 있는 자리\]/.test(
    buildVolatile('chat', 'minhyun', '선생님', null, [], null, { minhyun: 60 }, null, null, ['옥상'], 5, null, false)),
  true);
/* 모델이 안 건네주고 끝내는 턴이 있다. 그때마다 가방이 비면 지도를 돌 이유가 없다 */
eq('자리에서 나올 때 못 받았으면 채워준다',
  /const closeScene=\(\)=>\{[\s\S]{0,300}takeItem\(p\.item,sc\.room,sc\.place\)/.test(web), true);

/* ── 관전방도 저절로 쌓인다 ──
   선물도 안 주고 자리도 안 간 사람에게는 그 방이 영영 첫 장면 그대로였다.
   유저 없이도 돌아간다는 게 전제인데 정작 그 방만 유저가 뭘 해야 움직였다.
   자리를 비운 시간(한 시간)과 하루 상한(둘)은 그대로다 — 제일 비싼 호출이다 */
eq('사건이 없어도 만든다', /const ev=loadAutoEvent\(\)\|\|null;/.test(web), true);
eq('사건이 있으면 그 일을 얹는다',
  /\.\.\.\(ev&&ev\.kind\?\{event:\{kind:ev\.kind,to:ev\.to,name:ev\.name\}\}:\{\}\)/.test(web), true);
eq('관전방을 열 때도 돈다',
  /if\(!name\|\|\(view!=="list"&&view!=="health"\)\|\|autoBusy\.current\)return;/.test(web), true);
/* 비운 시간과 상한을 지우면 한 시간에 스물두 번씩 이만 이천 자를 보낸다 */
eq('비운 시간과 상한은 그대로다',
  /if\(now-lastAny<AUTO_AWAY\)return;/.test(web) && /if\(used>=AUTO_MAX_DAY\)/.test(web), true);

/* ── 보내기 단추가 허옇게 떴던 것 ──
   흰색이 -30%에서 시작해 방 색을 95%까지 밀어놨다. 눈에 보이는 구간이 거의 다
   흰색이라 단추가 허옇게 떴고, 그 위에 흰 광택(::after)이 한 번 더 얹혀서
   방 색이 아예 안 읽혔다. 흰 화살표도 같이 묻혔다.
   위에서 아래로 연한색 → 방 색 → 짙은색. 가운데가 방 색이라야 방 색으로 보인다 */
eq('보내기 색은 함수가 만든다',
  /const sendBg=room=>\{/.test(web) && !/#ffffff -30%/.test(web), true);
eq('가운데가 방 색이다',
  /\$\{c\.pale\|\|mid\} 0%, \$\{mid\} 46%, \$\{c\.dk\|\|mid\} 100%/.test(web), true);
/* 연한색·짙은색은 CHARS에 있고 방 목록(ROOMS)에는 색 하나뿐이다.
   room을 그대로 보면 폴백만 먹어서 예전과 똑같이 나온다 — 한 번 그랬다 */
eq('색은 CHARS에서 가져온다', /const c=CHARS\[room\.id\]\|\|\{\};/.test(web), true);
/* 위쪽만 흰 뚜껑을 덮으면 납작해진다. 창 머리 단추처럼 왼쪽 위에서
   비스듬히 오는 하이라이트라야 공으로 보인다 */
eq('하이라이트가 왼쪽 위에서 온다',
  /\.rbtn::after\{[\s\S]{0,160}radial-gradient\(circle at 33% 26%/.test(web), true);
/* 빈 칸일 때와 보낼 수 있을 때가 똑같아서 눌리는지가 안 보였다 */
eq('못 보내는 상태가 보인다', /\.rbtn\[disabled\]\{opacity:\.42/.test(web), true);

/* 앱에서 입력칸만 각졌었다 — 카드·창·단추가 다 둥근데 혼자 border-radius:0.
   보내기는 40x37이라 원이 아니라 옆으로 퍼진 타원이었다 */
eq('입력칸도 둥글다', /\.inputbar input\{[^}]*border-radius:9px\}/.test(web), true);
/* 크기·모양은 한 군데서만 들고 있어야 한다. 세 군데 적으면 세 군데를 고친다 */
eq('단추 셋이 한 규칙을 쓴다',
  /\.rbtn\{position:relative;overflow:hidden;flex:none;width:37px;height:37px;border-radius:50%/.test(web)
  && (web.match(/className="(backbtn|giftbtn|sendbtn) rbtn"/g) || []).length === 4, true);
/* 셋 다 색이 있으면 어느 게 보내기인지 모른다 */
eq('방 색은 보내기만 쓴다',
  /\.backbtn,\.giftbtn\{color:#5d5490;background:linear-gradient/.test(web)
  && /\.sendbtn\{color:#fff;text-shadow/.test(web), true);
/* 하이라이트가 위에 깔리므로 그림은 그 앞에 세워야 한다 */
eq('그림이 하이라이트 앞에 선다', /\.rbtn>svg\{position:relative;z-index:1\}/.test(web), true);

/* 어둠막(::before, z-index:0)이 입력줄 위에 얹혀서 자리에 들어가면
   입력창만 까맸다. 위치 없는 요소는 z-index:0인 형제보다 아래에 깔린다 */
eq('어둠막이 입력줄을 안 덮는다',
  /\.scenewrap \.scenebody,\.scenewrap \.tb,\.scenewrap \.scenebar\{position:relative;z-index:1\}/.test(web), true);
/* 창의 X는 창을 닫는다. 그림만 그려놓고 안 눌리면 창이 아니라 그림이다.
   채팅방 머리글만 남아 있었다 — 창 셋, 자리, 그리고 여기까지 같은 실수였다 */
eq('채팅방 X가 목록으로 보낸다',
  /\{room\.name\}\{watch\?"\.cam":"\.chat"\}<WinDots onClose=\{onBack\}\/>/.test(web), true);
/* 안 눌려도 되는 것은 오프닝의 가짜 오류창 넷과 등록 화면, 그리고 앱 창틀뿐이다 */
eq('안 눌리는 X는 여섯뿐이다', (web.match(/<WinDots\/>/g) || []).length, 6);

/* X는 나가기가 아니라 접기다. 자리는 그대로 두고 메신저로 돌아간다 —
   교실에 앉아서 삼촌한테 카톡하는 건 되는 일이다.
   자리를 뜨는 건 뒤로가기 쪽이고, 그쪽은 한 번 묻는다 */
eq('X는 접기다', /\{scene\.place\}<WinDots onClose=\{onMinimize\}\/>/.test(web), true);
eq('접으면 목록으로 간다', /onMinimize=\{\(\)=>setView\("list"\)\}/.test(web), true);
eq('뒤로가기는 여전히 나가기다', /onClick=\{onLeaveScene\} title="돌아가기"/.test(web), true);
/* 자리에 있는 동안엔 딴 데로 못 간다. 몸은 하나다 */
/* 같이 이동(mv)이 열린 뒤에도, 이동이 안 되는 자리면 여전히 몸이 묶인다 */
eq('자리에 있으면 딴 데로 못 간다',
  /const away=!!scene&&scene\.place!==ask;/.test(web)
  && /const no=!klass&&!mv&&\(away\|\|locked/.test(web)
  && /`현재 위치는 \$\{scene\.place\}\.\.\.`/.test(web), true);

/* ── 접어둔 자리는 시간에 맞춰 끝난다 ──
   X는 나가기가 아니라 접어두기인데 유효기간이 없었다. 낮에 보건실을
   접어두고 저녁에 열어도 아직 보건실에 앉아 있었다 — 재언은 다섯 시에
   퇴근하는 사람인데. 말이 끊긴 지 한 시간이면 그 모임은 끝난 걸로 친다. */
eq('말이 끊긴 지 한 시간이면 자리가 끝난다', /Date\.now\(\)-last<AUTO_AWAY/.test(web), true);
/* 새 숫자가 아니다 — 「자리를 비웠다」의 기준(관전방)과 같은 자를 쓴다 */
eq('한 시간은 자리 비움의 기준과 같은 자다', /AUTO_AWAY=60\*60\*1000/.test(web), true);
eq('나갈 때와 같은 규칙으로 닫는다 — 두고 온 것도 챙기고 한 줄 남긴다', (() => {
  const i = web.indexOf('접어둔 자리는 시간에 맞춰 끝난다');
  const t = web.slice(i, i + 2400);
  return t.includes('closeScene();') && t.includes('에서 나왔다');
})(), true);
/* 말없이 끝나 있으면 세계가 돌아간 게 아니라 꺼져 있던 거다 */
eq('닫고 나서 인사를 부른다 — 먼저 간 사람이 말을 남긴다', (() => {
  const i = web.indexOf('접어둔 자리는 시간에 맞춰 끝난다');
  return web.slice(i, i + 2400).includes('request(sc.room');
})(), true);

/* ── 대화 중에도 때는 온다 ──
   말만 계속 걸면 침묵 한 시간이 영영 안 차서, 보건실에 새벽까지 앉아
   있을 수 있었다 — 재언은 다섯 시에 퇴근하는 사람인데. 때는 있는 시계
   둘로 잰다: 자리의 문 닫는 시간(placeHours)과 그 사람이 자는 시간
   (presence off). 인물이 대답에서 마무리하고 일어서고, 말풍선이 다 뜨면
   프론트가 자리를 닫는다 — 닫는 걸 모델에 맡기면 영영 안 닫힌다. */
eq('자리의 때를 있는 시계 둘로 잰다', /const sceneOver=\(sc,now\)=>/.test(web)
  && /if\(p&&!placeHours\(p,now\)\)return true;/.test(web)
  && /if\(!pr\|\|pr\.s!=="off"\)return false;/.test(web), true);
/* 새벽 오프닝(편의점 라면)은 시간표를 안 보고 여는 자리다 — 열릴 때부터
   자는 시간이었다면 자리가 이긴다. 안 그러면 열리자마자 「나왔다」가 찍혔다 */
eq('자리가 열릴 때부터 잔 사람은 안 쫓아낸다',
  /const at=presence\(sc\.room,new Date\(sc\.since\)\);/.test(web)
  && /return !at\|\|at\.s!=="off";/.test(web), true);
eq('귀갓길은 안 본다 — 원래 곧 끝나는 자리다',
  /if\(!sc\|\|sc\.place===WAY\)return false;/.test(web), true);
eq('때가 지나면 보내는 말에 실린다', /sceneOver\(sc\)\?\{place_over:true\}/.test(web), true);
eq('답이 다 뜬 뒤에 자리가 닫힌다 — 인사보다 「나왔다」가 먼저면 거꾸로다',
  /if\(payload\.place_over\)\{/.test(web), true);
eq('접어두고 떠난 자리도 때가 지나면 닫힌다',
  /Date\.now\(\)-last<AUTO_AWAY&&!sceneOver\(sc\)/.test(web), true);
eq('워커가 때를 받으면 일어서라고 말한다',
  buildPlace('보건실', true, 'jaeeon', true).includes('이 자리는 여기까지다')
  && !buildPlace('보건실', true, 'jaeeon').includes('이 자리는 여기까지다'), true);

/* ── 같이 자리를 옮긴다 ──
   자리에 있으면 무조건 못 갔다. 점심의 보건실에서 옥상으로, 퇴근한 재언과
   편의점으로 — 같이 있다가 발길 닿는 이동은 되는 게 맞다. */
{
  eq('같이 있으면 옮길 수 있다',
    /const mv=away&&scene\.place!==WAY&&!!p&&\(p\.who\|\|\[\]\)\.includes\(scene\.room\)/.test(web)
    && /answerMove/.test(web), true);
  const i = web.indexOf('const answerMove');
  const t = web.slice(i, i + 1600);
  eq('이동도 방문이다 — 도장을 찍는다', t.includes('stampGone(place); goneTo(place);'), true);
  /* wendOnly는 약속 잡고 가는 날의 규칙이다. 이미 같이 있는 사람과
     흘러가는 저녁은 평일에도 있다 — 그래서 퇴근한 재언과 도서관·레코드샵이 된다 */
  eq('주말 전용은 이동에선 안 본다', t.includes('wendOnlyOk'), false);
  eq('그 사람이 갈 수 있는 자리만 간다', t.includes('(p.who||[]).includes(sc.room)'), true);
  eq('떠나는 자리를 먼저 정리한다 — 두고 온 것도 챙긴다', t.includes('closeScene();'), true);
  eq('귀갓길에서는 못 옮긴다 — 곧 내린다', t.includes('sc.place===WAY)return'), true);
  /* 「교실으로」가 아니라 「교실로」다 — (으)로만 ㄹ받침 예외가 있다 */
  const s = web.slice(web.indexOf('const jos=(w,pair)'));
  const J = new Function(s.slice(0, s.indexOf('\n};') + 3) + '\nreturn jos;')();
  eq('ㄹ받침은 로', J('교실', '으로/로'), '교실로');
  eq('딴 받침은 으로', J('옥상', '으로/로'), '옥상으로');
  eq('받침이 없으면 로', J('학교', '으로/로'), '학교로');
  eq('을/를은 예외가 없다', J('교실', '을/를'), '교실을');
}

/* ── 사고가 대사로 새어 나갔다 ──
   화면에 이민현의 말풍선으로 이 두 줄이 떴다: 「…어긋남을 짚어야 함.
   장난스럽게 받아침.」 「지금까지 249번 대화, …눈치 신호는 …언급 안 함.」
   모델이 무엇을 말할지 정리한 글을 messages에 담은 것이다. 이건 세계관이
   깨지는 정도가 아니라 유저가 프롬프트 속(관계 단계·대화 수·장치 이름)을
   들여다보게 되는 일이다. 인물이 절대 안 하는 셋으로 가려낸다. */
{
  const keep = t => dropMeta([{ sender: 'minhyun', text: t }]).length === 1;
  eq('새어 나온 그 두 줄을 버린다', [
    '이미 편의점 가고 있다는 상황과 유저가 "나도 가고 싶어"라고 한 것 사이 어긋남을 짚어야 함. 장난스럽게 받아침.',
    '지금까지 249번 대화, 이미 많이 가까워진 상태. 눈치 신호는 지금 화제와 관련 없으니 언급 안 함.오고 싶다니, 나오라니까요 지금.',
  ].filter(keep), []);
  /* 인물은 상대를 늘 「선생님」이라고 부른다 — 「유저」는 프롬프트에만 있는 말이다 */
  eq('장치 이름과 유저라는 말을 버린다',
    ['유저가 뭐라고 했는데요', '눈치 신호를 보면', '사진키를 쓴다', '직전 문맥에 답한다']
      .filter(keep), []);
  /* 영문으로도 샜다 — 「user제일 좋은 자리로 예매해」가 민현 말풍선으로 떴다 */
  eq('영문 user도 버린다',
    ['user제일 좋은 자리로 예매해', 'user에게 답한다', '(user) 왔어요'].filter(keep), []);
  /* 낱말 안의 user는 대사가 아니라 그냥 글자다 — 잘못 버리면 말을 먹는다 */
  eq('낱말에 섞인 영문은 안 버린다',
    ['username 뭐예요', '슈퍼user 같은 소리 하네'].filter(t => !keep(t)), []);
  /* 대사는 하나도 잃지 않아야 한다 — 필터가 말을 먹으면 침묵으로 보인다 */
  eq('멀쩡한 대사는 다 남는다',
    ['나오라니까요 지금.', '미안함. 그건 내 잘못이에요.', '선생님이 먼저 왔네요.',
     '눈 말고 뭐가 있어요.', '안 자요, 아직.', '불닭 두 개 계산해놨어요.',
     '오늘은 못 함', '그럼 자요'].filter(t => !keep(t)), ['오늘은 못 함']);
  /* 줄을 가르기 전에 걸러야 한 말풍선에 섞여 온 것도 통째로 잡힌다 */
  eq('말버릇 필터보다 앞에 있다',
    /trimTics\(sanitizePhotos\(unlabel\(splitLines\(dropMeta\(parsed\)\)/.test(workerSrc), true);
  eq('버릴 때 로그를 남긴다', /사고 유출을 버렸다/.test(workerSrc), true);

  /* ── 없는 말 하나 ──
     「약 갖다올게요」, 「약 갖다 왔어요」가 나왔다. 「갖다주다」는 맞지만
     「갖다오다」는 없다 — 「갔다 왔어요」(다녀왔다)와 「가져왔어요」(들고 왔다)가
     섞인 것이다. 물건을 들고 오는 자리이므로 「가지고」로 되돌린다. */
  const 말 = t => trimTics([{ sender: 'jaeeon', text: t }])[0].text;
  eq('없는 말을 되돌린다',
    ['약 갖다올게요.', '약 갖다 왔어요.', '책 갖다와요.'].map(말),
    ['약 가지고 올게요.', '약 가지고 왔어요.', '책 가지고 와요.']);
  /* 맞는 말은 안 건드린다 — 짐작해서 바꾸면 더 이상해진다 */
  eq('맞는 말은 그대로 둔다',
    ['약 갖다줄게요.', '매점 갔다 왔어요.', '가지고 왔어요.'].map(말),
    ['약 갖다줄게요.', '매점 갔다 왔어요.', '가지고 왔어요.']);

  /* ── 제 이름을 3인칭으로 부르는 줄 ──
     「새벽 세 시에 편의점 라면값 계산하고 가는 길이면 말이 많을 이유가 없다.
       이재언은 원래도 아낀다.」가 재언의 말풍선으로 떴다. 대사가 아니라
     지문이다. 이 줄에는 장치 이름이 하나도 없어서 위의 표에 안 걸린다. */
  const keepAs = (who, t) => dropMeta([{ sender: who, text: t }]).length === 1;
  eq('제 이름을 3인칭으로 쓴 지문을 버린다', [
    ['jaeeon', '새벽 세 시에 편의점 라면값 계산하고 가는 길이면 말이 많을 이유가 없다. 이재언은 원래도 아낀다.'],
    ['jaeeon', '이재언은 여기서 더 말하지 않는다.'],
    ['minhyun', '이민현이 먼저 웃는다.'],
  ].filter(([w, t]) => keepAs(w, t)), []);
  /* 상대 이름은 그냥 쓴다 — 민현이 삼촌 얘기를 하는 건 대사다 */
  eq('상대 이름은 안 버린다', [
    ['minhyun', '이재언 삼촌이요?'],
    ['minhyun', '이재언은 그런 말 안 해요.'],
    ['jaeeon', '이민현이 그러던가요.'],
  ].filter(([w, t]) => !keepAs(w, t)), []);
  /* ①만 보면 소개까지 자르고 ②만 보면 반말 한마디가 걸린다 — 둘 다일 때만이다 */
  eq('제 이름을 써도 서술체가 아니면 남는다', [
    ['jaeeon', '이재언입니다.'],
    ['jaeeon', '이재언이 아니라 그냥 선생이에요.'],
  ].filter(([w, t]) => !keepAs(w, t)), []);
  eq('서술체라도 제 이름이 없으면 남는다', [
    ['jaeeon', '알겠다.'],
    ['minhyun', '됐다 그럼.'],
    ['jaeeon', '라면은 집에서 끓여요.'],
  ].filter(([w, t]) => !keepAs(w, t)), []);
  eq('지문을 버릴 때도 로그를 남긴다', /지문을 버렸다/.test(workerSrc), true);
}

/* ── 아무 일도 없었으면 비운 자리도 없다 ──
   lastAny가 0이면 「자리를 비운 지 한 시간 뒤」가 1970년 1월 1일 한 시간
   뒤가 된다. 실제로 첫 실행에서 관전 대화가 1970년으로 찍혔고, 그게 이 판의
   첫 대화가 돼서 D-0 종료 화면이 첫날에 떴다 — 오프닝은 네 방이 다 비어야
   열리는데 그 방이 차 있으니 첫 자리도 안 열렸다. */
eq('기록이 하나도 없으면 관전방을 안 만든다', /if\(!lastAny\)return;/.test(web), true);

/* ── 갈라진 파일 사이로 새는 참조 ──
   한 파일이던 앱을 넷으로 가를 때 setAutoAt(방 목록의 상태) 호출만 app.js에
   남았다. 그 줄은 관전방 자동 생성 한가운데 있었고, async 안이라 조용히
   ReferenceError로 죽었다 — 화면에는 아무 일도 안 일어나고, autoBusy가 참인
   채 굳어 그 세션 내내 관전방이 멈췄다. 죽기 전에 사건과 하루 몫은 이미
   지운 뒤였다. 정적으로 잡는다: app.js가 부르는 setter는 app.js가 스스로
   들고 있거나 전역이어야 한다. */
eq('app.js가 남의 상태를 부르지 않는다', (() => {
  const appSrc2 = readFileSync(join(ROOT, 'app.js'), 'utf8');
  const uiSrc2 = readFileSync(join(ROOT, 'app-ui.js'), 'utf8');
  const dataSrc2 = readFileSync(join(ROOT, 'app-data.js'), 'utf8');
  const mine = new Set(['setTimeout', 'setInterval', 'setItem', 'setHours', 'setDate',
    'setMinutes', 'setSeconds', 'setMonth', 'setFullYear', 'setTime']);
  for (const m of appSrc2.matchAll(/const\s*\[\s*\w+\s*,\s*(\w+)\s*\]\s*=\s*useState/g)) mine.add(m[1]);
  for (const m of appSrc2.matchAll(/(?:const|let|function)\s+(\w+)/g)) mine.add(m[1]);
  /* 전역 — app-data와 app-ui의 최상위 선언 */
  for (const m of dataSrc2.matchAll(/^(?:const|let|function)\s+(\w+)/gm)) mine.add(m[1]);
  for (const m of uiSrc2.matchAll(/^(?:const|function)\s+(\w+)/gm)) mine.add(m[1]);
  return [...new Set([...appSrc2.matchAll(/\b(set[A-Z]\w*)\s*\(/g)].map(m => m[1]))]
    .filter(id => !mine.has(id));
})(), []);

/* ── 선톡의 상한은 간격뿐이다 ──
   하루 한 번 + 제비뽑기도 둬 봤다가 걷어냈다. 올 때마다 같은 말이 오는 게
   문제였지 오는 것 자체가 문제가 아니었다 — 시간마다 다른 말이 오면 그건
   알림이 아니라 안부다. 세 시간 간격만 남는다. */
eq('하루 상한과 제비뽑기는 걷어냈다',
  /greetLot|loadGreetDay|null_greetday/.test(web), false);
eq('세 시간 간격은 그대로다', /if\(gapMin>=0&&gapMin<180\)return;/.test(web), true);

/* ── 시간표를 아는 선톡 ──
   각본 스무 개는 아침이든 새벽이든 같은 스무 개였다. 때와 자기 상태는
   가변부의 [지금]이 이미 아니까, 먼저 걸라는 지시 한 줄만 얹으면 모델이
   알아서 쓴다 — 낮에는 「수업 중이겠네요」, 저녁에는 「퇴근 잘했어요?」,
   새벽에는 「아직 안 자나 봐요」. 워커에 선톡 모드는 여전히 없다 —
   지시가 이력의 마지막 유저 턴으로 실려 간다(관전방과 같은 길). */
eq('평소 선톡은 모델이 쓴다', /const GREET_ASK=/.test(web)
  && /history:\[\.\.\.buildHistory\(sinceSum\(id,ms\)\),\{role:"user",content:GREET_ASK\}\]/.test(web), true);
/* 유저가 방금 접속한 걸 인물이 알면 인사가 아니라 감시 카메라다 */
eq('유저가 온 걸 모른다 — 「왔어요」 금지',
  /상대가 온 걸 아는 말은 하지 않는다/.test(web), true);
eq('첫인사는 여전히 각본이다 — 세계관이 열리는 자리라 문장을 고정한다',
  /demoProactive\(id,demoGreetWhen\(gapMin,id\),name\)/.test(web), true);
eq('같이 있는 사람은 선톡을 안 한다',
  /sceneRef\.current&&sceneRef\.current\.room===id\)return/.test(web), true);
/* 지시가 기록에 남으면 다음 턴부터 그 지시까지 대화가 된다 — 정의와
   이력에 얹는 자리, 딱 두 번만 나와야 한다 */
eq('지시는 저장하지 않는다', (web.match(/GREET_ASK/g) || []).length, 2);
eq('가변부까지 실려 나간다', buildVolatile('chat', 'jaeeon', 'R', null, [], null, { jaeeon: 5 },
  null, null, [], 1, '보건실', true, '저녁', '화요일', null, true).includes('이 자리는 여기까지다'), true);

/* ── 교실 문틈 ──
   수업 중의 교실에서 마주 앉아 떠들었다. 수업 중인 애랑 대화가 될 리 없다 —
   가는 게 아니라 들여다본다. 배경에 그 애 사진 한 장, 말풍선도 도장도 없고
   아무 데나 누르면 돌아간다. */
eq('수업 중의 교실은 구경이 된다',
  /const klass=ask==="교실"&&!scene&&!locked&&!shut&&presence\("minhyun"\)\.t==="수업 중"/.test(web), true);
/* 구경은 방문이 아니다 — 도장(goneToday)을 안 보고 안 찍는다 */
eq('구경은 answerAsk를 안 탄다', /구경은 answerAsk를 안 탄다/.test(web)
  && /setLook\(\{shot:\["minhyun-window","minhyun-desk"\]/.test(web), true);
eq('문틈 화면은 누르면 돌아간다',
  /className="lookov" onClick=\{\(\)=>setLook\(null\)\}/.test(web)
  && /\.lookov\{position:absolute;inset:0/.test(web), true);
/* 주말은 shut이 먼저 막고(wend:false), presence도 주말엔 「수업 중」이 아니다 */

/* ── 실패해도 세션이 각본으로 굳지 않는다 ──
   한 번 실패하면 DEMO.auto가 켜진 채 안 풀렸다. 429 한 번에 그 뒤의 모든
   대화가 조용히 각본이 됐다 — 며칠 쌓인 세이브에는 구조가 아니라 사고다.
   실패한 턴만 각본으로 메우고, 다음 전송이 진짜를 다시 시도한다. */
eq('명시적 데모(?demo=1)만 네트워크를 안 탄다', /if\(DEMO\.on\)\{\s*\n\s*inflightRef/.test(web), true);
eq('성공하면 데모 표시가 꺼진다', /DEMO\.auto=false/.test(web), true);
eq('실패하면 그 턴만 데모로 메운다', /DEMO\.auto=true/.test(web), true);
/* 선물도 마찬가지다. 보고 있는 화면이 아니라 몸이 어디 있는지를 본다 —
   교실에 앉은 채로 목록에 나와 있어도 몸은 교실에 있다 */
eq('선물도 몸이 있는 데를 본다', /withChar=\{scene\?scene\.room:null\}/.test(web), true);

/* ── 나가기도 한 번 묻는다 ──
   하루에 한 번뿐인 자리를 뒤로가기 한 번에 닫으면 실수로 닫힌다.
   들어올 때 물었으니 나갈 때도 묻는 게 짝이 맞다 */
eq('나갈 때도 한 번 묻는다',
  /const leaveScene=\(\)=>\{ const sc=sceneRef\.current; if\(sc\)setLeaving\(sc\) \};/.test(web), true);
eq('나가면 끝난다고 말해준다',
  /지금 나가면 Ending\.\.\./.test(web), true);
/* 문을 열어주고 등을 보이는 사람은 없다. 지문 한 줄을 남기고 그걸 보고 인사한다 —
   새 프롬프트를 안 붙인다. 「보건실에서 나왔다」면 할 말이 정해져 있다 */
eq('나오면 지문이 남는다',
  /`\$\{sc\.place\}에서 나왔다`/.test(web), true);
eq('그 지문을 보고 인사한다',
  /appendMsg\(sc\.room,sys\);\s*\n\s*const next=\[\.\.\.\(storeRef\.current\.msgs\[sc\.room\]\|\|\[\]\),sys\];\s*\n\s*request\(sc\.room,/.test(web), true);
/* 귀갓길에서 나오는 건 나오는 게 아니라 도착하는 것이다 */
eq('귀갓길은 도착이다', /sc\.place===WAY\?"집에 도착했다"/.test(web), true);
/* 나온 뒤에 밤이면 데려다준다. 인사와 겹치지 않게 창을 이어서 띄운다 */
eq('나온 뒤에 데려다주기를 묻는다',
  /if\(sc\.place!==WAY&&talkedEnough\(sc\)&&wayOK\(\)&&loadWay\(\)!==dayKey\(\)\)setWay\(sc\);/.test(web), true);

/* ── 귀갓길 ──
   유저 집은 지도에 없다. 갈 곳이 아니라 헤어지는 자리라서, 자리가 끝나고
   붙는 한 다리가 그 일을 한다. 재언은 태워다 주고 민현은 같이 버스를 탄다. */
{
  eq('귀갓길은 지도에 없다',
    /\{name:"귀갓길"/.test(web) || /"귀갓길":\s*\{x:/.test(web), false);
  eq('귀갓길도 빈 자리로 시작한다',
    /const WAY_BG=\{jaeeon:"jaeeon-drive\.webp", ?minhyun:"minhyun-bus\.webp"\}/.test(web), true);
  eq('귀갓길에도 그 사람이 깔린다',
    /"귀갓길":\s*\{jaeeon:\["jaeeon-driveseat"\], ?minhyun:\["minhyun-busstop","minhyun-neon"\]\}/.test(web), true);
  /* 지도 자리가 아니라 PLACE_BG에 없다. 자리가 자기 배경을 들고 와야 한다 */
  eq('지도에 없는 자리는 배경을 들고 온다', /scene\.shot\|\|scene\.bg\|\|PLACE_BG/.test(web), true);
  /* 낮에 보건실 나오면서 집까지 태워다 주는 건 데려다주는 게 아니라 조퇴다 */
  eq('밤에만 데려다준다', /const wayOK=\(now\)=>\{const h=\(now\|\|nowClock\(\)\)\.getHours\(\);return h>=20\|\|h<5\}/.test(web), true);
  /* 매번 나올 때마다 물으면 데려다주는 게 아니라 절차가 된다 */
  eq('하루에 한 번만 묻는다',
    /loadWay\(\)!==dayKey\(\)/.test(web) && /saveWay\(dayKey\(\)\)/.test(web), true);
  eq('귀갓길에서 또 데려다주지 않는다', /sc\.place!==WAY&&talkedEnough\(sc\)/.test(web), true);
  /* 여기서 물러나도 그 자리에 두고 온 건 챙긴다 — 나온 건 나온 거다 */
  eq('데려다주기를 물어도 자리는 끝난다',
    /const answerWay=ok=>\{[\s\S]{0,200}closeScene\(\);/.test(web), true);
  /* ── 워커 쪽 ── */
  eq('워커가 귀갓길을 자리로 인정한다', placeOf('귀갓길'), '귀갓길');
  eq('없는 자리는 여전히 버린다', placeOf('노래방'), null);
  {
    const j = buildPlace('귀갓길', true, 'jaeeon'), m = buildPlace('귀갓길', true, 'minhyun');
    eq('귀갓길은 방마다 그림이 다르다',
      /차 안이다/.test(j) && /버스를 탔다/.test(m), true);
    eq('귀갓길에서도 사진을 안 보낸다', /"photo"를 쓰지 않는다/.test(j), true);
    eq('귀갓길은 곧 끝난다고 말해준다', /곧 내린다/.test(j), true);
    eq('데려다주는 걸로 생색내지 않는다', /생색내지 않는다/.test(j), true);
    /* 귀갓길에는 건넬 물건이 없다. 「언젠가 건넬 것」이 붙으면 없는 걸 내민다 */
    eq('귀갓길에는 건넬 것이 없다', /give/.test(buildPlace('귀갓길', false, 'jaeeon')), false);
    eq('귀갓길에서는 아무것도 못 건넨다', pickGive('key', '귀갓길', false), null);
  }
}
/* 「밴드을(를) 받았다」가 화면에 그대로 찍혔다. 괄호로 둘 다 적는 건
   글로 쓸 때 쓰는 표기지 사람이 읽는 문장이 아니다 */
eq('지문에 을(를)이 안 남아 있다', /을\(를\)|이\(가\)|과\(와\)/.test(
  web.slice(web.indexOf('function App()'))), false);
eq('받침을 보고 조사를 고른다', /const jos=\(w,pair\)=>/.test(web), true);
/* ── 내보낸 파일 ──
   「이민현이 이어폰을 받았다」는 아무도 한 말이 아닌데 유저 이름이 붙어서
   나갔다. 화면에서는 지문으로 뜨는데 파일에서만 유저가 자기 얘기를
   삼인칭으로 하는 사람이 됐다 */
eq('지문에는 말한 사람을 안 붙인다',
  /if\(m\.sys\)\{ lines\.push\(`\[\$\{fmtDivider\(m\.ts\)\}\] · \$\{m\.text\|\|""\}`\); return \}/.test(web), true);
/* 「등교전예요」가 시간표에 그대로 찍혔다. 서술격 조사도 받침을 본다 —
   출근·수업·점심·퇴근·저녁·등교전은 이에요, 야자만 예요다 */
eq('이에요와 예요도 받침을 본다',
  /지금은 \{jos\(L,"이에요\/예요"\)\}/.test(web)
  && /const L=wk\?null:nowLabel\(now\);/.test(web), true);
eq('굳은 예요가 안 남아 있다', /\}예요/.test(web), false);
/* 한글이 아닌 말은 읽는 소리로 정한다. LP·CD는 「엘피」「씨디」라 받침이 없고
   NULL은 「널」이라 받침이 있다 — 시간표 마지막 칸이 「NULL예요」로 나왔다 */
eq('영문도 읽는 소리로 조사를 고른다', (() => {
  const src = web.slice(web.indexOf('const jos=(w,pair)=>'));
  const J = new Function(src.slice(0, src.indexOf('\n};') + 3) + '\nreturn jos;')();
  return [J('NULL', '이에요/예요'), J('NULL', '을/를'), J('NULL', '으로/로'),
    J('믹스 CD', '을/를'), J('중고 LP', '이에요/예요')];
})(), ['NULL이에요', 'NULL을', 'NULL로', '믹스 CD를', '중고 LP예요']);
eq('같은 것은 가방에 두 번 안 들어간다',
  /if\(bagRef\.current\.some\(b=>b\.key===key\)\)return false/.test(web), true);
eq('자리에 있으면 place를 같이 보낸다', /\.\.\.\(at\?\{place:at,bag:/.test(web), true);
eq('map 탭이 있다', /onClick=\{\(\)=>setTab\("map"\)\}>map</.test(web), true);
/* gift가 준 것이면 bag은 받은 것이다. 작은 대화상자에 흰 줄로 늘어놓으니
   이 앱에서 혼자 다른 물건처럼 보였다 — 같은 부품을 쓴다 */
eq('bag이 gift와 같은 창을 쓴다',
  /function Bag\(\{bag,firstTs,onClose\}\)/.test(web)
  && /<div className="cartscreen"><div className="cartwin">[\s\S]{0,200}✿ bag/.test(web), true);
eq('bag이 gift와 같은 카드·칩을 쓴다',
  /className="cgcard"><span className="cribbon"\/>[\s\S]{0,120}bagpic/.test(web)
  && /ITEM_CATS\.map\(c=>[\s\S]{0,80}className=\{"cchip"/.test(web), true);
/* 가방은 물건이 주인공이다. 얼굴을 크게 놓으니 물건은 글자뿐이고 얼굴만
   네 번 박히는 화면이 됐다 */
eq('물건 그림이 앞에 온다', /className="bagpic" src=\{`item-\$\{b\.key\}\.webp`\}/.test(web), true);
eq('여덟 개 그림이 전부 저장소에 있다',
  ['note','bandaid','can','haribo','book','lp','coin','key']
    .filter(k => !exists(`item-${k}.webp`)), []);
eq('준 사람은 오른쪽 작은 원으로 남는다', /className="bagwho" style=\{faceBg\(who\)\}/.test(web), true);
/* 이 앱에서 시간은 8월 16일이 아니라 D-18이다 */
eq('받은 날을 남은 날로 적는다',
  /ENROLL_DAYS-Math\.floor\(\(b\.ts-firstTs\)\/864e5\)/.test(web)
  && /className="bagmeta">\{b\.where\}\{d!=null\?" · D-"\+d:""\}/.test(web), true);
/* 누가 줬는지는 오른쪽 얼굴이 이미 말한다. 이름까지 적으면 두 번이다 */
eq('준 사람 이름을 글로 또 안 적는다', /에게서/.test(web), false);
/* 설명이 아니라 물건이 하는 한 마디 */
eq('받은 것마다 한 마디가 있다', (() => {
  const t = web.slice(web.indexOf('const ITEMS={'));
  return (t.slice(0, t.indexOf('};')).match(/say:"/g) || []).length;
})(), 10);   // 자리 아홉 + 야자 주의 에너지바
eq('선물마다 한 마디가 있다', (() => {
  const t = web.slice(web.indexOf('const GIFTS=['));
  return (t.slice(0, t.indexOf('const GIFT_CATS')).match(/say:"/g) || []).length;
})(), 16);
/* 가방·선물 두 화면 다에 떠야 한다 — 한 군데만 넣으면 화면이 갈린다 */
eq('한 마디가 두 화면에 다 뜬다', (web.match(/className="itemsay"/g) || []).length, 2);
/* 분류를 걸러서 빈 것과 정말 하나도 없는 것은 다른 말이다 */
eq('빈 칸과 빈 가방을 다르게 말한다',
  /this drawer : empty/.test(web) && /bag : 0 items/.test(web), true);
/* 가방·선물 창의 글자는 영어다. 칸 이름만은 데이터에 한글로 박혀 있어서
   화면에만 영어를 씌운다 — 데이터를 바꾸면 저장된 가방이 어긋난다 */
eq('가방 창에 한글이 안 남았다',
  /className="bagcount">RECEIVED /.test(web)
  && /className="baglent">TO RETURN /.test(web)
  && /className="baglabel">RETURN ME</.test(web), true);
eq('선물 창에 한글이 안 남았다',
  /placeholder="what r u looking 4 \?"/.test(web)
  && !/placeholder="무엇을 찾고 있어\?"/.test(web), true);
/* 두 창이 같은 표를 본다 — 한쪽만 고치면 선물과 가방의 칸 이름이 갈린다 */
eq('칸 이름 표가 하나다',
  /const CAT_EN=\{"전체":"ALL","소품":"STUFF","옷":"WEAR","간식":"SNACK","기록":"TRACE"\}/.test(web)
  && (web.match(/\{CAT_EN\[c\]\|\|c\}/g) || []).length, 2);
eq('선물 칸도 가방 칸도 다 영어 이름이 있다',
  [...new Set([...web.matchAll(/const (?:GIFT|ITEM)_CATS=\[([^\]]+)\]/g)]
    .flatMap(m => m[1].split(',').map(s => s.replace(/"/g, ''))))]
    .filter(c => !new RegExp(`"${c}":"[A-Z]+"`).test(web)), []);
/* 선물도 이제 그림이다. SVG로 그리던 열여섯 개는 걷어냈다 */
eq('선물 그림 열여섯 개가 저장소에 있다',
  ['mug','photobook','beanie','earphone','hotpack','umbrella','hanky','camera',
   'scarf','gloves','bandana','candy','ramen','coffee','letter','mixcd']
    .filter(k => !exists(`gicon-${k}.webp`)), []);
eq('선물 SVG는 카트만 남았다', (() => {
  const t = web.slice(web.indexOf('const GiftIcon={'));
  return Object.keys({}).length + (t.slice(0, t.indexOf('\n};')).match(/^  \w+:\(/gm) || []).length;
})(), 1);
/* 반투명 흰색은 사진이 비쳐 회색으로 읽혔고, 거의 흰색은 그 위의 단추와
   입력칸을 같이 하얗게 만들어 없앴다. 자리의 입력줄도 다른 방과 같은 바다 */
eq('자리의 입력창이 따로 놀지 않는다',
  /\.scenewrap \.scenebar\{box-shadow:inset 0 1px 0 #fff,0 -3px 14px/.test(web)
  && !/\.scenewrap \.scenebar\{[^}]*background:/.test(web), true);
/* min-width:0이 없으면 input은 기본 size(20자) 아래로 안 줄어든다 —
   좁은 화면에서 보내기 단추가 화면 밖으로 밀려났다 */
eq('좁은 화면에서 보내기가 안 밀린다',
  /\.inputbar input\{flex:1;min-width:0;/.test(web), true);
/* 알약을 아예 뗐다. 가방은 알림함이 아니라 서랍이다 — 숫자가 뜨면 그걸
   없애려고 여는 창이 되고, 그러면 물건이 알림이 된다 */
eq('가방에 알약이 안 붙는다',
  /mbcount|bagNew|bagSeen|null_bagseen/.test(web), false);
/* 자리에 들어오자마자 손에 들어오면 그건 받은 게 아니라 주운 것이다.
   들렀다 바로 나오는 것만으로 여덟 개가 다 모이면 지도가 심부름이 된다 */
eq('말을 하고 나와야 받은 게 있다',
  /const SCENE_MIN_TALK=2/.test(web)
  && /const talkedEnough=sc=>!!sc&&/.test(web)
  && /if\(sc&&talkedEnough\(sc\)\)\{ const p=PLACE_BY\[sc\.place\]/.test(web), true);
eq('모델이 첫 턴에 건네도 안 받는다',
  /data\.give&&data\.give\.item&&talkedEnough\(sceneRef\.current\)/.test(web), true);
/* 표제를 「여기서 건넬 것」이라고 달아놨더니 첫 마디부터 건네줬다 */
eq('언젠가 건넨다고 적는다', (() => {
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  return /## 여기서 언젠가 건넬 것/.test(wk)
    && /\*\*대부분의 턴에는 안 건넨다\.\*\*/.test(wk)
    && /막 도착해서 첫 마디를 주고받는 중이면 아니다/.test(wk)
    && !/## 여기서 건넬 것/.test(wk);
})(), true);
/* 누런 종이는 이 창에서 혼자 다른 시대에서 온 물건이었다 */
eq('쪽지가 흰 종이다',
  /repeating-linear-gradient\(180deg,#fff 0 25px,#f1ebfb 25px 26px\)/.test(web)
  && !/A NOTE \(선택\)/.test(web), true);
/* 남은 날이 30을 넘을 수는 없다. 첫 대화 시각이 물건보다 늦게 잡히면 D-31이 나왔다 */
eq('남은 날이 30을 안 넘는다', /Math\.min\(ENROLL_DAYS,Math\.max\(0,/.test(web), true);
eq('bag 창이 gift 옆에 있다', web.indexOf('BagIcon size={14}/>bag') > web.indexOf('GiftIcon.cart size={14}/>gift'), true);

/* ── 하루에 한 자리는 한 번 ──
   같은 데를 하루에 세 번 가면 그건 다니는 게 아니라 새로고침이다.
   경계는 여기서도 새벽 다섯 시다 */
eq('자리마다 다녀온 날을 찍는다',
  /const goneToday=\(place,now\)=>loadGone\(\)\[place\]===dayKey\(now\)/.test(web)
  && /const stampGone=\(place,now\)=>saveGone\(\{\.\.\.loadGone\(\),\[place\]:dayKey\(now\)\}\)/.test(web), true);
eq('가기로 하면 그 날을 찍는다', /stampGone\(place\);/.test(web), true);
/* 시작한 자리도 다녀온 자리다. goneTo만 부르던 때는 해금 목록에만 들어가고
   오늘 도장이 안 찍혀서, 빨래방에서 시작한 날 지도의 빨래방이 그대로 열려
   있었다 — 하루에 한 번인데 두 번 갈 수 있었다. 앱도 같이 본다 */
eq('첫 자리도 그 날을 찍는다',
  /if\(PLACE_BY\[o\.place\]\)\{ goneTo\(o\.place\); stampGone\(o\.place\) \}/.test(web)
  && /setMet\(nm\); saveMet\(nm\); stampGone\(o\.place\);/.test(appSrc), true);
/* 눌러보고 알면 늦다. 묻는 자리에서 같이 말한다 */
eq('묻는 창이 규칙을 알려준다',
  /앗! 하루에 1번만 갈 수 있어요 <span className="kao">\(υl\|l◔ㅅ◔\)՞՞<\/span>/.test(web), true);
/* 못 가는 이유가 셋이라 이유를 각각 말해야 한다 — 눌렀는데 아무 일도 없는 게 제일 나쁘다 */
eq('못 가는 이유를 셋 다 말한다',
  /done\?R\(done_/.test(web) && /wk\?R\("여기는 Weekend only! ♡"/.test(web)
  && /empty\?R\("지금 밖은 Empty\.\.\."/.test(web), true);
/* 이유와 얼굴을 따로 고르면 갈래가 어긋난다 — 잠긴 데다 오늘 다녀온 자리에서
   이유는 빈 줄인데 우는 얼굴만 남아, 「아직은 못 가요」 밑에 얼굴이 혼자 떴다.
   한 갈래에서 짝으로 고르는지 보고, 앱도 같이 본다 */
{
  const flow2 = readFileSync(join(ROOT, 'app/lib/flow.ts'), 'utf8');
  const paired = s => !/const kao\s*=\s*done\s*\?/.test(s)
    && /\{\s*t:\s*why,\s*k:\s*kao\s*\}/.test(s);
  eq('이유와 얼굴을 한 갈래에서 짝으로 고른다', [web, flow2].filter(paired).length, 2);
  const lockedBare = s => /locked\s*\?\s*R\(\s*(''|"")\s*\)/.test(s);
  eq('잠긴 자리에는 얼굴도 안 붙는다', [web, flow2].filter(lockedBare).length, 2);
}
/* ── 화면 글월은 웹과 앱이 같아야 한다 ──
   한쪽만 고치면 두 화면이 다른 말을 한다. 지도 창은 판정이 flow.ts(앱)와
   app.js(웹) 두 군데서 도므로 특히 갈라지기 쉽다. */
{
  const flow = readFileSync(join(ROOT, 'app/lib/flow.ts'), 'utf8');
  const dlg = readFileSync(join(ROOT, 'app/screens/Dialogs.tsx'), 'utf8');
  eq('제목이 웹·앱 같다',
    ['CLASS 중!', '도 같이 GO?', '잠깐 OFF!', ' GO?'].filter(t => !(web.includes(t) && flow.includes(t))), []);
  eq('이유가 웹·앱 같다',
    ['Complete...', 'Weekend only! ♡', '밖은 Empty...', '현재 위치는'].filter(t =>
      !(web.includes(t) && flow.includes(t))), []);
  eq('단추가 웹·앱 같다',
    ['OK!', 'GO!', 'LATER...', '같이 GO!', '살짝 PEEK!'].filter(t =>
      !(web.includes(t) && dlg.includes(t))), []);
  eq('나가기·문틈이 웹·앱 같다',
    ['여기까지...?', '지금 나가면 Ending...', 'EXIT!', '조금 더 STAY!',
     'CLASS MODE ON!', '살짝만 PEEK'].filter(t => !(web.includes(t) && dlg.includes(t))), []);
  /* 얼굴은 픽셀 글꼴에 글자가 없다 — 웹은 .kao, 앱은 KAO로 따로 그린다 */
  eq('얼굴을 따로 그린다', /className="kao"/.test(web) && /style={KAO}/.test(dlg), true);
}

/* ── 주말에만 · 누구랑 갈지 ──
   도서관과 레코드샵은 들르는 데가 아니라 시간을 내서 가는 데다.
   평일엔 둘 다 학교에 매여 있다 */
{
  const wend = [...web.matchAll(/\{name:"([^"]+)",[\s\S]{0,120}?wendOnly:true/g)].map(m => m[1]);
  eq('주말에만 가는 자리가 둘이다', wend.sort(), ['도서관', '레코드샵']);
  eq('그 둘은 동행을 고른다',
    ['도서관', '레코드샵'].filter(p => !/pick:true/.test(PLACE_BY_WEB(p) || '')), []);
  /* 고를 수 있으려면 둘 다 후보여야 한다 */
  eq('고를 상대가 둘이다',
    ['도서관', '레코드샵'].filter(p => !/who:\["jaeeon","minhyun"\]/.test(PLACE_BY_WEB(p) || '')), []);
  eq('안 고르면 못 간다', /disabled=\{need\}/.test(web) && /const need=!away&&!!p&&p\.pick&&!askWho;/.test(web), true);
  eq('고른 사람이 그 자리에 온다', /if\(p\.pick\)return picked\|\|null;/.test(web), true);
}

/* ── 마주치는 자리 ──
   편의점·빨래방은 누가 있을지 정해두지 않는다. 누가 있을 수 있는지는
   이미 있는 생활 리듬이 정한다 — 새 규칙을 만들지 않는다 */
{
  const out = [...web.matchAll(/\{name:"([^"]+)",[\s\S]{0,60}?meet:"out"/g)].map(m => m[1]);
  eq('마주치는 자리가 둘이다', out.sort(), ['빨래방', '편의점']);
  /* 점심도 학교 안이다 — 교실 문틈이 풀리는 것과 학교 밖에 나오는 건 다른 일 */
  eq('생활 리듬으로 정한다',
    /const AT_WORK=\["보건실","수업 중","점심","야자"\];/.test(web)
    && /pr=presence\(id,d\)/.test(web), true);
  /* 주말엔 근무도 수업도 야자도 없다 */
  eq('주말엔 낮에도 나온다', /return isWend\(d\)\|\|!AT_WORK\.includes\(pr\.t\);/.test(web), true);
  const F = new Function('const isWend=d=>{const w=d.getDay();return w===0||w===6};'
    + web.slice(web.indexOf('function presence'),
        web.indexOf('function presence') + web.slice(web.indexOf('function presence')).indexOf('\n}\n') + 3)
    + 'const AT_WORK=["보건실","수업 중","점심","야자"];'
    + 'const freeOut=(id,now)=>{const d=now,pr=presence(id,d);'
    + 'if(!pr||pr.s==="off")return false;return isWend(d)||!AT_WORK.includes(pr.t)};'
    + '\nreturn (now)=>["jaeeon","minhyun"].filter(id=>freeOut(id,now));')();
  /* 화요일 낮 — 하나는 근무 중이고 하나는 수업 중이라 아무도 없다 */
  eq('평일 낮엔 아무도 밖에 없다', F(new Date(2026, 0, 6, 13)), []);
  /* 화요일 저녁 일곱 시 — 재언은 퇴근했고 민현은 야자 중이다 */
  eq('저녁엔 재언만 있다', F(new Date(2026, 0, 6, 19)), ['jaeeon']);
  /* 화요일 밤 열한 시 — 둘 다 나와 있을 수 있다 */
  eq('밤엔 둘 다 있을 수 있다', F(new Date(2026, 0, 6, 23)), ['jaeeon', 'minhyun']);
  /* 새벽 두 시 — 재언은 자고 민현만 깨 있다 */
  eq('새벽엔 민현만 있다', F(new Date(2026, 0, 7, 2)), ['minhyun']);
  /* 토요일 낮 — 학교가 없으니 둘 다 나올 수 있다 */
  eq('주말 낮엔 둘 다 있다', F(new Date(2026, 0, 10, 13)), ['jaeeon', 'minhyun']);
}

/* 길이 없어졌는데 머리글에 ROAD가 남아 있었다. 사물함이라 NOCKER다 */
eq('머리글이 사물함을 말한다',
  /<i className="rh">♡<\/i> NULL NOCKER<\/span>/.test(web) && !/NULL ROAD MAP/.test(web), true);

/* ── 캐비닛 지도 ──
   길이던 지도를 사물함으로 바꿨다. 이 앱은 가짜 OS인데 지도만 혼자 야외
   일러스트였다. 창이 있고 메뉴바가 있고 .exe가 뜨는 화면에서는 서랍이
   길보다 자연스럽고, 잠긴 자리도 자물쇠 딱지가 아니라 안 열리는 문이 된다. */
{
  const SLOT = [...web.slice(web.indexOf('const CAB_SLOT=['), web.indexOf('const CAB_COL='))
    .matchAll(/\{(?:kind|place):"([^"]+)"/g)].map(m => m[1]);
  eq('칸이 여덟이다', SLOT.length, 8);
  /* 차례는 need를 그대로 따라간다 — 학교에서 시작해 편의점·도서관으로 갈라지고,
     레코드샵·빨래방을 지나 둘 다 걸어야 집이 열린다. 왼쪽 줄과 오른쪽 줄이 한 갈래씩 */
  eq('차례가 열리는 차례다', SLOT,
    ['start', '학교', '편의점', '도서관', '레코드샵', '빨래방', '집', 'null']);
  /* 마을 여섯이 다 문짝을 가져야 한다. 하나라도 빠지면 그 칸이 빈다 */
  eq('마을 여섯이 다 칸에 있다',
    SPOTS_WEB().filter(n => !SLOT.includes(n)), []);
  /* 문짝 그림. 열림과 잠김이 짝으로 있어야 한다 — 집만 잠긴 그림이 있고
     열린 그림이 없어서 한 번 비었다 */
  const ICONS = ['school', 'conv', 'library', 'record', 'laundry', 'home'];
  eq('문짝이 열림·잠김 짝으로 다 있다',
    ICONS.flatMap(k => [`cab-icons/${k}-open.webp`, `cab-icons/${k}-lock.webp`])
      .filter(f => !exists(f)), []);
  eq('프레임·명패·TV가 있다',
    ['frame', 'start', 'null', 'tv'].map(k => `cab-icons/${k}.webp`).filter(f => !exists(f)), []);
  /* 칸 좌표는 프레임 그림에서 칸 안쪽을 재서 넣은 값이다. 4행 2열 */
  eq('칸 좌표가 4행 2열이다',
    /const CAB_COL=\[27\.50,72\.39\];/.test(web)
    && /const CAB_ROW=\[13\.36,35\.88,58\.48,81\.19\];/.test(web), true);
  /* 문짝은 구멍(40.73%)보다 넓어야 경첩이 프레임에 얹히고, 칸 간격(22.5%)보다
     좁아야 위아래가 안 겹친다. 그림이 정사각이라 폭이 곧 높이다 */
  eq('문짝이 구멍보다 넓고 칸 간격보다 좁다', /const CAB_DOOR_W=43;/.test(web), true);
  /* START와 NULL은 갈 자리가 아니다. 창은 뜨되 자리로 안 간다 */
  eq('명패는 자리가 아니다', /if\(s\.kind\)return <span key=\{s\.kind\} className="cabdoor plate"/.test(web), true);
  /* 잠긴 문도 눌린다. 눌러도 아무 일이 없으면 고장 난 것처럼 보인다 —
     왜 안 되는지는 창이 말한다 */
  eq('잠긴 문도 눌러진다', /const live=!dim;/.test(web), true);
  eq('잠긴 문을 누르면 묻는 창이 뜬다',
    /onClick=\{live\?\(open\?go:\(\)=>onGoPlace\(p\.name\)\):null\}/.test(web), true);
  /* 두 줄로 끊고 글자를 줄인다 — 한 줄로 늘어놓으면 창이 옆으로 벌어지고
     얼굴이 잘린다 */
  eq('잠겼다고 말해준다',
    /<span className="asklock">my bad <i>♡<\/i><br\/>아직은 못 가요/.test(web), true);
  /* 무엇을 먼저 가야 하는지는 안 적는다. 순서를 알려주면 지도를 도는 게
     심부름이 되고, 「옥상 먼저」 같은 줄이 창마다 붙어 지저분하다 */
  eq('먼저 갈 데를 안 적는다', /먼저":""/.test(web) || /placeNeed\(p,met\)/.test(web), false);
  /* 창의 X가 그림만 있고 안 눌렸다. 셋 다 눌리게 한다 */
  eq('묻는 창의 X가 눌린다',
    (web.match(/<WinDots onClose=\{\(\)=>answer(Ask|Invite|Way)\(false\)\}\/>/g) || []).length, 3);
  /* 열렸어도 지금 갈 시간이 아닐 수 있다. 문은 멀쩡하고 시간이 아니라서 색만 죽인다 */
  eq('못 가는 시간이면 문이 흐려진다',
    /\+\(open&&!nowOk&&!p\.into\?" shut":""\)/.test(web)
    && /\.cabdoor\.shut\{/.test(web), true);
  eq('다녀온 문은 빛난다', /\.cabdoor\.been img\{filter:drop-shadow\(0 0 9px/.test(web), true);

  /* ── 학교 문을 열면 TV가 뿅 ── */
  eq('학교를 누르면 안으로 들어간다',
    /const go=p\.into\?\(\)=>setLevel\(p\.into\)/.test(web)
    && /const \[level,setLevel\]=useState\("town"\)/.test(web), true);
  /* 사물함이 뒤로 물러나고 열린 문이 한가운데에 뿅 나온다.
     화면을 가득 채우지 않는다 — 여기는 사물함 안이지 다른 화면이 아니다 */
  /* 사물함은 화면보다 훨씬 길다. 그 한가운데를 잡으면 열린 문이 화면 밖
     저 아래에 뜬다 — 실제로 그랬다. 보이는 자리 안에서 가운데를 잡는다 */
  eq('TV가 보이는 자리 한가운데에 뜬다',
    /\.cabin\{position:relative;width:100%;height:100%;min-height:340px;overflow:hidden;cursor:pointer;/.test(web)
    && /\.cabpop\{position:relative;z-index:2;width:88%/.test(web), true);
  eq('학교 안은 스크롤이 없다',
    /\.mapscroll\.inside\{display:flex;flex-direction:column;overflow:hidden\}/.test(web)
    && /level==="school"\?" inside":""/.test(web), true);
  eq('뒤에 사물함이 희미하게 남는다',
    /\.cab\.cabback\{position:absolute;left:0;top:0;width:100%;opacity:\.3/.test(web)
    && /cabinet\(true\)/.test(web), true);
  /* 상자를 두르면 창 안에 창이 하나 더 생긴다. 글자색만 달리한다 */
  eq('규칙 줄에 상자를 안 두른다',
    /\.askrule\{margin:0 14px 11px;text-align:center;font-size:10\.5px/.test(web)
    && !/\.askrule\{[^}]*background:/.test(web), true);
  /* 열린 문 그림을 안 쓰면 그냥 TV만 뜬다. 여기는 사물함 안이다 */
  eq('열린 문 그림을 쓴다',
    /src="cab-icons\/open\.webp"/.test(web) && exists('cab-icons/open.webp'), true);
  /* 뒤에 깔린 사물함은 눌리면 안 된다 — 안 보이는 문을 누르게 된다 */
  eq('뒤에 깔린 문은 안 눌린다', /const live=!dim;/.test(web), true);
  /* 명패 둘은 갈 자리가 아니지만 누르면 한 마디 한다. 눌러도 아무 일이
     없는 칸이 여덟 중 둘이면 나머지도 안 눌러보게 된다 */
  eq('명패도 눌린다', /onClick=\{dim\?null:\(\)=>onPlate\(s\)\}/.test(web), true);
  eq('명패가 할 말이 있다',
    /say:"NULL에게 닿기를"/.test(web) && /say:"NULL 기다릴게"/.test(web), true);
  /* 얼굴은 .kao로 따로 뺀다 — 픽셀 글꼴에 저 글자들이 없다 */
  eq('명패 얼굴은 kao로 뺀다',
    /\{plate\.say\} <span className="kao">\{plate\.kao\}<\/span>/.test(web), true);
  /* 움직임을 줄여달라는 사람에게는 안 튀게 한다 */
  eq('덜 움직이게 해달라면 안 튄다',
    /@media\(prefers-reduced-motion:reduce\)\{\.cabpop\{animation:none\}\}/.test(web), true);
  /* TV 안 네 칸이 학교 안 네 자리다. 좌표는 TV 그림에서 화면 안쪽을 재서 넣었다 */
  const Q = [...web.slice(web.indexOf('const TV_QUAD={'), web.indexOf('const TV_QUAD_W='))
    .matchAll(/"([^"]+)":\s*\{x:/g)].map(m => m[1]);
  eq('TV에 학교 안 넷이 다 있다', Q, ['교실', '보건실', '옥상', '체육관']);
  /* TV 화면은 그림이라 잠금을 얹어서 말해야 한다 — 문짝처럼 그림을 갈 수 없다 */
  eq('잠긴 칸은 덮어서 알려준다',
    /\.tvq\.lock\{background:rgba\(64,52,112,\.52\)/.test(web), true);
  /* 길에 쓰던 것들은 걷었다. 안 쓰는 그림과 CSS는 팔레트만 흐린다 */
  eq('길은 걷었다', /roadmap|roadicon|roadpin|roadstart|roadfinishpanel/.test(web), false);
  eq('길 그림도 걷었다',
    ['null-roadmap-road.webp', 'school-roadmap-bg.webp', 'map-icons/heart-sign.png']
      .filter(f => exists(f)), []);
  /* 머리글은 남는다 — 진도 막대와 뒤로가기가 거기 있다 */
  eq('머리글은 그대로다', /className="roadhead"/.test(web), true);
}

/* 지우고 바로 다시 여는 것으로는 모자랐다 — 다시 열리기 전 몇 밀리초 사이에
   아직 살아 있는 화면이 상태를 도로 저장한다. 지운 이름이 살아남아 오프닝이
   안 뜬 적도 있다. 표식만 남기고 열어서, 다음 판 맨 앞에서 비운다 */
eq('리스타트는 표식만 남기고 다시 연다',
  /localStorage\.setItem\("null_wipe","1"\)/.test(web) && /location\.reload\(\)/.test(web), true);
eq('다음 판 맨 앞에서 비운다',
  /if\(localStorage\.getItem\("null_wipe"\)\)\{ localStorage\.clear\(\); \}/.test(web), true);

/* ── 시간표 ──
   하루에 여섯 번 알림을 띄우면 사흘이면 벽지가 된다. 하루에 한 번이면
   의식이 된다. 그 뒤로는 peek 옆 단추가 지금이 몇 교시인지 들고 있다. */
{
  const src = web.slice(web.indexOf('const PERIODS='), web.indexOf('/* 하루의 경계는'));
  const f = new Function(src + ';return {nowLabel,daySlots,slotNow,isYajaWeek,isWend}')();
  const at = (mo, d, h, mi) => new Date(2026, mo, d, h, mi);
  /* 요즘 고등학교 기준 — 50분 수업 10분 쉬는 시간, 4교시 뒤 점심 */
  eq('교시를 센다', ['등교전','1교시','쉬는시간','점심','5교시','퇴근'].filter((w, i) =>
    f.nowLabel([at(7,17,7,30),at(7,17,8,50),at(7,17,9,35),at(7,17,12,45),
                at(7,17,13,40),at(7,17,16,45)][i]) !== w), []);
  /* ── 마지막 칸이 OFF다 ──
     학교가 하루를 채워주다가 끝나면 정해주는 것이 없다. 전에는 저녁 칸이
     밤 열한 시까지 켜져 있었다 — 여섯 시간을 「저녁」이라고 우겼다.
     스물한 시는 timeWord가 「밤」으로 넘어가는 경계다. 시계를 둘 두지 않는다.
     그 칸의 이름은 NULL이었다가 OFF가 됐다 — ON과 짝을 이뤄 표의 양 끝을
     막는 마개다. 아래 설명칸의 「지금부터 NULL...」은 그 자리에 그대로 남는다. */
  eq('밤에는 시간표가 비어 있다',
    [f.nowLabel(at(7, 17, 19, 0)), f.nowLabel(at(7, 17, 21, 10)), f.nowLabel(at(7, 17, 23, 30))],
    ['저녁', 'OFF', 'OFF']);
  /* 표의 양 끝은 시각이 아니라 마개다 — 지나감(♡)도 지금(얼굴)도 안 붙는다 */
  eq('ON은 출근 위에 얹는다',
    /\{k:"ON",n:-1,edge:"오늘도 Loading\.\.\."\}/.test(web), true);
  eq('OFF는 마지막 칸의 이름이다',
    /s\.k==="OFF"\?\{edge:"오늘도 Ending\.\.\."\}/.test(web)
    && /\{k:"OFF",at:1260\}/.test(web), true);
  eq('마개에는 표시를 안 붙인다',
    /className="ttrow edge"[\s\S]{0,120}\{r\.edge\}<\/span>/.test(web), true);
  /* 제목으로 또 쓰면 한 화면에 같은 말이 두 번이다 */
  eq('설명칸에서 OFF 제목은 걷었다',
    !/L==="저녁"\?\{t:"OFF"/.test(web)
    && /\(L==="OFF"\|\|L==="NULL"\)\?\{t:"DAY OFF, NULL ON!"/.test(web), true);
  /* 자정을 넘겨도 하루는 안 바뀐다 — 경계는 새벽 다섯 시(dayKey와 같다).
     그 시간에 「등교전」이라고 뜨던 것이 어제의 NULL로 이어진다 */
  eq('새벽도 어제의 NULL이다',
    [f.nowLabel(at(7, 17, 2, 0)), f.nowLabel(at(7, 17, 6, 0))], ['NULL', '등교전']);
  /* 야자는 강제가 아니라 희망자 자율학습이다 — 유저가 감독인 날에만 붙는다 */
  eq('야자는 격주 목요일에만 붙는다',
    [6,13,20,27].map(d => f.daySlots(at(7,d,19,0)).some(s => s.k === '야자')),
    [false, true, false, true]);
  /* 주말은 학교가 정해주는 하루가 아니다 — 칸이 비고 유저가 적는다 */
  eq('주말은 칸이 비어 있다',
    [f.daySlots(at(7,22,14,0)).length, f.nowLabel(at(7,22,14,0))], [0, '토요일']);
  eq('주말 칸은 넷이다', /const WEND_SLOTS=4/.test(web), true);
}
/* 하루의 경계는 자정이 아니라 새벽 다섯 시다 — 대화 도중에 날짜가 넘어가면 안 된다 */
eq('하루는 새벽 다섯 시에 넘어간다',
  /if\(d\.getHours\(\)<5\)d\.setDate\(d\.getDate\(\)-1\)/.test(web), true);
eq('그날 처음 열 때 한 번만 뜬다',
  /if\(loadDaySeen\(\)===k\)return;/.test(web) && /saveDaySeen\(k\); setDlg\("timetable"\)/.test(web), true);
/* 시간표는 「수업」 한 덩이로 두고 교시는 단추에서만 센다 */
eq('시간표 칸에는 교시를 안 쓴다',
  /\{k:"수업",at:520\},\{k:"점심",at:750\},\{k:"수업",at:810\}/.test(web)
  && !/1교시",at:/.test(web), true);
eq('단추가 peek 옆에 같은 모양으로 선다',
  /<button className="moonbtn bevel nowbtn"[^>]*onClick=\{\(\)=>setDlg\("timetable"\)\}/.test(web), true);
/* 야자 감독인 주에는 그 주 아무 때나 들어와도 보인다 */
/* null.exe는 원래 「!! WARNING !!」 + 두 줄인 창이다. 야자 주에는 그 자리를
   바꿔 끼운다 — 상자를 하나 더 만들면 창 안에 창이 생긴다 */
eq('야자 주에는 아랫줄이 경고로 바뀐다',
  /<div className="ttsay warn">/.test(web) && /!!!WARNING!!!/.test(web)
  && /목요일은 내가 야자 감독 ミ✭/.test(web) && !/className="ttwarn"/.test(web), true);
/* 사람이 준 게 아니라 시간표가 쥐여주는 것이라 준 사람도 자리도 없다 */
eq('에너지바는 야자 주에 한 번만 들어온다',
  /if\(bagRef\.current\.some\(b=>b\.key==="ebar"\)\)return;/.test(web)
  && /ebar:\s*\{name:"에너지바",\s*cat:"간식", say:"energy level : restored \+20 ♡"\}/.test(web)
  && exists('item-ebar.webp'), true);
/* .blank은 이미 쓰이는 이름이다 — 붙이면 줄 전체가 점선 상자가 된다 */
eq('주말 칸이 기존 빈칸과 이름이 안 겹친다',
  /className="ttrow mine"/.test(web) && !/className="ttrow blank"/.test(web), true);

/* ── 지도 두 장 ──
   교실·보건실·옥상은 한 건물 안의 방이고 편의점·도서관은 동네의 다른 지점이다.
   그걸 한 길에 세우니 교실에서 보건실 가는 길에 표지판이 서 있었다.
   길은 그대로 두고(START에서 문까지가 30일이다) 학교만 안이 있는 정거장으로 */
eq('학교는 자리가 아니라 문이다',
  /\{name:"학교",\s*map:"town", into:"school"/.test(web)
  && /const SPOTS=PLACES\.filter\(p=>!p\.into\)/.test(web), true);
eq('진도는 갈 수 있는 자리로만 센다',
  (web.match(/SPOTS\.length/g) || []).length, 2);
eq('학교를 누르면 안으로 들어간다',
  /const go=p\.into\?\(\)=>setLevel\(p\.into\)/.test(web)
  && /const \[level,setLevel\]=useState\("town"\)/.test(web), true);
/* 학교 안은 길이 아니라 건물이다. 마을은 사물함이고 학교 안은 TV라
   화면부터 다르다 — 같은 그림에 표지판만 다르게 세우던 때와 다르다 */
eq('마을과 학교 안은 화면이 다르다',
  /if\(level==="town"\)return cabinet\(false\);/.test(web)
  && /return <div className="cabin" role="button"/.test(web), true);
/* 나갈 데가 머리글 하나뿐이면 못 찾는다. 열린 문 바깥은 전부 「닫기」다 */
eq('뒤를 누르면 마을로 돌아온다',
  /onClick=\{\(\)=>setLevel\("town"\)\}/.test(web), true);
/* 문짝도 「닫기」다. .cabpop이 통째로 클릭을 삼키던 때는 활짝 열린 그 문을
   눌러도 아무 일이 없었다. 이제 삼키는 건 TV 화면 넷뿐이다 —
   그래서 자리를 고를 때는 tvq가 클릭을 멈춰야 한다. 안 멈추면 자리를
   고르자마자 사물함이 닫히고 창만 덩그러니 남는다. 앱도 같이 본다 */
{
  const cab = readFileSync(join(ROOT, 'app/screens/Cabinet.tsx'), 'utf8');
  eq('문을 눌러도 닫힌다', /<div className="cabpop">/.test(web)
    && !/cabpop" onClick/.test(web), true);
  eq('앱도 문을 안 삼킨다', !/<Pressable onPress=\{\(\) => \{\}\}/.test(cab), true);
  eq('자리를 고를 때는 안 닫힌다',
    /const go=e=>\{if\(e\)e\.stopPropagation\(\);onGoPlace\(p\.name\)\}/.test(web), true);
}
/* TV 화면 위에 테두리를 두르면 그림 위에 그림이 하나 더 얹힌다 */
eq('TV 칸에는 다녀온 테두리를 안 두른다', /\.tvq\.been\{/.test(web), false);
/* 나가기는 단추를 더 놓지 않고 제목 자리가 대신한다 */
eq('머리글이 뒤로가기다', /className="rt rback" role="button"/.test(web), true);
/* 체육관은 TV 안에, 학교는 사물함 문짝에 있다 */
eq('학교·체육관이 각자 자리에 있다',
  /"체육관":\{x:35\.4, y:45\.0\}/.test(web)
  && ['cab-icons/school-open.webp','cab-icons/school-lock.webp'].filter(f => !exists(f)).length === 0, true);
/* peek은 메뉴바 맨 끝, LIVE는 「두 사람」 방 위의 딱지 — 원래 자리다.
   시간표 단추가 들어오면서 한 번 자리를 옮겼다가 되돌렸다. 390에서 여덟이
   한 줄에 앉는다(재봤다: peek 오른쪽 끝 385, 여백 5) */
eq('peek은 메뉴바 맨 끝이다',
  /<button className=\{"moonbtn bevel"\+\(left>0&&!autoLoading\?" cool":""\)\}[\s\S]{0,900}<\/button>\s*<\/div>\s*\{\/\*[\s\S]{0,200}\*\/\}\s*<div className="marquee">/.test(web), true);
eq('LIVE는 방 위의 딱지다',
  /\{watch&&<div className="sectwrap"><span className="sect">LIVE<\/span><\/div>\}/.test(web), true);
/* 옮겼다 되돌린 흔적은 남기지 않는다 — 안 쓰는 CSS가 팔레트를 흐린다 */
eq('핫핑크 점은 걷었다', /livedot/.test(web), false);
/* 여기 좁히지 않으면 peek이 창 밖으로 밀려난다. 한 번 겪었다 */
eq('시간표 단추는 peek보다 좁다',
  /\.menubar \.nowbtn\{padding:0 8px;font-size:10px/.test(web), true);

/* ── 사진은 배경이 하는 일이다 ──
   자리에 같이 있는데 사진을 문자로 받는 건 이상하고, 자리 밖에서 자기 모습을
   보내는 것도 남이 찍어줘야 나오는 그림이다. 자기가 찍을 수 있는 것만 남긴다 */
{
  const wk = readFileSync(join(ROOT, 'worker.js'), 'utf8');
  eq('자리에서는 사진을 안 보낸다',
    /여기서는 사진을 안 보낸다\("photo"를 쓰지 않는다\)/.test(wk), true);
  /* place는 매 턴 달라진다 — 시스템(캐시)에 섞으면 자리에 드나들 때마다 다시 쓰인다 */
  eq('그 규칙은 가변부에 있다',
    /buildPhotoGuide\(allowedChars\(mode, room\)\)/.test(wk)
    && !/buildPhotoGuide\([^)]*place/.test(wk), true);
  eq('보낼 수 있는 사진은 자기가 찍은 것뿐이다',
    /\.filter\(\(\[, p\]\) => chars\.includes\(p\.char\) && p\.self\)/.test(wk)
    && /\*\*자기가 찍어서 보낼 수 있는 것만 보낸다\.\*\*/.test(wk), true);
  eq('self는 설명이 그렇다고 말하는 것만', (() => {
    const t = wk.slice(wk.indexOf('const PHOTOS = {'));
    const body = t.slice(0, t.indexOf('\n};'));
    return [...body.matchAll(/"([\w-]+)":\s*\{\s*char:\s*"\w+", self: true,/g)].map(m => m[1]).sort();
  })(), ['jaeeon-care', 'jaeeon-cook', 'jaeeon-market', 'jaeeon-treat',
         'minhyun-mirror', 'minhyun-morning', 'minhyun-nap']);
  /* 재언은 자기 모습을 안 보낸다. 눈앞의 것만 찍는다 — 걱정을 말로 안 하는
     사람이라 그게 이 사람의 문장이다. 민현은 셀카를 찍는다. 스무 살이라서 */
  eq('재언이 보내는 건 자기 모습이 아니다', (() => {
    const t = wk.slice(wk.indexOf('const PHOTOS = {'));
    const body = t.slice(0, t.indexOf('\n};'));
    return [...body.matchAll(/"jaeeon-([\w]+)":\s*\{\s*char:\s*"jaeeon", self: true,/g)]
      .map(m => m[1]).sort();
  })(), ['care', 'cook', 'market', 'treat']);
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
