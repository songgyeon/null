/* NULL web · main game state and orchestration
   화면 컴포넌트는 scripts/ui/, 규칙과 데이터는 scripts/data/에 있다. */
function GameApp(){
  const [name,setName]=useState(()=>localStorage.getItem("null_name")||"");
  const [profile,setProfile]=useState(loadProfile);
  const [store,setStore]=useState(loadStore);
  const [unlocked,setUnlocked]=useState(loadUnlocked);
  const [gifts,setGifts]=useState(loadGifts);   // {jaeeon:["mug"], ...} 누구에게 뭘 줬나
  const [toast,setToast]=useState(null);            // 해금 알림
  /* 첫 만남이 끝나고 그 사람의 메신저가 생기는 창. 방이 왜 생겼는지를
     이 한 장면이 맡는다 — 대사로 「번호 주세요」를 여덟 번 쓰지 않아도 된다. */
  const [getcha,setGetcha]=useState(null);          // 메신저를 얻은 사람 id
  /* ── 창은 자리에서 **나올 때** 뜬다 ──
     말풍선이 다 앉는 것은 오프닝이 끝난 게 아니다. 그때는 아직 그 사람과
     마주 서 있다 — 번호는 헤어지면서 주고받는 것이다. 그래서 첫 자리를
     열 때 여기 이름을 걸어두고, 그 자리가 닫히는 순간에 연다. */
  const getchaRef=useRef(null);                     // 첫 자리에서 만난 사람
  const [view,setView]=useState("list");            // 'list' | roomId
  const [busy,setBusy]=useState({});                // 방별 타이핑 인디케이터
  const [failed,setFailed]=useState({});            // 방별 실패 payload (재시도용)
  /* ── 짧은 강제 타임아웃은 안 둔다 ──
     한 턴이 Writer → Critic 둘 → Finalizer를 타면 90초는 짧다. 거기에
     RETRY가 한 번 붙으면 멀쩡한 답을 스스로 끊게 된다 — 그건 고장이 아니라
     느린 것이다. 넉넉히 주되 무한정 기다리지는 않는다: 스피너가 영원히
     도는 화면이 제일 나쁘다. */
  const REQ_TIMEOUT=180000;
  const [autoLoading,setAutoLoading]=useState(false);
  const viewRef=useRef(view); viewRef.current=view;
  /* 판마다 하나. 등록 화면에서 고르고 저장소가 들고 있는다 */
  const [mode,setMode]=useState(loadMode);
  const storeRef=useRef(store); storeRef.current=store;
  /* 세계 시계의 출발 자리를 여기서 세운다. 규칙들은 시각만 받는 순수 함수라
     저장소를 스스로 못 본다 — 여기가 store가 바뀔 때마다 지나가는 자리다.
     세는 것은 첫 말풍선의 시각 하나뿐이다. 말풍선 수는 안 들어간다. */
  setWorldAt(firstTsOf(store));
  const profileRef=useRef(profile); profileRef.current=profile;
  const unlockedRef=useRef(unlocked); unlockedRef.current=unlocked;
  const giftsRef=useRef(gifts); giftsRef.current=gifts;
  const queueRef=useRef([]);                        // 순차 표시 대기열
  const runningRef=useRef(false);
  const inflightRef=useRef({});                     // 방별 지금 도는 요청 이름표
  useEffect(()=>{saveStore(store)},[store]);

  useEffect(()=>{try{localStorage.setItem("null_profile",JSON.stringify(profile))}catch(e){}},[profile]);
  useEffect(()=>{saveUnlocked(unlocked)},[unlocked]);
  /* get cha 창이 떠 있는 동안에는 알림을 세워둔다. 토스트(45)가 대화창(40)
     위에 뜨는 건 「구경 중에도 알림은 보인다」는 결정이라 그대로 두고,
     이 창일 때만 미룬다 — 첫 만남에서 자리 물건을 받으면 「bag — 에너지바」가
     Get cha! 글자를 정확히 덮는다. 창을 닫으면 그때 뜨고 2.6초 뒤 사라진다. */
  useEffect(()=>{if(!toast||getcha)return;const t=setTimeout(()=>setToast(null),2600);return()=>clearTimeout(t)},[toast,getcha]);

  /* 메시지 추가 (+현재 안 보고 있는 방이면 unread 증가)
     ── 계약 ──
     ① 그 자리에서 저장한다. 전에는 setStore만 하고 저장은 리액트가 그림을
        그린 뒤 effect가 했다. 그러면 「그렸다」와 「남았다」 사이에 틈이
        생긴다 — 재생 장부에서 그 줄을 빼는 것은 즉시인데 줄 자체는 아직
        안 남아 있는 순간. 지금 쓰고, ref도 같이 앞세운다.
     ② **갱신된 그 방의 목록을 돌려준다.** 이걸 안 하면 부르는 쪽이
        `[...storeRef.current.msgs[room], msg]`로 직접 이어 붙이는데,
        ref가 이미 갱신됐으므로 **같은 사건이 두 번** 들어간다. 화면에는
        한 번인데 모델에게 가는 history에는 두 번이고, counts도 부푼다.
        붙이지 말고 받아 쓴다.
     ③ 저장이 실패하면 null이다. 안 남은 것을 남았다고 치고 넘어가지 않는다. */
  const appendMsg=(room,msg)=>{
    const s=storeRef.current;
    const list=[...(s.msgs[room]||[]),msg];
    const next={msgs:{...s.msgs,[room]:list},
      unread:viewRef.current!==room?{...s.unread,[room]:(s.unread[room]||0)+1}:s.unread};
    if(!saveStore(next))return null;
    storeRef.current=next; setStore(next);
    return list;
  };
  /* 저장이 안 됐다. 조용히 넘어가면 화면에만 있는 세계가 된다 —
     그 방을 멈추고 왜 멈췄는지 적는다. */
  const saveFailed=(room,payload,batch)=>{
    setBusy(b=>({...b,[room]:!!batch}));   // 이어서 할 것이 남았으면 잠근 채로 둔다
    setFailed(f=>({...f,[room]:{payload:payload||null,batch:batch||null,
      detail:"저장에 실패했다 — 브라우저 저장 공간이 찼을 수 있다"}}));
    return null;
  };
  /* ── 같은 줄을 두 번 붙이지 않는다 ──
     재생은 끊길 수 있다. 덩어리에 적힌 id는 저장할 때 이미 박은 것이라,
     저장이 어디서 끊겼든 「이미 있는지」만 보면 두 번 붙는 일이 없다. */
  const appendOnce=(room,msg)=>{
    const ms=storeRef.current.msgs[room]||[];
    if(ms.some(m=>m&&m.id===msg.id))return true;   // 이미 있다 — 한 것으로 친다
    return !!appendMsg(room,msg);
  };
  /* ── 이 방이 아무것도 안 하고 있나 ──
     타이핑 표시를 끄는 조건이자 새 입력을 여는 조건이다. 셋 중 하나라도
     남아 있으면 아직 하는 중이다: 큐에 남은 말풍선 · 안 푼 덩어리 · 도는 요청.
     안 푼 덩어리를 안 보면, 새로고침으로 되살아난 답이 재생되는 동안
     입력이 열려서 「유저 말 → 새 유저 말 → 옛 답 나머지」로 갈린다. */
  /* 말풍선은 다 떴어도 지문·초대·표·자리 닫기가 남았으면 아직 하는 중이다.
     items만 보면 그 사이에 입력이 열려 새 요청이 나간다. */
  const replaying=room=>loadBatches().some(b=>b.room===room);
  const roomIdle=room=>!queueRef.current.some(q=>q.room===room)
    && !inflightRef.current[room] && !replaying(room);
  const settle=room=>{ if(roomIdle(room))setBusy(b=>({...b,[room]:false})) };

  /* 대기열 처리: 0.6초 간격 순차 등장 */
  const pump=()=>{
    if(runningRef.current)return;
    runningRef.current=true;
    const step=()=>{
      const it=queueRef.current.shift();
      if(!it){runningRef.current=false;return}
      paintQueued(it);
      settle(it.room);
      setTimeout(step,600);
    };
    setTimeout(step,500); // 타이핑 인디케이터를 잠깐 보여준 뒤 첫 버블
  };
  /* 한 개를 그리고, 적어둔 기록에서도 뺀다. 그 덩어리의 마지막이었으면
     거기 매달린 것(지문·초대·자리 닫기)을 그 자리에서 낸다.
     ── 시간으로 재지 않는 이유 ──
     큐는 방마다가 아니라 하나뿐이다. 다른 방 말풍선이 앞에 쌓여 있으면
     「몇 개니까 몇 초」로 잡은 짐작은 어긋난다 — 물건을 건네는 대사보다
     「받았다」가 먼저 뜨는 게 그거였다. 마지막 말풍선이 실제로 뜬 자리가
     그 시점이다. */
  /* 한 줄이 안 남았으면 그 덩어리의 나머지도 큐에서 거둔다.
     안 거두면 다음 줄이 먼저 떠서 순서가 뒤집힌다 — 실패한 ㄱ 다음에
     ㄴ이 붙고, 이어서 풀 때 ㄱ이 뒤에 온다. 장부에는 그대로 남아 있으니
     다시 풀면 적힌 차례대로 나온다. */
  const holdBatch=(room,id)=>{
    if(id)queueRef.current=queueRef.current.filter(q=>q.batch!==id);
    return saveFailed(room,null,id||null);
  };
  const paintQueued=it=>{
    /* 안 남았으면 장부에서도 안 뺀다 — 빼고 넘어가면 그 줄을 다시 못 푼다.
       **이름표를 같이 남긴다** — 안 남기면 재시도가 무엇을 이어야 할지 모른다 */
    if((it.text||it.photo)
      && !appendOnce(it.room,{id:it.id,sender:it.sender,text:it.text,photo:it.photo,ts:Date.now()}))
      return holdBatch(it.room,it.batch);
    if(!it.batch)return;
    const r=dropBatchItem(it.batch,it.id);
    if(r.status==="missing")return;                    // 이미 끝났다
    if(r.status==="storage_error")return holdBatch(it.room,it.batch);
    if((r.batch.items||[]).length)return;
    finishBatch(it.batch);
  };
  /* 그 자리에서 그 사람이 처음 입을 열면 화면이 그 사람으로 바뀐다.
     한 장면에 한 번만 — 열 번 주고받는 동안 얼굴이 계속 바뀌면 어지럽다 */
  const swapShot=room=>{
    const sc=sceneRef.current;
    if(!sc||sc.room!==room||sc.shot)return;
    const shot=sceneShot(sc.place,room);
    if(!shot)return;
    const next={...sc,shot}; setScene(next); saveScene(next);
    /* 본 것도 사진첩에 꽂는다. 이건 말풍선이 아니라 배경이라 대화
       기록에 안 남는다 — 여기서 적어두지 않으면 영영 안 모인다 */
    stampShot(shot);
  };
  /* 모델을 안 타는 줄(등록값 문답·데모)도 같은 길로 보낸다. 화면에
     뜨는 방식이 같으면 끊겼을 때 살아남는 방식도 같아야 한다. */
  const enqueue=(room,messages)=>{
    const id="say|"+room+"|"+uid();
    const items=bubbles(id,room,messages);
    if(!items.length){ settle(room); return false }
    return localBatch(id,room,{items});
  };
  /* 모델이 준 말 목록을 장부에 적을 꼴로 바꾼다. id는 여기서 박는다 —
     저장이 어디서 끊겨도 같은 줄이 두 번 붙지 않는다. */
  const bubbles=(id,room,messages)=>{
    const out=[];
    (messages||[]).forEach((m,i)=>{
      if(!m)return;
      const photo=photoSrc(m.photo)?m.photo:null;  // 없는 파일이면 사진은 버리고 말만 남긴다
      const text=(m.text||"").trim();
      if(text||photo)out.push({id:batchItemId(id,i),room,sender:m.sender||room,text,photo});
    });
    return out;
  };

  /* history / signals / counts / user_profile 구성 */
  /* 이전에 한 얘기를 기억하려면 이전에 한 얘기를 보내야 한다. 전에는 서른
     마디에서 잘랐다 — 말풍선이 한 턴에 두셋이니 실질 열 턴이었다.
     개수가 아니라 글자로 센다. 짧은 말 스무 마디와 긴 글 스무 마디는 같은
     스무 개인데 값이 열 배 다르다. 워커의 MAX_HISTORY_CHARS와 같은 값이다 —
     여기서 이미 걸러 보내면 쓸데없이 실어 나르지 않는다. */
  /* 원문으로 보내는 창. 이보다 오래된 것은 요약이 들고 있다.
     6만 자를 그냥 보내던 때보다 작다 — 요약이 생겼으니 원문을 다 이고 갈
     이유가 없다. 원문은 말투와 흐름을 위한 것이고, 사실은 요약이 담당한다. */
  const HISTORY_CHARS=12000;
  /* 안 요약된 원문이 이만큼 쌓이면 한 번 뭉친다. 뭉칠 때 끝의 TAIL_KEEP
     글자는 남긴다 — 다 뭉쳐버리면 방금 하던 얘기가 요약으로만 남는다. */
  const SUM_AT=12000, TAIL_KEEP=4000;
  const loadSum=room=>{try{return JSON.parse(localStorage.getItem("null_sum_"+room)||"null")||{text:"",upto:0}}catch(e){return{text:"",upto:0}}};
  const saveSum=(room,v)=>{try{localStorage.setItem("null_sum_"+room,JSON.stringify(v))}catch(e){}};
  /* 요약이 이미 삼킨 구간은 안 보낸다 — 같은 얘기를 원문과 요약으로 두 번
     보내면 값은 두 배인데 아는 건 그대로다 */
  const sinceSum=(room,ms)=>{const u=loadSum(room).upto||0;return ms.filter(m=>m.ts>u)};
  /* 시스템 줄(「…를 받았다」「…에서 나왔다」)은 유저가 친 말이 아니라 일어난
     일이다. 그대로 보내면 모델이 유저의 발화로 읽어서, 제가 준 물건을 두고
     「그게 왜 선생님한테 있어요」라고 되묻는 일이 생긴다. 괄호로 감싸 지문으로
     보낸다 — 화면에서 이미 지문으로 그리고 있고(isNarr), 선톡 지시문도 같은
     꼴이라 모델이 아는 표기다. */
  /* ── 지문은 유저가 친 말이 아니다 ──
     전에는 sys 줄을 "("+text+")"로 감싸 보냈다. 그러면 유저가 직접 친
     "(웃음)"과 글자 모양이 같아진다 — 모델에게는 둘 다 유저 발화이고,
     코드가 기록한 실제 사건이 유저의 괄호 말투와 구별되지 않는다.
     타입을 끝까지 들고 간다. 워커가 "[시스템 사건] …"으로 따로 적는다. */
  const buildHistory=ms=>{
    const all=ms.map(m=>({role:m.sender==="user"?"user":"assistant",sender:m.sender,
      ...(m.sys?{kind:"event"}:{}),
      content:m.photo?((m.text?m.text+" ":"")+"(사진을 보냈다)")
             :(m.sys?(m.text||"").trim():m.text)}))
      .filter(m=>m.content&&m.content.trim());
    const out=[];let used=0;
    for(let i=all.length-1;i>=0;i--){
      const n=all[i].content.length;
      if(out.length&&used+n>HISTORY_CHARS)break;   // 오래된 쪽부터 뺀다
      used+=n;out.unshift(all[i]);
    }
    return out;
  };
  /* 최근에 보낸 사진 — 같은 사진이 연달아 나오지 않게 백엔드에 알려준다 */
  const recentPhotos=room=>{
    const ms=(storeRef.current.msgs[room]||[]).slice(-24),out=[];
    for(let i=ms.length-1;i>=0&&out.length<4;i--) if(ms[i].photo&&!out.includes(ms[i].photo))out.push(ms[i].photo);
    return out;
  };
  /* 방별 누적 대화 수 — 관계 단계와 .hidden 해금의 근거.
     방금 보낸 메시지는 아직 상태에 반영되기 전이라 override로 직접 넘긴다 */
  const roomCounts=override=>{
    const c={};
    ["jaeeon","minhyun","group","health"].forEach(r=>{
      c[r]=(override&&override[r]!=null)?override[r]:(storeRef.current.msgs[r]||[]).length;
    });
    return c;
  };
  const buildSignals=exclude=>{
    const sig={},t0=new Date();t0.setHours(0,0,0,0);
    ["jaeeon","minhyun","group"].forEach(r=>{
      if(r===exclude)return;
      const ms=storeRef.current.msgs[r]||[];if(!ms.length)return;
      sig[r]={count:ms.filter(m=>m.ts>=t0.getTime()).length,minsAgo:Math.max(0,Math.floor((Date.now()-ms[ms.length-1].ts)/60000))};
    });
    return sig;
  };
  /* 채워진 칸만 보낸다 */
  const userProfile=()=>{
    const out={};
    Object.entries(profileRef.current).forEach(([k,v])=>{if(v)out[k]=v});
    return Object.keys(out).length?out:null;
  };

  /* 같이 가자는 제안이 오면 답을 받는다. 수락하면 그 자리에 다녀온 것이 되고,
     한 시간 뒤 관전방에서 다른 한 사람이 그 얘기를 꺼낸다. 거절하면 안 간다 —
     그리고 그 자리는 다시 안 나온다. 두 번 조르지 않는 것이 이 두 사람의 성격이다. */
  /* 저장소에서 읽어 시작한다. 창이 떠 있는 채로 껐다 켜도 물음은 남아야
     한다 — 워커는 초대한 걸로 아는데 유저에게는 물어본 적이 없으면 안 된다.
     줄의 맨 앞 하나만 뜬다. 답하면 다음 것이 열린다. */
  const [invite,setInvite]=useState(headInvite);
  /* 지금 어느 자리에 있나. 새로고침해도 그 자리에 남아 있게 저장해 둔다 */
  const [scene,setScene]=useState(loadScene);
  /* 다녀온 자리. 지도가 열리는 유일한 근거라서 저장소에만 두면 안 된다 —
     상태로 안 들고 있으면 갔다 와도 화면이 그대로다 */
  const [met,setMet]=useState(loadMet);
  const metRef=useRef(met); metRef.current=met;

  const [bag,setBag]=useState(loadBag);
  const bagRef=useRef(bag); bagRef.current=bag;
  /* ── 대사 고치기 ──
     인물이 이상한 말을 하면 그 말풍선을 눌러 고쳐 쓴다. 화면의 말이 바뀌고,
     이력은 이 목록(msgs)에서 다시 만들어지므로 **다음 턴부터 인물은 자기가
     그렇게 말한 걸로 안다.** 프롬프트를 안 건드리고 그 자리에서 바로잡는 길이다.
     고친 것은 원문과 짝으로 따로 쌓인다(data/50-story-state의 loadEdits 주석).
     이미 요약에 삼켜진 줄을 고치면 화면과 기록만 바뀐다 — 요약 원문까지는
     못 쫓아간다. 갓 나온 말을 그 자리에서 고치는 도구다. */
  const [edits,setEdits]=useState(loadEdits);
  const editsRef=useRef(edits); editsRef.current=edits;
  /* 그때 정황을 같이 담는다. 고친 말만 있으면 나중에 「이럴 때」가 뭐였는지
     알 수가 없다. 지문도 정황이라 같이 넣는다 — 「체육관에서 나왔다」가
     빠지면 왜 그 말이 이상한지 안 보인다. */
  const nearby=(room,at)=>(storeRef.current.msgs[room]||[])
    .slice(Math.max(0,at-4),at).map(m=>({
      who:m.sys?"·":(m.sender==="user"?"나":(CHARS[m.sender]?CHARS[m.sender].name:m.sender)),
      text:m.text||(m.photo?"(사진)":"")}));
  const keepEdit=e=>{
    const next=[...editsRef.current,e];
    editsRef.current=next; setEdits(next); saveEdits(next);
    setToast(`고친 말 ${next.length}개째`);
  };
  const editLine=(room,mid,text)=>{
    const t=(text||"").trim(); if(!t)return false;
    const ms=storeRef.current.msgs[room]||[];
    const at=ms.findIndex(m=>m.id===mid); if(at<0)return false;
    const was=ms[at].text||"";
    if(t===was)return false;
    setStore(st=>({...st,msgs:{...st.msgs,
      [room]:(st.msgs[room]||[]).map(m=>m.id===mid?{...m,text:t,fixed:true}:m)}}));
    keepEdit({id:Date.now()+Math.random(),ts:Date.now(),room,mid,
      who:ms[at].sender,was,now:t,before:nearby(room,at)});
    return true;
  };
  /* 고칠 말풍선이 딱 하나가 아닐 때 — 상황 자체가 이상할 때 적어둔다.
     「//」로 열면 대화가 아니라 이쪽으로 간다. 워커는 안 부른다. */
  const addNote=(room,note)=>{
    const t=(note||"").trim(); if(!t)return false;
    keepEdit({id:Date.now()+Math.random(),ts:Date.now(),room,mid:null,
      who:"",was:"",now:t,before:nearby(room,(storeRef.current.msgs[room]||[]).length)});
    return true;
  };
  /* 가방은 키만 보내고 있었다. 그런데 가방은 준 사람(from)도 들고 있다 —
     그걸 버리니 워커에서 방향이 없어졌고, 강현이 제가 준 젤리를 두고
     "사람 아까 핫팩 주더니 이제 젤리까지"라고 했다. 준 사람을 같이 보낸다. */
  /* 가방은 자리에 있을 때만 보내고 있었다. 그래서 체육관에서 손목 보호대를
     받고 나오면, 그 다음 채팅에서 강현은 자기가 준 것을 몰랐다 — 준 사실은
     그 자리에서 끝나는 일이 아니라 계속 남는 일이다. 늘 보낸다.
     워커가 from으로 걸러서 제 것만 읽으므로 방마다 나눠 담을 것은 없다. */
  const bagOut=()=>bagRef.current.map(b=>({k:b.key,from:b.from||""}));
  const sceneRef=useRef(scene); sceneRef.current=scene;
  /* 받은 것을 가방에 넣는다. 같은 것은 두 번 안 들어간다.
     채팅에는 지문 한 줄로 남긴다 — 유저의 말이 아니라 일어난 일이니까. */
  /* ── 같은 사건을 두 번 새기지 않는다 ──
     같은 응답을 두 번 처리해도(재시도·늦게 온 답·새로고침) 결과는 한 번과
     같아야 한다. id는 워커가 만든 것을 그대로 쓴다 — 같은 요청의 같은
     사건은 늘 같은 id다. */
  /* ── Effect 하나를 적용한다. 결과를 참·거짓으로 뭉개지 않는다 ──
     「이미 가진 물건」과 「저장 실패」는 전혀 다른 일인데 둘 다 false였다.
     그래서 가방 저장이 실패해도 대사는 그대로 나가고 장면까지 지워졌다.

     쓰고 나서 **다시 읽어 확인한다.** setItem이 안 던지고도 안 남는 경우가
     있고, 무엇보다 이렇게 하면 「이미 되어 있다」와 「방금 했다」가 같은
     검사로 처리된다 — 되풀이해도 결과가 같다는 뜻이다. */
  const markDone=e=>{
    const done=loadEffDone();
    if(done.indexOf(e.id)<0)done.push(e.id);
    if(!saveEffDone(done)||loadEffDone().indexOf(e.id)<0)
      return{status:"storage_error",key:"null_eff_done"};
    return{status:"applied"};
  };
  const applyEffect=e=>{
    if(!e||typeof e!=="object"||!e.id||!e.type)return{status:"not_applicable"};
    if(loadEffDone().indexOf(e.id)>=0)return{status:"already_applied"};
    if(e.type==="item_transfer"){
      /* 방향을 본다. 유저가 받는 것만 가방에 들어간다 */
      if(e.to!=="user"||!e.item||!ITEMS[e.item])return{status:"not_applicable"};
      const bag=loadBag();
      /* 그 사람이 준 것이 이미 가방에 있으면 다 된 것이다.
         같은 종류를 남이 준 것으로 이미 가졌으면 두 번 안 들어간다 — 표만 찍는다 */
      if(!bag.some(x=>x.key===e.item)){
        const next=[...bag,{key:e.item,from:e.from,where:(sceneRef.current||{}).place,ts:Date.now()}];
        if(!saveBag(next)||!loadBag().some(x=>x.key===e.item&&x.from===e.from))
          return{status:"storage_error",key:"null_bag"};
        bagRef.current=next; setBag(next);
      }
    }else if(e.type==="invite"){
      if(!e.place||!e.char)return{status:"not_applicable"};
      pushInvite({place:e.place,char:e.char});
      if(!loadInvites().some(x=>x.place===e.place&&x.char===e.char))
        return{status:"storage_error",key:"null_invite"};
      setInvite(headInvite());
    }else if(e.type==="story_transition"){
      /* 이야기 상태가 실제로 움직이는 유일한 자리 (E3). 워커가 검증된
         응답 뒤에만 내고, 여기서는 앞으로만 옮긴다 — 이미 지나 있으면
         한 것으로 친다. 안 남았으면 표도 안 찍는다. */
      const r=applyStoryTransition(e);
      if(r==="fail")return{status:"storage_error",key:"null_story"};
      if(r==="skip")return{status:"not_applicable"};
    }else if(e.type==="disclosure"){
      /* 출처가 실제로 말해졌다 — 같은 저장 트랜잭션에서 장부에 적고,
         다음 요청의 사실 투영이 이걸 받는다 (§8.5) */
      const r=applyDisclosure(e);
      if(r==="fail")return{status:"storage_error",key:"null_disclosed"};
      if(r==="skip")return{status:"not_applicable"};
    }else{
      return{status:"not_applicable"};
    }
    return markDone(e);
  };
  /* Effect가 남길 지문을 **하기 전에** 미리 적어둔다. need가 붙은 줄은
     그 물건이 그 사람이 준 것으로 실제로 들어와 있을 때만 나온다 — 가방과
     지문이 갈리지 않게 하는 자물쇠다. */
  const planEffects=fx=>{
    const sys=[]; let toast="";
    for(const e of fx||[]){
      if(!e||e.type!=="item_transfer"||e.to!=="user"||!ITEMS[e.item])continue;
      const it=ITEMS[e.item];
      sys.push({id:e.id+"#got",room:e.from,sender:"user",sys:true,
        text:`${CHARS[e.from]?CHARS[e.from].name:e.from}에게 ${jos(it.name,"을/를")} 받았다`,
        need:{key:e.item,from:e.from}});
      toast=`bag — ${it.name}`;
    }
    return{sys,toast};
  };
  /* 야자 감독인 주에 하나. 사람이 준 게 아니라 시간표가 쥐여주는 것이라
     대화에 지문도 안 남고 준 사람도 없다 — 가방에서 얼굴이 안 붙는 유일한 물건 */
  const giveEnergyBar=()=>{
    if(bagRef.current.some(b=>b.key==="ebar"))return;
    const next=[...bagRef.current,{key:"ebar",ts:Date.now()}];
    bagRef.current=next; setBag(next); saveBag(next); setToast("bag — 에너지바");
  };
  /* 자리에서 나온다. **여기서 물건을 안 준다.**
     전에는 두 마디만 했으면 나오면서 넣어줬다. 모델이 안 건네고 끝내는 턴이
     있어서였는데, 그러면 유저가 거절해도 들어가고, 인물이 준 적 없는 것이
     가방에 있고, 대사와 가방이 갈린다.
     가방에 들어오는 길은 하나다: 검증된 give Effect를 한 번 적용하는 것.
     자리를 닫는 것과 물건을 받는 것은 다른 일이다. */
  /* 자리에 들어오자마자 손에 들어오면 그건 받은 게 아니라 주운 것이다.
     들렀다 바로 나오는 것만으로 여덟 개가 다 모이면 지도를 도는 일이
     심부름이 된다. 말을 두 마디는 하고 나와야 건넬 자리가 있었던 걸로 친다.
     덜 하고 나가면 그 자리는 그대로 남는다 — 다시 오면 된다. */
  /* 셈은 data/50-story-state에 있다 — 웹과 앱이 같은 원본을 쓴다.
     list를 안 주면 storeRef를 읽는데 그건 리액트가 아직 갱신하기 전이라
     방금 친 말이 빠져 있다. 보내는 자리에서는 갓 만든 배열을 직접 넘긴다. */
  const talkedEnough=(sc,list)=>talkedEnoughIn(sc,list||storeRef.current.msgs[(sc||{}).room]||[]);


  /* ══════ 장부(null_batch)는 하기 전에 쓴다 ══════
     ── 왜 ──
     앞에서는 「저장하고 나서 실패면 멈춘다」였다. 그런데 실패를 알았을 때는
     이미 앞 단계의 상태가 바뀐 뒤라 되돌릴 수도 이어갈 수도 없었다: 가방은
     들어갔는데 지문이 없고, 표는 찍혔는데 장부가 없고, 초대는 줄에서 빠졌는데
     답 지문이 안 남았다. localStorage key 여럿을 하나씩 즉시 바꾸는 구조가
     그렇다.

     그래서 순서를 뒤집는다. **바꿀 계획을 먼저 한 덩어리로 적고**, 저장이
     성공한 뒤에 resumeBatch가 그 계획을 실행한다. 실행은 전부 멱등이다 —
     하나라도 확인이 안 되면 장부를 안 지우고 그 방을 잠근다. 다음에 다시
     켜거나 다시 눌러도 남은 것만 정확히 한 번 더 한다.

       items        아직 안 그린 말풍선 (그리며 하나씩 뺀다)
       sys          말풍선 뒤에 붙는 줄. need가 붙으면 그 조건이 맞을 때만
       effects      워커가 검증한 Effect 원본
       unlocked     이번에 열린 히든
       scene_ack    소모할 중요 장면 사유
       invite_ops   초대 줄에서 뺄 것
       local_ops    자리·도장·선물·해금 같은 이 판의 상태 변경
       auto_event_id 소모할 관전 사건

     상태를 먼저 바꾸고 장부를 쓰는 자리는 이제 없다. */
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const newBatch=(id,room,x)=>({id,room,
    items:(x&&x.items)||[], sys:(x&&x.sys)||[], effects:(x&&x.effects)||[],
    unlocked:(x&&x.unlocked)||[], scene_ack:(x&&x.scene_ack)||"",
    invite_ops:(x&&x.invite_ops)||[], local_ops:(x&&x.local_ops)||[],
    auto_event_id:(x&&x.auto_event_id)||"", toast:(x&&x.toast)||"",
    after_request:(x&&x.after_request)||null});

  /* ── 계획 하나를 적용한다. 전부 「이미 되어 있으면 성공」 ── */
  /* 첫 자리가 닫히는 순간 — 헤어지면서 번호를 주고받는다. 자리를 닫는 길이
     여럿이라(나가기·귀갓길·자리 이동·시간 끝) 닫는 자리 한 곳에서 잡는다. */
  const sceneClosed=sc=>{
    /* 첫 만남인 자리는 새로고침을 해도 scene에 표가 남는다. ref만 보면
       새로고침 뒤에는 헤어져도 메신저가 생기지 않는다. */
    if(!sc||(getchaRef.current!==sc.room&&!sc.firstEncounter))return;
    getchaRef.current=null;
    saveGetcha(sc.room); setGetcha(sc.room);
  };
  const applyOp=o=>{
    if(!o||!o.op)return true;
    if(o.op==="closeScene"){
      const sc=loadScene();
      if(!sc||(o.since&&sc.since!==o.since))return true;      // 이미 닫혔거나 다른 자리다
      if(!saveScene(null)||loadScene())return false;
      sceneRef.current=null; setScene(null); sceneClosed(sc); return true;
    }
    if(o.op==="leave"){
      /* 나온 줄을 먼저 남기고 그 다음에 닫는다 — 순서가 반대면
         「나왔다」 없이 자리만 사라진다 */
      const sc=loadScene();
      if(!sc||sc.room!==o.room||(o.since&&sc.since!==o.since))return true;
      if(!appendOnce(o.room,{id:o.id,sender:"user",sys:true,text:o.text,ts:Date.now()}))return false;
      if(!saveScene(null)||loadScene())return false;
      sceneRef.current=null; setScene(null); sceneClosed(sc); return true;
    }
    if(o.op==="openScene"){
      const sc=loadScene();
      if(sc&&sc.since===o.scene.since)return true;
      if(!saveScene(o.scene))return false;
      /* 학교 안 자리에서 마주 앉았으면 그때부터 교생인 걸 안다.
         그 전까지는 과거의 만남이 유저에 대해 아는 전부다. */
      if(isSchoolPlace(o.scene.place))markSchoolMet(o.scene.room);
      const now=loadScene(); if(!now||now.since!==o.scene.since)return false;
      /* ref도 같이 앞세운다 — setScene은 다음 그림에서야 반영되는데,
         이어 부르는 요청(runAfter)과 배경 바꾸기(swapShot)는 그 자리에서
         sceneRef를 읽는다. 안 앞세우면 방금 연 자리를 못 본다. */
      sceneRef.current=o.scene; setScene(o.scene); return true;
    }
    if(o.op==="view"){ setView(o.room); return true }
    /* ⑨ 고백에 답이 온 뒤에 화면이 통째로 그 얼굴이 된다. 말풍선 다음이라
       장부 안에 있다 — 밖에 두면 답보다 얼굴이 먼저 뜬다.
       한 짝에 한 번이다. 이미 봤으면 조용히 지나간다: 두 번째로 뜨면
       연출이 아니라 답장이 된다. 표에 도장이 안 찍히면 화면도 안 띄운다 —
       띄우고 못 적으면 다음 판에 또 뜬다. */
    if(o.op==="kiss"){
      if(!o.shot||loadKissSeen().includes(o.shot))return true;
      if(!saveKissSeen(o.shot))return false;
      setKiss(o.shot); return true;
    }
    if(o.op==="goneTo"){
      const met=loadMet();
      if(met.includes(o.place)){ if(!metRef.current.includes(o.place))setMet(met); return true }
      const next=[...met,o.place];
      if(!saveMet(next)||!loadMet().includes(o.place))return false;
      setMet(next); return true;
    }
    if(o.op==="stampGone"){ stampGone(o.place); return goneToday(o.place) }
    if(o.op==="stampGift"){ stampGift(o.char); return giftedToday(o.char) }
    if(o.op==="gift"){
      const g=loadGifts(), have=g[o.char]||[];
      if(have.includes(o.key))return true;
      const next={...g,[o.char]:[...have,o.key]};
      if(!saveGifts(next)||!(loadGifts()[o.char]||[]).includes(o.key))return false;
      giftsRef.current=next; setGifts(next); return true;
    }
    if(o.op==="refused"){
      const r=loadRefused();
      if(r.includes(o.place))return true;
      return !!saveRefused([...r,o.place])&&loadRefused().includes(o.place);
    }
    if(o.op==="event"){ pushAutoEvent(o.ev); return loadAutoQ().some(x=>x.id===evId(o.ev)) }
    if(o.op==="way"){ if(loadWay()===o.day)return true; saveWay(o.day); return loadWay()===o.day }
    if(o.op==="toast"){ setToast(o.text); return true }
    return true;
  };

  /* ── 장부를 실행한다. 되풀이해도 결과가 같다 ──
     말풍선이 남아 있으면 화면에 풀고(그리면서 하나씩 뺀다), 다 뜨면
     뒤따르는 것을 낸다. 목표 상태가 전부 확인된 뒤에만 장부를 지운다. */
  /* ── 그 방에 적힌 첫 덩어리 ──
     장부는 적은 차례대로 쌓인다(putBatch가 push한다). 방마다 그 방의
     머리만 실행한다 — 뒤엣것이 먼저 풀리면 말과 상태의 차례가 갈린다. */
  const headBatchOf=room=>loadBatches().find(b=>b.room===room)||null;
  /* ── 같은 방에서는 적힌 차례대로 푼다 (방별 FIFO) ──
     전에는 부팅에서 loadBatches().forEach로 전부 풀었다. 말풍선이 있는
     덩어리는 큐로 넘어가고(false), 말풍선이 없는 뒤 덩어리는 그 자리에서
     끝나버렸다 — 관전 대화가 아직 안 뜬 채로 뒤 덩어리의 해금·사건 소모가
     먼저 일어났다. 머리가 아니면 아무것도 안 한다: 머리가 끝날 때
     finishBatch가 다음을 이어 부른다. 방이 다르면 서로 안 막는다. */
  const resumeBatch=id=>{
    const b=getBatch(id); if(!b)return true;
    const head=headBatchOf(b.room);
    if(head&&head.id!==b.id)return false;             // 앞엣것이 아직 안 끝났다
    if((b.items||[]).length){ playItems(b); return false }
    return finishBatch(id);
  };
  /* 큐는 방마다가 아니라 하나뿐이므로 다른 방의 말풍선이 앞에 있을 수 있다 —
     순서는 큐가 정하고, 뒤따르는 것은 이 덩어리의 마지막 말풍선이 정한다. */
  const playItems=b=>{
    /* 이미 큐에서 도는 덩어리면 다시 안 넣는다 — 같은 답이 두 벌 뜬다 */
    if(queueRef.current.some(q=>q.batch===b.id))return;
    /* 풀 것이 남아 있는 방은 잠근다. 재생 중에 새 말을 받으면 「유저 말 →
       새 유저 말 → 옛 답 나머지」로 순서가 갈리고, 새 요청의 history에는
       아직 안 뜬 옛 답이 통째로 빠진다. */
    setBusy(x=>({...x,[b.room]:true}));
    b.items.forEach(it=>queueRef.current.push({...it,batch:b.id}));
    swapShot(b.room);
    pump();
  };
  const finishBatch=id=>{
    const b=getBatch(id); if(!b)return true;
    let ok=true;
    /* 줄 하나를 붙인다. 이미 있으면 성공이다(appendOnce가 본다) */
    const putLine=s=>{
      if(!s||!s.id)return true;
      if(s.need&&!loadBag().some(x=>x.key===s.need.key&&x.from===s.need.from))return true;
      const m={id:s.id,sender:s.sender||"user",text:s.text||"",ts:s.ts||Date.now()};
      if(s.sys!==false)m.sys=true;
      if(s.photo)m.photo=s.photo;
      return appendOnce(s.room,m);
    };
    /* ── ① 말풍선이 먼저다 ──
       전에는 Effect가 먼저였다. 관전 대사는 items가 아니라 sys로 오는데,
       그 순서에서는 **화면에 말이 하나도 없는 채로** 공개(disclosure)가
       먼저 장부에 적혔다. 저장이 거기서 끊기면 아무도 말한 적 없는 사실을
       상대가 아는 상태가 남는다. 대화가 남은 뒤에만 상태가 움직인다.
       need가 붙은 줄(「받았다」 같은 Effect 결과 지문)만 뒤로 미룬다 —
       그건 물건이 실제로 가방에 들어간 뒤에 붙어야 한다. */
    for(const s of b.sys||[]) if(!s||!s.need) if(!putLine(s))ok=false;
    /* 말이 안 남았으면 Effect로 못 간다 */
    if(!ok){ saveFailed(b.room,null,id); return false }
    /* ② Effect — 가방·초대·공개. 갈래를 셋으로 가른다 */
    for(const e of b.effects||[]){
      const r=applyEffect(e);
      if(r.status==="storage_error")ok=false;
    }
    /* ③ Effect 결과 지문. 그 조건이 실제로 이뤄졌을 때만 */
    for(const s of b.sys||[]) if(s&&s.need) if(!putLine(s))ok=false;
    /* 여기서 멈추면 아래는 전부 **소모하는** 일이라
       (초대를 줄에서 빼고, 장면을 쓰고, 관전 사건을 지운다) 대화가 없는
       채로 소모하면 유저가 한 일이 없던 일이 된다. */
    if(!ok){ saveFailed(b.room,null,id); return false }
    /* ④ 해금 */
    if((b.unlocked||[]).length){
      const now=loadUnlocked();
      const fresh=b.unlocked.filter(k=>HIDDEN_LABEL[k]&&!now.includes(k));
      if(fresh.length){
        const next=[...now,...fresh];
        if(!saveUnlocked(next)||!fresh.every(k=>loadUnlocked().includes(k)))ok=false;
        else{
          setUnlocked(next);
          setToast(fresh.length===1?`.hidden — ${HIDDEN_LABEL[fresh[0]]}`:`.hidden — ${fresh.length}개가 열렸다`);
          if(!applyOp({op:"event",ev:{kind:"unlock",name:HIDDEN_LABEL[fresh[0]]}}))ok=false;
        }
      }
    }
    /* ⑤ 초대 줄에서 빼기 — 답한 것만 */
    for(const op of b.invite_ops||[]){
      if(op.op!=="shift")continue;
      const head=headInvite();
      if(!head||head.place!==op.place||head.char!==op.char)continue;   // 이미 뺐다
      shiftInvite();
      const now=headInvite();
      if(now&&now.place===op.place&&now.char===op.char)ok=false;
    }
    setInvite(headInvite());
    /* ⑥ 이 판의 상태 — 자리·도장·선물 */
    for(const o of b.local_ops||[]) if(!applyOp(o))ok=false;
    if(b.toast)setToast(b.toast);
    /* ⑦ 중요 장면 소모.
       그 장면이 실제로 성공했으면 그 사람은 이제 안다 — 상태도 같이 뒤집는다.
       partner_known(다른 쪽이 처음 아는 자리)만이 아니라 partner_confirm
       (본인이 정해지는 자리)도다 — 안 뒤집으면 아크가 끝난 뒤에도 정작
       선택된 사람이 「모르는」 상태로 남는다. 안 뒤집히면 장부를 안 지운다. */
    if(b.scene_ack){
      if((b.scene_ack==="partner_known"||b.scene_ack==="partner_confirm")
        &&!markPartnerKnown(b.room))ok=false;
      if(ok){
        ackScene(b.room,b.scene_ack);
        if(peekScene(b.room)===b.scene_ack)ok=false;
      }
    }
    /* ⑧ 관전 사건 소모 */
    if(b.auto_event_id){
      ackAutoEvent(b.auto_event_id);
      if(loadAutoQ().some(x=>x.id===b.auto_event_id))ok=false;
    }
    /* 하나라도 확인이 안 되면 장부를 안 지운다. 그 방은 잠긴 채로 남고,
       다시 눌러도 모델은 안 부른다 — 남은 것만 이어서 한다. */
    if(!ok){ saveFailed(b.room,null,id); return false }
    /* 다 했는데 장부를 못 지우면 방이 영영 잠긴다 — 이것도 올린다.
       다시 눌러도 위가 전부 멱등이라 한 번 더 해도 결과는 같다 */
    if(!dropBatch(id)){ saveFailed(b.room,null,id); return false }
    settle(b.room);
    /* 모델을 아직 안 부른 일(초대·나가기·선물…)은 여기서 이어간다.
       정확히 한 번이다 — 장부가 지워진 뒤이므로 다시 오지 않는다.
       **다음 덩어리를 잇기 전에** 낸다: 순서를 바꾸면 뒤 덩어리의
       after_request가 먼저 나가고, 더 나쁘게는 아직 화면에 안 뜬
       말풍선이 history에서 통째로 빠진 채 요청이 나간다. */
    runAfter(b.room,b.after_request);
    /* ── 그 방에 적힌 다음 덩어리를 잇는다 (방별 FIFO) ──
       머리가 끝나야 다음이 열린다. 모델은 안 부른다 — 적힌 것만 푼다. */
    const next=headBatchOf(b.room);
    if(next)resumeBatch(next.id);
    return true;
  };
  /* ── 이어서 부를 요청은 함수가 아니라 장부에 적는다 ──
     closure로 들고 있으면 새로고침 한 번에 사라진다. 그러면 선물은
     가방에 들어갔는데 상대가 영영 아무 말도 안 하는 판이 된다.
     history·counts·가방은 **여기서** 최신 상태로 다시 조립한다 —
     장부를 쓸 때의 세계가 아니라 실제로 보낼 때의 세계여야 한다. */
  const runAfter=(room,after)=>{
    if(!after||!room)return;
    /* 지도에서 실제로 처음 마주친 사람의 첫 마디. 장소 각본은 이미 문구집에
       있으므로 모델을 부르지 않는다. 장부에 줄 자체를 넣어 새로고침에도
       어느 장소의 첫 마디였는지가 바뀌지 않게 한다. */
    if(Array.isArray(after.lines)){
      const lines=after.lines.filter(x=>x&&x.text);
      if(lines.length){ setBusy(b=>({...b,[room]:true})); enqueue(room,lines) }
      return;
    }
    const ms=storeRef.current.msgs[room]||[];
    request(room,{mode:"chat",room,user_name:name,
      history:buildHistory(sinceSum(room,ms)),signals:buildSignals(room),
      recent_photos:recentPhotos(room),counts:roomCounts({[room]:ms.length}),
      bag:bagOut(),...(after.extra||{})});
  };
  /* ── 모델을 안 타는 일도 같은 장부를 쓴다 ──
     자리 종료·귀갓길·초대 답·자리 이동·지도 방문·선물. 전에는 closeScene·
     stampGone·stampGift·goneTo·gifts를 메시지 저장 **전에** 했다 — 저장이
     실패하면 「간 것으로 찍혔는데 간 기록이 없는」 상태가 됐다. */
  /* ── 돌려주는 값은 「적혔나」다. 「지금 다 풀었나」가 아니다 ──
     방별 FIFO가 생기면서 정상 대기(그 방의 앞 덩어리가 아직 안 끝남)가
     resumeBatch의 false와 같은 값이 됐다. 호출자는 그걸 실패로 읽는다 —
     귀갓길 창이 안 뜨고, 초대가 두 번 나가는 자리가 거기였다.
     적혔으면 참이다: 지금 못 푼 것은 장부가 들고 있고, 머리가 끝나면
     finishBatch가 이어 부른다. 거짓은 **저장 자체가 안 됐을 때**뿐이다. */
  const localBatch=(id,room,plan)=>{
    if(getBatch(id)){ resumeBatch(id); return true }
    if(!putBatch(newBatch(id,room,plan))){ saveFailed(room); return false }
    resumeBatch(id);
    return true;
  };
  /* ── 모델의 답 하나를 장부로 옮긴다 ──
     여기서도 상태를 안 바꾼다. 계획만 적는다.
     같은 id가 이미 있으면 그대로 둔다 — 늦게 온 답·재시도·되살아난 탭이
     반쯤 푼 상태를 처음으로 되돌리면 이미 뜬 말풍선이 또 뜬다. */
  const commitTurn=(id,room,data,payload,scene)=>{
    const had=getBatch(id); if(had)return had;
    const fx=(data&&Array.isArray(data.effects))?data.effects:[];
    const {sys,toast}=planEffects(fx);
    const ops=[];
    /* 때가 지난 자리였다 — 방금 온 답이 마무리 인사다. 인사가 다 뜬 뒤에
       자리를 닫는다. 답을 기다리는 사이 유저가 다른 자리를 열었을 수 있으니
       그때 그 자리일 때만 닫는다(applyOp가 본다). */
    if(payload.place_over&&scene)ops.push({op:"leave",id:id+"#out",room,since:scene.since,
      text:scene.place===WAY?"집에 도착했다":`${scene.place}에서 나왔다`});
    /* ⑨ 워커는 「누가·어디서」만 준다. 그 짝의 사진이 있는지, 이미 본
       짝인지는 여기서 본다 — 사진표가 양쪽에 있으면 한 장 갈 때마다 갈린다 */
    const km=kissNext(data&&data.kiss);
    if(km)ops.push({op:"kiss",shot:km.shot});
    const b=newBatch(id,room,{
      items:bubbles(id,room,(data&&data.messages)||[]),
      sys,effects:fx,toast,local_ops:ops,
      unlocked:(data&&Array.isArray(data.unlocked))?data.unlocked:[],
      /* 워커가 실제로 올려서 답까지 낸 경우에만 scene_ack가 온다. 사유를
         거절하고 일반 턴으로 내렸으면 안 온다 — 그때는 예약이 남는다 */
      scene_ack:(payload.scene_reason&&data&&data.scene_ack===payload.scene_reason)
        ?payload.scene_reason:""});
    return putBatch(b)?b:null;
  };
  /* ── 끊긴 재생을 잇는다 ──
     첫 말풍선 전에 껐든 타이핑 도중에 껐든, 남아 있는 덩어리부터 다시 푼다.
     그래서 「장면은 소모됐는데 답이 없다」가 안 생긴다.
     푸는 동안 그 방은 잠긴다(playItems) — 아직 안 뜬 말 위에 새 말을
     얹으면 순서도 이력도 갈린다. */
  useEffect(()=>{ loadBatches().forEach(b=>resumeBatch(b.id)) },[]);
  /* ── 접어둔 자리는 시간에 맞춰 끝난다 ──
     X는 나가기가 아니라 접어두기다. 그런데 유효기간이 없어서, 낮에 보건실을
     접어두고 저녁에 열어도 아직 보건실에 앉아 있었다 — 재언은 다섯 시에
     퇴근하는 사람인데. 이 앱의 전제는 유저가 없어도 세계가 돌아간다는 거다.
     그 방에서 말이 끊긴 지 한 시간이 지났으면 그 모임은 끝난 걸로 친다.
     한 시간은 새 숫자가 아니다 — 「자리를 비웠다」의 기준(AUTO_AWAY, 관전방과
     같은 자)이다. 처음에는 하루 경계(새벽 다섯 시)로 닫았는데, 그러면 낮에
     접어둔 자리가 밤까지 살아 있었다. 이 규칙이 그 규칙을 통째로 품는다.
     대화가 이어지는 중이면 한 시간이 안 됐으니 안 닫힌다 — 따로 봐줄 게 없다.
     대화 중에 때가 되는 쪽은 send가 맡는다(place_over) — 인물이 대답에서
     마무리하고 일어선다. 여기는 접어두고 자리를 뜬 사람 몫이다.
     나갈 때와 같은 규칙으로 닫는다: 말을 나눴으면 두고 온 것도 챙기고(closeScene),
     기록에 한 줄 남긴다. 닫고 나서 인사를 한 번 부른다 — 말없이 끝나 있으면
     세계가 돌아간 게 아니라 꺼져 있던 게 된다. 먼저 간 사람이 말을 남긴다.
     단 그 사람이 자는 시간이면 인사는 안 부른다 — 점은 「자는 중」인데
     지금 시각 말풍선이 오면 그게 처음 고치려던 그림이다. 지문만 남는다.
     답이 오는 중이면(inflight) 이번엔 건너뛴다 — place_over 처리기가 말풍선
     뒤에 알아서 닫는다. 여기서도 닫으면 「나왔다」 두 줄에 작별이 두 벌 온다.
     함수로 뽑아둔 건 지도(openAsk)도 이걸 부르기 때문이다 — 목록에 밤새
     앉아 있던 탭은 view가 안 바뀌어 효과가 못 돌고, 죽은 자리를 근거로
     「같이 갈까요」가 뜬다. */
  const expireScene=()=>{
    const sc=sceneRef.current;
    if(!sc||inflightRef.current[sc.room])return;
    const ms=storeRef.current.msgs[sc.room]||[];
    const last=ms.length?ms[ms.length-1].ts:sc.since;
    if(Date.now()-last<AUTO_AWAY&&!sceneOver(sc))return;
    /* 나온 줄을 남기는 것과 자리를 닫는 것은 한 덩어리다. 전에는 먼저 닫고
       그 다음에 줄을 남겼다 — 저장이 실패하면 자리만 사라졌다. */
    /* 나갔다는 것을 같이 보낸다. 여기서는 자리를 이미 닫으므로 place가
       안 실리고, 그러면 모델에게는 그냥 문자 대화로 보인다 — 지문 한 줄만
       유저가 한 말처럼 들어간다. 그래서 이미 나간 사람을 두고 「오늘 벌써
       두 번째 나가는 거예요」라고 진행형으로 말했다. 나간 뒤라고 알려준다.
       자는 사람은 안 부른다 — 점은 「자는 중」인데 말풍선이 오면 거짓말이다. */
    const pr=presence(sc.room);
    const id="leave|"+sc.room+"|"+sc.since;
    localBatch(id,sc.room,{local_ops:[{op:"leave",id:id+"#0",room:sc.room,since:sc.since,
      text:sc.place===WAY?"집에 도착했다":`${sc.place}에서 나왔다`}],
      ...(pr&&pr.s==="off"?{}:{after_request:{extra:{left:sc.place}}})});
  };
  useEffect(()=>{expireScene()},[name,view]);
  /* 밤에 자리에서 나오면 그냥 사라지는 게 아니라 데려다준다.
     유저 집을 지도에 세우지 않은 건 그게 갈 곳이 아니라 헤어지는 자리라서다 —
     여기 붙는 한 다리가 그 일을 한다. 하루에 한 번이면 충분하다.
     매번 나올 때마다 물으면 데려다주는 게 아니라 절차가 된다. */
  const [way,setWay]=useState(null);
  /* 나가기도 한 번 묻는다. 하루에 한 번뿐인 자리를 뒤로가기 한 번에 닫으면
     실수로 닫힌다 — 들어올 때 물었으니 나갈 때도 묻는 게 짝이 맞다. */
  const [leaving,setLeaving]=useState(null);
  /* 사물함 명패 둘. 갈 자리는 아니지만 누르면 한 마디 한다 */
  const [plate,setPlate]=useState(null);
  /* 교실 문틈. 수업 중엔 대화가 아니라 구경이다 — 자리 도장도 대화도 없이
     들여다보기만 한다. {shot} 하나가 전부라 저장할 것도 없다 */
  const [look,setLook]=useState(null);
  /* 장바구니는 자리 안에서도 열려야 한다. 선물은 만나서만 주니까 */
  const [cart,setCart]=useState(false);
  /* 단톡방은 강현이 판다. 그전까지는 없는 방이다 */
  const [groupOn,setGroupOn]=useState(loadGroupOn);
  const [groupNew,setGroupNew]=useState(false);
  const leaveScene=()=>{ const sc=sceneRef.current; if(sc)setLeaving(sc) };
  /* 나가면 인사를 받는다. 문을 열어주고 등을 보이는 사람은 없다 —
     지문 한 줄을 남기고, 그 줄을 보고 상대가 알아서 인사한다.
     새 프롬프트를 안 붙인다. 「보건실에서 나왔다」면 할 말이 정해져 있다. */
  const answerLeave=ok=>{
    const sc=leaving; setLeaving(null); if(!sc||!ok)return;
    /* 창이 떠 있는 사이 자리가 이미 닫혔을 수 있다(place_over 타이머·만료).
       죽은 자리로 진행하면 「나왔다」 지문과 작별 요청이 두 벌 나간다 */
    const cur=sceneRef.current; if(!cur||cur.since!==sc.since)return;
    /* 귀갓길에서 나오는 건 나오는 게 아니라 도착하는 것이다 */
    const id="leave|"+sc.room+"|"+sc.since;
    if(!localBatch(id,sc.room,{local_ops:[{op:"leave",id:id+"#0",room:sc.room,since:sc.since,
      text:sc.place===WAY?"집에 도착했다":`${sc.place}에서 나왔다`}],
      after_request:{extra:{}}}))return;
    /* 나온 뒤에 밤이면 데려다준다. 인사와 겹치지 않게 창을 이어서 띄운다 */
    if(sc.place!==WAY&&talkedEnough(sc)&&wayOK()&&loadWay()!==dayKey())setWay(sc);
  };
  const answerWay=ok=>{
    const sc=way; setWay(null); if(!sc)return;
    /* answerLeave가 이미 닫고 여기 온다 — 남은 자리가 있으면 그때 것이다 */
    const who=sc.room, nm=CHARS[who].name;
    if(!ok){
      if(sceneRef.current&&sceneRef.current.since===sc.since)
        localBatch("wayno|"+who+"|"+sc.since,who,{local_ops:[{op:"closeScene",since:sc.since}]});
      return;
    }
    const line=who==="jaeeon"?`${nm}의 차를 타고 집에 가는 길이다`:`${nm}과 같이 버스를 타고 집에 가는 길이다`;
    const since=Date.now(), id="way|"+who+"|"+since;
    localBatch(id,who,{
      sys:[{id:id+"#0",room:who,text:line}],
      local_ops:[{op:"closeScene",since:sc.since},{op:"way",day:dayKey()},
        {op:"openScene",scene:{room:who,place:WAY,since,bg:WAY_BG[who]}},{op:"view",room:who}],
      after_request:{extra:{place:WAY}}});
  };
  const answerInvite=ok=>{
    /* 답한 것만 줄에서 뺀다. 뒤에 밀려 있던 초대는 그 자리에서 열린다 */
    const iv=invite; if(!iv){ setInvite(null); return }
    /* ── 먼저 빼지 않는다 ──
       전에는 shiftInvite()를 맨 앞에서 부르고 성공 여부도 안 봤다. 답 지문
       저장이 실패하면 답하지 않은 초대가 사라졌고, 초대 저장이 실패하면
       줄에는 남았는데 요청은 나가서 다시 답할 때 값이 두 번 나갔다.
       「지문 → 상태 → 줄에서 빼기」를 장부에 적고 멱등으로 실행한다. */
    const line=ok?`${jos(CHARS[iv.char].name,"과/와")} ${iv.place}에 가기로 했다`:`${jos(iv.place,"은/는")} 다음에 가기로 했다`;
    const id="inv|"+iv.char+"|"+iv.place+"|"+(ok?"y":"n");
    const ops=[];
    if(ok){
      ops.push({op:"goneTo",place:iv.place},{op:"stampGone",place:iv.place},
        {op:"event",ev:{kind:"met",to:iv.char,name:iv.place}});
      // 그 자리로 화면을 옮긴다. 배경이 깔리고 말풍선이 걷힌다
      /* 하던 자리가 있으면 먼저 정리한다 — 덮어쓰면 두고 온 것이 증발한다 */
      if(PLACE_BY[iv.place])ops.push({op:"closeScene"},
        {op:"openScene",scene:{room:iv.char,place:iv.place,since:Date.now(),came:"invited"}});
    }else ops.push({op:"refused",place:iv.place});
    /* 답을 했으면 상대도 답을 해야 한다. 전에는 여기서 끝이었다 —
       가자고 해놓고 갈게요 했더니 아무 말도 없이 대화가 멈췄다.
       그 자리 얘기는 한 시간 뒤 관전방에서나 나왔고, 정작 같이 가기로 한
       사람은 입을 다물고 있었다. 승낙이든 거절이든 반응이 있어야 사람이다. */
    localBatch(id,iv.char,{sys:[{id:id+"#0",room:iv.char,text:line}],
      local_ops:ops,invite_ops:[{op:"shift",place:iv.place,char:iv.char}],
      after_request:{extra:ok&&PLACE_BY[iv.place]?{place:iv.place,came:"invited"}:{}}});
  };

  /* 지도에서 내가 고른 자리. 인물이 부른 게 아니라 내 발로 가는 거라 창만
     같고 규칙은 다르다 — 여기서 물러나도 그 자리가 닫히지는 않는다.
     마음이 바뀐 것뿐이지 거절한 게 아니니까. */
  const [ask,setAsk]=useState(null);
  /* ── 같이 자리를 옮긴다 ──
     전에는 자리에 있으면 무조건 못 갔다. 점심의 보건실에서 옥상으로,
     퇴근한 재언과 편의점으로 — 같이 있다가 발길 닿는 이동은 되는 게 맞다.
     answerAsk와 다른 점 셋: 상대가 이미 정해져 있고(같이 있던 사람),
     주말 전용(wendOnly)을 안 보고 — 그건 약속 잡고 가는 날의 규칙이지
     이미 같이 있는 사람과 흘러가는 저녁의 규칙이 아니다 —, 떠나는 자리를
     먼저 정리한다(두고 온 것 챙기기 포함). 이동도 방문이라 도장은 찍는다. */
  const answerMove=ok=>{
    const place=ask; setAsk(null); setAskWho(null);
    const sc=sceneRef.current;
    if(!ok||!place||!sc||sc.place===WAY)return;
    const p=PLACE_BY[place]; if(!p)return;
    if(!placeHours(p)||goneToday(place)||!placeOpen(p,loadMet())||!(p.who||[]).includes(sc.room))return;
    /* 창(mv)과 같은 검사 — 주는 길이 둘이면 둘 다 잠가야 한다.
       근무·수업 중엔 학교 안에서만, 수업 중의 교실은 이동으로도 못 간다 */
    if(!isWend()&&AT_WORK.includes((presence(sc.room)||{}).t||"")&&p.map!=="school")return;
    if(place==="교실"&&presence("minhyun").t==="수업 중")return;
    const who=sc.room;
    const since=Date.now(), id="move|"+who+"|"+place+"|"+since;
    localBatch(id,who,{
      sys:[{id:id+"#0",room:who,text:`${jos(place,"으로/로")} 같이 자리를 옮겼다`}],
      local_ops:[{op:"closeScene",since:sc.since},{op:"stampGone",place},{op:"goneTo",place},
        {op:"event",ev:{kind:"met",to:who,name:place}},
        {op:"openScene",scene:{room:who,place,since,came:"asked"}},{op:"view",room:who}],
      after_request:{extra:{place,came:"asked"}}});
  };
  /* 동행을 고르는 자리에서 고른 사람. 창을 닫으면 같이 비운다 */
  const [askWho,setAskWho]=useState(null);
  /* 지도를 여는 순간 죽은 자리를 정리한다 — 목록에 밤새 앉아 있던 탭은
     만료 효과가 못 돌아서, 어제 자리를 근거로 「같이 갈까요」가 떴다 */
  const openAsk=place=>{expireScene();setAskWho(null);setAsk(place)};
  /* 누구를 만나나.
     pick — 유저가 고른다(도서관·레코드샵). 시간을 내서 가는 자리라서.
     out  — 그 시각에 밖에 나와 있을 수 있는 사람 중에서 뽑는다. 마주치는 자리라서.
     그 밖 — 자리 임자가 정해져 있다. 둘 다면 더 많이 말을 나눈 쪽. */
  const whoAt=(p,picked)=>{
    /* 두 사람이 가능한 장소는 지도에서 고른 사람을 그대로 데려간다.
       우연히 마주치는 장소는 그 시각 실제로 밖에 나온 사람만 고를 수 있다. */
    if(picked&&(p.who||[]).includes(picked)
      &&(p.meet!=="out"||outAt(p).includes(picked)))return picked;
    if(p.pick)return picked||null;
    if(p.meet==="out"){ const out=outAt(p); return out.length?out[Math.floor(Math.random()*out.length)]:null }
    const list=p.who||[]; if(list.length<2)return p.own||list[0];
    const n=id=>(storeRef.current.msgs[id]||[]).length;
    return list.slice().sort((a,b)=>n(b)-n(a))[0];
  };
  const answerAsk=ok=>{
    const place=ask, picked=askWho; setAsk(null); setAskWho(null);
    if(!ok||!place)return;
    const p=PLACE_BY[place]; if(!p)return;
    /* 못 가면 말은 해준다. 전에는 조용히 아무 일도 안 났다 — 문이 열려
       있고 「GO?」까지 물어놓고 GO! 를 누르면 아무 데도 안 가는 것이라,
       고장인지 시간이 아닌 건지 유저가 알 수가 없었다. */
    if(!canGoNow(p)){
      /* 까닭마다 다른 말을 한다. 아무도 없어서 못 가는데 여는 시각을
         적어주면 거짓말이 된다 — 그 시각이 돼도 사람이 없으면 못 간다 */
      setToast(
        goneToday(place)              ? `${place} — 오늘은 다녀왔어요`
        : (!placeHours(p)||!wendOnlyOk(p)) ? (placeWhen(p)||`${place} — 지금은 안 돼요`)
        : `${place} — 지금은 아무도 없어요`);
      return }
    const who=whoAt(p,picked);
    if(!who){ setToast(`${place} — 지금은 아무도 없어요`); return }
    /* 학교가 끝났다고 사람이 사라지는 것은 아니다. 편의점에서 아직 만나지
       않은 사람을 실제로 마주치면 누구든 이 자리가 첫 만남이다. 예전에는
       강현만 이 갈래를 타서 재언이 처음 본 유저를 아는 척했다. 메신저가 먼저
       관계를 만들지 않는다 — 장소의 첫 마디를 읽고 헤어진 뒤에 방이 열린다. */
    const firstEncounter=place==="편의점"&&!loadGetcha(who);
    const firstLines=firstEncounter?demoProactive(who,place,name):null;
    /* 「같이 갈 사람은 Who?」로 고른 자리는 같이 간 것이다. 기록에도 그렇게 남긴다 —
       「레코드샵에 갔다」만 있으면 이력만 읽는 다음 턴이 혼자 간 것으로 읽는다 */
    const since=Date.now(), id="ask|"+who+"|"+place+"|"+since;
    const enterPlace=()=>localBatch(id,who,{
      sys:[{id:id+"#0",room:who,
        text:picked?`${jos(CHARS[who].name,"과/와")} ${place}에 갔다`:`${place}에 갔다`}],
      /* 하던 자리가 있으면 먼저 정리한다 — 덮어쓰면 두고 온 것이 증발한다 */
      local_ops:[{op:"stampGone",place},{op:"goneTo",place},
        {op:"event",ev:{kind:"met",to:who,name:place}},{op:"closeScene"},
        {op:"openScene",scene:{room:who,place,since,...(picked?{came:"asked"}:{}),
          ...(firstEncounter?{firstEncounter:true}:{})}},
        {op:"view",room:who}],
      after_request:firstEncounter?{lines:firstLines}
        :{extra:{place,...(picked?{came:"asked"}:{})}}});
    /* 재언의 정해진 첫 마디는 유저의 옛 일기 뒤에 온다. 방에서 처음 만날
       때와 같은 순서다. 일기를 덮으면 위 장부를 그때 실행해 편의점 장면과
       첫 만남 대사를 연다. 이미 쓴 일기라면 바로 들어간다. */
    if(firstEncounter&&who==="jaeeon"&&!loadDiary()){
      diaryAfterRef.current=enterPlace;
      setDiary(true);
      return;
    }
    enterPlace();
  };

  /* 백엔드가 알려준 해금 목록을 반영하고, 새로 열린 게 있으면 알린다 */
  /* 해금도 장부를 탄다. 데모(?demo=1)만 여기로 들어온다 — 진짜 답은
     commitTurn이 unlocked를 장부에 적고 finishBatch가 적용한다. */
  /* ⑥ 제목을 맞혀서 연 칸. 장부를 안 탄다 — 두 사람이 한 일이 아니라
     유저가 알아낸 것이라 관전방에 적힐 사건이 없다. 토스트도 없다:
     「정답!」이 뜨면 그때부터 이건 퀴즈고, 퀴즈는 대화가 아니다.
     저장이 막히면 열지 않는다. 화면만 열리고 다음 판에 다시 잠기면
     무엇을 맞혔는지가 아니라 무엇이 고장 났는지를 유저가 세게 된다. */
  const guessHidden=key=>{
    if(!HIDDEN_LABEL[key])return;
    const now=loadUnlocked();
    if(now.includes(key))return;
    const next=[...now,key];
    if(!saveUnlocked(next)||!loadUnlocked().includes(key)){setToast("저장이 안 돼요");return}
    setUnlocked(next);
  };

  const applyUnlocked=list=>{
    if(!Array.isArray(list)||!list.length)return;
    const fresh=list.filter(k=>HIDDEN_LABEL[k]&&!unlockedRef.current.includes(k));
    if(!fresh.length)return;
    localBatch("unlock|"+fresh.join("|"),"health",{unlocked:fresh});
  };

  /* 데모 답 한 번. 여기서 터지면 타이핑 표시가 영영 안 꺼지므로 통째로 감싼다.
     원인은 콘솔에 남긴다 — 조용히 멈추면 뭐가 잘못됐는지 알 수가 없다. */
  const demoSay=(room,ask,gift)=>{
    try{
      enqueue(room,demoReply(room,ask,name,storeRef.current.msgs,gift));
      applyUnlocked(demoUnlocked(storeRef.current.msgs));
    }catch(e){
      console.error("%c[NULL] 데모 실패 ▶ "+(e&&e.message||e),"color:#c23b50;font-weight:bold");
      setBusy(b=>({...b,[room]:false}));
    }
  };

  /* ── 요약을 한 칸 굴린다 ──
     안 요약된 원문이 SUM_AT을 넘으면, 끝의 TAIL_KEEP만 남기고 앞쪽을 뭉친다.
     다 뭉치면 방금 하던 얘기까지 요약으로만 남아 말투가 끊긴다.
     한 번에 하나만 돈다. 답장 흐름과 무관한 뒷일이라 실패해도 조용히 넘어간다 —
     다음 턴에 다시 시도된다. */
  const summingRef=useRef({});
  const rollSummary=async room=>{
    /* 단톡도 한다. 전에는 CHARS에 있는 방(1:1 둘)만 했다. 그러면 단톡의
       오래된 대화는 요약도 없이 창 밖으로 밀려 그냥 사라진다 — 1:1은 밀려난
       것을 요약이 들고 있는데 단톡은 들고 있는 게 없어서, 창을 넘는 순간
       그 앞이 없던 일이 된다. 두 사람이 앞서 한 말을 잊고, 정해둔 것을 다시
       정하고, 시간 순서가 어긋난 소리를 한다.
       워커는 진작부터 감당하고 있었다 — room 검증에 group이 있고 SUMMARIZE도
       두 사람을 같이 적게 돼 있다. 프론트 가드 한 줄이 막고 있었을 뿐이다.
       관전(health)도 한다. 워커가 요약일 때만 네 방을 받게 열어뒀다 —
       요약은 인물 블록도 형식도 안 쓰는 압축이라 방을 안 가려도 된다. */
    if(demoOn()||summingRef.current[room])return;
    const all=sinceSum(room,storeRef.current.msgs[room]||[]);
    const total=all.reduce((n,m)=>n+((m.text||"").length),0);
    if(total<SUM_AT)return;
    let keep=0,cut=all.length;
    for(let i=all.length-1;i>=0;i--){ keep+=(all[i].text||"").length; if(keep>=TAIL_KEEP){cut=i;break} }
    const chunk=all.slice(0,cut);
    if(!chunk.length)return;
    summingRef.current[room]=true;
    try{
      const prev=loadSum(room);
      const res=await fetch(apiUrl(),{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"summarize",room,user_name:name,summary:prev.text,
          history:buildHistory(chunk)})});
      const data=await res.json().catch(()=>null);
      if(res.ok&&data&&data.summary){
        saveSum(room,{text:data.summary,upto:chunk[chunk.length-1].ts});
        console.log("%c[NULL] 요약 갱신 "+room+" — 원문 "+total+"자 중 "+
          chunk.length+"줄을 "+data.summary.length+"자로","color:#7a6cc4");
      }
    }catch(e){ console.warn("[NULL] 요약 실패 — 다음 턴에 다시",e); }
    summingRef.current[room]=false;
  };

  /* API 요청 — 실패 시 조용한 재시도 버튼 */
  const request=async(bucket,payload)=>{
    const up=userProfile();
    /* ── 준 기록은 수신자를 지킨다 ──
       {jaeeon:["mug"], minhyun:["letter"]} 그대로 보낸다. 평면 배열로 합치면
       누구에게 준 것인지가 사라지고, 워커가 사실을 만들 수가 없다.
       이번 턴에 건넨 것은 워커가 gift와 겹치는 것을 빼준다. */
    payload.gifts=giftsRef.current||{};
    /* 공개 장부도 싣는다 — 출처가 실제로 말해진 사실의 known_by가
       다음 턴 투영에서 넓어진다 (§8.5 disclosure) */
    payload.disclosed=loadDisclosed();
    // 다녀온 자리·거절한 자리 — 서버가 다음 제안을 고르는 근거
    if(payload.mode==="chat"){ payload.met=loadMet(); payload.refused=loadRefused();
      /* 지금 문 닫은 자리는 인물도 가자고 안 한다. 시간은 프론트만 안다 —
         워커는 UTC로 돌고 어느 엣지에 뜨는지도 그때그때다 */
      payload.closed=PLACES.filter(p=>!placeHours(p)).map(p=>p.name);
      /* 유저가 먼저 「편의점 가자」고 했을 때 인물이 열 수 있는 자리.
         지도 창이 「갈래요?」를 띄우는 조건 그대로다 — 조건은 프론트만 안다
         (해금·시각·주말·오늘 도장·그 사람이 갈 수 있는 곳).
         자리에 마주 앉아 있는 턴에는 안 보낸다. 워커도 place가 있으면 자리
         목록을 통째로 빼는데, 여기서 보내면 검증만 열려 있는 꼴이 된다. */
      if(payload.room&&payload.room!=="group"&&!payload.place)
        payload.can_go=canGoWith(payload.room,loadMet()); }
    if(up)payload.user_profile=up; else delete payload.user_profile;
    if(!payload.counts)payload.counts=roomCounts();
    if(payload.days==null)payload.days=daysSince(storeRef.current);
    if(payload.now==null)payload.now=timeWord();
    if(payload.day==null)payload.day=dayWord();
    if(payload.season==null)payload.season=seasonWord();
    /* 그 방 사람의 접속 상태. 목록에는 「수업 중」이 떠 있는데 본인은 한가한
       사람처럼 즉답했다 — 화면이 아는 걸 프롬프트가 몰랐다. 목록과 같은
       함수(presence)를 그대로 실어 보낸다.
       「주말」은 안 보낸다 — 요일이 이미 실려 있어서 같은 말이 두 번 된다.
       자리(place)에 같이 있을 때는 워커가 알아서 뺀다 — 마주 앉아 있는데
       「수업 중」이 붙으면 그게 더 이상하다. */
    if(payload.mode==="chat"&&payload.states==null){
      const st={};
      (payload.room==="group"?["jaeeon","minhyun"]:[payload.room]).forEach(id=>{
        const pr=presence(id); if(pr&&pr.t!=="주말")st[id]=pr.t;
      });
      if(Object.keys(st).length)payload.states=st;
    }
    /* 이 방의 요약. 원문 창 밖으로 밀려난 얘기가 여기 들어 있다.
       호출부마다 붙이지 않고 여기서 한 번에 얹는다 — 한 군데만 빠뜨려도
       그 경로에서만 기억을 잃는데, 그건 눈으로 찾기 어렵다. */
    /* 관전에도 싣는다. 안 실으면 요약을 만들어놓고 안 보는 꼴이다 */
    if(payload.mode==="chat"||payload.mode==="auto"){
      const t=loadSum(payload.room||bucket).text; if(t)payload.summary=t; }
    /* 자는 사람은 답이 없다. 목록의 점과 같은 시계(presence)를 본다.
       마주 앉아 있을 때(place)는 안 본다 — 눈앞에 있는 사람이 자고 있으면
       그건 자리가 닫힐 일이지 답이 없을 일이 아니다.
       지문을 한 줄 남긴다. 아무것도 안 뜨면 보낸 사람은 고장으로 읽는다.
       같은 줄을 연달아 쌓지는 않는다 — 다섯 번 말 걸면 다섯 줄이 된다. */
    if(payload.mode==="chat"&&!payload.place&&allAsleep(payload.room||bucket)){
      const who=payload.room==="group"?null:CHARS[payload.room||bucket];
      const line=who?`${jos(who.name,"은/는")} 자고 있다`:"둘 다 자고 있다";
      const ms=storeRef.current.msgs[bucket]||[];
      const last=ms[ms.length-1];
      if(!last||!last.sys||last.text!==line)
        appendMsg(bucket,{id:Date.now()+Math.random(),sender:"user",sys:true,text:line,ts:Date.now()});
      return;
    }
    /* ── 요청 하나에 이름표 하나 ──
       앞으로 한 턴이 모델 여러 번을 타게 된다(Writer→Director). 그러면 답이
       늦게 오고, 늦게 오는 동안 유저가 다시 보내거나 방을 나갔다 들어올 수
       있다. 그때 먼저 보낸 요청의 답이 뒤늦게 도착하면 지금 화면과 어긋난
       말이 붙는다. 이름표를 달아두고, 지금 것이 아니면 버린다.
       화면에 안 보이는 값이지만 없으면 늦은 답이 조용히 섞인다. */
    /* 재시도는 새 요청이 아니라 같은 요청을 다시 부르는 것이다. retry가 들고
       오는 payload에는 지난번 이름표가 그대로 붙어 있으니 그걸 쓴다 —
       새로 뽑으면 워커가 나중에 멱등 처리를 붙일 때 같은 턴을 두 번 센다. */
    const rid=payload.request_id
      ||((crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random());
    payload.request_id=rid;
    /* 지금이 어떤 자리인지. 서버는 상태를 안 들고 있어서 여기서 말해줘야
       하는데, 서버가 그대로 믿지는 않는다 — 허용된 사유인지와 지금 상태가
       그 사유를 받쳐주는지를 둘 다 보고 승인한다. 그래서 partner도 같이 보낸다.
       재시도면 이미 실려 있으니 다시 꺼내지 않는다 — 꺼내면서 지우기 때문에
       한 번 더 꺼내면 빈 값이 되어 중요한 장면이 일반 턴으로 내려간다. */
    /* 읽기만 한다. 지우는 것은 답이 저장된 뒤다(ackScene) —
       보내기 전에 지우면 실패한 턴에 그 장면이 통째로 증발한다. */
    if(!payload.scene_reason){
      const why=peekScene(bucket);
      if(why)payload.scene_reason=why;
    }
    const pid=loadPartner();
    if(pid)payload.partner=pid;
    /* ── 이야기 상태를 실어 보낸다 (E3·E4) ──
       워커는 아무것도 기억하지 않아서, 이야기가 어디까지 왔는지도 여기서
       말해줘야 한다. 감지는 워커가 한다 — 여기서는 상태만 나른다.
       출처 문답 단계는 그 방 사람 것이다. 단톡·관전에는 그 사람이 없다. */
    if(payload.mode==="chat"){
      payload.story=loadStory();
      if(CHARS[bucket])payload.origin_phase=originPhase(bucket);
      /* ④ 유저가 엽서 뒷면에 채운 셋. 강현 방에서만 실린다 — 재언은 그 종이를
         본 적이 없다. 워커에서는 **가변부에만** 들어간다(고정부에 넣으면
         캐시가 통째로 깨진다). 재언 일기(③)와 달리 이건 나가는 유일한 빈칸이고,
         그게 문서가 못박은 「서버 전달 경계」다. */
      if(bucket==="minhyun"){ const fl=loadFlash(); if(fl)payload.flash=fl; }
    }
    inflightRef.current[bucket]=rid;
    setBusy(b=>({...b,[bucket]:true}));
    setFailed(f=>({...f,[bucket]:null}));
    /* 데모는 ?demo=1로 고른 것만 남았다. 실패해서 넘어가는 길은 없앴다 —
       실패를 각본으로 메우면 화면에서 장애가 안 보인다. */
    if(DEMO.on){
      inflightRef.current[bucket]=null;
      setTimeout(()=>demoSay(bucket,demoAsk(payload),demoGiftKey(payload)),450);
      return;
    }
    /* ── 오래 걸려도 안 깨지고, 영영 안 오면 끊는다 ──
       여러 단계를 타는 턴은 평소보다 느리다. 그걸 고장으로 읽고 일찍 끊으면
       멀쩡한 답을 버리게 되므로 넉넉히 준다. 대신 무한정 기다리지는 않는다 —
       스피너가 영원히 도는 화면이 제일 나쁘다. */
    const ac=(typeof AbortController!=="undefined")?new AbortController():null;
    const killer=ac?setTimeout(()=>ac.abort(),REQ_TIMEOUT):null;
    try{
      const res=await fetch(apiUrl(),{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),...(ac?{signal:ac.signal}:{})});
      const data=await res.json().catch(()=>null);
      /* 이 방의 지금 요청이 아니면 버린다. 늦게 온 답을 붙이면 화면과 딴말이 된다 */
      if(inflightRef.current[bucket]!==rid)return;
      if(!res.ok){
        // 서버가 알려준 실패 사유를 그대로 들고 올라간다
        const err=new Error("HTTP "+res.status);
        err.detail=(data&&(data.detail||data.error))||("HTTP "+res.status);
        throw err;
      }
      clearTimeout(killer);
      if(inflightRef.current[bucket]===rid)inflightRef.current[bucket]=null;
      /* 선톡 답이 오는 사이 유저가 그 사람 자리에 들어갔을 수 있다.
         눈앞에 앉은 사람이 보낸 원격 안부 문자가 도착하면 버린다 — 발사 시점
         가드는 요청만 막지 도착은 못 막는다 */
      if(payload.greet&&sceneRef.current&&sceneRef.current.room===bucket){
        setBusy(b=>({...b,[bucket]:false}));
        return;
      }
      /* ── 계획을 먼저 적고, 그 다음에 실행한다 ──
         이 답이 바꿀 것을 통째로 장부에 적는다: 말풍선·검증된 Effect·
         해금·소모할 장면·닫을 자리. **여기서는 아무것도 안 바꾼다.**
         장부 저장이 성공한 뒤 resumeBatch가 전부 멱등으로 실행한다.
         전에는 이 셋이 각자 놀았다 — 첫 말풍선이 뜨기도 전에 장면은
         소모되고 초대는 타이머 뒤에만 있어서, 그 사이에 새로고침하면
         「썼는데 아무것도 안 남은」 턴이 됐다. */
      const bid=rid+"|"+bucket;
      const batch=commitTurn(bid,bucket,data,payload,sceneRef.current);
      /* 안 적혔으면 없던 일이다. 장면도 안 지웠고 표도 안 찍혔다 —
         모델을 다시 부르는 재시도로 남긴다 */
      if(!batch){ saveFailed(bucket,payload); return }
      /* 실측. 내 짐작이 아니라 진짜 토큰 수다. 읽음이 계속 0이면 캐시가
         안 맞고 있다는 뜻인데, 그건 오류를 안 내고 조용히 정가를 문다 */
      /* 멈춤이 max_tokens면 사고가 예산을 먹고 답이 잘린 것 — 출력 숫자가
         크고 화면 글자가 짧으면 그 차이가 전부 사고 토큰이다 */
      if(data&&data.usage)console.log("%c[NULL] "+(data.usage.model||"?")+
        " — 새로 "+(data.usage.input_tokens||0)+
        " · 캐시 씀 "+(data.usage.cache_creation_input_tokens||0)+
        " · 캐시 읽음 "+(data.usage.cache_read_input_tokens||0)+
        " · 출력 "+(data.usage.output_tokens||0)+
        " · 멈춤 "+(data.usage.stop_reason||"?")+
        (data.usage.output_tokens_details?" · 상세 "+JSON.stringify(data.usage.output_tokens_details):""),
        "color:#7a6cc4");
      /* ── 한 턴이 몇 번을 탔나 ──
         호출 수만 보고 비용을 짐작하지 않는다. 후보 재입력도, 캐시 쓰기·읽기도,
         재생성도 여기 다 잡힌다. 한 턴이 두 줄이면 다시 쓴 것이다. */
      /* 위의 usage는 쓰는 쪽 한 번이다. 한 턴이 네 번을 탔으면 그 하나만
         보고 비용을 짐작하면 안 된다 — 총합은 워커가 따로 세서 보낸다. */
      if(data&&Array.isArray(data.stages)&&data.stages.length){
        var tot=data.usage_total||{};
        console.log("%c[NULL] 단계 "+data.stages.length+"회"
          +" · 합계 새로 "+(tot.input_tokens||0)
          +" / 캐시 씀 "+(tot.cache_creation_input_tokens||0)
          +" / 읽음 "+(tot.cache_read_input_tokens||0)
          +" / 출력 "+(tot.output_tokens||0)+"\n"+data.stages.map(t=>
          `  #${t.call_id} ${t.stage}${t.candidate?"("+t.candidate+")":""} · ${t.model}`
          +` · ${t.status} · 새로 ${t.input_tokens} / 캐시읽음 ${t.cache_read_input_tokens}`
          +` / 출력 ${t.output_tokens} · ${t.latency_ms}ms · ${t.attempt}회차`).join("\n"),
          "color:#7a6cc4");
      }
      setTimeout(()=>rollSummary(bucket),1200);
      resumeBatch(bid);
    }catch(e){
      clearTimeout(killer);
      /* ── 오류와 사용자 취소를 가른다 ──
         유저가 다음 말을 보내면 앞 요청은 그 자리에서 밀려난다. 그건 고장이
         아니라 본인이 그만둔 것이므로 아무 말 없이 물러난다 — 재시도 단추도
         원인 줄도 안 띄운다. 본인이 밀어놓고 화면에 빨간 줄이 뜨면 제가 뭘
         망가뜨린 줄 안다. 스피너도 안 끈다: 지금 도는 새 요청의 것이다.
         밀려나지 않은 실패만 아래로 내려가서 재시도가 된다. */
      if(inflightRef.current[bucket]!==rid)return;
      inflightRef.current[bucket]=null;
      setBusy(b=>({...b,[bucket]:false}));
      const detail=(e&&e.name==="AbortError")
        ?"응답이 없어서 끊었습니다(시간 초과)"
        :String(e.detail||e.message||e).slice(0,500);
      // 화면(재시도 버튼 아래)과 콘솔 양쪽에 남긴다 — 어느 쪽을 보든 원인이 보이게
      console.error("%c[NULL] 실패 원인 ▶ "+detail,"color:#c23b50;font-size:13px;font-weight:bold");
      /* 실패한 턴을 각본으로 메우지 않는다.
         메우면 화면에는 대화가 그대로 뜬다 — 잠긴 것도, 키가 죽은 것도,
         한도가 바닥난 것도 전부 「잘 되는 중」으로 보인다. 실제로 그것 때문에
         자물쇠가 걸렸는지 아닌지를 한참 몰랐다. 안 되면 안 되는 게 보여야 한다.
         명시적 데모(?demo=1)는 그대로 둔다 — 그건 고른 것이다. */
      setFailed(f=>({...f,[bucket]:{payload,detail}}));
    }
  };

  /* 일반 대화 전송 */
  const send=(room,text,resumed)=>{
    /* 「//」로 열면 대화가 아니라 적어두는 것이다. 여기서 끊으므로 이력에도
       안 남고 워커도 안 부른다 — 인물은 이 말을 모른다. */
    if(/^\/\//.test(text)){ addNote(room,text.replace(/^\/\/\s*/,"")); return }
    /* ── 아직 안 뜬 답 위에 말을 얹지 않는다 ──
       화면에서도 막지만(busy) 코드로도 막는다. 받으면 「유저 말 → 새 유저
       말 → 옛 답 나머지」로 순서가 갈리고, 이 요청의 history에는 아직 안 뜬
       옛 답이 통째로 빠진다. 새로고침으로 되살아난 재생이 그 자리다. */
    if(replaying(room)){ setBusy(b=>({...b,[room]:true})); return }
    const prevList=storeRef.current.msgs[room]||[];
    /* ── 옥상이 올라오는 순간 ──
       강현 방이고, 오프닝에서 만난 게 강현이고, 아직 안 채웠고, 그가 이미
       말을 걸어둔 뒤다(「저 알죠」 세 줄이 앉은 다음). 그 순간에 한 번.

       유저가 친 말은 **삼키지 않는다.** 여기서 붙잡아 뒀다가 엽서를 덮은
       뒤에 그대로 다시 보낸다(resumed). 붙이고 나서 붙잡으면 말은 떠 있는데
       답이 없는 방이 되고, 삼키면 방금 친 말이 어디로 갔는지 모른다.
       모델은 이 순간에 안 부른다 — 기억이 올라오는 동안에는 아무도 말하지 않는다. */
    const metMinhyun=loadGetcha("minhyun")
      ||(sceneRef.current&&sceneRef.current.room==="minhyun"&&sceneRef.current.firstEncounter);
    if(!resumed&&room==="minhyun"&&metMinhyun&&!loadFlash()
       &&prevList.some(m=>m.sender==="minhyun")){
      setFlash({room,text});
      return;
    }
    const userMsg={id:Date.now()+Math.random(),sender:"user",text,ts:Date.now()};
    const next=appendMsg(room,userMsg);
    if(!next)return saveFailed(room);
    const history=buildHistory(sinceSum(room,next));
    /* ── 「그거 어떻게 알아요?」 ──
       등록값은 YES를 누른 순간 세계의 빈칸에 들어갔고, 두 사람은 그것을
       처음부터 알고 있다. 캐물으면 인물마다 딱 한 번 두 마디가 나온다 —
       「선생님이 알려줬잖아요.」, 그리고 「내가 언제?」에 「처음부터.」
       모델은 안 부른다. 현이 문구를 못박은 자리이고, 모델에게 맡기면
       매번 다르게 둘러대다가 결국 설명이 된다.
       인물이 방금 등록값을 입에 올린 바로 다음일 때만 연다 — 아무 데서나
       나오는 「어떻게 알아?」에 열리면 그게 오발이다.
       단체방에서는 방금 말한 그 사람의 상태만 바뀐다. */
    /* ── ④ 엽서를 덮고 **다음 턴에** 한 번 ──
       복귀하자마자가 아니다. 덮은 그 턴은 유저가 붙잡혔던 말이 그대로 나가고,
       그 다음에 유저가 다시 말을 걸면 그때 이 한 줄이 온다.
       조립이라 모델을 안 부른다 — originGate와 같은 층이다. 셋 중 둘째만
       쓴다: 복귀 직후에 셋을 다 쏟으면 되울림이 아니라 요약이 된다.
       도장을 못 찍으면 안 내보낸다. 내보내고 못 적으면 다음 턴에 또 온다. */
    if(!resumed&&room==="minhyun"&&loadFlash()&&!flashSaid()){
      const line=flashSayLine();
      if(line&&markFlashSaid()){
        setBusy(b=>({...b,[room]:true}));
        enqueue(room,[{sender:"minhyun",text:line}]);
        return;
      }
    }
    const lastSaid=[...prevList].reverse().find(m=>m.sender&&m.sender!=="user"&&!m.sys);
    const gate=lastSaid&&originGate(text,lastSaid.text,lastSaid.sender,profileRef.current,name);
    if(gate){
      setOriginPhase(lastSaid.sender,gate.next);
      setBusy(b=>({...b,[room]:true}));
      enqueue(room,[{sender:lastSaid.sender,text:gate.line}]);
      return;
    }
    /* 자리에 있는 동안에는 어느 자리인지 같이 보낸다. 안 보내면 마주 앉아서
       "지금 어디예요?"를 묻는다 — 화면만 바뀌고 사람은 안 바뀐 꼴이 된다. */
    const sc=sceneRef.current;
    const at=sc&&sc.room===room?sc.place:null;
    /* 어떻게 그 자리에 갔는지도 자리에 있는 내내 같이 보낸다. 첫 턴에만 보내면
       두 번째 말부터 다시 「따로 만난 자리」가 되고, 같이 온 사람이 「여기까지
       어떻게 왔어요」를 묻는다. 그래서 자리(scene)에 적어두고 자리째 딸려 보낸다. */
    /* 자리의 때가 지났으면(문 닫음·잘 시간) 그 사실을 같이 보낸다.
       인물이 이번 대답에서 마무리하고 일어서고, 답이 다 뜨면 자리가 닫힌다 */
    request(room,{mode:"chat",room,user_name:name,history,signals:buildSignals(room),
      recent_photos:recentPhotos(room),counts:roomCounts({[room]:next.length}),
      bag:bagOut(),
      /* 두 마디는 하고 나서만 건넬 수 있다. **부르기 전에** 정해서 보낸다 —
         응답 뒤에 재면 「받아요」는 화면에 뜨고 가방은 비는 일이 생긴다. */
      ...(at?{place:at,talked_enough:talkedEnough(sc,next),
        ...(sc.came?{came:sc.came}:{}),...(sceneOver(sc)?{place_over:true}:{})}:{})});
  };
  /* 선물 보내기.
     사진은 채팅창에 띄우지 않는다 — 줄글 한 줄만 남기고 반응은 인물이 알아서 한다.
     그 줄은 유저의 말이 아니라 일어난 일이므로 sys로 표시해 지문처럼 그린다.
     history에도 이 줄이 그대로 들어가서 모델이 "무엇을 받았는지" 알게 된다. */
  /* ── 한 물건은 한 사람에게만 ──
     같은 걸 둘 다에게 주면 주는 일이 고르는 일이 아니게 된다. 무엇을 줬는지가
     누구를 골랐는지가 되어야 한다. 창에서 이미 막지만 주는 길이 둘이라
     여기서도 막는다 — 한쪽만 잠그는 자물쇠는 자물쇠가 아니다. */
  const giftTaken=(char,key)=>Object.entries(giftsRef.current||{})
    .some(([c,a])=>c!==char&&(a||[]).includes(key));
  const giveGift=(char,gift,memo)=>{
    if(!char||!gift)return;
    const have=giftsRef.current[char]||[];
    if(have.includes(gift.key))return;              // 같은 걸 두 번 주지 않는다
    if(giftTaken(char,gift.key)){ setToast("one gift ♡ one person"); return }
    /* 한 사람에게 하루에 하나. 창에서 이미 막고 있지만 여기서도 막는다 —
       주는 길이 둘이면 한쪽만 잠그는 자물쇠는 자물쇠가 아니다 */
    /* 물건은 손에서 손으로 간다. 문자로는 못 준다 — 재언이 직접 말했다.
       「말로 주는 CD가 어딨어요. 지금 손에 든 거예요?」
       주는 길이 둘이면 둘 다 잠가야 한다. 창에서 이미 막고 있지만 여기서도 */
    const sc=sceneRef.current;
    if(!sc||sc.room!==char){ setToast("만나서 줘요 ♡"); return }
    if(giftedToday(char)){ setToast(`${CHARS[char].name} — one a day ♡`); return }
    const note=(memo||"").trim().slice(0,60);
    const line=`${jos(CHARS[char].name,"이/가")} ${jos(gift.name,"을/를")} 받았다`+(note?` — “${note}”`:"");
    const id="gift|"+char+"|"+gift.key+"|"+dayKey();
    localBatch(id,char,{sys:[{id:id+"#0",room:char,text:line}],
      local_ops:[{op:"stampGift",char},{op:"gift",char,key:gift.key},
        {op:"event",ev:{kind:"gift",to:char,name:gift.name}},
        {op:"toast",text:`${CHARS[char].name} — ${gift.name}`}],
      after_request:{extra:{gift:{name:gift.name,key:gift.key,note}}}});
  };

  /* ── 만나러 가서 준다 ──
     물건은 손에서 손으로 간다. 그래서 선물이 만나러 가는 이유가 된다.
     자리로 가는 것과 주는 것을 한 번에 한다 — 가서 다시 눌러 줘야 하면
     두 번 일이고, 선물을 들고 간 사람이 빈손으로 앉는 그림이 된다.
     자리 몫과 선물 몫을 둘 다 쓴다. 그만큼 값이 나가는 것이 맞다. */
  const giveGiftAt=(char,gift,memo,place)=>{
    const p=PLACE_BY[place]; if(!char||!gift||!p)return;
    if((giftsRef.current[char]||[]).includes(gift.key))return;
    if(giftTaken(char,gift.key)){ setToast("one gift ♡ one person"); return }
    if(giftedToday(char)||goneToday(place))return;
    const note=(memo||"").trim().slice(0,60);
    const since=Date.now(), id="giftat|"+char+"|"+gift.key+"|"+place+"|"+dayKey();
    localBatch(id,char,{
      sys:[{id:id+"#0",room:char,text:`${place}에 갔다`,ts:since},
        {id:id+"#1",room:char,ts:since+1,
          text:`${jos(CHARS[char].name,"이/가")} ${jos(gift.name,"을/를")} 받았다`+(note?` — “${note}”`:"")}],
      /* 하던 자리 정리 — 덮어쓰면 두고 온 것이 증발한다 */
      local_ops:[{op:"stampGift",char},{op:"stampGone",place},{op:"goneTo",place},
        {op:"gift",char,key:gift.key},{op:"event",ev:{kind:"gift",to:char,name:gift.name}},
        {op:"closeScene"},{op:"openScene",scene:{room:char,place,since}},{op:"view",room:char},
        {op:"toast",text:`${CHARS[char].name} — ${gift.name}`}],
      after_request:{extra:{place,gift:{name:gift.name,key:gift.key,note}}}});
  };

  /* 재시도: 저장해둔 payload를 최신 history로 갱신해 다시 전송 */
  const retry=room=>{
    const f=failed[room]; if(!f)return;
    /* ── 저장 실패는 모델을 다시 안 부른다 ──
       답은 이미 장부에 있다. request_id는 서버의 멱등 키가 아니라 늦은
       답을 가리는 이름표일 뿐이라, 다시 부르면 Writer·Critic·Finalizer
       값이 통째로 한 번 더 나간다. 남은 것만 이어서 한다. */
    if(f.batch){ setFailed(x=>({...x,[room]:null})); resumeBatch(f.batch); return }
    const p=f.payload; if(!p)return;
    if(p.mode==="chat")p.history=buildHistory(sinceSum(room,storeRef.current.msgs[room]||[]));
    p.recent_photos=recentPhotos(p.mode==="auto"?"health":room);
    request(room,p);
  };
  /* 시간 경과(달 버튼): 자율 대화 생성 → 관전방에 축적 */
  /* 선물이나 해금이 있으면 그 일을 적어둔다. 바로 만들지는 않는다 —
     유저가 자리를 비운 지 한 시간이 지나 다시 들어왔을 때 만든다.
     원문은 여전히 서버로 안 간다. 무슨 물건을 줬는지만 알려주고, 무슨 말이
     오갔는지는 프롬프트에서 못박아 막는다. */

  /* 유저가 아무것도 안 눌러도 생기는 사건 둘.
     ① 재언에게 사진이 다섯 장 넘게 오면 — 강현이는 그 사진을 못 본다.
        찍는 것만 봤다. 그래서 묻는 쪽이 된다.
     ② 떠날 날이 7·3·1일 남는 날 — 둘 다 알지만 이름을 먼저 안 붙인다.
     찍어만 두고 만들지는 않는다. 한 시간 뒤 아래 효과가 가져간다. */
  useEffect(()=>{
    if(!name)return;
    const done=loadEvDone();
    const mark=(key,ev)=>{ if(done.includes(key))return false;
      saveEvDone([...loadEvDone(),key]); pushAutoEvent(ev); return true };
    const m=storeRef.current.msgs||{};
    const shots=(m.jaeeon||[]).filter(x=>x.photo&&x.sender!=="user").length;
    if(shots>=PHOTO_EVENT_AT&&mark("photos",{kind:"photos",to:"jaeeon"}))return;
    /* 남은 날은 세계 시계가 센다 — 화면의 D-N과 같은 값이어야 한다.
       현실 날짜로 따로 세면 스피드 모드에서 D-7 사건이 영영 안 뜬다. */
    if(!firstTsOf(storeRef.current))return;
    const d=daysLeft(storeRef.current);
    if(DDAY_MARKS.includes(d))mark("dday:"+d,{kind:"dday",name:String(d)});
  },[name,view,store.msgs]);

  /* 강현이 「삼촌도 유저를 알고, 유저도 삼촌을 안다」를 알게 되는 순간.
     그가 방을 파고 유저를 부른다. 왜 불렀는지는 말해주지 않는다. */
  useEffect(()=>{
    if(!name||groupOn||!groupReady(store.msgs))return;
    saveGroupOn(); setGroupOn(true);
    /* 이미 말이 오간 방이면 하던 사람이라 놀랄 일이 아니다 — 창은 안 띄운다 */
    if(!(store.msgs.group||[]).length)setGroupNew(true);
  },[name,groupOn,store.msgs]);

  const autoBusy=useRef(false);
  useEffect(()=>{
    /* 목록에서도 돌고 관전방을 열 때도 돈다. 방을 열었는데 늘 같은 화면이면
       그 방은 죽은 방이다 — 유저 없이도 돌아간다는 게 이 앱의 전제인데
       정작 그 방만 유저가 뭘 해야 움직이고 있었다. */
    if(!name||(view!=="list"&&view!=="health")||autoBusy.current)return;
    /* 아직 안 푼 관전 장부가 남아 있으면 그 방은 잠겼다 — 새로 부르지
       않는다. 아직 안 뜬 말 위에 다음 장면을 얹으면 차례가 갈리고,
       이력에는 안 뜬 말이 통째로 빠진 채 다음 요청이 나간다.
       남은 것은 부팅 재개(resumeBatch)가 저장된 장부로만 잇는다. */
    if(headBatchOf("health"))return;
    (async()=>{
      /* 사건이 있으면 그 일을 두고 얘기하고, 없으면 그냥 둘이 떠든다.
         전에는 사건이 없으면 아무것도 안 만들었다 — 선물도 안 주고 자리도
         안 간 사람에게는 관전방이 영영 첫 장면 그대로였다.
         자리를 비운 시간과 하루 상한은 그대로다. 여기가 제일 비싼 호출이다. */
      const ev=peekAutoEvent();
      const m=storeRef.current.msgs||{};
      const all=Object.values(m).flat();
      const lastAny=all.reduce((a,x)=>x.ts>a?x.ts:a,(ev&&ev.created_at)||0);
      const now=Date.now();
      /* 아직 아무 일도 없었으면 비운 자리도 없다. 이걸 안 막으면 lastAny가
         0이라 「한 시간 뒤」가 1970년 1월 1일 한 시간 뒤가 된다 — 실제로
         첫 실행에서 관전 대화가 1970년으로 찍혔고, 그게 이 판의 첫 대화가
         돼서 D-0 종료 화면이 첫날에 떴다. 오프닝은 방이 다 비어야 열리는데
         그 방이 차 있으니 첫 자리도 안 열렸다.
         (파일을 가를 때 죽은 setAutoAt이 이 효과를 통째로 막고 있어서
         그동안 안 보였다. 그게 고쳐지자 드러났다.) */
      if(!lastAny)return;
      if(now-lastAny<AUTO_AWAY)return;
      // 유저가 나가고 한 시간쯤 뒤의 일로 찍는다
      const at=Math.min(lastAny+AUTO_AWAY+Math.floor(Math.random()*30*60*1000),now-5*60*1000);
      /* 그 시각에 둘 다 깨어 있었어야 한다. 재언이 자는데 「두 사람」방에서는
         떠들고 있었다 — 목록에 「자는 중」이 떠 있는 사람이 옆방에서 말을 하면
         그 점이 거짓말이 된다. 지금이 아니라 찍힐 시각(at)으로 잰다.
         하루 몫을 깎기 전에 본다 — 순서가 반대면 만들지도 못한 대화에 몫만
         나가고, 적어둔 사건(선물)까지 같이 지워진다. 전에 그렇게 잃었다. */
      if(!bothAwake(gameAt(at)))return;
      /* 하루 경계는 여기서도 새벽 다섯 시다. UTC 날짜로 세면 아침 아홉 시에
         상한이 리셋돼 한 하루에 네 번이 돈다 — 제일 비싼 호출인데 */
      const day=dayKey();
      const [d,n]=loadAutoDay().split("|");
      const used=d===day?Number(n)||0:0;
      /* 하루 몫이 찼다. **사건은 안 지운다** — 유저가 한 일이 없던 일이 되면
         안 된다. 내일 그 얘기가 나온다. */
      if(used>=AUTO_MAX_DAY)return;
      autoBusy.current=true;
      saveAutoDay(`${day}|${used+1}`);
      /* setAutoAt은 여기 없다 — 방 목록 안의 상태다. 한 파일이던 앱을 넷으로
         가를 때(f35bcf6) 이 줄만 따라오지 못했고, 그 뒤로 이 효과는 매번
         ReferenceError로 죽었다. 조용히 죽었다 — async 안이라 화면에는
         아무 일도 안 일어나고, autoBusy가 참인 채로 굳어 그 세션 내내 관전방이
         멈췄다. 게다가 죽기 전에 사건(선물)과 하루 몫을 이미 지워서, 없던
         일이 되는 쪽은 유저가 한 일이었다.
         쿨타임 표시는 저장값으로 충분하다 — 목록은 열 때 loadAutoAt으로 읽는다. */
      saveAutoAt(now);
      const done=await runAutoEvent(ev,at);
      autoBusy.current=false;
      /* 실패하면 사건이 줄에 그대로 남는다. 다음에 다시 시도한다 */
      if(!done)return;
      /* 관전도 창이 있다. 굴려두지 않으면 지난 관전 대화가 그냥 사라진다 */
      setTimeout(()=>rollSummary("health"),1200);
    })();
  },[name,view]);

  /* ── 관전 사건 턴 하나 — 응답 전부가 한 장부로 간다 ──
     전에는 data.messages만 꺼내고 data.effects를 버렸다. 서버가 만든
     택배에서 대사만 꺼내고 송장(공개 Effect)을 버리는 짓이라, 소유자가
     출처를 밝혀도 null_disclosed가 영영 안 갱신됐다. 이제 말풍선·Effect·
     사건 소모가 한 장부(localBatch)에 실린다 — finishBatch가 말풍선(①)을
     남긴 뒤에야 Effect(②)를 적용하고, 그 둘이 다 확인된 뒤에만(⑧) 사건을
     지운다. 어느 저장이 실패하면 장부와 사건이 남아 그 방이 잠기고,
     **API 재호출 없이** 남은 것만 이어서 한다. */
  const runAutoEvent=async(ev,at)=>{
    let data=null;
    /* 고른 데모(?demo=1)만 각본이다. 실패해서 넘어가는 길은 이제 없다. */
    if(DEMO.on){ data={messages:demoReply("health",null,name,storeRef.current.msgs)}; }
    else{
      try{
        const res=await fetch(apiUrl(),{method:"POST",headers:{"Content-Type":"application/json"},
          /* 관전방도 방 이름을 싣는다. 안 실으면 워커에서 minhyun으로
             떨어져 관전이 강현 1:1 방으로 처리된다 */
          body:JSON.stringify({mode:"auto",room:"health",user_name:name,counts:roomCounts(),
            /* 요약이 들고 있는 데까지는 빼고 보낸다. 안 빼면 요약과 원문이
               같은 얘기를 두 번 싣는다 */
            history:buildHistory(sinceSum("health",storeRef.current.msgs.health||[])),
            ...(loadSum("health").text?{summary:loadSum("health").text}:{}),
            signals:buildSignals(null),
            /* 준 기록도 싣는다 — 선물 관측 사건(§8.5)은 워커가 이걸로
               출처·보유 사실을 만들어 비대칭을 판정한다. 안 실으면
               발견 장면이 영영 못 선다. request()의 888줄과 같은 원본이다. */
            gifts:giftsRef.current||{},
            disclosed:loadDisclosed(),
            ...(ev&&ev.kind?{event:{kind:ev.kind,to:ev.to,name:ev.name}}:{})})});
        const body=await res.json().catch(()=>null);
        if(res.ok&&body)data=body;
      }catch(e){ /* 유저가 부른 적 없는 호출이라 실패를 알릴 이유가 없다 */ }
    }
    const list=data&&data.messages;
    if(!list||!list.length)return false;
    /* id를 뽑기로 만들지 않는다 — 둘째 말풍선 저장이 실패하고 다음에 다시
       만들면, 랜덤 id라 첫째가 한 번 더 붙는다. 사건에 매단 결정적 id면
       남은 것만 정확히 한 번 더 붙는다. */
    const evid=(ev&&ev.id)||("at|"+at);
    const sys=[]; let t=at;
    list.forEach((x,i)=>{
      if(!x)return;
      const photo=photoSrc(x.photo)?x.photo:null;
      const text=(x.text||"").trim();
      if(!text&&!photo)return;
      sys.push({id:`auto:${evid}#${i}`,room:"health",sender:x.sender||"health",
        sys:false,text,...(photo?{photo}:{}),ts:t});
      t+=40000+Math.floor(Math.random()*80000);
    });
    if(!sys.length)return false;
    /* 말풍선·Effect가 다 남은 뒤에만 **그 사건만** 지운다 */
    return !!localBatch("auto|"+evid,"health",{sys,
      effects:(data&&Array.isArray(data.effects))?data.effects:[],
      auto_event_id:(ev&&ev.id)||""});
  };

  const doAuto=async()=>{
    if(autoLoading)return;
    /* 이쪽은 지금 벌어지는 일로 찍힌다. 한 사람이라도 자고 있으면 만들 대화가
       없다 — 부르지도 않는다. 눌렀는데 아무 일이 없으면 고장으로 보이니 한 줄 띄운다 */
    if(!bothAwake()){
      /* 조건은 bothAwake — 한 명만 자도 막힌다. 그런데 말은 「둘 다 자요」였다.
         새벽 두 시엔 재언만 자고 강현은 세 시까지 깨 있는데, 목록에 「안 자는
         중」이라고 떠 있는 사람을 두고 둘 다 잔다고 하면 그 점이 거짓말이 된다.
         누가 자는지 그대로 말한다. */
      const zz=["jaeeon","minhyun"].filter(id=>asleep(id));
      setToast(zz.length>1?"지금은 둘 다 자요 ♡"
        :`지금은 ${jos(CHARS[zz[0]].name,"이/가")} 자요 ♡`);
      return }
    setAutoLoading(true);
    await request("health",{mode:"auto",room:"health",user_name:name,
      history:buildHistory(sinceSum("health",storeRef.current.msgs.health||[])),
      signals:buildSignals(null),recent_photos:recentPhotos("health")});
    setAutoLoading(false);
  };

  /* [편집] 대화 저장: 전체 방 → .txt 다운로드 */
  const exportTxt=()=>{
    const lines=["NULL — 대화 기록","내보낸 시각: "+gameAt(Date.now()).toLocaleString("ko-KR"),""];
    /* 고친 말을 맨 앞에 싣는다. 뒤에 붙이면 천 줄을 스크롤해야 보인다 —
       이 파일을 여는 이유가 그것일 때가 많다. 원문(✕)과 고친 말(○)을
       짝으로 적는다: 그 짝이 그대로 대화 예시가 된다. */
    const es=editsRef.current;
    if(es.length){
      lines.push(`──── 고친 말 ${es.length}개 ────`,"");
      es.forEach((e,i)=>{
        const rm=(ROOMS.find(r=>r.id===e.room)||{}).name||e.room;
        lines.push(`[${i+1}] ${rm} · ${fmtDivider(e.ts)}`);
        (e.before||[]).forEach(b=>lines.push(`    ${b.who} ${b.text}`));
        if(e.was){ lines.push(`  ✕ ${e.was}`,`  ○ ${e.now}`); }
        else lines.push(`  → ${e.now}`);
        lines.push("");
      });
      lines.push("");
    }
    ROOMS.forEach(r=>{
      const ms=storeRef.current.msgs[r.id]||[];if(!ms.length)return;
      lines.push("──── "+r.name+" ────");
      ms.forEach(m=>{
        /* 지문에는 말한 사람이 없다. 「이강현이 이어폰을 받았다」는 아무도
           한 말이 아닌데, 내보낸 파일에서는 유저 이름이 붙어서 유저가 자기
           얘기를 삼인칭으로 한 것처럼 찍혔다. 화면에서는 지문으로 뜨는데
           파일에서만 말이 됐다 — 화면과 파일이 다른 이야기를 하면 안 된다. */
        if(m.sys){ lines.push(`[${fmtDivider(m.ts)}] · ${m.text||""}`); return }
        const who=m.sender==="user"?name:(CHARS[m.sender]?CHARS[m.sender].name:m.sender);
        lines.push(`[${fmtDivider(m.ts)}] ${who}: ${m.photo?"(사진) ":""}${m.text||""}`);
      });
      lines.push("");
    });
    const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="NULL-대화기록.txt";a.click();
    URL.revokeObjectURL(a.href);
  };
  /* [대화] 읽음 처리 */
  const readAll=()=>setStore(s=>({...s,unread:{}}));
  /* [당신] 이름 변경 / 새로 시작 */
  const rename=n=>{localStorage.setItem("null_name",n);setName(n)};
  /* 다시 시작. greetAtRef까지 같이 지운다 — 이건 리액트 ref라 localStorage를
     지워도 안 없어진다. 방금 선톡을 받고 지웠으면 1분 동안 첫 인사가 안 왔다.
     처음 들어온 화면에서 아무도 말을 안 거는 게 제일 나쁜 그림이다. */
  /* 저장소를 비우고 다시 연다.
     전에는 지울 것을 하나씩 손으로 적었다. 저장소에서 읽어오는 상태가 열 개인데
     여섯 개만 적혀 있었고, 그래서 지우고 나서도 가방·다녀온 자리·있던 자리가
     화면에 남아 있었다. 저장소는 비었는데 화면은 안 비었으니 다음에 뭔가
     저장되는 순간 지운 것이 도로 써졌다.
     빠뜨리기 쉬운 목록을 고치는 대신 목록을 없앤다 — 다시 열면 열 개가 전부
     빈 저장소에서 읽힌다. 앞으로 상태를 더 만들어도 여기 적을 것이 없다.
     ?demo=1 같은 건 주소에 있어서 다시 열어도 그대로다. */
  const reset=()=>{try{localStorage.setItem("null_wipe","1")}catch(e){};location.reload()};

  /* 캐릭터가 먼저 건다. 방을 열었는데 아무 말도 없으면 그건 메신저가 아니라
     빈 상자다. 처음 들어왔거나 한참 만에 들어왔을 때만 한 번 — 들어올 때마다
     말을 걸면 사람이 아니라 알림이 된다.

     첫인사(기록 없는 방)는 문구집 각본이다 — 세계관이 열리는 자리라 문장을
     고정한다. 그 뒤의 선톡은 모델이 쓴다. 각본 스무 개를 돌 때는 아침이든
     새벽이든 같은 스무 개였다 — 낮에는 「수업 중이겠네요」, 저녁에는 「퇴근
     잘했어요?」, 새벽에는 「아직 안 자나 봐요」가 나와야 한다. 때와 자기
     상태는 가변부의 [지금]이 이미 알고 있으니, 먼저 걸라는 지시 한 줄만
     얹으면 모델이 알아서 한다.
     하루 상한이나 제비뽑기는 안 둔다 — 두어 봤는데, 올 때마다 같은 말이
     오는 게 문제였지 오는 것 자체가 문제가 아니었다. 시간마다 다른 말이
     오면 그건 알림이 아니라 안부다. 세 시간 간격은 그대로다.
     데모는 각본을 그대로 쓴다 — 부를 모델이 없다. */
  /* 「왔어요」는 금지다. 유저가 방금 접속한 것을 인물은 모른다 — 알면
     인사가 아니라 감시 카메라다. 이 선톡은 조용한 방에 대고 보내는 말이다. */
  const GREET_ASK="(유저는 한동안 말이 없다. 지금이 언제인지와 네 상황에 맞춰 네가 먼저 한두 마디를 건다 — 안부든, 지금 하고 있는 것이든. 유저가 방금 접속했는지 너는 모른다. 「왔어요」처럼 상대가 온 걸 아는 말은 하지 않는다.)";
  const greet=(id,delay)=>{
    if(id==="health"||id==="group")return;
    /* 거는 길이 둘이다 — 목록에 앉아 있을 때, 그리고 방을 열 때.
       한쪽만 잠그면 새벽에 재언 방을 열었을 때 그가 깨어난다 */
    if(!canGreet(id))return;
    /* 아직 만나지 않은 사람은 학교에 있을 때만 먼저 건다 */
    if(roomLock(storeRef.current,id))return;
    /* 같이 있는 사람은 선톡을 안 한다 — 눈앞에 있는데 문자가 오면 이상하다 */
    if(sceneRef.current&&sceneRef.current.room===id)return;
    const list=storeRef.current.msgs[id]||[];
    /* ── 재언의 첫 마디는 유저의 옛 일기 뒤다 ──
       선톡은 두 길로 나간다 — 방을 열 때, 그리고 목록에 앉아 있을 때의 추첨.
       방 여는 쪽만 막으면 추첨이 먼저 걸려서, 유저가 그의 첫 마디를 읽은 뒤에
       일기가 뜬다. 순서가 뒤집힌다.
       **첫 마디만** 잡는다. 이미 말이 오간 방은 평소대로 걸린다 — 일기는
       그를 처음 만나는 자리를 짓는 것이지 대화를 멈추는 장치가 아니다. */
    if(id==="jaeeon"&&!list.length&&!loadDiary())return;
    /* 빈 방의 첫 연락은 그 사람이 **학교에서** 거는 것이다(roomLock이 그
       시간에만 열어준다). 그 순간부터 교생인 걸 안다. */
    if(!list.length&&atWorkNow(id))markSchoolMet(id);
    const gapMin=list.length?Math.round((Date.now()-list[list.length-1].ts)/60000):-1;
    if(gapMin>=0&&gapMin<180)return;
    /* ── 첫 연락은 딱 한 번 ──
       빈 방의 첫인사는 각본이고(모델을 안 부른다) 정해진 세 줄이다.
       강현은 「선생님. / 저 알죠? / 선생님이 저 책임진다면서요.」로 연다.
       방을 700밀리초 안에 두 번 열면 두 번 나갔다 — 아직 저장되기 전이라
       두 번째가 봐도 방이 비어 있다. 보내기 전에 표를 찍는다. */
    if(gapMin<0&&!markOnce("first:"+id))return;
    /* 시간표를 아는 선톡 — 모델이 쓴다. 지시는 이력 끝에만 얹고 저장은
       안 한다. 답장만 남는 게 맞다 — 지시가 기록에 남으면 다음 턴부터
       그 지시까지 대화가 된다.
       greet:true 표시의 몫 셋 — ① 워커가 이 턴에는 이력 캐시 지점을 안
       찍는다(저장 안 되는 턴이라 그 캐시는 영영 안 읽힌다), ② 실패하면
       지시문을 유저 말로 알아듣는 데모 대신 각본 선톡으로 폴백한다,
       ③ 답이 오기 전에 그 사람 자리에 들어갔으면 답을 버린다.
       두 경로(방 열기·목록 추첨)가 서로를 못 봐 이중으로 나가던 것은
       inflight와 greetAtRef를 같이 보는 걸로 막는다. */
    if(gapMin>=0&&!demoOn()){
      if(inflightRef.current[id])return;
      greetAtRef.current=Date.now();
      const ms=storeRef.current.msgs[id]||[];
      request(id,{mode:"chat",room:id,user_name:name,greet:true,
        history:[...buildHistory(sinceSum(id,ms)),{role:"user",content:GREET_ASK}],
        signals:buildSignals(id),recent_photos:recentPhotos(id),counts:roomCounts(),
        bag:bagOut()});
      return;
    }
    setTimeout(()=>{
      try{
        const lines=demoProactive(id,demoGreetWhen(gapMin,id),name);
        if(lines.length)enqueue(id,lines);
      }catch(e){ console.error("%c[NULL] 선톡 실패 ▶ "+(e&&e.message||e),"color:#c23b50"); }
    },delay||0);
  };
  /* ── 「두 사람」 방의 첫 장면 ──
     처음 열었는데 비어 있으면 이 방이 무슨 방인지 알 길이 없다. 유저는 저 둘이
     삼촌과 조카라는 것도 못 듣는다. 화면에 「삼촌과 조카」라고 적어주는 건
     설명이지 이야기가 아니라서, 둘이 떠드는 걸 한 번 보여주는 쪽으로 한다 —
     첫 줄이 「삼촌,」으로 시작하고 같이 나갈 준비를 하고 있다. 그거면 안다.

     사건이 있어야 도는 자동 생성과는 별개다. 그건 유저가 자리를 비운 사이의
     일이고, 이건 방을 처음 여는 순간의 일이다. */
  const seedWatch=()=>{
    if((storeRef.current.msgs.health||[]).length)return;
    if(!markOnce("watch:open"))return;   // 빨리 두 번 열면 두 번 깔렸다
    try{
      const lines=demoWatchOpen(name);
      if(lines.length)setTimeout(()=>enqueue("health",lines),450);
    }catch(e){ console.error("%c[NULL] 첫 장면 실패 ▶ "+(e&&e.message||e),"color:#c23b50"); }
  };
  /* 잠긴 방은 열어도 말이 안 온다. 여기를 안 막았더니 방을 여는 순간
     선톡이 걸려서, 「아직 출근하지 않았어요」 위에 타이핑 표시가 떴다. */
  /* ── 유저의 옛 일기 ──
     재언 방에 처음 들어가는 순간, **선톡 앞에** 한 번. 선톡을 먼저 걸면
     말이 도착한 방 위에 종이가 덮여서, 첫 마디를 못 읽은 채로 일기를 읽게
     된다. 그래서 여기서 갈라진다 — 일기를 덮은 뒤에 선톡이 걸린다.

     잠긴 방(아직 안 만난 사람)에는 안 띄운다. 자리(오프닝)에서 시작한 판은
     openRoom을 안 거치므로 그 장면을 덮지도 않는다 — 목록에서 방으로 들어올
     때 처음 뜬다. 채운 값은 브라우저 안에만 산다. */
  const [diary,setDiary]=useState(false);
  const diaryAfterRef=useRef(null);
  const openRoom=id=>{setView(id);setStore(s=>({...s,unread:{...s.unread,[id]:0}}));
    if(id==="health")return seedWatch();
    if(roomLock(storeRef.current,id))return;
    if(id==="jaeeon"&&!loadDiary()){
      diaryAfterRef.current=null;
      return setDiary(true);
    }
    greet(id,700)};
  /* 방에서 연 일기는 선톡으로, 편의점에서 연 일기는 첫 만남 장면으로 잇는다. */
  const diaryDone=()=>{
    setDiary(false);
    const after=diaryAfterRef.current;
    diaryAfterRef.current=null;
    if(after)return after();
    greet("jaeeon",700);
  };
  /* ── 강현의 옛 일기 — 병원 옥상 ──
     오프닝에서 강현을 만난 판에서만, 「저 알죠」 세 줄이 다 앉은 뒤 유저가
     처음 무언가를 입력한 그 순간에 한 번. 유저의 말은 그대로 올라가고,
     엽서가 그 위로 뜬다 — 삼키면 유저가 방금 친 말이 어디로 갔는지 모른다.
     엽서를 덮은 뒤에 그 말이 나간다. */
  const [flash,setFlash]=useState(null);   // null | {room,text}
  const [kiss,setKiss]=useState(null);     // null | 사진 key (⑨)
  /* ⑩ 지금의 일기 — null | MY_DIARY의 한 장.
     스스로 안 뜬다. file 메뉴에서 유저가 열 때만 선다 — 매일 물으면 일과가
     되고 일과가 되면 안 쓴다. 쓴 값은 여기 브라우저 밖으로 안 나간다. */
  const [myDiary,setMyDiary]=useState(null);
  const myDiaryDone=()=>setMyDiary(null);
  /* 실습 남은 날. 첫 대화한 날을 D-30으로 잡고 하루씩 깎는다.
     방 목록(RoomList)이 세는 것과 같은 식이다 — 둘이 어긋나면 같은 화면에서
     다른 날짜가 뜬다. */
  const dLeft=daysLeft(store);
  const dayN=daysSince(store);
  /* 떠난 뒤에 유저가 다시 말을 걸었나. 프로필만 열면 작별 인사고,
     한 마디 하면 재회다. 새로 저장할 상태가 없다. */
  const cameBack=cameBackOf(store);
  /* ── D-0 · 계속 살아갈지 ──
     이름이 다 불렸을 때만 y가 눌린다. 빈칸이 남았다는 건 여기 단 한 사람도
     끝까지 부를 사람이 없었다는 말이다 — 그럼 계속 있을 이유도 없다. */
  const dSpan=ENROLL_DAYS+loadExtend();
  const calls=countCalls(store,name);
  const lit=filledLetters(calls,name);
  const nameFull=!!name&&lit>=name.length;
  const [ddayAns,setDdayAns]=useState(()=>{try{return localStorage.getItem("null_dday_ans")||""}catch(e){return""}});
  const [ddayHide,setDdayHide]=useState(false);
  /* 첫날의 통보. 스무 시간이 지난 뒤 처음 여는 순간에 한 번만.
     떠나는 날(dLeft 0)에는 안 띄운다 — 그때는 d-0.exe가 할 말이 따로 있다. */
  const [sys1,setSys1]=useState(false);
  useEffect(()=>{
    if(!name||loadSys1())return;
    /* 세계 시각으로 잰다 — 현실로 재면 스피드 모드의 첫날은 현실 여섯
       시간인데 통보는 스무 시간 뒤에 와서 나흘째에 도착한다 */
    if(!sys1Due(store))return;
    if(dLeft<=0)return;
    saveSys1(); setSys1(true);
  },[name,store,dLeft]);

  /* 연장은 한 번뿐이다. 추가 30일이 끝나면 WHO도 연장도 다시 안 묻는다 —
     세계를 지우지 않고 자유대화로 계속된다. */
  const askDday=dLeft===0&&!!name&&ddayAns!==String(dSpan)&&!loadExtend();
  const [whoAsk,setWhoAsk]=useState(false);     // STAY 뒤 — 누구 곁에 남나
  const [whoDone,setWhoDone]=useState(null);    // 방금 정해진 상대. 결과 카피 한 번
  const answerDday=yes=>{
    /* STAY는 아직 답이 아니다 — WHO까지 골라야 이 날의 답이 찍힌다.
       중간에 닫으면 d-0.exe가 다시 뜬다. */
    if(yes){ setWhoAsk(true); return }
    try{localStorage.setItem("null_dday_ans",String(dSpan))}catch(e){}
    setDdayAns(String(dSpan));
    /* 떠나기로 한 것도 되돌릴 수 없는 자리다 */
    markScene("jaeeon","dday_choice"); markScene("minhyun","dday_choice");
    setToast("left 4 real ✧");
  };
  const pickWho=id=>{
    if(loadPartner())return;                    // 한 번 정해지면 무를 수 없다
    try{localStorage.setItem("null_dday_ans",String(dSpan))}catch(e){}
    setDdayAns(String(dSpan));
    try{localStorage.setItem("null_extend",String(loadExtend()+ENROLL_DAYS))}catch(e){}
    const got=savePartner(id);
    /* 두 사람 다 이 일을 안다. 고른 쪽에는 정해진 직후의 첫 반응이고,
       안 고른 쪽에는 그 사실을 처음 아는 자리다 — 같은 사건이지만 다른
       장면이라 사유도 다르다. 각자 방의 다음 한 마디에 한 번만 실린다. */
    const other=(got||id)==="jaeeon"?"minhyun":"jaeeon";
    markScene(got||id,"partner_confirm");
    markScene(other,"partner_known");
    /* 관전방은 예약하지 않는다 — 워커가 auto를 무조건 일반 경로로 내리므로
       이 예약은 영영 안 쓰이는 죽은 배선이었다. 관전은 항상 일반 경로다. */
    setWhoAsk(false); setWhoDone(got||id);
  };

  /* 프로필 화면. 대화 수는 그 캐릭터가 낀 모든 방을 합쳐 센다 (worker의 단계 기준과 같다) */
  const [prof,setProf]=useState(null);
  /* 프로필이 바뀐 걸 목록이 알린다. 열어보면 그 단계를 본 것으로 찍고 표시가 꺼진다.
     방을 여는 걸로는 안 꺼진다 — 바뀐 건 대화가 아니라 프로필이니까. */
  const [seenStage,setSeenStage]=useState(loadSeenStage);
  const openProfile=id=>{
    setProf(id);
    if(!CHARS[id])return;
    const at=stageIdx((roomCounts()[id])||0,daysSince(storeRef.current));
    setSeenStage(s=>{const n={...s,[id]:at};saveSeenStage(n);return n});
  };
  const profCount=id=>{
    const s=storeRef.current.msgs||{};
    return (s[id]||[]).length+(s.group||[]).filter(m=>m.sender===id||m.sender==="user").length;
  };
  /* 이름을 넣으면 등록 → 세계 확정(YES)이 한 번 지나간다.
     enrolling은 단계다: false | "intro" | "enroll" | "confirm".
     intro는 배역을 받는 자리다 — 이름을 친 직후 한 번. 다시 열면 안 뜬다
     (등록만 하고 닫은 사람은 이미 봤다). 세계는 여전히 YES에서 생긴다.
     이름이 저장돼 있어도 YES를 안 눌렀으면(loadWorld가 거짓) 메신저로
     건너뛰지 않는다 — 등록만 하고 닫은 사람은 아직 시작 전이다. */
  const [enrolling,setEnrolling]=useState(()=>{
    try{
      return localStorage.getItem("null_name")&&!loadWorld()?"enroll":false
    }catch(e){return false}
  });
  const enter=n=>{localStorage.setItem("null_name",n);setName(n);setEnrolling("intro")};
  /* YES — 세계가 생기는 순간. 프로필이 잠기고 나이는 세계 고정값 25가 된다.
     saveWorld는 멱등이라 연타·재렌더가 와도 시작은 한 번이다. */
  const confirmYes=()=>{
    saveWorld();
    setProfile(p=>({...p,age:"25"}));
    setEnrolling(false);
  };

  /* 선톡은 방을 열어야 오는 게 아니다. 안 보고 있을 때 오는 것이 메신저다 —
     목록에 있는 동안 말이 도착하고 안 읽음이 붙는다. appendMsg가 지금 보고
     있는 방이 아니면 알아서 세어준다.

     한 번에 한 사람만 건다. 두 사람이 같은 초에 말을 걸면 그건 사람이 아니라
     알림이다. 제일 오래 조용했던 쪽이 먼저 건다.

     방을 열 때(demoGreet)와 조건이 같아서 둘이 겹치지 않는다 — 한쪽이
     말을 걸면 간격이 0이 되므로 다른 쪽은 안 걸린다. 목록을 떠나면 예약도
     같이 취소된다. */
  /* ── 첫 자리 ──
     한 마디도 오간 적이 없으면 인사로 시작하지 않는다. 자리에서 시작한다.
     시작한 시각이 어디인지를 정하고, 거기 있는 사람을 만난다.
     다른 한 사람은 평소대로 첫인사를 보낸다 — 아래 선톡 고리가 알아서 한다.
     새벽에 시작하면 재언은 여섯 시까지 조용하다(canGreet). 그래서 새벽에
     켠 사람은 강현하고만 하루를 연다.

     한 번만 돈다. 표식을 남기는 게 아니라 「아무 방에도 한 마디도 없다」를
     조건으로 쓴다 — 리스타트하면 저절로 다시 열린다. */
  const openedRef=useRef(false);
  /* 마지막으로 말을 건 시각. 첫 자리와 아래 추첨이 같이 본다 */
  const greetAtRef=useRef(0);
  useEffect(()=>{
    if(!name||enrolling||openedRef.current)return;
    if(["jaeeon","minhyun","group","health"].some(r=>(storeRef.current.msgs[r]||[]).length))return;
    openedRef.current=true;
    const o=openingFor();
    const sys={id:Date.now()+Math.random(),sender:"user",sys:true,text:o.note,ts:Date.now()};
    appendMsg(o.room,sys);
    /* 지도 자리면 다녀온 걸로 친다. 도장도 같이 찍는다 — goneTo만 부르던
       때는 해금 목록에만 들어가고 오늘 도장이 안 찍혔다. 빨래방에서 시작한
       날 지도의 빨래방이 그대로 열려 있어서 같은 날 한 번 더 갈 수 있었다.
       시작한 자리도 다녀온 자리다. 하루에 한 번은 여기에도 걸린다. */
    if(PLACE_BY[o.place])localBatch("open|"+o.place,o.room,
      {local_ops:[{op:"goneTo",place:o.place},{op:"stampGone",place:o.place}]});
    /* 첫 자리가 학교 안(보건실)이면 거기서 교생인 걸 안다. 밖이면 모른다 */
    if(isSchoolPlace(o.place))markSchoolMet(o.room);
    /* 세계가 시작된 자리에 있던 쪽. 편의점이 이 값을 보고 안 만난 쪽을 세운다 */
    saveFirstMet(o.room);
    const sc={room:o.room,place:o.place,since:Date.now(),
      ...(!loadGetcha(o.room)?{firstEncounter:true}:{}),...(o.bg?{bg:o.bg}:{})};
    setScene(sc); saveScene(sc); setView(o.room);
    /* ── 첫 마디는 정해져 있다 ──
       전에는 여기서 모델을 불렀다. 그런데 모델에게는 기록이 하나도 없으니
       아무 날의 아무 말처럼 나왔다 — 서로 처음 보는 자리인 걸 모르는 채로.
       게다가 그 방은 이제 비어 있지 않으니, 「도착 선톡 · 첫 만남」의 정해진
       첫 마디가 그날 영영 안 나온다. 그 사람의 첫 마디를 자리가 삼킨 것이다.
       자리마다 첫 마디를 문구집에 따로 정해뒀다. 모델은 안 부른다 —
       두 번째 말부터가 모델 몫이다. */
    setBusy(b=>({...b,[o.room]:true}));
    /* 첫 마디가 다 앉은 뒤에 창을 띄운다. 말하는 중에 덮으면 그 자리를
       못 읽는다 — 아래 useEffect가 busy를 보고 있다가 연다. */
    const first=demoProactive(o.room,o.place,name);
    if(!loadGetcha(o.room))getchaRef.current=o.room;
    if(first.length)setTimeout(()=>enqueue(o.room,first),700);
    else setBusy(b=>({...b,[o.room]:false}));
    /* 다른 한 사람은 첫인사를 보낸다. 여기서 직접 건다 — 아래 선톡 추첨에
       맡기면 자리 쪽 상태가 아직 화면에 안 앉아서 두 방이 다 비어 보이고,
       자리에서 만난 사람이 뽑혀 조용히 삼켜진다. 게다가 그 추첨은 view가
       바뀌면 정리와 함께 예약까지 취소돼서, 자리로 넘어가는 순간 죽는다.
       새벽이면 재언은 안 온다 — 여섯 시에 온다(canGreet). */
    /* ── 안 만난 사람은 학교에 있을 때만 온다 ──
       전에는 여기서 무조건 걸었다. 첫 자리에서 강현을 만났는데 삼 초 뒤에
       재언이 먼저 말을 걸었다 — 만난 적도 없는 사람한테서, 번호가 어디서
       났는지 설명 없이. 그 사람은 학교에서 만나야 하므로 출근해서 퇴근
       전까지(야자 포함)가 아니면 안 건다. 그 시간이 오면 아래 선톡 추첨이
       데려온다(그때 첫 마디는 「첫 만남」이다). */
    const other=o.room==="jaeeon"?"minhyun":"jaeeon";
    if(canGreet(other)&&!roomLock(storeRef.current,other)){
      greetAtRef.current=Date.now();               // 추첨은 일 분간 조용히
      setTimeout(()=>greet(other,0),2600+Math.random()*2600);
    }
  },[name,enrolling]);


  useEffect(()=>{
    if(!name||view!=="list"||enrolling)return;
    if(Date.now()-greetAtRef.current<60000)return;   // 목록을 들락거려도 연달아 오지 않게
    /* 자는 쪽은 후보에서 먼저 뺀다. 뽑고 나서 막으면 그 판은 아무도 안 건다 —
       새벽에는 제일 오래 조용한 쪽이 늘 재언이라, 강현이 영영 안 걸린다 */
    const cand=["jaeeon","minhyun"]
      .filter(id=>canGreet(id)&&!roomLock(storeRef.current,id)).map(id=>{
      const l=storeRef.current.msgs[id]||[];
      return {id,gap:l.length?(Date.now()-l[l.length-1].ts)/60000:-1};
    }).filter(c=>c.gap<0||c.gap>=180)
      .sort((a,b)=>(b.gap<0?1e9:b.gap)-(a.gap<0?1e9:a.gap))[0];
    if(!cand)return;
    greetAtRef.current=Date.now();
    let live=true;
    const t=setTimeout(()=>{ if(live)greet(cand.id,0); },1600+Math.random()*2600);
    return()=>{live=false;clearTimeout(t)};
  },[name,view,enrolling]);

  return <GameScreen game={{answerAsk,answerDday,answerInvite,answerLeave,answerMove,answerWay,ask,askDday,askWho,autoLoading,bag,busy,cameBack,cart,confirmYes,dLeft,dayN,ddayHide,diary,diaryDone,myDiary,setMyDiary,myDiaryDone,doAuto,editLine,edits,enrolling,enter,exportTxt,failed,flash,getcha,gifts,giveEnergyBar,giveGift,giveGiftAt,groupNew,groupOn,guessHidden,invite,kiss,leaveScene,leaving,lit,look,met,mode,name,nameFull,openAsk,openProfile,openRoom,pickWho,plate,prof,profCount,profile,readAll,rename,reset,retry,roomCounts,scene,seenStage,send,setAsk,setAskWho,setCart,setDdayHide,setEnrolling,setFlash,setGetcha,setGroupNew,setKiss,setLook,setMode,setPlate,setProf,setProfile,setSys1,setToast,setView,setWhoAsk,setWhoDone,store,sys1,toast,unlocked,view,way,whoAsk,whoDone}}/>;
}
