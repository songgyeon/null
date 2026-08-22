// App.tsx — NULL RN(Expo). 로직 동일, UI 레이어만 웹 버전 톤으로 재구성.
// 설치: npx expo install expo-linear-gradient expo-font expo-audio react-native-safe-area-context
// 폰트: https://github.com/quiple/galmuri 릴리즈에서 Galmuri11.ttf → assets/fonts/Galmuri11.ttf
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, Image, Modal,
  ImageBackground, Animated, Easing, StyleSheet, Dimensions, StatusBar,
  Platform, Share, BackHandler, Keyboard, useWindowDimensions, ImageStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { initDB, getMsgs, insertMsg, getMeta, setMeta, clearAll, countMsgs, Msg } from './lib/db';
import { sendChat, genAuto, rollSummary, IMG } from './lib/api';
import { demoAnswer, demoProactive, demoGreetWhen, demoWatchOpen } from './lib/demoLines';
import { stageDiff, loadSeenStage, saveSeenStage } from './lib/profiles';
import { currentStage, PROFILES, TRACKS, TRACK_INFO, MAIN_TRACK,
         loadGifts, saveGifts, bgFor, heartsOf } from './lib/profiles';
import { useAudioPlayer } from 'expo-audio';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { hydrateShim, resetShim } from './lib/shim';
import Cabinet from './screens/Cabinet';
import { AskDialog, LeaveDialog, WayDialog, PlateDialog, GroupNewDialog, LookOverlay } from './screens/Dialogs';
import { askState, whoAt, sceneExpired, placeOverNow, openingNow, talkedEnough } from './lib/flow';
/* ── 규칙은 웹과 같은 파일에서 온다 ──
   app-data.js가 원본이고 tools/build-rules.mjs가 app/lib/rules.ts를 만든다.
   전에는 이 표들을 앱이 손으로 베껴 들고 있었다. 그래서 웹에 지도가 생기고
   자리가 생기고 점심이 생기는 동안 앱은 옛 규칙에 머물렀다 — 같은 이름을 단
   다른 물건이 됐다. 베낀 것을 지우고 같은 글을 읽게 한다. */
import {
  CHARS, ROOMS, ENROLL_DAYS, HIDDEN, AV_V, presence, photoSrc,
  AUTO_COOL, AUTO_AWAY, AUTO_MAX_DAY, PHOTO_EVENT_AT, DDAY_MARKS, mmss,
  PLACES, PLACE_BY, SPOTS, WAY, WAY_BG, ITEMS, jos, dayKey, timeWord, isWend,
  placeOpen, placeHours, sceneShot, sceneOver, wayOK, loadWay, saveWay,
  loadScene, saveScene, loadMet, saveMet, loadBag, saveBag, goneToday, stampGone,
  giftedToday, stampGift, loadGroupOn, saveGroupOn, groupReady, roomsOn,
  openingFor, canGreet, asleep, allAsleep, bothAwake, speedOn, speedDaysOf, speedCountOf, setSpeedAt, loadMode, saveMode, stampShot, loadRefused, saveRefused, daysLeft, daysSince, seenPhotos, PLACE_BG,
  GIFTS, GIFT_CATS, GIFT_HINT, giftSpots as giftSpotsOf,
} from './lib/rules';

/* 갤러리는 규칙 파일의 CHARS에서 뽑는다 — 앨범이 웹과 어긋나지 않게 */
const GALLERY:Record<string,string[]> = {};
Object.entries(CHARS).forEach(([id,c]:any)=>{ GALLERY[id]=(c.gallery||[]).map((f:string)=>f.replace(/\.webp$/,'')); });

const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;

const P = {
  ink:'#4a4276', border:'#5d5490', mid:'#8a7fc0', chrome:'#dcd6f2', bg:'#ece8fa',
  pink:'#ff9ec6', sub:'#9a8fc8', dim:'#b0a6d8', badge:'#ff7fae', err:'#c23b50', dark:'#2a2450',
  lav:'#c3b2f0', shade:'#cdc3ec',
};
const F = { fontFamily:'Galmuri11' } as const; // 픽셀 폰트 — 모든 Text에 적용




/* .hidden 탭 — 해금된 key는 meta 'null_unlocked'(JSON 배열)에서 읽는다 */
/* .hidden — room/at은 worker.js의 UNLOCKS, index.html의 HIDDEN과 같아야 한다.
   어긋나면 화면에 뜨는 "N more"가 실제 해금 시점과 달라진다. */
type HiddenItem={key:string;label:string;room:'jaeeon'|'minhyun';at:number;day:number;note?:string};
type GalleryZoom={uri:string;label?:string;note?:string};

/* ── 데모 모드 ──
   대사와 매칭은 lib/demoLines.ts에 있다. 그 파일은 docs/dialogue-corpus.md에서
   만들어진다 — 대사를 고칠 때는 문구집을 고치고 node tools/build-demo.mjs를 돌린다.
   웹(demo-lines.js)과 같은 데서 나오므로 한쪽만 고쳐질 일이 없다.
   서버가 죽었거나 키가 없을 때 빈 화면 대신 각본이라도 움직인다. 조용히 가짜로
   바뀌면 진짜 장애를 못 알아채므로 실패 원인은 콘솔에 남기고 하단 바에 표시한다. */
const DEMO = { auto:false };
const demoOn = () => DEMO.auto;
/* 가까워졌는지. 셀카를 줄지 말지가 여기서 갈린다 — 처음부터 주면
   그건 셀카가 아니라 프로필 사진이다. 균열 단계(40마디)를 기준으로 삼는다.
   index.html의 demoClose와 같은 값이다. */
const demoCount:Record<string,number> = {};
/* gift는 물건의 열쇠다. 선물은 말이 아니라 물건이라 매칭에 안 걸린다 —
   "회색 머그컵을(를) 받았다"를 그대로 넘기면 못 알아들었다는 답이 나갔다. */
function demoReply(room:string, lastText?:string, userName?:string, gift?:string|null) {
  return demoAnswer(room, lastText || '', userName || '',
    { close:(demoCount[room]||0) >= 40, gift });
}

/* 프사를 교체해도 파일명이 같으면 앱의 이미지 캐시가 옛 사진을 계속 쓴다.
   사진을 갈아끼울 때마다 이 숫자를 올린다. */
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

const DOT:Record<string,string>={on:'#4fc98a',away:'#f0b34a',off:'#c3bcd8'};

/* ── 관계 온도 ── 단계 이름은 화면에 쓰지 않는다. 색으로만 말한다 */
// lib/profiles.ts의 stages, index.html의 STAGE_AT과 같아야 한다 (0/16/40/80/120)
const STAGE_AT=[0,16,40,80,120];
const STAGE_DAY=[0,4,10,18,25];
/* 대화 수와 날짜를 둘 다 넘어야 다음 단계다. index.html·worker.js와 같아야 한다 */
const stageIdx=(n:number,days=0)=>{let i=0;STAGE_AT.forEach((a,k)=>{if(n>=a&&days>=STAGE_DAY[k])i=k});return i};
// stageIdx로 색인한다 — STAGE_AT과 길이가 같아야 한다. 짧으면 마지막 단계에서 터진다
const HEAT=[{w:1,o:'44'},{w:1.5,o:'80'},{w:2,o:'b8'},{w:2.5,o:'e0'},{w:3,o:'ff'}];

/* 관전방 자동 채움 — 유저가 선물을 주거나 무언가 해금되면, 두 사람이 그 일을
   두고 이야기한다. 시계가 아니라 사건이 방아쇠다.
   다만 바로 만들지 않는다. 유저가 앱을 떠난 지 한 시간쯤 지난 뒤의 일로 찍는다.
   같이 있는데 내 얘기를 하는 건 딴짓처럼 보이지만, 내가 나가고 한 시간 뒤면
   그건 내가 없는 자리에서 벌어진 일이다.
   서버 크론은 안 쓴다. 안 돌아올 사람 몫까지 미리 만들어 돈을 태우고, 지금
   백엔드는 유저별 저장소도 없다. 돌아왔을 때 만들고 시각을 과거로 찍으면
   화면에 보이는 결과는 같고 값은 돌아온 사람 수만큼만 든다. */

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

/* ── 프로필이 바뀌면 목록이 알려준다 ──
   말풍선으로 알리지 않는다. 그건 그 사람이 나한테 한 말이 아니니까.
   얼굴 둘레가 숨 쉬듯 뛴다. 그게 전부다 — 웹은 홀로그램이 도는데 RN에는
   conic-gradient가 없어서 이쪽은 깜빡임으로 대신한다. */
function NuRing(){
  const a=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(a,{toValue:1,duration:900,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
      Animated.timing(a,{toValue:0,duration:900,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
    ]));
    loop.start(); return ()=>loop.stop();
  },[a]);
  return <Animated.View pointerEvents="none" style={[nu.ring,{
    opacity:a.interpolate({inputRange:[0,1],outputRange:[.22,1]}),
    transform:[{scale:a.interpolate({inputRange:[0,1],outputRange:[.95,1.05]})}]}]}/>;
}
const nu=StyleSheet.create({
  ring:{position:'absolute',left:-4,top:-4,width:50,height:50,borderRadius:25,
        borderWidth:1.6,borderColor:'#ff8fbe'},
});

/* 장식용 그림은 터치를 안 받아야 한다. RN 0.71부터 pointerEvents는 prop이
   아니라 style로 주는 게 정식이고 런타임은 어느 컴포넌트에서도 받는데,
   타입 쪽 ImageStyle에만 그 자리가 없다. 타입 구멍이라 여기 한 곳에서만
   메우고 쓰는 데서는 그냥 스타일처럼 얹는다. View는 아직 prop을 받으므로
   그쪽은 안 건드린다. */
const NO_TOUCH = { pointerEvents: 'none' } as unknown as ImageStyle;

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
function Enroll({name,profile,onSaveField,onRename,onDone,mode,onMode}:{
  name:string; profile:Record<string,string>;
  onSaveField:(k:string,v:string)=>void; onRename:(n:string)=>void; onDone:()=>void;
  mode:string; onMode:(m:string)=>void;
}) {
  /* 등록 화면인데 정작 이름만 못 고쳤다. 오타를 내면 목록의 edit 메뉴까지
     가야 했는데, 그때는 이미 두 사람이 그 이름으로 부르기 시작한 뒤다. */
  const [edit,setEdit]=useState(false);
  const [nv,setNv]=useState(name||'');
  useEffect(()=>setNv(name||''),[name,edit]);
  const saveName=()=>{setEdit(false);const t=nv.trim();if(t&&t!==name)onRename(t)};
  // 빈칸 넷 + MODE 한 줄 + DAYS LEFT 한 줄
  const rows = useRef(Array.from({length:ENR_FIELDS.length+2},()=>new Animated.Value(0))).current;
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
        <View style={en.nameRow}>
          {edit
            ?<TextInput style={en.nameIn} value={nv} autoFocus maxLength={12}
               onChangeText={setNv} onBlur={saveName} onSubmitEditing={saveName} returnKeyType="done"/>
            :<TouchableOpacity onPress={()=>setEdit(true)}>
               <Text style={en.name}>{name}</Text></TouchableOpacity>}
        </View>
        {ENR_FIELDS.map((f,i)=>
          <Animated.View key={f.k} style={[en.row,anim(rows[i])]}>
            <Text style={en.rowL}>{f.lab}</Text>
            <TextInput style={[en.blank,!!(profile[f.k]||'').trim()&&en.blankOn,f.w?{minWidth:f.w}:null]}
              placeholder="□□" placeholderTextColor="#7a6bb8" maxLength={20}
              defaultValue={profile[f.k]||''}
              onEndEditing={e=>onSaveField(f.k,e.nativeEvent.text.trim())}/>
            <Text style={en.rowT}>{f.tail}</Text>
          </Animated.View>)}
        {/* ── 이 판을 어떻게 살 것인가 ── 웹의 .emode와 같은 자리·같은 글월.
            중간에 바꾸면 D-N이 튀므로 판마다 한 번이다. */}
        <Animated.View style={[en.row,anim(rows[4])]}>
          <Text style={en.rowL}>MODE</Text>
          <View style={en.mode}>
            {['real','speed'].map(k=>
              <TouchableOpacity key={k} activeOpacity={.8} onPress={()=>onMode(k)}
                style={[en.modeB,mode===k&&en.modeBOn]}>
                <Text style={[en.modeT,mode===k&&en.modeTOn]}>{k}</Text>
              </TouchableOpacity>)}
          </View>
          <Text style={en.modeH}>{mode==='speed'
            ?'하루가 4배로 Speed up! ˙˚ଘo(∗ ❛ั ᵕ ❛ั )੭່˙'
            :'현실 하루 = NULL 하루! ♡ ٩(❛ัᴗ❛ั ๑)'}</Text>
        </Animated.View>
        {/* 남은 날은 세지 않는다. 이 값이 비어 있는 게 이 이야기다 */}
        <Animated.View style={[en.row,anim(rows[5])]}>
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
  /* 이 화면만 진보라였다. 앞의 오프닝도 뒤의 방 목록도 파스텔이라 1.5초짜리
     어두운 화면 하나가 다른 앱처럼 끼어 있었다. 같은 가족으로 옮겼다. */
  root:{...StyleSheet.absoluteFillObject,zIndex:55,backgroundColor:'#cabff1',
        alignItems:'center',justifyContent:'center',padding:26},
  card:{width:'100%',maxWidth:286,borderRadius:14,overflow:'hidden',borderWidth:2,borderColor:'#fff',
        backgroundColor:'#f6f1ff'},
  tb:{backgroundColor:'#b79ceb',paddingVertical:6,paddingHorizontal:10,
      borderBottomWidth:1.5,borderBottomColor:'#7f6cbb'},
  tbT:{...F,fontSize:9.5,letterSpacing:1.8,color:'#fff'},
  body:{paddingHorizontal:16,paddingTop:16,paddingBottom:15},
  nameRow:{flexDirection:'row',alignItems:'center',gap:6,paddingBottom:11,
           borderBottomWidth:1,borderBottomColor:'#d9cbf3'},
  name:{...F,fontSize:15,letterSpacing:.9,color:'#4a4276'},
  nameIn:{...F,flex:1,fontSize:15,color:'#4a4276',paddingVertical:3,paddingHorizontal:7,
          backgroundColor:'#fff',borderWidth:1,borderColor:'#c3b2f0',borderRadius:5},
  row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:5,
       paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#d9cbf3'},
  rowL:{...F,fontSize:8.5,letterSpacing:2,color:'#a290d4',minWidth:66},
  rowT:{...F,fontSize:12,color:'#6b5cae'},
  /* 이제 밝은 창이라 you.txt와 같은 빈칸을 쓴다 */
  blank:{...F,fontSize:12,minWidth:44,paddingVertical:2,paddingHorizontal:6,textAlign:'center',
         color:'#c46a97',backgroundColor:'#fff',borderWidth:1,borderColor:'#d9cbf3',
         borderStyle:'dashed',borderRadius:3},
  blankOn:{color:'#4a4276',borderStyle:'solid'},
  nullv:{...F,fontSize:12,letterSpacing:.7,color:'#b0a6d8'},
  /* 웹의 .emode와 같은 가족. 고른 쪽은 Click! 단추와 같은 분홍에 2px 턱이고,
     안 고른 쪽은 위의 빈칸들과 같은 점선이라 「아직 안 정한 칸」으로 읽힌다.
     RN에는 그라데이션이 없어서 단색 분홍으로 대신한다 — 턱과 광이 모양을 낸다. */
  mode:{flexDirection:'row',gap:6},
  modeB:{paddingVertical:4,paddingHorizontal:13,borderRadius:999,backgroundColor:'#fff',
         borderWidth:1.5,borderColor:'#d9cbf3',borderStyle:'dashed'},
  modeBOn:{borderStyle:'solid',borderColor:'#fff',backgroundColor:'#ffd9ec',
           shadowColor:'#edbcd6',shadowOpacity:1,shadowRadius:0,
           shadowOffset:{width:0,height:2},elevation:2},
  modeT:{...F,fontSize:11,letterSpacing:1.7,color:'#a897dd'},
  modeTOn:{color:'#6b5fa8'},
  /* 설명은 알약 밑으로 내린다 — 라벨 밑에 붙으면 어느 알약 얘기인지 안 보인다.
     66(라벨) + 5(gap) 만큼 들여써서 알약과 왼쪽을 맞춘다 */
  modeH:{...F,width:'100%',paddingLeft:71,fontSize:9,color:'#a897dd'},
  bar:{marginTop:15,height:6,borderRadius:999,backgroundColor:'#eae1fb',borderWidth:1,borderColor:'#d9cbf3',overflow:'hidden'},
  fill:{height:'100%',backgroundColor:'#ff8fbe'},
  msg:{...F,marginTop:8,fontSize:8.5,letterSpacing:1.8,color:'#a290d4'},
  msgOn:{color:'#5fb98a'},
  go:{marginTop:13,paddingVertical:10,alignItems:'center',borderRadius:999,backgroundColor:'#ffd9ec',
      borderWidth:1.5,borderColor:'#fff'},
  goT:{...F,fontSize:12,letterSpacing:3.6,color:'#6b5fa8'},
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
/* 초승달. 흰 그림 한 장을 tintColor로 물들여 쓴다 — 원 두 개를 겹쳐 파면
   뒤에 깔린 색을 알아야 해서 버튼 위와 아바타 위에서 같이 못 쓴다. */
const MOON_PNG=require('./assets/moon.png');
const SpCursor=()=><Image source={CURSOR_PNG} style={[sp.cursor,NO_TOUCH]}
  resizeMode="contain"/>;

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
      <Text style={tbT}>✿ gift{pick?' / wrap':''}</Text><Dots onClose={onBack}/></TB>

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
            <View style={ct.thumb}>
              <Image source={{uri:IMG+`gicon-${g.key}.webp`}} style={ct.thumbImg} resizeMode="contain"/></View>
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
        <View style={ct.gthumb}>
          <Image source={{uri:IMG+`gicon-${pick.key}.webp`}} style={ct.gthumbImg} resizeMode="contain"/></View>
        <View style={{flex:1}}>
          <Text style={ct.gname}>{pick.name}</Text>
          <View style={ct.gprice}><Text style={ct.priceT}>♡ {pick.cost}</Text></View>
        </View>
      </View>
      <View style={ct.sect}><View style={ct.sline}/>
        <Text style={ct.sectT}>WHO GETS THIS</Text><View style={ct.sline}/></View>
      {/* 물건은 손에서 손으로 간다 — 그래서 선물이 만나러 가는 이유가 된다.
          웹의 .cshut과 같은 글월이다. 상자는 안 두른다: 창 안에 창이 하나 더
          생기고, 이 창은 이미 테두리가 많다. */}
      <Text style={ct.shut}>선물은 What? 주인공은 Who? 장소는 Where?{'\n'}만나서 전해봐요! ˚₊·ଘ(っ≧∀≦)っ˚₊·♡</Text>
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
        <Text style={ct.backT}>BACK...</Text></Bevel>
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
  /* 물건은 그림이다. 이모지로 두면 기기마다 다른 그림이 나온다 */
  thumbImg:{width:46,height:46},
  gthumbImg:{width:54,height:54},
  gname:{...F,fontSize:14,color:P.ink},
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
  shut:{...F,marginBottom:10,paddingHorizontal:10,textAlign:'center',fontSize:9.5,
    letterSpacing:.6,lineHeight:18,color:'#b09ad4'},
  memo:{...F,minHeight:76,padding:13,fontSize:11,lineHeight:22,color:'#8a4f74',
    textAlignVertical:'top',backgroundColor:'#fffdf6',borderWidth:1,borderColor:'#ecd9c8',borderRadius:8},
  backT:{...F,fontSize:11,letterSpacing:3,color:P.ink},
});

// ═══ 프로필 화면 — Y2K 미니홈피 카드 (배경: 재언=전시회 / 민현=락페) ═══
function Profile({char,onBack,refresh,dLeft,back,days}:{char:string;onBack:()=>void;refresh?:number;dLeft?:number;back?:boolean;days?:number}) {
  const [stage,setStage]=useState<any>(null);
  const [count,setCount]=useState(0);
  const [gifts,setGifts]=useState<Record<string,string[]>>({});
  const [full,setFull]=useState(false);   // 배경만 크게 보기
  useEffect(()=>{(async()=>{
    setStage(await currentStage(char,dLeft,back,days));
    setCount(await countMsgs(char));
    setGifts(await loadGifts());
  })()},[char,refresh,dLeft,back,days]);
  const ch=CHARS[char];
  // 훅은 조건문 위에 있어야 한다 — 아래 return보다 뒤로 내리면 렌더마다 훅 수가 달라진다
  const bg=useBgUri(bgFor(char,count,gifts,stage?.bg,days), PROFILES[char]?.fallback||char+'-bg.webp');
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
                  <Text style={pf.polaCap}>{room.empty}</Text>
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
              <Text style={pf.closeT}>◁ BACK</Text></Bevel>
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
    <LinearGradient colors={['#ffe6f2','#efe6ff','#e2f4ff']} start={{x:0,y:0}} end={{x:1,y:0}}
      style={StyleSheet.absoluteFill} pointerEvents="none"/>
    <Animated.View style={{flexDirection:'row',transform:[{translateX:x}]}}>
      <Text style={rl.marqueeT} numberOfLines={1}
        onLayout={e=>setW(Math.round(e.nativeEvent.layout.width))}>{text}</Text>
      <Text style={rl.marqueeT} numberOfLines={1}>{text}</Text>
    </Animated.View>
  </View>;
}

// ═══ 방 목록 ═══
function RoomList({msgs,unread,unlocked,counts,seenStage,dayN,album,autoAt,onOpen,onProfile,onAuto,autoLoading,onMenu,onToast,onCart,demo,hearts,name,met,groupOn,onGoPlace,onPlate}:any) {
  /* 방문자 카운터용 집계 — 오늘 오간 말 / 전체 말 */
  const allMsgs=ROOMS.flatMap((r:any)=>msgs[r.id]||[]);
  /* 단톡방은 민현이 나중에 판다 — 그전까지는 없는 방이다 */
  const rooms=roomsOn(groupOn);
  const t0=new Date(); t0.setHours(0,0,0,0);
  const todayN=allMsgs.filter((m:any)=>(m.created_at||0)>=t0.getTime()).length;
  const totalN=allMsgs.length;
  const [tab,setTab]=useState<'rooms'|'map'|'cam'|'hidden'>('rooms');
  const [zoom,setZoom]=useState<GalleryZoom|null>(null);
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
        {/* 🎁 선물은 메뉴 항목이다 — 버튼은 peek 하나뿐이어야 그게 특별한
            동작으로 보인다. 메뉴바는 조용해야 한다. */}
        <TouchableOpacity onPress={onCart} hitSlop={{top:10,bottom:10,left:6,right:6}}
          style={{marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:4,paddingVertical:6,paddingHorizontal:6}}>
          <Text style={{fontSize:12}}>🎁</Text><Text style={rl.mi}>gift</Text></TouchableOpacity>
        <Bevel style={{minWidth:86,height:30,marginLeft:6}} inner={{flexDirection:'row',gap:5,paddingHorizontal:8}}
          onPress={()=>{ if(autoLoading)return;
            if(left>0){onToast('too soon · '+mmss(left));return}
            onAuto(); }}>
          <Image source={MOON_PNG} style={{width:13,height:13,tintColor:left>0?'#b0a6d8':'#6b5fa8'}}/>
          <Text style={rl.peek}>{autoLoading?'...':left>0?mmss(left):'peek'}</Text></Bevel>
      </View>
      <Marquee text={`✧ welcome 2 NULL ✧    the blank u fill in    ✦    ${un0>0?`you have (${un0}) new message`:'no new message'}    ♡    since 2026    `}/>
      <View style={rl.tabs}>
        <TouchableOpacity style={tab==='rooms'?rl.tabOn:rl.tab} onPress={()=>setTab('rooms')}><Text style={tab==='rooms'?rl.tabOnT:rl.tabT}>rooms ({roomsOn(groupOn).length})</Text></TouchableOpacity>
        <TouchableOpacity style={tab==='map'?rl.tabOn:rl.tab} onPress={()=>setTab('map')}><Text style={tab==='map'?rl.tabOnT:rl.tabT}>map</Text></TouchableOpacity>
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
        {tab==='map'
        ? <Cabinet met={met} onGoPlace={onGoPlace} onPlate={onPlate}/>
        : tab==='cam'
        ? <>
            {Object.entries(CHARS).map(([id,c]:[string,any])=>{
              const got=GALLERY[id].filter(k=>album.has(k));
              if(!got.length) return null;
              return <React.Fragment key={id}>
                <Text style={[rl.sect,{color:c.dk}]}>✧ {c.name} · {got.length} pics</Text>
                <View style={rl.galgrid}>
                  {got.map(k=><TouchableOpacity key={k} style={rl.galcell} onPress={()=>setZoom({uri:IMG+k+'.webp'})}>
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
                /* 얼마나 남았는지 안 알려준다. 자물쇠만 있다 */
                return <TouchableOpacity key={h.key} activeOpacity={un?0.7:0.85} style={[rl.galcell,{backgroundColor:'#2a2450'}]}
                  onPress={()=>un?setZoom({uri:IMG+h.key+'.webp',label:h.label,
                    note:((h as any).note||'').replace('{name}',name||'당신')})
                    :onToast('still locked')}>
                  <Image source={{uri:IMG+h.key+'.webp'}} style={[rl.galimg,!un&&{opacity:.45}]} blurRadius={un?0:14} resizeMode="cover"/>
                  {!un&&<View style={rl.hlock}><Text style={{fontSize:18}}>🔒</Text></View>}
                  {/* 잠긴 이름은 물음표가 아니라 빈칸이다. 글자 수만큼 밑줄을
                      그으면 지워진 문서처럼 보인다 — 없는 게 아니라 가려진 것이다 */}
                  <View style={rl.hlabel}><Text style={rl.hlabelT}>{un?h.label:h.label.replace(/\S/g,'_')}</Text></View>
                </TouchableOpacity>;
              })}
            </View>
            <Text style={rl.hnote}>LOCK! UNLOCK?{'\n'}keep talking · they open one by one</Text>
          </>
        : rooms.map((room:any)=>{
          const ms=msgs[room.id]||[]; const last=ms[ms.length-1]; const un=unread[room.id]||0;
          const watch=room.type==='watch';
          const pr=presence(room.id);
          /* 프로필이 바뀌었는데 아직 안 열어봤으면 — 얼굴 둘레가 뛴다 */
          const nuList=CHARS[room.id]?stageDiff(room.id,(seenStage||{})[room.id]||0,stageIdx(counts[room.id]||0,dayN)):[];
          const card=<TouchableOpacity style={[rl.card,watch&&rl.cardW]} onPress={()=>onOpen(room.id)}>
            {room.type==='dm'
              ? <TouchableOpacity onPress={()=>onProfile(room.id)}>
                  <Face char={room.id} size={42}
                    border={CHARS[room.id].dk+HEAT[stageIdx(counts[room.id]||0,dayN)].o}/>
                  {nuList.length>0&&<NuRing/>}
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
                    ? <Image source={MOON_PNG} style={{width:21,height:21,tintColor:'#8a7fc0'}}/>
                    : <View style={rl.bub}>
                        <View style={[rl.bubO,{width:19,height:19,borderRadius:10,left:1,top:4}]}/>
                        <View style={[rl.bubO,{width:6,height:6,borderRadius:3,left:16,top:0}]}/>
                        <View style={[rl.bubO,{width:4,height:4,borderRadius:2,left:17,top:16,borderWidth:.9}]}/>
                      </View>}
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
                {/* 지문에는 말한 사람이 없다 — 웹 목록에서 「나: 이재언은 자고
                    있다」로 찍힌 것과 같은 자리다. 앱은 sender가 sys라 갈래만 하나 더 둔다 */}
                {last?`${last.sender==='sys'?'· ':last.sender==='user'?'나: ':''}${last.photo?'[사진] ':''}${last.text}`:room.empty}
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
          {/* 웹의 .hompy .sp — 오른쪽 끝에 별과 하트. 웹은 픽셀 SVG를 쓰는데
              앱에는 그 그림이 없어서 같은 색의 글자로 놓는다 */}
          <View style={rl.hompySp} pointerEvents="none">
            <Text style={[rl.hompyIco,{color:'#ffd68a'}]}>✦</Text>
            <Text style={[rl.hompyIco,{color:'#ff7fae'}]}>♥</Text>
          </View>
        </View>}
      </ScrollView>
      </View>
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={()=>setZoom(null)}>
        <TouchableOpacity style={rl.lb} activeOpacity={1} onPress={()=>setZoom(null)}>
          {zoom&&<View style={rl.lbCard}>
              <Image source={{uri:zoom.uri}} style={rl.lbImg} resizeMode="contain"/>
              {zoom.label&&<View style={rl.lbCap}>
                <Text style={rl.lbTitle}>{zoom.label}</Text>
                {!!zoom.note&&<Text style={rl.lbNote}>{zoom.note}</Text>}
              </View>}
            </View>}
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
  hompySp:{marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:5,opacity:.9},
  hompyIco:{...F,fontSize:11},
  peek:{...F,fontSize:10,color:P.ink,letterSpacing:.5},
  pres:{flexDirection:'row',alignItems:'center',gap:4},
  presDot:{width:6,height:6,borderRadius:3},
  presT:{...F,fontSize:8.5,color:'#a79cd0'},
  marquee:{paddingVertical:4,overflow:'hidden',
    borderBottomWidth:1,borderBottomColor:'#cfc6ee'},
  marqueeT:{...F,fontSize:8.5,letterSpacing:1.6,color:'#a06cc9'},
  prog:{flexDirection:'row',alignItems:'center',gap:8,marginTop:12,marginBottom:8,marginLeft:4},
  progT:{...F,fontSize:8.5,letterSpacing:3,color:'#b0a6d8'},
  progBar:{flex:1,height:5,backgroundColor:'#e6e0f6',borderWidth:1,borderColor:'#cfc6ee'},
  progFill:{height:'100%',backgroundColor:'#c3b2f0'},
  progN:{...F,fontSize:8.5,color:'#8a7fc0'},
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
  lbCard:{width:'100%',height:'90%',justifyContent:'center',alignItems:'center'},
  lbImg:{width:'100%',flex:1},
  lbCap:{width:'100%',marginTop:8,paddingVertical:8,paddingHorizontal:10,borderWidth:1,borderColor:'#cfc6ee',backgroundColor:'rgba(255,253,255,.97)'},
  lbTitle:{...F,fontSize:10,color:'#8a7fc0',letterSpacing:1.4,marginBottom:4},
  lbNote:{...F,fontSize:11.5,lineHeight:19,color:'#4a4276'},
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
  /* 단톡방 — 웹의 BubbleIcon과 같은 배치다. 큰 것 하나에 작은 것 둘.
     사진 같은 비눗방울 한 장을 채워 넣으니 뿌옇게 번져서 그림으로 바꿨다 */
  bub:{width:24,height:23},
  bubO:{position:'absolute',borderWidth:1.3,borderColor:'#9db7e8',backgroundColor:'rgba(207,224,248,.45)'},
  avW:{backgroundColor:'#e6eaf7'},
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
function ChatRoom({room,msgs,typing,failed,onBack,onSend,onRetry,onProfile,scene,onLeaveScene,onMinimize}:any) {
  const [text,setText]=useState('');
  const [zoom,setZoom]=useState<string|null>(null);
  const ref=useRef<ScrollView>(null);
  const watch=room.type==='watch';
  const kb=useKeyboardHeight();   // 루트가 키보드 열릴 때 하단 여백을 접으므로 여기선 그대로 올린다
  useEffect(()=>{setTimeout(()=>ref.current?.scrollToEnd({animated:true}),80)},[msgs.length,typing,kb]);
  const send=()=>{const t=text.trim(); if(!t||typing) return; setText(''); onSend(t);};
  const meta=(s:string)=>CHARS[s]||{name:s,color:'#9aa3d8',dk:'#6b5fa8',pale:'#e2e6f5'};

  /* ── 자리 ──
     같이 있으면 그 자리가 화면이 된다. 들어간 순간엔 빈 방이고, 그 사람이
     입을 열면 그 사람이 배경이 된다(scene.shot) — 눈앞에 있는 사람 사진을
     문자로 받는 건 이상하니까 배경이 그 일을 대신한다.
     머리글의 X는 접기다(자리는 살아 있다). 나가기는 아래 뒤로가기가 맡는다 —
     하루에 한 번뿐인 자리라 실수로 닫히면 그날이 끝난다. */
  const bg=scene?(scene.shot||scene.bg||PLACE_BG[scene.place]):null;

  return <View style={{flex:1,backgroundColor:'#fdfcff'}}>
    {bg&&<Image source={{uri:IMG+bg}} style={StyleSheet.absoluteFill as any} resizeMode="cover"/>}
    {bg&&<View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(26,20,36,.42)'}]} pointerEvents="none"/>}
    <TB colors={watch?['#aab3d6','#c9c0ee']:[room.color,P.lav]}>
      <Text style={tbT}>{scene?scene.place:room.name}{watch?'.cam':'.chat'}</Text>
      <Dots onClose={scene?onMinimize:onBack}/>
    </TB>
    <View style={[ch.hdr,bg&&{backgroundColor:'rgba(255,255,255,.82)'}]}>
      <Bevel style={{width:32,height:29}} onPress={scene?onLeaveScene:onBack}>
        <Text style={{color:'#6b5fa8',fontSize:15}}>◁</Text></Bevel>
      {room.type==='dm'&&<TouchableOpacity onPress={()=>onProfile(room.id)}>
        <Face char={room.id} size={32} border={P.mid}/></TouchableOpacity>}
      <View><Text style={ch.hdrN}>{scene?`${room.name} · ${scene.place}`:room.name}</Text>
        <Text style={ch.hdrS}>{watch?'🔴 watching':scene?'같이 있는 중':room.sub}</Text></View>
    </View>
    <ScrollView ref={ref} style={{flex:1}} contentContainerStyle={{padding:16}}>
      {msgs.length===0&&!typing&&<View style={{paddingVertical:80,alignItems:'center'}}>
        {!watch&&<Text style={{...F,fontSize:13,color:'#ff8fbe',marginBottom:8}}>✧ ✦ ✧</Text>}
        <Text style={ch.empty}>{watch?'':room.empty}</Text></View>}
      {msgs.map((m:Msg,i:number)=>{
        const prev=msgs[i-1]; const gap=!prev||m.created_at-prev.created_at>600000;
        const me=m.sender==='user'; const mt=meta(m.sender);
        // 지문 줄이 끼면 흐름이 끊기므로 다음 말은 프로필부터 다시 보여준다
        const head=gap||!prev||prev.sender!==m.sender||isNarr(prev);
        const showName=head&&!me&&(room.type==='group'||watch);
        const pu=m.photo&&photoSrc(m.photo)?IMG+photoSrc(m.photo):null;
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
  /* 인물마다 프로필을 마지막으로 본 단계. 지금 단계가 이보다 높으면 목록이 알린다 */
  const [seenStage,setSeenStage]=useState<Record<string,number>>({});
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
  /* 판마다 하나. 등록 화면에서 고르고 저장소가 들고 있는다 — 웹과 같은 열쇠다 */
  const [mode,setMode]=useState<string>(loadMode);
  const lastSent=useRef<{room:string;text:string}|null>(null);     // 재시도용
  const [invite,setInvite]=useState<any>(null);   // 같이 가자는 제안
  /* ── 자리 ──
     지도에서 자리를 고르고 사람을 부르면 그 자리에 마주 앉는다. 화면이
     「지금 여기 같이 있다」를 대신 말해준다 — 전에는 그걸 그릴 방법이 없어
     괄호 지문으로 때우다가 「이건 그냥 텍스트니까요」까지 갔다.
     저장은 규칙 파일이 한다(loadScene/saveScene) — 웹과 같은 열쇠, 같은 모양. */
  const [scene,setScene]=useState<any>(null);
  const sceneRef=useRef<any>(null); sceneRef.current=scene;
  const putScene=(v:any)=>{ setScene(v); saveScene(v); };
  /* 키만 보내면 워커가 from을 빈칸으로 채운다. buildBag은 from으로 제 것을
     고르므로, 그 상태에서는 「네가 준 것」이 영영 비어 있었다 — 웹은 고쳐졌고
     앱만 문자열 배열로 남아 있었다. 자리 밖에서도 보낸다: 준 사실은 그 자리에서
     끝나는 일이 아니다. */
  const bagOut=(bs:any[])=>(bs||[]).map((b:any)=>({k:b.key,from:b.from||""}));
  const [bag,setBag]=useState<any[]>([]);          // 자리에서 받은 것
  const bagRef=useRef<any[]>([]); bagRef.current=bag;
  const [met,setMet]=useState<string[]>([]);       // 다녀온 자리 — 지도가 열리는 근거
  const [groupOn,setGroupOn]=useState(false);      // 단톡방은 민현이 나중에 판다
  const [groupNew,setGroupNew]=useState(false);
  const [ask,setAsk]=useState<string|null>(null);  // 지도에서 고른 자리
  const [askWho,setAskWho]=useState<string|null>(null);
  const [leaving,setLeaving]=useState<any>(null);  // 나가기 확인
  const [way,setWay]=useState<any>(null);          // 밤 귀갓길 제안
  const [plate,setPlate]=useState<any>(null);      // 사물함 명패
  const [look,setLook]=useState<any>(null);        // 교실 문틈
  const viewRef=useRef(view); viewRef.current=view;
  /* 실습 남은 날. 교생은 한 달 뒤에 떠난다 — 첫 대화한 날을 D-30으로 잡고
     하루씩 깎는다. 0이 되면 거기서 멈춘다. 웹도 같은 식으로 센다. */
  const firstTs=Object.values(msgs).flat().reduce((a:number,m:any)=>!a||m.created_at<a?m.created_at:a,0);
  const dLeft=firstTs?Math.max(0,ENROLL_DAYS-Math.floor((Date.now()-firstTs)/864e5)):ENROLL_DAYS;
  /* 웹과 같은 두 시계. 앱에는 아직 모드를 고르는 자리가 없어서 늘 real이지만,
     배선은 같이 해둔다 — speedOn만 켜지고 setSpeedDay를 안 부르면 dayKey가
     「s0」에 얼어붙어 선물도 자리도 영영 하루치로 잠긴다. */
  const dayN=speedOn()?speedDaysOf({msgs}):(firstTs?Math.floor((Date.now()-firstTs)/864e5):0);
  setSpeedAt(speedCountOf({msgs}),firstTs);
  /* 떠난 뒤에 유저가 다시 말을 걸었나. 떠나는 날 이후의 유저 발화가 있으면
     그건 재회다. 새로 저장할 상태가 없다 — 이미 있는 시각으로 판정된다.
     웹의 cameBack과 같은 식이다. */
  const cameBack=firstTs
    ? Object.values(msgs).flat().some((m:any)=>m.sender==='user'
        && m.created_at>=firstTs+ENROLL_DAYS*864e5)
    : false;

  const reload=useCallback(async(room?:string)=>{
    const rooms = room?[room]:['jaeeon','minhyun','group','health'];
    const next:Record<string,Msg[]>={};
    for(const r of rooms) next[r]=await getMsgs(r);
    setMsgs(prev=>({...prev,...next}));
  },[]);

  useEffect(()=>{(async()=>{
    await initDB();
    /* 규칙 파일이 읽는 localStorage를 저장소에서 한 번에 채운다. 이걸 안 하면
       규칙이 전부 「저장된 게 없다」로 읽는다 — 가방도 다녀온 자리도 없는
       첫날처럼 보인다. 화면을 그리기 전에 끝나야 한다. */
    await hydrateShim();
    /* 규칙이 들고 있는 것들을 화면 쪽으로 한 번 옮겨 온다. 저장은 계속
       규칙 파일이 하고(웹과 같은 열쇠), 화면은 그 사본을 그린다. */
    setScene(loadScene()); setBag(loadBag()); setMet(loadMet()); setGroupOn(loadGroupOn());
    const n=await getMeta('user_name');
    const p=await getMeta('null_profile');
    if(p){try{setProfile(JSON.parse(p))}catch{}}
    const u=await getMeta('null_unlocked');
    if(u){try{setUnlocked(JSON.parse(u))}catch{}}
    setGifts(await loadGifts());
    setSeenStage(await loadSeenStage());
    const a=await getMeta('null_auto_at');
    if(a) setAutoAt(Number(a)||0);
    if(n){ setName(n); await reload(); } else setName('');
    setReady(true);
  })()},[]);

  /* 토스트 자동 사라짐 */
  useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(null),1400); return ()=>clearTimeout(t); },[toast]);

  /* ── 접어둔 자리는 시간에 맞춰 끝난다 ──
     X는 나가기가 아니라 접어두기다. 유효기간이 없으면 낮에 보건실을 접어두고
     저녁에 열어도 아직 보건실에 앉아 있다 — 재언은 다섯 시에 퇴근하는데.
     말이 끊긴 지 한 시간이거나 그 자리의 때가 지났으면 끝난 걸로 친다.
     답이 오는 중이면 건너뛴다 — place_over 처리기가 말풍선 뒤에 알아서 닫는다.
     자는 시간에 끝난 자리는 인사를 안 부른다. 점은 「자는 중」인데 지금 시각
     말풍선이 오면 그게 처음 고치려던 그림이다. */
  const expireScene=useCallback(async()=>{
    const sc=sceneRef.current;
    if(!sc||typing) return;
    if(!sceneExpired(sc,msgsForFlow())) return;
    closeScene();
    await sysLine(sc.room, sc.place===WAY?'집에 도착했다':`${sc.place}에서 나왔다`);
    const pr=presence(sc.room);
    if(pr&&pr.s==='off') return;
    await runTurn(sc.room, sc.place);
  },[msgs,typing]);
  useEffect(()=>{ if(ready&&name&&!enrolling) expireScene(); },[ready,name,enrolling,view.type]);

  /* ── 첫 자리 ──
     한 마디도 오간 적이 없으면 인사로 시작하지 않는다. 자리에서 시작한다.
     앱을 처음 켠 시각이 그 자리를 정하고, 거기 있는 사람을 만난다.
     다른 한 사람은 평소대로 첫인사를 보낸다 — 새벽이면 재언은 안 온다. */
  const openedRef=useRef(false);
  useEffect(()=>{
    if(!ready||!name||enrolling||openedRef.current) return;
    if(['jaeeon','minhyun','group','health'].some(r=>((msgs as any)[r]||[]).length)) return;
    openedRef.current=true;
    (async()=>{
      const o=openingNow();
      /* 도장도 같이 찍는다 — 해금 목록에만 넣던 때는 오늘 도장이 안 찍혀서,
         빨래방에서 시작한 날 지도의 빨래방이 그대로 열려 있었다. 시작한
         자리도 다녀온 자리다. 하루에 한 번은 여기에도 걸린다. */
      if(PLACE_BY[o.place]){ const nm=met.includes(o.place)?met:[...met,o.place]; setMet(nm); saveMet(nm); stampGone(o.place); }
      await sysLine(o.room,o.note);
      const shot=sceneShot(o.place,o.room);
      if(shot)stampShot(shot);
      putScene({room:o.room,place:o.place,since:Date.now(),...(o.bg?{bg:o.bg}:{}),...(shot?{shot}:{})});
      setView({type:'chat',id:o.room});
      await runTurn(o.room);
      /* 다른 한 사람은 첫인사를 보낸다. 여기서 직접 건다 — 추첨에 맡기면
         자리 쪽 상태가 아직 안 앉아서 두 방이 다 비어 보이고, 자리에서 만난
         사람이 뽑혀 조용히 삼켜진다. */
      const other=o.room==='jaeeon'?'minhyun':'jaeeon';
      if(canGreet(other)){ greetAtRef.current=Date.now();
        setTimeout(()=>greet(other,0),2600+Math.random()*2600); }
    })();
  },[ready,name,enrolling,msgs]);

  /* 민현이 「삼촌도 유저를 알고, 유저도 삼촌을 안다」를 알게 되는 순간.
     그가 방을 파고 유저를 부른다. 왜 불렀는지는 말해주지 않는다. */
  useEffect(()=>{
    if(!ready||!name||groupOn) return;
    if(!groupReady(msgsForFlow())) return;
    saveGroupOn(); setGroupOn(true);
    if(!((msgs as any).group||[]).length) setGroupNew(true);
  },[ready,name,groupOn,msgs]);
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
    if(data?.invite?.place) setInvite(data.invite);
    if(Array.isArray(data?.unlocked)){
      setUnlocked(prev=>{
        const merged=Array.from(new Set([...prev,...data.unlocked]));
        if(merged.length!==prev.length){
          setMeta('null_unlocked',JSON.stringify(merged));
          const add=data.unlocked.find((k:string)=>!prev.includes(k));
          const label=HIDDEN.find(h=>h.key===add)?.label;
          if(label){ setToast('✧ .hidden — '+label); markEvent({kind:'unlock', name:label}); }
        }
        return merged;
      });
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

  /* 지나간 일로 넣는다. 타이핑 연출도 없다 — 지금 오는 말이 아니라
     이미 오갔던 말이라서 한 번에 얹혀 있어야 한다. */
  const enqueuePast = async (room:string, list:any[], baseTs:number) => {
    let t=baseTs;
    for(const m of list){
      await insertMsg({ room, sender:m.sender||room, text:m.text||'', photo:m.photo||null, created_at:t });
      t += 40000+Math.floor(Math.random()*80000);   // 40~120초 간격
    }
    await reload(room);
    if(viewRef.current.id!==room) setUnread(u=>({...u,[room]:(u[room]||0)+list.length}));
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
    /* 물건은 손에서 손으로 간다. 문자로는 못 준다 — 재언이 직접 말했다.
       「말로 주는 CD가 어딨어요. 지금 손에 든 거예요?」 */
    const sc0=sceneRef.current;
    if(!sc0||sc0.room!==char){ setToast('만나서 줘요 ♡'); return; }
    /* 한 사람에게 하루에 하나. 새벽 2시 43분에 이어폰, 2시 48분에 사진집을
       줬더니 같은 사람이 오 분 만에 같은 반응을 두 번 했다 — 한 번이면 그
       사람이고 두 번이면 틀이다. 막는 건 한 사람이 두 번 받는 것이지
       하루에 두 명에게 주는 게 아니다. */
    if(giftedToday(char)){ setToast(`${CHARS[char].name} — one a day ♡`); return; }
    stampGift(char);
    const next={...gifts,[char]:[...have,gift.key]};
    setGifts(next); await saveGifts(next);
    const note=(memo||'').trim().slice(0,60);
    const line=`${CHARS[char].name}이 ${gift.name}을(를) 받았다`+(note?` — \u201c${note}\u201d`:'');
    await insertMsg({room:char,sender:'sys',text:line,created_at:Date.now()});
    await reload(char);
    setToast(`${CHARS[char].name} — ${gift.name}`);
    await markEvent({kind:'gift', to:char, name:gift.name});
    setFailed(null); setTyping(true);
    if(demoOn()){ setTyping(false); await enqueue(char,demoReply(char,line,name,gift.key)); return; }
    try{
      const hist=await getMsgs(char);
      const data=await sendChat(char,name,hist,{gift:{key:gift.key,name:gift.name,note},
        bag:bagOut(bag),
        ...(sceneRef.current&&sceneRef.current.room===char
          ?{place:sceneRef.current.place}:{})});
      setTyping(false);
      await applyExtras(data);
      if(data.messages?.length) await enqueue(char,data.messages);
      logUsage(data); rollLater(char);
    }catch(e:any){ setTyping(false); await fallToDemo(e,char,line,gift.key); }
  };

  /* 실측. 내 짐작이 아니라 진짜 토큰 수다. 읽음이 계속 0이면 캐시가 안 맞고
     있다는 뜻인데, 그건 오류를 안 내고 조용히 정가를 문다 */
  const logUsage=(d:any)=>{ const u=d&&d.usage; if(!u)return;
    console.log(`[NULL] 토큰 — 새로 ${u.input_tokens||0} · 캐시 씀 ${u.cache_creation_input_tokens||0}`
      + ` · 캐시 읽음 ${u.cache_read_input_tokens||0} · 출력 ${u.output_tokens||0}`); };
  /* 요약 갱신은 답장이 다 뜬 뒤에 뒤에서 돈다. 한 번에 하나만 */
  const summingRef=useRef<Record<string,boolean>>({});
  const rollLater=(room:string)=>{
    if(demoOn()||summingRef.current[room])return;
    summingRef.current[room]=true;
    setTimeout(async()=>{
      try{ if(await rollSummary(room,name)) console.log('[NULL] 요약 갱신 '+room); }
      catch(e){ console.warn('[NULL] 요약 실패 — 다음 턴에 다시', e); }
      summingRef.current[room]=false;
    },1200);
  };

  /* 서버가 안 되면 각본으로 넘어간다. 한 번 넘어가면 그 뒤로는 계속 데모다 —
     한 대화 안에서 진짜와 각본이 섞이면 어느 쪽이 고장인지 알 수가 없다.
     실패한 진짜 이유는 콘솔에 그대로 남긴다. */
  const fallToDemo = async(e:any, room:string, lastText?:string, gift?:string|null)=>{
    console.error('[NULL] 서버 호출 실패 → 데모로 전환', e);
    DEMO.auto=true; setDemo(true); setFailed(null);
    await enqueue(room, demoReply(room,lastText,name,gift));
  };

  /* 보낸 말은 이미 저장돼 있다. 모델 호출만 다시 한다 —
     재시도해도 같은 말이 두 번 쌓이지 않는다. */
  const runTurn = async(room:string, left?:string)=>{
    if(!name) return;
    setFailed(null); setTyping(true);
    const ls=lastSent.current;
    const said=ls&&ls.room===room?ls.text:undefined;   // 각본을 고를 때만 쓴다
    if(demoOn()){ setTyping(false); await enqueue(room,demoReply(room,said,name)); return; }
    /* 자는 사람은 답이 없다 — 웹 app.js의 request와 같은 자리, 같은 시계다.
       마주 앉아 있을 때는 안 본다: 눈앞의 사람이 자고 있으면 그건 자리가
       닫힐 일이지 답이 없을 일이 아니다. 지문을 한 줄 남긴다 — 아무것도 안
       뜨면 보낸 사람은 고장으로 읽는다. 같은 줄을 연달아 쌓지는 않는다. */
    const sc0=sceneRef.current;
    if(!(sc0&&sc0.room===room)&&allAsleep(room)){
      setTyping(false);
      const who=room==='group'?null:CHARS[room];
      const line=who?`${jos(who.name,'은/는')} 자고 있다`:'둘 다 자고 있다';
      const ms=await getMsgs(room);
      const last=ms[ms.length-1];
      if(!(last&&last.sender==='sys'&&last.text===line)) await sysLine(room,line);
      return;
    }
    try{
      const hist=await getMsgs(room);
      /* 마주 앉은 자리면 어디인지 같이 보낸다. 안 보내면 같은 자리에 앉아서
         「지금 어디예요?」를 묻는다 — 화면만 바뀌고 사람은 안 바뀐 꼴이다.
         자리의 때가 지났으면(문 닫을 시각·잘 시각) 그것도 같이 보낸다 —
         인물이 이번 대답에서 매듭짓고 일어선다. */
      const sc=sceneRef.current;
      const at=sc&&sc.room===room?sc.place:null;
      /* left는 자리를 닫고 나서 부르는 턴에만 온다. place와 같이 오지 않는다 —
         워커도 place가 없을 때만 본다. */
      const data=await sendChat(room,name,hist,{bag:bagOut(bag),
        ...(at?{place:at,...(sc.came?{came:sc.came}:{}),...(placeOverNow(sc)?{placeOver:true}:{})}:(left?{left}:{}))});
      setTyping(false);
      await applyExtras(data);
      if(data.messages?.length) await enqueue(room,data.messages);
      logUsage(data); rollLater(room);
    }catch(e:any){ setTyping(false); await fallToDemo(e,room,said); }
  };

  const handleRetry = ()=>{
    const last=lastSent.current;
    const room=(viewRef.current.type==='chat'&&viewRef.current.id)||last?.room;
    if(room) runTurn(room);
  };

  const handleAuto = async()=>{
    if(!name||autoLoading) return;
    /* 이쪽은 지금 벌어지는 일로 찍힌다. 한 사람이라도 자고 있으면 만들 대화가
       없다 — 부르지도 않는다. 눌렀는데 아무 일이 없으면 고장으로 보이니 한 줄 띄운다.
       쿨타임을 깎기 전에 본다 — 누르지도 못한 관전에 시계가 돌면 안 된다 */
    if(!bothAwake()){
      /* 조건은 bothAwake — 한 명만 자도 막힌다. 그런데 말은 「둘 다 자요」였다.
         새벽 두 시엔 재언만 자고 민현은 세 시까지 깨 있는데, 목록에 「안 자는
         중」이라고 떠 있는 사람을 두고 둘 다 잔다고 하면 그 점이 거짓말이 된다. */
      const zz=(['jaeeon','minhyun'] as const).filter(id=>asleep(id));
      setToast(zz.length>1?'지금은 둘 다 자요 ♡'
        :`지금은 ${jos(CHARS[zz[0]].name,'이/가')} 자요 ♡`);
      return;
    }
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

  /* 선물이나 해금이 있으면 그 일을 적어둔다. 바로 만들지는 않는다 —
     유저가 자리를 비운 지 한 시간이 지나 다시 들어왔을 때 만든다.
     원문은 여전히 서버로 안 간다. 무슨 물건을 줬는지만 알려주고, 무슨 말이
     오갔는지는 프롬프트에서 못박아 막는다. */
  /* 같이 가자는 제안이 오면 답을 받는다. 수락하면 그 자리에 다녀온 것이 되고,
     한 시간 뒤 관전방에서 다른 한 사람이 그 얘기를 꺼낸다. 거절하면 안 간다 —
     그리고 그 자리는 다시 안 나온다. 두 번 조르지 않는 것이 이 두 사람의 성격이다. */
  const answerInvite = async(ok:boolean)=>{
    const iv=invite; setInvite(null); if(!iv) return;
    const key=ok?'null_met':'null_refused';
    let arr:string[]=[]; try{ arr=JSON.parse((await getMeta(key))||'[]') }catch{}
    await setMeta(key, JSON.stringify([...arr, iv.place]));
    const line=ok?`${CHARS[iv.char].name}과 ${iv.place}에 가기로 했다`:`${iv.place}은 다음에 가기로 했다`;
    await insertMsg({room:iv.char,sender:'sys',text:line,created_at:Date.now()});
    await reload(iv.char);
    if(ok) await markEvent({kind:'met', to:iv.char, name:iv.place});
    /* 답을 했으면 상대도 답을 해야 한다. 전에는 여기서 끝이었다 — 가자고
       해놓고 갈게요 했더니 아무 말도 없이 대화가 멈췄다. 그 자리 얘기는 한
       시간 뒤 관전방에서나 나왔고, 정작 같이 가기로 한 사람은 입을 다물고
       있었다. 승낙이든 거절이든 반응이 있어야 사람이다. */
    lastSent.current={room:iv.char,text:line};
    await runTurn(iv.char);
  };

  const markEvent = async(ev:any)=>{
    try{ await setMeta('null_auto_event', JSON.stringify({...ev, at:Date.now()})); }catch{}
  };
  /* 유저가 아무것도 안 눌러도 생기는 사건 둘.
     ① 재언에게 사진이 다섯 장 넘게 오면 — 민현이는 그 사진을 못 본다.
        찍는 것만 봤다. 그래서 묻는 쪽이 된다.
     ② 떠날 날이 7·3·1일 남는 날 — 둘 다 알지만 이름을 먼저 안 붙인다.
     찍어만 두고 만들지는 않는다. 한 시간 뒤 아래 효과가 가져간다. */
  const evBusy=useRef(false);
  useEffect(()=>{
    if(!ready||!name||enrolling||evBusy.current) return;
    (async()=>{
      evBusy.current=true;
      try{
        let done:string[]=[];
        try{ done=JSON.parse((await getMeta('null_ev_done'))||'[]') }catch{}
        const mark=async(key:string, ev:any)=>{
          if(done.includes(key)) return false;
          await setMeta('null_ev_done', JSON.stringify([...done,key]));
          await markEvent(ev); return true;
        };
        const shots=((msgs as any).jaeeon||[]).filter((m:any)=>m.photo&&m.sender!=='user').length;
        if(shots>=PHOTO_EVENT_AT&&await mark('photos',{kind:'photos',to:'jaeeon'})) return;
        const all=Object.values(msgs).flat() as any[];
        const firstTs=all.reduce((a,m)=>!a||m.created_at<a?m.created_at:a,0);
        if(!firstTs) return;
        const d=Math.max(0,ENROLL_DAYS-Math.floor((Date.now()-firstTs)/864e5));
        if(DDAY_MARKS.includes(d)) await mark('dday:'+d,{kind:'dday',name:String(d)});
      }finally{ evBusy.current=false }
    })();
  },[ready,name,enrolling,view,msgs]);

  const autoBusy=useRef(false);
  useEffect(()=>{
    if(!ready||!name||enrolling||autoBusy.current) return;
    /* 목록에서도 돌고 관전방을 열 때도 돈다. 방을 열었는데 늘 같은 화면이면
       그 방은 죽은 방이다 — 유저 없이도 돌아간다는 게 이 앱의 전제인데
       정작 그 방만 유저가 뭘 해야 움직이고 있었다. */
    if(view.type!=='list'&&!(view.type==='chat'&&view.id==='health')) return;
    (async()=>{
      /* 사건이 있으면 그 일을 두고 얘기하고, 없으면 그냥 둘이 떠든다.
         전에는 사건이 없으면 아무것도 안 만들었다 — 선물도 안 주고 자리도
         안 간 사람에게는 관전방이 영영 첫 장면 그대로였다. */
      let ev:any=null;
      const raw=await getMeta('null_auto_event');
      if(raw){ try{ ev=JSON.parse(raw) }catch{ ev=null } }
      if(ev&&!ev.kind) ev=null;
      // 마지막으로 뭐라도 한 시각. 그때로부터 한 시간은 지나야 "없는 자리"가 된다
      const all=Object.values(msgs).flat() as any[];
      const lastAny=all.reduce((a,m)=>m.created_at>a?m.created_at:a,(ev&&ev.at)||0);
      const now=Date.now();
      /* 아직 아무 일도 없었으면 비운 자리도 없다. 이걸 안 막으면 lastAny가 0이라
         「한 시간 뒤」가 1970년 1월 1일 한 시간 뒤가 된다 — 웹에서 실제로 첫
         실행에 관전 대화가 1970년으로 찍혔고, 그게 이 판의 첫 대화가 돼서
         D-0 종료 화면이 첫날에 떴다. */
      if(!lastAny) return;
      if(now-lastAny<AUTO_AWAY) return;
      // 유저가 나가고 한 시간쯤 뒤의 일로 찍는다
      const at=Math.min(lastAny+AUTO_AWAY+Math.floor(Math.random()*30*60*1000), now-5*60*1000);
      /* 그 시각에 둘 다 깨어 있었어야 한다. 재언이 자는데 「두 사람」방에서는
         떠들고 있었다 — 목록에 「자는 중」이 떠 있는 사람이 옆방에서 말을 하면
         그 점이 거짓말이 된다. 지금이 아니라 찍힐 시각(at)으로 잰다.
         하루 몫을 깎기 전에 본다 — 순서가 반대면 만들지도 못한 대화에 몫만
         나가고, 적어둔 사건(선물)까지 같이 지워진다. */
      if(!bothAwake(new Date(at))) return;
      /* 하루 경계는 여기서도 새벽 다섯 시다. UTC 날짜로 세면 아침 아홉 시에
         상한이 리셋돼 한 하루에 네 번이 돈다 — 제일 비싼 호출인데 */
      const day=dayKey();
      const [d,n]=((await getMeta('null_auto_day'))||'').split('|');
      const used=d===day?Number(n)||0:0;
      if(used>=AUTO_MAX_DAY){ await setMeta('null_auto_event',''); return; }
      autoBusy.current=true;
      await setMeta('null_auto_event','');
      await setMeta('null_auto_day',`${day}|${used+1}`);
      await setMeta('null_auto_at',String(now)); setAutoAt(now);
      try{
        /* 실패해서 넘어간 데모(DEMO.auto)는 여기서 안 본다 — 그걸 보면 한 번의
           실패 뒤 관전 생성이 진짜를 시도조차 않고 적어둔 사건을 각본에
           삼킨다. 이 경로는 진짜 요청을 안 하니 래치가 풀릴 길도 없었다. */
        const data=await genAuto(name,ev?{kind:ev.kind,to:ev.to,name:ev.name}:undefined);
        await applyExtras(data);
        if(data.messages?.length) await enqueuePast('health',data.messages,at);
      }catch(e:any){ /* 조용히 넘어간다. 유저가 부른 적 없는 호출이라 실패를 알릴 이유가 없다 */ }
      autoBusy.current=false;
    })();
  },[ready,name,enrolling,view,msgs]);

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
    /* greetAtRef도 같이 지운다 — ref라 DB를 비워도 안 없어진다.
       방금 선톡을 받고 지웠으면 1분 동안 첫 인사가 안 왔다. */
    /* 저장소를 비웠으면 규칙이 보고 있는 메모리도 같이 비운다 — 안 비우면
       지운 값이 화면에 남아 있다가 다음 저장 때 도로 써진다(웹에서 겪었다) */
    await clearAll(); resetShim(); greetAtRef.current=0; summingRef.current={};
    setName(''); setMsgs({}); setUnread({}); setProfile({}); setUnlocked([]); setGifts({}); setSeenStage({});
    lastSent.current=null; setAutoAt(0); setStamp(x=>x+1); setPopup(null); setView({type:'list'});
  };

  /* 방별 누적 수와 받은 사진은 이미 들고 있는 msgs에서 뽑는다 — 따로 저장하지 않는다 */
  const counts:Record<string,number>={};
  ['jaeeon','minhyun','group','health'].forEach(r=>{counts[r]=(msgs[r]||[]).length});
  /* 받은 사진 + 자리에서 본 사진. 웹과 같은 함수를 쓴다 — 손으로 두 판을
     만들면 반드시 어긋난다 */
  const album=seenPhotos(msgs);

  /* 캐릭터가 먼저 건다. 방을 열었는데 아무 말도 없으면 그건 메신저가 아니라
     빈 상자다. 처음 들어왔거나 한참 만에 들어왔을 때만 한 번.

     전에는 데모 전용이었다 — 키가 살아 있으면 아무도 먼저 말을 걸지 않았다.
     지금은 항상 온다.

     문장은 문구집의 「도착 선톡」에서 고른다. 공백에 따라 갈래가 다르다 —
     처음이면 고른 다섯 개, 평소면 스무 개, 하루를 넘겼으면 늦었다는 말이
     들어 있는 여섯 개다. 십 분 만에 들어온 사람한테 「이제 와요?」는 안 한다. */
  /* 「왔어요」는 금지다. 유저가 방금 앱을 연 것을 인물은 모른다 — 알면
     인사가 아니라 감시 카메라다. 이 선톡은 조용한 방에 대고 보내는 말이다.
     웹의 GREET_ASK와 글자 그대로 같아야 한다 — 두 곳에서 다른 말을 시키면
     같은 인물이 두 앱에서 다르게 군다. */
  const GREET_ASK="(유저는 한동안 말이 없다. 지금이 언제인지와 네 상황에 맞춰 네가 먼저 한두 마디를 건다 — 안부든, 지금 하고 있는 것이든. 유저가 방금 접속했는지 너는 모른다. 「왔어요」처럼 상대가 온 걸 아는 말은 하지 않는다.)";
  const greet=async(id:string,delay:number)=>{
    if(id==='health'||id==='group'||!name)return;
    /* 자는 사람은 먼저 말을 안 건다. 목록의 점을 정하는 함수가 선톡도 정한다 —
       점은 「꺼짐」인데 그 사람 말풍선이 오면 그게 제일 이상하다 */
    if(!canGreet(id))return;
    /* 같이 있는 사람은 선톡을 안 한다 — 눈앞에 있는데 문자가 오면 이상하다 */
    if(sceneRef.current&&sceneRef.current.room===id)return;
    const list:any[]=(msgs as any)[id]||[];
    const gapMin=list.length?Math.round((Date.now()-list[list.length-1].created_at)/60000):-1;
    if(gapMin>=0&&gapMin<180)return;
    if(delay) await new Promise(r=>setTimeout(r,delay));
    /* 첫인사(기록 없는 방)는 문구집 각본이다 — 세계관이 열리는 자리라 문장을
       고정한다. 그 뒤의 선톡은 모델이 쓴다. 각본 스무 개는 아침이든 새벽이든
       같은 스무 개였다 — 낮에는 수업, 저녁에는 퇴근, 새벽에는 안 자냐는 말이
       나와야 한다. 때와 자기 상태는 [지금] 줄이 이미 아니까 먼저 걸라는
       지시 한 줄만 얹으면 된다. 지시는 저장하지 않는다 — 답장만 남는 게 맞다. */
    if(gapMin>=0&&!DEMO.auto){
      greetAtRef.current=Date.now();
      try{
        const hist=[...(await getMsgs(id)), {room:id,sender:'user',text:GREET_ASK,created_at:Date.now()} as any];
        const data=await sendChat(id,name,hist,{greet:true});
        /* 답이 오는 사이 그 사람 자리에 들어갔으면 버린다 — 눈앞에 앉은
           사람이 보낸 원격 안부 문자가 도착하면 그게 처음 막으려던 그림이다 */
        if(sceneRef.current&&sceneRef.current.room===id)return;
        if(data?.messages?.length) await enqueue(id,data.messages);
        return;
      }catch{ /* 실패하면 아래 각본으로 메운다 */ }
    }
    const lines=demoProactive(id,demoGreetWhen(gapMin,id),name);
    if(lines.length) await enqueue(id,lines);
  };
  /* 선톡은 방을 열어야 오는 게 아니다. 안 보고 있을 때 오는 것이 메신저다 —
     목록에 있는 동안 말이 도착하고 안 읽음이 붙는다.

     한 번에 한 사람만 건다. 두 사람이 같은 초에 말을 걸면 그건 사람이 아니라
     알림이다. 제일 오래 조용했던 쪽이 먼저 건다.

     방을 열 때(demoGreet)와 조건이 같아서 둘이 겹치지 않는다 — 한쪽이 말을
     걸면 간격이 0이 되므로 다른 쪽은 안 걸린다. 목록을 떠나면 예약도 취소된다. */
  const greetAtRef=useRef(0);
  useEffect(()=>{
    if(!name||view.type!=='list')return;
    if(Date.now()-greetAtRef.current<60000)return;   // 목록을 들락거려도 연달아 오지 않게
    const cand=['jaeeon','minhyun'].map(id=>{
      const l:any[]=(msgs as any)[id]||[];
      return {id,gap:l.length?(Date.now()-l[l.length-1].created_at)/60000:-1};
    }).filter(c=>c.gap<0||c.gap>=180)
      .sort((a,b)=>(b.gap<0?1e9:b.gap)-(a.gap<0?1e9:a.gap))[0];
    if(!cand)return;
    greetAtRef.current=Date.now();
    let live=true;
    const t=setTimeout(()=>{ if(live) greet(cand.id,0); },1600+Math.random()*2600);
    return()=>{live=false;clearTimeout(t)};
  },[name,view,msgs,demo]);
  useEffect(()=>{ Object.keys(msgs).forEach(k=>{ demoCount[k]=((msgs as any)[k]||[]).length }) },[msgs]);
  /* 해금은 원래 서버가 세어서 내려준다. 데모에는 서버가 없으니 같은 기준으로
     여기서 센다 — 안 그러면 .hidden이 영영 0/12로 남는다. */
  useEffect(()=>{ if(!demoOn())return;
    const got=HIDDEN.filter(h=>(((msgs as any)[h.room]||[]).length)>=h.at&&dayN>=h.day).map(h=>h.key);
    if(got.length) applyExtras({ unlocked:got });
  },[msgs,demo]);
  /* 「두 사람」 방을 처음 열었는데 비어 있으면 이 방이 무슨 방인지 알 길이 없다.
     화면에 삼촌과 조카라고 적어주는 건 설명이지 이야기가 아니다 — 둘이 떠드는
     걸 한 번 보여준다. 첫 줄이 「삼촌,」으로 시작한다. */
  const seedWatch=async()=>{
    if(((msgs as any).health||[]).length)return;
    try{
      const lines=demoWatchOpen(name);
      if(lines.length){ await new Promise(r=>setTimeout(r,450)); await enqueue('health',lines); }
    }catch(e){ console.warn('[NULL] 첫 장면 실패', e); }
  };
  const openRoom=(id:string)=>{ setView({type:'chat',id}); setFailed(null); setUnread(u=>({...u,[id]:0}));
    if(id==='health') seedWatch(); else greet(id,700); };

  /* ── 자리에 가고, 옮기고, 나온다 ──
     판단은 lib/flow.ts가 한다(웹 app.js와 같은 사다리). 여기서는 그 판단대로
     저장하고 지문을 남기고 요청을 보낸다. 규칙을 여기서 다시 쓰지 않는다 —
     두 군데에 적히면 어긋나고, 어긋나면 뒤에 오는 쪽이 이긴다. */
  const msgsForFlow=()=>{
    const out:any={};
    Object.entries(msgs).forEach(([k,v]:any)=>{ out[k]=(v||[]).map((m:any)=>({...m,ts:m.created_at})) });
    return out;
  };
  const sysLine=async(room:string,text:string)=>{
    await insertMsg({room,sender:'sys',text,created_at:Date.now()});
    await reload(room);
  };
  /* 자리를 떠난다. 말을 나눈 자리면 두고 온 것을 챙긴다 — 모델이 안 건네고
     끝내는 턴이 있는데, 그때마다 가방이 비면 지도를 도는 이유가 사라진다. */
  const closeScene=()=>{
    const sc=sceneRef.current;
    if(sc&&talkedEnough(sc,msgsForFlow())){
      const p=PLACE_BY[sc.place];
      if(p&&p.item&&!bagRef.current.some((b:any)=>b.key===p.item)){
        const next=[...bagRef.current,{key:p.item,from:sc.room,where:sc.place,ts:Date.now()}];
        setBag(next); saveBag(next);
        const it=ITEMS[p.item];
        if(it){ sysLine(sc.room,`${CHARS[sc.room].name}에게 ${jos(it.name,'을/를')} 받았다`);
          setToast(`bag — ${it.name}`); }
      }
    }
    putScene(null);
  };
  const goPlace=async(place:string,who:string,note?:string,came?:string)=>{
    if(!name) return;
    stampGone(place);
    const nextMet=met.includes(place)?met:[...met,place];
    setMet(nextMet); saveMet(nextMet);
    await markEvent({kind:'met',to:who,name:place});
    if(sceneRef.current) closeScene();
    await sysLine(who,note||`${place}에 갔다`);
    const shot=sceneShot(place,who);
    if(shot)stampShot(shot);
    putScene({room:who,place,since:Date.now(),...(shot?{shot}:{}),...(came?{came}:{})});
    setView({type:'chat',id:who}); setUnread(u=>({...u,[who]:0}));
    await runTurn(who);
  };
  const answerAsk=async(ok:boolean)=>{
    const place=ask, picked=askWho; setAsk(null); setAskWho(null);
    if(!ok||!place) return;
    const st=askState(place,{scene,met,msgs:msgsForFlow(),picked});
    if(st.no) return;
    const who=whoAt(PLACE_BY[place],picked,msgsForFlow());
    const p=PLACE_BY[place];
    if(who) await goPlace(place,who,
      p&&p.pick?`${jos(CHARS[who].name,'과/와')} ${place}에 갔다`:undefined,
      p&&p.pick?'asked':undefined);
  };
  /* 같이 있다가 발길 닿는 이동. 떠나는 자리를 먼저 정리한다 */
  const answerMove=async(ok:boolean)=>{
    const place=ask; setAsk(null); setAskWho(null);
    const sc=sceneRef.current;
    if(!ok||!place||!sc) return;
    const st=askState(place,{scene:sc,met,msgs:msgsForFlow()});
    if(!st.mv) return;
    await goPlace(place,sc.room,`${jos(place,'으로/로')} 같이 자리를 옮겼다`,'asked');
  };
  const answerLeave=async(ok:boolean)=>{
    const sc=leaving; setLeaving(null);
    if(!ok||!sc) return;
    /* 창이 떠 있는 사이 자리가 이미 닫혔을 수 있다 — 죽은 자리로 진행하면
       「나왔다」 지문과 작별 요청이 두 벌 나간다 */
    const cur=sceneRef.current; if(!cur||cur.since!==sc.since) return;
    closeScene();
    await sysLine(sc.room, sc.place===WAY?'집에 도착했다':`${sc.place}에서 나왔다`);
    await runTurn(sc.room, sc.place);
    /* 나온 뒤에 밤이면 데려다준다. 인사와 겹치지 않게 창을 이어서 띄운다 */
    if(sc.place!==WAY&&talkedEnough(sc,msgsForFlow())&&wayOK()&&loadWay()!==dayKey()) setWay(sc);
  };
  const answerWay=async(ok:boolean)=>{
    const sc=way; setWay(null); if(!sc) return;
    if(sceneRef.current&&sceneRef.current.since===sc.since) closeScene();
    if(!ok) return;
    saveWay(dayKey());
    const who=sc.room, nm=CHARS[who].name;
    await sysLine(who, who==='jaeeon'?`${nm}의 차를 타고 집에 가는 길이다`
                                     :`${jos(nm,'과/와')} 같이 버스를 타고 집에 가는 길이다`);
    putScene({room:who,place:WAY,since:Date.now(),bg:WAY_BG[who]});
    setView({type:'chat',id:who});
    await runTurn(who);
  };
  /* 프로필을 열어보면 그 단계를 본 것으로 찍는다 — 목록의 표시가 그때 꺼진다.
     방을 여는 걸로는 안 꺼진다. 바뀐 건 대화가 아니라 프로필이니까. */
  const openProfile=(c:string)=>{
    setView({type:'profile',id:c});
    if(!CHARS[c])return;
    const at=stageIdx(counts[c]||0,dayN);
    setSeenStage(s=>{const n={...s,[c]:at}; saveSeenStage(n); return n});
  };

  // 오프닝은 폰트가 올라온 뒤에 그린다 — 픽셀 폰트가 없으면 로고가 딴 글씨가 된다
  if(!ready||!fontsOk) return <View style={{flex:1,backgroundColor:'#c3b2f0'}}/>;
  if(!name) return <><StatusBar barStyle="dark-content"/>
    <View style={{flex:1,paddingTop:insets.top,paddingBottom:insets.bottom}}>
      <Splash onEnter={handleEnter}/></View></>;

  let screen;
  if(view.type==='profile') screen=<Profile char={view.id!} refresh={stamp} dLeft={dLeft} back={cameBack} days={dayN}
    onBack={()=>setView({type:'list'})}/>;
  else if(view.type==='cart') screen=<CartScreen gifts={gifts} hearts={heartsOf(counts,gifts)}
    onSend={giveGift} onBack={()=>setView({type:'list'})}/>;
  else if(view.type==='chat'){
    const room=ROOMS.find(r=>r.id===view.id)!;
    /* 자리에 있으면 그 자리를 같이 넘긴다. 뒤로가기는 나가기(묻는다)가 되고,
       X는 접기다 — 자리는 살아 있고 다른 사람과 카톡만 할 수 있다.
       하루에 한 번뿐인 자리를 뒤로가기 한 번에 닫으면 실수로 닫힌다. */
    const sc=scene&&scene.room===view.id?scene:null;
    screen=<ChatRoom room={room} msgs={msgs[view.id!]||[]} typing={typing&&view.id!=='health'} failed={failed}
      scene={sc} onLeaveScene={()=>sc&&setLeaving(sc)} onMinimize={()=>setView({type:'list'})}
      onBack={()=>sc?setLeaving(sc):setView({type:'list'})} onSend={handleSend} onRetry={handleRetry}
      onProfile={openProfile}/>;
  } else {
    screen=<RoomList msgs={msgs} unread={unread} unlocked={unlocked} counts={counts} album={album}
      seenStage={seenStage} dayN={dayN} autoAt={autoAt} onOpen={openRoom} onProfile={openProfile}
      onAuto={handleAuto} autoLoading={autoLoading} onMenu={handleMenu} onToast={setToast}
      onCart={()=>setView({type:'cart'})} demo={demo} name={name}
      hearts={heartsOf(counts,gifts)}
      met={met} groupOn={groupOn} onGoPlace={(pl:string)=>{ expireScene(); setAskWho(null); setAsk(pl); }}
      onPlate={setPlate}/>;
  }

  return <>
    <StatusBar barStyle="light-content"/>
    <View style={{flex:1,backgroundColor:P.pink,paddingTop:insets.top,paddingBottom:padBottom}}>
      {screen}</View>
    {/* 같이 가자는 제안. 답하기 전에는 안 닫힌다 — 그냥 지나가면 안 간 것도
        거절한 것도 아니게 돼서 다음 제안이 영영 안 나온다 */}
    <Modal visible={!!invite} transparent animationType="fade" onRequestClose={()=>answerInvite(false)}>
      <View style={mo.bg}>
        <View style={mo.win}>
          <TB colors={['#ff8fbe','#ffb0d4']}>
            <Text style={tbT}>{invite?CHARS[invite.char].name:''}</Text></TB>
          <View style={{padding:18,alignItems:'center'}}>
            <Text style={mo.txt}>{invite?invite.place:''}도 같이 GO?</Text>
            {/* 얼굴은 픽셀 글꼴에 글자가 없어서 시스템 글꼴로 따로 그린다 */}
            <Text style={mo.sub}>같이 갈 사람은 Who? <Text style={{fontFamily:undefined}}>ʢ˶ &gt; ₃ &lt; ˶ʡ ➳❤︎</Text></Text>
            <View style={{flexDirection:'row',gap:8,marginTop:18}}>
              <Bevel style={{height:38,minWidth:96}} inner={{paddingHorizontal:16,backgroundColor:'#ffe3f0'}}
                onPress={()=>answerInvite(true)}><Text style={mo.btnT}>같이 GO!</Text></Bevel>
              <Bevel style={{height:38,minWidth:96}} inner={{paddingHorizontal:16}}
                onPress={()=>answerInvite(false)}><Text style={mo.btnT}>LATER...</Text></Bevel>
            </View>
          </View>
        </View>
      </View>
    </Modal>
    {enrolling&&<Enroll name={name} profile={profile} onSaveField={saveProfile}
      mode={mode} onMode={m=>{setMode(m);saveMode(m)}}
      onRename={doRename} onDone={()=>setEnrolling(false)}/>}
    {/* ── 지도와 자리의 창들 ── 판정은 flow.ts, 글월은 웹과 같다 */}
    {ask&&<AskDialog place={ask}
      state={askState(ask,{scene,met,msgs:msgsForFlow(),picked:askWho})}
      picked={askWho} onPickWho={setAskWho}
      onGo={()=>answerAsk(true)} onMove={()=>answerMove(true)}
      onLook={()=>{ setAsk(null); setAskWho(null);
        setLook({shot:['minhyun-window','minhyun-desk'][Math.floor(Math.random()*2)]+'.webp'}); }}
      onClose={()=>{ setAsk(null); setAskWho(null); }}/>}
    {leaving&&<LeaveDialog place={leaving.place}
      onLeave={()=>answerLeave(true)} onStay={()=>answerLeave(false)}/>}
    {way&&<WayDialog room={way.room} onRide={()=>answerWay(true)} onAlone={()=>answerWay(false)}/>}
    {plate&&<PlateDialog say={plate.say} kao={plate.kao} kind={plate.kind} onClose={()=>setPlate(null)}/>}
    {groupNew&&<GroupNewDialog onClose={()=>setGroupNew(false)}/>}
    {look&&<LookOverlay shot={look.shot} onClose={()=>setLook(null)}/>}
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
                <View style={mo.etcStk}>
                  {['✿','★','♡','✧','☾'].map((x,i)=>
                    <Text key={i} style={[mo.etcStkT,{color:['#ff9ec6','#ffd68a','#c3b2f0','#8fd8e8','#ffb0d4'][i]}]}>{x}</Text>)}
                </View>
                <Bevel style={{marginTop:18,height:34,minWidth:118}} inner={{paddingHorizontal:18,backgroundColor:'#ffe3f0'}}
                  onPress={()=>setPopup('reset')}><Text style={mo.btnT}>restart</Text></Bevel>
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
              </>}
              {/* restart는 프로필에 없다. 이름을 바꾸러 여는 창이라 위험한 버튼이
                  안전한 일 옆에 앉아 있었다. 지금은 etc. 안이다. */}
              {popup==='reset'&&<>
                <Text style={mo.warnW}>전부 처음으로 돌아갑니다</Text>
                {/* 되돌릴 수 없다는 말보다 숫자가 손을 멈춘다. 지우는 건 기록만이
                    아니라 시계와 해금까지다 */}
                <Text style={mo.warnN}>실습 D-{dLeft} · 히든 {unlocked.length}/{HIDDEN.length}
                  {' '}· 나눈 말 {ROOMS.reduce((n:number,r:any)=>n+((msgs as any)[r.id]||[]).length,0)}</Text>
                <View style={{flexDirection:'row',gap:8,marginTop:16}}>
                  {/* 웹에는 취소가 있는데 앱에는 없었다. 실수로 열었을 때 나갈 문이
                      눈에 안 보이는 건 지우기 쉬운 것보다 나쁘다 */}
                  <Bevel style={{height:38,minWidth:96}} inner={{paddingHorizontal:16}}
                    onPress={()=>setPopup('help')}><Text style={mo.btnT}>취소</Text></Bevel>
                  <Bevel style={{height:38,minWidth:110}} inner={{paddingHorizontal:16,backgroundColor:'#ffe3f0'}}
                    onPress={doReset}><Text style={mo.btnT}>erase all</Text></Bevel>
                </View>
              </>}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  </>;
}
const mo=StyleSheet.create({
  sub:{...F,marginTop:9,fontSize:10,letterSpacing:.4,color:'#b09ad4',textAlign:'center'},
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
  /* 지우기 확인. 되돌릴 수 없다는 말은 추상이고 숫자는 구체다 */
  warnW:{...F,marginTop:4,fontSize:12,color:'#c23b50',letterSpacing:.5,textAlign:'center'},
  warnN:{...F,marginTop:9,fontSize:10,lineHeight:17,color:'#b07d92',textAlign:'center'},
  toast:{position:'absolute',left:0,right:0,bottom:70,alignItems:'center'},
  toastT:{...F,fontSize:11,color:'#fff',letterSpacing:1,paddingVertical:9,paddingHorizontal:18,
    backgroundColor:'rgba(43,36,78,.88)',borderRadius:18,overflow:'hidden'},
});
