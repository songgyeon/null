#!/usr/bin/env node
/* ── G4. single5 replay — Sonnet 5 단일 Writer 실험 ──
   ENGINE_MODE=single5: 성공한 턴의 모델 호출은 Sonnet 5 Writer 한 번이
   전부다(후보 하나, Director·Canon·Character·Finalizer 0회). 검사는 기존
   경로 그대로고, 결정적 검사에서 탈락한 턴만 워커가 정확히 한 번 재호출한다
   (한 턴 최대 2회). 두 번째도 실패하면 폴백 없이 그 턴은 실패다.

   1차 — G3의 A-T01~A-T16 TurnPacket을 글자 그대로 + 기존 fixture 둘
        (14-jaeeon-early-probe: 기억 공개 전 이른 공부방 탐침,
         08-jaeeon-memory-probe: 기억 공개가 승인되는 공부방·기억 질문).
        총 18항목.
   2차 — 고위험 9항목은 1차 결과를 sample 1로 삼고 두 번씩 더 불러
        sample 3개를 만든다(독립 실행). 추가 18턴, 총 36 대화 턴.

   산출물(커밋 금지 — .gitignore의 replay-out* 패턴이 덮는다):
     answers.md    항목마다 상황·유저 발화·최종 대사 전체·시도 결과
     attempts.md   재시도가 난 항목의 첫 응답 원문·코드·둘째 응답·최종
     stability.md  고위험 항목별 sample 1·2·3 전체
     report.md     실측 usage 기반 수치 (요약 호출은 따로)
     trace/        턴별 원 trace

   쓰는 법:
     ANTHROPIC_API_KEY=<키> node tools/single5-replay.mjs
     node tools/single5-replay.mjs --fake        # 하네스 자체 점검
     --out=DIR (기본 replay-out-single5) --taste=DIR --packets=DIR
   §12 — 키는 env로만. 요청 헤더·키를 출력이나 파일에 남기지 않는다. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ENG from "../worker.js";
import * as RP from "./replay.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argOf = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const has = name => process.argv.includes(`--${name}`);
const die = msg => { console.error(`[single5] ${msg}`); process.exit(1); };

/* 고위험 항목 — 2차 안정성 대상 (계약 §7) */
export const STABILITY = [
  "T01-jaeeon-lunch-care",       // 걱정에 시비조가 나오는지
  "T04-jaeeon-mug",              // 머그컵 질문에 의미가 빠지는지
  "T08-minhyun-responsibility",  // 옥상 책임 설명을 회피하는지
  "T09-minhyun-why-like",        // 왜 좋아하는지 직접 답하는지
  "T14-health-mug-discovery",    // 머그컵 발견 대신 무관한 사건을 만드는지
  "T15-health-beanie-discovery", // 비니 발견 대신 일반 외출만 만드는지
  "T16-minhyun-partner-known",   // partner_known 반응을 지우는지
  "14-jaeeon-early-probe",       // 기억 공개 전 탐침
  "08-jaeeon-memory-probe",      // 기억 공개 승인 후 질문
];

const lastUserOf = body => {
  const m = [...(body.history || [])].reverse().find(x => x.role === "user");
  return (m && m.content) || "(각본 진입 턴)";
};
const contextLine = body => {
  const r = { jaeeon: "이재언 1:1", minhyun: "이민현 1:1", group: "단톡", health: "관전(두 사람)" }[body.room] || body.room;
  return `${r}${body.now ? ` · ${body.now}` : ""}${body.day ? ` · ${body.day}` : ""} · ${body.days ?? 0}일째`;
};
const linesOf = msgs => (msgs || []).map(m =>
  `${m.sender ? m.sender + ": " : ""}${m.photo ? "(사진) " : ""}${m.text || ""}`).join("\n");
const rejLines = rej => rej.originalMessages
  ? linesOf(rej.originalMessages) || "(빈 출력)"
  : `(원문 파싱 불가 — raw ${JSON.stringify((rej.raw || "").slice(0, 400))})`;

async function main() {
  const FAKE = has("fake");
  const KEY = process.env.ANTHROPIC_API_KEY || "";
  if (!FAKE && !KEY) die("ANTHROPIC_API_KEY가 없다. 점검만 하려면 --fake.");
  if (FAKE) globalThis.fetch = RP.fakeFetch();

  const outDir = resolve(ROOT, argOf("out", FAKE ? "replay-out-single5-fake" : "replay-out-single5"));
  if (existsSync(outDir) && readdirSync(outDir).length)
    die(`--out 디렉터리가 비어 있지 않다 — ${outDir}`);
  mkdirSync(join(outDir, "trace"), { recursive: true });

  /* ── 1차 자료 — 글자 하나 안 바꾼다: 파일을 그대로 읽는다 ── */
  const tasteDir = join(ROOT, argOf("taste", "test/packets-taste"));
  const pktDir = join(ROOT, argOf("packets", "test/packets"));
  const taste = readdirSync(tasteDir).filter(f => f.endsWith(".json")).sort()
    .map(f => JSON.parse(readFileSync(join(tasteDir, f), "utf8")));
  if (taste.length !== 16) die(`taste-pack이 16개가 아니다 — ${taste.length}`);
  const extra = ["14-jaeeon-early-probe", "08-jaeeon-memory-probe"].map(n =>
    JSON.parse(readFileSync(join(pktDir, `${n}.json`), "utf8")));
  const items = [...taste, ...extra].map(p => ({ label: p.label, blurb: p.blurb || "", body: p.body }));

  const key = FAKE ? "sk-fake" : KEY;
  const env = { ENGINE_MODE: "single5" };
  const calls = [];   // { label, sample, ok, status, rounds, codes, stages, latency, trace, final, rejected }

  async function runOne(item, sample, reqId) {
    const body = { ...item.body, request_id: reqId };
    const r = await RP.callWorker(env, body, key);
    const stages = (r.data && r.data.stages) || [];
    const tr = (r.data && r.data.trace) || {};
    const rejected = tr.rejected || [];
    const row = {
      label: item.label, blurb: item.blurb, body: item.body, sample,
      ok: r.ok, status: r.status,
      rounds: stages.length ? Math.max(...stages.map(s => s.attempt || 1)) - 1 : 0,
      codes: rejected.flatMap(x => x.codes || []),
      finalCodes: r.ok ? [] : rejected.filter(x => x.attempt === 2).flatMap(x => x.codes || []),
      stages, latency: r.latency_ms, rejected,
      final: r.ok ? linesOf(r.data.messages) : "",
      effects: (r.data && r.data.effects) || [],
      trace: { label: item.label, sample, ok: r.ok, status: r.status,
        latency_ms: r.latency_ms, engine: tr, stages,
        usage_total: r.data && r.data.usage_total,
        finalMessages: (r.data && r.data.messages) || [],
        effects: (r.data && r.data.effects) || [],
        error: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status) },
    };
    calls.push(row);
    writeFileSync(join(outDir, "trace",
      `${sample === 1 ? "A" : "S"}-${item.label}${sample > 1 ? `-r${sample}` : ""}.json`),
      JSON.stringify(row.trace, null, 2));
    console.log(`${sample === 1 ? "A" : `S${sample}`} ${item.label} → ${r.status}`
      + `${row.rounds ? ` · 재시도 ${row.rounds}` : ""}`);
    return row;
  }

  /* 1차 — 18항목 순차 */
  const first = {};
  for (const item of items) first[item.label] = await runOne(item, 1, `s5-A-${item.label}`);
  /* 2차 — 고위험 9항목 × 추가 2, 독립 실행 */
  for (const label of STABILITY) {
    const item = items.find(i => i.label === label);
    if (!item) die(`안정성 대상이 1차 목록에 없다 — ${label}`);
    for (const s of [2, 3]) await runOne(item, s, `s5-S-${label}-r${s}`);
  }

  /* ── answers.md — 1차 18항목 전부, 생략 없음 ── */
  const resultOf = c => !c.ok
    ? `실패 (코드: ${[...new Set([...c.codes, String(c.status)])].join(", ") || c.status})`
    : c.rounds ? `재시도 후 성공 (첫 시도 탈락: ${[...new Set(c.rejected.filter(x => x.attempt === 1).flatMap(x => x.codes || []))].join(", ")})`
    : "첫 시도 통과";
  const ans = ["# single5 — 최종 대사 (18항목)", "",
    "Sonnet 5 단일 Writer 한 호출(탈락시 한 번 재시도)의 최종 결과다.", ""];
  for (const item of items) {
    const c = first[item.label];
    ans.push(`## A-${item.label}`, "",
      `상황: ${contextLine(item.body)}${item.blurb ? ` — ${item.blurb}` : ""}`, "",
      `유저: ${lastUserOf(item.body)}`, "",
      c.ok ? c.final : "(실패 — 최종 대사 없음)", "",
      `결과: ${resultOf(c)}`, "");
  }
  writeFileSync(join(outDir, "answers.md"), ans.join("\n"));

  /* ── attempts.md — 재시도·실패가 난 호출만 ── */
  const tried = calls.filter(c => c.rounds > 0 || !c.ok);
  const att = ["# single5 — 재시도 기록", ""];
  if (!tried.length) att.push("재시도가 없었다 — 전 호출 첫 시도 통과.");
  for (const c of tried) {
    att.push(`## ${c.label}${c.sample > 1 ? ` · sample ${c.sample}` : ""}`, "");
    for (const rej of c.rejected)
      att.push(`- ${rej.attempt}번째 시도 탈락 — 코드: ${(rej.codes || []).join(", ")}`,
        "", "```", rejLines(rej), "```", "");
    att.push(c.ok ? `최종(재시도 성공):\n\n\`\`\`\n${c.final}\n\`\`\`` : "최종: 실패 — 대사 없음", "");
  }
  writeFileSync(join(outDir, "attempts.md"), att.join("\n"));

  /* ── stability.md — 고위험 9항목 × sample 3 ── */
  const stb = ["# single5 — 안정성 (고위험 9항목 × sample 3)", "",
    "sample 1은 1차 실행 결과 그대로다. 각 sample은 독립 실행이다.", ""];
  for (const label of STABILITY) {
    const rows = calls.filter(c => c.label === label).sort((a, b) => a.sample - b.sample);
    const item = items.find(i => i.label === label);
    stb.push(`## S-${label}`, "", `상황: ${contextLine(item.body)}`,
      `유저: ${lastUserOf(item.body)}`, "");
    for (const c of rows)
      stb.push(`- sample ${c.sample}${c.rounds ? " (재시도 후)" : ""}:`,
        ...(c.ok ? c.final.split("\n").map(l => `  ${l}`) : [`  (실패 — ${c.codes.join(",") || c.status})`]));
    stb.push("");
  }
  writeFileSync(join(outDir, "stability.md"), stb.join("\n"));

  /* ── report.md — 실측 usage만 ── */
  const rows = calls.flatMap(c => c.stages);
  const models = [...new Set(rows.map(r => r.model))];
  const sum = k => rows.reduce((n, r) => n + (r[k] || 0), 0);
  const okCalls = calls.filter(c => c.ok);
  const firstPass = calls.filter(c => c.ok && c.rounds === 0);
  const retried = calls.filter(c => c.rounds > 0);
  const cost = RP.costOf(rows);
  const lat = calls.map(c => c.latency).sort((a, b) => a - b);
  const pct = p => lat.length ? lat[Math.min(lat.length - 1, Math.ceil(p * lat.length) - 1)] : 0;
  const codeCount = pre => calls.reduce((n, c) => n
    + c.codes.filter(x => Array.isArray(pre) ? pre.includes(x) : x === pre).length, 0);
  const fmt = n => n.toFixed(4);
  const rep = ["# single5 replay 보고", "",
    RP.unknownModels.size ? `**INVALID — 단가를 모르는 모델: ${[...RP.unknownModels].join(", ")}**` : "",
    FAKE ? "**--fake 모드 — 모델 없이 하네스만 굴렸다.**" : "",
    "",
    `- 모델: ${models.join(", ")}`,
    `- 총 대화 턴: ${calls.length} (1차 ${items.length} + 안정성 ${calls.length - items.length}) · 성공 ${okCalls.length} · 최종 실패 ${calls.length - okCalls.length}`,
    `- 첫 시도 통과: ${firstPass.length}/${calls.length} (${Math.round(100 * firstPass.length / calls.length)}%)`,
    `- 재시도: ${calls.reduce((n, c) => n + c.rounds, 0)}회 (재시도 든 턴 ${retried.length} · 그중 성공 ${retried.filter(c => c.ok).length})`,
    `- 탈락 분류: empty ${codeCount("EMPTY")} · parse ${codeCount("WRITER_SCHEMA")} · sender ${codeCount("SENDER")} · fact ${codeCount("FACT_DENIAL")} · effect ${codeCount(["INVALID_GIVE", "INVALID_INVITE"])} · leak ${codeCount("LEAK")} · 최종 502 ${calls.filter(c => !c.ok).length}`,
    `- 토큰: in ${sum("input_tokens")} · 캐시 쓰기 ${sum("cache_creation_input_tokens")} · 캐시 읽기 ${sum("cache_read_input_tokens")} · out ${sum("output_tokens")}`,
    `- 비용: 총 ${fmt(cost)}$ · 성공 턴당 ${okCalls.length ? fmt(cost / okCalls.length) : "-"}$`,
    `- 지연(턴): p50 ${pct(0.5)}ms · p95 ${pct(0.95)}ms · 최대 ${lat[lat.length - 1] || 0}ms`,
    `- 요약 호출: 0 (packet 재생에는 요약이 없다 — 대화 비용과 분리 유지)`,
    `- 고정 각본·시스템 메시지: 모델 호출 없음 (fixture 이력으로만 존재)`,
    "", "턴별 원문·코드·usage는 trace/, 대사는 answers.md·stability.md,",
    "재시도 원문은 attempts.md."];
  writeFileSync(join(outDir, "report.md"), rep.join("\n"));
  console.log(`\n끝 — 대화 ${calls.length}턴. 보고: ${join(outDir, "report.md")}`);
  if (RP.unknownModels.size) die("단가를 모르는 모델이 나왔다 — 보고는 INVALID다.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => { console.error("single5 replay 실패:", e); process.exit(1); });
}
