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
  /* 검사 둘이 모든 턴에 붙는다. 순서는 나란히 부르므로 도착 순이 갈릴 수
     있어 정렬해서 본다 — 재는 것은 「무엇이 몇 번 불렸나」다. */
  const setOf = r => stagesOf(r).slice().sort().join("+");
  const a = await run({}, N01);
  eq("1:1 일반 — writer + 검사 둘", setOf(a), "canon+character+writer");
  eq("1:1 일반 — 기존 진영은 검사 둘뿐", a.sent.filter(s => !s.oai).map(s => s.stage).sort(),
    ["canon", "character"]);
  const b = await run({}, N11);
  eq("단톡 일반 — writer + 검사 둘", setOf(b), "canon+character+writer");
  const c = await run({}, WATCH);
  eq("관전 일반 — writer + 검사 둘", setOf(c), "canon+character+writer");
  const d = await run({}, C01);
  eq("중요 장면 — writer + 검사 둘", setOf(d), "canon+character+writer");
  eq("중요 장면 — 라우팅이 critical", d.data.trace.route.tier, "critical");
  const e = await run({}, T14);
  eq("비대칭 발견 — 관측자·소유자 writer 둘과 canon 하나",
    stagesOf(e), ["writer", "writer", "canon"]);
  eq("발견 장면의 두 화자가 같은 진영이다",
    e.sent.filter(s => s.stage === "writer").every(s => s.oai), true);
  const f = await run({}, T15);
  eq("T15도 같은 모양이다", stagesOf(f), ["writer", "writer", "canon"]);
  const g = await run({}, T16);
  eq("T16 partner_known — writer + 검사 둘", setOf(g), "canon+character+writer");
  eq("T16 승인 사유가 남는다", g.data.trace.route.reason, "partner_known");
}

console.log("── 모델 배치 ──");
{
  const r = await run({}, C01);
  const w = r.sent.filter(s => s.stage === "writer");
  const c = r.sent.filter(s => s.stage === "canon");
  eq("무플래그 Writer가 도전자 진영이다", w.every(s => s.oai), true);
  eq("Writer 모델이 snapshot 고정이다", w[0].model, ENG.OPENAI_MODEL);
  eq("검사 둘만 저비용 기존 모델이다",
    [c.length, c.every(x => !x.oai), c[0].model], [1, true, ENG.ENGINE.canon.id]);
  const ch = r.sent.filter(s => s.stage === "character");
  eq("사람 검사도 저비용이다", [ch.length, ch[0].model], [1, ENG.ENGINE.character.id]);
  eq("engineMode 기본값", ENG.engineMode({}), "gpt41");
}

console.log("── 기본 경로에서 사라진 것 ──");
{
  const names = [];
  for (const b of [N01, N11, WATCH, C01, T14, T15, T16])
    names.push(...(await run({}, b)).sent.map(s => s.stage));
  eq("director 호출", names.filter(x => x === "director").length, 0);
  eq("finalizer 호출", names.filter(x => x === "finalizer").length, 0);
  /* 검사 둘은 모든 턴에 붙는다 — 발견 장면은 소유자 정사가 하나 더 붙는다 */
  eq("검사 둘이 모든 턴에 붙는다", [
    names.filter(x => x === "canon").length,
    names.filter(x => x === "character").length,
  ], [7, 5]);
}

console.log("── 재시도 계약 ──");
{
  /* 정사 탈락 → 같은 진영 Writer로 한 번만 다시 쓴다. Canon도 한 번 더 */
  const bad = JSON.stringify({ problems: [{ candidate: "A", critic: "canon",
    code: "FACT_DENIAL", fact_id: "canon.jaeeon.study_room_attended" }] });
  const r = await run({}, C01, { canon: [bad] });
  eq("정사 탈락 → 쓰기 두 번·검사 두 벌",
    stagesOf(r).slice().sort().join("+"),
    "canon+canon+character+character+writer+writer");
  eq("두 번째도 같은 진영 Writer다",
    r.sent.filter(s => s.stage === "writer").every(s => s.oai), true);
  /* 두 번 다 탈락하면 502 — 다른 모델로 대체하지 않는다 */
  const r2 = await run({}, C01, { canon: [bad, bad] });
  eq("두 번 다 탈락이면 502다", r2.status, 502);
  eq("대체 모델을 안 부른다",
    [...new Set(stagesOf(r2))].sort(), ["canon", "character", "writer"]);
  eq("실패 응답에 Effect가 없다", (r2.data.effects || []).length, 0);
  eq("실패해도 장면 사유는 살아 있다", r2.data.trace.route.reason, "memory_reveal");
  /* 말투 불만으로는 재시도하지 않는다 — 사람 검사가 아예 안 돈다 */
  /* 말투 문제도 이제 탈락이다 — 검사를 달았으면 결과에 영향이 있어야 한다 */
  const badVoice = JSON.stringify({ problems: [{ candidate: "A", critic: "character",
    code: "VOICE_BREAK", rule_id: "minhyun.ask.stops_at_two" }] });
  const r3 = await run({}, N01, { character: [badVoice] });
  eq("일반 턴의 말투 탈락도 다시 쓴다",
    stagesOf(r3).filter(x => x === "writer").length, 2);
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
  eq("검사 둘을 모든 턴에 다는 배선이다",
    /const criticsAll = em === "gpt41";/.test(src)
    && /if \(tier === "critical" \|\| criticsAll\) \{/.test(src), true);
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
