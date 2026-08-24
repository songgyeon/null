#!/usr/bin/env node
/* ── G5. golden-v1 replay — hybrid-pair + 행동 규칙 실험 ──
   ENGINE_MODE는 hybrid(기본값). DIALOGUE_RULESET=golden-v1로 Writer에 행동
   규칙을 붙이고, Director에 구조화 판정(SELECT_A/SELECT_B/RETRY + 10개 코드)
   을 쓴다. 호출 구조는 hybrid-pair 그대로 — Writer 1회 + Director 1회,
   재시도 포함 최대 4회.

   항목 — taste-pack 16문항만. 안정성 2차 없음. 추가 packet 없음.

   산출물(커밋 금지 — .gitignore의 replay-out* 패턴이 덮는다):
     answers.md    항목마다 상황·유저 발화·후보 A·후보 B·Director 판정·최종
     attempts.md   재시도가 난 항목의 각 시도 원문·코드
     report.md     실측 usage 기반 수치
     trace/        턴별 원 trace JSON

   쓰는 법:
     ANTHROPIC_API_KEY=<키> node tools/golden-replay.mjs
     node tools/golden-replay.mjs --fake        # 하네스 자체 점검
     --out=DIR (기본 replay-out-golden)
   §12 — 키는 env로만. 요청 헤더·키를 출력이나 파일에 남기지 않는다. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as RP from "./replay.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argOf = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const has = name => process.argv.includes(`--${name}`);
const die = msg => { console.error(`[golden] ${msg}`); process.exit(1); };

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

  const outDir = resolve(ROOT, argOf("out", FAKE ? "replay-out-golden-fake" : "replay-out-golden"));
  if (existsSync(outDir) && readdirSync(outDir).length)
    die(`--out 디렉터리가 비어 있지 않다 — ${outDir}`);
  mkdirSync(join(outDir, "trace"), { recursive: true });

  const tasteDir = join(ROOT, argOf("taste", "test/packets-taste"));
  const taste = readdirSync(tasteDir).filter(f => f.endsWith(".json")).sort()
    .map(f => JSON.parse(readFileSync(join(tasteDir, f), "utf8")));
  if (taste.length !== 16) die(`taste-pack이 16개가 아니다 — ${taste.length}`);
  const items = taste.map(p => ({ label: p.label, blurb: p.blurb || "", body: p.body }));

  const key = FAKE ? "sk-fake" : KEY;
  const env = { CANDIDATE_MODE: "pair", DIALOGUE_RULESET: "golden-v1" };
  const calls = [];

  async function runOne(item, reqId) {
    const body = { ...item.body, request_id: reqId };
    const r = await RP.callWorker(env, body, key);
    const stages = (r.data && r.data.stages) || [];
    const tr = (r.data && r.data.trace) || {};
    const rejected = tr.rejected || [];
    const allCandidates = tr.allCandidates || [];
    const directorDecision = tr.directorDecision || null;
    const row = {
      label: item.label, blurb: item.blurb, body: item.body,
      ok: r.ok, status: r.status,
      rounds: stages.length ? Math.max(...stages.map(s => s.attempt || 1)) - 1 : 0,
      codes: rejected.flatMap(x => x.codes || []),
      finalCodes: r.ok ? [] : rejected.filter(x => x.attempt === 2).flatMap(x => x.codes || []),
      stages, latency: r.latency_ms, rejected,
      allCandidates, directorDecision,
      final: r.ok ? linesOf(r.data.messages) : "",
      effects: (r.data && r.data.effects) || [],
      trace: { label: item.label, ok: r.ok, status: r.status,
        latency_ms: r.latency_ms, engine: tr, stages,
        usage_total: r.data && r.data.usage_total,
        finalMessages: (r.data && r.data.messages) || [],
        effects: (r.data && r.data.effects) || [],
        error: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status) },
    };
    calls.push(row);
    writeFileSync(join(outDir, "trace", `A-${item.label}.json`),
      JSON.stringify(row.trace, null, 2));
    console.log(`${item.label} → ${r.status}`
      + `${row.rounds ? ` · 재시도 ${row.rounds}` : ""}`
      + (directorDecision ? ` · ${directorDecision.decision}` : ""));
    return row;
  }

  /* 16항목 순차 */
  const first = {};
  for (const item of items) first[item.label] = await runOne(item, `gv1-A-${item.label}`);

  /* ── answers.md — 후보 A·B + Director 판정 + 최종 대사 ── */
  const resultOf = c => !c.ok
    ? `실패 (코드: ${[...new Set([...c.codes, String(c.status)])].join(", ") || c.status})`
    : c.rounds ? `재시도 후 성공 (첫 시도 탈락: ${[...new Set(c.rejected.filter(x => x.attempt === 1).flatMap(x => x.codes || []))].join(", ")})`
    : "첫 시도 통과";

  const fmtCands = cands => {
    if (!cands || !cands.length) return "  (후보 없음)";
    return cands.map(c => {
      const lines = linesOf(c.originalMessages) || "(빈 출력)";
      return `  [후보 ${c.id}] (attempt ${c.attempt})\n${lines.split("\n").map(l => `  ${l}`).join("\n")}`;
    }).join("\n\n");
  };
  const fmtDec = dec => {
    if (!dec) return "  (Director 판정 없음)";
    const parts = [`  판정: ${dec.decision}`];
    if (dec.reject_codes && Object.keys(dec.reject_codes).length) {
      for (const [id, codes] of Object.entries(dec.reject_codes)) {
        const cs = Array.isArray(codes) ? codes : [codes];
        if (cs.length) parts.push(`  ${id} 탈락: ${cs.join(", ")}`);
      }
    }
    if (dec.fact_id) parts.push(`  fact_id: ${dec.fact_id}`);
    if (dec.rule_id) parts.push(`  rule_id: ${dec.rule_id}`);
    if (dec.why) parts.push(`  사유: ${dec.why}`);
    return parts.join("\n");
  };

  const ans = ["# golden-v1 — hybrid-pair + 행동 규칙 (16항목)", "",
    "hybrid-pair Writer에 golden-v1 행동 규칙을 붙이고, Director에 구조화 판정",
    "(SELECT_A/SELECT_B/RETRY + 10개 사유 코드)을 쓴 결과다.", ""];
  for (const item of items) {
    const c = first[item.label];
    ans.push(`## A-${item.label}`, "",
      `상황: ${contextLine(item.body)}${item.blurb ? ` — ${item.blurb}` : ""}`, "",
      `유저: ${lastUserOf(item.body)}`, "");
    ans.push("### 후보", "", fmtCands(c.allCandidates), "");
    ans.push("### Director", "", fmtDec(c.directorDecision), "");
    ans.push("### 최종 대사", "",
      c.ok ? c.final : "(실패 — 최종 대사 없음)", "",
      `결과: ${resultOf(c)}`, "");
  }
  writeFileSync(join(outDir, "answers.md"), ans.join("\n"));

  /* ── attempts.md — 재시도·실패가 난 호출만 ── */
  const tried = calls.filter(c => c.rounds > 0 || !c.ok);
  const att = ["# golden-v1 — 재시도 기록", ""];
  if (!tried.length) att.push("재시도가 없었다 — 전 호출 첫 시도 통과.");
  for (const c of tried) {
    att.push(`## ${c.label}`, "");
    for (const rej of c.rejected)
      att.push(`- ${rej.attempt}번째 시도 탈락 — 코드: ${(rej.codes || []).join(", ")}`,
        "", "```", rejLines(rej), "```", "");
    att.push(c.ok ? `최종(재시도 성공):\n\n\`\`\`\n${c.final}\n\`\`\`` : "최종: 실패 — 대사 없음", "");
  }
  writeFileSync(join(outDir, "attempts.md"), att.join("\n"));

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

  const dirCodes = {};
  for (const c of calls) {
    const dec = c.directorDecision;
    if (!dec || !dec.reject_codes) continue;
    for (const [, codes] of Object.entries(dec.reject_codes)) {
      for (const code of (Array.isArray(codes) ? codes : [codes]).filter(Boolean))
        dirCodes[code] = (dirCodes[code] || 0) + 1;
    }
  }
  const dirCodeLine = Object.entries(dirCodes).sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} ${n}`).join(" · ") || "없음";

  const rep = ["# golden-v1 replay 보고", "",
    RP.unknownModels.size ? `**INVALID — 단가를 모르는 모델: ${[...RP.unknownModels].join(", ")}**` : "",
    FAKE ? "**--fake 모드 — 모델 없이 하네스만 굴렸다.**" : "",
    "",
    `- 모델: ${models.join(", ")}`,
    `- 총 대화 턴: ${calls.length}`,
    `- 성공: ${okCalls.length} · 실패: ${calls.length - okCalls.length}`,
    `- 첫 시도 통과: ${firstPass.length}/${calls.length} (${Math.round(100 * firstPass.length / calls.length)}%)`,
    `- 재시도: ${calls.reduce((n, c) => n + c.rounds, 0)}회 (재시도 든 턴 ${retried.length} · 그중 성공 ${retried.filter(c => c.ok).length})`,
    `- hardFilter 탈락: empty ${codeCount("EMPTY")} · parse ${codeCount("WRITER_SCHEMA")} · sender ${codeCount("SENDER")} · fact ${codeCount("FACT_DENIAL")} · effect ${codeCount(["INVALID_GIVE", "INVALID_INVITE"])} · leak ${codeCount("LEAK")}`,
    `- Director 탈락 코드: ${dirCodeLine}`,
    `- 토큰: in ${sum("input_tokens")} · 캐시 쓰기 ${sum("cache_creation_input_tokens")} · 캐시 읽기 ${sum("cache_read_input_tokens")} · out ${sum("output_tokens")}`,
    `- 비용: 총 ${fmt(cost)}$ · 성공 턴당 ${okCalls.length ? fmt(cost / okCalls.length) : "-"}$`,
    `- 지연(턴): p50 ${pct(0.5)}ms · p95 ${pct(0.95)}ms · 최대 ${lat[lat.length - 1] || 0}ms`,
    "", "턴별 원문·코드·usage는 trace/, 대사는 answers.md,",
    "재시도 원문은 attempts.md."];
  writeFileSync(join(outDir, "report.md"), rep.join("\n"));
  console.log(`\n끝 — 대화 ${calls.length}턴. 보고: ${join(outDir, "report.md")}`);
  if (RP.unknownModels.size) die("단가를 모르는 모델이 나왔다 — 보고는 INVALID다.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => { console.error("golden replay 실패:", e); process.exit(1); });
}
