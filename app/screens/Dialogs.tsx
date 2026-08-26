// @ts-nocheck
/* ── 창(팝업)들 ──
   웹 app.js의 ask / leaving / way / plate / groupNew / look을 그대로 옮겼다.
   글월은 app.js에서 글자 그대로 가져온 것이다 — 이모티콘 한 자도 새로 짓지
   않는다. 앱에서만 다르게 말하면 같은 세계가 아니게 된다.

   판정은 여기서 안 한다. 무엇이 막혔는가도(away/locked/shut/wk/done/empty/
   need/mv/klass/no/why), 첫 줄에 뭐라고 쓰는지도(title), 동행 줄을 세우는지도
   (canPick/who) 전부 lib/flow.ts의 askState가 재고, 이 파일은 그 결과를
   그림으로만 옮긴다. 규칙이 두 군데 살면 반드시 갈라진다 — 웹이 규칙을
   app-data.js 한 곳에 몰아둔 것과 같은 이유다. 그래서 PLACE_BY를 안 들여온다:
   자리표가 손에 있으면 여기서 조건 한 줄 더 재는 일이 반드시 생긴다.

   왜 Modal이 아니라 절대배치 View인가:
   창은 겹쳐 뜬다. 나가기에 답하면 귀갓길 창이 이어서 뜨고(answerLeave),
   자리에 앉은 채로 초대가 올 수도 있다. RN의 Modal은 네이티브 창이라 둘이
   동시에 서면 나중 것이 화면을 통째로 덮고 아래 창은 눌리지 않는다 —
   웹에서 겹친 창 때문에 아래 창을 못 눌렀던 일이 네이티브에서는 더 크게
   난다. 그래서 형제로 나란히 눕히고 쌓이는 차례만 z로 정한다.
   z는 웹과 같은 값이다: 대화창 40, 문틈 42(토스트 45보다는 아래 —
   구경 중에도 알림은 보여야 한다). */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, TextInput, StyleSheet, Platform, Animated, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CHARS, AV_V, jos, DIARY_IMG, DIARY_BOX, DIARY_HEAD, DIARY_LINES, DIARY_TAIL_A, DIARY_TAIL_B, DIARY_MAX } from '../lib/rules';
import { IMG } from '../lib/api';
/* 값이 아니라 모양만 가져온다 — 판정은 저쪽 파일의 일이다.
   askState는 {away,locked,shut,wk,done,empty,need,mv,klass,no,why,
   title,canPick,who}를 준다. */
import type { AskState } from '../lib/flow';

/* App.tsx의 P·F·TB·Dots·Bevel·Face와 같은 것들이다. App.tsx는 default export
   하나뿐이라 가져올 길이 없어서 여기 다시 세운다 — 색과 치수를 바꾸려면
   두 곳을 같이 고쳐야 한다. 나중에 조각들을 lib으로 빼면 이 블록은 사라진다. */
const P = {
  ink:'#4a4276', border:'#5d5490', mid:'#8a7fc0', chrome:'#dcd6f2', bg:'#ece8fa',
  pink:'#ff9ec6', sub:'#9a8fc8', dim:'#b0a6d8', badge:'#ff7fae', err:'#c23b50', dark:'#2a2450',
  lav:'#c3b2f0', shade:'#cdc3ec',
};
const F = { fontFamily:'Galmuri11' } as const;

/* 이모티콘은 픽셀 글꼴에 없는 글자다. null.css가 .kao만 시스템 글꼴로
   빼둔 것과 같은 이유 — Galmuri11로 그리면 얼굴 자리에 두부가 뜬다.
   RN은 중첩 Text가 부모 글꼴을 물려받으므로 이름을 비우는 것으로는 안 되고
   시스템 글꼴 이름을 또박또박 적어야 덮인다. */
export const KAO = {
  fontFamily: Platform.select({ android:'sans-serif', ios:'System', default:'System' }),
  letterSpacing: 0,
};

/* ── 프사 ──
   웹 app-ui.js의 faceBg와 같은 계산이다. 정사각 액자에 원본을 통째로 넣으면
   위가 비어서 이마만 나온다 — 확대해서 눈높이로 끌어올린다.
   확대율과 위치는 rules.ts의 CHARS가 들고 있다("150%", "50% 22%"). 앱에
   숫자를 베껴두면 사진을 갈아끼울 때 한쪽만 고쳐진다. */
const pctOf = (s:string, d:number) => { const n = parseFloat(s); return isFinite(n) ? n/100 : d };
function Face({char, size}:{char:string; size:number}) {
  const c = CHARS[char] || {};
  const zoom = pctOf(c.zoom, 1.5);
  const [px, py] = String(c.pos || '50% 50%').split(/\s+/);
  const x = pctOf(px, .5), y = pctOf(py, .5);
  return <View style={{width:size, height:size, borderRadius:size/2, overflow:'hidden',
      backgroundColor:c.pale || '#efeaf9', borderWidth:1.5, borderColor:'#fff'}}>
    <Image source={{uri: IMG + c.img + AV_V}} resizeMode="cover"
      style={{width:size*zoom, height:size*zoom,
        marginLeft:-x*(zoom-1)*size, marginTop:-y*(zoom-1)*size}}/>
  </View>;
}

// 신호등 ─ □ ✕ — ✕만 실제로 닫는다
function Dots({onClose}:{onClose?:()=>void}) {
  const d:[string,string,string][] = [['#ffd0e6','─','#c46a97'],['#ff9ec6','□','#fff'],['#ff7fae','✕','#fff']];
  return <View style={{marginLeft:'auto', flexDirection:'row', gap:5}}>
    {d.map(([bg,glyph,ink],i)=>{
      const dot = <View style={{width:15, height:15, borderRadius:8, borderWidth:1, borderColor:P.border,
        backgroundColor:bg, alignItems:'center', justifyContent:'center'}}>
        <Text style={{...F, fontSize:7, lineHeight:9, color:ink}}>{glyph}</Text>
      </View>;
      return (i===2 && onClose)
        ? <Pressable key={i} onPress={onClose} hitSlop={{top:14,bottom:14,left:14,right:14}}>{dot}</Pressable>
        : <View key={i}>{dot}</View>;
    })}
  </View>;
}

// 베벨 버튼: 위/왼쪽 밝음 + 아래/오른쪽 음영, 누르면 반전 + 1px 밀림
function Bevel({onPress, disabled, style, inner, children}:any) {
  return <Pressable onPress={onPress} disabled={disabled} hitSlop={{top:8,bottom:8,left:8,right:8}}
    style={[bv.outer, disabled && {opacity:.45}, style]}>
    {({pressed}:any)=><>
      <View pointerEvents="none" style={bv.shadow}/>
      <View style={[bv.face, inner, pressed && bv.faceP]}>{children}</View>
    </>}
  </Pressable>;
}
const bv = StyleSheet.create({
  outer:{borderWidth:1, borderColor:P.border, backgroundColor:P.bg},
  shadow:{position:'absolute', left:2, top:2, right:-2, bottom:-2, backgroundColor:'rgba(93,84,144,.22)'},
  face:{flexGrow:1, alignSelf:'stretch', alignItems:'center', justifyContent:'center',
    borderWidth:2, borderTopColor:'#fff', borderLeftColor:'#fff',
    borderBottomColor:P.shade, borderRightColor:P.shade},
  faceP:{borderTopColor:P.shade, borderLeftColor:P.shade, borderBottomColor:'#fff', borderRightColor:'#fff',
    backgroundColor:'#e4ddf6', transform:[{translateX:1},{translateY:1}]},
});

/* 창의 단추. 웹에서는 .dlgbtns .bevel이 광택 알약으로 덮이는데, 앱에는 이미
   초대 창(App.tsx)이 네모 베벨로 서 있다. 한 앱 안에서 창마다 단추 모양이
   다른 것이 웹과 알약 하나 다른 것보다 눈에 띈다 — 앱의 결을 따른다.
   분홍은 그쪽에서 쓰는 것과 같은 안쪽 색(#ffe3f0)이다. */
function Btn({label, pink, disabled, onPress, style}:any) {
  return <Bevel style={[{flex:1, height:38}, style]} disabled={disabled}
    inner={pink ? {backgroundColor:'#ffe3f0'} : null} onPress={onPress}>
    <Text style={dl.btnT}>{label}</Text>
  </Bevel>;
}

/* 창 껍데기 — 웹의 .dlgov + .dlg + .dlgbody 세 겹.
   막은 형제로 깔고 창은 그 위에 얹는다. 창 안을 눌러도 막까지 안 내려간다 —
   형제라서 애초에 타고 내려갈 길이 없다(웹의 stopPropagation 자리다). */
function Dlg({title, onClose, z=40, children}:any) {
  return <View style={[dl.ov, {zIndex:z}]}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
    <View style={dl.wrap}>
      <View pointerEvents="none" style={dl.shadow}/>
      <View style={dl.win}>
        <LinearGradient colors={['#ff8fbe','#ffb0d4']} start={{x:0,y:0}} end={{x:1,y:0}} style={dl.tb}>
          <Text style={dl.tbT}>{title}</Text>
          <Dots onClose={onClose}/>
        </LinearGradient>
        <View style={dl.body}>{children}</View>
      </View>
    </View>
  </View>;
}

/* ══ 1. 자리를 눌렀을 때 ══
   지금 갈 시간이 아니면 묻지 않고 이유를 말한다. 눌렀는데 아무 일도 안
   일어나는 것보다 「몇 시부터」를 알려주는 편이 낫다. */
export function AskDialog({place, state, onGo, onMove, onLook, onClose, onPickWho, picked}:{
  place:string; state:AskState;
  onGo:()=>void; onMove:()=>void; onLook:()=>void; onClose:()=>void;
  onPickWho:(who:string)=>void; picked:string|null;
}) {
  if (!place) return null;
  const s:any = state || {};
  /* 여기서 재는 것은 이 하나뿐이다. 잠긴 자리를 맨 위에 두는 건 「지금은 못
     가요」가 아직 안 열린 자리에도 붙으면 시간 탓처럼 읽히기 때문이다. 자리에
     앉아 있는 동안(away)은 그 말이 맞으므로 그때만 아래로 흘려보낸다.
     askState가 title에 안 섞고 남겨둔 갈림이라 창이 맡는다 — 한 칸에 성격이
     다른 두 문장을 넣지 않으려고 저쪽이 일부러 비워둔 자리다. */
  const lock = !!s.locked && !s.away;
  return <Dlg title={place} onClose={onClose} z={40}>
    <View style={dl.lineBox}>
      {lock
        ? <Text style={dl.lock}>my bad <Text style={dl.lockI}>♡</Text>{'\n'}아직은 못 가요 <Text style={KAO}>𐔌՞꜆ ≧ ㅁ≦꜀՞𐦯</Text></Text>
        : <Text style={dl.line}>{s.title}</Text>}
    </View>
    {/* 하루에 한 번뿐이라는 건 눌러보고 알면 늦다. 묻는 자리에서 같이 말한다 */}
    {!s.no && !s.klass &&
      <Text style={dl.rule}>앗! 하루에 1번만 갈 수 있어요 <Text style={KAO}>(υl|l◔ㅅ◔)՞՞</Text></Text>}
    {/* 잠긴 자리는 이유가 빈 문자열이다(무엇을 먼저 가야 하는지는 안 적는다 —
        순서를 알려주면 지도를 도는 게 심부름이 된다). 그럴 때 웹은 빈 칸을
        띄우지만 여기서는 아예 건다 — 그 자리에는 이미 「my bad ♡」 두 줄이
        서 있어서, 빈 칸까지 끼면 말과 단추 사이가 이유 있는 것처럼 벌어진다 */}
    {!!s.no && !!s.why && <Text style={dl.why}>{s.why}{!!s.kao && <Text style={KAO}> {s.kao}</Text>}</Text>}
    {/* 시간을 내서 가는 자리는 누구랑 갈지 고른다 — 같이 이동이면 이미 정해져
        있다. 그 갈림은 askState가 canPick에 넣어 준다 */}
    {!!s.canPick && <View style={dl.who}>
      {(s.who || []).map((c:string)=>
        <Bevel key={c} style={{flex:1}} inner={[dl.whoIn, picked===c && dl.whoOn]}
          onPress={()=>onPickWho && onPickWho(c)}>
          <Face char={c} size={22}/>
          <Text style={[dl.whoT, picked===c && dl.whoTOn]}>{CHARS[c].name}</Text>
        </Bevel>)}
    </View>}
    <View style={dl.btns}>
      {s.no
        ? <Btn label="OK!" onPress={onClose}/>
        : s.klass
        /* 구경은 가는 길이 아니다 — 도장도 자리도 대화도 없어서 answerAsk를 안 탄다.
           어느 장을 볼지는 부르는 쪽(App.tsx)이 뽑는다. 웹은 단추 손잡이에서
           뽑지만 그 목록을 창에도 베껴 두면 두 벌이 된다 — 사진이 한 장 늘 때
           한쪽만 늘어난다. 창은 「눌렸다」만 알린다 */
        ? <>
            <Btn pink label="살짝 PEEK!" onPress={onLook}/>
            <Btn label="LATER..." onPress={onClose}/>
          </>
        : s.mv
        ? <>
            <Btn pink label="같이 GO!" onPress={onMove}/>
            <Btn label="LATER..." onPress={onClose}/>
          </>
        : <>
            <Btn pink disabled={!!s.need} label="GO!" onPress={onGo}/>
            <Btn label="LATER..." onPress={onClose}/>
          </>}
    </View>
  </Dlg>;
}

/* ══ 2. 나가기 ══
   들어올 때 물었으니 나갈 때도 묻는 게 짝이 맞다. 하루에 한 번뿐인 자리를
   뒤로가기 한 번에 닫으면 실수로 그날이 끝난다.
   막을 누르거나 ✕는 「더 있을래요」다 — 애매하게 닫혀서 자리를 잃지 않는다. */
export function LeaveDialog({place, onLeave, onStay}:{place:string; onLeave:()=>void; onStay:()=>void}) {
  if (!place) return null;
  return <Dlg title={place} onClose={onStay} z={40}>
    <View style={dl.lineBox}>
      <Text style={dl.line}>{jos(place, '은/는')} 여기까지...?</Text>
    </View>
    <Text style={dl.rule}>지금 나가면 Ending... <Text style={KAO}>.(๓´͈ ˘ `͈๓).</Text></Text>
    <View style={dl.btns}>
      <Btn pink label="EXIT!" onPress={onLeave}/>
      <Btn label="조금 더 STAY!" onPress={onStay}/>
    </View>
  </Dlg>;
}

/* ══ 3. 밤 귀갓길 ══
   유저 집을 지도에 세우지 않은 건 그게 갈 곳이 아니라 헤어지는 자리라서다.
   묻는 쪽이 상대라서 초대 창과 같은 모양이다 — 제목이 자리 이름이 아니라
   사람 이름인 것도 그래서다. */
export function WayDialog({room, onRide, onAlone}:{room:string; onRide:()=>void; onAlone:()=>void}) {
  if (!room) return null;
  return <Dlg title={CHARS[room] ? CHARS[room].name : ''} onClose={onAlone} z={40}>
    <View style={dl.lineBoxWay}>
      <Text style={dl.line}>
        {room === 'jaeeon' ? '늦었어요. 태워다 줄게요' : '저도 그쪽 방향인데, 같이 갈래요?'}
      </Text>
    </View>
    <View style={dl.btns}>
      <Btn pink label="같이 가요" onPress={onRide}/>
      <Btn label="혼자 갈게요" onPress={onAlone}/>
    </View>
  </Dlg>;
}

/* ══ 4. 사물함 명패 ══
   갈 자리는 아니지만 누르면 한 마디 한다. 눌러도 아무 일이 없는 칸이
   여덟 중 둘이면 나머지 여섯도 안 눌러보게 된다.
   얼굴(kao)이 say와 따로 오는 건 픽셀 글꼴에 그 글자들이 없어서다. */
export function PlateDialog({kind, say, kao, onClose}:{kind:string; say:string; kao:string; onClose:()=>void}) {
  if (!say) return null;
  return <Dlg title={kind === 'start' ? 'START' : 'NULL'} onClose={onClose} z={40}>
    <View style={dl.lineBoxPlate}>
      <Text style={dl.line}>{say} <Text style={KAO}>{kao}</Text></Text>
    </View>
    <View style={dl.btns}>
      <Btn pink label="ok ♡" onPress={onClose}/>
    </View>
  </Dlg>;
}

/* ══ 5. 새 방 ══
   단톡방은 민현이 판다. 유저는 초대를 받은 쪽이라 무슨 방인지 모른 채로
   들어간다 — 그래서 「이 유」 칸이 비밀이다. 웹소설 상태창 형식이라
   항목과 값만 적고, 왜 만들었는지를 쓸 자리가 형식에 없다. */
export function GroupNewDialog({onClose}:{onClose:()=>void}) {
  return <Dlg title="null.exe" onClose={onClose} z={40}>
    <View style={dq.box}>
      <Text style={dq.k}>［ 새 방 ］♡</Text>
      <View style={dq.rows}>
        {([['이 름','단톡방',false],['초 대','이민현',false],['이 유','비밀',true]] as [string,string,boolean][])
          .map(([k,v,hush])=>
            <View key={k} style={dq.r}>
              <Text style={dq.k2}>{k}</Text>
              <View style={dq.dot}/>
              <Text style={[dq.v, hush && dq.hush]}>{v}</Text>
            </View>)}
      </View>
      <Text style={dq.s}>
        이민현이 방을 만들고 당신을 넣었어요{'\n'}
        <Text style={KAO}>( ˶˘ ᵕ ˘˶ )</Text> ♡
      </Text>
      {/* 이 창의 ok는 다른 창보다 좁다(웹의 .wbtn max-width:112px).
          알림이지 갈림길이 아니라서 단추가 창을 가로지를 이유가 없다 */}
      <View style={dq.btns}>
        <Btn label="ok ♡" style={{flex:0, width:112}} onPress={onClose}/>
      </View>
    </View>
  </Dlg>;
}

/* ══ 5.5 get cha ══
   첫 만남이 끝나고 그 사람의 메신저가 생기는 창. Dlg 껍데기를 안 쓴다:
   이 창만 본문이 어둡다. 앱이 전부 파스텔이라 파스텔 알림으로 띄우면
   「저장됐습니다」와 같은 무게가 된다. 뒤에는 방금 그 자리가 그대로 있다.
   웹 app-ui.js의 GetCha와 같은 창이다 — 문구도 모양도 같아야 한다. */
/* ══ 재언의 옛 일기 ══ 웹의 Diary와 같은 종이·같은 글월.
   재언 방에 처음 들어가는 순간, 그의 첫 마디 앞에 한 번.

   이 앱의 다른 창은 전부 가짜 OS다. 여기만 종이다 — 20년 전 것이고 화면에서
   나온 물건이 아니라 서랍에서 나온 물건이라서. 창틀도 메뉴바도 없다.

   마지막 한 칸은 유저가 채운다. 재언이 왜 돌아오겠다고 했는지는 재언이 쓴
   것이지만, 그 이유를 정하는 건 이 판을 사는 사람이다.

   ⚠️ 채운 값은 이 기기 안에만 산다. 어떤 요청에도 안 실린다. */
export function DiaryPage({onDone}:{onDone:(v:string)=>void}) {
  const [v, setV] = useState('');
  const t = v.trim();
  /* 사진을 못 읽는 사람에게는 적힌 글을 그대로 읽어준다 */
  const alt = [DIARY_HEAD, ...DIARY_LINES, DIARY_TAIL_A + '□' + DIARY_TAIL_B].join(' ');
  return <View style={[dl.ov, dy.ov, {zIndex:58}]}>
    <View style={dy.page}>
      <Image source={{uri:IMG+DIARY_IMG}} style={dy.shot} resizeMode="contain"
        accessible accessibilityLabel={alt}/>
      {/* ── 지워진 칸 ──
          사진에서 검게 지워진 그 자리에 그대로 앉는다. 종이 색으로 덮어 새로
          그리지 않는다 — 덮으면 조명도 결도 안 맞아서 붙인 티가 난다.
          검은 칸을 그대로 두고 그 위에 글자가 들어찬다. */}
      <TextInput style={[dy.blank, {left:`${DIARY_BOX.left}%`, top:`${DIARY_BOX.top}%`,
        width:`${DIARY_BOX.w}%`, height:`${DIARY_BOX.h}%`}]}
        value={v} onChangeText={setV} autoFocus maxLength={DIARY_MAX}
        onSubmitEditing={()=>{ if(t) onDone(t) }} returnKeyType="done"/>
    </View>
    {/* 채워야 넘어간다. 비워두면 이 화면이 할 일이 없다 */}
    <Bevel style={[dy.btn, !t && dy.btnOff]} disabled={!t}
      inner={{backgroundColor:'#ff9ec6'}} onPress={()=>{ if(t) onDone(t) }}>
      <Text style={dy.btnT}>덮기 ♡</Text></Bevel>
  </View>;
}
const dy = StyleSheet.create({
  ov:{backgroundColor:'rgba(20,13,36,.86)', paddingHorizontal:16, paddingVertical:20, gap:14},
  /* 사진 그대로. 줄공책을 그리지 않는다 — 물건은 흉내내면 물건이 아니게 된다 */
  page:{position:'relative', width:'100%', maxWidth:330, aspectRatio:1024/1536,
    borderRadius:3, overflow:'hidden'},
  shot:{width:'100%', height:'100%'},
  blank:{...F, position:'absolute', margin:0, paddingHorizontal:4, paddingVertical:0,
    fontSize:13, lineHeight:15, textAlign:'center', color:'#fdf3e2',
    backgroundColor:'transparent', borderWidth:0},
  btn:{alignSelf:'center', minWidth:104, height:38, paddingHorizontal:20, borderColor:'#ff8fbe'},
  btnOff:{opacity:.45},
  btnT:{...F, fontSize:11, letterSpacing:1.4, color:'#fff'},
});

/* ══ 모드 팝업 ══ 웹의 ModeAsk와 같은 글월·같은 자리.
   비율만 말하던 자리였다. 비율은 숫자고, 유저가 정하는 건 살아지는 방식이다 —
   앱을 꺼둔 동안에도 세계가 흐르는가, 엔딩이 언제 오는가.
   그리고 중간에 못 바꾼다는 것이 주석에만 있었다. 화면이 말 안 하는
   되돌릴 수 없는 선택은 선택이 아니라 함정이다. */
export const MODE_ASK:{[k:string]:{days:number; body:string; kao:string}} = {
  real:{days:1, body:'하루가 진짜로 지나갑니다. 앱을 꺼도 세계는 흐르고, 엔딩까지 한 달입니다.',
        kao:'٩(❛ัᴗ❛ั ๑)'},
  speed:{days:4, body:'빠르게 진행됩니다. 현실 하루에 게임 나흘이 지나요.',
        kao:'˚₊·͟͟͞͞ ➳❥'},
};
/* 비율은 문장이 아니다. 이 앱은 이미 눈금으로 말하는 법을 갖고 있다
   (이름 칸, D-day 막대). 한 칸 대 네 칸을 보여주면 읽지 않고도 안다. */
function MdRow({k, on, n}:{k:string; on:number; n:number}) {
  return <View style={md.rr}>
    <Text style={md.rrK}>{k}</Text>
    <View style={md.rrBx}>
      {[0,1,2,3].map(i => <View key={i} style={[md.cell, i < on && md.cellOn]}/>)}
    </View>
    <Text style={md.rrN}><Text style={md.rrNb}>{n}</Text>일</Text>
  </View>;
}
export function ModeDialog({which, now, onYes, onNo}:
  {which:string; now:boolean; onYes:()=>void; onNo:()=>void}) {
  if (!which) return null;
  const m = MODE_ASK[which] || MODE_ASK.real;
  return <Dlg title="null.exe" onClose={onNo} z={41}>
    {/* 고른 것이 제목이 된다. 확인창이 확인해야 하는 건 「무엇을 골랐는가」다 */}
    <View style={md.pick}>
      <Text style={md.pickT}>{which}</Text>
      <Text style={[md.kao, KAO]}>{m.kao}</Text>
    </View>
    <Text style={md.body}>{m.body}</Text>
    <View style={md.ratio}>
      <MdRow k="현 실" on={1} n={1}/>
      <MdRow k="게 임" on={m.days} n={m.days}/>
    </View>
    {/* 경고는 점선 상자에서 꺼낸다 — 이 앱에서 점선 둥근 상자는 「채워야 할
        빈칸」이라 경고를 담으면 입력 안 한 칸처럼 보인다 */}
    <View style={md.lock}>
      <View style={md.lockIco}><View style={md.lockArc}/><View style={md.lockBox}/></View>
      <Text style={md.lockT}>한 번 정하면 바꿀 수 없어요</Text>
    </View>
    <View style={md.btns}>
      <Btn label="back" onPress={onNo}/>
      <Btn pink label={now ? 'ok ♡' : '이걸로 ♡'} onPress={onYes}/>
    </View>
  </Dlg>;
}
const md = StyleSheet.create({
  pick:{flexDirection:'row', alignItems:'baseline', gap:9, paddingHorizontal:2},
  pickT:{...F, fontSize:26, letterSpacing:.5, color:'#ff5fa8'},
  kao:{fontSize:12, color:'#c0aee6'},
  body:{...F, marginTop:11, paddingHorizontal:2, fontSize:11.5, lineHeight:21, color:'#8a7fc0'},
  ratio:{marginTop:15, paddingTop:13, paddingHorizontal:13, paddingBottom:12, borderRadius:9,
    backgroundColor:'#fff', borderWidth:1, borderColor:'#e6ddf8'},
  rr:{flexDirection:'row', alignItems:'center', gap:9},
  rrK:{...F, width:32, fontSize:9, letterSpacing:1.4, color:'#9a8fc8'},
  rrBx:{flex:1, flexDirection:'row', gap:4},
  cell:{flex:1, height:15, borderRadius:3, backgroundColor:'#f4effd', borderWidth:1, borderColor:'#ddd2f4'},
  cellOn:{backgroundColor:'#ff9ec6', borderColor:'#ff9ec6'},
  rrN:{...F, fontSize:9.5, letterSpacing:.7, color:'#b0a6d8'},
  rrNb:{color:'#e0568f'},
  lock:{flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, marginTop:15},
  /* RN에는 svg가 없다. 자물쇠는 네모 하나와 고리 하나로 그린다 */
  lockIco:{width:10, height:11, alignItems:'center', justifyContent:'flex-end'},
  lockArc:{width:6, height:4, borderTopLeftRadius:3, borderTopRightRadius:3,
    borderWidth:1.3, borderBottomWidth:0, borderColor:'#c9b8e8'},
  lockBox:{width:9, height:6.5, borderRadius:1.6, borderWidth:1.2,
    borderColor:'#c9b8e8', backgroundColor:'#efe9fc'},
  lockT:{...F, fontSize:10, letterSpacing:.4, color:'#b09ecf'},
  btns:{flexDirection:'row', gap:9, marginTop:15},
});

export function GetChaDialog({name, onClose}:{name:string; onClose:()=>void}) {
  return <View style={[dl.ov, {zIndex:41}]}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
    <View style={dl.wrap}>
      <View pointerEvents="none" style={dl.shadow}/>
      <View style={[dl.win, gc.win]}>
        <LinearGradient colors={['#ff8fbe','#ffb0d4']} start={{x:0,y:0}} end={{x:1,y:0}} style={dl.tb}>
          <Text style={dl.tbT}>null.exe</Text>
          <Dots onClose={onClose}/>
        </LinearGradient>
        <View style={gc.body}>
          {/* 이름만 채워지는 빈칸 — 아직 아무도 아니었던 칸에 이 사람이 들어왔다 */}
          <View style={gc.slot}><Text style={gc.slotT}>{name}</Text><View style={gc.car}/></View>
          <Text style={gc.of}>의 메신저를</Text>
          <Text style={gc.get}>Get cha!</Text>
          <Text style={[gc.kao, KAO]}>( ⸝⸝´꒳`⸝⸝) ꫂ 💌</Text>
          <Bevel style={gc.btn} inner={{backgroundColor:'#ff9ec6'}} onPress={onClose}>
            <Text style={gc.btnT}>chat ♡</Text></Bevel>
        </View>
      </View>
    </View>
  </View>;
}
const gc = StyleSheet.create({
  win:{backgroundColor:'#2b2352', borderColor:'rgba(255,255,255,.9)'},
  body:{paddingHorizontal:17, paddingTop:22, paddingBottom:19, alignItems:'center'},
  slot:{flexDirection:'row', alignItems:'center', justifyContent:'center', gap:5,
    minWidth:126, height:42, paddingHorizontal:15, borderRadius:7,
    backgroundColor:'rgba(255,255,255,.06)', borderWidth:2, borderStyle:'dashed', borderColor:'#ff8fbe'},
  slotT:{...F, fontSize:16, letterSpacing:2, color:'#ff9ec6'},
  car:{width:2, height:19, backgroundColor:'#ff5fa8'},
  of:{...F, marginTop:13, fontSize:11.5, color:'#c6b8f0'},
  get:{...F, marginTop:7, fontSize:22, color:'#ff8fbe'},
  kao:{marginTop:7, fontSize:11, color:'#a394d8'},
  btn:{marginTop:19, height:44, minWidth:118, paddingHorizontal:26, flex:0},
  btnT:{...F, fontSize:12.5, letterSpacing:2, color:'#fff'},
});

/* ══ 6. 교실 문틈 ══
   수업 중엔 대화가 아니라 구경이다. 교실 배경을 어둡게 깔고 그 애 사진
   한 장을 폴라로이드처럼 얹는다. 캐비닛 TV처럼 아무 데나 누르면 돌아간다.
   말풍선도 도장도 없다 — 방문이 아니니까. */
/* ══ 사진 보기 ══ 웹의 PhotoWin과 같은 창.
   이 앱에서 「앱 위에 얹히는 것」은 전부 창이다(gift·bag·map·yaja.exe).
   사진만 검은 공백에 떠 있었다. 그 사진들은 전부 표면 위에 놓인 물건을 찍은
   것이라 이미 자기 세계를 들고 온다 — 검정은 그 세계를 버리고 두 번째 세계를
   하나 더 얹는 일이었다. 뒤로 앱이 비치면 떠난 게 아니라 가까이 본 게 된다.
   부르는 자리가 셋이다(사진첩·히든·말풍선). 셋이 각자 그리면 어긋난다. */
type PvFill = {left:number; top:number; w:number; h:number; text:string};
export function PhotoWin({shot, onClose}:
  {shot:string|{uri:string; label?:string; note?:string;
                back?:string; fill?:PvFill[]; backFill?:PvFill[]}|null; onClose:()=>void}) {
  /* 사진마다 비율이 다르다(1024×1536도 있고 1122×1402도 있다). 웹은 height:auto로
     원본 비율이 저절로 나오는데 RN은 미리 알려줘야 해서, 흔한 쪽으로 그려두고
     사진이 도착하면 실제 값으로 고친다. 안 그러면 얼굴이 늘어난다. */
  const [ratio, setRatio] = useState(1024/1536);
  /* 훅은 조건부 return 위에 있어야 한다 — 밑으로 내려가면 사진이 없는
     렌더에서 훅 수가 달라져 터진다 */
  const [back, setBack] = useState(false);
  const keyOf = typeof shot === 'string' ? shot : ((shot && shot.uri) || '');
  useEffect(()=>{ setBack(false) }, [keyOf]);   // 딴 사진을 열면 다시 앞면부터
  if (!shot) return null;
  const one   = typeof shot === 'string';
  const label = one ? '' : (shot.label || '');
  const note  = one ? '' : (shot.note || '');
  /* 뒷면이 있는 것은 엽서 하나다. 누르면 넘어간다 — 뒤집는 단추를 따로
     달지 않는다. 엽서를 뒤집는 데 단추가 필요한 적은 없었다 */
  const flip  = one ? undefined : shot.back;
  const uri   = (back && flip) ? flip : (one ? shot : shot.uri);
  const fill  = ((back && flip) ? (one ? [] : shot.backFill) : (one ? [] : shot.fill)) || [];
  return <View style={[dl.ov, pv.ov, {zIndex:50}]}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose}/>
    <View style={[dl.wrap, pv.wrap]}>
      <View pointerEvents="none" style={dl.shadow}/>
      <View style={dl.win}>
        <LinearGradient colors={['#ff8fbe','#ffb0d4']} start={{x:0,y:0}} end={{x:1,y:0}} style={dl.tb}>
          <Text style={dl.tbT}>photo</Text>
          <Dots onClose={onClose}/>
        </LinearGradient>
        <View style={pv.body}>
          <Pressable disabled={!flip} onPress={()=>setBack(b=>!b)}>
            <View>
              <Image source={{uri}} resizeMode="contain"
                onLoad={(e:any)=>{ const s = e && e.nativeEvent && e.nativeEvent.source;
                  if (s && s.width && s.height) setRatio(s.width/s.height) }}
                style={[pv.img, {aspectRatio:ratio}]}/>
              {/* 유저가 채운 칸 — 사진 위 제자리에 앉는다. 사진이 contain으로
                  그려지고 이 층도 같은 비율 상자라 퍼센트가 사진 위에 떨어진다 */}
              {!!fill.length && <View pointerEvents="none"
                style={[StyleSheet.absoluteFillObject]}>
                {fill.map((f,i)=><Text key={i} numberOfLines={1} style={[pv.fill,{
                  left:(f.left+'%') as any, top:(f.top+'%') as any,
                  width:(f.w+'%') as any, height:(f.h+'%') as any}]}>{f.text}</Text>)}
              </View>}
            </View>
          </Pressable>
          {!!label && <View style={pv.cap}>
            <Text style={pv.capT}>{label}</Text>
            {!!note && <Text style={pv.capN}>{note}</Text>}
          </View>}
        </View>
        {/* 알약은 사진에 붙는다. 창 안이라 떠 있을 자리가 없다 */}
        <View style={pv.foot}>
          <Bevel style={pv.btn} inner={{backgroundColor:'#ff9ec6'}} onPress={onClose}>
            <Text style={pv.btnT}>덮기 ♡</Text></Bevel>
        </View>
      </View>
    </View>
  </View>;
}
const pv = StyleSheet.create({
  ov:{padding:16},
  wrap:{maxWidth:'100%'},
  body:{paddingHorizontal:11, paddingTop:11},
  img:{width:'100%', borderRadius:5},
  cap:{marginTop:9, paddingVertical:8, paddingHorizontal:10, borderRadius:6,
    borderWidth:1, borderColor:'#cfc6ee', backgroundColor:'rgba(255,253,255,.96)'},
  capT:{...F, marginBottom:4, fontSize:10, letterSpacing:1.4, color:'#8a7fc0'},
  capN:{...F, fontSize:11.5, lineHeight:19, color:'#4a4276'},
  /* 유저가 채운 칸 — 종이 위 연필이라 창의 보랏빛이 아니다 */
  fill:{...F, position:'absolute', fontSize:11, lineHeight:14, color:'#5b4a3a', textAlign:'center'},
  foot:{flexDirection:'row', alignItems:'center', gap:7, padding:11},
  btn:{flex:1, height:38, borderColor:'#ff8fbe'},
  btnT:{...F, fontSize:11, letterSpacing:1.2, color:'#fff'},
});

/* ── ⑨ 키스타임 ──
   화면이 통째로 그 얼굴이 되는 순간. 말풍선으로 오면 「상대가 보낸 셀카」로
   읽히고 그건 POV가 아니다 — 그래서 창이 아니라 화면이다. 창틀도 여백도 없다.

   단추가 없다. 유저가 고르는 장면이 아니라 유저가 보고 있는 것이라서
   뜨고 잠깐 있다가 저절로 접힌다. 급하면 아무 데나 누르면 접힌다.

   접촉은 화면 밖이다. 눈 감은 얼굴에서 끝난다.
   판정은 여기 없다: 이 화면이 떴다는 것은 워커가 두 문을 다 봤다는 뜻이다. */
export function KissTime({shot, rise, hold, out, onDone}:
  {shot:string; rise:number; hold:number; out:number; onDone:()=>void}) {
  const fade = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(1.09)).current;
  const done = useRef(false);
  const close = () => {
    if (done.current) return; done.current = true;
    Animated.timing(fade, {toValue:0, duration:out, useNativeDriver:true}).start(onDone);
  };
  useEffect(()=>{
    /* 다가오는 것이지 나타나는 게 아니다 — 살짝 크게 시작해 제자리에 앉는다 */
    Animated.parallel([
      Animated.timing(fade, {toValue:1, duration:rise, useNativeDriver:true}),
      Animated.timing(zoom, {toValue:1, duration:rise, useNativeDriver:true}),
    ]).start();
    const t = setTimeout(close, rise + hold);
    return ()=>clearTimeout(t);
  },[]);
  if (!shot) return null;
  return <Pressable style={ks.ov} onPress={close}>
    <Animated.Image source={{uri: IMG + shot + '.webp'}} resizeMode="cover"
      style={[StyleSheet.absoluteFill, {opacity:fade, transform:[{scale:zoom}]}]}/>
  </Pressable>;
}
const ks = StyleSheet.create({
  ov:{...StyleSheet.absoluteFillObject, zIndex:58, backgroundColor:'#0d0918'},
});

export function LookOverlay({shot, onClose}:{shot:string; onClose:()=>void}) {
  const {height} = useWindowDimensions();
  /* 사진마다 비율이 다르다(1024×1536도 있고 1122×1402도 있다). 웹은 height:auto로
     원본 비율이 저절로 나오는데 RN은 비율을 미리 알려줘야 해서, 일단 흔한 쪽으로
     그려두고 사진이 도착하면 실제 값으로 고친다. 안 그러면 얼굴이 늘어난다. */
  const [ratio, setRatio] = useState(1024/1536);
  if (!shot) return null;
  return <Pressable style={lk.ov} onPress={onClose}>
    <Image source={{uri: IMG + 'place-class.webp'}} resizeMode="cover" style={StyleSheet.absoluteFill}/>
    {/* RN에는 CSS filter가 없다. brightness(.5)를 어두운 막 한 겹으로 대신한다 —
        사진을 보러 온 화면이라 배경이 밝으면 폴라로이드가 안 뜬다 */}
    <View pointerEvents="none" style={lk.dim}/>
    {/* 웹은 top:43%로 가운데보다 조금 위에 건다. 화면 높이의 7%만큼 끌어올리면
        같은 자리다 — 아래에 남는 자리가 캡션 몫이다 */}
    <View pointerEvents="none" style={[lk.shotWrap, {transform:[{translateY:-height*0.07}]}]}>
      <View style={lk.shot}>
        <Image source={{uri: IMG + shot}} resizeMode="cover"
          onLoad={(e:any)=>{ const s = e && e.nativeEvent && e.nativeEvent.source;
            if (s && s.width && s.height) setRatio(s.width/s.height) }}
          style={{width:'100%', aspectRatio:ratio, borderRadius:1}}/>
      </View>
    </View>
    <Text style={[lk.cap, {bottom:height*0.13}]}>CLASS MODE ON!{'\n'}대화는 OFF, 살짝만 PEEK <Text style={KAO}>(՞ ⸝⸝&gt; ̫ &lt;⸝⸝ ՞)</Text></Text>
  </Pressable>;
}

const dl = StyleSheet.create({
  ov:{...StyleSheet.absoluteFillObject, alignItems:'center', justifyContent:'center',
    padding:26, backgroundColor:'rgba(74,66,118,.4)'},
  wrap:{width:'100%', maxWidth:290},
  /* 웹의 box-shadow 0 3px 0 — 안드로이드의 elevation은 무조건 블러라 뷰로 그린다 */
  shadow:{position:'absolute', left:0, top:3, right:0, bottom:-3,
    backgroundColor:'rgba(150,135,210,.35)', borderRadius:8},
  win:{width:'100%', backgroundColor:'#ffd0e4', borderWidth:1, borderColor:P.border,
    borderRadius:8, overflow:'hidden'},
  tb:{flexDirection:'row', alignItems:'center', paddingHorizontal:11, paddingVertical:8,
    borderBottomWidth:1, borderBottomColor:P.border},
  tbT:{...F, color:'#fff', fontSize:12, letterSpacing:1.2,
    textShadowColor:'rgba(93,84,144,.55)', textShadowOffset:{width:1,height:1}, textShadowRadius:0},
  body:{paddingTop:18, paddingHorizontal:16, paddingBottom:16, gap:8},

  // .dlgline — 인라인으로 덮이는 padding까지 자리별로 그대로 옮긴다
  lineBox:{paddingTop:10, paddingBottom:4},
  lineBoxWay:{paddingVertical:10},
  lineBoxPlate:{paddingTop:14, paddingBottom:12},
  line:{...F, fontSize:13, lineHeight:25, color:'#8a4f74', textAlign:'center'},
  // .asklock — 두 줄로 끊는다. 한 줄로 늘어놓으면 창이 옆으로 벌어지고 얼굴이 잘린다
  lock:{...F, fontSize:11.5, lineHeight:22, color:'#a06a90', textAlign:'center'},
  lockI:{color:'#e66fa4'},
  // .askrule — 상자를 두르면 창 안에 창이 하나 더 생긴다. 글자색만 달리한다
  rule:{...F, marginHorizontal:14, marginBottom:11, fontSize:10.5, lineHeight:16,
    letterSpacing:.2, color:'#d47aa8', textAlign:'center'},
  why:{...F, paddingBottom:8, fontSize:10, lineHeight:17, letterSpacing:.8,
    color:'#b4a7d6', textAlign:'center'},

  // .askwho / .whobtn
  who:{flexDirection:'row', gap:7, marginHorizontal:12, marginBottom:10},
  whoIn:{flexDirection:'row', gap:6, paddingVertical:7, paddingHorizontal:6},
  whoOn:{backgroundColor:'#ffc2e2'},
  whoT:{...F, fontSize:11, color:P.ink},
  /* .whobtn.on — 고른 쪽은 흰 글씨다. 분홍 위에 남색을 얹으면 골랐다기보다
     흐려진 것처럼 보여서, 고른 칸과 못 고르는 칸이 같은 얼굴이 된다 */
  whoTOn:{color:'#fff', textShadowColor:'rgba(170,80,140,.5)',
    textShadowOffset:{width:0,height:1}, textShadowRadius:0},

  btns:{flexDirection:'row', gap:7, marginTop:10},
  btnT:{...F, fontSize:12, color:P.ink, letterSpacing:2},
});

/* .ddq — null.exe의 상태 줄. 웹소설 상태창 형식이라 항목과 값만 적는다 */
const dq = StyleSheet.create({
  box:{paddingTop:4, paddingHorizontal:2, paddingBottom:2, alignItems:'center'},
  k:{...F, fontSize:8.5, letterSpacing:2.4, color:'#d0b3dd', textAlign:'center'},
  rows:{width:'100%', maxWidth:190, marginTop:12, gap:6},
  r:{flexDirection:'row', alignItems:'center', gap:7},
  k2:{...F, width:42, fontSize:9.5, letterSpacing:1.9, color:'#d0b3dd', textAlign:'left'},
  /* 점선 한 줄. 웹은 repeating-linear-gradient인데 RN에는 없어서 dashed 테로 낸다 —
     안드로이드가 이걸 실선으로 그리는 날이 있지만 여기서는 칸을 잇는 선일 뿐이라
     실선이어도 뜻이 안 바뀐다 */
  dot:{flex:1, height:1, borderTopWidth:1, borderStyle:'dashed', borderColor:'#e0d5f7'},
  v:{...F, fontSize:9.5, letterSpacing:.95, color:'#6b5fa8'},
  /* 비밀은 회색이 아니라 분홍이다. 못 보는 것과 안 알려주는 것은 다르다 */
  hush:{color:'#c98fb8'},
  s:{...F, marginTop:14, fontSize:9.5, lineHeight:18.5, letterSpacing:.57,
    color:'#b09ecf', textAlign:'center'},
  btns:{flexDirection:'row', justifyContent:'center', marginTop:10},
});

const lk = StyleSheet.create({
  ov:{...StyleSheet.absoluteFillObject, zIndex:42, backgroundColor:'#1a1424',
    alignItems:'center', justifyContent:'center'},
  dim:{...StyleSheet.absoluteFillObject, backgroundColor:'rgba(26,20,36,.5)'},
  shotWrap:{width:'100%', alignItems:'center'},
  /* 폴라로이드 — 아래 여백이 넓어야 사진이 아니라 인화물로 보인다.
     살짝 기울여두는 것도 같은 이유다(누가 놓고 간 것처럼) */
  shot:{width:'66%', maxWidth:240, paddingTop:7, paddingHorizontal:7, paddingBottom:24,
    backgroundColor:'#fdf9f2', borderRadius:2, transform:[{rotate:'-2deg'}],
    shadowColor:'#0a0414', shadowOffset:{width:0,height:8}, shadowOpacity:.55, shadowRadius:22,
    elevation:12},
  cap:{...F, position:'absolute', left:0, right:0, textAlign:'center',
    fontSize:11, letterSpacing:1.5, color:'#fff',
    textShadowColor:'rgba(10,4,20,.9)', textShadowOffset:{width:0,height:1}, textShadowRadius:7},
});
