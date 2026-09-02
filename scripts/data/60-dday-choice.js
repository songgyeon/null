/* NULL web · D-0 choice context for model requests
   index.html의 선언 순서가 의존 순서다. 단독 로드하지 않는다.

   D-0 화면은 선택을 저장했지만, 모델에게는 선택의 결과가 영구 상태로
   전달되지 않았다. STAY는 partner로 간접 추측할 수 있었고 LEAVE는 다음
   한 턴의 scene_reason이 사라지면 알 길이 없었다.

   결말 장면을 붙이기 전의 최소 배선이다.
   - 요청 본문에는 dday_choice를 명시적으로 싣는다.
   - 현재 워커가 읽는 summary 맨 앞에도 같은 사실을 적어 실제 프롬프트에
     도착시킨다. 새 필드를 워커가 정식 상태로 받게 되면 이 어댑터의 summary
     주입만 걷으면 된다.
   - 이것은 유저 대사가 아니다. 매 턴 되풀이하지 말고 관계의 전제로만 쓴다. */
const DDAY_CHOICE_TAG="[D-0 확정 선택 · 시스템 상태]";
const DDAY_CHOICES=["leave","stay_jaeeon","stay_minhyun"];

const loadDdayChoice=()=>{try{
  const partner=localStorage.getItem("null_partner");
  if(partner==="jaeeon")return "stay_jaeeon";
  if(partner==="minhyun")return "stay_minhyun";
  return localStorage.getItem("null_dday_ans")?"leave":null;
}catch(e){return null}};

const ddayChoiceLine=choice=>{
  const picked=choice==="leave"
    ?"유저는 D-0에 교생 실습을 끝내고 떠나기로 선택했다."
    :choice==="stay_jaeeon"
      ?"유저는 D-0에 떠나지 않고 이재언 곁에 남기로 선택했다."
      :choice==="stay_minhyun"
        ?"유저는 D-0에 떠나지 않고 이강현 곁에 남기로 선택했다."
        :"";
  return picked
    ?`${DDAY_CHOICE_TAG} ${picked} 이것은 유저가 방금 한 대사가 아니라 확정된 세계 상태다. 매 턴 되풀이하거나 다시 선택을 묻지 말고 이후의 태도와 행동에만 반영한다.`
    :"";
};

const attachDdayChoice=payload=>{
  if(!payload||(payload.mode!=="chat"&&payload.mode!=="auto"))return payload;
  const choice=loadDdayChoice();
  if(!DDAY_CHOICES.includes(choice))return payload;
  /* 4천 자에서 잘려도 선택이 살아야 하므로 맨 앞에 둔다.
     이전 요청이나 요약에 같은 줄이 남았으면 걷고 하나만 넣는다. */
  const old=String(payload.summary||"").split("\n")
    .filter(line=>!line.startsWith(DDAY_CHOICE_TAG)).join("\n").trim();
  return {...payload,dday_choice:choice,
    summary:ddayChoiceLine(choice)+(old?"\n"+old:"")};
};

/* 일반 채팅 request뿐 아니라 관전 사건의 별도 fetch에도 같은 상태를 싣는다.
   호출부가 둘이라 한쪽만 고치면 선택을 아는 세계와 모르는 세계가 생긴다. */
(()=>{
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{
    if(!init||typeof init.body!=="string")return nativeFetch(input,init);
    try{
      const payload=JSON.parse(init.body);
      const next=attachDdayChoice(payload);
      if(next!==payload)init={...init,body:JSON.stringify(next)};
    }catch(e){ /* JSON 요청이 아니면 원래 fetch 그대로 보낸다 */ }
    return nativeFetch(input,init);
  };
})();
