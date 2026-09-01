/* NULL web · demo, time labels, presence, openings, observation
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다. */
/* ── 데모 모드 ──
   키가 없거나 API가 죽어도 빈 화면을 보여주지 않는다. 각본이라도 움직이는 편이 낫다.
   ?demo=1 로 켜지면 계속 데모다. 그게 아니면 실패한 턴만 각본으로 메우고
   다음 전송에서 진짜를 다시 시도한다 — 전에는 한 번 실패하면 세션 내내
   데모였다. 429 한 번에 그 뒤의 모든 대화가 조용히 각본이 됐고, 며칠 쌓인
   세이브를 가진 사람에게 그건 구조가 아니라 사고다. auto는 「지난 호출이
   실패했다」는 표시일 뿐이고 성공하면 꺼진다.
   실패 원인은 콘솔에 그대로 남기고 하단 바에 demo 표시가 뜬다 — 조용히 가짜로
   바뀌면 진짜 장애를 못 알아채기 때문이다.

   대사와 매칭은 demo-lines.js에 있다. 그 파일은 docs/dialogue-corpus.md에서
   만들어진다 — 대사를 고칠 때는 문구집을 고치고 node tools/build-demo.mjs를 돌린다.
   앱도 같은 파일을 쓴다(app/lib/demoLines.ts). 한쪽만 고쳐질 일이 없다. */
/* 데모는 ?demo=1로 고른 것만이다. 실패해서 자동으로 넘어가는 길(auto)은 없앴다 —
   실패를 각본으로 메우면 잠긴 것도 키가 죽은 것도 한도가 바닥난 것도
   전부 「잘 되는 중」으로 보인다. */
const DEMO={on:new URLSearchParams(location.search).has("demo")};
/* ── 지금은 깨어 있는 걸로 친다 ──
   자는 시간에 붙잡고 고쳐볼 일이 있다. ?awake면 둘 다, ?awake=jaeeon이면
   그 사람만 자는 시간을 건너뛴다. 주소에 붙였을 때만 돌아서 평소에는 없다.
   점에는 「깨워둠」이라고 적는다 — 이게 진짜 시계가 아니라는 걸 보이게. */
const AWAKE=(()=>{
  const q=new URLSearchParams(location.search);
  if(!q.has("awake"))return null;
  const w=(q.get("awake")||"").trim();
  return w?w.split(",").map(x=>x.trim()).filter(Boolean):"all";
})();
const forcedAwake=id=>AWAKE==="all"||(Array.isArray(AWAKE)&&AWAKE.includes(id));
const demoOn=()=>DEMO.on;
/* 가까워졌는지. 셀카를 줄지 말지가 여기서 갈린다 — 처음부터 주면
   그건 셀카가 아니라 프로필 사진이다. 균열 단계(40마디)를 기준으로 삼는다. */
/* 대화가 얼마나 쌓였는지는 App 안에만 있다. 여기서 바로 못 읽으므로 받아서 쓴다 —
   모듈 바깥에서 App 안의 것을 참조하면 부를 때마다 터진다. 한 번 그랬다. */
const demoClose=(msgs,room)=>((((msgs||{})[room])||[]).length)>=40;
const demoReply=(bucket,lastText,userName,msgs,gift)=>
  demoAnswer(bucket,lastText,userName,{close:demoClose(msgs,bucket),gift:gift});
/* 해금은 원래 서버가 세어서 내려준다. 데모에는 서버가 없으니 같은 기준으로
   여기서 센다 — 안 그러면 .hidden이 영영 0/12로 남는다. */
const demoUnlocked=msgs=>{const d=daysSince({msgs});return HIDDEN.filter(h=>(((msgs||{})[h.room]||[]).length)>=h.at&&d>=h.day).map(h=>h.key)};
/* 문구집에 물어볼 말. 유저가 방금 친 말이다. 시스템 줄("…을(를) 받았다")은
   유저가 한 말이 아니라서 그대로 넘기면 아무것도 안 걸린다. */
const demoAsk=payload=>{
  const last=[...(payload.history||[])].reverse().find(m=>m.role==="user");
  return last&&last.content;
};
/* 선물은 말이 아니라 물건이다. 이름을 문장으로 꾸며 매칭에 태우면
   "회색 머그컵 선물이에요"가 아무 데도 안 걸려서 못 알아들었다는 답이 나갔다.
   열쇠를 그대로 넘겨 표에서 바로 찾는다. */
const demoGiftKey=payload=>(payload.gift&&payload.gift.key)||null;

/* ── 화면은 세계의 시각을 말한다 ──
   저장된 ts는 현실 epoch지만, 그리는 순간 gameAt으로 번역한다. 프롬프트와
   시간표는 게임 시각을 보는데 화면만 진짜 시각을 찍으면 — 인물은 「저녁이네요」
   하는데 말풍선 옆에는 오후 두 시가 붙는, 화면이 거짓말하는 그림이 됐다.
   리얼 모드에서는 번역이 항등이라 아무것도 안 변한다. */
const fmtClock=ts=>{const d=gameAt(ts);const h=d.getHours(),ap=h<12?"오전":"오후";return `${ap} ${h%12||12}:${String(d.getMinutes()).padStart(2,"0")}`};
/* 「오늘」도 세계의 오늘이다 — 진짜 달력과 견주면 게임 하루가 넷으로 쪼개진다 */
const isToday=ts=>gameAt(ts).toDateString()===nowClock().toDateString();
const fmtDivider=ts=>{const d=gameAt(ts);return isToday(ts)?fmtClock(ts):`${d.getMonth()+1}월 ${d.getDate()}일 ${fmtClock(ts)}`};

/* 괄호만으로 된 말풍선은 대사가 아니라 행동 지문이다 — 말풍선 대신 채팅창에 쳐진 줄로 그린다.
   서버가 줄 단위로 갈라서 보내주므로 여기서는 통째로 괄호인지만 보면 된다. */
/* 지문처럼 그릴 줄: 괄호로만 된 대사, 그리고 선물처럼 "일어난 일"을 적은 sys 줄 */
const isNarr=m=>!!m&&!m.photo&&(m.sys===true||/^[（(][^()（）]*[)）]$/.test((m.text||"").trim()));
const fmtListTime=ts=>{const d=gameAt(ts);return isToday(ts)?fmtClock(ts):`${d.getMonth()+1}월 ${d.getDate()}일`};
const MON=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const fmtDay=ts=>{const d=gameAt(ts),y=d.getFullYear();
  return `${MON[d.getMonth()]} ${d.getDate()}`+(y!==nowClock().getFullYear()?", "+y:"")};
/* 시간 구분선의 「한참 지났다」도 세계의 십 분이다. 진짜 십 분으로 재면
   스피드 모드에서 게임 사십 분이 소리 없이 지나간다 */
const dividerGap=(prevTs,ts)=>!prevTs||gameAt(ts).getTime()-gameAt(prevTs).getTime()>10*60*1000;

/* ── 지금이 언제인가 ──
   몇 시인지는 안 보낸다. 분 단위를 주면 「7시 42분이네요」 같은 말이 나온다.
   때만 준다. presence와 같은 시계를 봐야 한다 — 방 목록에는 「야자」라고
   떠 있는데 인물은 아침인 줄 알고 말하면 그게 제일 이상하다.
   서버에서 재면 안 된다. 워커는 UTC로 돌고 어느 엣지에 뜨는지도 그때그때다. */
const timeWord=now=>{const h=(now||nowClock()).getHours();
  return h<2?"밤":h<6?"새벽":h<11?"아침":h<17?"낮":h<21?"저녁":"밤"};
/* 요일은 때보다 세다. 주말이면 학교가 통째로 없어지고, 그러면 이 셋을
   묶고 있던 건물이 사라진다 — 만나려면 학교 밖으로 나가야 한다 */
const dayWord=now=>"일월화수목금토"[(now||nowClock()).getDay()]+"요일";
/* ── 계절 ──
   요일과 때만 보내고 계절을 안 보냈다. 그래서 팔월에 「눈이 그제보다 덜
   오네요」가 나왔다. 날씨는 인물이 창밖을 보면 바로 나오는 말이라, 안
   알려주면 지어낸다. 달까지는 안 준다 — 「8월 18일」을 주면 날짜를 세기
   시작한다. 계절 하나면 창밖 얘기는 안 틀린다.

   달력에서 뽑던 것을 겨울로 못박는다. 팔월에 계절을 보내는데도 눈이 여섯 번
   왔다. 필터가 진 게 아니라 세계가 겨울로 쓰여 있어서다 — 세계관 첫 줄이
   「겨울이 끝나가는 시점」이고, 긴 겨울·눈 온 날 사진·장갑·목도리·핫팩·
   비니가 전부 그 계절 소품이다. 그 앞에서 가변부 끝의 낱말 하나가 이길
   수 없다. 이 세계의 시계는 하루와 요일만 돌고 계절은 안 돈다. */
const seasonWord=()=>"겨울";
/* ── 자는 사람은 먼저 말을 안 건다 ──
   새벽 세 시에 앱을 처음 켜면 둘 다 몇 초 안에 인사를 보냈다. 목록에는
   「자는 중」이라고 떠 있는데 그 사람 말풍선이 왔다.
   그리고 이 앱은 유저가 없어도 세계가 돌아간다고 말하는 앱인데, 켜자마자
   둘이 인사하면 돌아가고 있던 게 아니라 기다리고 있던 게 된다.

   전에는 재언만 여섯 시로 못박은 상수를 따로 두고 강현은 시각을 안 봤다.
   그런데 강현에게도 꺼진 시간(3~8시)이 생겼다 — 점은 「꺼짐」인데 그 사람
   말풍선이 오면 처음 고치려던 그림 그대로다. 시계를 둘 두지 않는다.
   목록의 점을 정하는 presence가 선톡도 정한다 — off면 안 건다.
   재언은 여섯 시에 깨니(1~6시 off) 예전과 같은 시각에 인사가 온다.

   그래서 새벽에 시작한 사람은 첫 화면에서 두 가지를 공짜로 안다 —
   한 명은 이 시간에 깨 있는 애고 한 명은 자는 어른이라는 것,
   그리고 내가 켠다고 이 세계가 다 깨어나지는 않는다는 것. */
const canGreet=(id,now)=>{
  const pr=presence(id,now);
  return !pr||pr.s!=="off";
};
/* ── 자는 사람은 답이 없다 ──
   같은 시계(presence)의 off를 반대쪽에서도 본다. 먼저 안 거는 것만으로는
   모자랐다 — 밤에 말을 걸면 답은 꼬박꼬박 왔고, 대신 재언이 「자요, 이제」를
   서른세 분에 열다섯 번 말했다. 끝내려는 사람이 끝낼 수가 없었던 것이다.
   무슨 말을 걸든 반드시 답이 오는 세계에는 「답하지 않는다」는 수가 없어서,
   대화를 닫으려는 인물이 같은 말을 반복하는 것 말고 할 수 있는 게 없었다.

   그래서 자는 시간에는 부르지 않는다. 보낸 말은 그대로 남고, 깨어난 뒤의
   대화에 이력으로 실려 간다 — 밤새 쌓인 말을 아침에 읽은 사람이 된다.
   호출을 아예 안 하므로 비용도 안 나간다. */
const asleep=(id,now)=>{
  const pr=presence(id,now);
  return !!pr&&pr.s==="off";
};
/* 이 방 사람이 다 자고 있나. 단톡방은 한 사람만 깨 있어도 답이 온다 —
   그 방에서 자는 쪽의 말풍선은 워커가 지운다(states를 보고). */
const allAsleep=(room,now)=>(room==="group"?["jaeeon","minhyun"]:[room])
  .every(id=>asleep(id,now));
/* 관전방은 둘이 마주 앉은 자리다. 한 사람만 자도 그 대화는 없던 일이므로
   여기는 allAsleep(둘 다)이 아니라 어느 한쪽이라도 자면 막는다.
   재언이 자는데 「두 사람」방에서는 떠들고 있었다 — 목록에는 「자는 중」이
   떠 있는 사람이 옆방에서 말을 하고 있으면 그 점이 거짓말이 된다.
   재는 시각은 지금이 아니라 그 대화가 찍힐 시각이다. 관전 대화는 유저가
   자리를 비운 한 시간쯤 뒤로 거슬러 찍히므로, 지금 깨어 있는지가 아니라
   그때 깨어 있었는지를 봐야 한다. */
const bothAwake=now=>!asleep("jaeeon",now)&&!asleep("minhyun",now);

/* ── 첫 자리 ──
   전에는 앱을 켜면 둘이 인사를 보내는 걸로 시작했다. 그건 알림이지 만남이 아니다.
   지금은 시작한 시각이 첫 자리를 정한다. 거기서 한 사람을 만나고, 다른 한 사람은
   첫인사를 보낸다 — 그래서 첫 화면에서 이미 둘의 시간대가 갈린다.

   시간 경계는 timeWord와 같다(새벽 2·아침 6·낮 11·저녁 17·밤 21). 화면에
   「저녁」이라고 떠 있는데 아침 자리에서 시작하면 그게 제일 이상하다.
   딱 하나 19시만 timeWord에 없는 경계다 — 저녁 띠를 둘로 갈랐다.
   퇴근하고 바로 잡히는 자리(정류장)와, 한 번 들렀다 가는 자리(도서관)는
   같은 「저녁」이라도 시각이 다르다. 화면의 시간대 표시는 어차피 둘 다
   「저녁」이라 어긋나 보이지 않는다.

   note는 지문이다. 왜 거기 있는지 한 줄로 적어준다 — 손을 베였다거나 동전이
   없다거나. 대사가 아니라 상황이라 여기 있어도 된다.
   골목과 정류장은 지도에 없는 자리다. 귀갓길과 같은 길로 들어간다.
   첫 자리는 열려 있는 시간을 안 본다 — 고른 자리가 아니라 정해진 자리라서. */
const OPENINGS=[
  /* 새벽. 라면 하나 놓고 마주 앉는다 */
  {from:2,  place:"편의점",     room:"minhyun", note:"라면을 먹으러 편의점에 들렀다."},
  /* 아침. 등굣길에 지나는 골목에서 마주친다 — 처음 만난 자리는 병원 옥상이다 */
  {from:6,  place:"후문 골목",   room:"minhyun", bg:"minhyun-alley.webp",
   note:"후문 골목으로 들어섰다."},
  /* 낮. 제 발로 간 게 아니라 손을 베여서 내려온 것이다 */
  {from:11, place:"보건실",     room:"jaeeon",  note:"손을 베여 보건실에 내려왔다."},
  /* 저녁 앞. 퇴근길에 붙잡힌다 */
  {from:17, place:"버스정류장",  room:"minhyun", bg:"minhyun-busstop.webp",
   note:"퇴근길 버스정류장에 섰다."},
  /* 저녁 뒤. 곧장 집에 안 가고 들른 데다. 도서관은 22시까지 열려 있고
     삼 층은 늘 비어 있다 — 퇴근한 사람이 혼자 있기 좋은 자리라서.
     도서관은 wendOnly다. 그건 유저가 지도에서 골라 가는 것에 대한 규칙이고
     (「평일엔 못 간다 — 둘 다 학교에 매여 있고」), 첫 자리는 고른 자리가
     아니다. 그리고 19시면 재언은 이미 퇴근해서 매여 있지 않다.
     answerMove가 wendOnly를 안 보는 것과 같은 예외다. */
  {from:19, place:"도서관",     room:"jaeeon",  note:"퇴근길에 도서관에 들렀다."},
  /* 밤. 동전이 없다 */
  {from:21, place:"빨래방",     room:"jaeeon",  note:"빨래방에 왔는데 동전이 없다."},
];
/* 주말엔 정해진 자리가 없다.
   평일은 시간표가 사람을 어디 있게 한다 — 여덟 시에 출근하고 네 시에 수업이
   끝나니까 그 시각엔 거기 있다. 주말은 그게 없어서 아무 데나 있을 수 있다.
   그래서 뽑는다. 그 시각에 열려 있는 자리 중에서 하나.
   학교 안 넷은 애초에 안 열린다(wend:false). 집은 뺐다 — 처음 만나는 날에
   남의 집에 가 있을 수는 없다. */
const WEND_OPEN=[
  {place:"편의점",    room:"minhyun", note:"라면을 먹으러 편의점에 들렀다."},
  {place:"도서관",    room:"jaeeon",  note:"도서관 삼 층에 올라왔다."},
  {place:"레코드샵",  room:"minhyun", note:"레코드샵 중고반 상자를 뒤졌다."},
  {place:"빨래방",    room:"jaeeon",  note:"빨래방에 왔는데 동전이 없다."},
  {place:"후문 골목",  room:"minhyun", bg:"minhyun-alley.webp",   note:"후문 골목으로 들어섰다."},
  {place:"버스정류장", room:"minhyun", bg:"minhyun-busstop.webp", note:"버스를 기다렸다."},
];
const openingFor=now=>{
  const d=now||nowClock(), h=d.getHours();
  if(isWend(d)){
    /* 지도에 없는 자리(골목·정류장)는 여는 시각이 없다. 늘 후보다 */
    const open=WEND_OPEN.filter(o=>{const p=PLACE_BY[o.place];return !p||placeHours(p,d)});
    if(open.length)return open[Math.floor(Math.random()*open.length)];
  }
  /* 21시부터 다음날 2시까지가 밤이다. 자정을 넘어가는 띠라 표에서 못 찾는다 */
  return OPENINGS.slice().reverse().find(x=>h>=x.from)||OPENINGS[OPENINGS.length-1];
};

/* ── 야자가 붙는 날 ──
   격주. 어느 주부터인지는 유저 사정이 아니라 학교 사정이라 달력으로 센다.
   야자는 2017년쯤 강제가 없어져서 희망자만 남는 자율학습이다 — 매일이
   아니라 유저가 감독으로 남는 격주 목요일에만 붙는다.

   시간표(daySlots)는 처음부터 그렇게 세고 있었는데 생활 리듬(presence)만
   평일 저녁을 통째로 「야자」라고 불렀다. 시계가 둘이면 AT_WORK가 그
   거짓말을 그대로 받는다 — 야자도 없는 수요일 저녁에 강현이 아직 학교에
   있는 것이 되어, 안 만난 쪽 방이 열리고 선톡이 나갔다. 한 군데서 센다.

   presence 바로 위에 둔다 — 시험이 presence를 떼어 돌릴 때 이 셋이 같이
   딸려 와야 한다(그래서 시험의 자르는 자리도 weekNo부터다). */
const weekNo=d=>Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5+3)/7);
const isYajaWeek=(now)=>weekNo(now||nowClock())%2===0;
const isYajaDay=(now)=>{const d=now||nowClock();return d.getDay()===4&&isYajaWeek(d)};

/* 수업 여부와 상단 시간표가 같은 칸을 본다. 이 표를 둘로 적으면 화면에는
   「쉬는시간」인데 교실은 여전히 CLASS 중인 것처럼 잠기는 틈이 생긴다. */
const PERIODS=[[520,570,1],[580,630,2],[640,690,3],[700,750,4],
               [810,860,5],[870,920,6],[930,980,7]];   // 분 단위 · 시작·끝·교시

/* ── 접속 상태 ──
   시간대만 보고 정한다. 서버를 부르지 않으므로 비용이 없다.
   재언은 근무 시간에 보건실에 있고, 강현은 학교에 매여 있다.
   이 값은 이제 워커에도 실린다(states) — 목록에는 「수업 중」이 떠 있는데
   본인은 한가한 사람처럼 즉답하던 것이 여기서 고쳐진다. 화면과 프롬프트가
   같은 함수를 봐야 둘이 딴말을 안 한다.
   주말엔 근무도 수업도 없다. 토요일 낮에 「보건실」「수업 중」이 떠 있었다 —
   시간표가 사람을 놓아주는 날이라 「주말」이 뜬다. 잠은 주말에도 잔다.
   isWend를 안 부르고 요일을 직접 본다 — 테스트가 이 함수만 떼어 돌린다. */
function presence(id, now){
  const d=now||nowClock(), h=d.getHours(), mm=h*60+d.getMinutes();
  const wend=d.getDay()===0||d.getDay()===6;
  /* ?awake로 깨워둔 사람은 자는 자리를 건너뛴다. 시험이 이 함수만 떼어
     돌리므로 그쪽에는 forcedAwake가 없다 — 없으면 없는 대로 잔다 */
  const up=typeof forcedAwake==="function"&&forcedAwake(id);
  const off=t=>up?{s:"away",t:"깨워둠"}:{s:"off",t};
  if(id==="jaeeon"){
    /* 네 시 반에 일어난다. 선톡(canGreet)이 이 창의 끝을 그대로 본다 —
       점은 「자는 중」인데 그 사람이 인사를 보내면 그게 처음 고치려던 그림이다.
       여섯 시였다. 그때는 세 시부터 여섯 시까지 둘 다 자는 세 시간이 있었고,
       그 시간에는 유저가 말 걸 사람이 아무도 없었다. 강현이 자러 가는 시각과
       맞물려 놓으면 한쪽이 자는 동안 다른 쪽이 깨 있다 — 이 세계에는 아무도
       없는 시간이 없어진다. 출근은 여덟 시라 세 시간 반은 집에 깨어 있다. */
    if(mm>=60&&mm<270) return off("자는 중");
    if(wend)        return {s:"on",  t:"주말"};
    if(h>=8&&h<17)  return {s:"on",  t:"보건실"};
    if(h>=17&&h<23) return {s:"away",t:"퇴근"};
    if(h>=23||h<1)  return {s:"away",t:"집"};
    return {s:"away",t:"집"};
  }
  if(id==="minhyun"){
    /* 네 시 반까지 깨 있다. 두 시로 잡아놨더니 새벽에 그가 먼저 말을 거는데
       목록의 점은 「꺼짐」이었다 — 재언 쪽을 맞춘 것과 같은 이유다.
       세 시였던 것을 재언이 일어나는 시각에 붙였다. 이 애가 자러 가는 순간
       삼촌이 일어난다 — 둘이 같이 자는 시간이 없다. */
    if(mm>=22*60||mm<270) return {s:"on",  t:"안 자는 중"};
    if(mm>=270&&mm<480)   return off("꺼짐");
    if(wend)        return {s:"on",  t:"주말"};
    /* 시간표(PERIODS)와 같은 시계를 본다. 12시 40분에 상태 버튼은 「점심」인데
       여기가 「수업 중」이면 교실이 점심에도 문틈으로 잠긴다 — 점심에 교실에서
       만나 옥상으로 가는 게 이 지도의 그림이다. 7교시(16:00~16:20)가 야자로
       새던 것도 분으로 세면 같이 잡힌다. */
    if(mm>=750&&mm<810) return {s:"away",t:"점심"};
    if(PERIODS.some(([a,b])=>mm>=a&&mm<b))return {s:"away",t:"수업 중"};
    if(mm>=PERIODS[0][0]&&mm<PERIODS[PERIODS.length-1][1])
      return {s:"away",t:"쉬는시간"};
    /* 7교시가 끝나면 야자가 있는 날만 학교에 남는다. 없는 날은 갈 데가
       없는 애가 밖에 있다 — 상태를 새로 만들지 않고 밤에 쓰던 것을 그대로
       쓴다. 어디 있다고 말하지 않는 말이라 이 애한테 맞고, AT_WORK가 아니라
       그 저녁에 편의점·빨래방에서 마주칠 수도 있게 된다. */
    if(isYajaDay(d)) return {s:"on",  t:"야자"};
    return {s:"on",  t:"안 자는 중"};
  }
  return null;
}

/* ── 관계 온도 ──
   단계 이름은 화면에 쓰지 않는다. 대놓고 쓰면 몰입이 깨진다 — 색으로만 말한다. */
// stageIdx로 색인한다 — STAGE_AT과 길이가 같아야 한다. 짧으면 마지막 단계에서 터진다.
const HEAT=[
  {w:1,  a:.28},   // 처음
  {w:1.5,a:.5 },   // 익숙
  {w:2,  a:.72},   // 균열
  {w:2.5,a:.88},   // 시한
  {w:3,  a:1  },   // 마지막 달
];
const heatRing=(ch,idx)=>({borderWidth:HEAT[idx].w+"px",borderStyle:"solid",
  borderColor:rgba(ch.dk,HEAT[idx].a)});

/* ── 🌙 관찰 쿨타임 ──
   관찰은 흔하면 값이 떨어진다. 연타로 새는 API 비용도 여기서 막힌다. */
const AUTO_COOL=5*60*1000;
/* 관전방 자동 채움 — 유저가 선물을 주거나 무언가 해금되면, 두 사람이 그 일을
   두고 이야기한다. 시계가 아니라 사건이 방아쇠다.
   다만 바로 만들지 않는다. 유저가 자리를 비운 지 한 시간쯤 지난 뒤의 일로 찍는다.
   같이 있는데 내 얘기를 하는 건 딴짓처럼 보이지만, 내가 나가고 한 시간 뒤면
   그건 내가 없는 자리에서 벌어진 일이다.
   서버 크론은 안 쓴다. 안 돌아올 사람 몫까지 미리 만들어 돈을 태우고, 지금
   백엔드는 유저별 저장소도 없다. 돌아왔을 때 만들고 시각을 과거로 찍으면
   화면에 보이는 결과는 같고 값은 돌아온 사람 수만큼만 든다. */
const AUTO_AWAY=60*60*1000;    // 이만큼 자리를 비운 뒤에 있었던 일로 찍는다
const AUTO_MAX_DAY=2;          // 하루 상한. 관전 프롬프트가 22,000자로 제일 비싸다
const loadAutoDay=()=>{try{return localStorage.getItem("null_auto_day")||""}catch(e){return""}};
const saveAutoDay=v=>{try{localStorage.setItem("null_auto_day",v)}catch(e){}};
/* 다녀온 자리 / 거절한 자리. 서버가 다음 제안을 고르는 근거다 */
/* ── 같이 간 자리 ──
   「같이 가기로 했다」를 메신저 화면 그대로 두면 둘이 마주 앉은 걸 그릴 방법이
   없다. 그래서 괄호 지문으로 때우다가 「이건 그냥 텍스트니까요」까지 갔다.
   자리에 가면 그 자리를 깔고 말풍선을 걷는다 — 화면이 「지금 여기 같이 있다」를
   대신 말해준다. 사진은 아래쪽이 다 어두워서 흰 글씨가 그냥 읽힌다. */
