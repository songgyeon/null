/* NULL web · diary, flashback, encounter, name progress
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
/* ── 재언의 옛 일기 ──
   재언 방에 처음 들어가는 순간, 선톡 앞에 한 번. 20년 전 공부방 아이가
   쓴 것이고, 유저는 그걸 읽고 마지막 한 칸을 채운다.

   ⚠️ 채운 값은 **어떤 요청에도 실리지 않는다.** 프롬프트에도, story에도,
   페이로드에도 안 간다 — 여기 브라우저 안에만 산다. 유저만의 비밀이다.
   그래서 저장 자리도 이야기 상태(null_store_v1·loadStory)와 따로 둔다.
   시험이 실제 요청 본문을 뒤져서 이 값이 안 새는지 잰다.

   「엄마가 사탕을 줬다」에서 멈춘다. 누구에게 줬는지는 비운다 —
   사탕 삼각형은 어떤 화면도 발설하지 않는다. */
/* 종이의 결·빛·모서리만 사진이다. 본문과 빈칸은 실제 DOM 글자로 그려
   작성할 때와 CAM에서 다시 볼 때 같은 폰트·같은 줄바꿈을 유지한다. */
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
/* 다섯 장은 같은 빈 바인더 종이를 쓴다(1024×1536, 2:3).
   blanks의 숫자는 저장할 수 있는 글자 수 계약이다. 화면 좌표가 아니다. */
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
   blanks:{know:8,feel:11,between:13,like:15},
   echo:[{from:25,key:"feel",line:'D-25에 나는 그 눈빛이 꼭 "%s"다고 적었다.'}]},
  /* 두 칸은 코드가 안다 — 실제로 준 물건이다. 유저가 쓰는 것은 물건이 아니라
     **이유**다. 일기가 거울이 되는 자리라 여기만 자동이 섞인다.
     안 준 사람 칸은 그냥 빈칸으로 둔다 — 없는 선물을 지어내지 않는다. */
  /* ── 그런데 이유는 물어보고 있었다 ──
     물건 칸은 안 준 사람 것을 비워 두면서 「그걸 준 이유」는 유저 칸으로
     남겨두었다. 그래서 아무에게도 선물을 안 준 판에서 이 장은
     「내가 강현이에게 ___를 준 이유는 정말 [    ]뿐이었을까?」가 되고,
     그 [    ]를 채워야만 일기가 닫혔다 — **주지도 않은 선물을 준 척
     설명해야 저장되는 일기**였다. 없는 선물을 지어내지 않겠다고 해놓고
     없는 이유를 받아 적고 있었던 셈이다.
     문장을 네 갈래로 가른다. 준 사람 것만 묻고, 안 준 것은 안 물어본다.
     못 준 것은 못 줬다고 적는다 — 그것도 그날의 사실이다. */
  {at:14, variants:[
    {when:"both", text:
      "내가 채운 빈칸들이 나에게 돌아오고 있다. 내가 강현이에게 {giftK}를 준 이유는 "+
      "정말 {whyK}뿐이었을까? 이 선생님에게 {giftJ}를 줬던 건 {whyJ}만은 아니었던 "+
      "것 같다. 나는 두 사람에게 {want}고 싶다. 그게 {even}일지라도.",
     blanks:{giftK:5,whyK:14,giftJ:5,whyJ:19,want:9,even:13},
     auto:{giftK:"minhyun",giftJ:"jaeeon"}},
    {when:"minhyun", text:
      "내가 채운 빈칸들이 나에게 돌아오고 있다. 내가 강현이에게 {giftK}를 준 이유는 "+
      "정말 {whyK}뿐이었을까? 이 선생님에게는 아직 아무것도 건네지 못했다. "+
      "나는 두 사람에게 {want}고 싶다. 그게 {even}일지라도.",
     blanks:{giftK:5,whyK:14,want:9,even:13},
     auto:{giftK:"minhyun"}},
    {when:"jaeeon", text:
      "내가 채운 빈칸들이 나에게 돌아오고 있다. 이 선생님에게 {giftJ}를 줬던 건 "+
      "{whyJ}만은 아니었던 것 같다. 강현이에게는 아직 아무것도 건네지 못했다. "+
      "나는 두 사람에게 {want}고 싶다. 그게 {even}일지라도.",
     blanks:{giftJ:5,whyJ:19,want:9,even:13},
     auto:{giftJ:"jaeeon"}},
    {when:"none", text:
      "내가 채운 빈칸들이 나에게 돌아오고 있다. 그런데 나는 아직 두 사람 누구에게도 "+
      "아무것도 건네지 못했다. 나는 두 사람에게 {want}고 싶다. 그게 {even}일지라도.",
     blanks:{want:9,even:13}},
  ],
  echo:[{from:20,key:"like",line:'D-20에 나는 강현이가 "%s"처럼 느껴졌다고 적었다.'},
        {from:25,key:"feel",line:'D-25에 나는 그 눈빛이 꼭 "%s"다고 적었다.'}]},
  {at:7, text:
    "이제는 내가 누구인지 {decide}해야 할 때가 온 거 같다. 두 사람을 언제까지고 "+
    "{keep} 할 수는 없다. 강현이도, 이 선생님도 전부 나에게는 {both}다. "+
    "지금의 나에게는 내 {mine}보다 두 사람의 {theirs} 더 {more}다.",
   blanks:{decide:5,keep:11,both:10,mine:6,theirs:4,more:8},
   echo:[{from:14,key:"want",line:'D-14에 나는 두 사람에게 "%s"고 싶다고 적었다.'},
         {from:20,key:"between",line:'D-20에 나는 두 사람 사이에서 내가 "%s"라고 적었다.'}]},
  /* 마지막은 두 칸이다. 여기까지 온 사람에게 더 물을 것이 없다 */
  {at:1, text:"{last}. 나는 정말 {who}일까?",blanks:{last:7,who:7},
   echo:[{from:7,key:"both",line:'D-7에 나는 두 사람이 나에게는 "%s"라고 적었다.'},
         {from:14,key:"want",line:'D-14에 나는 두 사람에게 "%s"고 싶다고 적었다.'}]},
];
/* ── 어느 갈래인가 ──
   갈래가 없는 장은 그대로 돌려준다. 있는 장은 실제로 준 것이 정한다.
   **쓸 때와 다시 볼 때가 다르다**: 쓸 때는 지금 준 선물이 정하고, 다시 볼
   때는 그때 저장된 칸이 정한다. 나중에 선물을 더 줬다고 그날 쓴 일기의
   문장이 바뀌면 그건 일기가 아니다 — 일기는 그날에 묶여 있어야 한다.
   자동 칸은 실제로 준 것이 있을 때만 저장되므로(myDiaryAuto), 저장된
   값에 그 칸이 있는지가 그날의 갈래를 그대로 말해준다. */
const myDiaryVariant=(entry,gifts,saved)=>{
  const vs=(entry||{}).variants;
  if(!Array.isArray(vs)||!vs.length)return entry;
  const has=saved
    ? k=>Object.prototype.hasOwnProperty.call(saved,k)&&String(saved[k]||"").trim()!==""
    : k=>((((gifts||{})[k==="giftK"?"minhyun":"jaeeon"])||[]).length>0);
  const k=has("giftK"), j=has("giftJ");
  const when=k&&j?"both":k?"minhyun":j?"jaeeon":"none";
  const v=vs.find(x=>x.when===when)||vs[vs.length-1];
  /* variants는 남기지 않는다 — 고른 뒤의 장은 갈래가 없는 장과 같은 모양이다 */
  const {variants,...rest}=entry;
  return {...rest,...v};
};
/* ── 채운 빈칸이 돌아온다 ──
   D-14에는 「내가 채운 빈칸들이 나에게 돌아오고 있다」고 적혀 있었는데
   실제로는 앞 일기의 값이 단 하나도 안 돌아왔다. 종이에 쓰인 말이
   거짓말이었던 셈이다.

   돌려보내는 것은 유저가 쓴 그 글자 그대로다. 조사를 붙이지 않고 따옴표
   안에 그대로 인용한다 — 「나는 "다시 만날"고 싶다」 같은 문장을 코드가
   지어내면 유저가 쓴 말이 아니라 코드가 쓴 말이 된다. 인용은 원문을
   건드리지 않는 유일한 방법이다.

   여러 후보를 앞에서부터 본다. 일기는 건너뛸 수 있고, 건너뛴 것은 벌이
   아니다 — 있는 값 중 가장 가까운 날의 것을 쓰고, 하나도 없으면 아무
   줄도 안 붙는다. 그날 처음 쓰는 사람에게 없는 과거를 들이밀지 않는다.

   ⚠️ 이 값은 여전히 기기 밖으로 안 나간다. 돌아오는 자리는 다음 일기
   종이 안이지 프롬프트가 아니다 — 「서버 전달 경계」는 그대로다. */
const myDiaryEcho=(entry,all)=>{
  const list=(entry||{}).echo;
  if(!Array.isArray(list)||!list.length)return entry;
  for(const e of list){
    const v=((all||{})[e.from]||{})[e.key];
    const t=String(v==null?"":v).trim();
    if(!t)continue;
    const {echo,...rest}=entry;
    return {...rest,text:e.line.replace("%s",t)+" "+entry.text,echoed:{from:e.from,key:e.key,text:t}};
  }
  const {echo,...rest}=entry;
  return rest;
};
/* ── 「회색 머그컵를 준 이유는」 ──
   물건 이름은 코드가 채우는 칸인데 뒤 조사는 글에 박혀 있었다. 그런데
   「회색 머그컵을」과 「사진집을」과 「편지지를」이 다 다르다 — 받침이 있으면
   「을」, 없으면 「를」이다. 무엇이 들어갈지는 갈래를 고르고 값이 정해진
   뒤라야 알 수 있으므로 여기서 한 번에 바꾼다.
   유저가 쓴 칸에는 손대지 않는다. 코드가 채우는 칸(auto) 뒤에서만이다 —
   유저가 쓴 말에 코드가 조사를 붙이는 순간 그건 유저가 쓴 말이 아니다. */
const myDiaryJosa=(entry,auto)=>{
  const src=String((entry||{}).text||"");
  let t=src;
  for(const [k,v] of Object.entries(auto||{})){
    const name=String(v==null?"":v).trim(); if(!name)continue;
    t=t.replace(new RegExp("\\{"+k+"\\}(을|를)"),"{"+k+"}"+jos(name,"을/를").slice(name.length));
  }
  return t===src?entry:{...entry,text:t};
};
/* 화면이 쓰는 입구 하나. 갈래를 먼저 고르고(그 장의 문장이 정해진다),
   실제로 앉을 물건 이름에 조사를 맞추고, 그다음에 앞 일기를 앞에 얹는다 —
   순서가 뒤집히면 갈래가 인용문까지 갈아치운다. */
const myDiaryPage=(entry,gifts,all,saved)=>{
  const v=myDiaryVariant(entry,gifts,saved);
  return myDiaryEcho(myDiaryJosa(v,saved||myDiaryAuto(v,gifts)),all);
};
/* 글에서 칸을 뽑아 조각으로 가른다. 화면도 시험도 이 하나를 쓴다 —
   글과 칸 차례를 두 군데서 세면 언젠가 어긋난다. */
const myDiaryParts=text=>String(text||"").split(/(\{[a-zA-Z]+\})/)
  .filter(x=>x!=="").map(x=>/^\{[a-zA-Z]+\}$/.test(x)
    ? {blank:x.slice(1,-1)} : {text:x});
/* 자동 칸의 소유권은 값이 아니라 장의 auto 선언이 정한다. */
const myDiarySystemOwned=(entry,key)=>Object.prototype.hasOwnProperty.call(
  ((entry||{}).auto)||{},key);
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
const MY_DIARY_SCHEMA_KEY="null_mydiary_schema";
const MY_DIARY_SCHEMA="font-d1-v1";
const MY_DIARY_LEGACY_KEY="null_mydiary_legacy_d0";
const loadMyDiary=()=>{try{
  const v=JSON.parse(localStorage.getItem("null_mydiary"));
  if(!v||typeof v!=="object"||Array.isArray(v))return{};
  /* 사진판 v283이 D-0 값을 D-1 완료로 잘못 옮겨 새 D-1을 숨겼다.
     기존 값은 별도 보관하고 현재 D-1은 다시 쓸 수 있게 연다. */
  if(localStorage.getItem(MY_DIARY_SCHEMA_KEY)!==MY_DIARY_SCHEMA){
    const legacy=Object.prototype.hasOwnProperty.call(v,"0")?v[0]:v[1];
    if(legacy&&!localStorage.getItem(MY_DIARY_LEGACY_KEY))
      localStorage.setItem(MY_DIARY_LEGACY_KEY,JSON.stringify(legacy));
    const next={...v};delete next[0];delete next[1];
    localStorage.setItem("null_mydiary",JSON.stringify(next));
    localStorage.setItem(MY_DIARY_SCHEMA_KEY,MY_DIARY_SCHEMA);
    return next;
  }
  return v;
}catch(e){return{}}};
/* 한 장을 통째로 저장한다. 유저 칸이 하나라도 비면 저장하지 않는다 —
   반쯤 채운 일기는 나중에 열었을 때 뭘 하다 만 건지 알 수 없다. */
const saveMyDiary=(at,vals)=>{try{
  const raw=MY_DIARY.find(x=>x.at===at); if(!raw)return null;
  /* ── 갈래가 있는 장은 지금 들어온 값이 갈래를 정한다 ──
     원장(MY_DIARY)의 D-14에는 blanks가 없다 — 갈래 안에 산다. 그걸 모르고
     raw.blanks를 그대로 읽으면 Object.keys(undefined)가 터지고, catch가
     그것을 삼켜 **그 장이 통째로 저장이 안 된다**. 화면에서는 다 채우고
     「덮기 ♡」를 눌렀는데 아무 일도 안 일어나는 그림이었다.
     화면이 어느 갈래로 그렸는지는 들어온 값이 말해준다: 자동 칸(giftK·giftJ)은
     실제로 준 선물이 있을 때만 채워져 오므로, 그 존재가 곧 그날의 갈래다. */
  const e=myDiaryVariant(raw,null,vals||{});
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
  localStorage.setItem(MY_DIARY_SCHEMA_KEY,MY_DIARY_SCHEMA);
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
/* ── D-0에서 마지막으로 한 번 더 ──
   서른 날 동안 채운 빈칸이 돌아오는 마지막 자리다. 일기끼리만 주고받고
   끝나면 그 값은 일기 밖으로 한 번도 안 나온 것이 된다 — 「진짜 완전 True」는
   유저가 자기 물음에 답을 받는 화면인데, 그 물음을 유저가 직접 적어뒀다.

   D-1의 「나는 정말 {who}일까?」가 첫 후보다. 그 장을 안 썼으면 D-7·D-14로
   내려간다. 하나도 안 썼으면 아무것도 안 돌려준다 — 안 쓴 사람에게 지어낸
   과거를 보여주지 않는다. 안 쓰는 것도 선택이었다.

   여기서도 값은 기기 밖으로 안 나간다. 화면에 그리는 것뿐이다. */
const MY_DIARY_LAST=[
  {from:1,  key:"who",  line:'나는 정말 "%s"일까?'},
  {from:7,  key:"both", line:'두 사람은 나에게 "%s"였다.'},
  {from:14, key:"want", line:'나는 두 사람에게 "%s"고 싶었다.'},
  {from:20, key:"like", line:'강현이가 "%s"처럼 느껴졌던 날이 있었다.'},
  {from:25, key:"feel", line:'그 눈빛이 꼭 "%s" 같았다.'},
];
const myDiaryLast=()=>{
  const all=loadMyDiary();
  for(const e of MY_DIARY_LAST){
    const t=String(((all||{})[e.from]||{})[e.key]||"").trim();
    if(t)return {at:e.from,key:e.key,text:e.line.replace("%s",t)};
  }
  return null;
};
const userPics=(name,giftsOverride)=>{
  const out=[];
  const d=loadDiary();
  if(d)out.push({src:DIARY_PAPER_IMG,label:`${(name||"당신").trim()||"당신"}의 옛 일기`,
    diary:{kind:"child",src:DIARY_PAPER_IMG,values:{why:d}}});
  /* ⑩ 쓴 일기도 여기 쌓인다 — 옛 일기 다음 자리다. 자동으로 찬 칸도 같이
     얹는다: 화면에서 본 그대로여야 한다 */
  const md=loadMyDiary();
  for(const raw of MY_DIARY){
    const w=md[raw.at]; if(!w)continue;
    /* 다시 볼 때의 갈래는 그때 저장된 칸이 정한다 — 그 뒤에 선물을 더 줬어도
       그날 쓴 문장은 안 바뀐다 */
    const e=myDiaryPage(raw,null,md,w);
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
