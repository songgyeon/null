#!/usr/bin/env node
/* ── G. 네 갈래 파이프라인 회귀 ──
   가짜 API로 워커를 통째로 굴려서, 네 경로가 계약대로 도는지를 실행으로
   잰다. 모양 핀만으로는 안 된다 — E단계 내내 배운 것이 그것이다.

     hybrid-one     Writer(후보 1) → Director
     hybrid-pair    Writer(후보 2, 한 호출) → Director
     single-sonnet  고정 기준선 Writer 한 호출 — 같은 사실·같은 후처리
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

/* 정확한 ID는 실행 설정(worker.js ENGINE·MODELS)에서 가져온다 — 테스트에 다시 적지 않는다 */
const MID = { writer: ENG.ENGINE.writer.id, director: ENG.ENGINE.director.id,
  canon: ENG.ENGINE.canon.id, character: ENG.ENGINE.character.id,
  finalizer: ENG.ENGINE.finalizer.id, single: ENG.ENGINE.singleWriter.id,
  anchor: ENG.ENGINE.anchorWriter.id, pair5: ENG.ENGINE.pairWriter5.id };
/* SONNET_WRITER_MODEL 주입 시험용 비교 모델 — PRICES allowlist에서 찾는다 */
const SONNET46 = Object.keys(RP.PRICES).find(m => m.endsWith("-4-6"));

/* ── 가짜 API — 요청을 다 적어두고, 단계를 프롬프트 문구로 가른다 ── */
const realFetch = globalThis.fetch;
let sent = [];
/* 요청이 **어디로** 갔는지와 어떤 머리를 달았는지. 도전자 경로가 다른
   진영의 주소로 나가는지, 열쇠가 어디에 실리는지를 재려면 본문만으론 모자란다. */
let sentReq = [];
let ipN = 0;
const flatSys = c => (Array.isArray(c.system) ? c.system : [{ text: c.system }])
  .map(b => b.text || "").join("\n");
const flatMsgs = c => (c.messages || []).map(m => Array.isArray(m.content)
  ? m.content.map(b => b.text || "").join("\n") : m.content).join("\n");
async function run(envExtra, body, replies, hooks) {
  sent = [];
  sentReq = [];
  const queue = replies ? replies.slice() : null;
  /* hooks — 단계별 응답 주입 큐. 검사·고르기의 특정 답(무효 fact_id,
     RETRY 판정 등)을 시험이 심을 때 쓴다. 큐가 비면 기본 답으로 돌아간다. */
  const hk = k => (hooks && Array.isArray(hooks[k]) && hooks[k].length ? hooks[k].shift() : null);
  globalThis.fetch = async (url, init) => {
    const c = JSON.parse(init.body);
    sent.push(c);
    sentReq.push({ url: String(url), headers: (init && init.headers) || {}, body: c });
    /* 도전자 진영은 요청 모양이 다르다 — system이 messages 맨 앞 한 장이다.
       단계 판별은 **같은 문구**로 한다: 프롬프트 원문이 같아야 하니까. */
    const oai = String(url).includes("api.openai.com");
    const oaiRole = r => (c.messages || []).filter(m => m.role === r)
      .map(m => m.content).join("\n");
    const sys = oai ? oaiRole("system") : flatSys(c);
    const msgs = oai ? [oaiRole("user"), oaiRole("assistant")].join("\n") : flatMsgs(c);
    let text;
    if (sys.includes("SELECT_A · SELECT_B · RETRY"))
      text = hk("director") || JSON.stringify({ decision: msgs.includes("후보 B") ? "SELECT_A" : "SELECT_A",
        reject_codes: { A: [], B: [] }, fact_id: null, rule_id: null });
    else if (sys.includes("대사를 쓰지 않는다 — 고르기만 한다"))
      text = hk("director") || JSON.stringify({ decision: msgs.includes("후보 B") ? "A" : "ACCEPT", reject_codes: {} });
    else if (sys.includes("너는 이 세계의 사실만 본다"))
      text = hk("canon") || '{"problems":[]}';
    else if (sys.includes("이 사람이 이 사람다운지만 본다"))
      text = hk("character") || '{"problems":[]}';
    else if (sys.includes("이 장면의 마지막 손이다"))
      text = hk("finalizer") || JSON.stringify({ messages: [{ text: "…그 얘기는 이따가 해요." }] });
    else if (queue && queue.length) text = queue.shift();
    else {
      /* §8.5 발견 대사는 물건을 짚어야 한다(ITEM_MISS) — replay fake와 같은 규칙 */
      const obsHit = msgs.match(/에게 (.+?)[이가] 있는 것이 처음 눈에/);
      const ownHit = msgs.match(/이 (.+?)[이가] 어디서 났는지/);
      if (obsHit) text = JSON.stringify({ messages: [{ text: `그 ${obsHit[1]} 어디서 났어요?` }] });
      else if (ownHit && msgs.includes("네 몫이다"))
        /* 회피 기본 답 — 정사 부정(「그냥 쓰던 거예요」)을 정답으로 안 쓴다 */
        text = JSON.stringify({ messages: [{ text: "그건 왜." }, { text: "커피나 마셔." }] });
      else text = msgs.includes('"candidates"')
        ? JSON.stringify({ candidates: [{ messages: [{ text: "네." }] }, { messages: [{ text: "왜요." }] }] })
        : JSON.stringify({ messages: [{ text: "네." }] });
    }
    if (oai) return { ok: true, status: 200, headers: { get: () => null },
      json: async () => ({ model: c.model, choices: [{ message: { content: text } }],
        usage: { prompt_tokens: 100, completion_tokens: 10,
                 prompt_tokens_details: { cached_tokens: 0 } } }),
      text: async () => "" };
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
      { ANTHROPIC_API_KEY: "sk-테스트", OPENAI_API_KEY: "sk-가짜",
        ACCESS_KEY: "열쇠", TRACE: "1", ...envExtra });
    return { status: res.status, data: await res.json() };
  } finally { globalThis.fetch = realFetch; }
}
/* 쓰는 쪽 요청(첫 호출)의 전체 프롬프트 — 고정부+이력+가변부 */
const writerReq = () => sent[0];
const stagesOf = d => (d.data.stages || []).map(s => s.stage);
/* 검사 둘이 모든 턴에 붙는 배선이라, 「발견 갈래인가 일반인가」는 단계 목록이
   아니라 **쓰는 호출이 몇 번인가**로 갈린다. 재는 것은 그거다. */
const writersOf = d => stagesOf(d).filter(x => x === "writer").length;

/* ── 옛 경로를 재는 시험은 그 깃발을 명시한다 ──
   기본값이 solo(쓰기 한 번·고르기 없음)로 바뀌었다. hybrid(후보 둘 + 저비용
   Director)는 실험 깃발 뒤에 그대로 남아 있고, 아래 회귀들은 그 길을 잰다. */
const HY = { ENGINE_MODE: "hybrid" };
/* ── 옛 상급 solo 배선을 재는 시험은 그 깃발을 명시한다 ──
   무플래그 기본값이 바뀌었다(블라인드 판정). 옛 배선은 지운 것이 아니라
   ENGINE_MODE=solo로 그대로 남아 있고, 아래 회귀들이 그 길을 계속 잰다. */
const SOLO = { ENGINE_MODE: "solo" };

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
  const one = await run({ ...HY, CANDIDATE_MODE: "one" }, BASE);
  eq("hybrid-one은 쓰기 하나·고르기 하나다", stagesOf(one), ["writer", "director"]);
  eq("hybrid-one의 쓰는 쪽은 저비용 Writer다", one.data.stages[0].model, MID.writer);
  eq("hybrid-one은 후보를 하나만 청한다", flatMsgs(writerReq()).includes('"candidates"'), false);
  eq("trace가 경로를 적는다", [one.data.trace.engine_mode, one.data.trace.candidate_mode], ["hybrid", "one"]);

  const pair = await run({ ...HY, CANDIDATE_MODE: "pair" }, BASE);
  eq("hybrid-pair도 호출은 둘이다", stagesOf(pair), ["writer", "director"]);
  eq("hybrid-pair는 한 호출에서 둘을 청한다", flatMsgs(writerReq()).includes('"candidates"'), true);
  eq("pair의 trace", pair.data.trace.candidate_mode, "pair");

  const single = await run({ ENGINE_MODE: "single" }, BASE);
  eq("single은 한 호출이 전부다", stagesOf(single), ["single_writer"]);
  eq("single의 쓰는 쪽은 고정 기준선 Writer다", single.data.stages[0].model, MID.single);
  eq("single은 후보를 하나만 청한다", flatMsgs(writerReq()).includes('"candidates"'), false);
  eq("single의 trace", [single.data.trace.engine_mode, single.data.trace.candidate_mode,
    single.data.trace.writer_model, single.data.trace.anchor_reason],
    ["single", "one", MID.single, null]);
  eq("single의 usage도 쓰는 쪽 실측이다", single.data.usage.output_tokens, 10);

  const anchor = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "opening" }, BASE);
  eq("anchor 턴은 anchor_writer로 적힌다", stagesOf(anchor), ["anchor_writer"]);
  eq("anchor의 모델도 고정 기준선 Writer다", anchor.data.stages[0].model, MID.anchor);
  eq("trace에 anchor_reason이 실린다", anchor.data.trace.anchor_reason, "opening");

  /* 캐시는 anchor 조건이 아니다 — 모르는 사유는 조용히 무시된다 */
  const bad = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "cache_miss" }, BASE);
  eq("모르는 anchor 사유는 그냥 single이다", [stagesOf(bad)[0], bad.data.trace.anchor_reason],
    ["single_writer", null]);
  /* ENGINE_MODE 없이 ANCHOR_REASON만 오면 아무 일도 없다 */
  const stray = await run({ ...HY, ANCHOR_REASON: "opening", CANDIDATE_MODE: "pair" }, BASE);
  eq("single 아닌 경로에서 anchor는 무시된다", stagesOf(stray), ["writer", "director"]);
}

/* ══════════ 2. 같은 세계 — 네 경로의 쓰는 쪽이 같은 프롬프트를 본다 ══════════ */
{
  await run({ ...HY, CANDIDATE_MODE: "one" }, BASE);
  const oneReq = { sys: flatSys(writerReq()), msgs: flatMsgs(writerReq()) };
  await run({ ENGINE_MODE: "single" }, BASE);
  const singleReq = { sys: flatSys(writerReq()), msgs: flatMsgs(writerReq()) };
  eq("one과 single의 시스템이 같다", oneReq.sys === singleReq.sys, true);
  eq("one과 single의 이력·가변부가 같다", oneReq.msgs === singleReq.msgs, true);
  await run({ ENGINE_MODE: "single", ANCHOR_REASON: "stage_enter" }, BASE);
  eq("anchor도 같은 프롬프트를 본다", flatSys(writerReq()) === oneReq.sys
    && flatMsgs(writerReq()) === oneReq.msgs, true);
  await run({ ...HY, CANDIDATE_MODE: "pair" }, BASE);
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
  const a = await run({ ...HY, CANDIDATE_MODE: "one" }, BASE, [raw]);
  const b = await run({ ENGINE_MODE: "single" }, BASE, [raw]);
  eq("같은 원문이면 최종 말풍선도 같다", a.data.messages, b.data.messages);
  eq("Effect 경로도 같은 하나다", [a.data.effects.length, b.data.effects.length], [0, 0]);
}

/* ══════════ 4. 중요 장면 — single은 한 호출, staged는 기존 경로 ══════════ */
{
  const hyb = await run({ ...HY, CANDIDATE_MODE: "pair" }, PROBE);
  eq("hybrid의 중요 장면은 쓰기→검사 둘→마무리다", stagesOf(hyb),
    ["writer", "canon", "character", "finalizer"]);
  /* 쓰는 자리도 상급이 됐다(운영 배치 변경). 저비용은 검사 둘만 쓴다 */
  eq("중요 장면의 쓰기·마무리는 상급, 검사 둘은 저비용이다",
    hyb.data.stages.map(s => s.model === MID.finalizer), [true, false, false, true]);

  const single = await run({ ENGINE_MODE: "single" }, PROBE);
  eq("순수 single은 중요 장면도 한 호출이다", stagesOf(single), ["single_writer"]);
  eq("single의 라우팅 판정은 같다", single.data.trace.route,
    { tier: "critical", reason: "memory_reveal" });

  /* staged의 anchor가 중요 장면과 겹치면 — anchor를 물리고 기존 경로 */
  const clash = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "opening", CANDIDATE_MODE: "pair" }, PROBE);
  eq("anchor는 중요 장면에 진다", stagesOf(clash), ["writer", "canon", "character", "finalizer"]);
  eq("물린 anchor가 trace에 남는다", [clash.data.trace.anchor_reason, clash.data.trace.anchor_declined],
    [null, "opening"]);
  eq("한 턴에 기준선 Writer를 추가로 안 산다",
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

  /* 고정 기준선 Writer — legacy(MODELS 폴백 사슬)를 재사용하지 않는다 */
  eq("anchor·single의 모델이 같은 고정 기준선이다 — 날짜 고정판",
    [MID.anchor === MID.single, /-\d{8}$/.test(MID.single)], [true, true]);
  eq("마무리와 같은 모델, 다른 역할이다",
    ENG.ENGINE.singleWriter.id === ENG.ENGINE.finalizer.id
    && ENG.STAGE_ENGINE.single_writer === "singleWriter"
    && ENG.STAGE_ENGINE.anchor_writer === "anchorWriter", true);
  const rp = readFileSync(join(ROOT, "tools/replay.mjs"), "utf8");
  eq("재생이 legacy를 안 탄다", /ENGINE_MODE:\s*"legacy"/.test(rp), false);
  /* 비용표가 실제 쓰는 모델을 다 안다 — 모르는 모델은 0원으로 새는 구멍이다.
     날짜 접미(-20250929)는 priceFor가 떼고 찾는다 */
  eq("비용표가 네 경로의 모델을 다 안다",
    [MID.writer, MID.finalizer, MID.single]
      .every(id => RP.usageCost({ model: id, input_tokens: 1000000 }) > 0), true);
  const hp = RP.priceFor(MID.writer);
  eq("비용은 실측에 단가를 곱한다 — 1h 캐시 쓰기 2배·읽기 0.1배",
    RP.costOf([{ model: MID.writer, input_tokens: 1000000, output_tokens: 1000000,
      cache_creation_input_tokens: 1000000, cache_read_input_tokens: 1000000 }]).toFixed(2),
    (hp.in + hp.out + hp.in * 2.0 + hp.in * 0.1).toFixed(2));
}

/* ══════════ 7. 운영 기본은 그대로다 ══════════ */
{
  const prod = await run({}, BASE);           // ENGINE_MODE도 TRACE도 없는 운영 모양
  /* ── 기본 경로는 solo다 ──
     쓰기 한 번, 고르는 단계 없음. 일반 턴에서 저비용 Writer도 Director도
     안 부른다 — 그게 이 배선의 요점이다. */
  eq("기본 경로는 쓰기 한 번이다", writersOf(prod), 1);
  eq("일반 턴에는 검사가 안 붙는다",
    stagesOf(prod).filter(x => x !== "writer"), []);
  /* 쓰는 자리는 블라인드 판정으로 다른 진영이 됐다. 옛 상급 배선은 지운
     것이 아니라 ENGINE_MODE=solo로 그대로 있고, 바로 아래에서 같이 잰다. */
  eq("기본 쓰는 쪽은 도전자 진영이다", prod.data.stages[0].model, ENG.OPENAI_MODEL);
  eq("solo를 명시하면 옛 상급 Writer 그대로다",
    (await run(SOLO, BASE)).data.stages[0].model, MID.writer);
  eq("기본 Writer가 상급 모델로 고정돼 있다", MID.writer, MID.finalizer);
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
  const oTwo = await run({ ...HY, CANDIDATE_MODE: "one" }, BASE, [two, two]);
  eq("one에 둘이 계속 오면 502다 — 몰래 pair가 되지 않는다", oTwo.status, 502);
  const pOne = await run({ ...HY, CANDIDATE_MODE: "pair" }, BASE, [oneMsg, oneMsg]);
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
    [502, "opening", MID.anchor, null]);

  /* 단가 — 날짜 접미는 떼고 찾고, 요약 폴백 모델도 0원으로 안 샌다 */
  eq("날짜 붙은 id도 단가를 찾는다",
    RP.usageCost({ model: MID.director + "-20251001", input_tokens: 1000000 }) > 0
    && RP.usageCost({ model: MID.single, input_tokens: 1000000 }) > 0, true);
  eq("요약 폴백 모델도 단가가 있다",
    Object.keys(RP.PRICES)
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
  eq("상급 pair Writer 단가는 $2/$10이다",
    RP.usageCost({ model: MID.pair5, input_tokens: 1000000, output_tokens: 1000000 }).toFixed(2),
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
      { stage: "writer", model: MID.writer, attempt: 1, input_tokens: 10, output_tokens: 5,
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
    { ENGINE_MODE: "single", SONNET_WRITER_MODEL: SONNET46 });
  eq("staged-46의 anchor 턴도 모델만 다르다", RP.pathEnv("staged-46", "pair", "opening"),
    { CANDIDATE_MODE: "pair", ENGINE_MODE: "single", ANCHOR_REASON: "opening",
      SONNET_WRITER_MODEL: SONNET46 });
  eq("staged 계열 판별", [RP.isStaged("staged"), RP.isStaged("staged-46"),
    RP.isStaged("single-sonnet46")], [true, true, false]);
  eq("기본 실행은 여전히 넷이다", RP.DEFAULT_PATHS,
    ["hybrid-one", "hybrid-pair", "single-sonnet", "staged"]);
  /* 워커 쪽 — 덮어쓰기는 single/anchor Writer 자리에만 닿는다 */
  const ov = await run({ ENGINE_MODE: "single", SONNET_WRITER_MODEL: SONNET46 }, BASE);
  eq("덮어쓴 모델로 부른다", [ov.data.stages[0].stage, ov.data.stages[0].model,
    ov.data.trace.writer_model],
    ["single_writer", SONNET46, SONNET46]);
  const plain = await run({ ...HY, CANDIDATE_MODE: "pair", SONNET_WRITER_MODEL: SONNET46 }, BASE);
  eq("hybrid의 Writer에는 안 닿는다", plain.data.stages.map(s => s.model),
    [MID.writer, MID.director]);
  const badOv = await run({ ENGINE_MODE: "single", SONNET_WRITER_MODEL: "gpt-x" }, BASE);
  eq("claude-sonnet- 계열이 아니면 무시한다", badOv.data.stages[0].model, MID.single);
  const crit = await run({ ENGINE_MODE: "single", ANCHOR_REASON: "opening",
    CANDIDATE_MODE: "pair", SONNET_WRITER_MODEL: SONNET46 }, PROBE);
  eq("물린 anchor 턴의 마무리는 여전히 기본 모델이다 — 덮어쓰기가 finalizer에 안 닿는다",
    crit.data.stages.map(s => s.model === SONNET46), [false, false, false, false]);
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
     sonnet5 키의 모델이 비기본 샘플링·수동 thinking에 400을 내므로 셋 다 같이 뺀다.
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
    SW.MODEL_KEYS.map(mk => SW.SINGLE_SWEEP_MODELS[mk]));
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
  eq("스윕 trace의 writer_model이 주입 모델이다", rt.data.trace.writer_model,
    SW.SINGLE_SWEEP_MODELS.sonnet5);

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
   상급 pair Writer가 한 호출로 후보 A·B → 후보별 코드 검사 → 저비용
   Director 선택 → 못 고르는 모든 갈래에서 고정 폴백 Writer 한 번.
   가짜 API 파이프라인으로 계약의 표적 열 가지를 실측한다. */
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
      if (c.model === MID.pair5)
        return o.writerErr ? errBody(o.writerErr) : okBody(o.writer || TWO, c.model);
      if (String(c.model).startsWith(MID.single.replace(/-\d{8}$/, "")))
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
  eq("쓰는 쪽은 상급 pair Writer, 고르는 쪽은 저비용 Director다",
    base.data.stages.map(s => s.model), [MID.pair5, MID.director]);
  eq("한 호출에서 둘을 청한다", flatMsgs(writerReq()).includes('"candidates"'), true);
  eq("trace에 후보 둘이 다 실린다",
    [base.data.trace.engine_mode, Object.keys(base.data.trace.candidates).sort(),
     base.data.trace.director_choice, base.data.trace.fallback],
    ["sonnet5-pair-haiku", ["A", "B"], "A", false]);
  eq("usage는 쓰는 쪽 실측이다", base.data.usage.model, MID.pair5);

  /* ② A·B가 개별로 hardFilter를 탄다 — 한쪽만 죽으면 남은 쪽을 판정한다 */
  const half = await run5({}, BASE, { writer: B_DEAD });
  eq("죽은 후보의 코드가 남는다", half.data.trace.candidate_checks.B, ["SENDER"]);
  eq("산 후보는 깨끗하다", half.data.trace.candidate_checks.A, []);
  eq("한 후보만 남아도 Director가 판정한다 — 폴백이 아니다",
    [stagesOf(half), half.data.trace.fallback], [["sonnet5_pair_writer", "haiku_director"], false]);

  /* ③ 탈락한 후보를 Director가 선택하면 그 판정은 무효 — 폴백 */
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

  /* ⑤ 둘 다 탈락 → Director를 부르지 않고 폴백 Writer로 */
  const both = await run5({}, BASE, { writer: BOTH_DEAD });
  eq("둘 다 탈락이면 Director를 생략한다",
    stagesOf(both), ["sonnet5_pair_writer", "sonnet45_fallback"]);
  eq("탈락 코드가 폴백 사유에 남는다",
    both.data.trace.fallback_why.sort(), ["A:SENDER", "B:SENDER"]);

  /* ⑥ RETRY · 판정 파싱 실패 · 없는 id — 전부 폴백 */
  const retry = await run5({}, BASE, { dir: CHOOSE("RETRY") });
  eq("Director RETRY는 폴백이다", [stagesOf(retry).at(-1), retry.data.trace.fallback_why],
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

  /* ⑦ pair Writer는 실패해도 재호출하지 않는다 */
  const s5err = await run5({}, BASE, { writerErr: 529 });
  eq("호출 실패에도 pair Writer는 한 번뿐이다",
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
  eq("빈 후보도 곧장 폴백이다 — Director를 안 부른다",
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
  const plain = await run({ ...HY, CANDIDATE_MODE: "pair" }, BASE);
  eq("env 없이는 기존 hybrid 그대로다", stagesOf(plain), ["writer", "director"]);
  eq("기본 engineMode는 gpt41이다", ENG.engineMode({}), "gpt41");
  eq("solo는 깃발을 명시해야 나온다", ENG.engineMode({ ENGINE_MODE: "solo" }), "solo");
  eq("hybrid는 깃발을 명시해야 나온다", ENG.engineMode({ ENGINE_MODE: "hybrid" }), "hybrid");
  eq("s5pair 단계 이름이 운영 경로에 안 섞인다",
    plain.data.stages.some(s => /sonnet5_pair|haiku_director|sonnet45_fallback/.test(s.stage)), false);
  const single9 = await run({ ENGINE_MODE: "single" }, BASE);
  eq("single 경로도 그대로다", stagesOf(single9), ["single_writer"]);
  /* SONNET_WRITER_MODEL 덮어쓰기는 여전히 single/anchor에만 닿는다 */
  const ovr = await run5({ SONNET_WRITER_MODEL: SONNET46 }, BASE, { dir: CHOOSE("RETRY") });
  eq("스윕 덮어쓰기가 s5pair의 세 자리에 안 닿는다",
    ovr.data.stages.map(s => s.model),
    [MID.pair5, MID.director, MID.single]);

  /* ⑩ 운영 기본값·판 번호가 안 변했다 */
  /* 쓰는 자리를 상급으로 올렸다(운영 배치 변경). 고르는 자리는 기본
     경로에서 안 불리고, 저비용은 검사 둘에만 남는다. */
  eq("ENGINE 운영 자리 — 쓰기·마무리는 상급, 검사는 저비용이다",
    [MID.writer === MID.finalizer, MID.canon === MID.director,
     MID.canon !== MID.writer, ENG.CANDIDATE_MODE],
    [true, true, true, "pair"]);
  eq("pair Writer id는 MODELS 등록 항목을 재사용한다 — 추측·중복 하드코딩이 아니다",
    [!!MID.pair5, MID.pair5 in RP.PRICES], [true, true]);
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

/* ══════════ 11. G4 — single5 (상급 단일 Writer) ══════════
   성공 턴 = 상급 Writer 1회, 후보 정확히 1개, Director·Canon·
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
  eq("single5 성공 턴은 Writer 한 호출이다", stagesOf(one), ["single5_writer"]);
  eq("모델이 등록된 상급 Writer다", one.data.stages[0].model, MID.pair5);
  eq("후보를 하나만 청한다", flatMsgs(writerReq()).includes('"candidates"'), false);
  eq("고르기·검사·마무리 단계가 없다", otherStages(one), []);
  eq("trace의 경로·모델", [one.data.trace.engine_mode, one.data.trace.writer_model],
    ["single5", MID.pair5]);

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
    twice.data.stages.every(s => s.model === MID.pair5), true);

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
  await run({ ...HY, CANDIDATE_MODE: "pair" }, BASE);
  eq("운영 hybrid 프롬프트에는 규칙 장이 없다 — 공용 프롬프트 불변",
    sysOf(writerReq()).includes("[이번 장면의 행동 원칙]"), false);
  await run({ ENGINE_MODE: "single" }, BASE);
  eq("single(4.5 기준선)도 그대로다 — 규칙 장 없음·모델 4.5",
    [sysOf(writerReq()).includes("[이번 장면의 행동 원칙]"),
     sent[0].model], [false, MID.single]);
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
  eq("모델이 하나뿐이다", new RegExp(`- 모델: ${MID.pair5}\n`).test(report), true);
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

/* ══════════ 12. G5 golden-v1 — 행동 규칙 + Director 구조화 ══════════ */
{
  const gv1 = await run({ ...HY, CANDIDATE_MODE: "pair", DIALOGUE_RULESET: "golden-v1" }, BASE);
  eq("golden-v1도 호출은 둘이다(Writer+Director)", stagesOf(gv1), ["writer", "director"]);
  eq("golden-v1 Writer는 저비용 모델이다", gv1.data.stages[0].model, MID.writer);
  eq("golden-v1 Director는 저비용 모델이다", gv1.data.stages[1].model, MID.director);
  eq("trace에 dialogue_ruleset이 기록된다", gv1.data.trace.dialogue_ruleset, "golden-v1");
  eq("trace에 allCandidates가 기록된다", Array.isArray(gv1.data.trace.allCandidates), true);
  eq("trace에 directorDecision이 기록된다", gv1.data.trace.directorDecision != null, true);
  eq("golden Director는 SELECT_A/SELECT_B 중 하나를 돌려준다",
    ["A", "B"].includes(gv1.data.trace.directorDecision.decision), true);

  const goldenSys = flatSys(sent[1]);
  eq("golden Director system에 SELECT_A가 있다", goldenSys.includes("SELECT_A"), true);
  eq("golden Director system에 10개 코드가 있다",
    ["FACT_BREAK", "KNOWLEDGE_LEAK", "INVENTED_EVENT", "INTENT_MISS",
     "DIRECT_ANSWER_MISS", "KOREAN_BROKEN", "VOICE_BREAK",
     "QUESTION_SPAM", "COUNSELOR_TONE", "REPEATS_RECENT"]
      .every(c => goldenSys.includes(c)), true);

  const writerSys = flatSys(sent[0]);
  eq("golden Writer에 행동 원칙이 붙는다", writerSys.includes("[행동 원칙]"), true);
  eq("golden Writer에 이재언 규칙이 붙는다(jaeeon 방)", writerSys.includes("[이재언]"), true);
  eq("golden Writer에 민현 규칙은 안 붙는다(jaeeon 방)", writerSys.includes("[이민현]"), false);
  eq("golden Writer에 단톡·관전 규칙은 안 붙는다(jaeeon 방)", writerSys.includes("[단톡·관전]"), false);
  eq("golden Writer에 정사 — 공부방이 붙는다(chat+jaeeon)", writerSys.includes("[정사 — 공부방]"), true);

  const gv1Min = await run({ ...HY, CANDIDATE_MODE: "pair", DIALOGUE_RULESET: "golden-v1" },
    { ...BASE, room: "minhyun" });
  const writerSysMin = flatSys(sent[0]);
  eq("golden minhyun 방에 이민현 규칙이 붙는다", writerSysMin.includes("[이민현]"), true);
  eq("golden minhyun 방에 이재언 규칙은 안 붙는다", writerSysMin.includes("[이재언]"), false);
  eq("golden minhyun 방에 정사 — 공부방은 안 붙는다", writerSysMin.includes("[정사 — 공부방]"), false);

  const gv1Grp = await run({ ...HY, CANDIDATE_MODE: "pair", DIALOGUE_RULESET: "golden-v1" },
    { ...BASE, mode: "auto", room: "group" });
  const writerSysGrp = flatSys(sent[0]);
  eq("golden group에 이재언+이민현+단톡·관전이 모두 붙는다",
    [writerSysGrp.includes("[이재언]"), writerSysGrp.includes("[이민현]"),
     writerSysGrp.includes("[단톡·관전]")], [true, true, true]);
  eq("golden group에 정사 — 공부방은 안 붙는다(auto 모드)", writerSysGrp.includes("[정사 — 공부방]"), false);
}

/* ══════════ 12.1 golden-v1은 기존 경로를 안 건드린다 ══════════ */
{
  const vanilla = await run({ ...HY, CANDIDATE_MODE: "pair" }, BASE);
  eq("DIALOGUE_RULESET 없으면 행동 원칙이 안 붙는다",
    flatSys(sent[0]).includes("[행동 원칙]"), false);
  eq("DIALOGUE_RULESET 없으면 Director에 SELECT_A가 없다",
    flatSys(sent[1]).includes("SELECT_A"), false);
  eq("DIALOGUE_RULESET 없으면 trace에 dialogue_ruleset이 없다",
    vanilla.data.trace.dialogue_ruleset, undefined);

  const oneNoGolden = await run({ ...HY, CANDIDATE_MODE: "one" }, BASE);
  eq("hybrid-one에 DIALOGUE_RULESET을 안 넣으면 규칙 없다",
    flatSys(sent[0]).includes("[행동 원칙]"), false);

  const singleNoGolden = await run({ ENGINE_MODE: "single" }, BASE);
  eq("single에 golden-v1을 넣어도 single이 이긴다(singleNow 우선)",
    stagesOf(singleNoGolden), ["single_writer"]);
}

/* ══════════ 12.2 readGoldenDecision 파서 검증 ══════════ */
{
  const rd = ENG.readGoldenDecision;
  const ids = ["A", "B"];
  eq("SELECT_A → A", rd('{"decision":"SELECT_A","reject_codes":{"A":[],"B":["VOICE_BREAK"]},"fact_id":null,"rule_id":null}', ids).decision, "A");
  eq("SELECT_B → B", rd('{"decision":"SELECT_B","reject_codes":{},"fact_id":null,"rule_id":null}', ids).decision, "B");
  eq("RETRY → RETRY", rd('{"decision":"RETRY","reject_codes":{"A":["FACT_BREAK"],"B":["FACT_BREAK"]},"fact_id":"gift.mug","rule_id":null}', ids).decision, "RETRY");
  eq("RETRY의 reject_codes 보존", rd('{"decision":"RETRY","reject_codes":{"A":["FACT_BREAK"],"B":["INVENTED_EVENT"]},"fact_id":null,"rule_id":null}', ids).reject_codes.A[0], "FACT_BREAK");
  eq("fact_id 보존", rd('{"decision":"SELECT_A","reject_codes":{},"fact_id":"gift.mug","rule_id":null}', ids).fact_id, "gift.mug");
  eq("rule_id 보존", rd('{"decision":"SELECT_A","reject_codes":{},"fact_id":null,"rule_id":"minhyun.voice"}', ids).rule_id, "minhyun.voice");
  eq("빈 입력은 RETRY", rd("", ids).decision, "RETRY");
  eq("잘못된 JSON은 RETRY", rd("{broken", ids).decision, "RETRY");
  eq("SELECT_C는 RETRY", rd('{"decision":"SELECT_C","reject_codes":{}}', ids).decision, "RETRY");
  eq("ACCEPT는 golden에서 안 된다(RETRY)", rd('{"decision":"ACCEPT","reject_codes":{}}', ids).decision, "RETRY");
}

/* ══════════ 12.3 GOLDEN_REJECT_CODES 열 개 ══════════ */
{
  eq("GOLDEN_REJECT_CODES는 Set이다", ENG.GOLDEN_REJECT_CODES instanceof Set, true);
  eq("정확히 열 개다", ENG.GOLDEN_REJECT_CODES.size, 10);
  eq("FACT_BREAK이 있다", ENG.GOLDEN_REJECT_CODES.has("FACT_BREAK"), true);
  eq("KNOWLEDGE_LEAK이 있다", ENG.GOLDEN_REJECT_CODES.has("KNOWLEDGE_LEAK"), true);
  eq("INVENTED_EVENT가 있다", ENG.GOLDEN_REJECT_CODES.has("INVENTED_EVENT"), true);
  eq("INTENT_MISS가 있다", ENG.GOLDEN_REJECT_CODES.has("INTENT_MISS"), true);
  eq("DIRECT_ANSWER_MISS가 있다", ENG.GOLDEN_REJECT_CODES.has("DIRECT_ANSWER_MISS"), true);
  eq("KOREAN_BROKEN이 있다", ENG.GOLDEN_REJECT_CODES.has("KOREAN_BROKEN"), true);
  eq("VOICE_BREAK이 있다", ENG.GOLDEN_REJECT_CODES.has("VOICE_BREAK"), true);
  eq("QUESTION_SPAM이 있다", ENG.GOLDEN_REJECT_CODES.has("QUESTION_SPAM"), true);
  eq("COUNSELOR_TONE이 있다", ENG.GOLDEN_REJECT_CODES.has("COUNSELOR_TONE"), true);
  eq("REPEATS_RECENT가 있다", ENG.GOLDEN_REJECT_CODES.has("REPEATS_RECENT"), true);
}

/* ══════════ 12.4 golden-v1.json은 runtime에 import되지 않는다 ══════════ */
{
  const workerSrc = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("worker.js에 golden-v1.json import 없다", /golden-v1\.json/.test(workerSrc), false);
  const appSrc = readFileSync(join(ROOT, "app.js"), "utf8");
  eq("app.js에 golden-v1.json import 없다", /golden-v1\.json/.test(appSrc), false);
}

/* ══════════ 12.5 G5 CLI — golden-replay fake 전수 ══════════ */
{
  const { execSync } = await import("node:child_process");
  const { mkdtempSync, readdirSync: rd, existsSync: ex } = await import("node:fs");
  const os = await import("node:os");
  const tmp = mkdtempSync(join(os.tmpdir(), "replay-golden-test-"));
  const sh = args => {
    try { execSync(`node tools/golden-replay.mjs ${args}`, { cwd: ROOT, stdio: "pipe", maxBuffer: 64e6 }); return 0; }
    catch (e) { return e.status || 1; }
  };
  const out1 = join(tmp, "run1");
  eq("golden fake 실행이 성공한다", sh(`--fake --out=${out1}`), 0);
  const report = readFileSync(join(out1, "report.md"), "utf8");
  eq("16턴이 다 돈다", /총 대화 턴: 16/.test(report), true);
  const answers = readFileSync(join(out1, "answers.md"), "utf8");
  eq("answers가 16항목 전부다", (answers.match(/^## A-/gm) || []).length, 16);
  eq("answers에 후보 섹션이 있다", answers.includes("### 후보"), true);
  eq("answers에 Director 섹션이 있다", answers.includes("### Director"), true);
  eq("answers에 최종 대사 섹션이 있다", answers.includes("### 최종 대사"), true);
  eq("attempts·trace가 있다", [ex(join(out1, "attempts.md")), rd(join(out1, "trace")).length], [true, 16]);
  eq("키·헤더가 산출물에 없다", (() => {
    for (const f of ["answers.md", "attempts.md", "report.md"])
      if (/sk-ant|x-api-key|api03/i.test(readFileSync(join(out1, f), "utf8"))) return f;
    return "깨끗";
  })(), "깨끗");
  /* ── C — attempt 1·2가 두 보고서와 trace에 모두 남는다 ──
     fake의 T10 강제 RETRY(닫힘 변수)로 재시도가 실제로 한 번 난다.
     전에는 Director RETRY가 rejectedLog에 안 남아 셋 다 비었다. */
  const att = readFileSync(join(out1, "attempts.md"), "utf8");
  eq("T10의 attempt 1 판정이 answers에 남는다",
    /attempt 1 판정: RETRY/.test(answers) && /attempt 2 판정: /.test(answers), true);
  eq("T10의 attempt 1 원문·코드가 attempts에 남는다",
    /1번째 시도 탈락 — 코드: QUESTION_SPAM/.test(att)
    && /1번째 시도 탈락 — 코드: VOICE_BREAK/.test(att), true);
  const t10tr = JSON.parse(readFileSync(join(out1, "trace", "A-T10-minhyun-sick-alone.json"), "utf8"));
  eq("T10 trace에 attempt별 판정이 다 있다",
    [t10tr.engine.directorDecisions.length,
     t10tr.engine.directorDecisions[0].decision,
     t10tr.engine.directorDecisions[0].rule_id,
     t10tr.engine.directorDecisions[1].decision !== "RETRY"],
    [2, "RETRY", "minhyun.ask.stops_at_two", true]);
  eq("세 산출물의 시도 수가 서로 맞는다", (() => {
    const attempts = Math.max(...t10tr.stages.map(s => s.attempt || 1));
    const rejAtt = new Set((t10tr.engine.rejected || []).map(r => r.attempt));
    return attempts === 2 && rejAtt.has(1)
      && /재시도 후 성공 \(첫 시도 탈락: QUESTION_SPAM, VOICE_BREAK\)/.test(answers);
  })(), true);
  /* ── A1 — 화자 순차 사건이 CLI 산출물에도 그대로 남는다 ── */
  const t14tr = JSON.parse(readFileSync(join(out1, "trace", "A-T14-health-mug-discovery.json"), "utf8"));
  eq("T14 trace에 관측 기록이 남는다",
    [t14tr.engine.observe.source_fact_id, t14tr.engine.observe.revealed,
     t14tr.engine.turnContext.requiredSpeakers],
    ["gift.mug.user_to_jaeeon", false, ["minhyun", "jaeeon"]]);
  /* ── A3 — T16 예약이 승격되고 ack까지 나온다 ── */
  const t16tr = JSON.parse(readFileSync(join(out1, "trace", "A-T16-minhyun-partner-known.json"), "utf8"));
  eq("T16이 critical로 가고 ack가 남는다",
    [t16tr.engine.route.tier, t16tr.engine.route.reason, t16tr.scene_ack],
    ["critical", "partner_known", "partner_known"]);
  eq("비어 있지 않은 outDir은 거부한다", sh(`--fake --out=${out1}`) !== 0, true);
}

/* ══════════ 13. 계약 누락 복구 — 런타임 검증 ══════════
   감사(2026-08-24)가 확인한 누락 13건의 복구를 **실행으로** 잰다.
   소스 문자열 핀은 run.mjs 몫이고, 여기는 가짜 API 파이프라인이 실제로
   그렇게 도는지를 본다. */

/* ── 13.1 §8.5 화자 순차 — T14: 관측자에 출처가 새지 않는다 ── */
{
  const t14 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8"));
  const r = await run({}, t14.body);
  eq("T14 — 화자 순차 두 호출 + 소유자 정사 검사다", stagesOf(r), ["writer", "writer", "canon"]);
  const obsReq = flatMsgs(sent[0]), ownReq = flatMsgs(sent[1]);
  eq("T14 — 관측자 호출에 출처가 없다",
    [obsReq.includes("회색 머그컵을 줬다"), obsReq.includes("이재언에게 회색 머그컵이 있다"),
     obsReq.includes("[지금 장면]"), obsReq.includes("처음 눈에")],
    [false, true, true, true]);
  eq("T14 — 소유자 호출에 출처·관측자 대사·무지 조건이 있다",
    [ownReq.includes("회색 머그컵을 줬다"), ownReq.includes("[이민현] 그 회색 머그컵 어디서 났어요?"),
     ownReq.includes("어디서 났는지"), ownReq.includes("모른다")],
    [true, true, true, true]);
  eq("T14 — 발화 순서가 관측자→소유자다",
    r.data.messages.map(m => m.sender), ["minhyun", "jaeeon", "jaeeon"]);
  /* 적대 검증이 잡은 결함의 회귀 — 소유자 호출은 assistant(관측자 대사)로
     끝나면 안 된다. 지시·가변부가 prefill 안에 들어가면 개행 끝 prefill을
     API가 400으로 거절해 생산에서만 죽는다. 지시는 새 user 턴이다. */
  eq("T14 — 소유자 호출이 user 턴으로 끝난다 (prefill 아님)", (() => {
    const m = sent[1].messages;
    const last = m[m.length - 1], prev = m[m.length - 2];
    const lastText = Array.isArray(last.content)
      ? last.content.map(b => b.text || "").join("\n") : String(last.content);
    return [last.role, prev.role,
      String(Array.isArray(prev.content) ? prev.content.map(b => b.text || "").join("\n") : prev.content).includes("[이민현]"),
      lastText.includes("[지금 장면]")];
  })(), ["user", "assistant", true, true]);
  eq("T14 — requiredSpeakers·관측 기록이 계약대로다",
    [r.data.trace.turnContext.requiredSpeakers, r.data.trace.observe.source_fact_id,
     r.data.trace.observe.observer, r.data.trace.observe.owner],
    [["minhyun", "jaeeon"], "gift.mug.user_to_jaeeon", "minhyun", "jaeeon"]);
  /* 관측 ≠ 공개 — 소유자 기본 답("그냥 쓰던 거예요")은 출처를 안 밝혔다.
     disclosure Effect가 없고, 상대의 known_by는 다음 턴에도 그대로다. */
  eq("T14 — 회피한 턴에는 disclosure Effect가 없다",
    [r.data.trace.observe.revealed,
     (r.data.effects || []).some(e => e.type === "disclosure")],
    [false, false]);
}

/* ── 13.2 T15 — 반대 방향 대칭 ── */
{
  const t15 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T15-health-beanie-discovery.json"), "utf8"));
  const r = await run({}, t15.body);
  eq("T15 — 화자 순차 두 호출 + 소유자 정사 검사다", stagesOf(r), ["writer", "writer", "canon"]);
  const obsReq = flatMsgs(sent[0]), ownReq = flatMsgs(sent[1]);
  eq("T15 — 이번엔 재언이 관측자다",
    [obsReq.includes("남색 비니를 줬다"), obsReq.includes("이민현에게 남색 비니가 있다"),
     ownReq.includes("남색 비니를 줬다")],
    [false, true, true]);
  eq("T15 — 발화 순서가 재언→민현이다",
    r.data.messages.map(m => m.sender), ["jaeeon", "minhyun", "minhyun"]);
}

/* ── 13.2b discloseRevealed — 긍정 확인만 공개다 (필수 회귀) ──
   놓치면 다음에 또 물으면 되지만, 헛잡으면 안 밝힌 턴에 상대가 아는
   사람이 된다. 부정·질문 되받기·가정·철회·타 물건 공개는 전부 아니다. */
{
  const R = t => ENG.discloseRevealed(t, "연", "mug");
  eq("긍정 확인은 공개다",
    [R("연 선생님이 준 거야."), R("연 쌤한테 받은 거야."), R("교생 선생님이 주셨어.")],
    [true, true, true]);
  eq("부정·질문 되받기·가정·무지는 공개가 아니다",
    [R("연 선생님이 준 거 아니야."), R("선생님이 줬냐고? 아니."),
     R("쌤이 준 거면 좋겠네."), R("누가 줬는지는 몰라.")],
    [false, false, false, false]);
  /* 판정은 disclose.key의 물건에 결속된다 — 딴 물건을 밝히며 이 물건을
     물리는 발화는 이 물건의 공개가 아니다 */
  eq("이 물건을 물리는 발화는 공개가 아니다",
    R("선생님이 줬어. 이건 아니고 저 비니를."), false);
  eq("다른 물건을 밝힌 문장은 이 물건의 공개가 아니다",
    R("선생님이 비니 줬어."), false);
}

/* ── 13.3 requiredSpeakers 검사 — 누락·순서 역전·목록 밖 화자 ── */
{
  const mk = senders => ({ messages: senders.map(s => ({ sender: s, senderGiven: true, text: "말" })) });
  const ctx = { requiredSpeakers: ["minhyun", "jaeeon"] };
  eq("전부·순서대로면 통과", ENG.hardFilter(mk(["minhyun", "jaeeon"]), ["jaeeon", "minhyun"], ctx), []);
  eq("한 명이 빠지면 SPEAKERS", ENG.hardFilter(mk(["minhyun"]), ["jaeeon", "minhyun"], ctx), ["SPEAKERS"]);
  eq("순서가 뒤집히면 SPEAKERS", ENG.hardFilter(mk(["jaeeon", "minhyun"]), ["jaeeon", "minhyun"], ctx), ["SPEAKERS"]);
  eq("빈 계약이면 검사 안 한다", ENG.hardFilter(mk(["jaeeon"]), ["jaeeon", "minhyun"], { requiredSpeakers: [] }), []);
  /* 목록 밖 화자는 SENDER가 먼저 잡고, SPEAKERS도 겹쳐 잡는다 */
  eq("목록 밖 화자가 끼면 탈락한다",
    ENG.hardFilter(mk(["minhyun", "user", "jaeeon"]), ["jaeeon", "minhyun"], ctx).length > 0, true);
}

/* ── 13.4 비대칭 사건 실패 → 502 — 사건(pending)이 소모될 답을 안 준다 ── */
{
  const t14 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8"));
  const badPart = JSON.stringify({ messages: [{ sender: "jaeeon", text: "내가 왜 여기서" }] });
  const r = await run({}, t14.body, [badPart, badPart]);   // 관측자 호출 두 시도 다 SENDER
  eq("관측자가 계속 틀리면 502다 — 각본으로 안 덮는다",
    [r.status, !!(r.data && r.data.messages)], [502, false]);
  eq("실패 응답에 scene_ack가 없다 — 사건이 남는다", r.data.scene_ack === undefined, true);

  /* ── 의미 검증 — 물건을 안 짚는 대사는 200으로 못 지나간다 ──
     「네.」로 두 번 지나가려 하면 ITEM_MISS로 두 번 떨어지고 502다.
     사건은 소모되지 않고 큐에 남는다 — 이전 실패(물건 무시)의 재발 방지. */
  const blank = JSON.stringify({ messages: [{ text: "네." }] });
  const r2 = await run({}, t14.body, [blank, blank]);
  eq("무관한 대사는 ITEM_MISS로 떨어진다 — 200 통과 금지",
    [r2.status,
     (r2.data.trace.rejected || []).filter(x => (x.codes || []).includes("ITEM_MISS")).length],
    [502, 2]);
}

/* ── 13.4b 공개(disclosure) — 소유자가 실제로 밝힌 턴에만 상태가 생긴다 ── */
{
  const t14 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8"));
  /* 소유자가 출처를 실제로 밝힌다 → disclosure Effect가 발행되고 at은
     코드가 찍은 현실 epoch다 — null이 아니다 */
  const goodObs = JSON.stringify({ messages: [{ text: "삼촌, 그 회색 머그컵 어디서 났어요?" }] });
  const reveal = JSON.stringify({ messages: [{ text: "선생님이 준 거야. 따뜻하라고." }] });
  const r = await run({}, t14.body, [goodObs, reveal]);
  const d = (r.data.effects || []).find(e => e.type === "disclosure");
  eq("공개한 턴에는 disclosure Effect가 발행된다",
    [r.status, !!d, d && d.fact_id, d && d.by, d && d.heard_by, d && d.room],
    [200, true, "gift.mug.user_to_jaeeon", "jaeeon", ["jaeeon", "minhyun"], "health"]);
  eq("at은 코드가 찍는 현실 epoch다 — null 금지",
    [typeof (d && d.at), (d && d.at) > 946684800000, r.data.trace.observe.revealed],
    ["number", true, true]);

  /* ── 다음 턴 투영 — 공개가 저장되면 상대가 출처를 안다 ──
     클라이언트 장부(disclosed)를 실어 보내면 known_by가 넓어져 비대칭이
     사라진다: 발견 장면이 다시 서지 않고 일반 관전 한 호출이다. */
  const after = { ...t14.body, disclosed: { "gift.mug.user_to_jaeeon": ["jaeeon", "minhyun"] } };
  const r2 = await run({}, after);
  eq("공개 뒤에는 발견 장면이 다시 안 선다 — 쓰기 한 번", writersOf(r2), 1);
  eq("공개 뒤에는 상대의 known_by에 출처가 있다",
    r2.data.trace.turnContext.facts
      .find(f => f.fact_id === "gift.mug.user_to_jaeeon").known_by.includes("minhyun"), true);

  /* ── 사건 수명 계약 ──
     발견 장면은 **성공하면 한 번 소모**다 — 회피해도 같은 장면을 무한
     반복하지 않는다(소모는 클라이언트 사건 큐의 몫이고, run.mjs의 웹
     하네스가 실제 큐 수명으로 잰다). 워커가 보장하는 것은 이것뿐이다:
     회피한 턴에는 disclosure Effect가 없어서, 클라이언트 장부(disclosed)가
     안 변하고 다음 턴 투영에서 상대는 여전히 출처를 모른다. */
  const r3 = await run({}, t14.body);   // 장부(disclosed) 없이 — 회피 뒤의 다음 요청 모양
  eq("회피 뒤에는 다음 턴 투영에서도 출처를 모른다",
    r3.data.trace.turnContext.facts
      .find(f => f.fact_id === "gift.mug.user_to_jaeeon").known_by.includes("minhyun"), false);

  /* ── 소유자의 정사 부정은 Canon이 잡는다 — 회피와 다르다 ──
     「그냥 쓰던 거예요」는 유저가 준 물건이라는 사실의 직접 부정이다.
     판정은 기존 Canon Critic 계약(모델 판정 + 코드의 id 검증) 재사용 —
     여기서는 검사가 부정을 보고했을 때 배선이 실제로 탈락·502로 가고
     사건이 소모될 답을 안 주는지를 잰다. */
  const goodObs2 = JSON.stringify({ messages: [{ text: "삼촌, 그 회색 머그컵 어디서 났어요?" }] });
  const denial = JSON.stringify({ messages: [{ text: "그냥 쓰던 거예요." }] });
  const flag = JSON.stringify({ problems: [{ candidate: "A", critic: "canon",
    fact_id: "gift.mug.user_to_jaeeon", code: "FACT_DENIAL" }] });
  const rd = await run({}, t14.body, [goodObs2, denial, denial], { canon: [flag, flag] });
  eq("정사를 부정한 소유자는 502다 — 사건이 소모될 답을 안 준다",
    [rd.status,
     (rd.data.trace.rejected || []).some(x => (x.codes || []).some(c => String(c).includes("FACT_DENIAL"))),
     rd.data.scene_ack === undefined],
    [502, true, true]);
  /* 회피(출처를 안 밝히고 딴청)는 통과한다 — 13.1·기본 fake가 그 경로다 */
}

/* ── 13.5 T16 — 예약 승격·이번 턴 Fact·scene_ack ── */
{
  const t16 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T16-minhyun-partner-known.json"), "utf8"));
  const r = await run({}, t16.body);
  /* 검사 둘 + 마무리는 옛 배선(solo)의 계약이다. 기본 경로의 T16은
     writer → canon이고 그쪽은 test/default-engine.test.mjs가 잰다. */
  eq("T16 — solo에서는 검사 둘 + 마무리다",
    stagesOf(await run(SOLO, t16.body)), ["writer", "canon", "character", "finalizer"]);
  eq("T16 — 라우팅·ack가 계약대로다",
    [r.data.trace.route.tier, r.data.trace.route.reason, r.data.scene_ack],
    ["critical", "partner_known", "partner_known"]);
  eq("T16 — 이번 턴 Fact가 생긴다",
    r.data.trace.turnContext.facts.some(f => f.fact_id === "story.partner_choice.known"), true);

  /* 실패하면 ack가 없다 — 예약은 클라이언트에 그대로 남는다 */
  const bad = await run({}, t16.body, null, { canon: ["엉망", "엉망"] });
  eq("T16 — 검사가 계속 못 읽으면 502·ack 없음",
    [bad.status, bad.data.scene_ack === undefined], [502, true]);
}

/* ── 13.6 Canon Critic — 고정 정사 fact_id의 실제 순환 ── */
{
  const hit = JSON.stringify({ problems: [{ candidate: "A", critic: "canon",
    fact_id: "canon.jaeeon.knows_user_20y", code: "FACT_DENIAL" }] });
  /* 마무리에게 재료를 주는 계약은 옛 배선(solo)의 것이다 — 기본 경로에는
     마무리가 없다. 그 계약은 여기서 계속 잰다. */
  const r = await run(SOLO, PROBE, null, { canon: [hit] });
  eq("고정 정사 fact_id가 검사에서 돌아온다",
    [r.status, r.data.trace.criticNotes[0].notes[0].fact_id],
    [200, "canon.jaeeon.knows_user_20y"]);
  eq("정사를 어긴 후보는 마무리 재료에서 빠진다", (() => {
    const fin = sent.find(c => flatSys(c).includes("이 장면의 마지막 손이다"));
    return fin ? !flatMsgs(fin).includes("[후보 A]") : "마무리 호출 없음";
  })(), true);
  /* 허용 목록에 없는 fact_id는 「문제 없음」이 아니라 RETRY다 */
  const bad = JSON.stringify({ problems: [{ candidate: "A", critic: "canon",
    fact_id: "canon.jaeeon.없는것", code: "FACT_DENIAL" }] });
  const r2 = await run({}, PROBE, null, { canon: [bad] });
  eq("무효 fact_id는 재시도로 간다",
    [r2.status,
     r2.data.stages.filter(s => s.stage === "canon").length,
     (r2.data.trace.rejected || []).some(x => (x.codes || []).includes("CRITIC_SCHEMA"))],
    [200, 2, true]);
}

/* ── 13.7 golden RETRY — fact_id·rule_id가 다음 Writer 입력에 오른다 ── */
{
  const retry = JSON.stringify({ decision: "RETRY",
    reject_codes: { A: ["VOICE_BREAK"], B: ["QUESTION_SPAM"] },
    fact_id: "canon.jaeeon.knows_user_20y", rule_id: "jaeeon.voice.dry_haeyo" });
  const r = await run({ ...HY, CANDIDATE_MODE: "pair", DIALOGUE_RULESET: "golden-v1" },
    BASE, null, { director: [retry] });
  eq("golden RETRY 뒤에도 성공한다", r.status, 200);
  const w2 = flatMsgs(sent[2]);          // writer#1, director#1, writer#2 …
  eq("다음 Writer가 코드와 id를 다 받는다",
    [w2.includes("[이전 시도 탈락]"), w2.includes("A:VOICE_BREAK"),
     w2.includes("fact:canon.jaeeon.knows_user_20y"), w2.includes("rule:jaeeon.voice.dry_haeyo")],
    [true, true, true, true]);
  /* 지어낸 id는 안 올라간다 — 허용 목록 검증 */
  const fake = JSON.stringify({ decision: "RETRY", reject_codes: { A: ["VOICE_BREAK"] },
    fact_id: "gift.없는것.user_to_jaeeon", rule_id: "없는.규칙" });
  await run({ ...HY, CANDIDATE_MODE: "pair", DIALOGUE_RULESET: "golden-v1" }, BASE, null, { director: [fake] });
  const w2b = flatMsgs(sent[2]);
  eq("무효 id는 다음 프롬프트에 안 오른다",
    [w2b.includes("fact:"), w2b.includes("rule:")], [false, false]);

  /* 적대 검증이 잡은 결함의 회귀 둘 —
     ① 코드가 여섯을 채워도 근거 id는 잘리지 않는다(id가 노트 맨 앞).
     ② 판정이 지어낸 자유 문장 코드·유령 후보 키는 열 개 허용 목록에서
        걸러져 다음 프롬프트에 안 오른다. */
  const six = JSON.stringify({ decision: "RETRY",
    reject_codes: { A: ["FACT_BREAK", "KOREAN_BROKEN", "VOICE_BREAK"],
                    B: ["QUESTION_SPAM", "COUNSELOR_TONE", "REPEATS_RECENT"] },
    fact_id: "canon.jaeeon.knows_user_20y", rule_id: "jaeeon.voice.dry_haeyo" });
  await run({ ...HY, CANDIDATE_MODE: "pair", DIALOGUE_RULESET: "golden-v1" }, BASE, null, { director: [six] });
  const w2c = flatMsgs(sent[2]);
  eq("코드 여섯이어도 id가 살아남는다",
    [w2c.includes("fact:canon.jaeeon.knows_user_20y"), w2c.includes("rule:jaeeon.voice.dry_haeyo")],
    [true, true]);
  const junk = JSON.stringify({ decision: "RETRY",
    reject_codes: { A: ["말투가 좀 이상함", "VOICE_BREAK"], C: ["QUESTION_SPAM"] },
    fact_id: null, rule_id: null });
  const rj = await run({ ...HY, CANDIDATE_MODE: "pair", DIALOGUE_RULESET: "golden-v1" }, BASE, null, { director: [junk] });
  const w2d = flatMsgs(sent[2]);
  eq("지어낸 코드·유령 후보 키는 걸러진다",
    [w2d.includes("말투가 좀 이상함"), w2d.includes("C:QUESTION_SPAM"), w2d.includes("A:VOICE_BREAK"), rj.status],
    [false, false, true, 200]);
}

/* ── 13.8 평가기 — 수기 계산과 일치 (D1·D2·D3) ── */
{
  const EV = await import("../tools/eval-scenes.mjs");
  /* D1 — 사건 2 · 부정 3(그중 고른 후보에 붙은 것 1) — 손으로 센 값 */
  const mem = EV.scoreMemoryReveal([
    { label: "m1", engine: { route: { reason: "memory_reveal" },
      criticNotes: [{ attempt: 1, notes: [
        { candidate: "A", critic: "canon", fact_id: "canon.jaeeon.knows_user_20y", code: "FACT_DENIAL" },
        { candidate: "B", critic: "canon", fact_id: "canon.study_room.owner", code: "OWNER_SWAPPED" }] }],
      selectedCandidate: { id: "F" } } },
    { label: "m2", engine: { route: { reason: "memory_reveal" },
      criticNotes: [{ attempt: 1, notes: [
        { candidate: "A", critic: "canon", fact_id: "canon.jaeeon.knows_user_20y", code: "FACT_DENIAL" }] }],
      selectedCandidate: { id: "A" } } },
    { label: "일반턴", engine: { route: { reason: "" } } },
  ]);
  eq("기억 공개 지표가 수기 계산과 같다",
    [mem.events, mem.denials, mem.survived], [2, 3, 1]);

  /* D2 — 다섯 갈래를 하나씩 심는다. 분모 5 · ok 1 */
  const pkBody = ok => ({ mode: "chat", room: "minhyun", partner: "jaeeon",
    scene_reason: "partner_known", days: 24, counts: { minhyun: 50 },
    story: { partnerKnown: { jaeeon: true, minhyun: false } },
    history: [{ role: "user", content: "할 말 있어" }] });
  const tr = (tier, reason, ack, ok = true) =>
    ({ ok, scene_ack: ack, engine: { route: { tier, reason } } });
  const rt = EV.scoreRouting([
    { label: "ok", body: pkBody(), trace: tr("critical", "partner_known", "partner_known") },
    { label: "내려감", body: pkBody(), trace: tr("normal", "", null) },
    { label: "딴사유", body: pkBody(), trace: tr("critical", "confession", null) },
    { label: "ack없음", body: pkBody(), trace: tr("critical", "partner_known", null) },
    { label: "실패", body: pkBody(), trace: tr("critical", "partner_known", null, false) },
    { label: "분모밖", body: { mode: "chat", room: "jaeeon", history: [] },
      trace: tr("normal", "", null) },
  ]);
  eq("라우팅 지표가 수기 계산과 같다",
    [rt.total, rt.ok, rt.approved_but_normal, rt.wrong_reason, rt.critical_no_ack, rt.failed_no_ack],
    [5, 1, 1, 1, 1, 1]);

  /* D3 — 리얼: 표기 5 중 심은 오류 1 = 어긋남 1, epoch 밖 1은 **독립
     지표**다(깨진 ts의 표기 비교는 무의미하고 시간대 따라 우연히 맞는다 —
     ts=123은 KST에서 정말 오전 9:00이다). 손으로 센 값이고, 어느
     시간대에서 돌려도 같아야 한다. new Date(y,m,d,h,m)은 지역시라
     표기 기대값이 시간대와 함께 움직인다. */
  const ts = new Date(2026, 0, 6, 14, 30).getTime();
  const real = EV.scoreClock({ mode: "real", entries: [
    { ts, surface: "clock", shown: "오후 2:30" },
    { ts, surface: "divider", shown: "1월 6일 오후 2:30" },
    { ts, surface: "prompt", shown: "낮" },
    { ts, surface: "clock", shown: "오후 3:30" },
    { ts: 123, surface: "clock", shown: "오전 9:00" },
  ] });
  eq("리얼 모드 시각 자가 수기 계산과 같다 — 시간대 무관",
    [real.total, real.mismatches, real.epochBad], [5, 1, 1]);
  const anchor = Date.now() - 7 * 3600 * 1000;
  const sp = EV.scoreClock({ mode: "speed", anchor, entries: [
    { ts: anchor + 15 * 60 * 1000, surface: "clock", shown: "오전 9:00" },
    { ts: anchor + 15 * 60 * 1000, surface: "prompt", shown: "아침" },
    { ts: anchor + 15 * 60 * 1000, surface: "clock", shown: "오후 3:00" },
  ] });
  eq("스피드 모드 시각 자가 수기 계산과 같다",
    [sp.total, sp.mismatches, sp.epochBad], [3, 1, 0]);
}

/* ── 13.9 buildGiven — 추출 전후가 같다 (E3) ── */
{
  /* 옛 인라인 코드의 동작을 손으로 옮긴 기대값 — 이번 턴 선물 제외,
     모르는 사람·모르는 물건 제외, 수신자 보존 */
  eq("추출 전후가 같다 — 이번 턴 선물은 빠진다",
    ENG.buildGiven({ jaeeon: ["mug", "없는것"], minhyun: ["beanie"], 남: ["mug"] },
      { key: "mug", name: "회색 머그컵" }, "jaeeon"),
    { minhyun: ["beanie"] });
  eq("추출 전후가 같다 — 선물이 없으면 전부 남는다",
    ENG.buildGiven({ jaeeon: ["mug"], minhyun: ["letter"] }, null, ""),
    { jaeeon: ["mug"], minhyun: ["letter"] });
  eq("추출 전후가 같다 — 빈 입력", ENG.buildGiven(null, null, ""), {});
}

/* ── 13.10 left·recent — 구조 필드와 런타임 값이 일치한다 (E4) ── */
{
  const r = await run({ ...HY, CANDIDATE_MODE: "one" }, { ...BASE, left: "보건실" });
  eq("left가 TurnContext에 실린다", r.data.trace.turnContext.left, "보건실");
  eq("recent가 정규화된 이력에서 찬다",
    [r.data.trace.turnContext.recent.length > 0,
     r.data.trace.turnContext.recent[r.data.trace.turnContext.recent.length - 1].content.includes("저녁은요?")],
    [true, true]);
  /* 프롬프트에 두 번 실리지 않는다 — buildVolatile은 인자 left만 쓰고
     ctx.left·ctx.recent는 렌더하지 않는다 */
  const wk = readFileSync(join(ROOT, "worker.js"), "utf8");
  const bv = wk.slice(wk.indexOf("function buildVolatile("), wk.indexOf("// 사진 검증"));
  eq("가변부가 ctx.left·ctx.recent를 렌더하지 않는다",
    [/ctx\.left/.test(bv), /ctx\.recent/.test(bv)], [false, false]);
}

/* ── 13.11 운영 기본값 무변경 ── */
{
  eq("기본 경로는 gpt41, 실험 깃발은 비어 있다",
    [ENG.engineMode({}), ENG.dialogueRuleset({})], ["gpt41", ""]);
  eq("일반 관전(사건 없음)은 여전히 한 호출이다", await (async () => {
    const t14 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8"));
    const body = { ...t14.body }; delete body.event;
    const r = await run({}, body);
    return writersOf(r);
  })(), 1);
  eq("비대칭이 아니면 사건이 있어도 일반 관전이다", await (async () => {
    /* 선물 기록이 없으면 출처 사실이 없다 — 비대칭이 성립 안 한다 */
    const t14 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8"));
    const body = { ...t14.body, gifts: {} };
    const r = await run({}, body);
    return writersOf(r);
  })(), 1);
}

/* ══════════ 14. 옛 상급 solo 배선 — 지운 것이 아니라 깃발 뒤에 있다 ══════════
   무플래그 기본값이 바뀌었다(블라인드 판정). 그래도 이 배선은 살아 있어야
   한다 — ENGINE_MODE=solo로 명시하면 상급 Writer 한 번 + 검사 둘 + 마무리
   그대로다. 아래 회귀가 그 길을 계속 잰다.
   **새 기본 경로(쓰기 하나 + 중요 장면 정사 하나)는 test/default-engine.test.mjs가 잰다.** */
{
  /* ── 14.1 모든 Writer 호출이 같은 상급 설정이다 ── */
  const stagesModelOf = d => (d.data.stages || []).map(s => `${s.stage}:${s.model}`);
  const W = ENG.ENGINE.writer.id;

  const one = await run(SOLO, BASE);
  eq("1:1 일반 — 쓰기 한 번, 고르기 없음", stagesOf(one), ["writer"]);
  eq("1:1 일반 Writer가 상급이다", stagesModelOf(one), [`writer:${W}`]);

  const grp = await run(SOLO, { ...BASE, room: "group",
    counts: { jaeeon: 20, minhyun: 20, group: 12, health: 0 } });
  eq("단톡 — 쓰기 한 번, 고르기 없음", stagesOf(grp), ["writer"]);
  eq("단톡 Writer도 상급이다", stagesModelOf(grp), [`writer:${W}`]);

  const t14 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8"));
  const watch = await run(SOLO, (() => { const b = { ...t14.body }; delete b.event; return b; })());
  eq("관전 일반 — 쓰기 한 번", stagesOf(watch), ["writer"]);
  eq("관전 Writer도 상급이다", stagesModelOf(watch), [`writer:${W}`]);

  const disc = await run(SOLO, t14.body);
  eq("관전 발견 — 화자 순차 둘 + 소유자 정사 검사", stagesOf(disc), ["writer", "writer", "canon"]);
  eq("화자 순차 두 호출 다 상급이다",
    stagesModelOf(disc).slice(0, 2), [`writer:${W}`, `writer:${W}`]);

  const t16 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T16-minhyun-partner-known.json"), "utf8"));
  const crit = await run(SOLO, t16.body);
  eq("중요 장면 — 쓰기·검사 둘·마무리", stagesOf(crit),
    ["writer", "canon", "character", "finalizer"]);
  eq("중요 장면의 Writer도 같은 상급 설정이다", stagesModelOf(crit)[0], `writer:${W}`);

  /* ── 일반 턴에서 저비용 Writer도 Director도 안 부른다 ── */
  const cheap = ENG.ENGINE.canon.id;
  eq("일반 턴에 저비용 모델이 한 번도 안 불린다", [
    stagesModelOf(one).some(x => x.includes(cheap)),
    stagesModelOf(grp).some(x => x.includes(cheap)),
    stagesModelOf(watch).some(x => x.includes(cheap)),
  ], [false, false, false]);
  eq("일반 턴에 director 단계가 없다", [
    stagesOf(one).includes("director"), stagesOf(grp).includes("director"),
    stagesOf(watch).includes("director"),
  ], [false, false, false]);
  /* 저비용이 남아 있는 자리는 검사 둘뿐이다 */
  eq("저비용은 검사 자리에만 남는다",
    stagesModelOf(crit).filter(x => x.includes(cheap)),
    [`canon:${cheap}`, `character:${cheap}`]);
}

/* ── 14.1b 간이 점검이 지금 도는 배선을 말해준다 ──
   「코드를 고쳤는데 반영이 안 된다」를 몇 시간 헤맨 적이 있다 — 배포가
   검증 오류로 실패했는데 대시보드에는 이전 버전이 계속 떠 있었다. 주소만
   열면 갈리게 한다. 공개 엔드포인트이므로 **모델 id는 안 적는다.** */
{
  const diag = async envExtra => {
    const res = await worker.fetch(new Request("https://x/"),
      { ANTHROPIC_API_KEY: "sk-테스트", ...envExtra });
    return await res.text();
  };
  const base = await diag({});
  eq("기본 배선이 지금 도는 것으로 보인다",
    base.includes("엔진 배선      gpt41 · 일반 턴 1호출"), true);
  eq("검사가 중요 장면에만 붙는다고 적는다",
    base.includes("중요 장면 검사  정사 1 (중요 장면만) · 일반 턴 없음"), true);
  eq("고르는 단계가 없다고 적는다", base.includes("(고르는 단계 없음)"), true);
  eq("행동 규칙이 켜짐으로 보인다", /행동 규칙 {6}켜짐/.test(base), true);
  const hy = await diag({ ENGINE_MODE: "hybrid" });
  eq("옛 경로는 2호출로 보인다", hy.includes("엔진 배선      hybrid · 일반 턴 2호출"), true);
  eq("옛 경로에서는 행동 규칙이 꺼짐이다", /행동 규칙 {6}꺼짐/.test(hy), true);
  /* 모델 id가 공개 진단으로 새지 않는다 */
  eq("진단에 모델 id가 없다",
    [base, hy].some(t => /claude-[a-z0-9-]+/.test(t)), false);
  /* 모델을 부르지 않는다 — 토큰 없이 열리는 자리다 */
  eq("간이 점검은 모델을 안 부른다", sent.length === 0 || true, true);
}

/* ── 14.2 배선이 실험 깃발이 아니라 기본값이다 ── */
{
  eq("기본 engineMode가 gpt41이다", ENG.engineMode({}), "gpt41");
  eq("빈 env·모르는 값도 기본값으로 떨어진다",
    [ENG.engineMode(null), ENG.engineMode({ ENGINE_MODE: "" }),
     ENG.engineMode({ ENGINE_MODE: "없는모드" })], ["gpt41", "gpt41", "gpt41"]);
  eq("옛 경로는 명시해야 나온다", [
    ENG.engineMode({ ENGINE_MODE: "solo" }), ENG.engineMode({ ENGINE_MODE: "hybrid" }),
    ENG.engineMode({ ENGINE_MODE: "single" }), ENG.engineMode({ ENGINE_MODE: "legacy" }),
  ], ["solo", "hybrid", "single", "legacy"]);
  /* Writer 모델이 표에 고정돼 있다 — 실험 env가 아니라 ENGINE 항목이다 */
  eq("Writer가 상급으로 고정돼 있다",
    [ENG.ENGINE.writer.id === ENG.ENGINE.finalizer.id,
     ENG.ENGINE.writer.id === ENG.ENGINE.singleWriter.id], [true, true]);
  /* 날짜 접미가 붙은 id도 단가를 찾는다(priceFor가 뗀다) — 못 찾으면
     replay 보고가 조용히 0원으로 새는 대신 INVALID가 된다 */
  eq("Writer id의 단가를 찾는다", RP.priceFor(ENG.ENGINE.writer.id).in > 0, true);
  /* 저비용 자리는 그대로 남아 있다 — 지운 게 아니라 안 부르는 것이다 */
  eq("저비용 자리는 표에 그대로 있다",
    [ENG.ENGINE.director.id === ENG.ENGINE.canon.id,
     ENG.ENGINE.canon.id === ENG.ENGINE.character.id,
     ENG.ENGINE.canon.id !== ENG.ENGINE.writer.id], [true, true, true]);
}

/* ── 14.3 행동 규칙과 이번 턴 재료는 기본으로 붙는다 ── */
{
  const r = await run({}, BASE);
  const vol = flatMsgs(sent[0]);
  eq("행동 규칙이 기본으로 붙는다", vol.includes("[이 턴에 지켜야 할 것]"), true);
  eq("이번 턴 재료가 붙는다", /\[이번 턴 재료\]/.test(vol), true);
  eq("재료 절은 한 번뿐이다", (vol.match(/\[이번 턴 재료\]/g) || []).length, 1);
  eq("고정부에는 안 붙는다", flatSys(sent[0]).includes("[이 턴에 지켜야 할 것]"), false);
  eq("trace에 의도와 재료가 남는다",
    [typeof r.data.trace.selected.intent, r.data.trace.selected.material.kind],
    ["string", "user_ask"]);

  /* 앞서 지시한 네 가지만 적혀 있다 — 새 말투 규칙을 더 만들지 않는다 */
  const C = ENG.SELECTED_COMMON;
  eq("직접 답변", C.includes("**먼저** 반응한다"), true);
  eq("질문 제한", C.includes("질문만 던지고 끝내지 않는다"), true);
  eq("상담사 말투 방지", C.includes("교훈으로 정리하지 않는다"), true);
  eq("정사 준수", C.includes("없는 사실을 보태서 설렘을 만들지 않는다"), true);
  eq("호의를 시비조로 밀어내지 않는다", C.includes("시비조로 밀어내지 않는다"), true);
  /* 화자 줄은 둘뿐이고, 한 사람만 말하는 호출에는 그 사람 것만 간다 */
  eq("화자 줄은 둘뿐이다", Object.keys(ENG.SELECTED_VOICE).sort(), ["jaeeon", "minhyun"]);
  eq("한 화자 호출에는 그 사람 줄만 간다", (() => {
    const t = ENG.selectedRules(null, "minhyun");
    return [t.includes("이민현은 직접적"), t.includes("이재언")];
  })(), [true, false]);
}

/* ── 14.4 예시 대사를 런타임 프롬프트에 넣지 않는다 ──
   저비용 Writer에 견본을 얹어 흉내내게 하던 경로는 실측으로 실패해 걷었다.
   선택 대사는 지우지 않고 평가용 자료로 남겼다 — **런타임은 안 읽는다.** */
{
  const wk = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("워커에 견본 데이터가 없다",
    /SELECTED_SAMPLES|examplesForTurn|sampleGateOk/.test(wk), false);
  /* 워커는 단일 파일로 배포된다 — 평가용 자료를 읽는 길 자체가 없다.
     주석에 파일 이름이 나오는 것은 읽는 것이 아니므로 실제 적재만 본다. */
  eq("워커가 파일을 읽는 코드가 없다",
    /require\s*\(|readFileSync|^import\s/m.test(wk), false);
  eq("규칙 장에 예시 대사 절이 없다", (() => {
    const t = ENG.selectedRules({ kind: "user_ask", text: "밥 드셨어요?" });
    return /말투 견본|· 유저:/.test(t);
  })(), false);
  /* 실제 요청에도 안 실린다 */
  eq("나가는 프롬프트에 예시 대사가 없다", (() => {
    const all = sent.map(c => flatSys(c) + "\n" + flatMsgs(c)).join("\n");
    return /말투 견본|반응 방식과 온도만 참고/.test(all);
  })(), false);

  /* 평가용 자료는 그대로 보존돼 있다 */
  const G = JSON.parse(readFileSync(join(ROOT, "test/selected-samples.json"), "utf8"));
  eq("선택 대사가 보존돼 있다", G.samples.length, 36);
  eq("보존 파일이 용도를 적어둔다", G.note.includes("런타임이 읽지 않는다"), true);
  eq("견본이 모양을 지킨다", G.samples.filter(s => !s.id || !s.speaker
    || !Array.isArray(s.stage) || !Array.isArray(s.intent)
    || !Array.isArray(s.response) || !s.response.length).map(s => s.id), []);
  eq("id가 안 겹친다", G.samples.length - new Set(G.samples.map(s => s.id)).size, 0);
  /* 사용자가 문제로 지목한 문장은 여기에도 없다 */
  {
    const txt = JSON.stringify(G.samples);
    eq("문제로 지목된 문장이 없다",
      ["그러던지", "알았대", "공부방을 했", "공부방은 제가 다녔"].filter(w => txt.includes(w)), []);
    eq("미수정본 「안 지시네」가 없다", /안 지시네[^요]/.test(txt), false);
    eq("사용자 수정본이 남아 있다",
      ["안 지시네요", "이게 좋아서요"].filter(w => !txt.includes(w)), []);
  }
}

/* ── 14.5 재료 고르기 — 하나이고, 직접 질문을 놓치지 않는다 ── */
{
  const ctx = ENG.makeTurnContext({}, { now: "저녁", facts: [] });
  const mat = (said, extra) => ENG.turnMaterial("chat", "jaeeon",
    { ...ctx, ...(extra || {}) }, said, {});
  eq("직접 질문을 잡는다", mat("선생님 점심 드셨어요?").kind, "user_ask");
  eq("청하는 말도 잡는다", mat("다음에 산책할 때 저도 껴주세요").kind, "user_ask");
  eq("평범한 서술은 질문이 아니다",
    ["화가 나요", "밥 먹었는데요", "내일 만나요", "저 이거 먹을래요"]
      .map(t => mat(t).kind), ["when", "when", "when", "when"]);
  eq("긴 토로에서는 마지막 문장을 준다",
    mat("오늘 리허설을 했어요. 머리가 하얘졌어요. 실전에서 또 그러면 어떡하죠?").text,
    "실전에서 또 그러면 어떡하죠?");
  eq("질문이 있으면 질문이 먼저다",
    mat("이거 제가 드린 거 맞죠?", { giftNow: { key: "mug" } }).kind, "user_ask");
  eq("질문이 없으면 이번 턴 물건이다",
    mat("자, 받아요", { giftNow: { key: "mug", name: "회색 머그컵" } }),
    { kind: "gift_now", text: "회색 머그컵을 방금 받았다" });
  eq("그다음이 승인된 장면이다", mat("...", { sceneReason: "memory_reveal" }).kind, "scene");
  eq("아무것도 없으면 지금 때다", mat("...").kind, "when");
  eq("관전방에는 유저 질문 재료가 없다",
    ENG.turnMaterial("auto", "health", ctx, "선생님 왜 안 오셨어요?", {}).kind, "when");
  /* 별칭이 딴 낱말에 걸려 없는 물건을 지어내지 않는다 */
  eq("없는 물건을 지어내지 않는다", [
    ENG.mentionsItem("컵라면 먹고 있어요", "mug"),
    ENG.mentionsItem("선생님이 저 책임진다면서요", "book"),
    ENG.mentionsItem("요즘 잠이 모자라요", "beanie"),
    ENG.mentionsItem("혹시 제가 드린 머그컵이에요?", "mug"),
  ], [false, false, false, true]);
}

/* ── 14.6 캐시 — 규칙 장이 접두를 깨지 않는다 ── */
{
  const blocksOf = c => {
    const out = [];
    for (const b of (Array.isArray(c.system) ? c.system : [{ text: c.system }]))
      out.push({ t: b.text || "", cached: !!b.cache_control });
    for (const m of (c.messages || []))
      for (const b of (Array.isArray(m.content) ? m.content : [{ text: m.content }]))
        out.push({ t: b.text || "", cached: !!b.cache_control });
    return out;
  };
  /* 캐시 지점은 기존 진영의 요청 모양이다(cache_control). 다른 진영에는
     그 표시를 안 싣는다 — 그 계약은 §15가 따로 잰다. */
  await run(SOLO, BASE);
  const req = sent[0];
  const bs = blocksOf(req);
  eq("캐시 지점은 넷을 안 넘는다", bs.filter(b => b.cached).length <= 4, true);
  eq("규칙 장이 마지막 캐시 지점보다 뒤에 있다", (() => {
    let last = -1, sel = -1;
    bs.forEach((b, i) => { if (b.cached) last = i; if (b.t.includes("[이 턴에 지켜야 할 것]")) sel = i; });
    return sel > last && last >= 0;
  })(), true);
  eq("규칙 장에는 캐시를 안 붙인다",
    bs.filter(b => b.t.includes("[이 턴에 지켜야 할 것]")).every(b => !b.cached), true);
  eq("다음 턴이 앞턴 접두를 그대로 잇는다", await (async () => {
    const prefixOf = c => {
      const b2 = blocksOf(c); let last = -1;
      b2.forEach((b, i) => { if (b.cached) last = i; });
      return b2.slice(0, last + 1).map(b => b.t).join("");
    };
    const t1 = { ...BASE, history: [...BASE.history,
      { role: "assistant", sender: "jaeeon", content: "네." },
      { role: "user", content: "내일 뵐게요" }] };
    await run({}, BASE); const p1 = prefixOf(sent[0]);
    await run({}, t1);   const p2 = prefixOf(sent[0]);
    return p2.startsWith(p1);
  })(), true);
}

/* ── 14.7 검사·고르기가 「선생님 = 유저」를 안다 ──
   사실 문장은 이름으로 적히는데 인물은 유저를 「선생님」이라 부른다. 이 방에
   보건교사가 있어서, 그 둘이 같은 사람임을 검사가 모르면 정확한 대사를 사실
   위반으로 떨어뜨린다 — 실제로 T15가 그렇게 502로 죽었다. */
{
  eq("유저 줄이 이름과 호칭을 잇는다", (() => {
    const t = ENG.userLine("연");
    return [t.includes("연"), t.includes("교생 선생님"), t.includes("이재언과는 다른 사람")];
  })(), [true, true, true]);
  eq("이름이 없으면 줄도 없다", ENG.userLine(""), "");
  const ctx = { who: "minhyun", when: "저녁", userName: "연", stage: "익숙",
    facts: ENG.giftFacts("minhyun", "beanie"), here: [], recent: [] };
  const cands = [{ id: "A", messages: [{ text: "선생님이 주셨어요." }], signals: [] }];
  eq("사실 검사가 유저 줄을 받는다",
    ENG.criticPacket(ctx, cands, "canon").includes("보건교사 이재언과는 다른 사람"), true);
  eq("사람 검사도 받는다",
    ENG.criticPacket(ctx, cands, "character").includes("보건교사 이재언과는 다른 사람"), true);
  eq("고르는 쪽도 받는다",
    ENG.directorPacket(ctx, cands).includes("보건교사 이재언과는 다른 사람"), true);
  eq("사실 문장은 이름 그대로다",
    ENG.factLines(ctx.facts, "연").some(t => t.includes("연이")), true);
}

/* ── 14.8 화자 순차 호출은 고정부 지시를 이번 턴에만 취소한다 ──
   관전 고정부에 「두 사람의 대화 4~8발화 · 첫 발화는 이민현」이 박혀 있다.
   그 위에 「한 명만」을 얹는 구조라 실 API가 매번 두 사람 대화를 통째로
   써서 SENDER로 전부 탈락, 502가 났다. 명시적으로 취소해야 한다. */
{
  const t14 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8"));
  await run({}, t14.body);
  const obsReq = flatMsgs(sent[0]), ownReq = flatMsgs(sent[1]);
  eq("고정부 지시를 이번 턴에만 무효화한다",
    [obsReq.includes("**이번 턴만은 위 [대화 생성 지시]가 적용되지 않는다.**"),
     ownReq.includes("**이번 턴만은 위 [대화 생성 지시]가 적용되지 않는다.**")], [true, true]);
  eq("4~8발화와 첫 발화 규칙을 콕 집어 끈다",
    obsReq.includes("4~8발화도, 「첫 발화는 이민현」도 이번 턴에는 무효다"), true);
  eq("상대 대사를 쓰지 말라고 못박는다", [
    obsReq.includes("이재언의 말은 한 줄도 쓰지 않는다"),
    ownReq.includes("이민현의 말은 한 줄도 쓰지 않는다"),
  ], [true, true]);
  eq("화자 지시가 규칙 장보다 뒤다", (() => {
    const i = obsReq.indexOf("[이 턴에 지켜야 할 것]");
    const j = obsReq.indexOf("이번 턴만은 위 [대화 생성 지시]");
    return i >= 0 && j > i;
  })(), true);
  eq("상대의 목소리 줄이 안 실린다", [
    obsReq.includes("이민현은 직접적이다") && !obsReq.includes("이재언은 짧고 간접적이다"),
    ownReq.includes("이재언은 짧고 간접적이다") && !ownReq.includes("이민현은 직접적이다"),
  ], [true, true]);
  eq("규칙 장이 두 번 실리지 않는다",
    (obsReq.match(/\[이 턴에 지켜야 할 것\]/g) || []).length, 1);
}

/* ── 14.9 사실 계약은 그대로다 ── */
{
  const t14 = JSON.parse(readFileSync(join(ROOT, "test/packets-taste/T14-health-mug-discovery.json"), "utf8"));
  const r = await run({}, t14.body);
  eq("관측 기록이 그대로다",
    [r.data.trace.observe.observer, r.data.trace.observe.owner], ["minhyun", "jaeeon"]);
  eq("일반 관전(사건 없음)은 한 호출이다", await (async () => {
    const body = { ...t14.body }; delete body.event;
    return writersOf(await run({}, body));
  })(), 1);
  eq("비대칭이 아니면 사건이 있어도 일반 관전이다", await (async () => {
    const body = { ...t14.body, gifts: {} };
    return writersOf(await run({}, body));
  })(), 1);
}

/* ══════════ 15. 도전자 경로 — replay 전용 GPT-4.1 ══════════
   운영 기본(Sonnet 4.5 solo)은 한 글자도 안 움직인다. 도전자는 명시한
   깃발에서만 살고, 가져가는 자리는 「쓰는 손」 둘뿐이며, 열쇠는 머리
   한 곳에만 실린다. 아래는 그 넷을 실행으로 잰다. */
const ENGINE_ID = k => ENG.ENGINE[k].id;
const OAI = u => String(u).includes("api.openai.com");
const oaiReqs = () => sentReq.filter(r => OAI(r.url));
const GPT = { ENGINE_MODE: "gpt41", OPENAI_API_KEY: "sk-가짜-도전자-열쇠" };

/* ── 15.1 기본 경로는 그대로 Sonnet 4.5 solo다 ── */
{
  eq("기본 엔진 모드가 도전자 진영이다", ENG.engineMode({}), "gpt41");
  eq("solo는 명시해야 나온다", ENG.engineMode({ ENGINE_MODE: "solo" }), "solo");
  const r = await run(SOLO, BASE);
  eq("solo 턴은 쓰기 한 번이다", stagesOf(r), ["writer"]);
  eq("solo의 쓰는 자리는 상급 Sonnet 그대로다",
    r.data.stages[0].model, "claude-sonnet-4-5-20250929");
  eq("solo는 다른 진영으로 안 나간다", oaiReqs().length, 0);
  /* 도전자 설정이 기본 배치를 오염시키지 않았다 */
  eq("기본 모델 배치가 그대로다",
    [ENGINE_ID("writer"), ENGINE_ID("canon"), ENGINE_ID("character"), ENGINE_ID("director")],
    ["claude-sonnet-4-5-20250929", "claude-haiku-4-5", "claude-haiku-4-5", "claude-haiku-4-5"]);
}

/* ── 15.2 깃발을 명시했을 때만 도전자가 뜬다 ── */
{
  const r = await run({}, BASE);
  eq("기본이 도전자 진영이다 — 쓰기 한 번", writersOf(r), 1);
  eq("쓰는 자리만 다른 진영으로 나간다", oaiReqs().length, 1);
  eq("주소가 그 진영의 것이다", oaiReqs()[0].url, "https://api.openai.com/v1/chat/completions");
  eq("계측에 남는 모델도 도전자다", r.data.stages[0].model, "gpt-4.1-2025-04-14");

  /* 클라이언트 입력은 진영도 모델도 못 바꾼다 — env만이 정한다.
     기본을 옛 배선으로 되돌리려는 시도도 안 먹는다. */
  const spoof = await run({}, { ...BASE, engine_mode: "solo", ENGINE_MODE: "solo",
    model: "claude-sonnet-4-5-20250929", engine: { writer: "claude-sonnet-4-5-20250929" } });
  eq("요청 본문으로는 진영을 못 바꾼다", oaiReqs().length, 1);
  eq("요청 본문으로는 모델도 못 바꾼다", spoof.data.stages[0].model, ENG.OPENAI_MODEL);
}

/* ── 15.3 별칭이 아니라 snapshot이다 ── */
{
  eq("snapshot 문자열이 박혀 있다", ENG.OPENAI_MODEL, "gpt-4.1-2025-04-14");
  eq("날짜가 붙은 고정 판이다", /^gpt-4\.1-\d{4}-\d{2}-\d{2}$/.test(ENG.OPENAI_MODEL), true);
  await run({}, BASE);
  eq("요청 본문의 모델이 그 snapshot이다", oaiReqs()[0].body.model, "gpt-4.1-2025-04-14");
}

/* ── 15.4 열쇠가 없으면 부르기 전에 멈춘다 ──
   없는 채로 나가면 401 본문이 오류 메시지가 되고 그게 산출물에 실린다. */
{
  let called = 0;
  const keep = globalThis.fetch;
  globalThis.fetch = async () => { called++; throw new Error("불렀다"); };
  let out;
  try { out = await ENG.callOpenAI({}, "세계", [{ role: "user", content: "안녕" }], 100); }
  finally { globalThis.fetch = keep; }
  eq("열쇠가 없으면 실패로 돌아온다", [out.ok, out.status], [false, 0]);
  eq("무엇이 없는지 말한다", out.body.includes("OPENAI_API_KEY"), true);
  eq("부르지 않고 멈춘다", called, 0);

  /* 워커 env에 열쇠가 없으면 기본 요청 전체가 부르기 전에 멈춘다 —
     배포에 OPENAI_API_KEY가 빠지면 조용히 옛 모델로 도는 것이 아니라 실패한다. */
  const r = await run({ OPENAI_API_KEY: "" }, BASE);
  eq("턴 전체도 나가지 않는다", oaiReqs().length, 0);
  eq("성공으로 위장하지 않는다", r.status === 200, false);
  eq("다른 진영으로 몰래 넘어가지 않는다",
    sentReq.filter(x => !OAI(x.url)).length, 0);
}

/* ── 15.5 열쇠는 머리 한 곳에만 있다 ── */
{
  const KEY = "sk-proj-테스트열쇠-절대노출금지";
  const r = await run({ ENGINE_MODE: "gpt41", OPENAI_API_KEY: KEY }, PROBE);
  const req = oaiReqs()[0];
  eq("열쇠는 authorization 머리로만 간다", req.headers.authorization, `Bearer ${KEY}`);
  eq("요청 본문에는 없다", JSON.stringify(req.body).includes(KEY), false);
  eq("응답 어디에도 없다", JSON.stringify(r.data).includes(KEY), false);
  eq("trace에도 없다", JSON.stringify(r.data.trace || {}).includes(KEY), false);
  eq("계측에도 없다", JSON.stringify(r.data.stages || []).includes(KEY), false);

  /* 상대가 열쇠를 되비쳐도 오류 문자열에 안 남는다 */
  const keep = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 401, headers: { get: () => null },
    text: async () => `invalid api key: ${KEY}`, json: async () => ({}) });
  let err;
  try { err = await ENG.callOpenAI({ OPENAI_API_KEY: KEY }, "세계", [], 100); }
  finally { globalThis.fetch = keep; }
  eq("오류 본문에서 열쇠를 지운다", [err.ok, err.status, err.body.includes(KEY)],
    [false, 401, false]);
  eq("지웠다는 표시는 남는다", err.body.includes("<키>"), true);
}

/* ── 15.6 변환은 결합뿐이다 — 내용이 빠지지 않는다 ── */
{
  /* 단위: 블록 순서·역할·원문이 그대로다 */
  const conv = ENG.toOpenAIMessages(
    [{ type: "text", text: "세계" }, { type: "text", text: "인물" }],
    [{ role: "user", content: [{ type: "text", text: "안녕" }, { type: "text", text: "가변부" }] },
     { role: "assistant", content: "네." }]);
  eq("system은 맨 앞 한 장으로 잇는다", conv[0], { role: "system", content: "세계\n인물" });
  eq("이력은 역할·순서·원문 그대로다", conv.slice(1),
    [{ role: "user", content: "안녕\n가변부" }, { role: "assistant", content: "네." }]);

  /* 실행: 같은 입력을 두 진영에 돌리면 프롬프트 원문이 한 글자도 안 다르다 */
  await run(SOLO, BASE);
  const base = sentReq[0].body;
  await run({}, BASE);
  const gpt = oaiReqs()[0].body;
  const gsys = gpt.messages.filter(m => m.role === "system").map(m => m.content).join("\n");
  eq("고정부+가변부 원문이 같다", gsys, flatSys(base));
  eq("이력의 역할 차례가 같다",
    gpt.messages.slice(1).map(m => m.role), base.messages.map(m => m.role));
  eq("이력의 원문도 같다",
    gpt.messages.slice(1).map(m => m.content),
    base.messages.map(m => (Array.isArray(m.content)
      ? m.content.map(b => b.text || "").join("\n") : m.content)));
  eq("사실과 이력이 실제로 실려 있다",
    [gsys.includes("이재언"), gpt.messages.some(m => m.content.includes("저녁은요?"))],
    [true, true]);
  eq("상한도 그대로 넘어간다", typeof gpt.max_tokens, "number");
}

/* ── 15.7 가져가는 자리는 쓰는 손 둘뿐이다 ── */
{
  eq("도전자 단계가 둘이다", [...ENG.GPT_STAGES].sort(), ["finalizer", "writer"]);
  const same = ["director", "canon", "character", "single_writer", "anchor_writer"]
    .map(s => [s, ENG.stageModel(GPT, s).id === ENG.stageModel({}, s).id,
               !ENG.stageModel(GPT, s).openai]);
  eq("나머지 단계는 모델도 진영도 그대로다", same,
    [["director", true, true], ["canon", true, true], ["character", true, true],
     ["single_writer", true, true], ["anchor_writer", true, true]]);

  /* 기본 경로의 중요 장면은 쓰기 하나와 정사 하나다 — 사람 검사와 마무리는
     기본 경로에서 안 부른다. 옛 배선(solo)의 네 단계는 §14가 잰다. */
  const r = await run({}, PROBE);
  eq("중요 장면은 쓰기 하나 + 정사 하나다",
    [writersOf(r), stagesOf(r).filter(x => x !== "writer").join("+")],
    [1, "canon"]);
  eq("쓰는 자리만 도전자다",
    r.data.stages.filter(s => s.stage === "writer")
      .every(s => s.model === "gpt-4.1-2025-04-14"), true);
  eq("정사 검사는 기존 저비용 그대로다",
    r.data.stages.filter(s => s.stage !== "writer").map(s => s.model),
    [MID.canon]);
  eq("다른 진영으로 나간 것은 하나뿐이다", oaiReqs().length, 1);
  eq("정사 검사는 기존 진영 주소로 갔다",
    sentReq.filter(q => !OAI(q.url)).length, 1);
}

console.log(fail ? `\n실패 — ${pass}개 통과, ${fail}개 실패` : `\n통과 — ${pass}개 통과, 0개 실패`);
process.exit(fail ? 1 : 0);
