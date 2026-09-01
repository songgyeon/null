#!/usr/bin/env node
/* ── 도전자 replay — 생성 자리만 다른 진영으로 ──
   `ENGINE_MODE=gpt41`. 운영 기본(solo)과 **같은 배선**이고, 바뀌는 것은
   쓰는 손 하나뿐이다:

     Writer            도전자
     중요 장면 Finalizer  도전자
     Canon·Character   기존 모델·기존 규칙 그대로
     일반 턴 Director   없음 (solo와 같다 — 새로 만들지 않는다)

   같은 system 원문·같은 블록 순서·같은 TurnContext·같은 사실 투영·같은
   행동 규칙·같은 history·같은 출력 형식·같은 hardFilter와 후처리를 쓴다.
   프롬프트를 이 모델에 맞게 다시 쓰지 않았고, 새 규칙·견본·정규식도
   더하지 않았다. 변환은 블록을 순서대로 잇는 것뿐이다.

   ── 1차 범위 ──
   고위험 18항목을 **각 1회씩만**. 안정성 반복도, 44턴 전체 재생도 아직
   안 한다 — 1차를 사람이 읽고 통과시킨 뒤에 정한다.

     T01~T16   test/packets-taste/
     A-14      test/packets/14-jaeeon-early-probe.json
     A-08      test/packets/08-jaeeon-memory-probe.json

   산출물(커밋 금지 — .gitignore의 replay-out* 패턴이 덮는다):
     answers.md   상황 · 유저 입력 · 최종 대사 · 첫 시도/재시도/최종 실패
     attempts.md  재시도가 난 항목의 각 시도 원문·코드
     report.md    실측 usage 기반 수치
     trace/       턴별 원 trace JSON

   쓰는 법:
     OPENAI_API_KEY=<키> ANTHROPIC_API_KEY=<키> node tools/gpt41-replay.mjs
     node tools/gpt41-replay.mjs --fake        # 하네스 자체 점검
     --out=DIR (기본 replay-out-gpt41)

   열쇠는 env로만 읽는다. 요청 헤더·열쇠를 출력이나 파일에 남기지 않는다.
   Anthropic 열쇠도 필요하다 — 검사 둘(Canon·Character)이 기존 모델이다. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as RP from "./replay.mjs";
import * as ENG from "../worker.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argOf = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const has = name => process.argv.includes(`--${name}`);
const die = msg => { console.error(`[gpt41] ${msg}`); process.exit(1); };

/* 도전자 경로를 켜는 유일한 자리. 그 밖의 깃발은 안 준다 —
   나머지는 운영 기본값 그대로여야 비교가 성립한다. */
const ENV = { ENGINE_MODE: "gpt41" };
/* --baseline: 같은 18항목을 **운영 기본 경로**(깃발 없음 = Sonnet 4.5 solo)로
   돌린다. 비교 대상이 있어야 도전자의 대사를 읽을 수 있다 — 입력·상태·규칙·
   후처리·재시도 조건이 전부 같고 다른 것은 쓰는 손 하나뿐이다. */
/* 열쇠는 **부를 때** 환경변수에서 읽어 워커 env로만 건넨다. 파일 어디에도
   적지 않고, trace·보고·로그에도 안 싣는다. --fake는 자리표시자를 쓴다. */
const envWith = (key, base) => (base ? {} : { ...ENV, OPENAI_API_KEY: key });

/* ── 단가 ──
   replay 보고 전용이다. 모르는 모델이 나오면 0원으로 조용히 새는 대신
   보고가 INVALID가 되고 비정상 종료한다(RP.priceFor의 계약). */
const GPT_PRICE = { in: 2.00, out: 8.00, cachedIn: 0.50 };   // per 1M tokens

const lastUserOf = body => {
  const m = [...(body.history || [])].reverse().find(x => x.role === "user");
  return (m && m.content) || "(각본 진입 턴)";
};
const contextLine = body => {
  const r = { jaeeon: "이재언 1:1", minhyun: "이강현 1:1", group: "단톡", health: "관전(두 사람)" }[body.room] || body.room;
  return `${r}${body.now ? ` · ${body.now}` : ""}${body.day ? ` · ${body.day}` : ""} · ${body.days ?? 0}일째`;
};
const linesOf = msgs => (msgs || []).map(m =>
  `${m.sender ? m.sender + ": " : ""}${m.photo ? "(사진) " : ""}${m.text || ""}`).join("\n");
const rejLines = rej => rej.originalMessages
  ? linesOf(rej.originalMessages) || "(빈 출력)"
  : `(원문 파싱 불가 — raw ${JSON.stringify((rej.raw || "").slice(0, 400))})`;

/* 도전자 단계의 실측 usage로 비용을 낸다. 기존 단계(검사 둘)는 RP의
   단가표를 그대로 쓴다 — 두 진영이 한 보고에 섞이므로 따로 센다. */
const costOfRows = rows => rows.reduce((c, r) => {
  const isGpt = String(r.model || "").startsWith("gpt-");
  if (!isGpt) return c + RP.costOf([r]);
  const inTok = r.input_tokens || 0, cached = r.cache_read_input_tokens || 0;
  const out = r.output_tokens || 0;
  return c + (inTok * GPT_PRICE.in + cached * GPT_PRICE.cachedIn + out * GPT_PRICE.out) / 1e6;
}, 0);

async function main() {
  const FAKE = has("fake");
  const BASE = has("baseline");
  const OKEY = process.env.OPENAI_API_KEY || "";
  const AKEY = process.env.ANTHROPIC_API_KEY || "";
  if (!FAKE) {
    /* 부르기 전에 멈춘다 — 없는 채로 나가면 401 본문이 산출물에 실린다 */
    if (!OKEY && !BASE) die("OPENAI_API_KEY가 없다. 점검만 하려면 --fake.");
    if (!AKEY) die("ANTHROPIC_API_KEY가 없다 — 검사 둘(Canon·Character)이 기존 모델이다.");
  }
  if (FAKE) globalThis.fetch = RP.fakeFetch();

  const outDir = resolve(ROOT, argOf("out",
    BASE ? (FAKE ? "replay-out-sonnet45-fake" : "replay-out-sonnet45")
         : (FAKE ? "replay-out-gpt41-fake" : "replay-out-gpt41")));
  if (existsSync(outDir) && readdirSync(outDir).length)
    die(`--out 디렉터리가 비어 있지 않다 — ${outDir}\n지난 실행의 trace가 새 보고에 섞인다. 지우거나 다른 --out을 써라.`);
  mkdirSync(join(outDir, "trace"), { recursive: true });

  /* ── 18항목 — 정확히 같은 TurnPacket, 각 1회 ── */
  const tasteDir = join(ROOT, "test/packets-taste");
  const items = readdirSync(tasteDir).filter(f => f.endsWith(".json")).sort()
    .map(f => JSON.parse(readFileSync(join(tasteDir, f), "utf8")))
    .map(p => ({ label: p.label, blurb: p.blurb || "", body: p.body }));
  for (const [f, label] of [["14-jaeeon-early-probe.json", "A-14-early-probe"],
                            ["08-jaeeon-memory-probe.json", "A-08-memory-reveal"]]) {
    const p = JSON.parse(readFileSync(join(ROOT, "test/packets", f), "utf8"));
    items.push({ label, blurb: p.blurb || "", body: p.body });
  }
  if (items.length !== 18) die(`18항목이 아니다 — ${items.length}`);

  const key = FAKE ? "sk-fake" : AKEY;
  const env = envWith(FAKE ? "sk-fake-도전자" : OKEY, BASE);
  const calls = [];

  for (const item of items) {
    const body = { ...item.body, request_id: `gpt41-${item.label}` };
    const r = await RP.callWorker(env, body, key);
    const stages = (r.data && r.data.stages) || [];
    const tr = (r.data && r.data.trace) || {};
    const rejected = tr.rejected || [];
    const row = {
      label: item.label, blurb: item.blurb, body: item.body,
      ok: r.ok, status: r.status,
      rounds: stages.length ? Math.max(...stages.map(s => s.attempt || 1)) - 1 : 0,
      codes: rejected.flatMap(x => x.codes || []),
      stages, latency: r.latency_ms, rejected,
      route: tr.route || null, observe: tr.observe || null,
      final: r.ok ? linesOf(r.data.messages) : "",
      err: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status),
      trace: { label: item.label, ok: r.ok, status: r.status,
        latency_ms: r.latency_ms, engine: tr, stages,
        usage_total: r.data && r.data.usage_total,
        finalMessages: (r.data && r.data.messages) || [],
        effects: (r.data && r.data.effects) || [],
        error: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status) },
    };
    calls.push(row);
    writeFileSync(join(outDir, "trace", `${item.label}.json`), JSON.stringify(row.trace, null, 2));
    const models = [...new Set(stages.map(s => s.model))];
    console.log(`${item.label} → ${r.status}${row.rounds ? ` · 재시도 ${row.rounds}` : ""}`
      + ` · ${stages.map(s => s.stage).join("+")}`);
    if (!r.ok) console.log(`   실패: ${String(row.err).slice(0, 160)}`);
  }

  /* ── answers.md ── */
  const resultOf = c => !c.ok
    ? `최종 실패 (${[...new Set([...c.codes, String(c.status)])].join(", ") || c.status})`
    : c.rounds ? `재시도 후 성공 (첫 시도 탈락: ${[...new Set(c.rejected.filter(x => x.attempt === 1).flatMap(x => x.codes || []))].join(", ")})`
    : "첫 시도 통과";
  const ans = ["# 도전자 replay — 고위험 18항목 (각 1회)", "",
    "운영 기본(solo)과 같은 배선에서 **쓰는 손만** 다른 진영이다.",
    "같은 system 원문·같은 사실 투영·같은 행동 규칙·같은 후처리를 쓴다.",
    "프롬프트를 이 모델에 맞게 다시 쓰지 않았다.", "",
    "「설레는가 · 캐릭터가 맞는가 · 다음 말을 하고 싶은가」는 여기서 판정하지 않는다.", ""];
  for (const c of calls) {
    ans.push(`## ${c.label}`, "",
      `상황: ${contextLine(c.body)}${c.blurb ? ` — ${c.blurb}` : ""}`, "",
      `유저 입력: ${lastUserOf(c.body)}`, "");
    if (c.route && c.route.tier === "critical")
      ans.push(`(중요 장면 — ${c.route.reason})`, "");
    if (c.observe) ans.push(`(선물 관측 사건 — ${c.observe.owner} 소유 · `
      + `출처 ${c.observe.revealed ? "공개됨" : "안 밝힘"})`, "");
    ans.push("### 최종 대사", "",
      c.ok ? (c.final || "(빈 응답)") : "(실패 — 최종 대사 없음)", "",
      `- 결과: ${resultOf(c)}`, "");
  }
  writeFileSync(join(outDir, "answers.md"), ans.join("\n"));

  /* ── attempts.md ── */
  const tried = calls.filter(c => c.rounds > 0 || !c.ok);
  const att = ["# 도전자 replay — 재시도 기록", ""];
  if (!tried.length) att.push("재시도가 없었다 — 전 호출 첫 시도 통과.");
  for (const c of tried) {
    att.push(`## ${c.label}`, "");
    for (const rej of c.rejected)
      att.push(`- ${rej.attempt}번째 시도 탈락 — 코드: ${(rej.codes || []).join(", ")}`,
        "", "```", rejLines(rej), "```", "");
    att.push(c.ok ? `최종(재시도 성공):\n\n\`\`\`\n${c.final}\n\`\`\``
                  : `최종: 실패 — ${String(c.err).slice(0, 300)}`, "");
  }
  writeFileSync(join(outDir, "attempts.md"), att.join("\n"));

  /* ── report.md ── */
  const rows = calls.flatMap(c => c.stages);
  const gptRows = rows.filter(r => String(r.model || "").startsWith("gpt-"));
  const othRows = rows.filter(r => !String(r.model || "").startsWith("gpt-"));
  const sum = (rs, k) => rs.reduce((n, r) => n + (r[k] || 0), 0);
  const okCalls = calls.filter(c => c.ok);
  const firstPass = calls.filter(c => c.ok && c.rounds === 0);
  const retried = calls.filter(c => c.rounds > 0);
  const lat = calls.map(c => c.latency).sort((a, b) => a - b);
  const pct = p => lat.length ? lat[Math.min(lat.length - 1, Math.ceil(p * lat.length) - 1)] : 0;
  const codeCount = pre => calls.reduce((n, c) => n
    + c.codes.filter(x => Array.isArray(pre) ? pre.includes(x) : x === pre).length, 0);
  const why = {};
  for (const c of calls) for (const code of c.codes) why[code] = (why[code] || 0) + 1;
  const line = o => Object.entries(o).sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} ${n}`).join(" · ") || "없음";
  const errs = calls.filter(c => !c.ok).map(c => `${c.label}: ${String(c.err).slice(0, 120)}`);
  const fmt = n => n.toFixed(4);

  const rep = ["# 도전자 replay 보고", "",
    RP.unknownModels.size ? `**INVALID — 단가를 모르는 모델: ${[...RP.unknownModels].join(", ")}**` : "",
    FAKE ? "**--fake 모드 — 모델 없이 하네스만 굴렸다.**" : "",
    "",
    BASE ? `- 경로: 운영 기본(solo · 깃발 없음) — 비교 기준선`
         : `- 경로: ENGINE_MODE=gpt41 (운영 기본 solo와 같은 배선 · 쓰는 손만 다름)`,
    BASE ? `- 쓰는 자리: ${ENG.ENGINE.writer.id}`
         : `- 사용한 model id: **${ENG.OPENAI_MODEL}** (별칭 아님 · snapshot 고정)`,
    BASE ? `- 검사·마무리도 기존 배치 그대로`
         : `- 도전자가 맡은 단계: ${[...ENG.GPT_STAGES].join(" · ")}`,
    `- 기존 모델이 맡은 단계: ${[...new Set(othRows.map(r => r.stage))].join(" · ") || "없음"}`,
    "",
    `- 총 항목: ${calls.length}`,
    `- 성공 턴: ${okCalls.length} · 실패: ${calls.length - okCalls.length}`,
    `- 첫 시도 통과율: ${firstPass.length}/${calls.length} (${calls.length ? Math.round(100 * firstPass.length / calls.length) : 0}%)`,
    `- 재시도 수: ${calls.reduce((n, c) => n + c.rounds, 0)}회 (재시도 든 턴 ${retried.length} · 그중 성공 ${retried.filter(c => c.ok).length})`,
    `- 탈락 코드: ${line(why)}`,
    `- 그중 Fact 위반 ${codeCount("FACT_DENIAL")} · 지식 누출 ${codeCount("LEAK")} · SENDER ${codeCount("SENDER")}`
      + ` · 물건 미언급 ${codeCount("ITEM_MISS")} · 파싱 ${codeCount(["WRITER_SCHEMA", "CRITIC_SCHEMA", "EMPTY"])}`,
    "",
    `- 도전자 토큰: 입력 ${sum(gptRows, "input_tokens")} · 캐시 입력 ${sum(gptRows, "cache_read_input_tokens")} · 출력 ${sum(gptRows, "output_tokens")}`,
    `- 기존 모델 토큰: 입력 ${sum(othRows, "input_tokens")} · 캐시 입력 ${sum(othRows, "cache_read_input_tokens")} · 출력 ${sum(othRows, "output_tokens")}`,
    `- 실제 비용: 총 ${fmt(costOfRows(rows))}$ (도전자 ${fmt(costOfRows(gptRows))}$ · 기존 ${fmt(costOfRows(othRows))}$)`,
    `- 성공 턴당: ${okCalls.length ? fmt(costOfRows(rows) / okCalls.length) : "-"}$`,
    "",
    `- 지연(턴): p50 ${pct(0.5)}ms · p95 ${pct(0.95)}ms · 최대 ${lat[lat.length - 1] || 0}ms`,
    `- API 오류: ${errs.length ? "" : "없음"}`,
    ...errs.map(e => `  - ${e}`),
    "",
    "「설레는가 · 캐릭터가 맞는가 · 다음 말을 하고 싶은가」는 자동으로 판정하지 않는다 —",
    "answers.md를 사람이 읽고 정한다. 안정성 반복과 44턴 전체 재생은 그 뒤에 정한다.",
    "", "턴별 원문·코드·usage는 trace/, 대사는 answers.md, 재시도 원문은 attempts.md."];
  writeFileSync(join(outDir, "report.md"), rep.join("\n"));
  console.log(`\n끝 — ${calls.length}항목. 보고: ${join(outDir, "report.md")}`);
  if (RP.unknownModels.size) die("단가를 모르는 모델이 나왔다 — 보고는 INVALID다.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => { console.error("도전자 replay 실패:", e); process.exit(1); });
}
