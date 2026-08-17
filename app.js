/* NULL — 앱.
   상태를 들고 있는 곳. 저장소를 읽고, 워커를 부르고, 화면을 고른다.
   app-data.js·app-ui.js 다음에 실려야 한다. */
/* ── 앱 ── */
function App(){
  const [name,setName]=useState(()=>localStorage.getItem("null_name")||"");
  const [profile,setProfile]=useState(loadProfile);
  const [store,setStore]=useState(loadStore);
  const [unlocked,setUnlocked]=useState(loadUnlocked);
  const [gifts,setGifts]=useState(loadGifts);   // {jaeeon:["mug"], ...} 누구에게 뭘 줬나
  const [toast,setToast]=useState(null);            // 해금 알림
  const [view,setView]=useState("list");            // 'list' | roomId
  const [busy,setBusy]=useState({});                // 방별 타이핑 인디케이터
  const [failed,setFailed]=useState({});            // 방별 실패 payload (재시도용)
  const [autoLoading,setAutoLoading]=useState(false);
  const viewRef=useRef(view); viewRef.current=view;
  const storeRef=useRef(store); storeRef.current=store;
  const profileRef=useRef(profile); profileRef.current=profile;
  const unlockedRef=useRef(unlocked); unlockedRef.current=unlocked;
  const giftsRef=useRef(gifts); giftsRef.current=gifts;
  const queueRef=useRef([]);                        // 순차 표시 대기열
  const runningRef=useRef(false);
  const inflightRef=useRef({});
  useEffect(()=>{saveStore(store)},[store]);

  useEffect(()=>{try{localStorage.setItem("null_profile",JSON.stringify(profile))}catch(e){}},[profile]);
  useEffect(()=>{saveUnlocked(unlocked)},[unlocked]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),2600);return()=>clearTimeout(t)},[toast]);

  /* 메시지 추가 (+현재 안 보고 있는 방이면 unread 증가) */
  const appendMsg=(room,msg)=>setStore(s=>({
    msgs:{...s.msgs,[room]:[...(s.msgs[room]||[]),msg]},
    unread:viewRef.current!==room?{...s.unread,[room]:(s.unread[room]||0)+1}:s.unread
  }));

  /* 대기열 처리: 0.6초 간격 순차 등장 */
  const pump=()=>{
    if(runningRef.current)return;
    runningRef.current=true;
    const step=()=>{
      const it=queueRef.current.shift();
      if(!it){runningRef.current=false;return}
      appendMsg(it.room,{id:Date.now()+Math.random(),sender:it.sender,text:it.text,photo:it.photo,ts:Date.now()});
      if(!queueRef.current.some(q=>q.room===it.room)&&!inflightRef.current[it.room])
        setBusy(b=>({...b,[it.room]:false}));
      setTimeout(step,600);
    };
    setTimeout(step,500); // 타이핑 인디케이터를 잠깐 보여준 뒤 첫 버블
  };
  const enqueue=(room,messages)=>{
    /* 넣을 게 하나도 없으면 여기서 타이핑 표시를 끈다.
       큐에 안 들어가면 pump가 돌지 않고, 그러면 표시가 영영 안 꺼진다 —
       데이터가 비었다고 화면이 멈추면 안 된다. */
    const before=queueRef.current.length;
    (messages||[]).forEach(m=>{
      if(!m)return;
      const photo=photoSrc(m.photo)?m.photo:null;   // 없는 파일이면 사진은 버리고 말만 남긴다
      const text=(m.text||"").trim();
      if(text||photo)queueRef.current.push({room,sender:m.sender||room,text,photo});
    });
    if(queueRef.current.length===before){ setBusy(b=>({...b,[room]:false})); return; }
    /* 그 자리에서 그 사람이 처음 입을 열면 화면이 그 사람으로 바뀐다.
       한 장면에 한 번만 — 열 번 주고받는 동안 얼굴이 계속 바뀌면 어지럽다 */
    const sc=sceneRef.current;
    if(sc&&sc.room===room&&!sc.shot){
      const shot=sceneShot(sc.place,room);
      if(shot){
        const next={...sc,shot}; setScene(next); saveScene(next);
      }
    }
    pump();
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
  const buildHistory=ms=>{
    const all=ms.map(m=>({role:m.sender==="user"?"user":"assistant",sender:m.sender,
      content:m.photo?((m.text?m.text+" ":"")+"(사진을 보냈다)"):m.text}))
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
  const [invite,setInvite]=useState(null);
  /* 지금 어느 자리에 있나. 새로고침해도 그 자리에 남아 있게 저장해 둔다 */
  const [scene,setScene]=useState(loadScene);
  /* 다녀온 자리. 지도가 열리는 유일한 근거라서 저장소에만 두면 안 된다 —
     상태로 안 들고 있으면 갔다 와도 화면이 그대로다 */
  const [met,setMet]=useState(loadMet);
  const goneTo=place=>setMet(m=>{ if(m.includes(place))return m;
    const next=[...m,place]; saveMet(next); return next; });
  const [bag,setBag]=useState(loadBag);
  const bagRef=useRef(bag); bagRef.current=bag;
  const sceneRef=useRef(scene); sceneRef.current=scene;
  /* 받은 것을 가방에 넣는다. 같은 것은 두 번 안 들어간다.
     채팅에는 지문 한 줄로 남긴다 — 유저의 말이 아니라 일어난 일이니까. */
  const takeItem=(key,from,where)=>{
    const it=ITEMS[key]; if(!it)return false;
    if(bagRef.current.some(b=>b.key===key))return false;
    const next=[...bagRef.current,{key,from,where,ts:Date.now()}];
    setBag(next); saveBag(next);
    const line=`${CHARS[from]?CHARS[from].name:from}에게 ${jos(it.name,"을/를")} 받았다`;
    appendMsg(from,{id:Date.now()+Math.random(),sender:"user",sys:true,text:line,ts:Date.now()});
    setToast(`bag — ${it.name}`);
    return true;
  };
  /* 야자 감독인 주에 하나. 사람이 준 게 아니라 시간표가 쥐여주는 것이라
     대화에 지문도 안 남고 준 사람도 없다 — 가방에서 얼굴이 안 붙는 유일한 물건 */
  const giveEnergyBar=()=>{
    if(bagRef.current.some(b=>b.key==="ebar"))return;
    const next=[...bagRef.current,{key:"ebar",ts:Date.now()}];
    setBag(next); saveBag(next); setToast("bag — 에너지바");
  };
  /* 자리에서 나온다.
     나오는데 아직 못 받았으면 여기서 넣어준다. 모델이 안 건네주고 끝내는
     턴이 있는데, 그때마다 가방이 비면 지도를 도는 이유가 사라진다.
     받는 순간을 모델에게 맡기되, 받는다는 사실까지 맡기지는 않는다. */
  /* 자리에 들어오자마자 손에 들어오면 그건 받은 게 아니라 주운 것이다.
     들렀다 바로 나오는 것만으로 여덟 개가 다 모이면 지도를 도는 일이
     심부름이 된다. 말을 두 마디는 하고 나와야 건넬 자리가 있었던 걸로 친다.
     덜 하고 나가면 그 자리는 그대로 남는다 — 다시 오면 된다. */
  const SCENE_MIN_TALK=2;
  const talkedEnough=sc=>!!sc&&(storeRef.current.msgs[sc.room]||[])
    .filter(m=>!m.sys&&m.sender==="user"&&m.ts>=(sc.since||0)).length>=SCENE_MIN_TALK;
  const closeScene=()=>{
    const sc=sceneRef.current;
    if(sc&&talkedEnough(sc)){ const p=PLACE_BY[sc.place]; if(p&&p.item)takeItem(p.item,sc.room,sc.place); }
    setScene(null); saveScene(null);
  };
  /* 밤에 자리에서 나오면 그냥 사라지는 게 아니라 데려다준다.
     유저 집을 지도에 세우지 않은 건 그게 갈 곳이 아니라 헤어지는 자리라서다 —
     여기 붙는 한 다리가 그 일을 한다. 하루에 한 번이면 충분하다.
     매번 나올 때마다 물으면 데려다주는 게 아니라 절차가 된다. */
  const [way,setWay]=useState(null);
  /* 나가기도 한 번 묻는다. 하루에 한 번뿐인 자리를 뒤로가기 한 번에 닫으면
     실수로 닫힌다 — 들어올 때 물었으니 나갈 때도 묻는 게 짝이 맞다. */
  const [leaving,setLeaving]=useState(null);
  const leaveScene=()=>{ const sc=sceneRef.current; if(sc)setLeaving(sc) };
  /* 나가면 인사를 받는다. 문을 열어주고 등을 보이는 사람은 없다 —
     지문 한 줄을 남기고, 그 줄을 보고 상대가 알아서 인사한다.
     새 프롬프트를 안 붙인다. 「보건실에서 나왔다」면 할 말이 정해져 있다. */
  const answerLeave=ok=>{
    const sc=leaving; setLeaving(null); if(!sc||!ok)return;
    closeScene();
    /* 귀갓길에서 나오는 건 나오는 게 아니라 도착하는 것이다 */
    const line=sc.place===WAY?"집에 도착했다":`${sc.place}에서 나왔다`;
    const sys={id:Date.now()+Math.random(),sender:"user",sys:true,text:line,ts:Date.now()};
    appendMsg(sc.room,sys);
    const next=[...(storeRef.current.msgs[sc.room]||[]),sys];
    request(sc.room,{mode:"chat",room:sc.room,user_name:name,
      history:buildHistory(sinceSum(sc.room,next)),signals:buildSignals(sc.room),
      recent_photos:recentPhotos(sc.room),counts:roomCounts({[sc.room]:next.length})});
    /* 나온 뒤에 밤이면 데려다준다. 인사와 겹치지 않게 창을 이어서 띄운다 */
    if(sc.place!==WAY&&talkedEnough(sc)&&wayOK()&&loadWay()!==dayKey())setWay(sc);
  };
  const answerWay=ok=>{
    const sc=way; setWay(null); if(!sc)return;
    closeScene();                       // 그 자리는 여기서 끝난다 — 두고 나온 것도 챙긴다
    if(!ok)return;
    saveWay(dayKey());
    const who=sc.room, nm=CHARS[who].name;
    const line=who==="jaeeon"?`${nm}의 차를 타고 집에 가는 길이다`:`${nm}과 같이 버스를 타고 집에 가는 길이다`;
    const sys={id:Date.now()+Math.random(),sender:"user",sys:true,text:line,ts:Date.now()};
    appendMsg(who,sys);
    const next2={room:who,place:WAY,since:Date.now(),bg:WAY_BG[who]};
    setScene(next2); saveScene(next2); setView(who);
    const next=[...(storeRef.current.msgs[who]||[]),sys];
    request(who,{mode:"chat",room:who,user_name:name,
      history:buildHistory(sinceSum(who,next)),signals:buildSignals(who),
      recent_photos:recentPhotos(who),counts:roomCounts({[who]:next.length}),
      place:WAY,bag:bagRef.current.map(b=>b.key)});
  };
  const answerInvite=ok=>{
    const iv=invite; setInvite(null); if(!iv)return;
    const line=ok?`${jos(CHARS[iv.char].name,"과/와")} ${iv.place}에 가기로 했다`:`${jos(iv.place,"은/는")} 다음에 가기로 했다`;
    const sys={id:Date.now()+Math.random(),sender:"user",sys:true,text:line,ts:Date.now()};
    appendMsg(iv.char,sys);
    if(ok){ goneTo(iv.place); markEvent({kind:"met",to:iv.char,name:iv.place});
      // 그 자리로 화면을 옮긴다. 배경이 깔리고 말풍선이 걷힌다
      if(PLACE_BY[iv.place]){ const sc={room:iv.char,place:iv.place,since:Date.now()}; setScene(sc); saveScene(sc); } }
    else  { saveRefused([...loadRefused(),iv.place]); }
    /* 답을 했으면 상대도 답을 해야 한다. 전에는 여기서 끝이었다 —
       가자고 해놓고 갈게요 했더니 아무 말도 없이 대화가 멈췄다.
       그 자리 얘기는 한 시간 뒤 관전방에서나 나왔고, 정작 같이 가기로 한
       사람은 입을 다물고 있었다. 승낙이든 거절이든 반응이 있어야 사람이다. */
    const next=[...(storeRef.current.msgs[iv.char]||[]),sys];
    request(iv.char,{mode:"chat",room:iv.char,user_name:name,
      history:buildHistory(sinceSum(iv.char,next)),signals:buildSignals(iv.char),
      recent_photos:recentPhotos(iv.char),counts:roomCounts({[iv.char]:next.length}),
      ...(ok&&PLACE_BY[iv.place]?{place:iv.place,bag:bagRef.current.map(b=>b.key)}:{})});
  };

  /* 지도에서 내가 고른 자리. 인물이 부른 게 아니라 내 발로 가는 거라 창만
     같고 규칙은 다르다 — 여기서 물러나도 그 자리가 닫히지는 않는다.
     마음이 바뀐 것뿐이지 거절한 게 아니니까. */
  const [ask,setAsk]=useState(null);
  /* 동행을 고르는 자리에서 고른 사람. 창을 닫으면 같이 비운다 */
  const [askWho,setAskWho]=useState(null);
  const openAsk=place=>{setAskWho(null);setAsk(place)};
  /* 누구를 만나나.
     pick — 유저가 고른다(도서관·레코드샵). 시간을 내서 가는 자리라서.
     out  — 그 시각에 밖에 나와 있을 수 있는 사람 중에서 뽑는다. 마주치는 자리라서.
     그 밖 — 자리 임자가 정해져 있다. 둘 다면 더 많이 말을 나눈 쪽. */
  const whoAt=(p,picked)=>{
    if(p.pick)return picked||null;
    if(p.meet==="out"){ const out=whoOut(); return out.length?out[Math.floor(Math.random()*out.length)]:null }
    const list=p.who||[]; if(list.length<2)return p.own||list[0];
    const n=id=>(storeRef.current.msgs[id]||[]).length;
    return list.slice().sort((a,b)=>n(b)-n(a))[0];
  };
  const answerAsk=ok=>{
    const place=ask, picked=askWho; setAsk(null); setAskWho(null);
    const p=ok&&place&&PLACE_BY[place]; if(!p||!placeHours(p))return;
    if(!wendOnlyOk(p)||goneToday(place))return;
    const who=whoAt(p,picked); if(!who)return;
    stampGone(place);
    const sys={id:Date.now()+Math.random(),sender:"user",sys:true,text:`${place}에 갔다`,ts:Date.now()};
    appendMsg(who,sys);
    goneTo(place); markEvent({kind:"met",to:who,name:place});
    const sc={room:who,place,since:Date.now()}; setScene(sc); saveScene(sc);
    setView(who);
    const next=[...(storeRef.current.msgs[who]||[]),sys];
    request(who,{mode:"chat",room:who,user_name:name,
      history:buildHistory(sinceSum(who,next)),signals:buildSignals(who),
      recent_photos:recentPhotos(who),counts:roomCounts({[who]:next.length}),
      place,bag:bagRef.current.map(b=>b.key)});
  };

  /* 백엔드가 알려준 해금 목록을 반영하고, 새로 열린 게 있으면 알린다 */
  const applyUnlocked=list=>{
    if(!Array.isArray(list)||!list.length)return;
    const now=unlockedRef.current;
    const fresh=list.filter(k=>HIDDEN_LABEL[k]&&!now.includes(k));
    if(!fresh.length)return;
    setUnlocked([...now,...fresh]);
    setToast(fresh.length===1?`.hidden — ${HIDDEN_LABEL[fresh[0]]}`:`.hidden — ${fresh.length}개가 열렸다`);
    markEvent({kind:"unlock",name:HIDDEN_LABEL[fresh[0]]});
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
    if(!CHARS[room]||demoOn()||summingRef.current[room])return;
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
      const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},
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
    // 다녀온 자리·거절한 자리 — 서버가 다음 제안을 고르는 근거
    if(payload.mode==="chat"){ payload.met=loadMet(); payload.refused=loadRefused();
      /* 지금 문 닫은 자리는 인물도 가자고 안 한다. 시간은 프론트만 안다 —
         워커는 UTC로 돌고 어느 엣지에 뜨는지도 그때그때다 */
      payload.closed=PLACES.filter(p=>!placeHours(p)).map(p=>p.name); }
    if(up)payload.user_profile=up; else delete payload.user_profile;
    if(!payload.counts)payload.counts=roomCounts();
    if(payload.days==null)payload.days=daysSince(storeRef.current);
    if(payload.now==null)payload.now=timeWord();
    if(payload.day==null)payload.day=dayWord();
    /* 이 방의 요약. 원문 창 밖으로 밀려난 얘기가 여기 들어 있다.
       호출부마다 붙이지 않고 여기서 한 번에 얹는다 — 한 군데만 빠뜨려도
       그 경로에서만 기억을 잃는데, 그건 눈으로 찾기 어렵다. */
    if(payload.mode==="chat"){ const t=loadSum(payload.room||bucket).text; if(t)payload.summary=t; }
    inflightRef.current[bucket]=true;
    setBusy(b=>({...b,[bucket]:true}));
    setFailed(f=>({...f,[bucket]:null}));
    // 데모로 굳었으면 네트워크를 아예 타지 않는다
    if(demoOn()){
      inflightRef.current[bucket]=false;
      setTimeout(()=>demoSay(bucket,demoAsk(payload),demoGiftKey(payload)),450);
      return;
    }
    try{
      const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>null);
      if(!res.ok){
        // 서버가 알려준 실패 사유를 그대로 들고 올라간다
        const err=new Error("HTTP "+res.status);
        err.detail=(data&&(data.detail||data.error))||("HTTP "+res.status);
        throw err;
      }
      inflightRef.current[bucket]=false;
      const list=(data&&data.messages)||[];
      if(list.length)enqueue(bucket,list);
      else setBusy(b=>({...b,[bucket]:false}));
      applyUnlocked(data&&data.unlocked);
      /* 실측. 내 짐작이 아니라 진짜 토큰 수다. 읽음이 계속 0이면 캐시가
         안 맞고 있다는 뜻인데, 그건 오류를 안 내고 조용히 정가를 문다 */
      if(data&&data.usage)console.log("%c[NULL] 토큰 — 새로 "+(data.usage.input_tokens||0)+
        " · 캐시 씀 "+(data.usage.cache_creation_input_tokens||0)+
        " · 캐시 읽음 "+(data.usage.cache_read_input_tokens||0)+
        " · 출력 "+(data.usage.output_tokens||0),"color:#7a6cc4");
      setTimeout(()=>rollSummary(bucket),1200);
      if(data&&data.invite&&data.invite.place) setInvite(data.invite);
      /* 자리에서 뭘 건넸다. 말풍선이 다 뜬 뒤에 가방에 넣는다 —
         "받았다" 줄이 주는 말보다 먼저 뜨면 순서가 거꾸로 보인다. */
      /* 모델이 첫 턴부터 건네주기도 한다. 그때는 아직 아무 말도 안 오갔다 */
      if(data&&data.give&&data.give.item&&talkedEnough(sceneRef.current))
        setTimeout(()=>takeItem(data.give.item,data.give.char,data.give.place),
          Math.max(900,((data.messages||[]).length+1)*600));
    }catch(e){
      inflightRef.current[bucket]=false;
      setBusy(b=>({...b,[bucket]:false}));
      const detail=String(e.detail||e.message||e).slice(0,500);
      // 화면(재시도 버튼 아래)과 콘솔 양쪽에 남긴다 — 어느 쪽을 보든 원인이 보이게
      console.error("%c[NULL] 실패 원인 ▶ "+detail,"color:#c23b50;font-size:13px;font-weight:bold");
      /* 처음 실패하면 데모로 넘어간다. 저장소 링크만 보고 들어온 사람이
         재시도 버튼만 마주하는 것보다 각본이라도 움직이는 편이 낫다.
         원인은 위 콘솔에 그대로 남고 하단 바에 demo가 뜬다 — 조용히 가짜로
         바뀌면 진짜 장애를 못 알아채기 때문이다. */
      DEMO.auto=true;
      setBusy(b=>({...b,[bucket]:true}));
      setTimeout(()=>demoSay(bucket,demoAsk(payload),demoGiftKey(payload)),450);
    }
  };

  /* 일반 대화 전송 */
  const send=(room,text)=>{
    const userMsg={id:Date.now()+Math.random(),sender:"user",text,ts:Date.now()};
    appendMsg(room,userMsg);
    const next=[...(storeRef.current.msgs[room]||[]),userMsg];
    const history=buildHistory(sinceSum(room,next));
    /* 자리에 있는 동안에는 어느 자리인지 같이 보낸다. 안 보내면 마주 앉아서
       "지금 어디예요?"를 묻는다 — 화면만 바뀌고 사람은 안 바뀐 꼴이 된다. */
    const sc=sceneRef.current;
    const at=sc&&sc.room===room?sc.place:null;
    request(room,{mode:"chat",room,user_name:name,history,signals:buildSignals(room),
      recent_photos:recentPhotos(room),counts:roomCounts({[room]:next.length}),
      ...(at?{place:at,bag:bagRef.current.map(b=>b.key)}:{})});
  };
  /* 선물 보내기.
     사진은 채팅창에 띄우지 않는다 — 줄글 한 줄만 남기고 반응은 인물이 알아서 한다.
     그 줄은 유저의 말이 아니라 일어난 일이므로 sys로 표시해 지문처럼 그린다.
     history에도 이 줄이 그대로 들어가서 모델이 "무엇을 받았는지" 알게 된다. */
  const giveGift=(char,gift,memo)=>{
    if(!char||!gift)return;
    const have=giftsRef.current[char]||[];
    if(have.includes(gift.key))return;              // 같은 걸 두 번 주지 않는다
    /* 한 사람에게 하루에 하나. 창에서 이미 막고 있지만 여기서도 막는다 —
       주는 길이 둘이면 한쪽만 잠그는 자물쇠는 자물쇠가 아니다 */
    if(giftedToday(char)){ setToast(`${CHARS[char].name} — one a day ♡`); return }
    stampGift(char);
    const next={...giftsRef.current,[char]:[...have,gift.key]};
    setGifts(next); saveGifts(next);
    const note=(memo||"").trim().slice(0,60);
    const line=`${jos(CHARS[char].name,"이/가")} ${jos(gift.name,"을/를")} 받았다`+(note?` — “${note}”`:"");
    const sysMsg={id:Date.now()+Math.random(),sender:"user",sys:true,text:line,ts:Date.now()};
    appendMsg(char,sysMsg);
    setToast(`${CHARS[char].name} — ${gift.name}`);
    markEvent({kind:"gift",to:char,name:gift.name});
    const nextMsgs=[...(storeRef.current.msgs[char]||[]),sysMsg];
    request(char,{mode:"chat",room:char,user_name:name,history:buildHistory(sinceSum(char,nextMsgs)),
      signals:buildSignals(char),recent_photos:recentPhotos(char),
      counts:roomCounts({[char]:nextMsgs.length}),gift:{name:gift.name,key:gift.key,note}});
  };

  /* 재시도: 저장해둔 payload를 최신 history로 갱신해 다시 전송 */
  const retry=room=>{
    const p=failed[room]&&failed[room].payload;if(!p)return;
    if(p.mode==="chat")p.history=buildHistory(sinceSum(room,storeRef.current.msgs[room]||[]));
    p.recent_photos=recentPhotos(p.mode==="auto"?"health":room);
    request(room,p);
  };
  /* 시간 경과(달 버튼): 자율 대화 생성 → 관전방에 축적 */
  /* 선물이나 해금이 있으면 그 일을 적어둔다. 바로 만들지는 않는다 —
     유저가 자리를 비운 지 한 시간이 지나 다시 들어왔을 때 만든다.
     원문은 여전히 서버로 안 간다. 무슨 물건을 줬는지만 알려주고, 무슨 말이
     오갔는지는 프롬프트에서 못박아 막는다. */
  const markEvent=ev=>saveAutoEvent({...ev,at:Date.now()});

  /* 유저가 아무것도 안 눌러도 생기는 사건 둘.
     ① 재언에게 사진이 다섯 장 넘게 오면 — 민현이는 그 사진을 못 본다.
        찍는 것만 봤다. 그래서 묻는 쪽이 된다.
     ② 떠날 날이 7·3·1일 남는 날 — 둘 다 알지만 이름을 먼저 안 붙인다.
     찍어만 두고 만들지는 않는다. 한 시간 뒤 아래 효과가 가져간다. */
  useEffect(()=>{
    if(!name)return;
    const done=loadEvDone();
    const mark=(key,ev)=>{ if(done.includes(key))return false;
      saveEvDone([...loadEvDone(),key]); markEvent(ev); return true };
    const m=storeRef.current.msgs||{};
    const shots=(m.jaeeon||[]).filter(x=>x.photo&&x.sender!=="user").length;
    if(shots>=PHOTO_EVENT_AT&&mark("photos",{kind:"photos",to:"jaeeon"}))return;
    const all=Object.values(m).flat();
    const firstTs=all.reduce((a,x)=>!a||x.ts<a?x.ts:a,0);
    if(!firstTs)return;
    const d=Math.max(0,ENROLL_DAYS-Math.floor((Date.now()-firstTs)/864e5));
    if(DDAY_MARKS.includes(d))mark("dday:"+d,{kind:"dday",name:String(d)});
  },[name,view,store.msgs]);

  const autoBusy=useRef(false);
  useEffect(()=>{
    if(!name||view!=="list"||autoBusy.current)return;
    (async()=>{
      const ev=loadAutoEvent(); if(!ev||!ev.kind)return;
      const m=storeRef.current.msgs||{};
      const all=Object.values(m).flat();
      const lastAny=all.reduce((a,x)=>x.ts>a?x.ts:a,ev.at||0);
      const now=Date.now();
      if(now-lastAny<AUTO_AWAY)return;
      const day=new Date().toISOString().slice(0,10);
      const [d,n]=loadAutoDay().split("|");
      const used=d===day?Number(n)||0:0;
      if(used>=AUTO_MAX_DAY){ saveAutoEvent(null); return; }
      autoBusy.current=true;
      saveAutoEvent(null); saveAutoDay(`${day}|${used+1}`);
      saveAutoAt(now); setAutoAt(now);
      // 유저가 나가고 한 시간쯤 뒤의 일로 찍는다
      const at=Math.min(lastAny+AUTO_AWAY+Math.floor(Math.random()*30*60*1000),now-5*60*1000);
      let list=null;
      if(demoOn()){ list=demoReply("health",null,name,storeRef.current.msgs); }
      else{
        try{
          const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({mode:"auto",user_name:name,counts:roomCounts(),
              history:buildHistory(storeRef.current.msgs.health||[]),
              signals:buildSignals(null),event:{kind:ev.kind,to:ev.to,name:ev.name}})});
          const data=await res.json().catch(()=>null);
          if(res.ok&&data) list=data.messages;
        }catch(e){ /* 유저가 부른 적 없는 호출이라 실패를 알릴 이유가 없다 */ }
      }
      autoBusy.current=false;
      if(!list||!list.length)return;
      let t=at;
      list.forEach(x=>{
        if(!x)return;
        const photo=photoSrc(x.photo)?x.photo:null;
        const text=(x.text||"").trim();
        if(!text&&!photo)return;
        appendMsg("health",{id:t+Math.random(),sender:x.sender||"health",text,photo,ts:t});
        t+=40000+Math.floor(Math.random()*80000);
      });
    })();
  },[name,view]);

  const doAuto=async()=>{
    if(autoLoading)return;
    setAutoLoading(true);
    await request("health",{mode:"auto",user_name:name,
      history:buildHistory(storeRef.current.msgs.health||[]),signals:buildSignals(null),recent_photos:recentPhotos("health")});
    setAutoLoading(false);
  };

  /* [편집] 대화 저장: 전체 방 → .txt 다운로드 */
  const exportTxt=()=>{
    const lines=["NULL — 대화 기록","내보낸 시각: "+new Date().toLocaleString("ko-KR"),""];
    ROOMS.forEach(r=>{
      const ms=storeRef.current.msgs[r.id]||[];if(!ms.length)return;
      lines.push("──── "+r.name+" ────");
      ms.forEach(m=>{
        /* 지문에는 말한 사람이 없다. 「이민현이 이어폰을 받았다」는 아무도
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

     전에는 이게 데모 전용이었다. 키가 살아 있으면 아무도 먼저 말을 걸지
     않았다는 뜻이다. 지금은 항상 온다.

     문장은 문구집의 「도착 선톡」에서 고른다. 모델에게 첫 마디를 시켜도
     봤는데, 첫인사는 매번 같은 자리에서 같은 목적으로 나오는 말이라
     쓰여 있는 스무 개를 도는 편이 낫다. 대신 공백에 따라 갈래가 다르다 —
     처음이면 고른 다섯 개, 평소면 스무 개, 하루를 넘겼으면 늦었다는 말이
     들어 있는 여섯 개다. 십 분 만에 들어온 사람한테 「이제 와요?」는 안 한다. */
  const greet=(id,delay)=>{
    if(id==="health"||id==="group")return;
    /* 거는 길이 둘이다 — 목록에 앉아 있을 때, 그리고 방을 열 때.
       한쪽만 잠그면 새벽에 재언 방을 열었을 때 그가 깨어난다 */
    if(!canGreet(id))return;
    const list=storeRef.current.msgs[id]||[];
    const gapMin=list.length?Math.round((Date.now()-list[list.length-1].ts)/60000):-1;
    if(gapMin>=0&&gapMin<180)return;
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
    try{
      const lines=demoWatchOpen(name);
      if(lines.length)setTimeout(()=>enqueue("health",lines),450);
    }catch(e){ console.error("%c[NULL] 첫 장면 실패 ▶ "+(e&&e.message||e),"color:#c23b50"); }
  };
  const openRoom=id=>{setView(id);setStore(s=>({...s,unread:{...s.unread,[id]:0}}));
    if(id==="health")seedWatch(); else greet(id,700)};
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
    const first=Object.values((store&&store.msgs)||{}).flat()
      .reduce((a,m)=>!a||m.ts<a?m.ts:a,0);
    if(!first||Date.now()-first<SYS1_AFTER)return;
    if(dLeft<=0)return;
    saveSys1(); setSys1(true);
  },[name,store,dLeft]);

  const askDday=dLeft===0&&!!name&&ddayAns!==String(dSpan);
  const answerDday=yes=>{
    try{localStorage.setItem("null_dday_ans",String(dSpan))}catch(e){}
    setDdayAns(String(dSpan));
    if(yes){
      try{localStorage.setItem("null_extend",String(loadExtend()+ENROLL_DAYS))}catch(e){}
      setToast("staying ♡ +"+ENROLL_DAYS+" days");
    }else setToast("left 4 real ✧");
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
  /* 이름을 넣으면 등록 화면이 한 번 지나간다. 처음 들어온 사람에게만이다 —
     이미 이름이 있으면 오프닝도 등록도 건너뛰고 바로 메신저다. */
  const [enrolling,setEnrolling]=useState(false);
  const enter=n=>{localStorage.setItem("null_name",n);setName(n);setEnrolling(true)};

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
     켠 사람은 민현하고만 하루를 연다.

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
    if(PLACE_BY[o.place])goneTo(o.place);          // 지도 자리면 다녀온 걸로 친다
    const sc={room:o.room,place:o.place,since:Date.now(),...(o.bg?{bg:o.bg}:{})};
    setScene(sc); saveScene(sc); setView(o.room);
    const next=[...(storeRef.current.msgs[o.room]||[]),sys];
    request(o.room,{mode:"chat",room:o.room,user_name:name,
      history:buildHistory(sinceSum(o.room,next)),signals:buildSignals(o.room),
      recent_photos:recentPhotos(o.room),counts:roomCounts({[o.room]:next.length}),
      place:o.place,bag:bagRef.current.map(b=>b.key)});
    /* 다른 한 사람은 첫인사를 보낸다. 여기서 직접 건다 — 아래 선톡 추첨에
       맡기면 자리 쪽 상태가 아직 화면에 안 앉아서 두 방이 다 비어 보이고,
       자리에서 만난 사람이 뽑혀 조용히 삼켜진다. 게다가 그 추첨은 view가
       바뀌면 정리와 함께 예약까지 취소돼서, 자리로 넘어가는 순간 죽는다.
       새벽이면 재언은 안 온다 — 여섯 시에 온다(canGreet). */
    const other=o.room==="jaeeon"?"minhyun":"jaeeon";
    if(canGreet(other)){
      greetAtRef.current=Date.now();               // 추첨은 일 분간 조용히
      setTimeout(()=>greet(other,0),2600+Math.random()*2600);
    }
  },[name,enrolling]);

  useEffect(()=>{
    if(!name||view!=="list"||enrolling)return;
    if(Date.now()-greetAtRef.current<60000)return;   // 목록을 들락거려도 연달아 오지 않게
    /* 자는 쪽은 후보에서 먼저 뺀다. 뽑고 나서 막으면 그 판은 아무도 안 건다 —
       새벽에는 제일 오래 조용한 쪽이 늘 재언이라, 민현이 영영 안 걸린다 */
    const cand=["jaeeon","minhyun"].filter(id=>canGreet(id)).map(id=>{
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

  return <div className="phone">
    {enrolling&&<Enroll name={name} profile={profile} onDone={()=>setEnrolling(false)}
      onRename={rename} onSaveField={(k,v)=>setProfile(p=>({...p,[k]:v}))}/>}
    {!name?<Splash onEnter={enter}/>
    :view==="list"?<RoomList store={store} name={name} unlocked={unlocked} counts={roomCounts()}
       onOpen={openRoom} onProfile={openProfile} onAuto={doAuto} autoLoading={autoLoading} seenStage={seenStage}
       onExport={exportTxt} onReadAll={readAll} onRename={rename} onReset={reset} onToast={setToast}
       profile={profile} onSaveField={(k,v)=>setProfile(p=>({...p,[k]:v}))} gifts={gifts} onGift={giveGift} hearts={heartsOf(store,gifts)}
       bag={bag} met={met} onGoPlace={openAsk} onEnergyBar={giveEnergyBar}/>
    :<ChatRoom room={roomOf(view)} msgs={store.msgs[view]||[]} busy={!!busy[view]} failed={failed[view]} dLeft={dLeft}
       scene={scene&&scene.room===view?scene:null} onLeaveScene={leaveScene}
       onBack={()=>setView("list")} onSend={t=>send(view,t)} onRetry={()=>retry(view)} onProfile={openProfile}/>}
    {invite&&<div className="dlgov" onClick={()=>answerInvite(false)}>
      <div className="dlg" onClick={e=>e.stopPropagation()}>
        <div className="tb">{CHARS[invite.char].name}<WinDots onClose={()=>answerInvite(false)}/></div>
        <div className="dlgbody">
          <div className="dlgline" style={{textAlign:"center",padding:"10px 0",fontSize:13,color:"#8a4f74"}}>
            {invite.place}, 같이 갈래요?</div>
          <div className="dlgbtns">
            <button className="bevel pink" onClick={()=>answerInvite(true)}>갈게요</button>
            <button className="bevel" onClick={()=>answerInvite(false)}>다음에요</button>
          </div>
        </div>
      </div>
    </div>}
    {/* 나가기도 한 번 묻는다. 하루에 한 번뿐인 자리라 실수로 닫히면 그날이 끝난다 */}
    {leaving&&<div className="dlgov" onClick={()=>answerLeave(false)}>
      <div className="dlg" onClick={e=>e.stopPropagation()}>
        <div className="tb">{leaving.place}<WinDots onClose={()=>answerLeave(false)}/></div>
        <div className="dlgbody">
          <div className="dlgline" style={{textAlign:"center",padding:"10px 0 4px",fontSize:13,color:"#8a4f74"}}>
            {leaving.place}에서 나갈까요?</div>
          <div className="askrule">오늘은 못 와요 <span className="kao">Σ(°△° ꪱꪱꪱ)</span></div>
          <div className="dlgbtns">
            <button className="bevel pink" onClick={()=>answerLeave(true)}>나갈래요</button>
            <button className="bevel" onClick={()=>answerLeave(false)}>더 있을래요</button>
          </div>
        </div>
      </div>
    </div>}
    {/* 밤에 자리에서 나올 때. 묻는 쪽이 상대라서 초대 창과 같은 모양이다 */}
    {way&&<div className="dlgov" onClick={()=>answerWay(false)}>
      <div className="dlg" onClick={e=>e.stopPropagation()}>
        <div className="tb">{CHARS[way.room].name}<WinDots onClose={()=>answerWay(false)}/></div>
        <div className="dlgbody">
          <div className="dlgline" style={{textAlign:"center",padding:"10px 0",fontSize:13,color:"#8a4f74"}}>
            {way.room==="jaeeon"?"늦었어요. 태워다 줄게요":"저도 그쪽 방향인데, 같이 갈래요?"}</div>
          <div className="dlgbtns">
            <button className="bevel pink" onClick={()=>answerWay(true)}>같이 가요</button>
            <button className="bevel" onClick={()=>answerWay(false)}>혼자 갈게요</button>
          </div>
        </div>
      </div>
    </div>}
    {/* 지금 갈 시간이 아니면 묻지 않고 이유를 말한다. 눌렀는데 아무 일도
        안 일어나는 것보다 「몇 시부터」를 알려주는 편이 낫다 */}
    {ask&&(()=>{
      const p=PLACE_BY[ask];
      /* 아직 안 열린 자리. 눌러도 아무 일이 없으면 고장 난 것처럼 보인다 —
         왜 안 되는지는 말해줘야 한다. 무엇을 먼저 가야 하는지도 같이 */
      const locked=!!p&&!placeOpen(p,met);
      const shut=!!p&&!placeHours(p);            // 지금은 문 닫은 시각
      const wk=!!p&&!wendOnlyOk(p);              // 평일엔 못 가는 자리
      const done=goneToday(ask);                 // 오늘 이미 다녀왔다
      const out=p&&p.meet==="out"?whoOut():null; // 마주치는 자리 — 지금 밖에 누가 있나
      const empty=!!out&&!out.length;
      const need=!!p&&p.pick&&!askWho;           // 동행을 아직 안 골랐다
      const no=locked||shut||wk||done||empty;
      const left=locked?placeNeed(p,met):[];
      const why=locked?(left.length?left.join(" · ")+" 먼저":"")
        :done?"오늘은 벌써 다녀왔어요"
        :wk?"주말에만 갈 수 있어요"
        :empty?"지금은 아무도 밖에 없어요"
        :shut?placeWhen(p):"";
      return <div className="dlgov" onClick={()=>answerAsk(false)}>
      <div className="dlg" onClick={e=>e.stopPropagation()}>
        <div className="tb">{ask}<WinDots onClose={()=>answerAsk(false)}/></div>
        <div className="dlgbody">
          <div className="dlgline" style={{textAlign:"center",padding:"10px 0 4px",fontSize:13,color:"#8a4f74"}}>
            {locked
              ?<>my bad <i style={{fontStyle:"normal",color:"#e66fa4"}}>♡</i> 아직은 못 가요 <span className="kao">𐔌՞꜆ ≧ ㅁ≦꜀՞𐦯</span></>
              :no?`${ask}, 지금은 못 가요`:`${ask}, 갈까요?`}</div>
          {/* 하루에 한 번뿐이라는 건 눌러보고 알면 늦다. 묻는 자리에서 같이 말한다 */}
          {!no&&<div className="askrule">앗! 하루에 1번만 갈 수 있어요 <span className="kao">(υl|l◔ㅅ◔)՞՞</span></div>}
          {no&&<div style={{textAlign:"center",paddingBottom:8,fontSize:10,letterSpacing:".08em",color:"#b4a7d6"}}>{why}</div>}
          {/* 시간을 내서 가는 자리는 누구랑 갈지 고른다 */}
          {!no&&p&&p.pick&&<div className="askwho">
            {(p.who||[]).map(c=><button key={c}
              className={"whobtn bevel"+(askWho===c?" on":"")}
              onClick={()=>setAskWho(c)}>
              <span className="cface" style={faceBg(CHARS[c])}/>{CHARS[c].name}</button>)}
          </div>}
          <div className="dlgbtns">
            {no
              ?<button className="bevel" onClick={()=>answerAsk(false)}>알겠어요</button>
              :<><button className="bevel pink" disabled={need} onClick={()=>answerAsk(true)}>갈래요</button>
                 <button className="bevel" onClick={()=>answerAsk(false)}>다음에요</button></>}
          </div>
        </div>
      </div>
    </div>; })()}
    {prof&&<Profile char={prof} count={profCount(prof)} onBack={()=>setProf(null)} gifts={gifts} dLeft={dLeft} back={cameBack} days={dayN}/>}
    {sys1&&<Dialog title="null.exe" onClose={()=>setSys1(false)}>
      <div className="ddq">
        <div className="k">［ N U L L ］♡</div>
        <div className="ddrows">
          <div className="r"><span className="k2">대 상</span><span className="dot"/><span className="v">{name}</span></div>
          <div className="r"><span className="k2">등 록</span><span className="dot"/><span className="v">완료 ♡</span></div>
          <div className="r"><span className="k2">존재값</span><span className="dot"/><span className="v hush">비밀</span></div>
          <div className="r"><span className="k2">잔 여</span><span className="dot"/><span className="v">{dLeft}일</span></div>
        </div>
        <div className="q" style={{marginTop:16,fontSize:13}}>!! WARNING !!</div>
        <div className="s">다 못 채우면 사라져요 ♡<br/>비밀은 Secret <span className="kao">(𓂂꜆◕⩊◕꜀𓂂)</span> ✧</div>
        <div className="dlgbtns" style={{justifyContent:"center"}}>
          <button className="wbtn" onClick={()=>setSys1(false)}>ok ♡</button>
        </div>
      </div>
    </Dialog>}
    {askDday&&!ddayHide&&<Dialog title="d-0.exe" onClose={()=>setDdayHide(true)}>
      <div className="ddq">
        <div className="k">d-0 · last day</div>
        <div className="q">stay or leave??</div>
        <div className="s">{nameFull
          ?<>ur not NULL anymore ♡<br/>stay = 30 more days w them</>
          :<>still {name.length-lit} blank{name.length-lit>1?"s":""} left · still NULL<br/>a name has 2 be called out loud ♡</>}</div>
        <div className="ddyn">
          <button className={nameFull?"":"dead"}
            onClick={()=>nameFull?answerDday(true):setToast("still NULL ♡ □ "+(name.length-lit)+" left")}>
            <span className="g">♡</span>stay w them<span className="tail">{nameFull?"+30d":"locked"}</span></button>
          <button className="no" onClick={()=>answerDday(false)}>
            <span className="g">✧</span>leave 4 real<span className="tail">bye bye</span></button>
        </div>
      </div>
    </Dialog>}
    {toast&&<div className="toast"><span>✧ {toast}</span></div>}
  </div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
