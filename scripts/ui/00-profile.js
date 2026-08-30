/* NULL web UI · icons, avatars, character profiles
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
/* NULL — 화면 조각.
   아이콘, 아바타, 창, 그리고 방 목록·채팅방 같은 큰 화면까지.
   여기 있는 것은 「어떻게 보이는가」다. 상태는 위(App)에서 내려온다.
   JSX가 있어서 바벨을 탄다. scripts/data보다 뒤에 실려야 한다. */
/* 캐릭터 프로필 아이콘 */
/* 아이콘: 픽셀풍 (crispEdges) */
const px={shapeRendering:"crispEdges"};
const MoonIcon=({size=14,color})=><svg width={size} height={size} viewBox="0 0 16 16">
  {/* 초승달 = 원에서 어긋난 원을 뺀 것. 호 하나로 그리려면 플래그가 까다로워서
     mask로 잘라낸다. 모양이 어디서나 같으니 id는 하나로 쓴다. */}
  <mask id="moonc"><circle cx="8" cy="8" r="6.4" fill="#fff"/>
    <circle cx="11.2" cy="4.8" r="6.4" fill="#000"/></mask>
  <circle cx="8" cy="8" r="6.4" fill={color||"currentColor"} mask="url(#moonc)"/>
  <path d="M12.4 2l.45 1.15L14 3.6l-1.15.45L12.4 5.2l-.45-1.15L10.8 3.6l1.15-.45z"
    fill={color||"currentColor"} opacity=".7"/></svg>;
const BackIcon=()=><svg width="13" height="13" viewBox="0 0 14 14" style={px}><path d="M8 2h2v2H8v2H6v2h2v2h2v2H8v-2H6V8H4V6h2V4h2V2z" fill="currentColor"/></svg>;
const SendIcon=()=><svg width="14" height="14" viewBox="0 0 14 14" style={px}><path d="M6 1h2v2h2v2h2v2h-2V5H8v8H6V5H4v2H2V5h2V3h2V1z" fill="currentColor"/></svg>;
const StarGlyph=({color="#fff"})=><span style={{fontSize:11,color,textShadow:"1px 1px 0 rgba(93,84,144,.4)"}}>✦</span>;
const CrossIcon=({size=14,color="#3fbdb4"})=><svg width={size} height={size} viewBox="0 0 14 14" style={px}><path d="M5 2h4v3h3v4H9v3H5V9H2V5h3V2z" fill={color}/></svg>;
const Star4Icon=({size=14,color="#ff8a5f"})=><svg width={size} height={size} viewBox="0 0 14 14"><path d="M7 0l1.8 5.2L14 7l-5.2 1.8L7 14 5.2 8.8 0 7l5.2-1.8z" fill={color}/></svg>;
const LockIcon=({size=16})=><svg width={size} height={size} viewBox="0 0 14 14" style={px}><path d="M4 6V4h1V3h1V2h2v1h1v1h1v2" fill="none" stroke="#fff" strokeWidth="1.5"/><rect x="3" y="6" width="8" height="6" fill="#fff"/><rect x="6" y="8" width="2" height="3" fill="#8f86c9"/></svg>;
/* 단톡방: 물방울(비누방울) 아이콘 */
const BubbleIcon=({size=16})=><svg width={size} height={size} viewBox="0 0 16 16"><circle cx="7" cy="8" r="5.4" fill="none" stroke="#9db7e8" strokeWidth="1.3"/><circle cx="7" cy="8" r="5.4" fill="#cfe0f8" opacity=".45"/><path d="M4.4 6.2a3.4 3.4 0 0 1 2-1.7" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12.6" cy="3.6" r="1.7" fill="none" stroke="#9db7e8" strokeWidth="1"/><circle cx="12.6" cy="3.6" r="1.7" fill="#e2edfb" opacity=".5"/><circle cx="13.4" cy="12.4" r="1.1" fill="none" stroke="#9db7e8" strokeWidth=".9"/></svg>;
const CharIcon=({id,size=15})=>id==="jaeeon"?<CrossIcon size={size} color={CHARS.jaeeon.dk}/>:id==="minhyun"?<Star4Icon size={size} color={CHARS.minhyun.dk}/>:<BubbleIcon size={size}/>;

/* ── Y2K 스티커 세트 ──
   전부 인라인 SVG다. 파일을 안 받으므로 로딩이 없고 색도 코드로 맞춘다.
   많이 뿌리면 촌스러워지니 자리를 정해두고 거기에만 쓴다. */
/* 선물 아이콘. 사진이 아니라 그림이라 파일이 없어도 지금 바로 보인다.
   장바구니에 뜨는 건 이것이고, 배경으로 걸리는 건 gift-*.webp 쪽이다. */
/* 가방 — 받은 것들이 들어간다. 선물 상자와 헷갈리면 안 되므로 손잡이를 단다 */
const BagIcon=({size=15})=><svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.1">
  <path d="M8.4 9V6.6C8.4 4.6 10 3.2 12 3.2s3.6 1.4 3.6 3.4V9" fill="none" stroke="#5d5490"/>
  <rect x="3.6" y="8.6" width="16.8" height="12.2" rx="1.6" fill="#c9e2d6" stroke="#5d5490"/>
  <rect x="3.6" y="8.6" width="16.8" height="3.2" rx="1" fill="#e4f2ea" stroke="#5d5490"/>
  <circle cx="12" cy="15.4" r="1.5" fill="#fff" stroke="#5d5490" strokeWidth=".9"/></svg>;

const GiftIcon={
  /* 담아서 결제하는 화면이 아니라 골라서 포장해 보내는 화면이라 카트가 아니다.
     ♡로 사는 건데 카트가 붙어 있으면 돈 붙은 줄 안다. */
  /* 담아서 결제하는 화면이 아니라 골라서 포장해 보내는 화면이라 카트가 아니다.
     ♡로 사는데 카트가 붙어 있으면 돈 붙은 줄 안다.
     선 그림으로 뽑으니 17px에서 윤곽만 남아 밋밋했다. 아래 선물들과 같은
     방식으로 — 파스텔로 채우고 진보라로 두르는 — 다시 그렸다. */
  cart:({size=17})=><svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.1">
    <path d="M12 7.2C12 4.3 10.3 2.6 8.7 3.4 7.2 4.1 7.8 6.5 12 7.2z" fill="#ffb0d4" stroke="#5d5490"/>
    <path d="M12 7.2C12 4.3 13.7 2.6 15.3 3.4 16.8 4.1 16.2 6.5 12 7.2z" fill="#ffb0d4" stroke="#5d5490"/>
    <rect x="3.6" y="11" width="16.8" height="9.8" rx="1.2" fill="#ffc2dd" stroke="#5d5490"/>
    <rect x="2.2" y="7.2" width="19.6" height="4" rx="1" fill="#ffdcec" stroke="#5d5490"/>
    <rect x="10.4" y="7.2" width="3.2" height="13.6" fill="#fff4f9" stroke="#5d5490"/></svg>
};

const Sticker={
  cd:({size=34})=><svg width={size} height={size} viewBox="0 0 32 32">
    <defs><linearGradient id="cdg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#ffd6f0"/><stop offset=".35" stopColor="#c9e6ff"/>
      <stop offset=".65" stopColor="#d9ffe8"/><stop offset="1" stopColor="#ffe9b8"/></linearGradient></defs>
    <circle cx="16" cy="16" r="15" fill="url(#cdg)" stroke="#a996d8"/>
    <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeOpacity=".7"/>
    <circle cx="16" cy="16" r="4.2" fill="#fdfbff" stroke="#a996d8"/>
    <circle cx="16" cy="16" r="1.6" fill="#c9c0ee"/></svg>,
  floppy:({size=26})=><svg width={size} height={size} viewBox="0 0 24 24" shapeRendering="crispEdges">
    <rect x="2" y="2" width="20" height="20" fill="#b8a5e3" stroke="#5d5490"/>
    <rect x="7" y="3" width="10" height="7" fill="#efeaf9"/><rect x="13" y="4" width="3" height="5" fill="#8a7fc0"/>
    <rect x="6" y="13" width="12" height="8" fill="#fdfbff" stroke="#8a7fc0"/>
    <rect x="8" y="15" width="8" height="1" fill="#c9c0ee"/><rect x="8" y="17" width="8" height="1" fill="#c9c0ee"/></svg>,
  butterfly:({size=18,color="#ff9ec6"})=><svg width={size} height={size} viewBox="0 0 20 20">
    <path d="M10 10 C6 2 1 3 2 8 C2.6 11.4 6.6 11.4 10 10z" fill={color} opacity=".85"/>
    <path d="M10 10 C14 2 19 3 18 8 C17.4 11.4 13.4 11.4 10 10z" fill={color} opacity=".85"/>
    <path d="M10 10 C7 15 3 16 4 18 C5 19.6 8.6 14.6 10 10z" fill={color} opacity=".6"/>
    <path d="M10 10 C13 15 17 16 16 18 C15 19.6 11.4 14.6 10 10z" fill={color} opacity=".6"/>
    <rect x="9.4" y="6" width="1.2" height="9" rx=".6" fill="#6b5fa8"/></svg>,
  cursor:({size=17})=><svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges">
    <path d="M3 2h1v1h1v1h1v1h1v1h1v1h1v1h1v1h-4v1h-1v1h-1v1h-1V2z" fill="#fff" stroke="#5d5490" strokeWidth=".8"/></svg>,
  star:({size=16,color="#ffd68a"})=><svg width={size} height={size} viewBox="0 0 16 16">
    <path d="M8 0l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={color}/></svg>,
  heart:({size=15,color="#ff7fae"})=><svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges">
    <path d="M3 4h2v-1h2v1h2v-1h2v1h2v3h-1v2h-1v2h-1v1h-1v1H7v-1H6v-1H5v-2H4V7H3z" fill={color}/></svg>,
};

/* 떠다니는 반짝이 레이어 */
const BG="bg-desk.webp";
const BUBBLES=[[8,14,13,0],[22,9,17,2.5],[38,18,15,5],[54,11,19,1.2],[68,15,14,6.5],[84,8,16,3.4],[92,12,18,8]];
const SPARKS=[[6,10,10,"#fff"],[86,7,8,"#ffd0e6"],[70,24,12,"#fff"],[13,42,9,"#ffe9a8"],[91,50,10,"#d5c8ff"],[38,68,8,"#fff"],[76,84,11,"#ffd0e6"],[8,88,8,"#d5c8ff"]];
const Sparkles=()=><React.Fragment>{SPARKS.map((s,i)=><span key={i} className="spark" style={{left:s[0]+"%",top:s[1]+"%",width:s[2],height:s[2],background:s[3],animationDelay:(i*0.4)+"s"}}/>)}</React.Fragment>;

/* 창 타이틀바의 동그란 ─ □ ✕ */
const WinDots=({onClose})=><div className="dots"><span className="d1"><i/></span><span className="d2"><i/></span><span className="d3" onClick={onClose} style={onClose?{cursor:"pointer"}:null}><i/></span></div>;

/* 프로필 사진 줄맄 스타일 */
/* 확대율·위치는 사진마다 다르다. 사진을 갈아끼우면 CHARS의 zoom/pos를 다시 잡을 것.
   너무 키우면 머리 위가 잘린다 — 150% 근처가 머리 전체가 들어오는 한계다. */
/* 보내기 단추 색.
   전에는 흰색이 -30%에서 시작해 방 색을 95%까지 밀어놨다. 눈에 보이는 구간이
   거의 다 흰색이라 단추가 허옇게 떴고, 그 위에 흰 광택(::after)이 한 번 더
   얹혀서 방 색이 아예 안 읽혔다. 흰 화살표도 같이 묻혔다.
   위에서 아래로 연한색 → 방 색 → 짙은색. 가운데가 방 색이라야 방 색으로 보인다. */
/* 연한색·짙은색은 CHARS에 있고 방 목록(ROOMS)에는 색 하나뿐이다.
   단톡·관전방은 CHARS에 없으므로 그 방 색으로 셋을 다 만든다 */
const sendBg=room=>{
  const c=CHARS[room.id]||{};
  const mid=c.color||room.color;
  return `linear-gradient(180deg, ${c.pale||mid} 0%, ${mid} 46%, ${c.dk||mid} 100%)`;
};
const faceBg=ch=>({backgroundImage:`url("${ch.img+AV_V}")`,backgroundSize:ch.zoom||"150%",backgroundPosition:ch.pos,backgroundColor:ch.pale});
function Avatar({room,size=42,onProfile,heat,nu}){
  /* 얼굴 링은 인물 구분만 남기고 원색 청록·주황을 쓰지 않는다.
     배경과 아이콘이 자개 톤인데 여기만 선명하면 예전 UI 조각처럼 튄다. */
  const ringCh=room.id==="jaeeon"?{dk:"#9fcdd2"}
    :room.id==="minhyun"?{dk:"#e5b5b5"}:CHARS[room.id];
  const st={width:size,height:size,...(heat!=null?heatRing(ringCh,heat):null)};
  const on=nu?" nu":"";   // 프로필이 바뀌었는데 아직 안 봤다
  // 1:1 방의 얼굴만 눌러서 프로필로 들어간다. 단톡/관전방은 대상이 없다.
  const hit=onProfile&&room.type==="dm"
    ? {className:"avatar face clickable"+on,onClick:e=>{e.stopPropagation();onProfile(room.id)}}
    : {className:"avatar face"+on};
  if(room.type==="group"){
    return <div className="avatar groupavatar" style={st}><img className="specialroomicon" src="assets/ui/messenger/room-group.png?v=244" alt=""/></div>;
  }
  if(room.type==="watch"){
    return <div className="avatar watchavatar" style={st}><img className="specialroomicon" src="assets/ui/messenger/room-watch.png?v=244" alt=""/></div>;
  }
  return <div {...hit} style={{...st,...faceBg(CHARS[room.id])}}/>;
}

/* ── 캐릭터 프로필 ──
   관계 단계에 따라 상태메시지와 프로필 뮤직이 바뀐다.
   단계 기준(0/16/40/80)은 worker.js의 STAGES와 같아야 한다. */
/* 프로필이 바뀌는 지점. 마지막 120은 .hidden의 일기가 열리는 지점과 같다 —
   마지막 달에 배경과 일기가 함께 열린다.
   worker.js의 STAGES는 0/16/40/80 네 단계로 모델의 연기 톤을 정한다.
   그쪽은 "관계가 어디까지 왔나"고 이쪽은 "화면이 어떻게 보이나"라 길이가 달라도 된다.
   다만 HEAT는 이 배열과 길이가 같아야 한다. */
/* 대화 수와 날짜를 둘 다 넘어야 다음 단계다. 느린 쪽이 정한다.
   전에는 대화 수만 봤는데 유저는 하루에 백 개씩 보낸다. 그러면 첫날 밤에
   마지막 단계까지 가버린다 — 화면에는 D-29라고 적혀 있는데.
   1일은 1일이어야 한다. worker.js의 STAGES와 같아야 한다. */
const STAGE_AT=[0,16,40,80,120];
const STAGE_DAY=[0,4,10,18,25];
const stageIdx=(n,days)=>{let i=0;STAGE_AT.forEach((a,k)=>{if(n>=a&&(days||0)>=STAGE_DAY[k])i=k});return i};

/* 음원 위치. 저장소에 파일을 올리면 그대로 잡히고,
   R2 같은 외부 호스팅을 쓰면 MEDIA만 그 주소로 바꾸면 된다.
   파일이 없으면 재생 버튼은 조용히 숨는다. */
/* 앱(lib/profiles.ts)과 같은 R2 버킷·같은 파일명을 쓴다 */
const MEDIA="https://pub-6e08882e001c49cbb013168e4b9e8d38.r2.dev/";
/* 인물마다 넉 장. 관계가 깊어지면 배경과 같이 다음 곡이 걸린다.
   단계는 다섯인데 곡은 넷이라, 처음 두 단계(0~16)가 첫 곡을 같이 쓴다 —
   아직 아무 일도 안 일어난 구간이라 곡이 바뀔 이유가 없다.
   앱(lib/profiles.ts)의 TRACKS·TRACK_INFO와 같아야 한다. */
const TRACKS={
  "jaeeon-1": {file:"jaeeon1.mp3", artist:"Noah Vane",        title:"Two Bowls"},
  "jaeeon-2": {file:"jaeeon2.mp3", artist:"The Pale Cinema",  title:"Strangers, Again"},
  "jaeeon-3": {file:"jaeeon3.mp3", artist:"Mara Grey",        title:"Sugar Without Taste"},
  "jaeeon-4": {file:"jaeeon4.mp3", artist:"Sunday Archive",   title:"No Forwarding Address"},
  "minhyun-1":{file:"minhyun1.mp3",artist:"Luca Riot",        title:"Ask Again Tomorrow"},
  "minhyun-2":{file:"minhyun2.mp3",artist:"Cherry Crash",     title:"Online at 2AM"},
  "minhyun-3":{file:"minhyun3.mp3",artist:"Plastic Halo",     title:"Don't Look at Me Like That"},
  "minhyun-4":{file:"minhyun4.mp3",artist:"Last Exit Kids",   title:"Stay Until the Song Ends"},
  // 메신저 자체의 BGM — 데스크 가운데 CD를 누르면 나온다.
  // R2에 null1.mp3를 올리면 살아난다. 없으면 CD가 "no disc"만 띄운다.
  "null-1":   {file:"null1.mp3",   artist:"",          title:""},
};
const MAIN_TRACK="null-1";
const trackOf=k=>{const t=k&&TRACKS[k];return t&&t.file?{...t,src:MEDIA+t.file}:null};

/* 단계별 프로필 — 상태메시지(빈 문자열이면 안 띄운다) / 배경 / BGM.
   bg는 관계가 깊어질수록 바뀐다. app/profiles.ts의 stages와 같아야 한다 —
   어긋나면 같은 사람 프로필이 웹과 앱에서 다른 배경으로 나온다.
   단계 경계(0/16/40/80)는 stageIdx가 정하고, worker.js의 STAGES와 맞춰져 있다. */
const PROFILES={
  /* 재언 — 밝은 데서 어두운 데로. 미술관에서 시작해 계단참, 복도, 밤 차 안을
     지나 마지막이 부엌이다. 씻어서 엎어놓은 그릇이 두 개인 부엌.
     1인분을 계량하던 사람한테 2인분이 손에 붙었다는 게 그 사진이다. */
  jaeeon:{fallback:"jaeeon-gallery.webp",stages:[
    {status:"별일 없어요.", bg:"jaeeon-gallery.webp", track:"jaeeon-1"},
    {status:"문은 열어둘게요.", bg:"jaeeon-landing.webp", track:"jaeeon-1"},
    {status:"어디 안 가요.", bg:"jaeeon-lobby.webp", track:"jaeeon-2"},
    {status:"아직 남았어요.", bg:"jaeeon-drive.webp", track:"jaeeon-3"},
    {status:"남은 동안은 여기 있어요.", bg:"jaeeon-kitchen.webp", track:"jaeeon-4"},
  ]},
  /* 민현 — 안에서 밖으로. 레코드샵에서 시작해 버스, 골목을 지나 옥상에서 끝난다.
     같은 비 오는 밤인데 재언은 운전석에 앉아 있고 이 애는 버스에 서 있다. */
  minhyun:{fallback:"minhyun-sunset.webp",stages:[
    {status:"수업 중. 아마도.", bg:"minhyun-shop.webp", track:"minhyun-1"},
    {status:"기다리는 거 아니에요.", bg:"minhyun-lp.webp", track:"minhyun-1"},
    {status:"그 말 취소하면 안 돼요.", bg:"minhyun-bus.webp", track:"minhyun-2"},
    {status:"곧이잖아요. 지금이 아니라.", bg:"minhyun-cat.webp", track:"minhyun-3"},
    {status:"안 알려줘도 알아요.", bg:"minhyun-sunset.webp", track:"minhyun-4"},
  ]},
};

/* 떠난 뒤의 상메. 이건 대화 수가 아니라 시계가 정한다 —
   실습이 끝나는 건 몇 마디 했느냐와 상관없는 일이라서다.
   대화 수에 걸어놨더니 하루에 백스무 마디 하면 D-29에 작별 인사가 떴다.
   D-0이 되면 단계가 어디든 이걸로 덮는다. */
const STATUS_GONE={jaeeon:"잘 지내요. 항상.", minhyun:"모르는 걸로 할게요."};
/* D-0에서 멈춰만 두면 서른한 날째에도 백 일째에도 작별 인사를 걸어놓고
   유저와 계속 대화하는 화면이 된다. 떠난 뒤를 둘로 나눈다 —
   기준은 D-0 뒤에 유저가 말을 했느냐. 유저 발화만 센다. */
const STATUS_BACK={jaeeon:"아직 자리 있어요.", minhyun:"이제 와요?"};
/* 떠나는 날은 세계 시계가 정한다 — 스피드 모드의 서른 날은 현실 7.5일이다.
   현실 30일로 재면 재회가 영영 안 온다(cameBackAt이 그 환산을 들고 있다). */
const cameBackOf=store=>cameBackAt(store);

/* 본 단계와 지금 단계 사이에 실제로 달라진 것. 목록은 이게 비었는지만 본다.
   단계가 올랐어도 배경·곡·상메가 다 그대로면 알릴 일이 없다.
   두 단계를 건너뛰었어도 답은 "지금 무엇이 그때와 다른가" 하나다. */
const stageDiff=(char,seen,now)=>{
  const ss=(PROFILES[char]||{}).stages||[], a=ss[seen], b=ss[now];
  if(!a||!b||now<=seen)return [];
  return ["bg","track","status"].filter(k=>(a[k]||"")!==(b[k]||""));
};

/* 프로필 뮤직 — 눌러야 나온다. 곡 정보가 비어 있으면 "BGM 없음"으로 둔다.
   (없는 곡 제목을 지어내지 않기 위해 TRACKS의 artist/title은 비워둔 상태다) */
/* 배경 파일이 아직 없을 수 있다(사진은 나중에 올라온다).
   CSS background-image는 파일이 없어도 알려주지 않고 그냥 빈 화면이 되므로,
   먼저 불러보고 실패하면 그 인물의 기존 배경으로 돌아간다.
   파일을 올리는 순간 코드를 고치지 않아도 새 배경이 뜬다. */
function useBg(src,fallback){
  const [ok,setOk]=useState(null);   // null=확인 중
  useEffect(()=>{
    if(!src){setOk(false);return}
    let alive=true; const img=new Image();
    img.onload =()=>{if(alive)setOk(true)};
    img.onerror=()=>{if(alive)setOk(false)};
    img.src=src;
    return()=>{alive=false};
  },[src]);
  return ok?src:fallback;   // 확인 중에도 fallback을 보여준다 — 빈 화면이 깜빡이지 않게
}

function MusicBar({track,color,onPlay}){
  const ref=useRef(null);
  const [playing,setPlaying]=useState(false);
  const [dead,setDead]=useState(false);   // 파일이 없으면 재생 불가로 처리
  useEffect(()=>{const a=ref.current;return()=>{if(a)a.pause()}},[]);
  const label=track?[track.artist,track.title].filter(Boolean).join(" — "):"";
  if(!track||dead)return <div className="pfbgmoff">♪  no bgm</div>;
  const toggle=()=>{
    const a=ref.current;if(!a)return;
    if(playing){a.pause();setPlaying(false)}
    // 인물 BGM이 시작되면 데스크 CD는 멈춘다 — 두 곡이 겹쳐 나오면 안 된다
    else a.play().then(()=>{onPlay&&onPlay();setPlaying(true)}).catch(()=>setDead(true));
  };
  return <React.Fragment>
    <audio ref={ref} src={track.src} loop preload="none" onError={()=>setDead(true)} onEnded={()=>setPlaying(false)}/>
    <button className={"pfbgm"+(playing?" on":"")} onClick={toggle} style={{color}}>
      {playing&&<span className="np">now playing</span>}
      <span className="play" style={{borderColor:color,color}}>{playing?"❚❚":"▶"}</span>
      <span className="lab">{label||"press play ♪"}</span>
      <span className="eq"><i/><i/><i/></span>
    </button>
  </React.Fragment>;
}

function Profile({char,count,onBack,gifts,dLeft,back,days}){
  const ch=CHARS[char], p=PROFILES[char], room=roomOf(char);
  const [full,setFull]=useState(false);   // 배경만 크게 보기
  const st=p?(p.stages[stageIdx(count,days)]||p.stages[0]):null;
  /* 배경은 단계를 따라간다. 파일이 아직 없으면 그 인물의 기존 배경으로 돌아간다.
     훅은 아래 조건부 return보다 위에 있어야 한다 — 밑으로 내려가면 렌더마다
     훅 호출 수가 달라져서 React가 터진다. */
  /* 배경 우선순위: 유저가 준 선물 > 단계 배경. 자동으로 바뀌는 것보다
     유저가 건 것이 앞선다 — 그게 이 기능의 요지다.
     다만 GIFT_AT 단계는 지나야 한다. 주자마자 걸리면 사는 것이지 관계가 아니다. */
  const given=(gifts&&gifts[char])||[];
  /* 배경이 되는 건 사진이 있는 선물뿐이다. 그냥 마지막 선물을 집으면
     사진 없는 걸 방금 준 순간 단계 배경까지 같이 날아간다.
     그래서 뒤에서부터 사진 있는 것을 찾는다. */
  const hung=stageIdx(count,days)>=GIFT_AT
    ? given.slice().reverse().find(k=>(GIFTS.find(g=>g.key===k)||{}).bg) : null;
  const wanted=hung?(GIFTS.find(g=>g.key===hung)||{}).bg:(st&&st.bg);
  const bg=useBg(wanted,(p&&p.fallback)||char+"-bg.webp");
  if(!ch||!p)return null;
  /* 떠났으면 단계와 상관없이 작별 인사다. 시계가 단계를 이긴다 */
  const status=((dLeft===0?(back?STATUS_BACK:STATUS_GONE)[char]:null)||st.status||"").trim();
  return <div className="pfscreen" style={{backgroundImage:`url("${bg}")`}}>
    <div className="pfdim" onClick={e=>{if(e.target===e.currentTarget)setFull(true)}}>
      <Sparkles/>
      <div className="pfcard glasswindow">
        <WindowChrome title={`${char}.hompy`} onClose={()=>setFull(true)}/>
        <div className="pftop">
          <div className="pfpola">
            <span className="tape t1"/><span className="tape t2"/>
            <div className="shot" style={faceBg(ch)}/>
            <div className="cap">{room?room.empty:""}</div>
          </div>
          <div className="pfnamerow">
            <span className="deco" style={{color:ch.dk}}>✦</span>
            <span className="nm">{ch.name}</span>
            <span className="deco" style={{color:"#ff7fae"}}>♡</span>
          </div>
          {status&&<div className="pfbubble"><div className="b">{status}</div><div className="tail"/></div>}
        </div>
        <MusicBar track={trackOf(st.track)} color={ch.dk}/>
        <div className="pfstats">
          <div className="s"><span className="l">TODAY</span><span className="v" style={{color:"#ff7fae"}}>1</span></div>
          <div className="s"><span className="l">TALK</span><span className="v" style={{color:ch.dk}}>{count}</span></div>
        </div>
        <div className="pfstickers">
          {["✿","★","♡","✧","☾"].map((x,i)=><span key={i} style={{color:["#c3b2f0","#b9a7e6","#a78fe0","#8fd8e8","#d5c8ff"][i]}}>{x}</span>)}
        </div>
        <button className="pfclose bevel" onClick={onBack}>◁ BACK</button>
      </div>
    </div>
    {full&&<div className="bgfull" style={{backgroundImage:`url("${bg}")`}} onClick={onBack}>
      <span className="bgclose">tap to close</span>
    </div>}
  </div>;
}
