/* NULL web · diary, flashback, encounter, name progress
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
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
