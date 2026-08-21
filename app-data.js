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
const AV_V = "?v=4";

/* 캐릭터 / 방 정의 */
const CHARS = {
  jaeeon:{name:"이재언",color:"#7FD8D8",dk:"#2fa8a0",pale:"#cef0ee",img:"jaeeon-profile.webp",zoom:"150%",pos:"50% 22%",
    gallery:["jaeeon-work.webp","jaeeon-chart.webp","jaeeon-cook.webp","jaeeon-rooftop.webp","jaeeon-shelf.webp","jaeeon-laundry.webp","jaeeon-driveseat.webp","jaeeon-conv.webp","jaeeon-record.webp"]},
  minhyun:{name:"이민현",color:"#FF9E80",dk:"#f0764a",pale:"#ffe0d2",img:"minhyun-profile.webp",zoom:"150%",pos:"50% 22%",
    gallery:["minhyun-candy.webp","minhyun-corridor.webp","minhyun-rain.webp","minhyun-gate.webp","minhyun-morning.webp","minhyun-alley.webp","minhyun-gym.webp","minhyun-busstop.webp","minhyun-winter.webp","minhyun-snow.webp","minhyun-bench.webp","minhyun-desk.webp","minhyun-stair.webp","minhyun-vending.webp","minhyun-laundry.webp","minhyun-conv.webp","minhyun-nap.webp","minhyun-neon.webp","minhyun-ramen.webp","minhyun-window.webp","minhyun-mirror.webp"]},
};
/* 교생 실습 기간. etc.의 D-카운트가 여기서 나온다 */
const ENROLL_DAYS = 30;
/* ── 두 시계 ──
   리얼 모드는 진짜 달력을 본다. 하루가 진짜 하루고, 30일을 실제로 살아야
   끝이 난다 — 「당신이 말하지 않아도 세계는 돌아갑니다」를 진짜로 만드는 게
   이 시계다. 대신 링크를 받고 십 분 놀다 가는 사람은 D-30·hidden 0/18에서
   멈춘다. 제일 공들인 것이 제일 안 보인다.

   스피드 모드는 쌓인 대화를 날로 센다. 사다리를 새로 놓을 필요가 없었다 —
   원래 숫자가 이미 「하루에 네 마디」로 놓여 있었다:
     at   12  26  44  64  90  116
     day   3   7  11  15  20   26      ≒ at ÷ 4
   그 전제를 그대로 공식으로 쓴다. 리얼 모드에서 30일 걸려 닿는 자리에
   같은 대화량으로 닿는다.

   바뀌는 것은 「실습이 얼마나 진행됐나」뿐이다. 「지금 몇 시인가」는 안 바뀐다 —
   잠도 시간표도 자리 여는 시각도 진짜 시계 그대로다. 세계는 계속 진짜 시간에
   산다. 모드는 판마다 하나고 등록 화면에서 한 번 고른다. 중간에 바꾸면
   D-N이 튄다. */
const SPEED_PER_DAY=4;
const loadMode=()=>{try{return localStorage.getItem("null_mode")==="speed"?"speed":"real"}catch(e){return"real"}};
const saveMode=v=>{try{localStorage.setItem("null_mode",v==="speed"?"speed":"real")}catch(e){}};
const speedOn=()=>loadMode()==="speed";
/* 제일 많이 나눈 방으로 센다. 해금은 방마다 at을 따로 보므로, 한쪽만 파도
   다른 방 것은 그 방 대화 수가 막는다 — 날짜만 앞서가도 안 열린다.

   단톡도 센다. 전에는 1:1 둘만 셌더니 스피드 모드에서 단톡에만 있으면
   시계가 통째로 멈췄다 — 백스무 마디를 떠들어도 지난 날이 그대로고, 그러니
   가상 시계도 안 돌아 같은 시각·같은 요일에 얼어붙는다. 그러다 1:1로 옮겨
   몇 마디 하면 시간이 훅 뛴다. 유저가 말을 한 방은 다 세야 시계가 안 꼬인다.

   관전(health)은 뺀다. 그건 유저가 말한 게 아니라 자리를 비운 사이에
   자동으로 찍힌 것이라, 그걸로 날이 가면 안 켜고 둔 시간이 진도가 된다. */
const speedCountOf=store=>{const m=(store&&store.msgs)||{};
  return Math.max((m.jaeeon||[]).length,(m.minhyun||[]).length,(m.group||[]).length)};
const speedDaysOf=store=>Math.floor(speedCountOf(store)/SPEED_PER_DAY);
/* 시계가 출발하는 자리. 첫 마디가 있던 날이다 */
const firstTsOf=store=>Object.values((store&&store.msgs)||{}).flat()
  .reduce((a,x)=>!a||(x&&x.ts<a)?(x&&x.ts)||a:a,0);
/* ── 스피드 모드의 시계 ──
   처음엔 날짜만 당기고 시각은 진짜 시계를 그대로 뒀다. 그런데 스피드 모드는
   한 판이 실제 이십 분이다 — 새벽 세 시에 시작하면 판이 끝날 때까지 새벽
   세 시고, 재언은 1시~4:30 자니까 한 번도 안 깬다. 시간표도 안 돌고 학교도
   내내 닫혀 있다. 세계가 한 장면에 멈춘다.
   그래서 시각도 진행을 따라 돈다. 첫 마디가 있던 날 아침 일곱 시에서
   출발해서 한 마디에 (하루 ÷ SPEED_PER_DAY)씩 간다. 날 수가 speedDaysOf와
   저절로 같아진다 — floor((지금-출발)/하루) = floor(n/SPEED_PER_DAY).
   규칙들(잠·시간표·자리 여는 시각·주말)이 전부 이 시계 하나를 본다.
   말풍선에 찍히는 시각은 진짜 시각 그대로다. 그건 진짜로 일어난 일이다.

   앱이 store가 바뀔 때마다 넣어준다 — 이 함수들은 시각만 받는 순수 함수라
   대화 수를 스스로 볼 수 없다. */
/* 출발 시각이 네 칸의 자리를 정한다. 일곱 시로 두면 7·13·19·1시가 되는데
   일곱 시엔 민현이 자고(4:30~8) 한 시엔 재언이 자서 네 칸 중 둘이 반쪽이다.
   여덟 시면 8·14·20·2시다 — 출근·수업·저녁·밤에 얹히고, 자는 사람이 있는
   칸은 밤 하나뿐이다. 그 한 칸도 민현은 깨 있다(22~4:30). */
const SPEED_START_HOUR=8;
let SPEED_N=0, SPEED_ANCHOR=0;
const setSpeedAt=(n,firstTs)=>{
  SPEED_N=Math.max(0,Math.floor(Number(n)||0));
  SPEED_ANCHOR=Number(firstTs)||0;
};
const speedDay=()=>Math.floor(SPEED_N/SPEED_PER_DAY);
const speedNow=()=>{
  const a=new Date(SPEED_ANCHOR||Date.now());
  a.setHours(SPEED_START_HOUR,0,0,0);
  return new Date(a.getTime()+SPEED_N*(864e5/SPEED_PER_DAY));
};
/* 세계가 보는 지금. 리얼 모드면 진짜 지금이다 */
const nowClock=()=>speedOn()?speedNow():new Date();
/* D-0에 "계속 살아갈까"에 y를 누르면 한 달이 더 붙는다 */
const loadExtend=()=>{try{return +localStorage.getItem("null_extend")||0}catch(e){return 0}};
/* 첫날의 통보. 하루가 끝나기 전에 판돈을 알려준다 — 방법은 빼고.
   「24시간 안에」로 잡으면 그 시간에 앱을 안 연 사람에게는 영영 안 뜬다.
   스무 시간이 지난 뒤 처음 여는 순간에 한 번만 띄운다. */
const SYS1_AFTER = 20*60*60*1000;
const loadSys1=()=>{try{return localStorage.getItem("null_sys1")==="1"}catch(e){return false}};
const saveSys1=()=>{try{localStorage.setItem("null_sys1","1")}catch(e){}};
const daysLeft=store=>{
  const span=ENROLL_DAYS+loadExtend();
  if(speedOn())return Math.max(0,span-speedDaysOf(store));
  const all=Object.values((store&&store.msgs)||{}).flat();
  const first=all.reduce((a,m)=>!a||m.ts<a?m.ts:a,0);
  return first?Math.max(0,span-Math.floor((Date.now()-first)/864e5)):span;
};
/* 첫 대화로부터 며칠 지났나. 단계와 해금이 이걸 같이 본다 */
const daysSince=store=>{
  if(speedOn())return speedDaysOf(store);
  const all=Object.values((store&&store.msgs)||{}).flat();
  const first=all.reduce((a,m)=>!a||m.ts<a?m.ts:a,0);
  return first?Math.floor((Date.now()-first)/864e5):0;
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
  {id:"minhyun",name:"이민현", color:"#FF9E80", type:"dm",    sub:"3학년",      empty:"고등학생, 20세"},
  {id:"group",  name:"단톡방", color:"#B8A5E3", type:"group", sub:"group chat", empty:"loading..."},
  {id:"health", name:"두 사람", color:"#9aa3d8", type:"watch", sub:"LIVE cam",  empty:"access denied"},
];
const roomOf = id => ROOMS.find(r=>r.id===id);

/* 사진: 백엔드가 보내는 key ↔ 실제 파일(key.webp). 목록에 없는 key는 무시한다. */
const PHOTO_FILES={};
Object.values(CHARS).forEach(c=>c.gallery.forEach(f=>{PHOTO_FILES[f.replace(/\.webp$/,"")]=f}));
const photoSrc = k => (k&&PHOTO_FILES[k])||null;

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
  {key:"minhyun-bag",            file:"minhyun-bag.webp",            label:"민현의 가방", room:"minhyun", at:12, day:0},
  {key:"jaeeon-room",            file:"jaeeon-room.webp",            label:"재언의 방", room:"jaeeon", at:26, day:3},
  {key:"minhyun-room",           file:"minhyun-room.webp",           label:"민현의 방", room:"minhyun", at:26, day:3},
  {key:"jaeeon-playlist",        file:"jaeeon-playlist.webp",        label:"재언의 플레이리스트", room:"jaeeon", at:44, day:6},
  {key:"minhyun-playlist",       file:"minhyun-playlist.webp",       label:"민현의 플레이리스트", room:"minhyun", at:44, day:6},
  {key:"jaeeon-ticket",          file:"jaeeon-ticket.webp",          label:"재언의 티켓", room:"jaeeon", at:64, day:9},
  {key:"minhyun-ticket",         file:"minhyun-ticket.webp",         label:"민현의 티켓", room:"minhyun", at:64, day:9},
  {key:"jaeeon-yearbook",        file:"jaeeon-yearbook.webp",        label:"재언의 졸업사진", room:"jaeeon", at:90, day:13},
  {key:"minhyun-yearbook",       file:"minhyun-yearbook.webp",       label:"민현의 졸업사진", room:"minhyun", at:90, day:13},
  {key:"hidden-jaeeon-diary-200x-03-07", file:"hidden-jaeeon-diary-200x-03-07.webp", label:"재언의 일기 · 3월 7일", room:"jaeeon", at:100, day:17},
  {key:"hidden-minhyun-counseling-record-1-a4", file:"hidden-minhyun-counseling-record-1-a4.webp", label:"민현 상담 기록 · 1", room:"minhyun", at:100, day:17},
  {key:"hidden-jaeeon-diary-200x-04-12", file:"hidden-jaeeon-diary-200x-04-12.webp", label:"재언의 일기 · 4월 12일", room:"jaeeon", at:106, day:20},
  {key:"hidden-minhyun-counseling-record-2-a4", file:"hidden-minhyun-counseling-record-2-a4.webp", label:"민현 상담 기록 · 2", room:"minhyun", at:106, day:20},
  {key:"hidden-jaeeon-diary-201x-07-11", file:"hidden-jaeeon-diary-201x-07-11.webp", label:"재언의 일기 · 7월 11일", room:"jaeeon", at:112, day:23},
  {key:"hidden-minhyun-sns-1", file:"hidden-minhyun-sns-1.webp", label:"@mhy.wav · 1", room:"minhyun", at:112, day:23},
  {key:"hidden-jaeeon-diary-202x-start", file:"hidden-jaeeon-diary-202x-start.webp", label:"재언의 일기 · 202X년", room:"jaeeon", at:116, day:26},
  {key:"hidden-minhyun-sns-2", file:"hidden-minhyun-sns-2.webp", label:"@mhy.wav · 2", room:"minhyun", at:116, day:26},
];
const HIDDEN_LABEL={};HIDDEN.forEach(h=>{HIDDEN_LABEL[h.key]=h.label});

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
const GIFT_HINT={jaeeon:"“…뭐 이런 걸.”", minhyun:"“이걸 왜 줘요.”"};
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
const saveGifts=g=>{try{localStorage.setItem("null_gifts",JSON.stringify(g))}catch(e){}};
const loadUnlocked=()=>{try{return JSON.parse(localStorage.getItem("null_unlocked"))||[]}catch(e){return[]}};
const saveUnlocked=a=>{try{localStorage.setItem("null_unlocked",JSON.stringify(a))}catch(e){}};
/* 프로필을 마지막으로 본 단계. 지금 단계가 이보다 높으면 목록에 표시가 붙는다. */
const loadSeenStage=()=>{try{return JSON.parse(localStorage.getItem("null_seen_stage"))||{}}catch(e){return{}}};
const saveSeenStage=o=>{try{localStorage.setItem("null_seen_stage",JSON.stringify(o))}catch(e){}};

/* 색 유틸: hex → rgba */
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};

/* localStorage */
const loadStore=()=>{try{const s=JSON.parse(localStorage.getItem("null_store_v1"));if(s&&s.msgs)return{msgs:s.msgs,unread:s.unread||{}}}catch(e){}return{msgs:{},unread:{}}};
const saveStore=s=>{try{localStorage.setItem("null_store_v1",JSON.stringify(s))}catch(e){}};
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
const DEMO={on:new URLSearchParams(location.search).has("demo"),auto:false};
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
const demoOn=()=>DEMO.on||DEMO.auto;
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


const fmtClock=ts=>{const d=new Date(ts);const h=d.getHours(),ap=h<12?"오전":"오후";return `${ap} ${h%12||12}:${String(d.getMinutes()).padStart(2,"0")}`};
const isToday=ts=>{const d=new Date(ts),n=new Date();return d.toDateString()===n.toDateString()};
const fmtDivider=ts=>isToday(ts)?fmtClock(ts):`${new Date(ts).getMonth()+1}월 ${new Date(ts).getDate()}일 ${fmtClock(ts)}`;

/* 괄호만으로 된 말풍선은 대사가 아니라 행동 지문이다 — 말풍선 대신 채팅창에 쳐진 줄로 그린다.
   서버가 줄 단위로 갈라서 보내주므로 여기서는 통째로 괄호인지만 보면 된다. */
/* 지문처럼 그릴 줄: 괄호로만 된 대사, 그리고 선물처럼 "일어난 일"을 적은 sys 줄 */
const isNarr=m=>!!m&&!m.photo&&(m.sys===true||/^[（(][^()（）]*[)）]$/.test((m.text||"").trim()));
const fmtListTime=ts=>isToday(ts)?fmtClock(ts):`${new Date(ts).getMonth()+1}월 ${new Date(ts).getDate()}일`;
const MON=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const fmtDay=ts=>{const d=new Date(ts),y=d.getFullYear();
  return `${MON[d.getMonth()]} ${d.getDate()}`+(y!==new Date().getFullYear()?", "+y:"")};

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
   시작한다. 계절 하나면 창밖 얘기는 안 틀린다. */
const seasonWord=now=>{const m=(now||nowClock()).getMonth()+1;
  return m<3?"겨울":m<6?"봄":m<9?"여름":m<12?"가을":"겨울"};
/* ── 자는 사람은 먼저 말을 안 건다 ──
   새벽 세 시에 앱을 처음 켜면 둘 다 몇 초 안에 인사를 보냈다. 목록에는
   「자는 중」이라고 떠 있는데 그 사람 말풍선이 왔다.
   그리고 이 앱은 유저가 없어도 세계가 돌아간다고 말하는 앱인데, 켜자마자
   둘이 인사하면 돌아가고 있던 게 아니라 기다리고 있던 게 된다.

   전에는 재언만 여섯 시로 못박은 상수를 따로 두고 민현은 시각을 안 봤다.
   그런데 민현에게도 꺼진 시간(3~8시)이 생겼다 — 점은 「꺼짐」인데 그 사람
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
  /* 아침. 개학 전에 둘이 처음 마주친 자리다 — 다시 그 자리에서 시작한다 */
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

/* ── 접속 상태 ──
   시간대만 보고 정한다. 서버를 부르지 않으므로 비용이 없다.
   재언은 근무 시간에 보건실에 있고, 민현은 학교에 매여 있다.
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
       그 시간에는 유저가 말 걸 사람이 아무도 없었다. 민현이 자러 가는 시각과
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
    if(mm<980)       return {s:"away",t:"수업 중"};
    return {s:"on",  t:"야자"};
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
   own은 그 자리가 원래 누구 자리인가. 재언은 보건실에 있는 게 일이고 민현은
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
  {name:"편의점",   map:"town", meet:"out", bg:"place-conv.webp",     icon:"conv",    need:["옥상"],              who:["jaeeon","minhyun"], item:"haribo",
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
  {name:"집",       map:"town", hours:[17,2], wend:[11,2], bg:"place-home.webp", icon:"home", need:["빨래방","레코드샵"], who:["jaeeon"], item:"key",
   note:"현관에 우산이 두 개."},
  /* ── 학교 안 ── 길이 아니라 건물이다. 그래서 표지판을 안 세운다 */
  {name:"교실",     map:"school", hours:[8,22], wend:false, bg:"place-class.webp",   icon:"class",   need:[],                 who:["minhyun"], own:"minhyun", item:"note",
   note:"네 자리는 창가 셋째 줄."},
  {name:"보건실",   map:"school", hours:[8,17], wend:false, bg:"place-nurse.webp",   icon:"nurse",   need:[],                 who:["jaeeon"],  own:"jaeeon",  item:"bandaid",
   note:"커튼 안쪽 침대 두 개."},
  /* 옥상은 둘 다 만나본 뒤에 열린다 — 학교에서 유일하게 둘 다 오는 자리라서 */
  {name:"옥상",     map:"school", hours:[8,22], wend:false, bg:"place-rooftop.webp", icon:"rooftop", need:["교실","보건실"],  who:["jaeeon","minhyun"], item:"can",
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
const CAB_COL=[27.50,72.39];               // 칸 가운데 (프레임 폭의 %)
const CAB_ROW=[13.36,35.88,58.48,81.19];   // 칸 가운데 (프레임 높이의 %)
/* 문짝은 구멍보다 조금 커야 한다 — 경첩이 프레임에 얹혀야 문으로 보인다.
   다만 칸 간격(22.5%)보다 커지면 위아래 문이 서로를 덮는다. 문짝 그림이
   정사각이라 폭이 곧 높이다: 43%면 높이가 22.35%로 간격 안에 들어간다.
   46%로 뒀더니 아랫줄 문이 윗줄 문을 물고 프레임 테두리가 안 보였다. */
const CAB_DOOR_W=43;
/* 학교 문을 열면 TV가 나온다. 네 칸이 학교 안 네 자리다 —
   좌표는 TV 그림에서 화면 안쪽 네 칸을 재서 넣었다 */
/* 좌표는 open.webp(열린 문 + 그 안의 TV) 기준이다. 사물함 안이라 TV가 작다 */
const TV_QUAD={
  "교실":  {x:15.4, y:25.6},
  "보건실":{x:35.4, y:25.6},
  "옥상":  {x:15.4, y:45.0},
  "체육관":{x:35.4, y:45.0},
};
const TV_QUAD_W=19, TV_QUAD_H=18.5;

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
   민현이 그날 남는 것도 강제가 아니라서 성격이 된다. 갈 데가 없는 애다. */
const PERIODS=[[520,570,1],[580,630,2],[640,690,3],[700,750,4],
               [810,860,5],[870,920,6],[930,980,7]];   // 분 단위 · 시작·끝·교시
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
/* 격주. 어느 주부터인지는 유저 사정이 아니라 학교 사정이라 달력으로 센다 */
const weekNo=d=>Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5+3)/7);
const isYajaWeek=(now)=>weekNo(now||nowClock())%2===0;
const isWend=d=>{const w=(d||nowClock()).getDay();return w===0||w===6};
/* 오늘 시간표. 야자는 담당인 목요일에만 붙고, 주말은 아예 칸이 없다 —
   학교가 정해주는 하루가 아니라 유저가 적는 하루라서 */
const daySlots=(now)=>{
  const d=now||nowClock();
  if(isWend(d))return [];
  const yaja=isYajaWeek(d)&&d.getDay()===4;
  return DAY_SLOTS.filter(s=>s.k!=="야자"||yaja);
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
   스피드 모드에서 진짜 달력을 그대로 보면, 대화로 날을 넘겨도 선물은 진짜
   내일까지 못 준다. 그러면 빠른 게 빠른 게 아니다. 스피드 모드의 하루는
   네 마디라, 네 마디 나누면 도장도 같이 넘어간다. */
const dayKey=now=>{
  if(speedOn())return "s"+speedDay();
  const d=new Date(now||Date.now()); if(d.getHours()<5)d.setDate(d.getDate()-1);
  return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()};
const loadDaySeen=()=>{try{return localStorage.getItem("null_dayseen")||""}catch(e){return""}};
const saveDaySeen=v=>{try{localStorage.setItem("null_dayseen",v)}catch(e){}};
/* ── 선물은 한 사람에게 하루에 하나 ──
   새벽 두 시 사십삼 분에 이어폰을 주고 두 시 사십팔 분에 사진집을 줬더니,
   같은 사람이 오 분 만에 같은 반응을 두 번 했다 — 밀어내고, 값어치를 인정하고,
   받고, 그러고 나서 고맙다고. 한 번이면 그 사람이고 두 번이면 틀이다.
   모델을 고칠 일이 아니라 간격을 둘 일이었다.
   막는 것은 「한 사람이 하루에 두 번 받는 것」이지 「하루에 두 명에게 주는 것」이
   아니다 — 재언에게 주고 민현에게 주는 건 같은 반응이 두 번 도는 게 아니다.
   하루의 경계는 여기서도 새벽 다섯 시다. 새벽에 준 건 어제 준 것이다 —
   저 이어폰과 사진집이 같은 날로 묶여야 이 규칙에 걸린다. */
const loadGiftDay=()=>{try{return JSON.parse(localStorage.getItem("null_giftday"))||{}}catch(e){return{}}};
const saveGiftDay=v=>{try{localStorage.setItem("null_giftday",JSON.stringify(v))}catch(e){}};
const giftedToday=(char,now)=>loadGiftDay()[char]===dayKey(now);
const stampGift=(char,now)=>saveGiftDay({...loadGiftDay(),[char]:dayKey(now)});
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
const saveBag=a=>{try{localStorage.setItem("null_bag",JSON.stringify(a))}catch(e){}};
/* 자리가 열렸나. 다녀온 자리 목록만 본다 — 대화 수도 날짜도 안 본다.
   이미 다녀온 데는 조건을 안 본다. 캐릭터가 먼저 같이 가자고 하는 자리(초대)는
   지도의 순서를 건너뛴다 — 옥상에 가기 전에 민현이 편의점으로 불러낼 수 있다.
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
  /* 주말엔 학교가 없다. 재언은 출근을 안 하고 민현은 야자가 없다 —
     교실·보건실·옥상이 통째로 닫힌다(wend:false). 그래서 주말은 학교 밖에서
     일부러 만나야만 하는 날이 된다. 집은 낮에도 사람이 있다(wend:[11,2]).
     wend가 없는 데는 평일과 같다 — 도서관·레코드샵·편의점·빨래방. */
  const w=wend&&("wend" in p)?p.wend:p.hours;
  if(w===false)return false;
  if(!w)return true;
  const h=d.getHours(),[a,b]=w;
  return a<b ? (h>=a&&h<b) : (h>=a||h<b);
};
/* ── 자리에 깔리는 그 사람 사진 ──
   들어간 순간엔 빈 방이고, 그 사람이 입을 열면 그 사람이 화면이 된다.
   눈앞에 있는 사람 사진을 문자로 보내는 건 이상하니까 배경이 그 일을 한다.
   짝은 지어내지 않았다 — 사진 설명이 이미 어디인지 말하고 있어서 그대로 옮겼다.
   낮/저녁이 갈리는 건 교실뿐이다. desk는 짝이 찍어준 것(수업 중이라 제 손이
   묶여 있다)이고 nap은 자기가 찍은 것(빈 교실이라 찍을 수 있다)이다. */
const SCENE_SHOT={
  /* 교실은 민현 자리다 — PLACES의 who가 민현뿐이라 재언은 여기 오지 않는다 */
  "교실":     {minhyun:{day:["minhyun-window","minhyun-desk"], eve:["minhyun-nap"]}},
  "보건실":   {jaeeon:["jaeeon-work","jaeeon-chart"],
               minhyun:["minhyun-candy"]},
  "옥상":     {jaeeon:["jaeeon-rooftop"], minhyun:["minhyun-vending"]},
  "편의점":   {jaeeon:["jaeeon-conv"], minhyun:["minhyun-conv","minhyun-ramen"]},
  "도서관":   {jaeeon:["jaeeon-shelf"]},
  "레코드샵": {jaeeon:["jaeeon-record"], minhyun:["minhyun-mirror"]},
  /* 밤에 처음 켜면 여기서 재언을 만난다. 사진도 밤 코인세탁소다 —
     건조기 앞에 앉아 수건을 개고 있고 창밖에 비가 온다 */
  "빨래방":   {minhyun:["minhyun-laundry"], jaeeon:["jaeeon-laundry"]},
  "체육관":   {minhyun:["minhyun-gym"]},
  "집":       {jaeeon:["jaeeon-cook"]},
  /* 귀갓길은 지도에 없는 자리라 PLACES에 안 들어간다. 그래도 규칙은 같다 —
     빈 자리로 시작해서 그 사람이 입을 열면 그 사람이 화면이 된다. */
  "귀갓길":   {jaeeon:["jaeeon-driveseat"], minhyun:["minhyun-busstop","minhyun-neon"]},
};
/* ── 귀갓길 ── 지도에 없다. 골라서 가는 데가 아니라 자리가 끝나고 붙는 데다.
   유저 집은 정거장이 아니라 데려다주는 일이 끝나는 곳이라서 아이콘이 없다.
   재언은 태워다 주고(조수석에서 본 대시보드), 민현은 같이 버스를 탄다(빈 자리).
   건넬 물건은 없다 — 데려다주는 것이 이미 그거다. */
const WAY="귀갓길";
const WAY_BG={jaeeon:"jaeeon-drive.webp", minhyun:"minhyun-bus.webp"};
/* 밤에, 말을 나누고 나온 자리에서만. 그리고 하루에 한 번 */
const wayOK=(now)=>{const h=(now||nowClock()).getHours();return h>=20||h<5};
const loadWay=()=>{try{return localStorage.getItem("null_way")||""}catch(e){return""}};
const saveWay=v=>{try{localStorage.setItem("null_way",v)}catch(e){}};
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
  const at=presence(sc.room,new Date(sc.since));
  return !at||at.s!=="off";
};

/* ── 하루에 한 자리는 한 번 ──
   같은 데를 하루에 세 번 가면 그건 다니는 게 아니라 새로고침이다.
   경계는 여기서도 새벽 다섯 시다. */
const loadGone=()=>{try{return JSON.parse(localStorage.getItem("null_goneday"))||{}}catch(e){return{}}};
const saveGone=v=>{try{localStorage.setItem("null_goneday",JSON.stringify(v))}catch(e){}};
const goneToday=(place,now)=>loadGone()[place]===dayKey(now);
const stampGone=(place,now)=>saveGone({...loadGone(),[place]:dayKey(now)});

/* ── 지금 밖에 나와 있을 수 있나 ──
   편의점·빨래방은 누가 있을지 정해두지 않는다. 마주치는 자리라서.
   누가 있을 수 있는지는 이미 있는 생활 리듬(presence)이 정한다 — 새 규칙을
   만들지 않는다. 근무 중이거나 수업 중이거나 야자 중이거나 자는 중이면
   밖에 없다. 주말엔 학교가 없으니 낮에도 나올 수 있다. */
/* 점심도 학교 안이다 — 마주치는 자리(편의점·빨래방)에 나올 수는 없다.
   교실이 열리는 것(문틈 해제)과 학교 밖에 나오는 것은 다른 일이다. */
const AT_WORK=["보건실","수업 중","점심","야자"];
const freeOut=(id,now)=>{
  const d=now||nowClock(), pr=presence(id,d);
  if(!pr||pr.s==="off")return false;
  return isWend(d)||!AT_WORK.includes(pr.t);
};
const whoOut=(now)=>["jaeeon","minhyun"].filter(id=>freeOut(id,now));
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
  &&(p.meet!=="out"||whoOut(now).includes(id))).map(p=>p.name);
/* ── 단톡방은 나중에 생긴다 ──
   민현이 「삼촌도 유저를 알고, 유저도 삼촌을 안다」를 알게 된 순간 그가 판다.
   유저는 초대를 받는다 — 왜 초대됐는지는 모른 채로. 그게 이 앱의 모양이다.

   알게 되는 근거는 새로 만들지 않는다. 이미 민현에게 보내고 있는 신호가
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
  const canMeet=p.meet==="out" ? whoOut(now).includes(char)
              : p.pick ? true
              : (p.who||[]).includes(char);
  const why=!canMeet ? (p.meet==="out"?"지금은 아무도 없어요":"여기엔 안 와요")
    : goneToday(p.name,now) ? "오늘은 벌써 다녀왔어요"
    : !wendOnlyOk(p,now)    ? "주말에만"
    : !placeHours(p,now)    ? placeWhen(p,now)
    : "";
  return {place:p.name, icon:p.icon, ok:!why, why};
});

/* 주말에만 가는 자리 */
const wendOnlyOk=(p,now)=>!p.wendOnly||isWend(now||nowClock());

/* 왜 지금은 못 가는지 한 줄. 주말의 학교는 시간이 아니라 날이 문제라
   시각을 적어주면 거짓말이 된다 — 여덟 시가 돼도 안 열린다 */
const placeWhen=(p,now)=>{
  const d=now||nowClock(), wend=d.getDay()===0||d.getDay()===6;
  const w=wend&&("wend" in p)?p.wend:p.hours;
  if(w===false)return "weekdays only";
  if(!w)return "";
  const pad=n=>String(n).padStart(2,"0");
  return `open ${pad(w[0])}:00 – ${pad(w[1])}:00`;
};
/* 아직 못 간 자리에 뭐가 남았는지. 잠긴 칸에 그대로 적어준다 */
const placeNeed=(p,been)=>(p.need||[]).filter(n=>!been.includes(n));
const loadScene=()=>{try{return JSON.parse(localStorage.getItem("null_scene"))||null}catch(e){return null}};
const saveScene=v=>{try{v?localStorage.setItem("null_scene",JSON.stringify(v)):localStorage.removeItem("null_scene")}catch(e){}};
const loadMet=()=>{try{return JSON.parse(localStorage.getItem("null_met"))||[]}catch(e){return[]}};
const saveMet=a=>{try{localStorage.setItem("null_met",JSON.stringify(a))}catch(e){}};
const loadRefused=()=>{try{return JSON.parse(localStorage.getItem("null_refused"))||[]}catch(e){return[]}};
const saveRefused=a=>{try{localStorage.setItem("null_refused",JSON.stringify(a))}catch(e){}};
/* 눌러서 만드는 사건(선물·해금·약속) 말고, 그냥 쌓여서 되는 사건이 둘 있다.
   한 번씩만 찍는다 — 같은 일이 매일 나오면 그건 사건이 아니라 배경이다. */
const PHOTO_EVENT_AT=5;      // 재언에게 사진을 이만큼 받으면 민현이 눈치챈다
const DDAY_MARKS=[7,3,1];    // 남은 날이 이 값이 되는 날
const loadEvDone=()=>{try{return JSON.parse(localStorage.getItem("null_ev_done"))||[]}catch(e){return[]}};
const saveEvDone=a=>{try{localStorage.setItem("null_ev_done",JSON.stringify(a))}catch(e){}};
const loadAutoEvent=()=>{try{return JSON.parse(localStorage.getItem("null_auto_event"))}catch(e){return null}};
const saveAutoEvent=v=>{try{v?localStorage.setItem("null_auto_event",JSON.stringify(v)):localStorage.removeItem("null_auto_event")}catch(e){}};
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
const stampShot=key=>{try{
  if(!key)return;
  const a=loadShots(); if(a.includes(key))return;
  localStorage.setItem("null_shots",JSON.stringify([...a,key]));
}catch(e){}};
function seenPhotos(msgs){
  const set=new Set();
  Object.values(msgs||{}).forEach(list=>(list||[]).forEach(m=>{if(m.photo)set.add(m.photo)}));
  loadShots().forEach(k=>set.add(k));
  return set;
}

