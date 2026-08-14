/* NULL 회귀 테스트 — 의존성 없이 `node test/run.mjs`로 돈다.
   네트워크도 API 키도 쓰지 않는다. 모델을 부르지 않고 검증 가능한 것만 다룬다.

   여기 모인 것은 전부 "실제로 한 번 터졌던 것"이다. 새 기능을 넣을 때가 아니라
   화면이 깨졌을 때 하나씩 추가했다. 그래서 이름이 증상으로 붙어 있다. */

import { parseMessages, splitLines, trimTics, sanitizePhotos, buildSystem } from '../worker.js';
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
const vary = (...a) => buildSystem(...a).filter(b => !b.cache_control);
const A = ['chat', 'jaeeon', 'R', null, [], null, { jaeeon: 10 }, null];
const B = ['chat', 'jaeeon', 'R', { minhyun: { count: 3, minsAgo: 1 } }, [], { likes: '커피' }, { jaeeon: 90 },
           { name: '회색 머그컵', key: 'mug' }];

eq('고정부에 cache_control이 붙어 있다', fixed(...A).length > 0, true);
eq('신호·프로필·단계·선물이 달라져도 고정부는 그대로', stable(...A) === stable(...B), true);
eq('가변부에만 선물이 실린다', vary(...B).map(b => b.text).join('').includes('회색 머그컵'), true);
eq('가변부는 하나뿐이고 캐시가 안 걸린다', vary(...B).length, 1);
eq('선물이 없으면 그 대목도 없다', buildSystem(...A).some(b => b.text.includes('방금 일어난 일')), false);
eq('가변부는 맨 뒤다 — 앞에 끼면 뒤가 전부 캐시에서 빠진다',
  buildSystem(...B).findIndex(b => !b.cache_control), buildSystem(...B).length - 1);

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
const said = (room, t) => demo.demoAnswer(room, t, '윤하').map(m => m.text).join(' | ');

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
eq('데모 답이 터져도 화면은 안 멈춘다', /const demoSay=\(room,ask\)=>\{[\s\S]{0,400}catch/.test(web), true);
/* 대사 파일을 따로 뺐으므로 캐시를 끊어줘야 고친 게 반영된다 */
eq('대사 파일에 캐시 무효화가 붙어 있다', /demo-lines\.js\?v=/.test(web), true);

/* 데모에서도 사진첩이 차야 한다. 서버가 붙여주던 걸 엔진이 대신 한다 —
   말에 걸리는 게 있으면 그 사진을, 없으면 가끔 아무거나. */
[['jaeeon', '밥 먹었어요?'], ['jaeeon', '커피 마셨어요?'],
 ['minhyun', '사탕 있어요?'], ['minhyun', '졸려요']].forEach(([r, q]) =>
  eq(`"${q}"에 사진이 붙는다`, demo.demoAnswer(r, q, '윤하').some(m => m.photo), true));
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
 ['minhyun', '너 왜 자꾸 보건실에 있어', '다른 사람 때문에']].forEach(([r, q, want]) =>
  eq(`손으로 쓴 "${want}"가 제자리에서 나온다`, said(r, q).includes(want), true));

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
/* 💿는 소개 영상이다. 웹과 앱이 같은 사진·같은 문장이어야 한 작품으로 보인다. */
const filmOf = (src, q) => {
  const m = new RegExp(`FILM_(?:SHOTS|LINES)[^=]*=\\s*\\[([^\\]]*)\\]`, 'g');
  return [...src.matchAll(m)].map(x => [...x[1].matchAll(/['"]([^'"]+)['"]/g)].map(y => y[1]));
};
eq('소개 영상이 웹·앱 둘 다 있다',
  /function IntroFilm/.test(appSrc) && /function IntroFilm/.test(web), true);
eq('소개 영상의 사진과 문장이 웹·앱 같다', filmOf(appSrc), filmOf(web));

/* 등록 화면에서 채우는 빈칸. 웹에서만 고치고 앱을 안 고치는 일이 실제로 있었다.
   키와 꼬리말이 어긋나면 같은 값을 서버에 다르게 적어 보내게 된다. */
const enrOf = src => [...src.matchAll(/\{k:\s*['"](\w+)['"][^}]*?tail:\s*['"]([^'"]*)['"]/g)]
  .map(m => [m[1], m[2]]);
eq('등록 화면 빈칸이 웹·앱 같다', enrOf(appSrc), enrOf(web));
eq('등록 화면 빈칸이 네 칸이다', enrOf(web).length, 4);

/* etc. 팝업 문구 — 여기가 이 앱이 자기를 소개하는 유일한 자리다 */
const etcLines = ['안녕, NULL 기다렸어. ✧', 'the blank u fill in', '당신이 없어도 대화는 이어져요.'];
eq('etc. 팝업 문구가 웹·앱 같다',
  etcLines.filter(t => !(appSrc.includes(t) && web.includes(t))), []);

/* 실습 D-카운트. 첫 대화한 날부터 하루씩 깎이므로 양쪽이 같은 날짜 수에서
   출발해야 한다. 한쪽만 고치면 웹과 앱의 D가 어긋난다. */
const enrollDays = src => (src.match(/ENROLL_DAYS\s*=\s*(\d+)/) || [])[1];
eq('실습 기간이 웹·앱 같다', enrollDays(appSrc), enrollDays(web));
eq('실습 기간이 30일이다', enrollDays(web), '30');
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

/* 같이 가자는 제안. 서버가 고른다 — 모델이 알아서 꺼내게 두면 아무 때나
   조르거나 영영 안 꺼낸다. 거절한 곳을 다시 꺼내면 성격이 무너진다. */
eq('제안 자리를 서버가 고른다', /function inviteFor/.test(workerSrc), true);
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

/* 소개 영상은 설정 메뉴 옆에 평평하게 놓여 있어서 그 자체로는 눌릴 이유가
   없다. 대신 흐르는 띠가 말해준다. 메뉴바를 건드려 튀게 만들면 줄 전체가
   정신없어지므로, 초대는 띠 쪽에만 둔다. */
eq('흐르는 띠가 웹·앱 둘 다 소개 영상을 안내한다',
  /press intro · 11 seconds/.test(web) && /press intro · 11 seconds/.test(appSrc), true);

// 미니홈피 방문자 카운터 — 웹에만 있다가 앱에 옮겼다
eq('방문자 카운터가 웹·앱 둘 다 있다',
  /today.*total/s.test(appSrc.slice(appSrc.indexOf('visits'), appSrc.indexOf('visits') + 400))
  && /today.*total/s.test(web.slice(web.indexOf('visits'), web.indexOf('visits') + 400)), true);
eq('소개 영상 사진이 저장소에 있다', (filmOf(web)[0]||['x']).filter(f => !exists(f)), []);

// ─────────────────────────────────────────────
console.log(`\n${fail ? '실패' : '통과'} — ${pass}개 통과, ${fail}개 실패`);
process.exit(fail ? 1 : 0);
