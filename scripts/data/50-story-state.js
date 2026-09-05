/* NULL web · edits, effects, queues, story ledger, photo album
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
const EDIT_MAX=500;
const loadEdits=()=>{try{return JSON.parse(localStorage.getItem("null_edits"))||[]}catch(e){return[]}};
const saveEdits=a=>{try{localStorage.setItem("null_edits",JSON.stringify(a.slice(-EDIT_MAX)))}catch(e){}};
const loadMet=()=>{try{return JSON.parse(localStorage.getItem("null_met"))||[]}catch(e){return[]}};
const saveMet=a=>{try{localStorage.setItem("null_met",JSON.stringify(a));return true}catch(e){return false}};
const loadRefused=()=>{try{return JSON.parse(localStorage.getItem("null_refused"))||[]}catch(e){return[]}};
const saveRefused=a=>{try{localStorage.setItem("null_refused",JSON.stringify(a));return true}catch(e){return false}};
/* 눌러서 만드는 사건(선물·해금·약속) 말고, 그냥 쌓여서 되는 사건이 둘 있다.
   한 번씩만 찍는다 — 같은 일이 매일 나오면 그건 사건이 아니라 배경이다. */
const PHOTO_EVENT_AT=5;      // 재언에게 사진을 이만큼 받으면 강현이 눈치챈다
const DDAY_MARKS=[7,3,1];    // 남은 날이 이 값이 되는 날
/* ── 이미 새긴 사건 ──
   워커가 준 Effect.id를 적어둔다. 같은 응답을 두 번 처리해도(재시도·늦게
   온 답·새로고침) 결과가 한 번과 같으려면 이게 있어야 한다.

   상한을 둔다. 한 판에서 나올 수 있는 Effect는 자리 아이템 아홉과 초대
   몇 번이 전부지만, 재시도마다 request_id가 달라지므로 id는 그보다 는다.
   200이면 한 판을 다 돌고도 남는다 — 넘치면 오래된 것부터 버린다.
   버려진 id가 다시 와도 그때는 이미 가방에 있어서 takeItem이 막는다. */
/* ── 두 마디는 하고 나서 ──
   자리에 들르자마자 물건이 손에 들어오면 그건 받은 게 아니라 주운 것이다.
   웹과 앱이 **같은 숫자와 같은 셈**을 써야 한다 — 손으로 복제하면 갈린다.
   여기가 원본이고 rules.ts는 여기서 만들어진다.

   list를 반드시 넘긴다. 화면 상태(리액트 msgs)는 방금 친 말이 빠져 있어서,
   두 번째 발화에서 열려야 할 것이 세 번째부터 열렸다.
   ts든 created_at이든 받는다 — 웹은 ts, 앱은 created_at이다. */
const SCENE_MIN_TALK=2;
const countUserSaid=(sc,list)=>!sc?0:(list||[])
  .filter(m=>m&&!m.sys&&m.sender==="user"&&((m.ts||m.created_at||0)>=(sc.since||0))).length;
const talkedEnoughIn=(sc,list)=>countUserSaid(sc,list)>=SCENE_MIN_TALK;

const EFF_MAX=200;
const loadEffDone=()=>{try{const a=JSON.parse(localStorage.getItem("null_eff_done"));return Array.isArray(a)?a:[]}catch(e){return[]}};
const saveEffDone=a=>{try{
  localStorage.setItem("null_eff_done",JSON.stringify((a||[]).slice(-EFF_MAX)));return true;
}catch(e){return false}};

/* ── 답 하나는 한 덩어리다 ──
   전에는 말풍선을 0.6초마다 하나씩 화면 상태에 붙였고, 저장은 리액트가
   그림을 그린 뒤에야 따라왔다. 그런데 Effect 표(effect_done)와 장면 소모
   (ackScene)는 답이 오자마자 찍혔다. 그 사이에 새로고침하면 **장면은
   소모됐는데 답은 한 줄도 안 남은** 세이브가 된다. 초대는 더 나빴다 —
   표만 즉시 찍고 창은 타이머 뒤에 열어서, 그 전에 껐다 켜면 완료 표시만
   남고 초대는 영영 안 왔다.

   순서를 뒤집는다. 답이 오면 **먼저** 통째로 여기 적는다: 말풍선 전부,
   뒤따를 지문, 열어야 할 초대, 닫아야 할 자리. 그 다음에 장면을 지우고,
   화면은 적힌 것을 재생할 뿐이다. 재생 도중 꺼도 남은 것부터 다시 푼다.

   말풍선마다 id를 **적을 때** 박는다. 저장이 어디서 끊겨도 같은 id가 두
   번 붙지는 않는다 — 재생하기 전에 그 방에 이미 있는지 보면 된다.

   ── 상한을 두지 않는다 ──
   전에는 `slice(-8)`로 잘랐다. 이건 완료 기록이 아니라 **미완료 장부**다.
   아홉 번째가 들어올 때 제일 오래된 **아직 안 푼 답**이 조용히 사라졌다 —
   가방과 effect_done만 남고 「받았다」 지문이 없어지는 자리가 그거였다.
   다 푼 덩어리는 스스로 지워진다(dropBatch). 안 지워졌으면 아직 할 일이
   남은 것이므로 오래됐다는 이유로 버릴 근거가 없다. */
const okBatch=b=>!!b&&typeof b==="object"&&typeof b.id==="string"&&!!b.id;
/* 저장값이 깨져 있어도 앱을 죽이지 않는다 — 읽을 수 있는 것만 남긴다 */
const loadBatches=()=>{try{
  const a=JSON.parse(localStorage.getItem("null_batch"));
  if(!Array.isArray(a))return[];
  return a.filter(okBatch).map(b=>({...b,
    items:Array.isArray(b.items)?b.items.filter(i=>i&&i.id):[],
    sys:Array.isArray(b.sys)?b.sys.filter(s=>s&&s.id):[]}));
}catch(e){return[]}};
const saveBatches=a=>{try{
  localStorage.setItem("null_batch",JSON.stringify((a||[]).filter(okBatch)));return true;
}catch(e){return false}};
/* ── 이미 있는 id는 덮지 않는다 ──
   같은 답이 두 번 처리될 수 있다(늦게 온 답·재시도·되살아난 탭). 그때
   덮어쓰면 **반쯤 푼 상태가 처음으로 되돌아가** 이미 화면에 뜬 말풍선이
   한 번 더 뜬다. 있으면 그대로 두고 false를 돌려준다. */
const putBatch=b=>{
  const a=loadBatches();
  if(a.some(x=>x.id===b.id))return false;
  a.push(b); return saveBatches(a);
};
const getBatch=id=>loadBatches().find(x=>x.id===id)||null;
/* 그린 것 하나를 기록에서 뺀다. 갈래를 셋으로 가른다 —
   전에는 셋이 다 null이었다. 「이미 끝난 덩어리」와 「저장이 안 됐다」가
   같은 값이면, 저장 실패가 조용히 넘어가 그 방이 영영 잠긴다.

   missing        없는 덩어리다. 이미 끝났다 — 두 번 끝내지 않는다
   storage_error  안 뺐다. 뺐다고 치고 넘어가면 그 줄을 다시 못 푼다
   ok             뺐다. batch.items가 비었으면 마지막 말풍선이 방금 떴다 */
const dropBatchItem=(id,itemId)=>{
  const a=loadBatches(),b=a.find(x=>x.id===id);
  if(!b)return{status:"missing",batch:null};
  b.items=(b.items||[]).filter(i=>i&&i.id!==itemId);
  return saveBatches(a)?{status:"ok",batch:b}:{status:"storage_error",batch:b};
};
const dropBatch=id=>saveBatches(loadBatches().filter(x=>x.id!==id));
/* 한 덩어리에 든 말풍선의 id. 재생 전에 그 방에 이미 있는지 보는 자 */
const batchItemId=(id,i)=>id+"#"+i;

/* ── 초대는 화면 상태가 아니라 남는 상태다. 그리고 하나가 아니다 ──
   effect_done은 즉시 찍는데 초대는 setInvite()만 했다. 새로고침 한 번에
   「이미 처리했다」는 표만 남고 창은 사라진다 — 워커는 초대한 걸로 아는데
   유저에게는 물어본 적이 없는 게 된다.

   값 하나로 두면 두 방에서 초대가 겹칠 때 나중 것이 아직 답 안 한 앞의
   것을 덮는다. 재언의 편의점을 물어보기 전에 강현의 옥상이 오면 편의점은
   묻지도 못하고 사라진다. 줄로 세운다 — 앞엣것에 답해야 다음이 열린다. */
const loadInvites=()=>{try{
  const v=JSON.parse(localStorage.getItem("null_invite"));
  if(Array.isArray(v))return v.filter(x=>x&&x.place&&x.char);
  return v&&v.place&&v.char?[v]:[];   // 옛 단일 값도 읽는다
}catch(e){return[]}};
const saveInvites=a=>{try{
  const list=(a||[]).filter(x=>x&&x.place&&x.char);
  if(list.length)localStorage.setItem("null_invite",JSON.stringify(list));
  else localStorage.removeItem("null_invite");
  return true;
}catch(e){return false}};
const headInvite=()=>loadInvites()[0]||null;
/* 같은 초대가 두 번 들어오지 않는다 — 그건 같은 물음이다 */
const pushInvite=iv=>{
  const a=loadInvites();
  if(a.some(x=>x.place===iv.place&&x.char===iv.char))return true;
  a.push(iv); return saveInvites(a);
};
const shiftInvite=()=>{const a=loadInvites();a.shift();return saveInvites(a)};

const loadEvDone=()=>{try{return JSON.parse(localStorage.getItem("null_ev_done"))||[]}catch(e){return[]}};
const saveEvDone=a=>{try{localStorage.setItem("null_ev_done",JSON.stringify(a))}catch(e){}};
/* ── 한 번만 할 일에 이름표 ──
   방을 빨리 두 번 열면 첫 연락이 두 번 나갔다. 다 하고 나서 「했다」를
   찍으면 그 사이가 열린다 — 첫 번째가 아직 안 끝났을 때 두 번째가 들어와
   보면 표가 아직 없다. 그래서 표는 하기 전에 찍는다.
   대신 실패해도 그 일은 다시 안 온다. 정해진 줄을 그 자리에서 넣는 일에만
   쓴다 — 서버를 타는 일에는 안 쓴다. */
const markOnce=id=>{const a=loadEvDone();if(a.indexOf(id)>=0)return false;
  a.push(id);saveEvDone(a);return true};
const didOnce=id=>loadEvDone().indexOf(id)>=0;

/* ── 중요한 장면을 예약해둔다 ──
   서버는 상태를 안 들고 있으므로 「지금이 어떤 자리인지」는 여기서 말해줘야
   한다. 다만 아무 말이나 보내면 안 된다 — 서버가 허용된 사유 목록과 지금
   상태를 둘 다 보고 승인한다. 여기서는 방마다 한 번짜리로 적어두고,
   그 방의 다음 한 마디에 실어 보낸 뒤 지운다. */
const SCENE_REASONS = ["memory_reveal","null_identity","confession","irreversible",
  "partner_confirm","dday_choice","partner_first_reaction","partner_known",
  "parting","ending","conflict_result"];
/* ── 이야기 상태 (E3) ──
   이야기가 어디까지 왔나. 워커는 아무것도 기억하지 않으므로 여기가 원본이고,
   매 요청에 실어 보낸다. 바뀌는 길은 하나다 — 워커가 검증된 응답 뒤에 낸
   story_transition Effect를 장부가 적용하는 것. 클라이언트가 제 손으로
   explained/acknowledged를 찍는 자리는 없다.
     firstContact  unseen → pending → explained → recognized  강현의 병원 옥상
     jaeeonMemory  hidden → opened → acknowledged 재언의 20년 기억
     partnerKnown  {jaeeon,minhyun}               상대가 정해진 걸 아는가

   explained는 강현이 **말한** 자리고 recognized는 유저가 **받아들인** 자리다.
   둘을 한 칸으로 뭉치면 말한 순간 아는 사이가 되어, 유저가 계속 「누구세요」를
   쳐도 워커에 실리는 사실은 「이미 설명했다」 하나뿐이었다. */
const STORY_FC=["unseen","pending","explained","recognized"];
/* ── 학교에서 만났나 ──
   처음부터 교생인 걸 아는 게 아니다. 학교에서 만난 뒤부터 안다. 그 전까지는
   과거의 만남이 유저에 대해 아는 전부다.
   partnerKnown과 같은 모양이다 — 되돌릴 수 없고, 사람마다 따로 선다. */
const SCHOOL_PLACES=["학교","교실","보건실","옥상","체육관"];
const isSchoolPlace=place=>SCHOOL_PLACES.includes(place);
const STORY_JM=["hidden","opened","acknowledged"];
/* ── 유저가 그은 선 ──
   「둘이 있을 때 삼촌 얘기 하지 마」는 유저가 한 말이고, 그 말은 다음 날에도
   유효해야 한다. 안 그러면 어제 한 말이 없는 일이 되고, 그게 이 장르에서
   유저가 제일 못 견디는 것이다(치매·현타).
   지금 아는 화제는 하나다 — partner, 그 방에서 안 꺼냈으면 하는 상대 인물.
   방마다 따로 선다: 재언에게 그은 선이 강현에게까지 가면 그건 유저가 긋지
   않은 선이다. */
const STORY_TOPICS=["partner"];
const normBoundaries=b=>{
  const o=b||{},out={};
  for(const who of ["jaeeon","minhyun"])
    out[who]=(Array.isArray(o[who])?o[who]:[]).filter(t=>STORY_TOPICS.includes(t));
  return out;
};
const loadStory=()=>{try{
  const o=JSON.parse(localStorage.getItem("null_story"))||{};
  const pk=o.partnerKnown||{};
  const sm=o.schoolMet||{};
  return{firstContact:STORY_FC.includes(o.firstContact)?o.firstContact:"unseen",
    jaeeonMemory:STORY_JM.includes(o.jaeeonMemory)?o.jaeeonMemory:"hidden",
    partnerKnown:{jaeeon:!!pk.jaeeon,minhyun:!!pk.minhyun},
    schoolMet:{jaeeon:!!sm.jaeeon,minhyun:!!sm.minhyun},
    boundaries:normBoundaries(o.boundaries)};
}catch(e){return{firstContact:"unseen",jaeeonMemory:"hidden",
  partnerKnown:{jaeeon:false,minhyun:false},schoolMet:{jaeeon:false,minhyun:false},
  boundaries:{jaeeon:[],minhyun:[]}}}};
/* 선은 긋기만 하고 지우지 않는다 — 지우는 자리를 코드에 만들지 않는다.
   되풀이해도 같다. 저장은 쓰고 나서 다시 읽어 확인한다(장부의 규칙 그대로). */
const markBoundary=(room,topic)=>{
  if(room!=="jaeeon"&&room!=="minhyun")return "skip";
  if(!STORY_TOPICS.includes(topic))return "skip";
  const s=loadStory();
  if((s.boundaries[room]||[]).includes(topic))return "done";
  const next={...s,boundaries:{...s.boundaries,
    [room]:[...(s.boundaries[room]||[]),topic]}};
  if(!saveStory(next)||!(loadStory().boundaries[room]||[]).includes(topic))return "fail";
  return "done";
};
const saveStory=v=>{try{localStorage.setItem("null_story",JSON.stringify(v));return true}catch(e){return false}};
/* 앞으로만 간다. 이미 지나 있으면 한 것으로 친다 — 두 번 적용해도 같다.
   저장은 쓰고 나서 다시 읽어 확인한다(장부의 규칙 그대로). */
const applyStoryTransition=e=>{
  const list=e&&e.key==="firstContact"?STORY_FC:e&&e.key==="jaeeonMemory"?STORY_JM:null;
  if(!list||!list.includes(e.to))return"skip";
  const s=loadStory();
  if(list.indexOf(s[e.key])>=list.indexOf(e.to))return"done";   // 이미 지났다
  const next={...s,[e.key]:e.to};
  if(!saveStory(next)||loadStory()[e.key]!==e.to)return"fail";
  return"done";
};
/* partner_known 장면이 실제로 성공했을 때만 뒤집힌다 — 장부의 scene_ack
   단계가 부른다. 되풀이해도 같다. */
const markPartnerKnown=char=>{
  if(char!=="jaeeon"&&char!=="minhyun")return true;
  const s=loadStory();
  if(s.partnerKnown[char])return true;
  const next={...s,partnerKnown:{...s.partnerKnown,[char]:true}};
  return !!saveStory(next)&&loadStory().partnerKnown[char]===true;
};

/* 학교에서 만난 순간에만 선다. 되풀이해도 같다 — 되돌아가지 않는다 */
const markSchoolMet=char=>{
  if(char!=="jaeeon"&&char!=="minhyun")return true;
  const s=loadStory();
  if(s.schoolMet[char])return true;
  const next={...s,schoolMet:{...s.schoolMet,[char]:true}};
  return !!saveStory(next)&&loadStory().schoolMet[char]===true;
};

/* ── 공개 장부 — 출처가 실제로 말해진 사실 (§8.5 disclosure) ──
   {fact_id: ["jaeeon","minhyun"]}. 워커가 검증해 발행한 disclosure Effect가
   저장 트랜잭션(장부)에서만 여기 적히고, 다음 요청부터 payload.disclosed로
   실려 그 사실의 known_by가 넓어진다. 관측(봤다)과 공개(들었다)는 다른
   상태다 — 소유자가 회피한 턴에는 Effect가 없어 이 장부도 안 변한다. */
/* ── 관전 응답의 원자적 반영 — 웹·앱 공용 엔진 (§8.5) ──
   순서와 멱등을 코드로 강제하고, 저장은 어댑터가 한다. 이 엔진은 API를
   모른다 — 재개는 저장된 장부로만 하므로 재호출이 원리적으로 없다.

   순서: 말풍선 → Effect(공개 포함) → 사건 소모 → 장부 삭제.
   대화가 저장 확인이 안 되면 Effect로 못 간다 — 화면에 말이 없는데
   상태만 「아는 사람」이 되는 일이 없다. Effect가 안 남으면 사건을 안
   지운다. 한 단계라도 거짓이 오면 그 자리에서 멈추고 장부를 남긴다.

   어댑터 계약(웹은 finishBatch가 이 순서를 자체로 지키므로 이 엔진은
   앱이 쓴다 — rules.ts로 건너간다): 전부 「이미 되어 있으면 성공」이고
   성공 시 참을 준다.
     saveMsg(m)         말풍선 하나 저장 — 같은 id는 두 번 안 붙는다
     applyEffect(e)     Effect 하나 적용 — effect 장부(id) 멱등
     applyUnlocked(ks)  이번에 열린 히든 (없으면 안 불린다)
     ackEvent(id)       관전 사건 소모
     dropBatch(b)       그 항목만 줄에서 뺀다 */
const runAutoBatch=async(b,A)=>{
  if(!b)return true;
  for(const m of b.messages||[]){ if(!(await A.saveMsg(m)))return false; }
  for(const e of b.effects||[]){ if(!(await A.applyEffect(e)))return false; }
  /* 해금도 장부 안이다. 밖에 두면 장부가 한 번 막혔다 풀릴 때 말풍선과
     공개는 복구되는데 .hidden만 영영 안 열린다 — 그 방의 기록에는
     남았는데 열린 적이 없는 문이 된다. */
  if((b.unlocked||[]).length&&A.applyUnlocked
     &&!(await A.applyUnlocked(b.unlocked)))return false;
  if(b.event_id&&!(await A.ackEvent(b.event_id)))return false;
  return !!(await A.dropBatch(b));
};

/* ── 장부는 하나가 아니라 줄이다 — 방별 FIFO ──
   값 하나로 두면 앞엣것이 실패로 남아 있을 때 새 관전이 그걸 덮는다:
   아직 못 붙인 말풍선과 아직 안 적힌 공개가 통째로 사라지고, 소모되지
   않은 사건만 남아 같은 장면이 또 돈다. 줄로 세운다 — 적힌 차례대로
   풀고, 하나가 실패하면 그 자리에서 멈춘다. 뒤엣것은 그대로 남는다.
   웹 장부(null_batch)가 방마다 머리부터 푸는 것과 같은 규칙이다. */
const okAutoBatch=b=>!!b&&typeof b==="object"&&typeof b.id==="string"&&!!b.id;
/* 깨진 값에도 안 죽는다. 옛 단일 장부(객체 하나)도 읽어 줄로 올린다 */
const readAutoQueue=raw=>{
  try{
    const v=typeof raw==="string"?JSON.parse(raw||"[]"):raw;
    if(Array.isArray(v))return v.filter(okAutoBatch);
    return okAutoBatch(v)?[v]:[];
  }catch(e){return[]}
};
/* 같은 id는 두 번 안 들어간다 — 그건 같은 답이다 */
const pushAutoBatch=(list,b)=>{
  const a=readAutoQueue(list);
  return okAutoBatch(b)&&!a.some(x=>x.id===b.id)?[...a,b]:a;
};
/* 그 방의 줄을 순서대로 푼다. **남은 줄**을 돌려준다 — 빈 배열이면 다
   끝났다. 안 비었으면 그 방은 잠긴 채로 남고, 다음 부팅이 여기서 잇는다.
   이 함수도 API를 모른다 — 재개에 재호출이 원리적으로 없다. */
const runAutoQueue=async(list,A)=>{
  let left=readAutoQueue(list);
  while(left.length){
    if(!(await runAutoBatch(left[0],A)))return left;
    left=left.slice(1);
  }
  return left;
};

const loadDisclosed=()=>{try{return JSON.parse(localStorage.getItem("null_disclosed"))||{}}catch(e){return{}}};
const saveDisclosed=o=>{try{localStorage.setItem("null_disclosed",JSON.stringify(o));return true}catch(e){return false}};
const applyDisclosure=e=>{
  if(!e||e.type!=="disclosure"||!e.fact_id||!Array.isArray(e.heard_by)||!e.heard_by.length)return"skip";
  const d=loadDisclosed();
  const cur=d[e.fact_id]||[];
  const next=[...new Set([...cur,...e.heard_by.map(String)])];
  if(next.length===cur.length)return"done";            // 이미 반영 — 되풀이해도 같다
  const nd={...d,[e.fact_id]:next};
  if(!saveDisclosed(nd)||(loadDisclosed()[e.fact_id]||[]).length!==next.length)return"fail";
  return"done";
};

const loadScenePend=()=>{try{return JSON.parse(localStorage.getItem("null_scene_pend"))||{}}catch(e){return{}}};
const saveScenePend=o=>{try{localStorage.setItem("null_scene_pend",JSON.stringify(o));return true}catch(e){return false}};
const markScene=(room,reason)=>{
  if(SCENE_REASONS.indexOf(reason)<0)return;
  const o=loadScenePend(); o[room]=reason; saveScenePend(o);
};
/* ── 예약과 완료를 가른다 ──
   전에는 takeScene이 꺼내면서 지웠다. **요청을 보내기 전에** 지우는 것이라,
   그 요청이 실패하면 장면이 통째로 증발했다 — 고백도 기억 공개도 다시는
   안 온다. 한 번짜리인 것은 맞지만 「한 번 **성공**」이어야 한다.

   peekScene  읽기만 한다. 안 지운다.
   ackScene   검증된 답이 저장된 뒤에만 지운다. 그 방 것만 지운다. */
const peekScene=room=>loadScenePend()[room]||"";
const ackScene=(room,reason)=>{
  const o=loadScenePend();
  /* 그 사이에 다른 사유가 예약됐으면 그건 아직 안 끝난 것이다.
     지금 성공한 것만 지운다 — 남의 장면을 대신 지우지 않는다. */
  if(!o[room]||(reason&&o[room]!==reason))return false;
  delete o[room]; return saveScenePend(o);
};

/* ── 프로필 출처 ──
   YES를 누른 순간 등록값이 세계의 빈칸에 들어간다. 두 사람은 그 값을
   처음부터 알고 있다 — 등록 화면도 앱도 모르는 채로, 자기 기억으로는
   정말 처음부터 알던 것이다. 유저가 그걸 캐물으면 인물마다 딱 한 번
   이 두 마디가 나온다. 모델은 안 부른다: 현이 문구를 못박은 자리다.

   unasked → claimed_told → revealed_from_start

   오발이 제일 무섭다. 「어떻게 알아?」는 아무 데서나 나오는 말이라,
   인물이 방금 등록값을 입에 올린 바로 다음일 때만 연다. */
const ORIGIN_ASK=/어떻게\s*(그걸\s*)?(알|아세|아셨|압니|안\s*거)|어떻게\s*알았|그건?\s*어떻게|어디서\s*들|누가\s*(그래|말해|알려)|내가\s*말했/;
const ORIGIN_DENY=/내가\s*언제|말한\s*적\s*없|그런\s*적\s*없|언제\s*(알려줬|말했)|알려준\s*적\s*없|안\s*알려/;
const ORIGIN_TOLD="선생님이 알려줬잖아요.";
const ORIGIN_START="처음부터.";
const loadOrigin=()=>{try{return JSON.parse(localStorage.getItem("null_origin"))||{}}catch(e){return{}}};
const saveOrigin=o=>{try{localStorage.setItem("null_origin",JSON.stringify(o))}catch(e){}};
const originPhase=who=>loadOrigin()[who]||"unasked";
const setOriginPhase=(who,phase)=>{const o=loadOrigin();o[who]=phase;saveOrigin(o)};
/* 등록값이 그 말에 실제로 들어 있나. 값이 짧으면(한 글자) 아무 문장에나
   걸리므로 두 글자부터 본다 — 「나」가 취향이면 온 문장이 다 걸린다. */
const mentionsProfile=(text,profile,name)=>{
  const t=String(text||"");
  if(!t)return false;
  const vals=[];
  if(name)vals.push(name);
  ["subject","likes","dislikes"].forEach(k=>{
    String((profile||{})[k]||"").split(/[,·\/]/).forEach(v=>{
      const s=v.trim(); if(s.length>=2)vals.push(s);
    });
  });
  return vals.some(v=>t.indexOf(v)>=0);
};
/* 이번 유저 말에 무엇이 열리나. 안 열리면 빈 값이고, 그때는 평소대로
   모델이 답한다. prev는 그 방에서 인물이 방금 한 말이다. */
const originGate=(said,prev,who,profile,name)=>{
  if(!who||!prev)return null;
  const phase=originPhase(who);
  if(phase==="revealed_from_start")return null;
  const t=String(said||"");
  if(phase==="unasked"){
    if(!ORIGIN_ASK.test(t))return null;
    if(!mentionsProfile(prev,profile,name))return null;   // 방금 그 말이 아니면 안 연다
    return{line:ORIGIN_TOLD,next:"claimed_told"};
  }
  /* 두 번째는 방금 제가 한 말을 유저가 물고 늘어질 때만이다 */
  if(String(prev).indexOf(ORIGIN_TOLD)<0)return null;
  if(!ORIGIN_DENY.test(t))return null;
  return{line:ORIGIN_START,next:"revealed_from_start"};
};
/* ── 관전 사건은 줄을 선다 ──
   전에는 한 칸이었다. 선물을 연달아 둘 주면 앞엣것이 그냥 사라졌다 —
   그 사건에 대한 두 사람의 대화가 영영 안 나온다. 그리고 관전 API가
   실패해도 칸을 비워서 같은 이유로 사라졌다.
   줄로 바꾼다. 읽기(peek)와 지우기(ack)를 가른다. */
const loadAutoQ=()=>{try{const a=JSON.parse(localStorage.getItem("null_auto_q"));return Array.isArray(a)?a:[]}catch(e){return[]}};
const saveAutoQ=a=>{try{localStorage.setItem("null_auto_q",JSON.stringify((a||[]).slice(-20)));return true}catch(e){return false}};
/* 같은 사건은 같은 id다. 두 번 넣어도 하나다 — 화면을 두 번 눌러도
   두 사람이 같은 얘기를 두 번 하지 않는다. */
const evId=ev=>[ev.kind,ev.to||"",ev.name||""].join("|");
const pushAutoEvent=ev=>{
  const q=loadAutoQ(); const id=evId(ev);
  if(q.some(x=>x.id===id))return false;
  q.push({...ev,id,created_at:Date.now(),status:"pending"});
  return saveAutoQ(q);
};
/* 제일 오래된 것부터. created_at으로 안정된 순서를 지킨다 */
const peekAutoEvent=()=>{
  const q=loadAutoQ().filter(x=>x&&x.status!=="done");
  if(!q.length)return null;
  return q.slice().sort((a,b)=>(a.created_at||0)-(b.created_at||0))[0];
};
/* 그 하나만 지운다. 성공한 것 말고는 안 건드린다 */
const ackAutoEvent=id=>{
  const q=loadAutoQ(); const n=q.filter(x=>x&&x.id!==id);
  if(n.length===q.length)return false;
  return saveAutoQ(n);
};
const loadAutoAt=()=>{const v=+localStorage.getItem("null_auto_at");return v||0};
const saveAutoAt=t=>{try{localStorage.setItem("null_auto_at",String(t))}catch(e){}};
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));
  return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};

/* ── 사진첩(Cam) ──
   처음부터 다 보여주면 앨범이 아니라 목록이다. 실제로 본 것만 한 장씩 꽂힌다.

   받은 사진은 대화 기록에서 그대로 뽑는다 — 별도 저장이 없다.
   그런데 자리 사진(SCENE_SHOT)은 말풍선이 아니라 화면 배경이라 기록에 안
   남는다. gallery에는 들어 있으면서(jaeeon-laundry·minhyun-nap 같은 것들)
   영영 안 열리는 칸이었다. 빨래방에서 그 사람을 마주 보고 앉아 있었는데
   사진첩에는 없는 것이다. 본 것도 모은다 — 이건 기록에 없으니 따로 적어둔다. */
const loadShots=()=>{try{return JSON.parse(localStorage.getItem("null_shots")||"[]")}catch(e){return[]}};
/* sceneShot은 파일명(.webp까지)을 돌려주는데, 말풍선 사진(m.photo)은 확장자
   없는 열쇠다. 그대로 담아두니 cam이 gallery의 열쇠와 맞대볼 때 영영 안 맞았다
   — 자리 배경은 한 번도 사진첩에 안 떴다. 담을 때 확장자를 뗀다.
   시험은 확장자 없이 넣고 있어서 이걸 못 잡았다(F.stampShot('jaeeon-laundry')). */
const stampShot=key=>{try{
  const k=(key||"").toString().replace(/\.webp$/,"");
  if(!k)return;
  const a=loadShots(); if(a.includes(k))return;
  localStorage.setItem("null_shots",JSON.stringify([...a,k]));
}catch(e){}};
function seenPhotos(msgs){
  const set=new Set();
  Object.values(msgs||{}).forEach(list=>(list||[]).forEach(m=>{if(m.photo)set.add(m.photo)}));
  /* 이미 .webp가 붙은 채로 저장된 것이 있다. 읽을 때도 떼어 맞춘다 */
  loadShots().forEach(k=>set.add(String(k).replace(/\.webp$/,"")));
  return set;
}

