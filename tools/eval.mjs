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

   ── 무엇으로 나누나 ──
   「100발화 줄당」은 **줄바꿈을 적게 하는 모델이 유리해진다.** 한 턴에 네 줄을
   쓰는 모델과 두 줄을 쓰는 모델이 같은 실수를 하면 줄당 수치는 두 배 차이가
   난다. 그래서 사건과 턴으로 나눈다 — 선물 사건당, 응답 턴당, 방별로.

   ── 눈은 워커와 다르다 ──
   전에는 워커의 isLeak/isMeta를 가져다 썼다. 그러면 워커가 못 보는 것을
   자도 못 본다. 판정은 tools/eval-eye.mjs가 하고, 워커의 눈은 **엇갈림**을
   보는 데만 쓴다 — 자는 보는데 워커가 못 보면 그게 D단계에서 고칠 목록이다.

   기록은 앱의 내보내기 형식을 그대로 읽는다. 원문은 화면에만 뿌리고 어디에도
   저장하지 않는다 — 이 저장소는 공개다. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
/* 자의 눈. worker.js를 안 본다 — 그게 이 파일이 갈라져 있는 이유다. */
import { seesLeak, seesTail, seesHelper, seesUserWrite, seesDenial, seesEcho,
         GHOSTS, LONG_LINE } from './eval-eye.mjs';
/* 워커의 눈. **판정에는 안 쓴다.** 자와 얼마나 엇갈리는지만 본다. */
import { isLeak as workerLeak, isMeta as workerMeta } from '../worker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── 기록 읽기 ──
   [8월 18일 오전 9:06] 이재언: 왔어요.
   [8월 18일 오전 9:06] · 보건실에 갔다

   ── 지문과 시각을 버리지 않는다 ──
   전에는 둘 다 버렸다. 둘 다 재료다.
   지문은 이 판에서 **실제로 일어난 사건**이다 — 선물을 준 자리, 자리를
   드나든 자리가 거기 적혀 있다. 사건당으로 나누려면 이게 있어야 한다.
   시각은 나중에 「밤에 학교 가라고 했나」를 재는 재료다.

   ── 시각은 아직 판정에 안 쓴다 ──
   내보내기가 `fmtDivider(m.ts)`를 쓰고 그 ts는 **현실 epoch**다(app.js:987).
   게임 시계(speedNow)가 아니다. 그래서 지금 시각으로 생활리듬을 재면
   잘못 잰다. 읽어서 들고만 있는다 — 켜는 것은 F단계 뒤다.

   날짜가 없는 줄(`[오전 11:21]`)은 버그가 아니다. fmtDivider가 **오늘이면
   날짜를 뺀다**(app-data.js:357). 내보낸 날이 그 날짜다. */
const HEAD = /^────\s*(.+?)\s*────$/;
const ROW = /^\[([^\]]+)\]\s*(.*)$/;
const TS = /^(?:(\d+)월\s*(\d+)일\s*)?(오전|오후)\s*(\d+):(\d+)$/;

/* 방 이름과 코드의 열쇠를 맞춘다. 「고친 말」 절은 방이 아니다 —
   내보내기가 대화 앞에 끼워 넣는 별도 절이라 방으로 세면 안 된다. */
const ROOM_KEY = { '이재언': 'jaeeon', '이민현': 'minhyun', '단톡방': 'group', '두 사람': 'health' };

function readLog(path) {
  const rows = [];
  const src = readFileSync(path, 'utf8').split('\n');
  /* 머리의 「내보낸 시각」이 날짜 없는 줄의 날짜다 */
  const head = (src[1] || '').match(/내보낸 시각:\s*(\d+)\.\s*(\d+)\.\s*(\d+)/);
  const exported = head ? { month: +head[2], day: +head[3] } : null;
  let room = '', roomName = '', inRoom = false;

  for (let n = 0; n < src.length; n++) {
    const raw = src[n];
    const h = raw.match(HEAD);
    if (h) {
      roomName = h[1];
      /* 「고친 말 3개」처럼 방이 아닌 절은 여기서 끊는다 */
      inRoom = Object.prototype.hasOwnProperty.call(ROOM_KEY, roomName);
      room = inRoom ? ROOM_KEY[roomName] : '';
      continue;
    }
    if (!inRoom) continue;
    const m = raw.match(ROW);
    if (!m) continue;

    const at = m[1].trim(), rest = m[2];
    const t = at.match(TS);
    const ts = t ? {
      raw: at,
      month: t[1] ? +t[1] : (exported ? exported.month : null),
      day: t[2] ? +t[2] : (exported ? exported.day : null),
      min: (t[3] === '오후' && +t[4] !== 12 ? +t[4] + 12 : t[3] === '오전' && +t[4] === 12 ? 0 : +t[4]) * 60 + +t[5],
      dated: !!t[1],
    } : { raw: at, month: null, day: null, min: null, dated: false };

    /* 지문 — 이 판에서 실제로 일어난 사건 */
    if (rest.startsWith('· ')) {
      const text = rest.slice(2).trim();
      if (text) rows.push({ kind: 'stage', room, roomName, line: n + 1, ts, who: '', text });
      continue;
    }
    const i = rest.indexOf(': ');
    if (i < 0) continue;
    const who = rest.slice(0, i).trim();
    let text = rest.slice(i + 2).trim();
    /* 사진 말풍선은 「(사진) 」이 붙어 나온다. 그건 대사가 아니라 표시다 */
    const photo = text.startsWith('(사진) ');
    if (photo) text = text.slice(5).trim();
    if (!text && !photo) continue;
    rows.push({ kind: 'say', room, roomName, line: n + 1, ts, who, text, photo });
  }
  return rows;
}

/* 누가 인물이고 누가 유저인가. 이름은 기록마다 다르므로 인물 쪽을 못박고
   나머지를 유저로 본다 — 유저 이름은 사람마다 다르지만 인물은 둘뿐이다. */
const CHARS = ['이재언', '이민현'];
const isChar = w => CHARS.includes(w);

/* ── 사건 ──
   지문에서 뽑는다. 조사 하나로 방향이 갈리므로 순서가 중요하다 —
   「이재언**에게** 받았다」(인물→유저)를 먼저 걸러야 「이재언**이** 받았다」
   (유저→인물)와 안 섞인다. 둘을 뒤집으면 선물 사건 수가 통째로 틀린다. */
const EVENTS = [
  ['item_from_char', /^(이재언|이민현)에게\s+(.+?)(?:을|를)?\s*받았다/, m => ({ who: m[1], item: m[2] })],
  ['gift_to_char',   /^(이재언|이민현)(?:이|가)\s+(.+?)(?:을|를)?\s*받았다/, m => ({ who: m[1], item: m[2] })],
  ['place_in',       /^(?:.*?\s)?(\S+?)에\s+(?:갔다|들렀다|도착했다)/,      m => ({ place: m[1] })],
  ['place_out',      /^(\S+?)에서\s+나왔다/,                                 m => ({ place: m[1] })],
  ['promise',        /^(이재언|이민현)(?:와|과)\s+(\S+?)에\s+가기로\s+했다/,  m => ({ who: m[1], place: m[2] })],
  ['ride',           /차를\s+타고/,                                          () => ({}) ],
];

function eventOf(row) {
  /* 어느 갈래에 맞는지 **전부** 세어둔다. 하나도 안 맞으면(other) 사건
     분모가 조용히 모자라고, 둘 이상 맞으면 순서가 바뀔 때 방향이 뒤집힌다 —
     「이재언에게 받았다」와 「이재언이 받았다」가 그 자리다. 둘 다 보고한다. */
  const fit = EVENTS.filter(([, re]) => re.test(row.text)).map(([k]) => k);
  for (const [kind, re, pick] of EVENTS) {
    const m = row.text.match(re);
    if (m) return { kind, ...pick(m), row, fit };
  }
  return { kind: 'other', row, fit };
}

/* ── 응답 턴 ──
   모델 한 번의 응답이 기록에서 어떤 모양인가. 연속된 인물 발화가 한 턴이다.
   유저 말이나 지문이 끼면 끊는다. 시각이 바뀌어도 끊는다 — 선톡이 이어지면
   유저 말 없이 두 응답이 붙는데, 시각으로 갈리기 때문이다.

   단톡·관전방은 한 응답에 두 사람이 말한다. 화자가 바뀌어도 안 끊는 이유가
   그것이다 — 화자로 끊으면 단톡 한 응답이 네 턴으로 세어진다. */
function turnsOf(rows) {
  const out = [];
  let cur = null;
  for (const r of rows) {
    if (r.kind !== 'say' || !isChar(r.who)) { cur = null; continue; }
    const key = `${r.room}|${r.ts.day}|${r.ts.min}`;
    if (!cur || cur.key !== key) { cur = { key, room: r.room, lines: [] }; out.push(cur); }
    cur.lines.push(r);
  }
  return out;
}

/* ── 골든 데이터 ──
   docs/golden/<기록이름>.tsv. 사람이 눈으로 찾아 줄번호로 박아둔 것.
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

/* ══════════════════════════════════════════════════════════════
   재기 */
function measure(rows) {
  const says = rows.filter(r => r.kind === 'say');
  const said = says.filter(r => isChar(r.who));
  const stages = rows.filter(r => r.kind === 'stage').map(eventOf);
  const turns = turnsOf(rows);

  const hits = [];                       // {line, room, kind, code, text}
  const bump = (kind, r, code) => hits.push(
    { line: r.line, room: r.room, kind, code: code || '', s: `${r.who}: ${r.text}` });

  let prevUser = '';
  for (const r of rows) {
    if (r.kind !== 'say') { prevUser = ''; continue; }
    if (!isChar(r.who)) { prevUser = r.text; continue; }
    const t = r.text;
    const leak = seesLeak(t);
    if (leak) bump('안이 비쳤다', r, leak.code);
    if (seesHelper(t)) bump('상담사 말투', r);
    if (seesTail(t)) bump('금지한 어미', r);
    if (t.length > LONG_LINE) bump('한 줄이 길다', r);
    if (seesUserWrite(t)) bump('유저를 대신 쓴다', r);
    if (seesEcho(t, prevUser)) bump('메아리', r);
  }

  /* ── 주고받은 사건당 부정 ──
     사건 뒤에 그 방에서 오간 인물 발화만 본다. 같은 방의 다음 사건이 오면
     끊는다 — 안 끊으면 뒤 사건의 부정이 앞 사건에 붙는다.

     방향을 지킨다. 유저가 준 것을 없던 일로 만드는 것은 「받은 적 없다」이고,
     인물이 준 것은 「준 적 없다」다. 섞으면 엉뚱한 말이 세어진다. */
  const swaps = stages.filter(e => e.kind === 'gift_to_char' || e.kind === 'item_from_char');
  const gifts = swaps.filter(e => e.kind === 'gift_to_char');
  const denials = [];
  for (const g of swaps) {
    const dir = g.kind === 'gift_to_char' ? 'to_char' : 'from_char';
    const next = swaps.find(x => x.row.room === g.row.room && x.row.line > g.row.line);
    for (const r of said) {
      if (r.room !== g.row.room || r.line <= g.row.line) continue;
      if (next && r.line > next.row.line) break;
      const d = seesDenial(r.text, g.item, dir);
      if (d) denials.push({ event: g, dir, line: r.line, code: d.code, s: `${r.who}: ${r.text}` });
    }
  }

  /* ── 방별 분모 ── */
  const byRoom = {};
  for (const r of said) {
    const b = byRoom[r.room] || (byRoom[r.room] = { name: r.roomName, says: 0, turns: 0, hits: 0, chars: 0 });
    b.says++; b.chars += r.text.length;
  }
  for (const t of turns) if (byRoom[t.room]) byRoom[t.room].turns++;
  for (const h of hits) if (byRoom[h.room]) byRoom[h.room].hits++;

  /* 오류가 든 턴의 비율. 「줄당」과 달리 줄을 잘게 쪼개도 유리해지지 않는다 */
  const badLines = new Set(hits.map(h => h.line));
  const badTurns = turns.filter(t => t.lines.some(l => badLines.has(l.line)));

  /* 인물별 — 이름을 떼고도 누군지 알아야 한다. 여기서는 잴 수 있는 것만 */
  const byChar = {};
  for (const c of CHARS) {
    const mine = said.filter(r => r.who === c);
    if (!mine.length) continue;
    const seen = new Map();
    for (const r of mine) {
      const k = r.text.replace(/[^가-힣]/g, '');
      if (k.length < 4) continue;
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    byChar[c] = {
      says: mine.length,
      avg: Math.round(mine.reduce((a, r) => a + r.text.length, 0) / mine.length),
      dup: [...seen.entries()].filter(([, v]) => v > 1).map(([k, v]) => `${k} ×${v}`),
    };
  }

  const all = said.map(r => r.text).join('\n');
  const ghosts = GHOSTS.filter(g => all.includes(g));

  /* ── 엇갈림 ──
     자는 보는데 워커는 못 보는 줄. 이게 D단계에서 고칠 목록이다.
     반대(워커는 보는데 자는 못 봄)도 센다 — 그건 자를 고칠 목록이다. */
  const gap = { eyeOnly: [], workerOnly: [] };
  for (const r of said) {
    const eye = !!seesLeak(r.text);
    const wk = workerLeak(r.text) || workerMeta(r.text);
    if (eye && !wk) gap.eyeOnly.push({ line: r.line, s: `${r.who}: ${r.text}` });
    if (wk && !eye) gap.workerOnly.push({ line: r.line, s: `${r.who}: ${r.text}` });
  }

  return { says: says.length, said: said.length, turns, stages, gifts, swaps, denials,
           hits, byRoom, byChar, ghosts, gap,
           badTurnRate: turns.length ? badTurns.length / turns.length : 0,
           badTurns: badTurns.length };
}

/* ══════════════════════════════════════════════════════════════
   보고 */
const cut = (s, n) => String(s).length > n ? String(s).slice(0, n) + '…' : String(s);

function report(name, M) {
  console.log(`\n──── ${name}`);
  console.log(`  인물 발화 ${M.said}줄 · 응답 턴 ${M.turns.length} · 지문 ${M.stages.length}`);
  /* 지문이 사건이다. 안 읽히는 지문이 있으면 사건 분모가 조용히 틀린다 */
  const ek = {};
  for (const e of M.stages) ek[e.kind] = (ek[e.kind] || 0) + 1;
  console.log('  사건 — ' + Object.entries(ek).map(([k, v]) => `${k} ${v}`).join(' · '));
  const unread = M.stages.filter(e => e.kind === 'other');
  const twice = M.stages.filter(e => (e.fit || []).length > 1);
  console.log(`  지문 분류 — 미분류 ${unread.length} · 중복 ${twice.length}`
    + (unread.length || twice.length ? '   ← 0이 아니면 사건 분모를 믿지 마라' : ''));
  unread.forEach(e => console.log(`      ✗ 못 읽은 지문 ${e.row.line}줄 — ${cut(e.row.text, 60)}`));
  twice.forEach(e => console.log(`      ✗ 두 갈래에 걸린다 ${e.row.line}줄 [${e.fit.join(', ')}] ${cut(e.row.text, 50)}`));

  /* ── 분모를 먼저 적는다 ──
     수치보다 분모가 먼저다. 무엇으로 나눴는지 모르면 수치는 아무 말도 아니다. */
  console.log('  방별 —');
  for (const [k, b] of Object.entries(M.byRoom))
    console.log(`    ${b.name}(${k}) · 발화 ${b.says} · 턴 ${b.turns} · 걸린 것 ${b.hits}`
      + ` · 평균 ${Math.round(b.chars / b.says)}자`);

  const kinds = {};
  for (const h of M.hits) (kinds[h.kind] = kinds[h.kind] || []).push(h);
  for (const [k, v] of Object.entries(kinds)) {
    const codes = [...new Set(v.map(x => x.code).filter(Boolean))];
    console.log(`  ✗ ${k} — ${v.length}건${codes.length ? ` (${codes.join(', ')})` : ''}`);
    v.slice(0, 3).forEach(x => console.log(`      ${x.line}줄 ${cut(x.s, 80)}`));
    if (v.length > 3) console.log(`      … 그 외 ${v.length - 3}건`);
  }
  if (!M.hits.length) console.log('  ✓ 걸린 것 없음');

  /* ── 사건당 ── */
  /* 사건당으로 나눈다. 줄당으로 나누면 선물을 적게 주는 판이 유리해진다 */
  console.log(`  주고받은 사건 ${M.swaps.length}건 (유저→인물 ${M.gifts.length})`
    + ` — 부정 ${M.denials.length}건`
    + (M.swaps.length ? ` (사건당 ${(M.denials.length / M.swaps.length).toFixed(2)})` : ''));
  M.denials.slice(0, 3).forEach(d =>
    console.log(`      ${d.line}줄 [${d.code}] ${cut(d.s, 70)}`));
  console.log(`  응답 턴 ${M.turns.length} — 오류 든 턴 ${M.badTurns}`
    + ` (${(M.badTurnRate * 100).toFixed(1)}%)`);

  for (const [c, b] of Object.entries(M.byChar)) {
    console.log(`  · ${c} — 말수 ${b.says} · 평균 ${b.avg}자`
      + (b.dup.length ? ` · 같은 말 반복 ${b.dup.length}건` : ''));
  }
  if (M.ghosts.length) console.log(`  ✗ 옛 정사가 남았다 — ${M.ghosts.join(', ')}`);

  /* ── 엇갈림 ──
     자와 워커가 다른 눈이라는 것이 여기서 눈에 보인다. */
  console.log(`  엇갈림 — 자만 봄 ${M.gap.eyeOnly.length} · 워커만 봄 ${M.gap.workerOnly.length}`);
  M.gap.eyeOnly.slice(0, 5).forEach(x =>
    console.log(`      ▶ 워커가 못 잡는다(D단계) ${x.line}줄 ${cut(x.s, 70)}`));
  M.gap.workerOnly.slice(0, 5).forEach(x =>
    console.log(`      ◀ 자가 못 잡는다 ${x.line}줄 ${cut(x.s, 70)}`));

  return M.hits.length;
}

/* ── 자를 먼저 잰다 ──
   자를 고치면 숫자는 언제나 좋아진다. 그게 실제 개선인지 자가 눈이 먼
   것인지는 사람이 찾아둔 것과 맞춰봐야 안다. 새 수치를 내기 전에 이걸
   먼저 돌린다 — 순서가 반대면 오탐끼리 비교한 숫자를 개선이라고 적게 된다. */
function scoreGolden(name, M, gold) {
  console.log(`\n──── ${name} ── 골든 대비 (${gold.rows.length}건, 갈래 ${[...gold.kinds].join('·')})`);
  const caught = new Set(M.hits.filter(h => gold.kinds.has(h.kind)).map(h => h.line));
  const want = gold.rows.filter(r => gold.kinds.has(r.kind));
  const wantLines = new Set(want.map(r => r.line));
  const missed = want.filter(r => !caught.has(r.line));
  const extra = [...caught].filter(n => !wantLines.has(n));

  const pct = want.length ? Math.round((want.length - missed.length) / want.length * 100) : 0;
  console.log(`  재현율 ${want.length - missed.length}/${want.length} (${pct}%)`);
  console.log(`  오탐   ${extra.length}건`);
  missed.forEach(r => console.log(`  ✗ 놓쳤다 ${r.line}줄 — ${cut(r.excerpt, 70)}`));
  extra.forEach(n => console.log(`  ✗ 없는 것을 잡았다 ${n}줄`));
  if (!missed.length && !extra.length) console.log('  ✓ 사람이 찾은 것과 같다');
  return { want: want.length, missed: missed.length, extra: extra.length };
}

/* ── 오탐 시험대 ──
   작가가 쓴 문구집은 전부 정답이다. 여기서 하나라도 걸리면 그건 자가 틀린
   것이지 대사가 틀린 것이 아니다. 규칙을 넓힐 때마다 여기를 먼저 본다 —
   골든은 「잡아야 할 것」을 재고 이건 「잡으면 안 되는 것」을 잰다. */
/* ── 정상 반례 ──
   적대 검증이 지어낸 「아직 안 쓰였지만 실제로 나올 만한 정상 대사」를
   파일로 박아뒀다. 문구집만으로는 **없는 것을 안 잡는다**까지만 알 수 있다.
   여기 한 줄이라도 걸리면 대사가 아니라 자가 틀린 것이다. */
function normalLines() {
  const p = join(ROOT, 'docs/golden/_normal.tsv');
  if (!existsSync(p)) return [];
  const out = [];
  for (const [i, raw] of readFileSync(p, 'utf8').split('\n').entries()) {
    if (!raw.trim() || raw.startsWith('#')) continue;
    const [kind, text, why] = raw.split('\t');
    if (!kind || !text) continue;
    out.push({ line: i + 1, kind: kind.trim(), t: text.trim(), why: (why || '').trim() });
  }
  return out;
}

const CORPUS_LINE = /^　(재언|민현|둘|해설)\s*—\s*(.+?)\\?$/;
function corpusFalsePositives() {
  const p = join(ROOT, 'docs/dialogue-corpus.md');
  if (!existsSync(p)) return null;
  const bad = [];
  let n = 0;
  const extra = normalLines();
  for (const x of extra) {
    const leak = seesLeak(x.t);
    if (leak) bad.push({ line: `반례 ${x.line}`, code: leak.code, why: leak.why, t: x.t });
    else if (seesTail(x.t)) bad.push({ line: `반례 ${x.line}`, code: 'BANNED_TAIL', t: x.t });
    else if (seesHelper(x.t)) bad.push({ line: `반례 ${x.line}`, code: 'HELPER', t: x.t });
    else if (seesUserWrite(x.t)) bad.push({ line: `반례 ${x.line}`, code: 'USER_WRITE', t: x.t });
  }
  n += extra.length;
  for (const [i, raw] of readFileSync(p, 'utf8').split('\n').entries()) {
    const m = raw.match(CORPUS_LINE);
    if (!m) continue;
    n++;
    const t = m[2];
    const leak = seesLeak(t);
    if (leak) bad.push({ line: i + 1, code: leak.code, why: leak.why, t });
    else if (seesTail(t)) bad.push({ line: i + 1, code: 'BANNED_TAIL', why: '전언 어미', t });
    else if (seesHelper(t)) bad.push({ line: i + 1, code: 'HELPER', why: '상담사 말투', t });
    else if (seesUserWrite(t)) bad.push({ line: i + 1, code: 'USER_WRITE', why: '유저를 대신 씀', t });
  }
  return { n, bad };
}

/* ══════════════════════════════════════════════════════════════ */
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

/* 오탐 시험대를 제일 먼저 돌린다. 자가 멀쩡한 대사를 잡고 있으면
   그 아래 수치는 전부 못 믿는다. */
const fp = corpusFalsePositives();
if (fp) {
  console.log(`\n──── 오탐 시험대 — 작가 문구집 + 적대 반례 ${fp.n}줄`);
  if (!fp.bad.length) console.log('  ✓ 0건. 자가 멀쩡한 대사를 안 잡는다');
  else {
    console.log(`  ✗ ${fp.bad.length}건 — 아래 수치를 믿지 마라`);
    fp.bad.slice(0, 10).forEach(b => console.log(`      ${b.line}줄 [${b.code}] ${cut(b.t, 70)}`));
  }
}

let total = 0, said = 0, turns = 0;
const scores = [];
for (const f of files) {
  const rows = readLog(f);
  if (!rows.length) { console.log(`\n──── ${basename(f)} ── 읽을 줄이 없다`); continue; }
  const M = measure(rows);
  total += report(basename(f), M);
  said += M.said; turns += M.turns.length;
  const gold = readGolden(f);
  if (gold) scores.push(scoreGolden(basename(f), M, gold));
}

console.log(`\n합계 — 인물 발화 ${said}줄 · 응답 턴 ${turns} · 걸린 것 ${total}건`);
if (turns) console.log(`  턴당 ${(total / turns).toFixed(2)}건`);
if (said) console.log(`  (참고) 100줄당 ${(total / said * 100).toFixed(1)}건`
  + ' — 줄을 잘게 쪼개는 모델이 유리해지는 자다. 비교에는 턴당을 쓴다.');

if (scores.length) {
  const w = scores.reduce((a, s) => a + s.want, 0);
  const m = scores.reduce((a, s) => a + s.missed, 0);
  const e = scores.reduce((a, s) => a + s.extra, 0);
  console.log(`골든 — 재현율 ${w - m}/${w} · 오탐 ${e}건`);
  if (m || e) console.log('  ↑ 이 숫자가 0이 아니면 위 수치를 개선 근거로 쓰지 않는다.');
} else {
  console.log('골든 — 맞춰볼 것이 없다 (docs/golden/<기록이름>.tsv)');
}

console.log('\n이 자는 명백한 것만 센다. 「설레는가」와 「누군지 구별되는가」는');
console.log('사람이 읽어야 하고, 이 자는 그 읽기 전에 걸러내는 자다.');
console.log('아직 안 재는 것: 기억 공개 사건당 정사 부정 · 중요 장면당 올바른 라우팅.');
console.log('  텍스트 내보내기에는 장면 갈래도 라우팅 결과도 안 실린다 — G3의 trace JSON 몫이다.');
console.log('  시각 어긋남도 아직이다: 내보내기 시각이 게임 시계가 아니라 현실 시각이다(F단계 뒤).');
