import { getMsgs, getLastMsg, getFirstMsg, countToday, countMsgs, recentPhotos, getMeta, setMeta, Msg } from './db';
/* 규칙은 웹과 같은 파일에서 온다(app-data.js → rules.ts). 여기서 시각·요일·
   접속 상태·문 닫은 자리를 그 규칙대로 재서 보낸다 */
import { presence, timeWord, dayWord, PLACES, placeHours, canGoWith, loadMet } from './rules';

export const API = 'https://null-api.re-moonroom.workers.dev/';
export const IMG = 'https://songgyeon.github.io/null/';

// ── vibe: 규칙 기반 (LLM 호출 없음 — 비용 제약을 설계로 해결) ──
function calcVibe(msgs: Msg[]): string | undefined {
  const recent = msgs.slice(-8);
  if (!recent.length) return undefined;
  const userMsgs = recent.filter(m => m.sender === 'user');
  /* 표본이 적으면 비율이 비율 노릇을 못 한다. 유저 발화가 하나뿐이면
     물음표 하나로 qRatio가 1.0이 돼서 "캐묻는 중"이 확정됐다 — 한 마디
     묻고 나간 사람을 두고 관전방에서 "요즘 이것저것 캐묻던데"가 나갔다.
     임계값도 저 구간에서 비단조다(1개→물음표 1, 2개→2, 3개→2, 4개→3).
     넷으로 올리면 오판은 더 줄지만 최근 8발화에 유저 말은 보통 서넛이라
     평범한 대화에서 눈치가 통째로 꺼진다. 셋이 경계다. */
  if (userMsgs.length < 3) return undefined;

  const avgLen = userMsgs.reduce((s, m) => s + (m.text?.length || 0), 0) / userMsgs.length;
  const qRatio = userMsgs.filter(m => /[?？]/.test(m.text || '')).length / userMsgs.length;
  const exRatio = userMsgs.filter(m => /[!！ㅋㅎ]/.test(m.text || '')).length / userMsgs.length;

  if (exRatio > 0.4) return '들뜸';
  if (qRatio > 0.5) return '캐묻는 중';
  if (avgLen < 6) return '말이 짧아짐';
  if (avgLen > 30) return '길게 말하는 중';
  /* '평소'는 아무것도 안 알려준다. 필드가 없는 것과 정보량이 같은데
     프롬프트에서는 자리를 차지하고, 가변부라 캐시도 안 된다.
     없으면 평소다 — vibe가 붙어 있으면 그건 진짜 신호라는 뜻이 된다. */
  return undefined;
}

export async function buildSignals(excludeRoom: string | null) {
  const sig: Record<string, any> = {};
  for (const room of ['jaeeon', 'minhyun', 'group']) {
    if (room === excludeRoom) continue;
    const last = await getLastMsg(room);
    if (!last) continue;
    const msgs = await getMsgs(room, 20);
    sig[room] = {
      count: await countToday(room),
      minsAgo: Math.max(0, Math.floor((Date.now() - last.created_at) / 60000)),
      vibe: calcVibe(msgs),
    };
  }
  return sig;
}

/* 원문으로 보내는 창. 이보다 오래된 것은 요약이 들고 있다.
   원문은 말투와 흐름을 위한 것이고, 사실은 요약이 담당한다. */
export const HISTORY_CHARS = 12000;
/* 안 요약된 원문이 이만큼 쌓이면 한 번 뭉친다. 뭉칠 때 끝의 TAIL_KEEP
   글자는 남긴다 — 다 뭉치면 방금 하던 얘기까지 요약으로만 남는다. */
export const SUM_AT = 12000, TAIL_KEEP = 4000;

export type Summary = { text: string; upto: number };
export async function loadSum(room: string): Promise<Summary> {
  try { return JSON.parse((await getMeta('null_sum_' + room)) || 'null') || { text: '', upto: 0 }; }
  catch { return { text: '', upto: 0 }; }
}
export async function saveSum(room: string, v: Summary) {
  await setMeta('null_sum_' + room, JSON.stringify(v));
}

export function buildHistory(msgs: Msg[]) {
  /* sender가 'sys'인 줄은 "일어난 일"이다(선물 전달 등). 유저가 한 말은
     아니지만 유저 쪽에서 일어난 사건이므로 user로 넘긴다 — assistant로
     넘기면 마지막 줄이 assistant가 되어 서버가 400으로 막는다. */
  /* 이전에 한 얘기를 기억하려면 이전에 한 얘기를 보내야 한다. 전에는 서른
     마디에서 잘랐다 — 말풍선이 한 턴에 두셋이니 실질 열 턴이었다.
     개수가 아니라 글자로 센다. 워커의 MAX_HISTORY_CHARS와 같은 값이다. */
  const all = msgs.map(m => ({
    role: (m.sender === 'user' || m.sender === 'sys') ? 'user' : 'assistant',
    sender: m.sender,
    content: m.photo ? `${m.text ? m.text + ' ' : ''}(사진을 보냈다)` : (m.text || ''),
  })).filter(m => m.content && m.content.trim());
  const out: typeof all = [];
  let used = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const n = all[i].content.length;
    if (out.length && used + n > HISTORY_CHARS) break;   // 오래된 쪽부터 뺀다
    used += n;
    out.unshift(all[i]);
  }
  return out;
}

/* 방별 누적 대화 수. 서버는 이걸로 관계 단계를 정하고 .hidden 해금을 판단한다.
   안 보내면 단계가 영원히 "처음"에 머물고 해금도 일어나지 않는다.
   기준값(0/16/40/80)은 worker.js의 STAGES, lib/profiles.ts의 at과 같아야 한다. */
export async function buildCounts() {
  const counts: Record<string, number> = {};
  for (const room of ['jaeeon', 'minhyun', 'group']) {
    counts[room] = await countMsgs(room);
  }
  return counts;
}

/* 당신.txt에 채운 빈칸. 값이 있는 것만 보낸다 — 빈 항목까지 보내면
   프롬프트에 "좋아하는 것: " 같은 빈 줄이 생겨 모델이 헷갈린다. */
/* 첫 대화로부터 며칠이 지났나. 단계는 대화 수와 날짜를 둘 다 넘어야 오른다 —
   유저는 하루에 백 개씩 보내므로 대화 수만 보면 첫날 밤에 마지막 단계다.
   서버는 유저별 저장소가 없어서 첫 대화가 언제였는지 모른다. 여기서 세어 보낸다. */
export async function buildDays() {
  let first = 0;
  for (const room of ['jaeeon', 'minhyun', 'group', 'health']) {
    const t = (await getFirstMsg(room))?.created_at || 0;
    if (t && (!first || t < first)) first = t;
  }
  return first ? Math.floor((Date.now() - first) / 864e5) : 0;
}

export async function buildUserProfile() {
  let raw = '';
  try { raw = (await getMeta('null_profile')) || ''; } catch (e) {}
  if (!raw) return undefined;
  let parsed: Record<string, string>;
  try { parsed = JSON.parse(raw); } catch (e) { return undefined; }
  const out: Record<string, string> = {};
  for (const k of ['subject', 'age', 'likes', 'dislikes']) {
    const v = (parsed?.[k] || '').toString().trim();
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function callApi(payload: any) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);
  return data;
}

/* 워커에 보내는 것은 웹과 한 글자도 다르면 안 된다 — 다르면 같은 인물이
   두 곳에서 다르게 군다. 웹의 request()가 얹는 것을 여기서도 다 얹는다:
   요일·접속 상태·지금 있는 자리·가방·문 닫은 자리·자리의 때·선톡 표시. */
export type ChatOpts = {
  gift?: { key: string; name: string; note?: string };
  place?: string | null;      // 지금 마주 앉은 자리
  bag?: string[];             // 이미 받은 것 — 두 번 안 준다
  placeOver?: boolean;        // 그 자리의 때가 지났다 — 이번 대답에서 일어선다
  greet?: boolean;            // 선톡 턴 — 워커가 이력 캐시 지점을 안 찍는다
  extra?: Record<string, any>;
};
export async function sendChat(room: string, userName: string, history: Msg[],
                               opts: ChatOpts = {}) {
  const sum = await loadSum(room);
  const { gift, place, bag, placeOver, greet, extra } = opts;
  /* 그 방 사람의 접속 상태. 목록에 뜨는 것과 같은 함수(presence)를 쓴다 —
     화면에는 「수업 중」인데 본인은 한가한 사람처럼 답하던 것이 이걸로 맞는다.
     「주말」은 안 보낸다 — 요일이 이미 실려 있어 같은 말이 두 번 된다. */
  const states: Record<string, string> = {};
  for (const id of room === 'group' ? ['jaeeon', 'minhyun'] : [room]) {
    const pr = presence(id);
    if (pr && pr.t !== '주말') states[id] = pr.t;
  }
  return callApi({
    mode: 'chat',
    room,
    user_name: userName,
    /* 요약이 이미 삼킨 구간은 안 보낸다 — 같은 얘기를 원문과 요약으로 두 번
       보내면 값은 두 배인데 아는 건 그대로다 */
    history: buildHistory(history.filter(m => m.created_at > (sum.upto || 0))),
    ...(sum.text ? { summary: sum.text } : {}),
    signals: await buildSignals(room),
    recent_photos: await recentPhotos(room),
    counts: await buildCounts(),
    days: await buildDays(),
    user_profile: await buildUserProfile(),
    /* 지금이 언제인가. 워커는 UTC로 돌고 어느 엣지에 뜨는지도 그때그때라
       여기서 재서 보낸다 — 요일은 때보다 세다(주말이면 학교가 통째로 없다) */
    now: timeWord(),
    day: dayWord(),
    ...(Object.keys(states).length ? { states } : {}),
    /* 유저가 먼저 「편의점 가자」고 했을 때 인물이 열 수 있는 자리.
       지도 창이 「갈래요?」를 띄우는 조건 그대로다 — 조건은 여기(규칙 파일)만
       안다. 자리에 마주 앉은 턴에는 안 보낸다: 워커가 place가 있으면 자리
       목록을 통째로 빼는데, 여기서 보내면 검증만 열려 있는 꼴이 된다. */
    ...(room !== 'group' && !place ? { can_go: canGoWith(room, loadMet()) } : {}),
    // 방금 장바구니에서 보낸 선물. 없으면 아예 안 보낸다
    ...(gift ? { gift } : {}),
    // 마주 앉은 자리. 이게 없으면 같은 자리에 앉아서 「지금 어디예요?」를 묻는다
    ...(place ? { place, bag: bag || [] } : {}),
    ...(placeOver ? { place_over: true } : {}),
    ...(greet ? { greet: true } : {}),
    // 다녀온 자리·거절한 자리·지금 문 닫은 자리 — 서버가 다음 제안을 고르는 근거
    met: await loadList('null_met'),
    refused: await loadList('null_refused'),
    closed: PLACES.filter((p: any) => !placeHours(p)).map((p: any) => p.name),
    ...(extra || {}),
  });
}
async function loadList(key: string): Promise<string[]> {
  try { return JSON.parse((await getMeta(key)) || '[]'); } catch { return []; }
}

/* ── 요약을 한 칸 굴린다 ──
   안 요약된 원문이 SUM_AT을 넘으면 끝의 TAIL_KEEP만 남기고 앞쪽을 뭉친다.
   요약은 하이쿠가 쓴다(워커가 고른다). 답장 흐름과 무관한 뒷일이라 실패해도
   조용히 넘어간다 — 다음 턴에 다시 시도된다. */
export async function rollSummary(room: string, userName: string): Promise<boolean> {
  const sum = await loadSum(room);
  const all = (await getMsgs(room)).filter(m => m.created_at > (sum.upto || 0));
  const total = all.reduce((n, m) => n + (m.text?.length || 0), 0);
  if (total < SUM_AT) return false;
  let keep = 0, cut = all.length;
  for (let i = all.length - 1; i >= 0; i--) {
    keep += m_len(all[i]);
    if (keep >= TAIL_KEEP) { cut = i; break; }
  }
  const chunk = all.slice(0, cut);
  if (!chunk.length) return false;
  const data = await callApi({
    mode: 'summarize', room, user_name: userName,
    summary: sum.text, history: buildHistory(chunk),
  });
  if (!data?.summary) return false;
  await saveSum(room, { text: data.summary, upto: chunk[chunk.length - 1].created_at });
  return true;
}
function m_len(m: Msg) { return m.text?.length || 0; }

export async function genAuto(userName: string, event?: any) {
  const healthMsgs = await getMsgs('health', 30);
  return callApi({
    mode: 'auto',
    user_name: userName,
    history: buildHistory(healthMsgs),
    signals: await buildSignals(null),
    // 「두 사람」방은 사진을 쓰지 않는다 — recent_photos를 보낼 이유가 없다
    counts: await buildCounts(),
    days: await buildDays(),
    user_profile: await buildUserProfile(),
    // 이 대화를 열게 만든 사건(선물·해금). 없으면 안 보낸다
    ...(event ? { event } : {}),
  });
}
