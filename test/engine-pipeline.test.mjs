#!/usr/bin/env node
/* ── G. 네 갈래 파이프라인 회귀 ──
   가짜 API로 워커를 통째로 굴려서, 네 경로가 계약대로 도는지를 실행으로
   잰다. 모양 핀만으로는 안 된다 — E단계 내내 배운 것이 그것이다.

     hybrid-one     Writer(후보 1) → Director
     hybrid-pair    Writer(후보 2, 한 호출) → Director
     single-sonnet  Sonnet 4.5 Writer 한 호출 — 같은 사실·같은 후처리
     staged         anchor 턴만 single, 중요 장면과 겹치면 기존 경로가 이긴다

   따로 돈다: node test/engine-pipeline.test.mjs
   (test/run.mjs의 1858개와 별개다 — G 계약이 명시한 새 하네스의 자리) */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import worker, * as ENG from "../worker.js";
import * as RP from "../tools/replay.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       실제 ${g}\n       기대 ${w}`); }
};

/* ── 가짜 API — 요청을 다 적어두고, 단계를 프롬프트 문구로 가른다 ── */
const realFetch = globalThis.fetch;
let sent = [];
let ipN = 0;
const flatSys = c => (Array.isArray(c.system) ? c.system : [{ text: c.system }])
  .map(b => b.text || "").join("\n");
const flatMsgs = c => (c.messages || []).map(m => Array.isArray(m.content)
  ? m.content.map(b => b.text || "").join("\n") : m.content).join("\n");
async function run(envExtra, body, replies) {
  sent = [];
  const queue = replies ? replies.slice() : null;
  globalThis.fetch = async (url, init) => {
    const c = JSON.parse(init.body);
    sent.push(c);
    const sys = flatSys(c), msgs = flatMsgs(c);
    let text;
    if (sys.includes("대사를 쓰지 않는다 — 고르기만 한다"))
      text = JSON.stringify({ decision: msgs.includes("후보 B") ? "A" : "ACCEPT", reject_codes: {} });
    else if (sys.includes("너는 이 세계의 사실만 본다") || sys.includes("이 사람이 이 사람다운지만 본다"))
      text = '{"problems":[]}';
    else if (sys.includes("이 장면의 마지막 손이다"))
      text = JSON.stringify({ messages: [{ text: "…그 얘기는 이따가 해요." }] });
    else if (queue && queue.length) text = queue.shift();
    else text = msgs.includes('"candidates"')
      ? JSON.stringify({ candidates: [{ messages: [{ text: "네." }] }, { messages: [{ text: "왜요." }] }] })
      : JSON.stringify({ messages: [{ text: "네." }] });
    return { ok: true, status: 200, headers: { get: () => null },
      json: async () => ({ content: [{ type: "text", text }],
        usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        stop_reason: "end_turn" }),
      text: async () => "" };
  };
  try {
    const res = await worker.fetch(
      new Request("https://x/?k=열쇠", { method: "POST", body: JSON.stringify(body),
        headers: { "CF-Connecting-IP": `9.8.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}` } }),
      { ANTHROPIC_API_KEY: "sk-테스트", ACCESS_KEY: "열쇠", TRACE: "1", ...envExtra });
    return { status: res.status, data: await res.json() };
  } finally { globalThis.fetch = realFetch; }
}
/* 쓰는 쪽 요청(첫 호출)의 전체 프롬프트 — 고정부+이력+가변부 */
const writerReq = () => sent[0];
const stagesOf = d => (d.data.stages || []).map(s => s.stage);

const BASE = {
  mode: "chat", room: "jaeeon", user_name: "연",
  history: [
    { role: "user", content: "퇴근하셨어요?" },
    { role: "assistant", sender: "jaeeon", content: "방금요." },
    { role: "user", content: "저녁은요?" }],
  counts: { jaeeon: 10, minhyun: 4, group: 0, health: 0 },
  days: 2, now: "저녁", day: "화요일", gifts: {},
  story: { firstContact: "explained", jaeeonMemory: "hidden",
           partnerKnown: { jaeeon: false, minhyun: false } },
};
const PROBE = { ...BASE,
  history: [...BASE.history.slice(0, 2),
    { role: "user", content: "선생님 혹시 옛날에 공부방 하셨어요? 저 기억 안 나세요?" }] };

/* ══════════ 1. 경로 형태 — 누가 몇 번, 어느 모델을 부르나 ══════════ */
{
  const one = await run({ CANDIDATE_MODE: "one" }, BASE);
  eq("hybrid-one은 쓰기 하나·고르기 하나다", stagesOf(one), ["writer", "director"]);
  eq("hybrid-one의 쓰는 쪽은 Haiku다", one.data.stages[0].model, "claude-haiku-4-5");
  eq("hybrid-one은 후보를 하나만 청한다", flatMsgs(writerReq()).includes('"candidates"'), false);
  eq("trace가 경로를 적는다", [one.data.trace.engine_mode, one.data.trace.candidate_mode], ["hybrid", "one"]);

  const pair = await run({ CANDIDATE_MODE: "pair" }, BASE);
  eq("hybrid-pair도 호출은 둘이다", stagesOf(pair), ["writer", "director"]);
  eq("hybrid-pair는 한 호출에서 둘을 청한다", flatMsgs(writerReq()).includes('"candidates"'), true);
  eq("pair의 trace", pair.data.trace.candidate_mode, "pair");

  const single = await run({ ENGINE_MODE: "single" }, BASE);
  eq("single은 한 호출이 전부다", stagesOf(single), ["single_writer"]);
  eq("single의 쓰는 쪽은 고정 Sonnet 4.5다", single.data.stages[0].model, "claude-sonnet-4-5-20250929");
  eq("single은 후보를 하나만 청한다", flatMsgs(writerReq()).includes('"candidates"'), false);
  eq("single의 trace", [single.data.trace.engine_mode, single.data.trace.candidate_mode,
    single.data.trace.writer_model, single.data.trace.anchor_reason],
    ["single", "one", "claude-sonnet-4-5-20250929", null]);
  eq("single의 usage도 쓰는 쪽 실측이다", single.data.usage.output_tokens, 10);

  const anchor = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "opening" }, BASE);
  eq("anchor 턴은 anchor_writer로 적힌다", stagesOf(anchor), ["anchor_writer"]);
  eq("anchor의 모델도 고정 Sonnet 4.5다", anchor.data.stages[0].model, "claude-sonnet-4-5-20250929");
  eq("trace에 anchor_reason이 실린다", anchor.data.trace.anchor_reason, "opening");

  /* 캐시는 anchor 조건이 아니다 — 모르는 사유는 조용히 무시된다 */
  const bad = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "cache_miss" }, BASE);
  eq("모르는 anchor 사유는 그냥 single이다", [stagesOf(bad)[0], bad.data.trace.anchor_reason],
    ["single_writer", null]);
  /* ENGINE_MODE 없이 ANCHOR_REASON만 오면 아무 일도 없다 */
  const stray = await run({ ANCHOR_REASON: "opening", CANDIDATE_MODE: "pair" }, BASE);
  eq("single 아닌 경로에서 anchor는 무시된다", stagesOf(stray), ["writer", "director"]);
}

/* ══════════ 2. 같은 세계 — 네 경로의 쓰는 쪽이 같은 프롬프트를 본다 ══════════ */
{
  await run({ CANDIDATE_MODE: "one" }, BASE);
  const oneReq = { sys: flatSys(writerReq()), msgs: flatMsgs(writerReq()) };
  await run({ ENGINE_MODE: "single" }, BASE);
  const singleReq = { sys: flatSys(writerReq()), msgs: flatMsgs(writerReq()) };
  eq("one과 single의 시스템이 같다", oneReq.sys === singleReq.sys, true);
  eq("one과 single의 이력·가변부가 같다", oneReq.msgs === singleReq.msgs, true);
  await run({ ENGINE_MODE: "single", ANCHOR_REASON: "stage_enter" }, BASE);
  eq("anchor도 같은 프롬프트를 본다", flatSys(writerReq()) === oneReq.sys
    && flatMsgs(writerReq()) === oneReq.msgs, true);
  await run({ CANDIDATE_MODE: "pair" }, BASE);
  const pairMsgs = flatMsgs(writerReq());
  eq("pair는 청하는 말만 다르다", pairMsgs.startsWith(oneReq.msgs.slice(0, 200))
    && pairMsgs.replace(oneReq.msgs, "").includes("candidates"), true);
}

/* ══════════ 3. 같은 후처리 — single도 같은 검사줄을 탄다 ══════════ */
{
  /* 허용되지 않은 화자는 single에서도 hard다 — 떨어지면 같은 재시도를 돈다 */
  const r = await run({ ENGINE_MODE: "single" }, BASE, [
    JSON.stringify({ messages: [{ sender: "minhyun", text: "쌤!" }] }),
    JSON.stringify({ messages: [{ text: "먹었어요." }] })]);
  eq("single도 SENDER 검사를 탄다 — 걸리면 재시도", r.data.stages.map(s => [s.stage, s.attempt]),
    [["single_writer", 1], ["single_writer", 2]]);
  eq("재시도가 살린 답이 나간다", r.data.messages.map(m => m.text), ["먹었어요."]);

  /* 계속 떨어지면 각본으로 안 덮는다 — 502 그대로 */
  const dead = await run({ ENGINE_MODE: "single" }, BASE, [
    JSON.stringify({ messages: [{ sender: "minhyun", text: "쌤!" }] }),
    JSON.stringify({ messages: [{ sender: "minhyun", text: "쌤?" }] })]);
  eq("single도 실패를 각본으로 안 메운다", dead.status, 502);

  /* 같은 원문이면 네 경로의 최종 말풍선이 같다 — 후처리가 하나라는 증거 */
  const raw = JSON.stringify({ messages: [{ text: "저기...\n그게, 별일은 아니고요..." }] });
  const a = await run({ CANDIDATE_MODE: "one" }, BASE, [raw]);
  const b = await run({ ENGINE_MODE: "single" }, BASE, [raw]);
  eq("같은 원문이면 최종 말풍선도 같다", a.data.messages, b.data.messages);
  eq("Effect 경로도 같은 하나다", [a.data.effects.length, b.data.effects.length], [0, 0]);
}

/* ══════════ 4. 중요 장면 — single은 한 호출, staged는 기존 경로 ══════════ */
{
  const hyb = await run({ CANDIDATE_MODE: "pair" }, PROBE);
  eq("hybrid의 중요 장면은 쓰기→검사 둘→마무리다", stagesOf(hyb),
    ["writer", "canon", "character", "finalizer"]);
  eq("중요 장면 마무리만 Sonnet이다", hyb.data.stages.map(s => s.model.includes("sonnet")),
    [false, false, false, true]);

  const single = await run({ ENGINE_MODE: "single" }, PROBE);
  eq("순수 single은 중요 장면도 한 호출이다", stagesOf(single), ["single_writer"]);
  eq("single의 라우팅 판정은 같다", single.data.trace.route,
    { tier: "critical", reason: "memory_reveal" });

  /* staged의 anchor가 중요 장면과 겹치면 — anchor를 물리고 기존 경로 */
  const clash = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "opening", CANDIDATE_MODE: "pair" }, PROBE);
  eq("anchor는 중요 장면에 진다", stagesOf(clash), ["writer", "canon", "character", "finalizer"]);
  eq("물린 anchor가 trace에 남는다", [clash.data.trace.anchor_reason, clash.data.trace.anchor_declined],
    [null, "opening"]);
  eq("한 턴에 Sonnet Writer를 추가로 안 산다",
    clash.data.stages.filter(s => s.stage === "anchor_writer" || s.stage === "single_writer").length, 0);
}

/* ══════════ 5. staged의 anchor 판정 — 코드가 정한다 ══════════ */
{
  const D = RP.decideAnchor;
  const body = (over = {}) => ({ mode: "chat", room: "jaeeon", counts: { jaeeon: 10 }, days: 2, ...over });
  eq("첫 두 응답은 opening이다", [D({ responses: 0 }, body(), 0), D({ responses: 1 }, body(), 0)],
    ["opening", "opening"]);
  eq("셋째부터는 아니다", D({ responses: 2 }, body(), 0), null);
  /* rollover는 문장이 아니라 **upto의 전진**이다 — 같은 요약문이어도 upto가
     전진했으면 원문 창이 실제로 밀린 것이고, 문장만 바뀌고 upto가 같으면
     굴림이 아니다 */
  eq("upto가 전진하면 rollover다 — 요약문이 같아도",
    D({ responses: 9, summaryUpto: 100 }, body({ summary: "같은 문장" }), 200), "summary_rollover");
  eq("문장만 바뀌고 upto가 같으면 아니다",
    D({ responses: 9, summaryUpto: 100 }, body({ summary: "바뀐 문장" }), 100), null);
  eq("upto를 모르면 안 쏜다", D({ responses: 9 }, body(), 200), null);
  eq("단계가 오른 직후 한 번이다",
    D({ responses: 9, summaryUpto: 0, stageIdx: 0 },
      body({ counts: { jaeeon: 16 }, days: 4 }), 0), "stage_enter");
  eq("단계가 그대로면 아니다",
    D({ responses: 9, summaryUpto: 0, stageIdx: 0 }, body(), 0), null);
  eq("우선순위는 opening → rollover → stage다",
    [D({ responses: 1, summaryUpto: 0, stageIdx: 0 },
       body({ counts: { jaeeon: 16 }, days: 4 }), 100),
     D({ responses: 9, summaryUpto: 0, stageIdx: 0 },
       body({ counts: { jaeeon: 16 }, days: 4 }), 100)],
    ["opening", "summary_rollover"]);
  /* scene_reason은 선제 차단 사유가 아니다 — 승인 안 된 낡은 예약이 anchor를
     막으면 안 된다. anchor 후보는 워커로 가고, 워커가 실제로 critical로
     승인했을 때만 anchor_declined가 작동한다(아래 워커 테스트) */
  eq("낡은 scene_reason은 anchor를 안 막는다",
    D({ responses: 0 }, body({ scene_reason: "memory_reveal" }), 0), "opening");
  eq("단톡은 대상이 아니다", D({ responses: 0 }, body({ room: "group" }), 0), null);
  eq("관전은 대상이 아니다", [D({ responses: 0 }, body({ room: "health" }), 0),
    D({ responses: 0 }, body({ mode: "auto", room: "health" }), 0)], [null, null]);
  eq("허용된 사유는 셋뿐이다", ENG.ANCHOR_REASONS, ["opening", "summary_rollover", "stage_enter"]);
  eq("캐시류는 사유가 아니다", ["cache_miss", "cache_read", "hour_passed"]
    .some(s => ENG.ANCHOR_REASONS.includes(s)), false);
}

/* ══════════ 5.5 승인이 갈린다 — 낡은 예약은 무시, 진짜 중요 장면만 물린다 ══════════ */
{
  /* 낡은 scene_reason(상태가 안 받쳐줌 — acknowledged인데 memory_reveal 예약)
     은 워커가 승인하지 않는다 → 일반 턴 → anchor가 그대로 선다 */
  const stale = { ...BASE, scene_reason: "memory_reveal",
    story: { ...BASE.story, jaeeonMemory: "acknowledged" } };
  const r1 = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "opening" }, stale);
  eq("승인 안 된 예약은 anchor를 안 물린다",
    [stagesOf(r1), r1.data.trace.anchor_reason, r1.data.trace.route.tier],
    [["anchor_writer"], "opening", "normal"]);
  /* 진짜 중요 장면(워커 감지)만 물린다 — 4절에서 이미 검증, 여기서는 대비만 */
  const r2 = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "opening", CANDIDATE_MODE: "pair" }, PROBE);
  eq("승인된 중요 장면만 물린다", [r2.data.trace.anchor_declined, r2.data.trace.route.tier],
    ["opening", "critical"]);
}

/* ══════════ 6. 설정 표류 — 하네스가 실사용과 같은 창을 본다 ══════════ */
{
  const app = readFileSync(join(ROOT, "app.js"), "utf8");
  const n = re => Number((app.match(re) || [])[1]);
  eq("재생의 원문 창이 클라이언트와 같다", RP.HISTORY_CHARS, n(/const HISTORY_CHARS=(\d+);/));
  eq("요약 문턱도 같다", [RP.SUM_AT, RP.TAIL_KEEP],
    [n(/const SUM_AT=(\d+), TAIL_KEEP=\d+;/), n(/const SUM_AT=\d+, TAIL_KEEP=(\d+);/)]);
  /* buildHistory 복제의 핵심 배선 — sys는 event로, 사진은 문구로, 창은 뒤에서부터 */
  const h = RP.buildHistory([
    { sender: "user", text: "안녕", ts: 1 },
    { sender: "user", sys: true, text: "연이 이재언에게 머그컵을 건넸다", ts: 2 },
    { sender: "jaeeon", text: "잘 쓸게요", photo: "jaeeon-1", ts: 3 }]);
  eq("지문은 event로 간다", h[1].kind, "event");
  eq("사진은 문구가 붙는다", h[2].content, "잘 쓸게요 (사진을 보냈다)");
  eq("역할이 갈린다", h.map(x => x.role), ["user", "user", "assistant"]);

  /* 고정 Sonnet 4.5 — legacy(4.6→5→4.5 폴백)를 재사용하지 않는다 */
  eq("anchor·single의 모델이 고정 Sonnet 4.5다",
    [ENG.ENGINE.anchorWriter.id, ENG.ENGINE.singleWriter.id],
    ["claude-sonnet-4-5-20250929", "claude-sonnet-4-5-20250929"]);
  eq("마무리와 같은 모델, 다른 역할이다",
    ENG.ENGINE.singleWriter.id === ENG.ENGINE.finalizer.id
    && ENG.STAGE_ENGINE.single_writer === "singleWriter"
    && ENG.STAGE_ENGINE.anchor_writer === "anchorWriter", true);
  const rp = readFileSync(join(ROOT, "tools/replay.mjs"), "utf8");
  eq("재생이 legacy를 안 탄다", /ENGINE_MODE:\s*"legacy"/.test(rp), false);
  /* 비용표가 실제 쓰는 모델을 다 안다 — 모르는 모델은 0원으로 새는 구멍이다.
     날짜 접미(-20250929)는 priceFor가 떼고 찾는다 */
  eq("비용표가 네 경로의 모델을 다 안다",
    [ENG.ENGINE.writer.id, ENG.ENGINE.finalizer.id, ENG.ENGINE.singleWriter.id]
      .every(id => RP.usageCost({ model: id, input_tokens: 1000000 }) > 0), true);
  eq("비용은 실측에 단가를 곱한다 — 1h 캐시 쓰기 2배·읽기 0.1배",
    RP.costOf([{ model: "claude-haiku-4-5", input_tokens: 1000000, output_tokens: 1000000,
      cache_creation_input_tokens: 1000000, cache_read_input_tokens: 1000000 }]).toFixed(2),
    (1 + 5 + 2.0 + 0.1).toFixed(2));
}

/* ══════════ 7. 운영 기본은 그대로다 ══════════ */
{
  const prod = await run({}, BASE);           // ENGINE_MODE도 TRACE도 없는 운영 모양
  eq("기본 경로는 pair 그대로다", stagesOf(prod), ["writer", "director"]);
  eq("기본 쓰는 쪽은 Haiku다", prod.data.stages[0].model, "claude-haiku-4-5");
  const noTrace = await run({ TRACE: "" }, BASE);
  eq("TRACE 없이는 trace가 안 실린다 — 운영 응답 불변", "trace" in noTrace.data, false);
}

/* ══════════ 7.5 적대 검증이 잡은 것들 — 재발 방지 ══════════ */
{
  /* 실패한 턴은 anchor를 소진하지 않는다 — 세 사유가 같은 원칙을 탄다.
     그리고 **물린 anchor도 소진되지 않는다** — 중요 장면이 이긴 턴의
     rollover·단계 관찰은 전진하지 않아서 다음 적격 턴에 다시 선다. */
  const mem = RP.newMemory();
  const b1 = { mode: "chat", room: "jaeeon", counts: { jaeeon: 20 }, days: 5 };
  RP.noteTurn(mem, "jaeeon", true, { upto: 100, stageIdx: 1 });
  RP.noteTurn(mem, "jaeeon", true, { upto: 100, stageIdx: 1 });
  eq("upto가 전진하면 anchor가 선다",
    RP.decideAnchor(RP.snapshot(mem, "jaeeon"), b1, 200), "summary_rollover");
  RP.noteTurn(mem, "jaeeon", false, { upto: 200, stageIdx: 1 });   // 그 턴이 502로 죽었다
  eq("실패한 턴은 rollover를 안 소진한다",
    RP.decideAnchor(RP.snapshot(mem, "jaeeon"), b1, 200), "summary_rollover");
  RP.noteTurn(mem, "jaeeon", true, { upto: 200, stageIdx: 1, declined: true });   // 중요 장면이 이겼다
  eq("물린 anchor도 소진되지 않는다",
    RP.decideAnchor(RP.snapshot(mem, "jaeeon"), b1, 200), "summary_rollover");
  RP.noteTurn(mem, "jaeeon", true, { upto: 200, stageIdx: 1 });    // 드디어 anchor가 돌았다
  eq("성공하면 딱 한 번으로 닫힌다",
    RP.decideAnchor(RP.snapshot(mem, "jaeeon"), b1, 200), null);
  const mem2 = RP.newMemory();
  RP.noteTurn(mem2, "jaeeon", false, { upto: 0, stageIdx: 0 });
  eq("실패는 opening도 안 센다", RP.snapshot(mem2, "jaeeon").responses, 0);
  /* 오래된 세이브는 기왕의 응답 수를 선언한다 — 3주째 방에서 opening이 다시 서면 안 된다 */
  const mem3 = RP.newMemory(); mem3.responses.jaeeon = 200;
  eq("씨앗 응답 수가 opening을 막는다", RP.decideAnchor(RP.snapshot(mem3, "jaeeon"), b1, 0), null);

  /* 청한 후보 수와 온 수가 다르면 어느 경로든 스키마 위반이다 — one이 몰래
     pair가 되거나 single이 청하지 않은 후보를 집으면 경로의 정체가 무너진다 */
  const two = JSON.stringify({ candidates: [{ messages: [{ text: "네." }] }, { messages: [{ text: "왜요." }] }] });
  const oneMsg = JSON.stringify({ messages: [{ text: "네." }] });
  const sTwo = await run({ ENGINE_MODE: "single" }, BASE, [two, oneMsg]);
  eq("single에 둘이 오면 스키마 재시도다", sTwo.data.stages.map(s => [s.stage, s.attempt]),
    [["single_writer", 1], ["single_writer", 2]]);
  const oTwo = await run({ CANDIDATE_MODE: "one" }, BASE, [two, two]);
  eq("one에 둘이 계속 오면 502다 — 몰래 pair가 되지 않는다", oTwo.status, 502);
  const pOne = await run({ CANDIDATE_MODE: "pair" }, BASE, [oneMsg, oneMsg]);
  eq("pair에 하나만 계속 오면 502다", pOne.status, 502);

  /* API 오류로 죽은 턴에도 trace가 실린다 — 물린 anchor 집계가 유실되면 안 된다 */
  const err = await (async () => {
    sent = [];
    globalThis.fetch = async () => ({ ok: false, status: 500, headers: { get: () => null },
      json: async () => ({}), text: async () => "서버 오류" });
    try {
      const res = await worker.fetch(
        new Request("https://x/?k=열쇠", { method: "POST", body: JSON.stringify(BASE),
          headers: { "CF-Connecting-IP": `9.8.9.${(ipN++ % 250) + 1}` } }),
        { ANTHROPIC_API_KEY: "sk-테스트", ACCESS_KEY: "열쇠", TRACE: "1",
          ENGINE_MODE: "single", ANCHOR_REASON: "opening" });
      return { status: res.status, data: await res.json() };
    } finally { globalThis.fetch = realFetch; }
  })();
  eq("API 오류 502에도 trace가 실린다", [err.status, err.data.trace.anchor_reason,
    err.data.trace.writer_model, err.data.trace.selectedCandidate],
    [502, "opening", "claude-sonnet-4-5-20250929", null]);

  /* 단가 — 날짜 접미는 떼고 찾고, 요약 폴백 모델도 0원으로 안 샌다 */
  eq("날짜 붙은 id도 단가를 찾는다",
    RP.usageCost({ model: "claude-haiku-4-5-20251001", input_tokens: 1000000 }) > 0
    && RP.usageCost({ model: "claude-sonnet-4-5-20250929", input_tokens: 1000000 }) > 0, true);
  eq("요약 폴백 모델도 단가가 있다",
    ["claude-sonnet-4-6", "claude-sonnet-5", "claude-sonnet-4-5"]
      .every(m => RP.usageCost({ model: m, output_tokens: 1000000 }) > 0), true);
  eq("모르는 모델은 조용히 새지 않고 적힌다", (() => {
    RP.usageCost({ model: "claude-unknown-9", input_tokens: 5 });
    return RP.unknownModels.has("claude-unknown-9");
  })(), true);

  /* 재시도는 라운드 수다 — 경로의 단계 수(1단·2단·4단)에 비례해 부풀면 안 된다 */
  const rt = await run({ ENGINE_MODE: "single" }, BASE, [
    JSON.stringify({ messages: [{ sender: "minhyun", text: "쌤!" }] }),
    JSON.stringify({ messages: [{ text: "먹었어요." }] })]);
  eq("한 번 재시도는 어느 경로에서든 1이다",
    Math.max(...rt.data.stages.map(s => s.attempt)) - 1, 1);

  /* 비용 계약 — 워커의 캐시 TTL과 같은 배율, 지금 단가 */
  const wk = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("캐시 쓰기 배율이 워커 TTL 계약과 같다 — 1h면 2배",
    [/ttl: "1h"/.test(wk), RP.CACHE_WRITE_X], [true, 2.0]);
  eq("Sonnet 5 단가는 $2/$10이다",
    RP.usageCost({ model: "claude-sonnet-5", input_tokens: 1000000, output_tokens: 1000000 }).toFixed(2),
    "12.00");
}

/* ══════════ 7.55 실행 순서 균형 — 뒤에 도는 경로가 캐시를 공짜로 받지 않는다 ══════════ */
{
  eq("회전 0은 원래 순서다", RP.rotated(RP.PATHS, 0), RP.PATHS);
  const N = 42;                      // 지금 fixture의 대화 턴 수
  const count = {};                  // path → 자리별 등장 수
  for (let k = 0; k < N; k++)
    RP.rotated(RP.PATHS, k).forEach((p, pos) => {
      count[p] = count[p] || Array(RP.PATHS.length).fill(0); count[p][pos]++;
    });
  eq("각 경로가 각 자리에 서는 횟수 차는 최대 1이다",
    Object.values(count).every(a => Math.max(...a) - Math.min(...a) <= 1), true);
  eq("자리 합이 맞다", Object.values(count).every(a => a.reduce((x, y) => x + y) === N), true);
}

/* ══════════ 7.57 연속 세션 실행기 — 실패 뒤로 안 간다, 예상 밖 Effect는 invalid ══════════ */
{
  const mini = { label: "T", user_name: "연",
    seed: { msgs: { jaeeon: [{ sender: "jaeeon", text: "새로 오셨죠.", ts: 1000 }] } },
    turns: [
      { room: "jaeeon", text: "안녕하세요", ts: 2000, days: 0, now: "저녁", day: "목요일" },
      { room: "jaeeon", text: "질문이 있어요", ts: 3000, days: 0, now: "저녁", day: "목요일" },
      { room: "jaeeon", text: "이 말은 오면 안 된다", ts: 4000, days: 0, now: "저녁", day: "목요일" },
    ] };
  const okReply = { ok: true, status: 200, latency_ms: 1, data: {
    messages: [{ sender: "jaeeon", text: "네." }], effects: [], stages: [
      { stage: "writer", model: "claude-haiku-4-5", attempt: 1, input_tokens: 10, output_tokens: 5,
        cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }], trace: {} } };
  /* hybrid-one만 #1에서 두 번(원호출+UI 재시도) 다 죽는다 */
  const sent = [];
  const call = async (env, body) => {
    sent.push(JSON.stringify(body));
    if (body.request_id === "rp-B-T-hybrid-one-1")
      return { ok: false, status: 502, latency_ms: 1, data: { error: "생성 실패", stages: [] } };
    return JSON.parse(JSON.stringify(okReply));
  };
  const states = await RP.runSession(mini, ["hybrid-one", "hybrid-pair"], { call, rotBase: 0 });
  const bad = states["hybrid-one"], good = states["hybrid-pair"];
  eq("실패한 세션은 incomplete로 끝난다", [bad.status, bad.stoppedAt], ["incomplete", 1]);
  eq("실패 뒤 다음 유저 턴으로 진행하지 않는다", bad.rows.length, 2);
  eq("실패 뒤 연속 유저 발화가 history에 없다",
    bad.msgs.jaeeon.filter(m => m.sender === "user").map(m => m.text),
    ["안녕하세요", "질문이 있어요"]);
  eq("UI 재시도는 같은 body·같은 이름표다", (() => {
    const tries = sent.filter(s => s.includes("rp-B-T-hybrid-one-1"));
    return tries.length === 2 && tries[0] === tries[1];
  })(), true);
  eq("UI 재시도와 모델 내부 재시도는 따로 센다",
    [bad.rows[1].ui_retries, bad.rows[1].rounds], [1, 0]);
  eq("다른 경로는 끝까지 돈다", [good.status, good.rows.length], ["complete", 3]);

  /* 예상 밖의 UI Effect(초대·물건) — 하네스는 그 창에 답할 수 없다 → invalid */
  const fxCall = async (env, body) => {
    const r = JSON.parse(JSON.stringify(okReply));
    if (body.request_id.endsWith("-0"))
      r.data.effects = [{ id: "e1", type: "invite", place: "편의점", char: "jaeeon" }];
    return r;
  };
  const st2 = await RP.runSession(mini, ["hybrid-one"], { call: fxCall, rotBase: 0 });
  eq("예상 밖 Effect는 세션을 invalid로 끝낸다",
    [st2["hybrid-one"].status, st2["hybrid-one"].rows.length, st2["hybrid-one"].invalidWhy],
    ["invalid", 1, "예상 밖 Effect: invite"]);
}

/* ══════════ 7.57b 동세대 비교 팔 — 4.5 vs 4.6은 자리만 같고 모델만 다르다 ══════════ */
{
  eq("46팔의 env가 모델만 바꾼다", RP.pathEnv("single-sonnet46"),
    { ENGINE_MODE: "single", SONNET_WRITER_MODEL: "claude-sonnet-4-6" });
  eq("staged-46의 anchor 턴도 모델만 다르다", RP.pathEnv("staged-46", "pair", "opening"),
    { CANDIDATE_MODE: "pair", ENGINE_MODE: "single", ANCHOR_REASON: "opening",
      SONNET_WRITER_MODEL: "claude-sonnet-4-6" });
  eq("staged 계열 판별", [RP.isStaged("staged"), RP.isStaged("staged-46"),
    RP.isStaged("single-sonnet46")], [true, true, false]);
  eq("기본 실행은 여전히 넷이다", RP.DEFAULT_PATHS,
    ["hybrid-one", "hybrid-pair", "single-sonnet", "staged"]);
  /* 워커 쪽 — 덮어쓰기는 single/anchor Writer 자리에만 닿는다 */
  const ov = await run({ ENGINE_MODE: "single", SONNET_WRITER_MODEL: "claude-sonnet-4-6" }, BASE);
  eq("덮어쓴 모델로 부른다", [ov.data.stages[0].stage, ov.data.stages[0].model,
    ov.data.trace.writer_model],
    ["single_writer", "claude-sonnet-4-6", "claude-sonnet-4-6"]);
  const plain = await run({ CANDIDATE_MODE: "pair", SONNET_WRITER_MODEL: "claude-sonnet-4-6" }, BASE);
  eq("hybrid의 Writer에는 안 닿는다", plain.data.stages.map(s => s.model),
    ["claude-haiku-4-5", "claude-haiku-4-5"]);
  const badOv = await run({ ENGINE_MODE: "single", SONNET_WRITER_MODEL: "gpt-x" }, BASE);
  eq("Sonnet 계열이 아니면 무시한다", badOv.data.stages[0].model, "claude-sonnet-4-5-20250929");
  const crit = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "opening",
    CANDIDATE_MODE: "pair", SONNET_WRITER_MODEL: "claude-sonnet-4-6" }, PROBE);
  eq("물린 anchor 턴의 마무리는 여전히 4.5다 — 덮어쓰기가 finalizer에 안 닿는다",
    crit.data.stages.map(s => s.model.includes("4-6")), [false, false, false, false]);
}

/* ══════════ 7.58 CLI — 반쯤 도는 것보다 안 도는 게 낫다 ══════════ */
{
  const { execSync } = await import("node:child_process");
  const { mkdtempSync, readdirSync: rd } = await import("node:fs");
  const os = await import("node:os");
  const tmp = mkdtempSync(join(os.tmpdir(), "replay-test-"));
  const sh = args => {
    try {
      execSync(`node tools/replay.mjs ${args}`, { cwd: ROOT, stdio: "pipe", maxBuffer: 64e6 });
      return 0;
    } catch (e) { return e.status || 1; }
  };
  /* 전수 fake 실행 — 측정 단위가 계약과 맞는지 실측으로 */
  const out1 = join(tmp, "run1");
  eq("전수 fake 실행이 성공한다", sh(`--fake --out=${out1}`), 0);
  const report = readFileSync(join(out1, "report.md"), "utf8");
  eq("경로당 대화 턴이 42다 — 요약이 안 섞인다", (() => {
    const rows = report.split("\n").filter(l => /^\| (hybrid|single|staged)/.test(l));
    const chat = rows.slice(0, 4).map(l => Number(l.split("|")[2]));
    return chat.every(n => n === 42);
  })(), true);
  eq("요약 호출은 따로 센다", /## 요약 호출/.test(report), true);
  const traces = rd(join(out1, "trace"));
  /* 요약 trace 이름은 -sum<NN>.json 꼴이다 — 「summary-rollover」 같은 라벨
     문자열에 걸리지 않게 정확한 꼬리로 가른다 */
  const isSum = f => /-sum\d+\.json$/.test(f);
  eq("대화 trace가 네 경로 합계 168개다", traces.filter(f => !isSum(f)).length, 168);
  eq("요약 trace도 따로 남는다", traces.some(isSum), true);
  /* 같은 outDir 재사용 — 이전 trace가 새 보고에 섞이면 안 된다 → 거부 */
  eq("비어 있지 않은 outDir은 거부한다", sh(`--fake --out=${out1}`) !== 0, true);
  /* 모르는 경로는 0턴 성공이 아니라 비정상 종료다 */
  eq("모르는 --paths는 비정상 종료다", sh(`--fake --paths=typo --out=${join(tmp, "run2")}`) !== 0, true);
  eq("중복 --paths도 비정상 종료다",
    sh(`--fake --paths=hybrid-one,one --out=${join(tmp, "run3")}`) !== 0, true);
  eq("없는 packet 디렉터리는 비정상 종료다",
    sh(`--fake --packets=/no/such/dir --out=${join(tmp, "run4")}`) !== 0, true);
}

/* ══════════ 7.6 재생 자료가 실사용 모양이다 — packet·세션 lint ══════════ */
{
  const { readdirSync } = await import("node:fs");
  const load = dir => readdirSync(join(ROOT, dir)).filter(f => f.endsWith(".json"))
    .map(f => [f, JSON.parse(readFileSync(join(ROOT, dir, f), "utf8"))]);
  const TIME = ["새벽", "아침", "낮", "저녁", "밤"];
  const DAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const OPENER = { jaeeon: ["새로 오셨죠.", "애들 때문에 정신 없으시겠네요.", "저한테는 편하게 메세지 주셔도 됩니다."],
                   minhyun: ["선생님.", "저 알죠?", "선생님이 저 책임진다면서요."] };

  const pk = load("test/packets");
  eq("packet의 모든 이력 행에 화자가 있다 — buildHistory 출력형",
    pk.every(([, p]) => (p.body.history || []).every(m => m.sender
      && (m.role !== "user" || m.sender === "user"))), true);
  eq("packet의 때·요일 낱말이 워커 목록에 있다",
    pk.every(([, p]) => (!p.body.now || TIME.includes(p.body.now))
      && (!p.body.day || DAYS.includes(p.body.day))), true);
  /* 첫 선톡은 코드 고정 각본 그대로다 — 지어낸 첫 연락 위에서 opening의
     말맛을 재면 제품이 절대 만들지 않는 입력을 재는 것이 된다 */
  const opens = pk.filter(([f]) => f.startsWith("01-") || f.startsWith("14-"));
  eq("opening packet의 선톡이 각본 세 줄 그대로다", opens.every(([, p]) =>
    p.body.history.slice(0, 3).map(m => m.content).join("|") === OPENER.jaeeon.join("|")), true);

  const ss = load("test/sessions");
  eq("세션 셋이 다 있다", ss.map(([f]) => f),
    ["S1-jaeeon.json", "S2-minhyun.json", "S3-jaeeon-long.json"]);
  const kstDay = ts => DAYS[new Date(ts + 9 * 3600e3).getUTCDay()];
  for (const [f, s] of ss) {
    const room = s.turns[0].room, seed = s.seed.msgs[room];
    const label = f.replace(".json", "");
    eq(`${label}의 선톡이 각본 세 줄 그대로다`,
      seed.slice(0, 3).map(m => m.text), OPENER[room]);
    eq(`${label}의 경과일이 클라이언트 셈과 같다 — floor(경과/24h)`,
      s.turns.every(t => Math.floor((t.ts - seed[0].ts) / 864e5) === t.days), true);
    eq(`${label}의 요일이 ts와 맞는다 (KST)`,
      s.turns.every(t => kstDay(t.ts) === t.day)
      && s.turns.every(t => TIME.includes(t.now)), true);
  }
  /* S3 — 요약 문턱을 세션 **중간**에 실제로 넘는 크기여야 한다 */
  const s3 = ss.find(([f]) => f.startsWith("S3"))[1];
  const total = s3.seed.msgs.jaeeon.reduce((a, m) => a + m.text.length, 0);
  eq("S3 씨앗이 문턱 바로 아래다 (11,000~11,950자)", total >= 11000 && total <= 11950, true);
  eq("S3는 기왕의 응답 수를 선언한다 — opening 재발 방지",
    (s3.seed.responses || {}).jaeeon >= 2, true);
}

/* ══════════ 9. G2 모델 스윕 — 배우만 셋, 나머지는 바이트까지 같다 ══════════ */
{
  const SW = await import("../tools/model-sweep.mjs");
  eq("비교 모델은 셋뿐이고 4.5는 저장소 검증 ID다", (() => {
    SW.validateModels();
    return [SW.SINGLE_SWEEP_MODELS.sonnet45 === ENG.ENGINE.singleWriter.id,
            SW.MODEL_KEYS.length];
  })(), [true, 3]);
  eq("모르는 모델 키는 즉시 던진다", (() => {
    try { SW.sweepEnv("gpt5"); return "안 던짐"; } catch (e) { return "던짐"; }
  })(), "던짐");
  eq("안정성 항목은 계약의 열 개다", SW.STABILITY,
    ["A-03", "A-04", "A-05", "A-06", "A-07", "A-08", "A-10", "A-12", "A-13", "A-14"]);
  eq("스윕 단가가 갈린다 — 5는 $2/$10, 4.5·4.6은 $3/$15",
    [RP.PRICES["claude-sonnet-5"], RP.PRICES["claude-sonnet-4-6"]],
    [{ in: 2.00, out: 10.00 }, { in: 3.00, out: 15.00 }]);

  /* ── 맨몸 payload — 세 모델 모두 model·max_tokens·system·messages 넷뿐 ──
     Sonnet 5가 비기본 샘플링·수동 thinking에 400을 내므로 셋 다 같이 뺀다.
     model 필드만 빼면 프롬프트가 바이트 단위로 같아야 한다. */
  const payloads = {};
  for (const mk of SW.MODEL_KEYS) {
    sent = [];
    globalThis.fetch = async (url, init) => {
      payloads[mk] = JSON.parse(init.body);
      return { ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ content: [{ type: "text", text: JSON.stringify({ messages: [{ text: "네." }] }) }],
          usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: "end_turn" }),
        text: async () => "" };
    };
    try {
      await worker.fetch(new Request("https://x/?k=열쇠", { method: "POST",
        body: JSON.stringify({ ...BASE, request_id: "sweep:test:" + mk + ":r0" }),
        headers: { "CF-Connecting-IP": `9.7.0.${(ipN++ % 250) + 1}` } }),
        { ANTHROPIC_API_KEY: "sk-테스트", ACCESS_KEY: "열쇠", ...SW.sweepEnv(mk) });
    } finally { globalThis.fetch = realFetch; }
  }
  eq("payload 열쇠가 정확히 넷이다 — 샘플링·thinking·effort 없음",
    SW.MODEL_KEYS.map(mk => Object.keys(payloads[mk]).sort().join(",")),
    Array(3).fill("max_tokens,messages,model,system"));
  eq("모델 필드가 요청 그대로다 — 폴백 없음",
    SW.MODEL_KEYS.map(mk => payloads[mk].model),
    ["claude-sonnet-4-5-20250929", "claude-sonnet-4-6", "claude-sonnet-5"]);
  eq("model만 빼면 바이트까지 같다", (() => {
    const strip = p => JSON.stringify({ ...p, model: "X" });
    return strip(payloads.sonnet45) === strip(payloads.sonnet46)
        && strip(payloads.sonnet46) === strip(payloads.sonnet5);
  })(), true);

  /* 같은 후처리 — 스윕 env에서도 SENDER 위반은 재시도로 돈다 */
  const rt = await run(SW.sweepEnv("sonnet5"), BASE, [
    JSON.stringify({ messages: [{ sender: "minhyun", text: "쌤!" }] }),
    JSON.stringify({ messages: [{ text: "먹었어요." }] })]);
  eq("스윕도 같은 hardFilter를 탄다", rt.data.stages.map(s => [s.stage, s.attempt]),
    [["single_writer", 1], ["single_writer", 2]]);
  eq("스윕 trace의 writer_model이 5다", rt.data.trace.writer_model, "claude-sonnet-5");

  /* ── 모델별 상태 격리 — 각 모델의 history에는 자기 답만 있다 ── */
  const mini = { label: "TT", user_name: "연",
    seed: { msgs: { jaeeon: [{ sender: "jaeeon", text: "새로 오셨죠.", ts: 1000 }] } },
    turns: [
      { room: "jaeeon", text: "안녕하세요", ts: 2000, days: 0, now: "저녁", day: "목요일" },
      { room: "jaeeon", text: "두 번째 말", ts: 3000, days: 0, now: "저녁", day: "목요일" },
    ] };
  const tagCall = async (env, body) => ({ ok: true, status: 200, latency_ms: 1, data: {
    messages: [{ sender: "jaeeon", text: "답-" + env.SONNET_WRITER_MODEL }],
    effects: [], stages: [{ stage: "single_writer", model: env.SONNET_WRITER_MODEL,
      attempt: 1, input_tokens: 1, output_tokens: 1,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }], trace: {} } });
  const iso = await RP.runSession(mini, SW.MODEL_KEYS, { call: tagCall, rotBase: 0,
    envFor: mk => SW.sweepEnv(mk) });
  eq("모델별 history가 안 섞인다", SW.MODEL_KEYS.map(mk => {
    const replies = iso[mk].msgs.jaeeon.filter(m => m.sender === "jaeeon" && m.text.startsWith("답-"));
    return replies.length === 2 && replies.every(m => m.text === "답-" + SW.SINGLE_SWEEP_MODELS[mk]);
  }), [true, true, true]);

  /* ── fake 전수 실행 — 실험량·회전·블라인드·키를 실측으로 ── */
  const { execSync } = await import("node:child_process");
  const { mkdtempSync, readdirSync: rd } = await import("node:fs");
  const os = await import("node:os");
  const tmp = mkdtempSync(join(os.tmpdir(), "sweep-test-"));
  const sh = args => {
    try { execSync(`node tools/model-sweep.mjs ${args}`, { cwd: ROOT, stdio: "pipe", maxBuffer: 64e6 }); return 0; }
    catch (e) { return e.status || 1; }
  };
  const out1 = join(tmp, "run1");
  eq("fake 전수 스윕이 성공한다", sh(`--fake --out=${out1}`), 0);
  const man = JSON.parse(readFileSync(join(out1, "manifest.json"), "utf8"));
  eq("실험량 — 기본 126 + 안정성 60 = 186", [man.planned, man.executed.chat],
    [{ base: 126, stability: 60, total: 186 }, 186]);
  eq("회전이 계약 순서다", man.order.slice(0, 3).map(u => u.order.join(">")),
    ["sonnet45>sonnet46>sonnet5", "sonnet46>sonnet5>sonnet45", "sonnet5>sonnet45>sonnet46"]);
  const traces = rd(join(out1, "trace"));
  const isSum = f => /-sum\d+\.json$/.test(f);
  eq("chat trace가 186개다", traces.filter(f => !isSum(f)).length, 186);
  eq("모델별 62개씩이다", SW.MODEL_KEYS.map(mk =>
    traces.filter(f => !isSum(f) && f.includes(`-${mk}-`)).length), [62, 62, 62]);
  const key2 = JSON.parse(readFileSync(join(out1, "blind-key.json"), "utf8"));
  eq("blind-key가 27항목 × 3 = 81짝이다", Object.keys(key2).length, 81);
  eq("항목마다 세 이름표가 세 모델의 순열이다", (() => {
    const items = {};
    for (const [kk, v] of Object.entries(key2)) {
      const [item] = kk.split("/"); (items[item] = items[item] || []).push(v);
    }
    return Object.values(items).every(v => v.slice().sort().join(",") === SW.MODEL_KEYS.slice().sort().join(","));
  })(), true);
  eq("안정성 파일이 이름표당 sample 셋이다", (() => {
    const f = readFileSync(join(out1, "blind-stability", "S-A-03-jaeeon-summary-rollover.md"), "utf8");
    return (f.match(/- sample \d+:/g) || []).length === 9
        && (f.match(/^## /gm) || []).length === 3;
  })(), true);
  /* 블라인드에 모델·usage·지연·경로 흔적이 없다 */
  eq("블라인드가 깨끗하다", (() => {
    const bad = /sonnet|claude|4-5|4-6|usage|latency|writer|single|staged|hybrid|token|ms\b/i;
    for (const d of ["blind", "blind-stability"])
      for (const f of rd(join(out1, d)))
        if (bad.test(readFileSync(join(out1, d, f), "utf8"))) return f;
    return "깨끗";
  })(), "깨끗");
  eq("스윕도 비어 있지 않은 outDir을 거부한다", sh(`--fake --out=${out1}`) !== 0, true);
  eq("스윕 산출물이 gitignore에 있다",
    /replay-model-out\*?\//.test(readFileSync(join(ROOT, ".gitignore"), "utf8")), true);
}

/* ══════════ 8. 블라인드 섞기 — 결정적이고, 자리로 못 맞힌다 ══════════ */
{
  const a = RP.shuffled(["hybrid-one", "hybrid-pair", "single-sonnet", "staged"], "7-item1");
  const b = RP.shuffled(["hybrid-one", "hybrid-pair", "single-sonnet", "staged"], "7-item1");
  eq("같은 씨앗이면 같은 순서다", a, b);
  eq("원소는 그대로다", a.slice().sort(), ["hybrid-one", "hybrid-pair", "single-sonnet", "staged"]);
}

/* ══════════ 10. G3 — sonnet5-pair-haiku 경로 ══════════
   Sonnet 5가 한 호출로 후보 A·B → 후보별 코드 검사 → Haiku Director 선택 →
   못 고르는 모든 갈래에서 Sonnet 4.5 한 번 폴백. 가짜 API 파이프라인으로
   계약의 표적 열 가지를 실측한다. */
{
  const S5 = { ENGINE_MODE: "sonnet5-pair-haiku" };
  const okBody = (text, model) => ({ ok: true, status: 200, headers: { get: () => null },
    json: async () => ({ content: [{ type: "text", text }],
      usage: { model, input_tokens: 100, output_tokens: 10,
               cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      stop_reason: "end_turn" }),
    text: async () => "" });
  const errBody = status => ({ ok: false, status, headers: { get: () => null },
    text: async () => "요청 거부", json: async () => ({}) });
  const TWO = JSON.stringify({ candidates: [
    { messages: [{ text: "네." }] }, { messages: [{ text: "왜요." }] }] });
  const CHOOSE = c => JSON.stringify({ choice: c, reason_codes: [], fact_id: null, rule_id: null });
  /* 모델 id로 단계를 가른다 — 프롬프트 문구보다 정확하다 */
  async function run5(envExtra, body, o = {}) {
    sent = [];
    globalThis.fetch = async (url, init) => {
      const c = JSON.parse(init.body);
      sent.push(c);
      if (c.model === "claude-sonnet-5")
        return o.writerErr ? errBody(o.writerErr) : okBody(o.writer || TWO, c.model);
      if (String(c.model).startsWith("claude-sonnet-4-5"))
        return o.fbErr ? errBody(o.fbErr)
          : okBody(o.fb || JSON.stringify({ messages: [{ text: "나중에요." }] }), c.model);
      if (flatSys(c).includes('{"choice"'))
        return o.dirErr ? errBody(o.dirErr) : okBody(o.dir || CHOOSE("A"), c.model);
      return okBody(JSON.stringify({ messages: [{ text: "네." }] }), c.model);
    };
    try {
      const res = await worker.fetch(
        new Request("https://x/?k=열쇠", { method: "POST", body: JSON.stringify(body),
          headers: { "CF-Connecting-IP": `9.9.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}` } }),
        { ANTHROPIC_API_KEY: "sk-테스트", ACCESS_KEY: "열쇠", TRACE: "1", ...S5, ...envExtra });
      return { status: res.status, data: await res.json() };
    } finally { globalThis.fetch = realFetch; }
  }
  /* B만 죽는 후보쌍 — 이 방에 없는 화자를 명시한다(SENDER) */
  const B_DEAD = JSON.stringify({ candidates: [
    { messages: [{ text: "네." }] }, { messages: [{ sender: "minhyun", text: "어." }] }] });
  const BOTH_DEAD = JSON.stringify({ candidates: [
    { messages: [{ sender: "minhyun", text: "어." }] },
    { messages: [{ sender: "minhyun", text: "왜." }] }] });

  /* ① 한 호출에서 정확히 두 후보 */
  const base = await run5({}, BASE);
  eq("s5pair는 쓰기 하나·고르기 하나다", stagesOf(base), ["sonnet5_pair_writer", "haiku_director"]);
  eq("쓰는 쪽은 Sonnet 5, 고르는 쪽은 Haiku다",
    base.data.stages.map(s => s.model), ["claude-sonnet-5", "claude-haiku-4-5"]);
  eq("한 호출에서 둘을 청한다", flatMsgs(writerReq()).includes('"candidates"'), true);
  eq("trace에 후보 둘이 다 실린다",
    [base.data.trace.engine_mode, Object.keys(base.data.trace.candidates).sort(),
     base.data.trace.director_choice, base.data.trace.fallback],
    ["sonnet5-pair-haiku", ["A", "B"], "A", false]);
  eq("usage는 쓰는 쪽 실측이다", base.data.usage.model, "claude-sonnet-5");

  /* ② A·B가 개별로 hardFilter를 탄다 — 한쪽만 죽으면 남은 쪽을 판정한다 */
  const half = await run5({}, BASE, { writer: B_DEAD });
  eq("죽은 후보의 코드가 남는다", half.data.trace.candidate_checks.B, ["SENDER"]);
  eq("산 후보는 깨끗하다", half.data.trace.candidate_checks.A, []);
  eq("한 후보만 남아도 Haiku가 판정한다 — 폴백이 아니다",
    [stagesOf(half), half.data.trace.fallback], [["sonnet5_pair_writer", "haiku_director"], false]);

  /* ③ 탈락한 후보를 Haiku가 선택하면 그 판정은 무효 — 폴백 */
  const dead = await run5({}, BASE, { writer: B_DEAD, dir: CHOOSE("B") });
  eq("탈락 후보 선택은 폴백이다",
    [stagesOf(dead), dead.data.trace.fallback,
     dead.data.trace.fallback_why.some(w => w.startsWith("DIRECTOR_DEAD_PICK"))],
    [["sonnet5_pair_writer", "haiku_director", "sonnet45_fallback"], true, true]);
  eq("폴백 대사가 나간다", dead.data.messages.map(m => m.text), ["나중에요."]);

  /* ④ A를 고르면 A의 Effect만 따라온다 */
  const PLACE = { ...BASE, place: "보건실", talked_enough: true, bag: [] };
  const GIVE_A = JSON.stringify({ candidates: [
    { messages: [{ text: "밴드 줄게요." }], give: "bandaid" },
    { messages: [{ text: "이따 봐요." }] }] });
  const gaveA = await run5({}, PLACE, { writer: GIVE_A });
  eq("A를 고르면 A의 give만 사건이 된다",
    (gaveA.data.effects || []).map(f => [f.type, f.item]), [["item_transfer", "bandaid"]]);
  const gaveB = await run5({}, PLACE, { writer: GIVE_A, dir: CHOOSE("B") });
  eq("B를 고르면 A의 give는 안 따라온다", (gaveB.data.effects || []).length, 0);
  eq("B의 대사가 나간다", gaveB.data.messages.map(m => m.text), ["이따 봐요."]);

  /* ⑤ 둘 다 탈락 → Haiku를 부르지 않고 4.5로 */
  const both = await run5({}, BASE, { writer: BOTH_DEAD });
  eq("둘 다 탈락이면 Haiku를 생략한다",
    stagesOf(both), ["sonnet5_pair_writer", "sonnet45_fallback"]);
  eq("탈락 코드가 폴백 사유에 남는다",
    both.data.trace.fallback_why.sort(), ["A:SENDER", "B:SENDER"]);

  /* ⑥ RETRY · 판정 파싱 실패 · 없는 id — 전부 폴백 */
  const retry = await run5({}, BASE, { dir: CHOOSE("RETRY") });
  eq("Haiku RETRY는 폴백이다", [stagesOf(retry).at(-1), retry.data.trace.fallback_why],
    ["sonnet45_fallback", ["DIRECTOR_RETRY"]]);
  const garbled = await run5({}, BASE, { dir: "이건 JSON이 아니다" });
  eq("판정 파싱 실패도 폴백이다", [stagesOf(garbled).at(-1),
    garbled.data.trace.fallback_why.some(w => w.startsWith("DIRECTOR_BAD"))],
    ["sonnet45_fallback", true]);
  const ghost = await run5({}, BASE,
    { dir: JSON.stringify({ choice: "A", fact_id: "ghost.fact" }) });
  eq("없는 fact_id는 판정 무효 — 폴백이다", [stagesOf(ghost).at(-1),
    ghost.data.trace.fallback_why.some(w => w.includes("없는 fact_id"))],
    ["sonnet45_fallback", true]);
  const badRule = await run5({}, BASE,
    { dir: JSON.stringify({ choice: "A", rule_id: "ghost.rule" }) });
  eq("없는 rule_id도 판정 무효다",
    badRule.data.trace.fallback_why.some(w => w.includes("없는 rule_id")), true);

  /* ⑦ Sonnet 5는 실패해도 재호출하지 않는다 */
  const s5err = await run5({}, BASE, { writerErr: 529 });
  eq("호출 실패에도 Sonnet 5는 한 번뿐이다",
    [s5err.data.stages.filter(s => s.stage === "sonnet5_pair_writer").length,
     stagesOf(s5err).at(-1)], [1, "sonnet45_fallback"]);
  const oneCand = await run5({}, BASE,
    { writer: JSON.stringify({ candidates: [{ messages: [{ text: "네." }] }] }) });
  eq("후보 수 오류도 재호출 없이 폴백이다",
    [oneCand.data.stages.filter(s => s.stage === "sonnet5_pair_writer").length,
     oneCand.data.trace.fallback_why, stagesOf(oneCand).includes("haiku_director")],
    [1, ["WRITER_SCHEMA:1/2"], false]);
  const empty = await run5({}, BASE, { writer: JSON.stringify({ candidates: [
    { messages: [{ text: "네." }] }, { messages: [] }] }) });
  eq("빈 후보도 곧장 폴백이다 — Haiku를 안 부른다",
    [stagesOf(empty).includes("haiku_director"),
     empty.data.trace.fallback_why.includes("B:EMPTY")], [false, true]);

  /* ⑧ 폴백은 최대 한 번 — 그것도 실패하면 턴 실패다 */
  const fbDead = await run5({}, BASE, { dir: CHOOSE("RETRY"),
    fb: JSON.stringify({ messages: [{ sender: "minhyun", text: "어." }] }) });
  eq("폴백 탈락은 502다 — 가짜 대사로 안 덮는다", fbDead.status, 502);
  eq("폴백 호출은 한 번뿐이다",
    fbDead.data.stages.filter(s => s.stage === "sonnet45_fallback").length, 1);
  const fbErr = await run5({}, BASE, { writerErr: 529, fbErr: 500 });
  eq("폴백 호출 실패도 한 번뿐이고 502다", [fbErr.status,
    fbErr.data.stages.filter(s => s.stage === "sonnet45_fallback").length], [502, 1]);

  /* ⑨ 실험 모드를 안 켜면 기존 동작·호출 수가 그대로다 */
  const plain = await run({ CANDIDATE_MODE: "pair" }, BASE);
  eq("env 없이는 기존 hybrid 그대로다", stagesOf(plain), ["writer", "director"]);
  eq("기본 engineMode는 hybrid다", ENG.engineMode({}), "hybrid");
  eq("s5pair 단계 이름이 운영 경로에 안 섞인다",
    plain.data.stages.some(s => /sonnet5_pair|haiku_director|sonnet45_fallback/.test(s.stage)), false);
  const single9 = await run({ ENGINE_MODE: "single" }, BASE);
  eq("single 경로도 그대로다", stagesOf(single9), ["single_writer"]);
  /* SONNET_WRITER_MODEL 덮어쓰기는 여전히 single/anchor에만 닿는다 */
  const ovr = await run5({ SONNET_WRITER_MODEL: "claude-sonnet-4-6" }, BASE, { dir: CHOOSE("RETRY") });
  eq("스윕 덮어쓰기가 s5pair의 세 자리에 안 닿는다",
    ovr.data.stages.map(s => s.model),
    ["claude-sonnet-5", "claude-haiku-4-5", "claude-sonnet-4-5-20250929"]);

  /* ⑩ 운영 기본값·판 번호가 안 변했다 */
  eq("ENGINE 운영 자리가 그대로다",
    [ENG.ENGINE.writer.id, ENG.ENGINE.director.id, ENG.ENGINE.finalizer.id, ENG.CANDIDATE_MODE],
    ["claude-haiku-4-5", "claude-haiku-4-5", "claude-sonnet-4-5-20250929", "pair"]);
  eq("Sonnet 5 id는 MODELS에 등록된 것을 재사용한다 — 추측·중복 하드코딩이 아니다",
    ENG.ENGINE.pairWriter5.id, "claude-sonnet-5");
  eq("기본 replay 경로 목록에 s5pair가 없다", RP.DEFAULT_PATHS.includes("sonnet5-pair-haiku"), false);
  eq("판 번호가 웹과 앱에서 같다 — H를 안 건드렸다", (() => {
    const web = (readFileSync(join(ROOT, "index.html"), "utf8").match(/NULL_STORY_REV\s*=\s*["'](\d+)["']/) || [])[1];
    const app = (readFileSync(join(ROOT, "app/lib/db.ts"), "utf8").match(/NULL_STORY_REV\s*=\s*["'](\d+)["']/) || [])[1];
    return !!web && web === app;
  })(), true);
  eq("s5 산출물이 gitignore에 있다",
    /replay-s5-pair-haiku/.test(readFileSync(join(ROOT, ".gitignore"), "utf8")), true);
}

/* ══════════ 10.5 G3 CLI — taste-pack 16문항 fake 전수 ══════════ */
{
  const { execSync } = await import("node:child_process");
  const { mkdtempSync, readdirSync: rd, existsSync: ex } = await import("node:fs");
  const os = await import("node:os");
  const tmp = mkdtempSync(join(os.tmpdir(), "replay-s5-test-"));
  const sh = args => {
    try { execSync(`node tools/replay.mjs ${args}`, { cwd: ROOT, stdio: "pipe", maxBuffer: 64e6 }); return 0; }
    catch (e) { return e.status || 1; }
  };
  const out1 = join(tmp, "run1");
  eq("taste-pack fake 실행이 성공한다",
    sh(`--fake --paths=sonnet5-pair-haiku --packets=test/packets-taste --sessions=none --out=${out1}`), 0);
  const report = readFileSync(join(out1, "report.md"), "utf8");
  eq("16턴이 다 돈다", /총 replay 턴: 16 · 성공 16/.test(report), true);
  eq("계약된 산출물이 다 있다",
    ["selected-blind", "pair-blind", "trace"].every(d => ex(join(out1, d)))
      && ex(join(out1, "pair-key.json")), true);
  eq("경로 비교용 blind/는 안 만든다", ex(join(out1, "blind")), false);
  eq("pair-blind가 16개다", rd(join(out1, "pair-blind")).length, 16);
  const key = JSON.parse(readFileSync(join(out1, "pair-key.json"), "utf8"));
  eq("pair-key에 16항목·표시 교차가 있다", (() => {
    const names = Object.keys(key);
    if (names.length !== 16) return `개수 ${names.length}`;
    const firsts = names.map(n => key[n].display["ㄱ"]);
    return firsts.includes("A") && firsts.includes("B") ? "교차" : "고정";
  })(), "교차");
  /* 블라인드에 모델·선택·호출 흔적이 없다 — pair-key.json에만 있다 */
  eq("s5 블라인드가 깨끗하다", (() => {
    const bad = /sonnet|claude|haiku|4-5|director|fallback|폴백|token|usage|latency/i;
    for (const d of ["selected-blind", "pair-blind"])
      for (const f of rd(join(out1, d)))
        if (bad.test(readFileSync(join(out1, d, f), "utf8"))) return f;
    return "깨끗";
  })(), "깨끗");
  eq("--sessions=none 없이 빈 세션 디렉터리는 여전히 비정상 종료다",
    sh(`--fake --paths=sonnet5-pair-haiku --packets=test/packets-taste --sessions=/no/such --out=${join(tmp, "run2")}`) !== 0, true);
  /* taste-pack도 실사용 모양 lint를 통과한다 */
  const TIME = ["새벽", "아침", "낮", "저녁", "밤"];
  const DAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const tp = rd(join(ROOT, "test/packets-taste")).filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(readFileSync(join(ROOT, "test/packets-taste", f), "utf8")));
  eq("taste-pack이 16개다", tp.length, 16);
  eq("taste-pack 이력 행에 화자가 있고 때·요일이 워커 목록에 있다",
    tp.every(p => (p.body.history || []).every(m => m.sender
        && (m.role !== "user" || m.sender === "user"))
      && TIME.includes(p.body.now) && DAYS.includes(p.body.day)), true);
}

/* ══════════ 11. G4 — single5 (Sonnet 5 단일 Writer) ══════════
   성공 턴 = Sonnet 5 Writer 1회, 후보 정확히 1개, Director·Canon·
   Character·Finalizer 0회. 탈락시 정확히 한 번 재호출(턴당 최대 2회),
   폴백 없음. 검사·후처리는 기존 경로 그대로다. */
{
  const S5ONE = { ENGINE_MODE: "single5" };
  const GOOD = JSON.stringify({ messages: [{ text: "먹었어요. 늦게라도." }] });
  const BAD = JSON.stringify({ messages: [{ sender: "minhyun", text: "어." }] });
  const TWO = JSON.stringify({ candidates: [
    { messages: [{ text: "네." }] }, { messages: [{ text: "왜요." }] }] });
  const sysOf = c => flatSys(c);
  const otherStages = d => (d.data.stages || [])
    .filter(s => /director|canon|character|finalizer|haiku|fallback|pair/.test(s.stage));

  /* 성공 턴 — 한 호출이 전부다 */
  const one = await run(S5ONE, BASE, [GOOD]);
  eq("single5 성공 턴은 Sonnet 5 한 호출이다", stagesOf(one), ["single5_writer"]);
  eq("모델이 Sonnet 5다", one.data.stages[0].model, "claude-sonnet-5");
  eq("후보를 하나만 청한다", flatMsgs(writerReq()).includes('"candidates"'), false);
  eq("고르기·검사·마무리 단계가 없다", otherStages(one), []);
  eq("trace의 경로·모델", [one.data.trace.engine_mode, one.data.trace.writer_model],
    ["single5", "claude-sonnet-5"]);

  /* 첫 응답 hard reject → 정확히 한 번 재호출 → 성공 */
  const retry = await run(S5ONE, BASE, [BAD, GOOD]);
  eq("탈락 후 재호출까지 총 2회다", stagesOf(retry), ["single5_writer", "single5_writer"]);
  eq("재시도가 성공 대사를 낸다", retry.data.messages.map(m => m.text), ["먹었어요. 늦게라도."]);
  eq("재시도 입력에 탈락 코드만 짧게 붙는다",
    flatMsgs(sent[1]).includes("[이전 시도 탈락]") && flatMsgs(sent[1]).includes("A:SENDER"), true);
  eq("첫 입력은 변이되지 않았다", flatMsgs(sent[0]).includes("[이전 시도 탈락]"), false);
  eq("탈락 원문이 trace에 남는다 — attempts 기록용",
    retry.data.trace.rejected.map(r => [r.attempt, r.codes]), [[1, ["SENDER"]]]);

  /* 두 번 다 실패 — 폴백 없이 명시적 실패 */
  const twice = await run(S5ONE, BASE, [BAD, BAD]);
  eq("두 번 실패는 502다 — 가짜 대사·폴백 없음", twice.status, 502);
  eq("호출은 턴당 최대 2회다", stagesOf(twice), ["single5_writer", "single5_writer"]);
  eq("다른 모델이 전혀 안 불린다",
    twice.data.stages.every(s => s.model === "claude-sonnet-5"), true);

  /* 후보가 둘 오면 스키마 탈락 → 한 번 재시도 */
  const sch = await run(S5ONE, BASE, [TWO, GOOD]);
  eq("후보 둘은 탈락 후 한 번 재시도다", [stagesOf(sch), sch.status],
    [["single5_writer", "single5_writer"], 200]);

  /* 중요 장면도 hybrid critical 경로로 안 보낸다 */
  const crit = await run(S5ONE, PROBE, [GOOD]);
  eq("중요 장면도 single5 한 호출이다", stagesOf(crit), ["single5_writer"]);
  eq("검사 둘·마무리가 안 붙는다", otherStages(crit), []);

  /* 단톡·관전도 single5를 탄다 */
  const gBody = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T13-group-weekend.json"), "utf8")).body;
  const aBody = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8")).body;
  const grp = await run(S5ONE, gBody, [JSON.stringify({ messages: [
    { sender: "jaeeon", text: "주말은 비었다." }, { sender: "minhyun", text: "오 저도요" }] })]);
  eq("단톡도 single5 한 호출이다", stagesOf(grp), ["single5_writer"]);
  const auto = await run(S5ONE, aBody, [JSON.stringify({ messages: [
    { sender: "minhyun", text: "삼촌 그 컵 어디서 났어요?" }, { sender: "jaeeon", text: "샀다." }] })]);
  eq("관전도 single5 한 호출이다", stagesOf(auto), ["single5_writer"]);

  /* Candidate와 Effect가 같이 움직인다 */
  const PLACE5 = { ...BASE, place: "보건실", talked_enough: true, bag: [] };
  const gave = await run(S5ONE, PLACE5,
    [JSON.stringify({ messages: [{ text: "밴드 줄게요." }], give: "bandaid" })]);
  eq("한 후보의 give만 사건이 된다",
    (gave.data.effects || []).map(f => [f.type, f.item]), [["item_transfer", "bandaid"]]);

  /* single5 전용 행동 규칙 — 방별 투영 */
  await run(S5ONE, BASE, [GOOD]);
  const sysJ = sysOf(writerReq());
  eq("행동 규칙이 재언 1:1 프롬프트에 붙는다",
    [sysJ.includes("[이번 장면의 행동 원칙]"), sysJ.includes("[정사 — 공부방]")], [true, true]);
  const MB = { ...BASE, room: "minhyun", history: [
    { role: "user", content: "뭐 해" }] };
  await run(S5ONE, MB, [JSON.stringify({ messages: [{ text: "숙제요" }] })]);
  const sysM = sysOf(writerReq());
  eq("민현 방에는 정사 절이 안 붙는다 — known_by 투영",
    [sysM.includes("[이번 장면의 행동 원칙]"), sysM.includes("[정사 — 공부방]")], [true, false]);
  await run(S5ONE, gBody, [JSON.stringify({ messages: [{ sender: "jaeeon", text: "비었다." }] })]);
  eq("단톡에도 정사 절이 안 붙는다", sysOf(writerReq()).includes("[정사 — 공부방]"), false);
  await run({ CANDIDATE_MODE: "pair" }, BASE);
  eq("운영 hybrid 프롬프트에는 규칙 장이 없다 — 공용 프롬프트 불변",
    sysOf(writerReq()).includes("[이번 장면의 행동 원칙]"), false);
  await run({ ENGINE_MODE: "single" }, BASE);
  eq("single(4.5 기준선)도 그대로다 — 규칙 장 없음·모델 4.5",
    [sysOf(writerReq()).includes("[이번 장면의 행동 원칙]"),
     sent[0].model], [false, "claude-sonnet-4-5-20250929"]);
  eq("정사 원본은 이미 구분돼 있다 — 재언은 다닌 사람",
    /아홉 살 때 동네 공부방에 맡겨졌다/.test(readFileSync(join(ROOT, "worker.js"), "utf8")), true);
}

/* ══════════ 11.5 G4 CLI — single5 replay fake 전수 ══════════ */
{
  const { execSync } = await import("node:child_process");
  const { mkdtempSync, readdirSync: rd, existsSync: ex } = await import("node:fs");
  const os = await import("node:os");
  const tmp = mkdtempSync(join(os.tmpdir(), "replay-s5one-test-"));
  const sh = args => {
    try { execSync(`node tools/single5-replay.mjs ${args}`, { cwd: ROOT, stdio: "pipe", maxBuffer: 64e6 }); return 0; }
    catch (e) { return e.status || 1; }
  };
  const out1 = join(tmp, "run1");
  eq("single5 fake 실행이 성공한다", sh(`--fake --out=${out1}`), 0);
  const report = readFileSync(join(out1, "report.md"), "utf8");
  eq("36턴(18+18)이 다 돈다", /총 대화 턴: 36 \(1차 18 \+ 안정성 18\)/.test(report), true);
  eq("모델이 하나뿐이다", /- 모델: claude-sonnet-5\n/.test(report), true);
  const answers = readFileSync(join(out1, "answers.md"), "utf8");
  eq("answers가 18항목 전부다", (answers.match(/^## A-/gm) || []).length, 18);
  eq("고위험 두 fixture가 들어 있다",
    ["## A-14-jaeeon-early-probe", "## A-08-jaeeon-memory-probe"].every(s => answers.includes(s)), true);
  const stability = readFileSync(join(out1, "stability.md"), "utf8");
  eq("안정성이 9항목 × sample 3이다",
    [(stability.match(/^## S-/gm) || []).length, (stability.match(/- sample \d/g) || []).length], [9, 27]);
  eq("attempts·trace가 있다", [ex(join(out1, "attempts.md")), rd(join(out1, "trace")).length], [true, 36]);
  eq("키·헤더가 산출물에 없다", (() => {
    for (const f of ["answers.md", "attempts.md", "stability.md", "report.md"])
      if (/sk-ant|x-api-key|api03/i.test(readFileSync(join(out1, f), "utf8"))) return f;
    return "깨끗";
  })(), "깨끗");
  eq("비어 있지 않은 outDir은 거부한다", sh(`--fake --out=${out1}`) !== 0, true);
  eq("기본 산출물 이름이 gitignore 패턴에 덮인다",
    /replay-out\*\//.test(readFileSync(join(ROOT, ".gitignore"), "utf8")), true);
}

console.log(fail ? `\n실패 — ${pass}개 통과, ${fail}개 실패` : `\n통과 — ${pass}개 통과, 0개 실패`);
process.exit(fail ? 1 : 0);
