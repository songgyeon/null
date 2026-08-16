/* NULL — 데이터와 규칙.
   JSX가 없어서 바벨을 안 거친다. 브라우저가 그냥 읽는다.
   여기 있는 것은 전부 「무엇이 있는가」다 — 인물, 방, 선물, 장소, 시간표,
   그리고 그것들을 재는 자. 화면은 이 파일을 안 본다. 화면이 이 파일을 본다. */
const {useState,useEffect,useRef} = React;
const API = "https://null-api.re-moonroom.workers.dev/";

/* 프사를 교체해도 파일명이 같으면 브라우저·CDN이 옛 이미지를 계속 쓴다.
   사진을 갈아끼울 때마다 이 숫자를 올린다. */
const AV_V = "?v=4";

/* 캐릭터 / 방 정의 */
const CHARS = {
  jaeeon:{name:"이재언",color:"#7FD8D8",dk:"#2fa8a0",pale:"#cef0ee",img:"jaeeon-profile.webp",zoom:"150%",pos:"50% 22%",
    gallery:["jaeeon-treat.webp","jaeeon-care.webp","jaeeon-cook.webp","jaeeon-work.webp","jaeeon-evening.webp","jaeeon-market.webp","jaeeon-laundry.webp","jaeeon-car.webp","jaeeon-classroom.webp","jaeeon-rooftop.webp","jaeeon-curtain.webp","jaeeon-shelf.webp","jaeeon-bandage.webp","jaeeon-cabinet.webp","jaeeon-bottle.webp","jaeeon-chart.webp","jaeeon-door.webp","jaeeon-mug.webp","jaeeon-back.webp","jaeeon-driveseat.webp","jaeeon-corridor.webp","jaeeon-sink.webp"]},
  minhyun:{name:"이민현",color:"#FF9E80",dk:"#f0764a",pale:"#ffe0d2",img:"minhyun-profile.webp",zoom:"150%",pos:"50% 22%",
    gallery:["minhyun-candy.webp","minhyun-corridor.webp","minhyun-rain.webp","minhyun-gate.webp","minhyun-morning.webp","minhyun-alley.webp","minhyun-gym.webp","minhyun-busstop.webp","minhyun-winter.webp","minhyun-snow.webp","minhyun-bench.webp","minhyun-desk.webp","minhyun-stair.webp","minhyun-vending.webp","minhyun-laundry.webp","minhyun-conv.webp","minhyun-nap.webp","minhyun-neon.webp","minhyun-ramen.webp","minhyun-window.webp","minhyun-mirror.webp"]},
};
/* 교생 실습 기간. etc.의 D-카운트가 여기서 나온다 */
const ENROLL_DAYS = 30;
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
  const all=Object.values((store&&store.msgs)||{}).flat();
  const first=all.reduce((a,m)=>!a||m.ts<a?m.ts:a,0);
  return first?Math.max(0,span-Math.floor((Date.now()-first)/864e5)):span;
};
/* 첫 대화로부터 며칠 지났나. 단계와 해금이 이걸 같이 본다 */
const daysSince=store=>{
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
  {key:"jaeeon-bag",             file:"jaeeon-bag.webp",             label:"재언의 가방", room:"jaeeon", at:12, day:3},
  {key:"minhyun-bag",            file:"minhyun-bag.webp",            label:"민현의 가방", room:"minhyun", at:12, day:3},
  {key:"jaeeon-room",            file:"jaeeon-room.webp",            label:"재언의 방", room:"jaeeon", at:26, day:7},
  {key:"minhyun-room",           file:"minhyun-room.webp",           label:"민현의 방", room:"minhyun", at:26, day:7},
  {key:"jaeeon-playlist",        file:"jaeeon-playlist.webp",        label:"재언의 플레이리스트", room:"jaeeon", at:44, day:11},
  {key:"minhyun-playlist",       file:"minhyun-playlist.webp",       label:"민현의 플레이리스트", room:"minhyun", at:44, day:11},
  {key:"jaeeon-ticket",          file:"jaeeon-ticket.webp",          label:"재언의 티켓", room:"jaeeon", at:64, day:15},
  {key:"minhyun-ticket",         file:"minhyun-ticket.webp",         label:"민현의 티켓", room:"minhyun", at:64, day:15},
  {key:"jaeeon-yearbook",        file:"jaeeon-yearbook.webp",        label:"재언의 졸업사진", room:"jaeeon", at:90, day:20},
  {key:"minhyun-yearbook",       file:"minhyun-yearbook.webp",       label:"민현의 졸업사진", room:"minhyun", at:90, day:20},
  {key:"hidden-jaeeon-diary-200x-03-07", file:"hidden-jaeeon-diary-200x-03-07.webp", label:"재언의 일기 · 3월 7일", room:"jaeeon", at:100, day:23},
  {key:"hidden-minhyun-counseling-record-1-a4", file:"hidden-minhyun-counseling-record-1-a4.webp", label:"민현 상담 기록 · 1", room:"minhyun", at:100, day:23},
  {key:"hidden-jaeeon-diary-200x-04-12", file:"hidden-jaeeon-diary-200x-04-12.webp", label:"재언의 일기 · 4월 12일", room:"jaeeon", at:106, day:24},
  {key:"hidden-minhyun-counseling-record-2-a4", file:"hidden-minhyun-counseling-record-2-a4.webp", label:"민현 상담 기록 · 2", room:"minhyun", at:106, day:24},
  {key:"hidden-jaeeon-diary-201x-07-11", file:"hidden-jaeeon-diary-201x-07-11.webp", label:"재언의 일기 · 7월 11일", room:"jaeeon", at:112, day:25},
  {key:"hidden-minhyun-sns-1", file:"hidden-minhyun-sns-1.webp", label:"@mhy.wav · 1", room:"minhyun", at:112, day:25},
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
   ?demo=1 로 켜지고, 그게 아니어도 API가 실패하면 자동으로 넘어간다(그 뒤로는 계속 데모).
   실패 원인은 콘솔에 그대로 남기고 하단 바에 demo 표시가 뜬다 — 조용히 가짜로
   바뀌면 진짜 장애를 못 알아채기 때문이다.

   대사와 매칭은 demo-lines.js에 있다. 그 파일은 docs/dialogue-corpus.md에서
   만들어진다 — 대사를 고칠 때는 문구집을 고치고 node tools/build-demo.mjs를 돌린다.
   앱도 같은 파일을 쓴다(app/lib/demoLines.ts). 한쪽만 고쳐질 일이 없다. */
const DEMO={on:new URLSearchParams(location.search).has("demo"),auto:false};
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
const timeWord=now=>{const h=(now||new Date()).getHours();
  return h<2?"밤":h<6?"새벽":h<11?"아침":h<17?"낮":h<21?"저녁":"밤"};
/* 요일은 때보다 세다. 주말이면 학교가 통째로 없어지고, 그러면 이 셋을
   묶고 있던 건물이 사라진다 — 만나려면 학교 밖으로 나가야 한다 */
const dayWord=now=>"일월화수목금토"[(now||new Date()).getDay()]+"요일";
/* ── 자는 사람은 먼저 말을 안 건다 ──
   새벽 세 시에 앱을 처음 켜면 둘 다 몇 초 안에 인사를 보냈다. 목록에는
   「자는 중」이라고 떠 있는데 그 사람 말풍선이 왔다.
   그리고 이 앱은 유저가 없어도 세계가 돌아간다고 말하는 앱인데, 켜자마자
   둘이 인사하면 돌아가고 있던 게 아니라 기다리고 있던 게 된다.

   민현은 시각을 안 본다 — 새벽까지 깨 있는 게 그 애다.
   재언은 여섯 시부터다. 그 전에 켜면 그의 인사는 없던 일이 아니라 미뤄진
   것이고, 여섯 시 넘어 다시 열 때 온다. 기다린 인사가 아니라 일어나서
   보낸 인사가 된다.

   그래서 새벽에 시작한 사람은 첫 화면에서 두 가지를 공짜로 안다 —
   한 명은 이 시간에 깨 있는 애고 한 명은 자는 어른이라는 것,
   그리고 내가 켠다고 이 세계가 다 깨어나지는 않는다는 것. */
const GREET_FROM={jaeeon:6};
const canGreet=(id,now)=>{
  const from=GREET_FROM[id];
  return from==null||(now||new Date()).getHours()>=from;
};

/* ── 첫 자리 ──
   전에는 앱을 켜면 둘이 인사를 보내는 걸로 시작했다. 그건 알림이지 만남이 아니다.
   지금은 시작한 시각이 첫 자리를 정한다. 거기서 한 사람을 만나고, 다른 한 사람은
   첫인사를 보낸다 — 그래서 첫 화면에서 이미 둘의 시간대가 갈린다.

   시간 경계는 timeWord와 같다(새벽 2·아침 6·낮 11·저녁 17·밤 21). 화면에
   「저녁」이라고 떠 있는데 아침 자리에서 시작하면 그게 제일 이상하다.

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
  /* 저녁. 퇴근길에 붙잡힌다 */
  {from:17, place:"버스정류장",  room:"minhyun", bg:"minhyun-busstop.webp",
   note:"퇴근길 버스정류장에 섰다."},
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
  const d=now||new Date(), h=d.getHours();
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
   재언은 근무 시간에 보건실에 있고, 민현은 학교에 매여 있다. */
function presence(id, now){
  const h=(now||new Date()).getHours();
  if(id==="jaeeon"){
    if(h>=8&&h<17)  return {s:"on",  t:"보건실"};
    if(h>=17&&h<23) return {s:"away",t:"퇴근"};
    if(h>=23||h<1)  return {s:"away",t:"집"};
    /* 여섯 시에 일어난다. 여기가 GREET_FROM.jaeeon과 같아야 한다 —
       점은 「자는 중」인데 그 사람이 인사를 보내면 그게 처음 고치려던 그림이다.
       출근은 여덟 시라 두 시간은 집에 깨어 있다 */
    if(h>=6&&h<8)   return {s:"away",t:"집"};
    return {s:"off", t:"자는 중"};
  }
  if(id==="minhyun"){
    if(h>=8&&h<16)  return {s:"away",t:"수업 중"};
    if(h>=16&&h<22) return {s:"on",  t:"야자"};
    if(h>=22||h<2)  return {s:"on",  t:"안 자는 중"};
    return {s:"off", t:"꺼짐"};
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
  {name:"편의점",   map:"town", bg:"place-conv.webp",     icon:"conv",    need:["옥상"],              who:["minhyun"],          item:"haribo",
   note:"학교 뒷문에서 이 분."},
  {name:"도서관",   map:"town", hours:[9,22],  bg:"place-library.webp",  icon:"library", need:["옥상"],              who:["jaeeon"],           item:"book",
   note:"시립. 삼 층은 늘 비어 있다."},
  {name:"레코드샵", map:"town", hours:[12,21], bg:"place-record.webp",   icon:"record",  need:["편의점"],            who:["minhyun"],          item:"lp",
   note:"중고반 상자가 바닥에 있다."},
  {name:"빨래방",   map:"town", bg:"place-laundry.webp",  icon:"laundry", need:["도서관"],            who:["jaeeon"],           item:"coin",
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
/* 장소 그림은 배경에 박지 않는다. 같은 좌표에서 open/lock PNG만 교체한다. */
/* 아이콘 자리 — 길이 굽이치는 대로 따라간다. 두 줄로 딱 세우면 지도가 아니라
   목록으로 보인다. 각 자리 높이에서 길 가장자리를 재서 받침이 5%p 얹히게 놓았다 —
   길가에 선 것처럼 보이려면 붙어야 한다. */
/* 마을 길. 원래 여덟이던 자리 중 좌우가 번갈아 서는 여섯을 골랐다 —
   길이 굽는 쪽이 자리를 정하므로 아무거나 빼면 한쪽에 두 개가 몰린다 */
const ROAD_ICON_POS={
  "학교":       {x:34.3, y:79.2},
  "편의점":      {x:60.9, y:68.1},
  "도서관":      {x:27.4, y:57.3},
  "레코드샵":     {x:60.9, y:51.0},
  "빨래방":      {x:38.1, y:24.8},
  "집":        {x:64, y:10},   /* 길 위 끝을 받침이 덮게 */
};
/* 길 위에 찍는 핀. 건물은 길 밖에 있고 핀이 그 자리를 길 위에 표시한다.
   좌표는 도로 그림에서 리본을 따라가며 각 자리 높이의 중심을 잰 값이다. */
const ROAD_PIN_POS={
  "학교":       {x:52.9, y:79.2},
  "편의점":      {x:35.9, y:68.1},
  "도서관":      {x:52.9, y:57.3},
  "레코드샵":     {x:43.1, y:51.0},
  "빨래방":      {x:56.4, y:24.8},
  "집":        {x:64.6, y:10},
};
/* 학교 안. 길이 아니라 건물이라 표지판을 안 세운다 — 방 사이에 이정표가
   서 있으면 복도가 아니라 등산로가 된다 */
const SCHOOL_ICON_POS={
  "교실":       {x:30, y:78},
  "보건실":      {x:64, y:58},
  "옥상":       {x:30, y:36},
  "체육관":      {x:64, y:16},
};
/* 장소 그림에 파묻히는 표지판. 사각형으로 재면 아이콘이 29%라 여덟 개가
   전부 겹친다고 나온다. 실제 그림의 안 비치는 픽셀끼리 겹쳐보고, 표지판
   넓이의 12%를 넘게 먹히는 것만 골랐다 — 스치는 정도는 길가 표지판답다. */
/* 「집」은 길이 끝나는 자리라 표지판이 필요 없다 — 문이 곧 끝 표시다 */
const PIN_BURIED=["도서관","집"];
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
const DAY_SLOTS=[
  {k:"출근",at:480},{k:"수업",at:520},{k:"점심",at:750},{k:"수업",at:810},
  {k:"퇴근",at:990},{k:"저녁",at:1020},{k:"야자",at:1110},
];
const WEND_SLOTS=4;      // 주말은 이름이 없다. 유저가 넷을 직접 채운다
/* 격주. 어느 주부터인지는 유저 사정이 아니라 학교 사정이라 달력으로 센다 */
const weekNo=d=>Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5+3)/7);
const isYajaWeek=(now)=>weekNo(now||new Date())%2===0;
const isWend=d=>{const w=(d||new Date()).getDay();return w===0||w===6};
/* 오늘 시간표. 야자는 담당인 목요일에만 붙고, 주말은 아예 칸이 없다 —
   학교가 정해주는 하루가 아니라 유저가 적는 하루라서 */
const daySlots=(now)=>{
  const d=now||new Date();
  if(isWend(d))return [];
  const yaja=isYajaWeek(d)&&d.getDay()===4;
  return DAY_SLOTS.filter(s=>s.k!=="야자"||yaja);
};
/* 지금 몇 번째 칸인가. 아직 출근 전이면 -1, 다 끝났으면 마지막 칸 */
const slotNow=(now)=>{
  const d=now||new Date(), m=d.getHours()*60+d.getMinutes(), list=daySlots(d);
  let i=-1; list.forEach((s,n)=>{if(m>=s.at)i=n});
  return i;
};
/* 상태 버튼에 뜨는 말. 시간표는 「수업」 한 덩이지만 여기서는 교시를 센다 */
const nowLabel=(now)=>{
  const d=now||new Date();
  if(isWend(d))return d.getDay()===6?"토요일":"일요일";
  const m=d.getHours()*60+d.getMinutes();
  for(const [a,b,n] of PERIODS){ if(m>=a&&m<b)return n+"교시"; }
  if(m>=PERIODS[0][0]&&m<PERIODS[3][1])return "쉬는시간";
  if(m>=PERIODS[3][1]&&m<PERIODS[4][0])return "점심";
  if(m>=PERIODS[4][0]&&m<PERIODS[6][1])return "쉬는시간";
  const i=slotNow(d);
  return i<0?"등교전":daySlots(d)[i].k;
};
/* 하루의 경계는 자정이 아니라 새벽 다섯 시다. 새벽 두 시에 여는 건 어제의
   연장이지 새 하루가 아니다 — 대화 도중에 날짜가 넘어가면 그게 제일 이상하다 */
const dayKey=now=>{const d=new Date(now||Date.now()); if(d.getHours()<5)d.setDate(d.getDate()-1);
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
  const c=(w||"").trim().slice(-1).charCodeAt(0);
  if(!(c>=0xac00&&c<=0xd7a3))return w+b;          // 한글 음절이 아니면 받침 없음으로
  return w+(((c-0xac00)%28)?a:b);
};
const loadBag=()=>{try{return JSON.parse(localStorage.getItem("null_bag"))||[]}catch(e){return[]}};
const saveBag=a=>{try{localStorage.setItem("null_bag",JSON.stringify(a))}catch(e){}};
/* 자리가 열렸나. 다녀온 자리 목록만 본다 — 대화 수도 날짜도 안 본다 */
const placeOpen=(p,been)=>(p.need||[]).every(n=>been.includes(n));
/* 열린 것과 지금 갈 수 있는 것은 다르다. 새벽 세 시에 교실 문이 열려 있어도
   거기 갈 일은 없다. 자리마다 시간을 적어두고(hours), 안 적힌 데는 24시간이다 —
   편의점과 빨래방. 자정을 넘기는 시간대(집 17~2시)도 되게 감싼다.
   시계는 presence·timeWord와 같은 것을 본다. 방 목록에 「자는 중」이라고 떠
   있는데 그 사람 집에 갈 수 있으면 그게 제일 이상하다. */
const placeHours=(p,now)=>{
  const d=now||new Date(), wend=d.getDay()===0||d.getDay()===6;
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
  "교실":     {minhyun:{day:["minhyun-window","minhyun-desk"], eve:["minhyun-nap"]},
               jaeeon:["jaeeon-classroom"]},
  "보건실":   {jaeeon:["jaeeon-work","jaeeon-sink","jaeeon-cabinet","jaeeon-bottle","jaeeon-chart","jaeeon-mug"],
               minhyun:["minhyun-candy"]},
  "옥상":     {jaeeon:["jaeeon-rooftop"], minhyun:["minhyun-vending"]},
  "편의점":   {minhyun:["minhyun-conv","minhyun-ramen"]},
  "도서관":   {jaeeon:["jaeeon-shelf"]},
  "레코드샵": {minhyun:["minhyun-mirror"]},
  /* 밤에 처음 켜면 여기서 재언을 만난다. 사진도 밤 코인세탁소다 —
     건조기 앞에 앉아 수건을 개고 있고 창밖에 비가 온다 */
  "빨래방":   {minhyun:["minhyun-laundry"], jaeeon:["jaeeon-laundry"]},
  "체육관":   {minhyun:["minhyun-gym"]},
  "집":       {jaeeon:["jaeeon-cook","jaeeon-evening","jaeeon-curtain","jaeeon-back"]},
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
const wayOK=(now)=>{const h=(now||new Date()).getHours();return h>=20||h<5};
const loadWay=()=>{try{return localStorage.getItem("null_way")||""}catch(e){return""}};
const saveWay=v=>{try{localStorage.setItem("null_way",v)}catch(e){}};
/* 그 자리·그 사람·그 시간에 맞는 사진 하나. 없으면 빈 방 그대로 */
const sceneShot=(place,who,now)=>{
  const t=(SCENE_SHOT[place]||{})[who]; if(!t)return null;
  const h=(now||new Date()).getHours();
  const list=Array.isArray(t)?t:(h>=17?t.eve:t.day)||t.day||[];
  return list.length?list[Math.floor(Math.random()*list.length)]+".webp":null;
};

/* 왜 지금은 못 가는지 한 줄. 주말의 학교는 시간이 아니라 날이 문제라
   시각을 적어주면 거짓말이 된다 — 여덟 시가 돼도 안 열린다 */
const placeWhen=(p,now)=>{
  const d=now||new Date(), wend=d.getDay()===0||d.getDay()===6;
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
   처음부터 다 보여주면 앨범이 아니라 목록이다.
   실제로 받은 사진만 한 장씩 꽂힌다. 대화 기록에서 그대로 뽑으므로 별도 저장이 없다. */
function seenPhotos(msgs){
  const set=new Set();
  Object.values(msgs||{}).forEach(list=>(list||[]).forEach(m=>{if(m.photo)set.add(m.photo)}));
  return set;
}

