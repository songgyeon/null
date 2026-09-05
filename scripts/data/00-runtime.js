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
const AV_V = "?v=286";

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
/* ── 세계 시계는 하나다 ──
   리얼 모드는 진짜 달력을 본다. 하루가 진짜 하루고, 30일을 실제로 살아야
   끝이 난다 — 「당신이 말하지 않아도 세계는 돌아갑니다」를 진짜로 만드는 게
   이 시계다. 스피드 모드는 같은 시계를 네 배로 돌린다. 그뿐이다.

     리얼      현실 1시간 = 게임 1시간
     스피드    현실 1시간 = 게임 4시간
     출발      켠 그 시각 · 현실 6시간 뒤 같은 시각 하루 뒤 · 현실 7.5일에 게임 30일

   ── 말풍선은 시간에 손대지 않는다 ──
   한때 쌓인 대화를 날로 셌다(네 마디 = 하루). 그러면 인물이 두 줄로 답하느냐
   세 줄로 답하느냐가 달력을 민다. 실제로 그렇게 됐다 — 강현이 수다스러운 판에서
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
/* ── 오프닝에서 만난 사람 ──
   세계가 시작된 자리에 있던 쪽이다. 다른 한 사람은 아직 안 만난 사람이고,
   그쪽을 만나는 것이 첫 며칠의 할 일이다.

   판을 새로 열기 전의 세이브에는 이 값이 없다. 그런 판에서는 getcha 목록의
   첫 항목이 같은 값을 들고 있다 — 그 창은 오프닝이 닫힐 때 처음 뜨므로
   맨 앞이 오프닝 방이다. 없으면 null이고, 없는 것은 모르는 것이지
   틀린 것이 아니다 — 부르는 쪽이 「모르면 지금까지대로」로 받는다. */
