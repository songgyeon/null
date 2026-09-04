/* NULL web · viewport, API, characters, world clock
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
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
const {useState,useEffect,useRef} = React;
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
