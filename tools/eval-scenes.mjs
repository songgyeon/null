#!/usr/bin/env node
/* ── 장면 자 + 시계 자 — B단계가 「아직 안 잰다」로 미뤄뒀던 셋을 켠다 ──

   B단계의 텍스트 자(tools/eval.mjs)는 내보내기 원문만 읽는다. 장면 갈래와
   라우팅 결과는 원문에 안 실리므로 거기서는 잴 수 없었다 — G3의 trace JSON이
   생긴 지금, 그 trace를 입력으로 두 지표를 잰다. 시각 어긋남 자도 F(시계
   통일)가 끝났으므로 여기서 켠다.

   ── 무엇을 재나 ──
   ① 기억 공개 사건당 정사 부정 (D1)
      분모: 승인된 memory_reveal 사건 수 (trace의 route.reason)
      분자: 그 사건의 후보에서 Canon 검사가 유효한 fact_id와 함께 보고한
            정사 부정 수. 최종 응답까지 살아남은 것(고른 후보에 붙은 부정)은
            따로 표시한다 — 구조상 0이어야 하고, 0이 아니면 파이프라인이
            부정을 거르지 못한 것이다.
   ② 중요 장면당 올바른 라우팅 (D2)
      분모: 패킷 상태가 승인 조건을 실제로 충족한 중요 장면 수 — 워커와
            같은 함수(approveReason·detectScene)로 다시 판정한다. 텍스트를
            보고 장면을 추측하지 않는다.
      갈래: ok / 승인됐는데 normal로 내려감 / 다른 사유로 감 /
            critical인데 ack가 없거나 다름 / 실패해서 의도적으로 ack 없음
   ③ 시각 어긋남 (D3)
      내보내기 머리·구분선·목록·상단 시계·프롬프트 때 낱말을 전부
      gameAt(ts) 기준 기대값으로 다시 계산해 실제 표기와 비교한다.
      리얼·스피드 모드 둘 다. 저장 ts는 현실 epoch여야 한다 — 번역된
      값을 저장한 흔적(형식 밖 ts)도 센다.

   쓰는 법:
     node tools/eval-scenes.mjs --trace replay-out-golden/trace [--packets test/packets-taste]
     node tools/eval-scenes.mjs --clock <fixture.json>

   trace가 없으면 잴 것이 없다고 말한다 — 지어내지 않는다. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { approveReason, detectScene, lastUserUtterance, lastCharUtterance,
         makeStoryState, STAGES, stageOf, unlockedKeys } from "../worker.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ── trace 읽기 ── */
export function readTraces(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith(".json")).sort()
    .map(f => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }));
}

/* ── ① 기억 공개 사건당 정사 부정 (D1) ── */
export function scoreMemoryReveal(traces) {
  const events = (traces || []).filter(t =>
    t.engine && t.engine.route && t.engine.route.reason === "memory_reveal");
  const rows = [];
  let denials = 0, survived = 0;
  for (const t of events) {
    const notes = (t.engine.criticNotes || [])
      .flatMap(x => (x && x.notes) || [])
      .filter(n => n && n.critic === "canon" && n.fact_id);
    const sel = t.engine.selectedCandidate && t.engine.selectedCandidate.id;
    /* 고른 후보에 붙은 부정 — 정상이라면 사실을 어긴 후보는 마무리 재료에서
       빠지므로 여기 잡히는 것은 파이프라인의 구멍이다 */
    const live = notes.filter(n => n.candidate === sel);
    denials += notes.length;
    survived += live.length;
    rows.push({ label: t.label, denials: notes.length, survived: live.length,
      fact_ids: notes.map(n => n.fact_id) });
  }
  return { events: events.length, denials, survived,
    perEvent: events.length ? denials / events.length : 0, rows };
}

/* ── ② 승인 조건의 재판정 — 워커와 같은 함수로 ──
   평가기가 조건을 제 나름대로 다시 적으면 두 판정이 갈리고, 갈린 것을
   아무도 모른다. 워커가 export한 approveReason·detectScene을 그대로 쓴다. */
export function expectedSceneOf(body) {
  const story = makeStoryState({
    firstContact: (body.story || {}).firstContact,
    jaeeonMemory: (body.story || {}).jaeeonMemory,
    partnerKnown: (body.story || {}).partnerKnown,
    partnerId: body.partner });
  const counts = body.counts || {};
  const days = Math.max(0, Math.floor(Number(body.days) || 0));
  const ctx = { room: body.room,
    mode: body.mode === "auto" ? "auto" : "chat",
    greet: body.greet === true,
    partner: body.partner, days,
    unlocked: unlockedKeys(counts, days),
    story, originPhase: String(body.origin_phase || ""),
    lastUser: lastUserUtterance(Array.isArray(body.history) ? body.history : []),
    lastChar: lastCharUtterance(Array.isArray(body.history) ? body.history : []),
    stageIdx: STAGES.indexOf(stageOf(Number(counts[body.room]) || 0, days)) };
  const reserved = String(body.scene_reason || "").trim();
  if (reserved && ctx.mode === "chat" && approveReason(reserved, ctx))
    return { reason: reserved, reserved: true };
  const d = ctx.mode === "chat" ? detectScene(ctx) : "";
  return d ? { reason: d, reserved: false } : null;
}

/* items: [{label, body, trace}] — body는 보낸 패킷, trace는 그 턴의 기록 */
export function scoreRouting(items) {
  const rows = [];
  for (const it of items || []) {
    const exp = expectedSceneOf(it.body || {});
    if (!exp) continue;                                 // 분모 밖 — 일반 턴
    const route = (it.trace && it.trace.engine && it.trace.engine.route) || {};
    const ack = (it.trace && it.trace.scene_ack) || null;
    let verdict;
    if (it.trace && it.trace.ok === false) verdict = "failed_no_ack";
    else if (route.tier !== "critical") verdict = "approved_but_normal";
    else if (route.reason !== exp.reason) verdict = "wrong_reason";
    else if (exp.reserved && ack !== exp.reason) verdict = "critical_no_ack";
    else verdict = "ok";
    rows.push({ label: it.label, expected: exp.reason, reserved: exp.reserved,
      tier: route.tier || "", actual: route.reason || "", ack, verdict });
  }
  const n = k => rows.filter(r => r.verdict === k).length;
  return { total: rows.length, ok: n("ok"),
    approved_but_normal: n("approved_but_normal"),
    wrong_reason: n("wrong_reason"),
    critical_no_ack: n("critical_no_ack"),
    failed_no_ack: n("failed_no_ack"), rows };
}

/* ── ③ 시계 자 (D3) ──
   화면·내보내기 함수를 규칙 파일에서 그대로 잘라 실행한다 — 여기 복제해
   두면 두 시계가 갈린다. run.mjs의 F 검증과 같은 방식이다. */
export function clockFns() {
  /* 규칙 파일 목록은 여기 적지 않는다 — 적으면 갈라진다. index.html의
     싣는 차례가 곧 의존 차례이므로 거기서 그대로 읽어 잇는다. */
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const files = [...html.matchAll(/src="(scripts\/data\/[^"?]+)/g)].map(m => m[1]);
  if (!files.length) throw new Error("index.html에서 규칙 파일을 못 찾았다");
  const web = files.map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
  return new Function(
    'const localStorage={_v:{},getItem(k){return this._v[k]||null},setItem(k,v){this._v[k]=v}};'
    + web.slice(web.indexOf("const ENROLL_DAYS"), web.indexOf("/* ── 이름이 불린 횟수 ──"))
    + web.slice(web.indexOf("const fmtClock="), web.indexOf("/* ── 계절"))
    + 'return {saveMode,setWorldAt,gameAt,fmtClock,isToday,fmtDivider,fmtListTime,fmtDay,dividerGap,nowClock,timeWord,dayWord};')();
}

/* fixture: { mode:"real"|"speed", anchor?, entries:[{ts, surface, shown}] }
   surface: head | divider | list | clock | prompt
   기대값은 전부 gameAt(ts)에서 다시 계산한다. shown은 실제 표기(사람이
   손으로 계산해 박은 값, 또는 저장·내보내기에서 뽑은 값)다. */
export function scoreClock(fx) {
  const F = clockFns();
  F.saveMode(fx && fx.mode === "speed" ? "speed" : "real");
  if (fx && fx.mode === "speed") F.setWorldAt(Number(fx.anchor) || Date.now());
  const mismatches = [];
  let epochBad = 0, total = 0;
  for (const e of (fx && fx.entries) || []) {
    total++;
    /* 저장 ts는 현실 epoch다. 2000년 이전이거나 지금보다 이틀 넘게 미래면
       번역된 값을 저장했거나 형식이 깨진 것이다.
       ── epoch 위반과 표기 어긋남은 독립된 지표다 ──
       깨진 ts의 표기를 비교하는 것은 무의미하고, 시간대에 따라 우연히
       맞아떨어지기도 한다(예: ts=123은 KST에서 오전 9:00이다) — 그러면
       같은 fixture가 시간대마다 다른 수를 낸다. epoch 위반 항목은 여기서
       세고 표기 비교는 건너뛴다. */
    if (!(e.ts > 946684800000) || e.ts > Date.now() + 48 * 3600 * 1000) { epochBad++; continue; }
    const expect = e.surface === "divider" ? F.fmtDivider(e.ts)
      : e.surface === "list" ? F.fmtListTime(e.ts)
      : e.surface === "clock" ? F.fmtClock(e.ts)
      : e.surface === "head" ? F.gameAt(e.ts).toLocaleString("ko-KR")
      : e.surface === "prompt" ? F.timeWord(F.gameAt(e.ts))
      : null;
    if (expect === null) { mismatches.push({ ...e, expect: "(모르는 surface)" }); continue; }
    if (String(e.shown) !== String(expect)) mismatches.push({ ...e, expect });
  }
  return { total, mismatches: mismatches.length, epochBad, rows: mismatches };
}

/* ══════════════════ CLI ══════════════════ */
const argOf = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};

function main() {
  const traceDir = argOf("trace", "");
  const clockFx = argOf("clock", "");
  if (!traceDir && !clockFx) {
    console.log("잴 것이 없다.");
    console.log("  node tools/eval-scenes.mjs --trace=replay-out-golden/trace [--packets=test/packets-taste]");
    console.log("  node tools/eval-scenes.mjs --clock=<fixture.json>");
    return;
  }
  if (traceDir) {
    const traces = readTraces(resolve(ROOT, traceDir));
    if (!traces.length) { console.log(`trace가 없다 — ${traceDir}`); return; }
    const mem = scoreMemoryReveal(traces);
    console.log(`\n──── 기억 공개 사건당 정사 부정`);
    console.log(`  사건 ${mem.events} · 부정 ${mem.denials} (사건당 ${mem.perEvent.toFixed(2)}) · 최종까지 살아남음 ${mem.survived}`);
    mem.rows.forEach(r => console.log(`    ${r.label} — 부정 ${r.denials}${r.fact_ids.length ? ` (${r.fact_ids.join(", ")})` : ""}${r.survived ? ` · 살아남음 ${r.survived} ← 파이프라인 구멍` : ""}`));
    const packDir = resolve(ROOT, argOf("packets", "test/packets-taste"));
    if (existsSync(packDir)) {
      const items = [];
      for (const t of traces) {
        const hit = readdirSync(packDir).find(f => t.label && f.includes(t.label));
        if (!hit) continue;
        const pkt = JSON.parse(readFileSync(join(packDir, hit), "utf8"));
        items.push({ label: t.label, body: pkt.body, trace: t });
      }
      const rt = scoreRouting(items);
      console.log(`\n──── 중요 장면당 올바른 라우팅`);
      console.log(`  분모 ${rt.total} · ok ${rt.ok} · normal로 내려감 ${rt.approved_but_normal}`
        + ` · 다른 사유 ${rt.wrong_reason} · ack 없음/다름 ${rt.critical_no_ack} · 실패(의도적 미ack) ${rt.failed_no_ack}`);
      rt.rows.forEach(r => console.log(`    ${r.label} — 기대 ${r.expected}(${r.reserved ? "예약" : "감지"}) → ${r.tier}/${r.actual || "-"} · ack ${r.ack || "-"} · ${r.verdict}`));
    }
  }
  if (clockFx) {
    const fx = JSON.parse(readFileSync(resolve(ROOT, clockFx), "utf8"));
    const r = scoreClock(fx);
    console.log(`\n──── 시각 어긋남 (${fx.mode || "real"} 모드)`);
    console.log(`  표기 ${r.total} · 어긋남 ${r.mismatches} · epoch 아님 ${r.epochBad}`);
    r.rows.forEach(x => console.log(`    ${x.surface} ts=${x.ts} — 표기 ${JSON.stringify(x.shown)} ≠ 기대 ${JSON.stringify(x.expect)}`));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
