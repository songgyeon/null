#!/usr/bin/env node
/* ── 기본 운영 배선 회귀 ──
   무플래그 요청이 실제로 어떤 모델을 몇 번 부르는지 **실행으로** 잰다.
   모양 핀만으로는 안 된다 — 배선이 바뀌면 여기가 먼저 깨져야 한다.
   실 API는 부르지 않는다. */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../worker.js";
import * as ENG from "../worker.js";
import * as RP from "../tools/replay.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       실제 ${g}\n       기대 ${w}`); }
};
const realFetch = globalThis.fetch;
const OAI = u => String(u).includes("api.openai.com");

/* 검사 응답을 시험이 심을 수 있는 하네스. sent에 어디로 갔는지 남는다 */
async function run(env, body, hooks) {
  const sent = [];
  const base = RP.fakeFetch();
  const hk = k => (hooks && Array.isArray(hooks[k]) && hooks[k].length ? hooks[k].shift() : null);
  globalThis.fetch = async (url, init) => {
    const c = JSON.parse(init.body);
    const sys = OAI(url)
      ? (c.messages || []).filter(m => m.role === "system").map(m => m.content).join("\n")
      : (Array.isArray(c.system) ? c.system : [{ text: c.system }]).map(b => b.text || "").join("\n");
    const stage = sys.includes("너는 이 세계의 사실만 본다") ? "canon"
      : sys.includes("이 사람이 이 사람다운지만 본다") ? "character"
      : sys.includes("이 장면의 마지막 손이다") ? "finalizer"
      : sys.includes("대사를 쓰지 않는다 — 고르기만 한다")
        || sys.includes("SELECT_A · SELECT_B · RETRY") ? "director" : "writer";
    sent.push({ stage, oai: OAI(url), model: c.model });
    const inject = hk(stage);
    if (inject != null) {
      const shape = OAI(url)
        ? { model: c.model, choices: [{ message: { content: inject } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, prompt_tokens_details: { cached_tokens: 0 } } }
        : { content: [{ type: "text", text: inject }],
            usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: "end_turn" };
      return { ok: true, status: 200, headers: { get: () => null },
        json: async () => shape, text: async () => "" };
    }
    return base(url, init);
  };
  try {
    const res = await worker.fetch(
      new Request("https://x/?k=k", { method: "POST", body: JSON.stringify(body),
        headers: { "CF-Connecting-IP": `9.5.${Math.floor(Math.random() * 200)}.1` } }),
      { ANTHROPIC_API_KEY: "sk-t", ACCESS_KEY: "k", TRACE: "1",
        OPENAI_API_KEY: "sk-fake", ...env });
    return { status: res.status, data: await res.json(), sent };
  } finally { globalThis.fetch = realFetch; }
}
const load = (d, f) => JSON.parse(readFileSync(join(ROOT, d, f), "utf8"));
const P = (d, f) => load(d, f).body;
const N01 = P("test/packets-deep", "N01-jaeeon-care.json");
const N07 = P("test/packets-deep", "N07-minhyun-why.json");
const N11 = P("test/packets-deep", "N11-group-movie.json");
const C01 = P("test/packets-deep", "C01-memory-before.json");
const T14 = P("test/packets-taste", "T14-health-mug-discovery.json");
const T15 = P("test/packets-taste", "T15-health-beanie-discovery.json");
const T16 = P("test/packets-taste", "T16-minhyun-partner-known.json");
/* 관전 일반 — 사건이 없으면 발견 갈래가 아니다 */
const WATCH = (() => { const b = { ...T14 }; delete b.event; return b })();
const stagesOf = r => r.sent.map(s => s.stage);

console.log("── 경로별 단계 ──");
{
  /* 일반 턴은 쓰는 자리 한 번이다. 중요 장면에만 정사 검사 하나가 붙는다.
     실행으로 잰다 — 모양 핀만으로는 배선이 바뀌어도 안 깨진다. */
  const a = await run({}, N01);
  eq("1:1 일반 — writer 하나", stagesOf(a), ["writer"]);
  eq("1:1 일반 — 기존 진영을 아예 안 부른다", a.sent.filter(s => !s.oai).length, 0);
  const b = await run({}, N11);
  eq("단톡 일반 — writer 하나", stagesOf(b), ["writer"]);
  eq("단톡 일반 — 기존 진영을 안 부른다", b.sent.filter(s => !s.oai).length, 0);
  const c = await run({}, WATCH);
  eq("관전 일반 — writer 하나", stagesOf(c), ["writer"]);
  eq("관전 일반 — 기존 진영을 안 부른다", c.sent.filter(s => !s.oai).length, 0);
  const d = await run({}, C01);
  eq("중요 장면 — writer → 정사 검사", stagesOf(d), ["writer", "canon"]);
  eq("중요 장면 — 라우팅이 critical", d.data.trace.route.tier, "critical");
  const e = await run({}, T14);
  eq("비대칭 발견 — 관측자·소유자 writer 둘과 canon 하나",
    stagesOf(e), ["writer", "writer", "canon"]);
  eq("발견 장면의 두 화자가 같은 진영이다",
    e.sent.filter(s => s.stage === "writer").every(s => s.oai), true);
  const f = await run({}, T15);
  eq("T15도 같은 모양이다", stagesOf(f), ["writer", "writer", "canon"]);
  const g = await run({}, T16);
  eq("T16 partner_known — writer → 정사 검사", stagesOf(g), ["writer", "canon"]);
  eq("T16 승인 사유가 남는다", g.data.trace.route.reason, "partner_known");
}

console.log("── 모델 배치 ──");
{
  const r = await run({}, C01);
  const w = r.sent.filter(s => s.stage === "writer");
  const c = r.sent.filter(s => s.stage === "canon");
  eq("무플래그 Writer가 도전자 진영이다", w.every(s => s.oai), true);
  eq("Writer 모델이 snapshot 고정이다", w[0].model, ENG.OPENAI_MODEL);
  eq("정사 검사만 저비용 기존 모델이다",
    [c.length, c.every(x => !x.oai), c[0].model], [1, true, ENG.ENGINE.canon.id]);
  eq("engineMode 기본값", ENG.engineMode({}), "gpt41");
}

console.log("── 기본 경로에서 사라진 것 ──");
{
  const names = [];
  for (const b of [N01, N11, WATCH, C01, T14, T15, T16])
    names.push(...(await run({}, b)).sent.map(s => s.stage));
  eq("director 호출", names.filter(x => x === "director").length, 0);
  eq("finalizer 호출", names.filter(x => x === "finalizer").length, 0);
  /* 사람 검사(Character)는 기본 운영 경로 어디에도 없다. 코드·규칙표·
     호출부는 그대로 있고, 옛 배선과 실험 경로만 쓴다 */
  eq("character 호출", names.filter(x => x === "character").length, 0);
  /* 정사 검사는 승인된 중요 장면과 발견 장면에만 — 일곱 갈래 중 넷 */
  eq("정사 검사는 중요 장면에만", names.filter(x => x === "canon").length, 4);
  /* 일반 세 갈래는 통째로 한 호출이다 */
  const normals = [];
  for (const b of [N01, N11, WATCH]) normals.push(...(await run({}, b)).sent.map(s => s.stage));
  eq("일반 세 갈래는 writer 셋이 전부다", normals, ["writer", "writer", "writer"]);
}

console.log("── 재시도 계약 ──");
{
  /* 정사 탈락 → 같은 진영 Writer로 한 번만 다시 쓴다. Canon도 한 번 더 */
  const bad = JSON.stringify({ problems: [{ candidate: "A", critic: "canon",
    code: "FACT_DENIAL", fact_id: "canon.jaeeon.study_room_attended" }] });
  const r = await run({}, C01, { canon: [bad] });
  eq("정사 탈락 → 쓰기 두 번·검사 두 번",
    stagesOf(r), ["writer", "canon", "writer", "canon"]);
  eq("두 번째도 같은 진영 Writer다",
    r.sent.filter(s => s.stage === "writer").every(s => s.oai), true);
  /* 두 번 다 탈락하면 502 — 다른 모델로 대체하지 않는다 */
  const r2 = await run({}, C01, { canon: [bad, bad] });
  eq("두 번 다 탈락이면 502다", r2.status, 502);
  eq("대체 모델을 안 부른다",
    [...new Set(stagesOf(r2))].sort(), ["canon", "writer"]);
  eq("실패 응답에 Effect가 없다", (r2.data.effects || []).length, 0);
  eq("실패해도 장면 사유는 살아 있다", r2.data.trace.route.reason, "memory_reveal");
  /* 말투·관계 속도·질문 수로는 아무것도 안 버린다 — 사람 검사가 기본
     경로에서 아예 안 돌기 때문이다. 심어놔도 쓰이지 않는다. */
  const badVoice = JSON.stringify({ problems: [{ candidate: "A", critic: "character",
    code: "VOICE_BREAK", rule_id: "minhyun.ask.stops_at_two" }] });
  const r3 = await run({}, N01, { character: [badVoice, badVoice] });
  eq("일반 턴은 말투 판정 자체가 없다",
    [stagesOf(r3), r3.status], [["writer"], 200]);
  const r4 = await run({}, C01, { character: [badVoice, badVoice] });
  eq("중요 장면에도 사람 검사는 안 붙는다",
    [stagesOf(r4), r4.status], [["writer", "canon"], 200]);
}

console.log("── Canon 판정의 한계 ──");
{
  /* packet에 없는 fact_id는 판정으로 믿지 않는다 */
  const bogus = JSON.stringify({ problems: [{ candidate: "A", critic: "canon",
    code: "FACT_DENIAL", fact_id: "canon.지어낸.사실" }] });
  const r = await run({}, C01, { canon: [bogus] });
  eq("무효 fact_id는 판정으로 안 믿는다 — 스키마 어긋남으로 다시 쓴다",
    stagesOf(r).filter(x => x === "writer").length, 2);
  const src = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("검사는 중요 장면에만 붙는 배선이다",
    /const canonOnly = em === "gpt41";/.test(src)
    && /if \(tier === "critical"\) \{/.test(src)
    && !/criticsAll/.test(src), true);
  /* 지우지 않았다는 것도 함께 잰다 — 코드·규칙표·호출부는 그대로 있다 */
  eq("사람 검사 코드는 지우지 않았다",
    [/const CHAR_CRITIC = /.test(src), /const CHAR_RULES = /.test(src),
     /const CHAR_CODES = /.test(src), /callStage\(env, meter, "character"/.test(src)],
    [true, true, true, true]);
}

console.log("── sonnet45: 배선은 그대로, 쓰는 손만 ──");
{
  /* 쓰는 손을 되돌려 보는 깃발이다. 여기서 재는 것은 말맛이 아니라
     **배선이 한 군데도 안 움직였다**는 것 하나다 — 그게 아니면 나온 대사의
     차이를 모델 탓으로 읽을 수가 없다. 옛 solo로 돌아가면 사람 검사와
     마무리가 같이 켜져서 그 비교가 성립하지 않는다(바로 위 블록 참고). */
  const PACKETS = [["1:1", N01], ["단톡", N11], ["관전", WATCH],
                   ["중요 장면", C01], ["발견 T14", T14], ["발견 T15", T15],
                   ["T16", T16]];
  for (const [label, body] of PACKETS) {
    const base = await run({}, body);
    for (const flag of ["sonnet45", "sonnet5", "sonnet46"]) {
      const r = await run({ ENGINE_MODE: flag }, body);
      eq(`${label} · ${flag} — 단계가 무플래그와 같다`, stagesOf(r), stagesOf(base));
      eq(`${label} · ${flag} — 응답 코드가 같다`, r.status, base.status);
    }
  }
  /* 쓰는 자리만 갈린다. 검사는 저쪽이나 이쪽이나 같은 Haiku다 */
  const c = await run({ ENGINE_MODE: "sonnet45" }, C01);
  eq("sonnet45의 쓰는 자리는 Sonnet 4.5다",
    c.sent.filter(x => x.stage === "writer").map(x => x.model),
    ["claude-sonnet-4-5-20250929"]);
  eq("sonnet45의 정사 검사는 그대로 Haiku다",
    c.sent.filter(x => x.stage === "canon").map(x => x.model), ["claude-haiku-4-5"]);
  eq("sonnet45는 저쪽 진영을 안 부른다", c.sent.filter(x => x.oai).length, 0);
  eq("무플래그의 쓰는 자리는 저쪽이다", (await run({}, C01)).sent
    .filter(x => x.stage === "writer").every(x => x.oai), true);
  /* 이름을 그대로 「gpt41」로 적으면 대시보드가 거짓말을 한다 */
  eq("trace에 sonnet45라고 적는다", c.data.trace.engine_mode, "sonnet45");
  eq("trace의 쓰는 모델도 적힌다", c.data.trace.writer_model, "claude-sonnet-4-5-20250929");
  eq("무플래그 trace는 gpt41 그대로다", (await run({}, C01)).data.trace.engine_mode, "gpt41");
  /* 배선 판정은 전부 engineMode를 본다 — sonnet45는 거기서 gpt41을 돌려준다 */
  eq("깃발은 배선을 안 건드린다",
    [ENG.engineMode({ ENGINE_MODE: "sonnet45" }), ENG.writerSeat({ ENGINE_MODE: "sonnet45" }),
     ENG.engineLabel({ ENGINE_MODE: "sonnet45" })], ["gpt41", "sonnet", "sonnet45"]);
  eq("다른 갈래는 제 모델을 그대로 쓴다",
    ["solo", "hybrid", "single", "legacy"].map(v => ENG.writerSeat({ ENGINE_MODE: v })),
    ["own", "own", "own", "own"]);

  /* ── 같은 자리에 앉는 세 번째 손 ── */
  const c5 = await run({ ENGINE_MODE: "sonnet5" }, C01);
  eq("sonnet5의 쓰는 자리는 최상급이다",
    c5.sent.filter(x => x.stage === "writer").map(x => x.model), ["claude-sonnet-5"]);
  eq("sonnet5의 정사 검사도 그대로 저비용이다",
    c5.sent.filter(x => x.stage === "canon").map(x => x.model), ["claude-haiku-4-5"]);
  eq("sonnet5도 저쪽 진영을 안 부른다", c5.sent.filter(x => x.oai).length, 0);
  eq("sonnet5 trace 이름", c5.data.trace.engine_mode, "sonnet5");
  eq("sonnet5 trace의 쓰는 모델", c5.data.trace.writer_model, "claude-sonnet-5");
  /* payload가 맨몸이라야 한다 — 이 세대는 수동 thinking·비기본 샘플링에 400을 낸다.
     자리표에서 재는 게 아니라 실제로 나간 요청 본문에서 잰다. */
  const w5 = ENG.ENGINE.writer5;
  eq("최상급 자리는 등록된 id를 재사용한다", w5.id, "claude-sonnet-5");
  eq("최상급 자리는 thinking·effort를 안 싣는다", [w5.noThinking, w5.effort, w5.budget],
    [false, null, undefined]);
  /* 차상급 자리도 같은 모양이다. 사고는 끈다 — 지금 쓰는 자리(상급)와 같은
     payload라야 비교에서 바뀌는 것이 모델 하나로 유지된다 */
  const c46 = await run({ ENGINE_MODE: "sonnet46" }, C01);
  eq("sonnet46의 쓰는 자리는 차상급이다",
    c46.sent.filter(x => x.stage === "writer").map(x => x.model), ["claude-sonnet-4-6"]);
  eq("sonnet46의 정사 검사도 그대로 저비용이다",
    c46.sent.filter(x => x.stage === "canon").map(x => x.model), ["claude-haiku-4-5"]);
  eq("sonnet46 trace 이름", c46.data.trace.engine_mode, "sonnet46");
  const w46 = ENG.ENGINE.writer46;
  eq("차상급 자리는 등록된 id를 재사용한다", w46.id, "claude-sonnet-4-6");
  eq("차상급 자리는 사고를 끈다", [w46.noThinking, w46.effort, w46.budget],
    [true, null, undefined]);
  /* 네 손이 같은 자리(GPT_STAGES)를 갈아끼운다 — 검사 자리는 어느 손에서도 안 바뀐다 */
  const SEATS = ["", "sonnet45", "sonnet5", "sonnet46"];
  eq("네 손이 같은 자리를 갈아끼운다",
    SEATS.map(v => ENG.stageModel(v ? { ENGINE_MODE: v } : {}, "writer").id),
    [ENG.OPENAI_MODEL, "claude-sonnet-4-5-20250929", "claude-sonnet-5", "claude-sonnet-4-6"]);
  eq("검사 자리는 네 손 모두 같다",
    SEATS.map(v => ENG.stageModel(v ? { ENGINE_MODE: v } : {}, "canon").id),
    SEATS.map(() => "claude-haiku-4-5"));
  /* 목록에 없는 이름은 오류가 아니라 조용히 기본값이다. 그 사실을 못박아둔다 —
     「바꿨는데 왜 그대로지」를 헤매는 자리라, 모양이 바뀌면 여기가 말해준다 */
  eq("모르는 이름은 조용히 기본값으로 떨어진다",
    ["sonnet46 ", "SONNET46", "46", "sonnet-4-6", "오타"]
      .map(v => ENG.engineLabel({ ENGINE_MODE: v })),
    ["sonnet46", "sonnet46", "gpt41", "gpt41", "gpt41"]);
}

console.log("── 옛 배선은 살아 있다 ──");
{
  eq("solo를 명시하면 상급 Writer다", ENG.stageModel({ ENGINE_MODE: "solo" }, "writer").id,
    "claude-sonnet-4-5-20250929");
  const r = await run({ ENGINE_MODE: "solo" }, C01);
  eq("solo의 중요 장면은 검사 둘 + 마무리다",
    stagesOf(r), ["writer", "canon", "character", "finalizer"]);
  eq("solo는 다른 진영을 안 부른다", r.sent.filter(s => s.oai).length, 0);
  const h = await run({ ENGINE_MODE: "hybrid", CANDIDATE_MODE: "pair" }, N01);
  eq("hybrid는 고르는 쪽이 그대로 있다", stagesOf(h), ["writer", "director"]);
  eq("pure 실험(NO_CRITICS)은 검사를 아예 안 부른다",
    stagesOf(await run({ NO_CRITICS: "1" }, C01)), ["writer"]);
}

console.log("── 첫 만남: 말한 것과 통한 것 ──");
{
  /* N07은 이미 firstContact:"explained"다 — 민현이 병원 옥상을 말한 뒤다.
     여기서 움직이는 것은 유저 쪽이고, 이번 턴 유저 발화만 본다. */
  const say = text => {
    const b = JSON.parse(JSON.stringify(N07));
    b.history = [...b.history.slice(0, -1), { role: "user", sender: "user", content: text }];
    return b;
  };
  const fcOf = r => (r.data.effects || [])
    .filter(e => e.type === "story_transition" && e.key === "firstContact")
    .map(e => `${e.from}→${e.to}`);
  eq("받아들이면 한 칸 간다",
    fcOf(await run({}, say("아 그때 그 사람이구나. 기억은 안 나는데."))),
    ["explained→recognized"]);
  eq("부정하면 안 움직인다",
    fcOf(await run({}, say("사람 잘못 보신 것 같은데요."))), []);
  eq("아무 상관 없는 말에도 안 움직인다",
    fcOf(await run({}, say("오늘 급식 뭐였어요?"))), []);
  /* 이미 통한 뒤에는 두 번 안 낸다 — 뒤로도 못 가고 같은 칸도 다시 안 찍는다 */
  const done = JSON.parse(JSON.stringify(say("아 그때 그 사람이구나.")));
  done.story = { ...done.story, firstContact: "recognized" };
  eq("이미 통했으면 다시 안 찍는다", fcOf(await run({}, done)), []);
  /* 사실이 상태마다 다르게 실린다 — 「설명했다」와 「받아들였다」는 다른 줄 */
  const factsOf = b => {
    const r = { ids: [] };
    return run({}, b).then(x => {
      r.ids = ((x.data.trace.turnContext || {}).facts || []).map(f => f.fact_id);
      return r.ids;
    });
  };
  eq("explained에는 미확인 줄이 실린다",
    (await factsOf(say("네."))).includes("story.first_contact.explained"), true);
  eq("recognized에는 받아들인 줄이 실린다",
    (await factsOf(done)).includes("story.first_contact.recognized"), true);
  eq("두 줄이 같이 실리지는 않는다",
    (await factsOf(done)).includes("story.first_contact.explained"), false);
}

console.log("── 잠긴 자리 제안 (invite) ──");
{
  /* 아직 안 열린 자리를 대사가 입에 올려도 그 턴은 그대로 나간다.
     억제되는 것은 구조화된 invite Effect 하나뿐이다. */
  const locked = JSON.stringify({ invite: "빨래방", messages: ["같이 갈래요?"] });
  const r = await run({}, N01, { writer: [locked] });
  eq("잠긴 자리를 제안해도 200이다", r.status, 200);
  eq("다시 쓰지 않는다", stagesOf(r).filter(x => x === "writer").length, 1);
  eq("대사는 그대로 나간다",
    (r.data.messages || []).some(m => String(m.text || "").includes("같이 갈래요?")), true);
  eq("invite Effect는 안 생긴다",
    (r.data.effects || []).filter(e => e.type === "invite").length, 0);
  eq("억제 기록이 trace에 남는다",
    (r.data.trace.invite_suppressed || []).map(x => x.place), ["빨래방"]);
  /* 자연어를 정규식으로 지우지 않는다 — 원문 문장이 그대로 있다 */
  const src = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("hardFilter에 INVALID_INVITE 코드가 없다",
    /push\("INVALID_INVITE"\)/.test(src), false);
  eq("give는 그대로 탈락이다 — 물건은 실제로 오간다",
    /push\("INVALID_GIVE"\)/.test(src), true);
}

console.log("── pure 블라인드와 운영의 Writer 프롬프트가 같다 ──");
{
  /* 비교 실험(pure)과 운영이 같은 글을 보내는지 실행으로 잰다. 다르면
     블라인드 결과를 운영 판단에 못 쓴다. */
  const cap = async env => {
    const got = [];
    const realFetch = globalThis.fetch;
    const base = RP.fakeFetch();
    globalThis.fetch = async (u, init) => {
      if (String(u).includes("api.openai.com")) {
        const c = JSON.parse(init.body);
        got.push({ model: c.model, temperature: c.temperature,
          max_tokens: c.max_tokens ?? c.max_completion_tokens, messages: c.messages });
      }
      return base(u, init);
    };
    try {
      await worker.fetch(new Request("https://x/?k=k", { method: "POST", body: JSON.stringify(N01),
        headers: { "CF-Connecting-IP": "9.5.7.1" } }),
        { ANTHROPIC_API_KEY: "sk-t", ACCESS_KEY: "k", OPENAI_API_KEY: "sk-fake", ...env });
    } finally { globalThis.fetch = realFetch; }
    return got;
  };
  const pure = await cap({ NO_FINALIZER: "1", NO_CRITICS: "1" });
  const ops = await cap({});
  eq("두 경로의 Writer 요청이 바이트로 같다",
    JSON.stringify(pure) === JSON.stringify(ops), true);
  eq("temperature를 어느 쪽도 안 정한다",
    [pure[0].temperature, ops[0].temperature], [undefined, undefined]);
  /* 심사 규칙이 쓰는 자리에 섞이면 안 된다 — 판정 어휘를 보고 쓰게 된다 */
  const sys = ops[0].messages.filter(m => m.role === "system").map(m => m.content).join("\n");
  eq("Writer 프롬프트에 심사 코드·id가 없다",
    ["RELATIONSHIP_SPEED", "VOICE_BREAK", "stops_at_two", "COUNSELOR_TONE", "USER_PUPPETRY",
     "DESIRE_BREAK", "EXPOSITION", "FACT_DENIAL", "rule_id", "fact_id", "reject_codes"]
      .filter(k => sys.includes(k)), []);
}

console.log("── 아직 학교에서 만나기 전 ──");
{
  /* 그 규칙은 세계관 호칭 절에 있다 — 늘 실리고, 방마다 따로 붙는
     조건부 덩어리는 없다. 같은 말이 두 군데 있으면 한쪽만 고쳐진다. */
  const src = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("문장이 저장소에 한 번만 있다",
    (src.match(/처음부터 교생인 걸 아는 게 아니라 '학교'에서 만난 뒤부터/g) || []).length, 1);
  eq("유저가 먼저 꺼내면 예외다", src.includes(
    '학교가 아닌 장소에서 세계가 시작될 경우 유저를 "선생님"이라고 부르지 않는다.'), true);

  /* ── 규칙에는 조건이 달려 있다. 그 조건이 참이라는 것을 알려주는 것은
     사실이다 ── 이게 없으면 모델은 조건을 판정할 수 없어 조건절을 버리고
     앞 문장(「호칭은 선생님이다」)만 읽는다. 규칙을 넣어도 안 듣던 까닭. */
  const sentOf2 = async (body) => {
    let out = "";
    const realFetch = globalThis.fetch;
    const base = RP.fakeFetch();
    globalThis.fetch = async (u, init) => {
      if (String(u).includes("api.openai.com") && !out) out = init.body;
      return base(u, init);
    };
    try {
      await worker.fetch(new Request("https://x/?k=k", { method: "POST", body: JSON.stringify(body),
        headers: { "CF-Connecting-IP": "9.5.7.1" } }),
        { ANTHROPIC_API_KEY: "sk-t", ACCESS_KEY: "k", OPENAI_API_KEY: "sk-fake" });
    } finally { globalThis.fetch = realFetch; }
    return out;
  };
  const withMet2 = (body, sm) => {
    const b = JSON.parse(JSON.stringify(body));
    if (sm) b.story = { ...(b.story || {}), schoolMet: sm };
    else if (b.story) delete b.story.schoolMet;
    return b;
  };
  const YET = "아직 학교에서 만나지 않았다";
  eq("아직 안 만났으면 그 사실이 실린다",
    (await sentOf2(withMet2(N07, { jaeeon: false, minhyun: false }))).includes(YET), true);
  eq("학교에서 만난 뒤에는 안 실린다",
    (await sentOf2(withMet2(N07, { jaeeon: false, minhyun: true }))).includes(YET), false);
  /* 사람마다 따로 선다 — known_by가 그 사람이라 남의 방에는 안 샌다 */
  eq("남의 몫은 이 방에 안 샌다",
    (await sentOf2(withMet2(N07, { jaeeon: false, minhyun: true }))).includes("이재언은 유저를 아직"), false);
  eq("안 실려 온 판은 아무것도 안 낸다",
    (await sentOf2(withMet2(N07, null))).includes(YET), false);
  eq("사실이지 규칙이 아니다 — 문장에 지시가 없다",
    ENG.storyFacts(ENG.makeStoryState({ schoolMet: { jaeeon: false, minhyun: false } }))
      .filter(f => /school_met/.test(f.fact_id))
      .every(f => f.source === "state" && !/않는다\.|말라|하지 마/.test(f.value)), true);
}

console.log("── 민현 행동축 ──");
{
  const AXIS = "민현의 장난은 관심을 확인하려는 시도다";
  const sysOf = async body => {
    let sys = "";
    const realFetch = globalThis.fetch;
    const base = RP.fakeFetch();
    globalThis.fetch = async (u, init) => {
      if (String(u).includes("api.openai.com") && !sys) {
        const c = JSON.parse(init.body);
        sys = c.messages.filter(m => m.role === "system").map(m => m.content).join("\n");
      }
      return base(u, init);
    };
    try {
      await worker.fetch(new Request("https://x/?k=k", { method: "POST", body: JSON.stringify(body),
        headers: { "CF-Connecting-IP": "9.5.7.1" } }),
        { ANTHROPIC_API_KEY: "sk-t", ACCESS_KEY: "k", OPENAI_API_KEY: "sk-fake" });
    } finally { globalThis.fetch = realFetch; }
    return sys;
  };
  eq("민현 1:1에 행동축이 실린다", (await sysOf(N07)).includes(AXIS), true);
  eq("재언 1:1에는 안 실린다 — 1:1은 그 화자 것만", (await sysOf(N01)).includes(AXIS), false);
  eq("단톡에는 실린다", (await sysOf(N11)).includes(AXIS), true);
  const src = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("세 문장이 그대로 있다", src.includes(
    "민현의 장난은 관심을 확인하려는 시도다. 유저가 당황하거나 불쾌해하면 맞받아치거나 평가하지 않고 장난을 거두고 짧게 인정하거나 사실을 설명하며 물러선다. 관계 초기에는 친분·약속·반복된 일상·상대 성격을 이미 아는 것처럼 말하지 않는다."), true);
}

console.log("── 프롬프트에 더한 두 덩어리 ──");
{
  const src = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("직접 반응", src.includes(
    "사용자가 방금 한 말의 핵심에 먼저 직접 반응한다. 감정을 상담사처럼 다시 요약하거나 원인을 분석하는 질문으로 돌리지 않는다."), true);
  eq("주어진 사실 안에서 전진", src.includes(
    "아직 실행되지 않은 제안이나 약속은 제안 상태로 둔다."), true);
  /* 견본 대사·고정 대사·새 금지어 목록을 안 만들었다 */
  eq("예시 대사를 안 넣었다", /\[좋은 예\]|\[예시\]|예시 대사/.test(src), false);
}
console.log(fail ? `\n실패 — ${pass}개 통과, ${fail}개 실패` : `\n통과 — ${pass}개 통과, 0개 실패`);
process.exit(fail ? 1 : 0);
