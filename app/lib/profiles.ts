import { countMsgs, getMeta } from './db';

// Cloudflare R2 — 프로필 BGM 호스팅
export const R2 = 'https://pub-6e08882e001c49cbb013168e4b9e8d38.r2.dev/';

/* 인물마다 넉 장. 관계가 깊어지면 배경과 같이 다음 곡이 걸린다.
   단계는 다섯인데 곡은 넷이라, 처음 두 단계(0~16)가 첫 곡을 같이 쓴다 —
   아직 아무 일도 안 일어난 구간이라 곡이 바뀔 이유가 없다.
   index.html의 TRACKS와 같아야 한다. 어긋나면 웹과 앱에서 다른 곡이 나온다. */
export const TRACKS: Record<string, string> = {
  'jaeeon-1':  R2 + 'jaeeon1.mp3',
  'jaeeon-2':  R2 + 'jaeeon2.mp3',
  'jaeeon-3':  R2 + 'jaeeon3.mp3',
  'jaeeon-4':  R2 + 'jaeeon4.mp3',
  'minhyun-1': R2 + 'minhyun1.mp3',
  'minhyun-2': R2 + 'minhyun2.mp3',
  'minhyun-3': R2 + 'minhyun3.mp3',
  'minhyun-4': R2 + 'minhyun4.mp3',
  // 메신저 자체의 BGM — 방 목록의 💿를 누르면 나온다.
  'null-1':    R2 + 'null1.mp3',
};

// 플레이어에 표시할 곡 정보
export const TRACK_INFO: Record<string, { title: string; artist: string }> = {
  'jaeeon-1':  { title: 'Two Bowls',                  artist: 'Noah Vane' },
  'jaeeon-2':  { title: 'Strangers, Again',           artist: 'The Pale Cinema' },
  'jaeeon-3':  { title: 'Sugar Without Taste',        artist: 'Mara Grey' },
  'jaeeon-4':  { title: 'No Forwarding Address',      artist: 'Sunday Archive' },
  'minhyun-1': { title: 'Ask Again Tomorrow',         artist: 'Luca Riot' },
  'minhyun-2': { title: 'Online at 2AM',              artist: 'Cherry Crash' },
  'minhyun-3': { title: "Don't Look at Me Like That", artist: 'Plastic Halo' },
  'minhyun-4': { title: 'Stay Until the Song Ends',   artist: 'Last Exit Kids' },
};

/* 방 목록의 💿가 트는 곡. 인물 BGM과는 별개다 — 둘이 겹쳐 나오면 안 되므로
   인물 BGM이 시작되면 이쪽을 멈춘다. */
export const MAIN_TRACK = 'null-1';

export type Stage = { at: number; day: number; status: string; bg: string; track: string | null };

/* 선물 — index.html의 GIFTS와 같아야 한다. 어긋나면 웹에서 준 선물이
   앱에서는 없는 물건이 된다.
   bg가 있는 넷만 프로필 배경이 되고, 나머지는 주고 반응만 받는다.
   물건 그림은 gicon-{key}.webp — 웹과 같은 파일을 IMG에서 받는다. */
export type Gift = { key:string; name:string; cat:string; cost:number;
                     tags:string; bg?:string; badge?:string };
export const GIFTS: Gift[] = [
  {key:'mug',       name:'회색 머그컵',  cat:'소품', cost:2, badge:'NEW', bg:'gift-mug.webp',
   tags:'머그 머그컵 컵 커피 회색 무광 아침 소품 mug cup coffee grey'},
  {key:'photobook', name:'사진집',       cat:'기록', cost:5, bg:'gift-photobook.webp',
   tags:'사진집 사진 책 겨울 풍경 전시 미술관 기록 photo book winter'},
  {key:'beanie',    name:'남색 비니',    cat:'옷',   cost:3, bg:'gift-beanie.webp',
   tags:'비니 모자 니트 남색 겨울 옷 beanie hat knit navy'},
  {key:'earphone',  name:'유선 이어폰',  cat:'소품', cost:4, badge:'HOT', bg:'gift-earphone.webp',
   tags:'이어폰 유선 음악 노래 소품 earphone earphones wired music'},
  {key:'hotpack',   name:'핫팩',        cat:'소품', cost:1,
   tags:'핫팩 손난로 겨울 따뜻 소품 hotpack warm'},
  {key:'umbrella',  name:'접이식 우산',  cat:'소품', cost:3,
   tags:'우산 비 장마 접이식 소품 umbrella rain'},
  {key:'hanky',     name:'손수건',      cat:'소품', cost:2,
   tags:'손수건 수건 천 소품 handkerchief cloth'},
  {key:'camera',    name:'필름 카메라',  cat:'소품', cost:6,
   tags:'카메라 필름 사진 소품 camera film'},
  {key:'scarf',     name:'목도리',      cat:'옷',   cost:4,
   tags:'목도리 머플러 겨울 옷 scarf muffler'},
  {key:'gloves',    name:'장갑',        cat:'옷',   cost:3,
   tags:'장갑 손 겨울 옷 gloves'},
  {key:'bandana',   name:'파란 반다나',  cat:'옷',   cost:2,
   tags:'반다나 손목 파랑 파란 옷 bandana wrist blue'},
  {key:'candy',     name:'목캔디',      cat:'간식', cost:1,
   tags:'목캔디 사탕 캔디 간식 candy throat'},
  {key:'ramen',     name:'컵라면',      cat:'간식', cost:1,
   tags:'컵라면 라면 야식 간식 ramen noodle'},
  {key:'coffee',    name:'드립백 커피',  cat:'간식', cost:2,
   tags:'커피 드립백 원두 아침 간식 coffee drip'},
  {key:'letter',    name:'편지지',      cat:'기록', cost:2,
   tags:'편지지 편지 종이 기록 letter paper'},
  {key:'mixcd',     name:'믹스 CD',     cat:'기록', cost:3,
   tags:'CD 시디 믹스 음악 노래 기록 mix music'},
];
export const GIFT_CATS = ['전체','소품','옷','간식','기록'];
/* 받은 선물이 배경으로 걸리기 시작하는 단계. 그 전에는 받아두기만 한다. */
export const GIFT_AT = 2;
/* ♡ — 주고받은 말에서 나온다. 열 마디에 하나, 쓴 만큼 깎인다. */
export const HEART_PER = 10;

/* 누구에게 뭘 줬나. db 스키마를 건드리지 않으려고 meta에 JSON으로 넣는다. */
export async function loadGifts(): Promise<Record<string,string[]>> {
  try { return JSON.parse((await getMeta('null_gifts')) || '{}') || {}; } catch (e) { return {}; }
}
export async function saveGifts(g: Record<string,string[]>) {
  const { setMeta } = await import('./db');
  await setMeta('null_gifts', JSON.stringify(g || {}));
}

/* ── 공개 장부 — 출처가 실제로 말해진 사실 (§8.5 disclosure) ──
   웹의 null_disclosed와 같은 모양 {fact_id: ["jaeeon","minhyun"]}.
   워커가 검증해 발행한 disclosure Effect가 저장될 때만 적히고, 다음
   요청부터 payload.disclosed로 실려 그 사실의 known_by가 넓어진다. */
export async function loadDisclosed(): Promise<Record<string,string[]>> {
  try { return JSON.parse((await getMeta('null_disclosed')) || '{}') || {}; } catch (e) { return {}; }
}
export async function saveDisclosed(d: Record<string,string[]>) {
  const { setMeta } = await import('./db');
  await setMeta('null_disclosed', JSON.stringify(d || {}));
}

// at 값은 worker.js의 STAGES와 같아야 한다. 어긋나면 앱이 보여주는 단계와
// 모델이 연기하는 단계가 따로 논다. (0=처음 / 16=익숙 / 40=균열 / 80=시한)
//
// status는 이 표가 정한다. 서버는 상메를 안 보낸다.
// 둘 다 대놓고 상대를 지칭하지 않는다. 평범한 공지처럼 써놓고 실제로는
// 한 사람만 알아듣게 한다. 그래서 같은 단계끼리 나란히 놓으면 주고받는
// 말이 된다 — "문은 열어둘게요."에 "기다리는 거 아니에요."가 붙는 식이다.
// index.html의 PROFILES와 같아야 한다. 어긋나면 웹과 앱이 다른 문구를 쓴다.
// 재언은 밝은 데서 어두운 데로 — 미술관, 계단참, 복도, 밤 차 안, 그리고 부엌.
// 마지막 부엌에 씻어서 엎어놓은 그릇이 두 개다.
// 민현은 안에서 밖으로 — 레코드샵, 버스, 골목, 그리고 옥상.
// 마지막 120은 .hidden의 일기가 열리는 지점과 같다.
export const PROFILES: Record<string, { fallback: string; stages: Stage[] }> = {
  jaeeon: {
    fallback: 'jaeeon-gallery.webp',
    stages: [
      { at: 0, day: 0,   status: '별일 없어요.',       bg: 'jaeeon-gallery.webp', track: 'jaeeon-1' },
      { at: 16, day: 4,  status: '문은 열어둘게요.',    bg: 'jaeeon-landing.webp', track: 'jaeeon-1' },
      { at: 40, day: 10, status: '어디 안 가요.',       bg: 'jaeeon-lobby.webp',   track: 'jaeeon-2' },
      { at: 80, day: 18, status: '아직 남았어요.',      bg: 'jaeeon-drive.webp',   track: 'jaeeon-3' },
      { at: 120, day: 25, status: '남은 동안은 여기 있어요.', bg: 'jaeeon-kitchen.webp', track: 'jaeeon-4' },
    ],
  },
  minhyun: {
    fallback: 'minhyun-sunset.webp',
    stages: [
      { at: 0, day: 0,   status: '수업 중. 아마도.',          bg: 'minhyun-shop.webp',     track: 'minhyun-1' },
      { at: 16, day: 4,  status: '기다리는 거 아니에요.',     bg: 'minhyun-lp.webp',       track: 'minhyun-1' },
      { at: 40, day: 10, status: '그 말 취소하면 안 돼요.',   bg: 'minhyun-bus.webp', track: 'minhyun-2' },
      { at: 80, day: 18, status: '곧이잖아요. 지금이 아니라.', bg: 'minhyun-cat.webp',      track: 'minhyun-3' },
      { at: 120, day: 25, status: '안 알려줘도 알아요.',        bg: 'minhyun-sunset.webp',   track: 'minhyun-4' },
    ],
  },
};

/* 떠난 뒤. 이건 대화 수가 아니라 시계가 정한다 — 실습이 끝나는 건 몇 마디
   했느냐와 상관없는 일이라서다. 대화 수에 걸어놨더니 하루에 백스무 마디
   하면 D-29에 작별 인사가 떴다.

   그런데 D-0에서 멈춰만 두니 더 이상했다. 서른한 날째에도, 백 일째에도
   "잘 지내요. 항상."을 걸어놓고 유저와 계속 대화하는 화면이 됐다.
   작별 인사를 붙여둔 사람과 무한히 이야기하는 셈이다.

   그래서 떠난 뒤를 둘로 나눈다. 기준은 D-0 뒤에 유저가 말을 했느냐다.
   - 안 했으면 아직 떠나 있는 것이다 → GONE
   - 했으면 다시 온 것이다 → BACK

   유저 발화만 센다. 민현이 선톡만 보내고 유저가 답을 안 한 건 다시 온 게
   아니다. 새로 저장할 상태가 없다 — 이미 갖고 있는 타임스탬프로 판정되고,
   말을 거는 순간 저절로 넘어간다.
   index.html의 STATUS_GONE·STATUS_BACK과 같아야 한다. */
export const STATUS_GONE: Record<string, string> =
  { jaeeon: '잘 지내요. 항상.', minhyun: '모르는 걸로 할게요.' };
export const STATUS_BACK: Record<string, string> =
  { jaeeon: '아직 자리 있어요.', minhyun: '이제 와요?' };

/* 마지막으로 프로필을 본 단계와 지금 단계 사이에 실제로 달라진 것.
   index.html의 stageDiff와 같아야 한다 — 어긋나면 웹과 앱이 다른 걸 알린다.
   두 단계를 건너뛰었어도 답은 "지금 무엇이 그때와 다른가" 하나다.
   16단계는 곡이 그대로라 둘만 나온다. */
export function stageDiff(char: string, seen: number, now: number): string[] {
  const ss = PROFILES[char]?.stages || [];
  const a = ss[seen], b = ss[now];
  if (!a || !b || now <= seen) return [];
  return (['bg', 'track', 'status'] as const).filter(k => (a[k] || '') !== (b[k] || ''));
}

/* 인물마다 프로필을 마지막으로 본 단계. db 스키마를 안 건드리려고 meta에 넣는다. */
export async function loadSeenStage(): Promise<Record<string, number>> {
  try { return JSON.parse((await getMeta('null_seen_stage')) || '{}') || {}; } catch (e) { return {}; }
}
export async function saveSeenStage(o: Record<string, number>) {
  const { setMeta } = await import('./db');
  await setMeta('null_seen_stage', JSON.stringify(o || {}));
}

// 대화 수 → 단계 (동기). 서버를 부르지 않는 계산에는 이쪽을 쓴다
/* 대화 수와 날짜를 둘 다 넘어야 다음 단계다. 느린 쪽이 정한다.
   유저는 하루에 백 개씩 보낸다. 대화 수만 보면 첫날 밤에 마지막 단계다. */
export function stageIdxOf(char: string, n: number, days = 0): number {
  const stages = PROFILES[char]?.stages || [];
  let idx = 0;
  stages.forEach((s, i) => { if (n >= s.at && days >= s.day) idx = i; });
  return idx;
}

/* 프로필 배경. 유저가 준 선물이 단계 배경을 이긴다 — 자동으로 바뀌는 것보다
   유저가 건 게 앞선다. 다만 GIFT_AT은 지나야 한다.
   배경이 되는 건 사진이 있는 선물뿐이라 뒤에서부터 사진 있는 것을 찾는다.
   그냥 마지막 선물을 집으면 사진 없는 걸 방금 준 순간 단계 배경까지 날아간다. */
export function bgFor(char: string, count: number, gifts: Record<string,string[]>, stageBg?: string, days = 0): string {
  if (stageIdxOf(char, count, days) >= GIFT_AT) {
    const given = gifts?.[char] || [];
    for (let i = given.length - 1; i >= 0; i--) {
      const g = GIFTS.find(x => x.key === given[i]);
      if (g && g.bg) return g.bg;
    }
  }
  return stageBg || PROFILES[char]?.fallback || char + '-bg.webp';
}

/* ♡ 잔액 = 주고받은 말 ÷ 10 − 쓴 값. 따로 버는 화면을 만들지 않는 이유:
   대화가 곧 재화여야 이 앱의 이야기와 맞는다. */
export function heartsOf(counts: Record<string,number>, gifts: Record<string,string[]>): number {
  const said = ['jaeeon','minhyun','group'].reduce((n, r) => n + (counts[r] || 0), 0);
  const spent = Object.keys(gifts || {})
    .reduce((n, c) => n + (gifts[c] || []).reduce((m, k) =>
      m + (GIFTS.find(g => g.key === k)?.cost || 0), 0), 0);
  return Math.max(0, Math.floor(said / HEART_PER) - spent);
}

// 현재 단계 인덱스
export async function currentStageIdx(char: string, days = 0): Promise<number> {
  return stageIdxOf(char, await countMsgs(char), days);
}

/* 현재 단계. 상메는 이 표가 정한다 — 서버는 상메를 안 보낸다.
   전에는 서버 값을 저장해 기본값보다 우선했는데, 서버가 내려주던 게
   같은 표의 메아리라 아무 일도 안 하면서 옛 문구가 눌러앉는 길만 냈다.
   dLeft가 0이면 단계를 무시하고 작별 인사다 — 시계가 단계를 이긴다. */
export async function currentStage(char: string, dLeft?: number, back?: boolean, days = 0): Promise<Stage> {
  const idx = await currentStageIdx(char, days);
  const base = PROFILES[char]?.stages[idx];
  if (!base) return { at: 0, day: 0, status: '', bg: char + '-bg.webp', track: null };
  if (dLeft === 0) {
    const t = (back ? STATUS_BACK : STATUS_GONE)[char];
    return { ...base, status: t || base.status || '' };
  }
  return { ...base, status: (base.status || '').trim() };
}
