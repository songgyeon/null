/* NULL web · rooms, hidden records, gifts, storage
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
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
const AV="?v=286";
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
