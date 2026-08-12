import { getMsgs, getLastMsg, countToday, countMsgs, recentPhotos, getMeta, Msg } from './db';

export const API = 'https://null-api.re-moonroom.workers.dev/';
export const IMG = 'https://songgyeon.github.io/null/';

// ── vibe: 규칙 기반 (LLM 호출 없음 — 비용 제약을 설계로 해결) ──
function calcVibe(msgs: Msg[]): string | undefined {
  const recent = msgs.slice(-8);
  if (!recent.length) return undefined;
  const userMsgs = recent.filter(m => m.sender === 'user');
  if (!userMsgs.length) return undefined;

  const avgLen = userMsgs.reduce((s, m) => s + (m.text?.length || 0), 0) / userMsgs.length;
  const qRatio = userMsgs.filter(m => /[?？]/.test(m.text || '')).length / userMsgs.length;
  const exRatio = userMsgs.filter(m => /[!！ㅋㅎ]/.test(m.text || '')).length / userMsgs.length;

  if (exRatio > 0.4) return '들뜸';
  if (qRatio > 0.5) return '캐묻는 중';
  if (avgLen < 6) return '말이 짧아짐';
  if (avgLen > 30) return '길게 말하는 중';
  return '평소';
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
    user_profile: await buildUserProfile(),
    // 방금 장바구니에서 보낸 선물. 없으면 아예 안 보낸다
    ...(gift ? { gift } : {}),
  });
}

export async function genAuto(userName: string) {
  const healthMsgs = await getMsgs('health', 30);
  return callApi({
    mode: 'auto',
    user_name: userName,
    history: buildHistory(healthMsgs),
    signals: await buildSignals(null),
    // 「두 사람」방은 사진을 쓰지 않는다 — recent_photos를 보낼 이유가 없다
    counts: await buildCounts(),
    user_profile: await buildUserProfile(),
  });
}
