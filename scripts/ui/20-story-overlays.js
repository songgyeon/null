/* NULL web UI · photos, diaries, flashback, kiss, log
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
/* ── 사진 보기 ──
   이 앱에서 「앱 위에 얹히는 것」은 전부 창이다(gift·bag·map·yaja.exe).
   사진도 창에 담으면 규칙이 하나로 서고, 창틀이 「이게 무엇인지」도 말해준다.

   전에는 검은 공백에 사진만 띄웠다. 그런데 이 사진들은 전부 표면 위에 놓인
   물건을 찍은 것이라 이미 자기 세계를 들고 온다 — 검정은 그 세계를 버리고
   두 번째 세계를 하나 더 얹는 일이었다. 뒤로 앱이 비치면 떠난 게 아니라
   가까이 본 게 된다.

   알약은 사진에 붙는다. 창 안이라 떠 있을 자리가 없다 — 전에는 사진에서
   한참 떨어져 아무 관계도 없이 떠 있었다.

   부르는 자리가 셋이다(사진첩·히든·말풍선). 셋이 각자 그리면 같은 사진이
   화면마다 다르게 열린다. */
function PhotoWin({shot,onClose,onNext}){
  /* 훅은 조건부 return 위에 있어야 한다 — 밑으로 내려가면 사진이 없는
     렌더에서 훅 수가 달라져 React가 터진다 */
  const [back,setBack]=useState(false);
  const key=typeof shot==="string"?shot:(shot&&shot.src)||"";
  useEffect(()=>{setBack(false)},[key]);   // 딴 사진을 열면 다시 앞면부터
  if(!shot)return null;
  const one=typeof shot==="string";
  const src=one?shot:shot.src;
  const label=one?"":shot.label;
  const note=one?"":shot.note;
  /* 뒷면이 있는 것은 엽서 하나다. 누르면 넘어간다 — 뒤집는 단추를 따로
     달지 않는다. 엽서를 뒤집는 데 단추가 필요한 적은 없었다 */
  const flip=one?null:shot.back;
  const now=back&&flip?flip:src;
  const fill=(back&&flip?(shot.backFill||[]):(one?[]:(shot.fill||[])))||[];
  return <div className="pvwin" onClick={onClose}>
    <div className="pvframe" onClick={e=>e.stopPropagation()}>
    <ProfileFrame title="photo" onClose={onClose} frameClass="pvdlg" bodyClass="pvframebody">
      <div className={"pvbody"+(flip?" flip":"")}
        onClick={flip?()=>setBack(b=>!b):null}>
        {/* 빈칸은 사진 상자가 아니라 **사진**에 앉아야 한다. 사진은 창 폭을
            꽉 채우고 높이는 비율대로 따라오므로 사진 상자가 곧 사진이다 —
            여기서 감싸면 퍼센트가 그대로 사진 위에 떨어진다. 설명 칸까지
            같이 감싸면 그만큼 아래로 밀린다 */}
        <div className="pvshot">
          <img src={now} alt={label||""}/>
          {!!fill.length&&<div className="pvfit">
            {fill.map((f,i)=><span key={i} className="pvfill" style={{left:f.left+"%",top:f.top+"%",
              width:f.w+"%",height:f.h+"%"}}>{f.text}</span>)}
          </div>}
        </div>
        {label&&<div className="pvcap">
          <div className="lt">{label}</div>
          {note&&<div className="ln">{note}</div>}
        </div>}
      </div>
      <div className="pvfoot">
        {onNext&&<button className="pvnext" onClick={onNext} aria-label="다음 사진">
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 17c0-5 4-8 9-8M11 4l4 5-4 5" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg></button>}
        <button className="pvclose" onClick={onClose}>덮기 ♡</button>
      </div>
    </ProfileFrame>
    </div>
  </div>;
}

/* ── 유저의 옛 일기 ──
   재언 방에 처음 들어가는 순간, 선톡 앞에 한 번.

   이 앱의 다른 창은 전부 가짜 OS다. 여기만 종이다 — 20년 전 것이고
   화면에서 나온 물건이 아니라 서랍에서 나온 물건이라서. 그래서 창틀도
   메뉴바도 없다. 줄공책 한 장이 화면을 덮는다.

   마지막 한 칸은 유저가 채운다. 재언이 왜 돌아오겠다고 했는지는 재언이
   쓴 것이지만, 그 이유를 정하는 건 이 판을 사는 사람이다.

   ⚠️ 채운 값은 여기 브라우저 안에만 산다. 어떤 요청에도 안 실린다. */
function Diary({onDone}){
  const [v,setV]=useState("");
  const [out,setOut]=useState(false);
  const t=v.trim();
  /* 닫히는 동안 한 번 더 눌려서 두 번 저장되는 일이 없게 */
  const done=()=>{if(out||!t)return;setOut(true);saveDiary(t);setTimeout(onDone,420)};
  /* 사진을 못 읽는 사람에게는 적힌 글을 그대로 읽어준다 */
  const alt=[DIARY_HEAD,...DIARY_LINES,DIARY_TAIL_A+"□"+DIARY_TAIL_B].join(" ");
  return <div className={"diary"+(out?" out":"")}>
    <div className="dpage">
      <img className="dshot" src={av(DIARY_IMG)} alt={alt}/>
      {/* ── 빈칸은 상자가 아니라 **사진**에 앉는다 ──
          자리를 상자 기준 퍼센트로 잡으면, 화면이 낮아져 사진이 상자 안에서
          작아지는 순간 칸이 딴 데로 간다. 폰에서 키보드가 올라오면 바로 그
          일이 났다. 이 겹(fit)이 object-fit:contain과 같은 자리·같은 크기로
          서고, 빈칸은 그 안에서만 퍼센트를 센다. */}
      <div className="dfit">
        <input className="dblank" value={v} autoFocus maxLength={DIARY_MAX}
          style={{left:DIARY_BOX.left+"%",top:DIARY_BOX.top+"%",
                  width:DIARY_BOX.w+"%",height:DIARY_BOX.h+"%"}}
          onChange={e=>setV(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();done()}}}/>
      </div>
    </div>
    {/* 채워야 넘어간다. 비워두면 이 화면이 할 일이 없다 */}
    <button className="wbtn go dbtn" disabled={!t} onClick={done}>덮기 ♡</button>
  </div>;
}

/* ── 민현의 옛 일기 — 병원 옥상 ──
   유저가 처음 무언가를 입력한 그 순간. 말풍선으로 오지 않는다 — 말풍선은
   「상대가 보낸 사진」이고, 이건 유저의 기억이 올라오는 것이다. 화면이
   통째로 그 엽서가 된다.

   앞면이 천천히 앉고, 잠깐 그대로 있다가, 천천히 넘어간다. 넘어가고 나서야
   빈칸이 보이고 커서가 선다 — 앞면을 보는 동안 칸을 못 누르게 하는 것이
   이 화면의 속도다.

   정사는 전부 고정이다. 유저가 짓는 것은 상대의 반응과 자기 소망뿐이다. */
function Flash({onDone}){
  const [turn,setTurn]=useState(false);   // 뒷면으로 넘어갔나
  const [v,setV]=useState({face:"",said:"",wish:""});
  const [out,setOut]=useState(false);
  const first=useRef(null);
  useEffect(()=>{
    const t=setTimeout(()=>setTurn(true),FLASH_RISE+FLASH_HOLD);
    return()=>clearTimeout(t);
  },[]);
  /* 넘어간 뒤에 커서가 선다. 넘어가는 중에 잡으면 뒤집히는 종이를 누르는 게 된다 */
  useEffect(()=>{
    if(!turn)return;
    const t=setTimeout(()=>{if(first.current)first.current.focus()},FLASH_TURN);
    return()=>clearTimeout(t);
  },[turn]);
  const full=FLASH_KEYS.every(k=>v[k].trim());
  const done=()=>{if(out||!full)return;setOut(true);saveFlash(v);setTimeout(()=>onDone(v),460)};
  const set=(k,t)=>setV(p=>({...p,[k]:t}));
  return <div className={"flash"+(out?" out":"")}>
    {/* 앉는 것과 넘어가는 것을 두 겹으로 나눈다 — 한 겹에 얹으면 앉는
        애니메이션이 transform을 붙들고 있어서 넘어가는 게 화면에 안 나온다.
        (실제로 그랬다: 클래스는 바뀌는데 앞면이 그대로 있었다) */}
    <div className="fwrap" style={{"--rise":FLASH_RISE+"ms","--turn":FLASH_TURN+"ms"}}>
    <div className={"fcard"+(turn?" turn":"")}>
      <div className="fside ffront"><img src={av(FLASH_FRONT)} alt="눈 내리는 병원 옥상"/></div>
      <div className="fside fback">
        <img src={av(FLASH_BACK)} alt={FLASH_ALT.join(" ")}/>
        {/* 빈칸은 상자가 아니라 사진에 앉는다 — .dfit과 같은 이유다 */}
        <div className="dfit">
          {FLASH_BOX.map((b,i)=>
            <input key={b.key} ref={i===0?first:null} className="fblank"
              value={v[b.key]} maxLength={FLASH_MAX} tabIndex={turn?0:-1}
              style={{left:b.left+"%",top:b.top+"%",width:b.w+"%",height:b.h+"%"}}
              onChange={e=>set(b.key,e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();
                const n=e.target.closest(".fback").querySelectorAll(".fblank")[i+1];
                if(n)n.focus(); else done()}}}/>)}
        </div>
      </div>
    </div>
    </div>
    {/* 셋이 다 차야 넘어간다. 하나라도 비면 이 화면이 할 일이 남아 있다 */}
    <button className={"wbtn go fbtn"+(turn?"":" hid")} disabled={!full} onClick={done}>
      덮기 ♡</button>
  </div>;
}

/* ── ⑨ 키스타임 ──
   화면이 통째로 그 얼굴이 되는 순간. 말풍선으로 오면 「상대가 보낸 셀카」로
   읽히고, 그건 POV가 아니다 — 그래서 ④ 엽서와 같은 화면 전환을 쓴다.

   단추가 없다. 유저가 고르는 장면이 아니라 유저의 시야라서, 뜨고 잠깐
   있다가 저절로 접힌다. 급하면 아무 데나 누르면 접힌다.

   접촉은 화면 밖이다. 눈 감은 얼굴에서 끝난다 — 「분위기까지」의 시각판이다.
   판정은 여기 없다: 이 화면이 떴다는 것은 워커가 이미 두 문을 다 봤다는 뜻이다. */
function KissTime({shot,onDone}){
  const [out,setOut]=useState(false);
  const done=useRef(false);
  const close=()=>{
    if(done.current)return; done.current=true;
    setOut(true); setTimeout(onDone,KISS_OUT);
  };
  useEffect(()=>{
    const t=setTimeout(close,KISS_RUN);
    return()=>clearTimeout(t);
  },[]);
  /* 세 컷을 겹쳐 두고 배율을 이어받게 한다 — 컷이 바뀔 때 배율이 리셋되면
     뒤로 물러난 게 된다. 카메라는 한 번도 멈추지 않는다.
     .kseye 는 숨만, 그 안의 .ksf 는 다가감만 맡는다. 한 층에 둘을 겹치면
     서로를 지운다 */
  const cuts=(shot&&shot.shots)||[shot&&shot.shot];
  return <div className={"kiss"+(out?" out":"")} onClick={close}
    style={{"--run":KISS_RUN+"ms","--out":KISS_OUT+"ms"}}>
    <div className="kseye">
      {[0,1,2].map(n=><div key={n} className={"ksf ksf"+(n+1)}
        style={{backgroundImage:`url("${av((cuts[n]||cuts[0])+".webp")}")`}}/>)}
    </div>
    <div className="ksvig"/>
    <div className="ksout"/>
  </div>;
}

/* 탭하면 입력으로 바뀌는 빈칸 */
/* 열린 상태를 밖에서 쥘 수 있다(open/onOpen). 등록 화면은 그렇게 해서
   엔터 한 번에 다음 칸으로 넘긴다. 안 넘기면 제 안의 edit로 혼자 돈다 —
   프로필 창은 예전 그대로다. */
function Blank({value,onSave,width,open,onOpen,onNext,saveEmptyNow=false}){
  const ctl=typeof open==="boolean";
  const [edit,setEdit]=useState(false);
  const on=ctl?open:edit;
  const set=o=>ctl?onOpen(o):setEdit(o);
  const [v,setV]=useState(value||"");
  useEffect(()=>setV(value||""),[value,on]);
  const done=next=>{onSave(v.trim());if(next&&onNext)onNext();else set(false)};
  if(on)return <input className="blankin sunken" style={width?{width}:null} value={v} autoFocus maxLength={20}
    onChange={e=>{const n=e.target.value;setV(n);if(saveEmptyNow&&value&&!n.trim())onSave("")}}
    onBlur={()=>done(false)} onKeyDown={e=>e.key==="Enter"&&done(true)}/>;
  return <span className={"blank"+(value?" filled":"")} onClick={()=>set(true)}>{value||""}</span>;
}

/* [편집 → 기록] 지금까지 채운 빈칸을 숫자로 보여준다.
   대사로 못 하는 말을 통계가 대신한다 — 이 앱의 주제 그대로. */
function LogPanel({store,counts,unlocked,album}){
  const allPhotos=Object.values(CHARS).reduce((n,c)=>n+c.gallery.length,0);
  const first=Object.values(store.msgs||{}).flat().reduce((a,m)=>!a||m.ts<a?m.ts:a,0);
  const rows=[
    ["w/ 재언", (counts.jaeeon||0)],
    ["w/ 민현", (counts.minhyun||0)],
    ["group", (counts.group||0)],
    ["pics", album.size+" / "+allPhotos],
    [".hidden", unlocked.length+" / "+HIDDEN.length],
  ];
  return <div style={{padding:"4px 2px"}}>
    {rows.map(([k,v])=><div key={k} className="dlgline"
      style={{display:"flex",justifyContent:"space-between",gap:14,fontSize:12}}>
      <span style={{color:"#8a4f74"}}>{k}</span><span style={{color:"#4a4276"}}>{v}</span></div>)}
    <div className="dlgline" style={{marginTop:10,fontSize:10.5,color:"#b0a6d8",textAlign:"center"}}>
      {first?"first met u · "+fmtDay(first):"nothing yet"}
    </div>
  </div>;
}

