#!/usr/bin/env node
/* ── 기본 경로 replay — 상급 Writer 한 번 + 행동 규칙·턴 재료 ──
   깃발을 하나도 안 준다 — 운영이 실제로 도는 그 배선이다. Writer에
   [이번 턴 재료] 하나와 행동 규칙을 붙인다. 호출은 일반 턴에 상급 Writer
   한 번(고르는 단계 없음), 중요 장면에 Writer·Canon·Character·Finalizer,
   관전 발견에 화자 순차 둘 + 소유자 정사 검사.
   **경로는 이 하나뿐이다.** 모델 대회를 다시 열지 않는다.

   항목:
     기본        taste-pack 16문항 + 세션 S1·S2·S3
     --only=…    label 앞머리로 거른다 (예: --only=T14,T15,T16)
     --sessions=none  세션을 빼고 packet만

   산출물(커밋 금지 — .gitignore의 replay-out* 패턴이 덮는다):
     answers.md   항목마다 상황·유저 입력·최종 대사·첫시도/재시도·
                  의도·turn material·route·Effect·자동 검사 결과
     attempts.md  재시도가 난 항목의 각 시도 원문·코드
     report.md    실측 usage 기반 수치
     trace/       턴별 원 trace JSON

   쓰는 법:
     ANTHROPIC_API_KEY=<키> node tools/selected-replay.mjs
     node tools/selected-replay.mjs --fake        # 하네스 자체 점검
     --out=DIR (기본 replay-out-selected)
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
const die = msg => { console.error(`[replay] ${msg}`); process.exit(1); };

/* 운영 기본 경로 그대로다 — 깃발을 하나도 안 준다. 행동 규칙과 이번 턴
   재료는 이제 기본값이고, 쓰는 자리는 상급 Writer 한 번이다. */
/* ── 이 하네스가 재는 배선 ──
   selected-v1 실험은 **상급 Sonnet 단독 Writer**(solo) 위에서 행동 규칙과
   턴 재료를 재려고 만든 것이다. 무플래그 기본값이 바뀐 뒤에도 그 실험이
   재현되려면 그 배선을 명시해야 한다 — 안 그러면 이름과 실제가 갈린다. */
const ENV = { ENGINE_MODE: "solo" };

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

/* ── 자동으로 잴 수 있는 것만 잰다 ──
   「설레는가」는 여기서 판정하지 않는다. 사용자가 answers.md를 읽고
   정한다. 여기는 **기계가 확실히 아는 실패**만 센다. */
const AUTO_CHECKS = row => {
  const out = [];
  if (!row.ok) { out.push(`실패(${row.status})`); return out; }
  const msgs = (row.trace.finalMessages || []);
  const texts = msgs.map(m => (m.text || "").trim()).filter(Boolean);
  if (!texts.length) out.push("빈 응답");
  /* 질문만 하고 끝난 응답 — 마지막 줄이 물음표이고 평서문이 하나도 없다 */
  const asks = texts.filter(t => /[?？]$/.test(t));
  if (texts.length && asks.length === texts.length) out.push("질문만 함");
  /* 화자 — 그 방에 없는 사람이 말했나 (워커 hardFilter가 이미 보지만 재확인) */
  const room = row.body.room;
  const allowed = room === "jaeeon" ? ["jaeeon"] : room === "minhyun" ? ["minhyun"]
    : ["jaeeon", "minhyun"];
  const bad = [...new Set(msgs.map(m => m.sender).filter(s => s && !allowed.includes(s)))];
  if (bad.length) out.push(`화자 오류(${bad.join(",")})`);
  /* Effect가 대사보다 먼저 나갈 길 — 워커는 검증 뒤에만 낸다. 그 사실만 적는다 */
  return out.length ? out : ["통과"];
};

const fmtSelected = sel => {
  if (!sel) return "  (행동 규칙 기록 없음)";
  return [`  의도: ${sel.intent || "(없음)"}`,
    `  turn material: ${sel.material ? `${sel.material.kind} — ${sel.material.text}` : "(없음)"}`].join("\n");
};

async function main() {
  const FAKE = has("fake");
  const KEY = process.env.ANTHROPIC_API_KEY || "";
  if (!FAKE && !KEY) die("ANTHROPIC_API_KEY가 없다. 점검만 하려면 --fake.");
  if (FAKE) globalThis.fetch = RP.fakeFetch();

  const outDir = resolve(ROOT, argOf("out", FAKE ? "replay-out-selected-fake" : "replay-out-selected"));
  if (existsSync(outDir) && readdirSync(outDir).length)
    die(`--out 디렉터리가 비어 있지 않다 — ${outDir}\n지난 실행의 trace가 새 보고에 섞인다. 지우거나 다른 --out을 써라.`);
  mkdirSync(join(outDir, "trace"), { recursive: true });

  const only = String(argOf("only", "")).split(",").map(s => s.trim()).filter(Boolean);
  const keep = label => !only.length || only.some(p => String(label).startsWith(p));

  const tasteDir = join(ROOT, argOf("taste", "test/packets-taste"));
  const taste = readdirSync(tasteDir).filter(f => f.endsWith(".json")).sort()
    .map(f => JSON.parse(readFileSync(join(tasteDir, f), "utf8")))
    .filter(p => keep(p.label));
  const items = taste.map(p => ({ label: p.label, blurb: p.blurb || "", body: p.body }));

  const sesArg = argOf("sessions", "test/sessions");
  const sessions = (sesArg === "none" || only.length ? [] : readdirSync(join(ROOT, sesArg))
    .filter(f => f.endsWith(".json")).sort()
    .map(f => JSON.parse(readFileSync(join(ROOT, sesArg, f), "utf8"))))
    .filter(s => keep(s.label));
  if (!items.length && !sessions.length) die("돌릴 항목이 없다 — --only를 확인해라.");

  const key = FAKE ? "sk-fake" : KEY;
  const calls = [];

  const rowOf = (label, blurb, body, r, kind) => {
    const stages = (r.data && r.data.stages) || [];
    const tr = (r.data && r.data.trace) || {};
    const rejected = tr.rejected || [];
    const row = {
      label, blurb, body, kind, ok: r.ok, status: r.status,
      rounds: stages.length ? Math.max(...stages.map(s => s.attempt || 1)) - 1 : 0,
      codes: rejected.flatMap(x => x.codes || []),
      stages, latency: r.latency_ms, rejected,
      allCandidates: tr.allCandidates || [],
      directorDecisions: tr.directorDecisions || (tr.directorDecision ? [tr.directorDecision] : []),
      observe: tr.observe || null,
      selected: tr.selected || null,
      route: tr.route || null,
      scene_ack: (r.data && r.data.scene_ack) || null,
      final: r.ok ? linesOf(r.data.messages) : "",
      effects: (r.data && r.data.effects) || [],
      trace: { label, kind, ok: r.ok, status: r.status,
        latency_ms: r.latency_ms, engine: tr, stages,
        usage_total: r.data && r.data.usage_total,
        scene_ack: (r.data && r.data.scene_ack) || null,
        finalMessages: (r.data && r.data.messages) || [],
        effects: (r.data && r.data.effects) || [],
        error: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status) },
    };
    row.checks = AUTO_CHECKS(row);
    return row;
  };

  /* ── A층 — packet 하나씩 ── */
  for (const item of items) {
    const body = { ...item.body, request_id: `sv1-${item.label}` };
    const r = await RP.callWorker(ENV, body, key);
    const row = rowOf(item.label, item.blurb, item.body, r, "packet");
    calls.push(row);
    writeFileSync(join(outDir, "trace", `A-${item.label}.json`), JSON.stringify(row.trace, null, 2));
    console.log(`${item.label} → ${r.status}${row.rounds ? ` · 재시도 ${row.rounds}` : ""}`
      + (row.selected ? ` · ${row.selected.intent}` : ""));
  }

  /* ── B층 — 연속 세션. 경로는 selected 하나뿐이다 ── */
  for (const ses of sessions) {
    const states = await RP.runSession(ses, ["selected"], {
      call: (env, body) => RP.callWorker(env, body, key),
      envFor: () => ENV,
      onTurn: row => {
        const rr = { ...row, label: `${ses.label}#${row.turn}` };
        console.log(`${rr.label} → ${row.status}${row.rounds ? ` · 재시도 ${row.rounds}` : ""}`);
      },
    });
    const st = states.selected;
    st.rows.forEach((row, i) => {
      const tr = (row.trace && row.trace.engine) || {};
      const one = {
        label: `${ses.label}#${i}`, blurb: "", kind: "session",
        body: { room: ses.turns[i].room, now: ses.turns[i].now, day: ses.turns[i].day,
                days: ses.turns[i].days ?? 0,
                history: [{ role: "user", content: ses.turns[i].text }] },
        ok: row.ok, status: row.status, rounds: row.rounds,
        codes: (tr.rejected || []).flatMap(x => x.codes || []),
        stages: row.trace.stages || [], latency: row.latency,
        rejected: tr.rejected || [],
        allCandidates: tr.allCandidates || [],
        directorDecisions: tr.directorDecisions || (tr.directorDecision ? [tr.directorDecision] : []),
        observe: tr.observe || null, selected: tr.selected || null,
        route: tr.route || null, scene_ack: null,
        final: linesOf(row.trace.finalMessages || []),
        effects: row.trace.effects || [],
        trace: row.trace,
      };
      one.checks = AUTO_CHECKS(one);
      calls.push(one);
      writeFileSync(join(outDir, "trace", `B-${ses.label}-${i}.json`), JSON.stringify(row.trace, null, 2));
    });
    console.log(`${ses.label} → ${st.status} (${st.rows.length}턴)`);
  }

  /* ── answers.md ── */
  const resultOf = c => !c.ok
    ? `실패 (코드: ${[...new Set([...c.codes, String(c.status)])].join(", ") || c.status})`
    : c.rounds ? `재시도 후 성공 (첫 시도 탈락: ${[...new Set(c.rejected.filter(x => x.attempt === 1).flatMap(x => x.codes || []))].join(", ")})`
    : "첫 시도 통과";
  const fmtOneDec = (dec, head) => {
    const parts = [`  ${head}판정: ${dec.decision}`];
    for (const [id, codes] of Object.entries(dec.reject_codes || {})) {
      const cs = Array.isArray(codes) ? codes : [codes];
      if (cs.length) parts.push(`  ${id} 탈락: ${cs.join(", ")}`);
    }
    if (dec.why) parts.push(`  사유: ${dec.why}`);
    return parts.join("\n");
  };
  const fmtDec = c => {
    if (c.observe) return "  (화자 순차 사건 — Director를 안 탄다. 발화 순서는 필수 화자 검사가 지킨다)";
    const decs = c.directorDecisions || [];
    if (!decs.length) return "  (Director 판정 없음)";
    return decs.map(d => fmtOneDec(d, d.attempt ? `attempt ${d.attempt} ` : "")).join("\n\n");
  };

  const ans = ["# 기본 경로 — 상급 Writer + 행동 규칙·턴 재료", "",
    "깃발 없이 운영이 실제로 도는 배선으로 굴린 결과다.",
    "프롬프트에 예시 대사를 넣지 않는다 — 아래는 전부 모델이 그 자리에서 쓴 것이다.", "",
    "「설레는가 · 캐릭터가 맞는가 · 다음 말을 하고 싶은가」는 여기서 판정하지 않는다.", ""];
  for (const c of calls) {
    ans.push(`## ${c.label}`, "",
      `상황: ${contextLine(c.body)}${c.blurb ? ` — ${c.blurb}` : ""}`, "",
      `유저 입력: ${lastUserOf(c.body)}`, "");
    if (c.observe) ans.push(`(선물 관측 사건 — ${c.observe.owner} 소유 · `
      + `fact ${c.observe.source_fact_id} · 출처 ${c.observe.revealed ? "공개됨" : "안 밝힘"})`, "");
    ans.push("### selected-v1이 쓴 것", "", fmtSelected(c.selected), "");
    ans.push("### Director", "", fmtDec(c), "");
    ans.push("### 최종 대사", "", c.ok ? (c.final || "(빈 응답)") : "(실패 — 최종 대사 없음)", "");
    ans.push(`- 결과: ${resultOf(c)}`);
    ans.push(`- route: ${c.route ? `${c.route.tier}${c.route.reason ? ` · ${c.route.reason}` : ""}` : "(없음)"}`);
    ans.push(`- Effect: ${c.effects.length ? c.effects.map(e => `${e.type}${e.item ? `(${e.item})` : ""}${e.key ? `(${e.key})` : ""}`).join(", ") : "없음"}`);
    ans.push(`- 자동 검사: ${c.checks.join(", ")}`, "");
  }
  writeFileSync(join(outDir, "answers.md"), ans.join("\n"));

  /* ── attempts.md ── */
  const tried = calls.filter(c => c.rounds > 0 || !c.ok);
  const att = ["# selected-v1 — 재시도 기록", ""];
  if (!tried.length) att.push("재시도가 없었다 — 전 호출 첫 시도 통과.");
  for (const c of tried) {
    att.push(`## ${c.label}`, "");
    for (const rej of c.rejected)
      att.push(`- ${rej.attempt}번째 시도 탈락 — 코드: ${(rej.codes || []).join(", ")}`,
        "", "```", rejLines(rej), "```", "");
    att.push(c.ok ? `최종(재시도 성공):\n\n\`\`\`\n${c.final}\n\`\`\`` : "최종: 실패 — 대사 없음", "");
  }
  writeFileSync(join(outDir, "attempts.md"), att.join("\n"));

  /* ── report.md ── */
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
  const chk = name => calls.filter(c => c.checks.some(x => x.startsWith(name))).length;
  const fmt = n => n.toFixed(4);

  const retryWhy = {};
  for (const c of calls) for (const code of c.codes) retryWhy[code] = (retryWhy[code] || 0) + 1;
  const dirCodes = {};
  for (const c of calls) for (const dec of c.directorDecisions || []) {
    for (const [, codes] of Object.entries(dec.reject_codes || {}))
      for (const code of (Array.isArray(codes) ? codes : [codes]).filter(Boolean))
        dirCodes[code] = (dirCodes[code] || 0) + 1;
  }
  const line = o => Object.entries(o).sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} ${n}`).join(" · ") || "없음";

  const rep = ["# 기본 경로 replay 보고", "",
    RP.unknownModels.size ? `**INVALID — 단가를 모르는 모델: ${[...RP.unknownModels].join(", ")}**` : "",
    FAKE ? "**--fake 모드 — 모델 없이 하네스만 굴렸다.**" : "",
    "",
    `- 경로: 운영 기본값 (깃발 없음 — 상급 Writer 한 번, 고르는 단계 없음)`,
    `- 모델: ${models.join(", ")}`,
    `- 총 대화 턴: ${calls.length} (packet ${calls.filter(c => c.kind === "packet").length} · 세션 ${calls.filter(c => c.kind === "session").length})`,
    `- 성공: ${okCalls.length} · 실패: ${calls.length - okCalls.length}`,
    `- 최종 502: ${calls.filter(c => c.status === 502).length}`,
    `- 첫 시도 통과: ${firstPass.length}/${calls.length} (${calls.length ? Math.round(100 * firstPass.length / calls.length) : 0}%)`,
    `- 재시도: ${calls.reduce((n, c) => n + c.rounds, 0)}회 (재시도 든 턴 ${retried.length} · 그중 성공 ${retried.filter(c => c.ok).length})`,
    `- 재시도 원인: ${line(retryWhy)}`,
    `- Fact 위반(FACT_DENIAL): ${codeCount("FACT_DENIAL")}`,
    `- 지식 누출(LEAK): ${codeCount("LEAK")}`,
    `- SENDER 오류: ${codeCount("SENDER")}`,
    `- 비문·파싱 오류: WRITER_SCHEMA ${codeCount("WRITER_SCHEMA")} · CRITIC_SCHEMA ${codeCount("CRITIC_SCHEMA")} · EMPTY ${codeCount("EMPTY")}`,
    `- 질문만 한 응답: ${chk("질문만")}`,
    `- 직접 답변 누락(Director 코드): ${dirCodes.DIRECT_ANSWER_MISS || 0}`,
    `- Director 탈락 코드: ${line(dirCodes)}`,
    `- 토큰: in ${sum("input_tokens")} · 캐시 쓰기 ${sum("cache_creation_input_tokens")} · 캐시 읽기 ${sum("cache_read_input_tokens")} · out ${sum("output_tokens")}`,
    `- 비용: 총 ${fmt(cost)}$ · 성공 턴당 ${okCalls.length ? fmt(cost / okCalls.length) : "-"}$`,
    `- 지연(턴): p50 ${pct(0.5)}ms · p95 ${pct(0.95)}ms · 최대 ${lat[lat.length - 1] || 0}ms`,
    "",
    "「설레는가 · 캐릭터가 맞는가 · 다음 말을 하고 싶은가」는 자동으로 판정하지 않는다 —",
    "answers.md를 사람이 읽고 정한다.",
    "", "턴별 원문·코드·usage는 trace/, 대사는 answers.md, 재시도 원문은 attempts.md."];
  writeFileSync(join(outDir, "report.md"), rep.join("\n"));
  console.log(`\n끝 — 대화 ${calls.length}턴. 보고: ${join(outDir, "report.md")}`);
  if (RP.unknownModels.size) die("단가를 모르는 모델이 나왔다 — 보고는 INVALID다.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => { console.error("selected replay 실패:", e); process.exit(1); });
}
