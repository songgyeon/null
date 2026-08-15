import { getMsgs, getLastMsg, countToday, countMsgs, recentPhotos, getMeta, Msg } from './db';

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

export function buildHistory(msgs: Msg[]) {
  /* sender가 'sys'인 줄은 "일어난 일"이다(선물 전달 등). 유저가 한 말은
     아니지만 유저 쪽에서 일어난 사건이므로 user로 넘긴다 — assistant로
     넘기면 마지막 줄이 assistant가 되어 서버가 400으로 막는다. */
  return msgs.slice(-30).map(m => ({
    role: (m.sender === 'user' || m.sender === 'sys') ? 'user' : 'assistant',
    sender: m.sender,
    content: m.photo ? `${m.text ? m.text + ' ' : ''}(사진을 보냈다)` : (m.text || ''),
  }));
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
    const m = await getMsgs(room, 1);
    const t = m[0]?.created_at || 0;
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

export async function sendChat(room: string, userName: string, history: Msg[],
                               gift?: { key: string; name: string; note?: string }) {
  return callApi({
    mode: 'chat',
    room,
    user_name: userName,
    history: buildHistory(history),
    signals: await buildSignals(room),
    recent_photos: await recentPhotos(room),
    counts: await buildCounts(),
    days: await buildDays(),
    user_profile: await buildUserProfile(),
    // 방금 장바구니에서 보낸 선물. 없으면 아예 안 보낸다
    ...(gift ? { gift } : {}),
    // 다녀온 자리·거절한 자리 — 서버가 다음 제안을 고르는 근거
    met: await loadList('null_met'),
    refused: await loadList('null_refused'),
  });
}
/* 선톡. 유저가 아무 말도 안 한 상태에서 캐릭터가 먼저 거는 말이다.
   전에는 각본(demoLines)에만 있어서 데모에서만 왔다 — 키가 살아 있으면
   아무도 먼저 말을 걸지 않았다.
   얼마 만인지(분)와 유저 시계의 시를 같이 보낸다. 서버에는 유저별 저장소도
   유저의 시간대도 없어서 이쪽에서 세야 한다. */
export async function sendGreet(room: string, userName: string, history: Msg[], gapMin: number) {
  return callApi({
    mode: 'greet',
    room,
    user_name: userName,
    history: buildHistory(history),
    signals: await buildSignals(room),
    recent_photos: await recentPhotos(room),
    counts: await buildCounts(),
    days: await buildDays(),
    user_profile: await buildUserProfile(),
    gap_min: gapMin,
    hour: new Date().getHours(),
  });
}

async function loadList(key: string): Promise<string[]> {
  try { return JSON.parse((await getMeta(key)) || '[]'); } catch { return []; }
}

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
