/* NULL — 화면 조각.
   아이콘, 아바타, 창, 그리고 방 목록·채팅방 같은 큰 화면까지.
   여기 있는 것은 「어떻게 보이는가」다. 상태는 위(App)에서 내려온다.
   JSX가 있어서 바벨을 탄다. app-data.js보다 뒤에 실려야 한다. */
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
  const st={width:size,height:size,...(heat!=null?heatRing(CHARS[room.id],heat):null)};
  const on=nu?" nu":"";   // 프로필이 바뀌었는데 아직 안 봤다
  // 1:1 방의 얼굴만 눌러서 프로필로 들어간다. 단톡/관전방은 대상이 없다.
  const hit=onProfile&&room.type==="dm"
    ? {className:"avatar face clickable"+on,onClick:e=>{e.stopPropagation();onProfile(room.id)}}
    : {className:"avatar face"+on};
  if(room.type==="group"){ // 물방울
    return <div className="avatar" style={{...st,background:"linear-gradient(180deg,#ffffff,#e0ecfa)"}}><BubbleIcon size={size*.6}/></div>;
  }
  if(room.type==="watch"){ // 관전방: 달
    return <div className="avatar" style={{...st,color:"#8a7fc0",background:"linear-gradient(180deg,#ffffff,#dde3f4)"}}><MoonIcon size={size*.5}/></div>;
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
          <button key={g.key} className="citem" onClick={()=>setPick(g)}>
            {g.badge&&<span className={"cbadge"+(g.badge==="HOT"?" mint":"")}>{g.badge}</span>}
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
      {["jaeeon","minhyun"].map(c=>{
        /* 이미 어느 자리에 있으면 그 사람에게만 준다. 딴 사람을 고르면
           지금 자리를 말없이 버리고 옮겨가는 그림이 된다 — 인사도 없이 */
        const done=given(c), shut=done||today(c)||(!!withChar&&!here(c)), sel=to===c;
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
              {done?"SENT ♡":today(c)?"TOMORROW ♡":(withChar&&!here(c))?"NOT HERE"
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
function RoomList({store,name,unlocked,counts,seenStage,groupOn,onCart,onPlate,onOpen,onProfile,onAuto,autoLoading,onExport,onReadAll,onRename,onReset,onToast,profile,onSaveField,gifts,onGift,hearts,bag,met,onGoPlace,onEnergyBar,onGuess}){
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
        onClick={()=>{setMenu(null);onCart()}}><img className="navpixel" src={av("ui/null-gift-icon.svg")} alt=""/>gift</span>
      {/* gift는 준 것, bag은 받은 것. 나란히 둔다 — 한쪽만 있으면 주기만 하는 앱이 된다 */}
      {/* 알약은 안 붙인다. 가방은 알림함이 아니라 서랍이다 — 새로 들어온 게
          있다고 숫자가 뜨면 그걸 없애려고 여는 창이 된다 */}
      <span className="mbtn ico" title="what they gave u"
        onClick={()=>{setMenu(null);setDlg("bag")}}><img className="navpixel" src={av("ui/null-bag-icon.svg")} alt=""/>bag</span>
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
          <img className="ico" src={av("ui/null-gift-icon.svg")} alt=""/>
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
          <img className="ico" src={av("ui/null-gift-icon.svg")} alt=""/>
        </button>
        <input className="sunken" value={locked?"":v} disabled={!!locked}
          onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <button className="sendbtn rbtn" disabled={!!locked||!v.trim()||busy} onClick={send} style={{background:sendBg(room)}}><SendIcon/></button>
      </div>}
    <PhotoWin shot={zoom} onClose={()=>setZoom(null)}/>
    {fixBox}
  </div>;
}
