#!/usr/bin/env node
/* 대사 품질을 재는 자 — 오프라인.
   node tools/eval.mjs [기록파일...]

   ── 왜 만드나 ──
   「좋아졌다」는 말은 검증이 안 된다. 모델을 바꾸든 프롬프트를 고치든,
   나아졌는지 나빠졌는지를 같은 자로 재야 안다.

   ── 무엇으로 재지 않나 ──
   위 모델과 비교해서 통과 여부를 정하지 않는다. 그건 「비싼 쪽이 정답」이라는
   말이고, 이 게임에서는 틀렸다 — 일반 챗봇의 친절함·도움·상세함이 여기서는
   나쁜 대사다. 그래서 기준은 바깥이 아니라 이 작품 안에 있다.

   ── 무엇을 재나 ──
   프롬프트가 하지 말라고 적어둔 것들이 실제로 안 나오는지를 센다. 코드가
   확실히 아는 것만 센다 — 「설레는가」는 여기서 안 잰다. 그건 사람이 읽어야
   하고, 이 자는 그 읽기 전에 명백한 것을 걸러내는 자다.

   기록은 앱의 내보내기 형식을 그대로 읽는다. 원문은 화면에만 뿌리고 어디에도
   저장하지 않는다 — 이 저장소는 공개다. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── 기록 읽기 ──
   [8월 18일 오전 9:06] 이재언: 왔어요.
   지문(· 보건실에 갔다)과 유저 말은 화자로 안 센다. */
const LINE = /^\[[^\]]+\]\s*(?:·\s*)?(.*)$/;
function readLog(path) {
  const out = [];
  let room = '';
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const head = raw.match(/^────\s*(.+?)\s*────$/);
    if (head) { room = head[1]; continue; }
    const m = raw.match(LINE);
    if (!m) continue;
    const body = m[1];
    if (!body || raw.includes('] · ')) continue;          // 지문
    const i = body.indexOf(': ');
    if (i < 0) continue;
    const who = body.slice(0, i).trim();
    const text = body.slice(i + 2).trim();
    if (!text) continue;
    out.push({ room, who, text });
  }
  return out;
}

/* 누가 인물이고 누가 유저인가. 이름은 기록마다 다르므로 인물 쪽을 못박고
   나머지를 유저로 본다 — 유저 이름은 사람마다 다르지만 인물은 둘뿐이다. */
const CHARS = ['이재언', '이민현'];
const isChar = w => CHARS.includes(w);

/* ── 자 ──
   하나하나가 프롬프트에 「하지 마라」로 적혀 있는 것들이다.
   여기서 세는 것은 위반 횟수다. 낮을수록 좋다. */
const HELPER_WORDS = ['도움이 되', '정리해 드리', '정리하자면', '다음과 같', '말씀해 주시',
  '괜찮으시다면', '어떠신가요', '제안드', '추천드', '함께 알아', '어떠세요?'];
/* 인물이 안 쓰기로 한 어미 */
const BANNED_TAIL = /(대요|래요)\.$/;

function measure(lines) {
  const said = lines.filter(l => isChar(l.who));
  const n = said.length || 1;
  const hit = { turns: said.length };
  const bump = (k, l) => { (hit[k] = hit[k] || []).push(l.who + ': ' + l.text); };

  /* 매번 질문으로 끝내지 않는다 */
  let q = 0;
  /* 상담사·비서 말투 */
  /* 유저 문장을 어미만 바꿔 되돌리는 메아리 */
  /* 유저의 행동·감정을 대신 써주기 */
  const USER_WRITE = /(?:당신|선생님|너)(?:은|는|이|가)?\s*[^.!?]{0,12}(?:했잖|했을 거|하고 싶|힘들|외로|슬프|피곤하죠)/;

  let prevUser = '';
  for (const l of lines) {
    if (!isChar(l.who)) { prevUser = l.text; continue; }
    const t = l.text;
    if (/[?？]\s*$/.test(t.trim())) q++;
    if (HELPER_WORDS.some(w => t.includes(w))) bump('상담사 말투', l);
    if (BANNED_TAIL.test(t)) bump('금지한 어미', l);
    if (t.length > 60) bump('한 줄이 길다', l);
    if (USER_WRITE.test(t)) bump('유저를 대신 쓴다', l);
    /* 메아리 — 유저 문장의 알맹이를 그대로 되돌린 것 */
    if (prevUser && prevUser.length >= 6) {
      const core = prevUser.replace(/[^가-힣]/g, '');
      if (core.length >= 6 && t.replace(/[^가-힣]/g, '').includes(core.slice(0, 6)))
        bump('메아리', l);
    }
  }
  hit['물음표로 끝난 비율'] = Math.round(q / n * 100) + '%';

  /* 같은 말을 다시 하는가. 인물별로 본다 — 두 사람이 같은 말을 하는 것과
     한 사람이 같은 말을 두 번 하는 것은 다른 문제다. */
  for (const c of CHARS) {
    const mine = said.filter(l => l.who === c).map(l => l.text);
    const seen = new Map();
    for (const t of mine) {
      const k = t.replace(/[^가-힣]/g, '');
      if (k.length < 4) continue;
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    const dup = [...seen.entries()].filter(([, v]) => v > 1);
    if (dup.length) hit[`${c} 같은 말 반복`] = dup.map(([k, v]) => `${k} ×${v}`);
  }

  /* 두 사람이 구분되는가. 이름을 떼고도 누군지 알아야 한다.
     여기서는 대신 잴 수 있는 것만 잰다 — 문장 길이와 말끝. */
  for (const c of CHARS) {
    const mine = said.filter(l => l.who === c).map(l => l.text);
    if (!mine.length) continue;
    hit[`${c} 평균 길이`] = Math.round(mine.reduce((a, b) => a + b.length, 0) / mine.length);
    hit[`${c} 말수`] = mine.length;
  }

  /* 옛 정사가 남아 있는가. 첫 만남은 병원 옥상이고 유저는 담배를 안 피웠다 */
  const all = said.map(l => l.text).join('\n');
  const ghosts = ['맞담', '후문에서 만난', '후문 골목에서 처음', '같이 피우'];
  const found = ghosts.filter(g => all.includes(g));
  if (found.length) hit['옛 정사가 남았다'] = found;

  return hit;
}

function report(name, hit) {
  console.log(`\n──── ${name} ── 인물 발화 ${hit.turns}줄`);
  const bad = [];
  for (const [k, v] of Object.entries(hit)) {
    if (k === 'turns') continue;
    if (Array.isArray(v)) {
      bad.push([k, v.length]);
      console.log(`  ✗ ${k} — ${v.length}건`);
      v.slice(0, 3).forEach(x => console.log(`      ${String(x).slice(0, 90)}`));
      if (v.length > 3) console.log(`      … 그 외 ${v.length - 3}건`);
    } else {
      console.log(`  · ${k}: ${v}`);
    }
  }
  if (!bad.length) console.log('  ✓ 걸린 것 없음');
  return bad.reduce((a, [, n]) => a + n, 0);
}

const args = process.argv.slice(2);
const files = args.length ? args : (() => {
  const dir = join(ROOT, 'docs/playlog');
  return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.txt')).map(f => join(dir, f)) : [];
})();

if (!files.length) {
  console.log('잴 기록이 없다. docs/playlog/에 내보낸 파일을 두거나 경로를 인자로 준다.');
  console.log('  node tools/eval.mjs ~/Downloads/NULL_대화기록.txt');
  process.exit(0);
}

let total = 0, turns = 0;
for (const f of files) {
  const lines = readLog(f);
  if (!lines.length) { console.log(`\n──── ${basename(f)} ── 읽을 줄이 없다`); continue; }
  const hit = measure(lines);
  total += report(basename(f), hit);
  turns += hit.turns;
}
console.log(`\n합계 — 인물 발화 ${turns}줄에서 걸린 것 ${total}건`
  + (turns ? ` (100줄당 ${(total / turns * 100).toFixed(1)}건)` : ''));
console.log('\n이 자는 명백한 것만 센다. 「설레는가」와 「누군지 구별되는가」는');
console.log('사람이 읽어야 하고, 이 자는 그 읽기 전에 걸러내는 자다.');
