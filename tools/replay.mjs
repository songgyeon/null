#!/usr/bin/env node
/* ── G. 네 갈래 replay 하네스 ──
   같은 입력을 네 경로에 독립 재생해서, 무엇이 실제로 나은지를 잰다.

     hybrid-one     Haiku Writer 후보 1 → Haiku Director ACCEPT/RETRY
     hybrid-pair    Haiku Writer 한 호출 후보 2 → Haiku Director 선택/RETRY
     single-sonnet  Sonnet 4.5 Writer 한 호출 (같은 사실·같은 후처리)
     staged         anchor 턴만 Sonnet 4.5 single Writer, 나머지는 Haiku hybrid

   경로는 워커 코드 그대로다 — 여기서 프롬프트를 다시 조립하지 않는다.
   worker.js를 프로세스 안에서 부르고(env로 경로를 고른다), 워커가 만든
   프롬프트·후처리·Effect를 그대로 탄다. 하네스가 하는 일은 셋뿐이다:
   packet을 나르고, staged의 anchor를 **코드로** 판정하고, 결과를 적는다.

   ── 평가 두 층 ──
   A. 동일 TurnPacket 비교 — test/packets/*.json 하나하나를 네 경로에
      각각 넣는다. 사실 위반·말맛·비용·지연을 같은 입력 위에서 비교한다.
   B. 연속 세션 비교 — test/sessions/*.json 의 같은 초기 세이브와 같은
      유저 입력 순서를 쓰되, **경로마다 독립 세션**으로 굴린다. 자기 출력이
      자기 다음 history에 들어간다 — 한 경로의 출력을 다른 경로 history에
      섞지 않는다. Sonnet이 초반에 만든 말맛을 Haiku가 실제로 이어가는지는
      이 층만 답할 수 있다.

   ── 블라인드 ──
   결과 대사는 경로 이름을 가린 채(갑·을·병·정) blind/ 아래 적는다.
   짝은 blind-key.json에만 있다 — 읽기 전에 열지 않는다.

   ── 비용 ──
   호출 수로 추측하지 않는다. 단계별 usage 실측(stages)에 단가를 곱한다.

   쓰는 법:
     ANTHROPIC_API_KEY=<키> node tools/replay.mjs
     node tools/replay.mjs --fake            # 모델 없이 하네스 자체 점검
   고르기:
     --paths=hybrid-one,hybrid-pair,single-sonnet,staged   (기본: 넷 다)
     --staged-base=pair|one     staged의 비anchor 턴이 탈 hybrid (기본 pair)
     --packets=DIR  --sessions=DIR  --out=DIR  --seed=N

   §12 — 키는 env로만 받고 아무 데도 안 적는다. 자물쇠 값은 프로세스 안
   전용이다. 대화 원문은 replay 산출물(로컬 파일)에만 남는다. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ENG from "../worker.js";
import workerDefault from "../worker.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const worker = workerDefault;

/* ── 클라이언트와 같은 창 ──
   app.js의 값 그대로다. 값이 갈리면 재생이 실사용과 딴 창을 보게 된다 —
   test/engine-pipeline.test.mjs가 app.js 소스와 맞대 검사한다. */
export const HISTORY_CHARS = 12000;
export const SUM_AT = 12000, TAIL_KEEP = 4000;

/* app.js buildHistory의 재생용 사본 — 클라이언트를 흉내 내는 것이 하네스의
   일이라 복제가 본질이다. 모양이 갈리면 위의 소스 검사가 잡는다. */
export const buildHistory = ms => {
  const all = ms.map(m => ({ role: m.sender === "user" ? "user" : "assistant", sender: m.sender,
    ...(m.sys ? { kind: "event" } : {}),
    content: m.photo ? ((m.text ? m.text + " " : "") + "(사진을 보냈다)")
           : (m.sys ? (m.text || "").trim() : m.text) }))
    .filter(m => m.content && m.content.trim());
  const out = []; let used = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const n = all[i].content.length;
    if (out.length && used + n > HISTORY_CHARS) break;
    used += n; out.unshift(all[i]);
  }
  return out;
};
const sinceSum = (upto, ms) => ms.filter(m => m.ts > (upto || 0));

/* ── 경로 → env ──
   ENGINE_MODE=legacy는 안 쓴다 — MODELS의 4.6→5→4.5 폴백을 타서 깨끗한
   Sonnet 4.5 기준선이 아니다. single은 고정 singleWriter를 탄다. */
export const PATHS = ["hybrid-one", "hybrid-pair", "single-sonnet", "staged"];
export const pathEnv = (path, base, anchor) => {
  if (path === "hybrid-one") return { CANDIDATE_MODE: "one" };
  if (path === "hybrid-pair") return { CANDIDATE_MODE: "pair" };
  if (path === "single-sonnet") return { ENGINE_MODE: "single" };
  /* staged — anchor 턴만 Sonnet single. CANDIDATE_MODE는 늘 싣는다:
     워커가 중요 장면에서 anchor를 물리면(anchor_declined) 그 턴은 이 값의
     hybrid 경로로 돈다. */
  const b = { CANDIDATE_MODE: base === "one" ? "one" : "pair" };
  return anchor ? { ...b, ENGINE_MODE: "single", ANCHOR_REASON: anchor } : b;
};

/* ── staged의 anchor 판정 — 모델이 아니라 코드가 정한다 ──
   prev = 직전까지의 관찰 { responses, summary, stageIdx }.
     responses  이 방에서 지금까지 나온 **모델 생성 응답** 수.
                코드 고정 첫 선톡(각본)은 세지 않는다 — 하네스가 만든 응답만
                센다. 중요 장면 경로의 응답도 모델 응답이므로 센다.
     summary    직전 턴에 보낸 요약문. undefined면 「모른다」 — 안 쏜다.
     stageIdx   직전 packet의 관계 단계. undefined면 「모른다」.
   우선순위는 opening → summary_rollover → stage_enter 하나만이다.
   중요 장면(예약 scene_reason)은 기존 중요 장면 경로가 이긴다 — 여기서
   먼저 거르고, 워커 감지로 오르는 장면은 워커의 anchor_declined가 이중으로
   지킨다. 한 턴에 anchor는 한 번이다: 더 높은 사유가 그 턴을 쓰면 낮은
   사유의 「직후 한 턴」은 지나간 것으로 본다 — 그 턴도 이미 Sonnet이다.
   단톡(group)과 관전(auto/health)은 대상이 아니다 — 스테이지 가설은 1:1
   관계의 정착을 재는 것이다.
   캐시 hit/miss·cache_read_input_tokens·경과 시간은 조건이 아니다. */
export function decideAnchor(prev, body) {
  const p = prev || {};
  const room = (body || {}).room;
  if ((body || {}).mode !== "chat") return null;
  if (room !== "jaeeon" && room !== "minhyun") return null;   // group·health 제외
  if ((body || {}).scene_reason) return null;                 // 예약된 중요 장면
  if ((p.responses || 0) < 2) return "opening";
  if (p.summary !== undefined && String((body || {}).summary || "") !== String(p.summary))
    return "summary_rollover";
  if (p.stageIdx !== undefined && stageIdxOf(body) !== p.stageIdx) return "stage_enter";
  return null;
}
/* 워커 4898줄과 같은 식 — 관계 단계 index */
export const stageIdxOf = body => ENG.STAGES.indexOf(
  ENG.stageOf(Number(((body || {}).counts || {})[(body || {}).room]) || 0,
              Math.max(0, Math.floor(Number((body || {}).days) || 0))));

/* ── 단가 — usage 실측 × $/1M ──
   2026-08 API 단가. 캐시 쓰기는 5분 TTL 1.25×(워커의 ephemeral 기본값),
   읽기는 0.1×. 호출 수만 보고 비용을 추측하지 않는다. */
export const PRICES = {
  "claude-haiku-4-5":           { in: 1.00, out: 5.00 },
  "claude-sonnet-4-5-20250929": { in: 3.00, out: 15.00 },
};
export const costOf = rows => (rows || []).reduce((c, r) => {
  const p = PRICES[r.model] || { in: 0, out: 0 };
  return c + (r.input_tokens || 0) * p.in / 1e6
           + (r.output_tokens || 0) * p.out / 1e6
           + (r.cache_creation_input_tokens || 0) * p.in * 1.25 / 1e6
           + (r.cache_read_input_tokens || 0) * p.in * 0.1 / 1e6;
}, 0);
/* 요약 응답에는 stages가 없다(usage 하나뿐) — 그 한 호출을 usage로 잰다.
   요약은 늘 Haiku다(SUMMARY_MODEL). */
export const usageCost = (u, model = "claude-haiku-4-5") =>
  costOf([{ model, ...(u || {}) }]);

/* ── 워커를 프로세스 안에서 부른다 ── */
const LOCK = "replay-local";                 // 프로세스 안 전용 — 밖에 안 적는다
let ipSeq = 0;                               // 20/분/IP 제한을 안 건드리게 호출마다 다른 IP
export async function callWorker(envExtra, body, key) {
  const t0 = Date.now();
  const req = new Request("https://replay.local/?k=" + LOCK, {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json",
      "CF-Connecting-IP": `10.99.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}` } });
  const res = await worker.fetch(req, {
    ANTHROPIC_API_KEY: key, ACCESS_KEY: LOCK, TRACE: "1", ...envExtra });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data, latency_ms: Date.now() - t0 };
}

/* ── 세션 기억 — staged의 prev 관찰과 미니 클라이언트 상태 ── */
export const newMemory = () => ({ responses: {}, lastSummary: {}, lastStageIdx: {} });
export const snapshot = (mem, room) => ({
  responses: mem.responses[room] || 0,
  summary: mem.lastSummary[room],
  stageIdx: mem.lastStageIdx[room],
});
export const noteTurn = (mem, room, body, gotResponse) => {
  if (gotResponse) mem.responses[room] = (mem.responses[room] || 0) + 1;
  mem.lastSummary[room] = String(body.summary || "");
  mem.lastStageIdx[room] = stageIdxOf(body);
};

/* ── 이야기 상태 — 클라이언트 applyStoryTransition과 같은 앞으로만 ── */
const applyTransition = (story, fx) => {
  if (!fx || fx.type !== "story_transition") return story;
  const s = { ...story };
  if (s[fx.key] === fx.from) s[fx.key] = fx.to;
  return s;
};

/* ── 가짜 API — 하네스 자체 점검(--fake)과 파이프라인 테스트가 같이 쓴다 ──
   단계는 프롬프트의 고정 문구로 가른다(test/run.mjs와 같은 방식). usage는
   단계마다 다른 값을 줘서 비용 집계가 실제로 굴러가는지 보이게 한다. */
export const fakeFetch = (replies) => async (url, init) => {
  const c = JSON.parse(init.body);
  const sys = (Array.isArray(c.system) ? c.system : [{ text: c.system }])
    .map(b => b.text || "").join("\n");
  const msgsText = (c.messages || []).map(m => Array.isArray(m.content)
    ? m.content.map(b => b.text || "").join("\n") : m.content).join("\n");
  let text;
  if (sys.includes("대사를 쓰지 않는다 — 고르기만 한다"))
    /* 후보가 하나면 ACCEPT, 둘이면 id로 답해야 한다 — readDecision의 계약 */
    text = JSON.stringify({ decision: msgsText.includes("후보 B") ? "A" : "ACCEPT",
                            reject_codes: {} });
  else if (sys.includes("너는 이 세계의 사실만 본다") || sys.includes("이 사람이 이 사람다운지만 본다"))
    text = '{"problems":[]}';
  else if (sys.includes("이 장면의 마지막 손이다"))
    text = JSON.stringify({ messages: [{ text: "…그 얘기는, 조금만 이따가 해요." }] });
  else if (sys.includes("너는 대화 기록을 압축한다"))
    text = "유저와 짧게 안부를 주고받았다. 특별한 사건은 없었다.";
  else {
    const want = (replies && replies.shift());
    if (want) text = want;
    else text = msgsText.includes('"candidates"')
      ? JSON.stringify({ candidates: [{ messages: [{ text: "네." }] }, { messages: [{ text: "왜요." }] }] })
      : JSON.stringify({ messages: [{ text: "네." }] });
  }
  return { ok: true, status: 200, headers: { get: () => null },
    json: async () => ({ content: [{ type: "text", text }],
      usage: { input_tokens: 1000, output_tokens: 80,
               cache_read_input_tokens: 200, cache_creation_input_tokens: 100 },
      stop_reason: "end_turn" }),
    text: async () => "" };
};

/* ── 결정적 섞기 — 블라인드 이름표는 자리로 못 맞히게 한다 ── */
const mulberry = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const hashOf = s => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
export const shuffled = (arr, seedStr) => {
  const rnd = mulberry(hashOf(seedStr));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ══════════════════ CLI ══════════════════ */
const argOf = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const has = name => process.argv.includes(`--${name}`);

async function main() {
  const FAKE = has("fake");
  const KEY = process.env.ANTHROPIC_API_KEY || "";
  if (!FAKE && !KEY) {
    console.error("ANTHROPIC_API_KEY가 없다. 실제 재생은 키가 있어야 한다 —");
    console.error("  ANTHROPIC_API_KEY=<키> node tools/replay.mjs");
    console.error("모델 없이 하네스만 점검하려면: node tools/replay.mjs --fake");
    process.exit(1);
  }
  if (FAKE) globalThis.fetch = fakeFetch();

  const paths = argOf("paths", PATHS.join(",")).split(",").map(s => s.trim())
    .map(s => ({ one: "hybrid-one", pair: "hybrid-pair", single: "single-sonnet" }[s] || s))
    .filter(s => PATHS.includes(s));
  const stagedBase = argOf("staged-base", "pair") === "one" ? "one" : "pair";
  const seed = argOf("seed", "7");
  const outDir = join(ROOT, argOf("out", FAKE ? "replay-out-fake" : "replay-out"));
  const packetsDir = join(ROOT, argOf("packets", "test/packets"));
  const sessionsDir = join(ROOT, argOf("sessions", "test/sessions"));
  mkdirSync(join(outDir, "trace"), { recursive: true });
  mkdirSync(join(outDir, "blind"), { recursive: true });

  const loadDir = dir => !existsSync(dir) ? [] :
    readdirSync(dir).filter(f => f.endsWith(".json")).sort()
      .map(f => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }));

  const key = FAKE ? "sk-fake" : KEY;
  const results = [];           // { item, kind, path, turn, ok, status, cost, latency, calls, retries, messages, trace }
  const blindItems = [];        // { item, kind, context, byPath: {path: text} }

  /* ── A층 — 동일 TurnPacket을 네 경로에 각각 ── */
  for (const pkt of loadDir(packetsDir)) {
    const label = pkt.label || basename(pkt.file, ".json");
    const byPath = {};
    for (const path of paths) {
      const prev = pkt.meta && pkt.meta.prev
        ? { responses: pkt.meta.prev.responses ?? 99,
            summary: pkt.meta.prev.summary,
            stageIdx: pkt.meta.prev.stage_idx }
        : { responses: 99 };            // prev를 모르면 anchor는 안 선다
      const anchor = path === "staged" ? decideAnchor(prev, pkt.body) : null;
      const body = { ...pkt.body, request_id: `rp-A-${label}-${path}` };
      const r = await callWorker(pathEnv(path, stagedBase, anchor), body, key);
      const row = record(results, { item: label, kind: "packet", path, turn: 0 }, r, anchor);
      byPath[path] = row.rendered;
      writeFileSync(join(outDir, "trace", `A-${label}-${path}.json`),
        JSON.stringify(row.trace, null, 2));
      console.log(`A ${label} · ${path}${anchor ? ` · anchor:${anchor}` : ""} → ${r.status}`);
    }
    /* blurb는 trace·보고용이다 — 블라인드에는 중립 문맥만 싣는다. 「staged라면
       여기서 Sonnet」 같은 말이 들어가면 읽는 눈이 그걸 찾기 시작한다. */
    blindItems.push({ item: `A-${label}`, kind: "packet",
      context: contextOf(pkt.body), byPath });
  }

  /* ── B층 — 같은 세이브·같은 입력 순서를 경로마다 독립 세션으로 ── */
  for (const ses of loadDir(sessionsDir)) {
    const label = ses.label || basename(ses.file, ".json");
    for (const path of paths) {
      /* 경로마다 처음부터 다시 — 다른 경로의 출력을 절대 섞지 않는다 */
      const msgs = JSON.parse(JSON.stringify((ses.seed && ses.seed.msgs) || {}));
      const sums = JSON.parse(JSON.stringify((ses.seed && ses.seed.sum) || {}));
      let story = { firstContact: "unseen", jaeeonMemory: "hidden",
                    partnerKnown: { jaeeon: false, minhyun: false },
                    ...(ses.seed && ses.seed.story || {}) };
      const mem = newMemory();
      const transcript = [];
      for (let i = 0; i < (ses.turns || []).length; i++) {
        const t = ses.turns[i];
        const room = t.room;
        msgs[room] = msgs[room] || [];
        msgs[room].push({ sender: "user", text: t.text, ts: t.ts });
        const sum = sums[room] || { text: "", upto: 0 };
        const body = {
          mode: "chat", room, user_name: ses.user_name || "선생님",
          history: buildHistory(sinceSum(sum.upto, msgs[room])),
          counts: Object.fromEntries(["jaeeon", "minhyun", "group", "health"]
            .map(r => [r, (msgs[r] || []).length])),
          days: t.days ?? 0, now: t.now, day: t.day,
          gifts: {}, story, request_id: `rp-B-${label}-${path}-${i}`,
          ...(sum.text ? { summary: sum.text } : {}),
          ...(ses.partner ? { partner: ses.partner } : {}),
          ...(t.greet ? { greet: true } : {}),
          ...(t.scene_reason ? { scene_reason: t.scene_reason } : {}),
          ...(t.extra || {}),
        };
        const anchor = path === "staged" ? decideAnchor(snapshot(mem, room), body) : null;
        const r = await callWorker(pathEnv(path, stagedBase, anchor), body, key);
        const row = record(results, { item: label, kind: "session", path, turn: i }, r, anchor);
        writeFileSync(join(outDir, "trace", `B-${label}-${path}-${String(i).padStart(2, "0")}.json`),
          JSON.stringify(row.trace, null, 2));
        transcript.push({ user: t.text, reply: row.rendered, anchor });
        noteTurn(mem, room, body, r.ok);
        if (r.ok && r.data) {
          (r.data.messages || []).forEach((m, k) => msgs[room].push({
            sender: m.sender || room, text: m.text || "",
            ...(m.photo ? { photo: m.photo } : {}), ts: t.ts + 1000 + k }));
          (r.data.effects || []).forEach(fx => { story = applyTransition(story, fx); });
          if (r.data.scene_ack) {
            /* partner 계열 장면이 승인되면 **그 방 사람이** 알게 된다 —
               partner_confirm은 상대 본인 방, partner_known은 다른 사람 방.
               둘 다 그 방의 인물이 아는 쪽이다(클라이언트 markPartnerKnown 방향). */
            if (r.data.scene_ack === "partner_confirm" || r.data.scene_ack === "partner_known") {
              story = { ...story, partnerKnown: { ...story.partnerKnown, [room]: true } };
            }
          }
        }
        /* 요약 굴리기 — 클라이언트 rollSummary와 같은 문턱·같은 꼬리 */
        const un = sinceSum(sum.upto, msgs[room]);
        const total = un.reduce((n, m) => n + ((m.text || "").length), 0);
        if (total >= SUM_AT) {
          let keep = 0, cut = un.length;
          for (let k = un.length - 1; k >= 0; k--) {
            keep += (un[k].text || "").length;
            if (keep >= TAIL_KEEP) { cut = k; break; }
          }
          const chunk = un.slice(0, cut);
          if (chunk.length) {
            const sr = await callWorker({}, { mode: "summarize", room,
              user_name: ses.user_name || "선생님", summary: sum.text,
              history: buildHistory(chunk) }, key);
            /* 요약도 그 경로 세션의 실제 비용이다 — 경로마다 답 길이가 달라
               굴림 시점이 갈릴 수 있으니 따로 재서 합에 넣는다 */
            results.push({ item: label, kind: "summary", path, turn: i,
              ok: sr.ok, cost: usageCost(sr.data && sr.data.usage),
              latency: sr.latency_ms, calls: 1, retries: 0, anchor: null });
            if (sr.ok && sr.data && sr.data.summary) {
              sums[room] = { text: sr.data.summary, upto: chunk[chunk.length - 1].ts };
              console.log(`B ${label} · ${path} · 요약 갱신 (${total}자 → ${sr.data.summary.length}자)`);
            }
          }
        }
        console.log(`B ${label} · ${path} · #${i}${anchor ? ` · anchor:${anchor}` : ""} → ${r.status}`);
      }
      /* 세션도 중립 문맥만 — blurb의 anchor 얘기는 블라인드 읽기를 오염시킨다 */
      blindItems.push({ item: `B-${label}`, kind: "session",
        context: `${{ jaeeon: "이재언", minhyun: "이민현", group: "단톡" }[ses.turns[0].room] || ""} — ${ses.turns.length}턴 연속 세션`,
        byPath: { [path]: transcript }, partial: path });
    }
  }

  /* ── 블라인드 묶기 ── */
  const key2blind = {};
  for (const item of dedupBlind(blindItems)) {
    const order = shuffled(Object.keys(item.byPath).sort(), seed + item.item);
    const tags = ["갑", "을", "병", "정"];
    const lines = [`# ${item.item}`, "", item.context ? `상황: ${item.context}` : "", ""];
    order.forEach((path, i) => {
      key2blind[`${item.item}/${tags[i]}`] = path;
      lines.push(`## ${tags[i]}`, "");
      const v = item.byPath[path];
      if (Array.isArray(v)) v.forEach(turn => {
        lines.push(`**유저**: ${turn.user}`);
        lines.push(`**응답**: ${turn.reply || "(실패)"}`, "");
      });
      else lines.push(v || "(실패)", "");
    });
    writeFileSync(join(outDir, "blind", `${item.item}.md`), lines.join("\n"));
  }
  writeFileSync(join(outDir, "blind-key.json"), JSON.stringify(key2blind, null, 2));

  /* ── 비용·지연 보고 (경로 이름이 있다 — 블라인드 읽기 뒤에 본다) ── */
  const per = {};
  for (const r of results) {
    const p = per[r.path] = per[r.path] || { calls: 0, cost: 0, latency: 0, turns: 0,
      retries: 0, fails: 0, anchors: 0, declined: 0 };
    p.turns++; p.cost += r.cost; p.latency += r.latency; p.calls += r.calls;
    p.retries += r.retries; if (!r.ok) p.fails++;
    if (r.ranAnchor) p.anchors++; if (r.declined) p.declined++;
  }
  const fmt = n => n.toFixed(4);
  const rep = ["# G replay 보고", "",
    FAKE ? "**--fake 모드 — 모델 없이 하네스만 굴렸다. 숫자는 배선 점검용이다.**" : "",
    "", "| 경로 | 턴 | 호출 | 재시도 | 실패 | anchor | anchor 물림 | 비용($) | 지연 합(ms) |",
    "|---|---|---|---|---|---|---|---|---|"];
  for (const [path, p] of Object.entries(per))
    rep.push(`| ${path} | ${p.turns} | ${p.calls} | ${p.retries} | ${p.fails} | ${p.anchors} | ${p.declined} | ${fmt(p.cost)} | ${p.latency} |`);
  rep.push("", "턴별 상세는 trace/, 대사 비교는 blind/ (이름표는 blind-key.json).");
  writeFileSync(join(outDir, "report.md"), rep.join("\n"));
  console.log(`\n끝 — ${results.length}턴. 보고: ${join(outDir, "report.md")}`);
}

/* 세션 blind 조각(경로별로 따로 만든 것)을 한 item으로 합친다 */
function dedupBlind(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.item)) map.set(it.item, { ...it, byPath: { ...it.byPath } });
    else Object.assign(map.get(it.item).byPath, it.byPath);
  }
  return [...map.values()];
}

function contextOf(body) {
  const r = { jaeeon: "이재언 1:1", minhyun: "이민현 1:1", group: "단톡", health: "관전" }[body.room] || body.room;
  const last = [...(body.history || [])].reverse().find(m => m.role === "user");
  return `${r}${body.now ? ` · ${body.now}` : ""} — 유저: 「${(last && last.content || "").slice(0, 60)}」`;
}

function record(results, base, r, anchor) {
  const stages = (r.data && r.data.stages) || [];
  const messages = (r.data && r.data.messages) || [];
  const trace = {
    ...base, anchor_reason: anchor || null,
    ok: r.ok, status: r.status, latency_ms: r.latency_ms,
    engine: (r.data && r.data.trace) || null,      // engine_mode·candidate_mode·writer_model·route·turnContext·selectedCandidate
    stages, usage_total: r.data && r.data.usage_total, usage: r.data && r.data.usage,
    effects: (r.data && r.data.effects) || [],
    finalMessages: messages,
    error: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status),
  };
  /* 제안한 anchor와 실제로 선 anchor는 다르다 — 중요 장면과 겹치면 워커가
     물린다(anchor_declined). 보고에는 실제로 선 것을 센다. */
  const ranAnchor = !!(r.data && r.data.trace && r.data.trace.anchor_reason);
  const row = { ...base, ok: r.ok, cost: costOf(stages), latency: r.latency_ms,
    calls: stages.length, retries: stages.filter(s => s.attempt > 1).length,
    anchor: anchor || null, ranAnchor,
    declined: !!(r.data && r.data.trace && r.data.trace.anchor_declined), trace,
    rendered: messages.map(m => `${m.sender ? m.sender + ": " : ""}${m.photo ? "(사진) " : ""}${m.text || ""}`).join("\n") };
  results.push(row);
  return row;
}

/* 곧장 실행됐을 때만 CLI로 돈다 — 테스트는 위 함수들만 들여온다 */
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => { console.error("replay 실패:", e); process.exit(1); });
}
