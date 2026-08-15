/* NULL 회귀 테스트 — 의존성 없이 `node test/run.mjs`로 돈다.
   네트워크도 API 키도 쓰지 않는다. 모델을 부르지 않고 검증 가능한 것만 다룬다.

   여기 모인 것은 전부 "실제로 한 번 터졌던 것"이다. 새 기능을 넣을 때가 아니라
   화면이 깨졌을 때 하나씩 추가했다. 그래서 이름이 증상으로 붙어 있다. */

import { parseMessages, splitLines, trimTics, sanitizePhotos, buildSystem, buildVolatile, budgetHistory } from '../worker.js';
import worker from '../worker.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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
eq('선물이 없으면 그 대목도 없다', buildVolatile(...A).includes('방금 일어난 일'), false);
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
const web = readFileSync(join(ROOT, 'index.html'), 'utf8');
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
const dbSrc  = readFileSync(join(ROOT, 'app/lib/db.ts'), 'utf8');

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
    && !new RegExp(`export\\s*\\{[^}]*\\b${n}\\b`, 's').test(src));   // 파일 끝에 모아 내보내는 것도 센다
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
  '\nreturn {demoAnswer,demoProactive,demoSeed,demoReset,demoNorm,demoTokens,demoWhen,DEMO_SELFIE_RE,DEMO_PIC,DEMO_PIC_ANY,DEMO_CORPUS};')();
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
const GIFT_KEYS = [...web.matchAll(/\{key:"([a-z]+)"/g)].map(m => m[1]);
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
eq('실습 기간이 웹·앱 같다', enrollDays(appSrc), enrollDays(web));
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
  eq(`관전 자동 채움 ${k}가 웹·앱 같다`, autoNum(appSrc, k), autoNum(web, k)));
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
  eq(`쌓이는 방아쇠 ${k}가 웹·앱 같다`, autoNum(appSrc, k), autoNum(web, k)));
const ddayMarks = src => (src.match(/DDAY_MARKS\s*=\s*\[([^\]]*)\]/) || [])[1];
eq('남은 날 방아쇠가 웹·앱 같다', ddayMarks(appSrc), ddayMarks(web));
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
eq('남은 날 사건은 이름을 먼저 안 붙인다',
  /누구도 그 이름을 먼저 말하지 않는다/.test(workerSrc), true);

/* 누가 먼저 말하는가. 이 둘의 관계가 여기서 드러난다 — 민현은 미끼를 던지고
   재언은 물어야 답한다. 규칙이 빠지면 둘이 똑같이 말하기 시작한다. */
eq('관전방은 민현이 연다', /대화는 늘 이민현이 연다/.test(workerSrc), true);
eq('재언은 먼저 꺼내지 않는다', /먼저 꺼내는 법이 없다/.test(workerSrc), true);
eq('민현은 자랑을 질문으로 포장한다', /자랑을 질문으로 포장한다/.test(workerSrc), true);
/* 결을 정하는 것과 말투를 강제하는 것은 다르다. "게요"를 규칙으로 박으면
   민현이 그 어미만 반복하게 된다. */
eq('말투를 강제하지 않는다', /정해진 어미가 있는 건 아니다/.test(workerSrc), true);

/* 호칭. 교생은 신분이지 부르는 말이 아니다 — 두 사람 다 "선생님"이라고 부른다 */
/* 손으로 쓴 대사를 결 견본으로 프롬프트에 올렸다. 대사집이 아니라 견본이라는
   못이 같이 안 박히면 모델이 그대로 베껴 쓴다 — 예시가 늘수록 그 압력이 세진다. */
eq('견본을 그대로 베끼지 말라고 못박는다',
  (workerSrc.match(/같은 문장을 그대로 쓰지 않는다/g) || []).length, 2);
eq('두 사람 다 결 견본을 들고 있다',
  (workerSrc.match(/### 결 견본/g) || []).length, 2);
/* 재언의 반말은 상대에게 하는 말이 아니라 새어나오는 것이다. 순서가 뒤집히면
   그냥 말을 놓는 사람이 된다 — 존댓말이 먼저 서 있어야 예의가 확보된다. */
eq('혼잣말은 존댓말 뒤에 붙는다', /순서가 반대면 안 된다/.test(workerSrc), true);
eq('명령·질문·대답은 예외 없이 존댓말이다',
  /명령·질문·부탁·대답은 예외 없이 존댓말이다/.test(workerSrc), true);
/* 견본은 고정 블록에 있어야 한다. 가변부로 새면 매 턴 값을 다시 문다 */
eq('견본이 캐시되는 자리에 있다',
  buildSystem('chat', 'jaeeon', 'R', null, [], null, null, null)
    .filter(b => b.cache_control).some(b => b.text.includes('결 견본')), true);

eq('두 사람 다 유저를 선생님이라고 부른다',
  (workerSrc.match(/부를 때는 "선생님"이다/g) || []).length, 2);

/* 재언의 건조함은 자기 감정을 지우는 것이지 상대를 깎는 게 아니다. 되받아
   되묻는 버릇을 유저한테까지 쓰면 그건 그냥 싸가지다 — 조카한테만 쓴다. */
eq('되받아 되묻기는 민현에게만 쓴다',
  /되받아 되묻는다 — 민현에게만/.test(workerSrc), true);
eq('날은 자기 안으로 향한다', /날은 항상 자기 안으로 향한다/.test(workerSrc), true);
eq('이유 없는 거절을 안 한다', /이유 없는 거절은 이 사람이 안 하는 일이다/.test(workerSrc), true);
eq('재언은 점으로 침묵을 대신하지 않는다',
  /말줄임표로 침묵을 대신하지 않는다/.test(workerSrc), true);
/* 구두점을 지우라는 규칙으로 읽히면 재언이 통째로 툭툭 끊어 말한다.
   붙여 말하는 건 호흡 얘기지 쉼표 얘기가 아니다. */
eq('쉼표는 정상적으로 쓴다', /구두점을 지우라는 말이 아니다/.test(workerSrc), true);
/* 민현 쪽. 점을 찍는 건 슬픈 척이고, 괜찮다고 먼저 말해버리는 게 슬픈 것이다 */
eq('슬픔은 문장에서 나온다', /슬픔은 문장에서 나온다. 점으로 만들지 않는다/.test(workerSrc), true);
eq('자모 축약을 프롬프트에서도 막는다',
  (workerSrc.match(/ㅋ·ㅡㅡ·ㅇㅇ|자모 축약/g) || []).length >= 3, true);
eq('이름이 비었을 때도 선생님이다', !/userName \|\| "교생"/.test(workerSrc), true);
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

/* 이름을 아껴 쓰라고 두 사람 다에게 말해둔다 — 안 그러면 칸이 하루에 다 찬다 */
eq('두 사람 다 이름을 아껴 쓴다',
  (workerSrc.match(/이름은 아껴 쓴다/g) || []).length, 2);
eq('한 대화에 한 번을 넘기지 않는다',
  (workerSrc.match(/한 대화에 한 번을 넘기지 않는다/g) || []).length, 2);
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
   시작했는데 "이미 봤다"고 남아 첫 단계 변화를 놓친다 */
eq('새로 시작하면 본 기록도 지운다',
  /setSeenStage\(\{\}\)/.test(web) && /setSeenStage\(\{\}\)/.test(appSrc), true);

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
/* 단계는 안 올라가는데 일기만 첫날에 열리면 안쪽으로 들어가는 순서가 무너진다 */
eq('해금도 날짜를 본다', [uk(120, 0), uk(120, 3), uk(120, 15), uk(120, 25)], [0, 2, 8, 16]);
/* 표가 세 군데 있다 — 워커·웹·앱. 하나만 고치면 화면에 뜨는 진행도와 실제
   해금 시점이 어긋나는데, 그건 눈으로 안 보인다. 키·조건을 통째로 대조한다. */
{
  const pick = (t, from, to, re) => [...t.slice(t.indexOf(from), t.indexOf(to)).matchAll(re)]
    .map(m => `${m[1]}:${m[2]}:${m[3]}`);
  const W = pick(workerSrc, 'const UNLOCKS = [', '/* 상태메시지',
    /key: "([^"]+)", room: "([a-z]+)", at: (\d+)/g);
  const H = pick(web, 'const HIDDEN=[', 'const HIDDEN_LABEL',
    /key:"([^"]+)",\s*file:[^,]+,\s*label:[^,]+, room:"([a-z]+)", at:(\d+)/g);
  const A = pick(appSrc, 'const HIDDEN:HiddenItem', '/* ── 데모 모드',
    /key:'([^']+)',\s*label:[^,]+, room:'([a-z]+)', at:(\d+)/g);
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
eq('달은 여전히 관찰 버튼 안에 있다', /<MoonIcon\/>\s*\n\s*<span>\{autoLoading/.test(web), true);

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
eq('웹·앱 둘 다 공백으로 인사 갈래를 고른다',
  /demoProactive\(id,demoGreetWhen\(gapMin\),name\)/.test(web)
  && /demoProactive\(id,demoGreetWhen\(gapMin\),name\)/.test(appSrc), true);
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
  /greetAtRef\.current=0/.test(web) && /greetAtRef\.current=0/.test(appSrc), true);

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
  /보건실은 이재언의 자리다/.test(workerSrc) && /누가 왔느냐만 사건이다/.test(workerSrc), true);

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
/* ── 형식이 깨진 응답이 대사가 되던 것 ──
   「api호출오류: litellm.APIConnectionError ...」가 민현이 말풍선으로 나갔다.
   parseMessages의 마지막 줄이 무슨 글자든 대사로 만들고 splitLines가 줄마다
   말풍선으로 쪼갠 결과다. 그리고 저장돼서 매 턴 모델한테 되먹여졌다. */
{
  const ok = parseMessages('{"messages":["왔어요?","빨리 왔네요."]}', 'minhyun', ['minhyun']);
  eq('제대로 온 응답은 ok다', [parseMessages.ok, ok.length], [true, 2]);
  parseMessages('왔어요? 빨리 왔네요.\napi호출오류: litellm.APIConnectionError', 'minhyun', ['minhyun']);
  eq('JSON이 아니면 ok가 아니다', parseMessages.ok, false);
  eq('잘린 JSON도 ok가 아니다',
    (parseMessages('{"messages":["왔어요?","빨리', 'minhyun', ['minhyun']), parseMessages.ok), false);
}
eq('형식이 깨지면 다시 부른다',
  /if \(!parseMessages\.ok\) \{[\s\S]{0,320}askClaude\(env, system, msgs, Math\.round\(cap \* 1\.5\)\)/.test(workerSrc), true);
eq('그래도 깨지면 대사로 안 내보낸다',
  /형식이 깨진 응답"[\s\S]{0,120}status: 502/.test(workerSrc), true);
eq('받은 원문을 로그에 남긴다',
  /형식이 깨진 응답 ▶ \$\{raw\.slice\(0, 400\)\}/.test(workerSrc), true);
/* 워커에서 막아도 이미 저장된 것이 남아 있다. 그건 매 턴 프롬프트로 들어간다 */
eq('웹은 저장된 오류 말풍선을 걷어낸다',
  /const POISON=/.test(web) && /msgs:cleanMsgs\(s\.msgs\)/.test(web), true);
eq('앱도 켜질 때 지운다',
  /await purgePoison\(db\)/.test(dbSrc) && /DELETE FROM messages WHERE \$\{where\}/.test(dbSrc), true);
/* 요약에 섞이면 말풍선을 지워도 모델은 계속 그걸 본다 */
eq('요약에 섞였으면 요약을 버린다',
  /if\(POISON\.test\(v\.text\|\|""\)\)return\{text:"",upto:0\}/.test(web)
  && /null_sum_%[\s\S]{0,200}DELETE FROM meta/.test(dbSrc), true);
/* 어떤 경로로 오든 화면에 못 들어가게 한 겹 더 */
eq('웹·앱 둘 다 대사로 들어오는 것도 막는다',
  /if\(POISON\.test\(text\)\)/.test(web) && /if\(POISON\.test\(m\?\.text\|\|''\)\)/.test(appSrc), true);
/* request.cf.colo는 실행 위치가 아니라 요청이 들어온 콜로다 */
eq('진단 라벨이 거짓말하지 않는다',
  /요청 받은 곳/.test(workerSrc) && !/`실행 위치/.test(workerSrc), true);

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
  /단 이건 지켜본 뒤에 아는 것이다\. 처음부터 알고 있지 않다/.test(workerSrc), true);
eq('신호가 없으면 다른 방도 없다',
  /\[눈치 신호\]가 없으면 다른 방은 없는 것이다/.test(workerSrc), true);
/* 견제 자체는 이 인물들의 것이다. 없애는 게 아니라 빈도를 잡는다 */
eq('떠보는 건 살려두고 횟수만 잡는다',
  /떠보는 것도 견제하는 것도 이 인물들이 하는 짓이니까 없애지 않는다/.test(workerSrc)
  && /한 대화에 한 번\.\*\* 그 이상은 눈치가 아니라 감시/.test(workerSrc), true);

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
  /### 첫 연락 — 이 두 대목만은 문장 그대로 쓴다/.test(workerSrc)
  && /"선생님이 저 책임진다면서요\."/.test(workerSrc)
  && /"그래서 책임은 어떻게 질 건데요\?"/.test(workerSrc), true);
eq('설명은 유저가 물었을 때만',
  /유저가 안 물으면 굳이 설명하지 않는다/.test(workerSrc), true);
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
    ['이 단계에 맞게 연기한다', '목록을 읊지 말고', '눈치챈 것처럼만',
     '대부분의 턴에는 안 꺼낸다'].filter(t => v.includes(t)), []);
  eq('설명은 고정부에 있다',
    ['그 단계에 맞게 연기한다', '목록을 읊지 말고', '눈치챈 사람처럼만',
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
  /* 자기분석 금지는 WORLD 연기 가드에 예시까지 붙어 있다. 인물 블록에 또 적지 않는다 */
  eq('자기분석 금지는 한 군데만',
    (promptSrc.match(/자기분석을 대사로/g) || []).length, 1);
  /* 눈치 신호 읽는 법은 WORLD 교차 인식에 있다 */
  eq('눈치 신호 읽는 법도 한 군데만',
    (promptSrc.match(/직접 인용/g) || []).length, 1);
  /* 1번이 최애라는 말은 인물마다 자기 목록에서 한다 — FACTS가 또 말하지 않는다 */
  eq('최애 규칙은 인물 블록에만', (workerSrc.match(/1번이 최애다/g) || []).length, 2);
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
    ['새로 오셨죠. / 애들 때문에 정신 없으시겠네요. / 저한테는 편하게 메세지 주셔도 됩니다.']);
  eq('프롬프트도 그 예외를 적어뒀다', /아직 아는 사이가 아닐 때/.test(workerSrc), true);
  /* 그러니 프롬프트 예문에도 없어야 한다. 이름 밝히는 자리 하나만 예외 */
  /* 규칙 문장 자체는 세지 않는다 — 따옴표 안의 예문만 본다 */
  eq('재언 예문에 -ㅂ니다가 없다', (() => {
    const j = workerSrc.match(/const JAEEON = `([\s\S]*?)`;/)[1];
    return (j.slice(j.indexOf('### ★ 교생')).match(/"[^"]+"/g) || [])
      .filter(q => /(습니다|습니까|입니다|됩니다)/.test(q) && q !== '"-습니다/-습니까"');
  })(), ['"보건실 이재언입니다."', '"저한테는 편하게 메세지 주셔도 됩니다."']);
  /* 민현은 유저에게도 삼촌에게도 존댓말이다 */
  eq('문구집의 민현은 반말을 안 쓴다', M.filter(t => /(^뭐야|삼촌도 참|설명인데\.)/.test(t)).length, 0);
  eq('민현 말투 예시에도 반말이 없다', (() => {
    const m = workerSrc.match(/const MINHYUN = `([\s\S]*?)`;/)[1];
    const i = m.indexOf('### 말투 예시'), j = m.indexOf('### 결 견본');
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
  /const blocks = \[\{ type: "text", text: tail\.content, cache_control: CACHE \}\];/.test(workerSrc)
  && /if \(volatile\) blocks\.push\(\{ type: "text", text: volatile \}\);/.test(workerSrc), true);
/* 앱은 최근 것부터 가져와야 한다. ASC LIMIT이면 200개가 넘는 순간
   제일 오래된 200개가 돌아온다 — 화면에도 프롬프트에도 옛날 것만 남는다 */
{
  const dbSrc = readFileSync(join(ROOT, 'app/lib/db.ts'), 'utf8');
  eq('getMsgs가 최근 것부터 가져온다',
    /ORDER BY created_at DESC LIMIT \?\)'\s*\n?\s*\+ ' ORDER BY created_at ASC/.test(dbSrc), true);
  eq('D-30은 제일 처음 말로 센다', /export async function getFirstMsg/.test(dbSrc)
    && /await getFirstMsg\(room\)/.test(apiSrc), true);
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
