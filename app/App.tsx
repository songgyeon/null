// App.tsx — NULL RN(Expo). 로직 동일, UI 레이어만 웹 버전 톤으로 재구성.
// 설치: npx expo install expo-linear-gradient expo-font expo-audio react-native-safe-area-context
// 폰트: https://github.com/quiple/galmuri 릴리즈에서 Galmuri11.ttf → assets/fonts/Galmuri11.ttf
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, Image, Modal,
  ImageBackground, Animated, Easing, StyleSheet, Dimensions, StatusBar,
  Platform, Share, BackHandler, Keyboard, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { initDB, getMsgs, insertMsg, getMeta, setMeta, clearAll, countMsgs, Msg } from './lib/db';
import { sendChat, genAuto, IMG } from './lib/api';
import { currentStage, PROFILES, TRACKS, TRACK_INFO, MAIN_TRACK, saveStatus,
         GIFTS, GIFT_CATS, GIFT_HINT, loadGifts, saveGifts, bgFor, heartsOf } from './lib/profiles';
import { useAudioPlayer } from 'expo-audio';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;

const P = {
  ink:'#4a4276', border:'#5d5490', mid:'#8a7fc0', chrome:'#dcd6f2', bg:'#ece8fa',
  pink:'#ff9ec6', sub:'#9a8fc8', dim:'#b0a6d8', badge:'#ff7fae', err:'#c23b50', dark:'#2a2450',
  lav:'#c3b2f0', shade:'#cdc3ec',
};
const F = { fontFamily:'Galmuri11' } as const; // 픽셀 폰트 — 모든 Text에 적용

const CHARS:Record<string,{name:string;color:string;dk:string;pale:string}> = {
  jaeeon:{ name:'이재언', color:'#7FD8D8', dk:'#2fa8a0', pale:'#cef0ee' },
  minhyun:{ name:'이민현', color:'#FF9E80', dk:'#f0764a', pale:'#ffe0d2' },
};

const ROOMS = [
  { id:'jaeeon',  name:'이재언', color:'#7FD8D8', type:'dm',    sub:'보건교사, 29세' },
  { id:'minhyun', name:'이민현', color:'#FF9E80', type:'dm',    sub:'고등학생, 20세' },
  { id:'group',   name:'단톡방', color:'#B8A5E3', type:'group', sub:'loading...' },
  { id:'health',  name:'두 사람', color:'#9aa3d8', type:'watch', sub:'access denied' },
] as const;

/* 교생 실습 기간. etc.의 D-카운트가 여기서 나온다. 웹의 ENROLL_DAYS와 같다 */
const ENROLL_DAYS = 30;

/* 갤러리(Cam 탭) — 웹 버전과 동일. PHOTOS 키도 여기서 파생 */
const GALLERY:Record<string,string[]> = {
  jaeeon:['jaeeon-treat','jaeeon-care','jaeeon-cook','jaeeon-work','jaeeon-evening','jaeeon-market','jaeeon-laundry','jaeeon-car','jaeeon-classroom','jaeeon-rooftop','jaeeon-curtain','jaeeon-shelf','jaeeon-bandage','jaeeon-cabinet','jaeeon-bottle','jaeeon-chart','jaeeon-door','jaeeon-mug','jaeeon-back'],
  minhyun:['minhyun-candy','minhyun-corridor','minhyun-rain','minhyun-gate','minhyun-morning','minhyun-alley','minhyun-store','minhyun-gym','minhyun-busstop','minhyun-winter','minhyun-snow','minhyun-bench','minhyun-desk','minhyun-stair','minhyun-vending','minhyun-laundry','minhyun-conv','minhyun-nap','minhyun-neon','minhyun-ramen','minhyun-window','minhyun-mirror'],
};
const PHOTOS:Record<string,string> = {};
Object.values(GALLERY).forEach(l=>l.forEach(k=>{PHOTOS[k]=k+'.webp'}));
/* .hidden 탭 — 해금된 key는 meta 'null_unlocked'(JSON 배열)에서 읽는다 */
/* .hidden — room/at은 worker.js의 UNLOCKS, index.html의 HIDDEN과 같아야 한다.
   어긋나면 화면에 뜨는 "N more"가 실제 해금 시점과 달라진다. */
const HIDDEN=[
  {key:'jaeeon-bag',           label:'재언의 가방', room:'jaeeon', at:12},
  {key:'minhyun-bag',          label:'민현의 가방', room:'minhyun', at:12},
  {key:'jaeeon-room',          label:'재언의 방', room:'jaeeon', at:26},
  {key:'minhyun-room',         label:'민현의 방', room:'minhyun', at:26},
  {key:'jaeeon-playlist',      label:'재언의 플레이리스트', room:'jaeeon', at:44},
  {key:'minhyun-playlist',     label:'민현의 플레이리스트', room:'minhyun', at:44},
  {key:'jaeeon-ticket',        label:'재언의 티켓', room:'jaeeon', at:64},
  {key:'minhyun-ticket',       label:'민현의 티켓', room:'minhyun', at:64},
  {key:'jaeeon-yearbook',      label:'재언의 졸업사진', room:'jaeeon', at:90},
  {key:'minhyun-yearbook',     label:'민현의 졸업사진', room:'minhyun', at:90},
  {key:'jaeeon-diary',         label:'재언의 일기', room:'jaeeon', at:120},
  {key:'minhyun-diary',        label:'민현의 일기', room:'minhyun', at:120},
];

/* ── 데모 모드 ── index.html의 것과 같은 각본이다. 한쪽만 고치면 웹과 앱이
   다른 말을 하게 되므로 대사를 바꿀 때는 양쪽을 같이 고친다.
   서버가 죽었거나 키가 없을 때 빈 화면 대신 각본이라도 움직인다.
   조용히 가짜로 바뀌면 진짜 장애를 못 알아채므로, 실패 원인은 콘솔에 남기고
   하단 바에 demo 표시를 띄운다. */
const DEMO = { auto:false };
const demoOn = () => DEMO.auto;

// 유저 말에서 대충의 결만 고른다. 정확할 필요 없다 — 각본을 고르는 데만 쓴다
const demoBucket = (t?:string) => {
  const x=(t||'').trim();
  if(/아프|아파|다쳤|다쳐|열나|배가|머리가/.test(x))return 'hurt';
  if(/안녕|하이|왔|뭐해|자니|일어/.test(x))return 'greet';
  if(/잘생|예쁘|멋있|좋아|고마|최고|귀엽/.test(x))return 'praise';
  if(/갈게|잘자|끊을|바이|간다|가야/.test(x))return 'bye';
  if(/[?？]|왜|뭐|어때|어떻|얼마|언제/.test(x))return 'ask';
  return 'any';
};
const DEMO_LINES:Record<string,Record<string,string[][]>> = {
  jaeeon:{
    greet:[['네.'],['무슨 일 있으세요.'],['오셨어요.','앉으세요.']],
    ask:[['그건 왜 물으세요.'],['글쎄요.','맞다고 해드리면 만족하세요?'],['그런 건 안 궁금해하셔도 됩니다.']],
    hurt:[['어디가요.'],['가만있지 마시고 오세요.','앉아서 봅시다.'],['열은요.','재보고 말씀하세요.']],
    praise:[['…'],['그런 말 안 하셔도 됩니다.'],['…','할 일 있으시면 하세요.']],
    bye:[['네.'],['차 조심하세요.'],['늦었습니다.','가세요.']],
    any:[['그러시든가요.'],['별일 없습니다.'],['…','그건 아까 말씀드렸는데요.']],
  },
  minhyun:{
    greet:[['왔어요?'],['안 올 줄 알았는데'],['뭐예요 갑자기ㅋ','심심했어요?']],
    ask:[['그건 왜요.'],['먼저 말해봐요','그럼 대답할게요'],['제가 왜 대답해야 되는데요ㅋ','…농담이에요.']],
    hurt:[['어디가 아픈데요'],['보건실 가요.','삼촌 있어요'],['혼자 가지 말고요','같이 가요']],
    praise:[['…뭐예요.'],['그런 말 함부로 하지 마요'],['진짜예요?','…아니 됐어요.']],
    bye:[['가요?'],['벌써요'],['…네.','잘 자요.']],
    any:[['ㅡㅡ'],['그래서요'],['말 돌리지 마요','저 알아요 다']],
  },
};
// 단톡방·관전방은 결이 아니라 통째로 고른다
const DEMO_GROUP = [
  [{sender:'minhyun',text:'오늘 급식 뭐였는지 아세요'},{sender:'jaeeon',text:'모른다.'},
   {sender:'minhyun',text:'삼촌한테 안 물어봤는데요'}],
  [{sender:'jaeeon',text:'무슨 일 있으세요'},{sender:'minhyun',text:'저도 궁금한데'},
   {sender:'minhyun',text:'말해봐요 저도 웃게'}],
  [{sender:'minhyun',text:'선생님 내일 오세요?'},{sender:'jaeeon',text:'그건 왜 묻냐.'},
   {sender:'minhyun',text:'ㅡㅡ 제가 물었는데요 삼촌한테 안 물었고'}],
];
const DEMO_AUTO = [
  [{sender:'minhyun',text:'삼촌 오늘 왜 이렇게 일찍 왔어요'},{sender:'jaeeon',text:'일이 빨리 끝났어.'},
   {sender:'minhyun',text:'그런 건 삼촌한테 처음 있는 일인데'},{sender:'jaeeon',text:'씻고 나와.'},
   {sender:'minhyun',text:'교생 선생님이랑 뭐 있었어요?'},{sender:'jaeeon',text:'없어.'},
   {sender:'minhyun',text:'그게 대답이에요 지금'},{sender:'jaeeon',text:'밥 다 될 때까지 나오지 마.'}],
  [{sender:'jaeeon',text:'약 먹었냐.'},{sender:'minhyun',text:'네'},
   {sender:'minhyun',text:'…아직요'},{sender:'jaeeon',text:'먹어.'},
   {sender:'minhyun',text:'삼촌은 오늘 보건실에서 뭐 했어요'},{sender:'jaeeon',text:'일했지.'},
   {sender:'minhyun',text:'혼자요?'},{sender:'jaeeon',text:'…'},
   {sender:'minhyun',text:'아 혼자 아니었구나'}],
];
// 같은 각본이 연달아 나오지 않게 방·결마다 자리를 기억한다
const demoAt:Record<string,number> = {};
const demoPick = (key:string, arr:any[]) => {const i=(demoAt[key]||0)%arr.length; demoAt[key]=i+1; return arr[i]};
function demoReply(room:string, lastText?:string) {
  if(room==='health') return demoPick('health',DEMO_AUTO);
  if(room==='group')  return demoPick('group',DEMO_GROUP);
  const set=DEMO_LINES[room]; if(!set) return [{sender:room,text:'…'}];
  const b=demoBucket(lastText);
  return demoPick(room+':'+b, set[b]||set.any).map((t:string)=>({sender:room,text:t}));
}

/* 프사를 교체해도 파일명이 같으면 앱의 이미지 캐시가 옛 사진을 계속 쓴다.
   사진을 갈아끼울 때마다 이 숫자를 올린다. */
const AV_V = '?v=4';
const face = (id:string) => IMG + id + '-profile.webp' + AV_V;

/* 계산해서 만든 퍼센트 문자열. 그냥 (n*100)+'%'로 쓰면 타입이 string으로 넓어져
   RN의 DimensionValue에 안 들어간다(TS 2769). 자리 하나라 여기서 좁혀둔다. */
const pct = (n:number) => `${Math.max(0, Math.min(100, Math.round(n)))}%` as `${number}%`;

const fmtTime = (ts:number) => {
  const d=new Date(ts), h=d.getHours();
  return `${h<12?'오전':'오후'} ${h%12||12}:${String(d.getMinutes()).padStart(2,'0')}`;
};

/* 괄호만으로 된 말풍선은 대사가 아니라 행동 지문이다 — 말풍선 대신 채팅창에 쳐진 줄로 그린다.
   서버가 줄 단위로 갈라서 보내주므로 여기서는 통째로 괄호인지만 보면 된다. */
/* 지문처럼 그릴 줄: 괄호로만 된 대사, 그리고 sender가 'sys'인 "일어난 일" 줄(선물 등).
   sys를 별도 칸이 아니라 sender에 넣는 이유: db 스키마를 건드리지 않고 저장된다. */
const isNarr = (m:any) => !!m && !m.photo &&
  (m.sender === 'sys' || /^[（(][^()（）]*[)）]$/.test((m.text||'').trim()));

/* ── 접속 상태 ── 시간대만 보고 정한다. 서버를 부르지 않으므로 비용이 없다 */
function presence(id:string){
  const h=new Date().getHours();
  if(id==='jaeeon'){
    if(h>=8&&h<17)  return {s:'on',  t:'보건실'};
    if(h>=17&&h<23) return {s:'away',t:'퇴근'};
    if(h>=23||h<1)  return {s:'away',t:'집'};
    return {s:'off', t:'자는 중'};
  }
  if(id==='minhyun'){
    if(h>=8&&h<16)  return {s:'away',t:'수업 중'};
    if(h>=16&&h<22) return {s:'on',  t:'야자'};
    if(h>=22||h<2)  return {s:'on',  t:'안 자는 중'};
    return {s:'off', t:'꺼짐'};
  }
  return null;
}
const DOT:Record<string,string>={on:'#4fc98a',away:'#f0b34a',off:'#c3bcd8'};

/* ── 관계 온도 ── 단계 이름은 화면에 쓰지 않는다. 색으로만 말한다 */
// lib/profiles.ts의 stages, index.html의 STAGE_AT과 같아야 한다 (0/16/40/80/120)
const STAGE_AT=[0,16,40,80,120];
const stageIdx=(n:number)=>{let i=0;STAGE_AT.forEach((a,k)=>{if(n>=a)i=k});return i};
// stageIdx로 색인한다 — STAGE_AT과 길이가 같아야 한다. 짧으면 마지막 단계에서 터진다
const HEAT=[{w:1,o:'44'},{w:1.5,o:'80'},{w:2,o:'b8'},{w:2.5,o:'e0'},{w:3,o:'ff'}];

/* ── peek 쿨타임 ── 관찰이 흔하면 값이 떨어진다. 연타로 새는 비용도 여기서 막는다 */
const AUTO_COOL=5*60*1000;
const mmss=(ms:number)=>{const t=Math.max(0,Math.ceil(ms/1000));
  return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};

/* ── 프사 크롭 ──
   정사각 사진을 정사각 액자에 넣으면 원본이 통째로 들어가 위가 빈다.
   웹(index.html)의 background-size:150% + position과 같은 결과를 만든다.
   offset = -(pos) * (zoom-1) * size */
const ZOOM=1.5;
const CROP:Record<string,{x:number;y:number}>={jaeeon:{x:.50,y:.22},minhyun:{x:.50,y:.22}};
function Face({char,size,radius,border}:{char:string;size:number;radius?:number;border?:string}){
  const c=CROP[char]||{x:.5,y:.5};
  return <View style={{width:size,height:size,borderRadius:radius??size/2,overflow:'hidden',
    backgroundColor:'#efeaf9',...(border?{borderWidth:1.4,borderColor:border}:{})}}>
    <Image source={{uri:face(char)}} resizeMode="cover"
      style={{width:size*ZOOM,height:size*ZOOM,marginLeft:-c.x*(ZOOM-1)*size,marginTop:-c.y*(ZOOM-1)*size}}/>
  </View>;
}

// 타이핑 딜레이 — 캐릭터별 속도 차등
const typeDelay = (sender:string, text:string) => {
  const base = sender==='jaeeon' ? 60 : 35;
  return Math.min(2200, 400 + text.length * base);
};

// ═══ 공용 UI 부품 ═══

// 그라데이션 타이틀바 (핑크→라벤더)
function TB({colors,children,style}:{colors:[string,string];children:React.ReactNode;style?:any}) {
  return <LinearGradient colors={colors} start={{x:0,y:0}} end={{x:1,y:0}}
    style={[{flexDirection:'row',alignItems:'center',paddingHorizontal:11,paddingVertical:8,
      borderBottomWidth:1,borderBottomColor:P.border},style]}>{children}</LinearGradient>;
}
const tbT={...F,color:'#fff',fontSize:12,letterSpacing:1.2,
  textShadowColor:'rgba(93,84,144,.55)',textShadowOffset:{width:1,height:1},textShadowRadius:0} as const;

// 신호등 ─ □ ✕ — onClose를 주면 ✕가 실제로 닫는 버튼이 된다
function Dots({onClose}:{onClose?:()=>void}) {
  const d:[string,string,string][]=[['#ffd0e6','─','#c46a97'],['#ff9ec6','□','#fff'],['#ff7fae','✕','#fff']];
  return <View style={{marginLeft:'auto',flexDirection:'row',gap:5}}>
    {d.map(([bg,glyph,ink],i)=>{
      const dot=<View style={{width:15,height:15,borderRadius:8,borderWidth:1,borderColor:P.border,
        backgroundColor:bg,alignItems:'center',justifyContent:'center'}}>
        <Text style={{...F,fontSize:7,lineHeight:9,color:ink}}>{glyph}</Text>
      </View>;
      return (i===2&&onClose)
        ? <TouchableOpacity key={i} onPress={onClose} hitSlop={{top:14,bottom:14,left:14,right:14}}>{dot}</TouchableOpacity>
        : <View key={i}>{dot}</View>;
    })}
  </View>;
}

// 하드 섀도우 (blur 없는 오프셋) — Android elevation은 무조건 블러라 뷰로 처리
function HardShadow({children,dx=2,dy=2,color='rgba(138,127,192,.28)',radius=8,style}:any) {
  return <View style={style}>
    <View pointerEvents="none" style={{position:'absolute',left:dx,top:dy,right:-dx,bottom:-dy,
      backgroundColor:color,borderRadius:radius}}/>
    {children}
  </View>;
}

// 베벨 버튼: 위/왼쪽 밝음 + 아래/오른쪽 음영, 누르면 반전 + 1px 밀림
function Bevel({onPress,disabled,style,inner,children}:any) {
  return <Pressable onPress={onPress} disabled={disabled} hitSlop={{top:8,bottom:8,left:8,right:8}}
    style={[bv.outer,disabled&&{opacity:.45},style]}>
    {({pressed})=><>
      <View pointerEvents="none" style={bv.shadow}/>
      <View style={[bv.face,inner,pressed&&bv.faceP]}>{children}</View>
    </>}
  </Pressable>;
}
const bv=StyleSheet.create({
  outer:{borderWidth:1,borderColor:P.border,backgroundColor:P.bg},
  shadow:{position:'absolute',left:2,top:2,right:-2,bottom:-2,backgroundColor:'rgba(93,84,144,.22)'},
  face:{flexGrow:1,alignSelf:'stretch',alignItems:'center',justifyContent:'center',
    borderWidth:2,borderTopColor:'#fff',borderLeftColor:'#fff',
    borderBottomColor:P.shade,borderRightColor:P.shade},
  faceP:{borderTopColor:P.shade,borderLeftColor:P.shade,borderBottomColor:'#fff',borderRightColor:'#fff',
    backgroundColor:'#e4ddf6',transform:[{translateX:1},{translateY:1}]},
});

// 반짝이 파티클 — 천천히 깜빡+회전하는 ✦
function Spark({x,y,size,color,delay}:{x:any;y:any;size:number;color:string;delay:number}) {
  const a=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const loop=Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(a,{toValue:1,duration:1300,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(a,{toValue:0,duration:1300,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ]));
    loop.start(); return ()=>loop.stop();
  },[]);
  return <Animated.Text pointerEvents="none" style={{position:'absolute',left:x,top:y,fontSize:size,color,
    opacity:a.interpolate({inputRange:[0,1],outputRange:[.15,.95]}),
    transform:[{scale:a.interpolate({inputRange:[0,1],outputRange:[.4,1]})},
      {rotate:a.interpolate({inputRange:[0,1],outputRange:['0deg','90deg']})}]}}>✦</Animated.Text>;
}
const SPARKS:[string,string,number,string][]= [
  ['6%','8%',13,'#fff'],['86%','6%',11,'#ffd0e6'],['70%','22%',15,'#fff'],
  ['12%','40%',12,'#ffe9a8'],['90%','48%',13,'#d5c8ff'],['38%','66%',11,'#fff'],
  ['76%','82%',14,'#ffd0e6'],['8%','88%',11,'#d5c8ff'],
];
const Sparkles=()=><View pointerEvents="none" style={StyleSheet.absoluteFill}>
  {SPARKS.map(([x,y,s,c],i)=><Spark key={i} x={x} y={y} size={s} color={c} delay={i*400}/>)}
</View>;

const BOOT_VOL = .55;   // index.html의 BOOT_VOL과 같아야 한다

// ═══ 등록 화면 ═══
/* 이름을 넣고 나서 메신저로 들어가기 전에 한 번 지나간다.
   이야기를 설명하지 않는다 — 방금 적은 이름 아래 빈칸이 놓이고, 그걸 유저가
   직접 채운다. 이 프로덕트의 이름이 NULL이고 유저는 비어 있는 값이라,
   그 칸을 채우는 것이 곧 오프닝이다. DAYS LEFT는 끝까지 null로 둔다.
   시간이 지나면 넘어가지 않는다 — Click!을 눌러야 나간다. 다 안 채우고
   나가도 된다. 비워두는 것도 이 이야기에서는 답이다.
   index.html의 .enr / ENR_FIELDS와 같은 항목·같은 순서다. */
const ENR_FIELDS:{k:string;lab:string;tail:string;w?:number}[] = [
  {k:'subject',  lab:'SUBJECT', tail:'과목 교생'},
  {k:'age',      lab:'AGE',     tail:'세', w:52},
  {k:'likes',    lab:'LIKES',   tail:'를 좋아하고'},
  {k:'dislikes', lab:'HATES',   tail:'를 싫어한다'},
];
function Enroll({name,profile,onSaveField,onDone}:{
  name:string; profile:Record<string,string>;
  onSaveField:(k:string,v:string)=>void; onDone:()=>void;
}) {
  // 빈칸 넷 + DAYS LEFT 한 줄
  const rows = useRef(Array.from({length:ENR_FIELDS.length+1},()=>new Animated.Value(0))).current;
  const fade = useRef(new Animated.Value(0)).current;
  const kb   = useKeyboardHeight();
  useEffect(()=>{
    Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start();
    rows.forEach((v,i)=>Animated.timing(v,{toValue:1,duration:350,delay:300+250*i,useNativeDriver:true}).start());
  },[]);
  const filled = ENR_FIELDS.filter(f=>(profile[f.k]||'').trim()).length;
  const done   = filled===ENR_FIELDS.length;
  const leave  = ()=>{ Animated.timing(fade,{toValue:0,duration:420,useNativeDriver:true}).start(); setTimeout(onDone,440) };
  const anim   = (v:Animated.Value)=>({opacity:v,
    transform:[{translateX:v.interpolate({inputRange:[0,1],outputRange:[-4,0]})}]});
  /* 키보드가 올라오면 카드를 그만큼 띄운다. 안 그러면 아래 두 칸이 가린다 */
  return <Animated.View style={[en.root,{opacity:fade,paddingBottom:26+kb}]}>
    <View style={en.card}>
      <View style={en.tb}><Text style={en.tbT}>registering...</Text></View>
      <View style={en.body}>
        <Text style={en.name}>{name}</Text>
        {ENR_FIELDS.map((f,i)=>
          <Animated.View key={f.k} style={[en.row,anim(rows[i])]}>
            <Text style={en.rowL}>{f.lab}</Text>
            <TextInput style={[en.blank,!!(profile[f.k]||'').trim()&&en.blankOn,f.w?{minWidth:f.w}:null]}
              placeholder="□□" placeholderTextColor="#7a6bb8" maxLength={20}
              defaultValue={profile[f.k]||''}
              onEndEditing={e=>onSaveField(f.k,e.nativeEvent.text.trim())}/>
            <Text style={en.rowT}>{f.tail}</Text>
          </Animated.View>)}
        {/* 남은 날은 세지 않는다. 이 값이 비어 있는 게 이 이야기다 */}
        <Animated.View style={[en.row,anim(rows[4])]}>
          <Text style={en.rowL}>DAYS LEFT</Text><Text style={en.nullv}>null</Text>
        </Animated.View>
        <View style={en.bar}><View style={[en.fill,{width:pct(filled/ENR_FIELDS.length*100)}]}/></View>
        <Text style={[en.msg,done&&en.msgOn]}>
          {done?'READY ✓':`CONNECTING … ${filled}/${ENR_FIELDS.length}`}</Text>
        {/* 다 안 채워도 들어갈 수 있다 */}
        <TouchableOpacity style={en.go} activeOpacity={.8} onPress={leave}>
          <Text style={en.goT}>Click!</Text></TouchableOpacity>
      </View>
    </View>
  </Animated.View>;
}
const en=StyleSheet.create({
  root:{...StyleSheet.absoluteFillObject,zIndex:55,backgroundColor:'#17123a',
        alignItems:'center',justifyContent:'center',padding:26},
  card:{width:'100%',maxWidth:286,borderWidth:1,borderColor:P.border,backgroundColor:'#1e1848'},
  tb:{backgroundColor:'#6b4aa8',paddingVertical:5,paddingHorizontal:9},
  tbT:{...F,fontSize:9.5,letterSpacing:1.8,color:'#fff'},
  body:{paddingHorizontal:16,paddingTop:16,paddingBottom:15},
  name:{...F,fontSize:15,letterSpacing:.9,color:'#fff',paddingBottom:11,
        borderBottomWidth:1,borderBottomColor:'#443a7d'},
  row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:5,
       paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#443a7d'},
  rowL:{...F,fontSize:8.5,letterSpacing:2,color:'#8a7ac4',minWidth:66},
  rowT:{...F,fontSize:12,color:'#c9b6f5'},
  /* 어두운 창이라 빈칸도 어둡게 — 밝은 you.txt의 것을 그대로 쓰면 안 보인다 */
  blank:{...F,fontSize:12,minWidth:44,paddingVertical:2,paddingHorizontal:6,textAlign:'center',
         color:'#ffb0d4',backgroundColor:'#2a2159',borderWidth:1,borderColor:'#6b5fa8',
         borderStyle:'dashed',borderRadius:3},
  blankOn:{color:'#fff',borderStyle:'solid'},
  nullv:{...F,fontSize:12,letterSpacing:.7,color:'#6b5fa8'},
  bar:{marginTop:15,height:6,backgroundColor:'#2a2159',borderWidth:1,borderColor:P.border,overflow:'hidden'},
  fill:{height:'100%',backgroundColor:'#ff8fbe'},
  msg:{...F,marginTop:8,fontSize:8.5,letterSpacing:1.8,color:'#8a7ac4'},
  msgOn:{color:'#8fe0b0'},
  go:{marginTop:13,paddingVertical:9,alignItems:'center',backgroundColor:'#ffd5e8',
      borderWidth:1,borderColor:P.border},
  goT:{...F,fontSize:12,letterSpacing:3.6,color:P.ink},
});

// ═══ 소개 영상 ═══
/* 데스크 CD를 누르면 도는 11초짜리. index.html의 .film과 같은 순서·같은 초다.
   실제 동영상이 아니라 사진 넉 장과 문장 네 줄이 넘어가는 것을, VHS 테이프를
   재생하는 것처럼 껍데기를 씌운 것이다.

   RN에는 CSS가 없어서 웹과 만드는 법이 다르다.
   - 스캔라인·트래킹 노이즈: repeating-linear-gradient가 없다. 작은 타일 이미지를
     resizeMode="repeat"로 깔아서 반복시킨다.
   - RGB 어긋남: mix-blend-mode가 없다. 양옆에 얇은 그라데이션을 얹는 것으로 대신한다.
   - filter가 없어서 사진을 누르는 것도 반투명 한 겹으로 한다. */
const FILM_SHOTS = ['minhyun-roof.webp','jaeeon-shelf.webp','minhyun-street.webp','jaeeon-back.webp'];
const FILM_LINES = ['겨울이 끝나간다','당신은 한 달 뒤에 떠난다','두 사람은 그걸 알고 있다','당신이 모르는 건 따로 있다'];
const FILM_TRACK = 'null-film.mp3';

function IntroFilm({onClose}:{onClose:()=>void}) {
  const ph  = useRef(FILM_SHOTS.map(()=>new Animated.Value(0))).current;
  const zm  = useRef(FILM_SHOTS.map(()=>new Animated.Value(0))).current;
  const ln  = useRef(FILM_LINES.map(()=>new Animated.Value(0))).current;
  const dim = useRef(new Animated.Value(0)).current;   // 암전
  const end = useRef(new Animated.Value(0)).current;   // 로고
  const jump= useRef(new Animated.Value(0)).current;   // 세로로 튀는 글리치
  const rec = useRef(new Animated.Value(1)).current;   // ● REC 깜빡임
  const tr1 = useRef(new Animated.Value(0)).current;   // 트래킹 노이즈 띠
  const tr2 = useRef(new Animated.Value(0)).current;
  const fade= useRef(new Animated.Value(1)).current;
  const [sec,setSec]=useState(0);
  const [skipped,setSkipped]=useState(false);
  const player=useAudioPlayer(IMG+FILM_TRACK);
  const gone=useRef(false);
  const {height:H}=useWindowDimensions();

  const leave=()=>{
    if(gone.current)return; gone.current=true;
    try{ player.volume=.25 }catch(e){}          // 화면과 같이 소리도 줄인다
    Animated.timing(fade,{toValue:0,duration:420,useNativeDriver:true}).start(onClose);
  };
  // 처음 누르면 결말로 건너뛰고, 거기서 또 누르면 닫힌다
  const tap=()=>{
    if(skipped){leave();return}
    setSkipped(true); setSec(11);
    ph.forEach(v=>v.setValue(0)); ln.forEach(v=>v.setValue(0));
    dim.setValue(1);
    Animated.timing(end,{toValue:1,duration:400,useNativeDriver:true}).start();
  };

  useEffect(()=>{
    try{ player.loop=true; player.volume=.6; player.play(); }catch(e){}
    const pulse=(v:Animated.Value,delay:number,i:number,hold:number,o:number)=>Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v,{toValue:1,duration:i,useNativeDriver:true}),
      Animated.delay(hold),
      Animated.timing(v,{toValue:0,duration:o,useNativeDriver:true}),
    ]);
    ph.forEach((v,i)=>pulse(v,200+2000*i,700,1500,1200).start());
    ln.forEach((v,i)=>pulse(v,700+2000*i,340,1060,600).start());
    zm.forEach((v,i)=>Animated.timing(v,{toValue:1,duration:3400,delay:200+2000*i,useNativeDriver:true}).start());
    Animated.timing(dim,{toValue:1,duration:600,delay:8400,useNativeDriver:true}).start();
    Animated.timing(end,{toValue:1,duration:1000,delay:9300,useNativeDriver:true}).start();
    // 세 번 튄다. 웹의 @keyframes jump와 같은 자리
    const kick=(at:number)=>setTimeout(()=>Animated.sequence([
      Animated.timing(jump,{toValue:-9,duration:60,useNativeDriver:true}),
      Animated.timing(jump,{toValue:4,duration:60,useNativeDriver:true}),
      Animated.timing(jump,{toValue:0,duration:60,useNativeDriver:true}),
    ]).start(),at);
    const k1=kick(2310),k2=kick(5170),k3=kick(8250);
    Animated.loop(Animated.sequence([
      Animated.timing(rec,{toValue:.15,duration:10,useNativeDriver:true}), Animated.delay(540),
      Animated.timing(rec,{toValue:1,duration:10,useNativeDriver:true}),   Animated.delay(540),
    ])).start();
    Animated.loop(Animated.timing(tr1,{toValue:1,duration:5500,easing:Easing.linear,useNativeDriver:true})).start();
    Animated.loop(Animated.timing(tr2,{toValue:1,duration:7500,easing:Easing.linear,useNativeDriver:true})).start();
    const t=setInterval(()=>setSec(v=>Math.min(11,v+1)),1000);
    return ()=>{clearInterval(t);[k1,k2,k3].forEach(clearTimeout);try{player.pause()}catch(e){}};
  },[]);

  const mm=String(Math.floor(sec/60)).padStart(2,'0'), ss=String(sec%60).padStart(2,'0');
  return <Animated.View style={[fl.root,{opacity:fade}]}>
    <Pressable style={{flex:1}} onPress={tap}>
      <Animated.View style={[{flex:1,overflow:'hidden'},{transform:[{translateY:jump}]}]}>
        {FILM_SHOTS.map((f,i)=>
          <Animated.Image key={f} source={{uri:IMG+f}} resizeMode="cover"
            style={[StyleSheet.absoluteFillObject,{opacity:ph[i],
              transform:[{scale:zm[i].interpolate({inputRange:[0,1],outputRange:[1.06,1]})}]}]}/>)}
        {/* 문장 — 밝은 사진 위에서 안 읽혀서 뒤에 어두운 막을 깐다.
            단색 사각형에 borderRadius를 주면 알약 모양이 그대로 보인다.
            웹은 radial-gradient로 가장자리를 없애는데 RN에 radial이 없어서,
            가운데에서 밖으로 사라지는 그림 한 장을 늘려서 깐다. */}
        <View style={fl.lines} pointerEvents="none">
          {FILM_LINES.map((t,i)=>
            <Animated.View key={i} style={[fl.lineWrap,{opacity:ln[i],
              transform:[{translateY:ln[i].interpolate({inputRange:[0,1],outputRange:[8,0]})}]}]}>
              <Image source={LINE_FADE} style={fl.lineFade} resizeMode="stretch"/>
              <Text style={fl.line}>{t}</Text>
            </Animated.View>)}
        </View>
        <Animated.View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#0e0a24',opacity:dim}]} pointerEvents="none"/>
        <Animated.View style={[fl.ending,{opacity:end}]} pointerEvents="none">
          <Text style={fl.logo}>NULL</Text>
          <LinearGradient colors={['#ff9ec6','#ffd68a','#a8e6e0','#b9e3ff','#c3b2f0']}
            start={{x:0,y:0}} end={{x:1,y:0}} style={fl.rainbow}/>
          <Text style={fl.sub}>the blank u fill in</Text>
        </Animated.View>
      </Animated.View>

      {/* ── VHS 껍데기 ── */}
      <Animated.Image source={{uri:IMG+'vhs-track.webp'}} resizeMode="repeat" pointerEvents="none"
        style={[fl.band,{top:0,transform:[{translateY:tr1.interpolate({inputRange:[0,1],outputRange:[-26,H]})}]}]}/>
      <Animated.Image source={{uri:IMG+'vhs-track.webp'}} resizeMode="repeat" pointerEvents="none"
        style={[fl.band,{top:0,opacity:.4,transform:[{translateY:tr2.interpolate({inputRange:[0,1],outputRange:[H,-26]})}]}]}/>
      <LinearGradient colors={['rgba(255,0,90,.32)','rgba(255,0,90,0)','rgba(0,190,255,0)','rgba(0,190,255,.32)']}
        locations={[0,.12,.88,1]} start={{x:0,y:0}} end={{x:1,y:0}}
        style={StyleSheet.absoluteFillObject} pointerEvents="none"/>
      <Image source={{uri:IMG+'vhs-scan.webp'}} resizeMode="repeat" pointerEvents="none"
        style={StyleSheet.absoluteFillObject}/>

      <View style={[fl.hud,{top:0}]} pointerEvents="none">
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <Animated.View style={[fl.dot,{opacity:rec}]}/><Text style={fl.hudT}>REC</Text>
        </View>
        <Text style={fl.hudT}>00:{mm}:{ss}</Text>
      </View>
      <View style={[fl.hud,{bottom:0}]} pointerEvents="none">
        <Text style={fl.hudT}>▶ PLAY</Text>
        <Text style={fl.skip}>{skipped?'tap to close':'tap to skip'}</Text>
      </View>
      <Text style={[fl.sticker,{left:'8%',top:'33%',transform:[{rotate:'-12deg'}],color:'#ffe3f6'}]}>☆彡</Text>
      <Text style={[fl.sticker,{right:'7%',bottom:'16%',transform:[{rotate:'9deg'}],color:'#ffd0e6'}]}>♡ 2026</Text>
    </Pressable>
  </Animated.View>;
}
const fl=StyleSheet.create({
  root:{...StyleSheet.absoluteFillObject,zIndex:70,backgroundColor:'#0e0a24'},
  lines:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},
  lineWrap:{position:'absolute',left:0,right:0,paddingHorizontal:26,paddingVertical:22,
            alignItems:'center',justifyContent:'center'},
  /* 글자 상자보다 넉넉히 넘겨야 가장자리가 다 사라진 뒤에 화면과 만난다 */
  lineFade:{position:'absolute',left:-30,right:-30,top:-46,bottom:-46},
  line:{...F,fontSize:19,lineHeight:33,textAlign:'center',color:'#fff',
        textShadowColor:'rgba(120,70,120,.9)',textShadowOffset:{width:2,height:2},textShadowRadius:8},
  ending:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',gap:16},
  logo:{...F,fontSize:44,letterSpacing:15,color:'#fff',
        textShadowColor:'#ff9ec6',textShadowOffset:{width:0,height:0},textShadowRadius:14},
  rainbow:{width:150,height:5,borderRadius:3},
  sub:{...F,fontSize:11,letterSpacing:3.4,color:'#ffd0e6'},
  band:{position:'absolute',left:0,right:0,height:26,opacity:.5},
  hud:{position:'absolute',left:0,right:0,flexDirection:'row',alignItems:'center',
       justifyContent:'space-between',paddingHorizontal:14,paddingVertical:12},
  hudT:{...F,fontSize:11,color:'#fff',letterSpacing:.8,
        textShadowColor:'rgba(0,0,0,.55)',textShadowOffset:{width:1,height:1},textShadowRadius:0},
  dot:{width:9,height:9,borderRadius:5,backgroundColor:'#ff5470'},
  skip:{...F,fontSize:10,letterSpacing:2.4,color:'#ffd0e6'},
  sticker:{...F,position:'absolute',fontSize:13},
});


// ═══ 오프닝 ═══
/* Y2K 데스크톱 한 장. 도는 CD, 올라오는 방울, 흩어진 가짜 오류창.
   설명하는 문장이 없다 — 오류창이 대신 말한다. "당신을 찾을 수 없습니다".
   그래서 이름 칸이 이 화면에 같이 있다. 이름을 넣는 것이 그 오류를 지우는 일이다.
   로고곡은 여기서 돌고 들어갈 때 페이드아웃된다. index.html의 .splash와 같은 화면.

   위치는 전부 비율이다. 웹은 390x844에 픽셀로 박혀 있지만 앱은 기기마다
   화면이 달라서, 그대로 옮기면 작은 폰에서 아래 창이 잘려나간다. */
const BUBS = [[8,26,15,0],[22,14,11,1.4],[37,34,18,.6],[52,18,13,2.2],[68,44,21,.2],[80,20,12.5,3],[91,30,16,1.8]];
function Bubbles() {
  const {height:H}=useWindowDimensions();
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {BUBS.map((b,i)=><Bubble key={i} x={b[0]} d={b[1]} sec={b[2]} delay={b[3]} H={H}/>)}
  </View>;
}
const BUBBLE_PNG=require('./assets/bubble.png');
const LINE_FADE=require('./assets/linefade.png');
function Bubble({x,d,sec,delay,H}:any) {
  const v=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const run=Animated.loop(Animated.timing(v,{toValue:1,duration:sec*1000,
      easing:Easing.linear,useNativeDriver:true}));
    const t=setTimeout(()=>run.start(),delay*1000);
    return ()=>{clearTimeout(t);run.stop()};
  },[]);
  /* 웹은 radial-gradient 두 겹으로 비누막을 그리는데 RN에는 radial이 없다.
     단색 원에 흰 테두리를 두르면 비눗방울이 아니라 반투명 스티커로 보여서,
     막을 그려 넣은 그림 한 장을 크기만 바꿔 쓴다(assets/bubble.png). */
  return <Animated.View pointerEvents="none" style={{position:'absolute',left:`${x}%`,bottom:-70,
    width:d,height:d,
    opacity:v.interpolate({inputRange:[0,.06,.84,1],outputRange:[0,1,.95,0]}),
    transform:[{translateY:v.interpolate({inputRange:[0,1],outputRange:[0,-(H+120)]})},
               {translateX:v.interpolate({inputRange:[0,.5,1],outputRange:[-15,15,-15]})}]}}>
    <Image source={BUBBLE_PNG} style={{width:d,height:d}} resizeMode="contain"/>
  </Animated.View>;
}
/* 도는 CD. RN에는 conic-gradient가 없어서 파스텔 띠를 겹쳐 돌린다 */
function SpinCD({size=88}:{size?:number}) {
  const v=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const run=Animated.loop(Animated.timing(v,{toValue:1,duration:7000,easing:Easing.linear,useNativeDriver:true}));
    run.start(); return ()=>run.stop();
  },[]);
  const spin=v.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});
  return <Animated.View style={{width:size,height:size,borderRadius:size/2,overflow:'hidden',
    transform:[{rotate:spin}]}}>
    <LinearGradient colors={['#ffd0e6','#c3b2f0','#a8e6e0','#ffe9a8','#ffc2dd']}
      start={{x:0,y:0}} end={{x:1,y:1}} style={{flex:1}}/>
    <View style={{position:'absolute',left:'9%',top:'9%',right:'9%',bottom:'9%',
      borderRadius:size/2,borderWidth:1,borderColor:'rgba(255,255,255,.55)'}}/>
    <View style={{position:'absolute',left:'38%',top:'38%',right:'38%',bottom:'38%',
      borderRadius:size/2,backgroundColor:'#fff',borderWidth:2,borderColor:'rgba(255,255,255,.9)'}}/>
  </Animated.View>;
}
/* 데스크톱에 놓인 마우스 포인터. 아무 데도 안 붙어 있는 게 이 화면의 농담이다 */
/* 보더로 만든 삼각형은 한쪽만 채워져 작대기로 보이고, 꼬리를 따로 붙이면
   꺾인 조각처럼 보인다. 웹과 같은 path를 그림 한 장으로 구워서 쓴다. */
const CURSOR_PNG=require('./assets/cursor.png');
const SpCursor=()=><Image source={CURSOR_PNG} style={sp.cursor}
  resizeMode="contain" pointerEvents="none"/>;

/* 가짜 오류창 한 개 */
function SpWin({title,colors,style,children}:any) {
  return <View style={[sp.win,style]}>
    <LinearGradient colors={colors} start={{x:0,y:0}} end={{x:1,y:0}} style={sp.wtb}>
      <Text style={sp.wtbT}>{title}</Text><Dots/>
    </LinearGradient>
    <View style={sp.wbd}>{children}</View>
  </View>;
}

/* 로고 옆에서 깜빡이는 커서. 다 그려놓고 켜졌다 꺼지기만 한다 */
function Blink() {
  const v=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    const run=Animated.loop(Animated.sequence([
      Animated.delay(490), Animated.timing(v,{toValue:0,duration:10,useNativeDriver:true}),
      Animated.delay(490), Animated.timing(v,{toValue:1,duration:10,useNativeDriver:true}),
    ]));
    run.start(); return ()=>run.stop();
  },[]);
  return <Animated.Text style={[sp.cur,{opacity:v}]}>_</Animated.Text>;
}

function Splash({onEnter}:{onEnter:(n:string)=>void}) {
  const [v,setV]=useState('');
  const [armed,setArmed]=useState(false);
  const kb=useKeyboardHeight();
  const player=useAudioPlayer(IMG+'null-logo.mp3');
  useEffect(()=>{
    try{ player.loop=true; player.volume=0; player.play(); setArmed(true); }catch(e){ setArmed(false); }
    /* loop만 켜두면 끝에서 앞으로 뚝 끊긴다. 끝 2.2초를 줄이고 처음 1.2초를 올린다. */
    const ramp=setInterval(()=>{
      try{
        const d=player.duration, t=player.currentTime;
        if(!d||!isFinite(d)){ player.volume=BOOT_VOL; return; }
        const up=Math.min(1,t/1.2), down=Math.min(1,Math.max(0,d-t)/2.2);
        player.volume=BOOT_VOL*Math.min(up,down);
      }catch(e){}
    },50);
    return ()=>{ clearInterval(ramp); try{player.pause()}catch(e){} };
  },[]);
  const go=()=>{const t=v.trim(); if(t) onEnter(t)};
  /* 키보드가 올라오면 아래쪽 창들은 어차피 가려진다. 카드만 위로 띄운다. */
  return <LinearGradient colors={['#dcd3f7','#c3b2f0','#f0c2de']} style={{flex:1}}>
    <Bubbles/>
    <Sparkles/>
    {/* 창을 좌표로 흩어놓으면 화면 높이가 바뀔 때마다 겹치거나 잘린다.
        세로 흐름에 얹고, 흩어진 데스크톱처럼 보이는 건 좌우 정렬과
        살짝 겹치는 음수 여백으로 낸다. */}
    <View style={[sp.stack,kb?{justifyContent:'flex-start',paddingTop:12}:null]}>
      <View style={sp.cdSlot}><SpinCD size={76}/></View>
      <View style={[sp.card,sp.noShrink]}>
        <TB colors={['#ff8fbe','#c3b2f0']}><Text style={tbT}>null.exe</Text><Dots/></TB>
        <View style={sp.body}>
          <Text style={sp.logo}>NULL<Blink/></Text>
          <TextInput style={sp.input} value={v} onChangeText={setV} placeholder="안녕, 널 입력해줘."
            placeholderTextColor="#dbb0c8" maxLength={12} onSubmitEditing={go}/>
          <Bevel style={{marginTop:9,width:'100%'}} inner={{paddingVertical:10,backgroundColor:'#ffc2dd'}}
            disabled={!v.trim()} onPress={go}><Text style={sp.goT}>Click!</Text></Bevel>
        </View>
      </View>

      {/* 이 화면에서 이야기를 말하는 건 이 셋뿐이다 */}
      {!kb&&<>
        <SpWin title="Error" colors={['#b9a8ea','#8a7fc0']} style={[sp.w1,sp.noShrink]}>
          <Text style={sp.wtx}>이름을 입력해야 존재할 수 있어요.</Text>
          <View style={sp.wbtn}><Text style={sp.wbtnT}>ok</Text></View>
        </SpWin>
        {/* 커서는 창에 매달아 둔다 — 좌표로 놓으면 글자를 깔고 앉는다 */}
        <View style={[sp.w2,sp.noShrink]}>
          <SpWin title="System error" colors={['#ff7fae','#ff5fa8']}>
            <Text style={sp.wtx}>당신을 찾을 수 없습니다.</Text>
            <View style={sp.wbtn}><Text style={sp.wbtnT}>Cancel</Text></View>
          </SpWin>
          <SpCursor/>
        </View>
        <SpWin title="loading..." colors={['#8fd8e8','#c3b2f0']} style={[sp.w3,sp.noShrink]}>
          <View style={sp.bar}><LoadStripe/></View>
        </SpWin>
      </>}
    </View>
    {!kb&&<Text style={sp.tap}>{armed?'♪ NULL!':'TAP FOR MUSIC ♪'}</Text>}
  </LinearGradient>;
}

/* 차오르는 막대. 줄무늬만 흐르면 "돌고 있다"는 느낌은 나도 로딩으로는 안 읽힌다.
   14%에서 92%까지 차올랐다 되돌아가기를 반복한다. */
function LoadStripe() {
  const v=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const run=Animated.loop(Animated.sequence([
      Animated.timing(v,{toValue:1,duration:1800,easing:Easing.inOut(Easing.ease),useNativeDriver:false}),
      Animated.timing(v,{toValue:0,duration:1800,easing:Easing.inOut(Easing.ease),useNativeDriver:false}),
    ]));
    run.start(); return ()=>run.stop();
  },[]);
  return <Animated.View style={{height:'100%',flexDirection:'row',overflow:'hidden',
    width:v.interpolate({inputRange:[0,1],outputRange:['14%','92%']})}}>
    {Array.from({length:40}).map((_,i)=>
      <View key={i} style={{width:7,height:'100%',backgroundColor:i%2?'#ffd0e6':'#ff9ec6'}}/>)}
  </Animated.View>;
}

const sp=StyleSheet.create({
  stack:{...StyleSheet.absoluteFillObject,justifyContent:'center',paddingHorizontal:26,paddingBottom:52,gap:12},
  /* 세로가 모자라면 flex가 창들을 눌러버리고, overflow:hidden이라 안쪽 버튼이
     잘려나간다. 창은 절대 줄이지 않는다 — 모자라면 차라리 위아래가 잘리는 게 낫다. */
  noShrink:{flexShrink:0},
  cdSlot:{alignSelf:'flex-end',marginRight:-4,flexShrink:0},
  card:{width:'100%',backgroundColor:'#fff8fc',borderWidth:1,borderColor:P.border,
        borderRadius:9,overflow:'hidden'},
  body:{paddingHorizontal:18,paddingTop:34,paddingBottom:22,alignItems:'center'},
  cur:{...F,fontSize:40,color:'#ff9ec6'},
  logo:{...F,fontSize:40,letterSpacing:12,color:'#fff',marginBottom:16,
        textShadowColor:'#b06f9e',textShadowOffset:{width:2,height:2},textShadowRadius:1},
  input:{...F,width:'100%',marginTop:4,paddingVertical:10,paddingHorizontal:12,fontSize:16,color:P.ink,
         textAlign:'center',backgroundColor:'#fff',borderWidth:1,borderColor:P.mid},
  goT:{...F,fontSize:12.5,letterSpacing:4,color:P.ink},
  w1:{alignSelf:'flex-start',width:182,marginTop:14},
  w2:{alignSelf:'flex-end',width:194,marginTop:-6},
  w3:{alignSelf:'stretch',marginTop:8},
  win:{borderWidth:1,borderColor:P.border,borderRadius:5,overflow:'hidden'},
  wtb:{flexDirection:'row',alignItems:'center',paddingVertical:4,paddingHorizontal:7},
  wtbT:{...F,fontSize:9,color:'#fff',flex:1},
  wbd:{paddingHorizontal:11,paddingTop:11,paddingBottom:9,backgroundColor:'#fff'},
  wtx:{...F,fontSize:9.5,lineHeight:17,color:'#6b5fa8'},
  // 버튼은 제 줄에서 오른쪽 아래. 문장 옆에 붙이면 대화상자가 아니라 문장이 된다
  wbtn:{alignSelf:'flex-end',marginTop:11,paddingVertical:4,paddingHorizontal:14,
        backgroundColor:'#ece8fa',borderWidth:1,borderColor:P.border},
  wbtnT:{...F,fontSize:9,color:P.ink},
  bar:{height:11,backgroundColor:'#fff',borderWidth:1,borderColor:P.mid,overflow:'hidden'},
  cursor:{position:'absolute',left:-6,bottom:-19,width:17,height:24,transform:[{rotate:'-8deg'}]},
  tap:{...F,position:'absolute',left:0,right:0,bottom:8,textAlign:'center',
       fontSize:10.5,letterSpacing:3.4,color:P.ink},
});

// ═══ 장바구니 — 검색 → 아이템 → 받는 사람 + 쪽지 ═══
// 웹(index.html)의 Cart와 같은 흐름. 아이콘만 SVG가 아니라 이모지다.
function CartScreen({gifts,hearts,onSend,onBack}:any) {
  const [q,setQ]=useState('');
  const [cat,setCat]=useState('전체');
  const [pick,setPick]=useState<any>(null);
  const [to,setTo]=useState<string|null>(null);
  const [memo,setMemo]=useState('');
  const key=q.trim().toLowerCase();
  /* 검색어가 비면 그 분류를 전부 보여준다. 정확한 낱말을 맞춰야만 나오면
     뭐가 있는지 모르는 채로 헤매게 된다. */
  const hits=GIFTS.filter(g=>(cat==='전체'||g.cat===cat)
    &&(!key||(g.name+' '+g.tags).toLowerCase().includes(key)));
  const back=()=>{ if(pick){setPick(null);setTo(null);setMemo('')} else onBack(); };
  const poor=pick&&hearts<pick.cost;

  return <View style={{flex:1,backgroundColor:'#fdf6fb'}}>
    <TB colors={[P.pink,P.lav]}>
      <Text style={tbT}>✿ cart{pick?' / wrap':''}</Text><Dots onClose={onBack}/></TB>

    {!pick&&<>
      <View style={ct.bar}>
        <TextInput style={ct.search} value={q} onChangeText={setQ}
          placeholder="무엇을 찾고 있어?" placeholderTextColor="#b9addc"/>
        <View style={ct.coin}><Text style={ct.coinT}>♡ {hearts}</Text></View>
      </View>
      <View style={ct.chips}>{GIFT_CATS.map((c:string)=>
        <TouchableOpacity key={c} onPress={()=>setCat(c)} style={[ct.chip,cat===c&&ct.chipOn]}>
          <Text style={[ct.chipT,cat===c&&ct.chipTOn]}>{c}</Text></TouchableOpacity>)}</View>
      <ScrollView contentContainerStyle={ct.grid}>
        {hits.length?hits.map(g=>
          <TouchableOpacity key={g.key} style={ct.cell} activeOpacity={0.8} onPress={()=>setPick(g)}>
            {!!g.badge&&<View style={[ct.badge,g.badge==='HOT'&&{backgroundColor:'#5ec9c1'}]}>
              <Text style={ct.badgeT}>{g.badge}</Text></View>}
            <View style={ct.thumb}><Text style={{fontSize:28}}>{g.icon}</Text></View>
            <Text style={ct.cname}>{g.name}</Text>
            <View style={ct.price}><Text style={ct.priceT}>♡ {g.cost}</Text></View>
          </TouchableOpacity>)
         :<Text style={ct.none}>no result</Text>}
      </ScrollView>
      <Text style={ct.foot}>TAP TO WRAP ♡</Text>
    </>}

    {!!pick&&<ScrollView contentContainerStyle={ct.wrap}>
      <View style={ct.gcard}>
        <View style={ct.ribbon}/>
        <View style={ct.gthumb}><Text style={{fontSize:32}}>{pick.icon}</Text></View>
        <View style={{flex:1}}>
          <Text style={ct.gname}>{pick.name}</Text>
          <Text style={ct.gdesc}>{pick.desc}</Text>
          <View style={ct.gprice}><Text style={ct.priceT}>♡ {pick.cost}</Text></View>
        </View>
      </View>
      <View style={ct.sect}><View style={ct.sline}/>
        <Text style={ct.sectT}>WHO GETS THIS</Text><View style={ct.sline}/></View>
      {['jaeeon','minhyun'].map(c=>{
        const done=(gifts[c]||[]).includes(pick.key), sel=to===c;
        return <View key={c}>
          <TouchableOpacity activeOpacity={done?1:0.8} style={[ct.to,sel&&ct.toSel]}
            onPress={()=>{ if(done)return;
              if(!sel){setTo(c);return}
              if(poor)return;
              onSend(c,pick,memo); onBack(); }}>
            <View style={[ct.radio,sel&&ct.radioOn]}/>
            <Face char={c} size={38} border={P.mid}/>
            <Text style={ct.toName}>{CHARS[c].name}</Text>
            <View style={done?ct.sent:ct.send}>
              <Text style={done?ct.sentT:ct.sendT}>
                {done?'SENT ♡':(sel?(poor?`NEED ♡${pick.cost-hearts}`:'SEND ♡'):'WRAP ♡')}</Text></View>
          </TouchableOpacity>
          {sel&&!done&&<Text style={ct.hint}>{GIFT_HINT[c]}</Text>}
        </View>;
      })}
      <View style={ct.sect}><View style={ct.sline}/>
        <Text style={ct.sectT}>A NOTE (선택)</Text><View style={ct.sline}/></View>
      <TextInput style={ct.memo} value={memo} onChangeText={setMemo} maxLength={60}
        multiline placeholder="P.S. ♡" placeholderTextColor="#cbbba8"/>
      <Bevel style={{marginTop:14,height:40}} onPress={back}>
        <Text style={ct.backT}>◁  back</Text></Bevel>
    </ScrollView>}
  </View>;
}
const ct=StyleSheet.create({
  bar:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:13,paddingTop:12},
  search:{...F,flex:1,paddingVertical:8,paddingHorizontal:11,fontSize:12,color:P.ink,
    backgroundColor:'#fff',borderWidth:1,borderColor:'#8a7fc0'},
  coin:{paddingVertical:8,paddingHorizontal:11,backgroundColor:'#ffe6a8',borderWidth:1,borderColor:'#d8b45c'},
  coinT:{...F,fontSize:11,color:'#8a4f74'},
  chips:{flexDirection:'row',gap:6,paddingHorizontal:13,paddingTop:11,paddingBottom:4},
  chip:{paddingVertical:5,paddingHorizontal:11,backgroundColor:'#f1ebfd',borderWidth:1,borderColor:'#cabbee',borderRadius:14},
  chipOn:{backgroundColor:'#ff7fae',borderColor:'#e0699a'},
  chipT:{...F,fontSize:10,color:'#a294cf'}, chipTOn:{color:'#fff'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10,padding:13,paddingBottom:24},
  cell:{width:'47%',minHeight:150,alignItems:'center',paddingTop:14,paddingBottom:32,
    backgroundColor:'#fff',borderWidth:1,borderColor:'#e6d7f2',borderRadius:9,overflow:'hidden'},
  thumb:{width:62,height:62,borderRadius:31,alignItems:'center',justifyContent:'center',
    backgroundColor:'#f5f1fc',borderWidth:1,borderColor:'#e3dcf3'},
  cname:{...F,marginTop:7,fontSize:11,color:'#6b5fa8'},
  price:{position:'absolute',left:0,right:0,bottom:0,paddingVertical:5,alignItems:'center',
    backgroundColor:'#fff2f8',borderTopWidth:1,borderTopColor:'#f4c3d8'},
  priceT:{...F,fontSize:10,color:'#c05f8c'},
  badge:{position:'absolute',top:6,right:6,paddingVertical:2,paddingHorizontal:7,
    backgroundColor:'#ff7fae',borderWidth:1,borderColor:P.border,borderRadius:9,zIndex:2},
  badgeT:{...F,fontSize:8,color:'#fff'},
  none:{...F,width:'100%',paddingVertical:40,textAlign:'center',fontSize:11,color:'#c46a97'},
  foot:{...F,paddingBottom:13,textAlign:'center',fontSize:9,letterSpacing:2,color:'#bdb0e0'},
  wrap:{padding:15,paddingBottom:28,gap:12},
  gcard:{flexDirection:'row',alignItems:'center',gap:13,padding:14,backgroundColor:'#fff',
    borderWidth:1,borderColor:'#f0c3da',borderRadius:10,overflow:'hidden'},
  ribbon:{position:'absolute',left:0,top:16,bottom:16,width:5,backgroundColor:'#ff9ec6',borderRadius:3},
  gthumb:{width:70,height:70,alignItems:'center',justifyContent:'center',borderRadius:9,
    backgroundColor:'#f4f6fd',borderWidth:1,borderColor:'#d9d3f0'},
  gname:{...F,fontSize:14,color:P.ink},
  gdesc:{...F,marginTop:7,fontSize:10,lineHeight:17,color:'#a99bd0'},
  gprice:{alignSelf:'flex-start',marginTop:8,paddingVertical:3,paddingHorizontal:9,
    backgroundColor:'#fff2f8',borderWidth:1,borderColor:'#f4c3d8',borderRadius:10},
  sect:{flexDirection:'row',alignItems:'center',gap:8,marginTop:2},
  sline:{flex:1,height:1,backgroundColor:'#f0dcea'},
  sectT:{...F,fontSize:9.5,letterSpacing:3,color:'#d3a0c0'},
  to:{flexDirection:'row',alignItems:'center',gap:11,padding:11,backgroundColor:'#fff',
    borderWidth:1,borderColor:'#e8d9f4',borderRadius:10},
  toSel:{borderColor:'#ff9ec6',backgroundColor:'#fff7fb'},
  radio:{width:14,height:14,borderRadius:7,borderWidth:1.5,borderColor:'#e0c8dc',backgroundColor:'#fff'},
  radioOn:{borderColor:'#ff7fae',borderWidth:5},
  toName:{...F,flex:1,fontSize:12.5,color:P.ink},
  send:{paddingVertical:8,paddingHorizontal:15,borderRadius:16,backgroundColor:'#ff7fae',
    borderWidth:1,borderColor:P.border},
  sendT:{...F,fontSize:10.5,letterSpacing:1,color:'#fff'},
  sent:{paddingVertical:8,paddingHorizontal:15,borderRadius:16,backgroundColor:'#f2eefb',
    borderWidth:1,borderColor:'#d5cbee'},
  sentT:{...F,fontSize:10.5,letterSpacing:1,color:'#a99bd0'},
  hint:{...F,marginTop:5,marginLeft:64,fontSize:9,color:'#b4a7d6'},
  memo:{...F,minHeight:76,padding:13,fontSize:11,lineHeight:22,color:'#8a4f74',
    textAlignVertical:'top',backgroundColor:'#fffdf6',borderWidth:1,borderColor:'#ecd9c8',borderRadius:8},
  backT:{...F,fontSize:11,letterSpacing:3,color:P.ink},
});

// ═══ 프로필 화면 — Y2K 미니홈피 카드 (배경: 재언=전시회 / 민현=락페) ═══
function Profile({char,onBack,refresh}:{char:string;onBack:()=>void;refresh?:number}) {
  const [stage,setStage]=useState<any>(null);
  const [count,setCount]=useState(0);
  const [gifts,setGifts]=useState<Record<string,string[]>>({});
  const [full,setFull]=useState(false);   // 배경만 크게 보기
  useEffect(()=>{(async()=>{
    setStage(await currentStage(char));
    setCount(await countMsgs(char));
    setGifts(await loadGifts());
  })()},[char,refresh]);
  const ch=CHARS[char];
  // 훅은 조건문 위에 있어야 한다 — 아래 return보다 뒤로 내리면 렌더마다 훅 수가 달라진다
  const bg=useBgUri(bgFor(char,count,gifts,stage?.bg), PROFILES[char]?.fallback||char+'-bg.webp');
  if(!stage) return <View style={{flex:1,backgroundColor:P.dark}}/>;
  const status=(stage.status||'').trim();
  const room=ROOMS.find(r=>r.id===char)!;
  return <ImageBackground {...bg} style={{flex:1}} resizeMode="cover">
    <View style={pf.dim}>
      <Sparkles/>
      <ScrollView contentContainerStyle={{flexGrow:1}} showsVerticalScrollIndicator={false}>
        {/* 카드 바깥을 누르면 배경만 크게. 카드 위 터치는 안쪽 Pressable이 삼킨다 —
            뒤에 터치 영역을 깔면 ScrollView가 가려서 아예 안 눌린다 */}
        <Pressable style={pf.scroll} onPress={()=>setFull(true)}>
        <Pressable onPress={()=>{}} style={{width:'100%',maxWidth:320}}>
        <HardShadow dx={5} dy={5} radius={10} color="rgba(20,14,44,.45)" style={{width:'100%'}}>
          <View style={pf.card}>
            <TB colors={[ch.color,'#ffb0d4']}>
              <Text style={tbT}>{char}.hompy</Text><Dots onClose={onBack}/>
            </TB>
            {/* 폴라로이드 프사 + 마스킹테이프 */}
            <View style={pf.top}>
              <View style={pf.polaWrap}>
                <View style={[pf.tape,{left:-14,top:-8,transform:[{rotate:'-18deg'}],backgroundColor:'rgba(255,158,198,.75)'}]}/>
                <View style={[pf.tape,{right:-14,bottom:14,transform:[{rotate:'12deg'}],backgroundColor:'rgba(195,178,240,.75)'}]}/>
                <View style={pf.pola}>
                  <Face char={char} size={126} radius={3}/>
                  <Text style={pf.polaCap}>{room.sub}</Text>
                </View>
              </View>
              <View style={pf.nameRow}>
                <Text style={[pf.deco,{color:ch.dk}]}>✦</Text>
                <Text style={pf.name}>{ch.name}</Text>
                <Text style={[pf.deco,{color:'#ff7fae'}]}>♡</Text>
              </View>
              {!!status&&<View style={pf.bubbleWrap}>
                <View style={pf.bubble}><Text style={pf.bubbleT}>{status}</Text></View>
                <View style={pf.bubbleTail}/>
              </View>}
            </View>
            {/* BGM */}
            {stage.track&&TRACKS[stage.track]
              ? <MusicPlayer track={stage.track} color={ch.dk}/>
              : <View style={pf.bgmOff}><Text style={pf.bgmOffT}>♪  no bgm</Text></View>}
            {/* 카운터 */}
            <View style={pf.stats}>
              <View style={pf.stat}><Text style={pf.statL}>TODAY</Text><Text style={[pf.statV,{color:'#ff7fae'}]}>1</Text></View>
              <View style={pf.stat}><Text style={pf.statL}>TALK</Text><Text style={[pf.statV,{color:ch.dk}]}>{count}</Text></View>
            </View>
            <View style={pf.stickers}>
              {['✿','★','♡','✧','☾'].map((s,i)=>
                <Text key={i} style={[pf.sticker,{color:['#ff9ec6','#ffd68a','#c3b2f0','#8fd8e8','#ffb0d4'][i]}]}>{s}</Text>)}
            </View>
            <Bevel style={pf.close} inner={{paddingVertical:10,backgroundColor:'#ffe3f0'}} onPress={onBack}>
              <Text style={pf.closeT}>◁  back</Text></Bevel>
          </View>
        </HardShadow>
        </Pressable>
        </Pressable>
      </ScrollView>
    </View>
    <Modal visible={full} transparent animationType="fade" onRequestClose={()=>setFull(false)}>
      <TouchableOpacity activeOpacity={1} style={{flex:1}} onPress={()=>setFull(false)}>
        <ImageBackground {...bg} style={{flex:1}} resizeMode="cover">
          <Text style={pf.bgclose}>tap to close</Text>
        </ImageBackground>
      </TouchableOpacity>
    </Modal>
  </ImageBackground>;
}
/* 배경 사진이 아직 없을 수 있다(사진은 나중에 올라온다). RN의 ImageBackground는
   파일이 없으면 그냥 빈 화면이 되므로, onError를 받아 그 인물의 기존 배경으로
   돌아간다. 파일을 올리는 순간 코드를 안 고쳐도 새 배경이 뜬다. — 웹의 useBg와 같은 일 */
function useBgUri(name:string, fallback:string) {
  const [dead,setDead]=useState(false);
  useEffect(()=>{setDead(false)},[name]);      // 배경이 바뀌면 다시 시도해본다
  const src=dead?fallback:name;
  return { source:{uri:IMG+src}, onError:()=>{ if(src!==fallback) setDead(true); } };
}

/* 프로필 뮤직 — 싸이월드 BGM. 자동재생 안 함, 눌러야 나온다 */
function MusicPlayer({track,color}:{track:string;color:string}) {
  const player = useAudioPlayer(TRACKS[track]);
  const [playing,setPlaying] = useState(false);
  const info = TRACK_INFO[track] || {title:'PROFILE BGM',artist:''};
  const toggle = () => {
    try {
      if (playing) player.pause(); else player.play();
      setPlaying(!playing);
    } catch(e) {}
  };
  useEffect(()=>()=>{ try{ player.pause(); }catch(e){} },[]);
  return <TouchableOpacity style={pf.bgm} onPress={toggle} activeOpacity={0.85}>
    <View style={[pf.bgmBtn,{borderColor:color}]}><Text style={{fontSize:9,color}}>{playing?'❚❚':'▶'}</Text></View>
    <View style={{flex:1}}>
      <Text style={pf.bgmT} numberOfLines={1}>{info.title}{playing?'  ♪':''}</Text>
      {!!info.artist&&<Text style={pf.bgmA} numberOfLines={1}>{info.artist}</Text>}
    </View>
    <View style={pf.eq}>{[0,1,2].map(i=><View key={i} style={[pf.eqBar,{height:playing?[8,13,6][i]:3,backgroundColor:color}]}/>)}</View>
  </TouchableOpacity>;
}
const pf=StyleSheet.create({
  bgclose:{...F,position:'absolute',left:0,right:0,bottom:34,textAlign:'center',fontSize:9,
    letterSpacing:2,color:'rgba(255,255,255,.85)',
    textShadowColor:'rgba(0,0,0,.6)',textShadowOffset:{width:0,height:1},textShadowRadius:3},
  dim:{flex:1,backgroundColor:'rgba(20,14,44,.5)'},
  scroll:{flexGrow:1,alignItems:'center',justifyContent:'center',padding:22},
  card:{width:'100%',backgroundColor:'#fff6fb',borderWidth:1,borderColor:P.border,borderRadius:10,overflow:'hidden'},
  top:{alignItems:'center',paddingTop:22,paddingHorizontal:18},
  polaWrap:{position:'relative'},
  tape:{position:'absolute',width:44,height:15,borderRadius:1},
  pola:{backgroundColor:'#fff',padding:7,paddingBottom:5,borderWidth:1,borderColor:'#e7dcf4',
    shadowColor:'#000',shadowOpacity:0.12,shadowRadius:3,shadowOffset:{width:2,height:2}},
  polaImg:{width:126,height:126,borderRadius:3,backgroundColor:'#efeaf9'},
  polaCap:{...F,fontSize:8.5,color:'#b3a6cf',textAlign:'center',marginTop:6,letterSpacing:1},
  nameRow:{flexDirection:'row',alignItems:'center',gap:7,marginTop:14},
  name:{...F,fontSize:17,color:P.ink,letterSpacing:1},
  deco:{fontSize:11},
  bubbleWrap:{alignItems:'center',marginTop:12},
  bubble:{backgroundColor:'#fff',borderWidth:1,borderColor:'#f0b6d2',borderRadius:12,
    paddingVertical:9,paddingHorizontal:14,maxWidth:250},
  bubbleT:{...F,fontSize:11.5,lineHeight:19,color:'#8a4f74',textAlign:'center'},
  bubbleTail:{width:8,height:8,backgroundColor:'#fff',borderRightWidth:1,borderBottomWidth:1,
    borderColor:'#f0b6d2',transform:[{rotate:'45deg'}],marginTop:-4.5},
  bgm:{flexDirection:'row',alignItems:'center',gap:9,marginTop:18,marginHorizontal:18,
    paddingVertical:8,paddingHorizontal:12,backgroundColor:'#f3edff',borderWidth:1,borderColor:'#cabbee',borderRadius:20},
  bgmBtn:{width:20,height:20,borderRadius:10,borderWidth:1,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  bgmT:{...F,fontSize:9.5,color:'#7a6cae',letterSpacing:1},
  bgmA:{...F,fontSize:8,color:'#a99bd0',letterSpacing:.5,marginTop:3},
  eq:{flexDirection:'row',alignItems:'flex-end',gap:2,height:14},
  eqBar:{width:3,borderRadius:1},
  bgmOff:{marginTop:18,marginHorizontal:18,paddingVertical:9,alignItems:'center',
    backgroundColor:'#f6f3fd',borderWidth:1,borderColor:'#e0d8f4',borderRadius:20},
  bgmOffT:{...F,fontSize:9.5,color:'#c0b5dd',letterSpacing:1},
  stats:{flexDirection:'row',gap:8,marginTop:14,marginHorizontal:18},
  stat:{flex:1,alignItems:'center',paddingVertical:9,backgroundColor:'#fff',borderWidth:1,borderColor:'#ecdff2'},
  statL:{...F,fontSize:8,letterSpacing:2,color:'#c3aacd'},
  statV:{...F,fontSize:14,marginTop:4},
  stickers:{flexDirection:'row',justifyContent:'center',gap:12,marginTop:16},
  sticker:{fontSize:12},
  close:{margin:18,marginTop:14},
  closeT:{...F,fontSize:11,color:P.ink,letterSpacing:2},
});

/* 흐르는 띠 — 같은 글을 두 벌 이어 붙이고 한 벌 길이만큼 밀어 반복한다.
   한 벌만 쓰면 글이 다 지나간 뒤 빈 화면이 생긴다. */
function Marquee({text}:{text:string}) {
  const x=useRef(new Animated.Value(0)).current;
  const [w,setW]=useState(0);
  useEffect(()=>{
    if(!w) return;
    x.setValue(0);
    const loop=Animated.loop(Animated.timing(x,{toValue:-w,duration:w*38,
      easing:Easing.linear,useNativeDriver:true}));
    loop.start();
    return ()=>loop.stop();
  },[w]);
  return <View style={rl.marquee}>
    <Animated.View style={{flexDirection:'row',transform:[{translateX:x}]}}>
      <Text style={rl.marqueeT} numberOfLines={1}
        onLayout={e=>setW(Math.round(e.nativeEvent.layout.width))}>{text}</Text>
      <Text style={rl.marqueeT} numberOfLines={1}>{text}</Text>
    </Animated.View>
  </View>;
}

// ═══ 방 목록 ═══
function RoomList({msgs,unread,unlocked,counts,album,autoAt,onOpen,onProfile,onAuto,autoLoading,onMenu,onToast,onCart,demo,onFilm,hearts}:any) {
  /* 방문자 카운터용 집계 — 오늘 오간 말 / 전체 말 */
  const allMsgs=ROOMS.flatMap((r:any)=>msgs[r.id]||[]);
  const t0=new Date(); t0.setHours(0,0,0,0);
  const todayN=allMsgs.filter((m:any)=>(m.created_at||0)>=t0.getTime()).length;
  const totalN=allMsgs.length;
  const [tab,setTab]=useState<'rooms'|'cam'|'hidden'>('rooms');
  const [zoom,setZoom]=useState<string|null>(null);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
  const left=Math.max(0,(autoAt||0)+AUTO_COOL-now);
  const un0=Object.values(unread||{}).reduce((a:any,b:any)=>a+(b||0),0) as number;
  return <ImageBackground source={{uri:IMG+'bg-wallpaper.webp'}} style={{flex:1}} resizeMode="cover">
    <View style={{flex:1,backgroundColor:'rgba(255,255,255,.35)'}}>
      <Sparkles/>
      <TB colors={[P.pink,P.lav]}><Text style={tbT}>✦ NULL messenger</Text><Dots/></TB>
      <View style={rl.menu}>
        {['you','file','chat','etc.'].map(m=>
          <TouchableOpacity key={m} onPress={()=>onMenu(m)} hitSlop={{top:10,bottom:10,left:6,right:6}}
            style={{paddingVertical:6,paddingHorizontal:4}}><Text style={rl.mi}>{m}</Text></TouchableOpacity>)}
        {/* 💿 — 소개 영상. 이 앱이 뭔지 11초로 알려주는 자리 */}
        <TouchableOpacity onPress={onFilm} hitSlop={{top:10,bottom:10,left:6,right:6}}
          style={{marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:4,paddingVertical:6,paddingHorizontal:6}}>
          <Text style={{fontSize:12}}>💿</Text>
          <Text style={rl.mi}>intro</Text></TouchableOpacity>
        <TouchableOpacity onPress={onCart} hitSlop={{top:10,bottom:10,left:6,right:6}}
          style={{flexDirection:'row',alignItems:'center',gap:4,paddingVertical:6,paddingHorizontal:6}}>
          <Text style={{fontSize:12}}>🛒</Text><Text style={rl.mi}>cart</Text></TouchableOpacity>
        <Bevel style={{minWidth:86,height:30,marginLeft:6}} inner={{flexDirection:'row',gap:5,paddingHorizontal:8}}
          onPress={()=>{ if(autoLoading)return;
            if(left>0){onToast('too soon · '+mmss(left));return}
            onAuto(); }}>
          <Text style={{fontSize:11}}>🌙</Text>
          <Text style={rl.peek}>{autoLoading?'...':left>0?mmss(left):'peek'}</Text></Bevel>
      </View>
      <View style={rl.checker}/>
      <Marquee text={`✧ welcome 2 NULL ✧    the blank u fill in    ✦    ${un0>0?`you have (${un0}) new message`:'no new message'}    ♡    since 2026    `}/>
      <View style={rl.tabs}>
        <TouchableOpacity style={tab==='rooms'?rl.tabOn:rl.tab} onPress={()=>setTab('rooms')}><Text style={tab==='rooms'?rl.tabOnT:rl.tabT}>rooms (4)</Text></TouchableOpacity>
        <TouchableOpacity style={tab==='cam'?rl.tabOn:rl.tab} onPress={()=>setTab('cam')}><Text style={tab==='cam'?rl.tabOnT:rl.tabT}>cam</Text></TouchableOpacity>
        <TouchableOpacity style={tab==='hidden'?rl.tabOn:rl.tab} onPress={()=>setTab('hidden')}><Text style={[tab==='hidden'?rl.tabOnT:rl.tabT,tab!=='hidden'&&{color:'#8f86c9'}]}>.hidden</Text></TouchableOpacity>
      </View>
      {/* padding을 ScrollView 자체 style에 주면 스크롤 프레임이 패딩되어 내용 끝이
          잘린다(.hidden 안내문이 끝까지 내려도 반쯤 잘리던 원인). 여백은 반드시
          contentContainerStyle 쪽에 준다. 아래 여백을 넉넉히 두는 것도 같은 이유다. */}
      <View style={rl.wrap}>
        {/* 창 위쪽 무지개 — 목록이 좀 더 놓였다 */}
        <LinearGradient colors={['#ff9ec6','#ffd68a','#a8e6cf','#a8c8ff','#c3b2f0']}
          start={{x:0,y:0}} end={{x:1,y:0}} pointerEvents="none"
          style={{position:'absolute',left:0,right:0,top:0,height:2,zIndex:2}}/>
        <ScrollView style={{flex:1}}
        contentContainerStyle={{padding:10,paddingBottom:34}}
        showsVerticalScrollIndicator={false}>
        {tab==='cam'
        ? <>
            {Object.entries(CHARS).map(([id,c]:[string,any])=>{
              const got=GALLERY[id].filter(k=>album.has(k));
              if(!got.length) return null;
              return <React.Fragment key={id}>
                <Text style={[rl.sect,{color:c.dk}]}>✧ {c.name} · {got.length} pics</Text>
                <View style={rl.galgrid}>
                  {got.map(k=><TouchableOpacity key={k} style={rl.galcell} onPress={()=>setZoom(IMG+k+'.webp')}>
                    <Image source={{uri:IMG+k+'.webp'}} style={rl.galimg} resizeMode="cover"/>
                  </TouchableOpacity>)}
                </View>
              </React.Fragment>;
            })}
            {!album.size&&<View style={{paddingVertical:70,alignItems:'center'}}>
              <Text style={{...F,fontSize:13,color:'#ff8fbe',marginBottom:8}}>✧ ✦ ✧</Text>
              <Text style={ch.empty}>nothing here yet{'\n'}whatever they send lands here</Text>
            </View>}
          </>
        : tab==='hidden'
        ? <>
            <View style={rl.prog}>
              <Text style={rl.progT}>ENCRYPTED</Text>
              <View style={rl.progBar}><View style={[rl.progFill,{width:pct((unlocked||[]).length/HIDDEN.length*100)}]}/></View>
              <Text style={rl.progN}>{(unlocked||[]).length} / {HIDDEN.length}</Text>
            </View>
            <View style={rl.galgrid}>
              {HIDDEN.map(h=>{
                const un=(unlocked||[]).includes(h.key);
                const need=Math.max(0,h.at-(counts[h.room]||0));
                return <TouchableOpacity key={h.key} activeOpacity={un?0.7:0.85} style={[rl.galcell,{backgroundColor:'#2a2450'}]}
                  onPress={()=>un?setZoom(IMG+h.key+'.webp')
                    :onToast(need?'still locked · '+need+' more':'almost there')}>
                  <Image source={{uri:IMG+h.key+'.webp'}} style={[rl.galimg,!un&&{opacity:.45}]} blurRadius={un?0:14} resizeMode="cover"/>
                  {!un&&<View style={rl.hlock}>
                    <Text style={{fontSize:18}}>🔒</Text>
                    {need>0&&<Text style={rl.hneed}>{need} more</Text>}</View>}
                  <View style={rl.hlabel}><Text style={rl.hlabelT}>{un?h.label:'???'}</Text></View>
                </TouchableOpacity>;
              })}
            </View>
            <Text style={rl.hnote}>LOCK! UNLOCK?{'\n'}keep talking · they open one by one</Text>
          </>
        : ROOMS.map(room=>{
          const ms=msgs[room.id]||[]; const last=ms[ms.length-1]; const un=unread[room.id]||0;
          const watch=room.type==='watch';
          const pr=presence(room.id);
          const card=<TouchableOpacity style={[rl.card,watch&&rl.cardW]} onPress={()=>onOpen(room.id)}>
            {room.type==='dm'
              ? <TouchableOpacity onPress={()=>onProfile(room.id)}>
                  <Face char={room.id} size={42}
                    border={CHARS[room.id].dk+HEAT[stageIdx(counts[room.id]||0)].o}/>
                </TouchableOpacity>
              /* 단톡방·관전방은 얼굴이 없다. 웹은 여기에 SVG로 물방울과 달을 그리는데
                 RN에는 SVG가 없어서 ✧ 글자로 때워놨었다. 그런데 이 Text에만
                 fontFamily를 안 줘서 시스템 글꼴로 그려졌고, ✧가 없는 글꼴을 쓰는
                 폰에서는 빈 동그라미가 됐다(갤럭시가 그렇다). 같은 ✧라도 'LIVE'
                 쪽은 Galmuri11로 그려져서 멀쩡했던 것이다.
                 물방울은 오프닝에 쓰는 그림을 그대로 쓰고, 달은 원 두 개를 겹쳐
                 초승달을 판다. 글꼴에 기대지 않으면 이런 일이 없다. */
              : <View style={[rl.av,{borderColor:room.color},watch?rl.avW:rl.avG]}>
                  {watch
                    ? <View style={rl.moon}><View style={rl.moonCut}/></View>
                    : <Image source={BUBBLE_PNG} style={{width:26,height:26}} resizeMode="contain"/>}
                </View>}
            <View style={{flex:1}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                <Text style={rl.nm}>{room.name}</Text>
                {pr&&<View style={rl.pres}>
                  <View style={[rl.presDot,{backgroundColor:DOT[pr.s]}]}/>
                  <Text style={rl.presT}>{pr.t}</Text></View>}
                {last&&<Text style={rl.tm}>{fmtTime(last.created_at)}</Text>}
              </View>
              <Text style={rl.pv} numberOfLines={1}>
                {last?`${last.sender==='user'?'나: ':''}${last.photo?'[사진] ':''}${last.text}`:room.sub}
              </Text>
            </View>
            {un>0&&<View style={rl.bd}>
              <View style={rl.bdGloss} pointerEvents="none"/>
              <Text style={rl.bdT}>{un}</Text></View>}
          </TouchableOpacity>;
          return <React.Fragment key={room.id}>
            {watch&&<Text style={rl.sect}>✧ LIVE</Text>}
            {watch
              ? <HardShadow dx={1} dy={2} radius={8} color="rgba(93,84,144,.2)" style={{marginTop:6}}>
                  {/* 관전방만 무지개 테두리 — 다른 종류의 방이라는 표시.
                      웹은 hue-rotate를 돌리는데 RN에 filter가 없어서 고정색으로 둔다 */}
                  <LinearGradient colors={['#ffb0d4','#c3b2f0','#a8c8ff','#a8e6cf','#ffd68a']}
                    start={{x:0,y:0}} end={{x:1,y:1}}
                    style={{position:'absolute',left:-2,right:-2,top:-2,bottom:-2,borderRadius:10,opacity:.55}}/>
                  {card}
                </HardShadow>
              : card}
            {/* 카드 사이 구분선 — 점선 대신 하트 점이 떨어진다 */}
            {!watch&&<Text style={rl.hdiv} numberOfLines={1}>{'♡ · '.repeat(24)}</Text>}
          </React.Fragment>;
        })}
        {/* 미니홈피 방문자 카운터 — 목록 끝의 빈 자리를 메운다. 웹의 .hompy와 같다 */}
        {tab==='rooms'&&<View style={rl.hompy}>
          <Text style={rl.hompyL}>visits</Text>
          <View style={rl.hv}><Text style={rl.hvT}>today <Text style={rl.hvB}>{todayN}</Text></Text></View>
          <View style={rl.hv}><Text style={rl.hvT}>total <Text style={rl.hvB}>{totalN}</Text></Text></View>
          <View style={rl.hv}><Text style={rl.hvT}>♡ <Text style={[rl.hvB,{color:'#e0699a'}]}>{hearts}</Text></Text></View>
        </View>}
      </ScrollView></View>
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={()=>setZoom(null)}>
        <TouchableOpacity style={rl.lb} activeOpacity={1} onPress={()=>setZoom(null)}>
          {zoom&&<Image source={{uri:zoom}} style={{width:'100%',height:'80%'}} resizeMode="contain"/>}
        </TouchableOpacity>
      </Modal>
      <View style={rl.st}>
        <Text style={rl.stT}>the blank u fill in ♡ NULL v1.1{demo?' · demo':''}</Text>
        <Text style={rl.stC}>{fmtTime(Date.now())}</Text>
      </View>
    </View>
  </ImageBackground>;
}
const rl=StyleSheet.create({
  hompy:{flexDirection:'row',alignItems:'center',gap:6,marginTop:16,marginHorizontal:3,marginBottom:2,
    paddingVertical:9,paddingHorizontal:10,borderWidth:1,borderColor:'#e8cfe6',borderStyle:'dashed',
    borderRadius:9,backgroundColor:'#fffdff'},
  hompyL:{...F,fontSize:9,letterSpacing:1.8,color:'#c3a6cf'},
  hv:{paddingVertical:3,paddingHorizontal:8,backgroundColor:'#fff',
    borderWidth:1,borderColor:'#eee0f4',borderRadius:10},
  hvT:{...F,fontSize:9.5,letterSpacing:1.2,color:'#9a8fc8'},
  hvB:{color:'#6b5fa8'},
  peek:{...F,fontSize:10,color:P.ink,letterSpacing:.5},
  pres:{flexDirection:'row',alignItems:'center',gap:4},
  presDot:{width:6,height:6,borderRadius:3},
  presT:{...F,fontSize:8.5,color:'#a79cd0'},
  checker:{height:6,backgroundColor:'#efeaf9',borderBottomWidth:1,borderBottomColor:'#cfc6ee'},
  marquee:{paddingVertical:4,backgroundColor:'#f3ecff',overflow:'hidden',
    borderBottomWidth:1,borderBottomColor:'#cfc6ee'},
  marqueeT:{...F,fontSize:8.5,letterSpacing:1.6,color:'#a06cc9'},
  prog:{flexDirection:'row',alignItems:'center',gap:8,marginTop:12,marginBottom:8,marginLeft:4},
  progT:{...F,fontSize:8.5,letterSpacing:3,color:'#b0a6d8'},
  progBar:{flex:1,height:5,backgroundColor:'#e6e0f6',borderWidth:1,borderColor:'#cfc6ee'},
  progFill:{height:'100%',backgroundColor:'#c3b2f0'},
  progN:{...F,fontSize:8.5,color:'#8a7fc0'},
  hneed:{...F,marginTop:6,fontSize:9,color:'rgba(255,255,255,.9)'},
  menu:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:11,paddingVertical:3,backgroundColor:'rgba(240,236,252,.78)',borderBottomWidth:1,borderBottomColor:'#c5bce8'},
  mi:{...F,fontSize:11,color:'#6b5fa8'},
  tabs:{flexDirection:'row',gap:4,paddingHorizontal:12,paddingTop:9},
  tabOn:{paddingHorizontal:13,paddingVertical:6,backgroundColor:'#fff',borderWidth:1,borderColor:P.mid,borderBottomWidth:0,borderTopLeftRadius:7,borderTopRightRadius:7},
  tab:{paddingHorizontal:13,paddingVertical:6,backgroundColor:'rgba(226,220,246,.85)',borderWidth:1,borderColor:P.mid,borderBottomWidth:0,borderTopLeftRadius:7,borderTopRightRadius:7},
  tabOnT:{...F,fontSize:11,color:P.ink}, tabT:{...F,fontSize:11,color:P.mid},
  galgrid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginBottom:6},
  galcell:{width:'48.6%',aspectRatio:2/3,marginBottom:8,borderRadius:5,borderWidth:1,borderColor:'#cfc6ee',overflow:'hidden',backgroundColor:'#efeaf9'},
  galimg:{width:'100%',height:'100%'},
  lb:{flex:1,backgroundColor:'rgba(43,36,78,.85)',justifyContent:'center',alignItems:'center',padding:22},
  hlock:{...StyleSheet.absoluteFillObject,justifyContent:'center',alignItems:'center'},
  hlabel:{position:'absolute',left:0,right:0,bottom:0,paddingVertical:4,paddingHorizontal:7,backgroundColor:'rgba(43,36,78,.55)'},
  hlabelT:{...F,fontSize:9.5,color:'#fff',letterSpacing:1},
  hnote:{...F,textAlign:'center',marginTop:10,marginBottom:6,fontSize:10,color:P.dim,letterSpacing:1},
  wrap:{flex:1,marginHorizontal:12,backgroundColor:'rgba(255,255,255,.9)',borderWidth:1,borderColor:P.mid},
  sect:{...F,marginTop:12,marginBottom:6,marginLeft:4,fontSize:9.5,letterSpacing:4,color:P.dim},
  card:{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:11,paddingHorizontal:9,borderRadius:7},
  cardW:{backgroundColor:'#eef1fc',borderRadius:8},
  /* 카드 사이. 웹의 .roomcard::after와 같은 자리다 */
  hdiv:{...F,marginHorizontal:6,marginTop:-2,marginBottom:2,fontSize:7,letterSpacing:2.2,
        color:'#e7dcf5',height:10,overflow:'hidden'},
  av:{width:42,height:42,borderRadius:21,borderWidth:1,overflow:'hidden',justifyContent:'center',alignItems:'center',backgroundColor:'#fff'},
  avG:{backgroundColor:'#eaf1fb'},
  avW:{backgroundColor:'#e6eaf7'},
  /* 초승달 — 채운 원 위에 배경색 원을 살짝 밀어 얹어서 판다 */
  moon:{width:20,height:20,borderRadius:10,backgroundColor:'#8a7fc0',overflow:'hidden'},
  moonCut:{position:'absolute',left:5,top:-3,width:20,height:20,borderRadius:10,backgroundColor:'#e6eaf7'},
  nm:{...F,fontSize:13.5,color:P.ink}, tm:{...F,marginLeft:'auto',fontSize:9.5,color:P.dim},
  pv:{...F,marginTop:5,fontSize:11,color:P.sub},
  bd:{minWidth:20,height:20,paddingHorizontal:6,borderRadius:10,backgroundColor:P.badge,borderWidth:1,borderColor:P.border,justifyContent:'center',alignItems:'center'},
  bdGloss:{position:'absolute',left:3,right:3,top:2,height:6,borderRadius:6,backgroundColor:'rgba(255,255,255,.6)'},
  bdT:{...F,fontSize:10,color:'#fff'},
  st:{flexDirection:'row',gap:4,padding:8},
  stT:{...F,flex:1,paddingVertical:5,paddingHorizontal:9,fontSize:10,color:'#6b5fa8',backgroundColor:P.bg,borderWidth:1,borderColor:P.dim},
  stC:{...F,paddingVertical:5,paddingHorizontal:9,fontSize:10,color:'#6b5fa8',backgroundColor:P.bg,borderWidth:1,borderColor:P.dim},
});

/* 키보드가 입력창을 덮는 문제.
   요즘 안드로이드(edge-to-edge)는 키보드가 뜰 때 창을 줄이지 않고 위에 얹는다.
   그래서 adjustResize에 기대는 KeyboardAvoidingView만으로는 안 밀린다.
   키보드 높이를 직접 받아 입력바를 그만큼 올린다. 루트에서 이미
   insets.bottom을 주고 있으므로 그 몫은 빼야 두 번 밀리지 않는다. */
function useKeyboardHeight() {
  const [kbd,setKbd]=useState({h:0,top:0});
  const win=useWindowDimensions();
  const full=useRef(win.height);
  /* 키보드가 닫혀 있을 때의 창 높이를 기준으로 잡아둔다.
     창을 줄이는 모드(adjustResize)에서는 이미 그만큼 밀려 있으므로
     키보드가 가린 만큼에서 줄어든 몫을 빼야 두 번 밀리지 않는다. */
  if (kbd.h === 0 && win.height > full.current) full.current = win.height;
  useEffect(()=>{
    const ios=Platform.OS==='ios';
    const show=Keyboard.addListener(ios?'keyboardWillShow':'keyboardDidShow',
      e=>setKbd({h:e.endCoordinates?.height||0, top:e.endCoordinates?.screenY||0}));
    const hide=Keyboard.addListener(ios?'keyboardWillHide':'keyboardDidHide',()=>setKbd({h:0,top:0}));
    return ()=>{show.remove();hide.remove()};
  },[]);

  /* height는 기기마다 기준이 다르다. 삼성 IME처럼 위에 툴바가 붙는 키보드는
     height가 툴바를 빼고 오는 경우가 있어서 그만큼 입력창이 모자라게 올라온다.
     screenY(키보드 윗변의 화면 좌표)로 재면 툴바까지 포함한 실제 가림 높이가 나온다.
     화면 아래끝 − 키보드 윗변 = 진짜 가려진 높이. screenY를 안 주는 기기만 height로 돌아간다. */
  const scrH = Dimensions.get('screen').height;
  const byTop = kbd.top > 0 ? Math.max(0, scrH - kbd.top) : 0;
  const covered = kbd.h === 0 ? 0 : Math.max(kbd.h, byTop);
  const shrank = Math.max(0, full.current - win.height);
  return covered === 0 ? 0 : Math.max(0, covered - shrank);
}

// ═══ 채팅방 ═══
function ChatRoom({room,msgs,typing,failed,onBack,onSend,onRetry,onProfile}:any) {
  const [text,setText]=useState('');
  const [zoom,setZoom]=useState<string|null>(null);
  const ref=useRef<ScrollView>(null);
  const watch=room.type==='watch';
  const kb=useKeyboardHeight();   // 루트가 키보드 열릴 때 하단 여백을 접으므로 여기선 그대로 올린다
  useEffect(()=>{setTimeout(()=>ref.current?.scrollToEnd({animated:true}),80)},[msgs.length,typing,kb]);
  const send=()=>{const t=text.trim(); if(!t||typing) return; setText(''); onSend(t);};
  const meta=(s:string)=>CHARS[s]||{name:s,color:'#9aa3d8',dk:'#6b5fa8',pale:'#e2e6f5'};

  return <View style={{flex:1,backgroundColor:'#fdfcff'}}>
    <TB colors={watch?['#aab3d6','#c9c0ee']:[room.color,P.lav]}>
      <Text style={tbT}>{room.name}{watch?'.cam':'.chat'}</Text><Dots onClose={onBack}/>
    </TB>
    <View style={ch.hdr}>
      <Bevel style={{width:32,height:29}} onPress={onBack}>
        <Text style={{color:'#6b5fa8',fontSize:15}}>◁</Text></Bevel>
      {room.type==='dm'&&<TouchableOpacity onPress={()=>onProfile(room.id)}>
        <Face char={room.id} size={32} border={P.mid}/></TouchableOpacity>}
      <View><Text style={ch.hdrN}>{room.name}</Text>
        <Text style={ch.hdrS}>{watch?'🔴 watching':room.sub}</Text></View>
    </View>
    <ScrollView ref={ref} style={{flex:1}} contentContainerStyle={{padding:16}}>
      {msgs.length===0&&!typing&&<View style={{paddingVertical:80,alignItems:'center'}}>
        {!watch&&<Text style={{...F,fontSize:13,color:'#ff8fbe',marginBottom:8}}>✧ ✦ ✧</Text>}
        <Text style={ch.empty}>{watch?'':room.sub}</Text></View>}
      {msgs.map((m:Msg,i:number)=>{
        const prev=msgs[i-1]; const gap=!prev||m.created_at-prev.created_at>600000;
        const me=m.sender==='user'; const mt=meta(m.sender);
        // 지문 줄이 끼면 흐름이 끊기므로 다음 말은 프로필부터 다시 보여준다
        const head=gap||!prev||prev.sender!==m.sender||isNarr(prev);
        const showName=head&&!me&&(room.type==='group'||watch);
        const pu=m.photo&&PHOTOS[m.photo]?IMG+PHOTOS[m.photo]:null;
        if (isNarr(m)) return <React.Fragment key={m.id||i}>
          {gap&&<Text style={ch.div}>✦ {fmtTime(m.created_at)} ✦</Text>}
          <Text style={ch.narr}>{m.text}</Text>
        </React.Fragment>;
        return <React.Fragment key={m.id||i}>
          {gap&&<Text style={ch.div}>✦ {fmtTime(m.created_at)} ✦</Text>}
          <View style={[ch.row,me&&{justifyContent:'flex-end'},{marginTop:head?8:2}]}>
            {!me&&head&&(CHARS[m.sender]
              ? <TouchableOpacity activeOpacity={0.8} onPress={()=>onProfile(m.sender)}>
                  <Face char={m.sender} size={28} border={P.mid}/></TouchableOpacity>
              : <View style={[ch.av,{backgroundColor:mt.pale}]}/>)}
            {!me&&!head&&<View style={{width:28}}/>}
            <View style={{maxWidth:'76%',alignItems:me?'flex-end':'flex-start'}}>
              {showName&&<Text style={[ch.nm,{color:mt.dk}]}>{mt.name}</Text>}
              {pu?<HardShadow radius={8}>
                    <TouchableOpacity style={ch.pBub} onPress={()=>setZoom(pu)}>
                      <Image source={{uri:pu}} style={ch.pImg} resizeMode="cover"/>
                      {!!m.text&&<Text style={ch.pCap}>{m.text}</Text>}
                    </TouchableOpacity>
                  </HardShadow>
                : <HardShadow radius={8} dx={me?-2:2} color={me?'rgba(255,143,190,.4)':'rgba(138,127,192,.28)'}>
                    <View style={[ch.bub,me?{backgroundColor:room.color+'80',borderBottomRightRadius:2}:{borderBottomLeftRadius:2}]}>
                      <Text style={ch.bubT}>{m.text}</Text></View>
                  </HardShadow>}
            </View>
          </View>
        </React.Fragment>;
      })}
      {typing&&<View style={[ch.row,{marginTop:8}]}>
        <View style={ch.av}/>
        <HardShadow radius={8}><View style={ch.bub}>
          <Text style={{...F,color:P.mid,fontSize:14,letterSpacing:2}}>···</Text></View></HardShadow>
      </View>}
      {failed&&!typing&&<TouchableOpacity style={ch.retry} onPress={onRetry}>
        <Text style={ch.retryT}>no reply... try again?</Text></TouchableOpacity>}
    </ScrollView>
    {watch
      ? <View style={ch.wBar}><Text style={{fontSize:8}}>🔴</Text><Text style={ch.wT}>u can't join this one</Text></View>
      : <View style={[ch.iBar,{marginBottom:kb}]}>
          <TextInput style={ch.input} value={text} onChangeText={setText} onSubmitEditing={send} returnKeyType="send"/>
          <Bevel style={{width:40,height:37}} inner={{backgroundColor:room.color}}
            onPress={send} disabled={!text.trim()||typing}>
            <Text style={{color:'#fff',fontSize:16}}>↑</Text></Bevel>
        </View>}
    <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={()=>setZoom(null)}>
      <TouchableOpacity style={ch.lb} onPress={()=>setZoom(null)} activeOpacity={1}>
        {zoom&&<Image source={{uri:zoom}} style={{width:'100%',height:'80%'}} resizeMode="contain"/>}
      </TouchableOpacity>
    </Modal>
  </View>;
}
const ch=StyleSheet.create({
  hdr:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:11,paddingVertical:8,backgroundColor:P.bg,borderBottomWidth:1,borderBottomColor:'#c5bce8'},
  hdrAv:{width:32,height:32,borderRadius:16,borderWidth:1,borderColor:P.mid},
  hdrN:{...F,fontSize:13.5,color:P.ink}, hdrS:{...F,fontSize:9.5,color:P.sub},
  empty:{...F,textAlign:'center',color:P.dim,fontSize:11.5},
  div:{...F,alignSelf:'center',marginVertical:12,fontSize:9.5,color:'#c39ede'},
  // 괄호 지문 — 말풍선이 아니라 채팅창에 쳐진 한 줄
  narr:{...F,alignSelf:'center',maxWidth:'82%',marginVertical:7,paddingHorizontal:6,
        textAlign:'center',fontSize:10,lineHeight:17,color:'#9a8fc8'},
  row:{flexDirection:'row',alignItems:'flex-end',gap:8},
  av:{width:28,height:28,borderRadius:14,borderWidth:1,borderColor:P.mid,overflow:'hidden',justifyContent:'center',alignItems:'center',backgroundColor:P.bg},
  nm:{...F,fontSize:9.5,marginTop:6,marginBottom:3,marginLeft:2},
  bub:{paddingHorizontal:11,paddingVertical:8,borderRadius:8,backgroundColor:'#fff',borderWidth:1,borderColor:P.mid},
  bubT:{...F,fontSize:12.5,lineHeight:20,color:P.ink},
  pBub:{borderRadius:8,borderWidth:1,borderColor:P.mid,backgroundColor:'#fff',overflow:'hidden',padding:4},
  pImg:{width:W*.44,height:W*.55,borderRadius:5},
  pCap:{...F,paddingHorizontal:7,paddingVertical:5,fontSize:12.5,color:P.ink},
  retry:{alignSelf:'flex-start',marginTop:8,marginLeft:34,paddingHorizontal:13,paddingVertical:8,backgroundColor:'#fff0f3',borderWidth:1,borderColor:'#d4586b'},
  retryT:{...F,fontSize:11,color:P.err},
  iBar:{flexDirection:'row',alignItems:'center',gap:8,padding:10,backgroundColor:P.chrome,borderTopWidth:1,borderTopColor:P.mid},
  input:{...F,flex:1,paddingHorizontal:12,paddingVertical:10,fontSize:16,backgroundColor:'#fff',borderWidth:1,borderColor:P.mid,borderTopColor:P.border,borderLeftColor:P.border,color:P.ink},
  wBar:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:12,backgroundColor:P.chrome,borderTopWidth:1,borderTopColor:P.mid},
  wT:{...F,fontSize:11,color:'#2f9e5a',letterSpacing:1},
  lb:{flex:1,backgroundColor:'rgba(43,36,78,.85)',justifyContent:'center',alignItems:'center',padding:22},
});

/* 팝업 안의 메뉴 한 줄 */
function MenuRow({label,onPress}:{label:string;onPress:()=>void}) {
  return <TouchableOpacity onPress={onPress} style={mo.mrow}>
    <Text style={mo.mrowT}>{label}</Text></TouchableOpacity>;
}

/* [file → my stats] 지금까지 채운 빈칸을 숫자로. 대사로 못 하는 말을 통계가 대신한다 */
function StatsPanel({msgs,counts,unlocked,album}:any) {
  const allPhotos=Object.values(GALLERY).reduce((n:number,l:any)=>n+l.length,0);
  const first=Object.values(msgs).flat().reduce((a:number,m:any)=>!a||m.created_at<a?m.created_at:a,0) as number;
  const MON=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const day=(ts:number)=>{const d=new Date(ts);return MON[d.getMonth()]+' '+d.getDate()};
  const rows:[string,string][]=[
    ['w/ 재언', String(counts.jaeeon||0)],
    ['w/ 민현', String(counts.minhyun||0)],
    ['group',   String(counts.group||0)],
    ['pics',    album.size+' / '+allPhotos],
    ['.hidden', (unlocked||[]).length+' / '+HIDDEN.length],
  ];
  return <View style={{width:'100%'}}>
    {rows.map(([k,v])=><View key={k} style={mo.srow}>
      <Text style={mo.sk}>{k}</Text><Text style={mo.sv}>{v}</Text></View>)}
    <Text style={mo.sfoot}>{first?'first met u · '+day(first):'nothing yet'}</Text>
  </View>;
}

/* [chat → search] 방을 넘나들며 찾는다. 어디서 그 말을 했는지 기억나지 않을 때 */
function SearchPanel({msgs,name,onOpen}:any) {
  const [q,setQ]=useState('');
  const key=q.trim();
  const hits=!key?[]:ROOMS.flatMap((r:any)=>(msgs[r.id]||[])
    .filter((m:any)=>(m.text||'').includes(key)).map((m:any)=>({r,m}))).slice(-40).reverse();
  return <View style={{width:'100%'}}>
    <TextInput style={mo.find} value={q} onChangeText={setQ} placeholder="search..."
      placeholderTextColor="#c9a6c2" autoFocus/>
    <ScrollView style={{maxHeight:220,marginTop:10}}>
      {key&&!hits.length&&<Text style={mo.txt}>nothing found</Text>}
      {hits.map(({r,m}:any,i:number)=><TouchableOpacity key={i} style={mo.hit} onPress={()=>onOpen(r.id)}>
        <Text style={mo.hitWho}>{m.sender==='user'?name:(CHARS[m.sender]?.name||r.name)} · {r.name}</Text>
        <Text style={mo.hitT} numberOfLines={1}>{m.text}</Text>
      </TouchableOpacity>)}
    </ScrollView>
  </View>;
}

// ═══ 메인 ═══
/* SafeAreaView(react-native)는 iOS에서만 동작한다. 안드로이드에서는 화면이
   상태바 밑으로 파고들고 하단 내비게이션바에 가려진다.
   safe-area-context의 insets로 양쪽 플랫폼을 같이 처리한다. */
export default function App() {
  return <SafeAreaProvider><Root/></SafeAreaProvider>;
}

function Root() {
  const insets=useSafeAreaInsets();
  const kbRoot=useKeyboardHeight();
  /* 키보드가 뜨면 하단 내비게이션 여백은 의미가 없어진다. 접어두지 않으면
     입력바를 올릴 때 그만큼 모자라거나 두 번 밀린다. */
  const padBottom=kbRoot>0?0:insets.bottom;
  const [fontsOk]=useFonts({ Galmuri11: require('./assets/fonts/Galmuri11.ttf') });
  const [ready,setReady]=useState(false);
  const [name,setName]=useState<string|null>(null);
  const [msgs,setMsgs]=useState<Record<string,Msg[]>>({});
  const [unread,setUnread]=useState<Record<string,number>>({});
  const [view,setView]=useState<{type:'list'|'chat'|'profile'|'cart';id?:string}>({type:'list'});
  const [gifts,setGifts]=useState<Record<string,string[]>>({});   // 누구에게 뭘 줬나
  const [typing,setTyping]=useState(false);
  const [failed,setFailed]=useState<any>(null);
  const [autoLoading,setAutoLoading]=useState(false);
  const [popup,setPopup]=useState<string|null>(null);
  const [toast,setToast]=useState<string|null>(null);              // 짧은 확인 토스트
  const [profile,setProfile]=useState<Record<string,string>>({});  // 당신.txt 빈칸
  const [unlocked,setUnlocked]=useState<string[]>([]);             // .hidden 해금 key
  const [stamp,setStamp]=useState(0);                              // 프로필 갱신 트리거
  const [autoAt,setAutoAt]=useState(0);                            // 마지막 peek 시각(쿨타임)
  const [demo,setDemo]=useState(false);                            // 각본으로 넘어갔나
  /* 등록 화면은 이름을 처음 넣은 사람에게만 지나간다 — 이미 이름이 있으면
     앱을 열 때마다 볼 이유가 없다. */
  const [enrolling,setEnrolling]=useState(false);
  const lastSent=useRef<{room:string;text:string}|null>(null);     // 재시도용
  /* 소개 영상. 화면 전환 바깥에 달아야 방을 오가도 안 끊긴다. */
  const [film,setFilm]=useState(false);
  const viewRef=useRef(view); viewRef.current=view;
  /* 실습 남은 날. 교생은 한 달 뒤에 떠난다 — 첫 대화한 날을 D-30으로 잡고
     하루씩 깎는다. 0이 되면 거기서 멈춘다. 웹도 같은 식으로 센다. */
  const firstTs=Object.values(msgs).flat().reduce((a:number,m:any)=>!a||m.created_at<a?m.created_at:a,0);
  const dLeft=firstTs?Math.max(0,ENROLL_DAYS-Math.floor((Date.now()-firstTs)/864e5)):ENROLL_DAYS;

  const reload=useCallback(async(room?:string)=>{
    const rooms = room?[room]:['jaeeon','minhyun','group','health'];
    const next:Record<string,Msg[]>={};
    for(const r of rooms) next[r]=await getMsgs(r);
    setMsgs(prev=>({...prev,...next}));
  },[]);

  useEffect(()=>{(async()=>{
    await initDB();
    const n=await getMeta('user_name');
    const p=await getMeta('null_profile');
    if(p){try{setProfile(JSON.parse(p))}catch{}}
    const u=await getMeta('null_unlocked');
    if(u){try{setUnlocked(JSON.parse(u))}catch{}}
    setGifts(await loadGifts());
    const a=await getMeta('null_auto_at');
    if(a) setAutoAt(Number(a)||0);
    if(n){ setName(n); await reload(); } else setName('');
    setReady(true);
  })()},[]);

  /* 토스트 자동 사라짐 */
  useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(null),1400); return ()=>clearTimeout(t); },[toast]);
  /* 안드로이드 물리 뒤로: 팝업 → 닫기, 방/프로필 → 목록 */
  useEffect(()=>{
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(popup){ setPopup(null); return true; }
      if(viewRef.current.type!=='list'){ setView({type:'list'}); return true; }
      return false;
    });
    return ()=>sub.remove();
  },[popup]);

  /* 응답에 딸려오는 해금 목록과 상태메시지를 저장한다.
     이걸 안 하면 .hidden이 영영 안 열리고 프로필 상태메시지도 늘 비어 있다. */
  const applyExtras = async(data:any)=>{
    if(Array.isArray(data?.unlocked)){
      setUnlocked(prev=>{
        const merged=Array.from(new Set([...prev,...data.unlocked]));
        if(merged.length!==prev.length){
          setMeta('null_unlocked',JSON.stringify(merged));
          const add=data.unlocked.find((k:string)=>!prev.includes(k));
          const label=HIDDEN.find(h=>h.key===add)?.label;
          if(label) setToast('✧ .hidden — '+label);
        }
        return merged;
      });
    }
    if(data?.status&&typeof data.status==='object'){
      for(const [c,t] of Object.entries(data.status)) await saveStatus(c,String(t||''));
    }
    setStamp(x=>x+1);
  };

  // 순차 등장 — 타이핑 연출
  const enqueue = async (room:string, list:any[]) => {
    for(const m of list){
      setTyping(true);
      await new Promise(r=>setTimeout(r, typeDelay(m.sender||room, m.text||'')));
      await insertMsg({ room, sender:m.sender||room, text:m.text||'', photo:m.photo||null, created_at:Date.now() });
      await reload(room);
      if(viewRef.current.id!==room) setUnread(u=>({...u,[room]:(u[room]||0)+1}));
    }
    setTyping(false);
  };

  /* 입장 — 기본 문장 없음, 빈 방에서 시작 */
  const handleEnter = async(n:string)=>{
    await setMeta('user_name',n); setName(n); setEnrolling(true);
    await reload();
  };

  const handleSend = async(text:string)=>{
    const room=view.id!; if(!name) return;
    await insertMsg({room,sender:'user',text,created_at:Date.now()});
    await reload(room);
    lastSent.current={room,text};
    await runTurn(room);
  };

  /* 선물 보내기.
     사진은 채팅창에 띄우지 않는다 — 줄글 한 줄만 남기고 반응은 인물이 알아서 한다.
     sender를 'sys'로 두는 이유: db 스키마를 건드리지 않고도 "일어난 일"이라는 표시가
     그대로 저장된다. isNarr가 이걸 보고 말풍선 대신 지문 줄로 그린다. */
  const giveGift = async(char:string, gift:any, memo?:string)=>{
    if(!name||!char||!gift) return;
    const have=gifts[char]||[];
    if(have.includes(gift.key)) return;            // 같은 걸 두 번 주지 않는다
    const next={...gifts,[char]:[...have,gift.key]};
    setGifts(next); await saveGifts(next);
    const note=(memo||'').trim().slice(0,60);
    const line=`${CHARS[char].name}이 ${gift.name}을(를) 받았다`+(note?` — \u201c${note}\u201d`:'');
    await insertMsg({room:char,sender:'sys',text:line,created_at:Date.now()});
    await reload(char);
    setToast(`${CHARS[char].name} — ${gift.name}`);
    setFailed(null); setTyping(true);
    if(demoOn()){ setTyping(false); await enqueue(char,demoReply(char,line)); return; }
    try{
      const hist=await getMsgs(char);
      const data=await sendChat(char,name,hist,{key:gift.key,name:gift.name,note});
      setTyping(false);
      await applyExtras(data);
      if(data.messages?.length) await enqueue(char,data.messages);
    }catch(e:any){ setTyping(false); await fallToDemo(e,char,line); }
  };

  /* 서버가 안 되면 각본으로 넘어간다. 한 번 넘어가면 그 뒤로는 계속 데모다 —
     한 대화 안에서 진짜와 각본이 섞이면 어느 쪽이 고장인지 알 수가 없다.
     실패한 진짜 이유는 콘솔에 그대로 남긴다. */
  const fallToDemo = async(e:any, room:string, lastText?:string)=>{
    console.error('[NULL] 서버 호출 실패 → 데모로 전환', e);
    DEMO.auto=true; setDemo(true); setFailed(null);
    await enqueue(room, demoReply(room,lastText));
  };

  /* 보낸 말은 이미 저장돼 있다. 모델 호출만 다시 한다 —
     재시도해도 같은 말이 두 번 쌓이지 않는다. */
  const runTurn = async(room:string)=>{
    if(!name) return;
    setFailed(null); setTyping(true);
    const ls=lastSent.current;
    const said=ls&&ls.room===room?ls.text:undefined;   // 각본을 고를 때만 쓴다
    if(demoOn()){ setTyping(false); await enqueue(room,demoReply(room,said)); return; }
    try{
      const hist=await getMsgs(room);
      const data=await sendChat(room,name,hist);
      setTyping(false);
      await applyExtras(data);
      if(data.messages?.length) await enqueue(room,data.messages);
    }catch(e:any){ setTyping(false); await fallToDemo(e,room,said); }
  };

  const handleRetry = ()=>{
    const last=lastSent.current;
    const room=(viewRef.current.type==='chat'&&viewRef.current.id)||last?.room;
    if(room) runTurn(room);
  };

  const handleAuto = async()=>{
    if(!name||autoLoading) return;
    const t=Date.now(); setAutoAt(t); setMeta('null_auto_at',String(t));
    setAutoLoading(true);
    if(demoOn()){ await enqueue('health',demoReply('health')); setAutoLoading(false); return; }
    try{
      const data=await genAuto(name);
      await applyExtras(data);
      if(data.messages?.length) await enqueue('health',data.messages);
    }catch(e:any){ await fallToDemo(e,'health'); }
    setAutoLoading(false);
  };

  /* 당신.txt: 빈칸 저장 / 이름 변경 */
  const saveProfile=(k:string,v:string)=>setProfile(p=>{const n={...p,[k]:v}; setMeta('null_profile',JSON.stringify(n)); return n;});
  const doRename=(t:string)=>{const v=t.trim(); if(v){setMeta('user_name',v); setName(v);}};
  /* [편집] 대화 저장: 전체 방 → 공유 시트로 내보내기 */
  const exportTxt=async()=>{
    const lines:string[]=['NULL — 대화 기록',''];
    for(const r of ROOMS){
      const ms:Msg[]=msgs[r.id]||[]; if(!ms.length) continue;
      lines.push('──── '+r.name+' ────');
      ms.forEach(m=>lines.push(`${m.sender==='user'?name:(CHARS[m.sender]?.name||m.sender)}: ${m.photo?'(사진) ':''}${m.text||''}`));
      lines.push('');
    }
    try{ await Share.share({message:lines.join('\n'),title:'NULL 대화기록'}); }catch{}
  };
  const handleMenu = async(m:string)=>{
    if(m==='you') setPopup('profile');
    else if(m==='etc.') setPopup('help');
    else if(m==='file') setPopup('file');
    else if(m==='chat') setPopup('chat');
  };

  const doReset = async()=>{
    await clearAll(); setName(''); setMsgs({}); setUnread({}); setProfile({}); setUnlocked([]); setGifts({});
    lastSent.current=null; setAutoAt(0); setStamp(x=>x+1); setPopup(null); setView({type:'list'});
  };

  /* 방별 누적 수와 받은 사진은 이미 들고 있는 msgs에서 뽑는다 — 따로 저장하지 않는다 */
  const counts:Record<string,number>={};
  ['jaeeon','minhyun','group','health'].forEach(r=>{counts[r]=(msgs[r]||[]).length});
  const album=new Set<string>();
  Object.values(msgs).forEach(list=>(list||[]).forEach(m=>{if(m.photo)album.add(m.photo)}));

  const openRoom=(id:string)=>{ setView({type:'chat',id}); setFailed(null); setUnread(u=>({...u,[id]:0})); };

  // 오프닝은 폰트가 올라온 뒤에 그린다 — 픽셀 폰트가 없으면 로고가 딴 글씨가 된다
  if(!ready||!fontsOk) return <View style={{flex:1,backgroundColor:'#c3b2f0'}}/>;
  if(!name) return <><StatusBar barStyle="dark-content"/>
    <View style={{flex:1,paddingTop:insets.top,paddingBottom:insets.bottom}}>
      <Splash onEnter={handleEnter}/></View></>;

  let screen;
  if(view.type==='profile') screen=<Profile char={view.id!} refresh={stamp}
    onBack={()=>setView({type:'list'})}/>;
  else if(view.type==='cart') screen=<CartScreen gifts={gifts} hearts={heartsOf(counts,gifts)}
    onSend={giveGift} onBack={()=>setView({type:'list'})}/>;
  else if(view.type==='chat'){
    const room=ROOMS.find(r=>r.id===view.id)!;
    screen=<ChatRoom room={room} msgs={msgs[view.id!]||[]} typing={typing&&view.id!=='health'} failed={failed}
      onBack={()=>setView({type:'list'})} onSend={handleSend} onRetry={handleRetry}
      onProfile={(c:string)=>setView({type:'profile',id:c})}/>;
  } else {
    screen=<RoomList msgs={msgs} unread={unread} unlocked={unlocked} counts={counts} album={album}
      autoAt={autoAt} onOpen={openRoom}
      onProfile={(c:string)=>setView({type:'profile',id:c})}
      onAuto={handleAuto} autoLoading={autoLoading} onMenu={handleMenu} onToast={setToast}
      onCart={()=>setView({type:'cart'})} demo={demo} onFilm={()=>setFilm(true)}
      hearts={heartsOf(counts,gifts)}/>;
  }

  return <>
    <StatusBar barStyle="light-content"/>
    <View style={{flex:1,backgroundColor:P.pink,paddingTop:insets.top,paddingBottom:padBottom}}>
      {screen}</View>
    {enrolling&&<Enroll name={name} profile={profile} onSaveField={saveProfile}
      onDone={()=>setEnrolling(false)}/>}
    {film&&<IntroFilm onClose={()=>setFilm(false)}/>}
    {toast&&<View pointerEvents="none" style={mo.toast}><Text style={mo.toastT}>{toast}</Text></View>}
    <Modal visible={!!popup} transparent animationType="fade" onRequestClose={()=>setPopup(null)}>
      <TouchableOpacity style={mo.bg} activeOpacity={1} onPress={()=>setPopup(null)}>
        <TouchableOpacity activeOpacity={1} style={mo.winWrap} onPress={()=>{}}>
          <View style={mo.win}>
            <TB colors={['#ff8fbe','#ffb0d4']}><Text style={tbT}>NULL</Text><Dots onClose={()=>setPopup(null)}/></TB>
            <ScrollView style={{maxHeight:Math.min(380,H*0.55)}} contentContainerStyle={mo.body}>
              {/* etc. — 미니홈피 게스트북 톤. index.html의 .etc와 같은 문구·같은 순서다.
                  웹은 conic-gradient로 CD를 그리는데 RN에는 없어서, 오프닝에 쓰는
                  SpinCD를 작게 줄여 그대로 쓴다. */}
              {popup==='help'&&<View style={mo.etc}>
                <View style={mo.etcCd}><SpinCD size={62}/></View>
                <Text style={mo.etcHi}>안녕, NULL 기다렸어. ✧</Text>
                <Text style={mo.etcSub}>the blank u fill in</Text>
                <Text style={mo.etcDiv}>♡ ・ ♡ ・ ♡</Text>
                <View style={mo.etcRow}><Text style={mo.etcTag}>실습 D-{dLeft}</Text></View>
                <Text style={mo.etcNote}>당신이 없어도 대화는 이어져요.{'\n'}항상 당신 이야기로.</Text>
                <View style={mo.etcStk}>
                  {['✿','★','♡','✧','☾'].map((x,i)=>
                    <Text key={i} style={[mo.etcStkT,{color:['#ff9ec6','#ffd68a','#c3b2f0','#8fd8e8','#ffb0d4'][i]}]}>{x}</Text>)}
                </View>
              </View>}
              {popup==='file'&&<>
                <MenuRow label="💾  save all (.txt)" onPress={()=>{setPopup(null);exportTxt()}}/>
                <MenuRow label="♡  my stats" onPress={()=>setPopup('stats')}/>
              </>}
              {popup==='chat'&&<>
                <MenuRow label="✔  mark all read" onPress={()=>{setPopup(null);setUnread({});setToast('all read')}}/>
                <MenuRow label="➤  search" onPress={()=>setPopup('search')}/>
              </>}
              {popup==='stats'&&<StatsPanel msgs={msgs} counts={counts} unlocked={unlocked} album={album}/>}
              {popup==='search'&&<SearchPanel msgs={msgs} name={name}
                onOpen={(id:string)=>{setPopup(null);openRoom(id)}}/>}
              {popup==='profile'&&<>
                <TextInput style={mo.nameIn} defaultValue={name} maxLength={12}
                  onEndEditing={e=>doRename(e.nativeEvent.text)}/>
                {([['subject','과목 교생'],['age','세'],['likes','를 좋아하고'],['dislikes','를 싫어한다']] as [string,string][]).map(([k,sfx])=>
                  <View key={k} style={mo.row}>
                    <TextInput style={mo.blank} placeholder="□□" placeholderTextColor="#e0a8c8" defaultValue={profile[k]||''} maxLength={20}
                      onEndEditing={e=>saveProfile(k,e.nativeEvent.text.trim())}/>
                    <Text style={mo.txt}>{sfx}</Text>
                  </View>)}
                <Bevel style={{marginTop:16,height:38,minWidth:130}} inner={{paddingHorizontal:20,backgroundColor:'#ffe3f0'}}
                  onPress={()=>setPopup('reset')}><Text style={mo.btnT}>restart</Text></Bevel>
              </>}
              {popup==='reset'&&<>
                <Text style={mo.txt}>this cannot be undone. rly?</Text>
                <Bevel style={{marginTop:16,height:38,minWidth:130}} inner={{paddingHorizontal:20,backgroundColor:'#ffe3f0'}}
                  onPress={doReset}><Text style={mo.btnT}>erase all</Text></Bevel>
              </>}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  </>;
}
const mo=StyleSheet.create({
  /* etc. 팝업 — 웹의 .etc 계열. 분홍 그라데이션은 배경색 한 겹으로 대신한다 */
  etc:{alignItems:'center',paddingTop:4,paddingBottom:8},
  etcCd:{marginTop:14,marginBottom:12},
  etcHi:{...F,fontSize:14,letterSpacing:.8,color:'#8a4f74',textAlign:'center'},
  etcSub:{...F,marginTop:8,fontSize:10,letterSpacing:2.2,color:'#c0a8d0',textAlign:'center'},
  etcDiv:{...F,marginTop:14,marginBottom:12,fontSize:9,letterSpacing:5,color:'#f0a8c8'},
  etcRow:{flexDirection:'row',flexWrap:'wrap',gap:6,justifyContent:'center',paddingHorizontal:16},
  etcTag:{...F,paddingVertical:4,paddingHorizontal:9,fontSize:9,letterSpacing:.6,color:'#8a7fc0',
    backgroundColor:'#fff',borderWidth:1,borderColor:'#e6d9f5',borderRadius:11},
  etcNote:{...F,marginTop:14,paddingHorizontal:16,fontSize:9.5,lineHeight:19,
    color:'#b0a6d8',textAlign:'center'},
  etcStk:{flexDirection:'row',gap:11,marginTop:14},
  etcStkT:{fontSize:12},
  mrow:{width:'100%',paddingVertical:11,paddingHorizontal:12,marginBottom:6,
    backgroundColor:'#fff',borderWidth:1,borderColor:'#f0c4dc'},
  mrowT:{...F,fontSize:12,color:'#8a4f74',letterSpacing:.5},
  srow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:7},
  sk:{...F,fontSize:12,color:'#8a4f74'}, sv:{...F,fontSize:12,color:P.ink},
  sfoot:{...F,marginTop:10,textAlign:'center',fontSize:10,color:'#c3aacd'},
  find:{...F,width:'100%',paddingVertical:9,paddingHorizontal:11,fontSize:15,color:P.ink,
    backgroundColor:'#fff',borderWidth:1,borderColor:'#e79cc0'},
  hit:{padding:8,marginBottom:5,backgroundColor:'#fff',borderWidth:1,borderColor:'#e7dcf4'},
  hitWho:{...F,fontSize:9,color:'#8a7fc0',marginBottom:3},
  hitT:{...F,fontSize:11,color:P.ink},
  bg:{flex:1,backgroundColor:'rgba(43,36,78,.6)',justifyContent:'center',alignItems:'center',padding:30},
  winWrap:{width:'100%',maxWidth:300},
  win:{width:'100%',backgroundColor:'#ffd0e4',borderWidth:1,borderColor:P.border,borderRadius:8,overflow:'hidden'},
  body:{padding:26,alignItems:'center'},
  nameIn:{...F,fontSize:16,color:P.ink,marginBottom:12,paddingVertical:4,paddingHorizontal:10,textAlign:'center',
    borderBottomWidth:1,borderBottomColor:'#e79cc0',minWidth:120},
  row:{flexDirection:'row',alignItems:'center',gap:8,marginVertical:3},
  blank:{...F,fontSize:12,color:P.ink,minWidth:64,paddingVertical:4,paddingHorizontal:8,textAlign:'center',
    backgroundColor:'#fff',borderWidth:1,borderColor:'#e79cc0',borderStyle:'dashed',borderRadius:3},
  txt:{...F,fontSize:12.5,color:'#8a4f74',marginVertical:4,textAlign:'center'},
  btnT:{...F,fontSize:12,color:P.ink,letterSpacing:2},
  toast:{position:'absolute',left:0,right:0,bottom:70,alignItems:'center'},
  toastT:{...F,fontSize:11,color:'#fff',letterSpacing:1,paddingVertical:9,paddingHorizontal:18,
    backgroundColor:'rgba(43,36,78,.88)',borderRadius:18,overflow:'hidden'},
});
