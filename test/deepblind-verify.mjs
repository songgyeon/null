#!/usr/bin/env node
/* ── 심화 블라인드 비교 — 실 API 전 검증 ──
   계약이 요구한 열두 가지를 실행으로 증명한다. 하나라도 실패하면 실제
   호출을 하지 않는다. 모양 핀만으로는 안 된다 — 워커를 통째로 굴려서 잰다. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
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
const OUT = join(ROOT, "replay-out-deepblind-fake");
if (!existsSync(OUT)) { console.error("먼저 node tools/deepblind.mjs --fake 를 돌려라"); process.exit(1); }

/* ── 워커를 직접 굴리는 하네스. 나가는 요청을 전부 적어둔다 ── */
const realFetch = globalThis.fetch;
async function run(env, body) {
  const sent = [];
  const base = RP.fakeFetch();
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(init.body) });
    return base(url, init);
  };
  try {
    const res = await worker.fetch(
      new Request("https://x/?k=k", { method: "POST", body: JSON.stringify(body),
        headers: { "CF-Connecting-IP": `9.9.${Math.floor(Math.random() * 200)}.1` } }),
      { ANTHROPIC_API_KEY: "sk-t", ACCESS_KEY: "k", TRACE: "1", ...env });
    return { status: res.status, data: await res.json(), sent };
  } finally { globalThis.fetch = realFetch; }
}
const ENV_G = { ENGINE_MODE: "gpt41", NO_FINALIZER: "1", OPENAI_API_KEY: "sk-fake" };
const ENV_S = { NO_FINALIZER: "1" };
/* 나간 요청의 프롬프트를 진영과 무관한 한 덩어리로 편다 */
const flat = req => {
  const c = req.body;
  if (String(req.url).includes("openai"))
    return (c.messages || []).map(m => `${m.role}\n${m.content}`).join("\n---\n");
  const sys = (Array.isArray(c.system) ? c.system : [{ text: c.system }])
    .map(b => b.text || "").join("\n");
  const msg = (c.messages || []).map(m => `${m.role}\n` + (Array.isArray(m.content)
    ? m.content.map(b => b.text || "").join("\n") : m.content)).join("\n---\n");
  return `system\n${sys}\n---\n${msg}`;
};

const load = (d, f) => JSON.parse(readFileSync(join(ROOT, d, f), "utf8"));
const N01 = load("test/packets-deep", "N01-jaeeon-care.json").body;
const C01 = load("test/packets-deep", "C01-memory-before.json").body;
const C03 = load("test/packets-taste", "T14-health-mug-discovery.json").body;

console.log("── 1. 결과 자리 150개 ──");
{
  const s = readFileSync(join(OUT, "blind/singles.md"), "utf8");
  const b = readFileSync(join(OUT, "blind/sessions.md"), "utf8");
  const singles = (s.match(/\*\*(갑|을)\*\*/g) || []).length;
  const ses = (b.match(/\*\*(갑|을)\*\*/g) || []).length;
  eq("일반+중요 결과 자리", singles, 17 * 3 * 2);
  eq("세션 결과 자리", ses, 24 * 2);
  eq("합계", singles + ses, 150);
}

console.log("── 2. 두 진영의 입력이 바이트 단위로 같다 ──");
for (const [name, body] of [["일반", N01], ["중요", C01], ["관전", C03]]) {
  const g = await run(ENV_G, body), s = await run(ENV_S, body);
  /* 쓰는 자리의 요청만 비교한다 — 검사 둘은 양쪽 다 기존 진영이라 같다 */
  const gw = g.sent.filter(x => String(x.url).includes("openai")).map(flat);
  const sw = s.sent.filter(x => !String(x.url).includes("openai")
    && !flat(x).includes("너는 이 세계의 사실만 본다")
    && !flat(x).includes("이 사람이 이 사람다운지만 본다")).map(flat);
  eq(`${name} — 쓰는 호출 수가 같다`, gw.length, sw.length);
  eq(`${name} — 프롬프트 원문이 한 글자도 안 다르다`,
    gw.every((t, i) => t === sw[i]), true);
  eq(`${name} — 상한도 같다`, (() => {
    const a = g.sent.filter(x => String(x.url).includes("openai")).map(x => x.body.max_tokens);
    const b2 = s.sent.filter(x => !String(x.url).includes("openai")).map(x => x.body.max_tokens);
    return a.every(v => b2.includes(v));
  })(), true);
}

console.log("── 3·4. Finalizer 0 · Director 0 ──");
{
  const names = [];
  for (const body of [N01, C01, C03]) for (const env of [ENV_G, ENV_S]) {
    const r = await run(env, body);
    names.push(...(r.data.stages || []).map(x => x.stage));
  }
  eq("finalizer 호출", names.filter(x => x === "finalizer").length, 0);
  eq("director 호출", names.filter(x => x === "director").length, 0);
  /* fake 전체 실행의 trace에서도 0이어야 한다 */
  const all = readdirSync(join(OUT, "trace")).flatMap(f =>
    (JSON.parse(readFileSync(join(OUT, "trace", f), "utf8")).stages || []).map(s => s.stage));
  eq("fake 전체 trace에서도 finalizer 0", all.filter(x => x === "finalizer").length, 0);
  eq("fake 전체 trace에서도 director 0", all.filter(x => x === "director").length, 0);
  eq("검사 둘은 실제로 돈다", [...new Set(all)].sort(),
    ["canon", "character", "writer"]);
}

console.log("── 5·6. 검사는 대사를 안 고친다 · 통과한 원문 = 최종 출력 ──");
{
  /* 중요 장면에서 Writer가 낸 원문과 최종 출력이 같은지 — 마무리가 없으니
     한 글자도 달라질 수 없다. Writer 응답을 우리가 심어서 대조한다. */
  const LINE = "네. 잠깐 다녔어요. 그 시절 얘기는 잘 안 해요.";
  const sent = [];
  const base = RP.fakeFetch();
  globalThis.fetch = async (url, init) => {
    const c = JSON.parse(init.body);
    sent.push(String(url));
    const sys = (Array.isArray(c.system) ? c.system : [{ text: c.system }])
      .map(b => b.text || "").join("\n");
    if (sys.includes("너는 이 세계의 사실만 본다") || sys.includes("이 사람이 이 사람다운지만 본다"))
      return base(url, init);
    return { ok: true, status: 200, headers: { get: () => null },
      json: async () => ({ content: [{ type: "text", text: JSON.stringify({ messages: [{ text: LINE }] }) }],
        usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: "end_turn" }),
      text: async () => "" };
  };
  let out;
  try {
    const res = await worker.fetch(
      new Request("https://x/?k=k", { method: "POST", body: JSON.stringify(C01),
        headers: { "CF-Connecting-IP": "9.9.7.1" } }),
      { ANTHROPIC_API_KEY: "sk-t", ACCESS_KEY: "k", TRACE: "1", ...ENV_S });
    out = await res.json();
  } finally { globalThis.fetch = realFetch; }
  eq("중요 장면 라우팅이 맞다", out.trace.route.tier, "critical");
  eq("최종 출력이 Writer 원문 그대로다", (out.messages || []).map(m => m.text), [LINE]);
  eq("검사 둘이 실제로 돌았다",
    (out.stages || []).map(s => s.stage).sort(), ["canon", "character", "writer"]);
}

console.log("── 7·8. Writer 최대 2회 · 교차 fallback 0 ──");
{
  const src = readFileSync(join(ROOT, "worker.js"), "utf8");
  eq("재시도 상한이 1이다(시도 2회)", /const RETRY_MAX = 1;/.test(src), true);
  const traces = readdirSync(join(OUT, "trace")).map(f =>
    JSON.parse(readFileSync(join(OUT, "trace", f), "utf8")));
  const maxAttempt = Math.max(...traces.flatMap(t => (t.stages || []).map(s => s.attempt || 1)));
  eq("어떤 turn도 Writer 3회를 안 넘는다", maxAttempt <= 2, true);
  /* 한 turn 안에서 두 진영의 모델이 섞이면 교차 fallback이다 */
  const mixed = traces.filter(t => {
    const ws = (t.stages || []).filter(s => s.stage === "writer").map(s => s.model);
    return new Set(ws).size > 1;
  });
  eq("한 turn 안에서 쓰는 모델이 안 섞인다", mixed.length, 0);
  /* 도전자 turn의 쓰는 자리는 전부 도전자 모델이어야 한다 */
  const bad = traces.filter(t => t.camp === "gpt41"
    && (t.stages || []).some(s => s.stage === "writer" && !String(s.model).startsWith("gpt-")));
  eq("도전자 turn이 기존 모델로 안 샌다", bad.length, 0);
  const bad2 = traces.filter(t => t.camp === "sonnet45"
    && (t.stages || []).some(s => String(s.model).startsWith("gpt-")));
  eq("기준선 turn이 다른 진영으로 안 샌다", bad2.length, 0);
}

console.log("── 9. 블라인드 매핑 ──");
{
  const key = JSON.parse(readFileSync(join(OUT, "sealed/blind-key.json"), "utf8")).map;
  const items = Object.keys(key);
  eq("문항 수만큼 매핑이 있다", items.length, 17 + 3);
  eq("갑·을이 서로 다른 진영이다",
    items.every(k => key[k].갑 !== key[k].을), true);
  eq("문항마다 섞였다 — 한쪽으로 쏠리지 않았다", (() => {
    const g = items.filter(k => key[k].갑 === "gpt41").length;
    return g > 2 && g < items.length - 2;
  })(), true);
  /* key와 blind 본문이 실제로 대응하는가 — trace의 대사와 대조한다 */
  const tr = f => JSON.parse(readFileSync(join(OUT, "trace", f), "utf8"));
  const singles = readFileSync(join(OUT, "blind/singles.md"), "utf8");
  let checked = 0, okAll = true;
  for (const item of items.filter(k => !k.startsWith("S"))) {
    const camp = key[item].갑;
    const t = tr(`A-${item}-s1-${camp}.json`);
    const want = (t.finalMessages || []).map(m => `${m.sender || ""}: ${m.text || ""}`).join("\n");
    const sec = singles.split(`## ${item}\n`)[1] || "";
    const block = (sec.split("### sample 2")[0].match(/\*\*갑\*\*\n\n```\n([\s\S]*?)\n```/) || [])[1];
    if (block !== want) okAll = false;
    checked++;
  }
  eq(`갑 자리가 key의 진영과 같다 (${checked}문항)`, okAll, true);
}

console.log("── 10. 블라인드에 단서가 없다 ──");
{
  const files = readdirSync(join(OUT, "blind"));
  /* 읽고 판정할 두 파일에는 아무 단서도 없어야 한다 */
  const txt = ["singles.md", "sessions.md"]
    .map(f => readFileSync(join(OUT, "blind", f), "utf8")).join("\n");
  const bad = ["gpt", "GPT", "sonnet", "Sonnet", "claude", "Claude", "openai", "OpenAI",
    "anthropic", "Anthropic", "모델", "비용", "$", "ms", "토큰", "재시도", "탈락", "호출"];
  eq("읽을 파일에 금지 낱말 0", bad.filter(w => txt.includes(w)), []);
  /* 판정표는 「둘 다 탈락」 같은 선택지를 쓴다 — 그건 계약이 정한 낱말이다.
     여기서는 모델·공급자·계측 단서만 막는다. */
  const card = readFileSync(join(OUT, "blind", "scorecard.md"), "utf8");
  const bad2 = ["gpt", "GPT", "sonnet", "Sonnet", "claude", "Claude", "openai", "OpenAI",
    "anthropic", "Anthropic", "모델", "비용", "$", "ms", "토큰", "호출"];
  eq("판정표에 모델·계측 단서 0", bad2.filter(w => card.includes(w)), []);
  eq("파일 이름에도 단서가 없다", files.sort(), ["scorecard.md", "sessions.md", "singles.md"]);
  eq("실패는 이유 없이 적힌다",
    /\(응답 없음\)/.test(txt) || !/응답 없음/.test(txt), true);
}

console.log("── 11. 운영 기본·판 번호·배포 무변경 ──");
{
  eq("기본 엔진 모드가 solo다", ENG.engineMode({}), "solo");
  eq("기본 쓰는 자리가 그대로다", ENG.ENGINE.writer.id, "claude-sonnet-4-5-20250929");
  eq("기본 경로는 마무리를 부른다(깃발이 없으면)", (() => {
    const src = readFileSync(join(ROOT, "worker.js"), "utf8");
    return /if \(noFinalizer\) \{ picked = survivors\[0\]; break; \}/.test(src)
      && /const noFinalizer = String\(\(env && env\.NO_FINALIZER\) \|\| ""\) === "1";/.test(src);
  })(), true);
  const diff = execSync("git diff --name-only HEAD", { cwd: ROOT }).toString().trim().split("\n").filter(Boolean);
  eq("배포 파일에 diff가 없다",
    diff.filter(f => ["index.html", "app.js", "app-ui.js", "app-data.js", "null.css",
      "app/lib/db.ts", "app/lib/rules.ts", "app/App.tsx"].includes(f)), []);
  eq("바뀐 것은 워커의 실험 깃발과 도구·fixture뿐이다",
    diff.filter(f => !f.startsWith("tools/") && !f.startsWith("test/") && f !== "worker.js"), []);
}

console.log("── 12. 상한이 코드로 강제된다 ──");
{
  const src = readFileSync(join(ROOT, "tools/deepblind.mjs"), "utf8");
  eq("기본 상한이 300·$3다",
    /const CALL_CAP = Number\(argOf\("max-calls", "300"\)\);/.test(src)
    && /const COST_CAP = Number\(argOf\("max-cost", "3\.00"\)\);/.test(src), true);
  eq("호출 **전에** 자리를 본다",
    /if \(!roomLeft\(1\)\) \{[\s\S]{0,200}return null; \}/.test(src), true);
  eq("재시도까지 포함해 센다 — 단계 전부를 charge한다",
    /budget\.calls \+= \(stages \|\| \[\]\)\.length;/.test(src), true);
}

console.log(fail ? `\n실패 — ${pass}개 통과, ${fail}개 실패` : `\n통과 — ${pass}개 통과, 0개 실패`);
process.exit(fail ? 1 : 0);
