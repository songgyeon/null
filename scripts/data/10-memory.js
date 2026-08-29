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
/* 화면에 그리는 것은 **사진**이다. 줄공책을 CSS로 흉내내던 때가 있었는데,
   이건 20년 전 물건이고 물건은 흉내내면 물건이 아니게 된다.
   아래 글은 그 사진에 적힌 정사 원문이다 — 사진을 못 읽는 사람에게 읽어주는
   글(alt)이자, 이 빈칸이 어떤 문장인지 코드가 아는 자리다. */
const DIARY_IMG="diary-jaeeon.webp";
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
/* 빈칸이 사진 위 어디에 앉는지. 사진에 그려진 네모를 실제로 재서 넣은
   값이다(1024×1536 기준). 눈으로 맞추면 화면 크기가 바뀔 때마다 어긋난다. */
const DIARY_BOX={left:51.56,top:77.41,w:25.98,h:4.62};
const loadDiary=()=>{try{return localStorage.getItem("null_diary")||""}catch(e){return""}};
const saveDiary=v=>{try{
  const t=(v||"").toString().trim().slice(0,DIARY_MAX);
  if(t)localStorage.setItem("null_diary",t);
  return t;
}catch(e){return""}};

/* ── 민현의 옛 일기 — 병원 옥상 ──
   오프닝에서 민현을 만난 판에서, 「저 알죠」 세 줄이 다 앉은 뒤 유저가 처음
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

/* ── {이름} pics ──
   cam 탭은 원래 「받은 사진」이었다. 여기 서는 둘은 받은 게 아니라 유저가
   쓴 것이다 — 유저의 옛 일기 마지막 칸, 병원 옥상 엽서의 세 칸.
   그래서 두 사람 다음에 자기 이름으로 따로 선다. 채운 것만 나온다.

   빈칸 값은 여전히 기기 밖으로 안 나간다. 여기서 하는 일은 이미 저장돼
   있는 값을 사진 위 제자리에 얹어 보여주는 것뿐이다. */
const userPics=name=>{
  const out=[];
  const d=loadDiary();
  if(d)out.push({src:DIARY_IMG,label:`${(name||"당신").trim()||"당신"}의 옛 일기`,
    fill:[{...DIARY_BOX,text:d}]});
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
