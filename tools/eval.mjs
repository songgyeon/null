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
/* 판정은 워커 하나다. 정규식을 여기 복사하면 워커가 거른 것과 자가
   센 것이 갈리고, 그러면 「고쳤다」를 확인할 방법이 없어진다. */
import { isLeak, isMeta } from '../worker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── 기록 읽기 ──
   [8월 18일 오전 9:06] 이재언: 왔어요.
   지문(· 보건실에 갔다)과 유저 말은 화자로 안 센다. */
const LINE = /^\[[^\]]+\]\s*(?:·\s*)?(.*)$/;
function readLog(path) {
  const out = [];
  let room = '';
  const src = readFileSync(path, 'utf8').split('\n');
  for (let n = 0; n < src.length; n++) {
    const raw = src[n];
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
    /* 줄번호를 들고 다닌다. 골든 데이터가 줄로 박혀 있어서, 이게 없으면
       「몇 건 잡았다」는 세도 「그 건이 맞나」는 못 센다. */
    out.push({ room, who, text, line: n + 1 });
  }
  return out;
}

/* ── 골든 데이터 ──
   docs/golden/<기록이름>.tsv. 사람이 눈으로 찾아 줄번호로 박아둔 것.
   주석(#)과 빈 줄을 뺀 나머지가 `줄번호 \t 갈래 \t 발췌`다.
   머리의 「이 파일이 완전한 갈래:」 줄이, 오탐을 말할 수 있는 갈래를 정한다. */
function readGolden(logPath) {
  const p = join(ROOT, 'docs/golden', basename(logPath).replace(/\.txt$/, '') + '.tsv');
  if (!existsSync(p)) return null;
  const rows = [], kinds = new Set();
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const mk = raw.match(/^#\s*이 파일이 완전한 갈래:\s*(.+)$/);
    if (mk) { mk[1].split(/\s*[,·]\s*/).forEach(k => k.trim() && kinds.add(k.trim())); continue; }
    if (!raw.trim() || raw.startsWith('#')) continue;
    const [n, kind, excerpt] = raw.split('\t');
    if (!n || !kind) continue;
    rows.push({ line: Number(n), kind: kind.trim(), excerpt: (excerpt || '').trim() });
  }
  return rows.length ? { path: p, rows, kinds } : null;
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
/* ── 인물이 안 쓰기로 한 어미 ──
   금지한 것은 **전언**이다 — 「간대요」「하래요」처럼 남의 말을 옮기는 어미.
   그런데 `/(대요|래요)\.$/`만 보면 「그래요.」가 걸린다. 「그래요」는 전언이
   아니라 「그렇다」의 활용이고, 이 게임에서 제일 흔한 정상 대사 중 하나다.
   옛 기록 17건 중 7건이 그거였고 새 기록의 유일한 1건도 그거였다 —
   **오탐끼리 비교한 숫자로 「2.7 → 0.8건으로 좋아졌다」고 적었다.**
   그 수치는 폐기한다. 기준선은 여기를 고친 뒤 다시 잡는다.

   두 글자만 보고는 못 가른다. 형태소 분석기 없이 할 수 있는 것은
   「끝이 대요·래요인데 전언이 아닌 낱말」을 빼는 것이다. 목록을 늘리는
   것이 규칙을 넓히는 것보다 안전하다 — 놓치는 것보다 멀쩡한 대사를
   위반으로 세는 쪽이 나쁘다. */
const BANNED_TAIL = /(대요|래요)\.$/;
const TAIL_OK = /(그래요|이래요|저래요|노래요|빨래요|미래요|장래요|기대요|반대요|상대요|절대요|모래요)\.$/;
const bannedTail = t => BANNED_TAIL.test(t) && !TAIL_OK.test(t);

function measure(lines) {
  const said = lines.filter(l => isChar(l.who));
  const n = said.length || 1;
  const hit = { turns: said.length };
  /* 줄번호를 같이 담는다 — 골든 대비 채점이 줄로 맞춰야 하기 때문이다 */
  const bump = (k, l) => {
    (hit[k] = hit[k] || []).push({ line: l.line, s: l.who + ': ' + l.text });
  };

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
    /* 대사가 아닌 것이 말풍선으로 나간 것. 워커가 지금은 거르지만, 옛
       기록에는 그대로 남아 있고 그게 이 자가 재야 하는 것이다. */
    if (isLeak(t)) bump('안이 비쳤다', l);
    else if (isMeta(t)) bump('사고 유출', l);
    if (bannedTail(t)) bump('금지한 어미', l);
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

const shown = x => (x && x.s != null ? x.s : String(x));

function report(name, hit) {
  console.log(`\n──── ${name} ── 인물 발화 ${hit.turns}줄`);
  const bad = [];
  for (const [k, v] of Object.entries(hit)) {
    if (k === 'turns') continue;
    if (Array.isArray(v)) {
      bad.push([k, v.length]);
      console.log(`  ✗ ${k} — ${v.length}건`);
      v.slice(0, 3).forEach(x => console.log(`      ${shown(x).slice(0, 90)}`));
      if (v.length > 3) console.log(`      … 그 외 ${v.length - 3}건`);
    } else {
      console.log(`  · ${k}: ${v}`);
    }
  }
  if (!bad.length) console.log('  ✓ 걸린 것 없음');
  return bad.reduce((a, [, n]) => a + n, 0);
}

/* ── 자를 먼저 잰다 ──
   자를 고치면 숫자는 언제나 좋아진다. 그게 실제 개선인지 자가 눈이 먼
   것인지는 사람이 찾아둔 것과 맞춰봐야 안다. 새 수치를 내기 전에 이걸
   먼저 돌린다 — 순서가 반대면 오탐끼리 비교한 숫자를 개선이라고 적게 된다. */
function scoreGolden(name, hit, gold) {
  console.log(`\n──── ${name} ── 골든 대비 (${gold.rows.length}건, 갈래 ${[...gold.kinds].join('·')})`);
  const caught = new Map();          // 줄번호 → 자가 붙인 갈래들
  for (const [k, v] of Object.entries(hit)) {
    if (!Array.isArray(v)) continue;
    if (!gold.kinds.has(k)) continue;              // 사람이 전수 확인한 갈래만
    for (const x of v) {
      if (!x || x.line == null) continue;
      if (!caught.has(x.line)) caught.set(x.line, new Set());
      caught.get(x.line).add(k);
    }
  }
  const want = gold.rows.filter(r => gold.kinds.has(r.kind));
  const missed = want.filter(r => !caught.has(r.line));
  const wantLines = new Set(want.map(r => r.line));
  const extra = [...caught.keys()].filter(n => !wantLines.has(n));

  const pct = want.length ? Math.round((want.length - missed.length) / want.length * 100) : 0;
  console.log(`  재현율 ${want.length - missed.length}/${want.length} (${pct}%)`);
  console.log(`  오탐   ${extra.length}건`);
  missed.forEach(r => console.log(`  ✗ 놓쳤다 ${r.line}줄 — ${r.excerpt.slice(0, 70)}`));
  extra.forEach(n => console.log(`  ✗ 없는 것을 잡았다 ${n}줄`));
  if (!missed.length && !extra.length) console.log('  ✓ 사람이 찾은 것과 같다');
  return { want: want.length, missed: missed.length, extra: extra.length };
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
const scores = [];
for (const f of files) {
  const lines = readLog(f);
  if (!lines.length) { console.log(`\n──── ${basename(f)} ── 읽을 줄이 없다`); continue; }
  const hit = measure(lines);
  total += report(basename(f), hit);
  turns += hit.turns;
  const gold = readGolden(f);
  if (gold) scores.push(scoreGolden(basename(f), hit, gold));
}
console.log(`\n합계 — 인물 발화 ${turns}줄에서 걸린 것 ${total}건`
  + (turns ? ` (100줄당 ${(total / turns * 100).toFixed(1)}건)` : ''));
if (scores.length) {
  const w = scores.reduce((a, s) => a + s.want, 0);
  const m = scores.reduce((a, s) => a + s.missed, 0);
  const e = scores.reduce((a, s) => a + s.extra, 0);
  console.log(`골든 — 재현율 ${w - m}/${w} · 오탐 ${e}건`);
  if (m || e) console.log('  ↑ 이 숫자가 0이 아니면 위 「100줄당」을 개선 근거로 쓰지 않는다.');
} else {
  console.log('골든 — 맞춰볼 것이 없다 (docs/golden/<기록이름>.tsv)');
}
console.log('\n이 자는 명백한 것만 센다. 「설레는가」와 「누군지 구별되는가」는');
console.log('사람이 읽어야 하고, 이 자는 그 읽기 전에 걸러내는 자다.');
