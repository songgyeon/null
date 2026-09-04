/* 이 파일은 손으로 고치지 않는다.
   scripts/data에서 tools/build-rules.mjs가 만든다 — 규칙을 고칠 곳은 그쪽 하나다.
   웹과 앱이 같은 글을 읽어야 같은 세계가 된다. 베껴 두면 반드시 갈라진다.
   다시 만들기: node tools/build-rules.mjs */
// @ts-nocheck
import './shim';   // localStorage·location — 아래 규칙들이 딛고 서는 바닥

function __build(): any {

/* ── 보이는 높이를 직접 재서 못박는다 ──
   안드로이드 크롬에서 키보드가 올라오면 100dvh 만으로는 안 맞았다.
   껍데기는 키보드 뜨기 전 높이로 남고, 브라우저는 입력칸을 보이려고 페이지를
   위로 굴린다 — 그래서 앱 아래에 흰 띠가 생기고 아래가 잘린 채 멈춘다.

   dvh 는 「키보드가 올라온 뒤」를 늦게 따라오거나 아예 안 따라온다.
   실제로 보이는 칸은 visualViewport 가 안다. 그 높이를 --vh 에 적고
   껍데기를 거기에 맞춘다. 페이지 자체는 굴리지 않는다(scrollTo(0,0)) —
   굴러갈 곳이 없어야 흰 띠가 안 생긴다.

   여기서 재는 이유: 리액트가 뜨기 전에 첫 값이 박혀 있어야 첫 그림부터 맞는다. */
/* 이 파일은 앱(Expo)과 시험(node)에서도 읽힌다 — 거기엔 창도 문서도 없다.
   웹 화면일 때만 돈다 */
if (typeof window !== "undefined" && typeof document !== "undefined") (function(){
  var vv = window.visualViewport;
  var fit = function(){
    var h = (vv && vv.height) || window.innerHeight || 0;
    if (!h) return;
    document.documentElement.style.setProperty("--vh", h + "px");
    /* 키보드가 올라오며 굴러간 만큼 되돌린다. 굴린 것은 브라우저지 유저가 아니다 */
    if (window.scrollY) window.scrollTo(0, 0);
  };
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); }
  /* 칸에 커서가 들어간 직후가 제일 어긋난다 — 그 뒤로 한 번 더 잰다 */
  document.addEventListener("focusin", function(){ setTimeout(fit, 250) });
  document.addEventListener("focusout", function(){ setTimeout(fit, 250) });
})();

/* NULL — 데이터와 규칙.
   JSX가 없어서 바벨을 안 거친다. 브라우저가 그냥 읽는다.
   여기 있는 것은 전부 「무엇이 있는가」다 — 인물, 방, 선물, 장소, 시간표,
   그리고 그것들을 재는 자. 화면은 이 파일을 안 본다. 화면이 이 파일을 본다. */
/* (훅을 꺼내 쓰던 줄은 앱에서 뺀다 — 여기는 규칙만 산다) */
const API = "https://null-api.re-moonroom.workers.dev/";
/* ── 자물쇠 열쇠 ──
   워커 대시보드에 ACCESS_KEY를 넣으면 그때부터 열쇠 없는 호출이 거절된다.
   주소에 ?k=<값>을 한 번 붙여 들어오면 저장해 두고 그 뒤로는 늘 실어 보낸다
   — 링크를 다시 뿌릴 때 열쇠 붙은 주소 하나만 주면 된다.
   워커에 비밀값이 없으면 이 열쇠는 있어도 없어도 아무 일도 없다. */
const loadKey=()=>{try{return localStorage.getItem("null_apikey")||""}catch(e){return""}};
(()=>{try{const k=new URLSearchParams(location.search).get("k");
  if(k&&k.trim())localStorage.setItem("null_apikey",k.trim())}catch(e){}})();
const apiUrl=()=>{const k=loadKey();return k?API+"?k="+encodeURIComponent(k):API};

/* 프사를 교체해도 파일명이 같으면 브라우저·CDN이 옛 이미지를 계속 쓴다.
   사진을 갈아끼울 때마다 이 숫자를 올린다. */
const AV_V = "?v=170";

/* 캐릭터 / 방 정의 */
const CHARS = {
  /* rom — 창 이름에 쓰는 로마자. 열쇠(jaeeon·minhyun)는 저장된 게임이
     붙들고 있어서 못 바꾸므로, 사람에게 보이는 철자는 따로 둔다. */
  jaeeon:{name:"이재언",rom:"jaeeon",color:"#7FD8D8",dk:"#2fa8a0",pale:"#cef0ee",img:"jaeeon-profile.webp",zoom:"100%",pos:"50% 40%",
    gallery:["jaeeon-work.webp","jaeeon-chart.webp","jaeeon-cook.webp","jaeeon-rooftop.webp","jaeeon-shelf.webp","jaeeon-laundry.webp","jaeeon-driveseat.webp","jaeeon-conv.webp","jaeeon-record.webp",
      /* 자리마다 거리가 있다 — 중거리(mid)와 클로즈업(near). 눈 감은 최근접은
         여기 없다: 그건 KISS_SHOT이고 관계 단계가 열어준다 */
      "jaeeon-nurse-mid.webp","jaeeon-nurse-near.webp",
      "jaeeon-laundry-seat.webp","jaeeon-laundry-mid.webp","jaeeon-laundry-near.webp",
      "jaeeon-home-mid.webp","jaeeon-home-near.webp",
      "jaeeon-night.webp","jaeeon-book.webp"]},
  minhyun:{name:"이강현",rom:"kanghyun",color:"#FF9E80",dk:"#f0764a",pale:"#ffe0d2",img:"minhyun-profile.webp",zoom:"150%",pos:"50% 22%",
    gallery:["minhyun-candy.webp","minhyun-corridor.webp","minhyun-rain.webp","minhyun-gate.webp","minhyun-morning.webp","minhyun-elevator.webp","minhyun-alley.webp","minhyun-gym.webp","minhyun-busstop.webp","minhyun-busride.webp","minhyun-winter.webp","minhyun-snow.webp","minhyun-bench.webp","minhyun-desk.webp","minhyun-stair.webp","minhyun-vending.webp","minhyun-laundry.webp","minhyun-nap.webp","minhyun-neon.webp","minhyun-ramen.webp","minhyun-window.webp","minhyun-mirror.webp","minhyun-crate.webp","minhyun-record.webp","minhyun-shelf.webp",
      "minhyun-laundry-mid.webp","minhyun-laundry-near.webp",
      "minhyun-rooftop-mid.webp","minhyun-rooftop-near.webp",
      "minhyun-home-mid.webp","minhyun-home-near.webp",
      "minhyun-fridge.webp"]},
};
/* 교생 실습 기간. etc.의 D-카운트가 여기서 나온다 */
const ENROLL_DAYS = 30;
/* ── 날짜는 접속할 때만 간다 ──
   D-day·관계 단계·해금은 현실 경과시간이 아니라 이 판을 실제로 연 날을 센다.
   새벽 다섯 시를 하루 경계로 삼고, 그 경계를 지난 뒤 처음 foreground가 된
   순간에만 한 칸 간다. 며칠 비웠어도 한 칸뿐이고, 기기 시계가 뒤로 가면
   마지막으로 본 날짜보다 앞선 날짜는 세지 않는다.

   현실 시각은 따로 그대로 흐른다. 말풍선 시각·요일·presence·시간표는
   Date.now()를 보고, 접속 일차를 거꾸로 섞지 않는다. 오늘의 운세도 이 시계가
   아니라 별도의 자정 경계를 쓴다. */
/* ── 세계 확정 ──
   등록의 Click 뒤에 확인 화면이 한 번 선다 — 「{이름}, 너는 이 세계에 /
   NULL 존재하게 할 수 있을까?」. YES를 누른 순간에만 세계가 생긴다.
   이름이 저장돼 있어도 이 값이 없으면 메신저로 건너뛰지 않는다 —
   등록만 하고 닫은 사람은 아직 시작 전이다. YES 뒤에는 프로필이 잠긴다. */
const loadWorld=()=>{try{return localStorage.getItem("null_world")==="1"}catch(e){return false}};
const saveWorld=()=>{try{localStorage.setItem("null_world","1")}catch(e){}};
/* ── 연애 상대 ──
   D-0의 WHO에서 정해진다. null | jaeeon | minhyun 단일값 — 배열 없음,
   두 명 없음, 한 번 정해지면 무를 수 없다. 연타·새로고침이 와도 처음
   저장된 값이 이긴다. */
const loadPartner=()=>{try{const v=localStorage.getItem("null_partner");
  return v==="jaeeon"||v==="minhyun"?v:null}catch(e){return null}};
const savePartner=id=>{try{
  if(id!=="jaeeon"&&id!=="minhyun")return null;
  if(loadPartner())return null;                  // WHO는 한 번만이다
  localStorage.setItem("null_partner",id);return id}catch(e){return null}};
/* 옛 판의 최초 변환에서만 읽는다. 변환 뒤에는 real/speed가 진행에 관여하지
   않는다. 공개 선택 UI도 없어졌으므로 호환 이름은 언제나 real/false다. */
const legacyMode=()=>{try{return localStorage.getItem("null_mode")==="speed"?"speed":"real"}catch(e){return"real"}};
const loadMode=()=>"real";
const saveMode=v=>"real";
const speedOn=()=>false;
/* 시계가 출발하는 자리. 첫 마디가 있던 날이다 */
const firstTsOf=store=>Object.values((store&&store.msgs)||{}).flat()
  .reduce((a,x)=>!a||(x&&x.ts<a)?(x&&x.ts)||a:a,0);
const SPEED_RATE=4;         // 옛 speed 판을 최초 한 번 변환할 때만 쓰는 비율
const ACCESS_CLOCK_KEY="null_access_clock_v1";
const ACCESS_CLOCK_V=1;
let WORLD_ANCHOR=0;         // 옛 판 변환용 첫 말풍선의 현실 epoch
const setWorldAt=firstTs=>{ WORLD_ANCHOR=Number(firstTs)||0 };
const asEpoch=now=>{const n=now instanceof Date?now.getTime():Number(now);return Number.isFinite(n)?n:Date.now()};
/* 현실 로컬 날짜, 새벽 다섯 시 경계. 문자열 비교가 시간 순서가 되도록 0을 채운다. */
const accessDayKey=now=>{
  const d=new Date(now==null?Date.now():now); if(d.getHours()<5)d.setDate(d.getDate()-1);
  const p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
};
const cleanAccessClock=value=>{
  if(!value||value.v!==ACCESS_CLOCK_V||!Number.isInteger(value.elapsed)||value.elapsed<0
    ||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value.lastKey||"")
    ||!Number.isFinite(value.lastAt))return null;
  const milestones={};
  if(value.milestones&&typeof value.milestones==="object"&&!Array.isArray(value.milestones))
    Object.keys(value.milestones).forEach(k=>{
      const n=Number(k), at=Number(value.milestones[k]);
      if(Number.isInteger(n)&&n>=0&&Number.isFinite(at)&&at>0)milestones[String(n)]=at;
    });
  let legacy=null;
  if(value.legacy&&typeof value.legacy==="object"){
    const firstTs=Number(value.legacy.firstTs), rate=Number(value.legacy.rate),
      migratedAt=Number(value.legacy.migratedAt), elapsed=Number(value.legacy.elapsed);
    if(Number.isFinite(firstTs)&&firstTs>0&&(rate===1||rate===SPEED_RATE)
      &&Number.isFinite(migratedAt)&&Number.isInteger(elapsed)&&elapsed>=0)
      legacy={firstTs,rate,migratedAt,elapsed};
  }
  return {v:ACCESS_CLOCK_V,elapsed:value.elapsed,lastKey:value.lastKey,
    lastAt:value.lastAt,milestones,legacy};
};
const loadAccessClock=()=>{try{return cleanAccessClock(JSON.parse(localStorage.getItem(ACCESS_CLOCK_KEY)))}catch(e){return null}};
const saveAccessClock=value=>{try{
  const v=cleanAccessClock(value); if(!v)return null;
  localStorage.setItem(ACCESS_CLOCK_KEY,JSON.stringify(v)); return v;
}catch(e){return null}};
/* YES를 누른 새 판은 그 순간 D-30이다. 첫 메시지가 생길 때까지 기다리지 않는다. */
const startAccessClock=now=>{
  const at=asEpoch(now==null?Date.now():now);
  return saveAccessClock({v:ACCESS_CLOCK_V,elapsed:0,lastKey:accessDayKey(at),lastAt:at,
    milestones:{"0":at},legacy:null});
};
/* 옛 판은 real/speed의 종전 계산 결과를 그대로 한 번 받아온다. 이 뒤부터
   null_mode는 읽지 않는다. 변환한 날 자체는 새 접속일로 더 세지 않는다. */
const legacyElapsed=(store,now,rate)=>{
  const first=firstTsOf(store)||WORLD_ANCHOR, at=asEpoch(now==null?Date.now():now);
  if(!first)return 0;
  return Math.max(0,Math.floor((at-first)*(rate||1)/864e5));
};
const migrateAccessClock=(store,now)=>{
  const at=asEpoch(now==null?Date.now():now), first=firstTsOf(store)||WORLD_ANCHOR;
  const rate=legacyMode()==="speed"?SPEED_RATE:1;
  const elapsed=legacyElapsed(store,at,rate), milestones={};
  if(first){
    milestones["0"]=first;
    [30,60].forEach(n=>{if(elapsed>=n)milestones[String(n)]=first+n*864e5/rate});
  }else milestones["0"]=at;
  return saveAccessClock({v:ACCESS_CLOCK_V,elapsed,lastKey:accessDayKey(at),lastAt:at,
    milestones,legacy:first?{firstTs:first,rate,migratedAt:at,elapsed}:null});
};
/* 새 05시 기준일의 첫 foreground에서만 +1. 키가 같으면 재접속이어도 그대로,
   키가 작으면 시계 역행이므로 lastKey와 elapsed를 모두 보존한다. */
const touchAccessClock=(store,now)=>{
  const at=asEpoch(now==null?Date.now():now);
  let state=loadAccessClock();
  if(!state){if(!loadWorld())return null;return migrateAccessClock(store,at)}
  const key=accessDayKey(at);
  if(key<=state.lastKey)return state;
  const elapsed=state.elapsed+1;
  const milestones={...state.milestones};
  if(elapsed<=60)milestones[String(elapsed)]=at;
  return saveAccessClock({...state,elapsed,lastKey:key,lastAt:at,milestones})||state;
};
const accessElapsed=store=>{
  const state=loadAccessClock();
  if(state)return state.elapsed;
  return loadWorld()?legacyElapsed(store,Date.now(),legacyMode()==="speed"?SPEED_RATE:1):0;
};
/* 과거 물건의 D-일차용. 변환 이전 epoch는 옛 비율로, 이후는 실제 접속
   milestone로 되짚는다. */
const accessElapsedAt=(store,ts)=>{
  const at=Number(ts); if(!Number.isFinite(at)||at<=0)return 0;
  const state=loadAccessClock();
  if(!state)return legacyElapsed(store,at,legacyMode()==="speed"?SPEED_RATE:1);
  let elapsed=0;
  if(state.legacy){
    if(at<=state.legacy.migratedAt)
      return Math.min(state.legacy.elapsed,Math.max(0,
        Math.floor((at-state.legacy.firstTs)*state.legacy.rate/864e5)));
    elapsed=state.legacy.elapsed;
  }
  Object.keys(state.milestones).forEach(k=>{
    if(state.milestones[k]<=at)elapsed=Math.max(elapsed,Number(k)||0);
  });
  return Math.min(state.elapsed,elapsed);
};
const accessMilestoneAt=elapsed=>{
  const state=loadAccessClock(), n=Math.max(0,Math.floor(Number(elapsed)||0));
  if(!state||state.elapsed<n)return 0;
  if(state.milestones[String(n)])return state.milestones[String(n)];
  if(state.legacy&&state.legacy.elapsed>=n)
    return state.legacy.firstTs+n*864e5/state.legacy.rate;
  return 0;
};
/* 저장된 epoch와 현재 벽시계는 언제나 현실 그대로다. 옛 함수 이름은 호출부
   호환을 위해 남기되 이제 어떤 배속도 적용하지 않는다. */
const gameAt=ts=>new Date(Number(ts)||Date.now());
const worldStart=()=>new Date(WORLD_ANCHOR||Date.now());
const worldNow=()=>new Date(Date.now());
const worldDays=()=>accessElapsed({msgs:{anchor:WORLD_ANCHOR?[{ts:WORLD_ANCHOR}]:[]}});
const worldDaysOf=store=>accessElapsed(store);
const nowClock=()=>new Date(Date.now());
/* ── 개발 전용 일차 이동 ──
   한 판에서 30일을 확인할 때 D-day 접속 눈금만 직접 민다. 저장된 ts와 현실
   벽시계, presence, 시간표, 하루 도장은 움직이지 않는다. NULL_DEV가 켜진
   빌드에만 실린다 — 켜는 자리는 빌드지 localStorage가 아니다. */
const DEV_TIME = typeof NULL_DEV !== "undefined" && !!NULL_DEV;
/* 개발 단추도 벽시계를 움직이지 않는다. 접속 일차만 직접 민다. */
const devAddDay=n=>{if(!DEV_TIME)return;
  const add=Math.max(1,Math.floor(Number(n)||1));
  let state=loadAccessClock()||startAccessClock(Date.now()); if(!state)return;
  const elapsed=state.elapsed+add, milestones={...state.milestones};
  [30,60].forEach(x=>{if(state.elapsed<x&&elapsed>=x)milestones[String(x)]=Date.now()});
  saveAccessClock({...state,elapsed,milestones});
};
/* 남은 날을 콕 집어 맞춘다 — D-7·D-0 단추가 이걸 부른다. 지금 남은 날을
   받아서 그 차이만큼만 민다. 뒤로는 못 간다 — 오프셋을 음수로 두면 출발보다
   이른 「지금」이 나와서 일차가 음수가 되고, 그 아래 규칙들이 다 깨진다. */
const devToLeft=(curLeft,want)=>{
  const d=(Number(curLeft)||0)-Math.max(0,Number(want)||0);
  if(d>0)devAddDay(d);
};
/* D-0에 "계속 살아갈까"에 y를 누르면 한 달이 더 붙는다 */
const loadExtend=()=>{try{return +localStorage.getItem("null_extend")||0}catch(e){return 0}};
/* 첫날의 통보. 현실 스무 시간이 지난 뒤 처음 여는 순간에 한 번만 띄운다. */
const SYS1_AFTER = 20*60*60*1000;
const sys1Due=store=>{
  const first=firstTsOf(store);
  return !!first && Date.now()-first >= SYS1_AFTER;
};
/* ── 오프닝에서 만난 사람 ──
   세계가 시작된 자리에 있던 쪽이다. 다른 한 사람은 아직 안 만난 사람이고,
   그쪽을 만나는 것이 첫 며칠의 할 일이다.

   판을 새로 열기 전의 세이브에는 이 값이 없다. 그런 판에서는 getcha 목록의
   첫 항목이 같은 값을 들고 있다 — 그 창은 오프닝이 닫힐 때 처음 뜨므로
   맨 앞이 오프닝 방이다. 없으면 null이고, 없는 것은 모르는 것이지
   틀린 것이 아니다 — 부르는 쪽이 「모르면 지금까지대로」로 받는다. */

/* ── 유저의 옛 일기 ──
   재언 방에 처음 들어가는 순간, 선톡 앞에 한 번. 20년 전 공부방 아이가
   쓴 것이고, 유저는 그걸 읽고 마지막 한 칸을 채운다.

   ⚠️ 채운 값은 **어떤 요청에도 실리지 않는다.** 프롬프트에도, story에도,
   페이로드에도 안 간다 — 여기 브라우저 안에만 산다. 유저만의 비밀이다.
   그래서 저장 자리도 이야기 상태(null_store_v1·loadStory)와 따로 둔다.
   시험이 실제 요청 본문을 뒤져서 이 값이 안 새는지 잰다.

   「엄마가 사탕을 줬다」에서 멈춘다. 누구에게 줬는지는 비운다 —
   사탕 삼각형은 어떤 화면도 발설하지 않는다. */
/* 종이의 결·빛·모서리는 사진이고, 글월과 빈칸은 화면의 실제 글자다.
   20년 전 물건의 재질은 지키되 사진에 문장을 인쇄해 두지는 않는다 — 그래야
   글자 크기와 줄 간격이 화면을 따라 흐르고, 빈칸도 같은 문장 안에 선다. */
const DIARY_PAPER_IMG="diary-paper-child.webp";
const DIARY_HEAD="200X.XX.XX";
const DIARY_LINES=[
  "엄마가 이제 이사를 간다고 공부방을 안 한다고 했다.",
  "나는 속상해서 울었는데 엄마가 사탕을 줬다.",
  "그래도 계속 눈물이 났다.",
  "나중에 크면 다시 이 동네에 올 거다.",
];
const DIARY_TAIL_A="왜냐하면 나는 ";
const DIARY_TAIL_B="니까.";
const DIARY_MAX=8;
const loadDiary=()=>{try{return localStorage.getItem("null_diary")||""}catch(e){return""}};
const saveDiary=v=>{try{
  const t=(v||"").toString().trim().slice(0,DIARY_MAX);
  if(t)localStorage.setItem("null_diary",t);
  return t;
}catch(e){return""}};

/* ── 강현의 옛 일기 — 병원 옥상 ──
   오프닝에서 강현을 만난 판에서, 「저 알죠」 세 줄이 다 앉은 뒤 유저가 처음
   무언가를 입력한 그 순간. 엽서 앞면(그날의 옥상)이 천천히 뜨고, 그다음
   뒷면으로 천천히 넘어간다. 뒷면이 일기고 빈칸이 셋이다.

   정사는 전부 고정이다 — 옥상, 담배, 금연, 책임. 유저가 짓는 것은 자기
   행동이 아니라 **상대의 반응**(표정·말)과 **자기 소망**이다.

   빈칸 자리는 사진에 그려진 네모를 실제로 재서 넣었다(1024×1536 기준).
   눈으로 맞추면 화면 크기가 바뀔 때마다 어긋난다. */
const FLASH_FRONT="card-rooftop.webp";
const FLASH_BACK="card-note.webp";
const FLASH_ALT=[
  "병원 옥상에서 흡연 중인 고등학생을 만났다.",
  "나는 아무 말도 하지 않았다.",
  "걔는 왜 아무 말도 안 하냐고 했다.",
  "내가 책임질 사이에나 그런 말을 하는 거랬더니",
  "한 대 더 꺼내길래 그만 피우라고 했다.",
  "내가 책임지겠다고.",
  "걔는 □ 표정으로 날 보면서 □ 라고 했다.",
  "다시 만나면 □ 고 싶다.",
];
/* 셋의 뜻. 저장도 이 열쇠로 하고, 나중에 가변부로 나갈 때도 이 이름이다 */
const FLASH_KEYS=["face","said","wish"];
const FLASH_BOX=[
  {key:"face", left:24.71, top:59.90, w:33.01, h:4.04},
  {key:"said", left:32.13, top:66.47, w:37.01, h:4.17},
  {key:"wish", left:36.04, top:73.50, w:30.08, h:4.10},
];
const FLASH_MAX=10;
/* ── 얼마나 천천히 ──
   숫자를 화면과 시험이 같이 본다. 한쪽에만 적으면 「천천히」가 두 뜻이 된다.
   앞면이 앉고(1.4초) 잠깐 그대로 있다가(1.6초) 넘어간다(1.2초). */
const FLASH_RISE=1400, FLASH_HOLD=1600, FLASH_TURN=1200;
const loadFlash=()=>{try{
  const v=JSON.parse(localStorage.getItem("null_flash"));
  return v&&typeof v==="object"&&!Array.isArray(v)?v:null;
}catch(e){return null}};
const saveFlash=o=>{try{
  const out={};
  for(const k of FLASH_KEYS){
    const t=((o||{})[k]||"").toString().trim().slice(0,FLASH_MAX);
    if(!t)return null;                       // 셋이 다 차야 저장한다
    out[k]=t;
  }
  localStorage.setItem("null_flash",JSON.stringify(out));
  return out;
}catch(e){return null}};

/* ── ⑩ 지금의 일기 ──
   옛 일기는 오래된 줄공책, 지금의 일기는 밝은 바인더 종이다. 두 장 모두
   종이만 사진으로 두고 글월과 빈칸은 흐르는 화면 글자로 얹는다.

   ── 선택이다 ──
   매일 쓰면 일과가 되고, 일과가 되면 안 쓴다. 그래서 날마다 안 묻는다.
   떠날 날 눈금 다섯에 한 장씩만 열리고, 안 써도 아무것도 안 막힌다.
   다섯 장은 순서가 아니라 거리다 — 뒤로 갈수록 문장이 짧아지고 마지막
   장은 두 칸뿐이다.

   ⚠️ 채운 값은 **어떤 요청에도 안 실린다.** 옛 일기·엽서와 같은 자리다 —
   프롬프트에도, story에도, 페이로드에도 안 간다. 시험이 실제 요청 본문을
   뒤져서 이 값이 안 새는지 잰다. 두 사람이 모르는 것이 이 게임의 뼈다. */
/* 다섯 장은 같은 빈 바인더 종이를 쓴다(1024×1536, 2:3).
   blanks의 숫자는 저장할 수 있는 글자 수 계약이다. 화면 폭이나 네모 좌표가
   아니라 입력값의 경계이므로 그대로 둔다. */
const MY_DIARY_IMG="diary-paper-now.webp";
const MY_DIARY=[
  {at:25, text:
    "오늘 이 선생님과 {talk} 얘기를 나눴다. 이 선생님은 가끔 나를 오래 안 것처럼 "+
    "쳐다본다. 그게 꼭 {feel}다. 강현이한테는 {told} 했는데 강현이는 내가 "+
    "{think}고 생각하는 거 같다. 내일은 {tmr}까? 잘 모르겠다. 나는 여전히 빈칸이다.",
   blanks:{talk:6,feel:7,told:7,think:6,tmr:7}},
  {at:20, text:
    "어쩌면 이 선생님은 나를 {know}도 모른다. 그게 나에게는 {feel}다. "+
    "강현이와 이 선생님 사이에서 나는 {between}다. 오늘은 강현이가 {like}처럼 "+
    "느껴졌다. 앞으로 어떻게 해야 할까. 아직은 더 채워야겠다.",
   blanks:{know:8,feel:11,between:13,like:15}},
  /* 두 칸은 코드가 안다 — 실제로 준 물건이다. 유저가 쓰는 것은 물건이 아니라
     **이유**다. 일기가 거울이 되는 자리라 여기만 자동이 섞인다.
     안 준 사람 칸은 그냥 빈칸으로 둔다 — 없는 선물을 지어내지 않는다. */
  {at:14, text:
    "내가 채운 빈칸들이 나에게 돌아오고 있다. 내가 강현이에게 {giftK}를 준 이유는 "+
    "정말 {whyK}뿐이었을까? 이 선생님에게 {giftJ}를 줬던 건 {whyJ}만은 아니었던 "+
    "것 같다. 나는 두 사람에게 {want}고 싶다. 그게 {even}일지라도.",
   blanks:{giftK:5,whyK:14,giftJ:5,whyJ:19,want:9,even:13},
   auto:{giftK:"minhyun",giftJ:"jaeeon"}},
  {at:7, text:
    "이제는 내가 누구인지 {decide}해야 할 때가 온 거 같다. 두 사람을 언제까지고 "+
    "{keep} 할 수는 없다. 강현이도, 이 선생님도 전부 나에게는 {both}다. "+
    "지금의 나에게는 내 {mine}보다 두 사람의 {theirs} 더 {more}다.",
   blanks:{decide:5,keep:11,both:10,mine:6,theirs:4,more:8}},
  /* 마지막은 두 칸이다. 여기까지 온 사람에게 더 물을 것이 없다 */
  {at:0, text:"{last}. 나는 정말 {who}일까?",
   blanks:{last:7,who:7}},
];
/* 글에서 칸을 뽑아 조각으로 가른다. 화면도 시험도 이 하나를 쓴다 —
   글과 칸 차례를 두 군데서 세면 언젠가 어긋난다. */
const myDiaryParts=text=>String(text||"").split(/(\{[a-zA-Z]+\})/)
  .filter(x=>x!=="").map(x=>/^\{[a-zA-Z]+\}$/.test(x)
    ? {blank:x.slice(1,-1)} : {text:x});
/* 자동 칸의 소유권은 값이 아니라 MY_DIARY의 auto 표가 정한다.
   선물을 안 줘 값이 비어 있어도 이 칸은 시스템 기록이다 — 유저 입력칸으로
   바뀌면 주지 않은 선물을 지어내야만 일기를 덮을 수 있다. */
const myDiarySystemOwned=(entry,key)=>Object.prototype.hasOwnProperty.call(
  ((entry||{}).auto)||{},key);
/* 자동으로 채워지는 칸의 값 — 그 사람에게 실제로 준 것 중 마지막 하나.
   안 줬으면 빈 문자열인 **시스템 칸**으로 남는다. 소유권은 위 함수가 맡고,
   값의 truthy/falsy로 입력 가능 여부를 정하지 않는다. */
const myDiaryAuto=(entry,gifts)=>{
  const out={};
  for(const [k,who] of Object.entries((entry||{}).auto||{})){
    const a=((gifts||{})[who])||[];
    const name=a.length?GIFT_NAME[a[a.length-1]]:"";
    out[k]=name||"";
  }
  return out;
};
const loadMyDiary=()=>{try{
  const v=JSON.parse(localStorage.getItem("null_mydiary"));
  return v&&typeof v==="object"&&!Array.isArray(v)?v:{};
}catch(e){return{}}};
/* 한 장을 통째로 저장한다. 유저 칸이 하나라도 비면 저장하지 않는다 —
   반쯤 채운 일기는 나중에 열었을 때 뭘 하다 만 건지 알 수 없다.

   자동 칸은 작성 순간의 실제 선물명을 **그대로 snapshot**한다. 선물명은 유저
   입력 한도와 무관하므로 자르지 않고, 미증정이면 빈 문자열도 정상 기록이다.
   기존 저장본도 같은 평평한 모양이라 그대로 읽힌다. 이미 잘려 저장된 옛 값은
   추측으로 고치지 않는다 — 현재 선물로 덮어쓰는 것보다 보존하는 편이 안전하다. */
const saveMyDiary=(at,vals)=>{try{
  const e=MY_DIARY.find(x=>x.at===at); if(!e)return null;
  const out={};
  for(const k of Object.keys(e.blanks)){
    const raw=((vals||{})[k]||"").toString().trim();
    if(myDiarySystemOwned(e,k)){out[k]=raw;continue}
    const t=raw.slice(0,e.blanks[k]);
    if(!t)return null;
    out[k]=t;
  }
  const all={...loadMyDiary(),[at]:out};
  localStorage.setItem("null_mydiary",JSON.stringify(all));
  return loadMyDiary()[at]||null;
}catch(e){return null}};
/* 지금 열려 있는 장. 눈금을 지났고 아직 안 쓴 것 중 **가장 늦은** 것 하나다.
   여러 장이 한꺼번에 밀려 있어도 하나만 준다 — 밀린 숙제로 보이면 안 쓴다. */
const myDiaryOpen=left=>{
  const d=Number(left);
  if(!Number.isFinite(d))return null;
  const done=loadMyDiary();
  const open=MY_DIARY.filter(e=>d<=e.at&&!done[e.at]);
  return open.length?open[open.length-1]:null;
};

/* ── {이름} pics ──
   cam 탭은 원래 「받은 사진」이었다. 여기 서는 둘은 받은 게 아니라 유저가
   쓴 것이다 — 유저의 옛 일기 마지막 칸, 병원 옥상 엽서의 세 칸.
   그래서 두 사람 다음에 자기 이름으로 따로 선다. 채운 것만 나온다.

   빈칸 값은 여전히 기기 밖으로 안 나간다. 사진첩에서도 종이 사진 위에
   본문과 값을 실제 글자로 다시 그린다. */
const userPics=(name,giftsOverride)=>{
  const out=[];
  const d=loadDiary();
  if(d)out.push({src:DIARY_PAPER_IMG,label:`${(name||"당신").trim()||"당신"}의 옛 일기`,
    diary:{kind:"child",src:DIARY_PAPER_IMG,values:{why:d}}});
  /* ⑩ 쓴 일기도 여기 쌓인다 — 옛 일기 다음 자리다. 자동 칸까지 작성 순간에
     저장한 snapshot을 그대로 읽는다. 사진첩을 여는 시점의 선물 목록으로 다시
     계산하면 새 선물을 준 뒤 과거 일기의 물건이 바뀐다. */
  /* giftsOverride 인자는 옛 호출부 호환을 위해 받되, 저장된 일기의 값에는 쓰지
     않는다. 웹·Expo 어느 쪽도 재열람이 기록을 고치면 안 된다. */
  const md=loadMyDiary();
  for(const e of MY_DIARY){
    const w=md[e.at]; if(!w)continue;
    out.push({src:MY_DIARY_IMG,label:`D-${e.at}`,
      diary:{kind:"current",src:MY_DIARY_IMG,entry:e,
        values:Object.fromEntries(Object.keys(e.blanks).map(k=>[k,
          Object.prototype.hasOwnProperty.call(w,k)?String(w[k]??""):""]))}});
  }
  const f=loadFlash();
  if(f)out.push({src:FLASH_FRONT,back:FLASH_BACK,label:"병원 옥상",
    /* 채운 칸은 뒷면에 있다 — 앞면은 옥상 사진 한 장이다 */
    backFill:FLASH_BOX.map(b=>({...b,text:f[b.key]||""}))});
  return out;
};

/* ── ④ 플래시백 다음 턴에 나가는 한 줄 ──
   조립이다. 모델을 안 부른다 — originGate와 같은 층이고, 같은 이유다:
   모델에게 맡기면 매번 다르게 둘러대다가 결국 설명이 된다.

   셋 중 **둘째(said)만** 쓴다. 복귀하자마자 셋을 다 쏟으면 되울림이 아니라
   요약이 된다. 「___라고」는 인용 구문이라 유저가 뭘 넣어도 조사가 안 깨진다.

   한 번만 나간다. 도장은 따로 찍는다 — null_flash가 차 있다는 것만으로는
   「아직 말 안 했다」와 「이미 말했다」를 못 가른다. */
const FLASH_SAY_A="선생님, 그때 제가 ", FLASH_SAY_B="라고 했잖아요.";
const flashSayLine=()=>{
  const f=loadFlash();
  const t=((f||{}).said||"").trim();
  return t?FLASH_SAY_A+t+FLASH_SAY_B:null;
};
const flashSaid=()=>{try{return localStorage.getItem("null_flash_said")==="1"}catch(e){return true}};
const markFlashSaid=()=>{try{
  localStorage.setItem("null_flash_said","1");
  return flashSaid();
}catch(e){return false}};

const loadFirstMet=()=>{try{
  const v=localStorage.getItem("null_first");
  if(v==="jaeeon"||v==="minhyun")return v;
  const g=JSON.parse(localStorage.getItem("null_getcha"))||[];
  return g[0]==="jaeeon"||g[0]==="minhyun"?g[0]:null;
}catch(e){return null}};
const saveFirstMet=id=>{try{
  if((id==="jaeeon"||id==="minhyun")&&!localStorage.getItem("null_first"))
    localStorage.setItem("null_first",id);
}catch(e){}};
/* 아직 안 만난 쪽. 오프닝 상대를 모르면 null이다 */
const unmetOne=()=>{const f=loadFirstMet();
  return f==="jaeeon"?"minhyun":f==="minhyun"?"jaeeon":null};

const loadSys1=()=>{try{return localStorage.getItem("null_sys1")==="1"}catch(e){return false}};
/* ── get cha ──
   첫 만남이 끝나면 그 사람의 메신저가 생긴다. 판마다 사람마다 한 번뿐이라
   저장소에 적어둔다 — 새로고침으로 다시 뜨면 사건이 아니라 알림이 된다.
   null_wipe로 판을 새로 열면 이것도 같이 비워진다(저장소를 통째로 지운다). */
const loadGetcha=id=>{try{
  return (JSON.parse(localStorage.getItem("null_getcha"))||[]).includes(id);
}catch(e){return false}};
const saveGetcha=id=>{try{
  const a=JSON.parse(localStorage.getItem("null_getcha"))||[];
  if(!a.includes(id)){a.push(id);localStorage.setItem("null_getcha",JSON.stringify(a))}
  return true;
}catch(e){return false}};
const saveSys1=()=>{try{localStorage.setItem("null_sys1","1")}catch(e){}};
/* 남은 날·지난 날. 둘 다 foreground에서 찍힌 접속 일차 하나에서 나온다. */
const daysLeft=store=>Math.max(0,ENROLL_DAYS+loadExtend()-worldDaysOf(store));
/* 세계를 실제로 연 05시 기준일 수. 단계와 해금의 day 조건이 이걸 같이 본다 */
const daysSince=store=>worldDaysOf(store);
/* D-0에 실제로 접속해 그 일차가 찍힌 현실 epoch. 아직 D-0에 닿지 않았으면
   미래 시각을 지어내지 않고 0이다. 연장 판은 두 번째 D-0(60)을 본다. */
const leaveTsOf=store=>{
  return accessMilestoneAt(ENROLL_DAYS+loadExtend());
};
/* 떠난 뒤에 유저가 다시 말을 걸었나. 유저 발화만 센다 */
const cameBackAt=store=>{
  const leaveAt=leaveTsOf(store);
  return !!leaveAt && Object.values((store&&store.msgs)||{}).flat()
    .some(m=>m&&m.sender==="user"&&m.ts>=leaveAt);
};
/* 그 말풍선이 찍힌 날의 D-일차. 가방이 「받은 날」을 이걸로 적는다 */
const dLeftAt=(store,ts)=>{
  if(!firstTsOf(store)||!ts)return null;
  const gone=accessElapsedAt(store,ts);
  return Math.min(ENROLL_DAYS,Math.max(0,ENROLL_DAYS-gone));
};
/* ── 이름이 불린 횟수 ──
   유저는 NULL이다. 빈칸으로 있다가 이름이 불릴 때마다 한 칸씩 채워진다.
   글자 하나에 CALL_PER_LETTER번. 센 것은 캐릭터가 한 말 속의 이름뿐이다 —
   유저가 자기 이름을 쓰는 건 호명이 아니다. */
const CALL_PER_LETTER = 4;
const countCalls=(store,name)=>{
  if(!name)return 0;
  let n=0;
  Object.values((store&&store.msgs)||{}).forEach(ms=>(ms||[]).forEach(m=>{
    if(!m||m.sender==="user"||!m.text)return;
    let i=0;
    while((i=m.text.indexOf(name,i))>=0){n++;i+=name.length}
  }));
  return n;
};
const filledLetters=(calls,name)=>Math.min((name||"").length,Math.floor(calls/CALL_PER_LETTER));

const ROOMS = [
  {id:"jaeeon", name:"이재언", color:"#7FD8D8", type:"dm",    sub:"보건교사",   empty:"보건교사, 29세"},
  {id:"minhyun",name:"이강현", color:"#FF9E80", type:"dm",    sub:"3학년",      empty:"고등학생, 20세"},
  {id:"group",  name:"단톡방", color:"#B8A5E3", type:"group", sub:"group chat", empty:"loading..."},
  {id:"health", name:"두 사람", color:"#9aa3d8", type:"watch", sub:"LIVE cam",  empty:"access denied"},
];
const roomOf = id => ROOMS.find(r=>r.id===id);

/* ── 그림 판 번호 ──
   그림은 파일 이름이 안 바뀐 채 내용만 바뀐다. 사물함을 새 원화로 갈아끼웠는데
   화면에는 옛 사물함이 그대로 떴다 — 브라우저가 같은 이름의 옛 파일을 계속
   쓴 것이다. index.html이 갈라진 파일에 붙이는 ?v= 와 같은 번호를 그림에도
   붙인다. 번호가 갈리면 시험이 잡는다. */
const AV="?v=274";
const av=s=>s?s+AV:s;

/* 사진: 백엔드가 보내는 key ↔ 실제 파일(key.webp). 목록에 없는 key는 무시한다. */
const PHOTO_FILES={};
Object.values(CHARS).forEach(c=>c.gallery.forEach(f=>{PHOTO_FILES[f.replace(/\.webp$/,"")]=f}));
const photoSrc = k => (k&&av(PHOTO_FILES[k]))||null;

/* .hidden: 대화가 쌓이면 백엔드가 해금해준다 */
/* .hidden — room/at은 worker.js의 UNLOCKS와 같아야 한다.
   어긋나면 화면에 표시되는 "N번 남음"이 실제 해금 시점과 달라진다. */
const HIDDEN=[
  /* 첫 쌍만 날짜를 안 본다(day:0). 열두 마디는 첫날에도 채울 수 있다 —
     사흘을 기다려야 첫 칸이 열리면 그때까지 이 탭은 잠긴 상자 열여덟 개이고,
     무엇을 모으는 탭인지 알 길이 없다. 하나가 열려야 나머지가 목표가 된다.
     뒤쪽 넷은 23·24·25·26일에 하루 간격으로 몰려 있었다. 마지막 나흘에
     여덟 개가 한꺼번에 터지면 하나씩 읽히지 않고 무더기로 지나간다.
     17·20·23·26으로 벌려서 사흘에 하나씩 오게 했다 — 일기와 상담 기록이
     늦게 나와야 하는 것은 맞지만, 늦는 것과 몰리는 것은 다르다.
     마지막 칸은 26일 그대로다. 떠나기 나흘 전에 마지막 장이 열린다. */
  {key:"jaeeon-bag",             file:"jaeeon-bag.webp",             label:"재언의 가방", room:"jaeeon", at:12, day:0},
  {key:"minhyun-bag",            file:"minhyun-bag.webp",            label:"강현의 가방", room:"minhyun", at:12, day:0},
  {key:"jaeeon-room",            file:"jaeeon-room.webp",            label:"재언의 방", room:"jaeeon", at:26, day:3},
  {key:"minhyun-room",           file:"minhyun-room.webp",           label:"강현의 방", room:"minhyun", at:26, day:3},
  {key:"jaeeon-playlist",        file:"jaeeon-playlist.webp",        label:"재언의 플레이리스트", room:"jaeeon", at:44, day:6},
  {key:"minhyun-playlist",       file:"minhyun-playlist.webp",       label:"강현의 플레이리스트", room:"minhyun", at:44, day:6},
  {key:"jaeeon-ticket",          file:"jaeeon-ticket.webp",          label:"재언의 티켓", room:"jaeeon", at:64, day:9},
  {key:"minhyun-ticket",         file:"minhyun-ticket.webp",         label:"강현의 티켓", room:"minhyun", at:64, day:9},
  {key:"jaeeon-yearbook",        file:"jaeeon-yearbook.webp",        label:"재언의 졸업사진", room:"jaeeon", at:90, day:13},
  {key:"minhyun-yearbook",       file:"minhyun-yearbook.webp",       label:"강현의 졸업사진", room:"minhyun", at:90, day:13},
  {key:"hidden-jaeeon-diary-200x-03-07", file:"hidden-jaeeon-diary-200x-03-07.webp", label:"재언의 일기 · 3월 7일", room:"jaeeon", at:100, day:17},
  {key:"hidden-minhyun-counseling-record-1-a4", file:"hidden-minhyun-counseling-record-1-a4.webp", label:"강현 상담 기록 · 1", room:"minhyun", at:100, day:17},
  {key:"hidden-jaeeon-diary-200x-04-12", file:"hidden-jaeeon-diary-200x-04-12.webp", label:"재언의 일기 · 4월 12일", room:"jaeeon", at:106, day:20},
  {key:"hidden-minhyun-counseling-record-2-a4", file:"hidden-minhyun-counseling-record-2-a4.webp", label:"강현 상담 기록 · 2", room:"minhyun", at:106, day:20},
  {key:"hidden-jaeeon-diary-201x-07-11", file:"hidden-jaeeon-diary-201x-07-11.webp", label:"재언의 일기 · 7월 11일", room:"jaeeon", at:112, day:23},
  {key:"hidden-minhyun-sns-1", file:"hidden-minhyun-sns-1.webp", label:"@mhy.wav · 1", room:"minhyun", at:112, day:23},
  {key:"hidden-jaeeon-diary-202x-start", file:"hidden-jaeeon-diary-202x-start.webp", label:"재언의 일기 · 202X년", room:"jaeeon", at:116, day:26},
  {key:"hidden-minhyun-sns-2", file:"hidden-minhyun-sns-2.webp", label:"@mhy.wav · 2", room:"minhyun", at:116, day:26},
];
const HIDDEN_LABEL={};HIDDEN.forEach(h=>{HIDDEN_LABEL[h.key]=h.label});

/* ── ⑥ 히든 제목 빈칸 ──
   잠긴 칸에 적힌 □는 원래 「몇 글자짜리 이름인가」만 알려주는 표시였다.
   이제 그 자리에 커서가 선다. 제목을 그대로 쳐서 맞히면 그 칸이 열린다.

   퀴즈가 아니다. 맞았다고 알려주는 화면도, 틀렸다고 말해주는 화면도 없다 —
   열린 칸이 그 자체로 답이다. 그래서 여기 있는 것은 판정 하나뿐이다.

   띄어쓰기와 가운뎃점은 안 본다. 몇 글자인지는 □가 이미 말해줬으므로
   막히는 것은 낱말이어야지 서식이면 안 된다.

   판정도 값도 이 기기에서 끝난다. 제목은 이미 클라이언트에 다 있고
   서버로 보낼 것이 없다 — 「맞혔는지」를 물어볼 데가 없다. */
const HID_MAX=24;
const hidMask=label=>(label||"").split("").map(c=>c===" "?" ":"□").join("");
const hidNorm=s=>(s||"").toString().toLowerCase().replace(/[\s·.,'"“”’!?]/g,"");
const hidGuess=(key,text)=>{
  const label=HIDDEN_LABEL[key];
  if(!label)return false;
  const t=hidNorm(text);
  return !!t&&t===hidNorm(label);
};

/* ── ⑧ 선물 빈칸 ──
   자유 노트가 아니라 틀이다. 유저가 채우는 것은 「받고 어떻게 되면
   좋겠는가」 하나뿐이고 나머지 글자는 고정이다 — 반응 방향이 주어지면
   인물이 안 보이는 세부(내용물·글씨·곡목록)를 지어낼 이유가 사라진다.

   인물에게 가는 것은 조립된 문장 한 줄이다. 빈칸 값만 보내면 쪽지에
   「웃으」라고만 적힌다. */
const GIFT_WISH_MAX=24;
const GIFT_NOTE_A="이걸 받고 ", GIFT_NOTE_B="면 좋겠어! (*ˊᵕˋ*)੭ ੈ 💝";
const giftNote=w=>{
  const t=(w||"").toString().trim().slice(0,GIFT_WISH_MAX);
  return t?GIFT_NOTE_A+t+GIFT_NOTE_B:"";
};

/* 선물 — 장바구니에서 검색해 인물에게 보낸다.
   보내고 나면 그때부터 그 인물의 프로필 배경이 될 수 있다.
   tags는 검색어다. 한글과 영어를 같이 넣어둔다 — 뭐라고 칠지 모르니까.
   bg 파일이 아직 없어도 괜찮다. useBg가 기존 배경으로 돌려준다. */
const GIFTS=[
  {key:"mug",       name:"회색 머그컵",  bg:"gift-mug.webp",  cat:"소품", cost:2, badge:"NEW",
   say:"usage : every morning ♡",
   tags:"머그 머그컵 컵 커피 회색 무광 아침 소품 mug cup coffee grey"},
  {key:"photobook", name:"사진집",       bg:"gift-photobook.webp", cat:"기록", cost:5,
   say:"archive : winter only ✧",
   tags:"사진집 사진 책 겨울 풍경 전시 미술관 기록 photo book winter"},
  {key:"beanie",    name:"남색 비니",    bg:"gift-beanie.webp", cat:"옷", cost:3,
   say:"hair status : hidden",
   tags:"비니 모자 니트 남색 겨울 옷 beanie hat knit navy"},
  {key:"earphone",  name:"유선 이어폰",  bg:"gift-earphone.webp", cat:"소품", cost:4, badge:"HOT",
   say:"audio link : one side for u ♪",
   tags:"이어폰 유선 음악 노래 소품 earphone earphones wired music"},
];
/* bg가 있는 것만 프로필 배경이 된다. 없는 것은 주고 반응만 받는다 —
   사진이 필요 없으므로 얼마든지 늘릴 수 있고, 덕분에 배경까지 바뀌는
   네 개가 오히려 특별해진다. */
GIFTS.push(
  {key:"hotpack", name:"핫팩",        cat:"소품", cost:1,
   say:"temperature : rising...",
   tags:"핫팩 손난로 겨울 따뜻 소품 hotpack warm"},
  {key:"umbrella", name:"접이식 우산", cat:"소품", cost:3,
   say:"rain protocol : ready",
   tags:"우산 비 장마 접이식 소품 umbrella rain"},
  {key:"hanky",   name:"손수건",      cat:"소품", cost:2,
   say:"tear log : not found ♡",
   tags:"손수건 수건 천 소품 handkerchief cloth"},
  {key:"camera",  name:"필름 카메라",  cat:"소품", cost:6,
   say:"shots remaining : 24",
   tags:"카메라 필름 사진 소품 camera film"},
  {key:"scarf",   name:"목도리",      cat:"옷",   cost:4,
   say:"warmth level : protected",
   tags:"목도리 머플러 겨울 옷 scarf muffler"},
  {key:"gloves",  name:"장갑",        cat:"옷",   cost:3,
   say:"pair status : L / R complete",
   tags:"장갑 손 겨울 옷 gloves"},
  {key:"bandana", name:"파란 반다나",  cat:"옷",   cost:2,
   say:"blue marker : equipped ✧",
   tags:"반다나 손목 파랑 파란 옷 bandana wrist blue"},
  {key:"candy",   name:"목캔디",      cat:"간식", cost:1,
   say:"voice status : recovering...",
   tags:"목캔디 사탕 캔디 간식 candy throat"},
  {key:"ramen",   name:"컵라면",      cat:"간식", cost:1,
   say:"meal mode : after class",
   tags:"컵라면 라면 야식 간식 ramen noodle"},
  {key:"coffee",  name:"드립백 커피",  cat:"간식", cost:2,
   say:"boot sequence : coffee first",
   tags:"커피 드립백 원두 아침 간식 coffee drip"},
  {key:"letter",  name:"편지지",      cat:"기록", cost:2,
   say:"input field : waiting for u ♡",
   tags:"편지지 편지 종이 기록 letter paper"},
  {key:"mixcd",   name:"믹스 CD",     cat:"기록", cost:3,
   say:"playlist : 12 untitled tracks ♪",
   tags:"CD 시디 믹스 음악 노래 기록 mix music"},
);
const GIFT_CATS=["전체","소품","옷","간식","기록"];
/* 칸 이름은 데이터에 한글로 박혀 있다(GIFTS·ITEMS의 cat). 화면에만 영어를
   씌운다 — 데이터를 바꾸면 이미 저장된 가방과 앱 쪽 표가 같이 어긋난다.
   선물과 가방이 같은 표를 본다. 한쪽만 고치면 두 창의 말이 갈린다. */
const CAT_EN={"전체":"ALL","소품":"STUFF","옷":"WEAR","간식":"SNACK","기록":"TRACE"};
/* 받는 사람이 어떻게 받을지 미리 한 줄. 고를 때만 보인다 — 스포일러가 아니라 결의 예고다. */
/* ♡ — 주고받은 말에서 나온다. 열 마디에 하나. 쓴 만큼 깎인다.
   따로 버는 화면을 만들지 않는 이유: 대화가 곧 재화여야 이 앱의 이야기와 맞는다. */
const HEART_PER=10;
const heartsOf=(store,gifts)=>{
  const said=["jaeeon","minhyun","group"].reduce((n,r)=>n+((store.msgs&&store.msgs[r])||[]).length,0);
  const spent=Object.values(gifts||{}).flat()
    .reduce((n,k)=>n+((GIFTS.find(g=>g.key===k)||{}).cost||0),0);
  return Math.max(0,Math.floor(said/HEART_PER)-spent);
};
const GIFT_NAME={};GIFTS.forEach(g=>{GIFT_NAME[g.key]=g.name});
/* 받은 선물이 배경으로 걸리기 시작하는 단계. 그 전에는 받아두기만 한다 —
   주자마자 걸리면 사는 것이지 관계가 아니다. 숫자 하나만 고치면 조절된다. */
const GIFT_AT=2;
const loadGifts=()=>{try{return JSON.parse(localStorage.getItem("null_gifts"))||{}}catch(e){return{}}};
const saveGifts=g=>{try{localStorage.setItem("null_gifts",JSON.stringify(g));return true}catch(e){return false}};
const loadUnlocked=()=>{try{return JSON.parse(localStorage.getItem("null_unlocked"))||[]}catch(e){return[]}};
const saveUnlocked=a=>{try{localStorage.setItem("null_unlocked",JSON.stringify(a));return true}catch(e){return false}};
/* 프로필을 마지막으로 본 단계. 지금 단계가 이보다 높으면 목록에 표시가 붙는다. */
const loadSeenStage=()=>{try{return JSON.parse(localStorage.getItem("null_seen_stage"))||{}}catch(e){return{}}};
const saveSeenStage=o=>{try{localStorage.setItem("null_seen_stage",JSON.stringify(o))}catch(e){}};

/* 색 유틸: hex → rgba */
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};

/* localStorage */
const loadStore=()=>{try{const s=JSON.parse(localStorage.getItem("null_store_v1"));if(s&&s.msgs)return{msgs:s.msgs,unread:s.unread||{}}}catch(e){}return{msgs:{},unread:{}}};
/* ── 저장은 성공했는지 말해야 한다 ──
   저장 공간이 차면 setItem이 던진다. 전에는 그걸 삼키고 아무 일 없다는 듯
   다음으로 갔다 — 그래서 「장면은 소모됐는데 답은 없는」 상태가 저장 실패
   하나로 다시 만들어졌다. 부르는 쪽이 알아야 멈출 수 있다. */
const saveStore=s=>{try{localStorage.setItem("null_store_v1",JSON.stringify(s));return true}catch(e){return false}};
const loadProfile=()=>{try{return JSON.parse(localStorage.getItem("null_profile"))||{}}catch(e){return{}}};

/* 시간 포맷 */

/* ── 데모 모드 ──
   키가 없거나 API가 죽어도 빈 화면을 보여주지 않는다. 각본이라도 움직이는 편이 낫다.
   ?demo=1 로 켜지면 계속 데모다. 그게 아니면 실패한 턴만 각본으로 메우고
   다음 전송에서 진짜를 다시 시도한다 — 전에는 한 번 실패하면 세션 내내
   데모였다. 429 한 번에 그 뒤의 모든 대화가 조용히 각본이 됐고, 며칠 쌓인
   세이브를 가진 사람에게 그건 구조가 아니라 사고다. auto는 「지난 호출이
   실패했다」는 표시일 뿐이고 성공하면 꺼진다.
   실패 원인은 콘솔에 그대로 남기고 하단 바에 demo 표시가 뜬다 — 조용히 가짜로
   바뀌면 진짜 장애를 못 알아채기 때문이다.

   대사와 매칭은 demo-lines.js에 있다. 그 파일은 docs/dialogue-corpus.md에서
   만들어진다 — 대사를 고칠 때는 문구집을 고치고 node tools/build-demo.mjs를 돌린다.
   앱도 같은 파일을 쓴다(app/lib/demoLines.ts). 한쪽만 고쳐질 일이 없다. */
/* 데모는 ?demo=1로 고른 것만이다. 실패해서 자동으로 넘어가는 길(auto)은 없앴다 —
   실패를 각본으로 메우면 잠긴 것도 키가 죽은 것도 한도가 바닥난 것도
   전부 「잘 되는 중」으로 보인다. */
const DEMO={on:new URLSearchParams(location.search).has("demo")};
/* ── 지금은 깨어 있는 걸로 친다 ──
   자는 시간에 붙잡고 고쳐볼 일이 있다. ?awake면 둘 다, ?awake=jaeeon이면
   그 사람만 자는 시간을 건너뛴다. 주소에 붙였을 때만 돌아서 평소에는 없다.
   점에는 「깨워둠」이라고 적는다 — 이게 진짜 시계가 아니라는 걸 보이게. */
const AWAKE=(()=>{
  const q=new URLSearchParams(location.search);
  if(!q.has("awake"))return null;
  const w=(q.get("awake")||"").trim();
  return w?w.split(",").map(x=>x.trim()).filter(Boolean):"all";
})();
const forcedAwake=id=>AWAKE==="all"||(Array.isArray(AWAKE)&&AWAKE.includes(id));
const demoOn=()=>DEMO.on;
/* 가까워졌는지. 셀카를 줄지 말지가 여기서 갈린다 — 처음부터 주면
   그건 셀카가 아니라 프로필 사진이다. 균열 단계(40마디)를 기준으로 삼는다. */
/* 대화가 얼마나 쌓였는지는 App 안에만 있다. 여기서 바로 못 읽으므로 받아서 쓴다 —
   모듈 바깥에서 App 안의 것을 참조하면 부를 때마다 터진다. 한 번 그랬다. */
const demoClose=(msgs,room)=>((((msgs||{})[room])||[]).length)>=40;
const demoReply=(bucket,lastText,userName,msgs,gift)=>
  demoAnswer(bucket,lastText,userName,{close:demoClose(msgs,bucket),gift:gift});
/* 해금은 원래 서버가 세어서 내려준다. 데모에는 서버가 없으니 같은 기준으로
   여기서 센다 — 안 그러면 .hidden이 영영 0/12로 남는다. */
const demoUnlocked=msgs=>{const d=daysSince({msgs});return HIDDEN.filter(h=>(((msgs||{})[h.room]||[]).length)>=h.at&&d>=h.day).map(h=>h.key)};
/* 문구집에 물어볼 말. 유저가 방금 친 말이다. 시스템 줄("…을(를) 받았다")은
   유저가 한 말이 아니라서 그대로 넘기면 아무것도 안 걸린다. */
const demoAsk=payload=>{
  const last=[...(payload.history||[])].reverse().find(m=>m.role==="user");
  return last&&last.content;
};
/* 선물은 말이 아니라 물건이다. 이름을 문장으로 꾸며 매칭에 태우면
   "회색 머그컵 선물이에요"가 아무 데도 안 걸려서 못 알아들었다는 답이 나갔다.
   열쇠를 그대로 넘겨 표에서 바로 찾는다. */
const demoGiftKey=payload=>(payload.gift&&payload.gift.key)||null;

/* ── 화면은 세계의 시각을 말한다 ──
   저장된 ts는 현실 epoch지만, 그리는 순간 gameAt으로 번역한다. 프롬프트와
   시간표는 게임 시각을 보는데 화면만 진짜 시각을 찍으면 — 인물은 「저녁이네요」
   하는데 말풍선 옆에는 오후 두 시가 붙는, 화면이 거짓말하는 그림이 됐다.
   리얼 모드에서는 번역이 항등이라 아무것도 안 변한다. */
const fmtClock=ts=>{const d=gameAt(ts);const h=d.getHours(),ap=h<12?"오전":"오후";return `${ap} ${h%12||12}:${String(d.getMinutes()).padStart(2,"0")}`};
/* 「오늘」도 세계의 오늘이다 — 진짜 달력과 견주면 게임 하루가 넷으로 쪼개진다 */
const isToday=ts=>gameAt(ts).toDateString()===nowClock().toDateString();
const fmtDivider=ts=>{const d=gameAt(ts);return isToday(ts)?fmtClock(ts):`${d.getMonth()+1}월 ${d.getDate()}일 ${fmtClock(ts)}`};

/* 괄호만으로 된 말풍선은 대사가 아니라 행동 지문이다 — 말풍선 대신 채팅창에 쳐진 줄로 그린다.
   서버가 줄 단위로 갈라서 보내주므로 여기서는 통째로 괄호인지만 보면 된다. */
/* 지문처럼 그릴 줄: 괄호로만 된 대사, 그리고 선물처럼 "일어난 일"을 적은 sys 줄 */
const isNarr=m=>!!m&&!m.photo&&(m.sys===true||/^[（(][^()（）]*[)）]$/.test((m.text||"").trim()));
const fmtListTime=ts=>{const d=gameAt(ts);return isToday(ts)?fmtClock(ts):`${d.getMonth()+1}월 ${d.getDate()}일`};
const MON=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const fmtDay=ts=>{const d=gameAt(ts),y=d.getFullYear();
  return `${MON[d.getMonth()]} ${d.getDate()}`+(y!==nowClock().getFullYear()?", "+y:"")};
/* 시간 구분선의 「한참 지났다」도 세계의 십 분이다. 진짜 십 분으로 재면
   스피드 모드에서 게임 사십 분이 소리 없이 지나간다 */
const dividerGap=(prevTs,ts)=>!prevTs||gameAt(ts).getTime()-gameAt(prevTs).getTime()>10*60*1000;

/* ── 지금이 언제인가 ──
   몇 시인지는 안 보낸다. 분 단위를 주면 「7시 42분이네요」 같은 말이 나온다.
   때만 준다. presence와 같은 시계를 봐야 한다 — 방 목록에는 「야자」라고
   떠 있는데 인물은 아침인 줄 알고 말하면 그게 제일 이상하다.
   서버에서 재면 안 된다. 워커는 UTC로 돌고 어느 엣지에 뜨는지도 그때그때다. */
const timeWord=now=>{const h=(now||nowClock()).getHours();
  return h<2?"밤":h<6?"새벽":h<11?"아침":h<17?"낮":h<21?"저녁":"밤"};
/* 요일은 때보다 세다. 주말이면 학교가 통째로 없어지고, 그러면 이 셋을
   묶고 있던 건물이 사라진다 — 만나려면 학교 밖으로 나가야 한다 */
const dayWord=now=>"일월화수목금토"[(now||nowClock()).getDay()]+"요일";
/* ── 계절 ──
   요일과 때만 보내고 계절을 안 보냈다. 그래서 팔월에 「눈이 그제보다 덜
   오네요」가 나왔다. 날씨는 인물이 창밖을 보면 바로 나오는 말이라, 안
   알려주면 지어낸다. 달까지는 안 준다 — 「8월 18일」을 주면 날짜를 세기
   시작한다. 계절 하나면 창밖 얘기는 안 틀린다.

   달력에서 뽑던 것을 겨울로 못박는다. 팔월에 계절을 보내는데도 눈이 여섯 번
   왔다. 필터가 진 게 아니라 세계가 겨울로 쓰여 있어서다 — 세계관 첫 줄이
   「겨울이 끝나가는 시점」이고, 긴 겨울·눈 온 날 사진·장갑·목도리·핫팩·
   비니가 전부 그 계절 소품이다. 그 앞에서 가변부 끝의 낱말 하나가 이길
   수 없다. 이 세계의 시계는 하루와 요일만 돌고 계절은 안 돈다. */
const seasonWord=()=>"겨울";
/* ── 자는 사람은 먼저 말을 안 건다 ──
   새벽 세 시에 앱을 처음 켜면 둘 다 몇 초 안에 인사를 보냈다. 목록에는
   「자는 중」이라고 떠 있는데 그 사람 말풍선이 왔다.
   그리고 이 앱은 유저가 없어도 세계가 돌아간다고 말하는 앱인데, 켜자마자
   둘이 인사하면 돌아가고 있던 게 아니라 기다리고 있던 게 된다.

   전에는 재언만 여섯 시로 못박은 상수를 따로 두고 강현은 시각을 안 봤다.
   그런데 강현에게도 꺼진 시간(3~8시)이 생겼다 — 점은 「꺼짐」인데 그 사람
   말풍선이 오면 처음 고치려던 그림 그대로다. 시계를 둘 두지 않는다.
   목록의 점을 정하는 presence가 선톡도 정한다 — off면 안 건다.
   재언은 여섯 시에 깨니(1~6시 off) 예전과 같은 시각에 인사가 온다.

   그래서 새벽에 시작한 사람은 첫 화면에서 두 가지를 공짜로 안다 —
   한 명은 이 시간에 깨 있는 애고 한 명은 자는 어른이라는 것,
   그리고 내가 켠다고 이 세계가 다 깨어나지는 않는다는 것. */
const canGreet=(id,now)=>{
  const pr=presence(id,now);
  return !pr||pr.s!=="off";
};
/* ── 자는 사람은 답이 없다 ──
   같은 시계(presence)의 off를 반대쪽에서도 본다. 먼저 안 거는 것만으로는
   모자랐다 — 밤에 말을 걸면 답은 꼬박꼬박 왔고, 대신 재언이 「자요, 이제」를
   서른세 분에 열다섯 번 말했다. 끝내려는 사람이 끝낼 수가 없었던 것이다.
   무슨 말을 걸든 반드시 답이 오는 세계에는 「답하지 않는다」는 수가 없어서,
   대화를 닫으려는 인물이 같은 말을 반복하는 것 말고 할 수 있는 게 없었다.

   그래서 자는 시간에는 부르지 않는다. 보낸 말은 그대로 남고, 깨어난 뒤의
   대화에 이력으로 실려 간다 — 밤새 쌓인 말을 아침에 읽은 사람이 된다.
   호출을 아예 안 하므로 비용도 안 나간다. */
const asleep=(id,now)=>{
  const pr=presence(id,now);
  return !!pr&&pr.s==="off";
};
/* 이 방 사람이 다 자고 있나. 단톡방은 한 사람만 깨 있어도 답이 온다 —
   그 방에서 자는 쪽의 말풍선은 워커가 지운다(states를 보고). */
const allAsleep=(room,now)=>(room==="group"?["jaeeon","minhyun"]:[room])
  .every(id=>asleep(id,now));
/* 관전방은 둘이 마주 앉은 자리다. 한 사람만 자도 그 대화는 없던 일이므로
   여기는 allAsleep(둘 다)이 아니라 어느 한쪽이라도 자면 막는다.
   재언이 자는데 「두 사람」방에서는 떠들고 있었다 — 목록에는 「자는 중」이
   떠 있는 사람이 옆방에서 말을 하고 있으면 그 점이 거짓말이 된다.
   재는 시각은 지금이 아니라 그 대화가 찍힐 시각이다. 관전 대화는 유저가
   자리를 비운 한 시간쯤 뒤로 거슬러 찍히므로, 지금 깨어 있는지가 아니라
   그때 깨어 있었는지를 봐야 한다. */
const bothAwake=now=>!asleep("jaeeon",now)&&!asleep("minhyun",now);

/* ── 첫 자리 ──
   전에는 앱을 켜면 둘이 인사를 보내는 걸로 시작했다. 그건 알림이지 만남이 아니다.
   지금은 시작한 시각이 첫 자리를 정한다. 거기서 한 사람을 만나고, 다른 한 사람은
   첫인사를 보낸다 — 그래서 첫 화면에서 이미 둘의 시간대가 갈린다.

   시간 경계는 timeWord와 같다(새벽 2·아침 6·낮 11·저녁 17·밤 21). 화면에
   「저녁」이라고 떠 있는데 아침 자리에서 시작하면 그게 제일 이상하다.
   딱 하나 19시만 timeWord에 없는 경계다 — 저녁 띠를 둘로 갈랐다.
   퇴근하고 바로 잡히는 자리(정류장)와, 한 번 들렀다 가는 자리(도서관)는
   같은 「저녁」이라도 시각이 다르다. 화면의 시간대 표시는 어차피 둘 다
   「저녁」이라 어긋나 보이지 않는다.

   note는 지문이다. 왜 거기 있는지 한 줄로 적어준다 — 손을 베였다거나 동전이
   없다거나. 대사가 아니라 상황이라 여기 있어도 된다.
   골목과 정류장은 지도에 없는 자리다. 귀갓길과 같은 길로 들어간다.
   첫 자리는 열려 있는 시간을 안 본다 — 고른 자리가 아니라 정해진 자리라서. */
const OPENINGS=[
  /* 새벽. 라면 하나 놓고 마주 앉는다 */
  {from:2,  place:"편의점",     room:"minhyun", note:"라면을 먹으러 편의점에 들렀다."},
  /* 아침. 등굣길에 지나는 골목에서 마주친다 — 처음 만난 자리는 병원 옥상이다 */
  {from:6,  place:"후문 골목",   room:"minhyun", bg:"minhyun-alley.webp",
   note:"후문 골목으로 들어섰다."},
  /* 낮. 제 발로 간 게 아니라 손을 베여서 내려온 것이다 */
  {from:11, place:"보건실",     room:"jaeeon",  note:"손을 베여 보건실에 내려왔다."},
  /* 저녁 앞. 퇴근길에 붙잡힌다 */
  {from:17, place:"버스정류장",  room:"minhyun", bg:"minhyun-busstop.webp",
   note:"퇴근길 버스정류장에 섰다."},
  /* 저녁 뒤. 곧장 집에 안 가고 들른 데다. 도서관은 22시까지 열려 있고
     삼 층은 늘 비어 있다 — 퇴근한 사람이 혼자 있기 좋은 자리라서.
     도서관은 wendOnly다. 그건 유저가 지도에서 골라 가는 것에 대한 규칙이고
     (「평일엔 못 간다 — 둘 다 학교에 매여 있고」), 첫 자리는 고른 자리가
     아니다. 그리고 19시면 재언은 이미 퇴근해서 매여 있지 않다.
     answerMove가 wendOnly를 안 보는 것과 같은 예외다. */
  {from:19, place:"도서관",     room:"jaeeon",  note:"퇴근길에 도서관에 들렀다."},
  /* 밤. 동전이 없다 */
  {from:21, place:"빨래방",     room:"jaeeon",  note:"빨래방에 왔는데 동전이 없다."},
];
/* 주말엔 정해진 자리가 없다.
   평일은 시간표가 사람을 어디 있게 한다 — 여덟 시에 출근하고 네 시에 수업이
   끝나니까 그 시각엔 거기 있다. 주말은 그게 없어서 아무 데나 있을 수 있다.
   그래서 뽑는다. 그 시각에 열려 있는 자리 중에서 하나.
   학교 안 넷은 애초에 안 열린다(wend:false). 집은 뺐다 — 처음 만나는 날에
   남의 집에 가 있을 수는 없다. */
const WEND_OPEN=[
  {place:"편의점",    room:"minhyun", note:"라면을 먹으러 편의점에 들렀다."},
  {place:"도서관",    room:"jaeeon",  note:"도서관 삼 층에 올라왔다."},
  {place:"레코드샵",  room:"minhyun", note:"레코드샵 중고반 상자를 뒤졌다."},
  {place:"빨래방",    room:"jaeeon",  note:"빨래방에 왔는데 동전이 없다."},
  {place:"후문 골목",  room:"minhyun", bg:"minhyun-alley.webp",   note:"후문 골목으로 들어섰다."},
  {place:"버스정류장", room:"minhyun", bg:"minhyun-busstop.webp", note:"버스를 기다렸다."},
];
const openingFor=now=>{
  const d=now||nowClock(), h=d.getHours();
  if(isWend(d)){
    /* 지도에 없는 자리(골목·정류장)는 여는 시각이 없다. 늘 후보다 */
    const open=WEND_OPEN.filter(o=>{const p=PLACE_BY[o.place];return !p||placeHours(p,d)});
    if(open.length)return open[Math.floor(Math.random()*open.length)];
  }
  /* 21시부터 다음날 2시까지가 밤이다. 자정을 넘어가는 띠라 표에서 못 찾는다 */
  return OPENINGS.slice().reverse().find(x=>h>=x.from)||OPENINGS[OPENINGS.length-1];
};

/* ── 야자가 붙는 날 ──
   격주. 어느 주부터인지는 유저 사정이 아니라 학교 사정이라 달력으로 센다.
   야자는 2017년쯤 강제가 없어져서 희망자만 남는 자율학습이다 — 매일이
   아니라 유저가 감독으로 남는 격주 목요일에만 붙는다.

   시간표(daySlots)는 처음부터 그렇게 세고 있었는데 생활 리듬(presence)만
   평일 저녁을 통째로 「야자」라고 불렀다. 시계가 둘이면 AT_WORK가 그
   거짓말을 그대로 받는다 — 야자도 없는 수요일 저녁에 강현이 아직 학교에
   있는 것이 되어, 안 만난 쪽 방이 열리고 선톡이 나갔다. 한 군데서 센다.

   presence 바로 위에 둔다 — 시험이 presence를 떼어 돌릴 때 이 셋이 같이
   딸려 와야 한다(그래서 시험의 자르는 자리도 weekNo부터다). */
const weekNo=d=>Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5+3)/7);
const isYajaWeek=(now)=>weekNo(now||nowClock())%2===0;
const isYajaDay=(now)=>{const d=now||nowClock();return d.getDay()===4&&isYajaWeek(d)};

/* 수업 여부와 상단 시간표가 같은 칸을 본다. 이 표를 둘로 적으면 화면에는
   「쉬는시간」인데 교실은 여전히 CLASS 중인 것처럼 잠기는 틈이 생긴다. */
const PERIODS=[[520,570,1],[580,630,2],[640,690,3],[700,750,4],
               [810,860,5],[870,920,6],[930,980,7]];   // 분 단위 · 시작·끝·교시

/* ── 접속 상태 ──
   시간대만 보고 정한다. 서버를 부르지 않으므로 비용이 없다.
   재언은 근무 시간에 보건실에 있고, 강현은 학교에 매여 있다.
   이 값은 이제 워커에도 실린다(states) — 목록에는 「수업 중」이 떠 있는데
   본인은 한가한 사람처럼 즉답하던 것이 여기서 고쳐진다. 화면과 프롬프트가
   같은 함수를 봐야 둘이 딴말을 안 한다.
   주말엔 근무도 수업도 없다. 토요일 낮에 「보건실」「수업 중」이 떠 있었다 —
   시간표가 사람을 놓아주는 날이라 「주말」이 뜬다. 잠은 주말에도 잔다.
   isWend를 안 부르고 요일을 직접 본다 — 테스트가 이 함수만 떼어 돌린다. */
function presence(id, now){
  const d=now||nowClock(), h=d.getHours(), mm=h*60+d.getMinutes();
  const wend=d.getDay()===0||d.getDay()===6;
  /* ?awake로 깨워둔 사람은 자는 자리를 건너뛴다. 시험이 이 함수만 떼어
     돌리므로 그쪽에는 forcedAwake가 없다 — 없으면 없는 대로 잔다 */
  const up=typeof forcedAwake==="function"&&forcedAwake(id);
  const off=t=>up?{s:"away",t:"깨워둠"}:{s:"off",t};
  if(id==="jaeeon"){
    /* 네 시 반에 일어난다. 선톡(canGreet)이 이 창의 끝을 그대로 본다 —
       점은 「자는 중」인데 그 사람이 인사를 보내면 그게 처음 고치려던 그림이다.
       여섯 시였다. 그때는 세 시부터 여섯 시까지 둘 다 자는 세 시간이 있었고,
       그 시간에는 유저가 말 걸 사람이 아무도 없었다. 강현이 자러 가는 시각과
       맞물려 놓으면 한쪽이 자는 동안 다른 쪽이 깨 있다 — 이 세계에는 아무도
       없는 시간이 없어진다. 출근은 여덟 시라 세 시간 반은 집에 깨어 있다. */
    if(mm>=60&&mm<270) return off("자는 중");
    if(wend)        return {s:"on",  t:"주말"};
    if(h>=8&&h<17)  return {s:"on",  t:"보건실"};
    if(h>=17&&h<23) return {s:"away",t:"퇴근"};
    if(h>=23||h<1)  return {s:"away",t:"집"};
    return {s:"away",t:"집"};
  }
  if(id==="minhyun"){
    /* 네 시 반까지 깨 있다. 두 시로 잡아놨더니 새벽에 그가 먼저 말을 거는데
       목록의 점은 「꺼짐」이었다 — 재언 쪽을 맞춘 것과 같은 이유다.
       세 시였던 것을 재언이 일어나는 시각에 붙였다. 이 애가 자러 가는 순간
       삼촌이 일어난다 — 둘이 같이 자는 시간이 없다. */
    if(mm>=22*60||mm<270) return {s:"on",  t:"안 자는 중"};
    if(mm>=270&&mm<480)   return off("꺼짐");
    if(wend)        return {s:"on",  t:"주말"};
    /* 시간표(PERIODS)와 같은 시계를 본다. 12시 40분에 상태 버튼은 「점심」인데
       여기가 「수업 중」이면 교실이 점심에도 문틈으로 잠긴다 — 점심에 교실에서
       만나 옥상으로 가는 게 이 지도의 그림이다. 7교시(16:00~16:20)가 야자로
       새던 것도 분으로 세면 같이 잡힌다. */
    if(mm>=750&&mm<810) return {s:"away",t:"점심"};
    if(PERIODS.some(([a,b])=>mm>=a&&mm<b))return {s:"away",t:"수업 중"};
    if(mm>=PERIODS[0][0]&&mm<PERIODS[PERIODS.length-1][1])
      return {s:"away",t:"쉬는시간"};
    /* 7교시가 끝나면 야자가 있는 날만 학교에 남는다. 없는 날은 갈 데가
       없는 애가 밖에 있다 — 상태를 새로 만들지 않고 밤에 쓰던 것을 그대로
       쓴다. 어디 있다고 말하지 않는 말이라 이 애한테 맞고, AT_WORK가 아니라
       그 저녁에 편의점·빨래방에서 마주칠 수도 있게 된다. */
    if(isYajaDay(d)) return {s:"on",  t:"야자"};
    return {s:"on",  t:"안 자는 중"};
  }
  return null;
}

/* ── 관계 온도 ──
   단계 이름은 화면에 쓰지 않는다. 대놓고 쓰면 몰입이 깨진다 — 색으로만 말한다. */
// stageIdx로 색인한다 — STAGE_AT과 길이가 같아야 한다. 짧으면 마지막 단계에서 터진다.
const HEAT=[
  {w:1,  a:.28},   // 처음
  {w:1.5,a:.5 },   // 익숙
  {w:2,  a:.72},   // 균열
  {w:2.5,a:.88},   // 시한
  {w:3,  a:1  },   // 마지막 달
];
const heatRing=(ch,idx)=>({borderWidth:HEAT[idx].w+"px",borderStyle:"solid",
  borderColor:rgba(ch.dk,HEAT[idx].a)});

/* ── 🌙 관찰 쿨타임 ──
   관찰은 흔하면 값이 떨어진다. 연타로 새는 API 비용도 여기서 막힌다. */
const AUTO_COOL=5*60*1000;
/* 관전방 자동 채움 — 유저가 선물을 주거나 무언가 해금되면, 두 사람이 그 일을
   두고 이야기한다. 시계가 아니라 사건이 방아쇠다.
   다만 바로 만들지 않는다. 유저가 자리를 비운 지 한 시간쯤 지난 뒤의 일로 찍는다.
   같이 있는데 내 얘기를 하는 건 딴짓처럼 보이지만, 내가 나가고 한 시간 뒤면
   그건 내가 없는 자리에서 벌어진 일이다.
   서버 크론은 안 쓴다. 안 돌아올 사람 몫까지 미리 만들어 돈을 태우고, 지금
   백엔드는 유저별 저장소도 없다. 돌아왔을 때 만들고 시각을 과거로 찍으면
   화면에 보이는 결과는 같고 값은 돌아온 사람 수만큼만 든다. */
const AUTO_AWAY=60*60*1000;    // 이만큼 자리를 비운 뒤에 있었던 일로 찍는다
const AUTO_MAX_DAY=2;          // 하루 상한. 관전 프롬프트가 22,000자로 제일 비싸다
const loadAutoDay=()=>{try{return localStorage.getItem("null_auto_day")||""}catch(e){return""}};
const saveAutoDay=v=>{try{localStorage.setItem("null_auto_day",v)}catch(e){}};
/* 다녀온 자리 / 거절한 자리. 서버가 다음 제안을 고르는 근거다 */
/* ── 같이 간 자리 ──
   「같이 가기로 했다」를 메신저 화면 그대로 두면 둘이 마주 앉은 걸 그릴 방법이
   없다. 그래서 괄호 지문으로 때우다가 「이건 그냥 텍스트니까요」까지 갔다.
   자리에 가면 그 자리를 깔고 말풍선을 걷는다 — 화면이 「지금 여기 같이 있다」를
   대신 말해준다. 사진은 아래쪽이 다 어두워서 흰 글씨가 그냥 읽힌다. */

/* ── 지도 ──
   전에는 인물이 가자고 할 때만 자리가 열렸다. 그래서 「귀양 가는 기분」이라는
   말이 나왔다 — 가는 곳을 늘 저쪽이 정하니까. 지도는 반대다. 유저가 자리를
   고르고 누구를 부를지 정한다.

   ★ 대화 수나 날짜로는 안 열린다. 다녀와야 열린다.
   need에 적힌 자리를 다 다녀오면 열린다. 앉아서 말만 쌓아도 지도가 넓어지면
   그건 지도가 아니라 그냥 또 하나의 게이지다. 학교 안 둘에서 시작해
   학교 밖으로, 그 다음 사는 데로 — 발이 닿은 만큼만 넓어진다.

   who는 여기서 만날 수 있는 사람. 둘이면 고르게 한다.
   own은 그 자리가 원래 누구 자리인가. 재언은 보건실에 있는 게 일이고 강현은
   교실에 앉아 있다 — 「불러냈다」가 아니라 찾아가는 것이다. own이 없는 자리만
   따로 만나는 자리다.
   item은 그 자리에서 받는 것. ITEMS의 키이고 worker.js의 PLACE_ITEMS와 같아야 한다.
   bg가 없으면 배경 없이 열린다 — 사진이 아직 없는 자리도 막지는 않는다. */
/* ── 지도 두 장 ──
   교실·보건실·옥상은 한 건물 안의 방이고 편의점·도서관은 동네의 다른 지점이다.
   그걸 한 길에 나란히 세우니 교실에서 보건실 가는 길에 표지판이 서 있었다.
   길은 그대로 두되(START에서 문까지가 30일이다) 학교만 안이 있는 정거장으로
   만든다. 주말에 학교 셋이 같이 닫히던 것도 이제 아이콘 하나가 닫히면 된다. */
const PLACES=[
  /* ── 마을 길 ── 여섯 정거장. 학교가 첫 정거장이고 유일하게 안이 있다 */
  {name:"학교",     map:"town", into:"school", hours:[8,22], wend:false, icon:"school", need:[]},
  /* meet:"out" — 누가 있을지 정해두지 않는다. 그 시각에 밖에 나와 있을 수
     있는 사람 중에서 뽑는다. 약속하고 가는 게 아니라 마주치는 자리라서. */
  /* 편의점만 사다리 밖이다. 학교를 한 바퀴 돌아야(교실·보건실→옥상) 열리는
     자리였는데, 여기는 시간을 내서 가는 데가 아니라 지나다 들르는 데다 —
     meet:"out"인 자리에 해금을 걸면 「마주치는 자리」라는 설계와 어긋난다.
     사다리는 그대로 남는다: 레코드샵은 여전히 편의점을 딛고 열린다. */
  {name:"편의점",   map:"town", meet:"out", meetOther:true, bg:"place-conv.webp", icon:"conv", need:[],            who:["jaeeon","minhyun"], item:"haribo",
   note:"학교 뒷문에서 이 분."},
  /* wendOnly — 평일엔 못 간다. 둘 다 학교에 매여 있고, 여기는 들르는 데가
     아니라 시간을 내서 가는 데다. pick — 누구랑 갈지 고른다. */
  {name:"도서관",   map:"town", hours:[9,22],  wendOnly:true, pick:true,
   bg:"place-library.webp",  icon:"library", need:["옥상"],              who:["jaeeon","minhyun"], item:"book",
   note:"시립. 삼 층은 늘 비어 있다."},
  {name:"레코드샵", map:"town", hours:[12,21], wendOnly:true, pick:true,
   bg:"place-record.webp",   icon:"record",  need:["편의점"],            who:["jaeeon","minhyun"], item:"lp",
   note:"중고반 상자가 바닥에 있다."},
  {name:"빨래방",   map:"town", meet:"out", bg:"place-laundry.webp",  icon:"laundry", need:["도서관"],            who:["jaeeon","minhyun"], item:"coin",
   note:"건조기 도는 사십 분."},
  /* 마지막. 양쪽을 다 걸어봐야 열린다 — 한쪽만 파서 남의 집에 갈 수는 없다 */
  {name:"집",       map:"town", hours:[17,2], wend:[11,2], bg:"place-home.webp", icon:"home", need:["빨래방","레코드샵"], who:["jaeeon","minhyun"], own:"jaeeon", item:"key",
   note:"현관에 우산이 두 개."},
  /* ── 학교 안 ── 길이 아니라 건물이다. 그래서 표지판을 안 세운다 */
  {name:"교실",     map:"school", hours:[8,22], wend:false, bg:"place-class.webp",   icon:"class",   need:[],                 who:["minhyun"], own:"minhyun", item:"note",
   note:"네 자리는 창가 셋째 줄."},
  {name:"보건실",   map:"school", hours:[8,17], wend:false, bg:"place-nurse.webp",   icon:"nurse",   need:[],                 who:["jaeeon"],  own:"jaeeon",  item:"bandaid",
   note:"커튼 안쪽 침대 두 개."},
  /* 옥상은 둘 다 만나본 뒤에 열린다 — 학교에서 유일하게 둘 다 오는 자리라서 */
  /* 둘 다 오는 자리라 누구랑 갈지 유저가 고른다(pick). 안 물으면 코드가
     「말 많이 나눈 쪽」으로 대신 고르는데, 유저는 왜 그 사람이 왔는지 알
     길이 없다. 편의점·빨래방은 우연히 마주치는 자리라 안 묻는 게 맞지만
     여기는 시간 내서 가는 자리다. */
  {name:"옥상",     map:"school", hours:[8,22], wend:false, pick:true, bg:"place-rooftop.webp", icon:"rooftop", need:["교실","보건실"],  who:["jaeeon","minhyun"], item:"can",
   note:"문은 잠겨 있어야 하는데 안 잠겨 있다."},
  {name:"체육관",   map:"school", hours:[8,18], wend:false, bg:"place-gym.webp", icon:"gym",     need:["옥상"],           who:["minhyun"],          item:"wrist",
   note:"구석에 매트가 쌓여 있다."},
];
/* 갈 수 있는 자리만 센다 — 학교는 문이지 자리가 아니다 */
const SPOTS=PLACES.filter(p=>!p.into);
const PLACE_BG={};PLACES.forEach(p=>{if(p.bg)PLACE_BG[p.name]=p.bg});
const PLACE_BY={};PLACES.forEach(p=>{PLACE_BY[p.name]=p});
/* ── 캐비닛 ──
   길이던 지도를 사물함으로 바꾼다. 이 앱은 가짜 OS인데 지도만 혼자 야외
   일러스트였다. 창이 있고 메뉴바가 있고 .exe가 뜨는 화면에서는 서랍이
   길보다 자연스럽다 — 잠긴 자리도 자물쇠 아이콘이 아니라 안 열리는 문이 된다.

   여덟 칸. 4행 2열이고 좌표는 프레임 그림에서 칸 안쪽을 재서 넣었다.
   차례는 need를 그대로 따라간다 — 학교에서 시작해 편의점·도서관으로 갈라지고,
   레코드샵·빨래방을 지나 둘 다 걸어야 집이 열린다. 왼쪽 줄과 오른쪽 줄이
   각각 한 갈래다. 마지막 칸은 NULL 명패다. 유저가 채워야 하는 빈칸이라
   여기는 열고 닫을 것이 없다. */
/* 명패 둘은 갈 자리가 아니지만 누르면 한 마디 한다. 눌러도 아무 일이
   없는 칸이 여덟 중 둘이면 나머지도 안 눌러보게 된다.
   얼굴은 .kao로 따로 뺀다 — 픽셀 글꼴에 저 글자들이 없다 */
const CAB_SLOT=[
  {kind:"start", say:"NULL에게 닿기를", kao:"( ⸝⸝◡  ̫◡⸝⸝) 💕"}, {place:"학교"},
  {place:"편의점"}, {place:"도서관"},
  {place:"레코드샵"}, {place:"빨래방"},
  {place:"집"},   {kind:"null", say:"NULL 기다릴게", kao:"ʢ˶ > ₃ < ˶ʡ 💗"},
];
const CAB_COL=[26.07,74.08];               // 칸 가운데 (프레임 폭의 %)
const CAB_ROW=[20.80,40.62,60.44,80.26];   // 칸 가운데 (프레임 높이의 %)
/* 문짝은 프레임에 뚫린 구멍을 메우는 게 아니라, 통짜 원화에서 잘라낸
   같은 자리를 제자리에 다시 얹는 것이다(tools/build-cab-art.py). 그래서
   폭·자리가 원화에서 잰 값과 정확히 같아야 한다 — 어긋나면 문짝 하나가
   저 혼자 두 겹으로 보인다. 문짝은 정사각이 아니라 580×500이다. */
const CAB_DOOR_W=45.28;
/* 학교 문을 열면 TV가 나온다. 네 칸이 학교 안 네 자리다 —
   좌표는 TV 그림에서 화면 안쪽 네 칸을 재서 넣었다 */
/* 좌표는 open.webp 기준이다. 그 그림은 사물함 한 장 통째이고(프레임과 같은
   크기다) TV가 그 한가운데에 있다 — 열린 부분만 오려 띄우지 않는다 */
const TV_QUAD={
  "교실":  {x:33.57, y:40.62},
  "보건실":{x:48.24, y:40.62},
  "옥상":  {x:33.57, y:47.11},
  "체육관":{x:48.24, y:47.11},
};
const TV_QUAD_W=13.97, TV_QUAD_H=6.31;

/* 자리 이름 → 화면에 읽히는 이름. 캐비닛 문짝의 aria-label에 쓴다 */
const ROAD_LABEL={
  class:"CLASSROOM",nurse:"INFIRMARY",rooftop:"ROOFTOP",conv:"STORE",
  library:"LIBRARY",record:"RECORD SHOP",laundry:"LAUNDROMAT",home:"HOME",
  school:"SCHOOL",gym:"GYM",
};
/* ── 가방 ──
   선물은 유저가 준다. 가방은 받은 것이다. 자리마다 하나씩 있고, 그 자리에
   가야만 생긴다 — 지도를 도는 이유가 여기 있다.
   lent는 빌린 것. 돌려줘야 하는 게 하나쯤 있어야 다시 만날 이유가 남는다. */
const ITEMS={
  note:    {name:"접힌 쪽지",   cat:"기록", say:"message : 1 line / undeletable"},
  bandaid: {name:"밴드",        cat:"소품", say:"patch count : 2"},
  can:     {name:"캔커피",      cat:"간식", say:"temperature : cold / selected for u"},
  haribo:  {name:"하리보 젤리", cat:"간식", say:"bears received : full pack ♡"},
  book:    {name:"빌린 책",     cat:"기록", lent:true, say:"return date : not found"},
  lp:      {name:"중고 LP",     cat:"기록", say:"surface : scratched / playable"},
  coin:    {name:"동전 한 줌",  cat:"소품", say:"credit : 500 × 5 / keep the rest"},
  key:     {name:"여벌 열쇠",   cat:"소품", say:"HOME access : granted ♡"},
  /* 자리에서 받는 게 아니라 야자 감독인 주에 시스템이 쥐여주는 것.
     그래서 where가 없다 — 어디서 받았는지가 없는 유일한 물건이다. */
  wrist:   {name:"손목 보호대", cat:"소품", say:"support : still on"},
  ebar:    {name:"에너지바",    cat:"간식", say:"energy level : restored +20 ♡"},
};
const ITEM_CATS=["전체","간식","소품","기록"];

/* ── 하루의 시간표 ──
   요즘 고등학교 기준이다. 50분 수업에 10분 쉬는 시간, 4교시 끝나고 점심.
   야자는 2017년쯤 강제가 없어져서 지금은 희망자만 남는 자율학습이다. 그래서
   매일 붙지 않는다 — 유저가 감독으로 남는 날(격주 목요일)에만 붙는다.
   강현이 그날 남는 것도 강제가 아니라서 성격이 된다. 갈 데가 없는 애다. */
/* 마지막 칸이 NULL인 이유.
   학교가 하루를 채워준다 — 출근·수업·점심·퇴근·저녁까지는 시간표가 이 사람이
   어디서 뭘 하는지 정해준다. 그게 끝나면 정해주는 것이 없다. 교생의 하루는
   학교 것이고, 그 밖에서 이 사람은 값이 비어 있다. 전에는 저녁 칸이 밤 열한
   시까지 그대로 켜져 있었다 — 여섯 시간을 「저녁」이라고 우기고 있었던 셈이다.
   스물한 시는 timeWord가 「밤」으로 넘어가는 경계다. 시계를 둘 두지 않는다. */
/* 퇴근은 17:00이다. 16:30(990)으로 두었더니 4시 58분에 표는 「퇴근」인데
   방 목록의 재언은 아직 「보건실」이었다 — presence가 h>=17부터 퇴근이라
   시계가 둘이었다. 재언 쪽에 맞춘다. 저녁은 한 시간 밀어 18:00으로. */
const LEAVE_AT=1020;     // 퇴근 17:00 — presence의 재언과 같은 시각
const DAY_SLOTS=[
  {k:"출근",at:480},{k:"수업",at:520},{k:"점심",at:750},{k:"수업",at:810},
  {k:"퇴근",at:LEAVE_AT},{k:"저녁",at:1080},{k:"야자",at:1110},{k:"OFF",at:1260},
];
const WEND_SLOTS=4;      // 주말은 이름이 없다. 유저가 넷을 직접 채운다
const isWend=d=>{const w=(d||nowClock()).getDay();return w===0||w===6};
/* 오늘 시간표. 야자는 담당인 목요일에만 붙고, 주말은 아예 칸이 없다 —
   학교가 정해주는 하루가 아니라 유저가 적는 하루라서 */
const daySlots=(now)=>{
  const d=now||nowClock();
  if(isWend(d))return [];
  return DAY_SLOTS.filter(s=>s.k!=="야자"||isYajaDay(d));
};
/* 지금 몇 번째 칸인가. 아직 출근 전이면 -1, 다 끝났으면 마지막 칸 */
const slotNow=(now)=>{
  const d=now||nowClock(), m=d.getHours()*60+d.getMinutes(), list=daySlots(d);
  let i=-1; list.forEach((s,n)=>{if(m>=s.at)i=n});
  return i;
};
/* 상태 버튼에 뜨는 말. 시간표는 「수업」 한 덩이지만 여기서는 교시를 센다 */
const nowLabel=(now)=>{
  const d=now||nowClock();
  if(isWend(d))return d.getDay()===6?"토요일":"일요일";
  const m=d.getHours()*60+d.getMinutes();
  for(const [a,b,n] of PERIODS){ if(m>=a&&m<b)return n+"교시"; }
  if(m>=PERIODS[0][0]&&m<PERIODS[3][1])return "쉬는시간";
  if(m>=PERIODS[3][1]&&m<PERIODS[4][0])return "점심";
  /* 7교시가 끝나고 퇴근까지(16:20~17:00)는 종례·청소다. 표는 아직 「수업」
     칸이지만 수업은 끝났으니, 교시 사이의 빈틈과 같은 이름으로 묶는다 */
  if(m>=PERIODS[4][0]&&m<LEAVE_AT)return "쉬는시간";
  const i=slotNow(d);
  /* 자정을 넘겨도 하루는 안 바뀐다 — 경계는 새벽 다섯 시다(dayKey와 같다).
     그 시간의 교생에게 학교가 정해준 칸은 없다. 어제의 NULL이 그대로 이어진다.
     다섯 시부터 출근 전까지가 등교전이다. */
  return i<0?(d.getHours()<5?"NULL":"등교전"):daySlots(d)[i].k;
};
/* 하루의 경계는 자정이 아니라 새벽 다섯 시다. 새벽 두 시에 여는 건 어제의
   연장이지 새 하루가 아니다 — 대화 도중에 날짜가 넘어가면 그게 제일 이상하다 */
/* 「하루 한 번」 도장이 다 이걸 본다 — 선물·자리·귀갓길·관전 몫.
   인자 없이 부르면 마지막 foreground에서 찍힌 05시 기준일을 쓴다. 탭을 계속
   켜둔 채 경계만 지났다고 도장이 먼저 풀리면 접속 일차와 하루 제한이 갈린다.
   과거 시각을 명시해서 묻는 자리는 그 현실 시각의 05시 기준일을 계산한다. */
/* 기존 도장 값은 2026-9-3 꼴이었다. 접속 시계 내부의 정렬 가능한 0채움 key를
   그대로 내보내면 업데이트 당일 선물·자리를 한 번 더 열어 주게 되므로, 도장
   경계에서는 옛 문자열 모양을 보존한다. */
const dailyStampKey=key=>{const [y,m,d]=String(key||"").split("-");
  return y&&m&&d?y+"-"+Number(m)+"-"+Number(d):String(key||"")};
const dayKey=now=>{
  if(now!=null)return dailyStampKey(accessDayKey(now));
  const state=loadAccessClock();
  return dailyStampKey(state?state.lastKey:accessDayKey(Date.now()));
};
const loadDaySeen=()=>{try{return localStorage.getItem("null_dayseen")||""}catch(e){return""}};
const saveDaySeen=v=>{try{localStorage.setItem("null_dayseen",v)}catch(e){}};
/* ── 선물은 한 사람에게 하루에 하나 ──
   새벽 두 시 사십삼 분에 이어폰을 주고 두 시 사십팔 분에 사진집을 줬더니,
   같은 사람이 오 분 만에 같은 반응을 두 번 했다 — 밀어내고, 값어치를 인정하고,
   받고, 그러고 나서 고맙다고. 한 번이면 그 사람이고 두 번이면 틀이다.
   모델을 고칠 일이 아니라 간격을 둘 일이었다.
   막는 것은 「한 사람이 하루에 두 번 받는 것」이지 「하루에 두 명에게 주는 것」이
   아니다 — 재언에게 주고 강현에게 주는 건 같은 반응이 두 번 도는 게 아니다.
   하루의 경계는 여기서도 새벽 다섯 시다. 새벽에 준 건 어제 준 것이다 —
   저 이어폰과 사진집이 같은 날로 묶여야 이 규칙에 걸린다. */
const loadGiftDay=()=>{try{return JSON.parse(localStorage.getItem("null_giftday"))||{}}catch(e){return{}}};
const saveGiftDay=v=>{try{localStorage.setItem("null_giftday",JSON.stringify(v));return true}catch(e){return false}};
const giftedToday=(char,now)=>loadGiftDay()[char]===dayKey(now);
const stampGift=(char,now)=>giftedToday(char,now)||saveGiftDay({...loadGiftDay(),[char]:dayKey(now)});
/* 주말은 학교가 정해주는 하루가 아니다. 날짜별로 유저가 적은 넷을 들고 있는다 */
const loadWend=()=>{try{return JSON.parse(localStorage.getItem("null_wend"))||{}}catch(e){return{}}};
const saveWend=v=>{try{localStorage.setItem("null_wend",JSON.stringify(v))}catch(e){}};

/* ── 조사 ──
   「밴드을(를) 받았다」가 화면에 그대로 찍혔다. 괄호로 둘 다 적어두는 건
   글로 쓸 때 쓰는 표기지 사람이 읽는 문장이 아니다.
   받침이 있으면 앞의 것, 없으면 뒤의 것. 한글이 아닌 글자로 끝나면(LP·CD)
   받침 없는 쪽으로 읽는다 — 「엘피를」 「씨디를」이 자연스럽다. */
const jos=(w,pair)=>{
  const [a,b]=pair.split("/");
  const s=(w||"").trim();
  const c=s.slice(-1).charCodeAt(0);
  let batchim, rieul;
  if(c>=0xac00&&c<=0xd7a3){ const f=(c-0xac00)%28; batchim=!!f; rieul=(f===8); }
  else{
    /* 한글이 아니면 읽는 소리로 정한다. LP·CD는 「엘피」「씨디」로 읽혀 받침이
       없지만, NULL은 「널」이라 받침이 있다 — 「NULL예요」가 아니라 「NULL이에요」다.
       ㄹ·ㅁ·ㄴ으로 끝나 읽히는 글자만 받침 쪽으로 본다. */
    batchim=/[lmnr]$/i.test(s); rieul=/l$/i.test(s);
  }
  /* 「~(으)로」만 예외가 하나 있다 — ㄹ받침은 받침 없는 쪽과 같다.
     「교실으로」가 아니라 「교실로」다. 다른 조사쌍에는 없는 규칙이다 */
  if(a==="으로"&&rieul)return w+b;
  return w+(batchim?a:b);
};
const loadBag=()=>{try{return JSON.parse(localStorage.getItem("null_bag"))||[]}catch(e){return[]}};
const saveBag=a=>{try{localStorage.setItem("null_bag",JSON.stringify(a));return true}catch(e){return false}};
/* 자리가 열렸나. 다녀온 자리 목록만 본다 — 대화 수도 날짜도 안 본다.
   이미 다녀온 데는 조건을 안 본다. 캐릭터가 먼저 같이 가자고 하는 자리(초대)는
   지도의 순서를 건너뛴다 — 옥상에 가기 전에 강현이 편의점으로 불러낼 수 있다.
   그렇게 다녀오면 met에는 편의점이 있는데 need(옥상)는 비어 있어서, 갔다 온
   자리가 「아직은 못 가요」로 영원히 잠겨 있었다. 다녀온 곳이 안 열린 곳일 수는 없다. */
const placeOpen=(p,been)=>been.includes(p.name)||(p.need||[]).every(n=>been.includes(n));
/* 열린 것과 지금 갈 수 있는 것은 다르다. 새벽 세 시에 교실 문이 열려 있어도
   거기 갈 일은 없다. 자리마다 시간을 적어두고(hours), 안 적힌 데는 24시간이다 —
   편의점과 빨래방. 자정을 넘기는 시간대(집 17~2시)도 되게 감싼다.
   시계는 presence·timeWord와 같은 것을 본다. 방 목록에 「자는 중」이라고 떠
   있는데 그 사람 집에 갈 수 있으면 그게 제일 이상하다. */
const placeHours=(p,now)=>{
  const d=now||nowClock(), wend=d.getDay()===0||d.getDay()===6;
  /* 주말엔 학교가 없다. 재언은 출근을 안 하고 강현은 야자가 없다 —
     교실·보건실·옥상이 통째로 닫힌다(wend:false). 그래서 주말은 학교 밖에서
     일부러 만나야만 하는 날이 된다. 집은 낮에도 사람이 있다(wend:[11,2]).
     wend가 없는 데는 평일과 같다 — 도서관·레코드샵·편의점·빨래방. */
  const w=wend&&("wend" in p)?p.wend:p.hours;
  if(w===false)return false;
  /* ── 학교는 사람이 있을 때만 학교다 ──
     hours는 고정된 숫자 두 개라 요일을 모른다. 교실·옥상의 22시는 야자가
     끝나는 시각에 맞춘 것이었는데, 야자는 격주 목요일에만 붙는다 — 야자도
     없는 수요일 저녁에 강현은 이미 집에 갔는데 교실 문은 열려 있었다.
     체육관의 18시도 같은 종류의 숫자다.

     시각표를 요일마다 새로 적지 않는다. 그러면 시계가 또 둘이 된다.
     대신 위 주석이 이미 말한 규칙을 학교에도 그대로 적용한다 — 「방 목록에
     자는 중이라고 떠 있는데 그 사람 집에 갈 수 있으면 그게 제일 이상하다」.
     학교 자리는 그 자리 사람이 학교에 있을 때만 연다(atWorkNow).
     hours는 그대로 위쪽 상한으로 남는다 — 둘 중 좁은 쪽이 이긴다.

     학교 입구(into:"school")에는 who가 없다. 둘 중 하나라도 있으면 연다 —
     아무도 없는 학교에 들어가 빈 복도를 도는 그림은 이 게임에 없다. */
  if(p.map==="school"||p.into==="school"){
    const who=(p.who&&p.who.length)?p.who:["jaeeon","minhyun"];
    if(!who.some(id=>atWorkNow(id,d)))return false;
  }
  if(!w)return true;
  const h=d.getHours(),[a,b]=w;
  return a<b ? (h>=a&&h<b) : (h>=a||h<b);
};
/* ── 키스타임 층 (⑨) ──
   자리마다 거리가 셋이다: 자리 배경(중거리) → 대화 중 클로즈업(눈 뜸) →
   최근접(눈 감음). 얼굴을 숨겼다 보여주는 게 아니라, 처음부터 보이는
   사람한테 점점 가까워지는 곡선이다.

   ⚠️ 이 표는 **사진첩에도 자리 사진에도 안 들어간다.** 0단계에서 이 사진이
   나가면 관계 단계 급발진의 이미지판이다. 여는 것은 관계 단계와 장면 조건
   이중 게이트뿐이고, 그 배선이 서기 전까지 어느 화면도 이 표를 안 본다.
   시험이 그 사실을 잰다. */
const KISS_SHOT={
  "보건실": {jaeeon:"jaeeon-nurse-kiss"},
  "빨래방": {jaeeon:"jaeeon-laundry-kiss", minhyun:"minhyun-laundry-kiss"},
  "집":     {jaeeon:"jaeeon-home-kiss",    minhyun:"minhyun-home-kiss"},
  "옥상":   {minhyun:"minhyun-rooftop-kiss"},
};
const kissShot=(place,char)=>((KISS_SHOT[place]||{})[char])||null;

/* ── ⑨ 키스타임 ──
   판정은 여기서 안 한다. 최상위 단계인지·고백이 실제로 있었는지는 워커가
   재고(kissMoment) 「누가·어디서」만 내려온다. 여기가 하는 일은 둘뿐이다 —
   그 짝의 사진이 있는지 보는 것, 그리고 이미 본 것인지 보는 것.

   한 짝에 한 번이다. 같은 자리에서 두 번째 고백에 같은 얼굴이 또 뜨면
   연출이 아니라 반응이 된다. 여섯 짝이 저마다 한 번씩 온다. */
const loadKissSeen=()=>{try{
  const v=JSON.parse(localStorage.getItem("null_kiss"));
  return Array.isArray(v)?v.filter(x=>typeof x==="string"):[];
}catch(e){return[]}};
const saveKissSeen=k=>{try{
  const a=loadKissSeen();
  if(a.includes(k))return true;
  localStorage.setItem("null_kiss",JSON.stringify([...a,k]));
  return loadKissSeen().includes(k);
}catch(e){return false}};
/* 워커가 준 것을 사진 한 장으로 바꾼다. 표에 없거나 이미 본 짝이면 null —
   그때는 화면이 그냥 안 뜨고 대사만 나간다 */
const kissNext=k=>{
  if(!k||typeof k!=="object")return null;
  const shot=kissShot(String(k.place||""),String(k.char||""));
  if(!shot||loadKissSeen().includes(shot))return null;
  return {shot,shots:kissCuts(shot),char:String(k.char),place:String(k.place)};
};
/* ── 세 컷 ── 멀리 → 가까이 → 눈 감음.
   표에 적힌 것은 짝마다 한 장뿐이라, -2·-3이 아직 없는 짝은 같은 장을 그대로
   이어 쓴다. 컷이 안 갈릴 뿐 다가감·초점·어둠은 그대로 간다. 그림이 들어오는
   날 이 표만 채우면 화면은 안 고쳐도 된다. */
const KISS_CUTS={
  "jaeeon-nurse-kiss":    ["jaeeon-nurse-mid",   "jaeeon-nurse-near",   "jaeeon-nurse-kiss"],
  "jaeeon-laundry-kiss":  ["jaeeon-laundry-mid", "jaeeon-laundry-near", "jaeeon-laundry-kiss"],
  "jaeeon-home-kiss":     ["jaeeon-home-mid",    "jaeeon-home-near",    "jaeeon-home-kiss"],
  "minhyun-laundry-kiss": ["minhyun-laundry-mid","minhyun-laundry-near","minhyun-laundry-kiss"],
  "minhyun-home-kiss":    ["minhyun-home-mid",   "minhyun-home-near",   "minhyun-home-kiss"],
  "minhyun-rooftop-kiss": ["minhyun-rooftop-mid","minhyun-rooftop-near","minhyun-rooftop-kiss"],
};
const kissCuts=shot=>{
  const a=KISS_CUTS[shot]||[shot];
  return [a[0]||shot, a[1]||a[0]||shot, a[2]||a[1]||a[0]||shot];
};
/* ── 이 화면이 맡는 것은 상대가 아니라 내 몸이다 ──
   앞판은 한 장을 부드럽게 띄우는 것이었다. 사진이 전부 일하고 화면은 확대만 했다.
   키스는 매끄럽게 다가오지 않는다 — 머뭇거리고, 숨이 가빠지고, 어느 순간 숨이
   멈추고, 그 다음에 닿는다. 상대는 사진이 맡고 화면은 숨·초점·어둠을 맡는다.
   접촉은 화면 밖이다: 다 번진 검은 데서 끝난다.

   KISS_RUN은 그 한 호흡의 길이다. KISS_OUT은 그 뒤에 화면이 접히는 시간. */
const KISS_RUN=9600, KISS_OUT=900;
/* 옛 이름 둘은 Expo가 아직 부른다. 같은 한 호흡을 두 토막으로 부르는 것뿐이라
   합이 KISS_RUN이다 — 두 곳이 서로 다른 길이를 갖지 않게 여기서 갈라 쓴다 */
const KISS_RISE=6300, KISS_HOLD=KISS_RUN-KISS_RISE;

/* ── 자리에 깔리는 그 사람 사진 ──
   들어간 순간엔 빈 방이고, 그 사람이 입을 열면 그 사람이 화면이 된다.
   눈앞에 있는 사람 사진을 문자로 보내는 건 이상하니까 배경이 그 일을 한다.
   짝은 지어내지 않았다 — 사진 설명이 이미 어디인지 말하고 있어서 그대로 옮겼다.
   낮/저녁이 갈리는 건 교실뿐이다. desk는 짝이 찍어준 것(수업 중이라 제 손이
   묶여 있다)이고 nap은 자기가 찍은 것(빈 교실이라 찍을 수 있다)이다. */
const SCENE_SHOT={
  /* 교실은 강현 자리다 — PLACES의 who가 강현뿐이라 재언은 여기 오지 않는다 */
  "교실":     {minhyun:{day:["minhyun-window","minhyun-desk"], eve:["minhyun-nap"]}},
  "보건실":   {jaeeon:["jaeeon-work","jaeeon-chart","jaeeon-nurse-mid","jaeeon-nurse-near"],
               minhyun:["minhyun-candy"]},
  "옥상":     {jaeeon:["jaeeon-rooftop"],
               minhyun:["minhyun-vending","minhyun-rooftop-mid","minhyun-rooftop-near"]},
  "편의점":   {jaeeon:["jaeeon-conv"], minhyun:["minhyun-fridge","minhyun-ramen"]},
  "도서관":   {jaeeon:["jaeeon-shelf","jaeeon-book"], minhyun:["minhyun-shelf"]},
  "레코드샵": {jaeeon:["jaeeon-record"], minhyun:["minhyun-crate","minhyun-record","minhyun-mirror"]},
  /* 밤에 처음 켜면 여기서 재언을 만난다. 사진도 밤 코인세탁소다 —
     건조기 앞에 앉아 수건을 개고 있고 창밖에 비가 온다 */
  /* 재언의 빨래방은 자리 사진이 한 장이다 — 앉아서 수건을 개고 있는 그 장면이
     이 자리의 기본이다. 옛 사진(jaeeon-laundry)은 여기서 물러나고 사진첩에만
     남는다. 가까운 두 장(mid·near)도 사진첩 몫이다 — 자리에 앉는 순간 보이는
     것은 늘 같은 그림이라야 그 자리가 그 자리로 남는다. */
  "빨래방":   {minhyun:["minhyun-laundry","minhyun-laundry-mid","minhyun-laundry-near"],
               jaeeon:["jaeeon-laundry-seat"]},
  "체육관":   {minhyun:["minhyun-gym"]},
  /* 재언 집이지만 강현도 산다. 재언은 부엌에 서 있고, 강현은 막 일어난
     참이거나 엘리베이터에서 올라오는 길이다 */
  "집":       {jaeeon:["jaeeon-cook","jaeeon-night","jaeeon-home-mid","jaeeon-home-near"],
               minhyun:["minhyun-morning","minhyun-elevator","minhyun-home-mid","minhyun-home-near"]},
  /* 귀갓길은 지도에 없는 자리라 PLACES에 안 들어간다. 그래도 규칙은 같다 —
     빈 자리로 시작해서 그 사람이 입을 열면 그 사람이 화면이 된다. */
  /* 귀갓길은 같이 버스를 탄 자리다. 정류장 사진은 기다리는 그림이라
     여기 오면 아직 안 탄 사람이 된다 — 탄 그림으로 바꿨다.
     정류장 사진은 그대로 산다: 저녁 첫 자리(버스정류장)의 배경이고 앨범에도 있다. */
  "귀갓길":   {jaeeon:["jaeeon-driveseat"], minhyun:["minhyun-busride","minhyun-neon"]},
};
/* ── 귀갓길 ── 지도에 없다. 골라서 가는 데가 아니라 자리가 끝나고 붙는 데다.
   유저 집은 정거장이 아니라 데려다주는 일이 끝나는 곳이라서 아이콘이 없다.
   재언은 태워다 주고(조수석에서 본 대시보드), 강현은 같이 버스를 탄다(빈 자리).
   건넬 물건은 없다 — 데려다주는 것이 이미 그거다. */
const WAY="귀갓길";
const WAY_BG={jaeeon:"jaeeon-drive.webp", minhyun:"minhyun-bus.webp"};
/* 밤에, 말을 나누고 나온 자리에서만. 그리고 하루에 한 번 */
const wayOK=(now)=>{const h=(now||nowClock()).getHours();return h>=20||h<5};
const loadWay=()=>{try{return localStorage.getItem("null_way")||""}catch(e){return""}};
const saveWay=v=>{try{localStorage.setItem("null_way",v);return true}catch(e){return false}};
/* 그 자리·그 사람·그 시간에 맞는 사진 하나. 없으면 빈 방 그대로 */
const sceneShot=(place,who,now)=>{
  const t=(SCENE_SHOT[place]||{})[who]; if(!t)return null;
  const h=(now||nowClock()).getHours();
  const list=Array.isArray(t)?t:(h>=17?t.eve:t.day)||t.day||[];
  return list.length?list[Math.floor(Math.random()*list.length)]+".webp":null;
};

/* ── 이 자리가 끝날 때 ──
   말만 계속 걸면 침묵 한 시간이 영영 안 차서, 보건실에 새벽까지 앉아 있을
   수 있었다. 때는 새 시계가 아니라 있는 시계 둘로 정한다 — 자리의 문 닫는
   시간(placeHours)과 그 사람이 자는 시간(presence off). 재언은 다섯 시
   퇴근이고 문 닫는 데서는 나가야 한다.
   귀갓길은 안 본다 — 원래 곧 끝나는 자리다. */
const sceneOver=(sc,now)=>{
  if(!sc||sc.place===WAY)return false;
  const p=PLACE_BY[sc.place];
  if(p&&!placeHours(p,now))return true;
  const pr=presence(sc.room,now);
  if(!pr||pr.s!=="off")return false;
  /* 자리가 열릴 때부터 자는 시간이었다면 자리가 이긴다 — 새벽 오프닝
     (편의점 라면, 여섯 시 후문 골목)은 시간표를 안 보고 여는 자리인데,
     시간표로 닫으면 열리자마자 「나왔다」가 찍혔다. 눈앞에 있는 사람은
     자고 있지 않다. 깨어 있다가 잘 시간이 된 경우만 때다. */
  const at=presence(sc.room,gameAt(sc.since));
  return !at||at.s!=="off";
};

/* ── 하루에 한 자리는 한 번 ──
   같은 데를 하루에 세 번 가면 그건 다니는 게 아니라 새로고침이다.
   경계는 여기서도 새벽 다섯 시다. */
const loadGone=()=>{try{return JSON.parse(localStorage.getItem("null_goneday"))||{}}catch(e){return{}}};
const saveGone=v=>{try{localStorage.setItem("null_goneday",JSON.stringify(v));return true}catch(e){return false}};
const goneToday=(place,now)=>loadGone()[place]===dayKey(now);
const stampGone=(place,now)=>goneToday(place,now)||saveGone({...loadGone(),[place]:dayKey(now)});

/* ── 지금 밖에 나와 있을 수 있나 ──
   편의점·빨래방은 누가 있을지 정해두지 않는다. 마주치는 자리라서.
   누가 있을 수 있는지는 이미 있는 생활 리듬(presence)이 정한다 — 새 규칙을
   만들지 않는다. 근무 중이거나 수업 중이거나 야자 중이거나 자는 중이면
   밖에 없다. 주말엔 학교가 없으니 낮에도 나올 수 있다. */
/* 점심도 학교 안이다 — 마주치는 자리(편의점·빨래방)에 나올 수는 없다.
   교실이 열리는 것(문틈 해제)과 학교 밖에 나오는 것은 다른 일이다. */
const AT_WORK=["보건실","수업 중","쉬는시간","점심","야자"];
const freeOut=(id,now)=>{
  const d=now||nowClock(), pr=presence(id,d);
  if(!pr||pr.s==="off")return false;
  return isWend(d)||!AT_WORK.includes(pr.t);
};
const whoOut=(now)=>["jaeeon","minhyun"].filter(id=>freeOut(id,now));
/* ── 이 자리에 지금 나올 수 있는 사람 ──
   meetOther가 붙은 자리(편의점)는 「안 만난 쪽을 만나는 자리」다. 둘 다
   나와 있는 시간이면 그대로 둘 다지만, 한 사람만 나올 수 있는 시간이면
   그 자리에 서는 것은 **오프닝에서 안 만난 쪽**이다. 오프닝 상대가 편의점에
   또 서 있으면 안 만난 사람의 방은 계속 잠긴 채로 남는다 — 지도를 도는
   이유가 우연에 걸린다.

   그래서 나올 수 있는 사람이 오프닝 상대 하나뿐인 시간에는 아무도 안 나온다.
   화면은 이미 그 말을 할 줄 안다(「지금 밖은 Empty...」).

   whoAt·canGoWith·giftSpots가 전부 이 함수를 본다 — 셋이 따로 세면 지도에는
   뜨는데 들어가면 아무도 없는 자리가 생긴다. */
const outAt=(p,now)=>{
  const out=whoOut(now);
  if(!p||!p.meetOther||out.length>1)return out;
  const other=unmetOne();
  return other?out.filter(id=>id===other):out;    // 모르면 지금까지대로
};

/* ── 아직 만나지 않은 사람 ──
   첫 자리에서 만난 사람의 방만 열린다. 다른 한 사람은 **학교에서** 만나야
   한다. 그래서 그 사람이 학교에 있는 동안에만 먼저 말을 걸 수 있다 —
   출근해서 퇴근 전까지, 야자까지. 그 시간이 아니면 다음 근무 시간에 온다.

   창을 새로 만들지 않는다. 「학교에 있다」는 이미 생활 리듬(presence)이
   AT_WORK로 정해뒀다: 보건실·수업 중·점심·야자.

   상태도 따로 안 적는다 — 말이 한 마디라도 오갔으면 이미 만난 것이다.
   그러면 그 뒤로는 밤이든 주말이든 안 잠기고, 판을 새로 열면 저절로
   돌아온다. 단톡·관전은 제 조건(groupReady)이 따로 있어 여기 안 걸린다. */
const atWorkNow=(id,now)=>{
  const d=now||worldNow();
  if(isWend(d))return false;                    // 주말엔 학교가 없다
  const pr=presence(id,d);
  return !!pr&&AT_WORK.includes(pr.t);
};
/* 주말 — 실습이 아직 시작도 안 했다 */
const LOCK_LINES=["아직 출근하지 않았어요 ૮ ⸝⸝o̴̶̷᷄ ·̭ o̴̶̷̥᷅⸝⸝ ྀིა","교생 실습은 월요일부터 ♡"];
/* 평일인데 아직 출근 전 — 오늘 이따 온다 */
const SOON_LINES=["이따 만나요 ᜊ(੭ ˊ ᵕˋ)੭ : ﾟ.+","조금만 기다려 ♡"];
/* 평일인데 오늘 근무가 끝났다 — 다음은 내일이다 */
const WAIT_LINES=["내일 만나요 ᜊ(੭ ˊ ᵕˋ)੭ : ﾟ.+","조금만 기다려 ♡"];
/* 오늘 안에 아직 학교에 있을 때가 남았나. 출근 전(「이따」)과 퇴근 뒤
   (「내일」)를 가른다 — 새벽 세 시에 「내일 만나요」는 틀린 말이다.
   시각 상수를 새로 두지 않고 같은 presence를 오늘 끝까지 훑는다. 두 사람의
   창이 다르고(재언은 퇴근까지, 강현은 야자까지) 야자는 주마다 붙었다
   떨어지므로, 표를 따로 만들면 그게 또 갈린다. */
const worksLaterToday=(id,now)=>{
  const d=now||worldNow();
  const t=new Date(d);
  for(;;){
    t.setMinutes(t.getMinutes()+15,0,0);
    if(t.getDate()!==d.getDate()||t.getMonth()!==d.getMonth())return false;  // 자정을 넘었다
    if(atWorkNow(id,t))return true;
  }
};
/* 잠겼으면 화면에 설 두 줄을, 아니면 null을 준다. 부르는 쪽이 둘 다 쓴다 —
   잠금 여부와 까닭이 한 자리에서 나와야 둘이 어긋나지 않는다. */
const roomLock=(store,id,now)=>{
  if(id!=="jaeeon"&&id!=="minhyun")return null;
  if(((store&&store.msgs&&store.msgs[id])||[]).length)return null;   // 이미 만났다
  const d=now||worldNow();
  if(atWorkNow(id,d))return null;
  if(isWend(d))return LOCK_LINES;
  return worksLaterToday(id,d)?SOON_LINES:WAIT_LINES;
};
/* ── 유저가 먼저 가자고 하는 자리 ──
   지금까지 자리를 여는 길은 둘뿐이었다. 지도에서 유저가 고르거나, 관계가
   쌓여 인물이 먼저 꺼내거나(INVITES). 그래서 대화 중에 「편의점 가자」고
   하면 인물에게는 그 자리를 열 수단이 없었다 — 열지도 못하면서 말로만
   「지금 나가요」 「편의점 앞에서 봐요」를 되풀이하다 끝났다.
   그건 규칙을 어긴 게 아니라 손이 없었던 것이다.

   이 목록이 그 손이다. 새 조건은 만들지 않는다 — 지도 창이 「갈래요?」를
   띄우는 조건 그대로다. 화면에서 갈 수 있는 데면 말로도 갈 수 있어야 한다.
   인물이 먼저 꺼내는 자리(INVITES)는 이것과 별개로 둔다. 그쪽은 관계가
   쌓여야 열리는 사다리고, 이쪽은 유저가 이미 열어둔 문이다. */
const canGoWith=(id,met,now)=>PLACES.filter(p=>!p.into
  &&(p.who||[]).includes(id)
  &&placeOpen(p,met||[])&&placeHours(p,now)&&wendOnlyOk(p,now)&&!goneToday(p.name,now)
  &&(p.meet!=="out"||outAt(p,now).includes(id))).map(p=>p.name);
/* ── 단톡방은 나중에 생긴다 ──
   강현이 「삼촌도 유저를 알고, 유저도 삼촌을 안다」를 알게 된 순간 그가 판다.
   유저는 초대를 받는다 — 왜 초대됐는지는 모른 채로. 그게 이 앱의 모양이다.

   알게 되는 근거는 새로 만들지 않는다. 이미 강현에게 보내고 있는 신호가
   그거다 — 재언 방에 오늘 대화가 몇 번 있었고 마지막이 몇 분 전인가.
   「요즘 삼촌 폰 오래 붙잡고 있길래」가 그 신호를 보고 나온 말이다.
   여기서는 그 신호가 양쪽에 충분히 쌓였는지만 센다.

   이미 말이 오간 방은 도로 못 닫는다. 하던 사람의 기록이 사라지면 안 된다. */
const GROUP_AT=12;
const loadGroupOn=()=>{try{return localStorage.getItem("null_group")==="1"}catch(e){return false}};
const saveGroupOn=()=>{try{localStorage.setItem("null_group","1")}catch(e){}};
const groupReady=msgs=>{
  const n=r=>((msgs||{})[r]||[]).length;
  return n("group")>0||(n("jaeeon")>=GROUP_AT&&n("minhyun")>=GROUP_AT);
};
/* 방 목록. 단톡방은 열리기 전까지 없는 방이다 */
const roomsOn=on=>ROOMS.filter(r=>r.id!=="group"||on);

/* ── 선물을 어디서 줄까 ──
   물건은 손에서 손으로 간다. 그래서 선물은 만나러 가는 이유가 된다 —
   지도를 도는 이유가 아이템 하나뿐이었는데 하나 늘었다.
   자리 규칙은 하나도 안 봐준다. 여는 시간, 오늘 갔는지, 주말 전용,
   그리고 그 사람이 거기 있을 수 있는지까지 다 통과해야 목록에 뜬다.
   왜 안 되는지는 흐리게 남겨서 알려준다 — 아예 빼면 왜 없는지를 모른다.
   아직 안 열린 자리는 아예 안 보인다. 모르는 자리는 없는 자리다. */
const giftSpots=(char,met,now)=>SPOTS.filter(p=>placeOpen(p,met)).map(p=>{
  const canMeet=p.meet==="out" ? outAt(p,now).includes(char)
              : p.pick ? true
              : (p.who||[]).includes(char);
  const why=!canMeet ? (p.meet==="out"?"지금은 자리를 비웠어요":"이 장소에서는 만날 수 없어요")
    : goneToday(p.name,now) ? "오늘은 벌써 다녀왔어요"
    : !wendOnlyOk(p,now)    ? "주말에만"
    : !placeHours(p,now)    ? placeWhen(p,now)
    : "";
  return {place:p.name, icon:p.icon, ok:!why, why};
});

/* 주말에만 가는 자리 */
const wendOnlyOk=(p,now)=>!p.wendOnly||isWend(now||nowClock());

/* ── 지금 갈 수 있나 ── 한 자리에서만 판정한다.
   지도의 문과 GO! 가 서로 다른 것을 보고 있었다. 문은 placeHours만 보고
   열려 있는데, GO! 는 whoAt까지 봐서 아무도 안 나와 있는 시각에는 눌러도
   조용히 아무 일도 안 났다 — 문이 멀쩡히 열려 있고 「GO?」까지 물어놓고
   말이다. 마주치는 자리(편의점·빨래방)는 「나와 있는 사람」이 곧 문이다. */
const canGoNow=(p,now)=>{
  if(!p||p.into)return false;
  if(!placeHours(p,now)||!wendOnlyOk(p,now)||goneToday(p.name,now))return false;
  if(p.meet==="out")return outAt(p,now).length>0;
  return true;
};

/* 왜 지금은 못 가는지 한 줄. 주말의 학교는 시간이 아니라 날이 문제라
   시각을 적어주면 거짓말이 된다 — 여덟 시가 돼도 안 열린다 */
const placeWhen=(p,now)=>{
  const d=now||nowClock(), wend=d.getDay()===0||d.getDay()===6;
  const w=wend&&("wend" in p)?p.wend:p.hours;
  if(w===false)return "weekdays only";
  /* 시각을 적어주면 거짓말이 된다 — 여덟 시가 아니라 사람이 없어서 닫혔다 */
  if((p.map==="school"||p.into==="school")
    && !((p.who&&p.who.length)?p.who:["jaeeon","minhyun"]).some(id=>atWorkNow(id,d)))
    return "지금 학교는 Empty...";
  if(!w)return "";
  const pad=n=>String(n).padStart(2,"0");
  return `open ${pad(w[0])}:00 – ${pad(w[1])}:00`;
};
/* 아직 못 간 자리에 뭐가 남았는지. 잠긴 칸에 그대로 적어준다 */
const placeNeed=(p,been)=>(p.need||[]).filter(n=>!been.includes(n));
const loadScene=()=>{try{return JSON.parse(localStorage.getItem("null_scene"))||null}catch(e){return null}};
const saveScene=v=>{try{v?localStorage.setItem("null_scene",JSON.stringify(v)):localStorage.removeItem("null_scene");return true}catch(e){return false}};
/* ── 고친 대사 ──
   인물이 이상한 말을 하면 그 말풍선을 눌러 고쳐 쓴다. 이력은 대화 목록에서
   다시 만들어지므로, 고치면 다음 턴부터 인물은 **자기가 그렇게 말한 걸로**
   안다. 프롬프트를 안 건드리고 그 자리에서 바로잡는 길이다.

   고친 것은 원문과 짝으로 따로 쌓아둔다. 배포 전에 프롬프트를 손볼 때
   그대로 견본이 된다 — 「이렇게 말해야지」라는 설명이 아니라 실제 대사라서
   대화 예시에 바로 옮길 수 있다. 이 프로덕트에서 안 지켜지는 규칙을 만나면
   먼저 고칠 곳이 견본이라는 것을 두 번 겪었다(docs/playlog-review.md ②·⑦).

   모델에게 시켜서 알아서 모으게 하는 길도 있는데 안 골랐다. ① 그 말이
   인물에게도 보이므로 인물이 거기 답한다. ② 알아채는 게 확률이라 놓치는
   날이 있다. 놓친 것은 없는 것이고, 그러면 모으는 뜻이 없다. */

/* ── ✧ NULL 위한 오늘의 운세 ✧ ──
   세계 시계(dayKey)가 아니라 이 기기의 실제 달력 날짜를 쓴다. 스피드 모드나
   개발 시간 이동으로 운세를 여러 번 뽑을 수 있으면 「접속한 날 한 번」이라는
   약속이 깨지기 때문이다.

   빈칸은 유저 입력이 아니다. 시스템이 who/place/find/keyword를 만들고 이 기기에
   저장한 뒤, FILL을 눌렀을 때만 공개한다. 모델 요청에는 공개된 오늘의 keywordId
   하나만 보낼 수 있다. 나머지 운세와 덱은 전부 localStorage에서 끝난다. */
const FORTUNE_STORAGE_KEY="null_fortune_v1";
const FORTUNE_STATE_VERSION=1;
/* current는 덱에서 마지막으로 새로 뽑은 장을 계속 가리킨다. 그래야 used의
   마지막 값·긴장 간격 장부가 기존 v1과 같은 뜻을 유지한다. 현지 날짜가 잠깐
   앞으로 갔다 돌아온 때를 위해 그 밖의 최근 날짜만 31개 둔다 — current까지
   합치면 한 달짜리 NULL보다 긴 32일이고, 저장값은 몇 KB 안에서 멈춘다. */
const FORTUNE_HISTORY_MAX=31;

/* id는 워커가 허용 목록으로 확인하는 안정된 계약이고 label은 화면용이다.
   intensity:tension은 연속해서 나오지 않도록 덱에서 따로 간격을 둔다. */
const NULL_FORTUNE_KEYWORDS=[
  {id:"check_in",label:"안부",category:"daily_rhythm",intensity:"light"},
  {id:"morning",label:"아침",category:"daily_rhythm",intensity:"light"},
  {id:"night",label:"밤",category:"daily_rhythm",intensity:"light"},
  {id:"weather",label:"날씨",category:"daily_rhythm",intensity:"light"},
  {id:"weekend",label:"주말",category:"daily_rhythm",intensity:"light"},
  {id:"sleep",label:"잠",category:"daily_rhythm",intensity:"light"},
  {id:"walk",label:"산책",category:"daily_rhythm",intensity:"light"},
  {id:"rest",label:"휴식",category:"daily_rhythm",intensity:"light"},
  {id:"going_out",label:"외출",category:"daily_rhythm",intensity:"light"},
  {id:"homecoming",label:"귀가",category:"daily_rhythm",intensity:"light"},

  {id:"coffee",label:"커피",category:"food",intensity:"light"},
  {id:"ramen",label:"라면",category:"food",intensity:"light"},
  {id:"snack",label:"간식",category:"food",intensity:"light"},
  {id:"late_night_snack",label:"야식",category:"food",intensity:"light"},
  {id:"lunchbox",label:"도시락",category:"food",intensity:"light"},
  {id:"broth",label:"국물",category:"food",intensity:"light"},
  {id:"dessert",label:"디저트",category:"food",intensity:"light"},
  {id:"spicy_flavor",label:"매운맛",category:"food",intensity:"light"},
  {id:"cooking",label:"요리",category:"food",intensity:"light"},
  {id:"menu",label:"메뉴",category:"food",intensity:"light"},

  {id:"song",label:"노래",category:"taste",intensity:"light"},
  {id:"movie",label:"영화",category:"taste",intensity:"light"},
  {id:"book",label:"책",category:"taste",intensity:"light"},
  {id:"photo",label:"사진",category:"taste",intensity:"light"},
  {id:"color",label:"색깔",category:"taste",intensity:"light"},
  {id:"clothes",label:"옷",category:"taste",intensity:"light"},
  {id:"hobby",label:"취미",category:"taste",intensity:"light"},
  {id:"game",label:"게임",category:"taste",intensity:"light"},
  {id:"collection",label:"소장품",category:"taste",intensity:"light"},
  {id:"interior",label:"인테리어",category:"taste",intensity:"light"},

  {id:"temperature",label:"온도",category:"senses",intensity:"light"},
  {id:"sound",label:"소리",category:"senses",intensity:"light"},
  {id:"scent",label:"향기",category:"senses",intensity:"light"},
  {id:"texture",label:"촉감",category:"senses",intensity:"light"},
  {id:"light",label:"빛",category:"senses",intensity:"light"},
  {id:"shadow",label:"그림자",category:"senses",intensity:"light"},
  {id:"breeze",label:"바람",category:"senses",intensity:"light"},
  {id:"gaze",label:"시선",category:"senses",intensity:"personal"},
  {id:"voice",label:"목소리",category:"senses",intensity:"personal"},
  {id:"mood",label:"분위기",category:"senses",intensity:"light"},

  {id:"class",label:"수업",category:"school_life",intensity:"light"},
  {id:"break_time",label:"쉬는 시간",category:"school_life",intensity:"light"},
  {id:"after_school",label:"방과 후",category:"school_life",intensity:"light"},
  {id:"homework",label:"숙제",category:"school_life",intensity:"light"},
  {id:"exam",label:"시험",category:"school_life",intensity:"light"},
  {id:"presentation",label:"발표",category:"school_life",intensity:"light"},
  {id:"cleaning",label:"청소",category:"school_life",intensity:"light"},
  {id:"school_lunch",label:"급식",category:"school_life",intensity:"light"},
  {id:"physical_education",label:"체육",category:"school_life",intensity:"light"},
  {id:"attendance",label:"출석",category:"school_life",intensity:"light"},

  {id:"question",label:"질문",category:"conversation",intensity:"light"},
  {id:"answer",label:"대답",category:"conversation",intensity:"personal"},
  {id:"request",label:"부탁",category:"conversation",intensity:"personal"},
  {id:"compliment",label:"칭찬",category:"conversation",intensity:"personal"},
  {id:"recommendation",label:"추천",category:"conversation",intensity:"light"},
  {id:"teasing",label:"장난",category:"conversation",intensity:"light"},
  {id:"brag",label:"자랑",category:"conversation",intensity:"light"},
  {id:"encouragement",label:"응원",category:"conversation",intensity:"personal"},
  {id:"help",label:"도움",category:"conversation",intensity:"personal"},
  {id:"apology",label:"사과",category:"conversation",intensity:"tension"},

  {id:"first_impression",label:"첫인상",category:"memory_time",intensity:"personal"},
  {id:"memory",label:"기억",category:"memory_time",intensity:"personal"},
  {id:"past",label:"과거",category:"memory_time",intensity:"personal"},
  {id:"yesterday",label:"어제",category:"memory_time",intensity:"light"},
  {id:"tomorrow",label:"내일",category:"memory_time",intensity:"light"},
  {id:"timing",label:"타이밍",category:"memory_time",intensity:"personal"},
  {id:"moment",label:"순간",category:"memory_time",intensity:"personal"},
  {id:"repetition",label:"반복",category:"memory_time",intensity:"personal"},
  {id:"season",label:"계절",category:"memory_time",intensity:"light"},
  {id:"waiting",label:"기다림",category:"memory_time",intensity:"personal"},

  {id:"dream",label:"꿈",category:"possibility",intensity:"personal"},
  {id:"wish",label:"소원",category:"possibility",intensity:"personal"},
  {id:"imagination",label:"상상",category:"possibility",intensity:"light"},
  {id:"coincidence",label:"우연",category:"possibility",intensity:"light"},
  {id:"possibility",label:"가능성",category:"possibility",intensity:"personal"},
  {id:"hunch",label:"예감",category:"possibility",intensity:"personal"},
  {id:"discovery",label:"발견",category:"possibility",intensity:"light"},
  {id:"adventure",label:"모험",category:"possibility",intensity:"light"},
  {id:"what_if",label:"만약",category:"possibility",intensity:"personal"},
  {id:"opportunity",label:"기회",category:"possibility",intensity:"personal"},

  {id:"promise",label:"약속",category:"connection",intensity:"personal"},
  {id:"sincerity",label:"진심",category:"connection",intensity:"personal"},
  {id:"trust",label:"믿음",category:"connection",intensity:"personal"},
  {id:"comfort",label:"위로",category:"connection",intensity:"personal"},
  {id:"consideration",label:"배려",category:"connection",intensity:"personal"},
  {id:"courage",label:"용기",category:"connection",intensity:"personal"},
  {id:"name",label:"이름",category:"connection",intensity:"personal"},
  {id:"nickname",label:"별명",category:"connection",intensity:"light"},
  {id:"form_of_address",label:"호칭",category:"connection",intensity:"personal"},
  {id:"similarity",label:"닮은 점",category:"connection",intensity:"personal"},

  {id:"secret",label:"비밀",category:"tension",intensity:"tension"},
  {id:"lie",label:"거짓말",category:"tension",intensity:"tension"},
  {id:"misunderstanding",label:"오해",category:"tension",intensity:"tension"},
  {id:"silence",label:"침묵",category:"tension",intensity:"tension"},
  {id:"boundary",label:"경계",category:"tension",intensity:"tension"},
  {id:"regret",label:"후회",category:"tension",intensity:"tension"},
  {id:"suspicion",label:"의심",category:"tension",intensity:"tension"},
  {id:"excuse",label:"핑계",category:"tension",intensity:"tension"},
  {id:"hesitation",label:"망설임",category:"tension",intensity:"tension"},
  {id:"mistake",label:"실수",category:"tension",intensity:"tension"},
];
/* null prototype — 깨진 저장값의 __proto__/constructor가 허용 id처럼 보이면 안 된다. */
const FORTUNE_KEYWORD_BY_ID=Object.create(null);
NULL_FORTUNE_KEYWORDS.forEach(k=>{FORTUNE_KEYWORD_BY_ID[k.id]=k});

/* 조사까지 화면 문구에 고정돼 있으므로 who는 받침 있는 이름, find는 「을」이
   자연스러운 말만 둔다. place는 실제 NULL 지도에 있는 자리다. */
const NULL_FORTUNE_WHO=["이재언","이강현"];
const NULL_FORTUNE_PLACES=["학교","교실","보건실","옥상","체육관","편의점","도서관","레코드샵","빨래방","집"];
const NULL_FORTUNE_FINDS=["작은 행운","반가운 우연","새로운 장면","숨은 흔적","기다리던 답","사소한 비밀","다정한 마음","작은 선물","좋은 소식","새로운 인연"];

/* 실제 로컬 달력 날짜. nowClock/dayKey를 의도적으로 부르지 않는다. */
const fortuneDayKey=(now)=>{
  const d=now===undefined?new Date():(now instanceof Date?now:new Date(now));
  if(!Number.isFinite(d.getTime()))return"";
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const fortuneRandom=random=>{
  let n=0;
  try{n=Number((typeof random==="function"?random:Math.random)())}catch(e){n=0}
  return Number.isFinite(n)?Math.max(0,Math.min(0.9999999999999999,n)):0;
};
const shuffleFortune=(list,random)=>{
  const a=(list||[]).slice();
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(fortuneRandom(random)*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
};

/* 두 번째 값은 직전 tension 뒤로 지난 일반 키워드 수(0~6)다. 공개 helper를
   단독으로 쓸 때는 intensity 문자열도 받는다: tension=0, 그 밖=간격 충족.
   tension 사이에는 언제나 다른 키워드가 여섯 개 이상 놓인다. */
const fortuneTensionGap=previousIntensity=>{
  if(Number.isFinite(previousIntensity))return Math.max(0,Math.min(6,Math.floor(previousIntensity)));
  return previousIntensity==="tension"?0:6;
};
const buildFortuneDeck=(random,previousIntensity)=>{
  const tense=shuffleFortune(NULL_FORTUNE_KEYWORDS.filter(k=>k.intensity==="tension").map(k=>k.id),random);
  const calm=shuffleFortune(NULL_FORTUNE_KEYWORDS.filter(k=>k.intensity!=="tension").map(k=>k.id),random);
  /* 11 tension 앞·사이·뒤의 일반 키워드 묶음. 첫 묶음은 지난 덱의 꼬리와
     합쳐 여섯 칸이 되고, 열 개의 사이 묶음은 각자 최소 여섯 칸이다. */
  const gaps=Array(tense.length+1).fill(0);
  gaps[0]=Math.max(0,6-fortuneTensionGap(previousIntensity));
  for(let i=1;i<tense.length;i++)gaps[i]=6;
  let extra=calm.length-gaps.reduce((a,b)=>a+b,0);
  while(extra-->0)gaps[Math.floor(fortuneRandom(random)*gaps.length)]++;
  const deck=[],rest=calm.slice();
  for(let i=0;i<tense.length;i++){
    deck.push(...rest.splice(0,gaps[i]));
    deck.push(tense[i]);
  }
  deck.push(...rest);
  return deck;
};

const fortuneRecordOk=r=>!!r&&typeof r==="object"
  &&/^\d{4}-\d{2}-\d{2}$/.test(r.day||"")
  &&NULL_FORTUNE_WHO.includes(r.who)
  &&NULL_FORTUNE_PLACES.includes(r.place)
  &&NULL_FORTUNE_FINDS.includes(r.find)
  &&!!FORTUNE_KEYWORD_BY_ID[r.keywordId]
  &&typeof r.revealed==="boolean"&&typeof r.seen==="boolean";
const fortuneSequenceGap=(ids,startGap)=>{
  let gap=startGap;
  for(const id of ids){
    const k=FORTUNE_KEYWORD_BY_ID[id];
    if(!k)return-1;
    if(k.intensity==="tension"){
      if(gap<6)return-1;
      gap=0;
    }else gap=Math.min(6,gap+1);
  }
  return gap;
};
const fortuneDeckStateOk=s=>{
  if(!s||s.v!==FORTUNE_STATE_VERSION||!fortuneRecordOk(s.current))return false;
  if(!Array.isArray(s.deck)||!Array.isArray(s.used))return false;
  /* history가 없으면 이 기능 전의 v1 저장값이다. 빈 과거로 받아 다음 저장 때
     자연스럽게 새 모양이 된다. 필드가 있는데 모양이 틀린 것은 깨진 값이다. */
  const history=s.history===undefined?[]:s.history;
  if(!Array.isArray(history)||history.length>FORTUNE_HISTORY_MAX
    ||history.some(r=>!fortuneRecordOk(r)))return false;
  const days=[s.current.day,...history.map(r=>r.day)];
  if(new Set(days).size!==days.length)return false;
  const all=[...s.deck,...s.used];
  if(all.length!==NULL_FORTUNE_KEYWORDS.length||new Set(all).size!==all.length)return false;
  if(all.some(id=>!FORTUNE_KEYWORD_BY_ID[id]))return false;
  if(!s.used.length||s.used[s.used.length-1]!==s.current.keywordId)return false;
  if(s.lastKeywordId!==s.current.keywordId)return false;
  if(!Number.isInteger(s.cycleStartGap)||s.cycleStartGap<0||s.cycleStartGap>6)return false;
  if(!Number.isInteger(s.sinceTension)||s.sinceTension<0||s.sinceTension>6)return false;
  const afterUsed=fortuneSequenceGap(s.used,s.cycleStartGap);
  return afterUsed===s.sinceTension&&fortuneSequenceGap(s.deck,afterUsed)>=0;
};
const loadFortuneState=()=>{try{
  const s=JSON.parse(localStorage.getItem(FORTUNE_STORAGE_KEY));
  return fortuneDeckStateOk(s)?s:null;
}catch(e){return null}};
const saveFortuneState=s=>{try{
  localStorage.setItem(FORTUNE_STORAGE_KEY,JSON.stringify(s));return true;
}catch(e){return false}};
const pickFortune=(list,random)=>list[Math.floor(fortuneRandom(random)*list.length)];
const fortuneHistoryOf=s=>Array.isArray(s&&s.history)?s.history:[];
const fortuneRecordForDay=(s,day)=>{
  if(!s||!day)return null;
  if(s.current&&s.current.day===day)return s.current;
  return fortuneHistoryOf(s).find(r=>r.day===day)||null;
};
const replaceFortuneRecord=(s,record)=>{
  if(!s||!record)return false;
  if(s.current.day===record.day){s.current=record;return true}
  const i=fortuneHistoryOf(s).findIndex(r=>r.day===record.day);
  if(i<0)return false;
  s.history=s.history.slice();s.history[i]=record;return true;
};

/* 반환값은 UI가 바로 쓰는 오늘 record뿐이다. 덱/used는 저장 wrapper 안에 숨긴다. */
const ensureFortuneForToday=(now,random)=>{
  const day=fortuneDayKey(now);
  let old=loadFortuneState();
  /* 이미 만든 현지 날짜면 current가 아니어도 그대로 돌려준다. current를 과거
     날짜로 바꾸면 used의 마지막 값과 달라지므로, 덱 장부는 건드리지 않는다. */
  const remembered=fortuneRecordForDay(old,day);
  if(remembered)return remembered;

  let deck=old?old.deck.slice():[];
  let used=old?old.used.slice():[];
  const history=old
    ?[old.current,...fortuneHistoryOf(old).filter(r=>r.day!==old.current.day)]
      .slice(0,FORTUNE_HISTORY_MAX)
    :[];
  const previousId=old&&old.lastKeywordId;
  const previousGap=old?old.sinceTension:6;
  let cycleStartGap=old?old.cycleStartGap:previousGap;
  if(!deck.length){
    deck=buildFortuneDeck(random,previousGap);
    used=[];
    cycleStartGap=previousGap;
    /* 한 바퀴를 전부 쓴 경계에서는 반복이 허용되지만, 바로 같은 단어가
       겹치는 것만은 피한다. 덱의 무반복 계약에는 영향을 주지 않는다. */
    if(deck[0]===previousId){
      /* 같은 intensity끼리만 바꿔야 tension 앞의 여섯 칸 간격이 보존된다. */
      const kind=FORTUNE_KEYWORD_BY_ID[deck[0]].intensity;
      const swap=deck.findIndex((id,i)=>i>0&&id!==previousId
        &&FORTUNE_KEYWORD_BY_ID[id].intensity===kind);
      if(swap>0)[deck[0],deck[swap]]=[deck[swap],deck[0]];
    }
  }
  const keywordId=deck.shift();
  used.push(keywordId);
  const intensity=FORTUNE_KEYWORD_BY_ID[keywordId].intensity;
  const sinceTension=intensity==="tension"?0:Math.min(6,previousGap+1);
  const current={
    day,
    who:pickFortune(NULL_FORTUNE_WHO,random),
    place:pickFortune(NULL_FORTUNE_PLACES,random),
    find:pickFortune(NULL_FORTUNE_FINDS,random),
    keywordId,
    revealed:false,
    seen:false,
  };
  saveFortuneState({v:FORTUNE_STATE_VERSION,deck,used,cycleStartGap,sinceTension,lastKeywordId:keywordId,current,history});
  return current;
};
const fortuneNeedsAutoOpen=(record,now)=>!!record&&record.day===fortuneDayKey(now)&&record.seen!==true;
const markFortuneSeen=(record,now)=>{
  const day=fortuneDayKey(now),current=ensureFortuneForToday(now);
  const s=loadFortuneState();
  if(!s)return current;
  /* stale UI record로 오늘 것을 덮지 않는다. record는 호출 의도를 확인하는 데만 쓴다. */
  if(record&&record.day!==day)return current;
  const saved=fortuneRecordForDay(s,day);
  if(!saved)return current;
  const next={...saved,seen:true};
  if(!replaceFortuneRecord(s,next))return current;
  saveFortuneState(s);
  return next;
};
/* 둘째 인자는 지금 **화면에 보이는 장**이다. 23:59에 연 창을 00:01에
   채웠다고 보이지 않는 새 날짜를 공개하면 안 된다. record가 없을 때만 기존
   호출 호환대로 현재 로컬 날짜의 장을 잡는다. */
const revealFortuneForToday=(now,record)=>{
  const current=fortuneRecordOk(record)?record:ensureFortuneForToday(now);
  const day=current.day;
  const s=loadFortuneState();
  if(!s)return current;
  const saved=fortuneRecordForDay(s,day);
  if(!saved)return current;
  const next={...saved,revealed:true};
  if(!replaceFortuneRecord(s,next))return current;
  saveFortuneState(s);
  return next;
};
/* 요청 조립부가 읽는 유일한 출구. 오늘 공개한 allowlisted id가 아니면 null이다. */
const currentFortuneKeywordId=(now)=>{
  const s=loadFortuneState(),day=fortuneDayKey(now);
  const record=fortuneRecordForDay(s,day);
  return record&&record.revealed===true&&FORTUNE_KEYWORD_BY_ID[record.keywordId]
    ?record.keywordId:null;
};

const EDIT_MAX=500;
const loadEdits=()=>{try{return JSON.parse(localStorage.getItem("null_edits"))||[]}catch(e){return[]}};
const saveEdits=a=>{try{localStorage.setItem("null_edits",JSON.stringify(a.slice(-EDIT_MAX)))}catch(e){}};
const loadMet=()=>{try{return JSON.parse(localStorage.getItem("null_met"))||[]}catch(e){return[]}};
const saveMet=a=>{try{localStorage.setItem("null_met",JSON.stringify(a));return true}catch(e){return false}};
const loadRefused=()=>{try{return JSON.parse(localStorage.getItem("null_refused"))||[]}catch(e){return[]}};
const saveRefused=a=>{try{localStorage.setItem("null_refused",JSON.stringify(a));return true}catch(e){return false}};
/* 눌러서 만드는 사건(선물·해금·약속) 말고, 그냥 쌓여서 되는 사건이 둘 있다.
   한 번씩만 찍는다 — 같은 일이 매일 나오면 그건 사건이 아니라 배경이다. */
const PHOTO_EVENT_AT=5;      // 재언에게 사진을 이만큼 받으면 강현이 눈치챈다
const DDAY_MARKS=[7,3,1];    // 남은 날이 이 값이 되는 날
/* ── 이미 새긴 사건 ──
   워커가 준 Effect.id를 적어둔다. 같은 응답을 두 번 처리해도(재시도·늦게
   온 답·새로고침) 결과가 한 번과 같으려면 이게 있어야 한다.

   상한을 둔다. 한 판에서 나올 수 있는 Effect는 자리 아이템 아홉과 초대
   몇 번이 전부지만, 재시도마다 request_id가 달라지므로 id는 그보다 는다.
   200이면 한 판을 다 돌고도 남는다 — 넘치면 오래된 것부터 버린다.
   버려진 id가 다시 와도 그때는 이미 가방에 있어서 takeItem이 막는다. */
/* ── 두 마디는 하고 나서 ──
   자리에 들르자마자 물건이 손에 들어오면 그건 받은 게 아니라 주운 것이다.
   웹과 앱이 **같은 숫자와 같은 셈**을 써야 한다 — 손으로 복제하면 갈린다.
   여기가 원본이고 rules.ts는 여기서 만들어진다.

   list를 반드시 넘긴다. 화면 상태(리액트 msgs)는 방금 친 말이 빠져 있어서,
   두 번째 발화에서 열려야 할 것이 세 번째부터 열렸다.
   ts든 created_at이든 받는다 — 웹은 ts, 앱은 created_at이다. */
const SCENE_MIN_TALK=2;
const countUserSaid=(sc,list)=>!sc?0:(list||[])
  .filter(m=>m&&!m.sys&&m.sender==="user"&&((m.ts||m.created_at||0)>=(sc.since||0))).length;
const talkedEnoughIn=(sc,list)=>countUserSaid(sc,list)>=SCENE_MIN_TALK;

const EFF_MAX=200;
const loadEffDone=()=>{try{const a=JSON.parse(localStorage.getItem("null_eff_done"));return Array.isArray(a)?a:[]}catch(e){return[]}};
const saveEffDone=a=>{try{
  localStorage.setItem("null_eff_done",JSON.stringify((a||[]).slice(-EFF_MAX)));return true;
}catch(e){return false}};

/* ── 답 하나는 한 덩어리다 ──
   전에는 말풍선을 0.6초마다 하나씩 화면 상태에 붙였고, 저장은 리액트가
   그림을 그린 뒤에야 따라왔다. 그런데 Effect 표(effect_done)와 장면 소모
   (ackScene)는 답이 오자마자 찍혔다. 그 사이에 새로고침하면 **장면은
   소모됐는데 답은 한 줄도 안 남은** 세이브가 된다. 초대는 더 나빴다 —
   표만 즉시 찍고 창은 타이머 뒤에 열어서, 그 전에 껐다 켜면 완료 표시만
   남고 초대는 영영 안 왔다.

   순서를 뒤집는다. 답이 오면 **먼저** 통째로 여기 적는다: 말풍선 전부,
   뒤따를 지문, 열어야 할 초대, 닫아야 할 자리. 그 다음에 장면을 지우고,
   화면은 적힌 것을 재생할 뿐이다. 재생 도중 꺼도 남은 것부터 다시 푼다.

   말풍선마다 id를 **적을 때** 박는다. 저장이 어디서 끊겨도 같은 id가 두
   번 붙지는 않는다 — 재생하기 전에 그 방에 이미 있는지 보면 된다.

   ── 상한을 두지 않는다 ──
   전에는 `slice(-8)`로 잘랐다. 이건 완료 기록이 아니라 **미완료 장부**다.
   아홉 번째가 들어올 때 제일 오래된 **아직 안 푼 답**이 조용히 사라졌다 —
   가방과 effect_done만 남고 「받았다」 지문이 없어지는 자리가 그거였다.
   다 푼 덩어리는 스스로 지워진다(dropBatch). 안 지워졌으면 아직 할 일이
   남은 것이므로 오래됐다는 이유로 버릴 근거가 없다. */
const okBatch=b=>!!b&&typeof b==="object"&&typeof b.id==="string"&&!!b.id;
/* 저장값이 깨져 있어도 앱을 죽이지 않는다 — 읽을 수 있는 것만 남긴다 */
const loadBatches=()=>{try{
  const a=JSON.parse(localStorage.getItem("null_batch"));
  if(!Array.isArray(a))return[];
  return a.filter(okBatch).map(b=>({...b,
    items:Array.isArray(b.items)?b.items.filter(i=>i&&i.id):[],
    sys:Array.isArray(b.sys)?b.sys.filter(s=>s&&s.id):[]}));
}catch(e){return[]}};
const saveBatches=a=>{try{
  localStorage.setItem("null_batch",JSON.stringify((a||[]).filter(okBatch)));return true;
}catch(e){return false}};
/* ── 이미 있는 id는 덮지 않는다 ──
   같은 답이 두 번 처리될 수 있다(늦게 온 답·재시도·되살아난 탭). 그때
   덮어쓰면 **반쯤 푼 상태가 처음으로 되돌아가** 이미 화면에 뜬 말풍선이
   한 번 더 뜬다. 있으면 그대로 두고 false를 돌려준다. */
const putBatch=b=>{
  const a=loadBatches();
  if(a.some(x=>x.id===b.id))return false;
  a.push(b); return saveBatches(a);
};
const getBatch=id=>loadBatches().find(x=>x.id===id)||null;
/* 그린 것 하나를 기록에서 뺀다. 갈래를 셋으로 가른다 —
   전에는 셋이 다 null이었다. 「이미 끝난 덩어리」와 「저장이 안 됐다」가
   같은 값이면, 저장 실패가 조용히 넘어가 그 방이 영영 잠긴다.

   missing        없는 덩어리다. 이미 끝났다 — 두 번 끝내지 않는다
   storage_error  안 뺐다. 뺐다고 치고 넘어가면 그 줄을 다시 못 푼다
   ok             뺐다. batch.items가 비었으면 마지막 말풍선이 방금 떴다 */
const dropBatchItem=(id,itemId)=>{
  const a=loadBatches(),b=a.find(x=>x.id===id);
  if(!b)return{status:"missing",batch:null};
  b.items=(b.items||[]).filter(i=>i&&i.id!==itemId);
  return saveBatches(a)?{status:"ok",batch:b}:{status:"storage_error",batch:b};
};
const dropBatch=id=>saveBatches(loadBatches().filter(x=>x.id!==id));
/* 한 덩어리에 든 말풍선의 id. 재생 전에 그 방에 이미 있는지 보는 자 */
const batchItemId=(id,i)=>id+"#"+i;

/* ── 초대는 화면 상태가 아니라 남는 상태다. 그리고 하나가 아니다 ──
   effect_done은 즉시 찍는데 초대는 setInvite()만 했다. 새로고침 한 번에
   「이미 처리했다」는 표만 남고 창은 사라진다 — 워커는 초대한 걸로 아는데
   유저에게는 물어본 적이 없는 게 된다.

   값 하나로 두면 두 방에서 초대가 겹칠 때 나중 것이 아직 답 안 한 앞의
   것을 덮는다. 재언의 편의점을 물어보기 전에 강현의 옥상이 오면 편의점은
   묻지도 못하고 사라진다. 줄로 세운다 — 앞엣것에 답해야 다음이 열린다. */
const loadInvites=()=>{try{
  const v=JSON.parse(localStorage.getItem("null_invite"));
  if(Array.isArray(v))return v.filter(x=>x&&x.place&&x.char);
  return v&&v.place&&v.char?[v]:[];   // 옛 단일 값도 읽는다
}catch(e){return[]}};
const saveInvites=a=>{try{
  const list=(a||[]).filter(x=>x&&x.place&&x.char);
  if(list.length)localStorage.setItem("null_invite",JSON.stringify(list));
  else localStorage.removeItem("null_invite");
  return true;
}catch(e){return false}};
const headInvite=()=>loadInvites()[0]||null;
/* 같은 초대가 두 번 들어오지 않는다 — 그건 같은 물음이다 */
const pushInvite=iv=>{
  const a=loadInvites();
  if(a.some(x=>x.place===iv.place&&x.char===iv.char))return true;
  a.push(iv); return saveInvites(a);
};
const shiftInvite=()=>{const a=loadInvites();a.shift();return saveInvites(a)};

const loadEvDone=()=>{try{return JSON.parse(localStorage.getItem("null_ev_done"))||[]}catch(e){return[]}};
const saveEvDone=a=>{try{localStorage.setItem("null_ev_done",JSON.stringify(a))}catch(e){}};
/* ── 한 번만 할 일에 이름표 ──
   방을 빨리 두 번 열면 첫 연락이 두 번 나갔다. 다 하고 나서 「했다」를
   찍으면 그 사이가 열린다 — 첫 번째가 아직 안 끝났을 때 두 번째가 들어와
   보면 표가 아직 없다. 그래서 표는 하기 전에 찍는다.
   대신 실패해도 그 일은 다시 안 온다. 정해진 줄을 그 자리에서 넣는 일에만
   쓴다 — 서버를 타는 일에는 안 쓴다. */
const markOnce=id=>{const a=loadEvDone();if(a.indexOf(id)>=0)return false;
  a.push(id);saveEvDone(a);return true};
const didOnce=id=>loadEvDone().indexOf(id)>=0;

/* ── 중요한 장면을 예약해둔다 ──
   서버는 상태를 안 들고 있으므로 「지금이 어떤 자리인지」는 여기서 말해줘야
   한다. 다만 아무 말이나 보내면 안 된다 — 서버가 허용된 사유 목록과 지금
   상태를 둘 다 보고 승인한다. 여기서는 방마다 한 번짜리로 적어두고,
   그 방의 다음 한 마디에 실어 보낸 뒤 지운다. */
const SCENE_REASONS = ["memory_reveal","null_identity","confession","irreversible",
  "partner_confirm","dday_choice","partner_first_reaction","partner_known",
  "parting","ending","conflict_result"];
/* ── 이야기 상태 (E3) ──
   이야기가 어디까지 왔나. 워커는 아무것도 기억하지 않으므로 여기가 원본이고,
   매 요청에 실어 보낸다. 바뀌는 길은 하나다 — 워커가 검증된 응답 뒤에 낸
   story_transition Effect를 장부가 적용하는 것. 클라이언트가 제 손으로
   explained/acknowledged를 찍는 자리는 없다.
     firstContact  unseen → pending → explained → recognized  강현의 병원 옥상
     jaeeonMemory  hidden → opened → acknowledged 재언의 20년 기억
     partnerKnown  {jaeeon,minhyun}               상대가 정해진 걸 아는가

   explained는 강현이 **말한** 자리고 recognized는 유저가 **받아들인** 자리다.
   둘을 한 칸으로 뭉치면 말한 순간 아는 사이가 되어, 유저가 계속 「누구세요」를
   쳐도 워커에 실리는 사실은 「이미 설명했다」 하나뿐이었다. */
const STORY_FC=["unseen","pending","explained","recognized"];
/* ── 학교에서 만났나 ──
   처음부터 교생인 걸 아는 게 아니다. 학교에서 만난 뒤부터 안다. 그 전까지는
   과거의 만남이 유저에 대해 아는 전부다.
   partnerKnown과 같은 모양이다 — 되돌릴 수 없고, 사람마다 따로 선다. */
const SCHOOL_PLACES=["학교","교실","보건실","옥상","체육관"];
const isSchoolPlace=place=>SCHOOL_PLACES.includes(place);
const STORY_JM=["hidden","opened","acknowledged"];
const loadStory=()=>{try{
  const o=JSON.parse(localStorage.getItem("null_story"))||{};
  const pk=o.partnerKnown||{};
  const sm=o.schoolMet||{};
  return{firstContact:STORY_FC.includes(o.firstContact)?o.firstContact:"unseen",
    jaeeonMemory:STORY_JM.includes(o.jaeeonMemory)?o.jaeeonMemory:"hidden",
    partnerKnown:{jaeeon:!!pk.jaeeon,minhyun:!!pk.minhyun},
    schoolMet:{jaeeon:!!sm.jaeeon,minhyun:!!sm.minhyun}};
}catch(e){return{firstContact:"unseen",jaeeonMemory:"hidden",
  partnerKnown:{jaeeon:false,minhyun:false},schoolMet:{jaeeon:false,minhyun:false}}}};
const saveStory=v=>{try{localStorage.setItem("null_story",JSON.stringify(v));return true}catch(e){return false}};
/* 앞으로만 간다. 이미 지나 있으면 한 것으로 친다 — 두 번 적용해도 같다.
   저장은 쓰고 나서 다시 읽어 확인한다(장부의 규칙 그대로). */
const applyStoryTransition=e=>{
  const list=e&&e.key==="firstContact"?STORY_FC:e&&e.key==="jaeeonMemory"?STORY_JM:null;
  if(!list||!list.includes(e.to))return"skip";
  const s=loadStory();
  if(list.indexOf(s[e.key])>=list.indexOf(e.to))return"done";   // 이미 지났다
  const next={...s,[e.key]:e.to};
  if(!saveStory(next)||loadStory()[e.key]!==e.to)return"fail";
  return"done";
};
/* partner_known 장면이 실제로 성공했을 때만 뒤집힌다 — 장부의 scene_ack
   단계가 부른다. 되풀이해도 같다. */
const markPartnerKnown=char=>{
  if(char!=="jaeeon"&&char!=="minhyun")return true;
  const s=loadStory();
  if(s.partnerKnown[char])return true;
  const next={...s,partnerKnown:{...s.partnerKnown,[char]:true}};
  return !!saveStory(next)&&loadStory().partnerKnown[char]===true;
};

/* 학교에서 만난 순간에만 선다. 되풀이해도 같다 — 되돌아가지 않는다 */
const markSchoolMet=char=>{
  if(char!=="jaeeon"&&char!=="minhyun")return true;
  const s=loadStory();
  if(s.schoolMet[char])return true;
  const next={...s,schoolMet:{...s.schoolMet,[char]:true}};
  return !!saveStory(next)&&loadStory().schoolMet[char]===true;
};

/* ── 공개 장부 — 출처가 실제로 말해진 사실 (§8.5 disclosure) ──
   {fact_id: ["jaeeon","minhyun"]}. 워커가 검증해 발행한 disclosure Effect가
   저장 트랜잭션(장부)에서만 여기 적히고, 다음 요청부터 payload.disclosed로
   실려 그 사실의 known_by가 넓어진다. 관측(봤다)과 공개(들었다)는 다른
   상태다 — 소유자가 회피한 턴에는 Effect가 없어 이 장부도 안 변한다. */
/* ── 관전 응답의 원자적 반영 — 웹·앱 공용 엔진 (§8.5) ──
   순서와 멱등을 코드로 강제하고, 저장은 어댑터가 한다. 이 엔진은 API를
   모른다 — 재개는 저장된 장부로만 하므로 재호출이 원리적으로 없다.

   순서: 말풍선 → Effect(공개 포함) → 사건 소모 → 장부 삭제.
   대화가 저장 확인이 안 되면 Effect로 못 간다 — 화면에 말이 없는데
   상태만 「아는 사람」이 되는 일이 없다. Effect가 안 남으면 사건을 안
   지운다. 한 단계라도 거짓이 오면 그 자리에서 멈추고 장부를 남긴다.

   어댑터 계약(웹은 finishBatch가 이 순서를 자체로 지키므로 이 엔진은
   앱이 쓴다 — rules.ts로 건너간다): 전부 「이미 되어 있으면 성공」이고
   성공 시 참을 준다.
     saveMsg(m)         말풍선 하나 저장 — 같은 id는 두 번 안 붙는다
     applyEffect(e)     Effect 하나 적용 — effect 장부(id) 멱등
     applyUnlocked(ks)  이번에 열린 히든 (없으면 안 불린다)
     ackEvent(id)       관전 사건 소모
     dropBatch(b)       그 항목만 줄에서 뺀다 */
const runAutoBatch=async(b,A)=>{
  if(!b)return true;
  for(const m of b.messages||[]){ if(!(await A.saveMsg(m)))return false; }
  for(const e of b.effects||[]){ if(!(await A.applyEffect(e)))return false; }
  /* 해금도 장부 안이다. 밖에 두면 장부가 한 번 막혔다 풀릴 때 말풍선과
     공개는 복구되는데 .hidden만 영영 안 열린다 — 그 방의 기록에는
     남았는데 열린 적이 없는 문이 된다. */
  if((b.unlocked||[]).length&&A.applyUnlocked
     &&!(await A.applyUnlocked(b.unlocked)))return false;
  if(b.event_id&&!(await A.ackEvent(b.event_id)))return false;
  return !!(await A.dropBatch(b));
};

/* ── 장부는 하나가 아니라 줄이다 — 방별 FIFO ──
   값 하나로 두면 앞엣것이 실패로 남아 있을 때 새 관전이 그걸 덮는다:
   아직 못 붙인 말풍선과 아직 안 적힌 공개가 통째로 사라지고, 소모되지
   않은 사건만 남아 같은 장면이 또 돈다. 줄로 세운다 — 적힌 차례대로
   풀고, 하나가 실패하면 그 자리에서 멈춘다. 뒤엣것은 그대로 남는다.
   웹 장부(null_batch)가 방마다 머리부터 푸는 것과 같은 규칙이다. */
const okAutoBatch=b=>!!b&&typeof b==="object"&&typeof b.id==="string"&&!!b.id;
/* 깨진 값에도 안 죽는다. 옛 단일 장부(객체 하나)도 읽어 줄로 올린다 */
const readAutoQueue=raw=>{
  try{
    const v=typeof raw==="string"?JSON.parse(raw||"[]"):raw;
    if(Array.isArray(v))return v.filter(okAutoBatch);
    return okAutoBatch(v)?[v]:[];
  }catch(e){return[]}
};
/* 같은 id는 두 번 안 들어간다 — 그건 같은 답이다 */
const pushAutoBatch=(list,b)=>{
  const a=readAutoQueue(list);
  return okAutoBatch(b)&&!a.some(x=>x.id===b.id)?[...a,b]:a;
};
/* 그 방의 줄을 순서대로 푼다. **남은 줄**을 돌려준다 — 빈 배열이면 다
   끝났다. 안 비었으면 그 방은 잠긴 채로 남고, 다음 부팅이 여기서 잇는다.
   이 함수도 API를 모른다 — 재개에 재호출이 원리적으로 없다. */
const runAutoQueue=async(list,A)=>{
  let left=readAutoQueue(list);
  while(left.length){
    if(!(await runAutoBatch(left[0],A)))return left;
    left=left.slice(1);
  }
  return left;
};

const loadDisclosed=()=>{try{return JSON.parse(localStorage.getItem("null_disclosed"))||{}}catch(e){return{}}};
const saveDisclosed=o=>{try{localStorage.setItem("null_disclosed",JSON.stringify(o));return true}catch(e){return false}};
const applyDisclosure=e=>{
  if(!e||e.type!=="disclosure"||!e.fact_id||!Array.isArray(e.heard_by)||!e.heard_by.length)return"skip";
  const d=loadDisclosed();
  const cur=d[e.fact_id]||[];
  const next=[...new Set([...cur,...e.heard_by.map(String)])];
  if(next.length===cur.length)return"done";            // 이미 반영 — 되풀이해도 같다
  const nd={...d,[e.fact_id]:next};
  if(!saveDisclosed(nd)||(loadDisclosed()[e.fact_id]||[]).length!==next.length)return"fail";
  return"done";
};

const loadScenePend=()=>{try{return JSON.parse(localStorage.getItem("null_scene_pend"))||{}}catch(e){return{}}};
const saveScenePend=o=>{try{localStorage.setItem("null_scene_pend",JSON.stringify(o));return true}catch(e){return false}};
const markScene=(room,reason)=>{
  if(SCENE_REASONS.indexOf(reason)<0)return;
  const o=loadScenePend(); o[room]=reason; saveScenePend(o);
};
/* ── 예약과 완료를 가른다 ──
   전에는 takeScene이 꺼내면서 지웠다. **요청을 보내기 전에** 지우는 것이라,
   그 요청이 실패하면 장면이 통째로 증발했다 — 고백도 기억 공개도 다시는
   안 온다. 한 번짜리인 것은 맞지만 「한 번 **성공**」이어야 한다.

   peekScene  읽기만 한다. 안 지운다.
   ackScene   검증된 답이 저장된 뒤에만 지운다. 그 방 것만 지운다. */
const peekScene=room=>loadScenePend()[room]||"";
const ackScene=(room,reason)=>{
  const o=loadScenePend();
  /* 그 사이에 다른 사유가 예약됐으면 그건 아직 안 끝난 것이다.
     지금 성공한 것만 지운다 — 남의 장면을 대신 지우지 않는다. */
  if(!o[room]||(reason&&o[room]!==reason))return false;
  delete o[room]; return saveScenePend(o);
};

/* ── 프로필 출처 ──
   YES를 누른 순간 등록값이 세계의 빈칸에 들어간다. 두 사람은 그 값을
   처음부터 알고 있다 — 등록 화면도 앱도 모르는 채로, 자기 기억으로는
   정말 처음부터 알던 것이다. 유저가 그걸 캐물으면 인물마다 딱 한 번
   이 두 마디가 나온다. 모델은 안 부른다: 현이 문구를 못박은 자리다.

   unasked → claimed_told → revealed_from_start

   오발이 제일 무섭다. 「어떻게 알아?」는 아무 데서나 나오는 말이라,
   인물이 방금 등록값을 입에 올린 바로 다음일 때만 연다. */
const ORIGIN_ASK=/어떻게\s*(그걸\s*)?(알|아세|아셨|압니|안\s*거)|어떻게\s*알았|그건?\s*어떻게|어디서\s*들|누가\s*(그래|말해|알려)|내가\s*말했/;
const ORIGIN_DENY=/내가\s*언제|말한\s*적\s*없|그런\s*적\s*없|언제\s*(알려줬|말했)|알려준\s*적\s*없|안\s*알려/;
const ORIGIN_TOLD="선생님이 알려줬잖아요.";
const ORIGIN_START="처음부터.";
const loadOrigin=()=>{try{return JSON.parse(localStorage.getItem("null_origin"))||{}}catch(e){return{}}};
const saveOrigin=o=>{try{localStorage.setItem("null_origin",JSON.stringify(o))}catch(e){}};
const originPhase=who=>loadOrigin()[who]||"unasked";
const setOriginPhase=(who,phase)=>{const o=loadOrigin();o[who]=phase;saveOrigin(o)};
/* 등록값이 그 말에 실제로 들어 있나. 값이 짧으면(한 글자) 아무 문장에나
   걸리므로 두 글자부터 본다 — 「나」가 취향이면 온 문장이 다 걸린다. */
const mentionsProfile=(text,profile,name)=>{
  const t=String(text||"");
  if(!t)return false;
  const vals=[];
  if(name)vals.push(name);
  ["subject","likes","dislikes"].forEach(k=>{
    String((profile||{})[k]||"").split(/[,·\/]/).forEach(v=>{
      const s=v.trim(); if(s.length>=2)vals.push(s);
    });
  });
  return vals.some(v=>t.indexOf(v)>=0);
};
/* 이번 유저 말에 무엇이 열리나. 안 열리면 빈 값이고, 그때는 평소대로
   모델이 답한다. prev는 그 방에서 인물이 방금 한 말이다. */
const originGate=(said,prev,who,profile,name)=>{
  if(!who||!prev)return null;
  const phase=originPhase(who);
  if(phase==="revealed_from_start")return null;
  const t=String(said||"");
  if(phase==="unasked"){
    if(!ORIGIN_ASK.test(t))return null;
    if(!mentionsProfile(prev,profile,name))return null;   // 방금 그 말이 아니면 안 연다
    return{line:ORIGIN_TOLD,next:"claimed_told"};
  }
  /* 두 번째는 방금 제가 한 말을 유저가 물고 늘어질 때만이다 */
  if(String(prev).indexOf(ORIGIN_TOLD)<0)return null;
  if(!ORIGIN_DENY.test(t))return null;
  return{line:ORIGIN_START,next:"revealed_from_start"};
};
/* ── 관전 사건은 줄을 선다 ──
   전에는 한 칸이었다. 선물을 연달아 둘 주면 앞엣것이 그냥 사라졌다 —
   그 사건에 대한 두 사람의 대화가 영영 안 나온다. 그리고 관전 API가
   실패해도 칸을 비워서 같은 이유로 사라졌다.
   줄로 바꾼다. 읽기(peek)와 지우기(ack)를 가른다. */
const loadAutoQ=()=>{try{const a=JSON.parse(localStorage.getItem("null_auto_q"));return Array.isArray(a)?a:[]}catch(e){return[]}};
const saveAutoQ=a=>{try{localStorage.setItem("null_auto_q",JSON.stringify((a||[]).slice(-20)));return true}catch(e){return false}};
/* 같은 사건은 같은 id다. 두 번 넣어도 하나다 — 화면을 두 번 눌러도
   두 사람이 같은 얘기를 두 번 하지 않는다. */
const evId=ev=>[ev.kind,ev.to||"",ev.name||""].join("|");
const pushAutoEvent=ev=>{
  const q=loadAutoQ(); const id=evId(ev);
  if(q.some(x=>x.id===id))return false;
  q.push({...ev,id,created_at:Date.now(),status:"pending"});
  return saveAutoQ(q);
};
/* 제일 오래된 것부터. created_at으로 안정된 순서를 지킨다 */
const peekAutoEvent=()=>{
  const q=loadAutoQ().filter(x=>x&&x.status!=="done");
  if(!q.length)return null;
  return q.slice().sort((a,b)=>(a.created_at||0)-(b.created_at||0))[0];
};
/* 그 하나만 지운다. 성공한 것 말고는 안 건드린다 */
const ackAutoEvent=id=>{
  const q=loadAutoQ(); const n=q.filter(x=>x&&x.id!==id);
  if(n.length===q.length)return false;
  return saveAutoQ(n);
};
const loadAutoAt=()=>{const v=+localStorage.getItem("null_auto_at");return v||0};
const saveAutoAt=t=>{try{localStorage.setItem("null_auto_at",String(t))}catch(e){}};
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));
  return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};

/* ── 사진첩(Cam) ──
   처음부터 다 보여주면 앨범이 아니라 목록이다. 실제로 본 것만 한 장씩 꽂힌다.

   받은 사진은 대화 기록에서 그대로 뽑는다 — 별도 저장이 없다.
   그런데 자리 사진(SCENE_SHOT)은 말풍선이 아니라 화면 배경이라 기록에 안
   남는다. gallery에는 들어 있으면서(jaeeon-laundry·minhyun-nap 같은 것들)
   영영 안 열리는 칸이었다. 빨래방에서 그 사람을 마주 보고 앉아 있었는데
   사진첩에는 없는 것이다. 본 것도 모은다 — 이건 기록에 없으니 따로 적어둔다. */
const loadShots=()=>{try{return JSON.parse(localStorage.getItem("null_shots")||"[]")}catch(e){return[]}};
/* sceneShot은 파일명(.webp까지)을 돌려주는데, 말풍선 사진(m.photo)은 확장자
   없는 열쇠다. 그대로 담아두니 cam이 gallery의 열쇠와 맞대볼 때 영영 안 맞았다
   — 자리 배경은 한 번도 사진첩에 안 떴다. 담을 때 확장자를 뗀다.
   시험은 확장자 없이 넣고 있어서 이걸 못 잡았다(F.stampShot('jaeeon-laundry')). */
const stampShot=key=>{try{
  const k=(key||"").toString().replace(/\.webp$/,"");
  if(!k)return;
  const a=loadShots(); if(a.includes(k))return;
  localStorage.setItem("null_shots",JSON.stringify([...a,k]));
}catch(e){}};
function seenPhotos(msgs){
  const set=new Set();
  Object.values(msgs||{}).forEach(list=>(list||[]).forEach(m=>{if(m.photo)set.add(m.photo)}));
  /* 이미 .webp가 붙은 채로 저장된 것이 있다. 읽을 때도 떼어 맞춘다 */
  loadShots().forEach(k=>set.add(String(k).replace(/\.webp$/,"")));
  return set;
}



return {
  loadKey,
  apiUrl,
  AV_V,
  CHARS,
  ENROLL_DAYS,
  loadWorld,
  saveWorld,
  loadPartner,
  savePartner,
  legacyMode,
  loadMode,
  saveMode,
  speedOn,
  firstTsOf,
  SPEED_RATE,
  ACCESS_CLOCK_KEY,
  ACCESS_CLOCK_V,
  WORLD_ANCHOR,
  setWorldAt,
  asEpoch,
  accessDayKey,
  cleanAccessClock,
  loadAccessClock,
  saveAccessClock,
  startAccessClock,
  legacyElapsed,
  migrateAccessClock,
  touchAccessClock,
  accessElapsed,
  accessElapsedAt,
  accessMilestoneAt,
  gameAt,
  worldStart,
  worldNow,
  worldDays,
  worldDaysOf,
  nowClock,
  DEV_TIME,
  devAddDay,
  devToLeft,
  loadExtend,
  SYS1_AFTER,
  sys1Due,
  DIARY_PAPER_IMG,
  DIARY_HEAD,
  DIARY_LINES,
  DIARY_TAIL_A,
  DIARY_TAIL_B,
  DIARY_MAX,
  loadDiary,
  saveDiary,
  FLASH_FRONT,
  FLASH_BACK,
  FLASH_ALT,
  FLASH_KEYS,
  FLASH_BOX,
  FLASH_MAX,
  FLASH_RISE,
  FLASH_HOLD,
  FLASH_TURN,
  loadFlash,
  saveFlash,
  MY_DIARY_IMG,
  MY_DIARY,
  myDiaryParts,
  myDiarySystemOwned,
  myDiaryAuto,
  loadMyDiary,
  saveMyDiary,
  myDiaryOpen,
  userPics,
  FLASH_SAY_A,
  FLASH_SAY_B,
  flashSayLine,
  flashSaid,
  markFlashSaid,
  loadFirstMet,
  saveFirstMet,
  unmetOne,
  loadSys1,
  loadGetcha,
  saveGetcha,
  saveSys1,
  daysLeft,
  daysSince,
  leaveTsOf,
  cameBackAt,
  dLeftAt,
  CALL_PER_LETTER,
  countCalls,
  filledLetters,
  ROOMS,
  roomOf,
  AV,
  av,
  PHOTO_FILES,
  photoSrc,
  HIDDEN,
  HIDDEN_LABEL,
  HID_MAX,
  hidMask,
  hidNorm,
  hidGuess,
  GIFT_WISH_MAX,
  GIFT_NOTE_A,
  GIFT_NOTE_B,
  giftNote,
  GIFTS,
  GIFT_CATS,
  CAT_EN,
  HEART_PER,
  heartsOf,
  GIFT_NAME,
  GIFT_AT,
  loadGifts,
  saveGifts,
  loadUnlocked,
  saveUnlocked,
  loadSeenStage,
  saveSeenStage,
  rgba,
  loadStore,
  saveStore,
  loadProfile,
  DEMO,
  AWAKE,
  forcedAwake,
  demoOn,
  demoClose,
  demoReply,
  demoUnlocked,
  demoAsk,
  demoGiftKey,
  fmtClock,
  isToday,
  fmtDivider,
  isNarr,
  fmtListTime,
  MON,
  fmtDay,
  dividerGap,
  timeWord,
  dayWord,
  seasonWord,
  canGreet,
  asleep,
  allAsleep,
  bothAwake,
  OPENINGS,
  WEND_OPEN,
  openingFor,
  weekNo,
  isYajaWeek,
  isYajaDay,
  PERIODS,
  presence,
  HEAT,
  heatRing,
  AUTO_COOL,
  AUTO_AWAY,
  AUTO_MAX_DAY,
  loadAutoDay,
  saveAutoDay,
  PLACES,
  SPOTS,
  PLACE_BG,
  PLACE_BY,
  CAB_SLOT,
  CAB_COL,
  CAB_ROW,
  CAB_DOOR_W,
  TV_QUAD,
  TV_QUAD_W,
  TV_QUAD_H,
  ROAD_LABEL,
  ITEMS,
  ITEM_CATS,
  LEAVE_AT,
  DAY_SLOTS,
  WEND_SLOTS,
  isWend,
  daySlots,
  slotNow,
  nowLabel,
  dailyStampKey,
  dayKey,
  loadDaySeen,
  saveDaySeen,
  loadGiftDay,
  saveGiftDay,
  giftedToday,
  stampGift,
  loadWend,
  saveWend,
  jos,
  loadBag,
  saveBag,
  placeOpen,
  placeHours,
  KISS_SHOT,
  kissShot,
  loadKissSeen,
  saveKissSeen,
  kissNext,
  KISS_CUTS,
  kissCuts,
  KISS_RUN,
  KISS_OUT,
  KISS_RISE,
  KISS_HOLD,
  SCENE_SHOT,
  WAY,
  WAY_BG,
  wayOK,
  loadWay,
  saveWay,
  sceneShot,
  sceneOver,
  loadGone,
  saveGone,
  goneToday,
  stampGone,
  AT_WORK,
  freeOut,
  whoOut,
  outAt,
  atWorkNow,
  LOCK_LINES,
  SOON_LINES,
  WAIT_LINES,
  worksLaterToday,
  roomLock,
  canGoWith,
  GROUP_AT,
  loadGroupOn,
  saveGroupOn,
  groupReady,
  roomsOn,
  giftSpots,
  wendOnlyOk,
  canGoNow,
  placeWhen,
  placeNeed,
  loadScene,
  saveScene,
  FORTUNE_STORAGE_KEY,
  FORTUNE_STATE_VERSION,
  FORTUNE_HISTORY_MAX,
  NULL_FORTUNE_KEYWORDS,
  FORTUNE_KEYWORD_BY_ID,
  NULL_FORTUNE_WHO,
  NULL_FORTUNE_PLACES,
  NULL_FORTUNE_FINDS,
  fortuneDayKey,
  fortuneRandom,
  shuffleFortune,
  fortuneTensionGap,
  buildFortuneDeck,
  fortuneRecordOk,
  fortuneSequenceGap,
  fortuneDeckStateOk,
  loadFortuneState,
  saveFortuneState,
  pickFortune,
  fortuneHistoryOf,
  fortuneRecordForDay,
  replaceFortuneRecord,
  ensureFortuneForToday,
  fortuneNeedsAutoOpen,
  markFortuneSeen,
  revealFortuneForToday,
  currentFortuneKeywordId,
  EDIT_MAX,
  loadEdits,
  saveEdits,
  loadMet,
  saveMet,
  loadRefused,
  saveRefused,
  PHOTO_EVENT_AT,
  DDAY_MARKS,
  SCENE_MIN_TALK,
  countUserSaid,
  talkedEnoughIn,
  EFF_MAX,
  loadEffDone,
  saveEffDone,
  okBatch,
  loadBatches,
  saveBatches,
  putBatch,
  getBatch,
  dropBatchItem,
  dropBatch,
  batchItemId,
  loadInvites,
  saveInvites,
  headInvite,
  pushInvite,
  shiftInvite,
  loadEvDone,
  saveEvDone,
  markOnce,
  didOnce,
  SCENE_REASONS,
  STORY_FC,
  SCHOOL_PLACES,
  isSchoolPlace,
  STORY_JM,
  loadStory,
  saveStory,
  applyStoryTransition,
  markPartnerKnown,
  markSchoolMet,
  runAutoBatch,
  okAutoBatch,
  readAutoQueue,
  pushAutoBatch,
  runAutoQueue,
  loadDisclosed,
  saveDisclosed,
  applyDisclosure,
  loadScenePend,
  saveScenePend,
  markScene,
  peekScene,
  ackScene,
  ORIGIN_ASK,
  ORIGIN_DENY,
  ORIGIN_TOLD,
  ORIGIN_START,
  loadOrigin,
  saveOrigin,
  originPhase,
  setOriginPhase,
  mentionsProfile,
  originGate,
  loadAutoQ,
  saveAutoQ,
  evId,
  pushAutoEvent,
  peekAutoEvent,
  ackAutoEvent,
  loadAutoAt,
  saveAutoAt,
  mmss,
  loadShots,
  stampShot,
  seenPhotos,
};
}

const __rules: any = __build();
export const {
  loadKey,
  apiUrl,
  AV_V,
  CHARS,
  ENROLL_DAYS,
  loadWorld,
  saveWorld,
  loadPartner,
  savePartner,
  legacyMode,
  loadMode,
  saveMode,
  speedOn,
  firstTsOf,
  SPEED_RATE,
  ACCESS_CLOCK_KEY,
  ACCESS_CLOCK_V,
  WORLD_ANCHOR,
  setWorldAt,
  asEpoch,
  accessDayKey,
  cleanAccessClock,
  loadAccessClock,
  saveAccessClock,
  startAccessClock,
  legacyElapsed,
  migrateAccessClock,
  touchAccessClock,
  accessElapsed,
  accessElapsedAt,
  accessMilestoneAt,
  gameAt,
  worldStart,
  worldNow,
  worldDays,
  worldDaysOf,
  nowClock,
  DEV_TIME,
  devAddDay,
  devToLeft,
  loadExtend,
  SYS1_AFTER,
  sys1Due,
  DIARY_PAPER_IMG,
  DIARY_HEAD,
  DIARY_LINES,
  DIARY_TAIL_A,
  DIARY_TAIL_B,
  DIARY_MAX,
  loadDiary,
  saveDiary,
  FLASH_FRONT,
  FLASH_BACK,
  FLASH_ALT,
  FLASH_KEYS,
  FLASH_BOX,
  FLASH_MAX,
  FLASH_RISE,
  FLASH_HOLD,
  FLASH_TURN,
  loadFlash,
  saveFlash,
  MY_DIARY_IMG,
  MY_DIARY,
  myDiaryParts,
  myDiarySystemOwned,
  myDiaryAuto,
  loadMyDiary,
  saveMyDiary,
  myDiaryOpen,
  userPics,
  FLASH_SAY_A,
  FLASH_SAY_B,
  flashSayLine,
  flashSaid,
  markFlashSaid,
  loadFirstMet,
  saveFirstMet,
  unmetOne,
  loadSys1,
  loadGetcha,
  saveGetcha,
  saveSys1,
  daysLeft,
  daysSince,
  leaveTsOf,
  cameBackAt,
  dLeftAt,
  CALL_PER_LETTER,
  countCalls,
  filledLetters,
  ROOMS,
  roomOf,
  AV,
  av,
  PHOTO_FILES,
  photoSrc,
  HIDDEN,
  HIDDEN_LABEL,
  HID_MAX,
  hidMask,
  hidNorm,
  hidGuess,
  GIFT_WISH_MAX,
  GIFT_NOTE_A,
  GIFT_NOTE_B,
  giftNote,
  GIFTS,
  GIFT_CATS,
  CAT_EN,
  HEART_PER,
  heartsOf,
  GIFT_NAME,
  GIFT_AT,
  loadGifts,
  saveGifts,
  loadUnlocked,
  saveUnlocked,
  loadSeenStage,
  saveSeenStage,
  rgba,
  loadStore,
  saveStore,
  loadProfile,
  DEMO,
  AWAKE,
  forcedAwake,
  demoOn,
  demoClose,
  demoReply,
  demoUnlocked,
  demoAsk,
  demoGiftKey,
  fmtClock,
  isToday,
  fmtDivider,
  isNarr,
  fmtListTime,
  MON,
  fmtDay,
  dividerGap,
  timeWord,
  dayWord,
  seasonWord,
  canGreet,
  asleep,
  allAsleep,
  bothAwake,
  OPENINGS,
  WEND_OPEN,
  openingFor,
  weekNo,
  isYajaWeek,
  isYajaDay,
  PERIODS,
  presence,
  HEAT,
  heatRing,
  AUTO_COOL,
  AUTO_AWAY,
  AUTO_MAX_DAY,
  loadAutoDay,
  saveAutoDay,
  PLACES,
  SPOTS,
  PLACE_BG,
  PLACE_BY,
  CAB_SLOT,
  CAB_COL,
  CAB_ROW,
  CAB_DOOR_W,
  TV_QUAD,
  TV_QUAD_W,
  TV_QUAD_H,
  ROAD_LABEL,
  ITEMS,
  ITEM_CATS,
  LEAVE_AT,
  DAY_SLOTS,
  WEND_SLOTS,
  isWend,
  daySlots,
  slotNow,
  nowLabel,
  dailyStampKey,
  dayKey,
  loadDaySeen,
  saveDaySeen,
  loadGiftDay,
  saveGiftDay,
  giftedToday,
  stampGift,
  loadWend,
  saveWend,
  jos,
  loadBag,
  saveBag,
  placeOpen,
  placeHours,
  KISS_SHOT,
  kissShot,
  loadKissSeen,
  saveKissSeen,
  kissNext,
  KISS_CUTS,
  kissCuts,
  KISS_RUN,
  KISS_OUT,
  KISS_RISE,
  KISS_HOLD,
  SCENE_SHOT,
  WAY,
  WAY_BG,
  wayOK,
  loadWay,
  saveWay,
  sceneShot,
  sceneOver,
  loadGone,
  saveGone,
  goneToday,
  stampGone,
  AT_WORK,
  freeOut,
  whoOut,
  outAt,
  atWorkNow,
  LOCK_LINES,
  SOON_LINES,
  WAIT_LINES,
  worksLaterToday,
  roomLock,
  canGoWith,
  GROUP_AT,
  loadGroupOn,
  saveGroupOn,
  groupReady,
  roomsOn,
  giftSpots,
  wendOnlyOk,
  canGoNow,
  placeWhen,
  placeNeed,
  loadScene,
  saveScene,
  FORTUNE_STORAGE_KEY,
  FORTUNE_STATE_VERSION,
  FORTUNE_HISTORY_MAX,
  NULL_FORTUNE_KEYWORDS,
  FORTUNE_KEYWORD_BY_ID,
  NULL_FORTUNE_WHO,
  NULL_FORTUNE_PLACES,
  NULL_FORTUNE_FINDS,
  fortuneDayKey,
  fortuneRandom,
  shuffleFortune,
  fortuneTensionGap,
  buildFortuneDeck,
  fortuneRecordOk,
  fortuneSequenceGap,
  fortuneDeckStateOk,
  loadFortuneState,
  saveFortuneState,
  pickFortune,
  fortuneHistoryOf,
  fortuneRecordForDay,
  replaceFortuneRecord,
  ensureFortuneForToday,
  fortuneNeedsAutoOpen,
  markFortuneSeen,
  revealFortuneForToday,
  currentFortuneKeywordId,
  EDIT_MAX,
  loadEdits,
  saveEdits,
  loadMet,
  saveMet,
  loadRefused,
  saveRefused,
  PHOTO_EVENT_AT,
  DDAY_MARKS,
  SCENE_MIN_TALK,
  countUserSaid,
  talkedEnoughIn,
  EFF_MAX,
  loadEffDone,
  saveEffDone,
  okBatch,
  loadBatches,
  saveBatches,
  putBatch,
  getBatch,
  dropBatchItem,
  dropBatch,
  batchItemId,
  loadInvites,
  saveInvites,
  headInvite,
  pushInvite,
  shiftInvite,
  loadEvDone,
  saveEvDone,
  markOnce,
  didOnce,
  SCENE_REASONS,
  STORY_FC,
  SCHOOL_PLACES,
  isSchoolPlace,
  STORY_JM,
  loadStory,
  saveStory,
  applyStoryTransition,
  markPartnerKnown,
  markSchoolMet,
  runAutoBatch,
  okAutoBatch,
  readAutoQueue,
  pushAutoBatch,
  runAutoQueue,
  loadDisclosed,
  saveDisclosed,
  applyDisclosure,
  loadScenePend,
  saveScenePend,
  markScene,
  peekScene,
  ackScene,
  ORIGIN_ASK,
  ORIGIN_DENY,
  ORIGIN_TOLD,
  ORIGIN_START,
  loadOrigin,
  saveOrigin,
  originPhase,
  setOriginPhase,
  mentionsProfile,
  originGate,
  loadAutoQ,
  saveAutoQ,
  evId,
  pushAutoEvent,
  peekAutoEvent,
  ackAutoEvent,
  loadAutoAt,
  saveAutoAt,
  mmss,
  loadShots,
  stampShot,
  seenPhotos,
} = __rules;
