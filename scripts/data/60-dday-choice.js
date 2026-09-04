/* NULL web · D-0 relationship ending
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다.

   D-0은 게임을 닫는 날이 아니다. 누구의 옆자리를 채울지를 정하고,
   영화관을 지나 D-∞의 일상으로 들어가는 날이다. 이 파일은 그 상태만
   localStorage에 보관한다. 화면과 타이머는 UI 파일이 맡는다. */
const DDAY_CHOICE_TAG="[D-0 확정 관계 · 시스템 상태]";
const ENDING_KEY="null_ending";
const ENDING_VERSION=1;
const ENDING_ROUTES=["jaeeon","minhyun"];
const ENDING_PHASES=["waiting","dialogue","shot","complete","daily"];

const ENDING_ASSETS={
  jaeeon:{
    dialogue:"ending-jaeeon-dialogue.webp",
    alone:"ending-jaeeon-alone.webp",
    faint:"ending-jaeeon-faint.webp",
    present:"ending-jaeeon-present.webp",
  },
  minhyun:{
    dialogue:"ending-minhyun-dialogue.webp",
    alone:"ending-minhyun-alone.webp",
    faint:"ending-minhyun-faint.webp",
    present:"ending-minhyun-present.webp",
  },
};

/* 첫 줄은 두 루트 모두 정본이다. 마지막은 고백의 마침표가 아니라
   옆자리를 내어주는 말로 끝난다. 마지막 줄 뒤에는 선택지 없이 컷으로 간다. */
const ENDING_DIALOGUE={
  jaeeon:[
    "기다렸어요.",
    "처음 여기서 만났을 때는, 서로 아무것도 몰랐죠.",
    "오늘은 옆자리를 비워뒀어요. 이리 와요.",
  ],
  minhyun:[
    "기다렸어요.",
    "처음 여기서 봤을 때보다 오래 걸렸네요.",
    "그래도 옆자리는 안 줬어요. 앉아요.",
  ],
};

const endingDayKey=now=>{
  const d=now instanceof Date?now:new Date(now||Date.now());
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

const normalizeEnding=value=>{
  if(!value||typeof value!=="object"||!ENDING_ROUTES.includes(value.route))return null;
  const completed=!!value.completed;
  let phase=ENDING_PHASES.includes(value.phase)?value.phase:(completed?"daily":"waiting");
  let replaying=completed&&!!value.replaying;
  /* 저장값이 중간에 잘리거나 옛 코드가 섞여도 불가능한 조합으로는 열지 않는다.
     미완료 상태의 complete/daily는 대기부터, 완료 상태의 waiting은 일상부터.
     dialogue/shot은 명시적인 다시보기일 때만 완료 상태에서 복구한다. */
  if(!completed){
    if(phase==="complete"||phase==="daily")phase="waiting";
    replaying=false;
  }else{
    if(phase==="waiting")phase="daily";
    if((phase==="dialogue"||phase==="shot")&&!replaying)phase="daily";
    if(phase!=="dialogue"&&phase!=="shot")replaying=false;
  }
  return {
    v:ENDING_VERSION,
    route:value.route,
    phase,
    completed,
    replayable:completed||!!value.replayable,
    replaying,
    chosenAt:Number(value.chosenAt)||Date.now(),
    completedAt:completed?(Number(value.completedAt)||Date.now()):0,
    activeDays:completed?Math.max(1,Number(value.activeDays)||1):0,
    lastActiveDay:completed?String(value.lastActiveDay||endingDayKey()):"",
  };
};

/* 엔딩 뒤에는 달력에서 흘러간 날이 아니라 실제 접속한 날만 게임의 하루다.
   엔딩 당일은 30일째이고, 다음 날짜에 다시 열 때 31일째가 된다. */
const endingGameDay=(ending,store)=>ending&&ending.completed
  ?ENROLL_DAYS-1+Math.max(1,Number(ending.activeDays)||1)
  :daysSince(store);

const writeEnding=value=>{try{
  const next=normalizeEnding(value);
  if(!next)return null;
  localStorage.setItem(ENDING_KEY,JSON.stringify(next));
  return next;
}catch(e){return null}};

const loadEnding=()=>{try{
  /* 손상된 새 저장값 하나 때문에 멀쩡한 옛 partner까지 못 읽으면 안 된다.
     JSON 파싱만 따로 실패 처리하고 아래 legacy 이관은 계속 진행한다. */
  let raw=null;
  try{raw=JSON.parse(localStorage.getItem(ENDING_KEY)||"null")}catch(e){raw=null}
  const saved=normalizeEnding(raw);
  if(saved)return saved;
  /* 옛 +30일 판에서 이미 상대를 골랐다면 선택을 없애지 않는다. 연장만 걷고
     그 선택 직후의 대기 알림부터 이어서 새 결말을 볼 수 있게 옮긴다. */
  const legacy=loadPartner();
  if(ENDING_ROUTES.includes(legacy)){
    localStorage.removeItem("null_extend");
    return writeEnding({route:legacy,phase:"waiting",completed:false,chosenAt:Date.now()});
  }
  /* 옛 leave 선택은 새 정본에 대응하는 루트가 없다. 새 D-0은 떠날지 묻는
     화면이 아니라 누구의 옆자리를 채울지 정하는 화면이므로 재선택이 맞다. */
  return null;
}catch(e){return null}};

const chooseEndingRoute=route=>{
  if(!ENDING_ROUTES.includes(route))return null;
  const existing=loadEnding();
  if(existing)return existing;
  const picked=savePartner(route)||route;
  try{
    localStorage.setItem("null_dday_ans","relationship");
    localStorage.removeItem("null_extend");
  }catch(e){}
  return writeEnding({route:picked,phase:"waiting",completed:false,chosenAt:Date.now()});
};

const moveEnding=(ending,phase,extra={})=>{
  if(!ending||!ENDING_PHASES.includes(phase))return ending||null;
  return writeEnding({...ending,...extra,phase});
};

const finishEnding=ending=>{
  if(!ending)return null;
  /* 다시보기는 기록을 재생하는 것뿐이다. 이미 끝난 등록 팝업까지 다시 띄우지
     않고 마지막 암전 뒤 곧바로 D-∞ 일상으로 돌아간다. */
  if(ending.completed&&ending.replaying)
    return moveEnding(ending,"daily",{replaying:false});
  const today=endingDayKey();
  return writeEnding({...ending,phase:"complete",completed:true,replayable:true,replaying:false,
    completedAt:ending.completedAt||Date.now(),activeDays:ending.activeDays||1,
    lastActiveDay:ending.lastActiveDay||today});
};

const continueEnding=ending=>moveEnding(ending,"daily",{replaying:false});
const replayEnding=ending=>ending&&ending.completed
  ?moveEnding(ending,"dialogue",{replaying:true}):ending;

/* 엔딩 뒤의 날짜는 현실에서 지나간 날 수가 아니라 실제 접속한 날짜 수다.
   같은 날 열고 닫아도 한 번, 다음 날짜에 다시 들어왔을 때만 한 칸 간다. */
const touchEndingDay=(ending,now=new Date())=>{
  if(!ending||!ending.completed)return ending;
  const key=endingDayKey(now);
  if(ending.lastActiveDay===key)return ending;
  return writeEnding({...ending,lastActiveDay:key,activeDays:Math.max(1,ending.activeDays||1)+1});
};

const loadDdayChoice=()=>{
  const ending=loadEnding();
  return ending&&ENDING_ROUTES.includes(ending.route)?ending.route:null;
};

const ddayChoiceLine=(choice,ending)=>{
  if(!ENDING_ROUTES.includes(choice))return "";
  const picked=choice==="jaeeon"?"이재언":"이강현";
  const other=choice==="jaeeon"?"이강현":"이재언";
  const day=ending&&ending.completed?` 엔딩 이후 함께 보낸 접속일은 ${ending.activeDays||1}일째다.`:"";
  return `${DDAY_CHOICE_TAG} 유저는 D-0에 ${picked}의 옆자리를 채우기로 정했고 이 관계의 일상이 계속된다. ${other}의 연애 루트는 닫혔으므로 우정과 기존 관계는 유지하되 연애 고백·질투·소유 표현으로 다시 진전시키지 않는다.${day} 이것은 유저가 방금 한 대사가 아니라 확정된 세계 상태다. 매 턴 되풀이하거나 다시 선택을 묻지 말고 이후의 태도와 행동에만 반영한다.`;
};

const attachDdayChoice=payload=>{
  if(!payload||(payload.mode!=="chat"&&payload.mode!=="auto"))return payload;
  const ending=loadEnding();
  const choice=ending&&ending.route;
  if(!ENDING_ROUTES.includes(choice))return payload;
  const old=String(payload.summary||"").split("\n")
    .filter(line=>!line.startsWith(DDAY_CHOICE_TAG)).join("\n").trim();
  return {...payload,dday_choice:choice,
    summary:ddayChoiceLine(choice,ending)+(old?"\n"+old:"")};
};

/* 일반 채팅 request뿐 아니라 관전 사건의 별도 fetch에도 같은 상태를 싣는다. */
(()=>{
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    if(!init||typeof init.body!=="string")return nativeFetch(input,init);
    try{
      const payload=JSON.parse(init.body);
      const next=attachDdayChoice(payload);
      if(next!==payload)init={...init,body:JSON.stringify(next)};
    }catch(e){ /* JSON 요청이 아니면 원래 fetch 그대로 보낸다 */ }
    return nativeFetch(input,init);
  };
})();
