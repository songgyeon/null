/* NULL web · GameApp render tree
   상태와 동작은 scripts/game.js가 소유하고, 이 파일은 화면 조립만 맡는다. */
function GameScreen({game}){
  const {answerAsk,answerDday,answerInvite,answerLeave,answerMove,answerWay,ask,askDday,askWho,autoLoading,bag,busy,cameBack,cart,confirmYes,dLeft,dayN,ddayHide,diary,diaryDone,doAuto,editLine,edits,enrolling,enter,exportTxt,failed,flash,getcha,gifts,giveEnergyBar,giveGift,giveGiftAt,groupNew,groupOn,guessHidden,invite,kiss,leaveScene,leaving,lit,look,met,mode,name,nameFull,openAsk,openProfile,openRoom,pickWho,plate,prof,profCount,profile,readAll,rename,reset,retry,roomCounts,scene,seenStage,send,setAsk,setAskWho,setCart,setDdayHide,setEnrolling,setFlash,setGetcha,setGroupNew,setKiss,setLook,setMode,setPlate,setProf,setProfile,setSys1,setToast,setView,setWhoAsk,setWhoDone,store,sys1,toast,unlocked,view,way,whoAsk,whoDone}=game;
  return <div className="phone">
    {diary&&<Diary onDone={diaryDone}/>}
    {flash&&<Flash onDone={()=>{const f=flash;setFlash(null);
      /* 엽서를 끝까지 채웠다 = 민현이 그날 얘기를 **한** 것이다.
         explained는 「말했다」이지 「유저가 받아들였다」가 아니다 —
         recognized까지 여기서 찍지 않는다. 그건 대화가 정한다.
         덮기를 못 누르고 나가면 여기 안 온다: 상태가 그대로라 pending 경로다. */
      applyStoryTransition({key:"firstContact",to:"explained"});
      send(f.room,f.text,true)}}/>}
    {kiss&&<KissTime shot={{shot:kiss}} onDone={()=>setKiss(null)}/>}
    {enrolling==="intro"&&<Intro onGo={()=>setEnrolling("enroll")}/>}
    {enrolling==="enroll"&&<Enroll name={name} profile={profile} onDone={()=>setEnrolling("confirm")} onClose={()=>setEnrolling("intro")}
      mode={mode} onMode={m=>{setMode(m);saveMode(m)}}
      onRename={rename} onSaveField={(k,v)=>setProfile(p=>({...p,[k]:v}))}/>}
    {enrolling==="confirm"&&<Confirm name={name} onYes={confirmYes} onBack={()=>setEnrolling("enroll")}/>}
    {!name?<Splash onEnter={enter}/>
    :view==="list"?<RoomList store={store} name={name} unlocked={unlocked} counts={roomCounts()}
       groupOn={groupOn} onCart={()=>setCart(true)} onPlate={setPlate} onOpen={openRoom} onProfile={openProfile} onAuto={doAuto} autoLoading={autoLoading} seenStage={seenStage}
       onExport={exportTxt} onReadAll={readAll} onRename={rename} onReset={reset} onToast={setToast}
       profile={profile} onSaveField={(k,v)=>setProfile(p=>({...p,[k]:v}))} gifts={gifts} onGift={giveGift} hearts={heartsOf(store,gifts)}
       bag={bag} met={met} onGoPlace={openAsk} onEnergyBar={giveEnergyBar} onGuess={guessHidden}/>
    :<ChatRoom room={roomOf(view)} msgs={store.msgs[view]||[]} busy={!!busy[view]} failed={failed[view]} dLeft={dLeft}
       scene={scene&&scene.room===view?scene:null} onLeaveScene={leaveScene}
       onMinimize={()=>setView("list")} onCart={()=>setCart(true)}
       onBack={()=>setView("list")} onSend={t=>send(view,t)} onRetry={()=>retry(view)} onProfile={openProfile}
       fixed={new Set(edits.filter(e=>e.room===view&&e.mid).map(e=>e.mid))}
       locked={roomLock(store,view)}
       onFix={(mid,t)=>editLine(view,mid,t)}/>}
    {invite&&<div className="dlgov" onClick={()=>answerInvite(false)}>
      <div className="dlg" onClick={e=>e.stopPropagation()}>
        <div className="tb">{CHARS[invite.char].name}<WinDots onClose={()=>answerInvite(false)}/></div>
        <div className="dlgbody">
          <div className="dlgline" style={{textAlign:"center",padding:"10px 0",fontSize:13,color:"#8a4f74"}}>
            {invite.place}도 같이 GO?</div>
          <div className="askrule">같이 갈 사람은 Who? <span className="kao">ʢ˶ &gt; ₃ &lt; ˶ʡ ➳❤︎</span></div>
          <div className="dlgbtns">
            <button className="bevel pink" onClick={()=>answerInvite(true)}>같이 GO!</button>
            <button className="bevel" onClick={()=>answerInvite(false)}>LATER...</button>
          </div>
        </div>
      </div>
    </div>}
    {cart&&<Cart gifts={gifts||{}} hearts={heartsOf(store,gifts)} met={met}
      /* 보고 있는 화면이 아니라 몸이 어디 있는지를 본다. 교실에 앉은 채로
         목록에 나와 있어도 몸은 교실에 있다 */
      withChar={scene?scene.room:null}
      onSend={giveGift} onSendAt={giveGiftAt} onClose={()=>setCart(false)}/>}
    {/* 사물함 명패. 눌러도 아무 일이 없는 칸이 여덟 중 둘이면 나머지도 안 눌러보게 된다 */}
    {plate&&<Dialog title={plate.kind==="start"?"START":"NULL"}
      onClose={()=>setPlate(null)} win="platewin" cls="platebody">
      <div className="dlgline" style={{textAlign:"center",padding:"14px 0 12px",fontSize:13,color:"#8a4f74"}}>
        {plate.say} <span className="kao">{plate.kao}</span></div>
      <div className="dlgbtns platebuttons" style={{justifyContent:"center"}}>
        <button className="plateclose" onClick={()=>setPlate(null)}>ok ♡</button>
      </div>
    </Dialog>}
    {/* 나가기도 한 번 묻는다. 하루에 한 번뿐인 자리라 실수로 닫히면 그날이 끝난다 */}
    {leaving&&<div className="dlgov" onClick={()=>answerLeave(false)}>
      <div className="dlg" onClick={e=>e.stopPropagation()}>
        <div className="tb">{leaving.place}<WinDots onClose={()=>answerLeave(false)}/></div>
        <div className="dlgbody">
          <div className="dlgline" style={{textAlign:"center",padding:"10px 0 4px",fontSize:13,color:"#8a4f74"}}>
            {jos(leaving.place,"은/는")} 여기까지...?</div>
          <div className="askrule">지금 나가면 Ending... <span className="kao">{'.(๓´͈ ˘ `͈๓).'}</span></div>
          <div className="dlgbtns">
            <button className="bevel pink" onClick={()=>answerLeave(true)}>EXIT!</button>
            <button className="bevel" onClick={()=>answerLeave(false)}>조금 더 STAY!</button>
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
      /* 자리에 있는 동안엔 딴 데로 못 간다. 몸은 하나다 —
         X로 접어두고 메신저를 쓸 수는 있어도 옮겨 다닐 수는 없다 */
      const away=!!scene&&scene.place!==ask;
      const locked=!!p&&!placeOpen(p,met);
      const shut=!!p&&!placeHours(p);            // 지금은 문 닫은 시각
      const wk=!away&&!!p&&!wendOnlyOk(p);       // 평일엔 못 가는 자리 — 같이 이동엔 안 본다
      const done=goneToday(ask);                 // 오늘 이미 다녀왔다
      const out=!away&&p&&p.meet==="out"?outAt(p):null; // 이 장소에 실제로 나올 수 있는 사람만 본다
      const empty=!!out&&!out.length;
      /* 둘 다 갈 수 있는 장소면 자동으로 한 사람을 고르지 않는다.
         마주치는 장소는 지금 실제로 밖에 있는 사람만 선택지에 남긴다. */
      const pickWho=!away&&!!p&&(p.who||[]).length>1;
      const whoChoices=!p?[]:(p.meet==="out"?outAt(p):(p.who||[]));
      const need=pickWho&&whoChoices.length>0&&!askWho;
      /* 같이 있다가 발길 닿는 이동. 그 사람이 갈 수 있는 자리(who)여야 하고,
         열려 있어야 하고, 오늘 안 간 데여야 한다. 귀갓길에서는 못 옮긴다 — 곧 내린다.
         근무·수업·점심·야자 중에는 학교 안에서만 옮긴다 — 점심의 보건실→옥상은
         되고, 근무 중의 재언을 편의점으로 빼내지는 못한다. 학교 밖은 퇴근 뒤다.
         수업 중의 교실은 이동으로도 못 들어간다 — 문틈(klass)과 같은 이유다. */
      const stuck=away&&!isWend()&&AT_WORK.includes((presence(scene.room)||{}).t||"");
      const mv=away&&scene.place!==WAY&&!!p&&(p.who||[]).includes(scene.room)
             &&!locked&&!shut&&!done
             &&!(stuck&&p.map!=="school")
             &&!(ask==="교실"&&presence("minhyun").t==="수업 중");
      /* 수업 중의 교실은 가는 데가 아니라 들여다보는 데다. 앉아서 대화하던
         것이 이상했다 — 수업 중인 애랑 마주 앉아 떠들 수는 없다.
         구경은 방문이 아니라 도장(goneToday)을 안 본다 — 오늘 다녀왔어도 본다.
         자리에 있는 동안은 구경이 아니라 이동의 영역이다(!scene).
         주말은 위의 shut이 먼저 막는다(교실은 wend:false). */
      const klass=ask==="교실"&&!scene&&!locked&&!shut&&presence("minhyun").t==="수업 중";
      const no=!klass&&!mv&&(away||locked||shut||wk||done||empty);
      /* 무엇을 먼저 가야 하는지는 안 적는다. 순서를 알려주면 지도를 도는 게
         심부름이 되고, 「옥상 먼저」 같은 줄이 창마다 붙어 지저분하다 */
      const done_=`오늘치 ${jos(ask,"은/는")} Complete...`;
      /* 얼굴은 픽셀 글꼴에 글자가 없어서 .kao로 따로 그린다.
         이유와 얼굴은 한 갈래로 고른다. 따로 고르던 때는 갈래가 어긋났다 —
         잠겼고 오늘 다녀온 자리에서 이유는 빈 줄인데 우는 얼굴만 남아서,
         「아직은 못 가요」 밑에 얼굴 하나가 혼자 떠 있었다. */
      const R=(t,k)=>({t,k:k||""});
      const {t:why,k:kao}=away&&!mv
        ? (done?R(done_,"(⸝⸝o̴̶̷᷄ ·̭ o̴̶̷̥᷅⸝⸝)♡")
           :shut&&!locked?R(placeWhen(p))
           :R(`현재 위치는 ${scene.place}...`))
        :locked?R("")
        :done?R(done_,"(⸝⸝o̴̶̷᷄ ·̭ o̴̶̷̥᷅⸝⸝)♡")
        :wk?R("여기는 Weekend only! ♡","٩(❛ัᴗ❛ั ๑)")
        :empty?R("지금 밖은 Empty...","՞ ⸝⸝> ̫ <⸝⸝ ՞")
        :shut?R(placeWhen(p)):R("");
      return <Dialog title={ask} onClose={()=>answerAsk(false)} win="askwin">
          <div className="dlgline" style={{textAlign:"center",padding:"10px 0 4px",fontSize:13,color:"#8a4f74"}}>
            {locked&&!away
              ?<span className="asklock">my bad <i>♡</i><br/>아직은 못 가요 <span className="kao">𐔌՞꜆ ≧ ㅁ≦꜀՞𐦯</span></span>
              :klass?`${jos(ask,"은/는")} CLASS 중!`
              :mv?`${ask}도 같이 GO?`
              :done?`${ask} — OFFLINE!`
              :no?`${jos(ask,"은/는")} 잠깐 OFF!`:`${jos(ask,"으로/로")} GO?`}</div>
          {/* 하루에 한 번뿐이라는 건 눌러보고 알면 늦다. 묻는 자리에서 같이 말한다 */}
          {!no&&!klass&&<div className="askrule">앗! 하루에 1번만 갈 수 있어요 <span className="kao">(υl|l◔ㅅ◔)՞՞</span></div>}
          {no&&<div style={{textAlign:"center",paddingBottom:8,fontSize:10,letterSpacing:".08em",color:"#b4a7d6"}}>
            {why}{kao&&<> <span className="kao">{kao}</span></>}</div>}
          {/* 시간을 내서 가는 자리는 누구랑 갈지 고른다 — 같이 이동이면 이미 정해져 있다 */}
          {!no&&!mv&&pickWho&&whoChoices.length>0&&<div className="askwho">
            {whoChoices.map(c=><button key={c}
              className={"whobtn bevel"+(askWho===c?" on":"")}
              onClick={()=>setAskWho(c)}>
              <span className="cface" style={faceBg(CHARS[c])}/>{CHARS[c].name}</button>)}
          </div>}
          <div className="dlgbtns">
            {no
              ?<button className="bevel" onClick={()=>answerAsk(false)}>OK!</button>
              :klass
              /* 구경은 answerAsk를 안 탄다 — 도장도 자리도 대화도 없는 길이라서 */
              ?<><button className="bevel pink" onClick={()=>{setAsk(null);setAskWho(null);
                   setLook({shot:["minhyun-window","minhyun-desk"][Math.floor(Math.random()*2)]+".webp"})}}>살짝 PEEK!</button>
                 <button className="bevel" onClick={()=>answerAsk(false)}>LATER...</button></>
              :mv
              ?<><button className="bevel pink" onClick={()=>answerMove(true)}>같이 GO!</button>
                 <button className="bevel" onClick={()=>answerMove(false)}>LATER...</button></>
              :<><button className="bevel pink" disabled={need} onClick={()=>answerAsk(true)}>GO!</button>
                 <button className="bevel" onClick={()=>answerAsk(false)}>LATER...</button></>}
          </div>
    </Dialog>; })()}
    {/* 교실 문틈. 배경 위에 그 애 사진 한 장 — 말풍선도 도장도 없다.
        캐비닛 TV처럼 아무 데나 누르면 돌아간다 */}
    {look&&<div className="lookov" onClick={()=>setLook(null)}>
      <img className="lookbg" src="place-class.webp" alt=""/>
      <div className="lookshot"><img src={look.shot} alt="교실"/></div>
      <div className="lookcap">CLASS MODE ON!<br/>대화는 OFF, 살짝만 PEEK <span className="kao">(՞ ⸝⸝&gt; ̫ &lt;⸝⸝ ՞)</span></div>
    </div>}
    {prof&&<Profile char={prof} count={profCount(prof)} onBack={()=>setProf(null)} gifts={gifts} dLeft={dLeft} back={cameBack} days={dayN}/>}
    {/* 단톡방이 생겼다. 유저는 초대를 받은 쪽이라 무슨 방인지 모른 채로 들어간다 */}
    {groupNew&&<Dialog title="null.exe" onClose={()=>setGroupNew(false)}>
      <div className="ddq">
        <div className="k">［ 새 방 ］♡</div>
        <div className="ddrows">
          <div className="r"><span className="k2">이 름</span><span className="dot"/><span className="v">단톡방</span></div>
          <div className="r"><span className="k2">초 대</span><span className="dot"/><span className="v">이민현</span></div>
          <div className="r"><span className="k2">이 유</span><span className="dot"/><span className="v hush">비밀</span></div>
        </div>
        <div className="s" style={{marginTop:14}}>
          이민현이 방을 만들고 당신을 넣었어요<br/>
          <span className="kao">( ˶˘ ᵕ ˘˶ )</span> ♡
        </div>
        <div className="dlgbtns" style={{justifyContent:"center"}}>
          <button className="wbtn" onClick={()=>setGroupNew(false)}>ok ♡</button>
        </div>
      </div>
    </Dialog>}
    {getcha&&<GetCha char={getcha} onClose={()=>setGetcha(null)}/>}
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
    {whoAsk&&<Dialog title="d-0.exe" onClose={()=>setWhoAsk(false)}>
      <div className="ddq">
        <div className="k">stay ♡ but</div>
        {/* 이 제품은 처음부터 끝까지 빈칸을 채우는 이야기다. 마지막 칸도 그래야
            한다 — 얼굴을 고르는 게 아니라 이름을 쓴다. 아무 이름이나 되는 건
            아니고, 이 세계에 있는 두 사람만 들어간다. */}
        <div className="q">Stay with <WhoBlank onPick={pickWho}/>?</div>
        <div className="s">선택은 NEVER EVER! <span className="kao">{'(ᐡ⊃ෆ  ̫ ෆ ᐡ)⊃︵ 💕💕💕'}</span></div>
      </div>
    </Dialog>}
    {whoDone&&<Dialog title="d-0.exe" onClose={()=>setWhoDone(null)}>
      <div className="ddq">
        <div className="q">{whoDone==="jaeeon"?"이재언이 NULL 기다리고 있어!":"이민현이 NULL 기다리고 있어!"}
          {' '}<span className="kao">{'꒰ྀི⸝⸝> . <⸝⸝꒱ྀི'}</span></div>
        <div className="dlgbtns"><button className="bevel pink" onClick={()=>setWhoDone(null)}>+{ENROLL_DAYS}d ♡</button></div>
      </div>
    </Dialog>}
    {toast&&!getcha&&<div className="toast"><span>✧ {toast}</span></div>}
  </div>;
}

