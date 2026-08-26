// @ts-nocheck
/* ── 캐비닛 지도 ──
   웹 app-ui.js의 map 탭을 그대로 옮긴 것이다. 길이던 지도를 사물함으로 바꾼
   까닭(이 앱은 가짜 OS인데 지도만 혼자 야외 일러스트였다)도, 칸 좌표도,
   문짝이 구멍보다 넓어야 하는 이유도 전부 lib/rules.ts와 null.css에 적혀 있다.
   여기가 아는 것은 「어떻게 그리느냐」 하나뿐이다 — 언제 열리고 왜 잠기는지는
   한 줄도 다시 쓰지 않는다. 두 판으로 갈라두면 반드시 어긋난다.

   RN에는 CSS filter도 퍼센트 transform도 없다. 그래서 옮기면서 바꾼 것은 셋이다.
   그림자와 빛은 같은 그림을 물들여 겹치는 것으로, 가운데 정렬은 좌표를 미리
   빼두는 것으로, 스크롤 안에 붙어 있던 머리글은 스크롤 밖으로. 바뀐 것은
   그리는 방법이지 규칙이 아니다. */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Image, Pressable, ScrollView, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IMG } from '../lib/api';
import {
  PLACES, SPOTS, PLACE_BY, ROAD_LABEL,
  CAB_SLOT, CAB_COL, CAB_ROW, CAB_DOOR_W, TV_QUAD, TV_QUAD_W, TV_QUAD_H,
  placeOpen, placeHours, wendOnlyOk, goneToday,
} from '../lib/rules';

const P = {
  ink:'#4a4276', border:'#5d5490', mid:'#8a7fc0', chrome:'#dcd6f2', bg:'#ece8fa',
  pink:'#ff9ec6', sub:'#9a8fc8', dim:'#b0a6d8', badge:'#ff7fae', err:'#c23b50', dark:'#2a2450',
  lav:'#c3b2f0', shade:'#cdc3ec',
};
const F = { fontFamily:'Galmuri11' } as const; // 픽셀 폰트 — 모든 Text에 적용

/* 웹은 width:100%·height:auto면 브라우저가 그림을 받아보고 높이를 잡아준다.
   RN은 주소로 받아오는 그림의 크기를 그리기 전에 모른다 — 첫 프레임에 높이가
   0이면 그 위에 얹힌 문짝 여덟이 전부 한 점에 겹쳤다가 튄다. 그림의 실제
   크기를 적어 aspectRatio로 못 박아두면 받아오기 전부터 자리가 서 있다. */
/* 두 장이 같은 사물함이다 — frame.webp는 다 닫힌 것, open.webp는 학교 칸이
   열린 것. 크기도 같다(tools/build-cab-art.py가 같은 자리를 오려낸다) */
const FRAME_W = 760, FRAME_H = 1581;   // cab-icons/frame.webp · open.webp

/* 웹은 문짝을 translate(-50%,-50%)로 칸 가운데에 건다. RN에 퍼센트 translate가
   없으니 왼쪽·위 좌표를 미리 빼서 넣는다.
   가로는 그냥 절반을 뺀다 — left도 문짝 폭도 다 프레임 폭이 잣대라 같은 자다.
   세로는 자가 둘이나 다르다. top은 프레임 높이의 %인데 문짝 폭은 프레임
   폭의 %이고, 게다가 문짝은 정사각이 아니다(원화에서 580×500을 오려 400×345로
   줄인다). 그래서 프레임 비율과 문짝 비율을 차례로 곱해야 같은 자가 된다 */
const DOOR_W_PX = 400, DOOR_H_PX = 345;   // cab-icons/*-open.webp
const DOOR_H = CAB_DOOR_W * (FRAME_W / FRAME_H) * (DOOR_H_PX / DOOR_W_PX);

/* App.tsx의 pct는 반올림을 한다. 여기 값들은 소수 두 자리가 자리를 정하므로
   (22.34와 22는 문짝 하나가 반 칸 어긋나는 차이다) 반올림 없이 붙인다. */
const pct = (n:number) => `${n}%`;

const url = (f:string) => IMG + 'cab-icons/' + f;

/* ── 문짝 한 장 ──
   웹은 filter 한 줄로 그림자와 빛을 얻는다. RN에는 filter가 없다. 대신 같은
   그림을 tintColor로 물들여 겹친다 — 그림의 알파를 그대로 쓰니까 네모난
   그림자가 아니라 문짝 모양 그림자가 나온다. 뷰에 shadow를 주면 알파를 무시한
   네모가 생기고 안드로이드에서는 그마저 흐려진다.
   · 그림자 사본은 안 깐다. 새 원화의 문짝은 제 그림자를 달고 나와서
     하나 더 두르면 칸마다 네모 테두리가 진다 — 웹도 같은 이유로 걷었다
   · been의 drop-shadow(0 0 9px 분홍) → 분홍 사본을 조금 키워 뒤에 깐다.
     RN은 번짐을 못 하니 퍼지는 빛 대신 문짝을 따라 도는 빛이 된다. 뜻은 같다 —
     「여기는 다녀왔다」
   · shut의 grayscale(.34) → 잿빛 사본을 위에 34%로 덮는다
   · lock의 saturate(.82)는 안 옮긴다. null.css가 「잠긴 문은 자물쇠 그림이
     이미 말해준다, 색까지 죽이면 두 번 말하는 것」이라며 일부러 옅게 둔 값이다.
     흉내를 내면 얻는 건 없고 겹치는 그림만 하나 는다 */
function DoorArt({ uri, shut, been }:
  { uri:string; shut?:boolean; been?:boolean }) {
  return <View style={D.box}>
    {been && <Image source={{uri}} resizeMode="contain"
      style={[D.layer, { tintColor:'#ff8ec9', opacity:.92, transform:[{ scale:1.09 }] }]}/>}
    <Image source={{uri}} resizeMode="contain" style={D.layer}/>
    {shut && <Image source={{uri}} resizeMode="contain"
      style={[D.layer, { tintColor:'#6f6890', opacity:.34 }]}/>}
  </View>;
}
const D = StyleSheet.create({
  box:{ width:'100%', aspectRatio:DOOR_W_PX/DOOR_H_PX },
  layer:{ ...StyleSheet.absoluteFillObject, width:'100%', height:'100%' },
});

/* ── 그림 머리의 빈 홈 ──
   원화가 제 머리에 이름표와 빈 홈을 하나 달고 나온다. 이 게임에서 빈칸은
   채우라고 있는 것이라 거기에 진도를 넣는다. 좌표는 null.css의 .cabbar와
   같은 값이다 — 원화에서 홈 안쪽을 재서 넣었다 */
function CabBar({ n, of }: { n:number; of:number }) {
  return <View pointerEvents="none" style={B.bar}>
    <LinearGradient colors={['#ff9ec6', '#c3b2f0', '#9cdff1']}
      start={{ x:0, y:0 }} end={{ x:1, y:0 }}
      style={{ height:'100%', borderRadius:99, width:pct(n / of * 100) }}/>
    <Text style={B.n}>{n} / {of}</Text>
  </View>;
}
const B = StyleSheet.create({
  bar:{ position:'absolute', left:'9.8%', top:'7.42%', width:'63.4%', height:'1.72%',
    flexDirection:'row', alignItems:'center', borderRadius:99 },
  n:{ ...F, position:'absolute', right:'2.4%', fontSize:9, letterSpacing:.72, color:'#7a6ab4' },
});

/* ── 사물함 여덟 칸 ── */
function CabFrame({ met, now, onGoPlace, onPlate, onEnter }:
  { met:string[]; now:Date;
    onGoPlace:(p:string)=>void; onPlate:(s:any)=>void; onEnter:(lv:string)=>void }) {
  return <View style={{ width:'100%' }}>
    <Image source={{ uri:url('frame.webp') }} resizeMode="contain"
      style={{ width:'100%', aspectRatio:FRAME_W/FRAME_H }}/>
    {CAB_SLOT.map((s:any, i:number) => {
      const box = {
        left: pct(CAB_COL[i % 2] - CAB_DOOR_W / 2),
        top:  pct(CAB_ROW[i >> 1] - DOOR_H / 2),
        width: pct(CAB_DOOR_W),
      };

      /* START와 NULL은 자리가 아니다. 열 것도 잠글 것도 없다.
         그래도 누르면 한 마디는 한다 — 눌러도 아무 일이 없는 칸이 여덟 중
         둘이면 나머지 여섯도 안 눌러보게 된다 */
      if (s.kind) {
        const art = <DoorArt uri={url(s.kind + '.webp')}/>;
        return <Pressable key={s.kind} onPress={() => onPlate(s)}
          accessibilityRole="button" accessibilityLabel={s.say}
          style={({ pressed }) => [C.door, box, pressed && C.press]}>{art}</Pressable>;
      }

      const p = PLACE_BY[s.place], open = placeOpen(p, met);
      /* 못 가는 이유는 셋이다 — 시간, 주말 전용, 오늘 이미 다녀옴.
         문에는 흐리게만 알리고 왜인지는 눌렀을 때 창이 말한다 */
      const nowOk = placeHours(p, now) && wendOnlyOk(p, now) && !goneToday(p.name, now);
      const been = p.into ? false : met.includes(p.name);
      const shut = open && !nowOk && !p.into;
      const art = <DoorArt uri={url(`${p.icon}-${open ? 'open' : 'lock'}.webp`)}
        shut={shut} been={been}/>;

      /* 학교는 자리가 아니라 문이다. 물어보지 않고 바로 안으로 들어간다.
         잠긴 문도 눌린다 — 눌러도 아무 일이 없으면 고장 난 것처럼 보인다.
         왜 안 되는지는 부모가 띄우는 창이 말한다 */
      const go = () => (open && p.into) ? onEnter(p.into) : onGoPlace(p.name);
      return <Pressable key={p.name} onPress={go} accessibilityRole="button"
        accessibilityLabel={(ROAD_LABEL[p.icon] || 'PLACE') +
          (open ? (nowOk || p.into ? '' : ' · CLOSED NOW') : ' · LOCKED')}
        style={({ pressed }) => [C.door, box, pressed && C.press]}>{art}</Pressable>;
    })}
  </View>;
}
const C = StyleSheet.create({
  door:{ position:'absolute' },
  press:{ transform:[{ scale:.965 }] },   // 웹의 :active와 같은 눌림
});

/* ── 학교 안 ──
   학교 문을 누르면 그 문이 열린 사물함으로 바뀐다. 열린 칸 안에 TV가 있고
   그 안에 학교 네 자리가 있다 — 원화가 사물함 한 장으로 그려져 있어서
   열린 칸만 오려 띄우지 않는다. 마을과 같은 자리, 같은 크기다.
   전에는 열린 부분만 오려 한가운데에 뿅 띄웠는데, 그러면 사물함 안이 아니라
   화면 위에 얹힌 판때기 한 장으로 보였다. 웹도 같이 걷었다 */
function TvPop({ met, now, visitedN, onGoPlace }:
  { met:string[]; now:Date; visitedN:number; onGoPlace:(p:string)=>void }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue:1, duration:300,
      easing:Easing.out(Easing.quad), useNativeDriver:true }).start();
  }, [a]);

  /* TV 화면 넷 말고는 어디를 눌러도 닫힌다 — 열린 문짝도 「닫기」다.
     문을 눌러 닫는 건 제일 먼저 해보는 손짓이다. 그래서 그림 자체는
     터치를 안 삼키고 뒤의 Pressable까지 내려보낸다 */
  return <Animated.View style={{ width:'100%',
    opacity:a.interpolate({ inputRange:[0, 1], outputRange:[.4, 1] }) }}>
    <Image source={{ uri:url('open.webp') }} resizeMode="contain" pointerEvents="none"
      style={{ width:'100%', aspectRatio:FRAME_W/FRAME_H }}/>
    <CabBar n={visitedN} of={SPOTS.length}/>
    {PLACES.filter((p:any) => p.map === 'school').map((p:any) => {
      const q = TV_QUAD[p.name]; if (!q) return null;
      const open = placeOpen(p, met), nowOk = placeHours(p, now) && !goneToday(p.name, now);
      /* 다녀온 표시는 안 한다. TV 화면 위에 테두리를 두르면
         그림 위에 그림이 하나 더 얹힌다 */
      return <Pressable key={p.name} onPress={() => onGoPlace(p.name)}
        accessibilityRole="button"
        accessibilityLabel={(ROAD_LABEL[p.icon] || 'PLACE') +
          (open ? (nowOk ? '' : ' · CLOSED NOW') : ' · LOCKED')}
        style={({ pressed }) => [T.q,
          { left:pct(q.x), top:pct(q.y), width:pct(TV_QUAD_W), height:pct(TV_QUAD_H) },
          !open && T.qLock, open && !nowOk && T.qShut, pressed && T.qOn]}/>;
    })}
  </Animated.View>;
}
const T = StyleSheet.create({
  q:{ position:'absolute', borderRadius:5 },
  /* TV 화면은 그림이라 잠금을 얹어서 말해야 한다. 문짝처럼 자물쇠 그림이 없다 */
  qLock:{ backgroundColor:'rgba(64,52,112,.52)', borderWidth:2, borderColor:'rgba(255,255,255,.28)' },
  qShut:{ backgroundColor:'rgba(64,52,112,.26)' },
  qOn:{ backgroundColor:'rgba(255,142,201,.22)' },   // 눌린 동안. 잠긴 칸도 눌리는 건 보여준다
});

export default function Cabinet({ met, onGoPlace, onPlate }:
  { met:string[]; onGoPlace:(place:string)=>void; onPlate:(p:{kind:string;say:string;kao:string})=>void }) {
  const [level, setLevel] = useState('town');   // 지도 두 장 — 마을 사물함 / 학교 안
  const metList = met || [];

  /* 문이 열리고 닫히는 건 시계가 정한다. 화면을 켜둔 채로 두면 닫힌 자리가
     열린 문으로 남아 있다가, 눌러야 「지금은 안 돼요」를 만난다 — 그건 문이
     거짓말을 한 것이다. 웹은 매초 다시 그리는데 여기 규칙은 시(hour) 단위라
     삼십 초면 충분하다. now를 useMemo로 묶어두면 tick이 죽은 값이 아니게 된다 */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const now = useMemo(() => new Date(), [tick]);

  const visitedN = PLACES.filter((p:any) => metList.includes(p.name)).length;

  const cab = () => <CabFrame met={metList} now={now}
    onGoPlace={onGoPlace} onPlate={onPlate} onEnter={setLevel}/>;

  return <View style={S.wrap}>
    {/* 창 위에 머리글을 안 얹는다. 사물함 그림이 제 머리에 이름표와 빈 홈을
        달고 있어서 같은 것을 하나 더 놓으면 제목도 진도도 두 벌이 된다 —
        진도는 그 빈 홈 안에만 있다(CabBar).
        학교 안에서 나가는 길은 TV 화면 넷 말고 아무 데나 누르는 것이다 */}
    {/* 사물함은 화면보다 훨씬 길다(760×1581). 두 장이 같은 크기라 스크롤도
       같이 쓴다 — 전에는 열린 문만 오려 띄워서 학교 안만 스크롤을 막았었다 */}
    <ScrollView style={{ flex:1 }} contentContainerStyle={{ paddingBottom:14 }}
      showsVerticalScrollIndicator={false}>
      {level === 'town'
        ? cab()
        /* 나갈 데가 머리글 하나뿐이면 못 찾는다. TV 화면 넷 말고는
           어디를 눌러도 닫힌다 — 열린 문짝도 「닫기」다 */
        : <Pressable onPress={() => setLevel('town')}>
            <TvPop met={metList} now={now} visitedN={visitedN} onGoPlace={onGoPlace}/>
          </Pressable>}
    </ScrollView>
  </View>;
}

/* 지도 머리글은 걷었다. 사물함 원화가 제 머리에 이름표와 빈 홈을 달고
   나와서, 창 위에 같은 것을 하나 더 얹으면 제목도 진도도 두 벌이 됐다 */
const S = StyleSheet.create({
  wrap:{ flex:1, paddingHorizontal:7, paddingTop:7 },
});
