/* 문구집(docs/dialogue-corpus.md) → 데모 대사 데이터.
   문구집이 정본이다. 대사를 고칠 때는 .md를 고치고 이걸 다시 돌린다 —
   생성된 파일을 직접 고치면 다음 빌드에 날아간다.

     node tools/build-demo.mjs

   웹은 <script>로 부르고 앱은 import한다. 그래서 같은 내용을 두 벌 낸다.
   둘이 어긋나면 웹과 앱이 다른 말을 하므로 검사에서 대조한다. */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'docs/dialogue-corpus.md';
const md = readFileSync(SRC, 'utf8').split(/\r?\n/);

/* 여러 줄이 이어져 한 장면이 되는 절. 나머지 절은 한 줄이 곧 한 후보다 —
   단톡방에서 재언 줄과 민현 줄을 따로 뽑으면 주고받는 게 사라진다. */
const isScript = s => /단체방|관전방|장기 대화|선톡 후/.test(s);
const isProactive = s => /선톡|재접속|무응답 재호출|전날 대화 콜백/.test(s);

const out = { intents:[], follow:[], danger:[], group:[], watch:[],
              proactive:{jaeeon:[],minhyun:[]}, multi:[], repeat:[],
              fallback:{jaeeon:[],minhyun:[],group:[],watch:[]} };

let sec = '', sub = '', cur = null, mode = '';
const breath = t => t.split(' / ').map(s => s.trim()).filter(Boolean);

const flush = () => {
  if (!cur) return;
  const bucket =
      /위험·안전/.test(sec)        ? out.danger
    : /직전 대답 다음에만/.test(sec) ? out.follow
    : /^단체방/.test(sec)          ? out.group
    : /^관전방/.test(sec)          ? out.watch
    : /반복 입력 대응/.test(sec)    ? out.repeat
    : null;
  if (bucket) bucket.push(cur); else out.intents.push(cur);
  cur = null;
};

for (const raw of md) {
  const line = raw.replace(/\\$/, '').trimEnd();
  let m;
  if ((m = line.match(/^##\s+(.*)$/)))  { flush(); sec = m[1].trim(); sub = ''; continue; }
  if ((m = line.match(/^###\s+(.*)$/))) { flush(); sub = m[1].trim();
    if (/장기 대화|선톡 후/.test(sec)) { cur = { title: sub, sec, script: [] }; mode = 'script'; }
    else { cur = { q: [sub], sec, fromSub: true }; mode = 'cand'; }   // 소제목 아래 대사도 줍는다
    continue; }
  if ((m = line.match(/^\*\*Q\.\s*(.+?)\*\*(.*)$/))) {
    flush();
    cur = { q: m[1].split('/').map(s => s.trim()).filter(Boolean), sec };
    var cond = (m[2] || '').match(/\*\(([\s\S]+)\)\*/);   // 조건에 따옴표나 물음표가 들어와도 받는다
    if (cond) cur.after = cond[1].trim();
    mode = isScript(sec) ? 'script' : 'cand';
    if (mode === 'script') cur.script = [];
    continue;
  }
  /* 기본 폴백은 "**재언 · 뜻을 잘 모르겠을 때**" 꼴로 적혀 있다 */
  if ((m = line.match(/^\*\*(재언|민현|단체방|관전방)\s*·\s*(.+?)\*\*\s*$/))) {
    flush();
    cur = { fallbackOf: { '재언':'jaeeon', '민현':'minhyun', '단체방':'group', '관전방':'watch' }[m[1]],
            situation: m[2].trim(), sec };
    mode = 'cand';
    continue;
  }
  if ((m = line.match(/^\*\*상황\.\s*(.+?)\*\*\s*$/))) {
    flush();
    cur = { situation: m[1].trim(), sec };
    mode = isScript(sec) ? 'script' : isProactive(sec) ? 'proactive' : 'cand';
    if (mode === 'script') cur.script = [];
    continue;
  }
  /* 소제목 아래 설명문에 "식사, 카페, 영화처럼" 하고 걸리는 말이 나열돼 있다.
     그게 곧 이 갈래를 여는 입력이라 별칭으로 넣는다. */
  if (cur && cur.fromSub && line.indexOf('처럼') > 0) {
    const head = line.split('처럼')[0];
    const words = head.split(/[,、]/).map(w => w.trim().split(' ').pop()).filter(w => w && w.length <= 6);
    if (words.length >= 3) cur.q.push(...words);
  }
  if ((m = line.match(/^\*\*([^*]+)\*\*\s*$/))) {
    flush();
    cur = { situation: m[1].trim(), sec };
    mode = isScript(sec) ? 'script' : isProactive(sec) ? 'proactive' : 'cand';
    if (mode === 'script') cur.script = [];
    continue;
  }
  if ((m = line.match(/^[\s　]*(재언|민현|사용자)\s*—\s*(.+)$/))) {
    if (!cur) continue;
    const who = { '재언':'jaeeon', '민현':'minhyun', '사용자':'user' }[m[1]];
    const parts = breath(m[2].trim());
    if (mode === 'script') cur.script.push({ sender: who, text: parts });
    else { (cur[who] ||= []).push(parts); }
    continue;
  }
}
flush();

/* 선톡·재접속·무응답은 상황별로 캐릭터마다 따로 모은다 */
out.intents = out.intents.filter(e => {
  if (!isProactive(e.sec) || !e.situation) return true;
  for (const c of ['jaeeon','minhyun'])
    if (e[c]?.length) out.proactive[c].push({ when: e.situation, sec: e.sec, lines: e[c] });
  return false;
});
/* 사용자 줄이 섞인 것은 다턴 대화다. 어느 절에 있든 따로 뺀다 —
   장면 하나를 후보 목록으로 흩뜨리면 주고받는 순서가 사라진다. */
for (const arr of [out.group, out.watch, out.intents]) {
  for (const e of arr.slice())
    if (e.script?.some(x => x.sender === 'user') || /선톡 후|장기 대화/.test(e.sec)) {
      out.multi.push(e); arr.splice(arr.indexOf(e), 1);
    }
}
/* 기본 폴백 */
for (const e of out.intents.slice()) {
  if (!e.fallbackOf) continue;
  const k = e.fallbackOf;
  out.fallback[k].push(...(e[k === 'group' || k === 'watch' ? 'jaeeon' : k] || []));
  if (k === 'group' || k === 'watch') out.fallback[k].push(...(e.minhyun || []));
  out.intents.splice(out.intents.indexOf(e), 1);
}

/* 옮기다 흘린 줄이 없는지 센다. 4,500줄을 눈으로 못 본다 */
let got = 0;
for (const arr of [out.intents, out.follow, out.danger, out.repeat])
  for (const e of arr) got += (e.jaeeon?.length || 0) + (e.minhyun?.length || 0);
for (const c of ['jaeeon','minhyun']) {
  got += out.fallback[c].length;
  for (const p of out.proactive[c]) got += p.lines.length;
}
got += out.fallback.group.length + out.fallback.watch.length;
for (const arr of [out.group, out.watch, out.multi])
  for (const e of arr) got += (e.script || []).filter(x => x.sender !== 'user').length;
const want = readFileSync(SRC, 'utf8').split(/\r?\n/)
  .filter(l => /^[\s　]*(재언|민현)\s*—/.test(l)).length;
console.log(want === got ? `줄 수 맞음 ${got}` : `!! 흘린 줄이 있다 — 원본 ${want} / 옮긴 것 ${got}`);

const n = o => JSON.stringify(o).length;
console.log('의도', out.intents.length, '· 후속', out.follow.length, '· 위험', out.danger.length,
  '· 단톡', out.group.length, '· 관전', out.watch.length, '· 다턴', out.multi.length,
  '· 반복', out.repeat.length);
console.log('선톡  재언', out.proactive.jaeeon.length, '· 민현', out.proactive.minhyun.length);
console.log('폴백  재언', out.fallback.jaeeon.length, '· 민현', out.fallback.minhyun.length,
  '· 단톡', out.fallback.group.length, '· 관전', out.fallback.watch.length);
const total = out.intents.reduce((a,e)=>a+(e.jaeeon?.length||0)+(e.minhyun?.length||0),0);
console.log('1:1 답변', total, '줄 ·', (n(out)/1024).toFixed(0)+'KB');
writeFileSync('/tmp/corpus.json', JSON.stringify(out, null, 1));

/* ── 내보내기 ──
   웹은 <script src>로 부르고 앱은 import한다. 내용은 같아야 하므로
   같은 데이터와 같은 엔진에서 두 벌을 만든다. 검사에서 둘을 대조한다. */
const engine = readFileSync('tools/demo-engine.js', 'utf8');
const head = `/* 자동 생성 — 고치지 말 것.\n`
  + `   대사는 docs/dialogue-corpus.md가 정본이고, 엔진은 tools/demo-engine.js다.\n`
  + `   고친 뒤 \`node tools/build-demo.mjs\`를 돌리면 이 파일이 다시 만들어진다. */\n`;
const data = `var DEMO_CORPUS = ${JSON.stringify(out)};\n`;

writeFileSync('demo-lines.js', head + data + engine);
writeFileSync('app/lib/demoLines.ts',
  head + '/* eslint-disable */\n// @ts-nocheck\n' + data + engine
  + `\nexport { DEMO_CORPUS, demoAnswer, demoProactive, demoNorm, demoTokens,\n`
  + `         demoReset, demoSeed, demoMood, demoWhen, demoGreetWhen, DEMO_SELFIE_RE, DEMO_PIC, DEMO_PIC_ANY, DEMO_ST };\n`);
console.log('내보냄  demo-lines.js · app/lib/demoLines.ts');
