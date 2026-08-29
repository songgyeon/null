/* NULL web UI · splash, enrollment, confirmation, intro
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
/* ── 오프닝 ──
   Y2K 데스크톱 한 장. 도는 CD, 올라오는 방울, 흩어진 가짜 오류창.
   설명하는 문장이 없다 — 오류창이 대신 말한다. "당신을 찾을 수 없습니다".
   그래서 이름 칸이 이 화면에 같이 있다. 이름을 넣는 것이 그 오류를 지우는 일이다.

   로고곡은 여기서 돌고 들어갈 때 페이드아웃된다. 브라우저는 사용자가 이 페이지에서
   아무것도 누르기 전에는 소리를 막으므로(자동재생 정책), 막히면 아무 데나 누를 때
   다시 켠다. 아래 글자가 지금 어느 쪽인지 알려준다. */
// 저장소에 같이 있는 파일이라 상대 경로로 잡는다 (R2를 안 거친다)
const LOGO_TRACK="null-logo.mp3";
const BOOT_VOL=.55;   // 앱(App.tsx)의 BOOT_VOL과 같아야 한다

/* 방울 — 음악과 같이 올라온다. [왼쪽%, 지름, 한 바퀴 초, 시작 지연] */
const BUBS=[[8,26,15,0],[22,14,11,1.4],[37,34,18,.6],[52,18,13,2.2],[68,44,21,.2],[80,20,12.5,3],[91,30,16,1.8]];
const Bubbles=()=><div className="bubbles">{BUBS.map((b,i)=>
  <span key={i} className="bub" style={{left:b[0]+"%",width:b[1],height:b[1],
    animationDuration:`${b[2]}s,${(b[2]*0.28).toFixed(1)}s`,animationDelay:b[3]+"s"}}/>)}</div>;

function Splash({onEnter}){
  const [v,setV]=useState("");
  const [armed,setArmed]=useState(false);   // 자동재생이 됐는가
  const audio=useRef(null);
  useEffect(()=>{
    const a=new Audio(LOGO_TRACK); a.volume=0; a.loop=true; audio.current=a;
    a.play().then(()=>setArmed(true)).catch(()=>setArmed(false));
    /* loop만 켜두면 끝에서 앞으로 뚝 끊긴다. 끝 2.2초를 줄이고 처음 1.2초를 올려
       한 바퀴 돌 때 숨을 한 번 쉬는 것처럼 들리게 한다. timeupdate는 초당 네 번쯤이라
       그 간격으로 볼륨을 만지면 지직거려서, 50ms로 직접 잰다. */
    const ramp=setInterval(()=>{
      const d=a.duration, t=a.currentTime;
      if(!d||!isFinite(d)){a.volume=BOOT_VOL;return}
      const up=Math.min(1,t/1.2), down=Math.min(1,Math.max(0,d-t)/2.2);
      a.volume=BOOT_VOL*Math.min(up,down);
    },50);
    return()=>{
      clearInterval(ramp);   // 나가는 페이드와 싸우지 않게 먼저 끈다
      const f=setInterval(()=>{if(a.volume>.06)a.volume-=.06;else{a.pause();clearInterval(f)}},60);
      setTimeout(()=>{clearInterval(f);a.pause()},900);
    };
  },[]);
  const wake=()=>{const a=audio.current;if(!armed&&a)a.play().then(()=>setArmed(true)).catch(()=>{})};
  const go=()=>{const t=v.trim();if(t)onEnter(t)};

  /* ── 키보드가 올라와도 오프닝은 안 줄인다 ──
     index.html이 interactive-widget=resizes-content를 주고 있어서, 키보드가
     올라오면 창 높이가 그만큼 줄어든다. 채팅 화면은 그래야 입력칸이 키보드
     바로 위에 붙는다. 그런데 이 화면의 좌표는 전부 높이의 %라, 높이가 줄면
     아래 창 셋이 서로를 깔고 앉는다 — 370×430에서 재봤다:
         w1 235..339 · w2 312..392 · w3 376..417   (두 번 겹친다)
     그림들은 폭으로 높이가 정해져서(aspect-ratio) 저희끼리는 안 줄어드는데
     자리만 위로 당겨지기 때문이다.
     그래서 키보드가 없을 때의 높이를 재서 못박는다. 키보드가 올라오면 아래가
     잘릴 뿐 겹치지는 않는다 — 입력칸은 높이의 35% 자리라 잘리는 데 안 들어간다.
     타이핑 중에는 다시 재지 않는다. 그때 재면 줄어든 높이를 못박게 된다.

     못박는 것은 **좌표 상자(.spstack)뿐**이다. 배경은 .screen.splash에
     cover로 깔려 있어서, 화면까지 같이 늘리면 배경이 늘어난 상자를 덮느라
     확대되고 보이는 칸에는 그 윗동강만 남는다 — 실제로 그렇게 날아갔다.
     배경은 보이는 칸에 두고 좌표만 못박는다. */
  const box=useRef(null);
  const [ph,setPh]=useState(0);
  useEffect(()=>{
    const typing=()=>{const a=document.activeElement;
      return !!a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA")};
    const fit=()=>{const n=box.current;
      if(!n||!n.parentNode||typing())return;
      setPh(n.parentNode.clientHeight||0)};
    fit();
    window.addEventListener("resize",fit);
    window.addEventListener("orientationchange",fit);
    return()=>{window.removeEventListener("resize",fit);
      window.removeEventListener("orientationchange",fit)};
  },[]);

  return <div className="screen splash" ref={box} onClick={wake}>
    <Bubbles/>
    <Sparkles/>
    <div className="spstack" style={ph?{height:ph+"px",bottom:"auto"}:null}>
      <span className="spcd"/>
      <div className="spcard">
        <div className="sptb">null.exe<WinDots/></div>
        <div className="spbody">
          <div className="splogo">NULL<i className="cur">_</i></div>
          <input className="spinput" value={v} maxLength={12} placeholder="안녕, 널 입력해줘."
            onChange={e=>setV(e.target.value)} onFocus={wake} onKeyDown={e=>e.key==="Enter"&&go()}/>
          <button className="spgo" disabled={!v.trim()} onClick={go}>Click!</button>
        </div>
      </div>
      {/* 이 화면에서 이야기를 말하는 건 이 셋뿐이다 */}
      <div className="spwin w1" style={{animationDelay:".2s"}}>
        <div className="sptb" style={{background:"linear-gradient(90deg,#b9a8ea,#8a7fc0)"}}>Error<WinDots/></div>
        <div className="spbd">이름을 입력해야 존재할 수 있어요.<div className="spbtn">ok</div></div>
      </div>
      {/* 커서는 창에 매달아 둔다 — 좌표로 놓으면 글자를 깔고 앉는다 */}
      <div className="spcurwrap w2">
        <div className="spwin" style={{animationDelay:".35s"}}>
          <div className="sptb" style={{background:"linear-gradient(90deg,#ff7fae,#ff5fa8)"}}>System error<WinDots/></div>
          <div className="spbd">당신을 찾을 수 없습니다.<div className="spbtn">Cancel</div></div>
        </div>
      </div>
      <div className="spwin w3" style={{animationDelay:".5s"}}>
        <div className="sptb" style={{background:"linear-gradient(90deg,#8fd8e8,#c3b2f0)"}}>loading...<WinDots/></div>
        <div className="spbd" style={{background:"#fff8fc"}}>
          <span className="spbar"><i/></span>
        </div>
      </div>
      <div className="sptap">{armed?"♪ NULL!":"TAP FOR MUSIC ♪"}</div>
    </div>
  </div>;
}

/* ── 등록 화면 ── 이름을 넣은 직후 한 번. 여기서 채운 것이 그대로 서버로 간다. */
const ENR_FIELDS=[
  {k:"subject",  lab:"SUBJECT", tail:"과목 교생"},
  {k:"age",      lab:"AGE",     tail:"세", w:52},
  {k:"likes",    lab:"LIKES",   tail:"를 좋아하고"},
  {k:"dislikes", lab:"HATES",   tail:"를 싫어한다"},
];
/* 등록 화면의 창틀. 다른 창이 이 모양을 흉내 내지 않고 이 부품을 그대로 쓴다. */
function WindowChrome({title="NULL.exe",onClose}){
  return <React.Fragment>
    <div className="etb"><WinDots onClose={onClose}/></div>
    <div className="ewindowtitle">{title}</div>
  </React.Fragment>;
}
function ProfileFrame({title="NULL.exe",onClose,children,compact=false,frameClass="",bodyClass=""}){
  return <div className={`ecard profileframe glasswindow${compact?" compact":""}${frameClass?" "+frameClass:""}`}>
    <WindowChrome title={title} onClose={onClose}/>
    <div className={`ebody${bodyClass?" "+bodyClass:""}`}>{children}</div>
  </div>;
}

function Enroll({name,profile,onSaveField,onRename,onDone,onClose,mode,onMode}){
  const [out,setOut]=useState(false);
  /* 진행 막대를 그림 다섯 장으로 갈아끼우던 때는 첫 요청에 한 칸이 비어
     보여서 미리 받아뒀다. 지금은 막대가 CSS 한 줄(width %)이라 받아올 것이
     없다 — 미리 받기도 같이 걷는다 */
  /* 등록 화면인데 정작 이름만 못 고쳤다. 오타를 내면 방 목록의 edit 메뉴까지
     가야 했는데, 그때는 이미 두 사람이 그 이름으로 부르기 시작한 뒤다. */
  const [edit,setEdit]=useState(false);
  const [nv,setNv]=useState(name||"");
  useEffect(()=>setNv(name||""),[name,edit]);
  const saveName=()=>{setEdit(false);const t=nv.trim();if(t&&t!==name)onRename(t)};
  /* 한 칸 채우고 엔터를 치면 다음 칸이 열린다. 네 칸을 채우는 데 클릭이
     네 번 필요할 이유가 없다. -1은 아무 칸도 안 열린 상태다. */
  const [focus,setFocus]=useState(-1);
  /* 모드는 물어보고 바꾼다. 지금 켜진 걸 눌러도 창은 뜬다 —
     무엇을 고른 건지 다시 읽을 자리가 여기밖에 없다 */
  const [askMode,setAskMode]=useState(null);
  /* 다섯 칸을 센다 — 이름·SUBJECT·AGE·LIKES·HATES. AGE는 세계가 정한
     값이라 처음부터 차 있고, 그래서 이름만 넣은 판은 2/5에서 시작한다.
     막대와 글자가 같은 수를 봐야 한다. 전에는 막대가 넷을 세고 글자가
     넷을 세는데 막대에는 다섯 칸이 그려져 있어 끝까지 안 찼다. */
  const ESTEPS=ENR_FIELDS.length+1;
  const filled=(name.trim()?1:0)
    +ENR_FIELDS.filter(f=>f.k==="age"||(profile[f.k]||"").trim()).length;
  const leave=()=>{if(out)return;setOut(true);setTimeout(onDone,440)};
  return <div className={"enr cssprofile"+(out?" out":"")}>
    <ProfileFrame title="NULL.exe" onClose={onClose}>
      {/* ── 같은 말을 두 번 하지 않는다 ──
          이 문장은 원래 여기 흐르고 있었다. 지금은 바로 앞 화면(Intro)이
          전체 화면으로 그 말을 하고, 유저는 그걸 읽고 단추를 눌러 여기로
          온다 — 그 다음 창의 제목줄이 같은 문장을 또 흘리면 방금 읽은 것을
          되돌려주는 게 된다. 확정 화면에서 이미 같은 이유로 걷었다.
          자리를 새 문구로 채우지 않는다. 다른 창과 같은 이름을 쓴다. */}
      {/* 제목은 띠 안의 글자가 아니라 띠 위에 얹은 한 줄이다. 띠는 유리라
          안쪽에 빛막이 흐르는데, 글자를 그 안에 두면 막에 먹힌다 */}
        <div className="eprofiletitle">✧ NULL PROFILE ✧</div>
        <span className="enamelab">NAME</span>
        {edit
          ?<div className="ename"><input className="namein" value={nv} autoFocus maxLength={12}
             onChange={e=>setNv(e.target.value)} onBlur={saveName}
             onKeyDown={e=>e.key==="Enter"&&saveName()}/></div>
          :<div className="ename" onClick={()=>setEdit(true)} title="이름 고치기">{name}</div>}
        {ENR_FIELDS.map((f,i)=>
          <div className={`eline e-${f.k}`} key={f.k}>
            <span className="lab">{f.lab}</span>
            {/* 나이는 세계의 고정값이다 — 유저가 아니라 세계가 정한 칸. 행은 남기고 입력만 잠근다 */}
            {f.k==="age"
              ?<span className="blank filled" title="세계의 고정값">25</span>
              :<Blank value={profile[f.k]} width={f.w} onSave={v=>onSaveField(f.k,v)} saveEmptyNow
                 open={focus===i} onOpen={o=>setFocus(p=>o?i:(p===i?-1:p))}
                 onNext={()=>{const n=ENR_FIELDS.findIndex((g,j)=>j>i&&g.k!=="age");setFocus(n)}}/>}
            <span className="etail">{f.tail}</span>
          </div>)}
        {/* ── 이 판을 어떻게 살 것인가 ──
            등록 화면이 이미 「이 판을 어떻게 살지」 정하는 자리라 여기 둔다.
            중간에 바꾸면 D-N이 튀므로 판마다 한 번이다. */}
        <div className="eline e-mode"><span className="lab">MODE</span>
          <span className="emode">
            {[["real","real"],["speed","speed"]].map(([k,t])=>
              <b key={k} className={mode===k?"on":""} onClick={()=>setAskMode(k)}>{t}</b>)}
          </span>
        </div>
        {/* 남은 날은 세지 않는다. 이 값이 비어 있는 게 이 이야기다 */}
        <div className="eline e-days"><span className="lab">DAYS LEFT</span><span className="nullv">null</span></div>
        <div className={`ebar fill-${filled}`}><i/></div>
        <div className={"emsg"+(filled===ESTEPS?" done":"")}>
          {filled===ESTEPS?"READY ✓":`CONNECTING … ${filled}/${ESTEPS}`}</div>
        {/* 다 안 채워도 들어갈 수 있다 — 비워두는 것도 이 이야기에서는 답이다 */}
        {/* 별 둘이 짝이다. 왼쪽 큰 별은 단추가 그리고, 오른쪽 작은 별만
            자리를 따로 잡아야 해서 요소로 둔다 */}
        <button className="ego" onClick={leave}>Click!<i className="egostar"/></button>
    </ProfileFrame>
    {askMode&&<ModeAsk which={askMode}
      onYes={()=>{onMode(askMode);setAskMode(null)}} onNo={()=>setAskMode(null)}/>}
  </div>;
}

/* ── 세계 확정 ──
   등록의 Click 뒤에 한 번. YES를 눌러야 세계가 생긴다.
   「NULL을」로 고치지 않는다 — NULL=널이라 조사 없이 그대로가 의도다.
   작품 안 선택지는 YES 하나다. back은 등록으로 돌아갈 뿐 세계를 만들지 않는다. */
function Confirm({name,onYes,onBack}){
  const [pressed,setPressed]=useState(false);   // 연타해도 시작은 한 번이다
  const yes=()=>{if(pressed)return;setPressed(true);onYes()};
  /* ── 이 창만 어둡다 ──
     작가가 그린 그림이다. 물음이 NULL을 가운데 두고 갈라진다 —
     「너는 이 세계에 / [NULL] / 존재하게 할 수 있을까?」. 그 칸이 커서까지
     깜빡이는 입력칸으로 서 있어서, 채워야 할 빈칸이 곧 이 게임이라는 말을
     화면이 스스로 한다. 바탕이 어두우니 분홍 YES가 그제야 유일한 빛이 된다.
     자재는 있는 것을 쓴다 — 창은 .dlg, 깜빡임은 오프닝 로고의 blinkc,
     단추는 restart의 분홍 알약(.etcdel). 어두운 바탕만 여기서 준다. */
  return <div className="enr">
    <div className="dlg cwin">
      <div className="tb">null.exe<WinDots onClose={onBack}/></div>
      <div className="dlgbody">
        <div className="cq">{name}, 너는 이 세계에</div>
        <div className="cslot"><span className="cbox"><b>NULL</b><i className="ccar"/></span></div>
        <div className="cq">존재하게 할 수 있을까?</div>
        {/* 현실은 비어 있고 이 세계에서만 값이 생긴다. 한 줄로 나란히 둔다 */}
        <div className="cfacts">
          <span><b>현실</b> <em className="cnull">□□</em></span>
          <span><b>이세계</b> <em>교생 ♡</em></span>
          <span><b>대상</b> <em>{name}</em></span>
        </div>
        <button className="etcdel cyes" onClick={yes}>YES ♡</button>
        {/* 단추 아래라야 「YES밖에 없다」는 농담이 산다 */}
        <div className="cwhint">거절은 거절해 <span className="kao">{'(´▽｀ ʃƪ)♡'}</span></div>
      </div>
    </div>
  </div>;
}

/* ── 마지막 빈칸 ── D-0의 「Stay with □□?」.
   얼굴을 고르는 게 아니라 이름을 쓴다 — 이 제품은 처음부터 끝까지 빈칸을
   채우는 이야기다. 이 세계에 있는 두 사람만 들어가고, 그 밖의 글자는 다
   에러다. 성은 붙여도 되고 안 붙여도 된다 — 유저가 부르던 대로 쓰면 된다. */
const WHO_NAMES={ "이재언":"jaeeon", "재언":"jaeeon", "이민현":"minhyun", "민현":"minhyun" };
function WhoBlank({onPick}){
  const [on,setOn]=useState(false);
  const [v,setV]=useState("");
  const [bad,setBad]=useState(false);
  const done=()=>{
    const id=WHO_NAMES[v.replace(/\s/g,"")];
    if(id){onPick(id);return}
    /* 에러는 칸에서 낸다. 창을 하나 더 띄우면 마지막 장면이 시끄러워진다 */
    setBad(true); setTimeout(()=>setBad(false),620);
  };
  if(on)return <input className={"blankin sunken whoin"+(bad?" bad":"")} value={v} autoFocus maxLength={6}
    onChange={e=>{setV(e.target.value);setBad(false)}}
    onKeyDown={e=>e.key==="Enter"&&done()} onBlur={()=>{if(!v.trim())setOn(false)}}/>;
  return <span className="blank whoblank" onClick={()=>setOn(true)}>□□</span>;
}

/* 레트로 다이얼로그 셸 */
function Dialog({title,onClose,children,cls,win,compact=true,raw=false}){
  return <div className={"dlgov"+(!compact?" cssprofile":"")} onClick={onClose}>
    <div className="dialogmount" onClick={e=>e.stopPropagation()}>
      <ProfileFrame title={title} onClose={onClose} compact={compact} frameClass={win||""}
        bodyClass={(raw?"":"dlgbody")+(cls?" "+cls:"")}>
        {children}
      </ProfileFrame>
    </div>
  </div>;
}

/* ── get cha ── 첫 만남이 끝나고 그 사람의 메신저가 생기는 창.
   Dialog 셸을 안 쓴다: 이 창만 창틀 셋(─ □ ✕)이 다 보이고 본문이 어둡다.
   번호가 어디서 났는지를 대사로 설명하는 대신 이 한 장면이 맡는다 —
   그래서 문구집 여덟 자리를 한 줄도 안 고쳐도 된다. */
function GetCha({char,onClose}){
  return <div className="dlgov" onClick={onClose}>
    <div className="dlg getcha" onClick={e=>e.stopPropagation()}>
      <div className="tb">null.exe<WinDots onClose={onClose}/></div>
      <div className="gcbody">
        <span className="gcslot"><b>{(CHARS[char]||{}).name||"□□□"}</b><i/></span>
        <div className="gcget">
          <span>의 메신저를</span>
          <b>Get cha!</b>
          <i className="kao">( ⸝⸝´꒳`⸝⸝) ꫂ 💌</i>
        </div>
        <button className="wbtn gcbtn" onClick={onClose}>chat ♡</button>
      </div>
    </div>
  </div>;
}

/* ── 배역을 받는 자리 ──
   이름을 친 다음, 등록 네 칸 앞에 한 번.

   POV에서 내가 누구인지 정하는 건 내가 든 물건이 아니라 **남이 나를 부르는
   호칭**이다. 교실에서 「선생님」이라고 불리는 사람은 한 명뿐이고, 그 소리가
   나를 향하면 설명 없이 안다 — 아, 그게 나구나.
   그래서 그리는 물건이 없다. 사진은 교실을 앞에서 보는 시야고(교사만 서는
   자리), 부르는 소리가 그 자리에서 나고, 내 속마음이 그 위에 뜬다.

   이게 있어야 뒤에 「선생님」이라는 호칭이 설명 없이 성립한다. 전에는
   유저가 배역을 받은 줄 모르는 채로 첫 방에 들어갔다.

   팝업이 아니라 전체 화면이다 — 팝업은 앞의 가짜 오류창과 문법이 겹친다. */
function Intro({onGo}){
  return <div className="intro">
    {/* 소리는 말풍선이 아니다. 그 자리에서 나는 것이라 자리만 잡고 글자만 둔다 */}
    <div className="incall c1"><span className="who">뒷자리</span>
      <span className="say">선생님— <em className="kao">{'(๑•̀ㅅ•́)ﻭ✧'}</em></span></div>
    <div className="incall c2"><span className="who">창가 쪽</span>
      <span className="say"><em className="kao">{'ﻭ(•̀ᴗ•́)و'}</em> 선생님!</span></div>
    <div className="inbottom">
      {/* □□는 유저가 채우는 칸이 아니다. 현실의 내 값이 비어 있다는 말이라
          비어 있는 채로 고정이다 — 채워지는 건 이 세계 쪽뿐이다 */}
      <div className="inthink">현실에서 <span className="bk">□□</span>이던 내가<br/>
        이 세계에서는 <b>교생?</b>
        <span className="kao">{'(,,◕ᗝ◕,,)♡.ᐟ.ᐟ'}</span></div>
      <button className="wbtn go inbtn" onClick={onGo}>NULL 채우러 가기 ♡</button>
    </div>
  </div>;
}

/* ── 이 판을 어떻게 살 것인가 ──
   비율만 말하던 자리다(「현실 하루 = NULL 하루!」 「하루가 4배로 Speed up!」).
   비율은 숫자고, 유저가 정하는 건 숫자가 아니라 **살아지는 방식**이다 —
   앱을 꺼둔 동안에도 세계가 흐르는가, 엔딩이 언제 오는가.

   그리고 중간에 못 바꾼다는 것이 코드 주석에만 있었다. 화면이 말 안 하는
   되돌릴 수 없는 선택은 선택이 아니라 함정이다. 여기서 말한다.

   자재는 있는 것을 쓴다 — 겟챠 창과 같은 .dlgov/.dlg다. */
const MODE_ASK={
  real:{t:"real", days:1,
    body:"현실 하루 = NULL 하루! ♡",
    kao:"٩(❛ัᴗ❛ั ๑)"},
  speed:{t:"speed", days:4,
    body:"하루가 4배로 Speed up!",
    kao:"˙˚ଘo(∗ ❛ั ᵕ ❛ั )੭່˙"},
};
/* 비율은 문장이 아니다. 이 앱은 이미 눈금으로 말하는 법을 갖고 있다
   (이름 칸, D-day 막대). 한 칸 대 네 칸을 보여주면 읽지 않고도 안다. */
const MdRow=({k,on,n})=><div className="mdrr">
  <span className="k">{k}</span>
  <span className="bx">{[0,1,2,3].map(i=><span key={i} className={i<on?"on":""}/>)}</span>
  <span className="n"><b>{n}</b>일</span>
</div>;
function ModeAsk({which,onYes,onNo}){
  const m=MODE_ASK[which]||MODE_ASK.real;
  /* 이 창만 옛 문법(납작한 띠·실선 테두리·회색 알약)에 남아 있어서 다른
     앱에서 온 창처럼 보였다. 오프닝·등록과 같은 부품을 쓴다 — 제목은 띠의
     ::before가 그리므로 여기 글자는 font-size:0으로 숨는다 */
  return <div className="dlgov" onClick={onNo}>
    <div className="dlg modedlg" onClick={e=>e.stopPropagation()}>
      <div className="tb">null.exe<WinDots onClose={onNo}/></div>
      <div className="dlgbody mdbody">
        {/* 고른 것이 제목이 된다. 확인창이 확인해야 하는 건 「무엇을 골랐는가」다 —
            전에는 고른 값이 제일 작고 그걸 설명하는 문장이 제일 컸다 */}
        <div className="mdpick"><b>{m.t}</b> <em className="kao">{m.kao}</em></div>
        <div className="mdtx">{m.body}</div>
        <div className="mdratio">
          <MdRow k="현 실" on={1} n={1}/>
          <MdRow k="게 임" on={m.days} n={m.days}/>
        </div>
        {/* 경고는 점선 상자에서 꺼낸다. 이 앱에서 점선 둥근 상자는 「채워야 할
            빈칸」이라 경고를 담으면 입력 안 한 칸처럼 보인다. 자물쇠 한 줄이면 된다 */}
        <div className="mdlock">
          <svg width="10" height="11" viewBox="0 0 12 13" aria-hidden="true">
            <path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="#c9b8e8" strokeWidth="1.3" strokeLinecap="round"/>
            <rect x="2" y="5" width="8" height="6.5" rx="1.6" fill="#efe9fc" stroke="#c9b8e8" strokeWidth="1.2"/>
          </svg>한 번 정하면 바꿀 수 없어요</div>
        <div className="mdrow">
          <button className="wbtn" onClick={onNo}>back</button>
          {/* 이미 고른 모드냐 아니냐로 글자를 갈랐더니, real 은 ok 인데
              speed 만 「이걸로」라 두 모드가 다른 창처럼 보였다.
              같은 것을 고르는 자리니 같은 단추다 */}
          <button className="wbtn go" onClick={onYes}>ok ♡</button>
        </div>
      </div>
    </div>
  </div>;
}

