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
  /* 비용표가 실제 쓰는 모델을 다 안다 — 모르는 모델은 0원으로 새는 구멍이다.
     날짜 접미(-20250929)는 priceFor가 떼고 찾는다 */
  eq("비용표가 네 경로의 모델을 다 안다",
    [ENG.ENGINE.writer.id, ENG.ENGINE.finalizer.id, ENG.ENGINE.singleWriter.id]
      .every(id => RP.usageCost({ model: id, input_tokens: 1000000 }) > 0), true);
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

/* ══════════ 7.5 적대 검증이 잡은 것들 — 재발 방지 ══════════ */
{
  /* 실패한 턴은 anchor를 소진하지 않는다 — 세 사유가 같은 원칙을 탄다.
     실패 턴에 lastSummary를 덮으면 rollover 직후의 「첫 응답」이 안 나왔는데
     기회가 사라진다. */
  const mem = RP.newMemory();
  const b1 = { mode: "chat", room: "jaeeon", counts: { jaeeon: 20 }, days: 5, summary: "옛" };
  RP.noteTurn(mem, "jaeeon", b1, true); RP.noteTurn(mem, "jaeeon", b1, true);
  const b2 = { ...b1, summary: "새" };
  eq("요약이 갈리면 anchor가 선다", RP.decideAnchor(RP.snapshot(mem, "jaeeon"), b2), "summary_rollover");
  RP.noteTurn(mem, "jaeeon", b2, false);           // 그 턴이 502로 죽었다
  eq("실패한 턴은 rollover를 안 소진한다", RP.decideAnchor(RP.snapshot(mem, "jaeeon"), b2), "summary_rollover");
  RP.noteTurn(mem, "jaeeon", b2, true);            // 이번엔 답이 나왔다
  eq("성공하면 딱 한 번으로 닫힌다", RP.decideAnchor(RP.snapshot(mem, "jaeeon"), b2), null);
  const mem2 = RP.newMemory();
  RP.noteTurn(mem2, "jaeeon", b1, false);
  eq("실패는 opening도 안 센다", RP.snapshot(mem2, "jaeeon").responses, 0);
  /* 오래된 세이브는 기왕의 응답 수를 선언한다 — 3주째 방에서 opening이 다시 서면 안 된다 */
  const mem3 = RP.newMemory(); mem3.responses.jaeeon = 200;
  eq("씨앗 응답 수가 opening을 막는다", RP.decideAnchor(RP.snapshot(mem3, "jaeeon"), b1), null);

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

/* ══════════ 8. 블라인드 섞기 — 결정적이고, 자리로 못 맞힌다 ══════════ */
{
  const a = RP.shuffled(["hybrid-one", "hybrid-pair", "single-sonnet", "staged"], "7-item1");
  const b = RP.shuffled(["hybrid-one", "hybrid-pair", "single-sonnet", "staged"], "7-item1");
  eq("같은 씨앗이면 같은 순서다", a, b);
  eq("원소는 그대로다", a.slice().sort(), ["hybrid-one", "hybrid-pair", "single-sonnet", "staged"]);
}

console.log(fail ? `\n실패 — ${pass}개 통과, ${fail}개 실패` : `\n통과 — ${pass}개 통과, 0개 실패`);
process.exit(fail ? 1 : 0);
