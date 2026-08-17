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
  CAB_SLOT, CAB_COL, CAB_ROW, CAB_DOOR_W, TV_QUAD, TV_QUAD_W,
  placeOpen, placeHours, wendOnlyOk, goneToday,
} from '../lib/rules';

/* TV_QUAD_H만 rules.ts에서 안 나온다. app-data.js에 `const TV_QUAD_W=19, TV_QUAD_H=18.5;`로
   한 줄에 둘이 선언돼 있는데 tools/build-rules.mjs의 이름 훑기가 줄머리의 첫
   이름만 집기 때문이다 — 규칙이 없는 게 아니라 못 가져오는 것이다.
   그래서 여기 적힌 18.5는 새 규칙이 아니라 못 건너온 값의 임시 다리다.
   빌드가 고쳐져 TV_QUAD_H가 export에 들어오면 이 줄은 지우고 위에서 가져온다. */
const TV_QUAD_H = 18.5;

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
const FRAME_W = 760, FRAME_H = 1463;   // cab-icons/frame.webp
const OPEN_W  = 760, OPEN_H  = 656;    // cab-icons/open.webp — 열린 문 + 그 안의 TV

/* 웹은 문짝을 translate(-50%,-50%)로 칸 가운데에 건다. RN에 퍼센트 translate가
   없으니 왼쪽·위 좌표를 미리 빼서 넣는다.
   가로는 그냥 절반을 뺀다 — left도 문짝 폭도 다 프레임 폭이 잣대라 같은 자다.
   세로는 자가 다르다. top은 프레임 높이의 %인데 문짝은 정사각이라 높이가
   프레임 폭의 43%다. 프레임 비율로 한 번 환산해야 같은 자가 된다:
   43 × 760/1463 = 22.34%. null.css가 「43%면 높이가 22.35%로 간격 안에
   들어간다」고 적어둔 그 값이 여기서 다시 나온다 — 맞게 옮겼다는 뜻이다. */
const DOOR_H = CAB_DOOR_W * FRAME_W / FRAME_H;

/* App.tsx의 pct는 반올림을 한다. 여기 값들은 소수 두 자리가 자리를 정하므로
   (22.34와 22는 문짝 하나가 반 칸 어긋나는 차이다) 반올림 없이 붙인다. */
const pct = (n:number) => `${n}%`;

const url = (f:string) => IMG + 'cab-icons/' + f;

/* ── 문짝 한 장 ──
   웹은 filter 한 줄로 그림자와 빛을 얻는다. RN에는 filter가 없다. 대신 같은
   그림을 tintColor로 물들여 겹친다 — 그림의 알파를 그대로 쓰니까 네모난
   그림자가 아니라 문짝 모양 그림자가 나온다. 뷰에 shadow를 주면 알파를 무시한
   네모가 생기고 안드로이드에서는 그마저 흐려진다.
   · drop-shadow(0 3px 0 …)  → 보라 사본을 3만큼 내려 뒤에 깐다
   · been의 drop-shadow(0 0 9px 분홍) → 분홍 사본을 조금 키워 뒤에 깐다.
     RN은 번짐을 못 하니 퍼지는 빛 대신 문짝을 따라 도는 빛이 된다. 뜻은 같다 —
     「여기는 다녀왔다」
   · shut의 grayscale(.34) → 잿빛 사본을 위에 34%로 덮는다
   · lock의 saturate(.82)는 안 옮긴다. null.css가 「잠긴 문은 자물쇠 그림이
     이미 말해준다, 색까지 죽이면 두 번 말하는 것」이라며 일부러 옅게 둔 값이다.
     흉내를 내면 얻는 건 없고 겹치는 그림만 하나 는다 */
function DoorArt({ uri, shade, shut, been }:
  { uri:string; shade:number; shut?:boolean; been?:boolean }) {
  return <View style={D.box}>
    {been && <Image source={{uri}} resizeMode="contain"
      style={[D.layer, { tintColor:'#ff8ec9', opacity:.92, transform:[{ scale:1.09 }] }]}/>}
    <Image source={{uri}} resizeMode="contain"
      style={[D.layer, { tintColor:P.border, opacity:shade, transform:[{ translateY:3 }] }]}/>
    <Image source={{uri}} resizeMode="contain" style={D.layer}/>
    {shut && <Image source={{uri}} resizeMode="contain"
      style={[D.layer, { tintColor:'#6f6890', opacity:.34 }]}/>}
  </View>;
}
const D = StyleSheet.create({
  box:{ width:'100%', aspectRatio:1 },
  layer:{ ...StyleSheet.absoluteFillObject, width:'100%', height:'100%' },
});

/* ── 사물함 여덟 칸 ──
   학교 안에서는 이 그림이 뒤로 물러나 배경이 된다(live=false). 그때는 문이
   안 눌리고 읽히지도 않는다 — 웹의 aria-hidden이 하던 일이라, 앞의 TV와
   같은 이름이 화면에 두 벌 뜨지 않게 한다. */
function CabFrame({ met, now, live, onGoPlace, onPlate, onEnter }:
  { met:string[]; now:Date; live:boolean;
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
        const art = <DoorArt uri={url(s.kind + '.webp')} shade={.18}/>;
        if (!live) return <View key={s.kind} pointerEvents="none"
          style={[C.door, box]} accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">{art}</View>;
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
        shade={!open ? .16 : shut ? .18 : .22} shut={shut} been={been}/>;

      if (!live) return <View key={p.name} pointerEvents="none"
        style={[C.door, box]} accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">{art}</View>;

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
   학교 문을 열면 사물함이 뒤로 물러나고 열린 문 안의 TV가 한가운데에 뿅 나온다.
   화면을 가득 채우지 않는다 — 여기는 사물함 안이지 다른 화면이 아니다.
   튀어나오는 곡선은 웹의 cubic-bezier(.18,1.5,.42,1) 그대로다. 1.5가 넘는 값이라
   scale은 1을 지나쳤다 돌아온다(그게 「뿅」이다). 불투명도까지 넘치면 깜빡이므로
   그쪽만 clamp로 잡는다 */
function TvPop({ met, now, onGoPlace }:
  { met:string[]; now:Date; onGoPlace:(p:string)=>void }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue:1, duration:420,
      easing:Easing.bezier(.18, 1.5, .42, 1), useNativeDriver:true }).start();
  }, [a]);

  return <Animated.View style={[T.pop, {
    opacity:a.interpolate({ inputRange:[0, .55, 1], outputRange:[0, 1, 1], extrapolate:'clamp' }),
    transform:[{ scale:a.interpolate({ inputRange:[0, 1], outputRange:[.16, 1] }) }],
  }]}>
    {/* 열린 문 위에서는 안 닫힌다 — 웹의 stopPropagation 자리다. RN에서는
        자식이 터치를 잡으면 부모의 onPress가 안 뜨므로 빈 Pressable이 그 일을 한다 */}
    <Pressable onPress={() => {}} style={{ width:'100%' }}>
      {/* .cabpop의 drop-shadow(0 10px 0 rgba(93,84,144,.22)). 문짝과 같은 수법이다 —
          같은 그림을 보라로 물들여 10만큼 내려 뒤에 깐다. 뷰에 그림자를 주면
          열린 문짝의 뚫린 자리까지 네모로 메워져서, 사물함 안에 선 TV가 아니라
          판때기 한 장이 된다. 문짝 그림자가 3인데 이쪽만 10인 건 이게 앞으로
          튀어나온 물건이라서다 — 웹이 그렇게 정해뒀다 */}
      <Image source={{ uri:url('open.webp') }} resizeMode="contain" pointerEvents="none"
        style={[T.popShade, { tintColor:P.border, opacity:.22 }]}/>
      <Image source={{ uri:url('open.webp') }} resizeMode="contain"
        style={{ width:'100%', aspectRatio:OPEN_W/OPEN_H }}/>
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
    </Pressable>
  </Animated.View>;
}
const T = StyleSheet.create({
  pop:{ width:'88%' },
  popShade:{ position:'absolute', left:0, top:0, width:'100%',
    aspectRatio:OPEN_W/OPEN_H, transform:[{ translateY:10 }] },
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

  const cab = (live:boolean) => <CabFrame met={metList} now={now} live={live}
    onGoPlace={onGoPlace} onPlate={onPlate} onEnter={setLevel}/>;

  return <View style={S.wrap}>
    {/* 웹의 머리글은 스크롤 안에 sticky로 붙어 있다. RN에 sticky가 없는 건
        아니지만(stickyHeaderIndices) 학교 안에는 스크롤 자체가 없어서 두 쪽이
        다른 구조가 된다. 스크롤 밖에 한 번만 세우면 두 장이 같은 머리글을 쓴다 */}
    <View style={S.headWrap}>
      <View pointerEvents="none" style={S.headShade}/>
      <View pointerEvents="none" style={S.headRing}/>
      <LinearGradient colors={['rgba(255,255,255,.94)', 'rgba(238,231,253,.88)']}
        start={{ x:0, y:0 }} end={{ x:0, y:1 }} style={S.head}>
        {/* 나가기. 제목 자리가 그대로 뒤로가기가 된다 — 단추를 하나 더 놓으면 창이 시끄럽다 */}
        {level === 'school'
          ? <Pressable onPress={() => setLevel('town')} accessibilityRole="button"
              hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
              {({ pressed }) => <Text style={[S.rt, pressed && { opacity:.7 }]}>
                {'◁ '}<Text style={S.rh}>♡</Text>{' SCHOOL'}</Text>}
            </Pressable>
          : <Text style={S.rt}><Text style={S.rh}>♡</Text>{' NULL NOCKER'}</Text>}
        <View style={S.rbar}>
          <LinearGradient colors={['#ff9ec6', '#c3b2f0', '#9cdff1']}
            start={{ x:0, y:0 }} end={{ x:1, y:0 }}
            style={{ height:'100%', width:pct(visitedN / SPOTS.length * 100) }}/>
        </View>
        <Text style={S.rn}>{visitedN} / {SPOTS.length}</Text>
      </LinearGradient>
    </View>

    {level === 'town'
      /* 사물함은 화면보다 훨씬 길다(760×1463). 마을에서는 굴려서 본다 */
      ? <ScrollView style={{ flex:1 }} contentContainerStyle={{ paddingBottom:14 }}
          showsVerticalScrollIndicator={false}>{cab(true)}</ScrollView>
      /* 나갈 데가 머리글 하나뿐이면 못 찾는다. 뒤에 깔린 사물함을 누르면
         돌아간다 — 열린 문 바깥은 전부 「닫기」다.
         사물함은 화면보다 길어서 한가운데를 잡으면 TV가 화면 밖 저 아래에
         뜬다. 뒤 사물함은 위에서부터 깔고 잘리게 두고, TV만 보이는 자리
         한가운데에 세운다 */
      : <View style={{ flex:1, paddingBottom:14 }}>
          <Pressable style={S.cabin} onPress={() => setLevel('town')}>
            <View pointerEvents="none" style={S.cabback}>{cab(false)}</View>
            <TvPop met={metList} now={now} onGoPlace={onGoPlace}/>
          </Pressable>
        </View>}
  </View>;
}

const S = StyleSheet.create({
  wrap:{ flex:1, paddingHorizontal:7, paddingTop:7 },
  headWrap:{ marginBottom:7 },
  /* 웹의 box-shadow 0 2px 0 — 안드로이드 elevation은 무조건 흐려지므로
     App.tsx의 HardShadow와 같은 수를 쓴다. 밑에 깔린 네모 하나면 된다 */
  headShade:{ position:'absolute', left:0, top:2, right:0, bottom:-2,
    backgroundColor:'rgba(123,101,184,.16)', borderRadius:8 },
  /* .roadhead의 box-shadow는 둘이다. 두 번째 0 0 0 1px는 번짐이 없으니
     테두리 바깥 1px 선일 뿐이라 그대로 옮긴다. 이게 없으면 머리글의 제
     테두리가 흰색(.92)이라 연보라 바탕에 얹혔을 때 윤곽이 사라진다 —
     띄워둔 판이 아니라 배경에 스민 얼룩으로 보인다 */
  headRing:{ position:'absolute', left:-1, top:-1, right:-1, bottom:-1,
    borderWidth:1, borderColor:'rgba(172,153,221,.22)', borderRadius:9 },
  head:{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:9, paddingVertical:7,
    borderWidth:1, borderColor:'rgba(255,255,255,.92)', borderRadius:8 },
  rt:{ ...F, fontSize:10, letterSpacing:2, color:'#6655a6' },
  rh:{ ...F, color:'#e66fa4', letterSpacing:0 },
  rbar:{ flex:1, height:5, overflow:'hidden', borderWidth:1, borderColor:'#cfc3eb',
    backgroundColor:'#e6def7' },
  rn:{ ...F, fontSize:9, letterSpacing:.72, color:'#8a7fc0' },
  cabin:{ flex:1, width:'100%', minHeight:340, overflow:'hidden',
    alignItems:'center', justifyContent:'center' },
  /* 희미하게 남는 배경. 웹은 여기에 saturate(.5)까지 걸지만 RN에 filter가
     없어서 옅게 만드는 쪽만 옮긴다 — 뒤로 물러난다는 뜻은 opacity가 다 한다 */
  cabback:{ position:'absolute', left:0, top:0, width:'100%', opacity:.3 },
});
