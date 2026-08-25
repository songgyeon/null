#!/usr/bin/env node
/* ── 심화 블라인드 비교 — Writer 두 진영 ──

   ── 이 도구가 재는 것 ──
   자동 통과율이 아니다. 실제 대사의 품질과 안정성을 **사람이** 판정할 수
   있게 재료를 만든다. 그래서 이름표를 지우고 갑/을로만 내놓는다.

   ── 두 진영의 차이는 쓰는 손 하나뿐이다 ──
   같은 system 원문·같은 상태·같은 사실 투영·같은 행동 규칙·같은 history·
   같은 상한·같은 재시도 조건. 프롬프트를 진영에 맞게 고치지 않는다.

   ── 마무리를 뺀다 ──
   위를 쓰는 자리가 후보를 고쳐 써버리면 「누가 썼나」가 흐려진다. 그래서
   NO_FINALIZER=1로 돌린다:
     일반      Writer → hardFilter → 통과한 원문 그대로
     중요      Writer → Canon → Character → 통과한 원문 그대로
     관전 발견 관측자 Writer → 소유자 Writer → 정사 검사 → 두 원문 그대로
   검사는 판정만 한다. 대사를 고치거나 대신 쓰지 않는다.
   탈락하면 같은 진영 Writer에 코드를 넘겨 한 번만 다시 쓴다(최대 2회).
   두 번 실패하면 다른 진영으로 대체하지 않는다 — 「(응답 없음)」이다.

   ── 상한 ──
   실제 API 호출 300회 · 누적 추정 비용 $3.00. 코드가 강제한다. 넘으면
   그 자리에서 멈추고 이미 끝난 것만 남긴다. 재시도로 상한을 넘기지 않는다.

     node tools/deepblind.mjs --fake     # 배선 점검(모델 없이)
     OPENAI_API_KEY=<키> ANTHROPIC_API_KEY=<키> node tools/deepblind.mjs
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as RP from "./replay.mjs";
import * as ENG from "../worker.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argOf = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const has = name => process.argv.includes(`--${name}`);
const die = msg => { console.error(`[deep] ${msg}`); process.exit(1); };

/* ── 두 진영 ──
   이름은 여기에만 있다. blind 산출물에는 한 번도 안 나간다. */
const CAMPS = ["gpt41", "sonnet45"];
/* 마무리를 안 부르는 것은 양쪽 공통이다. 진영을 가르는 것은 ENGINE_MODE
   하나뿐 — sonnet45는 깃발이 없는 운영 기본 배선 그대로다. */
const envFor = (camp, okey) => camp === "gpt41"
  ? { ENGINE_MODE: "gpt41", NO_FINALIZER: "1", OPENAI_API_KEY: okey }
  : { NO_FINALIZER: "1" };

/* ── 단가 ── 보고 전용. 모르는 모델이 나오면 RP.priceFor가 죽는다 */
const GPT_PRICE = { in: 2.00, out: 8.00, cachedIn: 0.50 };   // per 1M
const isGpt = m => String(m || "").startsWith("gpt-");
function costOfStages(stages) {
  let gpt = 0, ant = 0;
  for (const s of stages || []) {
    /* 계측은 단계에 **평면으로** 실린다(input_tokens…). s.usage로 읽으면
       전부 0이 되고, 그러면 비용 상한이 있으나 마나가 된다 — 실제로 그랬다. */
    const u = s.usage || s;
    if (isGpt(s.model)) {
      gpt += ((u.input_tokens || 0) * GPT_PRICE.in
        + (u.cache_read_input_tokens || 0) * GPT_PRICE.cachedIn
        + (u.output_tokens || 0) * GPT_PRICE.out) / 1e6;
    } else {
      const p = RP.priceFor(s.model);
      ant += ((u.input_tokens || 0) * p.in
        + (u.cache_creation_input_tokens || 0) * (p.write ?? p.in * 1.25)
        + (u.cache_read_input_tokens || 0) * (p.cachedIn ?? p.in * 0.1)
        + (u.output_tokens || 0) * p.out) / 1e6;
    }
  }
  return { gpt, ant, all: gpt + ant };
}

/* ── 결정적 섞기 ── 문항마다 갑/을 배치를 따로 뒤집는다.
   같은 문항의 sample 1~3은 같은 매핑을 쓴다(안정성을 나란히 보려면
   그래야 한다). 문항이 바뀌면 다시 섞는다. 세션은 8턴 내내 유지한다. */
const hashOf = s => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
const mapFor = key => {
  const flip = (Math.abs(hashOf(key + "·갑을")) % 2) === 1;
  return flip ? { 갑: CAMPS[1], 을: CAMPS[0] } : { 갑: CAMPS[0], 을: CAMPS[1] };
};

const linesOf = ms => (ms || []).map(m => `${m.sender || ""}: ${m.text || ""}`).join("\n");

/* ── 상한 감시 ── 넘기 전에 멈춘다. 재시도로 넘지 않게 호출 전에 본다 */
const CALL_CAP = Number(argOf("max-calls", "300"));
const COST_CAP = Number(argOf("max-cost", "3.00"));
const budget = { calls: 0, cost: 0, stopped: null };
const roomLeft = need => budget.calls + need <= CALL_CAP && budget.cost < COST_CAP;
function chargeStages(stages) {
  budget.calls += (stages || []).length;
  budget.cost += costOfStages(stages).all;
}

async function main() {
  const FAKE = has("fake");
  const OKEY = process.env.OPENAI_API_KEY || "";
  const AKEY = process.env.ANTHROPIC_API_KEY || "";
  if (!FAKE) {
    if (!OKEY) die("OPENAI_API_KEY가 없다. 점검만 하려면 --fake.");
    if (!AKEY) die("ANTHROPIC_API_KEY가 없다 — 한 진영과 검사 둘이 그쪽이다.");
  }
  if (FAKE) globalThis.fetch = RP.fakeFetch();
  const key = FAKE ? "sk-fake" : AKEY;
  const okey = FAKE ? "sk-fake-도전자" : OKEY;

  const outDir = resolve(ROOT, argOf("out", FAKE ? "replay-out-deepblind-fake" : "replay-out-deepblind"));
  if (existsSync(outDir) && readdirSync(outDir).length)
    die(`--out 디렉터리가 비어 있지 않다 — ${outDir}`);
  for (const d of ["blind", "sealed", "trace"]) mkdirSync(join(outDir, d), { recursive: true });

  /* ── 문항 ── */
  const deepDir = join(ROOT, "test/packets-deep");
  const load = (dir, f) => JSON.parse(readFileSync(join(ROOT, dir, f), "utf8"));
  const singles = readdirSync(deepDir).filter(f => f.endsWith(".json")).sort()
    .map(f => load("test/packets-deep", f));
  /* C03·C04는 기존 T14·T15 fixture를 **그대로** 쓴다 — 계약이 그렇다 */
  for (const [f, label, blurb] of [
    ["T14-health-mug-discovery.json", "C03-mug-discovery",
     "관전 — 머그컵 발견. 민현은 컵을 직접 짚고, 재언은 사실을 부정하지 않는다."],
    ["T15-health-beanie-discovery.json", "C04-beanie-discovery",
     "관전 — 비니 발견. 재언은 돌려 묻고, 민현은 선물 사실을 부정하지 않는다."]]) {
    const p = load("test/packets-taste", f);
    singles.push({ label, blurb, kind: "critical", body: p.body });
  }
  singles.sort((a, b) => a.label.localeCompare(b.label));
  const SAMPLES = Number(argOf("samples", "3"));
  const sessions = JSON.parse(readFileSync(join(ROOT, "test/sessions-deep.json"), "utf8"));

  const expected = singles.length * SAMPLES * CAMPS.length
    + sessions.reduce((n, s) => n + s.turns.length, 0) * CAMPS.length;
  console.log(`[deep] 문항 ${singles.length} × sample ${SAMPLES} × 진영 ${CAMPS.length}`
    + ` + 세션 ${sessions.length} · 기대 결과 ${expected}개`);

  const rows = [];       // { group, item, sample, camp, ok, lines, ... }
  const call = async (camp, body, tag) => {
    if (!roomLeft(1)) { budget.stopped = budget.stopped || `상한 — 호출 ${budget.calls}/${CALL_CAP} · 비용 ${budget.cost.toFixed(4)}/$${COST_CAP}`; return null; }
    const r = await RP.callWorker(envFor(camp, okey), body, key);
    const stages = (r.data && r.data.stages) || [];
    chargeStages(stages);
    return { r, stages, tag };
  };
  const rowOf = (group, item, sample, camp, got, body) => {
    if (!got) return { group, item, sample, camp, ok: false, lines: "(응답 없음)",
      status: 0, stages: [], why: "상한", latency: 0 };
    const { r, stages } = got;
    const tr = (r.data && r.data.trace) || {};
    return { group, item, sample, camp,
      ok: !!r.ok, status: r.status,
      lines: r.ok ? linesOf(r.data.messages) : "(응답 없음)",
      finalMessages: (r.data && r.data.messages) || [],
      stages, latency: r.latency_ms,
      rounds: stages.length ? Math.max(...stages.map(s => s.attempt || 1)) - 1 : 0,
      codes: (tr.rejected || []).flatMap(x => x.codes || []),
      route: tr.route || null, observe: tr.observe || null,
      trace: { item, sample, camp, group, ok: r.ok, status: r.status, body,
        engine: tr, stages, finalMessages: (r.data && r.data.messages) || [],
        effects: (r.data && r.data.effects) || [] } };
  };

  /* ── A층 — 일반·중요 문항 × sample ──
     같은 문항의 두 진영을 **붙여서** 돌린다. 상한에 걸려 멈춰도 짝이
     반쪽으로 남지 않는다. 초기 상태는 sample마다 완전히 같다. */
  for (const it of singles) {
    for (let s = 1; s <= SAMPLES; s++) {
      for (const camp of CAMPS) {
        const body = { ...JSON.parse(JSON.stringify(it.body)),
          request_id: `deep-${it.label}-s${s}-${camp}` };
        const got = await call(camp, body, `${it.label}#${s}`);
        const row = rowOf(it.kind === "critical" ? "critical" : "normal",
          it.label, s, camp, got, body);
        rows.push(row);
        if (row.trace) writeFileSync(join(outDir, "trace",
          `A-${it.label}-s${s}-${camp}.json`), JSON.stringify(row.trace, null, 2));
      }
      console.log(`  ${it.label} #${s} → ${rows.slice(-2).map(r => r.ok ? "ok" : "—").join("/")}`
        + ` · 누적 ${budget.calls}회 $${budget.cost.toFixed(3)}`);
      if (budget.stopped) break;
    }
    if (budget.stopped) break;
  }

  /* ── B층 — 연속 세션 ──
     진영마다 완전히 분리된 세이브. 유저 문장은 고정이고 모델 응답에 맞춰
     바꾸지 않는다. 방을 넘나드는 세션(S3)은 방별 기록을 따로 쌓는다. */
  const sessionRows = [];
  for (const ses of sessions) {
    if (budget.stopped) break;
    const st = {};
    for (const camp of CAMPS) st[camp] = {
      msgs: JSON.parse(JSON.stringify(ses.seed && ses.seed.msgs || {})),
      story: { firstContact: "explained", jaeeonMemory: "hidden",
               partnerKnown: { jaeeon: false, minhyun: false }, ...(ses.seed && ses.seed.story || {}) },
      alive: true, turns: [] };
    for (let i = 0; i < ses.turns.length; i++) {
      const t = ses.turns[i];
      for (const camp of CAMPS) {
        const s = st[camp];
        if (!s.alive) { s.turns.push({ user: t.text || "(각본 진입 턴)", lines: "(응답 없음)" }); continue; }
        s.msgs[t.room] = s.msgs[t.room] || [];
        if (t.text) s.msgs[t.room].push({ sender: "user", text: t.text });
        const hist = (s.msgs[t.room] || []).slice(-24).map(m => m.sender === "user"
          ? { role: "user", sender: "user", content: m.text }
          : { role: "assistant", sender: m.sender, content: m.text });
        const body = {
          mode: t.mode || "chat", room: t.room, user_name: ses.user_name || "연",
          history: hist,
          counts: Object.fromEntries(["jaeeon", "minhyun", "group", "health"]
            .map(r => [r, (s.msgs[r] || []).length])),
          days: t.days ?? ses.days ?? 0, now: t.now, day: t.day,
          gifts: ses.seed && ses.seed.gifts || {},
          story: s.story,
          request_id: `deep-${ses.label}-t${i}-${camp}`,
          ...(ses.partner ? { partner: ses.partner } : {}),
          ...(t.extra || {}),
        };
        const got = await call(camp, body, `${ses.label}#${i}`);
        const row = rowOf("session", ses.label, i, camp, got, body);
        rows.push(row); sessionRows.push(row);
        if (row.trace) writeFileSync(join(outDir, "trace",
          `B-${ses.label}-t${i}-${camp}.json`), JSON.stringify(row.trace, null, 2));
        if (!row.ok) { s.alive = false; s.turns.push({ user: t.text || "(각본 진입 턴)", lines: "(응답 없음)" }); continue; }
        (row.finalMessages || []).forEach(m => s.msgs[t.room].push(
          { sender: m.sender || t.room, text: m.text || "" }));
        s.turns.push({ user: t.text || "(각본 진입 턴)", lines: row.lines });
      }
      console.log(`  ${ses.label} 턴${i} → ${CAMPS.map(c => st[c].alive ? "ok" : "—").join("/")}`
        + ` · 누적 ${budget.calls}회 $${budget.cost.toFixed(3)}`);
      if (budget.stopped) break;
    }
    ses._st = st;
  }

  /* ── 블라인드 산출물 ── 이름표·비용·지연·단계 수·코드는 한 글자도 안 간다 */
  const keyMap = {};
  const sideOf = (item, camp) => {
    const m = keyMap[item] || (keyMap[item] = mapFor(item));
    return m.갑 === camp ? "갑" : "을";
  };
  const pick = (item, sample, side) => {
    const m = keyMap[item] || (keyMap[item] = mapFor(item));
    const r = rows.find(x => x.item === item && x.sample === sample && x.camp === m[side]);
    return r ? r.lines : "(응답 없음)";
  };

  const S = [];
  S.push("# 블라인드 — 문항별 갑 / 을\n");
  S.push("두 진영의 차이는 **쓰는 손 하나**뿐이다. 같은 상황·같은 상태·같은 규칙이다.");
  S.push("한 문항 안에서는 sample 1~3의 갑/을이 같은 진영이다. 문항이 바뀌면 다시 섞였다.");
  S.push("실패는 이유 없이 「(응답 없음)」으로만 적는다.\n");
  for (const it of singles) {
    const label = it.kind === "critical" ? "중요 장면" : "일반";
    S.push(`## ${it.label}\n`);
    S.push(`- 갈래: ${label}`);
    S.push(`- 상황: ${it.blurb}`);
    const last = (it.body.history || []).filter(h => h.role === "user").pop();
    S.push(`- 유저 입력: ${last ? last.content : "(각본 진입 턴)"}\n`);
    for (let s = 1; s <= SAMPLES; s++) {
      S.push(`### sample ${s}\n`);
      S.push(`**갑**\n\n\`\`\`\n${pick(it.label, s, "갑")}\n\`\`\`\n`);
      S.push(`**을**\n\n\`\`\`\n${pick(it.label, s, "을")}\n\`\`\`\n`);
    }
  }
  writeFileSync(join(outDir, "blind", "singles.md"), S.join("\n") + "\n");

  const B = [];
  B.push("# 블라인드 — 연속 세션\n");
  B.push("한 세션 안에서는 여덟 턴 내내 갑/을이 같은 진영이다. 세션이 바뀌면 다시 섞였다.");
  B.push("유저 문장은 고정이다 — 응답에 맞춰 바꾸지 않았다.\n");
  for (const ses of sessions) {
    const m = keyMap[ses.label] || (keyMap[ses.label] = mapFor(ses.label));
    B.push(`## ${ses.label}\n`);
    B.push(`- 상황: ${ses.blurb}\n`);
    const stx = ses._st || {};
    for (let i = 0; i < ses.turns.length; i++) {
      const t = ses.turns[i];
      B.push(`### 턴 ${i + 1} · ${t.room}\n`);
      B.push(`유저: ${t.text || "(각본 진입 턴)"}\n`);
      for (const side of ["갑", "을"]) {
        const s = stx[m[side]];
        const one = s && s.turns[i];
        B.push(`**${side}**\n\n\`\`\`\n${one ? one.lines : "(응답 없음)"}\n\`\`\`\n`);
      }
    }
  }
  writeFileSync(join(outDir, "blind", "sessions.md"), B.join("\n") + "\n");

  /* ── 판정표 ── */
  const AX = ["정사·사실 오류", "한국어 비문·번역투", "캐릭터 목소리", "직접 반응",
    "감정·설렘", "다음 말을 하고 싶은가"];
  const SESAX = ["앞서 나온 유저 정보 유지", "같은 질문·화제 반복", "관계 온도의 누적",
    "8턴 뒤에도 같은 인물인가"];
  const K = [];
  K.push("# 판정표\n");
  K.push("`blind/singles.md`와 `blind/sessions.md`만 읽고 채운다.");
  K.push("선택은 **갑 / 을 / 무승부 / 둘 다 탈락** 중 하나.\n");
  for (const it of singles) {
    K.push(`## ${it.label}\n`);
    K.push("- 선택: ");
    for (const a of AX) K.push(`- ${a}: `);
    K.push("- 메모: \n");
  }
  for (const ses of sessions) {
    K.push(`## ${ses.label} (세션)\n`);
    K.push("- 선택: ");
    for (const a of [...AX, ...SESAX]) K.push(`- ${a}: `);
    K.push("- 메모: \n");
  }
  writeFileSync(join(outDir, "blind", "scorecard.md"), K.join("\n") + "\n");

  /* ── 봉인 ── 판정 전에는 열지 않는다 ── */
  writeFileSync(join(outDir, "sealed", "blind-key.json"),
    JSON.stringify({ note: "판정 전에는 열지 않는다", map: keyMap }, null, 2));

  const per = camp => {
    const rs = rows.filter(r => r.camp === camp);
    const st = rs.flatMap(r => r.stages || []);
    const lat = rs.map(r => r.latency || 0).sort((a, b) => a - b);
    const q = p => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] : 0;
    const cost = costOfStages(st);
    const sum = k => st.reduce((n, s) => n + (((s.usage || s)[k]) || 0), 0);
    return { turns: rs.length, ok: rs.filter(r => r.ok).length,
      none: rs.filter(r => !r.ok).length,
      first: rs.filter(r => r.ok && !r.rounds).length,
      retries: rs.reduce((n, r) => n + (r.rounds || 0), 0),
      codes: rs.flatMap(r => r.codes || []),
      calls: st.length, gptCalls: st.filter(s => isGpt(s.model)).length,
      antCalls: st.filter(s => !isGpt(s.model)).length,
      inTok: sum("input_tokens"), cacheTok: sum("cache_read_input_tokens"),
      outTok: sum("output_tokens"), cost: cost.all,
      p50: q(0.5), p95: q(0.95), max: lat[lat.length - 1] || 0 };
  };
  const stageNames = rows.flatMap(r => (r.stages || []).map(s => s.stage));
  const R = [];
  R.push("# 봉인 보고 — 판정 전에는 열지 않는다\n");
  R.push(`- 기대 결과: ${expected}개 · 실제: ${rows.length}개 · 「(응답 없음)」 ${rows.filter(r => !r.ok).length}개`);
  R.push(`- 실제 API 총호출: ${budget.calls} (상한 ${CALL_CAP})`);
  R.push(`- 누적 비용: $${budget.cost.toFixed(4)} (상한 $${COST_CAP})`);
  R.push(`- 상한 중단: ${budget.stopped || "없음"}`);
  R.push(`- finalizer 호출: ${stageNames.filter(s => s === "finalizer").length}`);
  R.push(`- director 호출: ${stageNames.filter(s => s === "director").length}\n`);
  for (const camp of CAMPS) {
    const p = per(camp);
    R.push(`## ${camp}\n`);
    R.push(`- 결과 ${p.turns} · 성공 ${p.ok} · 응답 없음 ${p.none}`);
    R.push(`- 첫 시도 통과 ${p.first}/${p.ok} · Writer 재시도 ${p.retries}회`);
    R.push(`- 탈락 코드: ${p.codes.length ? [...new Set(p.codes)].join(" · ") : "없음"}`);
    R.push(`- 호출 ${p.calls} (다른 진영 ${p.gptCalls} · 기존 ${p.antCalls})`);
    R.push(`- 토큰: 입력 ${p.inTok} · 캐시 ${p.cacheTok} · 출력 ${p.outTok}`);
    R.push(`- 비용 $${p.cost.toFixed(4)}`);
    R.push(`- 지연 p50 ${p.p50}ms · p95 ${p.p95}ms · 최대 ${p.max}ms\n`);
  }
  writeFileSync(join(outDir, "sealed", "report.md"), R.join("\n") + "\n");

  console.log(`\n끝 — 결과 ${rows.length}/${expected} · 호출 ${budget.calls} · $${budget.cost.toFixed(4)}`);
  console.log(`blind: ${join(outDir, "blind")}`);
  if (budget.stopped) console.log(`상한으로 멈췄다 — ${budget.stopped}`);
}
main().catch(e => { console.error(e); process.exit(1); });
