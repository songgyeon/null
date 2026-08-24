#!/usr/bin/env node
/* ── G2. 비교 모델 셋(SINGLE_SWEEP_MODELS 표) — single 모델 스윕 ──
   구조 비교가 아니라 배우 교체다: 동일한 NULL 세계관·TurnContext·프롬프트·
   후처리(single 경로 그대로)에서 **모델 ID만** 바꿔 셋을 나란히 세운다.
   이 결과로 운영 모델 하나를 확정하고 엔진 실험을 끝낸다.

   ── 호출 계약 ──
   세 모델 모두 ENGINE_MODE=single + SWEEP_BARE=1 로 부른다. payload는
   model·max_tokens·system·messages 넷뿐이다 — temperature·top_p·top_k·
   수동 thinking·budget_tokens·effort 전부 안 실린다(셋 중 최신 세대 모델이
   비기본 샘플링에 400을 내므로, 나머지 둘에도 똑같이 빼서 모델 외 변수를 없앤다).
   각 모델의 기본 동작 자체가 비교 대상이다 — 최신 세대의 adaptive thinking도
   사용량·지연에 그대로 포함된다.

   ── 실험량 ──
   기본: packet 14 + 세션 28턴 = 모델당 42턴 × 3 = 126
   안정성: 문제 장면 10항목 × 추가 2회 × 3모델 = 60
   총 186 대화 턴. 요약 호출은 따로 센다.
   안정성 반복은 상태를 진전시키지 않는다 — 같은 TurnPacket의 독립 재생이다.
   한 번 잘 나온 답과 「가끔 이상한 답」을 가르려면 반복이 필요하다.

   ── 공정 계약 (G에서 상속) ──
   실행 순서는 단위(packet×repeat, 세션 턴)마다 결정적으로 회전한다.
   모든 호출은 순차다 — 병렬은 순간 부하로 지연 비교를 오염시킨다.
   모델별 세이브·history·Effect·요약·recent_photos 완전 분리.
   실패: 같은 body·같은 request_id로 UI 재시도 1회, 그래도 실패면 그 자리
   기록 후(세션은 incomplete 종료) 다른 모델 출력으로 메우지 않는다.
   예상 밖 UI Effect(초대·물건)는 그 모델의 세션만 invalid로 끝낸다.
   허용되지 않은 모델 ID·모르는 usage는 조용히 넘기지 않는다 — INVALID +
   비정상 종료. 폴백 없음.

   ── 산출물 ──
   replay-model-out/ (비어 있지 않으면 거부)
     blind/            기본 A 항목·B 세션 — 갑·을·병, 항목마다 독립 셔플
     blind-stability/  안정성 10항목 — 이름표당 같은 모델의 sample 3개
     blind-key.json    짝 — 판정이 끝날 때까지 열지 않는다
     trace/            턴별 전체 기록 (모델 원문은 여기에만)
     report.md         운영 실측 — 판정 전에 열지 않는다
     manifest.json     실행 구성과 실행 순서

   쓰는 법:
     ANTHROPIC_API_KEY=<키> node tools/model-sweep.mjs
     node tools/model-sweep.mjs --fake     # 모델 없이 배선 전체 점검
     --out=DIR --packets=DIR --sessions=DIR --seed=N */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ENG from "../worker.js";
import { callWorker, runSession, rotated, shuffled, costOf, unknownModels,
         fakeFetch } from "./replay.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ── 비교 모델 — 이 셋뿐이다. 다른 ID는 즉시 비정상 종료, 폴백 없음 ── */
export const SINGLE_SWEEP_MODELS = {
  sonnet45: "claude-sonnet-4-5-20250929",
  sonnet46: "claude-sonnet-4-6",
  sonnet5:  "claude-sonnet-5",
};
export const MODEL_KEYS = Object.keys(SINGLE_SWEEP_MODELS);
/* 안정성 반복 대상 — 「가끔 이상한 답」이 나오던 문제 장면들 */
export const STABILITY = ["A-03", "A-04", "A-05", "A-06", "A-07",
                          "A-08", "A-10", "A-12", "A-13", "A-14"];
export const sweepEnv = key => {
  const id = SINGLE_SWEEP_MODELS[key];
  if (!id) throw new Error(`허용되지 않은 모델 키 — ${key}`);
  return { ENGINE_MODE: "single", SONNET_WRITER_MODEL: id, SWEEP_BARE: "1" };
};
/* sonnet45 항목의 ID는 저장소의 검증된 고정 ID와 글자까지 같아야 한다 — 별칭 대체 금지 */
export function validateModels() {
  if (SINGLE_SWEEP_MODELS.sonnet45 !== ENG.ENGINE.singleWriter.id)
    throw new Error(`sonnet45 ID가 저장소 검증 ID와 다르다 — ${SINGLE_SWEEP_MODELS.sonnet45} ≠ ${ENG.ENGINE.singleWriter.id}`);
  for (const [k, id] of Object.entries(SINGLE_SWEEP_MODELS))
    if (!id.startsWith("claude-sonnet-")) throw new Error(`허용되지 않은 모델 — ${k}: ${id}`);
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(p / 100 * a.length))];
};

const argOf = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const has = name => process.argv.includes(`--${name}`);
const die = msg => { console.error(`[sweep] ${msg}`); process.exit(1); };

async function main() {
  const FAKE = has("fake");
  const KEY = process.env.ANTHROPIC_API_KEY || "";
  if (!FAKE && !KEY) {
    console.error("ANTHROPIC_API_KEY가 없다. 배선 점검은: node tools/model-sweep.mjs --fake");
    process.exit(1);
  }
  if (FAKE) globalThis.fetch = fakeFetch();
  try { validateModels(); } catch (e) { die(e.message); }

  const seed = argOf("seed", "7");
  const outDir = resolve(ROOT, argOf("out", FAKE ? "replay-model-out-fake" : "replay-model-out"));
  if (existsSync(outDir) && readdirSync(outDir).length)
    die(`--out 디렉터리가 비어 있지 않다 — ${outDir}. 지우거나 다른 --out을 써라.`);
  const loadDir = (dir, what) => {
    if (!existsSync(dir)) die(`${what} 디렉터리가 없다 — ${dir}`);
    const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
    if (!files.length) die(`${what} 디렉터리가 비어 있다 — ${dir}`);
    return files.map(f => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }));
  };
  const packets = loadDir(join(ROOT, argOf("packets", "test/packets")), "packet");
  const sessions = loadDir(join(ROOT, argOf("sessions", "test/sessions")), "session");
  mkdirSync(join(outDir, "trace"), { recursive: true });
  mkdirSync(join(outDir, "blind"), { recursive: true });
  mkdirSync(join(outDir, "blind-stability"), { recursive: true });

  const key = FAKE ? "sk-fake" : KEY;
  const call = (env, body) => callWorker(env, body, key);
  const rows = [];      // chat rows {item, model, repeat, kind, ok, ...}
  const sumRows = [];
  const execOrder = []; // manifest용 — 단위별 실행 순서
  let k = 0;            // 회전 카운터 — packet×repeat와 세션 턴이 같은 바퀴

  /* UI 재시도 포함 한 번의 호출 — 같은 body·같은 request_id, 모델 불변 */
  async function callOnce(env, body) {
    let r = await call(env, body), ui = 0;
    let stages = (r.data && r.data.stages) || [];
    let latency = r.latency_ms;
    while (!r.ok && ui < 1) {
      ui++;
      r = await call(env, body);
      stages = stages.concat((r.data && r.data.stages) || []);
      latency += r.latency_ms;
    }
    return { r, ui, stages, latency };
  }

  /* ── A층: packet 14개 × (기본 1 + 안정성 항목은 반복 2) × 세 모델 ── */
  for (const pkt of packets) {
    const label = pkt.label || basename(pkt.file, ".json");
    const reps = STABILITY.includes("A-" + label.slice(0, 2)) ? 3 : 1;
    for (let rep = 0; rep < reps; rep++) {
      const order = rotated(MODEL_KEYS, k++);
      execOrder.push({ unit: `A-${label}:r${rep}`, order });
      for (const mk of order) {
        const body = { ...pkt.body, request_id: `sweep:${label}:${mk}:r${rep}` };
        const { r, ui, stages, latency } = await callOnce(sweepEnv(mk), body);
        const trace = { item: label, model: mk, repeat: rep, kind: "chat",
          ok: r.ok, status: r.status, ui_retries: ui, latency_ms: latency,
          engine: (r.data && r.data.trace) || null, stages,
          usage: r.data && r.data.usage, usage_total: r.data && r.data.usage_total,
          effects: (r.data && r.data.effects) || [],
          finalMessages: (r.data && r.data.messages) || [],
          error: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status) };
        rows.push({ item: label, model: mk, repeat: rep, layer: "A", ok: r.ok,
          ui, rounds: stages.length ? Math.max(...stages.map(s => s.attempt || 1)) - 1 : 0,
          calls: stages.length, cost: costOf(stages), latency, stages,
          text: trace.finalMessages.map(m =>
            `${m.sender ? m.sender + ": " : ""}${m.photo ? "(사진) " : ""}${m.text || ""}`).join("\n") || "(실패)" });
        writeFileSync(join(outDir, "trace", `A-${label}-${mk}-r${rep}.json`),
          JSON.stringify(trace, null, 2));
        console.log(`A ${label} r${rep} · ${mk} → ${r.status}`);
      }
    }
  }

  /* ── B층: 세션 3개 — 모델별 완전 분리, 턴 단위 회전 교차 ── */
  const sessionStates = {};
  for (const ses of sessions) {
    const label = ses.label || basename(ses.file, ".json");
    const states = await runSession({ ...ses, label }, MODEL_KEYS, {
      call, rotBase: k, envFor: mk => sweepEnv(mk),
      onTurn: row => console.log(`B ${label} · ${row.path} · #${row.turn}`
        + `${row.ui_retries ? ` · UI재시도 ${row.ui_retries}` : ""} → ${row.status}`),
    });
    for (let i = 0; i < ses.turns.length; i++) execOrder.push({ unit: `B-${label}:#${i}`, order: rotated(MODEL_KEYS, k + i) });
    k += ses.turns.length;
    sessionStates[label] = states;
    for (const mk of MODEL_KEYS) {
      const st = states[mk];
      st.rows.forEach(row => {
        rows.push({ item: label, model: mk, repeat: 0, layer: "B", ok: row.ok,
          ui: row.ui_retries, rounds: row.rounds, calls: row.calls, cost: row.cost,
          latency: row.latency, stages: row.trace.stages, turn: row.turn });
        writeFileSync(join(outDir, "trace", `B-${label}-${mk}-${String(row.turn).padStart(2, "0")}.json`),
          JSON.stringify(row.trace, null, 2));
      });
      st.sumRows.forEach(row => {
        sumRows.push({ ...row, model: mk });
        writeFileSync(join(outDir, "trace", `B-${label}-${mk}-sum${String(row.turn).padStart(2, "0")}.json`),
          JSON.stringify(row.trace, null, 2));
      });
      if (st.status !== "complete")
        console.log(`B ${label} · ${mk} · 세션 ${st.status}${st.invalidWhy ? ` (${st.invalidWhy})` : ""} — #${st.stoppedAt}`);
    }
  }

  /* ── 블라인드 — 모델·usage·지연·호출 흔적 없이 대사만 ── */
  const tags = ["갑", "을", "병"];
  const key2blind = {};
  const ctxOf = body => {
    const r = { jaeeon: "이재언 1:1", minhyun: "이민현 1:1", group: "단톡", health: "관전" }[body.room] || body.room;
    const last = [...(body.history || [])].reverse().find(m => m.role === "user");
    return `${r}${body.now ? ` · ${body.now}` : ""} — 유저: 「${(last && last.content || "").slice(0, 60)}」`;
  };
  for (const pkt of packets) {
    const label = pkt.label || basename(pkt.file, ".json");
    const order = shuffled(MODEL_KEYS.slice().sort(), seed + "A" + label);
    const lines = [`# A-${label}`, "", `상황: ${ctxOf(pkt.body)}`, ""];
    order.forEach((mk, i) => {
      key2blind[`A-${label}/${tags[i]}`] = mk;
      const row = rows.find(x => x.layer === "A" && x.item === label && x.model === mk && x.repeat === 0);
      lines.push(`## ${tags[i]}`, "", row ? row.text : "(실패)", "");
    });
    writeFileSync(join(outDir, "blind", `A-${label}.md`), lines.join("\n"));
    /* 안정성 — 이름표당 같은 모델의 sample 3개, 짝은 항목마다 다시 셔플 */
    if (STABILITY.includes("A-" + label.slice(0, 2))) {
      const so = shuffled(MODEL_KEYS.slice().sort(), seed + "S" + label);
      const sl = [`# S-A-${label} (안정성 — 이름표당 sample 3)`, "", `상황: ${ctxOf(pkt.body)}`, ""];
      so.forEach((mk, i) => {
        key2blind[`S-A-${label}/${tags[i]}`] = mk;
        sl.push(`## ${tags[i]}`, "");
        for (let rep = 0; rep < 3; rep++) {
          const row = rows.find(x => x.layer === "A" && x.item === label && x.model === mk && x.repeat === rep);
          sl.push(`- sample ${rep + 1}:`);
          (row ? row.text : "(실패)").split("\n").forEach(t => sl.push(`  ${t}`));
        }
        sl.push("");
      });
      writeFileSync(join(outDir, "blind-stability", `S-A-${label}.md`), sl.join("\n"));
    }
  }
  for (const ses of sessions) {
    const label = ses.label || basename(ses.file, ".json");
    const order = shuffled(MODEL_KEYS.slice().sort(), seed + "B" + label);
    const lines = [`# B-${label}`, "",
      `상황: ${{ jaeeon: "이재언", minhyun: "이민현" }[ses.turns[0].room] || ""} — ${ses.turns.length}턴 연속 세션`, ""];
    order.forEach((mk, i) => {
      key2blind[`B-${label}/${tags[i]}`] = mk;
      lines.push(`## ${tags[i]}`, "");
      (sessionStates[label][mk].transcript || []).forEach(t => {
        lines.push(`**유저**: ${t.user}`);
        lines.push(`**응답**: ${t.reply || "(실패)"}`, "");
      });
    });
    writeFileSync(join(outDir, "blind", `B-${label}.md`), lines.join("\n"));
  }
  writeFileSync(join(outDir, "blind-key.json"), JSON.stringify(key2blind, null, 2));

  /* ── 보고 — 운영 실측만. 품질·승자는 판정 뒤의 일이다 ── */
  const per = {};
  let usageMissing = 0;
  for (const r of rows) {
    const p = per[r.model] = per[r.model] || { base: 0, stab: 0, ok: 0, fail: 0,
      rounds: 0, ui: 0, calls: 0, cost: 0, lats: [], inTok: 0, outTok: 0, cw: 0, cr: 0 };
    if (r.layer === "A" && r.repeat > 0) p.stab++; else p.base++;
    if (r.ok) p.ok++; else p.fail++;
    p.rounds += r.rounds; p.ui += r.ui; p.calls += r.calls; p.cost += r.cost;
    p.lats.push(r.latency);
    for (const s of (r.stages || [])) {
      p.inTok += s.input_tokens || 0; p.outTok += s.output_tokens || 0;
      p.cw += s.cache_creation_input_tokens || 0; p.cr += s.cache_read_input_tokens || 0;
    }
    if (r.ok && !(r.stages || []).length) usageMissing++;
  }
  const sper = {};
  for (const r of sumRows) {
    const p = sper[r.model] = sper[r.model] || { calls: 0, cost: 0, latency: 0 };
    p.calls++; p.cost += r.cost; p.latency += r.latency;
  }
  const invalid = unknownModels.size > 0 || usageMissing > 0;
  const fmt = n => n.toFixed(4);
  const rep = ["# G2 모델 스윕 보고 — 비교 모델 셋 (single)", "",
    invalid ? `**INVALID — ${unknownModels.size ? `단가 모르는 모델: ${[...unknownModels].join(", ")}` : ""} ${usageMissing ? `usage 없는 성공 턴 ${usageMissing}` : ""}**` : "",
    FAKE ? "**--fake 모드 — 배선 점검용 숫자다.**" : "",
    "", "## 대화 턴",
    "| 모델 | 기본 턴 | 안정성 턴 | 성공 | 실패 | 모델 재시도 | UI 재시도 | 비용($) | 성공턴당($) | 평균 지연 | p50 | p95 | in tok | out tok | 캐시 w | 캐시 r |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const mk of MODEL_KEYS) {
    const p = per[mk] || { base: 0, stab: 0, ok: 0, fail: 0, rounds: 0, ui: 0, cost: 0, lats: [], inTok: 0, outTok: 0, cw: 0, cr: 0 };
    const avg = p.lats.length ? Math.round(p.lats.reduce((a, b) => a + b, 0) / p.lats.length) : 0;
    rep.push(`| ${mk} | ${p.base} | ${p.stab} | ${p.ok} | ${p.fail} | ${p.rounds} | ${p.ui} | ${fmt(p.cost)} | ${fmt(p.ok ? p.cost / p.ok : 0)} | ${avg} | ${pct(p.lats, 50)} | ${pct(p.lats, 95)} | ${p.inTok} | ${p.outTok} | ${p.cw} | ${p.cr} |`);
  }
  rep.push("", "## 요약 호출 (따로 센다)", "| 모델 | 호출 | 비용($) | 지연 합 |", "|---|---|---|---|");
  for (const mk of MODEL_KEYS) {
    const p = sper[mk] || { calls: 0, cost: 0, latency: 0 };
    rep.push(`| ${mk} | ${p.calls} | ${fmt(p.cost)} | ${p.latency} |`);
  }
  rep.push("", "세션 상태:");
  for (const [label, states] of Object.entries(sessionStates))
    for (const mk of MODEL_KEYS)
      rep.push(`- ${label} · ${mk}: ${states[mk].status}${states[mk].invalidWhy ? ` (${states[mk].invalidWhy})` : ""}`);
  writeFileSync(join(outDir, "report.md"), rep.join("\n"));
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify({
    models: SINGLE_SWEEP_MODELS, stability: STABILITY, seed,
    planned: { base: 42 * 3, stability: 60, total: 186 },
    executed: { chat: rows.length, summary: sumRows.length },
    order: execOrder, finished: new Date().toISOString(),
  }, null, 2));
  console.log(`\n끝 — 대화 ${rows.length}턴 · 요약 ${sumRows.length}호출. 보고: ${join(outDir, "report.md")}`);
  if (invalid) die("INVALID — 단가/usage 문제가 있다. 보고를 믿지 마라.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => { console.error("sweep 실패:", e); process.exit(1); });
}
