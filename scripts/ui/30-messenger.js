/* NULL web UI · timetable, bag, search, gift, room list
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
/* ── 시간표 ──
   그날 처음 열면 한 번 뜬다. 하루에 여섯 번 알림을 띄우면 사흘이면 벽지가
   되는데, 하루에 한 번이면 의식이 된다. 그 뒤로는 peek 옆 버튼이 지금이
   몇 교시인지 들고 있고, 눌러서 다시 볼 수 있다.
   야자 감독인 주에는 경고가 하나 붙는다 — 그 주 아무 때나 들어와도 보이게. */
function Timetable({wend,onFillWend,onClose}){
  /* 세계가 보는 시계다. 스피드 모드면 진행을 따라 도는 시계라, 대화가
     쌓이는 대로 이 표의 「지금」도 출근에서 저녁으로 내려간다 */
  const now=nowClock();
  const wk=isWend(now), slots=daySlots(now), i=slotNow(now);
  const key=dayKey(), mine=(wend||{})[key]||[];
  const yaja=isYajaWeek(now);
  /* ON은 출근 위에 얹고 OFF는 마지막 칸(21시)의 이름이다. 둘 다 다른 칸과
     똑같이 그린다 — 같은 줄, 같은 표시. 전에는 오른쪽에 「오늘도 Loading...」을
     글로 박았는데, 그러면 그 두 줄만 다른 종류로 보인다. 그 말은 아래 설명칸
     몫이다. ON은 출근 전(i<0)이 제 시간이라 그때가 「지금」이다. */
  const rows=wk
    ?Array.from({length:WEND_SLOTS},(_,n)=>({k:mine[n]||"",n,blank:true}))
    :[{k:"ON",n:-1,now:i<0,past:i>=0},
      ...slots.map((s,n)=>({k:s.k,n,now:n===i,past:n<i}))];
  return <Dialog title="null.exe" onClose={onClose} win="ttwin">
        <div className="ttpanel">
          <div className="tttag">TIMETABLE ♡</div>
          {rows.map(r=>r.blank
            ?<div key={r.n} className="ttrow mine">
               <span className="n"><Blank value={r.k} width={54} onSave={v=>onFillWend(key,r.n,v)}/></span>
               <span className="ln"/><span className="mk">{r.k?"♡":""}</span>
             </div>
            :<div key={r.n} className={"ttrow"+(r.now?" now":r.past?" past":" next")}>
               <span className="n">{r.k}</span><span className="ln"/>
               <span className="mk">{r.past?"♡":r.now?<><span className="kao">(՞៸៸›⩊‹៸៸՞)</span>🩷</>:""}</span>
             </div>)}
        </div>
        {/* 야자 감독인 주에는 아랫줄이 통째로 경고로 바뀐다 — null.exe가 원래
            「!! WARNING !!」+ 두 줄인 창이라 그 자리를 바꿔 끼우면 된다.
            상자를 하나 더 만들면 창 안에 창이 생긴다 */}
        {yaja
          ?<div className="ttsay warn">
             <b>!!!WARNING!!!</b>
             목요일은 내가 야자 감독 ミ✭<br/>
             에너지바가 NULL 지켜줄 거야 <span className="kao">(𓂂꜆◕⩊◕꜀𓂂)</span> 💗
           </div>
          :(()=>{
             /* 하루의 양 끝은 시간표가 정해주는 것이 없다 — 켜지기 전, 일과가
                끝난 뒤, 그리고 값이 비는 밤. 그 세 자리에는 말이 따로 있다.
                가운데(출근·수업·점심·퇴근·야자)는 「지금은 ○○이에요」 그대로다. */
             /* 첫 줄(「지금은 ○○이에요」)은 어느 때든 그대로다. 갈아끼우는 것은
                아랫줄뿐이다 — 하루가 켜지기 전이면 Loading, 끝난 뒤면 Ending.
                ON·OFF는 표에서 다른 칸과 똑같이 서 있고, 그 두 칸이 무엇인지는
                여기 아랫줄이 말한다. 21시 이후는 nowLabel이 「OFF」다. */
             const L=wk?null:nowLabel(now);
             const foot=L==="등교전"
                 ?<>오늘도 Loading... <span className="kao">˙˚ଘo(∗ ❛ั ᵕ ❛ั )੭່˙</span></>
               :(L==="OFF"||L==="NULL")
                 ?<>오늘도 Ending... <span className="kao">₍ ˵ • ꤮ ก ˵ ₎︎აᶻ 𝗓 𐰁</span></>
               :<>NULL 위한 하루가 되기를! <span className="kao">(ᗒ⩊ᗕ)⸝ި ʕᦏ⌎</span></>;
             return <div className="ttsay">
             {/* 「등교전예요」가 그대로 찍혔다. 받침이 있으면 이에요, 없으면 예요다 —
                 출근·수업·점심·퇴근은 이에요, 야자만 예요다 */}
             <b>{wk?<>오늘은 학교가 없어요 <i>♡</i></>
                 :<>지금은 {jos(L,"이에요/예요")} <i>♡</i></>}</b>
             {wk?<>NULL 위한 하루가 되기를! <span className="kao">(ᗒ⩊ᗕ)⸝ި ʕᦏ⌎</span></>:foot}
           </div>; })()}
        <div className="dlgbtns ttbuttons">
          <button className="ttclose" onClick={onClose}>ok ♡</button>
        </div>
  </Dialog>;
}

/* [bag] 받은 것들.
   gift가 준 것이면 bag은 받은 것이다. 그래서 같은 창으로 만든다 —
   작은 대화상자에 흰 줄로 늘어놓으니 이 앱에서 혼자 다른 물건처럼 보였다.
   누가 어디서 줬는지가 물건보다 중요해서 얼굴을 앞에 놓는다.
   빌린 것은 따로 표시한다 — 돌려줄 게 남아 있으면 아직 안 끝난 것이다. */
function Bag({bag,store,onClose}){
  const [cat,setCat]=useState("전체");
  const rows=bag.filter(b=>ITEMS[b.key]).filter(b=>cat==="전체"||ITEMS[b.key].cat===cat)
    .slice().sort((a,b)=>b.ts-a.ts);
  const lent=bag.filter(b=>ITEMS[b.key]&&ITEMS[b.key].lent).length;
  return <div className="cartscreen"><div className="cartwin glasswindow bagwin">
    <WindowChrome title="bag" onClose={onClose}/>
    <div className="cbar">
      <span className="bagcount">RECEIVED {bag.length} / {Object.keys(ITEMS).length}</span>
      {lent>0&&<span className="baglent">TO RETURN {lent}</span>}
    </div>
    <div className="cchips">{ITEM_CATS.map(c=>
      <button key={c} className={"cchip"+(cat===c?" on":"")} onClick={()=>setCat(c)}>{CAT_EN[c]||c}</button>)}</div>
    <div className="cwrap">
      {rows.length?rows.map(b=>{
        const it=ITEMS[b.key], who=CHARS[b.from];
        /* 받은 날은 날짜가 아니라 남은 날로 적는다 — 이 앱에서 시간은 8월 16일이
           아니라 D-18이다. 첫 대화 날짜를 모르면 그냥 안 적는다.
           **세계 시계로 잰다** — 화면 어디에도 현실 날짜로 센 D는 없어야 한다. */
        const d=dLeftAt(store,b.ts);
        return <div key={b.key} className="cgcard">
          <img className="bagpic" src={av(`item-${b.key}.webp`)} alt=""/>
          <div style={{flex:1,minWidth:0}}>
            <div className="cgname">{it.name}</div>
            {/* 누가 줬는지는 오른쪽 얼굴이 이미 말한다. 이름까지 적으면 두 번이다 */}
            <div className="bagmeta">{b.where}{d!=null?" · D-"+d:""}</div>
            <div className="itemsay">{it.say}</div>
            {it.lent&&<span className="baglabel">RETURN ME</span>}
          </div>
          {who&&<span className="bagwho" style={faceBg(who)}><i>♡</i></span>}
        </div>;
      }):<div className="cnone">{bag.length
        ?<>this drawer : empty ✧{"\n"}try another tab ♡</>
        :<>bag : 0 items ✧{"\n"}go get one on the map ♡</>}</div>}
    </div>
    <div className="cfoot">FROM THEM ♡</div>
  </div></div>;
}

/* [대화 → 찾기] 방을 넘나들며 찾는다. 어디서 그 말을 했는지 기억나지 않을 때. */
function FindPanel({store,name,onOpen}){
  const [q,setQ]=useState("");
  const key=q.trim();
  const hits=!key?[]:ROOMS.flatMap(r=>(store.msgs[r.id]||[])
    .filter(m=>(m.text||"").includes(key))
    .map(m=>({r,m}))).slice(-40).reverse();
  return <div style={{padding:"2px"}}>
    <input className="sunken" value={q} onChange={e=>setQ(e.target.value)} autoFocus
      placeholder="search..." style={{width:"100%",padding:"9px 11px",fontSize:15,
      fontFamily:"inherit",color:"#4a4276",outline:"none",borderRadius:0}}/>
    <div style={{maxHeight:260,overflowY:"auto",marginTop:10}}>
      {key&&!hits.length&&<div className="dlgline" style={{textAlign:"center",color:"#b0a6d8",fontSize:11}}>nothing found</div>}
      {hits.map(({r,m},i)=><div key={i} onClick={()=>onOpen(r.id)}
        style={{padding:"7px 8px",marginBottom:5,cursor:"pointer",background:"#fff",
        border:"1px solid #e7dcf4",fontSize:11,lineHeight:1.6}}>
        <div style={{fontSize:9,color:CHARS[m.sender]?CHARS[m.sender].dk:"#8a7fc0",letterSpacing:".06em"}}>
          {m.sender==="user"?name:(CHARS[m.sender]?CHARS[m.sender].name:r.name)} · {r.name}
        </div>
        <div style={{color:"#4a4276",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.text}</div>
      </div>)}
    </div>
  </div>;
}

/* [당신] 프로필 카드 */
/* 장바구니 — 목록에서 고르고, 누구에게 보낼지와 쪽지를 그 자리에서 정한다.
   작은 다이얼로그가 아니라 창 하나를 통째로 쓴다. 목록 + 쪽지까지 들어가면
   290px 상자로는 스크롤만 생긴다. */
function Cart({gifts,hearts,withChar,met,onSend,onSendAt,onClose}){
  const [q,setQ]=useState("");
  const [cat,setCat]=useState("전체");
  const [pick,setPick]=useState(null);
  const [to,setTo]=useState(null);
  const [memo,setMemo]=useState("");
  const key=q.trim().toLowerCase();
  /* 검색어가 비면 그 분류를 전부 보여준다. 아이템이 몇 개 없어서 정확한 낱말을
     맞춰야만 나오면 뭐가 있는지 모르는 채로 헤매게 된다. */
  const hits=GIFTS.filter(g=>(cat==="전체"||g.cat===cat)
    &&(!key||(g.name+" "+g.tags).toLowerCase().includes(key)));
  const back=()=>{setPick(null);setTo(null);setMemo("")};
  const given=c=>(gifts[c]||[]).includes(pick&&pick.key);
  /* ── 한 물건은 한 사람에게만 ──
     같은 걸 둘 다에게 주면 주는 일이 고르는 일이 아니게 된다. 무엇을 줬는지가
     누구를 골랐는지가 되어야 한다 — 일기가 나중에 그걸 되묻는다.
     「그 사람에게 준 이유는 정말 그것뿐이었을까?」 */
  const takenBy=k=>["jaeeon","minhyun"].find(c=>(gifts[c]||[]).includes(k));
  const taken=c=>{const o=takenBy(pick&&pick.key);return !!o&&o!==c};
  const poor=pick&&hearts<pick.cost;
  const today=c=>giftedToday(c);   // 이 사람 오늘 몫은 이미 나갔다
  /* 물건은 손에서 손으로 간다. 문자로는 못 준다 —
     재언이 직접 말한 적이 있다. 「말로 주는 CD가 어딨어요.」 */
  const here=c=>withChar===c;

  return <div className="cartscreen">
    <div className="cartwin glasswindow giftwin">
    <WindowChrome title={`gift${pick?" / wrap":""}`} onClose={onClose}/>

    {!pick&&<React.Fragment>
      <div className="cbar">
        <input className="csearch" value={q} placeholder="what r u looking 4 ?"
          onChange={e=>setQ(e.target.value)}/>
        <span className="ccoin">♡ {hearts}</span>
      </div>
      <div className="cchips">{GIFT_CATS.map(c=>
        <button key={c} className={"cchip"+(cat===c?" on":"")} onClick={()=>setCat(c)}>{CAT_EN[c]||c}</button>)}</div>
      <div className="cgrid">
        {hits.length?hits.map(g=>
          <button key={g.key} className={"citem"+(takenBy(g.key)?" gone":"")}
            onClick={()=>setPick(g)}>
            {/* 이미 나간 것은 목록에서 표가 난다. 포장까지 하고 나서 알면 늦다 */}
            {takenBy(g.key)
              ?<span className="cbadge sent">SENT</span>
              :g.badge&&<span className={"cbadge"+(g.badge==="HOT"?" mint":"")}>{g.badge}</span>}
            <span className="cthumb"><img src={av(`gicon-${g.key}.webp`)} alt=""/></span>
            <span className="ciname">{g.name}</span>
            <span className="cprice">♡ {g.cost}</span>
          </button>)
         :<div className="cnone">no result</div>}
      </div>
      <div className="cfoot">TAP TO WRAP ♡</div>
    </React.Fragment>}

    {pick&&<div className="cwrap">
      <button className="cback" onClick={back}>◁ BACK</button>
      <div className="cgcard">
        <span className="cgthumb"><img src={av(`gicon-${pick.key}.webp`)} alt=""/></span>
        <div>
          <div className="cgname">{pick.name}</div>
          <div className="itemsay">{pick.say}</div>
          <div className="cgprice">♡ {pick.cost}</div>
        </div>
      </div>
      <div className="csect">WHO GETS THIS</div>
      {/* 한 사람에게 하루에 하나. 눌렀는데 아무 일도 안 일어나는 것보다 왜
          안 되는지 적어주는 편이 낫다 — 자리가 닫혔을 때 여는 시각을
          적어주는 것과 같다. 한쪽만 잠긴 날에도 규칙은 알려준다 */}
      {/* 현이 쓴 문장과 카모지는 상태 안내가 아니라 이 화면의 본문이다.
          만남·전송 여부에 따라 갈아 끼우거나 숨기지 않는다. */}
      <div className="cshut giftline">선물은 What? 주인공은 Who? 장소는 Where?<br/>
        만나서 전해봐요! <span className="kao">˚₊·ଘ(っ≧∀≦)っ˚₊·♡</span></div>
      {(today("jaeeon")||today("minhyun"))&&<div className="cshut cday">
        <span>one a day ♡</span><span>each</span>
      </div>}
      {/* 이미 한 사람이 가진 물건이면 왜 딴 사람이 잠겼는지 적어준다 —
          눌렀는데 아무 일도 안 일어나는 것보다 낫다 */}
      {takenBy(pick.key)&&<div className="cshut cday">
        <span>one gift ♡</span><span>one person</span>
      </div>}
      {["jaeeon","minhyun"].map(c=>{
        /* 이미 어느 자리에 있으면 그 사람에게만 준다. 딴 사람을 고르면
           지금 자리를 말없이 버리고 옮겨가는 그림이 된다 — 인사도 없이 */
        const done=given(c), gone=taken(c);
        const shut=done||gone||today(c)||(!!withChar&&!here(c)), sel=to===c;
        return <div key={c}>
          <button className={"cto"+(sel?" sel":"")} disabled={shut}
            onClick={()=>{ if(shut)return;
              if(!sel){setTo(c);return}
              if(poor)return;
              /* 이미 마주 앉아 있으면 바로 준다. 아니면 아래에서 자리를 고른다 */
              if(!here(c))return;
              onSend(c,pick,giftNote(memo)); onClose(); }}>
            <span className="cradio"/>
            <span className="cface" style={faceBg(CHARS[c])}/>
            <span className="ctoname">{CHARS[c].name}</span>
            <span className={shut?"csent":"csend"}>
              {done?"SENT ♡":gone?"TAKEN":today(c)?"TOMORROW ♡":(withChar&&!here(c))?"NOT HERE"
                :(sel?(poor?`NEED ♡${pick.cost-hearts}`:(here(c)?"SEND ♡":"WHERE ♡")):"WRAP ♡")}</span>
          </button>
        </div>;
      })}
      {/* 만나고 있지 않으면 만나러 간다. 선물이 지도를 도는 이유가 된다 —
          자리 규칙은 하나도 안 봐준다. 여는 시간, 오늘 갔는지, 주말 전용,
          그리고 그 사람이 거기 있을 수 있는지까지 다 본다 */}
      {to&&!here(to)&&!given(to)&&!today(to)&&<React.Fragment>
        <div className="cwhere">
          {giftSpots(to,met).map(g=>
            <button key={g.place} className={"cspot bevel"+(g.ok?"":" off")}
              disabled={!g.ok||poor}
              onClick={()=>{ if(!g.ok||poor)return; onSendAt(to,pick,giftNote(memo),g.place); onClose(); }}>
              <span className="csname">{g.place}</span>
              <span className="cswhy">{g.ok?"♡":g.why}</span>
            </button>)}
        </div>
      </React.Fragment>}
      {/* ⑧ 쪽지는 빈 종이가 아니라 틀이다. 채우는 건 「받고 어떻게 되면
          좋겠는가」 한 자리뿐 — 반응 방향이 정해지면 인물이 안 보이는
          세부를 지어낼 자리가 없어진다. 나머지 글자는 안 지워진다 */}
      <div className="cnote">
        <span className="cnt">{GIFT_NOTE_A.trim()}</span>
        <input className="cwish" value={memo} maxLength={GIFT_WISH_MAX}
          placeholder="" aria-label="note"
          onChange={e=>setMemo(e.target.value)}/>
        <span className="cnt">{GIFT_NOTE_B}</span>
      </div>
    </div>}
  </div></div>;
}

/* restart는 여기 없다. 이름을 바꾸거나 □□를 채우러 여는 창이라, 위험한
   버튼이 안전한 일 옆에 앉아 있었다. 단계 수보다 이웃이 문제였다.
   지금은 etc. 안에 있다. */
function ProfileDialog({name,profile,onSaveField,onRename,onClose}){
  const [nv,setNv]=useState(name);
  const [draft,setDraft]=useState(()=>({
    subject:profile.subject||"",likes:profile.likes||"",dislikes:profile.dislikes||""
  }));
  /* 이 창의 칸은 누르는 순간 span에서 input으로 갈아끼우지 않는다. 모바일에서
     그 찰나에 등록 화면 좌표로 돌아가 칸이 길어졌고, 값도 blur 때 먼저 저장돼
     「변신」이 무엇을 하는 버튼인지 사라졌다. 여기서는 전부 임시로 적어 두고
     버튼 하나가 이름과 세 가지 선호를 함께 적용한다. */
  const transform=()=>{
    const t=nv.trim();
    if(t&&t!==name)onRename(t);
    ["subject","likes","dislikes"].forEach(k=>{
      const v=(draft[k]||"").trim();
      if(v!==(profile[k]||""))onSaveField(k,v);
    });
    onClose();
  };
  /* 등록 화면의 ProfileFrame·ename·eline·blank·ego를 그대로 쓴다.
     이 창만 닮은 칸을 따로 만들면 원본이 바뀔 때 다시 갈라진다. */
  return <div className="dlgov youoverlay" onClick={onClose}>
    <div className="cssprofile youprofile" onClick={e=>e.stopPropagation()}>
    <ProfileFrame title="you.txt" onClose={onClose} frameClass="youframe">
    <div className="ename"><input className="namein" value={nv} maxLength={12}
      aria-label="이름" onChange={e=>setNv(e.target.value)}/></div>
    {ENR_FIELDS.map(f=>
      <div className={`eline e-${f.k}`} key={f.k}>
        {f.k==="age"
          ?<span className="blank filled" title="세계의 고정값">25</span>
          :<input className="blankin sunken" value={draft[f.k]||""} maxLength={20}
            aria-label={f.lab} onChange={e=>setDraft(p=>({...p,[f.k]:e.target.value}))}/>}
        <span className="etail">{f.tail}</span>
      </div>)}
    <button className="ego yourename" onClick={transform}>
      <span>변신! <span className="kao">⸜( &gt;᎑&lt; )⸝♡</span></span><i className="egostar"/>
    </button>
    </ProfileFrame>
    </div>
  </div>;
}

/* ── 방 목록: 메신저 창 ── */
function RoomList({store,name,unlocked,counts,seenStage,groupOn,onCart,onPlate,onOpen,onProfile,onAuto,autoLoading,onExport,onReadAll,onRename,onReset,onToast,profile,onSaveField,gifts,onGift,hearts,bag,met,onGoPlace,onEnergyBar,onGuess,myDiaryOpen,onMyDiary}){
  const [menu,setMenu]=useState(null);     // 'you'|'edit'|'chat'|'help'
  const [dlg,setDlg]=useState(null);       // 'profile'|'help'|'log'|'find'
  const [confirming,setConfirming]=useState(false);   // etc.의 restart 2단계
  /* 시간표. 그날 처음 열면 한 번 뜨고, 그 뒤로는 버튼으로 다시 본다.
     야자 감독인 주에는 에너지바가 가방에 들어온다 — 그 주에 한 번만. */
  const [wend,setWend]=useState(loadWend);
  const [level,setLevel]=useState("town");    // 지도 두 장 — 마을 길 / 학교 안
  const [tick,setTick]=useState(0);           // 교시가 바뀌면 버튼 글자도 바뀐다
  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),60000);return()=>clearInterval(t)},[]);
  useEffect(()=>{
    const k=dayKey();
    if(loadDaySeen()===k)return;
    saveDaySeen(k); setDlg("timetable");
    if(isYajaWeek())onEnergyBar&&onEnergyBar();
  },[]);
  const fillWend=(k,n,v)=>setWend(w=>{
    const next={...w,[k]:[...(w[k]||[])]}; next[k][n]=v; saveWend(next); return next;
  });
  /* 방문자 카운터용 집계 — 오늘 오간 말 / 전체 말 */
  const allMsgs=ROOMS.flatMap(r=>(store.msgs&&store.msgs[r.id])||[]);
  const t0=new Date(); t0.setHours(0,0,0,0);
  const todayN=allMsgs.filter(m=>m.ts>=t0.getTime()).length;
  const totalN=allMsgs.length;
  /* 실습 남은 날. 교생은 한 달 뒤에 떠난다 — 첫 대화한 날을 D-30으로 잡고
     하루씩 깎는다. 0이 되면 거기서 멈춘다. 앱도 같은 식으로 센다.
     세는 것은 세계 시계 하나다(daysLeft → worldDays). */
  const dLeft=daysLeft(store);
  /* 빈칸 — 이름이 불린 만큼만 채운다. 칸에 글자를 넣지는 않는다:
     채워지는 것은 칸이지 이름이 아니다 */
  const calls=countCalls(store,name);
  const lit=filledLetters(calls,name);
  const letters=(name||"").split("");
  const namePct=Math.min(100,calls/Math.max(1,letters.length*CALL_PER_LETTER)*100);
  const dayN=daysSince(store);
  const [tab,setTab]=useState("rooms");    // 'rooms'|'map'|'cam'|'hidden'
  const [zoom,setZoom]=useState(null);
  /* 지금 커서가 서 있는 잠긴 칸(⑥). 한 번에 하나만 선다 — 열여덟 칸에
     커서가 다 서 있으면 채워야 할 자리가 아니라 서식이 된다 */
  const [guess,setGuess]=useState(null);
  const [typed,setTyped]=useState("");
  useEffect(()=>{setGuess(null);setTyped("")},[tab]);   // 탭을 옮기면 커서도 접는다
  const [now,setNow]=useState(Date.now()); // 접속 상태·쿨타임 갱신용
  const [autoAt,setAutoAt]=useState(loadAutoAt);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
  const left=Math.max(0,autoAt+AUTO_COOL-now);
  const album=seenPhotos(store.msgs);
  const un0=Object.values(store.unread||{}).reduce((a,b)=>a+(b||0),0);
  /* 지도 진행은 실제로 다녀온 자리만 센다. 갈 수 있게 열린 칸은 진행도가 아니다. */
  const visitedN=PLACES.filter(p=>met.includes(p.name)).length;
  useEffect(()=>{ // 바깥 클릭 시 드롭다운 닫기
    if(!menu)return;
    const h=()=>setMenu(null);
    document.addEventListener("click",h);
    return()=>document.removeEventListener("click",h);
  },[menu]);
  const mb=(id,label,onClick)=><span className={"mbtn"+(menu===id?" open":"")}
    onClick={e=>{e.stopPropagation();onClick?onClick():setMenu(menu===id?null:id)}}>{label}</span>;
  return <div className="screen desk glasswindow">
    <Sparkles/>
    <WindowChrome title="NULL messenger"/>
    <div className="menubar">
      {mb("you","you",()=>{setMenu(null);setDlg("profile")})}
      <span className="ddwrap">
        {mb("edit","file")}
        {menu==="edit"&&<div className="dd">
          {/* ⑩ 지금의 일기. 눈금을 지나 열린 장이 있을 때만 선다 —
              늘 서 있으면 「오늘도 안 썼네」가 되고 그러면 일과다.
              알약(숫자)은 안 붙인다. 지우려고 여는 창이 되면 안 쓴다 */}
          {myDiaryOpen&&<div className="dditem" onClick={()=>{setMenu(null);onMyDiary()}}>
            <Sticker.heart size={12} color="#ffb0d4"/> write my diary</div>}
          <div className="dditem" onClick={()=>{setMenu(null);onExport()}}><Sticker.floppy size={15}/> save all (.txt)</div>
          <div className="dditem" onClick={()=>{setMenu(null);setDlg("log")}}><Sticker.heart size={12} color="#c3b2f0"/> my stats</div>
        </div>}
      </span>
      <span className="ddwrap">
        {mb("chat","chat")}
        {menu==="chat"&&<div className="dd">
          <div className="dditem" onClick={()=>{setMenu(null);onReadAll()}}><Sticker.star size={13} color="#ffb0d4"/> mark all read</div>
          <div className="dditem" onClick={()=>{setMenu(null);setDlg("find")}}><Sticker.cursor size={13}/> search</div>
        </div>}
      </span>
      {mb("help","etc.",()=>{setMenu(null);setDlg("help")})}
      {/* 🎁 선물은 메뉴 항목이다 — 버튼은 peek 하나뿐이어야 그게 특별한
          동작으로 보인다. 메뉴바는 조용해야 한다. */}
      <span className="mbtn ico" style={{marginLeft:"auto"}} title="give something"
        onClick={()=>{setMenu(null);onCart()}}><img className="navpixel" src={av("ui/null-gift-icon.png")} alt=""/>gift</span>
      {/* gift는 준 것, bag은 받은 것. 나란히 둔다 — 한쪽만 있으면 주기만 하는 앱이 된다 */}
      {/* 알약은 안 붙인다. 가방은 알림함이 아니라 서랍이다 — 새로 들어온 게
          있다고 숫자가 뜨면 그걸 없애려고 여는 창이 된다 */}
      <span className="mbtn ico" title="what they gave u"
        onClick={()=>{setMenu(null);setDlg("bag")}}><img className="navpixel" src={av("ui/null-bag-icon.png")} alt=""/>bag</span>
      {/* 지금이 몇 교시인지. peek과 같은 단추라서 한 줄에 나란히 선다 */}
      <button className="toolkey nowbtn" title="timetable"
        onClick={()=>setDlg("timetable")}><span>{nowLabel()} ♡</span></button>
      <button className={"toolkey peekbtn"+(left>0&&!autoLoading?" cool":"")}
        title={autoLoading?"peeking...":left>0?"come back later":"see what theyre up 2"}
        onClick={()=>{ if(autoLoading)return;
          if(left>0){onToast("too soon · "+mmss(left));return}
          const t=Date.now(); setAutoAt(t); saveAutoAt(t); onAuto(); }}>
        {autoLoading&&<span className="fill" style={{width:"100%"}}/>}
        {/* 달은 「peek」일 때만 뜬다. 360 폭에서 이 줄은 이미 빠듯해서,
            글자가 길어지는 두 상태(남은 시간·흐르는 중)에는 달이 쓰던
            자리를 글자가 쓴다. 안 그러면 단추가 창 밖으로 밀린다 */}
        {!autoLoading&&left<=0&&<MoonIcon/>}
        <span>{autoLoading?"···":left>0?mmss(left):"peek"}</span>
      </button>
    </div>
    {/* 「time passing...」은 단추에 안 들어간다 — 들어가면 줄이 넘친다.
        전광판이 원래 상태를 흘려보내는 자리라 그 말을 여기서 한다 */}
    <div className="marquee"><span>
      {autoLoading
        ?<>✧ time passing... &nbsp; ♡ &nbsp; 두 사람을 Peeking... <span className="kao">|ૂ•ᴗ•⸝⸝)”♥</span> &nbsp; ✧</>
        :<>✧ welcome 2 NULL ✧ &nbsp; the blank u fill in &nbsp; ✦ &nbsp;
          {un0>0?`you have (${un0}) new message`:"no new message"} &nbsp; ♡ &nbsp; since 2026 &nbsp; ✧</>}
    </span></div>
    <div className="tabs">
      <span className={"tab"+(tab==="rooms"?" on":"")} onClick={()=>setTab("rooms")}>rooms ({roomsOn(groupOn).length})</span>
      <span className={"tab"+(tab==="map"?" on":"")} onClick={()=>setTab("map")}>map</span>
      <span className={"tab"+(tab==="cam"?" on":"")} onClick={()=>setTab("cam")}>cam</span>
      <span className={"tab hid"+(tab==="hidden"?" on":"")} onClick={()=>setTab("hidden")}>.hidden</span>
    </div>
    <div className="roomswrap">
      {BUBBLES.map((b,i)=><span key={i} className="bub"
        style={{left:b[0]+"%",width:b[1],height:b[1],animationDuration:b[2]+"s",animationDelay:b[3]+"s"}}/>)}
      {tab==="rooms"
      ?<div className="rooms">
        {roomsOn(groupOn).map((r,i)=>{
          const ms=store.msgs[r.id]||[], last=ms[ms.length-1], un=store.unread[r.id]||0;
          const watch=r.type==="watch";
          const pr=presence(r.id,gameAt(now));
          /* 프로필이 바뀌었는데 아직 안 열어봤으면 — 아바타 둘레가 돈다 */
          const nu=CHARS[r.id]?stageDiff(r.id,(seenStage||{})[r.id]||0,stageIdx(counts[r.id]||0,dayN)):[];
          return <React.Fragment key={r.id}>
            {watch&&<div className="sectwrap"><span className="sect">LIVE</span></div>}
            <div className={"roomcard"+(watch?" watch":"")} style={{animationDelay:`${i*0.05}s`}} onClick={()=>onOpen(r.id)}>
              <Avatar room={r} onProfile={onProfile} heat={CHARS[r.id]?stageIdx(counts[r.id]||0,dayN):null} nu={nu.length>0}/>
              <div className="rinfo">
                <div className="rtop">
                  <span className="rname">{r.name}</span>
                  {pr&&<span className={"pres "+pr.s}><i/>{pr.t}</span>}
                  {last&&<span className="rtime">{fmtListTime(last.ts)}</span>}
                </div>
                {/* 지문에는 말한 사람이 없다. sender는 user로 저장하지만 그건
                    자리를 채운 값이지 유저가 한 말이 아니다 — 「나: 이재언은
                    자고 있다」로 찍혔다. 내보내기에서 한 번 고친 것과 같은 일이
                    목록에서 또 났다. 지문은 채팅방에서 그러듯 가운뎃점을 앞에 둔다 */}
                <div className={"rprev"+(last&&last.sys?" sys":"")}>{last
                  ?(last.sys?"· ":last.sender==="user"?"나: ":"")
                    +(last.photo?"[사진] "+(last.text||""):last.text)
                  : r.empty.split("\n")[0]}</div>
              </div>
              {un>0&&<span className="rbadge">{un}</span>}
            </div>
          </React.Fragment>;
        })}
          <div className={"nmcard"+(lit>=letters.length?" done":"")}>
          <div className="nmline">
            <span className="k">NULL</span>
            {/* 이름이 한 번 불릴 때마다 실제 폭이 늘어난다. 글자 단위로 뭉쳐
                켜지는 동그라미가 아니라 하나의 연속된 존재 게이지다. */}
            <span className="namegauge" aria-label={`이름 호명 진행 ${Math.round(namePct)}%`}>
              <i style={{width:namePct+"%"}}/>
            </span>
          </div>
        </div>
      </div>
      :tab==="map"
      ?<div className="gal mapscroll">{/* 그림은 길, 버튼은 실제 장소 상태다 */}
        {/* 창 위에 머리글을 안 얹는다. 사물함 그림이 제 머리에 이름표와 빈 홈을
            달고 있어서 같은 것을 하나 더 놓으면 제목도 진도도 두 벌이 된다 —
            진도는 그 빈 홈 안에만 있다(.cabbar).
            학교 안에서 나가는 길은 TV 화면 넷 말고 아무 데나 누르는 것이다 */}
        {/* ── 사물함 여덟 칸 ── */}
        {(()=>{
          const cabinet=()=><div className="cab">
            <img className="cabframe" src={av("cab-icons/frame.webp")} alt="" aria-hidden="true"/>
            {/* 그림 머리의 빈 홈 */}
            <span className="cabbar">
              <i style={{width:(visitedN/SPOTS.length*100)+"%"}}/>
              <b>{visitedN} / {SPOTS.length}</b>
            </span>
            {CAB_SLOT.map((s,i)=>{
              const style={left:CAB_COL[i%2]+"%",top:CAB_ROW[i>>1]+"%",width:CAB_DOOR_W+"%"};
              /* START와 NULL은 자리가 아니다. 열 것도 잠글 것도 없다 */
              if(s.kind)return <span key={s.kind} className="cabdoor plate" style={style}
                role="button" tabIndex={0}
                onClick={()=>onPlate(s)}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onPlate(s)}}}
                aria-label={s.say}>
                <img src={av(`cab-icons/${s.kind}.webp`)} alt=""/></span>;
              const p=PLACE_BY[s.place], open=placeOpen(p,met);
              /* 못 가는 이유는 셋이다 — 시간, 주말 전용, 오늘 이미 다녀옴.
                 문에는 흐리게만 알리고 왜인지는 눌렀을 때 창이 말한다 */
              /* 문의 「지금 갈 수 있나」와 GO! 의 판정은 같은 함수여야 한다.
                 마주치는 자리는 나와 있는 사람이 곧 문이다 — 아무도 없는데
                 열린 문으로 그려놓으면 눌러도 아무 일이 안 난다 */
              const nowOk=canGoNow(p);
              const been=p.into?false:met.includes(p.name);
              /* 잠긴 문도 눌린다. 눌러도 아무 일이 없으면 고장 난 것처럼 보인다 —
                 왜 안 되는지는 창이 말한다 */
              /* 학교는 자리가 아니라 문이다. 물어보지 않고 바로 안으로 들어간다 */
              const go=p.into?()=>setLevel(p.into):()=>onGoPlace(p.name);
              return <span key={p.name}
                className={"cabdoor"+(open?"":" lock")+(open&&!nowOk&&!p.into?" shut":"")+(been?" been":"")}
                style={style}
                role="button" tabIndex={0}
                onClick={open?go:()=>onGoPlace(p.name)}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();
                  open?go():onGoPlace(p.name)}}}
                /* 문이 닫힌 것과 사람이 없는 것은 다른 일이다 — 여는 시각을
                   읽어주면 그 시각에 가도 못 가는 자리를 기다리게 된다 */
                aria-label={(ROAD_LABEL[p.icon]||"PLACE")+(open
                  ?(nowOk||p.into?"":(placeHours(p)&&wendOnlyOk(p)&&!goneToday(p.name)
                    ?" · EMPTY NOW":" · CLOSED NOW"))
                  :" · LOCKED")}>
                <img src={av(`cab-icons/${p.icon}-${open?"open":"lock"}.webp`)} alt=""/></span>;
            })}
          </div>;
          if(level==="town")return cabinet();
          /* 학교 문을 누르면 그 문이 열린 사물함으로 바뀐다. 열린 칸 안에
             TV가 있고 그 안에 학교 네 자리가 있다 — 원화가 사물함 한 장으로
             그려져 있어서 잘라 띄우지 않는다. 마을과 같은 자리, 같은 크기다 */
          /* 나갈 데가 머리글 하나뿐이면 못 찾는다. TV 화면 넷 말고는
             어디를 눌러도 닫힌다 — 열린 문짝도 「닫기」다. 문을 눌러 닫는 건
             제일 먼저 해보는 손짓이다 */
          return <div className="cabin" role="button" tabIndex={0}
            onClick={()=>setLevel("town")}
            onKeyDown={e=>{if(e.key==="Escape"||e.key==="Enter"){e.preventDefault();setLevel("town")}}}>
            <div className="cab cabpop">
              <img className="cabframe" src={av("cab-icons/open.webp")} alt="" aria-hidden="true"/>
              {/* 그림 머리의 빈 홈은 여기도 있다. 마을에서만 차 있고 여기는
                  비어 있으면 같은 사물함인데 한쪽만 덜 그린 것처럼 보인다 */}
              <span className="cabbar">
                <i style={{width:(visitedN/SPOTS.length*100)+"%"}}/>
                <b>{visitedN} / {SPOTS.length}</b>
              </span>
              {PLACES.filter(p=>p.map==="school").map(p=>{
                const q=TV_QUAD[p.name]; if(!q)return null;
                const open=placeOpen(p,met), nowOk=canGoNow(p);
                /* 다녀온 표시는 안 한다. TV 화면 위에 테두리를 두르면
                   그림 위에 그림이 하나 더 얹힌다 */
                /* 여기서 클릭을 멈춘다. 안 멈추면 바깥의 「닫기」까지 굴러가서
                   자리를 고르자마자 사물함이 닫히고 창만 덩그러니 남는다 */
                const go=e=>{if(e)e.stopPropagation();onGoPlace(p.name)};
                return <span key={p.name}
                  className={"tvq"+(open?"":" lock")+(open&&!nowOk?" shut":"")}
                  style={{left:q.x+"%",top:q.y+"%",width:TV_QUAD_W+"%",height:TV_QUAD_H+"%"}}
                  role="button" tabIndex={0}
                  onClick={go}
                  onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go(e)}}}
                  aria-label={(ROAD_LABEL[p.icon]||"PLACE")+(open?(nowOk?"":" · CLOSED NOW"):" · LOCKED")}/>;
              })}
            </div>
          </div>;
        })()}
      </div>
      :tab==="cam"
      ?<div className="gal">{/* Cam: 받은 사진과 자리에서 본 사진. 안 겪은 건 존재하지 않는다.
            자리 사진은 말풍선이 아니라 배경이라 대화 기록에 안 남는다 —
            seenPhotos가 따로 적어둔 것을 같이 들고 온다 */}
        {(()=>{
          /* 모은 것 중 지금 gallery에 있는 것만 그린다. 갤러리에서 빠진 사진은
             파일도 같이 지워졌으므로 그려봐야 깨진 그림이 된다.
             안내문은 album이 비었을 때가 아니라 그릴 것이 없을 때 띄운다 —
             모은 것은 있는데 전부 옛 목록이면, 전에는 섹션도 안내문도 없이
             백지가 됐다. 화풍을 갈면서 재언 갤러리를 스물둘에서 아홉으로
             줄였더니 실제로 그렇게 됐다. */
          const secs=Object.entries(CHARS).map(([id,ch])=>{
            const got=ch.gallery.filter(f=>album.has(f.replace(/\.webp$/,"")));
            if(!got.length)return null;
            return <React.Fragment key={id}>
              <div className="sect">✧ {ch.name} · {got.length} pics</div>
              <div className="galgrid">
                {got.map(f=><img key={f} src={f} alt="" loading="lazy" onClick={()=>setZoom({src:f})}/>)}
              </div>
            </React.Fragment>;
          }).filter(Boolean);
          /* 유저 몫 — 받은 사진이 아니라 자기가 채운 것이라 두 사람 다음에
             자기 이름으로 선다. 엽서는 눌러서 뒤집는다 */
          const mine=userPics(name);
          if(mine.length)secs.push(<React.Fragment key="__me">
            <div className="sect">✧ {name||"당신"} · {mine.length} pics</div>
            <div className="galgrid">
              {mine.map(m=><img key={m.src} src={m.src} alt="" loading="lazy" onClick={()=>setZoom(m)}/>)}
            </div>
          </React.Fragment>);
          return secs.length?secs:<div className="empty" style={{marginTop:60}}>
            <span style={{fontSize:13,color:"#ff8fbe"}}>✧ ✦ ✧</span><br/>
            nothing here yet{"\n"}whatever they send lands here
          </div>;
        })()}
      </div>
      :<div className="gal hiddenGal">{/* .hidden 탭: 잠긴 기록 */}
        <div className="progline">
          <span className="t">ENCRYPTED</span>
          <span className="bar"><i style={{width:(unlocked.length/HIDDEN.length*100)+"%"}}/></span>
          <span className="n">{unlocked.length} / {HIDDEN.length}</span>
        </div>
        <div className="galgrid">
          {HIDDEN.map(h=>{
            const un=unlocked.includes(h.key);
            /* 잠긴 칸을 누르면 이름 자리에 커서가 선다. 제목을 맞히면 열린다 —
               맞혔다고 알려주는 화면은 없다. 열린 칸이 답이다.
               틀렸다고 말해주는 화면도 없다. 계속 서 있는 커서가 그 말이다. */
            const typing=guess===h.key;
            return <div key={h.key} className={"hcell"+(un?"":" lock")}
              onClick={()=>un?setZoom({src:h.file,label:h.label,
                note:(h.note||"").replace("{name}",name||"당신")}):setGuess(h.key)}>
              <img src={av(h.file)} alt="" loading="lazy"/>
              {!un&&<div className="hlock"><LockIcon/></div>}
              {un
                ?<div className="hlabel">{h.label}</div>
                :typing
                  ?<input className="hlabel hid hin" autoFocus maxLength={HID_MAX} value={typed}
                     placeholder={hidMask(h.label)} aria-label="제목"
                     onClick={e=>e.stopPropagation()}
                     onBlur={()=>{setGuess(null);setTyped("")}}
                     onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape")e.target.blur()}}
                     onChange={e=>{const v=e.target.value; setTyped(v);
                       /* 다 치는 순간 열린다. 확인 단추가 없는 이유는 그게
                          「제출」이 되고, 제출에는 채점이 따라붙기 때문이다 */
                       if(hidGuess(h.key,v)){setGuess(null);setTyped("");onGuess(h.key)}}}/>
                  :<div className="hlabel hid">{hidMask(h.label)}</div>}
            </div>;
          })}
        </div>
        <div className="hnote">LOCK! UNLOCK?<br/>keep talking · or type the name u already know</div>
      </div>}
    </div>
    <div className="statusbar"><span>the blank u fill in ♡ NULL v1.1{demoOn()?" · demo":""}</span><span>{fmtClock(Date.now())}</span></div>
    {dlg==="bag"&&<Bag bag={bag||[]} store={store} onClose={()=>setDlg(null)}/>}
    {dlg==="timetable"&&<Timetable wend={wend} onFillWend={fillWend} onClose={()=>setDlg(null)}/>}
    {dlg==="profile"&&<ProfileDialog name={name} profile={profile} onSaveField={onSaveField}
      onRename={onRename} onClose={()=>setDlg(null)}/>}
    {dlg==="log"&&<Dialog title="my stats" onClose={()=>setDlg(null)}>
      <LogPanel store={store} counts={counts} unlocked={unlocked} album={album}/>
    </Dialog>}
    {dlg==="find"&&<Dialog title="search" onClose={()=>setDlg(null)}>
      <FindPanel store={store} name={name} onOpen={id=>{setDlg(null);onOpen(id)}}/>
    </Dialog>}
    {dlg==="help"&&<Dialog title="etc." win="etcwin" cls="etc" onClose={()=>{setDlg(null);setConfirming(false)}}>
      <div className="etcglit"/>
      <div className="etccd"/>
      <div className="etchi">안녕, NULL 기다렸어. ✧</div>
      <div className="etcsub">the blank u fill in</div>
      <div className="etcdiv">♡ ・ ♡ ・ ♡</div>
      <div className="etcrow"><span className="etctag">D-{dLeft} ♡</span></div>
      <div className="etcstk">
        {["✿","★","♡","✧","☾"].map((x,i)=><span key={i} style={{color:["#c3b2f0","#b9a7e6","#a78fe0","#8fd8e8","#d5c8ff"][i]}}>{x}</span>)}
      </div>
      {/* 되돌릴 수 없다는 말보다 숫자가 손을 멈춘다. 지우는 건 기록만이 아니라
          시계와 해금까지다 — 그걸 글로 쓰지 말고 지금 상태로 보여준다. */}
      {!confirming
        ?<div className="etcrow" style={{marginTop:18}}>
          <button className="etcdel" onClick={()=>setConfirming(true)}><span className="rr">↺</span>restart</button>
        </div>
        :<div className="etcwarn">
          <div className="w">delete it all?? 4 real??</div>
          <div className="n">no take backs ♡ everything goes bye</div>
          <div className="n2">d-{dLeft} · hidden {unlocked.length}/{HIDDEN.length} · {totalN} words</div>
          <div className="dlgbtns">
            <button className="wbtn" onClick={()=>setConfirming(false)}>nvm ♡</button>
            <button className="wbtn kill" onClick={onReset}>yes rly</button>
          </div>
        </div>}
    </Dialog>}
    <PhotoWin shot={zoom} onClose={()=>setZoom(null)}/>
  </div>;
}

