/* 이 파일은 손으로 고치지 않는다.
   app-data.js에서 tools/build-rules.mjs가 만든다 — 규칙을 고칠 곳은 그쪽 하나다.
   웹과 앱이 같은 글을 읽어야 같은 세계가 된다. 베껴 두면 반드시 갈라진다.
   다시 만들기: node tools/build-rules.mjs */
// @ts-nocheck
import './shim';   // localStorage·location — 아래 규칙들이 딛고 서는 바닥

function __build(): any {

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
const AV_V = "?v=5";

/* 캐릭터 / 방 정의 */
const CHARS = {
  jaeeon:{name:"이재언",color:"#7FD8D8",dk:"#2fa8a0",pale:"#cef0ee",img:"jaeeon-profile.webp",zoom:"100%",pos:"50% 40%",
    gallery:["jaeeon-work.webp","jaeeon-chart.webp","jaeeon-cook.webp","jaeeon-rooftop.webp","jaeeon-shelf.webp","jaeeon-laundry.webp","jaeeon-driveseat.webp","jaeeon-conv.webp","jaeeon-record.webp"]},
  minhyun:{name:"이민현",color:"#FF9E80",dk:"#f0764a",pale:"#ffe0d2",img:"minhyun-profile.webp",zoom:"150%",pos:"50% 22%",
    gallery:["minhyun-candy.webp","minhyun-corridor.webp","minhyun-rain.webp","minhyun-gate.webp","minhyun-morning.webp","minhyun-elevator.webp","minhyun-alley.webp","minhyun-gym.webp","minhyun-busstop.webp","minhyun-busride.webp","minhyun-winter.webp","minhyun-snow.webp","minhyun-bench.webp","minhyun-desk.webp","minhyun-stair.webp","minhyun-vending.webp","minhyun-laundry.webp","minhyun-conv.webp","minhyun-nap.webp","minhyun-neon.webp","minhyun-ramen.webp","minhyun-window.webp","minhyun-mirror.webp","minhyun-crate.webp","minhyun-record.webp","minhyun-shelf.webp"]},
};
/* 교생 실습 기간. etc.의 D-카운트가 여기서 나온다 */
const ENROLL_DAYS = 30;
/* ── 세계 시계는 하나다 ──
   리얼 모드는 진짜 달력을 본다. 하루가 진짜 하루고, 30일을 실제로 살아야
   끝이 난다 — 「당신이 말하지 않아도 세계는 돌아갑니다」를 진짜로 만드는 게
   이 시계다. 스피드 모드는 같은 시계를 네 배로 돌린다. 그뿐이다.

     리얼      현실 1시간 = 게임 1시간
     스피드    현실 1시간 = 게임 4시간
     출발      켠 그 시각 · 현실 6시간 뒤 같은 시각 하루 뒤 · 현실 7.5일에 게임 30일

   ── 말풍선은 시간에 손대지 않는다 ──
   한때 쌓인 대화를 날로 셌다(네 마디 = 하루). 그러면 인물이 두 줄로 답하느냐
   세 줄로 답하느냐가 달력을 민다. 실제로 그렇게 됐다 — 민현이 수다스러운 판에서
   재언 방의 D-일차가 같이 탔고, 첫날 아침 8시 47분에 이미 37일째였다.
   나눠지는 수를 바꿔봐야 「한 마디에 몇 시간」이라는 모양은 그대로다.
   그래서 구조를 뗀다. **시각·D-일차·요일·시간표·도장·재회·해금의 day 조건이
   전부 이 시계 하나에서 나온다.** 말풍선 수가 남아서 세는 것은 관계 대화량과
   해금의 at 조건뿐이다 — 그건 시간이 아니라 「얼마나 나눴나」다.

   대가는 알고 고른 것이다: 앱을 닫아도 세계는 흐른다. 스피드 모드에서 이틀
   안 열면 게임 여드레가 지나 있다. 그게 「당신이 말하지 않아도」의 뒷면이다.
   모드는 판마다 하나고 등록 화면에서 한 번 고른다. 중간에 바꾸면 D-N이 튄다. */
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
const loadMode=()=>{try{return localStorage.getItem("null_mode")==="speed"?"speed":"real"}catch(e){return"real"}};
const saveMode=v=>{try{localStorage.setItem("null_mode",v==="speed"?"speed":"real")}catch(e){}};
const speedOn=()=>loadMode()==="speed";
/* 시계가 출발하는 자리. 첫 마디가 있던 날이다 */
const firstTsOf=store=>Object.values((store&&store.msgs)||{}).flat()
  .reduce((a,x)=>!a||(x&&x.ts<a)?(x&&x.ts)||a:a,0);
/* ── 세계 시계 ──
   저장(ts·since·created_at)은 늘 **현실 epoch 그대로**다. 세계 시각은 그 위의
   번역일 뿐이다 — 저장에 gameAt을 쓰면 앵커가 제 출력을 도로 먹어 시계가
   발산한다(소스 검사로 막는다).

   함수 넷의 몫이 다르다. 섞으면 어제 그 사고가 다시 난다:
     gameAt(ts)   저장된 과거 epoch를 세계 시각으로 옮긴다. 개발 오프셋 없음
     worldStart() 세계가 출발한 자리. 개발 오프셋 없음
     worldNow()   세계가 보는 지금. **개발 오프셋은 여기에만 더한다**
     worldDays()  worldNow - worldStart를 하루로 나눈 것
   개발 오프셋을 gameAt에 넣으면 과거 말풍선 시각까지 통째로 움직이고,
   일차 계산에서는 시작과 지금 양쪽에 들어가 상쇄돼 버린다. 지금에만 더한다. */
/* ── 세계는 접속한 그 시각에서 출발한다 ──
   전에는 첫날을 무조건 여덟 시로 옮겨놓고 시작했다(SPEED_START_HOUR).
   그러면 스피드 모드의 첫 자리가 **늘 아침**이라, 오프닝 여섯 자리 중
   후문 골목 하나만 나왔다. 밤에 켠 사람의 세계가 아침이 되는 것도 이상하다.
   지금은 켠 시각 그대로에서 출발해 거기서부터 네 배로 흐른다 —
   비율만 세계의 것이고 출발 자리는 현실의 것이다. */
const SPEED_RATE=4;         // 실제 1분이 게임 4분. 진짜 하루가 게임 나흘이다
let WORLD_ANCHOR=0;         // 첫 말풍선의 현실 epoch
let DEV_SKEW=0;             // 개발 전용 시간 이동(ms). 배포판에서는 늘 0
const setWorldAt=firstTs=>{ WORLD_ANCHOR=Number(firstTs)||0 };
const gameAt=ts=>{
  const t=Number(ts)||Date.now();
  if(!speedOn())return new Date(t);
  const start=WORLD_ANCHOR||Date.now();
  return new Date(start+Math.max(0,t-start)*SPEED_RATE);
};
/* 세계가 출발한 자리. 스피드든 리얼이든 첫 말풍선 그 시각이다 */
const worldStart=()=>gameAt(WORLD_ANCHOR||Date.now());
/* 세계가 보는 지금. 잠·시간표·자리 여는 시각·요일·도장이 전부 이걸 본다 */
const worldNow=()=>new Date(gameAt(Date.now()).getTime()+DEV_SKEW);
/* 만난 지 며칠. **말풍선 수가 아니라 시계가 센다** */
const worldDays=()=>Math.max(0,
  Math.floor((worldNow().getTime()-worldStart().getTime())/864e5));
/* 저장소를 들고 묻는 자리용 — 앵커를 그 저장소에서 직접 읽는다.
   전역 앵커가 아직 안 세워진 첫 그림에서도 맞는 답이 나온다. */
const worldDaysOf=store=>{
  const first=firstTsOf(store);
  if(!first)return 0;
  const a=WORLD_ANCHOR; WORLD_ANCHOR=first;
  const d=worldDays();
  WORLD_ANCHOR=a;
  return d;
};
/* 세계가 보는 지금. 옛 이름을 그대로 둔다 — 부르는 자리가 마흔 곳이 넘는다 */
const nowClock=()=>worldNow();
/* ── 개발 전용 시간 이동 ──
   한 판에 30일을 봐야 할 때가 있다. 그렇다고 공개 스피드 모드의 비율을
   건드리면 안 된다 — 그건 세계의 속도지 시험 도구가 아니다. 그래서 지금에만
   더하는 오프셋을 따로 둔다. 저장된 ts도, 과거 말풍선의 시각도, 출발 자리도
   안 움직인다. 움직이는 것은 「지금」 하나고, 일차·도장·시간표가 그걸 따라온다.
   NULL_DEV가 켜진 빌드에만 실린다 — 켜는 자리는 빌드지 localStorage가 아니다.
   콘솔 한 줄로 켤 수 있으면 테스터의 판이 조용히 달라진다. */
const DEV_TIME = typeof NULL_DEV !== "undefined" && !!NULL_DEV;
const loadSkew=()=>{try{return +localStorage.getItem("null_devskew")||0}catch(e){return 0}};
/* 껐다 켜도 이동한 자리에 그대로 선다. 배포판은 값이 남아 있어도 안 읽는다 */
if(DEV_TIME)DEV_SKEW=loadSkew();
const setSkew=ms=>{ if(!DEV_TIME)return;
  DEV_SKEW=Math.max(0,Number(ms)||0);
  try{localStorage.setItem("null_devskew",String(DEV_SKEW))}catch(e){}};
/* 세계 하루만큼 뛴다. 현실로는 스피드에서 여섯 시간이지만 오프셋은 세계 값이다 */
const devAddDay=n=>setSkew(DEV_SKEW+(Number(n)||1)*864e5);
/* 남은 날을 콕 집어 맞춘다 — D-7·D-0 단추가 이걸 부른다. 지금 남은 날을
   받아서 그 차이만큼만 민다. 뒤로는 못 간다 — 오프셋을 음수로 두면 출발보다
   이른 「지금」이 나와서 일차가 음수가 되고, 그 아래 규칙들이 다 깨진다. */
const devToLeft=(curLeft,want)=>{
  const d=(Number(curLeft)||0)-Math.max(0,Number(want)||0);
  if(d>0)devAddDay(d);
};
/* D-0에 "계속 살아갈까"에 y를 누르면 한 달이 더 붙는다 */
const loadExtend=()=>{try{return +localStorage.getItem("null_extend")||0}catch(e){return 0}};
/* 첫날의 통보. 하루가 끝나기 전에 판돈을 알려준다 — 방법은 빼고.
   「24시간 안에」로 잡으면 그 시간에 앱을 안 연 사람에게는 영영 안 뜬다.
   **세계 시각으로** 스무 시간이 지난 뒤 처음 여는 순간에 한 번만 띄운다 —
   현실 시간으로 재면 스피드 모드의 첫날은 현실 여섯 시간이라 통보가
   나흘째에 도착한다. */
const SYS1_AFTER = 20*60*60*1000;
const sys1Due=store=>{
  const first=firstTsOf(store);
  return !!first && worldNow().getTime()-gameAt(first).getTime() >= SYS1_AFTER;
};
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
/* 남은 날·지난 날. 둘 다 세계 시계 하나에서 나온다 */
const daysLeft=store=>Math.max(0,ENROLL_DAYS+loadExtend()-worldDaysOf(store));
/* 첫 대화로부터 며칠 지났나. 단계와 해금의 day 조건이 이걸 같이 본다 */
const daysSince=store=>worldDaysOf(store);
/* 떠나는 날의 현실 epoch. 재회 판정과 가방의 D-일차가 같이 본다 —
   세계 하루는 스피드에서 현실 여섯 시간이므로 나눠서 되돌린다. */
const leaveTsOf=store=>{
  const first=firstTsOf(store);
  if(!first)return 0;
  const span=(ENROLL_DAYS+loadExtend())*864e5;
  return first+(speedOn()?span/SPEED_RATE:span);
};
/* 떠난 뒤에 유저가 다시 말을 걸었나. 유저 발화만 센다 */
const cameBackAt=store=>{
  const leaveAt=leaveTsOf(store);
  return !!leaveAt && Object.values((store&&store.msgs)||{}).flat()
    .some(m=>m&&m.sender==="user"&&m.ts>=leaveAt);
};
/* 그 말풍선이 찍힌 날의 D-일차. 가방이 「받은 날」을 이걸로 적는다 */
const dLeftAt=(store,ts)=>{
  const first=firstTsOf(store);
  if(!first||!ts)return null;
  const gone=Math.floor((gameAt(ts).getTime()-gameAt(first).getTime())/864e5);
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
  {name:"집",       map:"town", hours:[17,2], wend:[11,2], bg:"place-home.webp", icon:"home", need:["빨래방","레코드샵"], who:["jaeeon","minhyun"], own:"jaeeon", item:"key",
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
   **세계 시각의 달력**을 본다. 스피드 모드면 그 달력이 네 배로 도니까
   현실 여섯 시간마다 도장이 새로 찍힌다. 말풍선 수는 여기 안 들어온다 —
   네 마디 나눴다고 하루가 넘어가면 그게 어제 터진 그 구조다. */
const dayKey=now=>{
  const d=now?new Date(now):worldNow(); if(d.getHours()<5)d.setDate(d.getDate()-1);
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
  "도서관":   {jaeeon:["jaeeon-shelf"], minhyun:["minhyun-shelf"]},
  "레코드샵": {jaeeon:["jaeeon-record"], minhyun:["minhyun-crate","minhyun-record","minhyun-mirror"]},
  /* 밤에 처음 켜면 여기서 재언을 만난다. 사진도 밤 코인세탁소다 —
     건조기 앞에 앉아 수건을 개고 있고 창밖에 비가 온다 */
  "빨래방":   {minhyun:["minhyun-laundry"], jaeeon:["jaeeon-laundry"]},
  "체육관":   {minhyun:["minhyun-gym"]},
  /* 재언 집이지만 민현도 산다. 재언은 부엌에 서 있고, 민현은 막 일어난
     참이거나 엘리베이터에서 올라오는 길이다 */
  "집":       {jaeeon:["jaeeon-cook"], minhyun:["minhyun-morning","minhyun-elevator"]},
  /* 귀갓길은 지도에 없는 자리라 PLACES에 안 들어간다. 그래도 규칙은 같다 —
     빈 자리로 시작해서 그 사람이 입을 열면 그 사람이 화면이 된다. */
  /* 귀갓길은 같이 버스를 탄 자리다. 정류장 사진은 기다리는 그림이라
     여기 오면 아직 안 탄 사람이 된다 — 탄 그림으로 바꿨다.
     정류장 사진은 그대로 산다: 저녁 첫 자리(버스정류장)의 배경이고 앨범에도 있다. */
  "귀갓길":   {jaeeon:["jaeeon-driveseat"], minhyun:["minhyun-busride","minhyun-neon"]},
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
const AT_WORK=["보건실","수업 중","점심","야자"];
const freeOut=(id,now)=>{
  const d=now||nowClock(), pr=presence(id,d);
  if(!pr||pr.s==="off")return false;
  return isWend(d)||!AT_WORK.includes(pr.t);
};
const whoOut=(now)=>["jaeeon","minhyun"].filter(id=>freeOut(id,now));

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
   창이 다르고(재언은 퇴근까지, 민현은 야자까지) 야자는 주마다 붙었다
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
const EDIT_MAX=500;
const loadEdits=()=>{try{return JSON.parse(localStorage.getItem("null_edits"))||[]}catch(e){return[]}};
const saveEdits=a=>{try{localStorage.setItem("null_edits",JSON.stringify(a.slice(-EDIT_MAX)))}catch(e){}};
const loadMet=()=>{try{return JSON.parse(localStorage.getItem("null_met"))||[]}catch(e){return[]}};
const saveMet=a=>{try{localStorage.setItem("null_met",JSON.stringify(a));return true}catch(e){return false}};
const loadRefused=()=>{try{return JSON.parse(localStorage.getItem("null_refused"))||[]}catch(e){return[]}};
const saveRefused=a=>{try{localStorage.setItem("null_refused",JSON.stringify(a));return true}catch(e){return false}};
/* 눌러서 만드는 사건(선물·해금·약속) 말고, 그냥 쌓여서 되는 사건이 둘 있다.
   한 번씩만 찍는다 — 같은 일이 매일 나오면 그건 사건이 아니라 배경이다. */
const PHOTO_EVENT_AT=5;      // 재언에게 사진을 이만큼 받으면 민현이 눈치챈다
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
   것을 덮는다. 재언의 편의점을 물어보기 전에 민현의 옥상이 오면 편의점은
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
     firstContact  unseen → pending → explained → recognized  민현의 병원 옥상
     jaeeonMemory  hidden → opened → acknowledged 재언의 20년 기억
     partnerKnown  {jaeeon,minhyun}               상대가 정해진 걸 아는가

   explained는 민현이 **말한** 자리고 recognized는 유저가 **받아들인** 자리다.
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
  loadMode,
  saveMode,
  speedOn,
  firstTsOf,
  SPEED_RATE,
  WORLD_ANCHOR,
  DEV_SKEW,
  setWorldAt,
  gameAt,
  worldStart,
  worldNow,
  worldDays,
  worldDaysOf,
  nowClock,
  DEV_TIME,
  loadSkew,
  setSkew,
  devAddDay,
  devToLeft,
  loadExtend,
  SYS1_AFTER,
  sys1Due,
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
  PHOTO_FILES,
  photoSrc,
  HIDDEN,
  HIDDEN_LABEL,
  GIFTS,
  GIFT_CATS,
  CAT_EN,
  GIFT_HINT,
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
  PERIODS,
  LEAVE_AT,
  DAY_SLOTS,
  WEND_SLOTS,
  weekNo,
  isYajaWeek,
  isWend,
  daySlots,
  slotNow,
  nowLabel,
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
  placeWhen,
  placeNeed,
  loadScene,
  saveScene,
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
  loadMode,
  saveMode,
  speedOn,
  firstTsOf,
  SPEED_RATE,
  WORLD_ANCHOR,
  DEV_SKEW,
  setWorldAt,
  gameAt,
  worldStart,
  worldNow,
  worldDays,
  worldDaysOf,
  nowClock,
  DEV_TIME,
  loadSkew,
  setSkew,
  devAddDay,
  devToLeft,
  loadExtend,
  SYS1_AFTER,
  sys1Due,
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
  PHOTO_FILES,
  photoSrc,
  HIDDEN,
  HIDDEN_LABEL,
  GIFTS,
  GIFT_CATS,
  CAT_EN,
  GIFT_HINT,
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
  PERIODS,
  LEAVE_AT,
  DAY_SLOTS,
  WEND_SLOTS,
  weekNo,
  isYajaWeek,
  isWend,
  daySlots,
  slotNow,
  nowLabel,
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
  placeWhen,
  placeNeed,
  loadScene,
  saveScene,
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
