#!/usr/bin/env node
/* app-data.js → app/lib/rules.ts
   웹의 규칙(인물·방·선물·장소·시간표·생활리듬)을 앱이 그대로 쓰게 만든다.

   왜 만드나 — 앱은 이 규칙들을 손으로 베껴 들고 있었다. 그래서 웹에 지도가
   생기고 자리가 생기고 점심이 생기는 동안 앱은 옛 규칙에 머물렀고, 같은
   이름을 단 다른 물건이 됐다. 문구집(build-demo.mjs)에서 이미 쓰던 방식이다 —
   손으로 고치는 곳은 하나여야 한다.

   무엇을 하나 — 거의 아무것도 안 한다. app-data.js는 JSX도 DOM도 안 쓰는
   평범한 자바스크립트라 그대로 타입스크립트가 된다. 리액트를 꺼내 쓰는 첫
   줄만 떼고(앱은 훅을 여기서 안 쓴다), 맨 끝에 export를 붙인다.
   딛고 있는 브라우저 것 둘(localStorage·location)은 shim이 만들어 준다.

   API 주소는 안 내보낸다 — 앱은 lib/api.ts의 것을 쓴다. 이름이 겹치면
   어느 쪽을 쓰는지 읽는 사람이 헷갈린다. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'app-data.js');
const OUT = join(ROOT, 'app/lib/rules.ts');
const SKIP = new Set(['API']);   // 앱에는 이미 있다

const src = readFileSync(SRC, 'utf8');

/* 리액트를 꺼내 쓰는 줄. 앱의 rules는 훅을 안 쓴다 */
const body = src.replace(/^const \{useState,useEffect,useRef\} = React;\s*$/m,
  '/* (훅을 꺼내 쓰던 줄은 앱에서 뺀다 — 여기는 규칙만 산다) */');

/* 최상위 선언만 내보낸다. 들여쓴 것은 함수 안이라 대상이 아니다.
   한 줄에 둘을 선언한 것(`const TV_QUAD_W=19, TV_QUAD_H=18.5;`)에서 앞 이름만
   집던 때가 있었다 — TV_QUAD_H가 규칙 파일 안에는 있는데 내보내지지 않아,
   앱의 학교 TV 네 칸이 높이를 모르는 채로 그려질 뻔했다. 쉼표 뒤도 센다. */
const names = [];
for (const m of body.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)([^\n]*)/gm)) {
  const found = [m[1]];
  if (!m[0].startsWith('function')) {
    /* 같은 줄의 `, 이름=` 을 더 집는다. 값 안의 쉼표(객체·배열)에 속지 않게
       괄호·중괄호·대괄호가 다 닫힌 자리의 것만 센다 */
    let depth = 0, rest = m[2];
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (c === ',' && depth === 0) {
        const nm = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(rest.slice(i + 1));
        if (nm) found.push(nm[1]);
      }
    }
  }
  for (const n of found) if (!SKIP.has(n) && !names.includes(n)) names.push(n);
}
if (names.length < 100) {
  console.error(`[NULL] 규칙이 ${names.length}개뿐이다 — app-data.js를 제대로 못 읽었다`);
  process.exit(1);
}

/* ── 왜 함수 안에 넣나 ──
   ① 타입: 자바스크립트에서 온 글이라 `const dayKey=now=>...`의 now가
      타입스크립트 눈에는 «필수» 매개변수로 보인다. 웹에서 늘 쓰던 dayKey()가
      앱에서만 «인자가 모자란다»가 된다. any 한 겹을 거치면 그대로 통과한다.
   ② 이름: 그렇다고 파일 끝에서 `export const {AV_V,...} = __rules`로 풀면
      위에 이미 `const AV_V`가 있어서 같은 이름을 두 번 선언한 게 된다.
      실제로 그렇게 냈다가 앱이 아예 안 켜졌다 — 그런데 @ts-nocheck 때문에
      타입 검사는 통과했다. 진짜로 불러봐야만 나오는 종류다.
   규칙 전체를 함수 안에 넣으면 위의 선언들이 그 안에 살아서 부딪히지 않는다. */
const head = `/* 이 파일은 손으로 고치지 않는다.
   app-data.js에서 tools/build-rules.mjs가 만든다 — 규칙을 고칠 곳은 그쪽 하나다.
   웹과 앱이 같은 글을 읽어야 같은 세계가 된다. 베껴 두면 반드시 갈라진다.
   다시 만들기: node tools/build-rules.mjs */
// @ts-nocheck
import './shim';   // localStorage·location — 아래 규칙들이 딛고 서는 바닥

function __build(): any {

`;
const tail = `\n\nreturn {\n  ${names.join(',\n  ')},\n};\n}\n\nconst __rules: any = __build();\nexport const {\n  ${names.join(',\n  ')},\n} = __rules;\n`;

writeFileSync(OUT, head + body + tail);
console.log(`[NULL] app/lib/rules.ts — 규칙 ${names.length}개, ${(head + body + tail).length}자`);
