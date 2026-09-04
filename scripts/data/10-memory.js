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
   옛 일기(diary-jaeeon.webp)는 20년 전 **물건**이라 사진 위에 빈칸이 앉는다.
   이건 유저가 지금 쓰는 것이라 사진이 없다 — 흐르는 글 안에 칸이 박힌다.
   같은 빈칸이어도 재질이 다르다.

   ── 선택이다 ──
   매일 쓰면 일과가 되고, 일과가 되면 안 쓴다. 그래서 날마다 안 묻는다.
   떠날 날 눈금 다섯에 한 장씩만 열리고, 안 써도 아무것도 안 막힌다.
   다섯 장은 순서가 아니라 거리다 — 뒤로 갈수록 문장이 짧아지고 마지막
   장은 두 칸뿐이다.

   ⚠️ 채운 값은 **어떤 요청에도 안 실린다.** 옛 일기·엽서와 같은 자리다 —
   프롬프트에도, story에도, 페이로드에도 안 간다. 시험이 실제 요청 본문을
   뒤져서 이 값이 안 새는지 잰다. 두 사람이 모르는 것이 이 게임의 뼈다. */
/* ── 사진 한 장에 한 장 ──
   옛 일기와 같은 규격이다(1024×1536, 2:3). 글은 사진에 이미 적혀 있고
   네모도 사진에 그려져 있다 — 화면은 그 네모 안에 커서를 세울 뿐이다.
   아래 text는 그 사진에 적힌 정사 원문이다. 사진을 못 읽는 사람에게
   읽어주는 글(alt)이자, 어느 칸이 무슨 뜻인지 코드가 아는 자리다.
   box는 사진에 그려진 네모를 **실제로 재서** 넣는다(1024×1536 기준).
   눈으로 맞추면 화면 크기가 바뀔 때마다 어긋난다 — 옛 일기에서 그랬다.
   재는 방법: 선을 쫓지 않고 **둘러싸인 밝은 칸**을 찾는다(바깥 종이를 칠해
   없앤 뒤 남는 덩어리). 선이 흐린 장에서도 다섯 장 전부 정확히 나왔다.

   blanks의 숫자는 그 네모에 실제로 들어가는 글자 수다. 옛 일기가 폭 25.98%에
   여덟 자였으므로 한 자에 3.25% — 그 자로 네모 폭을 나눴다. 넉넉히 잡으면
   글자가 그려진 네모 밖으로 삐져나온다. */
const MY_DIARY=[
  {at:25, img:"mydiary-1.webp", text:
    "오늘 이 선생님과 {talk} 얘기를 나눴다. 이 선생님은 가끔 나를 오래 안 것처럼 "+
    "쳐다본다. 그게 꼭 {feel}다. 강현이한테는 {told} 했는데 강현이는 내가 "+
    "{think}고 생각하는 거 같다. 내일은 {tmr}까? 잘 모르겠다. 나는 여전히 빈칸이다.",
   blanks:{talk:6,feel:7,told:7,think:6,tmr:7},
   box:{talk:{left:46.58,top:22.66,w:19.14,h:3.84},feel:{left:49.51,top:35.29,w:22.36,h:3.65},
        told:{left:40.33,top:44.40,w:21.88,h:3.78},think:{left:42.09,top:50.20,w:18.46,h:3.45},
        tmr:{left:30.86,top:58.72,w:23.73,h:3.71}}},
  {at:20, img:"mydiary-2.webp", text:
    "어쩌면 이 선생님은 나를 {know}도 모른다. 그게 나에게는 {feel}다. "+
    "강현이와 이 선생님 사이에서 나는 {between}다. 오늘은 강현이가 {like}처럼 "+
    "느껴졌다. 앞으로 어떻게 해야 할까. 아직은 더 채워야겠다.",
   blanks:{know:8,feel:11,between:13,like:15},
   box:{know:{left:53.22,top:20.57,w:25.00,h:4.95},feel:{left:41.31,top:29.82,w:34.38,h:4.49},
        between:{left:27.34,top:46.09,w:43.26,h:4.82},like:{left:19.92,top:62.63,w:47.85,h:4.88}}},
  /* 두 칸은 코드가 안다 — 실제로 준 물건이다. 유저가 쓰는 것은 물건이 아니라
     **이유**다. 일기가 거울이 되는 자리라 여기만 자동이 섞인다.
     안 준 사람 칸은 그냥 빈칸으로 둔다 — 없는 선물을 지어내지 않는다. */
  {at:14, img:"mydiary-3.webp", text:
    "내가 채운 빈칸들이 나에게 돌아오고 있다. 내가 강현이에게 {giftK}를 준 이유는 "+
    "정말 {whyK}뿐이었을까? 이 선생님에게 {giftJ}를 줬던 건 {whyJ}만은 아니었던 "+
    "것 같다. 나는 두 사람에게 {want}고 싶다. 그게 {even}일지라도.",
   blanks:{giftK:5,whyK:14,giftJ:5,whyJ:19,want:9,even:13},
   auto:{giftK:"minhyun",giftJ:"jaeeon"},
   box:{giftK:{left:45.51,top:28.84,w:16.11,h:3.78},whyK:{left:28.61,top:35.68,w:45.12,h:4.82},
        giftJ:{left:41.99,top:46.29,w:16.70,h:3.84},whyJ:{left:19.92,top:52.67,w:60.35,h:5.34},
        want:{left:44.82,top:66.41,w:28.12,h:4.30},even:{left:27.83,top:73.96,w:41.31,h:5.08}}},
  {at:7, img:"mydiary-4.webp", text:
    "이제는 내가 누구인지 {decide}해야 할 때가 온 거 같다. 두 사람을 언제까지고 "+
    "{keep} 할 수는 없다. 강현이도, 이 선생님도 전부 나에게는 {both}다. "+
    "지금의 나에게는 내 {mine}보다 두 사람의 {theirs} 더 {more}다.",
   blanks:{decide:5,keep:11,both:10,mine:6,theirs:4,more:8},
   box:{decide:{left:51.95,top:23.11,w:14.84,h:4.04},keep:{left:50.78,top:36.46,w:34.96,h:4.10},
        both:{left:21.00,top:54.95,w:31.64,h:3.91},mine:{left:49.90,top:63.80,w:19.04,h:3.78},
        theirs:{left:35.35,top:69.99,w:14.36,h:3.91},more:{left:57.23,top:70.18,w:25.20,h:3.91}}},
  /* 마지막은 두 칸이다. 여기까지 온 사람에게 더 물을 것이 없다 */
  {at:1, img:"mydiary-5.webp", text:"{last}. 나는 정말 {who}일까?",
   blanks:{last:7,who:7},
   box:{last:{left:25.78,top:39.45,w:21.58,h:4.10},who:{left:44.53,top:49.15,w:23.73,h:3.97}}},
];
/* 글에서 칸을 뽑아 조각으로 가른다. 화면도 시험도 이 하나를 쓴다 —
   글과 칸 차례를 두 군데서 세면 언젠가 어긋난다. */
const myDiaryParts=text=>String(text||"").split(/(\{[a-zA-Z]+\})/)
  .filter(x=>x!=="").map(x=>/^\{[a-zA-Z]+\}$/.test(x)
    ? {blank:x.slice(1,-1)} : {text:x});
/* 자동으로 채워지는 칸의 값 — 그 사람에게 실제로 준 것 중 마지막 하나.
   안 줬으면 빈 문자열인 시스템 고정 칸으로 남는다. */
const myDiaryAuto=(entry,gifts)=>{
  const out={};
  for(const [k,who] of Object.entries((entry||{}).auto||{})){
    const a=((gifts||{})[who])||[];
    const name=a.length?GIFT_NAME[a[a.length-1]]:"";
    if(name)out[k]=name;
  }
  return out;
};
/* 값이 실제로 찼는지가 아니라 장의 선언을 본다. 선물을 안 줬어도 giftK·giftJ는
   유저가 지어내는 칸이 아니라 시스템이 비워 둔 고정 칸이다. */
const myDiaryAutoKeys=entry=>Object.keys((entry||{}).auto||{});
const myDiaryUserKeys=entry=>{
  const auto=new Set(myDiaryAutoKeys(entry));
  return Object.keys((entry||{}).blanks||{}).filter(k=>!auto.has(k));
};
const loadMyDiary=()=>{try{
  const v=JSON.parse(localStorage.getItem("null_mydiary"));
  if(!v||typeof v!=="object"||Array.isArray(v))return{};
  /* 마지막 장은 처음에 D-0이었다. 새 정본의 D-1로 옮기되 이미 쓴 두 칸은
     그대로 든다. 새 키가 함께 있는 비정상 중복 저장은 어느 쪽도 버리지 않는다. */
  if(Object.prototype.hasOwnProperty.call(v,"0")
    && !Object.prototype.hasOwnProperty.call(v,"1")){
    const next={...v,1:v[0]}; delete next[0];
    try{localStorage.setItem("null_mydiary",JSON.stringify(next))}catch(e){}
    return next;
  }
  return v;
}catch(e){return{}}};
/* 한 장을 통째로 저장한다. 유저 칸이 하나라도 비면 저장하지 않는다 —
   반쯤 채운 일기는 나중에 열었을 때 뭘 하다 만 건지 알 수 없다. */
const saveMyDiary=(at,vals)=>{try{
  const e=MY_DIARY.find(x=>x.at===at); if(!e)return null;
  const user=new Set(myDiaryUserKeys(e));
  const out={};
  for(const k of Object.keys(e.blanks)){
    /* 자동 칸은 실제 선물 이름이라 유저 입력 길이로 자르지 않는다. 선물을
       안 줬다면 빈 문자열 그대로 저장해, 나중 선물이 옛 일기를 바꾸지 않게 한다. */
    let t=((vals||{})[k]||"").toString().trim();
    if(user.has(k)){
      t=t.slice(0,e.blanks[k]);
      if(!t)return null;
    }
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

   빈칸 값은 여전히 기기 밖으로 안 나간다. 여기서 하는 일은 이미 저장돼
   있는 값을 사진 위 제자리에 얹어 보여주는 것뿐이다. */
const userPics=name=>{
  const out=[];
  const d=loadDiary();
  if(d)out.push({src:DIARY_IMG,kind:"diary",label:`${(name||"당신").trim()||"당신"}의 옛 일기`,
    fill:[{...DIARY_BOX,text:d}]});
  /* ⑩ 쓴 일기도 여기 쌓인다 — 옛 일기 다음 자리다. 자동으로 찬 칸도 같이
     얹는다: 화면에서 본 그대로여야 한다 */
  const md=loadMyDiary(), gf=loadGifts();
  for(const e of MY_DIARY){
    const w=md[e.at]; if(!w)continue;
    const auto=myDiaryAuto(e,gf);
    out.push({src:e.img,kind:"diary",label:`D-${e.at}`,
      /* 저장 당시의 값이 정본이다. 빈 자동 칸도 이후 선물로 소급해 채우지 않는다. */
      fill:Object.keys(e.blanks).map(k=>({...e.box[k],auto:Object.prototype.hasOwnProperty.call(e.auto||{},k),text:
        Object.prototype.hasOwnProperty.call(w,k)?w[k]:(auto[k]||"")}))});
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
