/* NULL web UI · day bar, developer clock, chat room
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
/* ── 채팅방 ── */
/* 실습 남은 날을 칸으로 그린다. 서른 칸이 다 차 있다가 하루 지날 때마다
   앞에서 한 칸씩 빈다. 오늘 칸만 분홍이다.
   숫자를 안 쓰는 이유 — 숫자는 읽어야 알고 칸은 보면 안다. */
function DayBar({left}){
  const gone=ENROLL_DAYS-left;
  return <div className="dbar" title={"실습 D-"+left}>
    {Array.from({length:ENROLL_DAYS},(_,i)=>
      <i key={i} className={i<gone?"gone":i===gone?"now":""}/>)}
    <DevTime left={left}/>
  </div>;
}
/* ── 개발 전용 시간 이동 ──
   한 판에 서른 날을 봐야 할 때가 있다. 공개 스피드 모드의 비율은 세계의
   속도지 시험 도구가 아니라서 건드리면 안 된다 — 「지금」에만 오프셋을
   더하는 단추 셋을 따로 둔다. 과거 말풍선의 시각도 출발 자리도 안 움직인다.
   DEV_TIME이 꺼진 빌드에서는 아무것도 안 그린다. 콘솔 한 줄로 켤 수 있게
   두면 테스터의 판이 조용히 달라진다. */
function DevTime({left}){
  if(!DEV_TIME)return null;
  /* 옮긴 뒤에는 새로 그린다. D-일차·도장·시간표·해금이 저마다 다른 자리에서
     계산되고 일부는 ref에 얹혀 있어서, 여기서 state 하나 흔들어봐야 절반만
     따라온다 — 반쯤 옮겨간 세계가 제일 헷갈린다. 오프셋은 저장돼 있으니
     다시 켜지면 옮긴 자리 그대로다. */
  const go=fn=>{ fn(); location.reload() };
  return <span className="devtime">
    <button onClick={()=>go(()=>devAddDay(1))}>+1d</button>
    <button onClick={()=>go(()=>devToLeft(left,7))}>D-7</button>
    <button onClick={()=>go(()=>devToLeft(left,0))}>D-0</button>
  </span>;
}
/* 장면 모드에서 보여줄 줄 수. 한 턴에 말풍선이 두셋 나오니 대여섯이면
   방금 오간 말이 다 보이고, 그 위는 사진에 자리를 내준다. */
const SCENE_LINES=6;
/* ── 대사 고치기 ──
   인물이 이상한 말을 하면 그 말풍선을 눌러 고쳐 쓴다. 화면의 말이 바뀌고,
   이력이 대화 목록에서 만들어지므로 다음 턴부터 인물은 자기가 그렇게 말한
   걸로 안다. 고친 것은 원문과 짝으로 따로 쌓인다.
   길게 누르기(600ms)와 우클릭 둘 다 연다 — 손가락과 마우스가 다 있어야 한다.
   짧게 누르는 것은 원래 하던 일(사진 확대)이라 안 건드린다.
   고친 말풍선에는 모서리에 ✎가 붙는다. 어디를 손봤는지 보이게. */
function ChatRoom({room,msgs,busy,failed,onBack,onSend,onRetry,onProfile,dLeft,scene,onLeaveScene,onMinimize,onCart,fixed,onFix,locked}){
  const [v,setV]=useState("");
  const [zoom,setZoom]=useState(null);   // 사진 확대해서 보기
  /* 고칠 것 메모. 말풍선을 길게 누르거나(600ms) 우클릭하면 열린다 —
     손가락과 마우스가 다 있어야 한다. 짧게 누르는 것은 원래 하던 일
     (사진 확대)이라 안 건드린다. */
  const [fixing,setFixing]=useState(null);
  const [draft,setDraft]=useState("");
  const holdRef=useRef(null);
  /* 원문을 그대로 채워 연다. 한 낱말만 손보는 일이 대부분이라 빈 칸으로 열면
     다시 타이핑하게 된다 */
  const openFix=m=>{ setDraft(m.text||""); setFixing(m) };
  const stopHold=()=>clearTimeout(holdRef.current);
  const hold=m=>({
    onContextMenu:e=>{e.preventDefault();openFix(m)},
    onPointerDown:()=>{stopHold();holdRef.current=setTimeout(()=>openFix(m),600)},
    onPointerUp:stopHold, onPointerLeave:stopHold, onPointerCancel:stopHold,
  });
  const saveFix=()=>{ if(onFix&&onFix(fixing.id,draft))setFixing(null) };
  const boxRef=useRef(null);
  /* 자리(scene)와 메신저는 돌아가는 자리가 다르다. 창은 하나로 두고 둘 다에 건다 */
  const fixBox = fixing && <div className="dlgov" onClick={()=>setFixing(null)}>
    <div className="dlg" onClick={e=>e.stopPropagation()}>
      <div className="tb">이렇게 말했어야지<WinDots onClose={()=>setFixing(null)}/></div>
      <div className="dlgbody">
        <div className="fixwas">{fixing.text||"(사진)"}</div>
        <textarea className="fixin sunken" value={draft} autoFocus maxLength={400}
          onChange={e=>setDraft(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))saveFix()}}/>
        <div className="askrule">고치면 얘는 이렇게 말한 걸로 알아요 <span className="kao">✎</span></div>
        <div className="dlgbtns">
          <button className="bevel pink" disabled={!draft.trim()||draft.trim()===(fixing.text||"")}
            onClick={saveFix}>이걸로</button>
          <button className="bevel" onClick={()=>setFixing(null)}>됐어요</button>
        </div>
      </div>
    </div>
  </div>;
  const watch=room.type==="watch";
  /* 훅은 아래 자리 분기(early return)보다 위에 있어야 한다.
     분기 뒤에 두면 자리에 들어가고 나올 때 훅 개수가 달라져서 리액트가 터진다. */
  useEffect(()=>{const el=boxRef.current;if(el)requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight})},[msgs.length,busy,failed]);
  const send0=()=>{const t=v.trim();if(!t||busy)return;setV("");onSend(t)};
  /* ── 자리에 가 있을 때 ──
     말풍선을 걷고 사진 위에 말만 얹는다. 지나간 말은 흘려보낸다 —
     돌아가면 방에 그대로 남아 있으니 사라지는 게 아니다. */
  /* 들어간 순간엔 빈 방이다. 그 사람이 입을 열면 그 사람이 화면이 된다 —
     몇 턴 세지 않고 첫 답을 기준으로 한다. 세면 임의고 첫마디면 이유가 있다. */
  /* 귀갓길은 지도 자리가 아니라 PLACE_BG에 없다. 그럴 땐 자리가 자기 배경을 들고 온다 */
  const bg=scene&&(scene.shot||scene.bg||PLACE_BG[scene.place]);
  if(scene){
    /* 이 자리에 온 뒤에 오간 말만 보여준다.
       방의 마지막 여섯 줄을 그냥 깔았더니, 아까 문자로 주고받던 말이 교실
       배경 위에 얹혀서 여기서 한 말처럼 보였다 — 선물 받은 반응이 교실에서
       나오고 첫 연락이 교실에서 나왔다. 자리는 방의 연장이 아니라 장면이다. */
    const tail=msgs.filter(m=>!m.sys&&(m.text||"").trim()&&m.ts>=(scene.since||0)).slice(-SCENE_LINES);
    const shotFocus=scene.shot?" scene-person-shot":"";
    return <div className={`screen scenewrap glasswindow${shotFocus}`} style={bg?{backgroundImage:`url("${bg}")`}:null}>
      <WindowChrome title={scene.place} onClose={onMinimize}/>
      <div className="scenebody">
        <div className="scenelines">
          {tail.map((m,i)=>{
            const me=m.sender==="user";
            const prev=tail[i-1];
            const head=!me&&(!prev||prev.sender!==m.sender);
            return <div key={m.id||i} className={"sline"+(me?" me":"")}>
              {head&&<div className="sname">{(CHARS[m.sender]||{}).name||m.sender}</div>}
              {m.photo
                ?<img className="sphoto" src={photoSrc(m.photo)} alt="" onClick={()=>setZoom(photoSrc(m.photo))}/>
                :null}
              {m.text&&<div className={"stext"+(fixed&&fixed.has(m.id)?" fixed":"")}
                            {...(me?{}:hold(m))}>{m.text}</div>}
            </div>;
          })}
          {busy&&!failed&&<div className="sline"><div className="stext dim">…</div></div>}
          {failed&&<button className="retry" onClick={onRetry}>
            no reply... try again?
            {failed.detail&&<span className="why">{failed.detail}</span>}
          </button>}
        </div>
      </div>
      <div className="inputbar scenebar">
        <button className="backbtn rbtn" onClick={onLeaveScene} title="돌아가기"><BackIcon/></button>
        {/* 선물은 만나서만 준다. 그러니 단추도 만난 자리에 있어야 한다 —
            메뉴바에만 두면 자리에서는 열 수가 없다 */}
        <button className="giftbtn rbtn" onClick={onCart} title="give something">
          <img className="ico" src={av("ui/null-gift-icon.png")} alt=""/>
        </button>
        <input className="sunken" value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send0()}/>
        <button className="sendbtn rbtn" disabled={!v.trim()||busy} onClick={send0}
          style={{background:sendBg(room)}}><SendIcon/></button>
      </div>
      <PhotoWin shot={zoom} onClose={()=>setZoom(null)}/>
      {fixBox}
    </div>;
  }
  const send=()=>{const t=v.trim();if(!t||busy)return;setV("");onSend(t)};
  const senderMeta=s=>s==="user"?null:(CHARS[s]||{name:s,color:"#9aa3d8",pale:"#e2e6f5",dk:"#6b5fa8"});
  return <div className={"screen chatwrap glasswindow"+(watch?" watchbg":"")}>
    <WindowChrome title={room.name+(watch?".cam":".chat")} onClose={onBack}/>
    <div className="chatbar">
      <button className="backbtn bevel" onClick={onBack}><BackIcon/></button>
      <Avatar room={room} size={31} onProfile={onProfile}/>
      <div>
        <div className="cname">{room.name}</div>
        <div className="csub">
          {watch?<><span className="rec"/> watching</>:room.sub}
          {!watch&&<DayBar left={dLeft}/>}
        </div>
      </div>
    </div>
    <div className="msgs" ref={boxRef}>
      {/* 아직 출근하지 않은 사람 — 화면 한가운데. 빈 방 안내와 같은 자리·
          같은 보라색이다. 방이 빈 것은 맞지만 까닭이 다르니 글만 바꾼다 */}
      {locked?<div className="empty lockempty">
        {locked.map((t,i)=><React.Fragment key={i}>{i?<br/>:null}{t}</React.Fragment>)}
      </div>
      :msgs.length===0&&!busy&&room.empty&&<div className="empty">
        <span style={{fontSize:13,color:"#ff8fbe"}}>✧ ✦ ✧</span><br/>{room.empty}
      </div>}
      {msgs.map((m,i)=>{
        const prev=msgs[i-1];
        const gap=dividerGap(prev&&prev.ts,m.ts);
        const me=m.sender==="user";
        const meta=senderMeta(m.sender);
        // 클러스터 시작. 지문 줄이 끼면 흐름이 끊기므로 다음 말은 프로필부터 다시 보여준다
        const head=gap||!prev||prev.sender!==m.sender||isNarr(prev);
        const showName=head&&!me&&(room.type==="group"||watch);
        return <React.Fragment key={m.id||i}>
          {gap&&<div className="divider">✦ {fmtDivider(m.ts)} ✦</div>}
          {isNarr(m)
          ?<div className="narr">{m.text}</div>
          :<div className={"mrow"+(me?" me":"")} style={{marginTop:head?8:0}}>
            {!me&&(head?
              <div className={"mavatar"+(meta.img?" face":"")+(CHARS[m.sender]?" clickable":"")}
                   onClick={()=>CHARS[m.sender]&&onProfile&&onProfile(m.sender)}
                   style={meta.img?faceBg(meta):{background:`linear-gradient(180deg,#ffffff, ${meta.pale}`+")"}}>{!meta.img&&<CharIcon id={m.sender} size={13}/>}</div>
              :<div className="sp"/>)}
            <div className="mcol">
              {showName&&<span className="mname" style={{color:meta.dk}}>{meta.name}</span>}
              <div className={"bubble"+(m.photo?" photo":"")+(fixed&&fixed.has(m.id)?" fixed":"")}
                   {...(me?{}:hold(m))}
                   style={me?{background:`linear-gradient(135deg, ${rgba(room.color,.5)} 0%, #ffffff 135%)`}:null}>
                {m.photo
                  ?<React.Fragment>
                    <img src={photoSrc(m.photo)} alt="" loading="lazy" onClick={()=>setZoom(photoSrc(m.photo))}/>
                    {m.text&&<div className="cap">{m.text}</div>}
                  </React.Fragment>
                  :m.text}
              </div>
            </div>
          </div>}
        </React.Fragment>;
      })}
      {/* ── 실패가 타이핑보다 앞선다 ──
          전에는 busy면 단추를 숨겼다. 그런데 저장이 실패한 방은 「이어서
          할 것이 남았다」는 뜻으로 잠긴 채(busy)로 둔다 — 그러면 복구할
          정보가 있는데도 유저가 누를 수가 없었다. 둘을 같이 띄우지 않는다. */}
      {busy&&!failed&&<div className="mrow" style={{marginTop:8}}>
        <div className="mavatar" style={{background:"#ece8fa"}}/>
        <div className="bubble typing"><i/><i/><i/></div>
      </div>}
      {failed&&<button className="retry" onClick={onRetry}>
        no reply... try again?
        {failed.detail&&<span className="why">{failed.detail}</span>}
      </button>}
    </div>
    {watch?
      <div className="watchbar"><span className="rec"/>u can't join this one</div>
      /* 아직 출근하지 않은 사람 — 까닭은 화면 한가운데가 말한다.
         여기는 자리를 그대로 두고 못 쓰게만 한다. 입력창을 빼버리면
         방을 열 때마다 화면이 흔들린다. */
      :<div className={"inputbar"+(locked?" locked":"")}>
        <button className="giftbtn rbtn" disabled={!!locked} onClick={onCart} title="give something">
          <img className="ico" src={av("ui/null-gift-icon.png")} alt=""/>
        </button>
        <input className="sunken" value={locked?"":v} disabled={!!locked}
          onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <button className="sendbtn rbtn" disabled={!!locked||!v.trim()||busy} onClick={send} style={{background:sendBg(room)}}><SendIcon/></button>
      </div>}
    <PhotoWin shot={zoom} onClose={()=>setZoom(null)}/>
    {fixBox}
  </div>;
}

