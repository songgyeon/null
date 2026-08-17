// @ts-nocheck
/* ── 자리(scene)의 판단만 모아둔 곳 ──
   웹 app.js가 「지금 이 자리에 갈 수 있나」를 재던 계산을 그대로 옮겼다.
   화면도 저장소도 안 건드린다 — 값을 받아 값을 돌려주는 것이 전부고,
   그 값으로 무엇을 할지(도장 찍기·요청 보내기·화면 옮기기)는 App.tsx가 한다.

   왜 굳이 떼어냈나. 웹은 이 판정이 JSX 한복판에 있다 — ask 창을 그리는
   자리에서 away/locked/shut/…을 그 자리에서 잰다. 그래서 「같이 이동」의
   조건이 창에 한 벌, answerMove에 또 한 벌 살게 됐고, app.js에는 그 옆에
   「주는 길이 둘이면 둘 다 잠가야 한다」는 줄이 붙어 있다. 두 벌을 손으로
   맞춰 두는 것은 잠깐 맞을 뿐이다. 앱에서는 재는 자를 하나만 둔다 —
   창(screens/Dialogs.tsx)은 결과를 그림으로 옮기기만 한다.

   값·시각·조건은 전부 rules.ts에서 온다(웹의 app-data.js와 같은 글이다).
   여기서 새로 세우는 숫자는 둘뿐인데, 둘 다 app-data.js가 아니라 app.js에
   박혀 있어서 규칙 파일에 없는 것들이다 — 각각 아래에 이유를 적었다.

   msgs의 모양은 { [room]: {sender, text?, sys?, ts}[] }다. 앱의 Msg는 시각을
   created_at으로 들고 있어서(lib/db.ts) 그대로는 안 맞는다 — 넘기는 쪽인
   App.tsx가 ts로 맞춰 준다. 여기서 created_at까지 같이 봐주면 「웹과 글자
   그대로 같은 판정」이라는 말이 그 순간 흐려진다. 재는 자는 하나여야 한다.
   sys 줄도 마찬가지다. 웹은 {sender:"user", sys:true}이고 앱은 sender가
   'sys'인데, 아래 셈은 sender==='user'만 세므로 어느 쪽이 와도 답이 같다. */
import {
  PLACE_BY, WAY, AUTO_AWAY, AT_WORK,
  placeOpen, placeHours, placeWhen, wendOnlyOk, goneToday,
  presence, whoOut, isWend, canGreet, sceneOver, openingFor, jos,
} from './rules';

/* 창이 읽는 모양. 창은 이 열넷만 보고 그린다 — PLACE_BY를 다시 뒤져
   조건을 덧붙이기 시작하면 규칙이 두 군데 사는 것이 도로 시작된다. */
export type AskState = {
  away: boolean;    // 지금 다른 자리에 앉아 있다
  locked: boolean;  // 아직 안 열린 자리(먼저 가야 할 데가 남았다)
  shut: boolean;    // 지금은 문 닫은 시각
  wk: boolean;      // 주말에만 가는 자리인데 평일이다
  done: boolean;    // 오늘 이미 다녀왔다
  empty: boolean;   // 마주치는 자리인데 지금 밖에 아무도 없다
  need: boolean;    // 동행을 아직 안 골랐다
  mv: boolean;      // 같이 있던 사람과 자리를 옮기는 길
  klass: boolean;   // 수업 중의 교실 — 가는 게 아니라 문틈으로 보는 길
  no: boolean;      // 못 간다
  why: string;      // 왜 못 가는지 한 줄
  kao: string;      // 그 줄에 붙는 얼굴 — 글꼴이 달라서 창이 따로 그린다
  title: string;    // 창 첫 줄
  canPick: boolean; // 동행 고르는 줄을 띄우나
  who: string[];    // 그 줄에 세울 사람들
};

/* ── 자리를 눌렀을 때 ──
   웹 app.js의 ask 창이 자기를 그리기 직전에 재던 사다리 그대로다.
   판정끼리 순서가 있다 — mv와 klass가 no보다 먼저 정해져야 하고, why는
   그 셋이 다 정해진 뒤에야 쓸 수 있다. 한 함수 안에 붙여둔 이유가 그거다.

   picked(고른 동행)는 웹의 askWho다. 창의 상태라 자리 정보에 안 들어
   있지만 need가 그걸 보고 정해진다 — 안 받으면 도서관·레코드샵의 「갈래요」가
   영영 눌리지 않는다. 그래서 셋 옆에 넷째로 얹어 받는다. */
export function askState(place, {scene, met, picked} = {}): AskState {
  const p = PLACE_BY[place];
  /* 여기만 msgs를 안 받는다. 웹의 ask 창도 기록은 안 뒤진다 — 시계와 도장과
     만난 사람 목록으로만 재는 사다리다. 부르는 쪽은 넷에 같은 꾸러미를
     넘기니 msgs가 딸려 와도 그냥 흘린다. 받아만 두고 안 쓰는 이름을 남겨
     두면 다음에 읽는 사람이 「창이 대화 기록도 본다」로 알아듣고, 없는
     조건을 찾아 이 사다리를 위아래로 훑게 된다. */
  /* 자리에 있는 동안엔 딴 데로 못 간다. 몸은 하나다 — X로 접어두고 메신저를
     쓸 수는 있어도 옮겨 다닐 수는 없다 */
  const away = !!scene && scene.place !== place;
  const locked = !!p && !placeOpen(p, met || []);
  const shut = !!p && !placeHours(p);            // 지금은 문 닫은 시각
  const wk = !away && !!p && !wendOnlyOk(p);     // 평일엔 못 가는 자리 — 같이 이동엔 안 본다
  const done = goneToday(place);                 // 오늘 이미 다녀왔다
  const out = !away && p && p.meet === 'out' ? whoOut() : null; // 마주치는 자리 — 이동이면 상대가 정해져 있다
  const empty = !!out && !out.length;
  const need = !away && !!p && !!p.pick && !picked; // 동행을 아직 안 골랐다 — 이동이면 이미 정해져 있다
  /* 같이 있다가 발길 닿는 이동. 그 사람이 갈 수 있는 자리(who)여야 하고,
     열려 있어야 하고, 오늘 안 간 데여야 한다. 귀갓길에서는 못 옮긴다 — 곧 내린다.
     근무·수업·점심·야자 중에는 학교 안에서만 옮긴다 — 점심의 보건실→옥상은
     되고, 근무 중의 재언을 편의점으로 빼내지는 못한다. 학교 밖은 퇴근 뒤다.
     수업 중의 교실은 이동으로도 못 들어간다 — 문틈(klass)과 같은 이유다. */
  const stuck = away && !isWend() && AT_WORK.includes((presence(scene.room) || {}).t || '');
  const mv = !!(away && scene.place !== WAY && !!p && (p.who || []).includes(scene.room)
    && !locked && !shut && !done
    && !(stuck && p.map !== 'school')
    && !(place === '교실' && presence('minhyun').t === '수업 중'));
  /* 수업 중의 교실은 가는 데가 아니라 들여다보는 데다. 앉아서 대화하던
     것이 이상했다 — 수업 중인 애랑 마주 앉아 떠들 수는 없다.
     구경은 방문이 아니라 도장(goneToday)을 안 본다 — 오늘 다녀왔어도 본다.
     자리에 있는 동안은 구경이 아니라 이동의 영역이다(!scene).
     주말은 위의 shut이 먼저 막는다(교실은 wend:false). */
  const klass = place === '교실' && !scene && !locked && !shut && presence('minhyun').t === '수업 중';
  const no = !klass && !mv && !!(away || locked || shut || wk || done || empty);
  /* 무엇을 먼저 가야 하는지는 안 적는다. 순서를 알려주면 지도를 도는 게
     심부름이 되고, 「옥상 먼저」 같은 줄이 창마다 붙어 지저분하다 */
  const done_ = `오늘치 ${jos(place, '은/는')} Complete...`;
  const why = away && !mv
    ? (done ? done_
      : shut && !locked ? placeWhen(p)
        : `현재 위치는 ${scene.place}...`)
    : locked ? ''
      : done ? done_
        : wk ? '여기는 Weekend only! ♡'
          : empty ? '지금 밖은 Empty...'
            : shut ? placeWhen(p) : '';
  /* 얼굴은 픽셀 글꼴에 글자가 없어서 창이 따로 그린다 — 웹의 .kao와 같은 몫 */
  const kao = done ? '(⸝⸝o̴̶̷᷄ ·̭ o̴̶̷̥᷅⸝⸝)♡'
    : wk ? '٩(❛ัᴗ❛ั ๑)'
      : empty ? '՞ ⸝⸝> ̫ <⸝⸝ ՞' : '';
  /* 잠긴 자리(locked && !away)는 이 줄 대신 「my bad ♡ / 아직은 못 가요」가
     뜬다 — 시간 탓이 아니라 아직 안 열린 자리라서 말투가 다르다. 그 갈림은
     창이 locked·away를 보고 정한다. 여기서 title에 섞으면 한 칸에 성격이
     다른 두 문장이 들어간다. */
  const title = klass ? `${jos(place, '은/는')} CLASS 중!`
    : mv ? `${place}도 같이 GO?`
      : no ? `${jos(place, '은/는')} 잠깐 OFF!`
        : `${jos(place, '으로/로')} GO?`;
  /* 시간을 내서 가는 자리는 누구랑 갈지 고른다 — 같이 이동이면 이미 정해져 있다 */
  const canPick = !no && !mv && !!p && !!p.pick;
  return {away, locked, shut, wk, done, empty, need, mv, klass, no, why, kao, title,
    canPick, who: (p && p.who) || []};
}

/* ── 누구를 만나나 ──
   pick — 유저가 고른다(도서관·레코드샵). 시간을 내서 가는 자리라서.
   out  — 그 시각에 밖에 나와 있을 수 있는 사람 중에서 뽑는다. 마주치는 자리라서.
   그 밖 — 자리 임자가 정해져 있다. 둘 다면 더 많이 말을 나눈 쪽.
   말수로 가르는 건 자리를 상으로 주는 게 아니라, 옥상처럼 둘 다 오는 데서
   지금 이야기가 붙어 있는 쪽이 나오는 게 자연스러워서다. */
export function whoAt(p, picked, msgs) {
  if (!p) return null;
  if (p.pick) return picked || null;
  if (p.meet === 'out') { const out = whoOut(); return out.length ? out[Math.floor(Math.random() * out.length)] : null; }
  const list = p.who || []; if (list.length < 2) return p.own || list[0];
  const n = id => ((msgs || {})[id] || []).length;
  return list.slice().sort((a, b) => n(b) - n(a))[0];
}

/* ── 접어둔 자리는 시간에 맞춰 끝난다 ──
   X는 나가기가 아니라 접어두기다. 유효기간이 없으면 낮에 보건실을 접어두고
   저녁에 열어도 아직 보건실에 앉아 있게 된다 — 재언은 다섯 시에 퇴근하는
   사람인데. 이 앱의 전제는 유저가 없어도 세계가 돌아간다는 거다.
   그 방에서 말이 끊긴 지 한 시간이 지났으면 그 모임은 끝난 걸로 친다.
   한 시간은 새 숫자가 아니다 — 「자리를 비웠다」의 기준(AUTO_AWAY, 관전방과
   같은 자)이다. 하루 경계(새벽 다섯 시)로 닫던 때는 낮에 접어둔 자리가
   밤까지 살아 있었다. 이 규칙이 그 규칙을 통째로 품는다.
   대화가 이어지는 중이면 한 시간이 안 됐으니 안 닫힌다 — 따로 봐줄 게 없다.
   sceneOver는 문 닫는 시각과 자는 시각을 본다(rules.ts).

   답이 오는 중이면(inflight) 건너뛰는 것은 여기 안 적는다 — 그건 요청을
   들고 있는 App.tsx만 아는 사정이고, 이 파일은 시계와 기록만 본다. */
export function sceneExpired(scene, msgs) {
  const sc = scene; if (!sc) return false;
  const ms = ((msgs || {})[sc.room]) || [];
  const last = ms.length ? ms[ms.length - 1].ts : sc.since;
  return (Date.now() - last >= AUTO_AWAY) || sceneOver(sc);
}

/* ── 이번 말에 place_over를 실을까 ──
   자리의 때가 지났으면 그 사실을 같이 보낸다. 인물이 이번 대답에서
   마무리하고 일어서고, 말풍선이 다 뜨면 그때 자리가 닫힌다 —
   침묵으로 만료되는 길(sceneExpired)과 달리 작별 인사가 남는다.
   방이 맞는지는 안 본다. 웹도 sc.room===room일 때만 place를 싣고, 그
   갈림은 보내는 쪽이 이미 했다 — App.tsx는 그 방의 자리만 여기 넘긴다. */
export function placeOverNow(scene) {
  return !!scene && sceneOver(scene);
}

/* ── 첫 자리 ──
   한 마디도 오간 적이 없으면 인사로 시작하지 않는다. 자리에서 시작한다.
   시작한 시각이 어디인지를 정하고, 거기 있는 사람을 만난다.
   고르는 건 rules.ts가 한다 — 여기서는 자리 만드는 데 필요한 넷만 추려
   넘긴다. openingFor가 돌려주는 건 표 안의 원본이라, 그대로 들고 나가면
   scene에 섞여 들어가 표를 물들일 수 있다. */
export function openingNow() {
  const o = openingFor();
  return {place: o.place, room: o.room, note: o.note, ...(o.bg ? {bg: o.bg} : {})};
}

/* 선톡 간격. app-data.js가 아니라 app.js에 박혀 있던 숫자라 규칙 파일에 없다 —
   시간표가 정하는 것이 아니라 「얼마나 조용했으면 말을 거나」라서 자리·시각을
   재는 표에 낄 자리가 없었다. 하루 상한이나 제비뽑기는 안 둔다. 올 때마다
   같은 말이 오는 게 문제였지 오는 것 자체가 문제가 아니었다. */
const GREET_GAP_MIN = 180;
/* ── 먼저 말을 걸어도 되나 ──
   문지기 넷. 관전방·단톡방은 사람이 아니라 방이라 선톡이 없고, 자는 사람은
   안 건다 — 목록의 점을 정하는 함수(presence→canGreet)가 선톡도 정한다.
   점은 「꺼짐」인데 그 사람 말풍선이 오면 그게 처음 고치려던 그림이다.
   눈앞에 앉아 있는 사람도 안 건다 — 마주 앉아서 문자를 보내는 셈이 된다.
   그리고 세 시간. lastTs는 그 방의 마지막 말이 온 시각이고, 한 마디도 없는
   방이면 0이다 — 그때는 간격을 못 재니 통과시킨다(첫인사가 그 길로 나간다). */
export function canGreetNow(id, scene, lastTs) {
  if (id === 'health' || id === 'group') return false;
  if (!canGreet(id)) return false;
  if (scene && scene.room === id) return false;
  const gapMin = lastTs ? Math.round((Date.now() - lastTs) / 60000) : -1;
  return !(gapMin >= 0 && gapMin < GREET_GAP_MIN);
}

/* 자리에 들어오자마자 손에 들어오면 그건 받은 게 아니라 주운 것이다.
   들렀다 바로 나오는 것만으로 여덟 개가 다 모이면 지도를 도는 일이
   심부름이 된다. 말을 두 마디는 하고 나와야 건넬 자리가 있었던 걸로 친다.
   덜 하고 나가면 그 자리는 그대로 남는다 — 다시 오면 된다.
   이것도 app.js에 있던 숫자다(SCENE_MIN_TALK). 자리마다 다른 값이 아니라
   자리 전체에 걸리는 문턱이라 표에는 안 들어갔다. */
const SCENE_MIN_TALK = 2;
/* 자리가 열린 뒤(since) 유저가 한 말만 센다. 지문(sys)은 유저가 한 말이
   아니라 일어난 일이라 빼고 — 「보건실에 갔다」 한 줄로 물건을 받아 가면
   말을 나눴다는 뜻이 없어진다. 두고 온 것 챙기기와 밤 귀갓길이 이걸 본다. */
export function talkedEnough(scene, msgs) {
  const sc = scene;
  return !!sc && (((msgs || {})[sc.room]) || [])
    .filter(m => !m.sys && m.sender === 'user' && m.ts >= (sc.since || 0)).length >= SCENE_MIN_TALK;
}
