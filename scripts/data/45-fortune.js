/* NULL web · daily NULL fortune
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
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
