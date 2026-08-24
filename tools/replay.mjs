#!/usr/bin/env node
/* ── G. 네 갈래 replay 하네스 ──
   같은 입력을 네 경로에 독립 재생해서, 무엇이 실제로 나은지를 잰다.

     hybrid-one     저비용 Writer 후보 1 → 저비용 Director ACCEPT/RETRY
     hybrid-pair    저비용 Writer 한 호출 후보 2 → 저비용 Director 선택/RETRY
     single-sonnet  single 비교 Writer 한 호출 (같은 사실·같은 후처리)
     staged         anchor 턴만 single 비교 Writer, 나머지는 저비용 hybrid

   경로는 워커 코드 그대로다 — 여기서 프롬프트를 다시 조립하지 않는다.
   worker.js를 프로세스 안에서 부르고(env로 경로를 고른다), 워커가 만든
   프롬프트·후처리·Effect를 그대로 탄다. 하네스가 하는 일은 넷뿐이다:
   packet을 나르고, staged의 anchor를 **코드로** 판정하고, 실행 순서를
   균형화하고, 결과를 적는다.

   ── 측정기의 공정 계약 ──
   · 실행 순서는 고정하지 않는다 — packet과 세션 턴마다 결정적 회전
     (Latin square)으로 균형화한다. 뒤에 도는 경로가 앞 경로가 데운 프롬프트
     캐시를 받는 편향을 없앤다. 각 경로가 1·2·3·4번째에 서는 횟수 차는
     최대 1이다.
   · 대화 턴과 요약 호출은 따로 센다 — 섞으면 경로당 턴 수가 거짓말이 된다.
   · 비용은 usage 실측 × 단가다. 캐시 쓰기는 워커의 TTL 계약(1h)대로 2×,
     읽기는 0.1×. 단가를 모르는 모델이 하나라도 나오면 보고는 INVALID이고
     비정상 종료한다 — $0으로 조용히 새지 않는다.
   · 연속 세션에서 실패한 턴 뒤로는 진행하지 않는다 — 같은 body·같은
     request_id로 한 번 UI 재시도하고, 그래도 실패면 그 경로의 세션은
     incomplete로 끝난다. 실패 뒤에 유저 발화가 연달아 쌓인 기록은 실제
     앱에 존재할 수 없다.
   · 예상 밖의 UI Effect(초대·물건)가 나오면 그 세션은 invalid로 끝난다 —
     하네스는 그 창에 답할 수 없으므로 무시하고 진행하면 앱과 다른 기록이 된다.

   ── 평가 두 층 ──
   A. 동일 TurnPacket 비교 — test/packets/*.json 하나하나를 네 경로에.
   B. 연속 세션 비교 — test/sessions/*.json 을 **경로마다 독립 세션**으로,
      턴 단위로 교차 실행한다. 자기 출력이 자기 다음 history에만 들어간다.

   ── 블라인드 ──
   대사는 경로 이름을 가린 채(갑·을·병·정) blind/ 아래 적는다.
   짝은 blind-key.json에만 있다 — 읽기 전에 열지 않는다.

   쓰는 법:
     ANTHROPIC_API_KEY=<키> node tools/replay.mjs
     node tools/replay.mjs --fake            # 모델 없이 하네스 자체 점검
   고르기:
     --paths=hybrid-one,hybrid-pair,single-sonnet,staged   (기본: 넷 다)
     --staged-base=pair|one     staged의 비anchor 턴이 탈 hybrid (기본 pair)
     --packets=DIR  --sessions=DIR  --out=DIR  --seed=N
   모르는 경로·중복·빈 목록, 없는/빈 packet·session 디렉터리, 비어 있지
   않은 --out은 전부 비정상 종료다 — 반쯤 도는 것보다 안 도는 게 낫다.

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
/* app.js recentPhotos의 사본 — 최근 24개에서 뒤부터, 겹치지 않게 넷까지 */
const recentPhotosOf = ms => {
  const tail = (ms || []).slice(-24), out = [];
  for (let i = tail.length - 1; i >= 0 && out.length < 4; i--)
    if (tail[i].photo && !out.includes(tail[i].photo)) out.push(tail[i].photo);
  return out;
};

/* ── 경로 → env ──
   ENGINE_MODE=legacy는 안 쓴다 — MODELS 표의 폴백 사슬을 타서 깨끗한
   single 비교 Writer 기준선이 아니다. single은 고정 singleWriter를 탄다. */
export const PATHS = ["hybrid-one", "hybrid-pair", "single-sonnet", "staged",
  /* 동세대 비교 팔 — single/anchor Writer만 비교 모델(SONNET46)로 바꿔 끼운다.
     기본 실행(--paths 생략)에는 안 들어간다 — 명시로만 돈다. */
  "single-sonnet46", "staged-46",
  /* G3 — 상급 Writer가 한 호출로 후보 A·B, 저비용 Director가 선택, 못 고르면
     폴백 Writer 한 번. 명시로만 돈다. 혼자 돌면 산출물이
     selected-blind/·pair-blind/·pair-key.json으로 바뀐다. */
  "sonnet5-pair-haiku"];
export const DEFAULT_PATHS = PATHS.slice(0, 4);
const SONNET46 = "claude-sonnet-4-6";
/* staged 계열인가 — anchor 판정을 타는 경로 */
export const isStaged = path => String(path).startsWith("staged");
export const pathEnv = (path, base, anchor) => {
  if (path === "sonnet5-pair-haiku") return { ENGINE_MODE: "sonnet5-pair-haiku" };
  if (path === "hybrid-one") return { CANDIDATE_MODE: "one" };
  if (path === "hybrid-pair") return { CANDIDATE_MODE: "pair" };
  if (path === "single-sonnet") return { ENGINE_MODE: "single" };
  if (path === "single-sonnet46")
    return { ENGINE_MODE: "single", SONNET_WRITER_MODEL: SONNET46 };
  const b = { CANDIDATE_MODE: base === "one" ? "one" : "pair" };
  if (!anchor) return b;
  return path === "staged-46"
    ? { ...b, ENGINE_MODE: "single", ANCHOR_REASON: anchor, SONNET_WRITER_MODEL: SONNET46 }
    : { ...b, ENGINE_MODE: "single", ANCHOR_REASON: anchor };
};
/* 실행 순서 균형 — 결정적 회전. k번째 항목은 k만큼 돌린 순서로 돈다 */
export const rotated = (paths, k) => {
  const n = paths.length, s = ((k % n) + n) % n;
  return paths.slice(s).concat(paths.slice(0, s));
};

/* ── staged의 anchor 판정 — 모델이 아니라 코드가 정한다 ──
   prev = 직전까지의 관찰 { responses, summaryUpto, stageIdx }.
     responses   이 방에서 지금까지 나온 **모델 생성 응답** 수. 각본 선톡은
                 안 세고, 실패한 턴도 안 센다.
     summaryUpto 직전 성공 턴에 쓰인 요약의 upto. **rollover는 문장이 아니라
                 upto의 전진으로 판정한다** — 같은 요약문이어도 upto가
                 전진했으면 원문 창이 실제로 밀린 것이고, 문장만 바뀌고
                 upto가 같으면 굴림이 아니다.
     stageIdx    직전 성공 턴의 관계 단계.
   우선순위는 opening → summary_rollover → stage_enter 하나만이다.
   중요 장면 여부는 여기서 선제 차단하지 않는다 — anchor 후보를 워커에
   보내고, **워커가 실제로 critical로 승인했을 때만** anchor_declined가
   작동한다. 승인 안 된 낡은 scene_reason이 anchor를 막으면 안 된다.
   물린 anchor는 소진되지 않는다 — noteTurn이 관찰을 안 전진시켜서 다음
   적격 턴에 다시 선다. 단톡(group)과 관전(auto/health)은 대상이 아니다.
   캐시 hit/miss·cache_read_input_tokens·경과 시간은 조건이 아니다. */
export function decideAnchor(prev, body, curUpto) {
  const p = prev || {};
  const room = (body || {}).room;
  if ((body || {}).mode !== "chat") return null;
  if (room !== "jaeeon" && room !== "minhyun") return null;   // group·health 제외
  if ((p.responses || 0) < 2) return "opening";
  if (p.summaryUpto !== undefined && Number(curUpto || 0) > Number(p.summaryUpto))
    return "summary_rollover";
  if (p.stageIdx !== undefined && stageIdxOf(body) !== p.stageIdx) return "stage_enter";
  return null;
}
/* 워커와 같은 식 — 관계 단계 index */
export const stageIdxOf = body => ENG.STAGES.indexOf(
  ENG.stageOf(Number(((body || {}).counts || {})[(body || {}).room]) || 0,
              Math.max(0, Math.floor(Number((body || {}).days) || 0))));

/* ── 단가 — usage 실측 × $/1M ──
   캐시 쓰기는 **워커의 캐시 계약(CACHE ttl "1h")과 같은 2×**다 — 5분 TTL의
   1.25×를 쓰면 실제 청구보다 싸게 잰다. 읽기는 0.1×. */
export const PRICES = {
  "claude-haiku-4-5":  { in: 1.00, out: 5.00 },
  "claude-sonnet-4-5": { in: 3.00, out: 15.00 },
  /* 요약의 폴백(askClaude의 MODELS)까지 — 폴백이 탄 호출이 새면 안 된다 */
  "claude-sonnet-4-6": { in: 3.00, out: 15.00 },
  "claude-sonnet-5":   { in: 2.00, out: 10.00 },
};
export const CACHE_WRITE_X = 2.0;      // 워커 CACHE ttl "1h"의 쓰기 배율
/* 날짜 접미(claude-…-20250929)는 떼고 찾는다. 그래도 모르는 모델은 적어
   두고, 보고 시점에 INVALID + 비정상 종료다 — $0으로 조용히 안 샌다. */
export const unknownModels = new Set();
export const priceFor = model => {
  const id = String(model || "");
  const hit = PRICES[id] || PRICES[id.replace(/-\d{8}$/, "")];
  if (hit) return hit;
  if (id && !unknownModels.has(id)) {
    unknownModels.add(id);
    console.error(`[replay] 단가를 모르는 모델 — ${id}. 보고는 INVALID다. PRICES에 추가하라.`);
  }
  return { in: 0, out: 0 };
};
export const costOf = rows => (rows || []).reduce((c, r) => {
  const p = priceFor(r.model);
  return c + (r.input_tokens || 0) * p.in / 1e6
           + (r.output_tokens || 0) * p.out / 1e6
           + (r.cache_creation_input_tokens || 0) * p.in * CACHE_WRITE_X / 1e6
           + (r.cache_read_input_tokens || 0) * p.in * 0.1 / 1e6;
}, 0);
/* 요약 응답에는 stages가 없다(usage 하나뿐) — 그 한 호출을 usage로 잰다.
   워커 callModel이 usage.model을 늘 실어 보내므로 그것이 이긴다. */
export const usageCost = (u, model = "claude-haiku-4-5") =>
  costOf([{ model, ...(u || {}) }]);
const cacheSums = rows => (rows || []).reduce((a, r) => ({
  w: a.w + (r.cache_creation_input_tokens || 0),
  r: a.r + (r.cache_read_input_tokens || 0) }), { w: 0, r: 0 });

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

/* ── 세션 기억 — staged의 prev 관찰 ── */
export const newMemory = () => ({ responses: {}, lastSummaryUpto: {}, lastStageIdx: {} });
export const snapshot = (mem, room) => ({
  responses: mem.responses[room] || 0,
  summaryUpto: mem.lastSummaryUpto[room],
  stageIdx: mem.lastStageIdx[room],
});
export const noteTurn = (mem, room, gotResponse, obs) => {
  /* 관찰은 **응답이 실제로 나온 턴만** 갱신한다 — 실패한 턴은 opening도
     rollover도 stage_enter도 소진하지 않는다. 그리고 **물린 anchor도
     소진되지 않는다**: 워커가 중요 장면으로 anchor를 물렸으면(declined)
     upto·단계 관찰을 전진시키지 않아서, 다음 적격 턴에 같은 사유가 다시
     선다. 응답 수는 물려도 센다 — 그 턴의 응답은 실제로 나왔다. */
  if (!gotResponse) return;
  mem.responses[room] = (mem.responses[room] || 0) + 1;
  if (obs && obs.declined) return;
  mem.lastSummaryUpto[room] = obs ? obs.upto : 0;
  mem.lastStageIdx[room] = obs ? obs.stageIdx : undefined;
};

/* ── 이야기 상태 — 클라이언트 applyStoryTransition과 같은 앞으로만 ── */
const applyTransition = (story, fx) => {
  if (!fx || fx.type !== "story_transition") return story;
  const s = { ...story };
  if (s[fx.key] === fx.from) s[fx.key] = fx.to;
  return s;
};

/* ══════════════ B층 — 연속 세션 실행기 ══════════════
   경로마다 독립 상태를 들고 **턴 단위로 교차** 실행한다. 턴마다 회전된
   순서(rotBase부터)라 캐시를 먼저 데우는 경로가 고정되지 않는다.
   opts.call(env, body) → {ok, status, data, latency_ms} — 주입 가능해서
   테스트가 실패를 심을 수 있다. 반환: 경로별 상태(rows·transcript·status). */
export async function runSession(ses, paths, opts) {
  const { call, stagedBase = "pair", uiRetries = 1, rotBase = 0, onTurn, envFor } = opts;
  const room0 = ses.turns[0].room;
  const seed = ses.seed || {};
  const states = {};
  for (const path of paths) {
    const mem = newMemory();
    if (seed.responses) Object.assign(mem.responses, seed.responses);
    states[path] = {
      path, msgs: JSON.parse(JSON.stringify(seed.msgs || {})),
      sums: JSON.parse(JSON.stringify(seed.sum || {})),
      story: { firstContact: "unseen", jaeeonMemory: "hidden",
               partnerKnown: { jaeeon: false, minhyun: false }, ...(seed.story || {}) },
      mem, alive: true, status: "complete", rows: [], sumRows: [], transcript: [],
    };
  }
  for (let i = 0; i < ses.turns.length; i++) {
    const t = ses.turns[i];
    const room = t.room;
    const order = rotated(paths, rotBase + i);
    for (const path of order) {
      const st = states[path];
      if (!st.alive) continue;
      st.msgs[room] = st.msgs[room] || [];
      st.msgs[room].push({ sender: "user", text: t.text, ts: t.ts });
      const sum = st.sums[room] || { text: "", upto: 0 };
      /* 클라이언트가 chat 턴마다 상시로 싣는 것들 — fixture의 met/refused/
         bag/gifts를 보존한다. 시계·해금 규칙이 필요한 것(states·closed·
         can_go)은 지어내지 않는다 — 필요한 대본은 t.extra로 선언한다. */
      const midnight = t.ts - ((t.ts + 9 * 3600e3) % 86400e3);
      const signals = {};
      ["jaeeon", "minhyun", "group"].forEach(r => {
        if (r === room) return;
        const ms = st.msgs[r] || []; if (!ms.length) return;
        signals[r] = { count: ms.filter(m => m.ts >= midnight).length,
          minsAgo: Math.max(0, Math.floor((t.ts - ms[ms.length - 1].ts) / 60000)) };
      });
      const body = {
        mode: "chat", room, user_name: ses.user_name || "선생님",
        history: buildHistory(sinceSum(sum.upto, st.msgs[room])),
        counts: Object.fromEntries(["jaeeon", "minhyun", "group", "health"]
          .map(r => [r, (st.msgs[r] || []).length])),
        days: t.days ?? 0, now: t.now, day: t.day,
        gifts: seed.gifts || {}, bag: seed.bag || [],
        met: seed.met || [], refused: seed.refused || [],
        recent_photos: recentPhotosOf(st.msgs[room]),
        ...(Object.keys(signals).length ? { signals } : {}),
        origin_phase: ses.origin_phase || "unasked",
        story: st.story, request_id: `rp-B-${ses.label}-${path}-${i}`,
        ...(sum.text ? { summary: sum.text } : {}),
        ...(ses.partner ? { partner: ses.partner } : {}),
        ...(t.greet ? { greet: true } : {}),
        ...(t.scene_reason ? { scene_reason: t.scene_reason } : {}),
        ...(t.extra || {}),
      };
      const anchor = isStaged(path)
        ? decideAnchor(snapshot(st.mem, room), body, sum.upto) : null;
      /* envFor — G2 모델 스윕처럼 경로 이름이 곧 모델인 실행이 env를 직접
         꽂는 자리. 없으면 기존 경로 표(pathEnv) 그대로다. */
      const env = envFor ? envFor(path, anchor) : pathEnv(path, stagedBase, anchor);
      /* UI 재시도 — 실제 앱처럼 같은 body·같은 request_id로, 제한적으로.
         모델 내부 attempt(stages의 attempt)와는 따로 센다. 비용은 실패한
         시도 것까지 전부 합산한다 — 실제로 청구된 돈이다. */
      let r = await call(env, body), ui = 0;
      let allStages = (r.data && r.data.stages) || [];
      let latency = r.latency_ms;
      while (!r.ok && ui < uiRetries) {
        ui++;
        r = await call(env, body);
        allStages = allStages.concat((r.data && r.data.stages) || []);
        latency += r.latency_ms;
      }
      const declined = !!(r.ok && r.data.trace && r.data.trace.anchor_declined);
      const row = {
        item: ses.label, kind: "chat", layer: "B", path, turn: i, ok: r.ok, status: r.status,
        anchor: anchor || null,
        ranAnchor: !!(r.ok && r.data.trace && r.data.trace.anchor_reason),
        declined, ui_retries: ui,
        rounds: allStages.length ? Math.max(...allStages.map(s => s.attempt || 1)) - 1 : 0,
        calls: allStages.length, cost: costOf(allStages), latency,
        cache: cacheSums(allStages),
        trace: {
          item: ses.label, kind: "chat", path, turn: i, anchor_reason: anchor || null,
          ok: r.ok, status: r.status, ui_retries: ui, latency_ms: latency,
          engine: (r.data && r.data.trace) || null,
          stages: allStages, usage_total: r.data && r.data.usage_total,
          usage: r.data && r.data.usage, effects: (r.data && r.data.effects) || [],
          finalMessages: (r.data && r.data.messages) || [],
          error: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status),
        },
      };
      st.rows.push(row);
      if (onTurn) onTurn(row);
      if (!r.ok) {
        /* 실패한 턴 뒤로는 진행하지 않는다 — 유저 발화가 연달아 쌓인 기록은
           실제 앱에 존재할 수 없다. 유저 말은 남고(재시도 UI의 모습) 세션은
           여기서 incomplete로 끝난다. */
        st.alive = false; st.status = "incomplete"; st.stoppedAt = i;
        st.transcript.push({ user: t.text, reply: "(실패 — 세션 중단)" });
        continue;
      }
      /* 예상 밖의 UI Effect — 초대·물건 창에 하네스는 답할 수 없다.
         무시하고 진행하면 앱에 존재할 수 없는 기록이 되므로 invalid로 끝낸다 */
      const fx = (r.data.effects || []);
      const uiFx = fx.find(f => f && f.type !== "story_transition");
      if (uiFx) {
        st.alive = false; st.status = "invalid"; st.stoppedAt = i;
        st.invalidWhy = `예상 밖 Effect: ${uiFx.type}`;
        st.transcript.push({ user: t.text,
          reply: (r.data.messages || []).map(m => m.text || "").join("\n") + "\n(세션 중단)" });
        noteTurn(st.mem, room, true, { upto: sum.upto, stageIdx: stageIdxOf(body), declined });
        continue;
      }
      (r.data.messages || []).forEach((m, k) => st.msgs[room].push({
        sender: m.sender || room, text: m.text || "",
        ...(m.photo ? { photo: m.photo } : {}), ts: t.ts + 1000 + k }));
      fx.forEach(f => { st.story = applyTransition(st.story, f); });
      if (r.data.scene_ack === "partner_confirm" || r.data.scene_ack === "partner_known")
        st.story = { ...st.story, partnerKnown: { ...st.story.partnerKnown, [room]: true } };
      st.transcript.push({ user: t.text,
        reply: (r.data.messages || []).map(m =>
          `${m.sender ? m.sender + ": " : ""}${m.photo ? "(사진) " : ""}${m.text || ""}`).join("\n") });
      noteTurn(st.mem, room, true, { upto: sum.upto, stageIdx: stageIdxOf(body), declined });
      /* 요약 굴리기 — 클라이언트 rollSummary와 같은 문턱·같은 꼬리·같은
         실행 조건(성공 경로에서만). 요약 호출은 대화 턴과 **따로** 센다. */
      const un = sinceSum(sum.upto, st.msgs[room]);
      const total = un.reduce((n, m) => n + ((m.text || "").length), 0);
      if (total >= SUM_AT) {
        let keep = 0, cut = un.length;
        for (let k = un.length - 1; k >= 0; k--) {
          keep += (un[k].text || "").length;
          if (keep >= TAIL_KEEP) { cut = k; break; }
        }
        const chunk = un.slice(0, cut);
        if (chunk.length) {
          const sr = await call({}, { mode: "summarize", room,
            user_name: ses.user_name || "선생님", summary: sum.text,
            history: buildHistory(chunk) });
          const su = sr.data && sr.data.usage;
          st.sumRows.push({ item: ses.label, kind: "summary", path, turn: i,
            ok: sr.ok, cost: usageCost(su), latency: sr.latency_ms, calls: 1,
            trace: { item: ses.label, kind: "summary", path, turn: i, ok: sr.ok,
              model: (su && su.model) || "claude-haiku-4-5", usage: su,
              latency_ms: sr.latency_ms, cost: usageCost(su) } });
          if (sr.ok && sr.data && sr.data.summary) {
            st.sums[room] = { text: sr.data.summary, upto: chunk[chunk.length - 1].ts };
            console.log(`B ${ses.label} · ${path} · 요약 갱신 (${total}자 → ${sr.data.summary.length}자)`);
          }
        }
      }
    }
  }
  return states;
}

/* ── 가짜 API — 하네스 자체 점검(--fake)과 파이프라인 테스트가 같이 쓴다 ──
   단계는 프롬프트의 고정 문구로 가른다. 답 길이는 실측(두 덩이, 출력
   60~110토큰)과 비슷하게 준다 — 짧은 가짜 답이면 요약 문턱 같은 누적
   조건이 fake 모드에서 영영 안 밟힌다. */
export const fakeFetch = (replies) => {
  /* T10 강제 재시도 — Director RETRY가 attempt별 산출물에 남는지를 하네스가
     실행으로 검증하려면, 한 턴은 실제로 RETRY를 겪어야 한다. Director 패킷은
     attempt 1과 2가 같은 글자라 내용으로는 못 가르므로 닫힘 변수로 센다. */
  let t10Directors = 0;
  return async (url, init) => {
  const c = JSON.parse(init.body);
  const sys = (Array.isArray(c.system) ? c.system : [{ text: c.system }])
    .map(b => b.text || "").join("\n");
  const msgsText = (c.messages || []).map(m => Array.isArray(m.content)
    ? m.content.map(b => b.text || "").join("\n") : m.content).join("\n");
  let text;
  if (sys.includes('{"choice"'))
    /* G3 판정기 — 살아 있는 후보 중 앞엣것을 고른다(출력 모양이 다르다).
       위 운영 Director 분기보다 먼저 가른다 — 문구가 겹친다. */
    text = JSON.stringify({ choice: msgsText.includes("후보 A는 코드 검사에서 탈락")
        ? "B" : "A", reason_codes: [], fact_id: null, rule_id: null });
  else if (sys.includes("SELECT_A · SELECT_B · RETRY"))
    text = msgsText.includes("나 아픈데 지금 혼자 있어") && ++t10Directors === 1
      ? JSON.stringify({ decision: "RETRY",
          reject_codes: { A: ["QUESTION_SPAM"], B: ["VOICE_BREAK"] },
          fact_id: null, rule_id: "minhyun.ask.stops_at_two" })
      : JSON.stringify({ decision: "SELECT_A",
          reject_codes: { A: [], B: [] }, fact_id: null, rule_id: null });
  else if (sys.includes("대사를 쓰지 않는다 — 고르기만 한다"))
    text = JSON.stringify({ decision: msgsText.includes("후보 B") ? "A" : "ACCEPT",
                            reject_codes: {} });
  else if (sys.includes("너는 이 세계의 사실만 본다") || sys.includes("이 사람이 이 사람다운지만 본다"))
    text = '{"problems":[]}';
  else if (sys.includes("이 장면의 마지막 손이다"))
    text = JSON.stringify({ messages: [{ text: "…그 얘기는 이따가 해요." }] });
  else if (sys.includes("너는 대화 기록을 압축한다"))
    text = "유저와 짧게 안부를 주고받았다. 특별한 사건은 없었다.";
  else {
    const want = (replies && replies.shift());
    if (want) text = want;
    else {
      /* §8.5 화자 순차 — 발견 대사는 물건을 실제로 짚어야 한다(ITEM_MISS).
         「네.」 같은 무관 대사로 통과시키면 하네스가 의미 검증을 영영 못
         지나가 본다. 장면 지시에서 물건 이름을 읽어 그대로 짚는다.
         소유자 기본 답은 출처를 **안** 밝힌다 — 공개 경로는 시험이
         replies로 심는다. */
      const obsHit = msgsText.match(/에게 (.+?)[이가] 있는 것이 처음 눈에/);
      const ownHit = msgsText.match(/이 (.+?)[이가] 어디서 났는지/);
      if (obsHit)
        text = JSON.stringify({ messages: [{ text: `그 ${obsHit[1]} 어디서 났어요?` }] });
      else if (ownHit && msgsText.includes("네 몫이다"))
        text = JSON.stringify({ messages: [{ text: `${ownHit[1]}? 그냥 쓰던 거예요.` }] });
      else {
        const A = [{ text: "오늘은 조용했어요. 애들도 얌전했고요." },
                   { text: "선생님 하루는 어땠어요. 밥은 챙겨 먹었고요?" }];
        const B = [{ text: "별일 없었어요. 늘 하던 대로요." },
                   { text: "그쪽 얘기나 해봐요. 뭔가 있어 보이는데." }];
        text = msgsText.includes('"candidates"')
          ? JSON.stringify({ candidates: [{ messages: A }, { messages: B }] })
          : JSON.stringify({ messages: A });
      }
    }
  }
  return { ok: true, status: 200, headers: { get: () => null },
    json: async () => ({ content: [{ type: "text", text }],
      /* 부른 모델을 그대로 비춘다 — fake로도 모델별 집계 배선이 검증되게 */
      usage: { model: c.model || "claude-haiku-4-5", input_tokens: 1000, output_tokens: 80,
               cache_read_input_tokens: 200, cache_creation_input_tokens: 100 },
      stop_reason: "end_turn" }),
    text: async () => "" };
  };
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
const die = msg => { console.error(`[replay] ${msg}`); process.exit(1); };

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

  /* ── 입력 검증 — 모르면 죽는다. 반쯤 도는 것이 제일 나쁘다 ── */
  const ALIAS = { one: "hybrid-one", pair: "hybrid-pair", single: "single-sonnet" };
  const rawPaths = argOf("paths", DEFAULT_PATHS.join(",")).split(",").map(s => s.trim());
  const paths = rawPaths.map(s => ALIAS[s] || s);
  if (!paths.length || rawPaths.some(s => !s)) die("--paths가 비었다");
  for (const p of paths) if (!PATHS.includes(p)) die(`모르는 경로 — ${p} (허용: ${PATHS.join(", ")})`);
  if (new Set(paths).size !== paths.length) die("--paths에 같은 경로가 두 번 있다");
  const stagedBase = argOf("staged-base", "pair");
  if (stagedBase !== "pair" && stagedBase !== "one") die(`모르는 staged-base — ${stagedBase}`);
  const seed = argOf("seed", "7");
  const outDir = resolve(ROOT, argOf("out", FAKE ? "replay-out-fake" : "replay-out"));
  if (existsSync(outDir) && readdirSync(outDir).length)
    die(`--out 디렉터리가 비어 있지 않다 — ${outDir}\n지난 실행의 trace가 새 보고에 섞인다. 지우거나 다른 --out을 써라.`);
  const loadDir = (dir, what) => {
    if (!existsSync(dir)) die(`${what} 디렉터리가 없다 — ${dir}`);
    const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
    if (!files.length) die(`${what} 디렉터리가 비어 있다 — ${dir}`);
    return files.map(f => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }));
  };
  const packets = loadDir(join(ROOT, argOf("packets", "test/packets")), "packet");
  /* --sessions=none — A층 packet만 도는 실행(taste-pack 등). 그 외에는
     기존 그대로 비어 있으면 죽는다. */
  const sesArg = argOf("sessions", "test/sessions");
  const sessions = sesArg === "none" ? [] : loadDir(join(ROOT, sesArg), "session");
  /* G3 혼자 도는 실행은 산출물 모양이 다르다 — 경로 비교 블라인드가 아니라
     후보쌍 블라인드(pair-blind)와 선택 결과(selected-blind)다. */
  const S5MODE = paths.length === 1 && paths[0] === "sonnet5-pair-haiku";
  mkdirSync(join(outDir, "trace"), { recursive: true });
  if (S5MODE) {
    mkdirSync(join(outDir, "selected-blind"), { recursive: true });
    mkdirSync(join(outDir, "pair-blind"), { recursive: true });
  } else mkdirSync(join(outDir, "blind"), { recursive: true });

  const key = FAKE ? "sk-fake" : KEY;
  const call = (env, body) => callWorker(env, body, key);
  const rows = [];        // chat rows (packet + session)
  const sumRows = [];     // summary rows — 따로 센다
  const blindItems = [];
  let rot = 0;            // 실행 순서 회전 — packet과 세션 턴이 같은 바퀴를 쓴다

  /* ── A층 — 동일 TurnPacket을 네 경로에 각각 (회전된 순서로) ── */
  for (const pkt of packets) {
    const label = pkt.label || basename(pkt.file, ".json");
    const byPath = {};
    const order = rotated(paths, rot++);
    for (const path of order) {
      const meta = pkt.meta || {};
      const prev = meta.prev
        ? { responses: meta.prev.responses ?? 99,
            summaryUpto: meta.prev.summary_upto,
            stageIdx: meta.prev.stage_idx }
        : { responses: 99 };
      const curUpto = meta.summary_upto ?? 0;
      const anchor = isStaged(path) ? decideAnchor(prev, pkt.body, curUpto) : null;
      const body = { ...pkt.body, request_id: `rp-A-${label}-${path}` };
      const r = await call(pathEnv(path, stagedBase, anchor), body);
      const stages = (r.data && r.data.stages) || [];
      const row = {
        item: label, kind: "chat", layer: "A", path, turn: 0, ok: r.ok, status: r.status,
        anchor: anchor || null,
        ranAnchor: !!(r.ok && r.data.trace && r.data.trace.anchor_reason),
        declined: !!(r.ok && r.data.trace && r.data.trace.anchor_declined),
        ui_retries: 0,
        rounds: stages.length ? Math.max(...stages.map(s => s.attempt || 1)) - 1 : 0,
        calls: stages.length, cost: costOf(stages), latency: r.latency_ms,
        cache: cacheSums(stages),
        trace: { item: label, kind: "chat", path, turn: 0, anchor_reason: anchor || null,
          ok: r.ok, status: r.status, ui_retries: 0, latency_ms: r.latency_ms,
          engine: (r.data && r.data.trace) || null, stages,
          usage_total: r.data && r.data.usage_total, usage: r.data && r.data.usage,
          effects: (r.data && r.data.effects) || [],
          /* 라우팅 지표(D2)의 재료 — 예약이 실제로 승격돼 답까지 나왔는지 */
          scene_ack: (r.data && r.data.scene_ack) || null,
          finalMessages: (r.data && r.data.messages) || [],
          error: r.ok ? null : (r.data && (r.data.detail || r.data.error)) || String(r.status) },
      };
      rows.push(row);
      writeFileSync(join(outDir, "trace", `A-${label}-${path}.json`),
        JSON.stringify(row.trace, null, 2));
      byPath[path] = ((r.data && r.data.messages) || []).map(m =>
        `${m.sender ? m.sender + ": " : ""}${m.photo ? "(사진) " : ""}${m.text || ""}`).join("\n")
        || "(실패)";
      console.log(`A ${label} · ${path}${anchor ? ` · anchor:${anchor}` : ""} → ${r.status}`);
    }
    blindItems.push({ item: `A-${label}`, context: contextOf(pkt.body), byPath });
  }

  /* ── B층 — 경로마다 독립 세션, 턴 단위 교차 실행 ── */
  for (const ses of sessions) {
    const label = ses.label || basename(ses.file, ".json");
    const states = await runSession({ ...ses, label }, paths, {
      call, stagedBase, rotBase: rot,
      onTurn: row => console.log(`B ${label} · ${row.path} · #${row.turn}`
        + `${row.anchor ? ` · anchor:${row.anchor}` : ""}`
        + `${row.ui_retries ? ` · UI재시도 ${row.ui_retries}` : ""} → ${row.status}`),
    });
    rot += ses.turns.length;
    const byPath = {};
    for (const path of paths) {
      const st = states[path];
      st.rows.forEach(row => {
        rows.push(row);
        writeFileSync(join(outDir, "trace",
          `B-${label}-${path}-${String(row.turn).padStart(2, "0")}.json`),
          JSON.stringify(row.trace, null, 2));
      });
      st.sumRows.forEach(row => {
        sumRows.push(row);
        writeFileSync(join(outDir, "trace",
          `B-${label}-${path}-sum${String(row.turn).padStart(2, "0")}.json`),
          JSON.stringify(row.trace, null, 2));
      });
      byPath[path] = st.transcript;
      if (st.status !== "complete")
        console.log(`B ${label} · ${path} · 세션 ${st.status}`
          + `${st.invalidWhy ? ` (${st.invalidWhy})` : ""} — #${st.stoppedAt}에서 중단`);
    }
    blindItems.push({ item: `B-${label}`,
      context: `${{ jaeeon: "이재언", minhyun: "이민현", group: "단톡" }[ses.turns[0].room] || ""} — ${ses.turns.length}턴 연속 세션`,
      byPath });
  }

  /* ── G3 혼자 도는 실행 — 산출물이 다르다 ── */
  if (S5MODE) {
    writeS5Outputs(outDir, { rows, sumRows, blindItems, FAKE });
    console.log(`\n끝 — 대화 ${rows.length}턴 · 요약 ${sumRows.length}호출. 보고: ${join(outDir, "report.md")}`);
    if (unknownModels.size) die("단가를 모르는 모델이 나왔다 — 보고는 INVALID다.");
    return;
  }

  /* ── 블라인드 묶기 ── */
  const key2blind = {};
  for (const item of blindItems) {
    const order = shuffled(Object.keys(item.byPath).sort(), seed + item.item);
    const tags = ["갑", "을", "병", "정", "무", "기"];
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

  /* ── 보고 — 대화 턴과 요약 호출을 따로, 캐시 실측을 따로 ── */
  const per = {};
  for (const r of rows) {
    const p = per[r.path] = per[r.path] || { chat: 0, calls: 0, rounds: 0, ui: 0,
      fails: 0, anchors: 0, declined: 0, cost: 0, latency: 0, cw: 0, cr: 0 };
    p.chat++; p.calls += r.calls; p.rounds += r.rounds; p.ui += r.ui_retries;
    p.cost += r.cost; p.latency += r.latency;
    p.cw += r.cache.w; p.cr += r.cache.r;
    if (!r.ok) p.fails++; if (r.ranAnchor) p.anchors++; if (r.declined) p.declined++;
  }
  const sper = {};
  for (const r of sumRows) {
    const p = sper[r.path] = sper[r.path] || { calls: 0, cost: 0, latency: 0, fails: 0 };
    p.calls++; p.cost += r.cost; p.latency += r.latency; if (!r.ok) p.fails++;
  }
  const invalid = unknownModels.size > 0;
  const fmt = n => n.toFixed(4);
  const rep = ["# G replay 보고", "",
    invalid ? `**INVALID — 단가를 모르는 모델이 있다: ${[...unknownModels].join(", ")}. 비용 합계를 믿지 마라.**` : "",
    FAKE ? "**--fake 모드 — 모델 없이 하네스만 굴렸다. 숫자는 배선 점검용이다.**" : "",
    "", "## 대화 턴 (packet + 세션)",
    "| 경로 | 대화 턴 | 호출 | 모델 재시도 | UI 재시도 | 실패 | anchor | anchor 물림 | 캐시 쓰기 tok | 캐시 읽기 tok | 비용($) | 지연 합(ms) |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const [path, p] of Object.entries(per))
    rep.push(`| ${path} | ${p.chat} | ${p.calls} | ${p.rounds} | ${p.ui} | ${p.fails} | ${p.anchors} | ${p.declined} | ${p.cw} | ${p.cr} | ${fmt(p.cost)} | ${p.latency} |`);
  rep.push("", "## 요약 호출 (대화 턴과 따로 센다)",
    "| 경로 | 요약 호출 | 실패 | 비용($) | 지연 합(ms) |", "|---|---|---|---|---|");
  for (const path of paths) {
    const p = sper[path] || { calls: 0, cost: 0, latency: 0, fails: 0 };
    rep.push(`| ${path} | ${p.calls} | ${p.fails} | ${fmt(p.cost)} | ${p.latency} |`);
  }
  rep.push("", "실행 순서는 packet·세션 턴마다 회전(Latin square)돼 있다 — 캐시를",
    "먼저 데우는 경로가 고정되지 않는다. 턴별 상세는 trace/, 대사 비교는",
    "blind/ (이름표는 blind-key.json — 읽기 전에 열지 않는다).");
  writeFileSync(join(outDir, "report.md"), rep.join("\n"));
  console.log(`\n끝 — 대화 ${rows.length}턴 · 요약 ${sumRows.length}호출. 보고: ${join(outDir, "report.md")}`);
  if (invalid) die("단가를 모르는 모델이 나왔다 — 보고는 INVALID다.");
}

/* ══════════════ G3 산출물 — sonnet5-pair-haiku 혼자 도는 실행 ══════════════
   selected-blind/  최종 대사만 — 모델명·호출 수·선택 이유를 노출하지 않는다.
   pair-blind/      상급 Writer 후보 A·B를 둘 다 — 저비용 Director가 뭘 골랐는지는 숨긴다.
                    표시 순서(ㄱ·ㄴ)는 항목 순번 짝홀로 결정적으로 교차한다 —
                    A가 늘 위에 오는 위치 편향을 막는다.
   pair-key.json    표시 이름표 ↔ 원래 Candidate id, Director 선택, 후보별 코드
                    탈락, Director 사유, 폴백 여부. 판정 전에 열지 않는다. */
function writeS5Outputs(outDir, { rows, sumRows, blindItems, FAKE }) {
  const P = "sonnet5-pair-haiku";
  for (const item of blindItems) {
    const v = item.byPath[P];
    const lines = [`# ${item.item}`, "", item.context ? `상황: ${item.context}` : "", ""];
    if (Array.isArray(v)) v.forEach(turn => {
      lines.push(`**유저**: ${turn.user}`);
      lines.push(`**응답**: ${turn.reply || "(실패)"}`, "");
    });
    else lines.push(v || "(실패)", "");
    writeFileSync(join(outDir, "selected-blind", `${item.item}.md`), lines.join("\n"));
  }

  const ctxByItem = Object.fromEntries(blindItems.map(b => [b.item, b.context || ""]));
  const key = {};
  const chat = rows.filter(r => r.kind === "chat");
  chat.forEach((r, idx) => {
    const name = r.layer === "B"
      ? `B-${r.item}-${String(r.turn).padStart(2, "0")}` : `A-${r.item}`;
    const e = (r.trace && r.trace.engine) || null;
    const checks = (e && e.candidate_checks) || {};
    const cands = e && e.candidates;
    const order = cands ? (idx % 2 ? ["B", "A"] : ["A", "B"]) : [];
    key[name] = {
      display: cands ? { "ㄱ": order[0], "ㄴ": order[1] } : null,
      director_choice: e ? e.director_choice : null,
      director_output: e ? e.director_output : null,
      candidate_checks: checks,
      fallback: e ? !!e.fallback : null,
      fallback_why: (e && e.fallback_why) || [],
      ok: r.ok,
    };
    const L = [`# ${name}`, ""];
    const ctx = ctxByItem[r.layer === "B" ? `B-${r.item}` : `A-${r.item}`];
    if (ctx) L.push(`상황: ${ctx}${r.layer === "B" ? ` · #${r.turn}` : ""}`, "");
    if (!cands) L.push(`(상급 Writer 후보 없음 — ${r.ok ? "폴백으로 진행" : "턴 실패"})`, "");
    else order.forEach((cid, i) => {
      L.push(`## ${"ㄱㄴ"[i]}`, "");
      const ms = (cands[cid] && cands[cid].messages) || [];
      if (!ms.length) L.push("(빈 후보)", "");
      else {
        ms.forEach(m => L.push(`${m.sender ? m.sender + ": " : ""}${m.photo ? "(사진) " : ""}${m.text || ""}`));
        L.push("");
      }
    });
    writeFileSync(join(outDir, "pair-blind", `${name}.md`), L.join("\n"));
  });
  writeFileSync(join(outDir, "pair-key.json"), JSON.stringify(key, null, 2));

  /* ── 보고 — 계약된 집계 전부 ── */
  const stages = chat.flatMap(r => (r.trace && r.trace.stages) || []);
  const nStage = s => stages.filter(x => x.stage === s).length;
  const byModel = {};
  for (const s of stages) {
    const m = byModel[s.model] = byModel[s.model]
      || { calls: 0, tin: 0, tout: 0, cw: 0, cr: 0, cost: 0 };
    m.calls++; m.tin += s.input_tokens || 0; m.tout += s.output_tokens || 0;
    m.cw += s.cache_creation_input_tokens || 0; m.cr += s.cache_read_input_tokens || 0;
    m.cost += costOf([s]);
  }
  const engines = chat.map(r => (r.trace && r.trace.engine) || null);
  const has = (e, id) => e && ((e.candidate_checks || {})[id] || []).length > 0;
  const why = (e, pre) => e && (e.fallback_why || []).some(w => String(w).startsWith(pre));
  const rejA = engines.filter(e => has(e, "A")).length;
  const rejB = engines.filter(e => has(e, "B")).length;
  const rejBoth = engines.filter(e => has(e, "A") && has(e, "B")).length;
  const retry = engines.filter(e => why(e, "DIRECTOR_RETRY")).length;
  const dirBad = engines.filter(e => why(e, "DIRECTOR_BAD") || why(e, "DIRECTOR_DEAD_PICK")
    || why(e, "DIRECTOR_GHOST") || why(e, "DIRECTOR_ERROR")).length;
  const schemaBad = engines.filter(e => why(e, "WRITER_SCHEMA") || why(e, "A:EMPTY")
    || why(e, "B:EMPTY") || why(e, "S5_ERROR")).length;
  const chooseA = engines.filter(e => e && e.director_choice === "A").length;
  const chooseB = engines.filter(e => e && e.director_choice === "B").length;
  const fallbacks = engines.filter(e => e && e.fallback).length;
  const lat = chat.map(r => r.latency).sort((a, b) => a - b);
  const pct = p => lat.length ? lat[Math.min(lat.length - 1, Math.ceil(p * lat.length) - 1)] : 0;
  const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
  const chatCost = chat.reduce((c, r) => c + r.cost, 0);
  const sumCost = sumRows.reduce((c, r) => c + r.cost, 0);
  const route = r => {
    const e = (r.trace && r.trace.engine) || null;
    if (!e) return r.ok ? "?" : "실패(trace 없음)";
    const p = [e.candidates ? "Writer(A·B)" : "Writer×"];
    if ((r.trace.stages || []).some(s => s.stage === "haiku_director"))
      p.push(`dir:${e.director_choice
        || (e.fallback_why || []).find(w => String(w).startsWith("DIRECTOR")) || "?"}`);
    if (e.fallback) p.push(r.ok ? "폴백" : "폴백×");
    return p.join(" → ");
  };
  const fmt = n => n.toFixed(4);
  const rep = ["# G3 replay 보고 — sonnet5-pair-haiku", "",
    unknownModels.size ? `**INVALID — 단가를 모르는 모델: ${[...unknownModels].join(", ")}**` : "",
    FAKE ? "**--fake 모드 — 모델 없이 하네스만 굴렸다. 숫자는 배선 점검용이다.**" : "",
    "",
    `- 총 replay 턴: ${chat.length} · 성공 ${chat.filter(r => r.ok).length} · 실패 ${chat.filter(r => !r.ok).length}`,
    `- 상급 Writer 호출: ${nStage("sonnet5_pair_writer")} · 저비용 Director 호출: ${nStage("haiku_director")} · 폴백 Writer 호출: ${nStage("sonnet45_fallback")} (폴백 턴 ${fallbacks})`,
    `- 후보 코드 탈락: A ${rejA} · B ${rejB} · 둘 다 ${rejBoth}`,
    `- Director RETRY: ${retry} · 판정 무효/탈락 선택/판정 오류: ${dirBad} · 상급 Writer 스키마/호출 실패: ${schemaBad}`,
    `- Director 선택: A ${chooseA} · B ${chooseB}${chooseA + chooseB ? ` (A ${Math.round(100 * chooseA / (chooseA + chooseB))}%)` : ""}`,
    `- 지연(턴): 평균 ${avg}ms · p50 ${pct(0.5)}ms · p95 ${pct(0.95)}ms`,
    `- 비용: 대화 ${fmt(chatCost)}$ · 요약 ${fmt(sumCost)}$ · 합 ${fmt(chatCost + sumCost)}$`,
    "", "## 모델별 실측 (대화 턴)",
    "| 모델 | 호출 | in tok | out tok | 캐시 w | 캐시 r | 비용($) |", "|---|---|---|---|---|---|---|"];
  for (const [m, v] of Object.entries(byModel))
    rep.push(`| ${m} | ${v.calls} | ${v.tin} | ${v.tout} | ${v.cw} | ${v.cr} | ${fmt(v.cost)} |`);
  rep.push("", "## 턴별 route", "| 항목 | route | 상태 |", "|---|---|---|");
  chat.forEach(r => rep.push(`| ${r.layer === "B" ? `B-${r.item}-${r.turn}` : `A-${r.item}`} | ${route(r)} | ${r.ok ? "ok" : r.status} |`));
  rep.push("", "후보쌍 비교는 pair-blind/, 최종 대사는 selected-blind/,",
    "이름표 대응·Director 선택은 pair-key.json — 판정 전에 열지 않는다.");
  writeFileSync(join(outDir, "report.md"), rep.filter(x => x !== null).join("\n"));
}

function contextOf(body) {
  const r = { jaeeon: "이재언 1:1", minhyun: "이민현 1:1", group: "단톡", health: "관전" }[body.room] || body.room;
  const last = [...(body.history || [])].reverse().find(m => m.role === "user");
  return `${r}${body.now ? ` · ${body.now}` : ""} — 유저: 「${(last && last.content || "").slice(0, 60)}」`;
}

/* 곧장 실행됐을 때만 CLI로 돈다 — 테스트는 위 함수들만 들여온다 */
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => { console.error("replay 실패:", e); process.exit(1); });
}
