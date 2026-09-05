/* NULL web · map, cabinet, bag, timetable, scenes, movement
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
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
   아니다 — 재언에게 주고 강현에게 주는 건 같은 반응이 두 번 도는 게 아니다.
   하루의 경계는 여기서도 새벽 다섯 시다. 새벽에 준 건 어제 준 것이다 —
   저 이어폰과 사진집이 같은 날로 묶여야 이 규칙에 걸린다. */
const loadGiftDay=()=>{try{return JSON.parse(localStorage.getItem("null_giftday"))||{}}catch(e){return{}}};
const saveGiftDay=v=>{try{localStorage.setItem("null_giftday",JSON.stringify(v));return true}catch(e){return false}};
const giftedToday=(char,now)=>loadGiftDay()[char]===dayKey(now);
const stampGift=(char,now)=>giftedToday(char,now)||saveGiftDay({...loadGiftDay(),[char]:dayKey(now)});
/* ── 오늘 이 방에서 아니라고 했다 ──
   선물 도장과 같은 모양이고 같은 하루 경계를 본다(새벽 다섯 시).
   경계(story.boundaries)는 되돌릴 일이 아니라 영구지만, 거절에는 대개
   「오늘은」이 붙는다 — 저녁을 오늘 거절한 것이 내일까지 가면 그건 거절이
   아니라 절교다. 그래서 하루만 산다.
   무엇을 거절했는지는 안 적는다. 제안은 자유 자연어라 목록이 없고, 코드가
   뽑아 적으면 유저가 안 한 말이 장부에 남는다 — 남기는 것은 「한 번 아니라고
   했다」 하나고 무엇이었는지는 대화가 이미 알고 있다. */
const loadRefuseDay=()=>{try{return JSON.parse(localStorage.getItem("null_refuseday"))||{}}catch(e){return{}}};
const saveRefuseDay=v=>{try{localStorage.setItem("null_refuseday",JSON.stringify(v));return true}catch(e){return false}};
const refusedToday=(char,now)=>loadRefuseDay()[char]===dayKey(now);
const stampRefuse=(char,now)=>refusedToday(char,now)||saveRefuseDay({...loadRefuseDay(),[char]:dayKey(now)});
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
