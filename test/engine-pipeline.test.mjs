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
  eq("첫 두 응답은 opening이다", [D({ responses: 0 }, body()), D({ responses: 1 }, body())],
    ["opening", "opening"]);
  eq("셋째부터는 아니다", D({ responses: 2 }, body()), null);
  eq("요약이 갱신된 직후 한 번이다",
    D({ responses: 9, summary: "옛 요약" }, body({ summary: "새 요약" })), "summary_rollover");
  eq("요약이 그대로면 아니다",
    D({ responses: 9, summary: "같음" }, body({ summary: "같음" })), null);
  eq("요약을 모르면 안 쏜다", D({ responses: 9 }, body({ summary: "무엇" })), null);
  eq("단계가 오른 직후 한 번이다",
    D({ responses: 9, summary: "", stageIdx: 0 },
      body({ summary: "", counts: { jaeeon: 16 }, days: 4 })), "stage_enter");
  eq("단계가 그대로면 아니다",
    D({ responses: 9, summary: "", stageIdx: 0 }, body({ summary: "" })), null);
  eq("우선순위는 opening이 먼저다",
    D({ responses: 1, summary: "옛", stageIdx: 0 },
      body({ summary: "새", counts: { jaeeon: 16 }, days: 4 })), "opening");
  eq("예약된 중요 장면은 기존 경로가 이긴다",
    D({ responses: 0 }, body({ scene_reason: "memory_reveal" })), null);
  eq("단톡은 대상이 아니다", D({ responses: 0 }, body({ room: "group" })), null);
  eq("관전은 대상이 아니다", [D({ responses: 0 }, body({ room: "health" })),
    D({ responses: 0 }, body({ mode: "auto", room: "health" }))], [null, null]);
  eq("허용된 사유는 셋뿐이다", ENG.ANCHOR_REASONS, ["opening", "summary_rollover", "stage_enter"]);
  eq("캐시류는 사유가 아니다", ["cache_miss", "cache_read", "hour_passed"]
    .some(s => ENG.ANCHOR_REASONS.includes(s)), false);
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
  /* 비용표가 실제 쓰는 모델을 다 안다 — 모르는 모델은 0원으로 새는 구멍이다 */
  eq("비용표가 네 경로의 모델을 다 안다",
    [ENG.ENGINE.writer.id, ENG.ENGINE.finalizer.id, ENG.ENGINE.singleWriter.id]
      .every(id => RP.PRICES[id]), true);
  eq("비용은 실측에 단가를 곱한다 — 캐시 쓰기 1.25배·읽기 0.1배",
    RP.costOf([{ model: "claude-haiku-4-5", input_tokens: 1000000, output_tokens: 1000000,
      cache_creation_input_tokens: 1000000, cache_read_input_tokens: 1000000 }]).toFixed(2),
    (1 + 5 + 1.25 + 0.1).toFixed(2));
}

/* ══════════ 7. 운영 기본은 그대로다 ══════════ */
{
  const prod = await run({}, BASE);           // ENGINE_MODE도 TRACE도 없는 운영 모양
  eq("기본 경로는 pair 그대로다", stagesOf(prod), ["writer", "director"]);
  eq("기본 쓰는 쪽은 Haiku다", prod.data.stages[0].model, "claude-haiku-4-5");
  const noTrace = await run({ TRACE: "" }, BASE);
  eq("TRACE 없이는 trace가 안 실린다 — 운영 응답 불변", "trace" in noTrace.data, false);
}

/* ══════════ 8. 블라인드 섞기 — 결정적이고, 자리로 못 맞힌다 ══════════ */
{
  const a = RP.shuffled(["hybrid-one", "hybrid-pair", "single-sonnet", "staged"], "7-item1");
  const b = RP.shuffled(["hybrid-one", "hybrid-pair", "single-sonnet", "staged"], "7-item1");
  eq("같은 씨앗이면 같은 순서다", a, b);
  eq("원소는 그대로다", a.slice().sort(), ["hybrid-one", "hybrid-pair", "single-sonnet", "staged"]);
}

console.log(fail ? `\n실패 — ${pass}개 통과, ${fail}개 실패` : `\n통과 — ${pass}개 통과, 0개 실패`);
process.exit(fail ? 1 : 0);
